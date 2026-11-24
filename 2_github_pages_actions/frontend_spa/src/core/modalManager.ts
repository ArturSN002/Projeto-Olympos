/**
 * Onda 1 (Sprint 1.4 — Item 1.4): Gerenciador Unificado de Modais & Focus Trap (WCAG 2.2 AA).
 * Monitora automaticamente todos os .modal-backdrop / [role="dialog"] com MutationObserver,
 * aplicando inert em <main id="view-root">, ciclo Tab/Shift+Tab, fechamento Escape e restauração de foco.
 */

interface ModalStackEntry {
  el: HTMLElement;
  trigger: HTMLElement | null;
}

const activeStack: ModalStackEntry[] = [];
let observer: MutationObserver | null = null;
let initialized = false;

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

function isElementVisible(el: HTMLElement): boolean {
  if (!el || !el.isConnected) return false;
  if (el.classList.contains('hidden')) return false;
  if (el.hasAttribute('hidden')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.style && el.style.display === 'none') return false;
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return true;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter((node) => {
    if (node.closest('.hidden')) return false;
    if (node.style && node.style.display === 'none') return false;
    if (node.hasAttribute('disabled')) return false;
    return true;
  });
}

function setBackgroundInert(enabled: boolean): void {
  const targets = [
    document.getElementById('view-root'),
    document.querySelector<HTMLElement>('.top-masthead'),
    document.querySelector<HTMLElement>('.editorial-hero')
  ];
  for (const target of targets) {
    if (!target) continue;
    if (enabled) {
      (target as any).inert = true;
      target.setAttribute('inert', '');
    } else {
      (target as any).inert = false;
      target.removeAttribute('inert');
    }
  }
}

export function trapFocus(el: HTMLElement): void {
  const focusables = getFocusableElements(el);
  if (focusables.length > 0) {
    const preferred = el.querySelector<HTMLElement>('[autofocus]') || focusables[0];
    preferred?.focus?.({ preventScroll: true });
    return;
  }
  const card = el.querySelector<HTMLElement>('.modal-card, [role="document"]') || el;
  if (!card.hasAttribute('tabindex')) {
    card.setAttribute('tabindex', '-1');
  }
  card.focus?.({ preventScroll: true });
}

export function getActiveModal(): HTMLElement | null {
  if (activeStack.length === 0) return null;
  return activeStack[activeStack.length - 1].el;
}

export function closeModal(el?: HTMLElement | null): void {
  const target = el || getActiveModal();
  if (!target) return;

  if (target.getAttribute('data-non-dismissible') === 'true') {
    return;
  }

  // Aciona botão de fechamento nativo do modal quando disponível para preservar cleanup específico
  const closeBtn = target.querySelector<HTMLElement>(
    '#btnFecharNotifDrawer, #btnFecharModalAtalhos, #closeSetupModalBtn, #closeLoginScreenXBtn, #closeLoginModalBtn, .icon-capsule-btn[aria-label*="Fechar"], button[aria-label*="Fechar"], .modal-close-btn'
  );
  if (closeBtn && typeof closeBtn.click === 'function') {
    closeBtn.click();
    syncVisibleModals();
    return;
  }

  target.classList.add('hidden');
  target.style.display = 'none';
  syncVisibleModals();
}

export function openModal(el: HTMLElement): void {
  if (!el) return;
  el.classList.remove('hidden');
  const computedDisplay = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
    ? window.getComputedStyle(el).display
    : '';
  if (el.style.display === 'none' || computedDisplay === 'none') {
    el.style.display = 'flex';
  }
  syncVisibleModals();
}

function syncVisibleModals(): void {
  const allDialogs = Array.from(document.querySelectorAll<HTMLElement>('.modal-backdrop'));
  const currentlyVisible = new Set<HTMLElement>(allDialogs.filter(isElementVisible));

  // Remover da pilha modais que fecharam ou saíram do DOM
  for (let i = activeStack.length - 1; i >= 0; i--) {
    const entry = activeStack[i];
    if (!currentlyVisible.has(entry.el)) {
      activeStack.splice(i, 1);
      if (activeStack.length === 0) {
        setBackgroundInert(false);
      }
      if (entry.trigger && entry.trigger.isConnected && typeof entry.trigger.focus === 'function') {
        requestAnimationFrame(() => {
          entry.trigger?.focus?.({ preventScroll: true });
        });
      }
    }
  }

  // Empilhar modais recém-abertos
  for (const el of currentlyVisible) {
    const alreadyInStack = activeStack.some((entry) => entry.el === el);
    if (!alreadyInStack) {
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
      if (!el.getAttribute('aria-modal')) el.setAttribute('aria-modal', 'true');
      activeStack.push({ el, trigger });
      setBackgroundInert(true);
      requestAnimationFrame(() => {
        if (isElementVisible(el)) {
          trapFocus(el);
        }
      });
    }
  }
}

function handleKeyDown(ev: KeyboardEvent): void {
  const topModal = getActiveModal();
  if (!topModal || !isElementVisible(topModal)) return;

  if (ev.key === 'Escape') {
    if (topModal.getAttribute('data-non-dismissible') !== 'true') {
      ev.preventDefault();
      ev.stopPropagation();
      closeModal(topModal);
    }
    return;
  }

  if (ev.key === 'Tab') {
    const focusables = getFocusableElements(topModal);
    if (focusables.length === 0) {
      ev.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = document.activeElement as HTMLElement | null;

    if (ev.shiftKey) {
      if (!current || current === first || !topModal.contains(current)) {
        ev.preventDefault();
        last.focus();
      }
    } else if (!current || current === last || !topModal.contains(current)) {
      ev.preventDefault();
      first.focus();
    }
  }
}

export function initModalManager(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  document.addEventListener('keydown', handleKeyDown, true);

  observer = new MutationObserver(() => {
    syncVisibleModals();
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
  });

  syncVisibleModals();
}

if (typeof window !== 'undefined') {
  window.OlymposModalManager = {
    init: initModalManager,
    open: openModal,
    close: closeModal,
    getActiveModal,
    trapFocus
  };
}
