/**
 * Guarda de Sessão Zero-Trust:
 * 1. Timeout por inatividade (30 min para MODERADOR/ADMIN_GABINETE; 60 min demais perfis) c/ aviso 2 min antes.
 * 2. Bloqueio progressivo contra tentativas inválidas de login.
 * 3. Registro de sessões ativas e revogação global ("Encerrar em todos os dispositivos").
 */

const IDLE_MS_CRITICAL = 30 * 60 * 1000;
const IDLE_MS_STANDARD = 60 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const LOCKOUT_STORAGE_KEY = 'olympos_login_attempts_v1';

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let warnTimer: ReturnType<typeof setTimeout> | null = null;
let monitoringActive = false;
let lastActivityTs = Date.now();
let currentIdleLimitMs = IDLE_MS_STANDARD;

function isCriticalRole(role?: string | null): boolean {
  const r = String(role || '').trim().toUpperCase();
  return r === 'MODERADOR' || r === 'ADMIN_GABINETE';
}

function clearTimers(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (warnTimer) {
    clearTimeout(warnTimer);
    warnTimer = null;
  }
}

function scheduleIdleChecks(): void {
  clearTimers();
  if (!monitoringActive) return;

  const warnDelay = Math.max(1000, currentIdleLimitMs - WARNING_BEFORE_MS);
  warnTimer = setTimeout(() => {
    const app = (window as any).OlymposApp;
    if (app && typeof app.showToast === 'function') {
      app.showToast('Sessão expirará em 2 minutos por inatividade. Interaja para manter o acesso.', true);
    }
  }, warnDelay);

  idleTimer = setTimeout(() => {
    const app = (window as any).OlymposApp;
    monitoringActive = false;
    clearTimers();
    if (app && typeof app.showToast === 'function') {
      app.showToast('Sessão encerrada automaticamente por inatividade.', true);
    }
    if (app && typeof app.fazerLogout === 'function') {
      app.fazerLogout();
    }
  }, currentIdleLimitMs);
}

function onUserActivity(): void {
  const now = Date.now();
  if (now - lastActivityTs < 5000) return;
  lastActivityTs = now;
  if (monitoringActive) {
    scheduleIdleChecks();
  }
}

export function startIdleMonitor(role?: string | null): void {
  currentIdleLimitMs = isCriticalRole(role) ? IDLE_MS_CRITICAL : IDLE_MS_STANDARD;
  lastActivityTs = Date.now();

  if (!monitoringActive && typeof document !== 'undefined') {
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((evt) => {
      document.addEventListener(evt, onUserActivity, { passive: true });
    });
  }
  monitoringActive = true;
  scheduleIdleChecks();
}

export function stopIdleMonitor(): void {
  monitoringActive = false;
  clearTimers();
}

export function getLoginAttemptState(): { count: number; lockUntil: number } {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { count: 0, lockUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count) || 0,
      lockUntil: Number(parsed.lockUntil) || 0
    };
  } catch {
    return { count: 0, lockUntil: 0 };
  }
}

export function getLockoutRemainingSeconds(): number {
  const st = getLoginAttemptState();
  const diff = st.lockUntil - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

export function recordFailedLoginAttempt(): { count: number; lockSeconds: number } {
  const prev = getLoginAttemptState();
  const nextCount = prev.count + 1;
  let lockSeconds = 0;
  if (nextCount >= 7) {
    lockSeconds = 300;
  } else if (nextCount >= 5) {
    lockSeconds = 60;
  } else if (nextCount >= 3) {
    lockSeconds = 15;
  }
  const lockUntil = lockSeconds > 0 ? Date.now() + lockSeconds * 1000 : 0;
  try {
    sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({ count: nextCount, lockUntil }));
  } catch {
    // ignora
  }
  return { count: nextCount, lockSeconds };
}

export function resetLoginAttempts(): void {
  try {
    sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
  } catch {
    // ignora
  }
}

export async function registrarSessaoAtiva(userId?: string, aal = 'aal1'): Promise<void> {
  if (!userId) return;
  const supa = (window as any).OlymposSupabase;
  const client = supa && typeof supa.getClient === 'function' ? supa.getClient() : null;
  if (!client) return;

  try {
    await client.from('user_sessions_log').insert({
      user_id: userId,
      user_agent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 180) : 'Browser',
      aal: aal || 'aal1',
      last_seen_at: new Date().toISOString()
    });
  } catch {
    // silencioso para não bloquear o login caso a tabela ainda não tenha sido migrada no ambiente remoto
  }
}

export async function listarSessoesAtivas(): Promise<any[]> {
  const supa = (window as any).OlymposSupabase;
  const client = supa && typeof supa.getClient === 'function' ? supa.getClient() : null;
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('user_sessions_log')
      .select('id, user_agent, aal, last_seen_at, revoked_at, created_at')
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(15);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function encerrarEmTodosDispositivos(): Promise<void> {
  const supa = (window as any).OlymposSupabase;
  const client = supa && typeof supa.getClient === 'function' ? supa.getClient() : null;
  if (client) {
    try {
      const { data: userData } = await client.auth.getUser();
      if (userData?.user?.id) {
        await client
          .from('user_sessions_log')
          .update({ revoked_at: new Date().toISOString() })
          .eq('user_id', userData.user.id)
          .is('revoked_at', null);
      }
      await client.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('[SessionGuard] Erro ao revogar sessões globalmente:', e);
    }
  }
  stopIdleMonitor();
  if ((window as any).OlymposApp && typeof (window as any).OlymposApp.fazerLogout === 'function') {
    await (window as any).OlymposApp.fazerLogout();
  }
}

export const OlymposSessionGuard = {
  startIdleMonitor,
  stopIdleMonitor,
  getLockoutRemainingSeconds,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  registrarSessaoAtiva,
  listarSessoesAtivas,
  encerrarEmTodosDispositivos
};

if (typeof window !== 'undefined') {
  (window as any).OlymposSessionGuard = OlymposSessionGuard;
}
