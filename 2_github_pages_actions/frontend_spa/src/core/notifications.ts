/**
 * Onda 1 (Sprint 1.3 — Item 1.1): Central de Notificações Persistente (Sino no Header).
 * Estado reativo com @preact/signals-core, drawer lazy e RPCs Supabase.
 */

import { signal, computed, effect } from '@preact/signals-core';

export interface NotificacaoItem {
  id: number;
  destinatario_user_id: string | null;
  destinatario_roles: string[];
  categoria: 'PENDENCIA' | 'FEMURN' | 'HOMERO' | 'CORREIO_OLIMPO' | 'SEGURANCA' | 'PSS';
  severidade: 'INFO' | 'AVISO' | 'CRITICO';
  titulo: string;
  mensagem: string;
  link_rota: string | null;
  lida_por: string[];
  criado_em: string;
}

export type NotifFilter = 'todas' | 'nao_lidas' | 'criticas';

const notificacoesSignal = signal<NotificacaoItem[]>([]);
const filtroNotifSignal = signal<NotifFilter>('todas');
const currentUserIdSignal = signal<string>('');
const drawerOpenSignal = signal<boolean>(false);
const loadingSignal = signal<boolean>(false);

let pollInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;

const CATEGORIA_LABELS: Record<string, string> = {
  PENDENCIA: 'Pendência',
  FEMURN: 'FEMURN',
  HOMERO: 'Homero',
  CORREIO_OLIMPO: 'Correio do Olimpo',
  SEGURANCA: 'Segurança',
  PSS: 'PSS / Niké'
};

function isLida(n: NotificacaoItem, uid: string): boolean {
  if (!uid) return false;
  return Array.isArray(n.lida_por) && n.lida_por.includes(uid);
}

const naoLidasCountSignal = computed(() => {
  const uid = currentUserIdSignal.value;
  return notificacoesSignal.value.filter((n) => !isLida(n, uid)).length;
});

const filtradasSignal = computed(() => {
  const uid = currentUserIdSignal.value;
  const f = filtroNotifSignal.value;
  return notificacoesSignal.value.filter((n) => {
    if (f === 'nao_lidas') return !isLida(n, uid);
    if (f === 'criticas') return n.severidade === 'CRITICO' || n.severidade === 'AVISO';
    return true;
  });
});

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(v));
  }
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarRelativo(iso: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '--';
  const diffMin = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function atualizarBadgeNoHeader(): void {
  const badge = document.getElementById('notificacoesBadge');
  const btn = document.getElementById('btnNotificacoesSino');
  const count = naoLidasCountSignal.value;
  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count <= 0);
  }
  if (btn) {
    btn.setAttribute('aria-label', count > 0 ? `Central de notificações (${count} não lida(s))` : 'Central de notificações');
    btn.setAttribute('aria-expanded', drawerOpenSignal.value ? 'true' : 'false');
  }
}

function ensureDrawerLazyDom(): HTMLElement {
  let backdrop = document.getElementById('notificacoesDrawer');
  if (backdrop) return backdrop;

  const container = document.getElementById('modal-root') || document.body;
  backdrop = document.createElement('div');
  backdrop.id = 'notificacoesDrawer';
  backdrop.className = 'modal-backdrop notif-drawer-backdrop hidden';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'notifDrawerTitle');

  backdrop.innerHTML =
    '<div class="notif-drawer-panel modal-card">' +
      '<div class="notif-drawer-header">' +
        '<div>' +
          '<span class="section-eyebrow" style="font-size: 10px;">ALERTAS EM TEMPO REAL</span>' +
          '<h3 id="notifDrawerTitle" style="margin: 2px 0 0; font-size: 1.15rem;">Central de Notificações</h3>' +
        '</div>' +
        '<button type="button" id="btnFecharNotifDrawer" class="icon-capsule-btn" aria-label="Fechar central de notificações">' +
          '✕' +
        '</button>' +
      '</div>' +
      '<div class="notif-drawer-toolbar">' +
        '<div class="notif-filter-tabs" role="tablist" aria-label="Filtrar notificações">' +
          '<button type="button" class="notif-filter-btn active" role="tab" aria-selected="true" data-notif-filter="todas">Todas</button>' +
          '<button type="button" class="notif-filter-btn" role="tab" aria-selected="false" data-notif-filter="nao_lidas">Não lidas</button>' +
          '<button type="button" class="notif-filter-btn" role="tab" aria-selected="false" data-notif-filter="criticas">Críticas</button>' +
        '</div>' +
        '<button type="button" id="btnMarcarTodasLidas" class="btn btn-ghost btn-sm">Marcar todas como lidas</button>' +
      '</div>' +
      '<div id="notifDrawerBody" class="notif-drawer-body"></div>' +
    '</div>';

  container.appendChild(backdrop);

  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) fecharDrawer();
  });

  document.getElementById('btnFecharNotifDrawer')?.addEventListener('click', fecharDrawer);
  document.getElementById('btnMarcarTodasLidas')?.addEventListener('click', () => {
    void marcarTodasLidas();
  });

  backdrop.querySelectorAll('[data-notif-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = (btn.getAttribute('data-notif-filter') || 'todas') as NotifFilter;
      filtroNotifSignal.value = f;
      backdrop!.querySelectorAll('[data-notif-filter]').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    });
  });

  document.getElementById('notifDrawerBody')?.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement | null;
    const itemBtn = target?.closest?.('[data-notif-id]') as HTMLElement | null;
    if (!itemBtn) return;
    const idNum = parseInt(itemBtn.getAttribute('data-notif-id') || '', 10);
    const link = itemBtn.getAttribute('data-notif-link') || '';
    if (!isNaN(idNum)) {
      void marcarNotificacaoLida(idNum);
    }
    fecharDrawer();
    if (link && link.startsWith('#') && window.OlymposRouter?.navegarPara) {
      window.OlymposRouter.navegarPara(link.slice(1));
    }
  });

  return backdrop;
}

function renderizarDrawerConteudo(): void {
  const body = document.getElementById('notifDrawerBody');
  if (!body) return;

  if (loadingSignal.value && notificacoesSignal.value.length === 0) {
    body.innerHTML = '<div class="output-panel">Carregando alertas...</div>';
    return;
  }

  const uid = currentUserIdSignal.value;
  const lista = filtradasSignal.value;
  if (lista.length === 0) {
    body.innerHTML =
      '<div class="output-panel" style="text-align: center; padding: 28px 16px;">' +
        'Nenhuma notificação nesta categoria.' +
      '</div>';
    return;
  }

  body.innerHTML = lista
    .map((n) => {
      const lida = isLida(n, uid);
      const sevClass = n.severidade === 'CRITICO' ? 'pill-red' : (n.severidade === 'AVISO' ? 'pill-amber' : 'pill-blue');
      const catLabel = CATEGORIA_LABELS[n.categoria] || n.categoria;
      return (
        `<button type="button" class="notif-item${lida ? ' is-read' : ' is-unread'}" data-notif-id="${n.id}" data-notif-link="${esc(n.link_rota || '')}">` +
          '<div class="notif-item-meta">' +
            `<span class="pill-badge ${sevClass}" style="font-size: 10.5px; padding: 2px 7px;">${esc(catLabel)} • ${esc(n.severidade)}</span>` +
            `<span class="notif-item-time">${esc(formatarRelativo(n.criado_em))}</span>` +
          '</div>' +
          `<div class="notif-item-title">${lida ? '' : '<span class="notif-unread-dot" aria-hidden="true"></span>'}${esc(n.titulo)}</div>` +
          `<div class="notif-item-msg">${esc(n.mensagem)}</div>` +
        '</button>'
      );
    })
    .join('');
}

export async function carregarNotificacoes(): Promise<void> {
  const sessao = window.OlymposApp?.getSession?.();
  if (!sessao || !sessao.perfil) {
    notificacoesSignal.value = [];
    currentUserIdSignal.value = '';
    return;
  }

  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;

  loadingSignal.value = true;
  try {
    let uid = currentUserIdSignal.value;
    if (!uid && typeof window.OlymposSupabase.getSession === 'function') {
      const sbSess = await window.OlymposSupabase.getSession();
      uid = sbSess?.user?.id || sessao.userId || sessao.id || '';
      currentUserIdSignal.value = uid;
    }

    const { data, error } = await client
      .from('notificacoes')
      .select('id,destinatario_user_id,destinatario_roles,categoria,severidade,titulo,mensagem,link_rota,lida_por,criado_em')
      .order('criado_em', { ascending: false })
      .limit(50);

    if (!error && Array.isArray(data)) {
      notificacoesSignal.value = data;
    }
  } catch {
    // Falha silenciosa não-bloqueante para manter experiência fluida offline/sandbox
  } finally {
    loadingSignal.value = false;
  }
}

export async function marcarNotificacaoLida(id: number): Promise<void> {
  const uid = currentUserIdSignal.value;
  if (uid) {
    notificacoesSignal.value = notificacoesSignal.value.map((n) => {
      if (n.id !== id || isLida(n, uid)) return n;
      return { ...n, lida_por: [...(n.lida_por || []), uid] };
    });
  }
  try {
    const client = window.OlymposSupabase?.getClient?.();
    if (client) {
      await client.rpc('marcar_notificacao_lida', { p_id: id });
    }
  } catch {}
}

export async function marcarTodasLidas(): Promise<void> {
  const uid = currentUserIdSignal.value;
  if (uid) {
    notificacoesSignal.value = notificacoesSignal.value.map((n) =>
      isLida(n, uid) ? n : { ...n, lida_por: [...(n.lida_por || []), uid] }
    );
  }
  try {
    const client = window.OlymposSupabase?.getClient?.();
    if (client) {
      await client.rpc('marcar_todas_lidas');
    }
    window.OlymposApp?.showToast?.('Todas as notificações foram marcadas como lidas.');
  } catch {}
}

export function abrirDrawer(): void {
  const sessao = window.OlymposApp?.getSession?.();
  if (!sessao || !sessao.perfil) {
    window.OlymposApp?.solicitarLogin?.();
    return;
  }
  const drawer = ensureDrawerLazyDom();
  drawerOpenSignal.value = true;
  drawer.classList.remove('hidden');
  renderizarDrawerConteudo();
  void carregarNotificacoes();
}

export function fecharDrawer(): void {
  drawerOpenSignal.value = false;
  const drawer = document.getElementById('notificacoesDrawer');
  if (drawer) drawer.classList.add('hidden');
}

export function toggleDrawer(): void {
  if (drawerOpenSignal.value) {
    fecharDrawer();
  } else {
    abrirDrawer();
  }
}

export function initNotifications(): void {
  if (initialized) return;
  initialized = true;

  const btnSino = document.getElementById('btnNotificacoesSino');
  if (btnSino) {
    btnSino.addEventListener('click', toggleDrawer);
  }

  effect(() => {
    atualizarBadgeNoHeader();
    if (drawerOpenSignal.value) {
      renderizarDrawerConteudo();
    }
  });

  window.addEventListener('olympos:auth-changed', () => {
    void carregarNotificacoes();
  });

  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    const sessao = window.OlymposApp?.getSession?.();
    if (sessao && sessao.perfil && !document.hidden) {
      void carregarNotificacoes();
    }
  }, 60000);

  void carregarNotificacoes();
}

if (typeof window !== 'undefined') {
  window.OlymposNotifications = {
    init: initNotifications,
    refresh: carregarNotificacoes,
    open: abrirDrawer,
    close: fecharDrawer,
    toggle: toggleDrawer,
    marcarLida: marcarNotificacaoLida,
    marcarTodasLidas
  };
}
