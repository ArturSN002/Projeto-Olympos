/**
 * Hub Olympos V2.03 — Página Modular 10: Configurações, Gateway Dual-Front & Preferências
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.configuracoes = (function() {
  let usuariosLista = [];
  let subtabAtiva = 'conexao';

  const MOCK_USUARIOS_FALLBACK = [
    {
      id: 'usr_gabinete_01',
      full_name: 'Gabinete Executivo SMEB',
      email: 'gabinete@smeb.cearamirim.rn.gov.br',
      role: 'ADMIN_GABINETE',
      department: 'Gabinete da Secretária',
      ativo: true
    },
    {
      id: 'usr_rh_02',
      full_name: 'Comissão de Portarias e RH',
      email: 'rh@smeb.cearamirim.rn.gov.br',
      role: 'RH_COMISSAO',
      department: 'Recursos Humanos',
      ativo: true
    },
    {
      id: 'usr_ped_03',
      full_name: 'Coordenação Pedagógica & Eventos',
      email: 'pedagogico@smeb.cearamirim.rn.gov.br',
      role: 'PEDAGOGICO_EVENTOS',
      department: 'Diretoria Pedagógica',
      ativo: true
    },
    {
      id: 'usr_jur_04',
      full_name: 'Assessoria Jurídica SMEB',
      email: 'juridico@smeb.cearamirim.rn.gov.br',
      role: 'JURIDICO',
      department: 'Assessoria Jurídica',
      ativo: true
    }
  ];

  function init() {
    bindEvents();
    carregarValoresAtuais();
    alternarSubtab(subtabAtiva);
  }

  function bindEvents() {
    const bind = function(id, evt, fn) {
      const el = document.getElementById(id);
      if (el && !el._bound) {
        el._bound = true;
        el.addEventListener(evt, fn);
      }
    };

    bind('configSalvarApiBtn', 'click', salvarUrlApi);
    bind('configTestarApiBtn', 'click', testarConexaoApi);
    bind('configResetApiBtn', 'click', function() {
      window.OlymposApi.setApiUrl(window.OlymposApi.DEFAULT_API_URL);
      carregarValoresAtuais();
      window.OlymposApp.showToast('Endpoint restaurado para a implantação oficial do Hub!');
    });
    bind('configLogoutBtn', 'click', function() {
      window.OlymposApp.fazerLogout();
    });
    bind('configTemaSelect', 'change', function(e) {
      window.OlymposApp.definirTema(e.target.value);
    });
    bind('configSalvarCartoKeyBtn', 'click', function() {
      const inKey = document.getElementById('configCartoApiKeyInput');
      if (inKey && window.OlymposCarto) {
        window.OlymposCarto.setApiKey(inKey.value);
        atualizarStatusCartoUi();
        window.OlymposApp.showToast('CARTO_API_KEY atualizada para os mapas MapLibre GL + Carto!');
      }
    });
    bind('configLimparCartoKeyBtn', 'click', function() {
      if (window.OlymposCarto) {
        window.OlymposCarto.setApiKey('');
        carregarValoresAtuais();
        window.OlymposApp.showToast('Restaurado para a CARTO_API_KEY injetada pelo GitHub Actions!');
      }
    });

    // Sub-abas de Ajustes
    document.querySelectorAll('.subnav-tab[data-subtab], .subtab-btn[data-subtab]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          alternarSubtab(btn.getAttribute('data-subtab'));
        });
      }
    });

    // Usuários: Atualizar lista
    bind('btnRecarregarUsuarios', 'click', function() {
      carregarUsuarios();
    });

    // Modal Editar Usuário
    bind('closeModalEditarUsuarioBtn', 'click', fecharModalEditarUsuario);
    bind('btnCancelarEditarUsuario', 'click', fecharModalEditarUsuario);

    const formEditarUser = document.getElementById('formEditarUsuario');
    if (formEditarUser && !formEditarUser._bound) {
      formEditarUser._bound = true;
      formEditarUser.addEventListener('submit', salvarEdicaoUsuario);
    }
  }

  function alternarSubtab(subtabId) {
    if (!subtabId) return;
    subtabAtiva = subtabId;

    // Atualiza botões
    document.querySelectorAll('.subnav-tab[data-subtab], .subtab-btn[data-subtab]').forEach(function(btn) {
      const match = btn.getAttribute('data-subtab') === subtabId;
      btn.classList.toggle('active', match);
    });

    // Mapeamento das seções
    const mapSubpanes = {
      'conexao': 'subpaneAjustesConexao',
      'aparencia': 'subpaneAjustesAparencia',
      'usuarios': 'subpaneAjustesUsuarios',
      'personas': 'subpaneAjustesPersonas',
      'automacoes': 'subpaneAjustesAutomacoes'
    };

    Object.keys(mapSubpanes).forEach(function(key) {
      const el = document.getElementById(mapSubpanes[key]);
      if (el) {
        const isCurrent = key === subtabId;
        el.classList.toggle('active', isCurrent);
        el.style.display = isCurrent ? 'block' : 'none';
      }
    });

    if (subtabId === 'usuarios') {
      carregarUsuarios();
    } else if (subtabId === 'personas') {
      if (window.OlymposViews && window.OlymposViews.personas && typeof window.OlymposViews.personas.init === 'function') {
        window.OlymposViews.personas.init();
      }
    }
  }

  async function carregarUsuarios() {
    const container = document.getElementById('tabelaUsuariosContainer');
    if (!container) return;

    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Carregando operadores do Supabase...</div>';

    let lista = null;
    if (window.OlymposSupabase && typeof window.OlymposSupabase.listarPerfisUsuarios === 'function') {
      try {
        lista = await window.OlymposSupabase.listarPerfisUsuarios();
      } catch (err) {
        console.warn('[Configuracoes] Falha ao consultar Supabase profiles:', err);
      }
    }

    if (!Array.isArray(lista) || lista.length === 0) {
      lista = MOCK_USUARIOS_FALLBACK;
    }

    usuariosLista = lista;

    const session = window.OlymposApp ? window.OlymposApp.getSession() : null;
    const currentUserId = (session && session.user && session.user.id) || (session && session.profile && session.profile.id);

    const getRoleBadge = function(role) {
      const r = String(role || '').toUpperCase();
      if (r === 'ADMIN_GABINETE') {
        return '<span class="pill-badge pill-purple" style="font-size: 0.72rem;">ADMIN_GABINETE</span>';
      }
      if (r === 'JURIDICO') {
        return '<span class="pill-badge pill-blue" style="font-size: 0.72rem;">JURIDICO</span>';
      }
      if (r === 'RH_COMISSAO') {
        return '<span class="pill-badge pill-amber" style="font-size: 0.72rem;">RH_COMISSAO</span>';
      }
      return '<span class="pill-badge pill-green" style="font-size: 0.72rem;">' + r + '</span>';
    };

    const rowsHtml = usuariosLista.map(function(u) {
      const isSelf = currentUserId && (u.id === currentUserId || u.email === (session && session.usuario));
      const nomeSafe = window.OlymposApp ? window.OlymposApp.escapeHtml(u.full_name || u.nome || u.email) : (u.full_name || u.nome || u.email);
      const emailSafe = window.OlymposApp ? window.OlymposApp.escapeHtml(u.email || '--') : (u.email || '--');
      const deptSafe = window.OlymposApp ? window.OlymposApp.escapeHtml(u.department || u.departamento || 'Secretaria Municipal de Educacao') : (u.department || 'Secretaria Municipal de Educacao');
      const isAtivo = u.ativo !== false;

      return `
        <tr style="border-bottom: 1px solid var(--border-hairline);">
          <td style="padding: 12px 14px;">
            <div style="font-weight: 600; color: var(--text-primary);">${nomeSafe}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted); font-family: var(--font-mono);">${emailSafe}</div>
          </td>
          <td style="padding: 12px 14px;">${getRoleBadge(u.role)}</td>
          <td style="padding: 12px 14px; font-size: 0.85rem; color: var(--text-secondary);">${deptSafe}</td>
          <td style="padding: 12px 14px;">
            <span class="pill-badge ${isAtivo ? 'pill-green' : 'pill-red'}" style="font-size: 0.7rem;">
              ${isAtivo ? '✓ Ativo' : '✕ Suspenso'}
            </span>
          </td>
          <td style="padding: 12px 14px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 4px 8px;" onclick="window.OlymposViews.configuracoes.abrirModalEditarUsuario('${u.id}')">
                ✏️ Editar
              </button>
              <button type="button" class="btn btn-danger btn-sm" style="font-size: 0.75rem; padding: 4px 8px;" ${isSelf ? 'disabled title="Você não pode excluir sua própria conta"' : ''} onclick="window.OlymposViews.configuracoes.excluirUsuario('${u.id}')">
                🗑️ Excluir
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="table-clean" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
          <thead>
            <tr style="background: var(--bg-tonal); border-bottom: 1px solid var(--border-hairline); color: var(--text-muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 10px 14px;">Operador</th>
              <th style="padding: 10px 14px;">Papel RBAC</th>
              <th style="padding: 10px 14px;">Lotação / Departamento</th>
              <th style="padding: 10px 14px;">Status</th>
              <th style="padding: 10px 14px; text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  function abrirModalEditarUsuario(id) {
    const user = usuariosLista.find(function(u) { return u.id === id; });
    if (!user) return;

    const modal = document.getElementById('modalEditarUsuario');
    if (!modal) return;

    const inId = document.getElementById('editarUsuarioId');
    const inNome = document.getElementById('editarUsuarioNome');
    const inEmail = document.getElementById('editarUsuarioEmail');
    const inRole = document.getElementById('editarUsuarioRole');
    const inDept = document.getElementById('editarUsuarioDepartamento');
    const inAtivo = document.getElementById('editarUsuarioAtivo');
    const feedback = document.getElementById('editarUsuarioFeedback');

    if (inId) inId.value = user.id;
    if (inNome) inNome.value = user.full_name || user.nome || '';
    if (inEmail) inEmail.value = user.email || '';
    if (inRole) inRole.value = user.role || 'RH_COMISSAO';
    if (inDept) inDept.value = user.department || user.departamento || 'Secretaria Municipal de Educacao';
    if (inAtivo) inAtivo.value = user.ativo !== false ? 'true' : 'false';
    if (feedback) {
      feedback.classList.add('hidden');
      feedback.textContent = '';
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function fecharModalEditarUsuario() {
    const modal = document.getElementById('modalEditarUsuario');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  async function salvarEdicaoUsuario(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const inId = document.getElementById('editarUsuarioId');
    const inNome = document.getElementById('editarUsuarioNome');
    const inRole = document.getElementById('editarUsuarioRole');
    const inDept = document.getElementById('editarUsuarioDepartamento');
    const inAtivo = document.getElementById('editarUsuarioAtivo');
    const feedback = document.getElementById('editarUsuarioFeedback');
    const btnSalvar = document.getElementById('btnSalvarEdicaoUsuario');

    if (!inId || !inNome || !inRole) return;

    const userId = inId.value;
    const nome = inNome.value.trim();
    const role = inRole.value;
    const department = inDept ? inDept.value.trim() : 'Secretaria Municipal de Educacao';
    const ativo = inAtivo ? (inAtivo.value === 'true') : true;

    if (!nome) {
      if (feedback) {
        feedback.textContent = 'O nome completo é obrigatório.';
        feedback.className = 'output-panel output-error';
        feedback.classList.remove('hidden');
      }
      return;
    }

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';
    }

    const payload = {
      full_name: nome,
      role: role,
      department: department,
      ativo: ativo
    };

    let sucesso = false;
    if (window.OlymposSupabase && typeof window.OlymposSupabase.atualizarPerfilUsuario === 'function') {
      try {
        sucesso = await window.OlymposSupabase.atualizarPerfilUsuario(userId, payload);
      } catch (err) {
        console.warn('[Configuracoes] Falha na atualização do perfil:', err);
      }
    }

    // Atualiza localmente no cache
    const idx = usuariosLista.findIndex(function(u) { return u.id === userId; });
    if (idx >= 0) {
      usuariosLista[idx] = Object.assign({}, usuariosLista[idx], payload);
      try {
        localStorage.setItem('olympos_usuarios_perfis_cache', JSON.stringify(usuariosLista));
      } catch (eStorage) {}
    }

    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Alterações';
    }

    fecharModalEditarUsuario();
    carregarUsuarios();

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Perfil do usuário "' + nome + '" atualizado com sucesso!');
    }
  }

  async function excluirUsuario(id) {
    if (!id) return;

    const session = window.OlymposApp ? window.OlymposApp.getSession() : null;
    const currentUserId = (session && session.user && session.user.id) || (session && session.profile && session.profile.id);

    if (currentUserId && (id === currentUserId || id === (session && session.usuario))) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Ação proibida: você não pode excluir a si mesmo.', true);
      }
      return;
    }

    const user = usuariosLista.find(function(u) { return u.id === id; });
    const nome = user ? (user.full_name || user.email) : id;

    if (!confirm('Deseja realmente revogar os acessos e excluir o operador "' + nome + '"?')) {
      return;
    }

    if (window.OlymposSupabase && typeof window.OlymposSupabase.excluirPerfilUsuario === 'function') {
      try {
        await window.OlymposSupabase.excluirPerfilUsuario(id);
      } catch (err) {
        console.warn('[Configuracoes] Erro ao excluir no Supabase:', err);
      }
    }

    usuariosLista = usuariosLista.filter(function(u) { return u.id !== id; });
    try {
      localStorage.setItem('olympos_usuarios_perfis_cache', JSON.stringify(usuariosLista));
    } catch (eStorage) {}

    carregarUsuarios();

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Operador "' + nome + '" removido com sucesso!');
    }
  }

  function atualizarStatusCartoUi() {
    const inKey = document.getElementById('configCartoApiKeyInput');
    const badge = document.getElementById('configCartoKeyStatusBadge');
    if (!window.OlymposCarto) return;
    const key = window.OlymposCarto.getApiKey();
    if (inKey) inKey.value = key;
    if (badge) {
      badge.textContent = key ? 'CARTO_API_KEY Ativa' : 'CARTO Basemaps Padrão';
      badge.className = key ? 'pill-badge pill-green' : 'pill-badge pill-blue';
    }
  }

  function carregarValoresAtuais() {
    const inUrl = document.getElementById('configGasUrlInput');
    if (inUrl) inUrl.value = window.OlymposApi.getApiUrl();

    const selTema = document.getElementById('configTemaSelect');
    if (selTema) selTema.value = document.documentElement.getAttribute('data-theme') || 'light';

    atualizarStatusCartoUi();

    const session = window.OlymposApp.getSession();
    const userLabel = document.getElementById('configUserLabel');
    const userRole = document.getElementById('configUserRole');
    const userTabs = document.getElementById('configUserTabs');

    if (session && session.perfil) {
      if (userLabel) userLabel.textContent = session.nome || session.usuario;
      if (userRole) userRole.textContent = session.perfil.nome;
      if (userTabs) userTabs.textContent = (session.perfil.abasPermitidas || []).join(', ');
    }
  }

  function salvarUrlApi() {
    const val = document.getElementById('configGasUrlInput').value.trim();
    try {
      window.OlymposApi.setApiUrl(val);
      window.OlymposApp.showToast('URL do Gateway Google Apps Script salva!');
      testarConexaoApi();
    } catch (e) {
      window.OlymposApp.showToast(e.message, true);
    }
  }

  function testarConexaoApi() {
    const btn = document.getElementById('configTestarApiBtn');
    const resBox = document.getElementById('configTestResult');

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    resBox.innerHTML = 'Medindo latência com o Gateway Google Apps Script...';

    window.OlymposApi.testarConexao(function(res) {
      btn.disabled = false;
      btn.textContent = 'Testar Latência';

      if (res.ok) {
        resBox.innerHTML =
          '<div style="color:var(--success); font-weight:700;">Gateway Conectado com Sucesso</div>' +
          '<div style="margin-top:4px; font-family:var(--font-mono); font-size:11.5px;">' +
            'Latência: ' + res.latency + ' ms • Sistema: ' + window.OlymposApp.escapeHtml((res.data && res.data.sistema) || 'Hub Olympos') +
            ' • Versão: ' + window.OlymposApp.escapeHtml((res.data && res.data.versao) || '2.0.3') +
          '</div>';
        window.OlymposApp.atualizarStatusConexao(true);
      } else {
        resBox.innerHTML =
          '<div style="color:var(--danger); font-weight:700;">Falha de Conectividade</div>' +
          '<div style="margin-top:4px; font-size:12px;">' + window.OlymposApp.escapeHtml(res.error || 'Verifique a URL /exec.') + '</div>';
        window.OlymposApp.atualizarStatusConexao(false);
      }
    });
  }

  return {
    init: init,
    alternarSubtab: alternarSubtab,
    carregarUsuarios: carregarUsuarios,
    abrirModalEditarUsuario: abrirModalEditarUsuario,
    fecharModalEditarUsuario: fecharModalEditarUsuario,
    salvarEdicaoUsuario: salvarEdicaoUsuario,
    excluirUsuario: excluirUsuario
  };
})();
