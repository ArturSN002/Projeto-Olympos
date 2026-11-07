/**
 * @fileoverview Modal Simplificado de Configuração do Supabase (Chave Pública Única).
 * Solicita exclusivamente a Chave Pública (Anon Key) do Supabase, derivando automaticamente
 * a URL do projeto a partir do payload JWT (`ref`/`iss`) e vinculando o Gateway GAS canônico
 * sem exigir URLs manuais do operador.
 * Versão 2.1.0 — Projeto Olympos
 */

window.OlymposSetupModal = (function() {
  const FALLBACK_SUPABASE_URL = 'https://rbwizevjvbvjwtbwwyif.supabase.co';

  function getElements() {
    return {
      modal: document.getElementById('supabaseSetupModal'),
      form: document.getElementById('supabaseSetupForm'),
      inputUrl: document.getElementById('setupSupabaseUrl'),
      inputKey: document.getElementById('setupSupabaseAnonKey'),
      detectedBadge: document.getElementById('setupModalDetectedInfo'),
      btnTest: document.getElementById('testSupabaseConnectionBtn'),
      btnClose: document.getElementById('closeSetupModalBtn'),
      feedback: document.getElementById('setupModalFeedback')
    };
  }

  function normalizeUrl(rawUrl) {
    return String(rawUrl || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/(rest|auth)\/v1(\/.*)?$/i, '');
  }

  function extrairUrlLocalDaChave(rawKey) {
    if (window.OlymposSupabase && typeof window.OlymposSupabase.extrairUrlSupabaseDaChave === 'function') {
      return window.OlymposSupabase.extrairUrlSupabaseDaChave(rawKey);
    }
    const k = String(rawKey || '').trim();
    const parts = k.split('.');
    if (parts.length !== 3) return null;
    try {
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      const payload = JSON.parse(atob(b64));
      if (payload && typeof payload.ref === 'string' && /^[a-z0-9]{15,35}$/i.test(payload.ref.trim())) {
        return 'https://' + payload.ref.trim().toLowerCase() + '.supabase.co';
      }
      if (payload && typeof payload.iss === 'string' && payload.iss.startsWith('https://')) {
        return normalizeUrl(payload.iss);
      }
    } catch (e) {}
    return null;
  }

  function resolverUrlAutomatica(rawKey) {
    const derived = extrairUrlLocalDaChave(rawKey);
    if (derived) return derived;
    const saved = normalizeUrl(localStorage.getItem('olympos_supabase_url') || '');
    if (saved && saved.startsWith('https://')) return saved;
    if (window.OlymposSupabase && window.OlymposSupabase.DEFAULT_PUBLIC_SUPABASE_URL) {
      return window.OlymposSupabase.DEFAULT_PUBLIC_SUPABASE_URL;
    }
    return FALLBACK_SUPABASE_URL;
  }

  function atualizarIndicadorProjetoDetectado(rawKey) {
    const el = getElements();
    const keyTrim = String(rawKey || '').trim();
    const derived = extrairUrlLocalDaChave(keyTrim);
    const resolved = resolverUrlAutomatica(keyTrim);

    if (el.inputUrl) {
      el.inputUrl.value = resolved;
    }

    if (!el.detectedBadge) return;

    if (!keyTrim) {
      el.detectedBadge.textContent = '🔒 Endpoint Supabase e Gateway GAS serão detectados automaticamente a partir da chave pública.';
      return;
    }

    if (derived) {
      const host = derived.replace(/^https:\/\//i, '');
      el.detectedBadge.textContent = '✅ Projeto detectado automaticamente no token JWT: ' + host + ' • Gateway GAS vinculado automaticamente.';
    } else if (keyTrim.startsWith('sb_publishable_') && keyTrim.length > 20) {
      const hostFallback = resolved.replace(/^https:\/\//i, '');
      el.detectedBadge.textContent = '✅ Chave publicável reconhecida • Endpoint canônico ativo (' + hostFallback + ') • Gateway GAS automático.';
    } else {
      el.detectedBadge.textContent = '⚠️ Informe uma chave pública JWT (eyJ...) ou sb_publishable_* válida do Supabase.';
    }
  }

  function abrirModal() {
    const el = getElements();
    if (!el.modal) return;

    const savedKey = localStorage.getItem('olympos_supabase_anon_key') || '';
    if (el.inputKey) {
      el.inputKey.value = savedKey;
    }
    atualizarIndicadorProjetoDetectado(savedKey);

    if (el.feedback) {
      el.feedback.style.display = 'none';
      el.feedback.textContent = '';
    }

    el.modal.style.display = 'flex';
  }

  function fecharModal() {
    const el = getElements();
    if (el.modal) {
      el.modal.style.display = 'none';
    }
  }

  function exibirFeedback(mensagem, tipo) {
    const el = getElements();
    if (!el.feedback) return;

    el.feedback.style.display = 'block';
    el.feedback.textContent = mensagem;

    if (tipo === 'sucesso') {
      el.feedback.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      el.feedback.style.color = '#10b981';
      el.feedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else if (tipo === 'aviso') {
      el.feedback.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
      el.feedback.style.color = '#f59e0b';
      el.feedback.style.border = '1px solid rgba(245, 158, 11, 0.3)';
    } else {
      el.feedback.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      el.feedback.style.color = '#ef4444';
      el.feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    }
  }

  async function testarConexao() {
    const el = getElements();
    const key = (el.inputKey ? el.inputKey.value : '').trim();

    if (!key || key.length < 20) {
      exibirFeedback('Informe uma Chave Pública (Anon Key) válida do Supabase.', 'erro');
      return;
    }

    const url = resolverUrlAutomatica(key);
    if (el.inputUrl) {
      el.inputUrl.value = url;
    }

    exibirFeedback('Testando conectividade automática com ' + url.replace(/^https:\/\//i, '') + '...', 'aviso');

    try {
      const endpoint = url.replace(/\/$/, '') + '/rest/v1/';
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key
        }
      });

      if (response.ok || response.status === 200 || response.status === 404 || response.status === 401) {
        if (response.status === 401) {
          exibirFeedback('O projeto respondeu, mas a Chave Pública informada foi recusada (HTTP 401). Verifique a chave.', 'erro');
        } else {
          exibirFeedback('Conexão estabelecida com sucesso usando apenas a Chave Pública! (Status ' + response.status + ')', 'sucesso');
        }
      } else {
        exibirFeedback('Resposta inesperada da instância Supabase: HTTP ' + response.status, 'aviso');
      }
    } catch (err) {
      console.error('[OlymposSetupModal] Erro ao testar conexão:', err);
      exibirFeedback('Falha de rede ao conectar à instância derivada: ' + err.message, 'erro');
    }
  }

  function salvarConfiguracao(e) {
    if (e && e.preventDefault) e.preventDefault();
    const el = getElements();

    const key = (el.inputKey ? el.inputKey.value : '').trim();
    if (!key || key.length < 20) {
      exibirFeedback('A Chave Pública do Supabase informada é inválida.', 'erro');
      return;
    }

    const url = resolverUrlAutomatica(key);
    if (el.inputUrl) {
      el.inputUrl.value = url;
    }

    try {
      localStorage.setItem('olympos_supabase_url', url);
      localStorage.setItem('olympos_supabase_anon_key', key);

      // Vincula automaticamente o endpoint canônico do Gateway GAS sem solicitar ao usuário
      if (window.OlymposApi && window.OlymposApi.DEFAULT_API_URL) {
        localStorage.setItem('olympos_api_url', window.OlymposApi.DEFAULT_API_URL);
      }

      // Reinicializa o cliente Supabase forçando atualização de credenciais
      if (window.OlymposSupabase && typeof window.OlymposSupabase.init === 'function') {
        window.OlymposSupabase.init(true);
      }

      exibirFeedback('Chave Pública validada e instância configurada automaticamente!', 'sucesso');

      setTimeout(function() {
        fecharModal();
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Chave Pública salva! Endpoint Supabase e Gateway GAS vinculados automaticamente.', 'success');
        }
      }, 700);
    } catch (err) {
      exibirFeedback('Erro ao salvar no localStorage: ' + err.message, 'erro');
    }
  }

  function bindEvents() {
    const el = getElements();

    if (el.btnClose) {
      el.btnClose.addEventListener('click', fecharModal);
    }
    if (el.btnTest) {
      el.btnTest.addEventListener('click', testarConexao);
    }
    if (el.form) {
      el.form.addEventListener('submit', salvarConfiguracao);
    }
    if (el.inputKey) {
      el.inputKey.addEventListener('input', function() {
        atualizarIndicadorProjetoDetectado(el.inputKey.value);
      });
    }

    // Botão de abertura a partir da tela de login
    const btnOpenFromLogin = document.getElementById('openSetupModalFromLoginBtn');
    if (btnOpenFromLogin) {
      btnOpenFromLogin.addEventListener('click', abrirModal);
    }

    // Clique fora fecha o modal
    if (el.modal) {
      el.modal.addEventListener('click', function(e) {
        if (e.target === el.modal) {
          fecharModal();
        }
      });
    }
  }

  // Inicializa os bindings quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

  return {
    abrirModal: abrirModal,
    fecharModal: fecharModal,
    testarConexao: testarConexao,
    salvarConfiguracao: salvarConfiguracao,
    resolverUrlAutomatica: resolverUrlAutomatica
  };
})();
