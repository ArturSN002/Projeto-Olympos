/**
 * Hub Olympos V2.1 — Controlador Central da Aplicação Modular
 * Estética Editorial (Google DeepMind + The Keyword), RBAC, Tema 60-30-10 e Modais.
 */
window.OlymposApp = (function() {
  let currentUserSession = null;
  let activeMemoriaEditando = null;

  const LEGACY_TAB_MAP = {
    'tab-apolo': ['visao-geral', 'oficios', 'personas', 'busca'],
    'tab-pincel': ['portarias', 'oficios'],
    'tab-licencas': ['licencas'],
    'tab-lira': ['certificados'],
    'tab-prometheus': ['diario-oficial', 'papiro-cadmo']
  };

  document.addEventListener('DOMContentLoaded', function() {
    hydrateVectorIcons();
    initTheme();
    initSession();
    bindGlobalElements();
    window.OlymposRouter.init();
    verificarStatusConexaoInicial();
  });

  function hydrateVectorIcons() {
    if (!window.OlymposIcons) return;
    const setHtml = function(id, svg) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = svg;
    };

    setHtml('brandMarkSvg', window.OlymposIcons.ui('olymposMark'));
    setHtml('topQuickSearchBtn', window.OlymposIcons.ui('search'));
    setHtml('mobileMenuToggleBtn', window.OlymposIcons.ui('menu'));
    setHtml('closeModalBtn', window.OlymposIcons.ui('close'));
    setHtml('closeContadoresModalBtn', window.OlymposIcons.ui('close'));
    setHtml('pincelDoneCheckSvg', window.OlymposIcons.ui('check'));

    document.querySelectorAll('[data-persona-icon]').forEach(function(badge) {
      const key = badge.getAttribute('data-persona-icon');
      badge.innerHTML = window.OlymposIcons.get(key);
    });
  }

  // =========================================================================
  // TEMA 60-30-10 (MODO CLARO & MODO ESCURO DEEPMIND MIDNIGHT)
  // =========================================================================
  function initTheme() {
    const saved = localStorage.getItem('olympos_theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    definirTema(saved);
  }

  function definirTema(theme) {
    const target = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('olympos_theme', target);

    const btn = document.getElementById('themeToggleBtn');
    if (btn && window.OlymposIcons) {
      btn.innerHTML = target === 'dark'
        ? window.OlymposIcons.ui('sunMode')
        : window.OlymposIcons.ui('moonMode');
    }

    const sel = document.getElementById('configTemaSelect');
    if (sel) sel.value = target;
  }

  function alternarTema() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    definirTema(current === 'dark' ? 'light' : 'dark');
  }

  // =========================================================================
  // AUTENTICAÇÃO E CONTROLE DE ACESSO RBAC
  // =========================================================================
  function initSession() {
    // 1. Tenta sessionStorage (memória da aba ativa para carregamento veloz)
    try {
      const cachedRbac = sessionStorage.getItem('olympos_session_rbac');
      if (cachedRbac) {
        const sessionObj = JSON.parse(cachedRbac);
        if (sessionObj && sessionObj.perfil) {
          currentUserSession = sessionObj;
          aplicarSessaoNaInterface(currentUserSession);
          return;
        }
      }
    } catch (e) {
      sessionStorage.removeItem('olympos_session_rbac');
    }

    // 2. Fallback resiliente para localStorage
    const stored = localStorage.getItem('olympos_session');
    if (stored) {
      try {
        currentUserSession = JSON.parse(stored);
        try {
          sessionStorage.setItem('olympos_session_rbac', JSON.stringify(currentUserSession));
          if (currentUserSession.perfil) {
            sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(currentUserSession.perfil));
          }
        } catch (eStore) {}
        aplicarSessaoNaInterface(currentUserSession);
      } catch (e) {
        localStorage.removeItem('olympos_session');
        solicitarLogin();
      }
    } else {
      solicitarLogin();
    }
  }

  function solicitarLogin() {
    const modal = document.getElementById('loginScreen');
    if (modal) modal.classList.remove('hidden');
  }

  const RBAC_TAB_PERMISSIONS = {
    ADMIN_GABINETE: [
      'visao-geral', 'oficios', 'portarias', 'licencas', 'certificados',
      'diario-oficial', 'papiro-cadmo', 'personas', 'busca', 'configuracoes'
    ],
    RH_COMISSAO: [
      'visao-geral', 'oficios', 'portarias', 'licencas',
      'diario-oficial', 'papiro-cadmo', 'personas', 'busca', 'configuracoes'
    ],
    PEDAGOGICO_EVENTOS: [
      'visao-geral', 'oficios', 'certificados', 'personas', 'busca', 'configuracoes'
    ],
    JURIDICO: [
      'visao-geral', 'oficios', 'portarias', 'diario-oficial',
      'papiro-cadmo', 'personas', 'busca', 'configuracoes'
    ]
  };

  async function handleLoginSubmit() {
    const userInputEl = document.getElementById('loginUserInput') || document.getElementById('loginEmail');
    const passInputEl = document.getElementById('loginPasswordInput') || document.getElementById('loginSenha');
    const userInput = userInputEl ? userInputEl.value.trim() : '';
    const passInput = passInputEl ? passInputEl.value.trim() : '';
    const btn = document.getElementById('loginSubmitBtn');

    if (!userInput || !passInput) {
      showToast('Informe identificador/e-mail e senha de acesso.', true);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Validando credenciais...';

    // 1. Autenticação primária via Supabase Auth
    if (window.OlymposSupabase && window.OlymposSupabase.isConfigured()) {
      try {
        const authResult = await window.OlymposSupabase.login(userInput, passInput);
        btn.disabled = false;
        btn.textContent = 'Acessar Ambiente Olympos';

        const profile = authResult.profile || {};
        const role = profile.role || 'RH_COMISSAO';
        const abas = RBAC_TAB_PERMISSIONS[role] || RBAC_TAB_PERMISSIONS.RH_COMISSAO;

        currentUserSession = {
          ok: true,
          token: authResult.session.access_token,
          access_token: authResult.session.access_token,
          usuario: authResult.user.email,
          nome: profile.full_name || authResult.user.email,
          perfil: {
            id: role,
            nome: role,
            abasPermitidas: abas
          }
        };

        localStorage.setItem('olympos_session', JSON.stringify(currentUserSession));
        try {
          sessionStorage.setItem('olympos_session_rbac', JSON.stringify(currentUserSession));
          sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(profile));
        } catch (eStore) {}
        document.getElementById('loginScreen').classList.add('hidden');
        aplicarSessaoNaInterface(currentUserSession);
        showToast('Bem-vindo(a), ' + (profile.full_name || authResult.user.email) + '!');

        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
        window.OlymposRouter.navegarPara(window.OlymposRouter.getPaginaAtual(), true);
        return;
      } catch (err) {
        console.warn('[handleLoginSubmit] Falha no Supabase Auth:', err);
        if (err.message && (err.message.includes('Invalid login') || err.message.includes('credentials'))) {
          btn.disabled = false;
          btn.textContent = 'Acessar Ambiente Olympos';
          showToast('Credenciais inválidas no Supabase Auth. Verifique e-mail e senha.', true);
          return;
        }
      }
    }

    // 2. Fallback via backend GAS (se configurado ou em contingência)
    window.OlymposApi.chamar('auth_login', { usuario: userInput, senha: passInput }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Acessar Ambiente Olympos';

      if (res && res.ok) {
        currentUserSession = res;
        localStorage.setItem('olympos_session', JSON.stringify(res));
        try {
          sessionStorage.setItem('olympos_session_rbac', JSON.stringify(res));
          if (res.perfil) {
            sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(res.perfil));
          }
        } catch (eStore) {}
        document.getElementById('loginScreen').classList.add('hidden');
        aplicarSessaoNaInterface(res);
        showToast(res.mensagem || 'Acesso autenticado com sucesso!');

        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
        window.OlymposRouter.navegarPara(window.OlymposRouter.getPaginaAtual(), true);
      } else {
        showToast((res && res.mensagem) || 'Credenciais inválidas. Configure o Supabase no botão abaixo.', true);
      }
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Acessar Ambiente Olympos';
      showToast('Falha de comunicação ao autenticar: ' + err.message, true);
    });
  }

  async function fazerLogout() {
    if (window.OlymposSupabase && typeof window.OlymposSupabase.logout === 'function') {
      try {
        await window.OlymposSupabase.logout();
      } catch (e) {
        // silencia
      }
    }
    localStorage.removeItem('olympos_session');
    try {
      sessionStorage.removeItem('olympos_session_rbac');
      sessionStorage.removeItem('olympos_rbac_profile_cache');
    } catch (e) {}
    currentUserSession = null;
    const blocoGestao = document.getElementById('blocoGestaoUsuarios');
    if (blocoGestao) blocoGestao.classList.add('hidden');
    const topNovoUsuarioBtn = document.getElementById('topNovoUsuarioBtn');
    if (topNovoUsuarioBtn) topNovoUsuarioBtn.classList.add('hidden');
    showToast('Sessão encerrada.');
    solicitarLogin();
  }

  function normalizarPermissoesRbac(listaBruta) {
    const set = new Set(['visao-geral', 'configuracoes', 'personas', 'busca', 'escolas', 'calendario', 'papiro-cadmo']);
    (listaBruta || []).forEach(function(item) {
      if (LEGACY_TAB_MAP[item]) {
        LEGACY_TAB_MAP[item].forEach(function(p) { set.add(p); });
      } else {
        set.add(item);
      }
    });
    return Array.from(set);
  }

  function aplicarSessaoNaInterface(sessao) {
    if (!sessao || !sessao.perfil) return;

    const nomeExibicao = sessao.nome || sessao.usuario || 'Gabinete';
    const userBadgeName = document.getElementById('userBadgeName');
    const userBadgeRole = document.getElementById('userBadgeRole');
    const avatarInitials = document.getElementById('userAvatarInitials');

    if (userBadgeName) userBadgeName.textContent = nomeExibicao;
    if (userBadgeRole) userBadgeRole.textContent = sessao.perfil.nome || 'Autenticado';
    if (avatarInitials) {
      const partes = nomeExibicao.split(/\s+/).filter(Boolean);
      const iniciais = partes.length >= 2
        ? (partes[0][0] + partes[1][0]).toUpperCase()
        : nomeExibicao.substring(0, 2).toUpperCase();
      avatarInitials.textContent = iniciais;
    }

    const permitidas = normalizarPermissoesRbac(sessao.perfil.abasPermitidas);
    document.querySelectorAll('.nav-link').forEach(function(link) {
      const pageTarget = link.getAttribute('data-page');
      if (!pageTarget) return;
      if (permitidas.includes(pageTarget) || permitidas.includes('TODOS')) {
        link.classList.remove('hidden');
      } else {
        link.classList.add('hidden');
      }
    });

    document.querySelectorAll('.nav-dropdown').forEach(function(dd) {
      const items = dd.querySelectorAll('.dropdown-item');
      if (items.length > 0) {
        const hasVisible = Array.from(items).some(function(item) {
          return !item.classList.contains('hidden');
        });
        dd.classList.toggle('hidden', !hasVisible);
      }
    });

    // Controle de Visibilidade RBAC para Moderador (ADMIN_GABINETE)
    const isAdmin = Boolean(sessao.perfil && (sessao.perfil.id === 'ADMIN_GABINETE' || sessao.perfil.nome === 'ADMIN_GABINETE'));
    const blocoGestao = document.getElementById('blocoGestaoUsuarios');
    if (blocoGestao) {
      if (isAdmin) {
        blocoGestao.classList.remove('hidden');
      } else {
        blocoGestao.classList.add('hidden');
      }
    }
    const topNovoUsuarioBtn = document.getElementById('topNovoUsuarioBtn');
    if (topNovoUsuarioBtn) {
      if (isAdmin) {
        topNovoUsuarioBtn.classList.remove('hidden');
      } else {
        topNovoUsuarioBtn.classList.add('hidden');
      }
    }
  }

  function getSession() {
    return currentUserSession;
  }

  function getSessaoAtual() {
    return currentUserSession;
  }

  function atualizarTokenSessao(novoToken) {
    if (!novoToken) return;
    if (currentUserSession) {
      currentUserSession.token = novoToken;
      currentUserSession.access_token = novoToken;
      try {
        localStorage.setItem('olympos_session', JSON.stringify(currentUserSession));
      } catch (e) {}
    }
  }

  // =========================================================================
  // JANELA COMPANION GEMINI (DESKTOP RESEARCH ASSISTANT)
  // =========================================================================
  function abrirJanelaGeminiCompanion() {
    const width = 520;
    const height = 780;
    const availWidth = (window.screen && window.screen.availWidth) ? window.screen.availWidth : window.innerWidth;
    const availHeight = (window.screen && window.screen.availHeight) ? window.screen.availHeight : window.innerHeight;

    // Posicionamento ergonômico no quadrante direito da tela
    const left = Math.max(0, availWidth - 540);
    const top = Math.max(20, Math.round((availHeight - height) / 2));

    const windowFeatures = [
      'width=' + width,
      'height=' + height,
      'left=' + left,
      'top=' + top,
      'resizable=yes',
      'scrollbars=yes',
      'status=no',
      'toolbar=no',
      'menubar=no',
      'location=yes'
    ].join(',');

    const geminiWin = window.open('https://gemini.google.com/', 'GeminiOlympos', windowFeatures);
    if (geminiWin && !geminiWin.closed) {
      geminiWin.focus();
    }
  }

  // =========================================================================
  // SKELETON LOADERS EDITORIAL (TABELAS ANIMADAS)
  // =========================================================================
  function renderSkeletonTable(tbodyElement, rows = 4, cols = 4, colWidths = ['15%', '25%', '45%', '15%']) {
    if (!tbodyElement) return;
    tbodyElement.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      tr.className = 'skeleton-table-row skeleton-row';
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.className = 'skeleton-cell';
        const w = colWidths[c % colWidths.length] || '100%';
        td.innerHTML = '<span class="skeleton-shimmer" style="max-width: ' + w + ';"></span>';
        tr.appendChild(td);
      }
      tbodyElement.appendChild(tr);
    }
  }

  // =========================================================================
  // CONFIGURAÇÃO DE DESTINATÁRIOS DO BOLETIM (BOLETIM_DESTINATARIOS_EMAIL)
  // =========================================================================
  function carregarConfiguracaoBoletimEmails() {
    const salvo = localStorage.getItem('olympos_boletim_emails') || '';
    const inCfg = document.getElementById('configBoletimEmailInput');
    const inDiario = document.getElementById('diarioBoletimEmailInput');
    if (inCfg && !inCfg.value) inCfg.value = salvo;
    if (inDiario && !inDiario.value) inDiario.value = salvo;

    const hasToken = Boolean(
      currentUserSession ||
      (window.OlymposApi && typeof window.OlymposApi.getJwtToken === 'function' && window.OlymposApi.getJwtToken())
    );
    if (hasToken && window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('prometheus_get_config', {}, function(res) {
        if (res && res.destinatarios) {
          localStorage.setItem('olympos_boletim_emails', res.destinatarios);
          if (inCfg) inCfg.value = res.destinatarios;
          if (inDiario) inDiario.value = res.destinatarios;
        }
      });
    }
  }

  function salvarBoletimEmails(emails) {
    const clean = String(emails || '').trim();
    localStorage.setItem('olympos_boletim_emails', clean);
    const inCfg = document.getElementById('configBoletimEmailInput');
    const inDiario = document.getElementById('diarioBoletimEmailInput');
    if (inCfg) inCfg.value = clean;
    if (inDiario) inDiario.value = clean;

    const fbCfg = document.getElementById('configBoletimEmailFeedback');
    const fbDiario = document.getElementById('diarioBoletimEmailFeedback');
    if (fbCfg) {
      fbCfg.textContent = 'Gravando destinatários...';
      fbCfg.style.display = 'block';
    }
    if (fbDiario) {
      fbDiario.textContent = 'Gravando destinatários...';
      fbDiario.style.display = 'block';
    }

    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('prometheus_config_emails', { destinatarios: clean }, function(res) {
        const msg = (res && res.mensagem) || 'Destinatários do boletim gravados com sucesso!';
        if (fbCfg) fbCfg.textContent = '✅ ' + msg;
        if (fbDiario) fbDiario.textContent = '✅ ' + msg;
        showToast(msg);
      }, function(err) {
        if (fbCfg) fbCfg.textContent = '⚠️ Salvo localmente no navegador (pendente sync com servidor).';
        if (fbDiario) fbDiario.textContent = '⚠️ Salvo localmente no navegador.';
        showToast('Destinatários salvos localmente.');
      });
    } else {
      showToast('Destinatários gravados no armazenamento local.');
    }
  }

  function testarEnvioBoletim() {
    const inCfg = document.getElementById('configBoletimEmailInput');
    const emails = inCfg ? inCfg.value.trim() : '';
    showToast('Enviando boletim de teste para ' + (emails || 'destinatários configurados') + '...');
    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('prometheus_test_email', { destinatarios: emails }, function(res) {
        showToast((res && res.mensagem) || 'Disparo de teste concluído com sucesso!');
      }, function(err) {
        showToast('Falha no teste: ' + err.message, true);
      });
    }
  }

  function fecharDropdowns() {
    document.querySelectorAll('.nav-dropdown').forEach(function(dd) {
      dd.classList.remove('open');
    });
    document.querySelectorAll('.nav-dropdown-trigger').forEach(function(btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  // =========================================================================
  // EVENTOS GLOBAIS E ATALHOS DE TECLADO
  // =========================================================================
  function bindGlobalElements() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLoginSubmit();
      });
    }

    const brandHome = document.getElementById('brandHomeLink');
    if (brandHome) {
      brandHome.addEventListener('click', function() {
        window.OlymposRouter.navegarPara('visao-geral');
      });
    }

    const btnTheme = document.getElementById('themeToggleBtn');
    if (btnTheme) btnTheme.addEventListener('click', alternarTema);

    const btnGemini = document.getElementById('topGeminiBtn');
    if (btnGemini) {
      btnGemini.addEventListener('click', function() {
        abrirJanelaGeminiCompanion();
      });
    }

    const btnUser = document.getElementById('userSessionBtn');
    if (btnUser) {
      btnUser.addEventListener('click', function() {
        if (confirm('Deseja encerrar a sessão atual ou trocar de perfil setorial?')) {
          fazerLogout();
        }
      });
    }

    const btnMenu = document.getElementById('mobileMenuToggleBtn');
    if (btnMenu) {
      btnMenu.addEventListener('click', function() {
        document.body.classList.toggle('nav-drawer-open');
      });
    }

    document.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        const page = link.getAttribute('data-page');
        if (!page) return;
        e.preventDefault();
        document.body.classList.remove('nav-drawer-open');
        fecharDropdowns();
        window.OlymposRouter.navegarPara(page);
      });
    });

    // Gatilho de abertura/fechamento do dropdown Documentos
    document.querySelectorAll('.nav-dropdown-trigger').forEach(function(trigger) {
      trigger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const parent = trigger.closest('.nav-dropdown');
        if (!parent) return;
        const isOpen = parent.classList.contains('open');
        fecharDropdowns();
        if (!isOpen) {
          parent.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // Fechamento defensivo de dropdowns ao clicar fora ou pressionar Escape
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.nav-dropdown')) {
        fecharDropdowns();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        fecharDropdowns();
      }
    });

    document.querySelectorAll('[data-nav-target]').forEach(function(el) {
      el.addEventListener('click', function() {
        const target = el.getAttribute('data-nav-target');
        document.body.classList.remove('nav-drawer-open');
        if (target) window.OlymposRouter.navegarPara(target);
      });
    });

    const inTopSearch = document.getElementById('topQuickSearchInput');
    const btnTopSearch = document.getElementById('topQuickSearchBtn');
    if (btnTopSearch && inTopSearch) {
      const exec = function() {
        const val = inTopSearch.value.trim();
        if (val) {
          window.OlymposRouter.navegarPara('busca');
          if (window.OlymposViews && window.OlymposViews.busca) {
            window.OlymposViews.busca.dispararComTermo(val);
          }
        }
      };
      btnTopSearch.addEventListener('click', exec);
      inTopSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') exec();
      });
    }

    // Atalho "/" estilo Google DeepMind para focar a busca rápida
    document.addEventListener('keydown', function(e) {
      if (e.key === '/' && inTopSearch) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          inTopSearch.focus();
        }
      }
    });

    const closeMem = document.getElementById('closeModalBtn');
    if (closeMem) {
      closeMem.addEventListener('click', function() {
        document.getElementById('memoriaModal').classList.add('hidden');
      });
    }

    const closeCont = document.getElementById('closeContadoresModalBtn');
    if (closeCont) {
      closeCont.addEventListener('click', function() {
        document.getElementById('contadoresModal').classList.add('hidden');
      });
    }

    const btnSaveCont = document.getElementById('saveContadoresMdBtn');
    if (btnSaveCont) btnSaveCont.addEventListener('click', salvarContadoresMd);

    const btnSaveMem = document.getElementById('saveMemoriaBtn');
    if (btnSaveMem) btnSaveMem.addEventListener('click', salvarMemoriaMd);

    // Modal de Cadastro de Novo Usuário (Exclusivo ADMIN_GABINETE)
    const btnOpenNovoUser = document.getElementById('btnAbrirModalNovoUsuario');
    if (btnOpenNovoUser) btnOpenNovoUser.addEventListener('click', abrirModalNovoUsuario);

    const btnTopNovoUser = document.getElementById('topNovoUsuarioBtn');
    if (btnTopNovoUser) btnTopNovoUser.addEventListener('click', abrirModalNovoUsuario);

    const btnCloseNovoUser = document.getElementById('closeModalNovoUsuarioBtn');
    if (btnCloseNovoUser) btnCloseNovoUser.addEventListener('click', fecharModalNovoUsuario);

    const btnCancelNovoUser = document.getElementById('btnCancelarNovoUsuario');
    if (btnCancelNovoUser) btnCancelNovoUser.addEventListener('click', fecharModalNovoUsuario);

    const btnGenPass = document.getElementById('btnGerarSenhaNovoUsuario');
    if (btnGenPass) btnGenPass.addEventListener('click', gerarSenhaParaFormularioNovoUsuario);

    const btnTogglePass = document.getElementById('btnToggleVisibilidadeSenha');
    if (btnTogglePass) btnTogglePass.addEventListener('click', toggleVisibilidadeSenhaNovoUsuario);

    const formNovoUser = document.getElementById('formNovoUsuario');
    if (formNovoUser) {
      formNovoUser.addEventListener('submit', function(e) {
        e.preventDefault();
        handleNovoUsuarioSubmit(e);
      });
    }

    // Configuração de Destinatários do Boletim (Ajustes e Diário Oficial)
    const btnSalvarCfgEmail = document.getElementById('configSalvarBoletimEmailBtn');
    if (btnSalvarCfgEmail) {
      btnSalvarCfgEmail.addEventListener('click', function() {
        const inCfg = document.getElementById('configBoletimEmailInput');
        salvarBoletimEmails(inCfg ? inCfg.value : '');
      });
    }

    const btnTestarCfgEmail = document.getElementById('configTestarBoletimEmailBtn');
    if (btnTestarCfgEmail) {
      btnTestarCfgEmail.addEventListener('click', testarEnvioBoletim);
    }

    const btnSalvarDiarioEmail = document.getElementById('diarioSalvarBoletimEmailBtn');
    if (btnSalvarDiarioEmail) {
      btnSalvarDiarioEmail.addEventListener('click', function() {
        const inDiario = document.getElementById('diarioBoletimEmailInput');
        salvarBoletimEmails(inDiario ? inDiario.value : '');
      });
    }

    carregarConfiguracaoBoletimEmails();
  }

  function verificarStatusConexaoInicial() {
    window.OlymposApi.testarConexao(function(res) {
      atualizarStatusConexao(res.ok);
    });
  }

  function atualizarStatusConexao(isOnline) {
    const pill = document.getElementById('apiStatusPill');
    if (pill) {
      pill.innerHTML = '<span>' + (isOnline ? 'Gateway Online' : 'Gateway Offline') + '</span>';
      pill.className = 'status-pill ' + (isOnline ? 'status-online' : 'status-offline');
    }
  }

  // =========================================================================
  // MODAIS DE CONTADORES E MEMÓRIAS .MD
  // =========================================================================
  function abrirModalContadores() {
    document.getElementById('contadoresModal').classList.remove('hidden');
  }

  function salvarContadoresMd() {
    const ofVal = document.getElementById('inputProximoOficioMd').value.trim();
    const ptVal = document.getElementById('inputProximaPortariaMd').value.trim();
    const sigVal = document.getElementById('inputSignatarioMd').value.trim();
    const motVal = document.getElementById('inputMotivoAjusteMd').value.trim() || 'Ajuste manual pelo Hub Olympos';
    const btn = document.getElementById('saveContadoresMdBtn');

    btn.disabled = true;
    btn.textContent = 'Gravando...';

    window.OlymposApi.chamar('atualizar_contador_md', {
      tipo: 'GERAL',
      novo_valor: {
        proximoOficio2026: parseInt(ofVal, 10),
        proximaPortaria2026: parseInt(ptVal, 10),
        signatarioTitular: sigVal
      },
      motivo: motVal
    }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Gravar Numeração';

      if (res && res.ok) {
        showToast('Numeração oficial atualizada em _memoria_apolo.md!');
        document.getElementById('contadoresModal').classList.add('hidden');
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        showToast((res && res.mensagem) || 'Falha ao atualizar numeração.', true);
      }
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Gravar Numeração';
      showToast('Erro ao salvar: ' + err.message, true);
    });
  }

  function abrirModalMemoria(memoriaObj) {
    activeMemoriaEditando = memoriaObj;
    const nome = memoriaObj.deus || memoriaObj.nome || memoriaObj.arquivo;
    document.getElementById('modalMemoriaTitle').textContent = nome + ' — ' + memoriaObj.arquivo;
    const ta = document.getElementById('modalMemoriaTextarea');

    // Recupera conteúdo com preferência para edições locais salvas no catálogo
    let conteudo = memoriaObj.conteudoCompleto || '';
    if (window.OLYMPOS_MEMORIAS_CATALOGO) {
      const local = window.OLYMPOS_MEMORIAS_CATALOGO.obterConteudoLocal(memoriaObj.arquivo);
      if (local !== null && local !== undefined) {
        conteudo = local;
      }
    }
    ta.value = conteudo;

    const atualizarContadorLinhas = function() {
      const l = ta.value.split('\n').length;
      const counter = document.getElementById('modalLineCounter');
      counter.textContent = l + ' / 60 linhas';
      counter.className = 'pill-badge ' + (l > 55 ? 'pill-red' : 'pill-gold');
    };

    atualizarContadorLinhas();
    ta.oninput = atualizarContadorLinhas;
    document.getElementById('memoriaModal').classList.remove('hidden');
  }

  function salvarMemoriaMd() {
    if (!activeMemoriaEditando) return;
    const novoConteudo = document.getElementById('modalMemoriaTextarea').value;
    const arq = activeMemoriaEditando.arquivo;
    const btn = document.getElementById('saveMemoriaBtn');

    // 1. Persistência local imediata no browser (localStorage e in-memory)
    if (window.OLYMPOS_MEMORIAS_CATALOGO) {
      window.OLYMPOS_MEMORIAS_CATALOGO.salvarLocal(arq, novoConteudo);
    }
    activeMemoriaEditando.conteudoCompleto = novoConteudo;

    btn.disabled = true;
    btn.textContent = 'Sincronizando no Drive...';

    // 2. Sincronização remota via Gateway GAS (CORS Simple Request)
    window.OlymposApi.salvarMemoria(arq, novoConteudo, function(res) {
      btn.disabled = false;
      btn.textContent = 'Salvar no Arquivo Existente';

      if (res && res.ok) {
        if (window.OLYMPOS_MEMORIAS_CATALOGO) {
          window.OLYMPOS_MEMORIAS_CATALOGO.removerEdicaoLocal(arq);
        }
        showToast('Memória ' + arq + ' sincronizada com sucesso no Google Drive!');
        document.getElementById('memoriaModal').classList.add('hidden');
        if (window.OlymposViews && window.OlymposViews.personas) {
          window.OlymposViews.personas.recarregar();
        }
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        showToast('Salvo localmente no navegador! Sincronização com o Drive pendente (' + ((res && res.mensagem) || 'offline') + ').', false);
        document.getElementById('memoriaModal').classList.add('hidden');
        if (window.OlymposViews && window.OlymposViews.personas) {
          window.OlymposViews.personas.recarregar();
        }
      }
    }, function() {
      btn.disabled = false;
      btn.textContent = 'Salvar no Arquivo Existente';
      // Modo offline: salvo com sucesso no localStorage, não trava nem perde a edição
      showToast('Salvo localmente no navegador! Sincronização com o Drive ocorrerá quando o Gateway estiver online.', false);
      document.getElementById('memoriaModal').classList.add('hidden');
      if (window.OlymposViews && window.OlymposViews.personas) {
        window.OlymposViews.personas.recarregar();
      }
    });
  }

  // =========================================================================
  // RENDERIZADOR PADRÃO DE LINKS DE ARQUIVOS GERADOS (1 OU N ARQUIVOS)
  // =========================================================================
  function copiarTexto(texto, rotulo) {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(function() {
      showToast((rotulo || 'Link') + ' copiado para a área de transferência!');
    });
  }

  function copiarKpi(elemId, rotulo) {
    const el = document.getElementById(elemId);
    if (!el) return;
    const txt = el.textContent.trim();
    if (txt === '--' || txt.includes('--')) {
      showToast('Aguardando carregamento da numeração oficial...', true);
      return;
    }
    copiarTexto(txt, rotulo);
  }

  function renderizarItensLinksGerados(listContainer, arquivos) {
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!arquivos || arquivos.length === 0) {
      listContainer.innerHTML = '<div style="font-size:12.5px; color:var(--text-muted);">Processamento concluído. Consulte a pasta oficial para visualizar os documentos anteriores.</div>';
      return;
    }

    arquivos.forEach(function(arq) {
      const row = document.createElement('div');
      row.className = 'job-link-item';

      const titulo = arq.titulo || (arq.portaria ? 'Portaria Nº ' + arq.portaria + '/2026' : (arq.identificador || arq.nome || 'Documento Gerado'));
      const subtituloPartes = [];
      if (arq.identificador && titulo !== arq.identificador) subtituloPartes.push(arq.identificador);
      if (arq.matricula) subtituloPartes.push('Mat. ' + arq.matricula);
      if (arq.detalhe) subtituloPartes.push(arq.detalhe);
      if (arq.hash) subtituloPartes.push('Hash ' + arq.hash);

      const url = arq.url || arq.urlPdf || arq.urlArquivo || '';

      row.innerHTML =
        '<div class="job-link-info">' +
          '<span class="job-link-name">' + escapeHtml(titulo) + '</span>' +
          (subtituloPartes.length ? '<span class="job-link-meta">' + escapeHtml(subtituloPartes.join(' • ')) + '</span>' : '') +
        '</div>' +
        '<div class="button-group">' +
          (url ? '<button type="button" class="btn btn-secondary btn-sm btn-copy-single">Copiar Link</button>' : '') +
          (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Abrir Arquivo ↗</a>' : '') +
        '</div>';

      const copyBtn = row.querySelector('.btn-copy-single');
      if (copyBtn && url) {
        copyBtn.addEventListener('click', function() {
          copiarTexto(url, 'Link de ' + titulo);
        });
      }

      listContainer.appendChild(row);
    });
  }

  function showToast(msg, isError) {
    const t = document.getElementById('globalToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('error', Boolean(isError));
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() {
      t.classList.add('hidden');
    }, 4200);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // =========================================================================
  // GESTÃO DE USUÁRIOS E MODAL NOVO USUÁRIO (EXCLUSIVO ADMIN_GABINETE)
  // =========================================================================
  function abrirModalNovoUsuario() {
    const sessao = currentUserSession;
    const role = sessao && sessao.perfil && (sessao.perfil.id || sessao.perfil.nome);
    if (role !== 'ADMIN_GABINETE') {
      showToast('Acesso restrito ao Moderador do Gabinete (ADMIN_GABINETE).', true);
      return;
    }
    const modal = document.getElementById('modalNovoUsuario');
    if (modal) {
      modal.classList.remove('hidden');
      const inNome = document.getElementById('novoUsuarioNome');
      if (inNome) inNome.focus();
    }
  }

  function fecharModalNovoUsuario() {
    const modal = document.getElementById('modalNovoUsuario');
    if (modal) modal.classList.add('hidden');
    const feedback = document.getElementById('novoUsuarioFeedback');
    if (feedback) {
      feedback.classList.add('hidden');
      feedback.innerHTML = '';
    }
  }

  function gerarSenhaSeguraAleatoria() {
    const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const minusculas = 'abcdefghijkmnopqrstuvwxyz';
    const numeros = '23456789';
    const simbolos = '!@#$%&*';
    const todos = maiusculas + minusculas + numeros + simbolos;

    let senha = '';
    senha += maiusculas.charAt(Math.floor(Math.random() * maiusculas.length));
    senha += minusculas.charAt(Math.floor(Math.random() * minusculas.length));
    senha += numeros.charAt(Math.floor(Math.random() * numeros.length));
    senha += simbolos.charAt(Math.floor(Math.random() * simbolos.length));

    for (let i = 4; i < 14; i++) {
      senha += todos.charAt(Math.floor(Math.random() * todos.length));
    }
    return senha.split('').sort(function() { return 0.5 - Math.random(); }).join('');
  }

  function gerarSenhaParaFormularioNovoUsuario() {
    const inSenha = document.getElementById('novoUsuarioSenha');
    if (inSenha) {
      inSenha.value = gerarSenhaSeguraAleatoria();
      inSenha.type = 'text';
      const btnToggle = document.getElementById('btnToggleVisibilidadeSenha');
      if (btnToggle) btnToggle.textContent = '🔒';
      showToast('Senha segura gerada com sucesso!');
    }
  }

  function toggleVisibilidadeSenhaNovoUsuario() {
    const inSenha = document.getElementById('novoUsuarioSenha');
    const btnToggle = document.getElementById('btnToggleVisibilidadeSenha');
    if (!inSenha) return;
    if (inSenha.type === 'password') {
      inSenha.type = 'text';
      if (btnToggle) btnToggle.textContent = '🔒';
    } else {
      inSenha.type = 'password';
      if (btnToggle) btnToggle.textContent = '👁️';
    }
  }

  function exibirFeedbackNovoUsuario(msg, tipo) {
    const fb = document.getElementById('novoUsuarioFeedback');
    if (!fb) return;
    fb.classList.remove('hidden');
    let cor = 'var(--text-primary)';
    if (tipo === 'erro') cor = 'var(--danger, #e53935)';
    else if (tipo === 'sucesso') cor = 'var(--success, #43a047)';
    else if (tipo === 'info') cor = 'var(--accent-gold, #c99738)';
    fb.innerHTML = '<span style="color:' + cor + '; font-weight:600;">' + escapeHtml(msg) + '</span>';
  }

  async function handleNovoUsuarioSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const sessao = currentUserSession;
    const role = sessao && sessao.perfil && (sessao.perfil.id || sessao.perfil.nome);
    if (role !== 'ADMIN_GABINETE') {
      showToast('Ação restrita ao Moderador do Gabinete.', true);
      return;
    }

    const inNome = document.getElementById('novoUsuarioNome');
    const inEmail = document.getElementById('novoUsuarioEmail');
    const inRole = document.getElementById('novoUsuarioRole');
    const inDepto = document.getElementById('novoUsuarioDepartamento');
    const inSenha = document.getElementById('novoUsuarioSenha');
    const btnSubmit = document.getElementById('btnSalvarNovoUsuario');

    const nome = inNome ? inNome.value.trim() : '';
    const email = inEmail ? inEmail.value.trim() : '';
    const papel = inRole ? inRole.value.trim() : '';
    const departamento = inDepto ? inDepto.value.trim() : 'Secretaria Municipal de Educacao';
    const senha = inSenha ? inSenha.value.trim() : '';

    if (!nome || !email || !papel || !senha) {
      exibirFeedbackNovoUsuario('Preencha todos os campos obrigatórios (*).', 'erro');
      return;
    }

    if (senha.length < 8) {
      exibirFeedbackNovoUsuario('A senha temporária deve conter no mínimo 8 caracteres.', 'erro');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Cadastrando...';
    }
    exibirFeedbackNovoUsuario('Provisionando operador no Supabase Auth...', 'info');

    const payload = {
      nome: nome,
      email: email,
      role: papel,
      departamento: departamento,
      senhaTemporaria: senha
    };

    try {
      const res = await window.OlymposApi.criarUsuario(payload);
      if (res && res.ok) {
        exibirFeedbackNovoUsuario(res.mensagem || 'Usuário cadastrado com sucesso!', 'sucesso');
        showToast('Usuário ' + email + ' cadastrado com sucesso!');
        const form = document.getElementById('formNovoUsuario');
        if (form) form.reset();
        setTimeout(function() {
          fecharModalNovoUsuario();
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Criar Usuário';
          }
        }, 1500);
      } else {
        exibirFeedbackNovoUsuario((res && res.mensagem) || 'Falha ao cadastrar usuário.', 'erro');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Criar Usuário';
        }
      }
    } catch (err) {
      console.error('[handleNovoUsuarioSubmit] Erro:', err);
      exibirFeedbackNovoUsuario('Erro de comunicação: ' + (err.message || 'Falha de rede.'), 'erro');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Criar Usuário';
      }
    }
  }

  return {
    showToast: showToast,
    copiarTexto: copiarTexto,
    copiarKpi: copiarKpi,
    renderizarItensLinksGerados: renderizarItensLinksGerados,
    abrirModalContadores: abrirModalContadores,
    abrirModalMemoria: abrirModalMemoria,
    abrirModalNovoUsuario: abrirModalNovoUsuario,
    fecharModalNovoUsuario: fecharModalNovoUsuario,
    solicitarLogin: solicitarLogin,
    handleLoginSubmit: handleLoginSubmit,
    fazerLogout: fazerLogout,
    definirTema: definirTema,
    atualizarStatusConexao: atualizarStatusConexao,
    getSession: getSession,
    getSessaoAtual: getSessaoAtual,
    atualizarTokenSessao: atualizarTokenSessao,
    abrirJanelaGeminiCompanion: abrirJanelaGeminiCompanion,
    renderSkeletonTable: renderSkeletonTable,
    carregarConfiguracaoBoletimEmails: carregarConfiguracaoBoletimEmails,
    salvarBoletimEmails: salvarBoletimEmails,
    testarEnvioBoletim: testarEnvioBoletim,
    fecharDropdowns: fecharDropdowns,
    escapeHtml: escapeHtml
  };
})();
