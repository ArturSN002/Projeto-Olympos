/**
 * Hub Olympos V2 — Roteador Modular SPA (Hash Routing)
 * Cada bloco funcional opera em sua própria página independente e navegável.
 */
window.OlymposRouter = (function() {
  const PAGES = {
    'visao-geral': {
      eyebrow: 'GOVERNANÇA EXECUTIVA • SMEB 2026',
      title: 'Inteligência documental e governança pública.',
      subtitle: 'Painel central da Secretaria Municipal de Educação Básica de Ceará-Mirim: numeração sequencial oficial, atalhos operacionais e constelação das 17 personas Olympos.',
      category: 'gabinete'
    },
    'oficios': {
      eyebrow: 'REDAÇÃO OFICIAL • PADRÃO PR/2018',
      title: 'Emissão de Ofícios do Gabinete.',
      subtitle: 'Geração imediata de expedientes oficiais formatados no Google Docs com reserva atômica de numeração pelo Olho de Apolo.',
      category: 'atos'
    },
    'portarias': {
      eyebrow: 'O PINCEL DE HOMERO • PROCESSAMENTO EM LOTE',
      title: 'Portarias de Licenças e Readaptações.',
      subtitle: 'Diagnóstico pré-voo, auto-numeração sequencial, carimbo de revogação cruzada e exibição imediata dos links dos documentos gerados.',
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
      subtitle: 'Padronização prévia de nomes e e-mails, QR Code com hash SHA-256 de autenticidade, links de acesso aos PDFs e proteção automática de cota.',
      category: 'atos'
    },
    'diario-oficial': {
      eyebrow: 'FOGO DE PROMETHEUS • GITHUB ACTIONS + GAS',
      title: 'Vigilância do Diário Oficial FEMURN.',
      subtitle: 'Integração unificada nas duas frentes do Hub: coleta diária em Python/OCR no GitHub Actions e indexação exclusiva na planilha oficial única da SMEB.',
      category: 'inteligencia'
    },
    'papiro-cadmo': {
      eyebrow: 'O PAPIRO DE CADMO • ETL INTERMUNICIPAL RN',
      title: 'Monitoramento Mensal de Servidores Permutados.',
      subtitle: 'Extração automatizada de 15 municípios potiguares e SEEC/RN com consolidação em esquema canônico de 8 colunas para Cadmo e Hera.',
      category: 'inteligencia'
    },
    'servidores': {
      eyebrow: 'QUADRO FUNCIONAL UNIFICADO • RN & MUNICÍPIOS',
      title: 'Consulta Integrada de Servidores Públicos.',
      subtitle: 'Pesquisa cadastral, dossiê funcional detalhado, lotação e auditoria de vínculos de Ceará-Mirim, Natal, Parnamirim, São Gonçalo do Amarante e Governo do RN (SEEC).',
      category: 'gestao'
    },
    'escolas': {
      eyebrow: 'GEORREFERENCIAMENTO MUNICIPAL • REDE ESCOLAR SMEB',
      title: 'Mapa e Gestão das Escolas Municipais.',
      subtitle: 'Localização cartográfica, cadastro georreferenciado (CRUD com latitude e longitude) e distribuição territorial das unidades da SMEB de Ceará-Mirim.',
      category: 'gestao'
    },
    'calendario': {
      eyebrow: 'CALENDÁRIO ESCOLAR & AGENDA INTERSETORIAL • SMEB 2026–2027',
      title: 'Calendário Escolar e Planejamento.',
      subtitle: 'Controle de 203 dias letivos, 4 bimestres, recessos, cronograma de matrículas, eventos intersetoriais e exportação iCal.',
      category: 'gestao'
    },
    'personas': {
      eyebrow: 'ARQUITETURA COGNITIVA • 17 PERSONAS & 11 MEMÓRIAS',
      title: 'Ecossistema Olympos e Memórias .md.',
      subtitle: 'Governança em tempo real dos 11 arquivos de memória operacional (teto de 60 linhas sem criação de duplicatas) e das 6 personas roteadas por anfitriã.',
      category: 'inteligencia'
    },
    'busca': {
      eyebrow: 'ÍNDICE RECURSIVO • EXERCÍCIOS 2025–2026',
      title: 'Busca Global no Acervo SMEB.',
      subtitle: 'Pesquisa tokenizada e insensível a acentos ou separadores em pastas setoriais ativas de 2026 e no acervo histórico de 2025.',
      category: 'inteligencia'
    },
    'configuracoes': {
      eyebrow: 'INFRAESTRUTURA • DUAL-FRONT GATEWAY',
      title: 'Conexão, Sessão e Preferências.',
      subtitle: 'Gerenciamento do endpoint Google Apps Script, diagnóstico de latência, perfil RBAC ativo e alternância entre Modo Claro e Modo Escuro.',
      category: 'sistema'
    }
  };

  let activePage = 'visao-geral';
  let suppressNextHashChange = false;

  function init() {
    window.addEventListener('hashchange', function() {
      if (suppressNextHashChange) {
        suppressNextHashChange = false;
        return;
      }
      const hash = window.location.hash.replace('#', '').trim();
      navegarPara(hash || 'visao-geral', true);
    });

    const initialHash = window.location.hash.replace('#', '').trim();
    navegarPara(initialHash || 'visao-geral', true);
  }

  function navegarPara(pageId, replaceState) {
    let targetSubtab = null;
    if (pageId === 'permutas') {
      pageId = 'papiro-cadmo';
    }
    if (pageId === 'consulta-servidores') {
      pageId = 'servidores';
    }
    if (pageId === 'licencas') {
      pageId = 'portarias';
      targetSubtab = 'licencas';
    }

    if (!PAGES[pageId]) {
      pageId = 'visao-geral';
    }

    activePage = pageId;
    if (window.location.hash !== '#' + pageId) {
      if (replaceState) {
        window.history.replaceState(null, '', '#' + pageId);
      } else {
        suppressNextHashChange = true;
        window.location.hash = '#' + pageId;
      }
    }

    document.querySelectorAll('.page-view').forEach(function(view) {
      const isTarget = view.id === 'page-' + pageId;
      view.classList.toggle('active', isTarget);
      view.classList.toggle('hidden', !isTarget);
    });

    document.querySelectorAll('.nav-link').forEach(function(link) {
      const linkPage = link.getAttribute('data-page');
      if (linkPage) {
        link.classList.toggle('active', linkPage === pageId);
      }
    });

    // Destaque ativo para container e trigger do dropdown Documentos
    const isDocPage = ['oficios', 'portarias', 'certificados'].includes(pageId);
    document.querySelectorAll('.nav-dropdown').forEach(function(dd) {
      dd.classList.toggle('active', isDocPage);
    });
    document.querySelectorAll('.nav-dropdown-trigger').forEach(function(trigger) {
      trigger.classList.toggle('active', isDocPage);
    });

    // Fechar dropdowns de navegação ao navegar
    if (window.OlymposApp && typeof window.OlymposApp.fecharDropdowns === 'function') {
      window.OlymposApp.fecharDropdowns();
    }

    const meta = PAGES[pageId];
    const eyebrowElem = document.getElementById('pageHeaderEyebrow');
    const titleElem = document.getElementById('pageHeaderTitle');
    const subtitleElem = document.getElementById('pageHeaderSubtitle');

    if (eyebrowElem) eyebrowElem.textContent = meta.eyebrow;
    if (titleElem) titleElem.textContent = meta.title;
    if (subtitleElem) subtitleElem.textContent = meta.subtitle;

    document.body.classList.remove('nav-drawer-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pageId === 'portarias') {
      if (window.OlymposViews && window.OlymposViews.portarias && typeof window.OlymposViews.portarias.alternarSubtab === 'function') {
        window.OlymposViews.portarias.alternarSubtab(targetSubtab || 'lote');
      }
    }

    dispararCarregamentoPagina(pageId);
  }

  function dispararCarregamentoPagina(pageId) {
    if (!window.OlymposViews) return;
    const map = {
      'visao-geral': 'visaoGeral',
      'oficios': 'oficios',
      'portarias': 'portarias',
      'licencas': 'licencas',
      'certificados': 'certificados',
      'diario-oficial': 'diarioOficial',
      'papiro-cadmo': 'papiroCadmo',
      'servidores': 'servidores',
      'escolas': 'escolas',
      'calendario': 'calendario',
      'personas': 'personas',
      'busca': 'busca',
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
    PAGES: PAGES
  };
})();
