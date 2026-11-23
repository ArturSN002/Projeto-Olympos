/**
 * Sprint 5.2 — Check-in Documental Manual & Checklist Eliminatório de Certificações (ex.: Motorista CNH D/E).
 */

import {
  escPss,
  getSupabaseClientPss,
  maskCpfSafe,
  notifyPss,
  type PssEdital,
  type PssSegmento
} from './pssUtils';
import type { PssInscricaoResumo } from './triagemPanel';

export function renderCheckinDocumentalPanel(
  container: HTMLElement,
  edital: PssEdital | null,
  segmentos: PssSegmento[],
  inscricoes: PssInscricaoResumo[],
  onRefresh: () => Promise<void>
): void {
  if (!edital) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione um edital PSS para realizar o check-in documental.</div>';
    return;
  }

  const segMap = new Map(segmentos.map((s) => [s.id, s]));
  const ativas = inscricoes.filter((i) => i.status_triagem === 'ATIVA');

  container.innerHTML =
    '<div class="surface-card" style="padding:20px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px;">' +
        '<div>' +
          '<h3 style="margin:0;">Recebimento Documental &amp; Checklist Eliminatório de Habilitação</h3>' +
          '<p class="section-desc" style="margin:4px 0 0;">Para cargos com certificação obrigatória (ex.: Motorista), reprovar qualquer item marca automaticamente INAPTO_HABILITACAO.</p>' +
        '</div>' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
          '<input type="search" id="pssCheckinSearchInput" class="input-clean" placeholder="Buscar por nome, inscrição ou CPF mascarado..." style="min-width:260px;" />' +
        '</div>' +
      '</div>' +
      '<div id="pssCheckinListHost" class="pss-table-scroll" style="margin-top:14px;"></div>' +
    '</div>';

  const listHost = container.querySelector<HTMLElement>('#pssCheckinListHost');
  const searchInp = container.querySelector<HTMLInputElement>('#pssCheckinSearchInput');

  const renderRows = (term: string) => {
    if (!listHost) return;
    const norm = term.trim().toLowerCase();
    const filtered = ativas.filter((item) => {
      if (!norm) return true;
      const hay = `${item.numero_inscricao} ${item.pss_candidatos?.nome_completo || ''} ${item.pss_candidatos?.cpf_mascarado || ''} ${item.pss_segmentos?.cargo_nome || ''}`.toLowerCase();
      return hay.includes(norm);
    });

    if (filtered.length === 0) {
      listHost.innerHTML = '<div class="section-desc">Nenhuma inscrição ativa encontrada para check-in.</div>';
      return;
    }

    const rowsHtml = filtered.slice(0, 60).map((item) => {
      const seg = item.segmento_id ? segMap.get(item.segmento_id) : undefined;
      const certs = Array.isArray(seg?.certificacoes_exigidas_json) ? seg!.certificacoes_exigidas_json! : [];
      const validadas = item.certificacoes_validadas_json || {};
      const certsHtml = certs.length > 0
        ? certs.map((c) => `<label style="display:inline-flex; gap:4px; align-items:center; font-size:0.78rem; margin-right:8px;"><input type="checkbox" class="pss-cert-chk" data-insc-id="${escPss(item.id)}" data-cert="${escPss(c)}"${validadas[c] ? ' checked' : ''}/> ${escPss(c)}</label>`).join('')
        : '<span class="section-desc">Sem certificação eliminatória</span>';

      return (
        `<tr data-checkin-row="${escPss(item.id)}">` +
          `<td><strong>${escPss(item.numero_inscricao)}</strong></td>` +
          `<td>${escPss(item.pss_candidatos?.nome_completo || '--')}<br><small>${escPss(maskCpfSafe(item.pss_candidatos?.cpf_mascarado))}</small></td>` +
          `<td>${escPss(seg?.cargo_nome || item.pss_segmentos?.cargo_nome || '--')}<br><small>${escPss(seg?.regiao_nome || 'Município Único')}</small></td>` +
          `<td>${certsHtml}</td>` +
          `<td><span class="pill-badge">${escPss(item.status_documental)}</span></td>` +
          '<td>' +
            '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
              `<button type="button" class="btn btn-primary btn-sm pss-checkin-save-btn" data-insc-id="${escPss(item.id)}" data-status="DOCUMENTACAO_ENTREGUE">Recebido / Validar</button>` +
              `<button type="button" class="btn btn-secondary btn-sm pss-checkin-save-btn" data-insc-id="${escPss(item.id)}" data-status="DOCUMENTACAO_INCOMPLETA">Incompleta</button>` +
              `<button type="button" class="btn btn-ghost btn-sm pss-checkin-save-btn" data-insc-id="${escPss(item.id)}" data-status="NAO_COMPARECEU_ELIMINADO">Ausente</button>` +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    listHost.innerHTML =
      '<table class="clean-table" style="font-size:0.84rem;">' +
        '<thead><tr><th>Inscrição</th><th>Candidato</th><th>Cargo / Região</th><th>Certificações Exigidas</th><th>Situação Docs</th><th>Check-in</th></tr></thead>' +
        `<tbody>${rowsHtml}</tbody>` +
      '</table>';
  };

  renderRows('');
  searchInp?.addEventListener('input', () => renderRows(searchInp.value));

  listHost?.addEventListener('click', async (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    const btn = target.closest<HTMLElement>('.pss-checkin-save-btn');
    if (!btn) return;

    const inscId = btn.dataset.inscId || '';
    const statusDoc = btn.dataset.status || 'DOCUMENTACAO_ENTREGUE';
    const certsPayload: Record<string, boolean> = {};
    listHost.querySelectorAll<HTMLInputElement>(`.pss-cert-chk[data-insc-id="${inscId}"]`).forEach((chk) => {
      const k = chk.dataset.cert || '';
      if (k) certsPayload[k] = chk.checked;
    });

    const client = getSupabaseClientPss();
    if (!client) return;
    const { data, error } = await client.rpc('rpc_pss_registrar_checkin_documental', {
      p_inscricao_id: inscId,
      p_status_documental: statusDoc,
      p_certificacoes_json: certsPayload
    });

    if (error) {
      notifyPss(`Erro no check-in documental: ${error.message}`, true);
      return;
    }

    if (data?.status_documental === 'INAPTO_HABILITACAO') {
      notifyPss('Check-in registrado: candidato marcado como INAPTO_HABILITACAO por falta de certificação obrigatória.', true);
    } else {
      notifyPss(`Situação documental atualizada para ${data?.status_documental || statusDoc}.`);
    }
    await onRefresh();
  });
}
