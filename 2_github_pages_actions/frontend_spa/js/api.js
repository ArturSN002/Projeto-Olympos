/**
 * Hub Olympos V2 — Camada Modular de API (Dual-Front: GitHub Pages HTTP + GAS Nativo)
 * Integrado ao Supabase JWT e validação de sessão segura.
 * Versão 2.0.0 — Projeto Olympos
 */
window.OlymposApi = (function() {
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbw-zKUdYJO6Zw1_XHo12a49p2wpgNtfii-2CJOq1838f6S1-L0SYM6iI9A2PS2ZPjYdmQ/exec';

  function getApiUrl() {
    return localStorage.getItem('olympos_api_url') || localStorage.getItem('olympos_gas_api_url') || DEFAULT_API_URL;
  }

  function setApiUrl(url) {
    if (!url || !url.startsWith('https://')) {
      throw new Error('A URL da API deve começar com https://');
    }
    localStorage.setItem('olympos_api_url', url.trim());
    localStorage.setItem('olympos_gas_api_url', url.trim());
  }

  function getSession() {
    try {
      const s = localStorage.getItem('olympos_session');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function getJwtToken() {
    const session = getSession();
    if (session) {
      if (session.access_token) return session.access_token;
      if (session.token) return session.token;
      if (session.session && session.session.access_token) return session.session.access_token;
    }
    return null;
  }

  function processarResposta(data, onSuccess, onError) {
    if (data && data.code === 'AUTH_REQUIRED') {
      if (window.OlymposApp && typeof window.OlymposApp.solicitarLogin === 'function') {
        window.OlymposApp.solicitarLogin();
      }
      if (onError) onError(new Error(data.mensagem || 'Sessão expirada. Faça login novamente via Supabase.'));
      return;
    }
    if (onSuccess) onSuccess(data);
  }

  function chamar(action, payload, onSuccess, onError) {
    const token = getJwtToken();
    const bodyData = Object.assign({}, payload || {}, {
      action: action,
      token: token,
      sessionToken: token,
      jwtToken: token
    });

    // Frente 1: Execução embarcada no Google Apps Script (HtmlService)
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(data) {
          processarResposta(data, onSuccess, onError);
        })
        .withFailureHandler(function(err) {
          console.error('Erro google.script.run [' + action + ']:', err);
          if (onError) onError(err);
        })
        .executarAcaoHubClient(bodyData);
      return;
    }

    // Frente 2: Execução desacoplada via GitHub Pages / HTTP Fetch (CORS-safe text/plain)
    const url = getApiUrl();
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyData)
    })
      .then(function(res) {
        if (!res.ok) {
          throw new Error('Falha HTTP ' + res.status + ': ' + res.statusText);
        }
        return res.json();
      })
      .then(function(data) {
        processarResposta(data, onSuccess, onError);
      })
      .catch(function(err) {
        console.error('Erro HTTP [' + action + ']:', err);
        if (onError) onError(err);
      });
  }

  function testarConexao(onResult) {
    const start = performance.now();

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function() {
          onResult({
            ok: true,
            latency: Math.round(performance.now() - start),
            data: { sistema: 'Hub Olympos GAS Nativo', versao: '2.1.0' }
          });
        })
        .withFailureHandler(function(err) {
          onResult({ ok: false, error: err.message });
        })
        .executarAcaoHubClient({ action: 'auth_check', token: '' });
      return;
    }

    const url = getApiUrl();
    const testEndpoint = url + (url.includes('?') ? '&' : '?') + 'api=1';

    fetch(testEndpoint)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        const latency = Math.round(performance.now() - start);
        onResult({ ok: true, latency: latency, data: data });
      })
      .catch(function(err) {
        onResult({ ok: false, error: err.message });
      });
  }

  return {
    getApiUrl: getApiUrl,
    setApiUrl: setApiUrl,
    DEFAULT_API_URL: DEFAULT_API_URL,
    getSession: getSession,
    getJwtToken: getJwtToken,
    chamar: chamar,
    testarConexao: testarConexao
  };
})();
