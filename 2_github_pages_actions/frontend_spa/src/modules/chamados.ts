import '../styles/onda2.css';
import chamadosHtml from '../templates/pages/chamados.html?raw';
import '../../js/views/chamados.js';
import { mountChamadosKanban, renderKanbanBoard, setKanbanViewMode } from './chamadosKanban';
import { openChamadoTimelineDrawer } from './chamadosTimelineDrawer';

export const routeId = 'chamados';
export const htmlTemplate = chamadosHtml;

function bindChamadosOnda2Events(): void {
  const btnTabela = document.getElementById('btnChamadosViewTabela') as any;
  const btnKanban = document.getElementById('btnChamadosViewKanban') as any;

  if (btnTabela && !btnTabela._boundOnda2) {
    btnTabela._boundOnda2 = true;
    btnTabela.addEventListener('click', () => {
      setKanbanViewMode('tabela');
    });
  }

  if (btnKanban && !btnKanban._boundOnda2) {
    btnKanban._boundOnda2 = true;
    btnKanban.addEventListener('click', () => {
      setKanbanViewMode('kanban');
    });
  }

  // Re-renderiza o Kanban quando filtros da toolbar são alterados
  const refreshKanban = () => renderKanbanBoard();
  const busca = document.getElementById('chamadosBuscaInput') as any;
  if (busca && !busca._boundKanbanFilter) {
    busca._boundKanbanFilter = true;
    busca.addEventListener('input', refreshKanban);
  }
  const setor = document.getElementById('chamadosSetorSelect') as any;
  if (setor && !setor._boundKanbanFilter) {
    setor._boundKanbanFilter = true;
    setor.addEventListener('change', refreshKanban);
  }
  const statusGroup = document.getElementById('filterStatusGroup') as any;
  if (statusGroup && !statusGroup._boundKanbanFilter) {
    statusGroup._boundKanbanFilter = true;
    statusGroup.addEventListener('click', () => setTimeout(refreshKanban, 0));
  }
  const urgGroup = document.getElementById('filterUrgenciaGroup') as any;
  if (urgGroup && !urgGroup._boundKanbanFilter) {
    urgGroup._boundKanbanFilter = true;
    urgGroup.addEventListener('click', () => setTimeout(refreshKanban, 0));
  }

  // Clique no card na visão Tabela/Lista abre o Timeline Drawer (ignorando botões de ação e links)
  const lista = document.getElementById('chamadosListaContainer') as any;
  if (lista && !lista._boundTimelineClick) {
    lista._boundTimelineClick = true;
    lista.addEventListener('click', (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('button, a, input, select, .chamado-actions, .chamado-anexos')) {
        return;
      }
      const card = target.closest('.chamado-card[data-id]') as HTMLElement | null;
      if (card) {
        const id = card.getAttribute('data-id');
        if (id) void openChamadoTimelineDrawer(id);
      }
    });
  }
}

interface ChatPrefillPendencia {
  titulo?: string;
  justificativa?: string;
  referenciaChat?: {
    sala_id?: string;
    sala_nome?: string;
    mensagem_id?: number | string;
  };
}

let activeChatRef: ChatPrefillPendencia['referenciaChat'] | null = null;
let novaPendenciaHashBound = false;

function showChamadosToast(msg: string, isErr = false): void {
  if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
    window.OlymposApp.showToast(msg, isErr);
  }
}

function abrirModalNovaPendencia(prefill?: ChatPrefillPendencia): void {
  const modal = document.getElementById('modalNovaPendenciaInterna');
  if (!modal) return;

  const assuntoEl = document.getElementById('novaPendenciaAssunto') as HTMLInputElement | null;
  const justEl = document.getElementById('novaPendenciaJustificativa') as HTMLTextAreaElement | null;
  const urgEl = document.getElementById('novaPendenciaUrgencia') as HTMLInputElement | null;
  const dataEl = document.getElementById('novaPendenciaDataLimite') as HTMLInputElement | null;
  const bannerEl = document.getElementById('novaPendenciaChatRefBanner');

  if (assuntoEl) assuntoEl.value = prefill?.titulo || '';
  if (justEl) justEl.value = prefill?.justificativa || '';
  if (urgEl) urgEl.checked = false;
  if (dataEl) dataEl.value = '';

  activeChatRef = prefill?.referenciaChat || null;
  if (bannerEl) {
    if (activeChatRef && (activeChatRef.sala_nome || activeChatRef.mensagem_id)) {
      bannerEl.textContent = `Origem vinculada ao Chat Interno: ${activeChatRef.sala_nome || 'Sala SMEB'} (Msg #${activeChatRef.mensagem_id || '--'})`;
      bannerEl.classList.remove('hidden');
    } else {
      bannerEl.textContent = '';
      bannerEl.classList.add('hidden');
    }
  }

  window.OlymposModalManager?.openModal?.(modal);
}

function consumirPrefillPendenciaDoChat(): void {
  try {
    const raw = sessionStorage.getItem('olympos_chat_prefill_pendencia');
    if (!raw) return;
    sessionStorage.removeItem('olympos_chat_prefill_pendencia');
    const parsed = JSON.parse(raw) as ChatPrefillPendencia;
    abrirModalNovaPendencia(parsed);
  } catch {
    // prefill inválido ignorado silenciosamente
  }
}

async function handleSubmitNovaPendencia(ev: Event): Promise<void> {
  ev.preventDefault();
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) {
    showChamadosToast('Autentique-se para registrar nova pendência.', true);
    return;
  }

  const assuntoEl = document.getElementById('novaPendenciaAssunto') as HTMLInputElement | null;
  const setorEl = document.getElementById('novaPendenciaSetor') as HTMLSelectElement | null;
  const urgEl = document.getElementById('novaPendenciaUrgencia') as HTMLInputElement | null;
  const dataEl = document.getElementById('novaPendenciaDataLimite') as HTMLInputElement | null;
  const justEl = document.getElementById('novaPendenciaJustificativa') as HTMLTextAreaElement | null;
  const submitBtn = document.getElementById('btnSalvarNovaPendencia') as HTMLButtonElement | null;

  const assunto = (assuntoEl?.value || '').trim();
  const setor = (setorEl?.value || 'Gabinete SMEB').trim() || 'Gabinete SMEB';
  const urgencia = Boolean(urgEl?.checked);
  const dataLimite = (dataEl?.value || '').trim() || null;
  let justificativa = (justEl?.value || '').trim();

  if (assunto.length < 3 || justificativa.length < 3) {
    showChamadosToast('Preencha assunto e descrição da pendência.', true);
    return;
  }

  if (activeChatRef && (activeChatRef.sala_nome || activeChatRef.mensagem_id)) {
    justificativa += `\n\n[Ref. Chat: Sala ${activeChatRef.sala_nome || activeChatRef.sala_id || 'SMEB'} #${activeChatRef.mensagem_id || ''}]`;
  }

  if (submitBtn) submitBtn.disabled = true;
  try {
    const sess = window.OlymposApp?.getSession?.();
    let userEmail = String(sess?.usuario || '').trim();
    if (!userEmail) {
      const authRes = await client.auth.getUser();
      userEmail = String(authRes?.data?.user?.email || '').trim() || 'interno@smeb.cearamirim.rn.gov.br';
    }
    const userName = String(sess?.nome || '').trim() || 'Operador SMEB';
    const year = new Date().getFullYear();
    const protoSuffix = String(Date.now()).slice(-6);
    const protocolo = `INT-${year}-${protoSuffix}`;

    // Inserção direta interna sem disparo de e-mail
    const { error } = await client.from('pendencias_solicitacoes').insert({
      numero_protocolo: protocolo,
      email: userEmail,
      nome: userName,
      setor,
      assunto_tipo: assunto.slice(0, 160),
      justificativa,
      urgencia,
      data_limite_entrega: dataLimite,
      status: 'PENDENTE'
    });

    if (error) {
      showChamadosToast('Erro ao registrar pendência: ' + error.message, true);
      return;
    }

    const modal = document.getElementById('modalNovaPendenciaInterna');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
    (document.getElementById('formNovaPendenciaInterna') as HTMLFormElement | null)?.reset();
    activeChatRef = null;
    document.getElementById('novaPendenciaChatRefBanner')?.classList.add('hidden');
    showChamadosToast(`Pendência ${protocolo} registrada na fila (sem envio de e-mail).`);

    if (window.OlymposViews?.chamados && typeof window.OlymposViews.chamados.carregarChamados === 'function') {
      void window.OlymposViews.chamados.carregarChamados(true);
    } else {
      document.getElementById('chamadosAtualizarBtn')?.click();
    }
    renderKanbanBoard();
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

export async function mount(): Promise<void> {
  mountChamadosKanban('chamadosKanbanRoot');
  bindChamadosOnda2Events();

  const btnNova = document.getElementById('btnNovaPendenciaInterna') as any;
  if (btnNova && !btnNova._boundOnda6) {
    btnNova._boundOnda6 = true;
    btnNova.addEventListener('click', () => abrirModalNovaPendencia());
  }

  const btnFechar = document.getElementById('btnFecharNovaPendenciaModal') as any;
  if (btnFechar && !btnFechar._boundOnda6) {
    btnFechar._boundOnda6 = true;
    btnFechar.addEventListener('click', () => {
      const m = document.getElementById('modalNovaPendenciaInterna');
      if (m) window.OlymposModalManager?.closeModal?.(m);
    });
  }

  const btnCancelar = document.getElementById('btnCancelarNovaPendencia') as any;
  if (btnCancelar && !btnCancelar._boundOnda6) {
    btnCancelar._boundOnda6 = true;
    btnCancelar.addEventListener('click', () => {
      const m = document.getElementById('modalNovaPendenciaInterna');
      if (m) window.OlymposModalManager?.closeModal?.(m);
    });
  }

  const form = document.getElementById('formNovaPendenciaInterna') as any;
  if (form && !form._boundOnda6) {
    form._boundOnda6 = true;
    form.addEventListener('submit', (ev: Event) => {
      void handleSubmitNovaPendencia(ev);
    });
  }

  if (!novaPendenciaHashBound) {
    novaPendenciaHashBound = true;
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '').trim().split(/[/?]/)[0];
      if (hash === 'chamados' || hash === 'pendencias') {
        consumirPrefillPendenciaDoChat();
      }
    });
  }

  consumirPrefillPendenciaDoChat();
}
