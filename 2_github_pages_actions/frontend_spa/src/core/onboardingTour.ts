/**
 * Onda 3 — Tour Guiado de Onboarding por Perfil (6 perfis RBAC + Visitante).
 * Carrega `driver.js` e `driver.js/dist/driver.css` exclusivamente sob demanda
 * quando o operador ainda não visualizou `CURRENT_TOUR_VERSION` ou aciona "Rever Tour Guiado".
 */

import '../styles/onda3.css';

export const CURRENT_TOUR_VERSION = 'v4.2-onda3';

export type OnboardingRoleId =
  | 'VISITANTE'
  | 'RH_COMISSAO'
  | 'PEDAGOGICO_EVENTOS'
  | 'JURIDICO'
  | 'ADMIN_GABINETE'
  | 'MODERADOR';

export interface OnboardingTourStepDef {
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export const ONBOARDING_ROTEIROS: Record<OnboardingRoleId, OnboardingTourStepDef[]> = {
  VISITANTE: [
    {
      selector: '.brand-lockup, #page-visao-geral',
      title: 'Bem-vindo ao Hub Olympos SMEB',
      description: 'Portal de transparência documental e acompanhamento público da Secretaria Municipal de Educação Básica de Ceará-Mirim/RN.',
      side: 'bottom'
    },
    {
      selector: '#municipalNewsSection, #page-visao-geral',
      title: 'Notícias Oficiais do Município',
      description: 'Acompanhe matérias oficiais da Prefeitura e da Câmara Municipal de Ceará-Mirim atualizadas diretamente nesta página inicial.',
      side: 'top'
    },
    {
      selector: '.masthead-nav-rail a[data-page="diario-oficial"], #page-diario-oficial',
      title: 'Diário Oficial FEMURN',
      description: 'Consulte atos publicados no Diário Oficial da FEMURN de interesse da educação municipal com pesquisa por período, setor e servidor.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="escolas"], #page-escolas',
      title: 'Mapa Interativo da Rede Escolar',
      description: 'Explore a localização georreferenciada e os dados públicos das unidades escolares da rede municipal SMEB.',
      side: 'bottom'
    },
    {
      selector: '#userSessionBtn',
      title: 'Acesso Institucional',
      description: 'Servidores autorizados podem entrar com e-mail e senha institucionais para acessar módulos de emissão documental e gestão.',
      side: 'left'
    }
  ],

  RH_COMISSAO: [
    {
      selector: '#statCardProximaPortaria, #page-visao-geral',
      title: 'Olho de Apolo • Numeração de Portarias',
      description: 'Acompanhe em tempo real o próximo número oficial de Portaria 2026 sincronizado com a Memória de Apolo.',
      side: 'bottom'
    },
    {
      selector: '#dropdownDocsBtn, .masthead-nav-rail a[data-page="portarias"]',
      title: 'Portarias & Lote Inteligente (CSV/XLSX)',
      description: 'No menu Documentos > Portarias, utilize o Pincel de Homero e o novo Lote Inteligente para validar planilhas inline, pré-visualizar minutas e exportar ZIP/PDF único.',
      side: 'bottom'
    },
    {
      selector: '.quick-module-card[data-nav-target="licencas"], .quick-module-card[data-nav-target="portarias"]',
      title: 'Licenças e Readaptações',
      description: 'Registre Licenças-Prêmio, Sem Remuneração e Anulações com cálculo automático de término e emissão imediata no Google Docs.',
      side: 'top'
    },
    {
      selector: '.masthead-nav-rail a[data-page="papiro-cadmo"], .masthead-nav-rail a[data-page="servidores"]',
      title: 'Permutas e Consulta de Servidores',
      description: 'Monitore permutas intermunicipais (O Papiro de Cadmo) e consulte vínculos funcionais na base unificada respeitando a LGPD.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="chamados"], #btnNotificacoesSino',
      title: 'Central de Pendências & Alertas',
      description: 'Gerencie demandas em modo Kanban ou Tabela, atribua responsáveis e acompanhe alertas preventivos no Sino ou Telegram Institucional.',
      side: 'bottom'
    }
  ],

  PEDAGOGICO_EVENTOS: [
    {
      selector: '#widgetAgendaVisaoGeral, #page-visao-geral',
      title: 'Agenda Escolar & Visão Geral',
      description: 'Confira os próximos compromissos externos e eventos intersetoriais da rede SMEB diretamente na página inicial.',
      side: 'top'
    },
    {
      selector: '#dropdownDocsBtn, .masthead-nav-rail a[data-page="oficios"]',
      title: 'Redação Oficial de Ofícios (PR/2018)',
      description: 'Em Documentos > Ofícios, redija expedientes no editor híbrido com suporte à Biblioteca de Modelos/Snippets e envio ao Google Docs.',
      side: 'bottom'
    },
    {
      selector: '.quick-module-card[data-nav-target="certificados"], #dropdownDocsBtn',
      title: 'A Lira de Orfeu • Certificados & Lote CSV/XLSX',
      description: 'Importe listas de participantes via arrastar-e-soltar com detecção de duplicidades, gere certificados com QR Code e baixe lotes em ZIP.',
      side: 'top'
    },
    {
      selector: '.masthead-nav-rail a[data-page="calendario"]',
      title: 'Calendário Escolar 2026–2027',
      description: 'Acompanhe os 203 dias letivos, bimestres, recessos e eventos pedagógicos com exportação para agenda.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="chamados"], #btnNotificacoesSino',
      title: 'Pendências, Relatórios & Telegram',
      description: 'Acompanhe solicitações pedagógicas no Kanban, gere prestações de contas em Documentos > Relatórios e ative alertas no Telegram.',
      side: 'bottom'
    }
  ],

  JURIDICO: [
    {
      selector: '.masthead-nav-rail a[data-page="diario-oficial"]',
      title: 'Radar Preditivo FEMURN',
      description: 'O Diário Oficial destaca automaticamente badges de prazos legais, citações de servidores SMEB e roteamento inteligente para Têmis e demais personas.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="chamados"]',
      title: 'Kanban de Pendências & Despachos',
      description: 'Abra qualquer chamado na linha do tempo lateral para inserir pareceres da Biblioteca de Snippets ou gerar Ofício/Portaria vinculado ao protocolo.',
      side: 'bottom'
    },
    {
      selector: '#dropdownDocsBtn, .masthead-nav-rail a[data-page="oficios"]',
      title: 'Minutas Jurídicas & Expedientes',
      description: 'Utilize modelos canônicos como o Despacho Jurídico Têmis diretamente no editor de Ofícios e consulte o acervo indexado.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="papiro-cadmo"]',
      title: 'Análise de Permutas & Atos',
      description: 'Consulte termos de permuta, cessões e pareceres de legalidade integrados ao quadro funcional.',
      side: 'bottom'
    },
    {
      selector: '#dropdownDocsBtn, .masthead-nav-rail a[data-page="configuracoes"]',
      title: 'Relatórios Mensais & Telegram Institucional',
      description: 'Exporte prestações de contas em PDF/XLSX (Documentos > Relatórios) e conecte seu Telegram em Ajustes para alertas jurídicos.',
      side: 'bottom'
    }
  ],

  ADMIN_GABINETE: [
    {
      selector: '#statCardProximoOficio, #page-visao-geral',
      title: 'Olho de Apolo • Controle Executivo',
      description: 'Monitore e reserve a numeração oficial de Ofícios e Portarias 2026 com sincronização direta ao Google Docs.',
      side: 'bottom'
    },
    {
      selector: '#btnModoKiosk',
      title: 'Modo TV / Painel de Gabinete',
      description: 'Exiba prazos SLA (sem PII), atos da FEMURN e telemetria do expediente em tela cheia 16:9 no gabinete.',
      side: 'left'
    },
    {
      selector: '#dropdownDocsBtn',
      title: 'Documentos & Relatórios Executivos 1-Clique',
      description: 'Acesse Ofícios, Portarias (com Lote CSV/XLSX + PDF único FEMURN), Certificados e Relatórios Mensais (PDF 1-Clique e XLSX 4 abas).',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="chamados"]',
      title: 'Fluxo Kanban & Despacho Direto',
      description: 'Mova pendências entre colunas, atribua responsáveis e transforme demandas em Ofícios ou Portarias com vinculação automática.',
      side: 'bottom'
    },
    {
      selector: '#btnNotificacoesSino, .masthead-nav-rail a[data-page="diario-oficial"]',
      title: 'Radar FEMURN & Notificações em Tempo Real',
      description: 'Receba alertas de prazos preventivos (48h/24h) e citações no Diário Oficial na Central do Sino e no Telegram.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="configuracoes"]',
      title: 'Governança das 22 Memórias & Telegram',
      description: 'Em Ajustes, revise diffs visuais das memórias, compacte histórico, restaure snapshots do Dédalo e vincule seu Telegram Institucional.',
      side: 'bottom'
    }
  ],

  MODERADOR: [
    {
      selector: '#statCardProximoOficio, #page-visao-geral',
      title: 'Painel de Governança Total (Moderador)',
      description: 'Você possui visão completa do Hub Olympos, incluindo controle de numeração Apolo, acervo e monitoramento operacional.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="configuracoes"]',
      title: 'Usuários RBAC, MFA AAL2 & Telegram',
      description: 'Gerencie operadores em Ajustes > Usuários, acompanhe sessões MFA, administre as 22 Memórias com SHA-256 e configure alertas no Telegram.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="auditoria"]',
      title: 'Auditoria Imutável & Saúde de Backups (DR)',
      description: 'Inspecione eventos em audit_logs, monitore backups semanais (DR Supabase & 22 Memórias) e execute detecção de anomalias operacionais.',
      side: 'bottom'
    },
    {
      selector: '.masthead-nav-rail a[data-page="chamados"]',
      title: 'Central de Pendências Kanban & Snippets',
      description: 'Supervisione o SLA da equipe, gerencie o catálogo de modelos/snippets institucionais e acompanhe despachos vinculados.',
      side: 'bottom'
    },
    {
      selector: '#dropdownDocsBtn',
      title: 'Relatórios Executivos & Lotes Inteligentes',
      description: 'Emita a Prestação de Contas mensal (PDF 1-Clique e XLSX multi-abas) e consolide lotes em ZIP ou PDF Único para a FEMURN.',
      side: 'bottom'
    },
    {
      selector: '#btnNotificacoesSino, .masthead-nav-rail a[data-page="diario-oficial"]',
      title: 'Central do Sino & Radar Preditivo FEMURN',
      description: 'Acompanhe alertas críticos de segurança, prazos preventivos e publicações vetorizadas do Diário Oficial em tempo real.',
      side: 'bottom'
    }
  ]
};

let tourEmExecucao = false;

export function normalizeOnboardingRole(roleId?: string | null): OnboardingRoleId {
  const r = String(roleId || '').trim().toUpperCase();
  if (
    r === 'MODERADOR' ||
    r === 'ADMIN_GABINETE' ||
    r === 'RH_COMISSAO' ||
    r === 'PEDAGOGICO_EVENTOS' ||
    r === 'JURIDICO'
  ) {
    return r;
  }
  return 'VISITANTE';
}

export function getRoteiroPorPerfil(roleId?: string | null): OnboardingTourStepDef[] {
  const role = normalizeOnboardingRole(roleId);
  return ONBOARDING_ROTEIROS[role];
}

function getLocalStorageKey(role: OnboardingRoleId, userId?: string): string {
  const suffix = userId ? `uid_${userId}` : `role_${role}`;
  return `olympos_onboarding_seen_${suffix}`;
}

function isTourAlreadySeenLocally(role: OnboardingRoleId, userId?: string): boolean {
  try {
    const key = getLocalStorageKey(role, userId);
    if (localStorage.getItem(key) === CURRENT_TOUR_VERSION) return true;
    if (!userId && localStorage.getItem(`olympos_onboarding_seen_${role}`) === CURRENT_TOUR_VERSION) {
      return true;
    }
  } catch {
    // ignora
  }
  return false;
}

function markLocalStorageSeen(role: OnboardingRoleId, userId?: string): void {
  try {
    localStorage.setItem(getLocalStorageKey(role, userId), CURRENT_TOUR_VERSION);
    localStorage.setItem(`olympos_onboarding_seen_${role}`, CURRENT_TOUR_VERSION);
  } catch {
    // ignora
  }
}

async function persistOnboardingSeen(role: OnboardingRoleId, userId?: string): Promise<void> {
  markLocalStorageSeen(role, userId);

  const sessao = window.OlymposApp?.getSession?.();
  if (sessao?.profile) {
    sessao.profile.onboarding_version_seen = CURRENT_TOUR_VERSION;
    try {
      sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(sessao.profile));
    } catch {
      // ignora
    }
  }

  if (role === 'VISITANTE') return;

  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;

  try {
    const sbSession = await window.OlymposSupabase?.getSession?.();
    if (!sbSession) return;
    await client.rpc('marcar_onboarding_visto', { p_versao: CURRENT_TOUR_VERSION });
  } catch {
    // Persistência local já garantida como contingência
  }
}

function isElementVisibleForTour(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.isConnected) return false;
  if (el.closest('.hidden')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function resolveFirstVisibleElement(selectorsCsv: string): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const selectors = selectorsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  for (const sel of selectors) {
    try {
      const candidates = document.querySelectorAll(sel);
      for (const el of Array.from(candidates)) {
        if (isElementVisibleForTour(el)) {
          return el;
        }
      }
    } catch {
      // seletor inválido ignorado
    }
  }
  return undefined;
}

function hasBlockingModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  const blockers = ['loginScreen', 'termoSigiloModal', 'modalMfaDesafio', 'modalMfaEnroll'];
  return blockers.some((id) => {
    const el = document.getElementById(id);
    return Boolean(el && !el.classList.contains('hidden'));
  });
}

async function launchDriverTour(role: OnboardingRoleId, userId?: string): Promise<void> {
  if (tourEmExecucao) return;
  if (hasBlockingModalOpen()) return;

  tourEmExecucao = true;
  try {
    // Carregamento 100% dinâmico: driver.js + CSS nunca entram no bundle principal
    const [{ driver }] = await Promise.all([
      import('driver.js'),
      import('driver.js/dist/driver.css')
    ]);

    const roteiro = getRoteiroPorPerfil(role);
    const steps = roteiro.map((step) => {
      const targetEl = resolveFirstVisibleElement(step.selector);
      return {
        ...(targetEl ? { element: targetEl } : {}),
        popover: {
          title: step.title,
          description: step.description,
          side: step.side || 'bottom',
          align: step.align || 'start'
        }
      };
    });

    let persisted = false;
    const finalizar = () => {
      tourEmExecucao = false;
      if (!persisted) {
        persisted = true;
        void persistOnboardingSeen(role, userId);
      }
    };

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      popoverClass: 'olympos-driver-popover',
      nextBtnText: 'Próximo →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Concluir',
      progressText: '{{current}} de {{total}}',
      steps,
      onDestroyStarted: () => {
        finalizar();
        driverObj.destroy();
      },
      onDestroyed: () => {
        finalizar();
      }
    });

    driverObj.drive();
  } catch (err) {
    tourEmExecucao = false;
    console.warn('[OnboardingTour] Falha ao iniciar driver.js:', err);
  }
}

export async function iniciarOnboardingSeNecessario(roleId?: string | null): Promise<boolean> {
  const sessao = window.OlymposApp?.getSession?.();
  const resolvedRole = normalizeOnboardingRole(
    roleId || sessao?.perfil?.id || sessao?.profile?.role || 'VISITANTE'
  );
  const userId = String(sessao?.user?.id || sessao?.profile?.id || '').trim() || undefined;

  // 1. Checagem síncrona no perfil em sessão e cache local (evita importar driver.js se já visto)
  const seenFromSession = sessao?.profile?.onboarding_version_seen;
  if (seenFromSession === CURRENT_TOUR_VERSION) {
    markLocalStorageSeen(resolvedRole, userId);
    return false;
  }
  if (isTourAlreadySeenLocally(resolvedRole, userId)) {
    return false;
  }

  // 2. Para operador autenticado sem onboarding_version_seen no objeto de sessão, confirma no Supabase
  if (resolvedRole !== 'VISITANTE' && userId) {
    const client = window.OlymposSupabase?.getClient?.();
    if (client) {
      try {
        const { data } = await client
          .from('profiles')
          .select('onboarding_version_seen')
          .eq('id', userId)
          .maybeSingle();
        if (data?.onboarding_version_seen === CURRENT_TOUR_VERSION) {
          if (sessao?.profile) sessao.profile.onboarding_version_seen = CURRENT_TOUR_VERSION;
          markLocalStorageSeen(resolvedRole, userId);
          return false;
        }
      } catch {
        // segue com fallback local
      }
    }
  }

  await launchDriverTour(resolvedRole, userId);
  return true;
}

export async function reverTourGuiado(roleId?: string | null): Promise<void> {
  const sessao = window.OlymposApp?.getSession?.();
  const resolvedRole = normalizeOnboardingRole(
    roleId || sessao?.perfil?.id || sessao?.profile?.role || 'VISITANTE'
  );
  const userId = String(sessao?.user?.id || sessao?.profile?.id || '').trim() || undefined;
  await launchDriverTour(resolvedRole, userId);
}

export const OlymposOnboarding = {
  CURRENT_TOUR_VERSION,
  ONBOARDING_ROTEIROS,
  getRoteiroPorPerfil,
  iniciarSeNecessario: iniciarOnboardingSeNecessario,
  iniciarOnboardingSeNecessario,
  reverTourGuiado
};

if (typeof window !== 'undefined') {
  (window as any).OlymposOnboarding = OlymposOnboarding;
}
