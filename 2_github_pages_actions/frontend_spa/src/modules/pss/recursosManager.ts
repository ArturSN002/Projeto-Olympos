/**
 * Sprint 5.3 — Motor de Recursos (1ª e 2ª Etapas) + Classificação com Desempate Legal & Snapshots SHA-256.
 */

import {
  escPss,
  getSupabaseClientPss,
  maskCpfSafe,
  notifyPss,
  type PssEdital,
  type PssEtapaConfig
} from './pssUtils';
import type { PssCriterioAvaliacao } from './gradeNotas';
import type { PssInscricaoResumo } from './triagemPanel';

export interface PssRecursoItem {
  id: string;
  edital_id: string;
  etapa_id: string;
  inscricao_id: string;
  protocolo: string;
  argumentacao_resumo: string;
  status: string;
  parecer_banca?: string | null;
  nota_anterior?: number | null;
  nota_revisada?: number | null;
  criado_em: string;
}

export interface PssSnapshotItem {
  id: string;
  edital_id: string;
  etapa_id?: string | null;
  tipo_snapshot: 'PRELIMINAR' | 'POS_RECURSO' | 'FINAL_HOMOLOGADO';
  versao: number;
  dados_congelados_json: any[];
  sha256_integridade: string;
  criado_em: string;
}

export function renderRecursosManagerPanel(
  container: HTMLElement,
  edital: PssEdital | null,
  etapas: PssEtapaConfig[],
  criterios: PssCriterioAvaliacao[],
  inscricoes: PssInscricaoResumo[],
  recursos: PssRecursoItem[],
  snapshots: PssSnapshotItem[],
  onRefresh: () => Promise<void>
): void {
  if (!edital) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione um edital PSS para gerenciar recursos e snapshots.</div>';
    return;
  }

  const ativas = inscricoes.filter((i) => i.status_triagem === 'ATIVA');
  const etapaOpts = etapas.map((e) => `<option value="${escPss(e.id)}">${escPss(e.titulo_etapa)}</option>`).join('');
  const inscOpts = ativas.map(
    (i) => `<option value="${escPss(i.id)}">${escPss(i.numero_inscricao)} — ${escPss(i.pss_candidatos?.nome_completo || '--')}</option>`
  ).join('');
  const critOpts = criterios.map((c) => `<option value="${escPss(c.id)}">${escPss(c.rotulo)} (Máx ${c.nota_maxima})</option>`).join('');

  const recursosHtml = recursos.length === 0
    ? '<p class="section-desc">Nenhum recurso protocolado até o momento.</p>'
    : '<div class="pss-table-scroll"><table class="clean-table" style="font-size:0.83rem;">' +
        '<thead><tr><th>Protocolo</th><th>Argumentação</th><th>Status</th><th>Nota</th><th>Decisão da Banca / Jurídico</th></tr></thead>' +
        '<tbody>' +
          recursos.map((r) => (
            `<tr>` +
              `<td><strong>${escPss(r.protocolo)}</strong><br><small>${escPss(new Date(r.criado_em).toLocaleDateString('pt-BR'))}</small></td>` +
              `<td>${escPss(r.argumentacao_resumo)}</td>` +
              `<td><span class="pill-badge">${escPss(r.status)}</span></td>` +
              `<td>${r.nota_anterior ?? '--'} → <strong>${r.nota_revisada ?? '--'}</strong></td>` +
              '<td>' +
                `<div style="display:flex; flex-direction:column; gap:6px; min-width:240px;">` +
                  `<input type="text" class="input-clean pss-rec-parecer" data-rec-id="${escPss(r.id)}" value="${escPss(r.parecer_banca || '')}" placeholder="Parecer motivado obrigatório..." />` +
                  `<div style="display:flex; gap:6px; flex-wrap:wrap;">` +
                    `<select class="input-clean pss-rec-crit" data-rec-id="${escPss(r.id)}" style="flex:1 1 130px;"><option value="">Sem ajuste de nota</option>${critOpts}</select>` +
                    `<input type="number" step="0.5" min="0" class="pss-grade-input pss-rec-nota" data-rec-id="${escPss(r.id)}" placeholder="Nova nota" />` +
                  '</div>' +
                  `<div style="display:flex; gap:6px;">` +
                    `<button type="button" class="btn btn-primary btn-sm pss-rec-julgar-btn" data-rec-id="${escPss(r.id)}" data-decisao="DEFERIDO">Deferir</button>` +
                    `<button type="button" class="btn btn-secondary btn-sm pss-rec-julgar-btn" data-rec-id="${escPss(r.id)}" data-decisao="DEFERIDO_PARCIAL">Parcial</button>` +
                    `<button type="button" class="btn btn-ghost btn-sm pss-rec-julgar-btn" data-rec-id="${escPss(r.id)}" data-decisao="INDEFERIDO">Indeferir</button>` +
                  '</div>' +
                '</div>' +
              '</td>' +
            '</tr>'
          )).join('') +
        '</tbody></table></div>';

  const latestSnap = snapshots[0] || null;
  const rankingPreviewHtml = !latestSnap
    ? '<p class="section-desc">Nenhum snapshot calculado. Gere o Snapshot Preliminar, Pós-Recurso ou Final Homologado.</p>'
    : `<p class="section-desc">Último Snapshot: <strong>v${latestSnap.versao} (${escPss(latestSnap.tipo_snapshot)})</strong> • SHA-256: <code>${escPss(latestSnap.sha256_integridade.slice(0, 18))}...</code> • ${(latestSnap.dados_congelados_json || []).length} registro(s)</p>` +
      '<div class="pss-table-scroll">' +
        '<table class="clean-table" style="font-size:0.83rem;">' +
          '<thead><tr><th>Pos.</th><th>Inscrição</th><th>Candidato</th><th>CPF (LGPD)</th><th>Cargo / Região</th><th>Nota</th><th>Situação</th></tr></thead>' +
          '<tbody>' +
            (latestSnap.dados_congelados_json || []).slice(0, 60).map((row: any) => (
              '<tr>' +
                `<td><strong>${escPss(row.posicao)}º</strong></td>` +
                `<td>${escPss(row.numero_inscricao)}</td>` +
                `<td>${escPss(row.nome_completo)}</td>` +
                `<td>${escPss(maskCpfSafe(row.cpf_mascarado))}</td>` +
                `<td>${escPss(row.cargo_nome)} • ${escPss(row.regiao_nome || 'Município Único')}</td>` +
                `<td><strong>${escPss(row.nota_total)}</strong></td>` +
                `<td><span class="pill-badge">${escPss(row.situacao)}</span></td>` +
              '</tr>'
            )).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';

  container.innerHTML =
    '<div class="pss-grid-2">' +
      '<div class="surface-card" style="padding:20px;">' +
        '<h3 style="margin-top:0;">Protocolar Novo Recurso Administrativo</h3>' +
        '<form id="pssNovoRecursoForm" style="display:flex; flex-direction:column; gap:10px;">' +
          `<div><label for="pssRecEtapaSel">Etapa Recorrida</label><select id="pssRecEtapaSel" class="input-clean">${etapaOpts}</select></div>` +
          `<div><label for="pssRecInscSel">Candidato (Inscrição Ativa)</label><select id="pssRecInscSel" class="input-clean">${inscOpts}</select></div>` +
          '<div><label for="pssRecArgInput">Síntese da Argumentação</label><textarea id="pssRecArgInput" class="input-clean" rows="3" required placeholder="Ex: Solicita recontagem de título de pós-graduação anexo..."></textarea></div>' +
          '<button type="submit" class="btn btn-secondary btn-sm">+ Registrar Protocolo de Recurso</button>' +
        '</form>' +
      '</div>' +
      '<div class="surface-card" style="padding:20px;">' +
        '<h3 style="margin-top:0;">Classificação Determinística &amp; Desempate Legal</h3>' +
        '<p class="section-desc">Aplica desempate em cascata (1º Estatuto do Idoso ≥ 60 anos, 2º Etapa Eliminatória, 3º Maior Idade) e gera snapshot imutável SHA-256.</p>' +
        `<div><label for="pssSnapEtapaSel">Escopo de Etapa (ou todas)</label><select id="pssSnapEtapaSel" class="input-clean" style="margin-bottom:12px;"><option value="">Todas as etapas ponderadas</option>${etapaOpts}</select></div>` +
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
          '<button type="button" class="btn btn-secondary btn-sm pss-calc-snap-btn" data-snap-tipo="PRELIMINAR">Gerar Snapshot PRELIMINAR</button>' +
          '<button type="button" class="btn btn-secondary btn-sm pss-calc-snap-btn" data-snap-tipo="POS_RECURSO">Gerar Snapshot PÓS-RECURSO</button>' +
          '<button type="button" class="btn btn-primary btn-sm pss-calc-snap-btn" data-snap-tipo="FINAL_HOMOLOGADO">Homologar FINAL (MFA aal2)</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    `<div class="surface-card" style="padding:20px; margin-top:16px;"><h3 style="margin-top:0;">Fila de Julgamento de Recursos (${recursos.length})</h3>${recursosHtml}</div>` +
    `<div class="surface-card" style="padding:20px; margin-top:16px;"><h3 style="margin-top:0;">Classificação Congelada (Snapshots Imutáveis: ${snapshots.length})</h3>${rankingPreviewHtml}</div>`;

  container.querySelector<HTMLFormElement>('#pssNovoRecursoForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const client = getSupabaseClientPss();
    if (!client) return;
    const etapaId = container.querySelector<HTMLSelectElement>('#pssRecEtapaSel')?.value || '';
    const inscId = container.querySelector<HTMLSelectElement>('#pssRecInscSel')?.value || '';
    const arg = (container.querySelector<HTMLTextAreaElement>('#pssRecArgInput')?.value || '').trim();
    if (!etapaId || !inscId || !arg) return;
    const protocolo = `REC-${edital.ano}-${Date.now().toString().slice(-6)}`;
    const { error } = await client.from('pss_recursos').insert({
      edital_id: edital.id,
      etapa_id: etapaId,
      inscricao_id: inscId,
      protocolo,
      argumentacao_resumo: arg
    });
    if (error) {
      notifyPss(`Erro ao protocolar recurso: ${error.message}`, true);
      return;
    }
    notifyPss(`Recurso ${protocolo} registrado.`);
    await onRefresh();
  });

  container.querySelectorAll<HTMLElement>('.pss-rec-julgar-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const recId = btn.dataset.recId || '';
      const decisao = btn.dataset.decisao || 'INDEFERIDO';
      const parecer = (container.querySelector<HTMLInputElement>(`.pss-rec-parecer[data-rec-id="${recId}"]`)?.value || '').trim();
      const critId = container.querySelector<HTMLSelectElement>(`.pss-rec-crit[data-rec-id="${recId}"]`)?.value || '';
      const notaVal = container.querySelector<HTMLInputElement>(`.pss-rec-nota[data-rec-id="${recId}"]`)?.value || '';

      if (parecer.length < 5) {
        notifyPss('Informe um parecer motivado (mín. 5 caracteres) para julgar o recurso.', true);
        return;
      }

      const ajustes = critId && notaVal !== ''
        ? [{ criterio_id: critId, valor_numerico: Number(notaVal), status_item: 'VALIDO' }]
        : [];

      const client = getSupabaseClientPss();
      const { data, error } = await client.rpc('rpc_pss_julgar_recurso', {
        p_recurso_id: recId,
        p_status: decisao,
        p_parecer: parecer,
        p_ajustes_criterios: ajustes
      });
      if (error) {
        notifyPss(`Erro ao julgar recurso: ${error.message}`, true);
        return;
      }
      notifyPss(`Recurso ${decisao}. Nota: ${data?.nota_anterior ?? '--'} → ${data?.nota_revisada ?? '--'}.`);
      await onRefresh();
    });
  });

  container.querySelectorAll<HTMLElement>('.pss-calc-snap-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tipoSnap = btn.dataset.snapTipo || 'PRELIMINAR';
      const etapaId = container.querySelector<HTMLSelectElement>('#pssSnapEtapaSel')?.value || null;
      const client = getSupabaseClientPss();
      const { data, error } = await client.rpc('rpc_pss_calcular_classificacao', {
        p_edital_id: edital.id,
        p_etapa_id: etapaId,
        p_tipo_snapshot: tipoSnap
      });
      if (error) {
        notifyPss(`Falha ao calcular classificação: ${error.message}`, true);
        return;
      }
      notifyPss(`Snapshot v${data?.versao || ''} (${tipoSnap}) gerado com integridade SHA-256.`);
      await onRefresh();
    });
  });
}
