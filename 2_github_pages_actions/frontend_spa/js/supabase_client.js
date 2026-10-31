/**
 * @fileoverview Cliente de Inicialização Supabase com Proteção Contra Falhas (Resilience Layer).
 * Se as variáveis de ambiente/localStorage não estiverem configuradas,
 * exibe o Setup Modal amigavelmente sem travar ou emitir tela branca no navegador.
 * Versão 2.0.0 — Projeto Olympos
 */

window.OlymposSupabase = (function() {
  let supabaseInstance = null;
  let cachedProfile = null;

  function getConfig() {
    return {
      url: (localStorage.getItem('olympos_supabase_url') || '').trim(),
      anonKey: (localStorage.getItem('olympos_supabase_anon_key') || '').trim()
    };
  }

  function isConfigured() {
    const cfg = getConfig();
    return Boolean(cfg.url && cfg.anonKey && cfg.url.startsWith('https://') && cfg.anonKey.length > 20);
  }

  function init() {
    const cfg = getConfig();

    if (!isConfigured()) {
      console.warn('[OlymposSupabase] Supabase não configurado no localStorage. Abrindo modal de configuração guiada.');
      // Evita travar a página: aguarda o DOM e abre o Setup Modal de forma graciosa
      if (window.OlymposSetupModal && typeof window.OlymposSetupModal.abrirModal === 'function') {
        window.OlymposSetupModal.abrirModal();
      } else {
        setTimeout(function() {
          if (window.OlymposSetupModal && typeof window.OlymposSetupModal.abrirModal === 'function') {
            window.OlymposSetupModal.abrirModal();
          }
        }, 500);
      }
      return null;
    }

    if (!window.supabase) {
      console.error('[OlymposSupabase] A biblioteca Supabase JS (@supabase/supabase-js) não foi carregada pelo CDN.');
      return null;
    }

    try {
      supabaseInstance = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log('[OlymposSupabase] Cliente Supabase inicializado com sucesso.');
      return supabaseInstance;
    } catch (err) {
      console.error('[OlymposSupabase] Erro ao instanciar createClient:', err);
      return null;
    }
  }

  function getClient() {
    if (!supabaseInstance) {
      init();
    }
    return supabaseInstance;
  }

  /**
   * Realiza login autenticado com e-mail institucional e senha no Supabase Auth.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} Dados do usuário, sessão e perfil RBAC
   */
  async function login(email, password) {
    const client = getClient();
    if (!client) {
      if (window.OlymposSetupModal && typeof window.OlymposSetupModal.abrirModal === 'function') {
        window.OlymposSetupModal.abrirModal();
      }
      throw new Error('Supabase não está configurado. Por favor, configure a URL e a Chave Anônima.');
    }

    const cleanEmail = String(email || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      throw new Error('Informe e-mail e senha para prosseguir.');
    }

    // Chamada oficial ao Supabase Auth GoTrue
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });

    if (error) {
      throw error;
    }

    // Carregar perfil associado na tabela public.profiles
    let profile = null;
    try {
      const { data: profData, error: profErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profErr && profData) {
        profile = profData;
      }
    } catch (eProf) {
      console.warn('[OlymposSupabase] Aviso ao buscar perfil na tabela profiles:', eProf);
    }

    // Fallback de perfil via metadados do token se a tabela não tiver registro
    if (!profile) {
      const userMeta = data.user.user_metadata || {};
      const appMeta = data.user.app_metadata || {};
      profile = {
        id: data.user.id,
        email: data.user.email,
        full_name: userMeta.full_name || data.user.email,
        role: appMeta.role || 'RH_COMISSAO',
        department: userMeta.department || 'Secretaria Municipal de Educacao'
      };
    }

    cachedProfile = profile;

    return {
      user: data.user,
      session: data.session,
      profile: profile
    };
  }

  /**
   * Encerra a sessão ativa no Supabase Auth.
   */
  async function logout() {
    const client = getClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('[OlymposSupabase] Erro ao executar signOut:', e);
      }
    }
    cachedProfile = null;
    localStorage.removeItem('olympos_session');
  }

  /**
   * Resgata a sessão atual autenticada.
   */
  async function getSession() {
    const client = getClient();
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      return data ? data.session : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Resgata o JWT token de acesso da sessão atual.
   */
  async function getJwtToken() {
    const sess = await getSession();
    return (sess && sess.access_token) ? sess.access_token : null;
  }

  return {
    getConfig: getConfig,
    isConfigured: isConfigured,
    init: init,
    getClient: getClient,
    login: login,
    logout: logout,
    getSession: getSession,
    getJwtToken: getJwtToken
  };
})();

// Auto-inicialização quando o DOM carregar
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.OlymposSupabase.init();
    });
  } else {
    window.OlymposSupabase.init();
  }
}
