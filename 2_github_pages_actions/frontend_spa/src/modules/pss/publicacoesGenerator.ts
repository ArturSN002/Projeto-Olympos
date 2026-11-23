/**
 * Sprint 5.4 — Publicações Oficiais entre Fases (Google Docs via GAS + PDF FEMURN via pdfBundler.ts).
 * Aplica higienização LGPD estrita (zero telefone/e-mail/CPF integral).
 */

import {
  callGasGatewayPss,
  escPss,
  getSupabaseClientPss,
  notifyPss,
  sanitizarRegistroPublicacaoPss,
  type PssEdital
} from './pssUtils';
import type { PssSnapshotItem } from './recursosManager';

export interface PssPublicacaoItem {
  id: string;
  edital_id: string;
  snapshot_id?: string | null;
  tipo_publicacao: string;
  titulo: string;
  drive_url?: string | null;
  codigo_femurn?: string | null;
  data_circulacao_femurn?: string | null;
  publicado_em: string;
}

export function renderPublicacoesGeneratorPanel(
  container: HTMLElement,
  edital: PssEdital | null,
  snapshots: PssSnapshotItem[],
  publicacoes: PssPublicacaoItem[],
  onRefresh: () => Promise<void>
): void {
  if (!edital) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione um edital PSS para gerar publicações.</div>';
    return;
  }

  const snapOpts = snapshots.map(
    (s) => `<option value="${escPss(s.id)}">v${s.versao} — ${escPss(s.tipo_snapshot)} (${(s.dados_congelados_json || []).length} cand.)</option>`
  ).join('');

  const pubRows = publicacoes.length === 0
    ? '<p class="section-desc">Nenhuma publicação oficial emitida para este edital ainda.</p>'
    : '<div class="pss-table-scroll"><table class="clean-table" style="font-size:0.83rem;">' +
        '<thead><tr><th>Título</th><th>Tipo</th><th>Código FEMURN</th><th>Data</th><th>Acesso</th></tr></thead>' +
        '<tbody>' +
          publicacoes.map((p) => (
            '<tr>' +
              `<td><strong>${escPss(p.titulo)}</strong></td>` +
              `<td>${escPss(p.tipo_publicacao)}</td>` +
              `<td>${p.codigo_femurn ? `<span class="pill-badge pill-gold">${escPss(p.codigo_femurn)}</span>` : '<span class="section-desc">Aguardando Radar</span>'}</td>` +
              `<td>${escPss(new Date(p.publicado_em).toLocaleDateString('pt-BR'))}</td>` +
              `<td>${p.drive_url ? `<a href="${escPss(p.drive_url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Abrir Docs ↗</a>` : '--'}</td>` +
            '</tr>'
          )).join('') +
        '</tbody></table></div>';

  container.innerHTML =
    '<div class="surface-card" style="padding:20px;">' +
      '<h3 style="margin-top:0;">Publicações Oficiais LGPD (Google Docs &amp; PDF FEMURN)</h3>' +
      '<div class="pss-grid-2" style="gap:12px;">' +
        '<div>' +
          '<label for="pssPubTipoSel">Tipo de Publicação</label>' +
          '<select id="pssPubTipoSel" class="input-clean">' +
            '<option value="RESULTADO_PRELIMINAR_F1">Resultado Preliminar — 1ª Fase</option>' +
            '<option value="RESULTADO_RECURSOS_F1">Julgamento de Recursos — 1ª Fase</option>' +
            '<option value="CONVOCACAO_F2">Convocação para 2ª Fase (Entrevista/Prática)</option>' +
            '<option value="RESULTADO_PRELIMINAR_F2">Resultado Preliminar — 2ª Fase</option>' +
            '<option value="RESULTADO_FINAL">Resultado Final Homologado</option>' +
          '</select>' +
        '</div>' +
        `<div><label for="pssPubSnapSel">Snapshot Congelado</label><select id="pssPubSnapSel" class="input-clean">${snapOpts || '<option value="">Gere um snapshot na aba 7 primeiro</option>'}</select></div>` +
        '<div style="grid-column:1 / -1;"><label for="pssPubTituloInput">Título Oficial do Ato</label><input type="text" id="pssPubTituloInput" class="input-clean" value="Resultado Oficial PSS ' + escPss(edital.numero_edital) + '" /></div>' +
        '<div style="grid-column:1 / -1;"><label for="pssPubPreambuloInput">Preâmbulo Institucional</label><textarea id="pssPubPreambuloInput" class="input-clean" rows="2">A Secretaria Municipal de Educação Básica de Ceará-Mirim/RN, no uso de suas atribuições legais, torna pública a classificação oficial em conformidade com a LGPD.</textarea></div>' +
      '</div>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">' +
        '<button type="button" id="btnPssGerarDocsPub" class="btn btn-primary btn-sm">Gerar Google Docs Oficial (GAS + Acervo)</button>' +
        '<button type="button" id="btnPssGerarPdfFemurn" class="btn btn-secondary btn-sm">Gerar PDF Único FEMURN (Client-Side)</button>' +
      '</div>' +
    '</div>' +
    `<div class="surface-card" style="padding:20px; margin-top:16px;"><h3 style="margin-top:0;">Histórico de Publicações &amp; Conciliação FEMURN</h3>${pubRows}</div>`;

  const getSelectedSnapshot = (): PssSnapshotItem | null => {
    const sid = container.querySelector<HTMLSelectElement>('#pssPubSnapSel')?.value || '';
    return snapshots.find((s) => s.id === sid) || snapshots[0] || null;
  };

  container.querySelector('#btnPssGerarDocsPub')?.addEventListener('click', async () => {
    const snap = getSelectedSnapshot();
    if (!snap) {
      notifyPss('Calcule ao menos um snapshot de classificação na aba 7 antes de publicar.', true);
      return;
    }
    const tipoPub = container.querySelector<HTMLSelectElement>('#pssPubTipoSel')?.value || 'RESULTADO_PRELIMINAR_F1';
    const titulo = (container.querySelector<HTMLInputElement>('#pssPubTituloInput')?.value || '').trim();
    const preambulo = (container.querySelector<HTMLTextAreaElement>('#pssPubPreambuloInput')?.value || '').trim();
    const registrosSanitizados = (snap.dados_congelados_json || []).map((r: any) => sanitizarRegistroPublicacaoPss(r));

    try {
      const resp = await callGasGatewayPss('pss_gerar_documento_publicacao', {
        editalId: edital.id,
        numeroEdital: edital.numero_edital,
        ano: edital.ano,
        titulo,
        preambulo,
        subcategoria: 'RESULTADO_PSS',
        registros: registrosSanitizados
      });
      if (!resp || resp.ok === false) {
        notifyPss(resp?.mensagem || 'Erro ao gerar Google Docs da publicação.', true);
        return;
      }

      const client = getSupabaseClientPss();
      let docEmitidoId: number | null = null;
      if (resp.fileId && client) {
        const { data: docRow } = await client
          .from('documentos_emitidos')
          .select('id')
          .eq('drive_file_id', resp.fileId)
          .maybeSingle();
        if (docRow?.id) docEmitidoId = Number(docRow.id);
      }

      const { error: pubErr } = await client.from('pss_publicacoes').insert({
        edital_id: edital.id,
        snapshot_id: snap.id,
        tipo_publicacao: tipoPub,
        titulo,
        documento_emitido_id: docEmitidoId,
        drive_url: resp.driveUrl || null,
        texto_publico_sanitizado: resp.textoPublicoSanitizado || null
      });
      if (pubErr) {
        notifyPss(`Google Doc gerado, porém erro ao salvar publicação: ${pubErr.message}`, true);
        return;
      }
      notifyPss('Google Docs oficial gerado (LGPD mascarado) e indexado no acervo!');
      await onRefresh();
    } catch (err: any) {
      notifyPss(`Erro ao gerar publicação: ${err?.message || 'falha'}`, true);
    }
  });

  container.querySelector('#btnPssGerarPdfFemurn')?.addEventListener('click', async () => {
    const snap = getSelectedSnapshot();
    if (!snap) {
      notifyPss('Calcule um snapshot antes de gerar o PDF FEMURN.', true);
      return;
    }
    const bundler = window.OlymposPdfBundler;
    const fn = bundler?.gerarPdfUnicoConsolidado || (await import('../../core/pdfBundler')).gerarPdfUnicoConsolidado;
    const titulo = (container.querySelector<HTMLInputElement>('#pssPubTituloInput')?.value || `FEMURN_PSS_${edital.numero_edital}`).trim();
    const items = (snap.dados_congelados_json || []).map((raw: any) => {
      const r = sanitizarRegistroPublicacaoPss(raw);
      return {
        titulo: `${r.posicao}o - ${r.nome_completo}`,
        identificador: `${r.numero_inscricao} | CPF ${r.cpf_mascarado}`,
        detalhe: `${r.cargo_nome} (${r.regiao_nome}) | Nota: ${r.nota_total} | ${r.situacao}`,
        conteudo: ''
      };
    });
    await fn(items, titulo);
    notifyPss(`PDF Único FEMURN gerado com ${items.length} registro(s) sanitizado(s)!`);
  });
}
