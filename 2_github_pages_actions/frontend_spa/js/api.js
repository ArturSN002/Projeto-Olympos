/**
 * Hub Olympos V2 — Camada Modular de API (Dual-Front: GitHub Pages HTTP + GAS Nativo)
 * Integrado ao Supabase JWT e validação de sessão segura.
 * Versão 2.0.3 — Projeto Olympos (Release V2.03)
 */
window.OlymposApi = (function() {
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbw-zKUdYJO6Zw1_XHo12a49p2wpgNtfii-2CJOq1838f6S1-L0SYM6iI9A2PS2ZPjYdmQ/exec';

  // IDs de implantações antigas/revogadas que retornam HTTP 404 HTML sem cabeçalho CORS
  const REVOKED_DEPLOYMENT_IDS = [
    'AKfycbwM8M-L4QzDmsT3SGSUyuAAwwYri5McqL6HI2AGutVd7ZzXn5mQMfZj1O4eBs-ci2Ub7Q'
  ];

  function isRevokedOrInvalidUrl(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('https://')) return true;
    for (let i = 0; i < REVOKED_DEPLOYMENT_IDS.length; i++) {
      if (url.includes(REVOKED_DEPLOYMENT_IDS[i])) return true;
    }
    return false;
  }

  function sanitizeStoredApiUrl() {
    try {
      const savedA = localStorage.getItem('olympos_api_url');
      const savedB = localStorage.getItem('olympos_gas_api_url');
      if (savedA && isRevokedOrInvalidUrl(savedA)) {
        localStorage.setItem('olympos_api_url', DEFAULT_API_URL);
      }
      if (savedB && isRevokedOrInvalidUrl(savedB)) {
        localStorage.setItem('olympos_gas_api_url', DEFAULT_API_URL);
      }
    } catch (e) {}
  }

  sanitizeStoredApiUrl();

  function getApiUrl() {
    sanitizeStoredApiUrl();
    return localStorage.getItem('olympos_api_url') || localStorage.getItem('olympos_gas_api_url') || DEFAULT_API_URL;
  }

  function setApiUrl(url) {
    if (!url || !url.startsWith('https://')) {
      throw new Error('A URL da API deve começar com https://');
    }
    const clean = isRevokedOrInvalidUrl(url.trim()) ? DEFAULT_API_URL : url.trim();
    localStorage.setItem('olympos_api_url', clean);
    localStorage.setItem('olympos_gas_api_url', clean);
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
      _token: token,
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

    // Frente 2: Execução desacoplada via GitHub Pages / HTTP Fetch
    // Protocolo estrito de CORS Simple Request:
    // 1. Método POST
    // 2. Content-Type: text/plain;charset=utf-8 (evita preflight OPTIONS no GAS)
    // 3. ZERO headers de autorização HTTP (token trafega no corpo JSON)
    // 4. redirect: 'follow' explícito para redirecionamentos do script.googleusercontent.com
    const url = getApiUrl();
    const fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyData),
      redirect: 'follow'
    };

    fetch(url, fetchOpts)
      .catch(function(firstErr) {
        if (url !== DEFAULT_API_URL) {
          try {
            localStorage.setItem('olympos_api_url', DEFAULT_API_URL);
            localStorage.setItem('olympos_gas_api_url', DEFAULT_API_URL);
          } catch (e) {}
          return fetch(DEFAULT_API_URL, fetchOpts);
        }
        throw firstErr;
      })
      .then(function(res) {
        if (!res.ok) {
          throw new Error('Falha HTTP ' + res.status + ': ' + (res.statusText || 'Erro no Gateway'));
        }
        return res.text();
      })
      .then(function(text) {
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Resposta não-JSON do Gateway GAS: ' + (text ? text.substring(0, 100) : 'vazio'));
        }
        processarResposta(data, onSuccess, onError);
      })
      .catch(function(err) {
        console.warn('Erro de rede/Gateway [' + action + ']:', err.message);
        if (onError) onError(err);
      });
  }

  function testarConexao(onResult) {
    const start = performance.now();

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(data) {
          if (typeof onResult === 'function') {
            onResult({
              ok: true,
              latency: Math.round(performance.now() - start),
              data: data || { sistema: 'Hub Olympos GAS Nativo', versao: '2.0.3' }
            });
          }
        })
        .withFailureHandler(function(err) {
          if (typeof onResult === 'function') {
            onResult({ ok: false, error: err.message });
          }
        })
        .executarAcaoHubClient({ action: 'ping', api: '1', token: '' });
      return;
    }

    const url = getApiUrl();
    const token = getJwtToken();
    const pingPayload = {
      action: 'ping',
      api: '1',
      token: token,
      _token: token
    };
    const pingOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(pingPayload),
      redirect: 'follow'
    };

    fetch(url, pingOpts)
      .catch(function(firstErr) {
        if (url !== DEFAULT_API_URL) {
          try {
            localStorage.setItem('olympos_api_url', DEFAULT_API_URL);
            localStorage.setItem('olympos_gas_api_url', DEFAULT_API_URL);
          } catch (e) {}
          return fetch(DEFAULT_API_URL, pingOpts);
        }
        throw firstErr;
      })
      .then(function(res) {
        if (!res.ok) {
          throw new Error('Falha HTTP ' + res.status + ' (' + (res.statusText || 'Offline') + ')');
        }
        return res.text();
      })
      .then(function(text) {
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Resposta HTML ou não-JSON recebida. Verifique a implantação pública do Apps Script.');
        }
        const latency = Math.round(performance.now() - start);
        if (typeof onResult === 'function') {
          onResult({ ok: true, latency: latency, data: data });
        }
      })
      .catch(function(err) {
        if (typeof onResult === 'function') {
          onResult({ ok: false, error: err.message || 'Gateway offline ou inacessível' });
        }
      });
  }

  /**
   * Atualiza o conteúdo Markdown de uma memória existente no Google Drive via Gateway GAS.
   * Modifica in-place sem gerar duplicatas no Drive.
   * @param {string} arquivo Nome do arquivo canônico (ex: _memoria_hera.md).
   * @param {string} conteudo Texto consolidado em Markdown.
   * @param {Function} [onSuccess] Callback de sucesso.
   * @param {Function} [onError] Callback de erro.
   */
  function salvarMemoria(arquivo, conteudo, onSuccess, onError) {
    return chamar('memorias_salvar', {
      arquivo: arquivo,
      conteudo: conteudo
    }, onSuccess, onError);
  }

  /**
   * Provisiona novo usuário administrativo através do Gateway GAS intermediando o Supabase Auth.
   * Suporta tanto padrão assíncrono via Promise quanto callbacks tradicionais (onSuccess, onError).
   * @param {Object} dados Dados cadastrais { email, nome, role, departamento, senhaTemporaria }.
   * @param {Function} [onSuccess] Callback de sucesso.
   * @param {Function} [onError] Callback de erro.
   * @returns {Promise<Object>}
   */
  function criarUsuario(dados, onSuccess, onError) {
    return new Promise(function(resolve, reject) {
      chamar('usuario_criar', { dados: dados }, function(res) {
        if (onSuccess) onSuccess(res);
        resolve(res);
      }, function(err) {
        if (onError) onError(err);
        reject(err);
      });
    });
  }

  return {
    getApiUrl: getApiUrl,
    setApiUrl: setApiUrl,
    DEFAULT_API_URL: DEFAULT_API_URL,
    getSession: getSession,
    getJwtToken: getJwtToken,
    chamar: chamar,
    criarUsuario: criarUsuario,
    salvarMemoria: salvarMemoria,
    testarConexao: testarConexao
  };
})();
