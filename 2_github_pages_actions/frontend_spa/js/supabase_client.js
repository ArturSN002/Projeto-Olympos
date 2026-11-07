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
  const DEFAULT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid2l6ZXZqdmJ2and0Ynd3eWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NjA1NDgsImV4cCI6MjEwOTAzNjU0OH0.R5WH_n4EXZqO7x1GMIhH1LV4F5DvYnMMsnsdzoQGjIk';

  /**
   * Extrai automaticamente a URL do projeto Supabase a partir do payload JWT da Chave Pública (anon key),
   * eliminando a necessidade de solicitar manualmente a URL do projeto ao operador.
   * @param {string} rawKey Chave pública (JWT ou sb_publishable_*)
   * @returns {string|null} URL HTTPS derivada ou null se a chave for opaca/inválida
   */
  function extrairUrlSupabaseDaChave(rawKey) {
    const k = String(rawKey || '').trim();
    if (!k) return null;
    const parts = k.split('.');
    if (parts.length !== 3) return null;
    try {
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) {
        b64 += '=';
      }
      const decoded = atob(b64);
      const payload = JSON.parse(decoded);
      if (payload && typeof payload.ref === 'string' && /^[a-z0-9]{15,35}$/i.test(payload.ref.trim())) {
        return 'https://' + payload.ref.trim().toLowerCase() + '.supabase.co';
      }
      if (payload && typeof payload.iss === 'string' && payload.iss.startsWith('https://') && payload.iss.includes('.supabase.')) {
        return normalizeSupabaseUrl(payload.iss);
      }
    } catch (e) {
      // Chave não é um JWT padrão decodificável; utiliza fallback canônico
    }
    return null;
  }

  function getConfig() {
    let key = (localStorage.getItem('olympos_supabase_anon_key') || '').trim();
    if (!key) {
      key = DEFAULT_PUBLIC_SUPABASE_ANON_KEY;
      try {
        localStorage.setItem('olympos_supabase_anon_key', DEFAULT_PUBLIC_SUPABASE_ANON_KEY);
      } catch (e) {}
    }

    const derivedUrl = extrairUrlSupabaseDaChave(key);
    let rawUrl = localStorage.getItem('olympos_supabase_url');
    if (derivedUrl) {
      rawUrl = derivedUrl;
      try {
        localStorage.setItem('olympos_supabase_url', derivedUrl);
      } catch (e) {}
    } else if (!rawUrl) {
      rawUrl = DEFAULT_PUBLIC_SUPABASE_URL;
      try {
        localStorage.setItem('olympos_supabase_url', DEFAULT_PUBLIC_SUPABASE_URL);
      } catch (e) {}
    }

    const cleanUrl = normalizeSupabaseUrl(rawUrl);
    if (rawUrl && cleanUrl && rawUrl !== cleanUrl) {
      try {
        localStorage.setItem('olympos_supabase_url', cleanUrl);
      } catch (e) {}
    }

    return {
      url: cleanUrl,
      anonKey: key
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
        // Sanitiza caracteres reservados do PostgREST (, ( ) * % \) contra injeção de filtro lógico
        const safeTerm = queryEmbedding.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (safeTerm) {
          query = query.or(`titulo.ilike.%${safeTerm}%,ato_tipo.ilike.%${safeTerm}%`);
        }
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

  // =========================================================================
  // PERSISTÊNCIA: ESCOLAS MUNICIPAIS DE CEARÁ-MIRIM
  // =========================================================================
  // PERSISTÊNCIA: ESCOLAS MULTI-REDE E MULTI-SEGMENTOS
  // =========================================================================

  function normalizarCategoriaInstitucional(cat, nome) {
    var c = String(cat || '').trim();
    var cLow = c.toLowerCase();
    var nLow = String(nome || '').trim().toLowerCase();

    if (c === 'Instituição' || cLow.includes('institui') || cLow.includes('sede') || nLow.includes('smeb sede') || nLow.includes('secretaria') || nLow.includes('ifrn')) {
      return 'Instituição';
    }
    if (
      c === 'Centro de Educação Infantil' ||
      c === 'Educação Infantil' ||
      c === 'Educação Infantil (CEI)' ||
      cLow === 'cei' ||
      cLow === 'cmei' ||
      cLow === 'creche' ||
      /^c\.?e\.?i\.?\b/i.test(nLow) ||
      /^cmei\b/i.test(nLow) ||
      nLow.includes('centro de educação infantil')
    ) {
      return 'Centro de Educação Infantil';
    }
    return 'Escola';
  }

  function normalizarEscola(e) {
    if (!e) return e;
    var redeValida = ['Municipal', 'Estadual', 'Federal', 'Privada'].includes(e.rede) ? e.rede : 'Municipal';
    var categoriaInstitucional = normalizarCategoriaInstitucional(e.categoria, e.nome);
    var segmentos = Array.isArray(e.segmentos) && e.segmentos.length > 0 ? e.segmentos : null;
    if (!segmentos) {
      if (categoriaInstitucional === 'Centro de Educação Infantil') {
        segmentos = ['Ed. Infantil'];
      } else if (categoriaInstitucional === 'Instituição') {
        segmentos = ['Sede Administrativa'];
      } else {
        segmentos = ['Ens. Fundamental I', 'Ens. Fundamental II'];
      }
    }

    var zonaValida = e.zona || 'Urbana';
    var isRural = String(zonaValida).toLowerCase().includes('rural');

    // Matriz V2.03 de Cores por Rede e Zona:
    // Municipal: Urbana #22C55E (Verde claro), Rural #166534 (Verde escuro)
    // Estadual: Urbana #FACC15 (Amarelo claro), Rural #EA580C (Laranja)
    // Federal: Urbana #38BDF8 (Azul claro), Rural #1E40AF (Azul escuro)
    // Privada: Urbana #EF4444 (Vermelho), Rural #EC4899 (Rosa)
    var corPadrao = isRural ? '#166534' : '#22C55E';
    if (redeValida === 'Estadual') {
      corPadrao = isRural ? '#EA580C' : '#FACC15';
    } else if (redeValida === 'Federal') {
      corPadrao = isRural ? '#1E40AF' : '#38BDF8';
    } else if (redeValida === 'Privada') {
      corPadrao = isRural ? '#EC4899' : '#EF4444';
    }

    // Matriz V2.03 de Símbolos por Segmento:
    // Ed. Infantil / CEI: 'C'
    // Ensino Fundamental I: 'I'
    // Ensino Fundamental II: 'II'
    // Ensino Médio / Técnico: 'M'
    // Mais de um segmento: 'X'
    // Instituição Sede (SMEB / CEMAI): '★'
    var iconePadrao = 'I';
    var validSegs = (segmentos || []).filter(function(s) {
      return !s.includes('Sede') && !s.includes('Especial');
    });
    var nLow = String(e.nome || '').toLowerCase();
    if (nLow.includes('smeb sede') || nLow.includes('cemai')) {
      iconePadrao = '★';
    } else if (validSegs.length > 1) {
      iconePadrao = 'X';
    } else if (validSegs.length === 1) {
      var s = validSegs[0].toLowerCase();
      if (s.includes('infantil') || s.includes('creche') || s.includes('cei')) iconePadrao = 'C';
      else if (s.includes('fundamental i') || s.includes('anos iniciais')) iconePadrao = 'I';
      else if (s.includes('fundamental ii') || s.includes('anos finais')) iconePadrao = 'II';
      else if (s.includes('médio') || s.includes('medio') || s.includes('técnico') || s.includes('tecnico')) iconePadrao = 'M';
    } else if (categoriaInstitucional === 'Centro de Educação Infantil') {
      iconePadrao = 'C';
    } else if (categoriaInstitucional === 'Instituição') {
      iconePadrao = '★';
    }

    var iconeFinal = e.icone || iconePadrao;
    var corFinal = e.cor || corPadrao;

    return {
      id: e.id,
      nome: e.nome,
      inep: e.inep || '',
      rede: redeValida,
      segmentos: segmentos,
      categoria: categoriaInstitucional,
      zona: zonaValida,
      bairroDistrito: e.bairroDistrito || e.bairro_distrito || '',
      endereco: e.endereco || '',
      lat: typeof e.lat === 'number' ? e.lat : parseFloat(e.latitude || 0),
      lng: typeof e.lng === 'number' ? e.lng : parseFloat(e.longitude || 0),
      turnos: Array.isArray(e.turnos) ? e.turnos : ['Matutino', 'Vespertino'],
      telefone: e.telefone || '',
      diretor: e.diretor || '',
      cor: corFinal,
      icone: iconeFinal,
      status: e.status || 'ATIVA'
    };
  }

  async function carregarEscolas() {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('escolas')
          .select('*')
          .order('id');
        if (!error && Array.isArray(data) && data.length > 0) {
          console.log('[Olympos Supabase] Conteúdo recebido da tabela [escolas] (' + data.length + ' unidades):', data);
          const adaptadas = data.map(normalizarEscola);
          try {
            localStorage.setItem('olympos_escolas_municipais', JSON.stringify(adaptadas));
          } catch (eStorage) {}
          return adaptadas;
        }
        if (error) {
          console.error('[Olympos Supabase] Erro ao consultar tabela [escolas]:', error);
        }

        // Fallback secundário: carrega arquivo JSON estruturado em public.catalogos_json
        const { data: catDoc, error: catErr } = await client
          .from('catalogos_json')
          .select('conteudo')
          .eq('chave', 'escolas_ceara_mirim')
          .maybeSingle();
        if (!catErr && catDoc && Array.isArray(catDoc.conteudo) && catDoc.conteudo.length > 0) {
          const adaptadasJson = catDoc.conteudo.map(normalizarEscola);
          try {
            localStorage.setItem('olympos_escolas_municipais', JSON.stringify(adaptadasJson));
          } catch (eStoreJson) {}
          return adaptadasJson;
        }
      } catch (err) {
        console.warn('[OlymposSupabase] Falha ao carregar escolas do Supabase. Utilizando cache local:', err);
      }
    }
    // Fallback offline com normalização
    try {
      const cached = localStorage.getItem('olympos_escolas_municipais');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizarEscola);
        }
      }
    } catch (eCache) {}
    return (window.BANCO_SEMENTE_ESCOLAS || []).map(normalizarEscola);
  }

  async function sincronizarCatalogoEscolasJson(listaEscolas) {
    if (!Array.isArray(listaEscolas)) return false;
    const client = getClient();
    if (!client) return false;
    const sess = await getSession();
    if (!sess) return false;

    const normalizadas = listaEscolas.map(normalizarEscola);
    try {
      const { error } = await client.from('catalogos_json').upsert({
        chave: 'escolas_ceara_mirim',
        descricao: 'Catálogo JSON georreferenciado oficial das Escolas, CEIs e Instituições de Ceará-Mirim/RN',
        versao: 2,
        conteudo: normalizadas
      });
      if (error) {
        console.warn('[OlymposSupabase] Aviso ao atualizar catalogos_json no Supabase:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[OlymposSupabase] Exceção ao sincronizar catalogos_json:', e);
      return false;
    }
  }

  async function sincronizarEscola(escola) {
    if (!escola || !escola.id) return false;
    const client = getClient();
    if (client) {
      const sess = await getSession();
      if (!sess) {
        console.info('[OlymposSupabase] Escola salva localmente (autentique-se no Supabase para sincronizar na nuvem).');
        return false;
      }
      const normalizada = normalizarEscola(escola);
      const payload = {
        id: normalizada.id,
        inep: normalizada.inep || '',
        nome: normalizada.nome,
        rede: normalizada.rede,
        segmentos: normalizada.segmentos,
        categoria: normalizada.categoria,
        zona: normalizada.zona || 'Urbana',
        bairro_distrito: normalizada.bairroDistrito || '',
        endereco: normalizada.endereco || '',
        latitude: parseFloat(normalizada.lat),
        longitude: parseFloat(normalizada.lng),
        turnos: Array.isArray(normalizada.turnos) ? normalizada.turnos : [],
        telefone: normalizada.telefone || '',
        diretor: normalizada.diretor || '',
        cor: normalizada.cor || '#38BDF8',
        icone: normalizada.icone || 'U',
        status: normalizada.status || 'ATIVA'
      };
      try {
        const { error } = await client.from('escolas').upsert(payload);
        if (error) {
          console.warn('[OlymposSupabase] Erro ao sincronizar escola no Supabase:', error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[OlymposSupabase] Exceção ao sincronizar escola:', e);
        return false;
      }
    }
    return false;
  }

  async function excluirEscola(escolaId) {
    if (!escolaId) return false;
    const client = getClient();
    if (client) {
      const sess = await getSession();
      if (!sess) return false;
      try {
        const { error } = await client.from('escolas').delete().eq('id', escolaId);
        if (error) {
          console.warn('[OlymposSupabase] Erro ao excluir escola no Supabase:', error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[OlymposSupabase] Exceção ao excluir escola:', e);
        return false;
      }
    }
    return false;
  }

  // =========================================================================
  // PERSISTÊNCIA: SECRETARIAS MUNICIPAIS PARCEIRAS (PERMUTAS RN)
  // =========================================================================

  async function carregarSecretariasParceiras() {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('secretarias_parceiras')
          .select('*')
          .order('municipio');
        if (!error && Array.isArray(data) && data.length > 0) {
          console.log('[Olympos Supabase] Conteúdo recebido da tabela [secretarias_parceiras] (' + data.length + ' secretarias):', data);
          const adaptadas = data.map(function(s) {
            return {
              id: s.id,
              nome: s.nome,
              municipio: s.municipio,
              regiao: s.regiao || 'Grande Natal',
              tipo: s.tipo || 'Secretaria Municipal Parceira',
              coords: [s.latitude, s.longitude],
              cor: s.cor || '#10B981',
              icone: s.icone || '🏛️',
              endereco: s.endereco || '',
              contato: s.contato || '',
              ativo: s.ativo !== false
            };
          });
          try {
            localStorage.setItem('olympos_secretarias_parceiras', JSON.stringify(adaptadas));
          } catch (eStore) {}
          return adaptadas;
        }
      } catch (err) {
        console.warn('[OlymposSupabase] Falha ao carregar secretarias do Supabase:', err);
      }
    }
    try {
      const cached = localStorage.getItem('olympos_secretarias_parceiras');
      if (cached) return JSON.parse(cached);
    } catch (eCache) {}
    return null;
  }

  async function sincronizarSecretariaParceira(sec) {
    if (!sec || !sec.id) return false;
    const client = getClient();
    if (client) {
      const sess = await getSession();
      if (!sess) {
        console.info('[OlymposSupabase] Secretaria parceira salva localmente (autentique-se para sincronizar na nuvem).');
        return false;
      }
      const coords = Array.isArray(sec.coords) ? sec.coords : [-5.6344, -35.4245];
      const payload = {
        id: sec.id,
        nome: sec.nome,
        municipio: sec.municipio,
        regiao: sec.regiao || 'Grande Natal',
        tipo: sec.tipo || 'Secretaria Municipal Parceira',
        latitude: parseFloat(coords[0]),
        longitude: parseFloat(coords[1]),
        cor: sec.cor || '#10B981',
        icone: sec.icone || '🏛️',
        endereco: sec.endereco || '',
        contato: sec.contato || '',
        ativo: sec.ativo !== false
      };
      try {
        const { error } = await client.from('secretarias_parceiras').upsert(payload);
        if (error) {
          console.warn('[OlymposSupabase] Erro ao sincronizar secretaria parceira:', error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[OlymposSupabase] Exceção ao sincronizar secretaria parceira:', e);
        return false;
      }
    }
    return false;
  }

  // =========================================================================
  // PERSISTÊNCIA: AGENDA INTERSETORIAL DO CALENDÁRIO
  // =========================================================================

  async function carregarAgendaEventos(ano) {
    const anoInt = parseInt(ano, 10) || 2026;
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('calendario_agenda')
          .select('*')
          .eq('ano', anoInt)
          .order('data_inicio');
        if (!error && Array.isArray(data)) {
          const adaptados = data.map(function(ev) {
            return {
              id: ev.id,
              ano: ev.ano,
              titulo: ev.titulo,
              dataInicio: ev.data_inicio,
              dataFim: ev.data_fim,
              horario: ev.horario || '',
              setor: ev.setor || 'Gabinete SMEB',
              categoria: ev.categoria || 'agenda_intersetorial',
              descricao: ev.descricao || '',
              local: ev.local || '',
              publicoAlvo: ev.publico_alvo || '',
              letivo: false,
              cor: ev.cor || '#8B5CF6',
              icone: ev.icone || '🗓️',
              isCustom: true
            };
          });
          return adaptados;
        }
      } catch (err) {
        console.warn('[OlymposSupabase] Erro ao carregar agenda do Supabase:', err);
      }
    }
    return null;
  }

  async function salvarAgendaEvento(evento) {
    if (!evento || !evento.id) return false;
    const client = getClient();
    if (client) {
      const sess = await getSession();
      if (!sess) {
        console.info('[OlymposSupabase] Evento de agenda salvo localmente (autentique-se no Supabase para sincronizar na nuvem).');
        return false;
      }
      const payload = {
        id: evento.id,
        ano: parseInt(evento.ano, 10) || 2026,
        titulo: evento.titulo,
        data_inicio: evento.dataInicio,
        data_fim: evento.dataFim || evento.dataInicio,
        horario: evento.horario || '',
        setor: evento.setor || 'Gabinete SMEB',
        categoria: evento.categoria || 'agenda_intersetorial',
        descricao: evento.descricao || '',
        local: evento.local || '',
        publico_alvo: evento.publicoAlvo || '',
        letivo: false,
        cor: evento.cor || '#8B5CF6',
        icone: evento.icone || '🗓️'
      };
      try {
        const { error } = await client.from('calendario_agenda').upsert(payload);
        if (error) {
          console.warn('[OlymposSupabase] Erro ao salvar evento de agenda no Supabase:', error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[OlymposSupabase] Exceção ao salvar evento de agenda:', e);
        return false;
      }
    }
    return false;
  }

  async function excluirAgendaEvento(eventoId) {
    if (!eventoId) return false;
    const client = getClient();
    if (client) {
      const sess = await getSession();
      if (!sess) return false;
      try {
        const { error } = await client.from('calendario_agenda').delete().eq('id', eventoId);
        if (error) {
          console.warn('[OlymposSupabase] Erro ao excluir evento de agenda no Supabase:', error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[OlymposSupabase] Exceção ao excluir evento de agenda:', e);
        return false;
      }
    }
    return false;
  }

  // =========================================================================
  // PERSISTÊNCIA: NUMERAÇÃO OFICIAL DO GABINETE 2026 (PORTARIAS & OFÍCIOS)
  // =========================================================================

  async function carregarNumeracaoGabinete() {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('catalogos_json')
          .select('conteudo')
          .eq('chave', 'numeracao_gabinete')
          .maybeSingle();
        if (!error && data && data.conteudo && typeof data.conteudo === 'object') {
          const c = data.conteudo;
          // Ignora registro de seed estático inicial que não veio de sincronização real do Drive (_memoria_apolo.md)
          const isStaticSeed = !c.sincronizadoDrive &&
            c.atualizadoEm === '2026-11-07T14:00:00Z' &&
            Number(c.proximoOficio2026) === 155 &&
            Number(c.proximaPortaria2026) === 412;
          if (!isStaticSeed) {
            console.log('[Olympos Supabase] Conteúdo dinâmico recebido do catálogo [numeracao_gabinete]:', c);
            return c;
          }
        }
        if (error) {
          console.error('[Olympos Supabase] Erro ao consultar [numeracao_gabinete]:', error);
        }
      } catch (err) {
        console.warn('[Olympos Supabase] Exceção ao consultar numeracao_gabinete:', err);
      }
    }
    // Sem valores estáticos hardcoded: mantém estado "--" na UI até os dados reais serem carregados
    return null;
  }

  async function sincronizarNumeracaoGabinete(numeracao) {
    if (!numeracao || typeof numeracao !== 'object') return false;
    const client = getClient();
    if (!client) return false;
    try {
      const sess = await getSession();
      if (!sess) return false;
      const conteudo = Object.assign({}, numeracao, {
        sincronizadoDrive: true,
        atualizadoEm: new Date().toISOString()
      });
      const { error } = await client.from('catalogos_json').upsert({
        chave: 'numeracao_gabinete',
        conteudo: conteudo,
        updated_at: new Date().toISOString()
      });
      return !error;
    } catch (e) {
      return false;
    }
  }

  // =========================================================================
  // PERSISTÊNCIA: PUBLICAÇÕES OFICIAIS DO DIÁRIO OFICIAL FEMURN
  // =========================================================================

  async function carregarPublicacoesDiario() {
    const client = getClient();
    if (client) {
      try {
        // 1. Tenta recuperar da tabela estruturada public.publicacoes_diario
        const { data, error } = await client
          .from('publicacoes_diario')
          .select('*')
          .order('data_publicacao', { ascending: false })
          .limit(100);
        if (!error && Array.isArray(data) && data.length > 0) {
          console.log('[Olympos Supabase] Conteúdo recebido da tabela [publicacoes_diario] (' + data.length + ' atos):', data);
          return data;
        }

        // 2. Fallback de resiliência: catálogo JSON em public.catalogos_json
        const { data: catData, error: catError } = await client
          .from('catalogos_json')
          .select('conteudo')
          .eq('chave', 'diario_oficial_publicacoes')
          .maybeSingle();
        if (!catError && catData && Array.isArray(catData.conteudo) && catData.conteudo.length > 0) {
          console.log('[Olympos Supabase] Conteúdo recebido do catálogo [diario_oficial_publicacoes] (' + catData.conteudo.length + ' atos):', catData.conteudo);
          return catData.conteudo;
        }
        if (error) {
          console.error('[Olympos Supabase] Erro ao consultar [publicacoes_diario]:', error);
        }
      } catch (err) {
        console.warn('[Olympos Supabase] Exceção ao consultar publicações diário:', err);
      }
    }
    return [];
  }

  /**
   * Verifica o status da Autenticação em Duas Etapas (TOTP MFA) da sessão atual.
   * Retorna os níveis de garantia AAL (aal1 / aal2) e lista de fatores ativos.
   */
  async function checkMfaStatus() {
    const client = getClient();
    if (!client || !client.auth || !client.auth.mfa) {
      return {
        supported: false,
        currentLevel: 'aal1',
        currentAal: 'aal1',
        nextLevel: 'aal1',
        nextAal: 'aal1',
        factors: [],
        verifiedFactors: [],
        hasEnrolled: false
      };
    }
    try {
      const { data: aalData, error: aalErr } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factorsData, error: factorsErr } = await client.auth.mfa.listFactors();

      const factors = (factorsData && (factorsData.all || factorsData.totp)) || [];
      const verifiedTotp = factors.filter(function(f) {
        return (f.status === 'verified') && (f.factor_type === 'totp' || f.type === 'totp');
      });

      const currentLvl = (aalData && aalData.currentLevel) || 'aal1';
      const nextLvl = (aalData && aalData.nextLevel) || (verifiedTotp.length > 0 ? 'aal2' : 'aal1');

      return {
        supported: true,
        currentLevel: currentLvl,
        currentAal: currentLvl,
        nextLevel: nextLvl,
        nextAal: nextLvl,
        factors: factors,
        verifiedFactors: verifiedTotp,
        hasEnrolled: verifiedTotp.length > 0
      };
    } catch (err) {
      console.warn('[OlymposSupabase] Falha ao verificar status MFA:', err);
      return {
        supported: false,
        currentLevel: 'aal1',
        currentAal: 'aal1',
        nextLevel: 'aal1',
        nextAal: 'aal1',
        factors: [],
        verifiedFactors: [],
        hasEnrolled: false
      };
    }
  }

  /**
   * Inicia o registro de um novo fator TOTP MFA para o usuário ativo.
   * @param {string} [friendlyName] Nome identificador do dispositivo autenticador
   */
  async function enrollMfaTotp(friendlyName) {
    const client = getClient();
    if (!client || !client.auth || !client.auth.mfa) {
      throw new Error('Supabase MFA não suportado no ambiente.');
    }
    const sessionRes = await client.auth.getSession();
    const userEmail = (sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.user)
      ? sessionRes.data.session.user.email
      : 'Operador';
    const factorName = friendlyName || 'Olympos SMEB (' + userEmail + ')';

    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'Olympos SMEB',
      friendlyName: factorName
    });

    if (error) throw error;
    return data;
  }

  /**
   * Responde ao desafio TOTP verificando o código de 6 dígitos gerado pelo autenticador.
   * Promove a sessão ativa para o nível de garantia 'aal2'.
   * @param {string} factorId UUID do fator registrado
   * @param {string} code Código de 6 dígitos
   */
  async function challengeAndVerifyMfa(factorId, code) {
    const client = getClient();
    if (!client || !client.auth || !client.auth.mfa) {
      throw new Error('Supabase MFA indisponível.');
    }

    const cleanCode = String(code || '').trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      throw new Error('O código de autenticação deve possuir exatamente 6 dígitos numéricos.');
    }

    const { data, error } = await client.auth.mfa.challengeAndVerify({
      factorId: factorId,
      code: cleanCode
    });

    if (error) throw error;

    if (data && data.session && window.OlymposApp && typeof window.OlymposApp.atualizarTokenSessao === 'function') {
      window.OlymposApp.atualizarTokenSessao(data.session.access_token);
    }

    return data;
  }

  /**
   * Remove/desvincula um fator TOTP MFA previamente registrado.
   * @param {string} factorId UUID do fator
   */
  async function unenrollMfa(factorId) {
    const client = getClient();
    if (!client || !client.auth || !client.auth.mfa) {
      throw new Error('Supabase MFA indisponível.');
    }
    const { data, error } = await client.auth.mfa.unenroll({ factorId: factorId });
    if (error) throw error;
    return data;
  }

  /**
   * Retorna true se o perfil requer obrigatoriamente aal2 (TOTP MFA).
   */
  function isRoleMfaMandatory(role) {
    const r = String(role || '').toUpperCase();
    return r === 'ADMIN_GABINETE' || r === 'JURIDICO';
  }

  return {
    DEFAULT_PUBLIC_SUPABASE_URL: DEFAULT_PUBLIC_SUPABASE_URL,
    extrairUrlSupabaseDaChave: extrairUrlSupabaseDaChave,
    getConfig: getConfig,
    isConfigured: isConfigured,
    init: init,
    getClient: getClient,
    login: login,
    logout: logout,
    getSession: getSession,
    getJwtToken: getJwtToken,
    getCachedProfile: getCachedProfile,
    checkMfaStatus: checkMfaStatus,
    enrollMfaTotp: enrollMfaTotp,
    challengeAndVerifyMfa: challengeAndVerifyMfa,
    unenrollMfa: unenrollMfa,
    isRoleMfaMandatory: isRoleMfaMandatory,
    buscarPublicacoesSemanticas: buscarPublicacoesSemanticas,
    normalizarCategoriaInstitucional: normalizarCategoriaInstitucional,
    carregarEscolas: carregarEscolas,
    sincronizarEscola: sincronizarEscola,
    sincronizarCatalogoEscolasJson: sincronizarCatalogoEscolasJson,
    excluirEscola: excluirEscola,
    carregarSecretariasParceiras: carregarSecretariasParceiras,
    sincronizarSecretariaParceira: sincronizarSecretariaParceira,
    carregarAgendaEventos: carregarAgendaEventos,
    salvarAgendaEvento: salvarAgendaEvento,
    excluirAgendaEvento: excluirAgendaEvento,
    carregarNumeracaoGabinete: carregarNumeracaoGabinete,
    sincronizarNumeracaoGabinete: sincronizarNumeracaoGabinete,
    carregarPublicacoesDiario: carregarPublicacoesDiario
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
