/**
 * Sprint 5.4 — Fila Viva de X Convocações Anuais, Pós-Chamada & Termos de Encaminhamento em Lote ZIP.
 */

import {
  callGasGatewayPss,
  escPss,
  getSupabaseClientPss,
  maskCpfSafe,
  notifyPss,
  type PssEdital,
  type PssSegmento
} from './pssUtils';
import type { PssInscricaoResumo } from './triagemPanel';
import type { PssSnapshotItem } from './recursosManager';

export interface PssConvocacaoHeader {
  id: string;
  edital_id: string;
  numero_chamada: number;
  data_edital: string;
  prazo_comparecimento_fim: string;
  local_comparecimento: string;
  status: string;
}

export interface PssConvocacaoItem {
  id: string;
  convocacao_id: string;
  inscricao_id: string;
  segmento_id: string;
  posicao_classificacao: number;
  status_pos_chamada: string;
  termo_encaminhamento_url?: string | null;
  observacao?: string | null;
}

export function renderConvocacoesManagerPanel(
  container: HTMLElement,
  edital: PssEdital | null,
  segmentos: PssSegmento[],
  inscricoes: PssInscricaoResumo[],
  snapshots: PssSnapshotItem[],
  convocacoes: PssConvocacaoHeader[],
  itensConv: PssConvocacaoItem[],
  onRefresh: () => Promise<void>
): void {
  if (!edital) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione um edital PSS para gerenciar a Fila Viva de Convocações.</div>';
    return;
  }

  const inscMap = new Map(inscricoes.map((i) => [i.id, i]));
  const segMap = new Map(segmentos.map((s) => [s.id, s]));
  const latestSnap = snapshots.find((s) => s.tipo_snapshot === 'FINAL_HOMOLOGADO') || snapshots[0] || null;
  const chamadoStatusPorInsc = new Map<string, string>();
  for (const item of itensConv) {
    chamadoStatusPorInsc.set(item.inscricao_id, item.status_pos_chamada);
  }

  const filaCards = segmentos.map((seg) => {
    const itensSeg = itensConv.filter((ci) => ci.segmento_id === seg.id);
    const contratados = itensSeg.filter((ci) => ci.status_pos_chamada === 'CONTRATADO').length;
    const aguardando = itensSeg.filter((ci) => ci.status_pos_chamada === 'CONVOCADO' || ci.status_pos_chamada === 'COMPARECEU_APTO').length;
    const desistentes = itensSeg.filter((ci) => ci.status_pos_chamada === 'DESISTENTE' || ci.status_pos_chamada === 'AUSENTE_ELIMINADO').length;

    const listaSnap = Array.isArray(latestSnap?.dados_congelados_json) ? latestSnap!.dados_congelados_json : [];
    const proxLivre = listaSnap.find(
      (r: any) =>
        r.segmento_id === seg.id &&
        r.situacao === 'CLASSIFICADO' &&
        !chamadoStatusPorInsc.has(r.inscricao_id)
    );

    return (
      '<div class="pss-stat-card">' +
        `<div class="pss-stat-label">${escPss(seg.cargo_nome)} • ${escPss(seg.regiao_nome || 'Município Único')}</div>` +
        `<div style="margin-top:6px; font-size:0.86rem;">` +
          `Vagas: <strong>${seg.vagas_imediatas}</strong> | Contratados: <strong>${contratados}</strong><br>` +
          `Aguardando: ${aguardando} | Desist./Aus.: ${desistentes}<br>` +
          `Próximo da Fila: <strong>${proxLivre ? `#${proxLivre.posicao} (${escPss(proxLivre.nome_completo)})` : 'Fila esgotada / sem snapshot'}</strong>` +
        '</div>' +
        '<div style="margin-top:8px;">' +
          `<label style="font-size:0.78rem;">Qtd. vagas nesta chamada: <input type="number" min="0" value="0" class="pss-grade-input pss-conv-vaga-inp" data-seg-id="${escPss(seg.id)}" /></label>` +
        '</div>' +
      '</div>'
    );
  }).join('');

  const itensRows = itensConv.length === 0
    ? '<p class="section-desc">Nenhuma convocação gerada ainda neste edital.</p>'
    : '<div class="pss-table-scroll"><table class="clean-table" style="font-size:0.83rem;">' +
        '<thead><tr><th>Pos.</th><th>Candidato / Inscrição</th><th>Cargo / Região</th><th>Status Pós-Chamada</th><th>Encaminhamento</th><th>Atualizar</th></tr></thead>' +
        '<tbody>' +
          itensConv.map((ci) => {
            const insc = inscMap.get(ci.inscricao_id);
            const seg = segMap.get(ci.segmento_id);
            return (
              '<tr>' +
                `<td><strong>${ci.posicao_classificacao}º</strong></td>` +
                `<td>${escPss(insc?.pss_candidatos?.nome_completo || '--')}<br><small>${escPss(insc?.numero_inscricao || '')} • ${escPss(maskCpfSafe(insc?.pss_candidatos?.cpf_mascarado))}</small></td>` +
                `<td>${escPss(seg?.cargo_nome || '--')}<br><small>${escPss(seg?.regiao_nome || 'Município Único')}</small></td>` +
                '<td>' +
                  `<select class="input-clean pss-conv-status-sel" data-item-id="${escPss(ci.id)}">` +
                    ['CONVOCADO', 'COMPARECEU_APTO', 'CONTRATADO', 'DESISTENTE', 'AUSENTE_ELIMINADO', 'FIM_DE_FILA', 'INAPTO_MEDICO_DOC']
                      .map((st) => `<option value="${st}"${ci.status_pos_chamada === st ? ' selected' : ''}>${st}</option>`)
                      .join('') +
                  '</select>' +
                '</td>' +
                `<td>${ci.termo_encaminhamento_url ? `<a href="${escPss(ci.termo_encaminhamento_url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Docs ↗</a>` : '<span class="section-desc">Pendente</span>'}</td>` +
                `<td style="display:flex; gap:6px;"><button type="button" class="btn btn-primary btn-sm pss-conv-save-btn" data-item-id="${escPss(ci.id)}">Salvar</button></td>` +
              '</tr>'
            );
          }).join('') +
        '</tbody></table></div>';

  container.innerHTML =
    '<div class="surface-card" style="padding:20px;">' +
      '<h3 style="margin-top:0;">Fila Viva — Próxima Chamada (X Convocações Anuais)</h3>' +
      `<div class="pss-grid-3">${filaCards || '<div class="section-desc">Nenhum segmento cadastrado.</div>'}</div>` +
      '<div class="pss-grid-2" style="gap:10px; margin-top:14px;">' +
        '<div><label for="pssConvPrazoInput">Prazo de Comparecimento</label><input type="date" id="pssConvPrazoInput" class="input-clean" /></div>' +
        '<div><label for="pssConvLocalInput">Local de Comparecimento</label><input type="text" id="pssConvLocalInput" class="input-clean" value="Sede da SMEB Ceará-Mirim/RN" /></div>' +
      '</div>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">' +
        `<button type="button" id="btnPssNovaConvocacao" class="btn btn-primary btn-sm">+ Gerar ${convocacoes.length + 1}ª Convocação da Fila</button>` +
        '<button type="button" id="btnPssLoteEncaminhamentos" class="btn btn-secondary btn-sm">Gerar Termos de Encaminhamento &amp; ZIP (Aptos/Contratados)</button>' +
      '</div>' +
    '</div>' +
    `<div class="surface-card" style="padding:20px; margin-top:16px;"><h3 style="margin-top:0;">Controle Pós-Chamada (${itensConv.length} convocado(s) em ${convocacoes.length} chamada(s))</h3>${itensRows}</div>`;

  const prazoInp = container.querySelector<HTMLInputElement>('#pssConvPrazoInput');
  if (prazoInp && !prazoInp.value) {
    const dt = new Date(Date.now() + 5 * 86400000);
    prazoInp.value = dt.toISOString().slice(0, 10);
  }

  container.querySelector('#btnPssNovaConvocacao')?.addEventListener('click', async () => {
    const vagasPorSeg: Record<string, number> = {};
    container.querySelectorAll<HTMLInputElement>('.pss-conv-vaga-inp').forEach((inp) => {
      const segId = inp.dataset.segId || '';
      const qtd = parseInt(inp.value || '0', 10) || 0;
      if (segId && qtd > 0) vagasPorSeg[segId] = qtd;
    });
    if (Object.keys(vagasPorSeg).length === 0) {
      notifyPss('Informe ao menos 1 vaga em algum segmento Cargo x Região para convocar.', true);
      return;
    }

    const prazoFim = prazoInp?.value || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const localComp = (container.querySelector<HTMLInputElement>('#pssConvLocalInput')?.value || '').trim();
    const client = getSupabaseClientPss();
    const { data, error } = await client.rpc('rpc_pss_gerar_proxima_convocacao', {
      p_edital_id: edital.id,
      p_vagas_por_segmento: vagasPorSeg,
      p_prazo_fim: prazoFim,
      p_local: localComp
    });
    if (error) {
      notifyPss(`Falha ao gerar convocação: ${error.message}`, true);
      return;
    }
    notifyPss(`${data?.numero_chamada || ''}ª Convocação criada com ${data?.total_convocados ?? 0} candidato(s)!`);
    await onRefresh();
  });

  container.querySelectorAll<HTMLElement>('.pss-conv-save-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.dataset.itemId || '';
      const st = container.querySelector<HTMLSelectElement>(`.pss-conv-status-sel[data-item-id="${itemId}"]`)?.value || 'CONVOCADO';
      const client = getSupabaseClientPss();
      const { error } = await client
        .from('pss_convocacoes_itens')
        .update({ status_pos_chamada: st })
        .eq('id', itemId);
      if (error) {
        notifyPss(`Erro ao atualizar status pós-chamada: ${error.message}`, true);
        return;
      }
      notifyPss(`Status atualizado para ${st}.`);
      await onRefresh();
    });
  });

  container.querySelector('#btnPssLoteEncaminhamentos')?.addEventListener('click', async () => {
    const aptos = itensConv.filter((ci) => ci.status_pos_chamada === 'COMPARECEU_APTO' || ci.status_pos_chamada === 'CONTRATADO');
    if (aptos.length === 0) {
      notifyPss('Nenhum convocado marcado como COMPARECEU_APTO ou CONTRATADO para gerar encaminhamento.', true);
      return;
    }
    const client = getSupabaseClientPss();
    const zipItems: any[] = [];
    for (const ci of aptos) {
      const insc = inscMap.get(ci.inscricao_id);
      const seg = segMap.get(ci.segmento_id);
      const resp = await callGasGatewayPss('pss_gerar_termo_encaminhamento', {
        numeroEdital: edital.numero_edital,
        nome_completo: insc?.pss_candidatos?.nome_completo || 'Candidato',
        cpf_mascarado: insc?.pss_candidatos?.cpf_mascarado || '',
        cargo_nome: seg?.cargo_nome || '',
        regiao_nome: seg?.regiao_nome || 'Município Único',
        unidadeDestino: container.querySelector<HTMLInputElement>('#pssConvLocalInput')?.value || 'SMEB'
      });
      if (resp?.ok && resp.driveUrl) {
        await client.from('pss_convocacoes_itens').update({ termo_encaminhamento_url: resp.driveUrl }).eq('id', ci.id);
        zipItems.push({
          nome: `${resp.titulo || ci.inscricao_id}.txt`,
          titulo: resp.titulo || 'Termo Encaminhamento',
          detalhe: `${insc?.pss_candidatos?.nome_completo || ''} | ${seg?.cargo_nome || ''}`,
          url: resp.driveUrl,
          conteudo: `TERMO DE ENCAMINHAMENTO PSS ${edital.numero_edital}\nCandidato: ${insc?.pss_candidatos?.nome_completo || ''}\nCargo: ${seg?.cargo_nome || ''}\nGoogle Docs: ${resp.driveUrl}\nPDF: ${resp.pdfExportUrl || ''}\n`
        });
      }
    }

    if (zipItems.length > 0) {
      const zipFn = window.OlymposPdfBundler?.empacotarZipDocumentos || (await import('../../core/pdfBundler')).empacotarZipDocumentos;
      await zipFn(zipItems, `Encaminhamentos_PSS_${edital.numero_edital.replace(/[^\w-]+/g, '_')}.zip`);
      notifyPss(`${zipItems.length} Termo(s) de Encaminhamento gerados e empacotados em ZIP!`);
      await onRefresh();
    }
  });
}
