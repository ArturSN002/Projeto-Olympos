/**
 * Sprint 5.3 — 2ª Fase Polimórfica por Cargo (Entrevista Presencial e/ou Prova Prática + Selo de Certificações).
 */

import {
  escPss,
  getSupabaseClientPss,
  notifyPss,
  type PssEdital,
  type PssEtapaConfig,
  type PssSegmento
} from './pssUtils';
import type { PssCriterioAvaliacao, PssNotaLancamento } from './gradeNotas';
import type { PssInscricaoResumo } from './triagemPanel';

export function renderSegundaFasePanel(
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
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione um edital PSS para gerenciar a 2ª Fase.</div>';
    return;
  }

  const etapasF2 = etapas.filter((e) => e.tipo_etapa === 'ENTREVISTA' || e.tipo_etapa === 'PROVA_PRATICA');
  if (etapasF2.length === 0) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Nenhuma etapa de 2ª Fase (Entrevista ou Prova Prática) configurada neste edital. Adicione na aba 1.</div>';
    return;
  }

  const segMap = new Map(segmentos.map((s) => [s.id, s]));
  const ativas = inscricoes.filter(
    (i) => i.status_triagem === 'ATIVA' && i.status_documental !== 'NAO_COMPARECEU_ELIMINADO' && i.status_documental !== 'INAPTO_HABILITACAO'
  );

  const etapaOpts = etapasF2.map(
    (e) => `<option value="${escPss(e.id)}">${escPss(e.titulo_etapa)} (${escPss(e.tipo_etapa)}${e.cargo_nome ? ' • ' + escPss(e.cargo_nome) : ''})</option>`
  ).join('');

  container.innerHTML =
    '<div class="surface-card" style="padding:20px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px;">' +
        '<div style="flex:1 1 280px;">' +
          '<label for="pssF2EtapaSelect" style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:4px;">Etapa da 2ª Fase</label>' +
          `<select id="pssF2EtapaSelect" class="input-clean">${etapaOpts}</select>` +
        '</div>' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
          '<input type="date" id="pssF2DataDefault" class="input-clean" aria-label="Data padrão de agendamento" />' +
          '<input type="text" id="pssF2LocalDefault" class="input-clean" placeholder="Local / Sala / Pista" />' +
        '</div>' +
      '</div>' +
      '<div id="pssF2ListaHost" class="pss-table-scroll" style="margin-top:16px;"></div>' +
    '</div>';

  const etapaSel = container.querySelector<HTMLSelectElement>('#pssF2EtapaSelect');
  const host = container.querySelector<HTMLElement>('#pssF2ListaHost');

  const notaByKey = new Map<string, PssNotaLancamento>();
  for (const n of notas) {
    notaByKey.set(`${n.inscricao_id}:${n.etapa_id}`, n);
  }

  const renderLista = async () => {
    if (!host) return;
    const etapaId = etapaSel?.value || etapasF2[0].id;
    const etapa = etapasF2.find((e) => e.id === etapaId) || etapasF2[0];
    let critF2 = criterios.find((c) => c.etapa_id === etapa.id);

    const elegiveis = ativas.filter((i) => {
      if (!etapa.cargo_nome) return true;
      const seg = i.segmento_id ? segMap.get(i.segmento_id) : undefined;
      return (seg?.cargo_nome || '').toLowerCase() === etapa.cargo_nome.toLowerCase();
    });

    if (elegiveis.length === 0) {
      host.innerHTML = '<div class="section-desc">Nenhum candidato habilitado para esta etapa da 2ª Fase.</div>';
      return;
    }

    const rowsHtml = elegiveis.map((i) => {
      const seg = i.segmento_id ? segMap.get(i.segmento_id) : undefined;
      const notaAtual = notaByKey.get(`${i.id}:${etapa.id}`);
      const ag = notaAtual?.agendamento_json || {};
      const certsOk = Object.entries(i.certificacoes_validadas_json || {})
        .filter(([, ok]) => Boolean(ok))
        .map(([k]) => k);
      const certBadge = seg?.exige_certificacao
        ? `<span class="pss-badge-cert-ok">Certs OK: ${escPss(certsOk.join(', ') || 'Validada')}</span>`
        : '<span class="section-desc">Não aplicável</span>';

      return (
        `<tr data-f2-row="${escPss(i.id)}">` +
          `<td><strong>${escPss(i.numero_inscricao)}</strong><br><small>${escPss(seg?.cargo_nome || '--')}</small></td>` +
          `<td>${escPss(i.pss_candidatos?.nome_completo || '--')}</td>` +
          `<td>${certBadge}</td>` +
          `<td><input type="text" class="input-clean pss-f2-agenda" data-insc-id="${escPss(i.id)}" value="${escPss(ag.horario_local || '')}" placeholder="Ex: 14h00 • Sala 02" style="min-width:150px;" /></td>` +
          '<td>' +
            `<select class="input-clean pss-f2-parecer" data-insc-id="${escPss(i.id)}">` +
              `<option value="VALIDO"${notaAtual?.status_item === 'VALIDO' ? ' selected' : ''}>Avaliado</option>` +
              `<option value="APTO"${notaAtual?.status_item === 'APTO' ? ' selected' : ''}>APTO</option>` +
              `<option value="INAPTO"${notaAtual?.status_item === 'INAPTO' ? ' selected' : ''}>INAPTO (Elim.)</option>` +
              `<option value="AUSENTE"${notaAtual?.status_item === 'AUSENTE' ? ' selected' : ''}>AUSENTE (Elim.)</option>` +
            '</select>' +
          '</td>' +
          `<td><input type="number" step="0.5" min="0" max="${critF2?.nota_maxima ?? 100}" class="pss-grade-input pss-f2-nota" data-insc-id="${escPss(i.id)}" value="${Number(notaAtual?.valor_numerico ?? 0)}" /></td>` +
          `<td><button type="button" class="btn btn-primary btn-sm pss-f2-save-btn" data-insc-id="${escPss(i.id)}">Salvar</button></td>` +
        '</tr>'
      );
    }).join('');

    host.innerHTML =
      `<table class="clean-table" style="font-size:0.84rem;">` +
        `<thead><tr><th>Inscrição</th><th>Candidato</th><th>Habilitação (Triagem)</th><th>Escala (Horário / Local)</th><th>Parecer / Presença</th><th>Nota ${escPss(etapa.tipo_etapa === 'PROVA_PRATICA' ? 'Prática' : 'Entrevista')}</th><th>Ação</th></tr></thead>` +
        `<tbody>${rowsHtml}</tbody>` +
      '</table>';

    host.querySelectorAll<HTMLElement>('.pss-f2-save-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const inscId = btn.dataset.inscId || '';
        const client = getSupabaseClientPss();
        if (!client) return;

        if (!critF2) {
          const { data: newCrit, error: critErr } = await client
            .from('pss_criterios_avaliacao')
            .insert({
              etapa_id: etapa.id,
              cargo_nome: etapa.cargo_nome || null,
              codigo: etapa.tipo_etapa === 'PROVA_PRATICA' ? 'PRATICA_GERAL' : 'ENTREVISTA_GERAL',
              rotulo: etapa.tipo_etapa === 'PROVA_PRATICA' ? 'Nota Prova Prática' : 'Nota Entrevista',
              nota_maxima: 100,
              eliminatorio: etapa.carater !== 'CLASSIFICATORIO',
              ordem: 1
            })
            .select()
            .single();
          if (critErr || !newCrit) {
            notifyPss(`Falha ao preparar critério da 2ª fase: ${critErr?.message || 'erro'}`, true);
            return;
          }
          critF2 = newCrit;
        }

        const agendaTxt = host.querySelector<HTMLInputElement>(`.pss-f2-agenda[data-insc-id="${inscId}"]`)?.value || '';
        const parecer = host.querySelector<HTMLSelectElement>(`.pss-f2-parecer[data-insc-id="${inscId}"]`)?.value || 'VALIDO';
        const notaVal = Number(host.querySelector<HTMLInputElement>(`.pss-f2-nota[data-insc-id="${inscId}"]`)?.value || 0);
        const dataDef = container.querySelector<HTMLInputElement>('#pssF2DataDefault')?.value || '';
        const localDef = container.querySelector<HTMLInputElement>('#pssF2LocalDefault')?.value || '';

        const { error } = await client
          .from('pss_notas_lancamentos')
          .upsert({
            inscricao_id: inscId,
            etapa_id: etapa.id,
            criterio_id: critF2!.id,
            valor_numerico: parecer === 'AUSENTE' ? 0 : Math.max(0, notaVal),
            status_item: parecer,
            agendamento_json: { horario_local: agendaTxt || `${dataDef} ${localDef}`.trim() }
          }, { onConflict: 'inscricao_id,criterio_id' });

        if (error) {
          notifyPss(`Erro ao salvar 2ª fase: ${error.message}`, true);
          return;
        }
        notifyPss('Avaliação da 2ª fase salva com sucesso!');
        await onRefresh();
      });
    });
  };

  void renderLista();
  etapaSel?.addEventListener('change', () => void renderLista());
}
