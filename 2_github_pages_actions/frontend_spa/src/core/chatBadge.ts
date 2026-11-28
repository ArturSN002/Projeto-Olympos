/**
 * Contador reativo leve para mensagens não lidas do Chat Interno.
 * Atualiza o badge no cabeçalho (#chatHeaderBadge) e notifica listeners da página #chat.
 */

import { signal, computed } from '@preact/signals-core';

export const chatUnreadByRoomSignal = signal<Record<string, number>>({});
export const chatTotalUnreadSignal = computed(() => {
  const map = chatUnreadByRoomSignal.value;
  return Object.values(map).reduce((acc, qty) => acc + (Number.isFinite(qty) ? qty : 0), 0);
});

let realtimeBadgeChannel: any = null;
let badgePollTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;
let currentUserIdCache: string | null = null;
const roomChangeListeners = new Set<() => void>();

function renderHeaderChatBadge(): void {
  const badgeEl = document.getElementById('chatHeaderBadge');
  const btnEl = document.getElementById('btnChatHeaderBadge');
  const total = chatTotalUnreadSignal.value;

  if (badgeEl) {
    if (total > 0) {
      badgeEl.textContent = total > 99 ? '99+' : String(total);
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.textContent = '0';
      badgeEl.classList.add('hidden');
    }
  }
  if (btnEl) {
    btnEl.classList.toggle('has-unread', total > 0);
    btnEl.setAttribute(
      'aria-label',
      total > 0 ? `Chat Interno (${total} mensagens não lidas)` : 'Abrir Chat Interno'
    );
  }
}

async function resolveCurrentUserId(): Promise<string | null> {
  const sess = window.OlymposApp?.getSession?.();
  if (sess && sess.user && sess.user.id) {
    currentUserIdCache = String(sess.user.id);
    return currentUserIdCache;
  }
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return null;
  try {
    const res = await client.auth.getUser();
    const uid = res?.data?.user?.id || null;
    currentUserIdCache = uid;
    return uid;
  } catch {
    return null;
  }
}

export async function refreshChatUnreadCounts(): Promise<Record<string, number>> {
  const sess = window.OlymposApp?.getSession?.();
  if (!sess || !sess.perfil) {
    chatUnreadByRoomSignal.value = {};
    renderHeaderChatBadge();
    return {};
  }

  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return chatUnreadByRoomSignal.value;

  void bindGlobalBadgeRealtime();

  try {
    const { data, error } = await client.rpc('rpc_chat_contar_nao_lidas');
    if (error || !Array.isArray(data)) return chatUnreadByRoomSignal.value;

    const next: Record<string, number> = {};
    for (const row of data) {
      if (row && row.sala_id) {
        next[String(row.sala_id)] = Number(row.nao_lidas || 0);
      }
    }
    chatUnreadByRoomSignal.value = next;
    renderHeaderChatBadge();
    roomChangeListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore listener failure
      }
    });
    return next;
  } catch {
    return chatUnreadByRoomSignal.value;
  }
}

async function bindGlobalBadgeRealtime(): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  const sess = window.OlymposApp?.getSession?.();
  if (!client || !sess || !sess.perfil) return;

  await resolveCurrentUserId();
  if (realtimeBadgeChannel) return;

  try {
    realtimeBadgeChannel = client
      .channel('olympos-chat-badge-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensagens' },
        (payload: any) => {
          const row = payload?.new;
          if (row && currentUserIdCache && row.remetente_id === currentUserIdCache) {
            return;
          }
          void refreshChatUnreadCounts();
        }
      )
      .subscribe();
  } catch {
    realtimeBadgeChannel = null;
  }
}

export function onChatUnreadUpdated(cb: () => void): () => void {
  roomChangeListeners.add(cb);
  return () => roomChangeListeners.delete(cb);
}

export function clearChatBadgeOnLogout(): void {
  const client = window.OlymposSupabase?.getClient?.();
  if (client && realtimeBadgeChannel) {
    try {
      void client.removeChannel(realtimeBadgeChannel);
    } catch {
      // ignore
    }
  }
  realtimeBadgeChannel = null;
  currentUserIdCache = null;
  chatUnreadByRoomSignal.value = {};
  renderHeaderChatBadge();
}

export function initChatBadge(): void {
  if (initialized) {
    void refreshChatUnreadCounts();
    void bindGlobalBadgeRealtime();
    return;
  }
  initialized = true;

  const btnEl = document.getElementById('btnChatHeaderBadge');
  if (btnEl && !btnEl.dataset.chatBadgeBound) {
    btnEl.dataset.chatBadgeBound = '1';
    btnEl.addEventListener('click', () => {
      if (window.OlymposRouter?.navegarPara) {
        window.OlymposRouter.navegarPara('chat');
      }
    });
  }

  void refreshChatUnreadCounts();
  void bindGlobalBadgeRealtime();

  if (!badgePollTimer) {
    badgePollTimer = setInterval(() => {
      const sess = window.OlymposApp?.getSession?.();
      if (sess && sess.perfil) {
        void refreshChatUnreadCounts();
        void bindGlobalBadgeRealtime();
      } else if (chatTotalUnreadSignal.value > 0) {
        clearChatBadgeOnLogout();
      }
    }, 35000);
  }

  window.OlymposChatBadge = {
    refresh: refreshChatUnreadCounts,
    clearOnLogout: clearChatBadgeOnLogout,
    onUpdate: onChatUnreadUpdated
  };
}
