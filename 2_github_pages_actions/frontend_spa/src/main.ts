import '../styles.css';

// Injeta chave CARTO vinda do build env do Vite (GitHub Secrets -> VITE_CARTO_API_KEY)
if (typeof window !== 'undefined' && import.meta.env.VITE_CARTO_API_KEY) {
  window.__OLYMPOS_CARTO_API_KEY__ = String(import.meta.env.VITE_CARTO_API_KEY).trim();
}

// 1. Núcleo leve e reatividade
import '../js/icons.js';
import '../js/carto_config.js';
import '../js/perf_engine.js';
import '../js/setup_modal.js';
import '../js/olympos_password_guard.js';
import '../js/supabase_client.js';
import '../js/api.js';
import '../js/signals.js';
import '../js/pagination.js';
import '../js/sla_engine.js';

// 2. Módulos core TypeScript (LGPD, Zero-Trust Session Guard, Termo de Sigilo, RBAC Onda 7, Roteador Lazy, Acessibilidade & Notificações)
import './core/piiMask';
import './core/termoSigilo';
import './core/sessionGuard';
import './core/rbacEngine';
import { initModalManager } from './core/modalManager';
import { initShortcuts } from './core/shortcuts';
import { initNotifications } from './core/notifications';
import { initChatBadge } from './core/chatBadge';
import { bindNavPrefetch } from './core/routeLoader';
import { initTableStandard } from './core/tableStandard';

// 3. Controlador central e roteador (carregam módulos de página sob demanda)
import '../js/router.js';
import '../js/app.js';

initModalManager();
initShortcuts();
initNotifications();
initChatBadge();
bindNavPrefetch();
initTableStandard();

// Ponte lazy para Tour Guiado de Onboarding (mantém driver.js fora do entry bundle)
if (typeof window !== 'undefined' && !window.OlymposOnboarding) {
  window.OlymposOnboarding = {
    iniciarSeNecessario: async (roleId?: string | null) => {
      const mod = await import('./core/onboardingTour');
      return mod.iniciarOnboardingSeNecessario(roleId);
    },
    reverTourGuiado: async (roleId?: string | null) => {
      const mod = await import('./core/onboardingTour');
      return mod.reverTourGuiado(roleId);
    }
  };
}
