/**
 * @fileoverview Cliente de Inicialização Supabase com Proteção Contra Falhas (Resilience Layer).
 * Se as variáveis de ambiente/localStorage não estiverem configuradas,
 * exibe o Setup Modal amigavelmente sem travar ou emitir tela branca no navegador.
 * Versão 2.0.0 — Projeto Olympos
 */

window.OlymposSupabase = (function() {
  let supabaseInstance = null;
  let cachedProfile = null;
  let activeUrl = null;
  let activeKey = null;

  function normalizeSupabaseUrl(rawUrl) {
    return String(rawUrl || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/(rest|auth)\/v1(\/.*)?$/i, '');
  }

  const DEFAULT_PUBLIC_SUPABASE_URL = 'https://rbwizevjvbvjwtbwwyif.supabase.co';

  function getConfig() {
    let rawUrl = localStorage.getItem('olympos_supabase_url');
    if (!rawUrl) {
      rawUrl = DEFAULT_PUBLIC_SUPABASE_URL;
      try {
        localStorage.setItem('olympos_supabase_url', DEFAULT_PUBLIC_SUPABASE_URL);
      } catch (e) {}
    }
    const cleanUrl = normalizeSupabaseUrl(rawUrl);
    if (rawUrl && cleanUrl && rawUrl !== cleanUrl) {
      localStorage.setItem('olympos_supabase_url', cleanUrl);
    }
    return {
      url: cleanUrl,
      anonKey: (localStorage.getItem('olympos_supabase_anon_key') || '').trim()
    };
  }

  function isConfigured() {
    const cfg = getConfig();
    return Boolean(cfg.url && cfg.anonKey && cfg.url.startsWith('https://') && cfg.anonKey.length > 20);
  }

  function init(force) {
    const cfg = getConfig();

    if (!isConfigured()) {
      console.info('[OlymposSupabase] Inicialização em modo público. Credenciais de autenticação aguardando configuração via Setup Modal.');
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

    // Padrão Singleton Estrito: Reutiliza instância ativa se URL e Chave forem idênticas
    if (supabaseInstance && !force && activeUrl === cfg.url && activeKey === cfg.anonKey) {
      return supabaseInstance;
    }

    // Se já havia instância ativa mas credenciais mudaram ou force=true, encerra auto-refresh anterior
    if (supabaseInstance && supabaseInstance.auth && typeof supabaseInstance.auth.stopAutoRefreshToken === 'function') {
      try {
        supabaseInstance.auth.stopAutoRefreshToken();
      } catch (eStop) {}
    }

    try {
      supabaseInstance = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      activeUrl = cfg.url;
      activeKey = cfg.anonKey;
      console.log('[OlymposSupabase] Cliente Supabase inicializado com sucesso (Singleton).');

      // Escuta renovação automática de token e sincroniza sessão do app
      if (supabaseInstance.auth && typeof supabaseInstance.auth.onAuthStateChange === 'function') {
        supabaseInstance.auth.onAuthStateChange(function(event, session) {
          if (event === 'TOKEN_REFRESHED' && session && window.OlymposApp && typeof window.OlymposApp.atualizarTokenSessao === 'function') {
            window.OlymposApp.atualizarTokenSessao(session.access_token);
          }
        });
      }

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

    // Cache RBAC de alta performance em sessionStorage para navegação veloz
    try {
      sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(profile));
      sessionStorage.setItem('olympos_session_rbac', JSON.stringify({
        user: data.user,
        profile: profile,
        role: profile.role,
        token: data.session ? data.session.access_token : null
      }));
    } catch (eStorage) {
      console.warn('[OlymposSupabase] Aviso ao persistir RBAC no sessionStorage:', eStorage);
    }

    return {
      user: data.user,
      session: data.session,
      profile: profile
    };
  }

  /**
   * Resgata perfil e claims RBAC em cache (memória ativa ou sessionStorage).
   */
  function getCachedProfile() {
    if (cachedProfile) return cachedProfile;
    try {
      const raw = sessionStorage.getItem('olympos_rbac_profile_cache');
      if (raw) {
        cachedProfile = JSON.parse(raw);
        return cachedProfile;
      }
    } catch (e) {
      console.warn('[OlymposSupabase] Falha ao ler cache RBAC do sessionStorage:', e);
    }
    return null;
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
    try {
      sessionStorage.removeItem('olympos_rbac_profile_cache');
      sessionStorage.removeItem('olympos_session_rbac');
    } catch (e) {}
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

  /**
   * Helper de busca semântica vetorial (pgvector) no acervo oficial.
   * Invoca a RPC 'match_publicacoes_semanticas' com threshold e count configuráveis.
   * Se o pgvector não estiver populado, se queryEmbedding for termo de texto ou se ocorrer erro na RPC,
   * executa fallback gracioso para busca textual padrão na tabela publicacoes_diario.
   *
   * @param {Array<number>|string} queryEmbedding - Vetor float 768 dimensões ou termo textual de consulta
   * @param {number} [threshold=0.65] - Limiar mínimo de similaridade de cosseno
   * @param {number} [count=10] - Limite máximo de publicações retornadas
   * @returns {Promise<Array<Object>>} Lista de publicações encontradas com similaridade
   */
  async function buscarPublicacoesSemanticas(queryEmbedding, threshold = 0.65, count = 10) {
    const client = getClient();
    if (!client) {
      console.warn('[OlymposSupabase] Cliente não inicializado para busca semântica.');
      return [];
    }

    // 1. Tentativa de busca vetorial se queryEmbedding for um vetor numérico válido
    if (Array.isArray(queryEmbedding) && queryEmbedding.length > 0) {
      try {
        const { data, error } = await client.rpc('match_publicacoes_semanticas', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: count
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data;
        }

        if (error) {
          console.warn('[OlymposSupabase] RPC match_publicacoes_semanticas retornou erro. Acionando fallback textual:', error.message);
        } else {
          console.info('[OlymposSupabase] Busca vetorial retornou 0 registros. Executando fallback.');
        }
      } catch (errRpc) {
        console.warn('[OlymposSupabase] Exceção na chamada RPC match_publicacoes_semanticas:', errRpc);
      }
    }

    // 2. Fallback gracioso para busca textual na tabela publicacoes_diario
    try {
      let query = client
        .from('publicacoes_diario')
        .select('id, data_publicacao, edicao, titulo, ato_tipo, servidores_envolvidos, conteudo_ner')
        .order('data_publicacao', { ascending: false })
        .limit(count);

      if (typeof queryEmbedding === 'string' && queryEmbedding.trim()) {
        const term = queryEmbedding.trim();
        query = query.or(`titulo.ilike.%${term}%,ato_tipo.ilike.%${term}%`);
      }

      const { data: textData, error: textErr } = await query;
      if (!textErr && Array.isArray(textData)) {
        return textData.map(function(item) {
          return Object.assign({}, item, {
            similarity: 1.0,
            fallback_textual: true
          });
        });
      }
    } catch (errFallback) {
      console.warn('[OlymposSupabase] Falha ao executar fallback textual:', errFallback);
    }

    return [];
  }

  return {
    getConfig: getConfig,
    isConfigured: isConfigured,
    init: init,
    getClient: getClient,
    login: login,
    logout: logout,
    getSession: getSession,
    getJwtToken: getJwtToken,
    getCachedProfile: getCachedProfile,
    buscarPublicacoesSemanticas: buscarPublicacoesSemanticas
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
