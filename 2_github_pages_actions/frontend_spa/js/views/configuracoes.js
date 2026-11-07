/**
 * Hub Olympos V2.03 — Página Modular 10: Configurações, Gateway Dual-Front & Preferências
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.configuracoes = (function() {
  function init() {
    bindEvents();
    carregarValoresAtuais();
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
  }

  function carregarValoresAtuais() {
    const inUrl = document.getElementById('configGasUrlInput');
    if (inUrl) inUrl.value = window.OlymposApi.getApiUrl();

    const selTema = document.getElementById('configTemaSelect');
    if (selTema) selTema.value = document.documentElement.getAttribute('data-theme') || 'light';

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
    init: init
  };
})();
