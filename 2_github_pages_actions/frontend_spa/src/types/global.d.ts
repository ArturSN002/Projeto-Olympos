/// <reference types="vite/client" />

declare module '*.js';
declare module '*.html?raw' {
  const content: string;
  export default content;
}

interface Window {
  OlymposApp?: any;
  OlymposRouter?: any;
  OlymposApi?: any;
  OlymposSupabase?: any;
  OlymposIcons?: any;
  OlymposSignals?: any;
  OlymposPagination?: any;
  OlymposPerfEngine?: any;
  OlymposCarto?: any;
  OlymposSetupModal?: any;
  OlymposPasswordSecurity?: any;
  OlymposPasswordGuard?: any;
  OlymposSlaEngine?: any;
  OlymposViews?: Record<string, any>;
  OlymposRouteLoader?: any;
  OlymposPiiMask?: any;
  OlymposTermoSigilo?: any;
  OlymposSessionGuard?: any;
  OlymposDocumentosAcervo?: any;
  OlymposOficioEditor?: any;
  OlymposNotifications?: any;
  OlymposModalManager?: any;
  OlymposShortcuts?: any;
  OlymposOnboarding?: any;
  OlymposDispatchContext?: any;
  OlymposSnippets?: any;
  OlymposPdfBundler?: any;
  OlymposTelegramConfig?: any;
  OlymposDiarioRadar?: any;
  OlymposMemoriasGovernanca?: any;
  OlymposChamadosKanban?: any;
  OlymposChamadosTimeline?: any;
  OlymposOraculo?: any;
  OLYMPOS_MEMORIAS_CATALOGO?: any;
  BANCO_SEMENTE_ESCOLAS?: any[];
  DADOS_PERMUTAS_VIGENTES?: any;
  OLYMPOS_PERMUTAS_VIGENTES?: any;
  __OLYMPOS_CARTO_API_KEY__?: string;
}
