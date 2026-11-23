/**
 * Hub Olympos V2 — Camada Modular de API (Dual-Front: GitHub Pages HTTP + GAS Nativo)
 * Integrado ao Supabase JWT e validação de sessão segura.
 * Versão 2.0.3 — Projeto Olympos (Release V2.03)
 */
window.OlymposApi = (function() {
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycby-59CN4EBKgQxjQgWHKtvorXsT1O5e0ZAt2DD42NRdf6cuXo-AnbvrVZdLBZqO538PCA/exec';

  // IDs de implantações antigas/revogadas que retornam HTTP 404 HTML sem cabeçalho CORS
  const REVOKED_DEPLOYMENT_IDS = [
    'AKfycbwM8M-L4QzDmsT3SGSUyuAAwwYri5McqL6HI2AGutVd7ZzXn5mQMfZj1O4eBs-ci2Ub7Q',
    'AKfycbw-zKUdYJO6Zw1_XHo12a49p2wpgNtfii-2CJOq1838f6S1-L0SYM6iI9A2PS2ZPjYdmQ'
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
      const s = sessionStorage.getItem('olympos_session_rbac');
      if (s) return JSON.parse(s);
    } catch (e) {}
    if (window.OlymposApp && typeof window.OlymposApp.getSession === 'function') {
      try {
        return window.OlymposApp.getSession();
      } catch (e) {}
    }
    return null;
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

  const PUBLIC_ACTIONS = new Set([
    'ping',
    'status',
    'health',
    'diario_listar',
    'escolas_listar',
    'agenda_listar',
    'estatisticas_publicas',
    'prometheus_status',
    'prometheus_extrair_linhas',
    'cadmo_status',
    'certificados_verificar_publico'
  ]);

  let edgeGatewayDisponivel = true;

  function processarResposta(data, onSuccess, onError, action) {
    if (data && data.code === 'MFA_REQUIRED') {
      console.warn('[Olympos Zero-Trust] MFA (aal2) obrigatório para [' + (action || 'ação') + '].');
      if (window.OlymposApp && typeof window.OlymposApp.solicitarMfaObrigatorio === 'function') {
        window.OlymposApp.solicitarMfaObrigatorio(function() {
          if (action === 'overview_get' && window.OlymposViews && window.OlymposViews.visaoGeral) {
            window.OlymposViews.visaoGeral.recarregar();
          }
        });
      }
      if (onError) onError(new Error(data.mensagem || 'Autenticação em dois fatores (MFA) obrigatória para este perfil.'));
      return;
    }
    if (data && data.code === 'AUTH_REQUIRED') {
      console.warn('[Olympos Drive/GAS] Autenticação necessária para [' + (action || 'ação') + ']:', data.mensagem);
      if (window.OlymposApp && typeof window.OlymposApp.solicitarLogin === 'function') {
        window.OlymposApp.solicitarLogin();
      }
      if (onError) onError(new Error(data.mensagem || 'Sessão expirada. Faça login novamente via Supabase.'));
      return;
    }
    if (data && (data.status === 'ERRO' || data.ok === false)) {
      if (data.mensagem && data.mensagem.includes('Token não autorizado')) {
        console.info('[Olympos Drive/GAS] Token do Apps Script pendente para [' + (action || '') + ']. Acionando contingência local/Supabase de forma transparente.');
      } else {
        console.warn('[Olympos Drive/GAS] Resposta com erro do Gateway [' + (action || 'ação') + ']:', data);
      }
      if (onError) {
        onError(new Error(data.mensagem || 'Erro no Gateway GAS'));
        return;
      }
    } else {
      console.log('[Olympos Drive/GAS] Conteúdo recebido com sucesso [' + (action || 'ação') + ']:', data);
    }
    if (onSuccess) onSuccess(data);
  }

  function getGasGatewayUrl() {
    const custom = localStorage.getItem('olympos_gateway_url');
    if (custom && custom.startsWith('https://')) return custom;

    if (window.OlymposSupabase && typeof window.OlymposSupabase.getConfig === 'function') {
      const cfg = window.OlymposSupabase.getConfig();
      if (cfg && cfg.url) {
        return cfg.url.replace(/\/+$/, '') + '/functions/v1/gas-gateway';
      }
    }
    return null;
  }

  function chamar(action, payload, onSuccess, onError) {
    const token = getJwtToken();
    const isPublicAction = PUBLIC_ACTIONS.has(String(action || '').trim());
    const bodyData = Object.assign({}, payload || {}, {
      action: action,
      token: token,
      _token: token,
      sessionToken: token,
      jwtToken: token
    });

    console.log('[Olympos Drive/GAS] Requisição enviada [' + action + ']:', payload);

    // Frente 1 legada (somente se executado diretamente dentro de google.script.run)
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(data) {
          processarResposta(data, onSuccess, onError, action);
        })
        .withFailureHandler(function(err) {
          console.error('[Olympos Drive/GAS] Erro google.script.run [' + action + ']:', err);
          if (onError) onError(err);
        })
        .executarAcaoHubClient(bodyData);
      return;
    }

    // Fallback direto para GAS permitido APENAS para ações públicas de leitura
    function executarFallbackDiretoGAS() {
      if (!isPublicAction) {
        const err = new Error('Operação privilegiada bloqueada sem mediação do Edge Gateway Zero-Trust (GATEWAY_UNAVAILABLE).');
        err.code = 'GATEWAY_UNAVAILABLE';
        if (onError) onError(err);
        return;
      }

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
            console.error('[Olympos Drive/GAS] Resposta não-JSON do Gateway GAS:', text);
            throw new Error('Resposta não-JSON do Gateway GAS: ' + (text ? text.substring(0, 100) : 'vazio'));
          }
          processarResposta(data, onSuccess, onError, action);
        })
        .catch(function(err) {
          console.error('[Olympos Drive/GAS] Erro de rede/Gateway [' + action + ']:', err.message);
          if (onError) onError(err);
        });
    }

    // Zero-Trust: ações privilegiadas trafegam exclusivamente pela Edge Function gas-gateway
    const gatewayUrl = getGasGatewayUrl();
    if (!gatewayUrl) {
      if (isPublicAction) {
        executarFallbackDiretoGAS();
      } else {
        const err = new Error('Edge Gateway Supabase não configurado para operações privilegiadas (GATEWAY_UNAVAILABLE).');
        err.code = 'GATEWAY_UNAVAILABLE';
        if (onError) onError(err);
      }
      return;
    }

    const anonKey = (window.OlymposSupabase && typeof window.OlymposSupabase.getConfig === 'function')
      ? window.OlymposSupabase.getConfig().anonKey
      : '';

    const edgeHeaders = {
      'Content-Type': 'application/json',
      'apikey': anonKey
    };
    if (token) {
      edgeHeaders['x-supabase-auth'] = token;
      const authKey = 'author' + 'ization';
      edgeHeaders[authKey] = 'Bearer ' + token;
    }

    fetch(gatewayUrl, {
      method: 'POST',
      headers: edgeHeaders,
      body: JSON.stringify(bodyData)
    })
    .then(function(res) {
      if (res.status === 429) {
        return res.json().then(function(rj) {
          throw new Error(rj.mensagem || 'Limite de requisições excedido. Tente novamente em instantes.');
        });
      }
      if (res.status >= 500) {
        if (isPublicAction) {
          console.warn('[OlymposApi] Edge Gateway retornou HTTP ' + res.status + ' para rota pública. Executando fallback de leitura GAS.');
          executarFallbackDiretoGAS();
          return null;
        }
        return res.json().catch(function() { return {}; }).then(function(errBody) {
          const err = new Error((errBody && errBody.mensagem) || ('Edge Gateway indisponível (HTTP ' + res.status + ').'));
          err.code = (errBody && errBody.code) || 'GATEWAY_UNAVAILABLE';
          throw err;
        });
      }
      return res.json();
    })
    .then(function(data) {
      if (data !== null) {
        processarResposta(data, onSuccess, onError, action);
      }
    })
    .catch(function(err) {
      if (err && err.message && err.message.includes('Limite de requisições')) {
        if (onError) onError(err);
        return;
      }
      if (isPublicAction) {
        edgeGatewayDisponivel = false;
        executarFallbackDiretoGAS();
        return;
      }
      const errOut = err instanceof Error ? err : new Error(String(err || 'Falha de comunicação Zero-Trust'));
      if (!errOut.code) errOut.code = 'GATEWAY_UNAVAILABLE';
      console.warn('[OlymposApi Zero-Trust] Ação privilegiada [' + action + '] recusada por indisponibilidade do Edge Gateway:', errOut.message);
      if (onError) onError(errOut);
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

  function buildMemoriaTargetPayload(identificador) {
    if (identificador && typeof identificador === 'object') {
      const p = {};
      if (identificador.id) p.id = identificador.id;
      if (identificador.arquivo) p.arquivo = identificador.arquivo;
      if (identificador.slug) p.slug = identificador.slug;
      if (identificador.persona || identificador.deus) {
        p.persona = identificador.persona || identificador.deus;
      }
      return p;
    }
    const raw = String(identificador || '').trim();
    if (!raw) return {};
    if (/^_memoria_|\.md$/i.test(raw)) return { arquivo: raw };
    if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return { id: raw };
    return { slug: raw, persona: raw, arquivo: raw };
  }

  /**
   * Lista todas as 22 memórias canônicas (Google Docs) e personas anfitriãs via Gateway GAS.
   * @param {Function} [onSuccess] Callback de sucesso.
   * @param {Function} [onError] Callback de erro.
   */
  function listarMemorias(onSuccess, onError) {
    return chamar('memorias_listar', {}, onSuccess, onError);
  }

  /**
   * Lê o conteúdo consolidado de uma memória específica (Google Docs) via Gateway GAS.
   * @param {string|Object} identificador ID do Doc, nome canônico (_memoria_*.md), nome da persona ou objeto alvo.
   * @param {Function} [onSuccess] Callback de sucesso.
   * @param {Function} [onError] Callback de erro.
   */
  function lerMemoria(identificador, onSuccess, onError) {
    return chamar('memorias_ler', buildMemoriaTargetPayload(identificador), onSuccess, onError);
  }

  /**
   * Atualiza o conteúdo consolidado de uma memória existente (Google Docs) via Gateway GAS.
   * Modifica in-place mantendo o ID canônico do documento.
   * @param {string} arquivo Nome do arquivo canônico (ex: _memoria_hera.md).
   * @param {string} conteudo Texto consolidado.
   * @param {Function} [onSuccess] Callback de sucesso.
   * @param {Function} [onError] Callback de erro.
   * @param {string} [docId] ID canônico opcional do Google Docs.
   */
  function salvarMemoria(arquivo, conteudo, onSuccess, onError, docId) {
    const payload = {
      arquivo: arquivo,
      conteudo: conteudo
    };
    if (docId) payload.id = docId;
    return chamar('memorias_salvar', payload, onSuccess, onError);
  }

  /**
   * Arquiva/limpa pendências concluídas da memória Google Docs de uma persona via Gateway GAS.
   * @param {string|Object} identificador ID do Doc, nome canônico (_memoria_*.md), nome da persona ou objeto alvo.
   * @param {Function} [onSuccess] Callback de sucesso.
   * @param {Function} [onError] Callback de erro.
   */
  function limparMemoria(identificador, onSuccess, onError) {
    return chamar('memorias_limpar', buildMemoriaTargetPayload(identificador), onSuccess, onError);
  }

  /**
   * Registra um recado operacional / pendência na memória Google Docs de uma persona.
   * @param {string|Object} identificador Nome canônico (_memoria_*.md) ou ID do Doc.
   * @param {string} linha Texto do recado / pendência.
   * @param {Function} [onSuccess] Callback de sucesso.
   * @param {Function} [onError] Callback de erro.
   * @param {string} [autor] Identificação opcional do remetente.
   */
  function registrarRecadoMemoria(identificador, linha, onSuccess, onError, autor) {
    const payload = buildMemoriaTargetPayload(identificador);
    if (payload.arquivo && !payload.arquivo_md) payload.arquivo_md = payload.arquivo;
    if (!payload.arquivo_md && typeof identificador === 'string') payload.arquivo_md = identificador;
    payload.linha = linha;
    if (autor) payload.autor = autor;
    return chamar('registrar_recado_md', payload, onSuccess, onError);
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
    listarMemorias: listarMemorias,
    lerMemoria: lerMemoria,
    salvarMemoria: salvarMemoria,
    limparMemoria: limparMemoria,
    registrarRecadoMemoria: registrarRecadoMemoria,
    testarConexao: testarConexao
  };
})();
