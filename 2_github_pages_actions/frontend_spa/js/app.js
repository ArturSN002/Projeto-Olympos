/**
 * Hub Olympos V2.03 — Controlador Central da Aplicação Modular
 * Estética Editorial (Google DeepMind + The Keyword), RBAC, Tema 60-30-10 e Modais.
 */
window.OlymposApp = (function() {
  const PUBLIC_PAGES = ['visao-geral', 'diario-oficial', 'escolas', 'oraculo'];
  let currentUserSession = null;
  let activeMemoriaEditando = null;
  let mfaFlowActive = false;
  let mfaPendingCallbacks = [];
  let initialPreloadDoneForAuth = false;

  const LEGACY_TAB_MAP = {
    'tab-apolo': ['visao-geral', 'oficios', 'personas', 'busca'],
    'tab-pincel': ['portarias', 'oficios'],
    'tab-licencas': ['licencas'],
    'tab-lira': ['certificados'],
    'tab-prometheus': ['diario-oficial', 'papiro-cadmo']
  };

  function agendarPreloadInicial_(isAuth) {
    const authBool = Boolean(isAuth);
    if (authBool && initialPreloadDoneForAuth) return;
    if (authBool) initialPreloadDoneForAuth = true;
    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.preloadInitialRoutes === 'function') {
      window.OlymposRouteLoader.preloadInitialRoutes(authBool);
    }
  }

  function bootOlymposApp() {
    hydrateVectorIcons();
    initTheme();
    initSession();
    bindGlobalElements();
    if (window.OlymposRouter && typeof window.OlymposRouter.init === 'function') {
      window.OlymposRouter.init();
      if (document.body && typeof window.OlymposRouter.getPaginaAtual === 'function') {
        document.body.setAttribute('data-active-page', window.OlymposRouter.getPaginaAtual());
      }
    }
    verificarStatusConexaoInicial();
    agendarPreloadInicial_(Boolean(currentUserSession && !mfaFlowActive));
  }

  function hydrateVectorIcons() {
    if (!window.OlymposIcons) return;
    const uiFn = typeof window.OlymposIcons.ui === 'function' ? window.OlymposIcons.ui : window.OlymposIcons.get;
    const setHtml = function(id, svg) {
      const el = document.getElementById(id);
      if (el && svg) el.innerHTML = svg;
    };

    if (typeof uiFn === 'function') {
      setHtml('brandMarkSvg', uiFn('olymposMark'));
      setHtml('topQuickSearchBtn', uiFn('search'));
      setHtml('mobileMenuToggleBtn', uiFn('menu'));
      setHtml('closeModalBtn', uiFn('close'));
      setHtml('closeContadoresModalBtn', uiFn('close'));
      setHtml('closeLoginScreenXBtn', uiFn('close'));
      setHtml('closeUserProfileModalBtn', uiFn('close'));
      setHtml('pincelDoneCheckSvg', uiFn('check'));
    }

    document.querySelectorAll('[data-persona-icon]').forEach(function(badge) {
      const key = badge.getAttribute('data-persona-icon');
      badge.innerHTML = window.OlymposIcons.get(key);
    });

    if (typeof window.OlymposIcons.hydrateAll === 'function') {
      window.OlymposIcons.hydrateAll();
    }
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

  function acionarOnboardingTour(roleId) {
    const targetRole = roleId || obterRoleIdSessao(currentUserSession) || 'VISITANTE';
    setTimeout(function() {
      window.OlymposOnboarding?.iniciarSeNecessario?.(targetRole);
    }, 600);
  }

  // =========================================================================
  // AUTENTICAÇÃO E CONTROLE DE ACESSO RBAC
  // =========================================================================
  function initSession() {
    // Limpa chave legada duplicada em localStorage (Zero-Trust: sessão reside no SDK Supabase / sessionStorage)
    try {
      localStorage.removeItem('olympos_session');
    } catch (eCleanLs) {}

    // 1. Restaura sessão ativa da aba em sessionStorage
    try {
      const cachedRbac = sessionStorage.getItem('olympos_session_rbac');
      if (cachedRbac) {
        const sessionObj = JSON.parse(cachedRbac);
        const cachedRole = sessionObj && sessionObj.perfil ? obterRoleIdSessao(sessionObj) : 'VISITANTE';
        if (sessionObj && sessionObj.perfil && cachedRole !== 'VISITANTE') {
          const cachedToken = sessionObj.access_token || sessionObj.token || '';
          const requiresMfa = (cachedRole === 'MODERADOR' || cachedRole === 'ADMIN_GABINETE' || cachedRole === 'JURIDICO');
          if (requiresMfa && decodificarAalJwt_(cachedToken) !== 'aal2') {
            sessionStorage.removeItem('olympos_session_rbac');
          } else {
            currentUserSession = sessionObj;
            aplicarSessaoNaInterface(currentUserSession);
            if (window.OlymposSessionGuard && typeof window.OlymposSessionGuard.startIdleMonitor === 'function') {
              window.OlymposSessionGuard.startIdleMonitor(cachedRole);
            }
            acionarOnboardingTour(cachedRole);
            return;
          }
        } else {
          sessionStorage.removeItem('olympos_session_rbac');
          sessionStorage.removeItem('olympos_rbac_profile_cache');
        }
      }
    } catch (e) {
      sessionStorage.removeItem('olympos_session_rbac');
    }

    // 2. Sem sessão síncrona: inicia no Modo Visitante e tenta hidratar sessão válida do Supabase Auth (nova aba)
    currentUserSession = null;
    mfaFlowActive = false;
    mfaPendingCallbacks = [];
    initialPreloadDoneForAuth = false;
    if (window.OlymposRbac && typeof window.OlymposRbac.limparContextoAcesso === 'function') {
      window.OlymposRbac.limparContextoAcesso();
    }
    aplicarModoVisitanteNaInterface();
    if (window.OlymposChatBadge && typeof window.OlymposChatBadge.clearOnLogout === 'function') {
      window.OlymposChatBadge.clearOnLogout();
    }

    const initialHash = window.location.hash.replace('#', '').trim();
    const initialHashRoute = initialHash.split('?')[0].trim();
    const isInitialPublicQr =
      (initialHashRoute === 'inventario' && /[?&](?:item|codigo|lote)=/i.test(initialHash)) ||
      (initialHashRoute === 'certificados' && initialHash.indexOf('?') !== -1);
    if (window.OlymposSupabase && typeof window.OlymposSupabase.isConfigured === 'function' && window.OlymposSupabase.isConfigured()) {
      window.OlymposSupabase.getSession().then(async function(sbSession) {
        if (!sbSession || !sbSession.user || currentUserSession) {
          if (!currentUserSession && initialHashRoute && !PUBLIC_PAGES.includes(initialHashRoute) && !isInitialPublicQr) {
            window.location.hash = '#visao-geral';
            solicitarLogin();
          } else if (!currentUserSession) {
            acionarOnboardingTour('VISITANTE');
          }
          return;
        }
        try {
          const client = window.OlymposSupabase.getClient();
          let profData = null;
          const resProf = await client
            .from('profiles')
            .select('id, email, full_name, role, department, setor_codigo, cargo_setor, ativo, termo_sigilo_aceito_em, termo_sigilo_versao, onboarding_version_seen')
            .eq('id', sbSession.user.id)
            .maybeSingle();
          if (resProf && !resProf.error && resProf.data) {
            profData = resProf.data;
          } else {
            const resLegacy = await client
              .from('profiles')
              .select('id, email, full_name, role, department, termo_sigilo_aceito_em, termo_sigilo_versao, onboarding_version_seen')
              .eq('id', sbSession.user.id)
              .maybeSingle();
            profData = resLegacy ? resLegacy.data : null;
          }
          const profile = profData || {
            id: sbSession.user.id,
            email: sbSession.user.email,
            full_name: sbSession.user.email,
            role: (sbSession.user.app_metadata && sbSession.user.app_metadata.role) || 'PEDAGOGICO_EVENTOS'
          };
          if (profile.ativo === false) {
            showToast('Conta de operador suspensa pelo Moderador.', true);
            await fazerLogout();
            return;
          }
          const role = profile.role || 'PEDAGOGICO_EVENTOS';
          const ctxRbacInit = window.OlymposRbac && typeof window.OlymposRbac.hidratarContextoLocal === 'function'
            ? window.OlymposRbac.hidratarContextoLocal(profile)
            : null;
          const abas = (ctxRbacInit && ctxRbacInit.paginasPermitidas)
            ? ctxRbacInit.paginasPermitidas
            : (RBAC_TAB_PERMISSIONS[role] || RBAC_TAB_PERMISSIONS.PEDAGOGICO_EVENTOS);

          const finishHydration = function(finalAccessToken) {
            const tok = finalAccessToken || sbSession.access_token;
            currentUserSession = {
              ok: true,
              token: tok,
              access_token: tok,
              usuario: sbSession.user.email,
              nome: profile.full_name || sbSession.user.email,
              department: profile.department || '',
              user: { id: sbSession.user.id, email: sbSession.user.email },
              profile: profile,
              perfil: { id: role, nome: obterLabelPerfilOrganico(role), abasPermitidas: abas }
            };
            if (window.OlymposRbac && typeof window.OlymposRbac.hidratarContextoLocal === 'function') {
              window.OlymposRbac.hidratarContextoLocal(profile);
            }
            sessionStorage.setItem('olympos_session_rbac', JSON.stringify(currentUserSession));
            sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(profile));
            aplicarSessaoNaInterface(currentUserSession);
            if (window.OlymposRbac && typeof window.OlymposRbac.carregarContextoAcesso === 'function') {
              window.OlymposRbac.carregarContextoAcesso(true).then(function(ctxAtualizado) {
                if (currentUserSession && ctxAtualizado && ctxAtualizado.autenticado) {
                  currentUserSession.perfil.abasPermitidas = ctxAtualizado.paginasPermitidas;
                  currentUserSession.profile = Object.assign({}, currentUserSession.profile || {}, {
                    setor_codigo: ctxAtualizado.setorCodigo,
                    cargo_setor: ctxAtualizado.cargoSetor,
                    ativo: ctxAtualizado.ativo
                  });
                  aplicarSessaoNaInterface(currentUserSession);
                }
              }).catch(function() {});
            }
            if (window.OlymposSessionGuard && typeof window.OlymposSessionGuard.startIdleMonitor === 'function') {
              window.OlymposSessionGuard.startIdleMonitor(role);
            }
            if (window.OlymposRouter) {
              const targetPage = initialHash || window.OlymposRouter.getPaginaAtual();
              if (targetPage === 'visao-geral' && window.OlymposViews && window.OlymposViews.visaoGeral) {
                window.OlymposViews.visaoGeral.recarregar();
              } else {
                window.OlymposRouter.navegarPara(targetPage, true);
              }
            }
            agendarPreloadInicial_(true);
            acionarOnboardingTour(role);
          };

          const isMfaMandatory = (typeof window.OlymposSupabase.isRoleMfaMandatory === 'function')
            ? window.OlymposSupabase.isRoleMfaMandatory(role, profile.setor_codigo, profile.cargo_setor)
            : (role === 'MODERADOR' || role === 'ADMIN_GABINETE' || role === 'JURIDICO');

          if (isMfaMandatory && decodificarAalJwt_(sbSession.access_token) !== 'aal2' && typeof window.OlymposSupabase.checkMfaStatus === 'function') {
            const mfaSt = await window.OlymposSupabase.checkMfaStatus();
            const curAal = mfaSt && (mfaSt.currentAal || mfaSt.currentLevel);
            if (mfaSt && mfaSt.supported && curAal !== 'aal2') {
              solicitarMfaObrigatorio(function(verifiedSess) {
                const tok = (verifiedSess && verifiedSess.access_token) || null;
                finishHydration(tok);
              });
              return;
            }
            const freshTok = typeof window.OlymposSupabase.getJwtToken === 'function'
              ? await window.OlymposSupabase.getJwtToken()
              : sbSession.access_token;
            finishHydration(freshTok);
            return;
          }

          finishHydration(sbSession.access_token);
        } catch (eHydrate) {
          console.warn('[OlymposApp] Falha silenciosa ao hidratar sessão Supabase:', eHydrate);
        }
      });
      return;
    }

    if (initialHashRoute && !PUBLIC_PAGES.includes(initialHashRoute) && !isInitialPublicQr) {
      window.location.hash = '#visao-geral';
      solicitarLogin();
    } else {
      acionarOnboardingTour('VISITANTE');
    }
  }

  function solicitarLogin() {
    const modal = document.getElementById('loginScreen');
    if (modal) modal.classList.remove('hidden');
  }

  function fecharModalLogin(opcoes) {
    const opts = opcoes || {};
    const modal = document.getElementById('loginScreen');
    if (modal) {
      modal.classList.add('hidden');
    }

    const submitBtn = document.getElementById('loginSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Acessar Ambiente Olympos';
    }

    if (opts.forcarVisitante || !currentUserSession || !currentUserSession.perfil) {
      currentUserSession = null;
      try {
        sessionStorage.removeItem('olympos_session_rbac');
        sessionStorage.removeItem('olympos_rbac_profile_cache');
        localStorage.removeItem('olympos_session');
      } catch (e) {}
      aplicarModoVisitanteNaInterface();
    if (window.OlymposChatBadge && typeof window.OlymposChatBadge.clearOnLogout === 'function') {
      window.OlymposChatBadge.clearOnLogout();
    }
    } else {
      aplicarControleAcessoModularEDrive(currentUserSession);
    }

    if (window.OlymposRouter && typeof window.OlymposRouter.navegarPara === 'function') {
      const cur = typeof window.OlymposRouter.getPaginaAtual === 'function'
        ? window.OlymposRouter.getPaginaAtual()
        : (window.location.hash.replace('#', '').trim() || 'visao-geral');
      if (!podeAcessarPagina(cur)) {
        window.OlymposRouter.navegarPara('visao-geral');
      }
    }
  }

  const RBAC_TAB_PERMISSIONS = {
    MODERADOR: [
      'visao-geral', 'oficios', 'portarias', 'licencas', 'certificados', 'relatorios',
      'diario-oficial', 'papiro-cadmo', 'servidores', 'escolas', 'inventario', 'chamados', 'pendencias', 'personas', 'busca', 'oraculo', 'processos-seletivos', 'pss', 'mural', 'chat', 'auditoria', 'kiosk', 'configuracoes'
    ],
    ADMIN_GABINETE: [
      'visao-geral', 'oficios', 'portarias', 'licencas', 'certificados', 'relatorios',
      'diario-oficial', 'papiro-cadmo', 'servidores', 'escolas', 'inventario', 'chamados', 'pendencias', 'personas', 'busca', 'oraculo', 'processos-seletivos', 'pss', 'mural', 'chat', 'kiosk', 'configuracoes'
    ],
    RH_COMISSAO: [
      'visao-geral', 'oficios', 'relatorios',
      'diario-oficial', 'papiro-cadmo', 'servidores', 'chamados', 'pendencias', 'personas', 'busca', 'oraculo', 'processos-seletivos', 'pss', 'mural', 'chat', 'kiosk', 'configuracoes'
    ],
    PEDAGOGICO_EVENTOS: [
      'visao-geral', 'oficios', 'certificados', 'relatorios', 'servidores', 'chamados', 'pendencias', 'personas', 'busca', 'oraculo', 'mural', 'chat', 'kiosk', 'configuracoes'
    ],
    JURIDICO: [
      'visao-geral', 'oficios', 'relatorios', 'diario-oficial',
      'papiro-cadmo', 'servidores', 'chamados', 'pendencias', 'personas', 'busca', 'oraculo', 'processos-seletivos', 'pss', 'mural', 'chat', 'kiosk', 'configuracoes'
    ]
  };

  const ROLE_LABELS = {
    MODERADOR: 'Moderador',
    ADMIN_GABINETE: 'Gabinete Executivo',
    RH_COMISSAO: 'Recursos Humanos e Portarias',
    PEDAGOGICO_EVENTOS: 'Pedagógico e Eventos',
    JURIDICO: 'Assessoria Jurídica',
    VISITANTE: 'Visitante'
  };

  function decodificarAalJwt_(token) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return 'aal1';
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      const claims = JSON.parse(atob(b64));
      return String((claims && claims.aal) || 'aal1').toLowerCase();
    } catch (e) {
      return 'aal1';
    }
  }

  function atualizarTokenSessao(novoToken) {
    if (!novoToken) return;
    if (currentUserSession) {
      currentUserSession.token = novoToken;
      currentUserSession.access_token = novoToken;
      try {
        sessionStorage.setItem('olympos_session_rbac', JSON.stringify(currentUserSession));
      } catch (e) {}
    }
  }

  function drenarCallbacksMfa_(verifiedSession) {
    const callbacks = mfaPendingCallbacks.slice();
    mfaPendingCallbacks = [];
    for (let i = 0; i < callbacks.length; i++) {
      try {
        callbacks[i](verifiedSession);
      } catch (eCb) {
        console.warn('[OlymposApp] Erro em callback pós-MFA:', eCb);
      }
    }
  }

  async function solicitarMfaObrigatorio(onSucesso) {
    if (typeof onSucesso === 'function') {
      mfaPendingCallbacks.push(onSucesso);
    }
    if (mfaFlowActive) {
      return;
    }
    if (!window.OlymposSupabase || typeof window.OlymposSupabase.checkMfaStatus !== 'function') {
      mfaPendingCallbacks = [];
      return;
    }
    mfaFlowActive = true;
    try {
      const mfaStatus = await window.OlymposSupabase.checkMfaStatus();
      if (!mfaStatus || !mfaStatus.supported) {
        mfaFlowActive = false;
        mfaPendingCallbacks = [];
        return;
      }
      const currentAal = mfaStatus.currentAal || mfaStatus.currentLevel;
      if (currentAal === 'aal2') {
        let freshToken = null;
        if (typeof window.OlymposSupabase.getJwtToken === 'function') {
          freshToken = await window.OlymposSupabase.getJwtToken();
        }
        if (freshToken) {
          atualizarTokenSessao(freshToken);
        }
        mfaFlowActive = false;
        drenarCallbacksMfa_(freshToken ? { access_token: freshToken } : null);
        return;
      }
      if (mfaStatus.hasEnrolled && currentAal !== 'aal2') {
        const factorId = mfaStatus.verifiedFactors && mfaStatus.verifiedFactors[0]
          ? mfaStatus.verifiedFactors[0].id
          : (mfaStatus.factors[0] && mfaStatus.factors[0].id);
        abrirModalMfaDesafio(factorId, function(verifiedSession) {
          if (verifiedSession && verifiedSession.access_token) {
            atualizarTokenSessao(verifiedSession.access_token);
          }
          drenarCallbacksMfa_(verifiedSession);
        });
      } else if (!mfaStatus.hasEnrolled) {
        abrirModalMfaEnroll(function(verifiedSession) {
          if (verifiedSession && verifiedSession.access_token) {
            atualizarTokenSessao(verifiedSession.access_token);
          }
          drenarCallbacksMfa_(verifiedSession);
        });
      } else {
        mfaFlowActive = false;
      }
    } catch (e) {
      mfaFlowActive = false;
      mfaPendingCallbacks = [];
      console.warn('[OlymposApp] Falha ao iniciar desafio MFA:', e);
    }
  }

  async function abrirModalMfaDesafio(factorId, onSucesso) {
    mfaFlowActive = true;
    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.ensureModal === 'function') {
      await window.OlymposRouteLoader.ensureModal('mfa');
    }
    const modal = document.getElementById('modalMfaDesafio');
    if (!modal) {
      mfaFlowActive = false;
      if (typeof onSucesso === 'function') onSucesso();
      return;
    }
    const inputCode = document.getElementById('mfaChallengeCode');
    const feedback = document.getElementById('mfaDesafioFeedback');
    const form = document.getElementById('formMfaDesafio');
    const btnConfirm = document.getElementById('btnConfirmarMfaDesafio');
    const btnCancel = document.getElementById('btnCancelarMfaDesafio');
    const btnClose = document.getElementById('closeModalMfaDesafioBtn');

    if (inputCode) inputCode.value = '';
    if (btnConfirm) btnConfirm.disabled = false;
    if (feedback) {
      feedback.textContent = '';
      feedback.classList.add('hidden');
    }
    modal.classList.remove('hidden');
    if (inputCode) inputCode.focus();

    function fechar(cancelado) {
      mfaFlowActive = false;
      modal.classList.add('hidden');
      if (btnConfirm) btnConfirm.disabled = false;
      if (form) form.onsubmit = null;
      if (btnCancel) btnCancel.onclick = null;
      if (btnClose) btnClose.onclick = null;
      if (cancelado) mfaPendingCallbacks = [];
    }

    if (btnCancel) {
      btnCancel.onclick = function() {
        fechar(true);
        fazerLogout();
      };
    }
    if (btnClose) {
      btnClose.onclick = function() {
        fechar(true);
        fazerLogout();
      };
    }

    if (form) {
      form.onsubmit = async function(e) {
        e.preventDefault();
        if (btnConfirm && btnConfirm.disabled) return;
        const code = inputCode ? inputCode.value.trim() : '';
        if (code.length !== 6) {
          if (feedback) {
            feedback.textContent = 'Informe os 6 dígitos numéricos do autenticador.';
            feedback.classList.remove('hidden');
          }
          return;
        }
        try {
          if (btnConfirm) btnConfirm.disabled = true;
          if (feedback) {
            feedback.textContent = 'Validando código TOTP...';
            feedback.classList.remove('hidden');
          }
          const verifyData = await window.OlymposSupabase.challengeAndVerifyMfa(factorId, code);
          const verifiedSess = (verifyData && verifyData.session) ||
            (verifyData && verifyData.access_token ? { access_token: verifyData.access_token } : null);
          fechar(false);
          if (typeof onSucesso === 'function') onSucesso(verifiedSess);
        } catch (err) {
          if (btnConfirm) btnConfirm.disabled = false;
          if (feedback) {
            feedback.textContent = err.message || 'Código TOTP inválido ou expirado. Tente novamente.';
            feedback.classList.remove('hidden');
          }
        }
      };
    }
  }

  async function abrirModalMfaEnroll(onSucesso) {
    mfaFlowActive = true;
    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.ensureModal === 'function') {
      await window.OlymposRouteLoader.ensureModal('mfa');
    }
    const modal = document.getElementById('modalMfaEnroll');
    if (!modal) {
      mfaFlowActive = false;
      if (typeof onSucesso === 'function') onSucesso();
      return;
    }
    const qrContainer = document.getElementById('mfaQrCodeContainer');
    const secretText = document.getElementById('mfaSecretKeyText');
    const inputCode = document.getElementById('mfaEnrollCode');
    const feedback = document.getElementById('mfaEnrollFeedback');
    const form = document.getElementById('formMfaEnroll');
    const btnConfirm = document.getElementById('btnConfirmarMfaEnroll');
    const btnCopy = document.getElementById('btnCopiarMfaSecret');
    const btnCancel = document.getElementById('btnCancelarMfaEnroll');
    const btnClose = document.getElementById('closeModalMfaEnrollBtn');

    if (inputCode) inputCode.value = '';
    if (btnConfirm) btnConfirm.disabled = false;
    if (feedback) {
      feedback.textContent = '';
      feedback.classList.add('hidden');
    }
    modal.classList.remove('hidden');

    function fechar(cancelado) {
      mfaFlowActive = false;
      modal.classList.add('hidden');
      if (btnConfirm) btnConfirm.disabled = false;
      if (form) form.onsubmit = null;
      if (btnCancel) btnCancel.onclick = null;
      if (btnClose) btnClose.onclick = null;
      if (btnCopy) btnCopy.onclick = null;
      if (cancelado) mfaPendingCallbacks = [];
    }

    if (btnCancel) {
      btnCancel.onclick = function() {
        fechar(true);
        fazerLogout();
      };
    }
    if (btnClose) {
      btnClose.onclick = function() {
        fechar(true);
        fazerLogout();
      };
    }

    try {
      if (qrContainer) qrContainer.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Gerando credencial TOTP...</span>';
      const enrollData = await window.OlymposSupabase.enrollMfaTotp();
      const factorId = enrollData.id;
      const totp = enrollData.totp || {};

      if (secretText) {
        secretText.textContent = totp.secret || 'CHAVE-INDISPONÍVEL';
      }
      if (btnCopy) {
        btnCopy.onclick = function() {
          if (totp.secret && navigator.clipboard) {
            navigator.clipboard.writeText(totp.secret).then(function() {
              showToast('Chave secreta copiada para a área de transferência!');
            });
          }
        };
      }

      if (qrContainer) {
        let qrRaw = String((totp && totp.qr_code) || '').trim();
        if (qrRaw.includes('%3Csvg') || qrRaw.includes('%3C%73%76%67') || qrRaw.includes('%3csvg')) {
          try { qrRaw = decodeURIComponent(qrRaw); } catch (e) {}
        }

        const svgMatch = qrRaw.match(/<svg[\s\S]*?<\/svg>/i);
        if (svgMatch) {
          qrContainer.innerHTML = svgMatch[0];
          const svgEl = qrContainer.querySelector('svg');
          if (svgEl) {
            svgEl.removeAttribute('width');
            svgEl.removeAttribute('height');
            svgEl.setAttribute('role', 'img');
            svgEl.setAttribute('aria-label', 'QR Code de Autenticação TOTP');
            svgEl.style.width = '170px';
            svgEl.style.height = '170px';
            svgEl.style.maxWidth = '100%';
            svgEl.style.display = 'block';
            svgEl.style.margin = '0 auto';
            svgEl.style.borderRadius = '8px';
            svgEl.style.border = '1px solid var(--border-hairline, rgba(255,255,255,0.12))';
            svgEl.style.background = '#ffffff';
            svgEl.style.padding = '8px';
            svgEl.style.boxSizing = 'border-box';
          }
        } else if (qrRaw.startsWith('data:image/')) {
          const img = document.createElement('img');
          img.src = qrRaw;
          img.alt = 'QR Code TOTP';
          img.style.width = '170px';
          img.style.height = '170px';
          img.style.maxWidth = '100%';
          img.style.display = 'block';
          img.style.margin = '0 auto';
          img.style.borderRadius = '8px';
          img.style.border = '1px solid var(--border-hairline, rgba(255,255,255,0.12))';
          img.style.background = '#ffffff';
          img.style.padding = '8px';
          img.style.boxSizing = 'border-box';
          qrContainer.innerHTML = '';
          qrContainer.appendChild(img);
        } else if (totp && totp.uri) {
          const uriWrapper = document.createElement('div');
          uriWrapper.style.fontSize = '11.5px';
          uriWrapper.style.wordBreak = 'break-all';
          uriWrapper.style.padding = '8px';
          uriWrapper.style.background = 'var(--bg-surface)';
          uriWrapper.style.borderRadius = '6px';
          const codeEl = document.createElement('code');
          codeEl.textContent = totp.uri;
          uriWrapper.appendChild(codeEl);
          qrContainer.innerHTML = '';
          qrContainer.appendChild(uriWrapper);
        } else {
          qrContainer.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">QR Code indisponível. Utilize a chave manual abaixo.</span>';
        }
      }

      if (form) {
        form.onsubmit = async function(e) {
          e.preventDefault();
          if (btnConfirm && btnConfirm.disabled) return;
          const code = inputCode ? inputCode.value.trim() : '';
          if (code.length !== 6) {
            if (feedback) {
              feedback.textContent = 'Informe os 6 dígitos numéricos do autenticador.';
              feedback.classList.remove('hidden');
            }
            return;
          }
          try {
            if (btnConfirm) btnConfirm.disabled = true;
            if (feedback) {
              feedback.textContent = 'Confirmando ativação TOTP...';
              feedback.classList.remove('hidden');
            }
            const verifyData = await window.OlymposSupabase.challengeAndVerifyMfa(factorId, code);
            const verifiedSess = (verifyData && verifyData.session) ||
              (verifyData && verifyData.access_token ? { access_token: verifyData.access_token } : null);
            fechar(false);
            showToast('Segundo Fator (TOTP MFA) ativado com sucesso!');
            if (typeof onSucesso === 'function') onSucesso(verifiedSess);
          } catch (err) {
            if (btnConfirm) btnConfirm.disabled = false;
            if (feedback) {
              feedback.textContent = err.message || 'Código TOTP incorreto. Verifique o horário do seu dispositivo e tente novamente.';
              feedback.classList.remove('hidden');
            }
          }
        };
      }
    } catch (err) {
      if (feedback) {
        feedback.textContent = 'Erro ao inicializar MFA: ' + (err.message || err);
        feedback.classList.remove('hidden');
      }
    }
  }

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

    if (window.OlymposSessionGuard && typeof window.OlymposSessionGuard.getLockoutRemainingSeconds === 'function') {
      const lockSec = window.OlymposSessionGuard.getLockoutRemainingSeconds();
      if (lockSec > 0) {
        showToast('Muitas tentativas inválidas. Aguarde ' + lockSec + 's antes de tentar novamente.', true);
        return;
      }
    }

    btn.disabled = true;
    btn.textContent = 'Validando credenciais...';

    // 1. Autenticação primária via Supabase Auth
    if (window.OlymposSupabase && window.OlymposSupabase.isConfigured()) {
      try {
        const authResult = await window.OlymposSupabase.login(userInput, passInput);
        btn.disabled = false;
        btn.textContent = 'Acessar Ambiente Olympos';

        if (window.OlymposSessionGuard && typeof window.OlymposSessionGuard.resetLoginAttempts === 'function') {
          window.OlymposSessionGuard.resetLoginAttempts();
        }

        const profile = authResult.profile || {};
        if (profile.ativo === false) {
          showToast('Conta de operador suspensa pelo Moderador.', true);
          if (window.OlymposSupabase && typeof window.OlymposSupabase.logout === 'function') {
            try { await window.OlymposSupabase.logout(); } catch (_eL) {}
          }
          return;
        }
        const role = profile.role || 'RH_COMISSAO';
        const ctxLogin = window.OlymposRbac && typeof window.OlymposRbac.hidratarContextoLocal === 'function'
          ? window.OlymposRbac.hidratarContextoLocal(profile)
          : null;
        const abas = (ctxLogin && ctxLogin.paginasPermitidas)
          ? ctxLogin.paginasPermitidas
          : (RBAC_TAB_PERMISSIONS[role] || RBAC_TAB_PERMISSIONS.RH_COMISSAO);

        async function concluirSessaoLogin(tokenAal, aalLevel) {
          let finalToken = tokenAal;
          if (!finalToken && window.OlymposSupabase && typeof window.OlymposSupabase.getJwtToken === 'function') {
            try {
              finalToken = await window.OlymposSupabase.getJwtToken();
            } catch (eTok) {}
          }
          finalToken = finalToken || (authResult.session && authResult.session.access_token) || '';

          const organicRoleLabel = obterLabelPerfilOrganico(role);
          currentUserSession = {
            ok: true,
            token: finalToken,
            access_token: finalToken,
            usuario: authResult.user.email,
            nome: profile.full_name || authResult.user.email,
            department: profile.department || '',
            user: {
              id: authResult.user.id,
              email: authResult.user.email
            },
            profile: profile,
            perfil: {
              id: role,
              nome: organicRoleLabel,
              abasPermitidas: abas
            }
          };

          if (window.OlymposRbac && typeof window.OlymposRbac.hidratarContextoLocal === 'function') {
            window.OlymposRbac.hidratarContextoLocal(profile);
          }

          try {
            localStorage.removeItem('olympos_session');
            sessionStorage.setItem('olympos_session_rbac', JSON.stringify(currentUserSession));
            sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(profile));
          } catch (eStore) {}
          document.getElementById('loginScreen').classList.add('hidden');
          aplicarSessaoNaInterface(currentUserSession);

          if (window.OlymposRbac && typeof window.OlymposRbac.carregarContextoAcesso === 'function') {
            window.OlymposRbac.carregarContextoAcesso(true).then(function(ctxAtualizado) {
              if (currentUserSession && ctxAtualizado && ctxAtualizado.autenticado) {
                currentUserSession.perfil.abasPermitidas = ctxAtualizado.paginasPermitidas;
                currentUserSession.profile = Object.assign({}, currentUserSession.profile || {}, {
                  setor_codigo: ctxAtualizado.setorCodigo,
                  cargo_setor: ctxAtualizado.cargoSetor,
                  ativo: ctxAtualizado.ativo
                });
                aplicarSessaoNaInterface(currentUserSession);
              }
            }).catch(function() {});
          }

          if (window.OlymposTermoSigilo && typeof window.OlymposTermoSigilo.verificarEAplicarTermoSigilo === 'function') {
            const aceito = await window.OlymposTermoSigilo.verificarEAplicarTermoSigilo(currentUserSession);
            if (!aceito) return;
          }

          if (window.OlymposSessionGuard) {
            if (typeof window.OlymposSessionGuard.startIdleMonitor === 'function') {
              window.OlymposSessionGuard.startIdleMonitor(role);
            }
            if (typeof window.OlymposSessionGuard.registrarSessaoAtiva === 'function') {
              window.OlymposSessionGuard.registrarSessaoAtiva(authResult.user.id, aalLevel || 'aal1');
            }
          }

          showToast('Bem-vindo(a), ' + (profile.full_name || authResult.user.email) + '!');

          const curPage = window.OlymposRouter.getPaginaAtual();
          if (curPage === 'visao-geral') {
            if (window.OlymposViews && window.OlymposViews.visaoGeral) {
              window.OlymposViews.visaoGeral.recarregar();
            } else {
              window.OlymposRouter.navegarPara('visao-geral', true);
            }
          } else {
            window.OlymposRouter.navegarPara(curPage, true);
          }
          agendarPreloadInicial_(true);
          acionarOnboardingTour(role);
        }

        // 1.1 Verificação de MFA GoTrue (aal1 / aal2)
        const isMfaMandatory = (typeof window.OlymposSupabase.isRoleMfaMandatory === 'function')
          ? window.OlymposSupabase.isRoleMfaMandatory(role, profile.setor_codigo, profile.cargo_setor)
          : (role === 'MODERADOR' || role === 'ADMIN_GABINETE' || role === 'JURIDICO');

        let mfaStatus = { supported: false, currentLevel: 'aal1', nextLevel: 'aal1', hasEnrolled: false, factors: [], verifiedFactors: [] };
        if (typeof window.OlymposSupabase.checkMfaStatus === 'function') {
          mfaStatus = await window.OlymposSupabase.checkMfaStatus();
        }

        if (mfaStatus && mfaStatus.supported) {
          const currentAal = mfaStatus.currentAal || mfaStatus.currentLevel;
          if (mfaStatus.hasEnrolled && currentAal !== 'aal2') {
            const factorId = mfaStatus.verifiedFactors && mfaStatus.verifiedFactors[0] ? mfaStatus.verifiedFactors[0].id : (mfaStatus.factors[0] && mfaStatus.factors[0].id);
            abrirModalMfaDesafio(factorId, function(verifiedSession) {
              const aal2Tok = verifiedSession && verifiedSession.access_token ? verifiedSession.access_token : null;
              concluirSessaoLogin(aal2Tok, 'aal2');
              drenarCallbacksMfa_(verifiedSession);
            });
            return;
          } else if (isMfaMandatory && (!mfaStatus.hasEnrolled || currentAal !== 'aal2')) {
            if (!mfaStatus.hasEnrolled) {
              abrirModalMfaEnroll(function(verifiedSession) {
                const aal2Tok = verifiedSession && verifiedSession.access_token ? verifiedSession.access_token : null;
                concluirSessaoLogin(aal2Tok, 'aal2');
                drenarCallbacksMfa_(verifiedSession);
              });
              return;
            }
          }
        }

        await concluirSessaoLogin(null, (mfaStatus && (mfaStatus.currentAal || mfaStatus.currentLevel)) || 'aal1');
        return;
      } catch (err) {
        console.warn('[handleLoginSubmit] Falha no Supabase Auth:', err);
        btn.disabled = false;
        btn.textContent = 'Acessar Ambiente Olympos';
        if (window.OlymposSessionGuard && typeof window.OlymposSessionGuard.recordFailedLoginAttempt === 'function') {
          const att = window.OlymposSessionGuard.recordFailedLoginAttempt();
          if (att.lockSeconds > 0) {
            showToast('Muitas tentativas inválidas. Login bloqueado temporariamente por ' + att.lockSeconds + 's.', true);
            return;
          }
        }
        showToast((err && err.message) ? ('Falha na autenticação: ' + err.message) : 'Credenciais inválidas no Supabase Auth.', true);
        return;
      }
    }

    // 2. Contingência GAS apenas quando Supabase não está configurado
    window.OlymposApi.chamar('auth_login', { usuario: userInput, senha: passInput }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Acessar Ambiente Olympos';

      if (res && res.ok) {
        if (res.perfil) {
          const resolvedRoleId = obterRoleIdSessao(res);
          if (!res.perfil.id && resolvedRoleId !== 'VISITANTE') {
            res.perfil.id = resolvedRoleId;
          }
          res.perfil.nome = obterLabelPerfilOrganico(resolvedRoleId);
        }
        currentUserSession = res;
        try {
          localStorage.removeItem('olympos_session');
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
        acionarOnboardingTour(obterRoleIdSessao(res));
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
    if (window.OlymposSessionGuard && typeof window.OlymposSessionGuard.stopIdleMonitor === 'function') {
      window.OlymposSessionGuard.stopIdleMonitor();
    }
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
    mfaFlowActive = false;
    mfaPendingCallbacks = [];
    initialPreloadDoneForAuth = false;
    if (window.OlymposRbac && typeof window.OlymposRbac.limparContextoAcesso === 'function') {
      window.OlymposRbac.limparContextoAcesso();
    }
    aplicarModoVisitanteNaInterface();
    if (window.OlymposChatBadge && typeof window.OlymposChatBadge.clearOnLogout === 'function') {
      window.OlymposChatBadge.clearOnLogout();
    }
    if (window.OlymposViews && window.OlymposViews.visaoGeral && typeof window.OlymposViews.visaoGeral.resetarEstadoLogout === 'function') {
      window.OlymposViews.visaoGeral.resetarEstadoLogout();
    }
    const modalLogin = document.getElementById('loginScreen');
    if (modalLogin) modalLogin.classList.add('hidden');
    showToast('Sessão encerrada.');
    if (window.OlymposRouter && typeof window.OlymposRouter.navegarPara === 'function') {
      window.OlymposRouter.navegarPara('visao-geral');
    }
  }

  function aplicarModoVisitanteNaInterface() {
    if (document.body) {
      document.body.classList.add('is-visitante');
    }

    const userSessionBtn = document.getElementById('userSessionBtn');
    const userBadgeName = document.getElementById('userBadgeName');
    const userBadgeRole = document.getElementById('userBadgeRole');
    const avatarInitials = document.getElementById('userAvatarInitials');

    if (userSessionBtn) {
      userSessionBtn.title = 'Entrar no Hub Olympos';
      userSessionBtn.classList.remove('is-authenticated');
    }
    if (userBadgeName) userBadgeName.textContent = 'Entrar';
    if (userBadgeRole) userBadgeRole.textContent = obterLabelPerfilOrganico('VISITANTE');
    if (avatarInitials) avatarInitials.textContent = 'VS';

    const userProfileModal = document.getElementById('userProfileModal');
    if (userProfileModal) userProfileModal.classList.add('hidden');

    document.querySelectorAll('.nav-link').forEach(function(link) {
      const pageTarget = link.getAttribute('data-page');
      if (!pageTarget) return;
      if (PUBLIC_PAGES.includes(pageTarget)) {
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
      } else {
        dd.classList.add('hidden');
      }
    });

    const blocoGestao = document.getElementById('blocoGestaoUsuarios');
    const avisoRestrito = document.getElementById('avisoAcessoUsuariosRestrito');
    if (blocoGestao) blocoGestao.classList.add('hidden');
    if (avisoRestrito) avisoRestrito.classList.remove('hidden');

    const modalLogin = document.getElementById('loginScreen');
    if (modalLogin) modalLogin.classList.add('hidden');

    aplicarControleAcessoModularEDrive(null, PUBLIC_PAGES);

    if (window.OlymposViews) {
      if (window.OlymposViews.visaoGeral && typeof window.OlymposViews.visaoGeral.resetarEstadoLogout === 'function') {
        window.OlymposViews.visaoGeral.resetarEstadoLogout();
      }
      if (window.OlymposViews.visaoGeral && typeof window.OlymposViews.visaoGeral.atualizarSaudacaoVisitante === 'function') {
        window.OlymposViews.visaoGeral.atualizarSaudacaoVisitante();
      }
      if (window.OlymposViews.escolas && typeof window.OlymposViews.escolas.atualizarPermissoesMapa === 'function') {
        window.OlymposViews.escolas.atualizarPermissoesMapa();
      }
      if (window.OlymposViews.papiroCadmo && typeof window.OlymposViews.papiroCadmo.atualizarPermissoesMapa === 'function') {
        window.OlymposViews.papiroCadmo.atualizarPermissoesMapa();
      }
    }

    if (window.OlymposIcons && typeof window.OlymposIcons.hydrateAll === 'function') {
      window.OlymposIcons.hydrateAll();
    }
    try {
      window.dispatchEvent(new CustomEvent('olympos:auth-changed', { detail: { sessao: null } }));
    } catch (eEvt) {}
  }

  function normalizarTextoSemAcentos_(val) {
    const s = String(val || '').trim();
    return (typeof s.normalize === 'function' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s).toUpperCase();
  }

  function normalizarPermissoesRbac(listaBruta, roleId) {
    const set = new Set(['visao-geral', 'escolas', 'calendario', 'configuracoes', 'personas', 'busca', 'oraculo', 'servidores', 'chamados', 'pendencias']);
    const roleKey = String(roleId || '').trim().toUpperCase();
    const fonteLista = (Array.isArray(listaBruta) && listaBruta.length > 0)
      ? listaBruta
      : (RBAC_TAB_PERMISSIONS[roleKey] || []);

    (fonteLista || []).forEach(function(item) {
      if (item === 'TODOS') {
        Object.keys(RBAC_TAB_PERMISSIONS).forEach(function(k) {
          RBAC_TAB_PERMISSIONS[k].forEach(function(p) { set.add(p); });
        });
        set.add('TODOS');
      } else if (LEGACY_TAB_MAP[item]) {
        LEGACY_TAB_MAP[item].forEach(function(p) { set.add(p); });
      } else {
        set.add(item);
      }
    });
    return Array.from(set);
  }

  function obterLabelPerfilOrganico(roleId) {
    const r = normalizarTextoSemAcentos_(roleId);
    if (!r) return ROLE_LABELS.VISITANTE;
    if (ROLE_LABELS[r]) return ROLE_LABELS[r];
    if (r.indexOf('MODERADOR') !== -1) return ROLE_LABELS.MODERADOR;
    if (r.indexOf('ADMIN') !== -1 || r.indexOf('GABINETE') !== -1) return ROLE_LABELS.ADMIN_GABINETE;
    if (r.indexOf('RH') !== -1 || r.indexOf('COMISSAO') !== -1 || r.indexOf('RECURSOS HUMANOS') !== -1) return ROLE_LABELS.RH_COMISSAO;
    if (r.indexOf('PEDAGOG') !== -1 || r.indexOf('EVENTO') !== -1) return ROLE_LABELS.PEDAGOGICO_EVENTOS;
    if (r.indexOf('JURID') !== -1) return ROLE_LABELS.JURIDICO;
    if (r.indexOf('VISITANTE') !== -1 || r.indexOf('PUBLICO') !== -1) return ROLE_LABELS.VISITANTE;
    return 'Operador';
  }

  function obterRoleIdSessao(sessao) {
    const s = sessao !== undefined ? sessao : currentUserSession;
    if (!s || !s.perfil) return 'VISITANTE';
    const rawId = normalizarTextoSemAcentos_(s.perfil.id || s.perfil.role || s.perfil.nome || '');
    if (RBAC_TAB_PERMISSIONS[rawId]) return rawId;
    if (rawId.indexOf('MODERADOR') !== -1) return 'MODERADOR';
    if (rawId.indexOf('ADMIN') !== -1 || rawId.indexOf('GABINETE') !== -1) return 'ADMIN_GABINETE';
    if (rawId.indexOf('RH') !== -1 || rawId.indexOf('COMISSAO') !== -1 || rawId.indexOf('RECURSOS HUMANOS') !== -1) return 'RH_COMISSAO';
    if (rawId.indexOf('PEDAGOG') !== -1 || rawId.indexOf('EVENTO') !== -1) return 'PEDAGOGICO_EVENTOS';
    if (rawId.indexOf('JURID') !== -1) return 'JURIDICO';
    return 'VISITANTE';
  }

  function isModerador(sessao) {
    return obterRoleIdSessao(sessao) === 'MODERADOR';
  }

  function podeEditarMapa(sessao) {
    const r = obterRoleIdSessao(sessao);
    return r === 'MODERADOR' || r === 'ADMIN_GABINETE';
  }

  function podeEditarMemorias(sessao) {
    const s = sessao !== undefined ? sessao : currentUserSession;
    if (!s || !s.perfil) return false;
    if (s.perfil.podeEditarMemorias === false) return false;
    if (s.perfil.podeEditarMemorias === true) return true;
    const r = obterRoleIdSessao(s);
    return r === 'MODERADOR' || r === 'ADMIN_GABINETE';
  }

  function getPermitidasSessao(sessao) {
    const s = sessao !== undefined ? sessao : currentUserSession;
    if (!s || !s.perfil) {
      return PUBLIC_PAGES.slice();
    }
    const roleId = obterRoleIdSessao(s);
    if (window.OlymposRbac && typeof window.OlymposRbac.getContextoAtual === 'function') {
      const ctx = window.OlymposRbac.getContextoAtual();
      if (ctx && ctx.autenticado && Array.isArray(ctx.paginasPermitidas) && ctx.paginasPermitidas.length > 0) {
        return normalizarPermissoesRbac(ctx.paginasPermitidas, roleId);
      }
    }
    const abasBrutas = Array.isArray(s.perfil.abasPermitidas) && s.perfil.abasPermitidas.length > 0
      ? s.perfil.abasPermitidas
      : (RBAC_TAB_PERMISSIONS[roleId] || []);
    return normalizarPermissoesRbac(abasBrutas, roleId);
  }

  function podeAcessarPagina(pageId, sessao) {
    const s = sessao !== undefined ? sessao : currentUserSession;
    const target = String(pageId || 'visao-geral').trim();
    if (!s || !s.perfil) {
      return PUBLIC_PAGES.includes(target);
    }
    if (window.OlymposRbac && typeof window.OlymposRbac.podeAcessarPagina === 'function') {
      const ctx = window.OlymposRbac.getContextoAtual();
      if (ctx && ctx.autenticado) {
        return window.OlymposRbac.podeAcessarPagina(target, ctx);
      }
    }
    const permitidas = getPermitidasSessao(s);
    return permitidas.includes('TODOS') || permitidas.includes(target);
  }

  function aplicarControleAcessoModularEDrive(sessaoArg, permitidasArg) {
    const sessao = sessaoArg !== undefined ? sessaoArg : currentUserSession;
    const roleId = obterRoleIdSessao(sessao);
    const isAuth = Boolean(sessao && sessao.perfil && roleId !== 'VISITANTE');
    const permitidas = Array.isArray(permitidasArg)
      ? permitidasArg
      : getPermitidasSessao(sessao);
    const temTodos = isAuth && (permitidas.includes('TODOS') || roleId === 'MODERADOR');

    // 1. Filtrar cards da seção OPERAÇÕES MODULARES (.quick-module-card[data-nav-target])
    let cardsVisiveis = 0;
    document.querySelectorAll('.quick-module-card[data-nav-target]').forEach(function(card) {
      const target = card.getAttribute('data-nav-target');
      if (!target) return;
      const permitido = isAuth
        ? (temTodos || permitidas.includes(target))
        : PUBLIC_PAGES.includes(target);
      card.classList.toggle('hidden', !permitido);
      card.style.display = permitido ? '' : 'none';
      card.setAttribute('aria-hidden', permitido ? 'false' : 'true');
      if (permitido) {
        cardsVisiveis++;
        card.setAttribute('data-vis-order', String(cardsVisiveis));
      } else {
        card.removeAttribute('data-vis-order');
      }
    });

    const secModular = document.getElementById('operacoesModularesSection');
    if (secModular) {
      secModular.classList.toggle('hidden', cardsVisiveis === 0);
      const gridModular = secModular.querySelector('.quick-modules-grid');
      if (gridModular) {
        gridModular.setAttribute('data-visible-count', String(cardsVisiveis));
      }
    }

    // 2. Filtrar Atalhos para o Drive e elementos com data-requires-auth / data-access-roles / data-access-page
    const avaliarElementoAcesso = function(el) {
      const reqAuth = el.getAttribute('data-requires-auth') === 'true';
      const rolesAttr = el.getAttribute('data-access-roles');
      const pageAttr = el.getAttribute('data-access-page');

      if (reqAuth && !isAuth) {
        return false;
      }
      if (rolesAttr) {
        if (!isAuth) return false;
        const allowedRoles = rolesAttr.split(',').map(function(r) { return r.trim().toUpperCase(); }).filter(Boolean);
        if (allowedRoles.length > 0 && roleId !== 'MODERADOR' && !allowedRoles.includes(roleId)) {
          return false;
        }
      }
      if (pageAttr) {
        if (isAuth) {
          if (!temTodos && !permitidas.includes(pageAttr)) return false;
        } else {
          if (!PUBLIC_PAGES.includes(pageAttr)) return false;
        }
      }
      return true;
    };

    document.querySelectorAll('[data-requires-auth], [data-access-roles], [data-access-page]').forEach(function(el) {
      if (el.classList.contains('quick-module-card')) return;
      const visivel = avaliarElementoAcesso(el);
      el.classList.toggle('hidden', !visivel);
      el.style.display = visivel ? '' : 'none';
      el.setAttribute('aria-hidden', visivel ? 'false' : 'true');
    });

    document.querySelectorAll('[data-visitante-only="true"]').forEach(function(el) {
      const visivel = !isAuth;
      el.classList.toggle('hidden', !visivel);
      el.style.display = visivel ? '' : 'none';
      el.setAttribute('aria-hidden', visivel ? 'false' : 'true');
    });

    // 3. Ocultar contêineres de Atalhos Drive quando nenhum atalho filho estiver visível
    const drawerDriveSec = document.getElementById('mobileDrawerDriveSection') || document.querySelector('.mobile-drawer-drive-section');
    if (drawerDriveSec) {
      const driveItems = drawerDriveSec.querySelectorAll('.drawer-drive-item');
      const hasVisibleDriveItem = Array.from(driveItems).some(function(item) {
        return !item.classList.contains('hidden');
      });
      drawerDriveSec.classList.toggle('hidden', !hasVisibleDriveItem);
      drawerDriveSec.style.display = hasVisibleDriveItem ? '' : 'none';
    }

    const headerDriveActions = document.getElementById('operacoesModularesDriveActions');
    if (headerDriveActions) {
      const chips = headerDriveActions.querySelectorAll('.folder-chip');
      const hasVisibleChip = Array.from(chips).some(function(chip) {
        return !chip.classList.contains('hidden');
      });
      headerDriveActions.classList.toggle('hidden', !hasVisibleChip);
      headerDriveActions.style.display = hasVisibleChip ? 'flex' : 'none';
    }

    if (window.OlymposRbac && typeof window.OlymposRbac.aplicarAtributosPermissaoDom === 'function') {
      window.OlymposRbac.aplicarAtributosPermissaoDom();
    }
  }

  function aplicarSessaoNaInterface(sessao) {
    if (!sessao || !sessao.perfil) return;

    if (window.OlymposRbac && typeof window.OlymposRbac.getContextoAtual === 'function' && !window.OlymposRbac.getContextoAtual().autenticado) {
      window.OlymposRbac.hidratarContextoLocal(sessao.profile || sessao);
    }

    if (document.body) {
      document.body.classList.remove('is-visitante');
    }

    const roleId = obterRoleIdSessao(sessao);
    const nomeExibicao = sessao.nome || sessao.usuario || obterLabelPerfilOrganico(roleId);
    const userSessionBtn = document.getElementById('userSessionBtn');
    const userBadgeName = document.getElementById('userBadgeName');
    const userBadgeRole = document.getElementById('userBadgeRole');
    const avatarInitials = document.getElementById('userAvatarInitials');

    if (userSessionBtn) {
      userSessionBtn.title = 'Minha Conta e Perfil (Clique para visualizar ou editar)';
      userSessionBtn.classList.add('is-authenticated');
    }
    if (userBadgeName) userBadgeName.textContent = nomeExibicao;
    if (userBadgeRole) {
      const setorCod = sessao.profile && sessao.profile.setor_codigo;
      const cargoSet = sessao.profile && sessao.profile.cargo_setor;
      userBadgeRole.textContent = (window.OlymposRbac && typeof window.OlymposRbac.formatarCargoSetorBadge === 'function')
        ? window.OlymposRbac.formatarCargoSetorBadge(setorCod, cargoSet, roleId)
        : obterLabelPerfilOrganico(roleId);
    }
    if (avatarInitials) {
      const partes = nomeExibicao.split(/\s+/).filter(Boolean);
      const iniciais = partes.length >= 2
        ? (partes[0][0] + partes[1][0]).toUpperCase()
        : nomeExibicao.substring(0, 2).toUpperCase();
      avatarInitials.textContent = iniciais;
    }

    const permitidas = normalizarPermissoesRbac(sessao.perfil.abasPermitidas, roleId);
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

    // Controle de Visibilidade RBAC exclusivo do perfil Moderador
    const isMod = isModerador(sessao);
    const blocoGestao = document.getElementById('blocoGestaoUsuarios');
    const avisoRestrito = document.getElementById('avisoAcessoUsuariosRestrito');
    if (blocoGestao) blocoGestao.classList.toggle('hidden', !isMod);
    if (avisoRestrito) avisoRestrito.classList.toggle('hidden', isMod);

    aplicarControleAcessoModularEDrive(sessao, permitidas);
    if (window.OlymposChatBadge && typeof window.OlymposChatBadge.refresh === 'function') {
      window.OlymposChatBadge.refresh();
    }

    if (window.OlymposViews) {
      if (window.OlymposViews.visaoGeral && typeof window.OlymposViews.visaoGeral.atualizarSaudacaoVisitante === 'function') {
        window.OlymposViews.visaoGeral.atualizarSaudacaoVisitante();
      }
      if (window.OlymposViews.escolas && typeof window.OlymposViews.escolas.atualizarPermissoesMapa === 'function') {
        window.OlymposViews.escolas.atualizarPermissoesMapa();
      }
      if (window.OlymposViews.papiroCadmo && typeof window.OlymposViews.papiroCadmo.atualizarPermissoesMapa === 'function') {
        window.OlymposViews.papiroCadmo.atualizarPermissoesMapa();
      }
    }
    if (window.OlymposRouter && typeof window.OlymposRouter.getPaginaAtual === 'function' && window.OlymposRouter.getPaginaAtual() === 'visao-geral') {
      const vgMeta = window.OlymposRouter.PAGES && window.OlymposRouter.PAGES['visao-geral'];
      if (vgMeta) {
        const eb = document.getElementById('pageHeaderEyebrow');
        const tt = document.getElementById('pageHeaderTitle');
        const sb = document.getElementById('pageHeaderSubtitle');
        if (eb) eb.textContent = vgMeta.eyebrow;
        if (tt) tt.textContent = vgMeta.title;
        if (sb) sb.textContent = vgMeta.subtitle;
      }
    }

    if (window.OlymposIcons && typeof window.OlymposIcons.hydrateAll === 'function') {
      window.OlymposIcons.hydrateAll();
    }
    try {
      window.dispatchEvent(new CustomEvent('olympos:auth-changed', { detail: { sessao: sessao } }));
    } catch (eEvt) {}
  }

  function getSession() {
    return currentUserSession;
  }

  function getSessaoAtual() {
    return currentUserSession;
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
  // RESET PWA & PURGA DE CACHE OFFLINE PARA DISPOSITIVOS MÓVEIS
  // =========================================================================
  async function resetMobileApp() {
    showToast('Resetando cache e atualizando aplicação...', false);
    try {
      // 1. Limpa todas as instâncias do CacheStorage
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(function(k) {
          return caches.delete(k);
        }));
      }

      // 2. Desregistra todos os Service Workers instalados
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(function(r) {
          return r.unregister();
        }));
      }

      // 3. Limpa sessionStorage
      try {
        sessionStorage.clear();
      } catch (eSession) {}

      // 4. Limpa caches transitórios do localStorage sem apagar URLs de infraestrutura
      try {
        localStorage.removeItem('olympos_sw_purged_v260');
        localStorage.removeItem('olympos_sw_purged_v203');
        localStorage.removeItem('olympos_session_rbac');
        localStorage.removeItem('olympos_rbac_profile_cache');
      } catch (eStorage) {}

      // 5. Recarregamento forçado com parâmetro anti-cache
      showToast('Cache limpo com sucesso! Recarregando sistema...', false);
      setTimeout(function() {
        const bustUrl = window.location.origin + window.location.pathname + '?v=2.0.3&t=' + Date.now() + window.location.hash;
        window.location.replace(bustUrl);
      }, 300);
    } catch (err) {
      console.error('[PWA-Reset] Erro durante o reset:', err);
      window.location.reload(true);
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

    if ((!inCfg && !inDiario) || mfaFlowActive) {
      return;
    }

    const token = (window.OlymposApi && typeof window.OlymposApi.getJwtToken === 'function')
      ? window.OlymposApi.getJwtToken()
      : null;
    const roleId = currentUserSession ? obterRoleIdSessao(currentUserSession) : 'VISITANTE';
    if (!currentUserSession || roleId === 'VISITANTE' || !token) {
      return;
    }
    if ((roleId === 'MODERADOR' || roleId === 'ADMIN_GABINETE') && decodificarAalJwt_(token) !== 'aal2') {
      return;
    }

    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
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
        const okIcon = window.OlymposIcons ? (window.OlymposIcons.inline ? window.OlymposIcons.inline('check') : '<span class="svg-icon-inline">' + window.OlymposIcons.ui('check') + '</span>') : '';
        if (fbCfg) fbCfg.innerHTML = okIcon + ' ' + escapeHtml(msg);
        if (fbDiario) fbDiario.innerHTML = okIcon + ' ' + escapeHtml(msg);
        showToast(msg);
      }, function(err) {
        const warnIcon = window.OlymposIcons ? (window.OlymposIcons.inline ? window.OlymposIcons.inline('alertTriangle') : '<span class="svg-icon-inline">' + window.OlymposIcons.ui('alertTriangle') + '</span>') : '';
        if (fbCfg) fbCfg.innerHTML = warnIcon + ' Salvo localmente no navegador (pendente sync com servidor).';
        if (fbDiario) fbDiario.innerHTML = warnIcon + ' Salvo localmente no navegador.';
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

    const btnGemini = document.getElementById('topGeminiBtn');
    if (btnGemini) {
      btnGemini.addEventListener('click', function() {
        fecharDropdowns();
        abrirJanelaGeminiCompanion();
      });
    }

    const dropdownWorkspaceMenu = document.getElementById('dropdownWorkspaceMenu');
    if (dropdownWorkspaceMenu) {
      dropdownWorkspaceMenu.querySelectorAll('a.dropdown-item').forEach(function(link) {
        link.addEventListener('click', function() {
          fecharDropdowns();
        });
      });
    }

    const btnModoKiosk = document.getElementById('btnModoKiosk');
    if (btnModoKiosk && !btnModoKiosk._boundKiosk) {
      btnModoKiosk._boundKiosk = true;
      btnModoKiosk.addEventListener('click', function() {
        if (window.OlymposRouter && typeof window.OlymposRouter.navegarPara === 'function') {
          window.OlymposRouter.navegarPara('kiosk');
        }
      });
    }

    const btnUser = document.getElementById('userSessionBtn');
    if (btnUser) {
      btnUser.addEventListener('click', function() {
        if (!currentUserSession || !currentUserSession.perfil) {
          solicitarLogin();
        } else {
          abrirModalPerfilUsuario();
        }
      });
    }

    const btnCloseLogin = document.getElementById('closeLoginModalBtn');
    if (btnCloseLogin) {
      btnCloseLogin.addEventListener('click', function() {
        fecharModalLogin();
      });
    }

    const btnCloseLoginX = document.getElementById('closeLoginScreenXBtn');
    if (btnCloseLoginX) {
      btnCloseLoginX.addEventListener('click', function() {
        fecharModalLogin();
      });
    }

    const loginModalBackdrop = document.getElementById('loginScreen');
    if (loginModalBackdrop) {
      loginModalBackdrop.addEventListener('click', function(e) {
        if (e.target === loginModalBackdrop) {
          fecharModalLogin();
        }
      });
    }

    const btnMenu = document.getElementById('mobileMenuToggleBtn');
    if (btnMenu) {
      btnMenu.addEventListener('click', function() {
        document.body.classList.toggle('nav-drawer-open');
      });
    }

    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', function() {
        document.body.classList.remove('nav-drawer-open');
      });
    }

    document.querySelectorAll('.drawer-close-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.body.classList.remove('nav-drawer-open');
      });
    });

    document.querySelectorAll('.mobile-nav-inner .nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        if (link.classList.contains('nav-dropdown-trigger') || !link.getAttribute('data-page')) {
          return;
        }
        document.body.classList.remove('nav-drawer-open');
      });
    });

    const btnMobileReset = document.getElementById('mobileResetSiteBtn');
    if (btnMobileReset) {
      btnMobileReset.addEventListener('click', function(e) {
        e.preventDefault();
        const conf = confirm(
          'Deseja resetar o aplicativo móvel?\n\n' +
          'Esta ação irá:\n' +
          '1. Limpar todo o cache PWA offline;\n' +
          '2. Desregistrar versões anteriores do Service Worker;\n' +
          '3. Forçar o download da versão mais recente;\n' +
          '4. Recarregar o sistema limpo.\n\n' +
          'Deseja continuar?'
        );
        if (conf) {
          resetMobileApp();
        }
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

    // Gatilho de abertura/fechamento do dropdown Documentos e navegação completa por teclado
    const getVisibleDropdownItems = function(menu) {
      if (!menu) return [];
      return Array.from(menu.querySelectorAll('.dropdown-item')).filter(function(item) {
        return !item.classList.contains('hidden') && item.offsetParent !== null;
      });
    };

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

      trigger.addEventListener('keydown', function(e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const parent = trigger.closest('.nav-dropdown');
        const menu = parent ? parent.querySelector('.dropdown-menu') : null;
        const items = getVisibleDropdownItems(menu);
        if (!parent || items.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        fecharDropdowns();
        parent.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        const targetItem = e.key === 'ArrowUp' ? items[items.length - 1] : items[0];
        if (targetItem && typeof targetItem.focus === 'function') {
          targetItem.focus();
        }
      });
    });

    document.querySelectorAll('.dropdown-menu').forEach(function(menu) {
      menu.addEventListener('keydown', function(e) {
        const items = getVisibleDropdownItems(menu);
        if (items.length === 0) return;
        const currentIdx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = items[(currentIdx + 1) % items.length];
          if (next) next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = items[(currentIdx - 1 + items.length) % items.length];
          if (prev) prev.focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          items[0].focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const parent = menu.closest('.nav-dropdown');
          const trigger = parent ? parent.querySelector('.nav-dropdown-trigger') : null;
          fecharDropdowns();
          if (trigger && typeof trigger.focus === 'function') trigger.focus();
        }
      });
    });

    // Toast clicável para fechamento imediato
    const globalToastEl = document.getElementById('globalToast');
    if (globalToastEl && !globalToastEl._boundClose) {
      globalToastEl._boundClose = true;
      globalToastEl.setAttribute('title', 'Clique para fechar');
      globalToastEl.addEventListener('click', function() {
        globalToastEl.classList.add('hidden');
        if (document.body) document.body.classList.remove('has-active-toast');
        clearTimeout(globalToastEl._timer);
      });
    }

    // Botão flutuante Voltar ao Topo (criado dinamicamente para preservar budget do index.html)
    if (typeof document !== 'undefined' && document.body && !document.getElementById('btnBackToTop')) {
      const btnTop = document.createElement('button');
      btnTop.type = 'button';
      btnTop.id = 'btnBackToTop';
      btnTop.className = 'back-to-top-fab hidden';
      btnTop.setAttribute('aria-label', 'Voltar ao topo da página');
      btnTop.setAttribute('title', 'Voltar ao topo');
      btnTop.innerHTML = (window.OlymposIcons && typeof window.OlymposIcons.ui === 'function')
        ? (window.OlymposIcons.ui('arrowUp') || '↑')
        : '↑';
      btnTop.addEventListener('click', function() {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      document.body.appendChild(btnTop);

      const syncBackToTop = function() {
        btnTop.classList.toggle('hidden', window.scrollY <= 460);
      };
      window.addEventListener('scroll', syncBackToTop, { passive: true });
      syncBackToTop();
    }

    // Fechamento defensivo de dropdowns ao clicar fora ou pressionar Escape
    document.addEventListener('click', function(e) {
      if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('.nav-dropdown')) {
        fecharDropdowns();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.body.classList.remove('nav-drawer-open');
        fecharDropdowns();
        const modalLogin = document.getElementById('loginScreen');
        if (modalLogin && !modalLogin.classList.contains('hidden')) {
          fecharModalLogin();
        }
        const modalPerfil = document.getElementById('userProfileModal');
        if (modalPerfil && !modalPerfil.classList.contains('hidden')) {
          fecharModalPerfilUsuario();
        }
      }
    });

    window.addEventListener('hashchange', function() {
      fecharModalPerfilUsuario();
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

    bindDynamicControls();
  }

  function bindDynamicControls() {
    const bindOnce = function(el, evt, fn) {
      if (!el) return;
      const key = '_bound_' + evt;
      if (el[key]) return;
      el[key] = true;
      el.addEventListener(evt, fn);
    };

    document.querySelectorAll('[data-nav-target]').forEach(function(el) {
      if (el.tagName !== 'A' && el.tagName !== 'BUTTON') {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.hasAttribute('role')) el.setAttribute('role', 'link');
      }
      bindOnce(el, 'click', function() {
        const target = el.getAttribute('data-nav-target');
        document.body.classList.remove('nav-drawer-open');
        if (target) window.OlymposRouter.navegarPara(target);
      });
      if (el.tagName !== 'A' && el.tagName !== 'BUTTON') {
        bindOnce(el, 'keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const target = el.getAttribute('data-nav-target');
            document.body.classList.remove('nav-drawer-open');
            if (target) window.OlymposRouter.navegarPara(target);
          }
        });
      }
    });

    const btnModoKioskDyn = document.getElementById('btnModoKiosk');
    bindOnce(btnModoKioskDyn, 'click', function() {
      if (window.OlymposRouter && typeof window.OlymposRouter.navegarPara === 'function') {
        window.OlymposRouter.navegarPara('kiosk');
      }
    });

    const btnCloseProfile = document.getElementById('closeUserProfileModalBtn');
    bindOnce(btnCloseProfile, 'click', fecharModalPerfilUsuario);

    const userProfileBackdrop = document.getElementById('userProfileModal');
    bindOnce(userProfileBackdrop, 'click', function(e) {
      if (e.target === userProfileBackdrop) {
        fecharModalPerfilUsuario();
      }
    });

    const formUserProfile = document.getElementById('formUserProfile');
    bindOnce(formUserProfile, 'submit', handleSalvarPerfilProprio);

    const btnLogoutFromProfile = document.getElementById('btnLogoutFromProfileModal');
    bindOnce(btnLogoutFromProfile, 'click', function() {
      fecharModalPerfilUsuario();
      fazerLogout();
    });

    const closeMem = document.getElementById('closeModalBtn');
    bindOnce(closeMem, 'click', function() {
      const m = document.getElementById('memoriaModal');
      if (m) m.classList.add('hidden');
    });

    const closeCont = document.getElementById('closeContadoresModalBtn');
    bindOnce(closeCont, 'click', function() {
      const m = document.getElementById('contadoresModal');
      if (m) m.classList.add('hidden');
    });

    bindOnce(document.getElementById('saveContadoresMdBtn'), 'click', salvarContadoresMd);
    bindOnce(document.getElementById('saveMemoriaBtn'), 'click', salvarMemoriaMd);
    bindOnce(document.getElementById('reloadMemoriaBtn'), 'click', function() {
      recarregarMemoriaModalAoVivo(false);
    });
    bindOnce(document.getElementById('clearMemoriaBtn'), 'click', limparPendenciasMemoriaModal);

    bindOnce(document.getElementById('btnAbrirModalNovoUsuario'), 'click', abrirModalNovoUsuario);
    bindOnce(document.getElementById('closeModalNovoUsuarioBtn'), 'click', fecharModalNovoUsuario);
    bindOnce(document.getElementById('btnCancelarNovoUsuario'), 'click', fecharModalNovoUsuario);
    bindOnce(document.getElementById('btnGerarSenhaNovoUsuario'), 'click', gerarSenhaParaFormularioNovoUsuario);
    bindOnce(document.getElementById('btnToggleVisibilidadeSenha'), 'click', toggleVisibilidadeSenhaNovoUsuario);

    const formNovoUser = document.getElementById('formNovoUsuario');
    bindOnce(formNovoUser, 'submit', function(e) {
      e.preventDefault();
      handleNovoUsuarioSubmit(e);
    });

    bindOnce(document.getElementById('configSalvarBoletimEmailBtn'), 'click', function() {
      const inCfg = document.getElementById('configBoletimEmailInput');
      salvarBoletimEmails(inCfg ? inCfg.value : '');
    });
    bindOnce(document.getElementById('configTestarBoletimEmailBtn'), 'click', testarEnvioBoletim);
    bindOnce(document.getElementById('diarioSalvarBoletimEmailBtn'), 'click', function() {
      const inDiario = document.getElementById('diarioBoletimEmailInput');
      salvarBoletimEmails(inDiario ? inDiario.value : '');
    });

    if (document.getElementById('configBoletimEmailInput') || document.getElementById('diarioBoletimEmailInput')) {
      carregarConfiguracaoBoletimEmails();
    }

    bindOnce(document.getElementById('themeToggleBtn'), 'click', alternarTema);

    bindOnce(document.getElementById('btnAbrirMapaAtalhosConfig'), 'click', function() {
      if (window.OlymposShortcuts && typeof window.OlymposShortcuts.openHelpModal === 'function') {
        window.OlymposShortcuts.openHelpModal();
      }
    });
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
  async function abrirModalContadores() {
    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.ensureModal === 'function') {
      await window.OlymposRouteLoader.ensureModal('contadores');
    }
    const modal = document.getElementById('contadoresModal');
    if (modal) modal.classList.remove('hidden');
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

  function atualizarContadorLinhasModal(ta) {
    const counter = document.getElementById('modalLineCounter');
    if (!counter || !ta) return;
    const l = ta.value.split('\n').length;
    counter.textContent = l + ' / 60 linhas';
    counter.className = 'pill-badge ' + (l > 55 ? 'pill-red' : 'pill-gold');
  }

  function recarregarMemoriaModalAoVivo(silencioso) {
    if (!activeMemoriaEditando || !window.OlymposApi || typeof window.OlymposApi.lerMemoria !== 'function') {
      return;
    }
    const alvoArq = activeMemoriaEditando.arquivo;
    const alvoIdentificador = activeMemoriaEditando.id || alvoArq;
    const reloadBtn = document.getElementById('reloadMemoriaBtn');
    if (!silencioso && reloadBtn) {
      reloadBtn.disabled = true;
      reloadBtn.textContent = 'Sincronizando...';
    }

    window.OlymposApi.lerMemoria(alvoIdentificador, function(res) {
      if (!silencioso && reloadBtn) {
        reloadBtn.disabled = false;
        reloadBtn.textContent = 'Recarregar do Docs';
      }
      const mem = (res && res.memoria) || (res && res.data && res.data.memoria);
      if (!mem || !mem.conteudoCompleto) {
        if (!silencioso) {
          showToast((res && res.mensagem) || 'Não foi possível obter conteúdo atualizado do Google Docs.', true);
        }
        return;
      }
      if (!activeMemoriaEditando || activeMemoriaEditando.arquivo !== alvoArq) {
        return;
      }
      if (!silencioso && window.OLYMPOS_MEMORIAS_CATALOGO) {
        window.OLYMPOS_MEMORIAS_CATALOGO.removerEdicaoLocal(alvoArq);
      }
      activeMemoriaEditando.conteudoCompleto = mem.conteudoCompleto;
      if (mem.id) activeMemoriaEditando.id = mem.id;
      if (mem.url) activeMemoriaEditando.url = mem.url;

      const ta = document.getElementById('modalMemoriaTextarea');
      if (ta) {
        ta.value = mem.conteudoCompleto;
        atualizarContadorLinhasModal(ta);
      }
      if (!silencioso) {
        showToast('Memória sincronizada diretamente do Google Docs!');
      }
    }, function(err) {
      if (!silencioso && reloadBtn) {
        reloadBtn.disabled = false;
        reloadBtn.textContent = 'Recarregar do Docs';
        showToast('Falha ao ler Google Docs: ' + ((err && err.message) || 'gateway indisponível'), true);
      }
    });
  }

  function limparPendenciasMemoriaModal() {
    if (!activeMemoriaEditando) return;
    if (!podeEditarMemorias()) {
      showToast('Seu perfil possui acesso somente leitura às memórias institucionais.', true);
      return;
    }
    const nome = activeMemoriaEditando.deus || activeMemoriaEditando.nome || activeMemoriaEditando.arquivo;
    const confirma = typeof window.confirm === 'function'
      ? window.confirm('Deseja limpar a Caixa de Entrada e Pendências Concluídas de ' + nome + ' no Google Docs?')
      : true;
    if (!confirma) return;

    if (!window.OlymposApi || typeof window.OlymposApi.limparMemoria !== 'function') {
      showToast('Serviço de limpeza de memória indisponível.', true);
      return;
    }

    const arq = activeMemoriaEditando.arquivo;
    const clearBtn = document.getElementById('clearMemoriaBtn');
    if (clearBtn) {
      clearBtn.disabled = true;
      clearBtn.textContent = 'Higienizando...';
    }

    window.OlymposApi.limparMemoria(activeMemoriaEditando.id || arq, function(res) {
      if (clearBtn) {
        clearBtn.disabled = false;
        clearBtn.textContent = 'Limpar Caixa/Pendências';
      }
      if (res && res.ok !== false) {
        if (window.OLYMPOS_MEMORIAS_CATALOGO) {
          window.OLYMPOS_MEMORIAS_CATALOGO.removerEdicaoLocal(arq);
        }
        showToast('Caixa de Entrada e pendências higienizadas no Google Docs de ' + nome + '!');
        recarregarMemoriaModalAoVivo(true);
        if (window.OlymposViews && window.OlymposViews.personas) {
          window.OlymposViews.personas.recarregar(true);
        }
      } else {
        showToast((res && res.mensagem) || 'Falha ao higienizar memória.', true);
      }
    }, function(err) {
      if (clearBtn) {
        clearBtn.disabled = false;
        clearBtn.textContent = 'Limpar Caixa/Pendências';
      }
      showToast('Erro ao higienizar memória: ' + ((err && err.message) || 'falha de comunicação'), true);
    });
  }

  async function abrirModalMemoria(memoriaObj) {
    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.ensureModal === 'function') {
      await window.OlymposRouteLoader.ensureModal('memoria');
    }
    let enriched = memoriaObj || {};
    if (window.OLYMPOS_MEMORIAS_CATALOGO) {
      const catMeta = (enriched.id && window.OLYMPOS_MEMORIAS_CATALOGO.obterPorId(enriched.id)) ||
        window.OLYMPOS_MEMORIAS_CATALOGO.obterPorArquivo(enriched.arquivo || enriched.nome || enriched.deus);
      if (catMeta) {
        enriched = Object.assign({}, catMeta, enriched, {
          id: enriched.id || catMeta.id,
          url: enriched.url || catMeta.url,
          arquivo: enriched.arquivo || catMeta.arquivo,
          dominio: enriched.dominio || catMeta.dominio,
          formato: enriched.formato || catMeta.formato || 'GOOGLE_DOCS'
        });
      }
    }

    activeMemoriaEditando = enriched;
    const nome = enriched.deus || enriched.nome || enriched.arquivo;
    const arq = enriched.arquivo || nome;
    const docId = enriched.id || enriched.driveId || '';
    const docUrl = enriched.url || (docId ? ('https://docs.google.com/document/d/' + docId + '/edit') : '');
    const podeEditar = podeEditarMemorias();

    const titleEl = document.getElementById('modalMemoriaTitle');
    if (titleEl) titleEl.textContent = nome + ' — Google Docs';

    const subtitleEl = document.getElementById('modalMemoriaSubtitle');
    if (subtitleEl) {
      subtitleEl.textContent = arq + (docId ? (' • ID ' + docId) : '') + (podeEditar ? '' : ' • Somente leitura');
    }

    const openLinkEl = document.getElementById('modalMemoriaOpenDocLink');
    if (openLinkEl) {
      if (docUrl) {
        openLinkEl.href = docUrl;
        openLinkEl.classList.remove('hidden');
      } else {
        openLinkEl.removeAttribute('href');
        openLinkEl.classList.add('hidden');
      }
    }

    const btnSave = document.getElementById('saveMemoriaBtn');
    if (btnSave) {
      btnSave.textContent = 'Salvar no Google Docs';
      btnSave.classList.toggle('hidden', !podeEditar);
    }
    const btnClear = document.getElementById('clearMemoriaBtn');
    if (btnClear) {
      btnClear.classList.toggle('hidden', !podeEditar);
    }

    const ta = document.getElementById('modalMemoriaTextarea');
    ta.readOnly = !podeEditar;

    // Recupera conteúdo com preferência para edições locais pendentes no catálogo
    let conteudo = enriched.conteudoCompleto || '';
    let temPendenteLocal = false;
    if (window.OLYMPOS_MEMORIAS_CATALOGO && arq) {
      temPendenteLocal = Boolean(window.OLYMPOS_MEMORIAS_CATALOGO.temEdicaoLocalPendente(arq));
      const local = window.OLYMPOS_MEMORIAS_CATALOGO.obterConteudoLocal(arq);
      if (local !== null && local !== undefined) {
        conteudo = local;
      }
    }
    ta.value = conteudo;

    atualizarContadorLinhasModal(ta);
    ta.oninput = function() {
      atualizarContadorLinhasModal(ta);
    };
    document.getElementById('memoriaModal').classList.remove('hidden');

    if (!temPendenteLocal && window.OlymposApi && typeof window.OlymposApi.lerMemoria === 'function') {
      recarregarMemoriaModalAoVivo(true);
    }
  }

  function salvarMemoriaMd() {
    if (!activeMemoriaEditando) return;
    if (!podeEditarMemorias()) {
      showToast('Seu perfil possui acesso somente leitura às memórias institucionais.', true);
      return;
    }
    const novoConteudo = document.getElementById('modalMemoriaTextarea').value;
    const arq = activeMemoriaEditando.arquivo;
    const docId = activeMemoriaEditando.id || activeMemoriaEditando.driveId || '';
    const btn = document.getElementById('saveMemoriaBtn');

    // 1. Persistência local imediata no browser (localStorage e in-memory)
    if (window.OLYMPOS_MEMORIAS_CATALOGO) {
      window.OLYMPOS_MEMORIAS_CATALOGO.salvarLocal(arq, novoConteudo);
    }
    activeMemoriaEditando.conteudoCompleto = novoConteudo;

    btn.disabled = true;
    btn.textContent = 'Sincronizando no Google Docs...';

    // 2. Sincronização remota via Gateway GAS (CORS Simple Request)
    window.OlymposApi.salvarMemoria(arq, novoConteudo, function(res) {
      btn.disabled = false;
      btn.textContent = 'Salvar no Google Docs';

      if (res && res.ok) {
        if (window.OLYMPOS_MEMORIAS_CATALOGO) {
          window.OLYMPOS_MEMORIAS_CATALOGO.removerEdicaoLocal(arq);
        }
        showToast('Memória ' + arq + ' sincronizada com sucesso no Google Docs!');
        document.getElementById('memoriaModal').classList.add('hidden');
        if (window.OlymposViews && window.OlymposViews.personas) {
          window.OlymposViews.personas.recarregar(true);
        }
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        showToast('Salvo localmente no navegador! Sincronização com o Google Docs pendente (' + ((res && res.mensagem) || 'offline') + ').', false);
        document.getElementById('memoriaModal').classList.add('hidden');
        if (window.OlymposViews && window.OlymposViews.personas) {
          window.OlymposViews.personas.recarregar(true);
        }
      }
    }, function() {
      btn.disabled = false;
      btn.textContent = 'Salvar no Google Docs';
      // Modo offline: salvo com sucesso no localStorage, não trava nem perde a edição
      showToast('Salvo localmente no navegador! Sincronização com o Google Docs ocorrerá quando o Gateway estiver online.', false);
      document.getElementById('memoriaModal').classList.add('hidden');
      if (window.OlymposViews && window.OlymposViews.personas) {
        window.OlymposViews.personas.recarregar(true);
      }
    }, docId);
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
    if (window.OlymposShortcuts && typeof window.OlymposShortcuts.anunciarLeitorTela === 'function') {
      window.OlymposShortcuts.anunciarLeitorTela(msg, Boolean(isError));
    }
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('error', Boolean(isError));
    t.classList.remove('hidden');
    if (document.body) document.body.classList.add('has-active-toast');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() {
      t.classList.add('hidden');
      if (document.body) document.body.classList.remove('has-active-toast');
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
  // PERFIL DO USUÁRIO LOGADO (POPUP + AUTOEDIÇÃO DE NOME E DEPARTAMENTO)
  // =========================================================================
  async function atualizarPerfilProprio(dados) {
    if (!currentUserSession || !currentUserSession.perfil) {
      throw new Error('Sessão de usuário não autenticada.');
    }

    const opts = dados || {};
    const cleanName = String(opts.full_name !== undefined ? opts.full_name : (opts.nome || '')).trim();
    const cleanDept = String(opts.department !== undefined ? opts.department : (opts.departamento || '')).trim();

    if (!cleanName) {
      throw new Error('O nome completo é obrigatório.');
    }

    if (window.OlymposSupabase && typeof window.OlymposSupabase.getSession === 'function') {
      const sbSess = await window.OlymposSupabase.getSession();
      if (sbSess && sbSess.user && typeof window.OlymposSupabase.atualizarPerfilProprio === 'function') {
        const resRemote = await window.OlymposSupabase.atualizarPerfilProprio({
          full_name: cleanName,
          department: cleanDept
        });
        if (resRemote && resRemote.profile) {
          currentUserSession.profile = Object.assign({}, currentUserSession.profile || {}, resRemote.profile);
        }
      }
    }

    currentUserSession.nome = cleanName;
    currentUserSession.department = cleanDept;
    if (currentUserSession.profile) {
      currentUserSession.profile.full_name = cleanName;
      currentUserSession.profile.department = cleanDept;
    }

    try {
      localStorage.removeItem('olympos_session');
      sessionStorage.setItem('olympos_session_rbac', JSON.stringify(currentUserSession));
      if (currentUserSession.profile) {
        sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(currentUserSession.profile));
      }
    } catch (eStorage) {}

    aplicarSessaoNaInterface(currentUserSession);

    const cfgUserLabel = document.getElementById('configUserLabel');
    if (cfgUserLabel) cfgUserLabel.textContent = cleanName;

    return {
      ok: true,
      nome: cleanName,
      department: cleanDept,
      session: currentUserSession
    };
  }

  async function abrirModalPerfilUsuario() {
    if (!currentUserSession || !currentUserSession.perfil) {
      solicitarLogin();
      return;
    }

    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.ensureModal === 'function') {
      await window.OlymposRouteLoader.ensureModal('userProfile');
    }

    const modal = document.getElementById('userProfileModal');
    if (!modal) return;

    const roleId = obterRoleIdSessao(currentUserSession);
    const roleLabel = obterLabelPerfilOrganico(roleId);
    const nomeAtual = currentUserSession.nome || (currentUserSession.profile && currentUserSession.profile.full_name) || currentUserSession.usuario || 'Operador';
    const emailAtual = currentUserSession.usuario || (currentUserSession.user && currentUserSession.user.email) || (currentUserSession.profile && currentUserSession.profile.email) || '--';
    const deptAtual = currentUserSession.department || (currentUserSession.profile && currentUserSession.profile.department) || '';

    const partes = nomeAtual.split(/\s+/).filter(Boolean);
    const iniciais = partes.length >= 2
      ? (partes[0][0] + partes[1][0]).toUpperCase()
      : nomeAtual.substring(0, 2).toUpperCase();

    const elAvatar = document.getElementById('profileModalAvatarInitials');
    const elDisplay = document.getElementById('profileModalDisplayName');
    const elEmail = document.getElementById('profileModalEmail');
    const elBadge = document.getElementById('profileModalRoleBadge');
    const inName = document.getElementById('profileInputFullName');
    const inDept = document.getElementById('profileInputDepartment');
    const feedback = document.getElementById('profileModalFeedback');

    if (elAvatar) elAvatar.textContent = iniciais;
    if (elDisplay) elDisplay.textContent = nomeAtual;
    if (elEmail) elEmail.textContent = emailAtual;
    if (elBadge) elBadge.textContent = roleLabel;
    if (inName) inName.value = nomeAtual;
    if (inDept) inDept.value = deptAtual;
    if (feedback) {
      feedback.classList.add('hidden');
      feedback.textContent = '';
    }

    modal.classList.remove('hidden');
    if (inName) inName.focus();
  }

  function fecharModalPerfilUsuario() {
    const modal = document.getElementById('userProfileModal');
    if (modal) modal.classList.add('hidden');
  }

  async function handleSalvarPerfilProprio(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const inName = document.getElementById('profileInputFullName');
    const inDept = document.getElementById('profileInputDepartment');
    const btnSave = document.getElementById('btnSaveUserProfile');
    const feedback = document.getElementById('profileModalFeedback');

    const fullName = inName ? inName.value.trim() : '';
    const department = inDept ? inDept.value.trim() : '';

    if (!fullName) {
      if (feedback) {
        feedback.textContent = 'O nome completo é obrigatório.';
        feedback.className = 'output-panel output-error';
        feedback.classList.remove('hidden');
      }
      return;
    }

    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';
    }

    try {
      await atualizarPerfilProprio({
        full_name: fullName,
        department: department
      });

      const elDisplay = document.getElementById('profileModalDisplayName');
      const elAvatar = document.getElementById('profileModalAvatarInitials');
      if (elDisplay) elDisplay.textContent = fullName;
      if (elAvatar) {
        const partes = fullName.split(/\s+/).filter(Boolean);
        elAvatar.textContent = partes.length >= 2
          ? (partes[0][0] + partes[1][0]).toUpperCase()
          : fullName.substring(0, 2).toUpperCase();
      }
      if (feedback) {
        feedback.textContent = 'Dados do perfil atualizados com sucesso!';
        feedback.className = 'output-panel output-success';
        feedback.classList.remove('hidden');
      }
      showToast('Perfil atualizado com sucesso!');
    } catch (err) {
      if (feedback) {
        feedback.textContent = (err && err.message) || 'Não foi possível salvar as alterações.';
        feedback.className = 'output-panel output-error';
        feedback.classList.remove('hidden');
      }
      showToast((err && err.message) || 'Erro ao atualizar perfil.', true);
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Salvar Alterações';
      }
    }
  }

  // =========================================================================
  // GESTÃO DE USUÁRIOS E MODAL NOVO USUÁRIO (EXCLUSIVO MODERADOR)
  // =========================================================================
  async function abrirModalNovoUsuario() {
    if (!isModerador(currentUserSession)) {
      showToast('Acesso restrito ao perfil Moderador.', true);
      return;
    }
    if (window.OlymposRouteLoader && typeof window.OlymposRouteLoader.ensureModal === 'function') {
      await window.OlymposRouteLoader.ensureModal('usuarios');
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

  function csprngIndiceSeguro(maxExclusivo) {
    if (!maxExclusivo || maxExclusivo <= 1) return 0;
    const cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const limiteSemVies = Math.floor(0x100000000 / maxExclusivo) * maxExclusivo;
      const buf = new Uint32Array(1);
      do {
        cryptoObj.getRandomValues(buf);
      } while (buf[0] >= limiteSemVies);
      return buf[0] % maxExclusivo;
    }
    throw new Error('CSPRNG (window.crypto.getRandomValues) indisponível neste navegador.');
  }

  function gerarSenhaSeguraAleatoria() {
    const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const minusculas = 'abcdefghijkmnopqrstuvwxyz';
    const numeros = '23456789';
    const simbolos = '!@#$%&*';
    const todos = maiusculas + minusculas + numeros + simbolos;

    const chars = [
      maiusculas.charAt(csprngIndiceSeguro(maiusculas.length)),
      minusculas.charAt(csprngIndiceSeguro(minusculas.length)),
      numeros.charAt(csprngIndiceSeguro(numeros.length)),
      simbolos.charAt(csprngIndiceSeguro(simbolos.length))
    ];

    for (let i = 4; i < 16; i++) {
      chars.push(todos.charAt(csprngIndiceSeguro(todos.length)));
    }

    // Embaralhamento imparcial de Fisher-Yates via CSPRNG
    for (let j = chars.length - 1; j > 0; j--) {
      const k = csprngIndiceSeguro(j + 1);
      const tmp = chars[j];
      chars[j] = chars[k];
      chars[k] = tmp;
    }
    return chars.join('');
  }

  function gerarSenhaParaFormularioNovoUsuario() {
    const inSenha = document.getElementById('novoUsuarioSenha');
    if (inSenha) {
      inSenha.value = gerarSenhaSeguraAleatoria();
      inSenha.type = 'text';
      const btnToggle = document.getElementById('btnToggleVisibilidadeSenha');
      if (btnToggle) btnToggle.innerHTML = window.OlymposIcons ? window.OlymposIcons.ui('lock') : '';
      showToast('Senha segura gerada com sucesso!');
    }
  }

  function toggleVisibilidadeSenhaNovoUsuario() {
    const inSenha = document.getElementById('novoUsuarioSenha');
    const btnToggle = document.getElementById('btnToggleVisibilidadeSenha');
    if (!inSenha) return;
    if (inSenha.type === 'password') {
      inSenha.type = 'text';
      if (btnToggle) btnToggle.innerHTML = window.OlymposIcons ? window.OlymposIcons.ui('lock') : '';
    } else {
      inSenha.type = 'password';
      if (btnToggle) btnToggle.innerHTML = window.OlymposIcons ? window.OlymposIcons.ui('eye') : '';
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
    if (!isModerador(currentUserSession)) {
      showToast('Ação restrita ao perfil Moderador.', true);
      return;
    }

    const inNome = document.getElementById('novoUsuarioNome');
    const inEmail = document.getElementById('novoUsuarioEmail');
    const inRole = document.getElementById('novoUsuarioRole');
    const inSetor = document.getElementById('novoUsuarioSetor');
    const inCargoSetor = document.getElementById('novoUsuarioCargoSetor');
    const inDepto = document.getElementById('novoUsuarioDepartamento');
    const inSenha = document.getElementById('novoUsuarioSenha');
    const btnSubmit = document.getElementById('btnSalvarNovoUsuario');

    const nome = inNome ? inNome.value.trim() : '';
    const email = inEmail ? inEmail.value.trim() : '';
    let setorCodigo = inSetor ? inSetor.value.trim().toUpperCase() : '';
    let cargoSetor = inCargoSetor ? inCargoSetor.value.trim().toUpperCase() : '';
    let papel = inRole ? inRole.value.trim().toUpperCase() : '';

    if (setorCodigo && window.OlymposRbac && window.OlymposRbac.SETORES_MAP && window.OlymposRbac.SETORES_MAP[setorCodigo]) {
      papel = window.OlymposRbac.SETORES_MAP[setorCodigo].legacyRole || papel;
    } else if (!setorCodigo && papel && window.OlymposRbac) {
      setorCodigo = window.OlymposRbac.inferirSetorPorRoleLegado(papel);
      cargoSetor = cargoSetor || window.OlymposRbac.inferirCargoPorRoleLegado(papel);
    }
    cargoSetor = cargoSetor || 'MEMBRO';
    if (papel === 'MODERADOR' || setorCodigo === 'MODERADOR' || cargoSetor === 'MODERADOR') {
      exibirFeedbackNovoUsuario('Governança: existe apenas um usuário Moderador único no sistema.', 'erro');
      return;
    }
    const setorInfo = window.OlymposRbac && window.OlymposRbac.SETORES_MAP ? window.OlymposRbac.SETORES_MAP[setorCodigo] : null;
    const departamento = (inDepto ? inDepto.value.trim() : '') || (setorInfo ? setorInfo.nome : 'Secretaria Municipal de Educacao');
    const senha = inSenha ? inSenha.value.trim() : '';

    if (!nome || !email || !papel || !senha) {
      exibirFeedbackNovoUsuario('Preencha todos os campos obrigatórios (*).', 'erro');
      return;
    }

    if (senha.length < 12) {
      exibirFeedbackNovoUsuario('A senha temporária deve conter no mínimo 12 caracteres.', 'erro');
      return;
    }

    if (window.OlymposPasswordSecurity) {
      const comp = window.OlymposPasswordSecurity.validateComplexity(senha);
      if (!comp.valid) {
        exibirFeedbackNovoUsuario(comp.errors[0] || 'A senha não atende aos critérios mínimos de complexidade.', 'erro');
        return;
      }
      exibirFeedbackNovoUsuario('Verificando credencial contra base de vazamentos (k-Anonymity HIBP)...', 'info');
      const hibp = await window.OlymposPasswordSecurity.checkHaveIBeenPwned(senha);
      if (hibp && (hibp.leaked || hibp.pwned)) {
        const totalOcorrencias = hibp.breachCount || hibp.count || 1;
        exibirFeedbackNovoUsuario('Esta senha consta em vazamentos públicos (' + totalOcorrencias + ' ocorrências). Gere outra senha segura.', 'erro');
        return;
      }
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
      setorCodigo: setorCodigo,
      cargoSetor: cargoSetor,
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
        if (window.OlymposViews && window.OlymposViews.configuracoes && typeof window.OlymposViews.configuracoes.carregarUsuarios === 'function') {
          window.OlymposViews.configuracoes.carregarUsuarios();
        }
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

  // =========================================================================
  // RESET DE CACHE PWA E RECARREGAMENTO FORÇADO MOBILE (RELEASE V2.03)
  // =========================================================================
  async function resetMobileApp() {
    try {
      showToast('Iniciando limpeza profunda de cache PWA...');
      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map(function(k) { return window.caches.delete(k); }));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let i = 0; i < registrations.length; i++) {
          await registrations[i].unregister();
        }
      }
      try {
        sessionStorage.clear();
        localStorage.removeItem('olympos_sw_purged_v203');
      } catch (e) {}
      showToast('Cache limpo com sucesso! Recarregando...');
      setTimeout(function() {
        const cleanUrl = window.location.origin + window.location.pathname + '?v=' + Date.now();
        window.location.replace(cleanUrl);
      }, 500);
    } catch (err) {
      console.error('[resetMobileApp] Erro ao resetar:', err);
      showToast('Falha ao resetar cache: ' + err.message, true);
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
    alternarTema: alternarTema,
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
    resetMobileApp: resetMobileApp,
    escapeHtml: escapeHtml,
    hydrateVectorIcons: hydrateVectorIcons,
    bindDynamicControls: bindDynamicControls,
    solicitarMfaObrigatorio: solicitarMfaObrigatorio,
    PUBLIC_PAGES: PUBLIC_PAGES,
    RBAC_TAB_PERMISSIONS: RBAC_TAB_PERMISSIONS,
    ROLE_LABELS: ROLE_LABELS,
    obterLabelPerfilOrganico: obterLabelPerfilOrganico,
    obterRoleIdSessao: obterRoleIdSessao,
    isModerador: isModerador,
    podeEditarMapa: podeEditarMapa,
    podeEditarMemorias: podeEditarMemorias,
    atualizarPerfilProprio: atualizarPerfilProprio,
    abrirModalPerfilUsuario: abrirModalPerfilUsuario,
    fecharModalPerfilUsuario: fecharModalPerfilUsuario,
    aplicarModoVisitanteNaInterface: aplicarModoVisitanteNaInterface,
    aplicarSessaoNaInterface: aplicarSessaoNaInterface,
    aplicarControleAcessoModularEDrive: aplicarControleAcessoModularEDrive,
    fecharModalLogin: fecharModalLogin,
    podeAcessarPagina: podeAcessarPagina,
    getPermitidasSessao: getPermitidasSessao,
    boot: bootOlymposApp
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.OlymposApp && typeof window.OlymposApp.boot === 'function') {
        window.OlymposApp.boot();
      }
    });
  } else if (window.OlymposApp && typeof window.OlymposApp.boot === 'function') {
    window.OlymposApp.boot();
  }
}
