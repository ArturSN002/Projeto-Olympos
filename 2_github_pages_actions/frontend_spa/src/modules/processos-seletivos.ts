/**
 * Onda 5 — Módulo Lazy de Processos Seletivos Simplificados (Motor Niké PSS).
 * Carregado sob demanda via routeLoader.ts (#processos-seletivos / #pss).
 */

import '../styles/onda5.css';
import pssTemplateHtml from '../templates/pages/processos-seletivos.html?raw';
import {
  escPss,
  getSupabaseClientPss,
  notifyPss,
  type PssEdital,
  type PssEtapaConfig,
  type PssSegmento
} from './pss/pssUtils';
import { renderSchemaMapperPanel } from './pss/schemaMapper';
import { renderTriagemPanel, type PssInscricaoResumo } from './pss/triagemPanel';
import { renderCheckinDocumentalPanel } from './pss/checkinDocumental';
import { renderGradeNotasPanel, type PssCriterioAvaliacao, type PssNotaLancamento } from './pss/gradeNotas';
import { renderSegundaFasePanel } from './pss/segundaFase';
import { renderRecursosManagerPanel, type PssRecursoItem, type PssSnapshotItem } from './pss/recursosManager';
import { renderPublicacoesGeneratorPanel, type PssPublicacaoItem } from './pss/publicacoesGenerator';
import { renderConvocacoesManagerPanel, type PssConvocacaoHeader, type PssConvocacaoItem } from './pss/convocacoesManager';

export const routeId = 'processos-seletivos';
export const htmlTemplate = pssTemplateHtml;

interface PssRuntimeState {
  editais: PssEdital[];
  selectedEditalId: string;
  activeTab: string;
  showNewEditalForm: boolean;
  segmentos: PssSegmento[];
  etapas: PssEtapaConfig[];
  criterios: PssCriterioAvaliacao[];
  inscricoes: PssInscricaoResumo[];
  notas: PssNotaLancamento[];
  recursos: PssRecursoItem[];
  snapshots: PssSnapshotItem[];
  publicacoes: PssPublicacaoItem[];
  convocacoes: PssConvocacaoHeader[];
  itensConv: PssConvocacaoItem[];
}

const state: PssRuntimeState = {
  editais: [],
  selectedEditalId: '',
  activeTab: 'editais',
  showNewEditalForm: false,
  segmentos: [],
  etapas: [],
  criterios: [],
  inscricoes: [],
  notas: [],
  recursos: [],
  snapshots: [],
  publicacoes: [],
  convocacoes: [],
  itensConv: []
};

let eventsBound = false;

function getSelectedEdital(): PssEdital | null {
  return state.editais.find((e) => e.id === state.selectedEditalId) || state.editais[0] || null;
}

function renderEditaisEEtapasTab(container: HTMLElement): void {
  const edital = getSelectedEdital();
  const formHtml = (!state.showNewEditalForm && state.editais.length > 0)
    ? ''
    : '<div class="surface-card" style="padding:20px; margin-bottom:16px;">' +
        '<h3 style="margin-top:0;">Cadastrar Novo Edital PSS</h3>' +
        '<form id="pssNovoEditalForm" class="pss-grid-2" style="gap:10px;">' +
          '<div><label for="pssNewNumEdital">Número do Edital</label><input type="text" id="pssNewNumEdital" class="input-clean" placeholder="001/2026" required /></div>' +
          '<div><label for="pssNewTituloEdital">Título do PSS</label><input type="text" id="pssNewTituloEdital" class="input-clean" placeholder="PSS Contratação Temporária SMEB 2026" required /></div>' +
          '<div><label for="pssNewRegraDup">Regra de Desduplicação</label><select id="pssNewRegraDup" class="input-clean"><option value="POR_EDITAL">Última inscrição por Edital (1 cargo)</option><option value="POR_EDITAL_CARGO">Última inscrição por Edital + Cargo</option></select></div>' +
          '<div><label for="pssNewVigFim">Vigência Prevista até</label><input type="date" id="pssNewVigFim" class="input-clean" /></div>' +
          '<div style="grid-column:1 / -1;"><button type="submit" class="btn btn-primary btn-sm">Criar Edital PSS</button></div>' +
        '</form>' +
      '</div>';

  if (!edital) {
    container.innerHTML = formHtml + '<div class="surface-card" style="padding:20px;">Nenhum edital cadastrado. Crie o primeiro edital PSS acima.</div>';
    bindEditaisTabHandlers(container);
    return;
  }

  const segRows = state.segmentos.map((s) => (
    '<tr>' +
      `<td><strong>${escPss(s.cargo_nome)}</strong></td>` +
      `<td>${escPss(s.regiao_nome || 'Município Único')}</td>` +
      `<td>${s.vagas_imediatas} + ${s.vagas_cr} CR</td>` +
      `<td>${s.exige_certificacao ? escPss((s.certificacoes_exigidas_json || []).join(', ') || 'Sim') : 'Não'}</td>` +
    '</tr>'
  )).join('');

  const etapasRows = state.etapas.map((et) => (
    '<tr>' +
      `<td>${et.ordem}ª</td>` +
      `<td><strong>${escPss(et.titulo_etapa)}</strong></td>` +
      `<td>${escPss(et.tipo_etapa)}</td>` +
      `<td>${escPss(et.cargo_nome || 'Todos os cargos')}</td>` +
      `<td>${escPss(et.carater)}</td>` +
      `<td><span class="pill-badge">${escPss(et.status_etapa)}</span></td>` +
    '</tr>'
  )).join('');

  container.innerHTML =
    formHtml +
    '<div class="pss-grid-2">' +
      '<div class="surface-card" style="padding:20px;">' +
        '<h3 style="margin-top:0;">Segmentos (Cargo x Região &amp; Certificações)</h3>' +
        '<form id="pssNovoSegmentoForm" class="pss-grid-2" style="gap:8px;">' +
          '<div><label for="pssSegCargo">Cargo</label><input type="text" id="pssSegCargo" class="input-clean" placeholder="Ex: Motorista Escolar" required /></div>' +
          '<div><label for="pssSegRegiao">Região / Polo (vazio = único)</label><input type="text" id="pssSegRegiao" class="input-clean" placeholder="Ex: Zona Rural Norte" /></div>' +
          '<div><label for="pssSegVagas">Vagas Imediatas</label><input type="number" id="pssSegVagas" min="0" class="input-clean" value="5" /></div>' +
          '<div><label for="pssSegCr">Cadastro Reserva</label><input type="number" id="pssSegCr" min="0" class="input-clean" value="10" /></div>' +
          '<div style="grid-column:1 / -1;"><label for="pssSegCerts">Certificações Obrigatórias Eliminatórias (separadas por vírgula)</label><input type="text" id="pssSegCerts" class="input-clean" placeholder="Ex: CNH_D_VALIDA, CURSO_TRANSPORTE_ESCOLAR" /></div>' +
          '<div style="grid-column:1 / -1;"><button type="submit" class="btn btn-secondary btn-sm">+ Adicionar Segmento Cargo x Região</button></div>' +
        '</form>' +
        `<div class="pss-table-scroll">${state.segmentos.length ? `<table class="clean-table" style="font-size:0.82rem;"><thead><tr><th>Cargo</th><th>Região</th><th>Vagas</th><th>Certificações</th></tr></thead><tbody>${segRows}</tbody></table>` : '<p class="section-desc">Sem segmentos cadastrados.</p>'}</div>` +
      '</div>' +
      '<div class="surface-card" style="padding:20px;">' +
        '<h3 style="margin-top:0;">Trilha Polimórfica de Etapas por Cargo</h3>' +
        '<form id="pssNovaEtapaForm" class="pss-grid-2" style="gap:8px;">' +
          '<div><label for="pssEtapaTitulo">Título da Etapa</label><input type="text" id="pssEtapaTitulo" class="input-clean" placeholder="1ª Fase: Análise de Títulos" required /></div>' +
          '<div><label for="pssEtapaTipo">Modalidade</label><select id="pssEtapaTipo" class="input-clean"><option value="TITULOS">1ª Fase: Títulos / Qualificações</option><option value="TRIAGEM_DOCUMENTAL">Triagem Documental</option><option value="CHECKLIST_HABILITACAO">Checklist Habilitação</option><option value="ENTREVISTA">2ª Fase: Entrevista Presencial</option><option value="PROVA_PRATICA">2ª Fase: Prova Prática</option></select></div>' +
          '<div><label for="pssEtapaCargo">Restringir a Cargo (opcional)</label><input type="text" id="pssEtapaCargo" class="input-clean" placeholder="Motorista Escolar" /></div>' +
          '<div><label for="pssEtapaCarater">Caráter</label><select id="pssEtapaCarater" class="input-clean"><option value="CLASSIFICATORIO">Classificatório</option><option value="ELIMINATORIO">Eliminatório</option><option value="MISTO">Classificatório e Eliminatório</option></select></div>' +
          '<div style="grid-column:1 / -1;"><button type="submit" class="btn btn-secondary btn-sm">+ Adicionar Etapa ao Fluxo</button></div>' +
        '</form>' +
        `<div class="pss-table-scroll">${state.etapas.length ? `<table class="clean-table" style="font-size:0.82rem;"><thead><tr><th>Ord.</th><th>Etapa</th><th>Modalidade</th><th>Cargo</th><th>Caráter</th><th>Status</th></tr></thead><tbody>${etapasRows}</tbody></table>` : '<p class="section-desc">Nenhuma etapa configurada.</p>'}</div>` +
        '<hr style="border-color:var(--border-hairline); margin:16px 0;" />' +
        '<button type="button" id="btnPssRetencaoLgpd" class="btn btn-ghost btn-sm">Executar Anonimização / Retenção LGPD Pós-Vigência (MFA aal2)</button>' +
      '</div>' +
    '</div>';

  bindEditaisTabHandlers(container);
}

function bindEditaisTabHandlers(container: HTMLElement): void {
  container.querySelector<HTMLFormElement>('#pssNovoEditalForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const client = getSupabaseClientPss();
    if (!client) return;
    const numero_edital = (container.querySelector<HTMLInputElement>('#pssNewNumEdital')?.value || '').trim();
    const titulo = (container.querySelector<HTMLInputElement>('#pssNewTituloEdital')?.value || '').trim();
    const regra_duplicidade = container.querySelector<HTMLSelectElement>('#pssNewRegraDup')?.value || 'POR_EDITAL';
    const vigencia_fim = container.querySelector<HTMLInputElement>('#pssNewVigFim')?.value || null;

    const { data, error } = await client
      .from('pss_editais')
      .insert({ numero_edital, titulo, regra_duplicidade, vigencia_fim, status: 'EM_ANDAMENTO' })
      .select()
      .single();
    if (error) {
      notifyPss(`Erro ao criar edital PSS: ${error.message}`, true);
      return;
    }
    state.selectedEditalId = data.id;
    state.showNewEditalForm = false;
    notifyPss(`Edital PSS ${numero_edital} criado!`);
    await loadAllPssData();
  });

  const edital = getSelectedEdital();
  if (!edital) return;

  container.querySelector<HTMLFormElement>('#pssNovoSegmentoForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const client = getSupabaseClientPss();
    if (!client) return;
    const cargo_nome = (container.querySelector<HTMLInputElement>('#pssSegCargo')?.value || '').trim();
    const regiao_nome = (container.querySelector<HTMLInputElement>('#pssSegRegiao')?.value || '').trim() || null;
    const vagas_imediatas = parseInt(container.querySelector<HTMLInputElement>('#pssSegVagas')?.value || '0', 10) || 0;
    const vagas_cr = parseInt(container.querySelector<HTMLInputElement>('#pssSegCr')?.value || '0', 10) || 0;
    const certsRaw = (container.querySelector<HTMLInputElement>('#pssSegCerts')?.value || '').trim();
    const certs = certsRaw ? certsRaw.split(',').map((c) => c.trim()).filter(Boolean) : [];

    const { error } = await client.from('pss_segmentos').insert({
      edital_id: edital.id,
      cargo_nome,
      regiao_nome,
      vagas_imediatas,
      vagas_cr,
      exige_certificacao: certs.length > 0,
      certificacoes_exigidas_json: certs
    });
    if (error) {
      notifyPss(`Erro ao adicionar segmento: ${error.message}`, true);
      return;
    }
    notifyPss(`Segmento "${cargo_nome}" adicionado.`);
    await loadEditalDetails();
  });

  container.querySelector<HTMLFormElement>('#pssNovaEtapaForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const client = getSupabaseClientPss();
    if (!client) return;
    const titulo_etapa = (container.querySelector<HTMLInputElement>('#pssEtapaTitulo')?.value || '').trim();
    const tipo_etapa = container.querySelector<HTMLSelectElement>('#pssEtapaTipo')?.value || 'TITULOS';
    const cargo_nome = (container.querySelector<HTMLInputElement>('#pssEtapaCargo')?.value || '').trim() || null;
    const carater = container.querySelector<HTMLSelectElement>('#pssEtapaCarater')?.value || 'CLASSIFICATORIO';

    const { error } = await client.from('pss_etapas_config').insert({
      edital_id: edital.id,
      ordem: state.etapas.length + 1,
      titulo_etapa,
      tipo_etapa,
      cargo_nome,
      carater
    });
    if (error) {
      notifyPss(`Erro ao adicionar etapa: ${error.message}`, true);
      return;
    }
    notifyPss(`Etapa "${titulo_etapa}" configurada.`);
    await loadEditalDetails();
  });

  container.querySelector('#btnPssRetencaoLgpd')?.addEventListener('click', async () => {
    if (!window.confirm(`Confirmar verificação de retenção LGPD (anonimização pós-vigência) para o Edital ${edital.numero_edital}?`)) return;
    const client = getSupabaseClientPss();
    const { data, error } = await client.rpc('rpc_pss_aplicar_retencao_lgpd', { p_edital_id: edital.id, p_dias_apos_vigencia: 365 });
    if (error) {
      notifyPss(`Falha na retenção LGPD: ${error.message}`, true);
      return;
    }
    notifyPss(data?.ok ? `LGPD: ${data.candidatos_anonimizados} registro(s) anonimizados.` : (data?.mensagem || 'Retenção verificada.'));
  });
}

function renderActiveTab(): void {
  const edital = getSelectedEdital();
  const selEl = document.getElementById('pssEditalSelect') as HTMLSelectElement | null;
  const badgeEl = document.getElementById('pssEditalStatusBadge');

  if (selEl) {
    selEl.innerHTML = state.editais.length === 0
      ? '<option value="">Nenhum edital cadastrado</option>'
      : state.editais
          .map((e) => `<option value="${escPss(e.id)}"${e.id === edital?.id ? ' selected' : ''}>Edital ${escPss(e.numero_edital)} — ${escPss(e.titulo)}</option>`)
          .join('');
  }
  if (badgeEl) {
    badgeEl.textContent = edital ? `${edital.status} • ${edital.ano}` : 'Sem edital ativo';
  }

  const tabMap: Record<string, string> = {
    'editais': 'pssTabEditais',
    'mapeamento': 'pssTabMapeamento',
    'triagem': 'pssTabTriagem',
    'checkin': 'pssTabCheckin',
    'notas': 'pssTabNotas',
    'segunda-fase': 'pssTabSegundaFase',
    'recursos': 'pssTabRecursos',
    'publicacoes': 'pssTabPublicacoes'
  };

  Object.entries(tabMap).forEach(([tabKey, domId]) => {
    const el = document.getElementById(domId);
    if (!el) return;
    el.classList.toggle('hidden', state.activeTab !== tabKey);
  });

  document.querySelectorAll<HTMLElement>('.pss-subtab-btn').forEach((btn) => {
    const active = btn.dataset.pssTab === state.activeTab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const panel = document.getElementById(tabMap[state.activeTab] || 'pssTabEditais');
  if (!panel) return;

  switch (state.activeTab) {
    case 'editais':
      renderEditaisEEtapasTab(panel);
      break;
    case 'mapeamento':
      renderSchemaMapperPanel(panel, edital, loadEditalDetails);
      break;
    case 'triagem':
      renderTriagemPanel(panel, edital, state.segmentos, state.inscricoes, loadEditalDetails);
      break;
    case 'checkin':
      renderCheckinDocumentalPanel(panel, edital, state.segmentos, state.inscricoes, loadEditalDetails);
      break;
    case 'notas':
      renderGradeNotasPanel(panel, edital, state.segmentos, state.etapas, state.criterios, state.inscricoes, state.notas, loadEditalDetails);
      break;
    case 'segunda-fase':
      renderSegundaFasePanel(panel, edital, state.segmentos, state.etapas, state.criterios, state.inscricoes, state.notas, loadEditalDetails);
      break;
    case 'recursos':
      renderRecursosManagerPanel(panel, edital, state.etapas, state.criterios, state.inscricoes, state.recursos, state.snapshots, loadEditalDetails);
      break;
    case 'publicacoes':
      panel.innerHTML = '<div id="pssPubHostSub"></div><div id="pssConvHostSub" style="margin-top:16px;"></div>';
      renderPublicacoesGeneratorPanel(panel.querySelector('#pssPubHostSub')!, edital, state.snapshots, state.publicacoes, loadEditalDetails);
      renderConvocacoesManagerPanel(panel.querySelector('#pssConvHostSub')!, edital, state.segmentos, state.inscricoes, state.snapshots, state.convocacoes, state.itensConv, loadEditalDetails);
      break;
  }
}

async function loadEditalDetails(): Promise<void> {
  const edital = getSelectedEdital();
  const client = getSupabaseClientPss();
  if (!edital || !client) {
    renderActiveTab();
    return;
  }

  const [rSeg, rEt, rInsc, rRec, rSnap, rPub, rConv] = await Promise.all([
    client.from('pss_segmentos').select('*').eq('edital_id', edital.id).order('cargo_nome'),
    client.from('pss_etapas_config').select('*').eq('edital_id', edital.id).order('ordem'),
    client
      .from('pss_inscricoes')
      .select('id,numero_inscricao,segmento_id,submitted_at,source_row_number,status_triagem,motivo_triagem,substituida_por_id,status_documental,certificacoes_validadas_json,pss_candidatos(id,nome_completo,cpf_mascarado,data_nascimento),pss_segmentos(id,cargo_nome,regiao_nome)')
      .eq('edital_id', edital.id)
      .order('submitted_at', { ascending: false })
      .limit(1000),
    client.from('pss_recursos').select('*').eq('edital_id', edital.id).order('criado_em', { ascending: false }),
    client.from('pss_classificacao_snapshots').select('*').eq('edital_id', edital.id).order('versao', { ascending: false }),
    client.from('pss_publicacoes').select('*').eq('edital_id', edital.id).order('publicado_em', { ascending: false }),
    client.from('pss_convocacoes').select('*').eq('edital_id', edital.id).order('numero_chamada', { ascending: false })
  ]);

  state.segmentos = Array.isArray(rSeg.data) ? rSeg.data : [];
  state.etapas = Array.isArray(rEt.data) ? rEt.data : [];
  state.inscricoes = Array.isArray(rInsc.data) ? rInsc.data : [];
  state.recursos = Array.isArray(rRec.data) ? rRec.data : [];
  state.snapshots = Array.isArray(rSnap.data) ? rSnap.data : [];
  state.publicacoes = Array.isArray(rPub.data) ? rPub.data : [];
  state.convocacoes = Array.isArray(rConv.data) ? rConv.data : [];

  const etapaIds = state.etapas.map((e) => e.id);
  if (etapaIds.length > 0) {
    const [rCrit, rNotas] = await Promise.all([
      client.from('pss_criterios_avaliacao').select('*').in('etapa_id', etapaIds).order('ordem'),
      client.from('pss_notas_lancamentos').select('*').in('etapa_id', etapaIds)
    ]);
    state.criterios = Array.isArray(rCrit.data) ? rCrit.data : [];
    state.notas = Array.isArray(rNotas.data) ? rNotas.data : [];
  } else {
    state.criterios = [];
    state.notas = [];
  }

  const convIds = state.convocacoes.map((c) => c.id);
  if (convIds.length > 0) {
    const rItens = await client.from('pss_convocacoes_itens').select('*').in('convocacao_id', convIds).order('posicao_classificacao');
    state.itensConv = Array.isArray(rItens.data) ? rItens.data : [];
  } else {
    state.itensConv = [];
  }

  renderActiveTab();
}

async function loadAllPssData(): Promise<void> {
  const client = getSupabaseClientPss();
  if (!client) {
    renderActiveTab();
    return;
  }

  const { data, error } = await client.from('pss_editais').select('*').order('criado_em', { ascending: false });
  if (!error && Array.isArray(data)) {
    state.editais = data;
    if (!state.selectedEditalId && data.length > 0) {
      state.selectedEditalId = data[0].id;
    }
  }
  await loadEditalDetails();
}

export async function mount(): Promise<void> {
  if (!eventsBound) {
    eventsBound = true;
    document.getElementById('pssEditalSelect')?.addEventListener('change', (ev) => {
      state.selectedEditalId = (ev.target as HTMLSelectElement).value;
      void loadEditalDetails();
    });

    document.getElementById('btnPssAtualizarTudo')?.addEventListener('click', () => {
      void loadAllPssData();
    });

    document.getElementById('btnPssToggleNovoEdital')?.addEventListener('click', () => {
      state.showNewEditalForm = !state.showNewEditalForm;
      state.activeTab = 'editais';
      renderActiveTab();
    });

    document.getElementById('pssSubtabsNav')?.addEventListener('click', (ev) => {
      const raw = ev.target as HTMLElement | null;
      if (!raw || typeof raw.closest !== 'function') return;
      const btn = raw.closest<HTMLElement>('.pss-subtab-btn');
      if (!btn || !btn.dataset.pssTab) return;
      state.activeTab = btn.dataset.pssTab;
      renderActiveTab();
    });
  }

  if (typeof window !== 'undefined') {
    window.OlymposPss = {
      reload: loadAllPssData,
      setTab: (tab: string) => {
        state.activeTab = tab;
        renderActiveTab();
      }
    };
  }

  await loadAllPssData();
}
