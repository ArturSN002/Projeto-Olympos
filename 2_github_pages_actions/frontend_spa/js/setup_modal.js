/**
 * @fileoverview Modal Interativo de Configuração do Supabase (Zero Senhas Hardcoded).
 * Permite ao operador inserir a URL e Anon Key do Supabase ou alternar para modo contingência,
 * armazenando as preferências exclusivamente no localStorage do navegador.
 * Versão 2.0.0 — Projeto Olympos
 */

window.OlymposSetupModal = (function() {
  function getElements() {
    return {
      modal: document.getElementById('supabaseSetupModal'),
      form: document.getElementById('supabaseSetupForm'),
      inputUrl: document.getElementById('setupSupabaseUrl'),
      inputKey: document.getElementById('setupSupabaseAnonKey'),
      inputGas: document.getElementById('setupGasWebhookUrl'),
      btnTest: document.getElementById('testSupabaseConnectionBtn'),
      btnClose: document.getElementById('closeSetupModalBtn'),
      feedback: document.getElementById('setupModalFeedback')
    };
  }

  function abrirModal() {
    const el = getElements();
    if (!el.modal) return;

    // Preenche com os valores salvos no localStorage (se existirem)
    if (el.inputUrl) {
      el.inputUrl.value = localStorage.getItem('olympos_supabase_url') || '';
    }
    if (el.inputKey) {
      el.inputKey.value = localStorage.getItem('olympos_supabase_anon_key') || '';
    }
    if (el.inputGas) {
      el.inputGas.value = localStorage.getItem('olympos_api_url') || '';
    }

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
    const url = (el.inputUrl ? el.inputUrl.value : '').trim();
    const key = (el.inputKey ? el.inputKey.value : '').trim();

    if (!url || !url.startsWith('https://')) {
      exibirFeedback('Informe uma URL HTTPS válida para a instância Supabase.', 'erro');
      return;
    }
    if (!key || key.length < 20) {
      exibirFeedback('A chave anônima (anon public key) informada é inválida ou muito curta.', 'erro');
      return;
    }

    exibirFeedback('Testando conectividade com o Supabase...', 'aviso');

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
        // Se respondeu HTTP do PostgREST, endpoint é válido
        if (response.status === 401) {
          exibirFeedback('A URL respondeu, mas a chave Anon informada foi recusada (HTTP 401). Verifique a chave.', 'erro');
        } else {
          exibirFeedback('Conexão com o Supabase estabelecida com sucesso! (Status ' + response.status + ')', 'sucesso');
        }
      } else {
        exibirFeedback('Resposta inesperada da instância Supabase: HTTP ' + response.status, 'aviso');
      }
    } catch (err) {
      console.error('[OlymposSetupModal] Erro ao testar conexão:', err);
      exibirFeedback('Falha de rede ao conectar à URL informada: ' + err.message, 'erro');
    }
  }

  function salvarConfiguracao(e) {
    if (e && e.preventDefault) e.preventDefault();
    const el = getElements();

    const url = (el.inputUrl ? el.inputUrl.value : '').trim();
    const key = (el.inputKey ? el.inputKey.value : '').trim();
    const gas = (el.inputGas ? el.inputGas.value : '').trim();

    if (!url || !url.startsWith('https://')) {
      exibirFeedback('URL do Supabase inválida. Deve iniciar com https://', 'erro');
      return;
    }
    if (!key || key.length < 20) {
      exibirFeedback('A Chave Anônima do Supabase informada é inválida.', 'erro');
      return;
    }

    try {
      localStorage.setItem('olympos_supabase_url', url);
      localStorage.setItem('olympos_supabase_anon_key', key);
      if (gas) {
        localStorage.setItem('olympos_api_url', gas);
      }

      // Reinicializa o cliente Supabase se estiver carregado
      if (window.OlymposSupabase && typeof window.OlymposSupabase.init === 'function') {
        window.OlymposSupabase.init();
      }

      exibirFeedback('Configurações salvas no localStorage com sucesso!', 'sucesso');

      setTimeout(function() {
        fecharModal();
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Instância Supabase configurada com sucesso!', 'success');
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
    salvarConfiguracao: salvarConfiguracao
  };
})();
