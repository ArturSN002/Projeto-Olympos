/**
 * Carregador Dinâmico de Rotas e Modais (Code Splitting Vite).
 * Garante carregamento sob demanda de templates HTML, views JS e libs pesadas.
 */

export interface RouteModule {
  routeId: string;
  htmlTemplate: string;
  modalTemplates?: Array<{ id: string; html: string }>;
  mount: () => Promise<void>;
}

const ROUTE_IMPORTERS: Record<string, () => Promise<RouteModule>> = {
  'visao-geral':    () => import('../modules/visao-geral'),
  'oficios':        () => import('../modules/oficios'),
  'portarias':      () => import('../modules/portarias'),
  'certificados':   () => import('../modules/certificados'),
  'relatorios':     () => import('../modules/relatorios'),
  'diario-oficial': () => import('../modules/diario-oficial'),
  'papiro-cadmo':   () => import('../modules/papiro-cadmo'),
  'servidores':     () => import('../modules/servidores'),
  'calendario':     () => import('../modules/calendario'),
  'escolas':        () => import('../modules/escolas'),
  'inventario':     () => import('../modules/inventario'),
  'busca':          () => import('../modules/busca'),
  'configuracoes':  () => import('../modules/configuracoes'),
  'chamados':       () => import('../modules/chamados'),
  'auditoria':           () => import('../modules/auditoria'),
  'kiosk':               () => import('../modules/kiosk'),
  'oraculo':             () => import('../modules/oraculo'),
  'processos-seletivos': () => import('../modules/processos-seletivos'),
  'mural':               () => import('../modules/mural'),
  'chat':                () => import('../modules/chat')
};

const MODAL_IMPORTERS: Record<string, { id: string; loader: () => Promise<{ default: string }> }> = {
  memoria:      { id: 'memoriaModal',       loader: () => import('../templates/modals/memoriaModal.html?raw') },
  contadores:   { id: 'contadoresModal',    loader: () => import('../templates/modals/contadoresModal.html?raw') },
  userProfile:  { id: 'userProfileModal',   loader: () => import('../templates/modals/userProfileModal.html?raw') },
  usuarios:     { id: 'modalNovoUsuario',   loader: () => import('../templates/modals/usuariosModals.html?raw') },
  escolas:      { id: 'modalCadastroEscola',loader: () => import('../templates/modals/escolasModals.html?raw') },
  servidores:   { id: 'modalDossieServidor',loader: () => import('../templates/modals/servidoresModal.html?raw') },
  certificados: { id: 'modalLiraNovaAba',   loader: () => import('../templates/modals/certificadosModals.html?raw') },
  mfa:          { id: 'modalMfaDesafio',    loader: () => import('../templates/modals/mfaModals.html?raw') },
  termoSigilo:  { id: 'termoSigiloModal',   loader: () => import('../templates/modals/termoSigiloModal.html?raw') }
};

const loadedRoutes = new Map<string, Promise<RouteModule>>();
const mountedModalIds = new Set<string>();

function normalizeRouteKey(pageId: string): string {
  const p = String(pageId || 'visao-geral').trim();
  if (p === 'licencas') return 'portarias';
  if (p === 'pendencias') return 'chamados';
  if (p === 'permutas') return 'papiro-cadmo';
  if (p === 'ajustes' || p === 'personas') return 'configuracoes';
  if (p === 'consulta-servidores') return 'servidores';
  if (p === 'pss') return 'processos-seletivos';
  return ROUTE_IMPORTERS[p] ? p : 'visao-geral';
}

function showRouteSkeleton(viewRoot: HTMLElement): void {
  let sk = document.getElementById('routeSkeletonLoader');
  if (!sk) {
    sk = document.createElement('div');
    sk.id = 'routeSkeletonLoader';
    sk.className = 'route-skeleton-loader';
    sk.innerHTML =
      '<div class="surface-card" style="padding: 28px;">' +
        '<div class="skeleton-shimmer" style="height: 16px; max-width: 220px; margin-bottom: 12px;"></div>' +
        '<div class="skeleton-shimmer" style="height: 28px; max-width: 420px; margin-bottom: 20px;"></div>' +
        '<div class="skeleton-shimmer" style="height: 140px; max-width: 100%;"></div>' +
      '</div>';
    viewRoot.appendChild(sk);
  }
  sk.classList.remove('hidden');
}

function hideRouteSkeleton(): void {
  const sk = document.getElementById('routeSkeletonLoader');
  if (sk) sk.classList.add('hidden');
}

function hoistEmbeddedModals(root: ParentNode): void {
  if (typeof document === 'undefined') return;
  const modalRoot = document.getElementById('modal-root') || document.body;
  if (!modalRoot) return;
  root.querySelectorAll<HTMLElement>('.modal-backdrop').forEach((modalEl) => {
    if (modalEl.id) {
      const existing = document.getElementById(modalEl.id);
      if (existing && existing !== modalEl) {
        modalEl.remove();
        return;
      }
    }
    modalRoot.appendChild(modalEl);
  });
}

function appendModalTemplate(domId: string, html: string): void {
  if (!html || mountedModalIds.has(domId) || document.getElementById(domId)) {
    mountedModalIds.add(domId);
    return;
  }
  const modalRoot = document.getElementById('modal-root') || document.body;
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  modalRoot.appendChild(tpl.content);
  mountedModalIds.add(domId);
}

export async function ensureModal(modalKey: string): Promise<void> {
  const cfg = MODAL_IMPORTERS[modalKey];
  if (!cfg) return;
  if (mountedModalIds.has(cfg.id) || document.getElementById(cfg.id)) {
    mountedModalIds.add(cfg.id);
    return;
  }
  const mod = await cfg.loader();
  appendModalTemplate(cfg.id, mod.default);
  if (window.OlymposApp) {
    if (typeof window.OlymposApp.hydrateVectorIcons === 'function') {
      window.OlymposApp.hydrateVectorIcons();
    }
    if (typeof window.OlymposApp.bindDynamicControls === 'function') {
      window.OlymposApp.bindDynamicControls();
    }
  }
}

const PRELOAD_VIEW_KEYS: Record<string, string> = {
  'visao-geral': 'visaoGeral',
  'oficios': 'oficios',
  'portarias': 'portarias',
  'certificados': 'certificados',
  'relatorios': 'relatorios',
  'diario-oficial': 'diarioOficial',
  'papiro-cadmo': 'papiroCadmo',
  'servidores': 'servidores',
  'calendario': 'calendario',
  'escolas': 'escolas',
  'inventario': 'inventario',
  'busca': 'busca',
  'chamados': 'chamados',
  'auditoria': 'auditoria',
  'configuracoes': 'configuracoes',
  'oraculo': 'oraculo',
  'mural': 'mural',
  'chat': 'chat'
};

const preloadedInFlight = new Map<string, Promise<void>>();

export function prefetchRoute(pageId: string): void {
  const key = normalizeRouteKey(pageId);
  if (!loadedRoutes.has(key) && ROUTE_IMPORTERS[key]) {
    ROUTE_IMPORTERS[key]().catch(() => {});
  }
}

export async function preloadRoute(pageId: string, options?: { initView?: boolean }): Promise<void> {
  const key = normalizeRouteKey(pageId);
  if (!ROUTE_IMPORTERS[key]) return;

  const inflight = preloadedInFlight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    let modPromise = loadedRoutes.get(key);
    if (!modPromise) {
      modPromise = ROUTE_IMPORTERS[key]();
      loadedRoutes.set(key, modPromise);
    }

    try {
      const mod = await modPromise;
      const viewRoot = document.getElementById('view-root') || document.querySelector('main.app-main');
      const existingSection = document.getElementById(`page-${key}`);

      if (viewRoot && !existingSection) {
        const tpl = document.createElement('template');
        tpl.innerHTML = mod.htmlTemplate.trim();
        const currentPage = window.OlymposRouter?.getPaginaAtual?.() || 'visao-geral';
        const isCurrentlyActive = currentPage === key;
        tpl.content.querySelectorAll('.page-view').forEach((sec) => {
          sec.classList.toggle('active', isCurrentlyActive);
          sec.classList.toggle('hidden', !isCurrentlyActive);
        });
        hoistEmbeddedModals(tpl.content);
        viewRoot.appendChild(tpl.content);
      }

      if (Array.isArray(mod.modalTemplates)) {
        for (const m of mod.modalTemplates) {
          appendModalTemplate(m.id, m.html);
        }
      }

      await mod.mount();

      if (window.OlymposApp) {
        if (typeof window.OlymposApp.hydrateVectorIcons === 'function') {
          window.OlymposApp.hydrateVectorIcons();
        }
        if (typeof window.OlymposApp.bindDynamicControls === 'function') {
          window.OlymposApp.bindDynamicControls();
        }
        const sess = typeof window.OlymposApp.getSession === 'function' ? window.OlymposApp.getSession() : null;
        if (typeof window.OlymposApp.aplicarControleAcessoModularEDrive === 'function') {
          window.OlymposApp.aplicarControleAcessoModularEDrive(sess);
        }
      }

      if (options?.initView && window.OlymposViews) {
        const viewKey = PRELOAD_VIEW_KEYS[key];
        if (viewKey && window.OlymposViews[viewKey] && typeof window.OlymposViews[viewKey].init === 'function') {
          window.OlymposViews[viewKey].init();
        }
      }
    } catch (err) {
      loadedRoutes.delete(key);
      console.warn(`[RouteLoader] Pré-carregamento silencioso falhou para "${key}":`, err);
    } finally {
      preloadedInFlight.delete(key);
    }
  })();

  preloadedInFlight.set(key, task);
  return task;
}

export function preloadInitialRoutes(isAuthenticated: boolean): void {
  if (typeof window === 'undefined') return;
  const runPreloads = () => {
    void preloadRoute('calendario', { initView: true });
    if (isAuthenticated) {
      const canChamados = window.OlymposApp?.podeAcessarPagina
        ? window.OlymposApp.podeAcessarPagina('chamados')
        : true;
      if (canChamados) {
        void preloadRoute('chamados', { initView: true });
      }
    }
  };

  const ric = (window as any).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(runPreloads, { timeout: 1200 });
  } else {
    setTimeout(runPreloads, 120);
  }
}

export async function loadRoute(pageId: string): Promise<void> {
  const key = normalizeRouteKey(pageId);
  const viewRoot = document.getElementById('view-root') || document.querySelector('main.app-main');
  const existingSection = document.getElementById(`page-${key}`);

  if (existingSection && loadedRoutes.has(key)) {
    hideRouteSkeleton();
    return;
  }

  if (viewRoot && !existingSection) {
    viewRoot.querySelectorAll('.page-view').forEach((v) => {
      v.classList.remove('active');
      v.classList.add('hidden');
    });
    showRouteSkeleton(viewRoot as HTMLElement);
  }

  let modPromise = loadedRoutes.get(key);
  if (!modPromise) {
    const importer = ROUTE_IMPORTERS[key];
    modPromise = importer();
    loadedRoutes.set(key, modPromise);
  }

  try {
    const mod = await modPromise;

    if (viewRoot && !document.getElementById(`page-${key}`)) {
      const tpl = document.createElement('template');
      tpl.innerHTML = mod.htmlTemplate.trim();
      hoistEmbeddedModals(tpl.content);
      viewRoot.appendChild(tpl.content);
    }

    if (Array.isArray(mod.modalTemplates)) {
      for (const m of mod.modalTemplates) {
        appendModalTemplate(m.id, m.html);
      }
    }

    await mod.mount();

    if (window.OlymposApp) {
      if (typeof window.OlymposApp.hydrateVectorIcons === 'function') {
        window.OlymposApp.hydrateVectorIcons();
      }
      if (typeof window.OlymposApp.bindDynamicControls === 'function') {
        window.OlymposApp.bindDynamicControls();
      }
      const sess = typeof window.OlymposApp.getSession === 'function' ? window.OlymposApp.getSession() : null;
      if (typeof window.OlymposApp.aplicarControleAcessoModularEDrive === 'function') {
        window.OlymposApp.aplicarControleAcessoModularEDrive(sess);
      }
    }
  } catch (err) {
    loadedRoutes.delete(key);
    console.error(`[RouteLoader] Falha ao carregar rota "${key}":`, err);
    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast(`Erro ao carregar módulo ${key}. Verifique sua conexão.`, true);
    }
  } finally {
    hideRouteSkeleton();
  }
}

export function bindNavPrefetch(): void {
  if (typeof document === 'undefined') return;
  const handler = (e: Event) => {
    const raw = e.target as Element | null;
    if (!raw || typeof raw.closest !== 'function') return;
    const target = raw.closest('[data-page], [data-nav-target]') as HTMLElement | null;
    if (!target) return;
    const page = target.getAttribute('data-page') || target.getAttribute('data-nav-target');
    if (page) prefetchRoute(page);
  };
  document.addEventListener('mouseenter', handler, { capture: true, passive: true });
  document.addEventListener('focusin', handler, { passive: true });
}

export const OlymposRouteLoader = {
  loadRoute,
  prefetchRoute,
  preloadRoute,
  preloadInitialRoutes,
  ensureModal,
  bindNavPrefetch
};

if (typeof window !== 'undefined') {
  window.OlymposRouteLoader = OlymposRouteLoader;
}
