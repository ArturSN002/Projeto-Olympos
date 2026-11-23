import configuracoesHtml from '../templates/pages/configuracoes.html?raw';
import usuariosModalsHtml from '../templates/modals/usuariosModals.html?raw';
import memoriaModalHtml from '../templates/modals/memoriaModal.html?raw';
import { mountMemoriasGovernanca } from '../core/memoriasGovernanca';
import { mountTelegramConfig } from './telegramConfig';
import { reverTourGuiado } from '../core/onboardingTour';
import '../../js/memorias_catalogo.js';
import '../../js/views/personas.js';
import '../../js/views/configuracoes.js';
import '../../js/views/ajustes.js';

export const routeId = 'configuracoes';
export const htmlTemplate = configuracoesHtml;
export const modalTemplates = [
  { id: 'modalNovoUsuario', html: usuariosModalsHtml },
  { id: 'memoriaModal', html: memoriaModalHtml }
];

async function atualizarPainelSegurancaMfaSessoes(): Promise<void> {
  const badge = document.getElementById('configMfaAalBadge');
  const listaEl = document.getElementById('listaSessoesAtivasConfig');
  const supa = window.OlymposSupabase;
  const guard = window.OlymposSessionGuard;

  if (badge && supa && typeof supa.checkMfaStatus === 'function') {
    try {
      const st = await supa.checkMfaStatus();
      const aal = String(st?.currentAal || st?.currentLevel || 'aal1').toUpperCase();
      badge.textContent = aal;
      badge.className = aal === 'AAL2' ? 'pill-badge pill-green' : 'pill-badge pill-gold';
    } catch {
      badge.textContent = 'AAL1';
    }
  }

  if (listaEl && guard && typeof guard.listarSessoesAtivas === 'function') {
    const sessao = window.OlymposApp?.getSession?.();
    if (!sessao || !sessao.perfil) {
      listaEl.textContent = 'Faça login para consultar sessões ativas registradas.';
      return;
    }
    const rows = await guard.listarSessoesAtivas();
    if (!rows || rows.length === 0) {
      listaEl.textContent = 'Nenhuma sessão adicional registrada nesta competência.';
      return;
    }
    const esc = window.OlymposApp?.escapeHtml || ((s: string) => String(s || ''));
    listaEl.innerHTML = rows
      .map((r: any) => {
        const dt = r.last_seen_at ? new Date(r.last_seen_at).toLocaleString('pt-BR') : '--';
        const ua = esc(String(r.user_agent || 'Navegador').slice(0, 75));
        const aal = esc(String(r.aal || 'aal1').toUpperCase());
        return `<div style="padding:6px 0; border-bottom:1px solid var(--border-hairline); display:flex; justify-content:space-between; gap:8px;"><span>${ua}</span><strong>${aal} • ${esc(dt)}</strong></div>`;
      })
      .join('');
  }
}

let oraculoLoadPromise: Promise<void> | null = null;

async function mountOraculoEmAjustes(): Promise<void> {
  const host = document.getElementById('configOraculoHost');
  if (!host) return;

  if (host.dataset.oraculoMounted === '1') {
    await import('./oraculo').then((mod) => mod.mount());
    return;
  }

  if (oraculoLoadPromise) return oraculoLoadPromise;

  oraculoLoadPromise = (async () => {
    const mod = await import('./oraculo');
    // Remove instância standalone caso #oraculo tenha sido montado diretamente antes
    const standalone = document.getElementById('page-oraculo');
    if (standalone && !host.contains(standalone)) {
      standalone.remove();
    }

    const tpl = document.createElement('template');
    tpl.innerHTML = String(mod.htmlTemplate || '').trim();
    const section = tpl.content.querySelector('#page-oraculo');
    host.innerHTML = section ? section.innerHTML : tpl.innerHTML;
    host.dataset.oraculoMounted = '1';

    await mod.mount();
    if (window.OlymposIcons && typeof window.OlymposIcons.hydrateAll === 'function') {
      window.OlymposIcons.hydrateAll();
    }
  })();

  try {
    await oraculoLoadPromise;
  } finally {
    oraculoLoadPromise = null;
  }
}

if (typeof window !== 'undefined') {
  (window as any).OlymposConfigOraculoMount = () => {
    void mountOraculoEmAjustes();
  };
}

function bindSecurityPanelEvents(): void {
  const bindOnce = (id: string, fn: () => void) => {
    const el = document.getElementById(id) as any;
    if (el && !el._boundSec) {
      el._boundSec = true;
      el.addEventListener('click', fn);
    }
  };

  bindOnce('btnModoKiosk', () => {
    window.OlymposRouter?.navegarPara?.('kiosk');
  });

  bindOnce('btnAtivarMfaConfig', () => {
    if (window.OlymposApp && typeof window.OlymposApp.solicitarMfaObrigatorio === 'function') {
      window.OlymposApp.solicitarMfaObrigatorio();
    }
  });

  bindOnce('btnAtualizarSessoesConfig', () => {
    atualizarPainelSegurancaMfaSessoes();
  });

  bindOnce('btnEncerrarTodasSessoesConfig', async () => {
    if (window.confirm && !window.confirm('Encerrar todas as sessões ativas deste usuário em todos os dispositivos?')) {
      return;
    }
    if (window.OlymposSessionGuard && typeof window.OlymposSessionGuard.encerrarEmTodosDispositivos === 'function') {
      await window.OlymposSessionGuard.encerrarEmTodosDispositivos();
    }
  });

  bindOnce('btnReverTourGuiadoConfig', () => {
    void reverTourGuiado();
  });

  bindOnce('subtabBtnAjustesOraculo', () => {
    void mountOraculoEmAjustes();
  });

  bindOnce('subtabBtnAjustesPersonas', () => {
    mountMemoriasGovernanca();
  });

  bindOnce('subtabBtnAjustesAutomacoes', () => {
    mountTelegramConfig('configTelegramRoot');
  });
}

let authListenerBound = false;

export async function mount(): Promise<void> {
  bindSecurityPanelEvents();
  atualizarPainelSegurancaMfaSessoes();
  mountMemoriasGovernanca();
  mountTelegramConfig('configTelegramRoot');
  window.OlymposApp?.aplicarControleAcessoModularEDrive?.();

  if (!authListenerBound && typeof window !== 'undefined') {
    authListenerBound = true;
    window.addEventListener('olympos:auth-changed', () => {
      atualizarPainelSegurancaMfaSessoes();
      mountTelegramConfig('configTelegramRoot');
      window.OlymposApp?.aplicarControleAcessoModularEDrive?.();
    });
  }
}
