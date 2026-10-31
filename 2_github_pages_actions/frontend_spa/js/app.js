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
    const stored = localStorage.getItem('olympos_session');
    if (stored) {
      try {
        currentUserSession = JSON.parse(stored);
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
    const userInput = document.getElementById('loginUserInput').value.trim();
    const passInput = document.getElementById('loginPasswordInput').value.trim();
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
    currentUserSession = null;
    showToast('Sessão encerrada.');
    solicitarLogin();
  }

  function normalizarPermissoesRbac(listaBruta) {
    const set = new Set(['visao-geral', 'configuracoes', 'personas', 'busca']);
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
      if (permitidas.includes(pageTarget) || permitidas.includes('TODOS')) {
        link.classList.remove('hidden');
      } else {
        link.classList.add('hidden');
      }
    });
  }

  function getSession() {
    return currentUserSession;
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
        e.preventDefault();
        const page = link.getAttribute('data-page');
        window.OlymposRouter.navegarPara(page);
      });
    });

    document.querySelectorAll('[data-nav-target]').forEach(function(el) {
      el.addEventListener('click', function() {
        const target = el.getAttribute('data-nav-target');
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
    document.getElementById('modalMemoriaTitle').textContent = memoriaObj.deus + ' — ' + memoriaObj.arquivo;
    const ta = document.getElementById('modalMemoriaTextarea');
    ta.value = memoriaObj.conteudoCompleto || '';

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
    const btn = document.getElementById('saveMemoriaBtn');

    btn.disabled = true;
    btn.textContent = 'Salvando no Drive...';

    window.OlymposApi.chamar('memorias_salvar', {
      arquivo: activeMemoriaEditando.arquivo,
      conteudo: novoConteudo
    }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Salvar no Arquivo Existente';

      if (res && res.ok) {
        showToast('Memória ' + activeMemoriaEditando.arquivo + ' atualizada sem criar duplicatas!');
        document.getElementById('memoriaModal').classList.add('hidden');
        if (window.OlymposViews && window.OlymposViews.personas) {
          window.OlymposViews.personas.recarregar();
        }
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        showToast((res && res.mensagem) || 'Falha ao salvar memória.', true);
      }
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Salvar no Arquivo Existente';
      showToast('Erro ao salvar memória: ' + err.message, true);
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
    copiarTexto(el.textContent.trim(), rotulo);
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

  return {
    showToast: showToast,
    copiarTexto: copiarTexto,
    copiarKpi: copiarKpi,
    renderizarItensLinksGerados: renderizarItensLinksGerados,
    abrirModalContadores: abrirModalContadores,
    abrirModalMemoria: abrirModalMemoria,
    solicitarLogin: solicitarLogin,
    handleLoginSubmit: handleLoginSubmit,
    fazerLogout: fazerLogout,
    definirTema: definirTema,
    atualizarStatusConexao: atualizarStatusConexao,
    getSession: getSession,
    escapeHtml: escapeHtml
  };
})();
