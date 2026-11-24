/**
 * Onda 6 — Sprint 6.1: Mural Compartilhado SMEB.
 * Feed multi-escopo com confirmação de leitura ("Ciente"), vínculo com Agenda Intersetorial,
 * destaque/reflexo TV controlado por Gabinete/Moderador e promoção vinda do Chat Interno.
 */

import '../styles/onda6.css';
import muralHtml from '../templates/pages/mural.html?raw';
import { renderMuralCalendarStrip, AgendaEventoResumo } from './comunicacao/calendarStrip';

export const routeId = 'mural';
export const htmlTemplate = muralHtml;

type MuralScopeFilter = 'TODOS' | 'MEU_SETOR' | 'INTERSETORIAL' | 'GERAL_SMEB' | 'FIXADOS';

interface MuralPublicacaoItem {
  id: string;
  titulo: string;
  resumo: string;
  conteudo_md: string | null;
  tipo: 'NOTICIA' | 'AVISO_OPERACIONAL' | 'EVENTO_DESTAQUE' | 'COMUNICADO_GABINETE';
  escopo: 'MEU_SETOR' | 'INTERSETORIAL' | 'GERAL_SMEB';
  setores_destino: string[];
  evento_calendario_id: string | null;
  imagem_url: string | null;
  link_acao: string | null;
  fixado: boolean;
  exibir_no_kiosk: boolean;
  publicado_em: string;
  expira_em: string | null;
  autor_id: string;
  autor_nome?: string;
  autor_setor?: string;
  evento_titulo?: string | null;
  evento_data_inicio?: string | null;
  evento_horario?: string | null;
  evento_local?: string | null;
  total_confirmacoes?: number;
  eu_dei_ciente?: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  NOTICIA: 'Notícia',
  AVISO_OPERACIONAL: 'Aviso Operacional',
  EVENTO_DESTAQUE: 'Evento em Destaque',
  COMUNICADO_GABINETE: 'Comunicado de Gabinete'
};

const ESCOPO_LABELS: Record<string, string> = {
  MEU_SETOR: 'Setorial',
  INTERSETORIAL: 'Intersetorial',
  GERAL_SMEB: 'Geral SMEB'
};

let allItems: MuralPublicacaoItem[] = [];
let agendaEventosCache: AgendaEventoResumo[] = [];
let activeFilter: MuralScopeFilter = 'TODOS';
let searchTerm = '';
let currentUserId = '';
let currentUserRole = '';
let currentUserDept = '';
let mounted = false;

function esc(v: unknown): string {
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(v ?? ''));
  }
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizarUrlAcao(rawUrl: string | null | undefined): string | null {
  const txt = String(rawUrl || '').trim();
  if (!txt) return null;
  try {
    const parsed = new URL(txt);
    if (parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function formatarDataHoraPt(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(iso);
  }
}

function showToast(msg: string, isErr = false): void {
  if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
    window.OlymposApp.showToast(msg, isErr);
  }
}

function canModerateGabinete(): boolean {
  return currentUserRole === 'MODERADOR' || currentUserRole === 'ADMIN_GABINETE';
}

async function resolveSessionIdentity(): Promise<void> {
  const sess = window.OlymposApp?.getSession?.();
  currentUserRole = String(sess?.perfil?.id || '');
  currentUserDept = String(sess?.department || sess?.profile?.department || '').trim();
  if (sess?.user?.id) {
    currentUserId = String(sess.user.id);
    return;
  }
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;
  try {
    const res = await client.auth.getUser();
    currentUserId = res?.data?.user?.id || '';
  } catch {
    currentUserId = '';
  }
}

function matchesUserSector(item: MuralPublicacaoItem): boolean {
  if (item.autor_id && currentUserId && item.autor_id === currentUserId) return true;
  const targets = Array.isArray(item.setores_destino) ? item.setores_destino : [];
  const roleUp = currentUserRole.toUpperCase();
  const deptUp = currentUserDept.toUpperCase();
  return targets.some((t) => {
    const s = String(t || '').trim().toUpperCase();
    return Boolean(s && (s === roleUp || (deptUp && s === deptUp)));
  });
}

function applyFiltersAndRender(): void {
  const gridEl = document.getElementById('muralFeedGrid');
  const statusEl = document.getElementById('muralStatusInfo');
  if (!gridEl) return;

  const q = searchTerm.trim().toLowerCase();
  const filtered = allItems.filter((item) => {
    if (activeFilter === 'FIXADOS' && !item.fixado) return false;
    if (activeFilter === 'GERAL_SMEB' && item.escopo !== 'GERAL_SMEB') return false;
    if (activeFilter === 'INTERSETORIAL' && item.escopo !== 'INTERSETORIAL') return false;
    if (activeFilter === 'MEU_SETOR') {
      if (item.escopo !== 'MEU_SETOR' && !matchesUserSector(item)) return false;
    }
    if (q) {
      const hay = `${item.titulo} ${item.resumo} ${item.conteudo_md || ''} ${item.autor_nome || ''} ${(item.setores_destino || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (statusEl) {
    statusEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'publicação visível' : 'publicações visíveis'}`;
  }

  if (filtered.length === 0) {
    gridEl.innerHTML =
      '<div class="surface-card" style="grid-column: 1 / -1; text-align: center; padding: 32px;">' +
        '<p class="page-subtitle" style="margin: 0;">Nenhuma publicação encontrada para o filtro selecionado.</p>' +
      '</div>';
    return;
  }

  gridEl.innerHTML = filtered
    .map((item) => {
      const safeLink = sanitizarUrlAcao(item.link_acao);
      const isGab = item.tipo === 'COMUNICADO_GABINETE';
      const isOwnerOrMod = Boolean((currentUserId && item.autor_id === currentUserId) || canModerateGabinete());
      const cienteCount = Number(item.total_confirmacoes || 0);
      const cienteCls = item.eu_dei_ciente ? 'is-confirmed' : '';
      const setoresHtml = (item.setores_destino || []).length
        ? `<span class="mural-tag">${esc(item.setores_destino.join(' • '))}</span>`
        : '';

      return `
        <article class="mural-card ${item.fixado ? 'is-pinned' : ''}" data-mural-id="${esc(item.id)}">
          <div class="mural-card-badges">
            ${item.fixado ? '<span class="mural-tag is-pin">📌 Fixado</span>' : ''}
            <span class="mural-tag ${isGab ? 'is-gabinete' : ''}">${esc(TIPO_LABELS[item.tipo] || item.tipo)}</span>
            <span class="mural-tag">${esc(ESCOPO_LABELS[item.escopo] || item.escopo)}</span>
            ${item.exibir_no_kiosk ? '<span class="mural-tag is-tv">📺 Painel TV</span>' : ''}
            ${setoresHtml}
          </div>

          <h3 class="mural-card-title">${esc(item.titulo)}</h3>
          <p class="mural-card-summary">${esc(item.resumo)}</p>

          ${
            item.conteudo_md
              ? `<details class="mural-card-details"><summary>Ler detalhamento completo</summary><div style="margin-top:8px;white-space:pre-wrap;">${esc(item.conteudo_md)}</div></details>`
              : ''
          }

          ${
            item.evento_titulo
              ? `<div class="mural-card-event-link">
                   <span aria-hidden="true">📅</span>
                   <div>
                     <strong>${esc(item.evento_titulo)}</strong>
                     <div style="font-size:0.75rem;color:var(--text-secondary);">
                       ${esc(String(item.evento_data_inicio || '').slice(0, 10))}${item.evento_horario ? ` • ${esc(item.evento_horario)}` : ''}${item.evento_local ? ` • ${esc(item.evento_local)}` : ''}
                     </div>
                   </div>
                 </div>`
              : ''
          }

          <div class="mural-card-footer">
            <div class="mural-author-meta">
              <strong>${esc(item.autor_nome || 'Equipe SMEB')}</strong>
              <span>${esc(item.autor_setor || 'SMEB')} • ${esc(formatarDataHoraPt(item.publicado_em))}</span>
            </div>

            <div class="mural-card-actions">
              ${
                safeLink
                  ? `<a href="${esc(safeLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Abrir Link</a>`
                  : ''
              }
              <button
                type="button"
                class="mural-ciente-btn ${cienteCls}"
                data-action="toggle-ciente"
                data-id="${esc(item.id)}"
                aria-pressed="${item.eu_dei_ciente ? 'true' : 'false'}"
              >
                <span>${item.eu_dei_ciente ? '✓ Ciente' : 'Confirmar Ciente'}</span>
                <span>(${cienteCount})</span>
              </button>
              ${
                isOwnerOrMod
                  ? `<button type="button" class="btn btn-ghost btn-sm" data-action="archive-mural" data-id="${esc(item.id)}" title="Arquivar publicação">Arquivar</button>`
                  : ''
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

async function fetchMuralFeed(): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  const statusEl = document.getElementById('muralStatusInfo');
  if (!client) {
    if (statusEl) statusEl.textContent = 'Autentique-se para visualizar o Mural Compartilhado.';
    return;
  }

  if (statusEl) statusEl.textContent = 'Sincronizando mural institucional...';

  const { data, error } = await client
    .from('vw_mural_feed_ativo')
    .select('*')
    .order('fixado', { ascending: false })
    .order('publicado_em', { ascending: false })
    .limit(60);

  if (error) {
    if (statusEl) statusEl.textContent = 'Não foi possível carregar o feed do Mural.';
    showToast('Erro ao carregar Mural: ' + error.message, true);
    return;
  }

  allItems = Array.isArray(data) ? (data as MuralPublicacaoItem[]) : [];
  applyFiltersAndRender();
}

function populateAgendaSelect(eventos: AgendaEventoResumo[]): void {
  const sel = document.getElementById('muralSelectEvento') as HTMLSelectElement | null;
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">Sem vínculo direto de agenda</option>';
  eventos.forEach((ev) => {
    const opt = document.createElement('option');
    opt.value = ev.id;
    opt.textContent = `${String(ev.data_inicio).slice(0, 10)} — ${ev.titulo}`;
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;
}

function openNovaPublicacaoModal(prefill?: { titulo?: string; resumo?: string; conteudo_md?: string; eventoId?: string }): void {
  const modal = document.getElementById('modalNovaPublicacaoMural');
  if (!modal) return;

  const tituloEl = document.getElementById('muralInputTitulo') as HTMLInputElement | null;
  const resumoEl = document.getElementById('muralInputResumo') as HTMLTextAreaElement | null;
  const mdEl = document.getElementById('muralInputConteudoMd') as HTMLTextAreaElement | null;
  const linkEl = document.getElementById('muralInputLinkAcao') as HTMLInputElement | null;
  const setoresEl = document.getElementById('muralInputSetores') as HTMLInputElement | null;
  const eventoEl = document.getElementById('muralSelectEvento') as HTMLSelectElement | null;
  const flagsWrap = document.getElementById('muralGabineteFlagsWrap');
  const fixadoCheck = document.getElementById('muralCheckFixado') as HTMLInputElement | null;
  const kioskCheck = document.getElementById('muralCheckKiosk') as HTMLInputElement | null;
  const tipoEl = document.getElementById('muralSelectTipo') as HTMLSelectElement | null;

  if (tituloEl) tituloEl.value = prefill?.titulo || '';
  if (resumoEl) resumoEl.value = prefill?.resumo || '';
  if (mdEl) mdEl.value = prefill?.conteudo_md || '';
  if (linkEl) linkEl.value = '';
  if (setoresEl) setoresEl.value = '';
  if (eventoEl) eventoEl.value = prefill?.eventoId || '';
  if (fixadoCheck) fixadoCheck.checked = false;
  if (kioskCheck) kioskCheck.checked = false;

  if (tipoEl) {
    const gabOpt = tipoEl.querySelector<HTMLOptionElement>('option[value="COMUNICADO_GABINETE"]');
    if (gabOpt) {
      gabOpt.disabled = !canModerateGabinete();
    }
    if (!canModerateGabinete() && tipoEl.value === 'COMUNICADO_GABINETE') {
      tipoEl.value = 'AVISO_OPERACIONAL';
    }
  }

  if (flagsWrap) {
    flagsWrap.classList.toggle('hidden', !canModerateGabinete());
  }

  window.OlymposModalManager?.openModal?.(modal);
}

async function handleSubmitPublicacao(ev: Event): Promise<void> {
  ev.preventDefault();
  const client = window.OlymposSupabase?.getClient?.();
  if (!client || !currentUserId) {
    showToast('Autenticação institucional necessária para publicar no Mural.', true);
    return;
  }

  const titulo = ((document.getElementById('muralInputTitulo') as HTMLInputElement | null)?.value || '').trim();
  const resumo = ((document.getElementById('muralInputResumo') as HTMLTextAreaElement | null)?.value || '').trim();
  const conteudo_md = ((document.getElementById('muralInputConteudoMd') as HTMLTextAreaElement | null)?.value || '').trim() || null;
  const tipo = ((document.getElementById('muralSelectTipo') as HTMLSelectElement | null)?.value || 'AVISO_OPERACIONAL') as MuralPublicacaoItem['tipo'];
  const escopo = ((document.getElementById('muralSelectEscopo') as HTMLSelectElement | null)?.value || 'GERAL_SMEB') as MuralPublicacaoItem['escopo'];
  const setoresRaw = ((document.getElementById('muralInputSetores') as HTMLInputElement | null)?.value || '').trim();
  const eventoId = ((document.getElementById('muralSelectEvento') as HTMLSelectElement | null)?.value || '').trim() || null;
  const linkRaw = ((document.getElementById('muralInputLinkAcao') as HTMLInputElement | null)?.value || '').trim();
  const fixado = canModerateGabinete() && Boolean((document.getElementById('muralCheckFixado') as HTMLInputElement | null)?.checked);
  const exibir_no_kiosk = canModerateGabinete() && escopo === 'GERAL_SMEB' && Boolean((document.getElementById('muralCheckKiosk') as HTMLInputElement | null)?.checked);

  if (titulo.length < 2 || resumo.length < 2) {
    showToast('Informe título e resumo válidos para publicar.', true);
    return;
  }

  const safeLink = linkRaw ? sanitizarUrlAcao(linkRaw) : null;
  if (linkRaw && !safeLink) {
    showToast('Link de ação deve utilizar protocolo HTTPS válido.', true);
    return;
  }

  const setoresList = setoresRaw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if ((escopo === 'MEU_SETOR' || escopo === 'INTERSETORIAL') && setoresList.length === 0) {
    if (currentUserDept) setoresList.push(currentUserDept.toUpperCase());
    if (currentUserRole && !setoresList.includes(currentUserRole.toUpperCase())) {
      setoresList.push(currentUserRole.toUpperCase());
    }
  }

  const submitBtn = document.getElementById('btnSalvarNovaPubMural') as HTMLButtonElement | null;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { error } = await client.from('mural_publicacoes').insert({
      titulo,
      resumo,
      conteudo_md,
      tipo,
      escopo,
      setores_destino: Array.from(new Set(setoresList)),
      evento_calendario_id: eventoId,
      link_acao: safeLink,
      fixado,
      exibir_no_kiosk,
      autor_id: currentUserId
    });

    if (error) {
      showToast('Falha ao publicar no Mural: ' + error.message, true);
      return;
    }

    const modal = document.getElementById('modalNovaPublicacaoMural');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
    showToast('Publicação registrada no Mural Compartilhado.');
    await fetchMuralFeed();
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleToggleCiente(publicacaoId: string): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client || !currentUserId) return;

  const target = allItems.find((item) => item.id === publicacaoId);
  if (!target) return;

  const currentlyConfirmed = Boolean(target.eu_dei_ciente);
  if (currentlyConfirmed) {
    const { error } = await client
      .from('mural_confirmacoes_leitura')
      .delete()
      .eq('publicacao_id', publicacaoId)
      .eq('user_id', currentUserId);
    if (error) {
      showToast('Erro ao remover confirmação: ' + error.message, true);
      return;
    }
  } else {
    const { error } = await client
      .from('mural_confirmacoes_leitura')
      .upsert(
        { publicacao_id: publicacaoId, user_id: currentUserId },
        { onConflict: 'publicacao_id,user_id', ignoreDuplicates: true }
      );
    if (error) {
      showToast('Erro ao registrar Ciente: ' + error.message, true);
      return;
    }
  }

  await fetchMuralFeed();
}

async function handleArchivePublicacao(publicacaoId: string): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;
  const { error } = await client
    .from('mural_publicacoes')
    .update({ arquivado_em: new Date().toISOString(), exibir_no_kiosk: false, fixado: false })
    .eq('id', publicacaoId);
  if (error) {
    showToast('Não foi possível arquivar (verifique 2FA/AAL2 ou permissão): ' + error.message, true);
    return;
  }
  showToast('Publicação arquivada do Mural.');
  await fetchMuralFeed();
}

function consumeChatPrefill(): void {
  try {
    const raw = sessionStorage.getItem('olympos_chat_prefill_mural');
    if (!raw) return;
    sessionStorage.removeItem('olympos_chat_prefill_mural');
    const parsed = JSON.parse(raw);
    openNovaPublicacaoModal({
      titulo: parsed?.titulo || 'Comunicado Promovido do Chat Interno',
      resumo: String(parsed?.resumo || parsed?.conteudo || '').slice(0, 950),
      conteudo_md: parsed?.conteudo_md || ''
    });
  } catch {
    // ignore invalid prefill
  }
}

function bindEventsOnce(): void {
  const page = document.getElementById('page-mural');
  if (!page || page.dataset.muralBound === '1') return;
  page.dataset.muralBound = '1';

  document.getElementById('btnMuralAtualizar')?.addEventListener('click', () => {
    void refreshMuralData();
  });

  document.getElementById('btnMuralIrChat')?.addEventListener('click', () => {
    window.OlymposRouter?.navegarPara?.('chat');
  });

  document.getElementById('btnMuralAbrirCalendario')?.addEventListener('click', () => {
    window.OlymposRouter?.navegarPara?.('calendario');
  });

  document.getElementById('btnNovaPublicacaoMural')?.addEventListener('click', () => {
    openNovaPublicacaoModal();
  });

  document.getElementById('btnFecharNovaPubMural')?.addEventListener('click', () => {
    const modal = document.getElementById('modalNovaPublicacaoMural');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
  });

  document.getElementById('btnCancelarNovaPubMural')?.addEventListener('click', () => {
    const modal = document.getElementById('modalNovaPublicacaoMural');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
  });

  document.getElementById('formNovaPublicacaoMural')?.addEventListener('submit', (ev) => {
    void handleSubmitPublicacao(ev);
  });

  page.querySelectorAll<HTMLButtonElement>('[data-mural-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = (btn.dataset.muralFilter as MuralScopeFilter) || 'TODOS';
      page.querySelectorAll<HTMLButtonElement>('[data-mural-filter]').forEach((sibling) => {
        const isOn = sibling === btn;
        sibling.classList.toggle('is-active', isOn);
        sibling.setAttribute('aria-selected', isOn ? 'true' : 'false');
      });
      applyFiltersAndRender();
    });
  });

  document.getElementById('muralSearchInput')?.addEventListener('input', (ev) => {
    searchTerm = ((ev.target as HTMLInputElement)?.value || '');
    applyFiltersAndRender();
  });

  document.getElementById('muralFeedGrid')?.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;
    if (action === 'toggle-ciente') {
      void handleToggleCiente(id);
    } else if (action === 'archive-mural') {
      void handleArchivePublicacao(id);
    }
  });
}

async function refreshMuralData(): Promise<void> {
  await resolveSessionIdentity();
  const trackEl = document.getElementById('muralCalendarStripTrack');
  const [eventos] = await Promise.all([
    renderMuralCalendarStrip(trackEl, (evento) => {
      openNovaPublicacaoModal({
        titulo: `Agenda: ${evento.titulo}`,
        eventoId: evento.id
      });
    }),
    fetchMuralFeed()
  ]);
  agendaEventosCache = eventos;
  populateAgendaSelect(agendaEventosCache);
}

export async function mount(): Promise<void> {
  mounted = true;
  bindEventsOnce();
  await refreshMuralData();
  if (mounted) {
    consumeChatPrefill();
  }
}

export function unmount(): void {
  mounted = false;
}

window.OlymposMural = {
  recarregar: refreshMuralData,
  abrirNovaPublicacao: openNovaPublicacaoModal
};

if (typeof window !== 'undefined') {
  window.OlymposViews = window.OlymposViews || {};
  window.OlymposViews.mural = {
    init: () => {
      void mount();
    }
  };
}
