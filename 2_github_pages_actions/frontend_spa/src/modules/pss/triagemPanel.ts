/**
 * Sprint 5.2 — Painel de Desduplicação Determinística ("Última Inscrição"),
 * Distribuição Cargo x Região e Resolução Auditada de Quarentena + Revelação PII (MFA aal2).
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

export interface PssInscricaoResumo {
  id: string;
  numero_inscricao: string;
  segmento_id?: string | null;
  submitted_at: string;
  source_row_number: number;
  status_triagem: string;
  motivo_triagem?: string | null;
  substituida_por_id?: string | null;
  status_documental: string;
  certificacoes_validadas_json?: Record<string, boolean> | null;
  pss_candidatos?: {
    id: string;
    nome_completo: string;
    cpf_mascarado: string;
    data_nascimento?: string | null;
  } | null;
  pss_segmentos?: {
    id: string;
    cargo_nome: string;
    regiao_nome?: string | null;
  } | null;
}

export function renderTriagemPanel(
  container: HTMLElement,
  edital: PssEdital | null,
  segmentos: PssSegmento[],
  inscricoes: PssInscricaoResumo[],
  onRefresh: () => Promise<void>
): void {
  if (!edital) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione um edital PSS para executar a triagem e desduplicação.</div>';
    return;
  }

  const ativas = inscricoes.filter((i) => i.status_triagem === 'ATIVA');
  const substituidas = inscricoes.filter((i) => i.status_triagem === 'SUBSTITUIDA_POR_REINSCRICAO');
  const quarentena = inscricoes.filter((i) => i.status_triagem === 'QUARENTENA_CONFLITO');
  const pendentes = inscricoes.filter((i) => i.status_triagem === 'PENDENTE');

  const segCardsHtml = segmentos.map((seg) => {
    const countSeg = ativas.filter((i) => i.segmento_id === seg.id).length;
    const totalVagas = (seg.vagas_imediatas || 0) + (seg.vagas_cr || 0);
    const ratio = seg.vagas_imediatas > 0 ? (countSeg / seg.vagas_imediatas).toFixed(1) : '--';
    return (
      '<div class="pss-stat-card">' +
        `<div class="pss-stat-label">${escPss(seg.cargo_nome)} • ${escPss(seg.regiao_nome || 'Município Único')}</div>` +
        `<div class="pss-stat-value">${countSeg}</div>` +
        `<div class="section-desc">Vagas: ${seg.vagas_imediatas} + ${seg.vagas_cr} CR • Cand/Vaga: ${escPss(ratio)}${totalVagas ? '' : ''}</div>` +
      '</div>'
    );
  }).join('');

  const quarentenaRows = quarentena.map((item) => {
    const candNome = item.pss_candidatos?.nome_completo || '--';
    const candCpf = maskCpfSafe(item.pss_candidatos?.cpf_mascarado);
    const segOpts = ['<option value="">Selecionar Cargo x Região...</option>']
      .concat(
        segmentos.map(
          (s) =>
            `<option value="${escPss(s.id)}"${s.id === item.segmento_id ? ' selected' : ''}>${escPss(s.cargo_nome)} — ${escPss(s.regiao_nome || 'Município Único')}</option>`
        )
      )
      .join('');
    return (
      `<tr data-quar-row="${escPss(item.id)}">` +
        `<td>${escPss(item.numero_inscricao)}<br><small>Linha ${item.source_row_number}</small></td>` +
        `<td>${escPss(candNome)}<br><small>${escPss(candCpf)}</small></td>` +
        `<td><span class="pill-badge pss-badge-quarentena">${escPss(item.motivo_triagem || 'Conflito de mapeamento')}</span></td>` +
        `<td><select class="input-clean pss-quar-seg-select" data-insc-id="${escPss(item.id)}">${segOpts}</select></td>` +
        '<td style="display:flex; gap:6px; flex-wrap:wrap;">' +
          `<button type="button" class="btn btn-primary btn-sm pss-quar-resolver-btn" data-insc-id="${escPss(item.id)}">Aprovar</button>` +
          `<button type="button" class="btn btn-secondary btn-sm pss-quar-indeferir-btn" data-insc-id="${escPss(item.id)}">Indeferir</button>` +
          (item.pss_candidatos?.id
            ? `<button type="button" class="btn btn-ghost btn-sm pss-revelar-pii-btn" data-cand-id="${escPss(item.pss_candidatos.id)}">Revelar PII</button>`
            : '') +
        '</td>' +
      '</tr>'
    );
  }).join('');

  const dupRows = substituidas.slice(0, 50).map((item) => (
    '<tr>' +
      `<td>${escPss(item.numero_inscricao)}</td>` +
      `<td>${escPss(item.pss_candidatos?.nome_completo || '--')}</td>` +
      `<td>${escPss(maskCpfSafe(item.pss_candidatos?.cpf_mascarado))}</td>` +
      `<td>${escPss(new Date(item.submitted_at).toLocaleString('pt-BR'))}</td>` +
      `<td><span class="pill-badge pss-badge-substituida">${escPss(item.status_triagem)}</span></td>` +
    '</tr>'
  )).join('');

  container.innerHTML =
    '<div class="surface-card" style="padding:20px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">' +
        '<div>' +
          `<h3 style="margin:0;">Desduplicação Determinística (${escPss(edital.regra_duplicidade)})</h3>` +
          '<p class="section-desc" style="margin:4px 0 0;">Prevalece a última inscrição por carimbo de data/hora; duplicatas são arquivadas em trilha auditável.</p>' +
        '</div>' +
        '<button type="button" id="btnPssExecutarDesdup" class="btn btn-primary">Executar Desduplicação (Última Inscrição)</button>' +
      '</div>' +
      '<div class="pss-grid-3" style="margin-top:16px;">' +
        `<div class="pss-stat-card"><div class="pss-stat-label">Total Bruto</div><div class="pss-stat-value">${inscricoes.length}</div><div class="section-desc">${pendentes.length} pendente(s)</div></div>` +
        `<div class="pss-stat-card"><div class="pss-stat-label">Inscrições Ativas</div><div class="pss-stat-value">${ativas.length}</div></div>` +
        `<div class="pss-stat-card"><div class="pss-stat-label">Substituídas (Histórico)</div><div class="pss-stat-value">${substituidas.length}</div></div>` +
        `<div class="pss-stat-card"><div class="pss-stat-label">Quarentena Conflito</div><div class="pss-stat-value">${quarentena.length}</div></div>` +
      '</div>' +
    '</div>' +
    `<div class="surface-card" style="padding:20px; margin-top:16px;"><h3 style="margin-top:0;">Distribuição Cargo x Região</h3><div class="pss-grid-3">${segCardsHtml || '<div class="section-desc">Nenhum segmento cadastrado.</div>'}</div></div>` +
    '<div class="surface-card" style="padding:20px; margin-top:16px;">' +
      `<h3 style="margin-top:0;">Fila de Quarentena (${quarentena.length})</h3>` +
      (quarentena.length === 0
        ? '<p class="section-desc">Nenhum conflito pendente de resolução.</p>'
        : `<div class="pss-table-scroll"><table class="clean-table"><thead><tr><th>Inscrição</th><th>Candidato</th><th>Motivo</th><th>Segmento Correto</th><th>Ações</th></tr></thead><tbody>${quarentenaRows}</tbody></table></div>`) +
    '</div>' +
    '<div class="surface-card" style="padding:20px; margin-top:16px;">' +
      `<h3 style="margin-top:0;">Relatório Auditável de Inscrições Substituídas por Duplicidade (${substituidas.length})</h3>` +
      (substituidas.length === 0
        ? '<p class="section-desc">Nenhuma reinscrição substituída até o momento.</p>'
        : `<div class="pss-table-scroll"><table class="clean-table"><thead><tr><th>Inscrição Antiga</th><th>Candidato</th><th>CPF (LGPD)</th><th>Data Envio</th><th>Status</th></tr></thead><tbody>${dupRows}</tbody></table></div>`) +
    '</div>';

  container.querySelector('#btnPssExecutarDesdup')?.addEventListener('click', async () => {
    const client = getSupabaseClientPss();
    if (!client) return;
    const { data, error } = await client.rpc('rpc_pss_executar_desduplicacao', { p_edital_id: edital.id });
    if (error) {
      notifyPss(`Erro ao desduplicar: ${error.message}`, true);
      return;
    }
    notifyPss(`Desduplicação concluída: ${data?.ativas ?? 0} ativas, ${data?.substituidas ?? 0} substituídas, ${data?.quarentena ?? 0} quarentena.`);
    await onRefresh();
  });

  container.addEventListener('click', async (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;

    const resolveBtn = target.closest<HTMLElement>('.pss-quar-resolver-btn');
    if (resolveBtn) {
      const inscId = resolveBtn.dataset.inscId || '';
      const sel = container.querySelector<HTMLSelectElement>(`.pss-quar-seg-select[data-insc-id="${inscId}"]`);
      const segId = sel?.value || '';
      if (!segId) {
        notifyPss('Selecione o segmento Cargo x Região antes de aprovar.', true);
        return;
      }
      const client = getSupabaseClientPss();
      const { error } = await client
        .from('pss_inscricoes')
        .update({
          segmento_id: segId,
          status_triagem: 'ATIVA',
          motivo_triagem: 'Conflito resolvido manualmente pela comissão'
        })
        .eq('id', inscId);
      if (error) {
        notifyPss(`Falha ao resolver quarentena: ${error.message}`, true);
        return;
      }
      notifyPss('Inscrição retirada de quarentena e ativada.');
      await onRefresh();
      return;
    }

    const indefBtn = target.closest<HTMLElement>('.pss-quar-indeferir-btn');
    if (indefBtn) {
      const inscId = indefBtn.dataset.inscId || '';
      const client = getSupabaseClientPss();
      const { error } = await client
        .from('pss_inscricoes')
        .update({
          status_triagem: 'INDEFERIDA',
          motivo_triagem: 'Indeferida em análise de quarentena'
        })
        .eq('id', inscId);
      if (error) {
        notifyPss(`Falha ao indeferir inscrição: ${error.message}`, true);
        return;
      }
      notifyPss('Inscrição marcada como INDEFERIDA.');
      await onRefresh();
      return;
    }

    const piiBtn = target.closest<HTMLElement>('.pss-revelar-pii-btn');
    if (piiBtn) {
      const candId = piiBtn.dataset.candId || '';
      const justificativa = window.prompt('Informe a justificativa formal (mín. 5 caracteres) para auditoria LGPD:', 'Conferência documental de quarentena PSS');
      if (!justificativa || justificativa.trim().length < 5) return;
      try {
        const resp = await callGasGatewayPss('pss_revelar_pii_candidato', {
          candidato_id: candId,
          justificativa: justificativa.trim()
        });
        if (!resp || resp.ok === false) {
          notifyPss(resp?.mensagem || 'Acesso negado ao revelar PII (verifique MFA aal2).', true);
          return;
        }
        const d = resp.dados || {};
        notifyPss(`PII auditado: ${d.nome_completo || ''} | CPF: ${d.cpf_decrypted || d.cpf_mascarado} | Contato: ${d.contato_decrypted || '--'}`);
      } catch (err: any) {
        notifyPss(`Erro na revelação LGPD: ${err?.message || 'falha'}`, true);
      }
    }
  });
}
