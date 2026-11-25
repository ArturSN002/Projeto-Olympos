/**
 * Hub Olympos V2 — Roteador Modular SPA (Hash Routing)
 * Cada bloco funcional opera em sua própria página independente e navegável.
 */
window.OlymposRouter = (function() {
  const PUBLIC_PAGES = ['visao-geral', 'diario-oficial', 'escolas', 'oraculo'];

  const PAGES = {
    'visao-geral': {
      eyebrow: 'GOVERNANÇA EXECUTIVA • SMEB 2026',
      title: 'Inteligência documental e governança pública.',
      subtitle: 'Painel central da Secretaria Municipal de Educação Básica de Ceará-Mirim: numeração sequencial oficial, atalhos operacionais e constelação das 22 memórias operacionais Olympos.',
      category: 'gabinete'
    },
    'oficios': {
      eyebrow: 'REDAÇÃO OFICIAL • PADRÃO PR/2018',
      title: 'Emissão de Ofícios Institucionais.',
      subtitle: 'Geração imediata de expedientes oficiais formatados no Google Docs com numeração sequencial por setor ou Gabinete.',
      category: 'atos'
    },
    'portarias': {
      eyebrow: 'O PINCEL DE HOMERO • PROCESSAMENTO EM LOTE',
      title: 'Portarias de Licenças e Readaptações.',
      subtitle: 'Verificação prévia de dados funcionais, numeração sequencial e emissão em lote de portarias no Google Docs.',
      category: 'atos'
    },
    'licencas': {
      eyebrow: 'GESTÃO DE PESSOAS • REGISTRO DIRETO',
      title: 'Cadastro de Licenças no Hub.',
      subtitle: 'Inserção direta na planilha oficial com cálculo automático de término para Licença-Prêmio e opção de emissão instantânea do Google Docs.',
      category: 'atos'
    },
    'certificados': {
      eyebrow: 'A LIRA DE ORFEU • FORMAÇÃO & EVENTOS',
      title: 'Certificados e Declarações Autenticáveis.',
      subtitle: 'Padronização de listas de participantes, QR Code de verificação de autenticidade, geração de PDFs e envio institucional.',
      category: 'atos'
    },
    'relatorios': {
      eyebrow: 'PRESTAÇÃO DE CONTAS • SMEB 2026',
      title: 'Relatórios Executivos Mensais.',
      subtitle: 'Consolidação mensal de ofícios, portarias, licenças, SLA de pendências e atos FEMURN com exportação em PDF e XLSX em 1 clique.',
      category: 'atos'
    },
    'diario-oficial': {
      eyebrow: 'PUBLICAÇÕES OFICIAIS • MONITORAMENTO DIÁRIO',
      title: 'Vigilância do Diário Oficial FEMURN.',
      subtitle: 'Acompanhamento diário dos atos da FEMURN, Diário Oficial de Ceará-Mirim e triagem inteligente com Gemma / Gemini.',
      category: 'inteligencia'
    },
    'papiro-cadmo': {
      eyebrow: 'QUADRO DE PERMUTAS • MOBILIDADE INTERMUNICIPAL',
      title: 'Monitoramento Mensal de Servidores Permutados.',
      subtitle: 'Acompanhamento mensal de permutas e cessões de servidores entre Ceará-Mirim e redes parceiras.',
      category: 'inteligencia'
    },
    'servidores': {
      eyebrow: 'QUADRO FUNCIONAL UNIFICADO • RN & MUNICÍPIOS',
      title: 'Consulta Integrada de Servidores Públicos.',
      subtitle: 'Pesquisa cadastral, dossiê funcional detalhado, lotação e auditoria de vínculos em 16 entes públicos monitorados no RN (Ceará-Mirim, Natal, SEEC/RN e parceiros).',
      category: 'gestao'
    },
    'escolas': {
      eyebrow: 'GEORREFERENCIAMENTO MUNICIPAL • REDE ESCOLAR SMEB',
      title: 'Mapa e Gestão das Escolas Municipais.',
      subtitle: 'Localização cartográfica, cadastro atualizado das unidades de ensino e distribuição territorial da rede.',
      category: 'gestao'
    },
    'calendario': {
      eyebrow: 'CALENDÁRIO ESCOLAR & AGENDA INTERSETORIAL • SMEB 2026–2027',
      title: 'Calendário Escolar e Planejamento.',
      subtitle: 'Controle de 203 dias letivos, 4 bimestres, recessos, cronograma de matrículas, eventos intersetoriais e exportação iCal.',
      category: 'gestao'
    },
    'personas': {
      eyebrow: 'ARQUITETURA COGNITIVA • 26 PERSONAS & 22 MEMÓRIAS GOOGLE DOCS',
      title: 'Ecossistema Olympos e Memórias Google Docs.',
      subtitle: 'Painel de diretrizes operacionais, 22 memórias canônicas em Google Docs e assistentes especializados da SMEB.',
      category: 'inteligencia'
    },
    'busca': {
      eyebrow: 'ÍNDICE RECURSIVO • EXERCÍCIOS 2025–2026',
      title: 'Busca Global no Acervo SMEB.',
      subtitle: 'Localização rápida de documentos, ofícios e portarias nas pastas setoriais de 2026 e no acervo de 2025.',
      category: 'inteligencia'
    },
    'oraculo': {
      eyebrow: 'ORÁCULO VETORIAL • GEMINI EMBEDDING 2 (ZERO CUSTO)',
      title: 'Oráculo Semântico & Citação Oficial.',
      subtitle: 'Pesquisa em linguagem natural nas normas, atos FEMURN, portarias, ofícios e memórias autorizadas com zero alucinação.',
      category: 'inteligencia'
    },
    'processos-seletivos': {
      eyebrow: 'MOTOR NIKÉ • SELEÇÃO PÚBLICA & FILA VIVA',
      title: 'Processos Seletivos Simplificados (PSS).',
      subtitle: 'Mapeamento condicional de formulários, desduplicação pela última inscrição, avaliação multi-fase, recursos e fila viva de convocações.',
      category: 'gestao'
    },
    'chamados': {
      eyebrow: 'CENTRAL DE ATENDIMENTO • SMEB 2026',
      title: 'Chamados e Pendências Operacionais.',
      subtitle: 'Acompanhamento das solicitações prioritárias da SMEB organizadas por ordem de chegada e previsão de atendimento no expediente.',
      category: 'atendimento'
    },
    'auditoria': {
      eyebrow: 'GOVERNANÇA & LGPD • SOMENTE MODERADOR',
      title: 'Trilha de Auditoria Imutável (audit_logs).',
      subtitle: 'Consulta auditada e imutável de acessos a dados pessoais, edições nas 22 memórias Google Docs, numeração Apolo e alterações de papéis RBAC.',
      category: 'sistema'
    },
    'kiosk': {
      eyebrow: 'PAINEL DE GABINETE • MODO TV 16:9',
      title: 'Monitoramento em Tempo Real SMEB.',
      subtitle: 'Visão limpa em tela cheia com prazos SLA sem dados pessoais, atos da FEMURN e Agenda Intersetorial.',
      category: 'gabinete'
    },
    'mural': {
      eyebrow: 'COMUNICAÇÃO INTERNA • MURAL COMPARTILHADO',
      title: 'Mural Institucional & Agenda SMEB.',
      subtitle: 'Comunicados setoriais, alinhamentos intersetoriais, confirmações de leitura e agenda integrada.',
      category: 'comunicacao'
    },
    'chat': {
      eyebrow: 'COMUNICAÇÃO INTERNA • TEMPO REAL',
      title: 'Chat Interno Olympos.',
      subtitle: 'Mensagens diretas (1-a-1) e grupos setoriais com sincronização instantânea e arquivamento auditável.',
      category: 'comunicacao'
    },
    'configuracoes': {
      eyebrow: 'INFRAESTRUTURA • CONECTIVIDADE & SEGURANÇA',
      title: 'Conexão, Sessão e Preferências.',
      subtitle: 'Configurações de conectividade, aparência visual do sistema, gestão de usuários e diretrizes operacionais.',
      category: 'sistema'
    }
  };

  let activePage = 'visao-geral';
  let suppressNextHashChange = false;
  let navSequence = 0;

  function extrairRotaEQueryHash(rawHash) {
    const clean = String(rawHash || '').replace(/^#/, '').trim();
    const qIdx = clean.indexOf('?');
    if (qIdx >= 0) {
      return {
        route: clean.slice(0, qIdx).trim() || 'visao-geral',
        query: clean.slice(qIdx)
      };
    }
    return {
      route: clean || 'visao-geral',
      query: ''
    };
  }

  function init() {
    window.addEventListener('hashchange', function() {
      if (suppressNextHashChange) {
        suppressNextHashChange = false;
        return;
      }
      const parsed = extrairRotaEQueryHash(window.location.hash);
      navegarPara(parsed.route, true, parsed.query);
    });

    const parsedInit = extrairRotaEQueryHash(window.location.hash);
    navegarPara(parsedInit.route, true, parsedInit.query);
  }

  function navegarPara(pageId, replaceState, hashQueryOpt) {
    let targetSubtab = null;
    const parsedArg = extrairRotaEQueryHash(pageId);
    pageId = parsedArg.route;
    const preservedQuery = (hashQueryOpt !== undefined ? hashQueryOpt : parsedArg.query) || '';
    if (pageId === 'pendencias') {
      pageId = 'chamados';
    }
    if (pageId === 'permutas') {
      pageId = 'papiro-cadmo';
    }
    if (pageId === 'ajustes') {
      pageId = 'configuracoes';
    }
    if (pageId === 'personas') {
      pageId = 'configuracoes';
      targetSubtab = 'personas';
    }
    if (pageId === 'consulta-servidores') {
      pageId = 'servidores';
    }
    if (pageId === 'licencas') {
      pageId = 'portarias';
      targetSubtab = 'licencas';
    }
    if (pageId === 'pss') {
      pageId = 'processos-seletivos';
    }

    if (!PAGES[pageId]) {
      pageId = 'visao-geral';
    }

    const sessaoAtiva = window.OlymposApp && typeof window.OlymposApp.getSession === 'function'
      ? window.OlymposApp.getSession()
      : null;

    if (pageId === 'oraculo' && sessaoAtiva) {
      pageId = 'configuracoes';
      targetSubtab = 'oraculo';
    }
    if (pageId === 'auditoria' && sessaoAtiva) {
      pageId = 'configuracoes';
      targetSubtab = 'auditoria';
    }

    if (!sessaoAtiva && !PUBLIC_PAGES.includes(pageId)) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Faça login para acessar este módulo restrito.', true);
      }
      if (window.OlymposApp && typeof window.OlymposApp.solicitarLogin === 'function') {
        window.OlymposApp.solicitarLogin();
      }
      pageId = 'visao-geral';
      targetSubtab = null;
    } else if (sessaoAtiva && window.OlymposApp && typeof window.OlymposApp.podeAcessarPagina === 'function') {
      const checkPage = targetSubtab === 'licencas' ? 'licencas' : (targetSubtab === 'auditoria' ? 'auditoria' : pageId);
      if (!window.OlymposApp.podeAcessarPagina(checkPage)) {
        if (typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Seu nível de acesso atual não possui permissão para este módulo.', true);
        }
        pageId = 'visao-geral';
        targetSubtab = null;
      }
    }

    activePage = pageId;
    if (document.body) {
      document.body.setAttribute('data-active-page', pageId);
    }
    const nextHash = '#' + pageId + (pageId === 'certificados' ? preservedQuery : '');
    if (window.location.hash !== nextHash) {
      if (replaceState) {
        window.history.replaceState(null, '', nextHash);
      } else {
        suppressNextHashChange = true;
        window.location.hash = nextHash;
      }
    }

    document.querySelectorAll('.page-view').forEach(function(view) {
      const isTarget = view.id === 'page-' + pageId;
      view.classList.toggle('active', isTarget);
      view.classList.toggle('hidden', !isTarget);
    });

    // ISOLAMENTO DOS GATILHOS DO HERO: Exibe "Abrir Central de Chamados" e "Consultar Diário Oficial" EXCLUSIVAMENTE na Visão Geral
    const heroDualActions = document.getElementById('heroDualActions') || document.querySelector('.hero-dual-actions');
    if (heroDualActions) {
      const showHeroActions = (pageId === 'visao-geral');
      heroDualActions.classList.toggle('hidden', !showHeroActions);
      heroDualActions.style.display = showHeroActions ? 'flex' : 'none';
      heroDualActions.setAttribute('aria-hidden', showHeroActions ? 'false' : 'true');
    }

    // ISOLAMENTO DA TELEMETRIA: Exibe a fita de telemetria EXCLUSIVAMENTE na Visão Geral
    const telemetryStrip = document.getElementById('heroTelemetryStrip') || document.querySelector('.telemetry-strip');
    if (telemetryStrip) {
      const showTelemetry = (pageId === 'visao-geral');
      telemetryStrip.classList.toggle('hidden', !showTelemetry);
      telemetryStrip.style.display = showTelemetry ? '' : 'none';
    }

    document.querySelectorAll('.nav-link').forEach(function(link) {
      const linkPage = link.getAttribute('data-page');
      if (linkPage) {
        link.classList.toggle('active', linkPage === pageId);
      }
    });

    // Destaque ativo dinâmico para dropdowns com itens navegáveis (Documentos, Agenda, Pessoal)
    document.querySelectorAll('.nav-dropdown').forEach(function(dd) {
      const hasActiveChild = Array.from(dd.querySelectorAll('.dropdown-item[data-page]')).some(function(item) {
        return item.getAttribute('data-page') === pageId;
      });
      dd.classList.toggle('active', hasActiveChild);
      const trigger = dd.querySelector('.nav-dropdown-trigger');
      if (trigger) trigger.classList.toggle('active', hasActiveChild);
    });

    // Fechar dropdowns de navegação ao navegar
    if (window.OlymposApp && typeof window.OlymposApp.fecharDropdowns === 'function') {
      window.OlymposApp.fecharDropdowns();
    }

    const meta = PAGES[pageId];
    const eyebrowElem = document.getElementById('pageHeaderEyebrow');
    const titleElem = document.getElementById('pageHeaderTitle');
    const subtitleElem = document.getElementById('pageHeaderSubtitle');

    const sessaoAtual = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;
    const isAuth = Boolean(sessaoAtual && sessaoAtual.perfil);

    if (pageId === 'visao-geral' && !isAuth) {
      if (eyebrowElem) eyebrowElem.textContent = 'SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA • CEARÁ-MIRIM/RN';
      if (titleElem) titleElem.textContent = 'Bem-vindo ao Portal Olympos da Educação.';
      if (subtitleElem) subtitleElem.textContent = 'Acompanhe o Diário Oficial do município, localize escolas da rede municipal no mapa, consulte o calendário letivo e leia as notícias oficiais de Ceará-Mirim.';
    } else {
      if (eyebrowElem) eyebrowElem.textContent = meta.eyebrow;
      if (titleElem) titleElem.textContent = meta.title;
      if (subtitleElem) subtitleElem.textContent = meta.subtitle;
    }

    document.body.classList.remove('nav-drawer-open');
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

    const currentSeq = ++navSequence;

    function ativarPaginaMontada() {
      if (currentSeq !== navSequence) return;

      document.querySelectorAll('.page-view').forEach(function(view) {
        const isTarget = view.id === 'page-' + pageId;
        view.classList.toggle('active', isTarget);
        view.classList.toggle('hidden', !isTarget);
      });

      if (pageId === 'portarias') {
        if (window.OlymposViews && window.OlymposViews.portarias && typeof window.OlymposViews.portarias.alternarSubtab === 'function') {
          window.OlymposViews.portarias.alternarSubtab(targetSubtab || 'lote');
        }
      }

      if (pageId === 'configuracoes') {
        if (window.OlymposViews && window.OlymposViews.configuracoes && typeof window.OlymposViews.configuracoes.init === 'function') {
          window.OlymposViews.configuracoes.init(targetSubtab || 'conexao');
        }
      }

      if (window.OlymposApp && typeof window.OlymposApp.aplicarControleAcessoModularEDrive === 'function') {
        window.OlymposApp.aplicarControleAcessoModularEDrive();
      }
      if (window.OlymposRbac && typeof window.OlymposRbac.aplicarAtributosPermissaoDom === 'function') {
        window.OlymposRbac.aplicarAtributosPermissaoDom();
      }
      dispararCarregamentoPagina(pageId);
    }

    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.loadRoute === 'function') {
      window.OlymposRouteLoader.loadRoute(pageId).then(ativarPaginaMontada);
    } else {
      ativarPaginaMontada();
    }
  }

  function dispararCarregamentoPagina(pageId) {
    if (!window.OlymposViews) return;
    if (pageId === 'configuracoes') return;
    const map = {
      'visao-geral': 'visaoGeral',
      'oficios': 'oficios',
      'portarias': 'portarias',
      'licencas': 'licencas',
      'certificados': 'certificados',
      'relatorios': 'relatorios',
      'diario-oficial': 'diarioOficial',
      'papiro-cadmo': 'papiroCadmo',
      'servidores': 'servidores',
      'escolas': 'escolas',
      'calendario': 'calendario',
      'personas': 'personas',
      'busca': 'busca',
      'oraculo': 'oraculo',
      'chamados': 'chamados',
      'mural': 'mural',
      'chat': 'chat',
      'auditoria': 'auditoria',
      'configuracoes': 'configuracoes'
    };
    const key = map[pageId];
    if (key && window.OlymposViews[key] && typeof window.OlymposViews[key].init === 'function') {
      window.OlymposViews[key].init();
    }
    if (pageId === 'portarias' && window.OlymposViews.licencas && typeof window.OlymposViews.licencas.init === 'function') {
      window.OlymposViews.licencas.init();
    }
  }

  function getPaginaAtual() {
    return activePage;
  }

  return {
    init: init,
    navegarPara: navegarPara,
    getPaginaAtual: getPaginaAtual,
    PAGES: PAGES,
    PUBLIC_PAGES: PUBLIC_PAGES
  };
})();
