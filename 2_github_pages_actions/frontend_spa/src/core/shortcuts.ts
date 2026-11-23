/**
 * Onda 1 (Sprint 1.4 — Item 1.4): Atalhos de Teclado, Regiões aria-live e Modo Alto Contraste (WCAG 2.2 AA).
 */

const HIGH_CONTRAST_STORAGE_KEY = 'olympos_high_contrast';

const ALT_ROUTE_MAP: Record<string, string> = {
  '1': 'visao-geral',
  '2': 'oficios',
  '3': 'portarias',
  '4': 'certificados',
  '5': 'diario-oficial',
  '6': 'papiro-cadmo',
  '7': 'servidores',
  '8': 'chamados',
  '9': 'configuracoes'
};

let initialized = false;
let politeClearTimer: ReturnType<typeof setTimeout> | null = null;

export function anunciarLeitorTela(mensagem: string, assertive = false): void {
  if (typeof document === 'undefined' || !mensagem) return;
  const el = document.getElementById(assertive ? 'srLiveAssertive' : 'srLivePolite');
  if (!el) return;

  if (politeClearTimer) clearTimeout(politeClearTimer);
  el.textContent = '';
  requestAnimationFrame(() => {
    el.textContent = String(mensagem);
  });
  politeClearTimer = setTimeout(() => {
    if (el.textContent === mensagem) el.textContent = '';
  }, 5000);
}

export function isHighContrastEnabled(): boolean {
  try {
    return localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === '1';
  } catch {
    return document.documentElement.getAttribute('data-contrast') === 'high';
  }
}

function sincronizarControlesAltoContraste(ativo: boolean): void {
  const btnHeader = document.getElementById('btnAltoContrasteHeader');
  if (btnHeader) {
    btnHeader.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    btnHeader.classList.toggle('is-active', ativo);
  }
  const chkConfig = document.getElementById('configAltoContrasteToggle') as HTMLInputElement | null;
  if (chkConfig) {
    chkConfig.checked = ativo;
    chkConfig.setAttribute('aria-checked', ativo ? 'true' : 'false');
  }
}

export function setHighContrast(enabled: boolean, announce = true): void {
  if (enabled) {
    document.documentElement.setAttribute('data-contrast', 'high');
  } else {
    document.documentElement.removeAttribute('data-contrast');
  }
  try {
    localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, enabled ? '1' : '0');
  } catch {}

  sincronizarControlesAltoContraste(enabled);
  if (announce) {
    anunciarLeitorTela(enabled ? 'Modo alto contraste ativado.' : 'Modo alto contraste desativado.');
  }
}

export function toggleHighContrast(): boolean {
  const next = !isHighContrastEnabled();
  setHighContrast(next, true);
  return next;
}

export function openHelpModal(): void {
  let modal = document.getElementById('modalAtalhosTeclado');
  if (!modal) {
    const root = document.getElementById('modal-root') || document.body;
    modal = document.createElement('div');
    modal.id = 'modalAtalhosTeclado';
    modal.className = 'modal-backdrop hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modalAtalhosTitulo');

    modal.innerHTML =
      '<div class="modal-card" style="max-width: 520px; width: 92%;">' +
        '<div class="modal-header">' +
          '<div class="modal-title-wrap">' +
            '<span class="section-eyebrow" style="font-size: 10px;">ACESSIBILIDADE WCAG 2.2 AA</span>' +
            '<h3 id="modalAtalhosTitulo" style="margin: 2px 0 0; font-size: 1.2rem;">Mapa de Atalhos de Teclado</h3>' +
          '</div>' +
          '<button type="button" id="btnFecharModalAtalhos" class="icon-capsule-btn" aria-label="Fechar mapa de atalhos">✕</button>' +
        '</div>' +
        '<div class="modal-body" style="padding: 18px 22px;">' +
          '<table class="clean-table" style="font-size: 13px;">' +
            '<thead><tr><th>Atalho</th><th>Ação no Sistema</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>/</code></td><td>Ir para a Busca Global ou focar campo de pesquisa ativo</td></tr>' +
              '<tr><td><code>Alt + 1</code></td><td>Visão Geral do Gabinete</td></tr>' +
              '<tr><td><code>Alt + 2</code> / <code>Alt + 3</code></td><td>Ofícios / Portarias e Acervo 2026</td></tr>' +
              '<tr><td><code>Alt + 4</code> / <code>Alt + 5</code></td><td>Certificados / Diário Oficial FEMURN</td></tr>' +
              '<tr><td><code>Alt + 6</code> / <code>Alt + 7</code></td><td>Permutas / Consulta de Servidores</td></tr>' +
              '<tr><td><code>Alt + 8</code> / <code>Alt + 9</code></td><td>Pendências / Ajustes &amp; Memórias</td></tr>' +
              '<tr><td><code>?</code></td><td>Abrir este mapa de atalhos</td></tr>' +
              '<tr><td><code>Esc</code></td><td>Fechar modal ou central de notificações ativa</td></tr>' +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    root.appendChild(modal);
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) modal!.classList.add('hidden');
    });
    document.getElementById('btnFecharModalAtalhos')?.addEventListener('click', () => {
      modal!.classList.add('hidden');
    });
  }

  modal.classList.remove('hidden');
}

function isEditableElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return true;
  return false;
}

function focarCampoBusca(): void {
  const visibleSearch = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="search"]')).find(
    (inp) => !inp.closest('.hidden') && !inp.disabled && inp.offsetParent !== null
  );
  if (visibleSearch) {
    visibleSearch.focus();
    visibleSearch.select?.();
    anunciarLeitorTela('Campo de pesquisa focado.');
    return;
  }

  const podeBusca = window.OlymposApp?.podeAcessarPagina?.('busca');
  const destino = podeBusca ? 'busca' : 'servidores';
  window.OlymposRouter?.navegarPara?.(destino);
  setTimeout(() => {
    const targetInput = (document.getElementById('pageBuscaInput') ||
      document.getElementById('servidoresSearchInput')) as HTMLInputElement | null;
    targetInput?.focus?.();
  }, 180);
}

function handleGlobalKeyDown(ev: KeyboardEvent): void {
  if (ev.ctrlKey || ev.metaKey) return;

  if (ev.key === 'Escape') {
    const drawer = document.getElementById('notificacoesDrawer');
    if (drawer && !drawer.classList.contains('hidden')) {
      ev.preventDefault();
      window.OlymposNotifications?.close?.();
    }
    return;
  }

  if (ev.altKey && ALT_ROUTE_MAP[ev.key]) {
    ev.preventDefault();
    const rota = ALT_ROUTE_MAP[ev.key];
    window.OlymposRouter?.navegarPara?.(rota);
    anunciarLeitorTela(`Navegando para ${rota}.`);
    return;
  }

  if (isEditableElement(ev.target)) return;

  const activeModal = window.OlymposModalManager?.getActiveModal?.();
  if (activeModal) return;

  if (ev.key === '/') {
    ev.preventDefault();
    focarCampoBusca();
  } else if (ev.key === '?') {
    ev.preventDefault();
    openHelpModal();
  }
}

export function initShortcuts(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  setHighContrast(isHighContrastEnabled(), false);

  document.addEventListener('keydown', handleGlobalKeyDown);

  document.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement | null;
    if (target?.closest?.('#btnAltoContrasteHeader')) {
      toggleHighContrast();
    }
  });

  document.addEventListener('change', (ev) => {
    const target = ev.target as HTMLInputElement | null;
    if (target && target.id === 'configAltoContrasteToggle') {
      setHighContrast(Boolean(target.checked), true);
    }
  });

  window.addEventListener('hashchange', () => {
    requestAnimationFrame(() => sincronizarControlesAltoContraste(isHighContrastEnabled()));
  });
}

if (typeof window !== 'undefined') {
  window.OlymposShortcuts = {
    init: initShortcuts,
    openHelpModal,
    anunciarLeitorTela,
    setHighContrast,
    toggleHighContrast,
    isHighContrastEnabled
  };
}
