/**
 * Sprint 5.3 — Grade de Notas Dinâmica (N Colunas) + Export/Import .xlsx para Banca Especialista.
 */

import {
  escPss,
  getSupabaseClientPss,
  notifyPss,
  type PssEdital,
  type PssEtapaConfig,
  type PssSegmento
} from './pssUtils';
import type { PssInscricaoResumo } from './triagemPanel';
import { assertSafeSpreadsheetFile, sanitizeRowsForExport, sanitizeSheetRows } from '../../core/safeSpreadsheet';

export interface PssCriterioAvaliacao {
  id: string;
  etapa_id: string;
  cargo_nome?: string | null;
  codigo: string;
  rotulo: string;
  tipo: 'PONTUACAO' | 'CHECKLIST_ELIMINATORIO';
  valor_unitario: number;
  nota_maxima: number;
  eliminatorio: boolean;
  ordem: number;
}

export interface PssNotaLancamento {
  id?: string;
  inscricao_id: string;
  etapa_id: string;
  criterio_id: string;
  valor_numerico: number;
  status_item: string;
  agendamento_json?: Record<string, any> | null;
  observacao?: string | null;
}

export function renderGradeNotasPanel(
  container: HTMLElement,
  edital: PssEdital | null,
  segmentos: PssSegmento[],
  etapas: PssEtapaConfig[],
  criterios: PssCriterioAvaliacao[],
  inscricoes: PssInscricaoResumo[],
  notas: PssNotaLancamento[],
  onRefresh: () => Promise<void>
): void {
  if (!edital) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione um edital PSS para configurar critérios e lançar notas.</div>';
    return;
  }

  const etapasF1 = etapas.filter((e) => e.tipo_etapa === 'TITULOS' || e.ordem === 1);
  const etapaAtiva = etapasF1[0] || etapas[0] || null;
  if (!etapaAtiva) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Cadastre uma etapa da 1ª Fase (Títulos / Qualificações) na aba 1.</div>';
    return;
  }

  const segOpts = segmentos.map(
    (s) => `<option value="${escPss(s.id)}">${escPss(s.cargo_nome)} — ${escPss(s.regiao_nome || 'Município Único')}</option>`
  ).join('');

  container.innerHTML =
    '<div class="pss-grid-2">' +
      '<div class="surface-card" style="padding:20px;">' +
        `<h3 style="margin-top:0;">Critérios Dinâmicos (N Colunas) — ${escPss(etapaAtiva.titulo_etapa)}</h3>` +
        '<form id="pssNovoCriterioForm" class="pss-grid-2" style="gap:10px;">' +
          '<div><label for="pssCritCodigo">Código Curto</label><input type="text" id="pssCritCodigo" class="input-clean" placeholder="POS_GRAD" required /></div>' +
          '<div><label for="pssCritRotulo">Rótulo do Critério</label><input type="text" id="pssCritRotulo" class="input-clean" placeholder="Pós-Graduação 360h" required /></div>' +
          '<div><label for="pssCritCargo">Cargo Específico (vazio = todos)</label><input type="text" id="pssCritCargo" class="input-clean" placeholder="Professor" /></div>' +
          '<div><label for="pssCritMax">Teto Máximo (Pontos)</label><input type="number" step="0.5" min="0" id="pssCritMax" class="input-clean" value="10" required /></div>' +
          '<div style="grid-column:1 / -1;"><button type="submit" class="btn btn-secondary btn-sm">+ Adicionar Critério na 1ª Fase</button></div>' +
        '</form>' +
      '</div>' +
      '<div class="surface-card" style="padding:20px;">' +
        '<h3 style="margin-top:0;">Filtro da Banca &amp; Planilha .xlsx (Ida e Volta)</h3>' +
        '<div class="field-group" style="margin-bottom:10px;">' +
          '<label for="pssGradeSegFilter">Filtrar Segmento (Cargo x Região)</label>' +
          `<select id="pssGradeSegFilter" class="input-clean">${segOpts || '<option value="">Sem segmentos</option>'}</select>` +
        '</div>' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">' +
          '<button type="button" id="btnPssExportarBancaXlsx" class="btn btn-secondary btn-sm">Exportar Planilha para Banca (.xlsx)</button>' +
          '<label class="btn btn-ghost btn-sm" style="cursor:pointer;">Importar Notas da Banca (.xlsx)<input type="file" id="pssImportBancaXlsxInput" accept=".xlsx,.xls" class="hidden" /></label>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="surface-card" id="pssGradeTabelaHost" style="padding:20px; margin-top:16px;"></div>';

  const segFilter = container.querySelector<HTMLSelectElement>('#pssGradeSegFilter');
  const tableHost = container.querySelector<HTMLElement>('#pssGradeTabelaHost');

  const getFilteredContext = () => {
    const segId = segFilter?.value || segmentos[0]?.id || '';
    const seg = segmentos.find((s) => s.id === segId);
    const crits = criterios
      .filter((c) => c.etapa_id === etapaAtiva.id && (!c.cargo_nome || (seg && c.cargo_nome.toLowerCase() === seg.cargo_nome.toLowerCase())))
      .sort((a, b) => a.ordem - b.ordem);
    const inscs = inscricoes.filter(
      (i) => i.status_triagem === 'ATIVA' && (!segId || i.segmento_id === segId) && i.status_documental !== 'NAO_COMPARECEU_ELIMINADO'
    );
    return { seg, crits, inscs };
  };

  const notaIndex = new Map<string, number>();
  for (const n of notas) {
    notaIndex.set(`${n.inscricao_id}:${n.criterio_id}`, Number(n.valor_numerico || 0));
  }

  const renderGrid = () => {
    if (!tableHost) return;
    const { seg, crits, inscs } = getFilteredContext();
    if (crits.length === 0) {
      tableHost.innerHTML = '<div class="section-desc">Adicione ao menos 1 critério acima para liberar o lançamento de notas.</div>';
      return;
    }
    if (inscs.length === 0) {
      tableHost.innerHTML = '<div class="section-desc">Nenhum candidato ativo neste segmento Cargo x Região.</div>';
      return;
    }

    const headCols = crits.map((c) => `<th>${escPss(c.rotulo)}<br><small>Máx ${c.nota_maxima}</small></th>`).join('');
    const rowsHtml = inscs.map((i) => {
      let total = 0;
      const inputsHtml = crits.map((c) => {
        const val = notaIndex.get(`${i.id}:${c.id}`) ?? 0;
        total += val;
        return `<td><input type="number" step="0.5" min="0" max="${c.nota_maxima}" class="pss-grade-input" data-insc-id="${escPss(i.id)}" data-crit-id="${escPss(c.id)}" data-max="${c.nota_maxima}" value="${val}" /></td>`;
      }).join('');
      return (
        `<tr>` +
          `<td>${escPss(i.numero_inscricao)}</td>` +
          `<td>${escPss(i.pss_candidatos?.nome_completo || '--')}</td>` +
          inputsHtml +
          `<td><strong data-pss-total="${escPss(i.id)}">${total.toFixed(2)}</strong></td>` +
        '</tr>'
      );
    }).join('');

    tableHost.innerHTML =
      `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">` +
        `<h3 style="margin:0;">Grade Web — ${escPss(seg?.cargo_nome || 'Geral')} (${inscs.length} candidato(s))</h3>` +
        '<button type="button" id="btnPssSalvarTodasNotas" class="btn btn-primary btn-sm">Salvar Notas Lançadas</button>' +
      '</div>' +
      '<div class="pss-table-scroll">' +
        `<table class="clean-table"><thead><tr><th>Inscrição</th><th>Candidato</th>${headCols}<th>Total</th></tr></thead><tbody>${rowsHtml}</tbody></table>` +
      '</div>';

    tableHost.querySelectorAll<HTMLInputElement>('.pss-grade-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const max = Number(inp.dataset.max || 100);
        let num = Number(inp.value || 0);
        if (num > max) {
          num = max;
          inp.value = String(max);
          notifyPss(`Valor ajustado para o teto máximo do critério (${max}).`, true);
        }
        const inscId = inp.dataset.inscId || '';
        const sum = Array.from(tableHost.querySelectorAll<HTMLInputElement>(`.pss-grade-input[data-insc-id="${inscId}"]`))
          .reduce((acc, el) => acc + Math.max(0, Number(el.value || 0)), 0);
        const totEl = tableHost.querySelector<HTMLElement>(`[data-pss-total="${inscId}"]`);
        if (totEl) totEl.textContent = sum.toFixed(2);
      });
    });

    tableHost.querySelector('#btnPssSalvarTodasNotas')?.addEventListener('click', async () => {
      const client = getSupabaseClientPss();
      if (!client) return;
      const rowsToUpsert = Array.from(tableHost.querySelectorAll<HTMLInputElement>('.pss-grade-input')).map((inp) => ({
        inscricao_id: inp.dataset.inscId,
        etapa_id: etapaAtiva.id,
        criterio_id: inp.dataset.critId,
        valor_numerico: Math.max(0, Number(inp.value || 0)),
        status_item: 'VALIDO'
      }));
      const { error } = await client
        .from('pss_notas_lancamentos')
        .upsert(rowsToUpsert, { onConflict: 'inscricao_id,criterio_id' });
      if (error) {
        notifyPss(`Falha ao gravar notas: ${error.message}`, true);
        return;
      }
      notifyPss(`${rowsToUpsert.length} lançamento(s) salvos com sucesso!`);
      await onRefresh();
    });
  };

  renderGrid();
  segFilter?.addEventListener('change', renderGrid);

  container.querySelector<HTMLFormElement>('#pssNovoCriterioForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const client = getSupabaseClientPss();
    if (!client) return;
    const codigo = (container.querySelector<HTMLInputElement>('#pssCritCodigo')?.value || '').trim().toUpperCase();
    const rotulo = (container.querySelector<HTMLInputElement>('#pssCritRotulo')?.value || '').trim();
    const cargoNome = (container.querySelector<HTMLInputElement>('#pssCritCargo')?.value || '').trim() || null;
    const notaMax = Number(container.querySelector<HTMLInputElement>('#pssCritMax')?.value || 10);

    const { error } = await client.from('pss_criterios_avaliacao').insert({
      etapa_id: etapaAtiva.id,
      cargo_nome: cargoNome,
      codigo,
      rotulo,
      nota_maxima: notaMax,
      ordem: criterios.length + 1
    });
    if (error) {
      notifyPss(`Erro ao adicionar critério: ${error.message}`, true);
      return;
    }
    notifyPss(`Critério "${rotulo}" adicionado à 1ª fase.`);
    await onRefresh();
  });

  container.querySelector('#btnPssExportarBancaXlsx')?.addEventListener('click', async () => {
    const { seg, crits, inscs } = getFilteredContext();
    if (crits.length === 0 || inscs.length === 0) {
      notifyPss('Selecione um segmento com candidatos e critérios cadastrados para exportar.', true);
      return;
    }
    const XLSX = await import('xlsx');
    const sheetRows = inscs.map((i) => {
      const base: Record<string, any> = {
        INSCRICAO: i.numero_inscricao,
        CANDIDATO: i.pss_candidatos?.nome_completo || ''
      };
      for (const c of crits) {
        base[`${c.codigo} (MAX ${c.nota_maxima})`] = notaIndex.get(`${i.id}:${c.id}`) ?? 0;
      }
      return base;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sanitizeRowsForExport(sheetRows));
    XLSX.utils.book_append_sheet(wb, ws, 'Notas_Banca');
    const fileName = `Banca_${edital.numero_edital.replace(/[^\w-]+/g, '_')}_${(seg?.cargo_nome || 'Geral').replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    notifyPss(`Planilha "${fileName}" gerada para a banca.`);
  });

  container.querySelector<HTMLInputElement>('#pssImportBancaXlsxInput')?.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    assertSafeSpreadsheetFile(file);
    const { crits, inscs } = getFilteredContext();
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const rows = sanitizeSheetRows<Record<string, any>>(
      XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: 0 })
    );
    const inscByNum = new Map(inscs.map((i) => [i.numero_inscricao, i.id]));
    const payloads: any[] = [];
    const avisos: string[] = [];

    for (const r of rows) {
      const inscId = inscByNum.get(String(r.INSCRICAO || '').trim());
      if (!inscId) continue;
      for (const c of crits) {
        const key = Object.keys(r).find((k) => k === c.codigo || k.startsWith(`${c.codigo} (`));
        if (!key) continue;
        const val = Number(r[key] ?? 0);
        if (!Number.isFinite(val) || val < 0) continue;
        if (val > c.nota_maxima) {
          avisos.push(`${r.INSCRICAO} (${c.codigo}): ${val} > máx ${c.nota_maxima}`);
          continue;
        }
        payloads.push({
          inscricao_id: inscId,
          etapa_id: etapaAtiva.id,
          criterio_id: c.id,
          valor_numerico: val,
          status_item: 'VALIDO'
        });
      }
    }

    if (avisos.length > 0) {
      notifyPss(`Planilha rejeitada por notas acima do teto: ${avisos.slice(0, 3).join('; ')}`, true);
      return;
    }
    if (payloads.length === 0) {
      notifyPss('Nenhuma nota correspondente encontrada na planilha enviada.', true);
      return;
    }
    if (!window.confirm(`Confirmar importação de ${payloads.length} lançamento(s) de notas da planilha "${file.name}"?`)) {
      return;
    }

    const client = getSupabaseClientPss();
    const { error } = await client.from('pss_notas_lancamentos').upsert(payloads, { onConflict: 'inscricao_id,criterio_id' });
    if (error) {
      notifyPss(`Erro ao importar notas: ${error.message}`, true);
      return;
    }
    notifyPss(`${payloads.length} nota(s) importadas e validadas com sucesso!`);
    await onRefresh();
  });
}
