/**
 * @fileoverview Roteador WebApp, Gateway de API V2 (doPost), Controle de Acesso (Login/Hash SHA-256) e Busca Global Multi-Ano Recursiva.
 * Versão 2.0.0 — Hub Olympos
 */

/**
 * Renderiza a Interface Unificada do Hub Olympos ou responde status em JSON.
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && (e.parameter.action || e.parameter.modulo)) || (e && e.parameter && e.parameter.api === '1' ? 'ping' : null);

    if (action === 'ping' || action === 'status' || action === 'health' || (e && e.parameter && e.parameter.api === '1')) {
      return responderJSON({
        ok: true,
        status: 'online',
        service: 'Projeto Olympos Gateway',
        timestamp: new Date().toISOString()
      });
    }

    if (e && e.parameter && e.parameter.action) {
      const payload = Object.assign({}, e.parameter);
      if (!payload.token) {
        payload.token = payload._token || payload.access_token || payload.sessionToken;
      }
      return responderJSON(rotearAcaoGatewayHub(payload));
    }

    const template = HtmlService.createTemplateFromFile('ui_index');
    return template.evaluate()
      .setTitle('Hub Olympos SMEB — Painel de Automações')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    console.error('Erro em doGet:', err);
    return responderJSON({
      ok: false,
      mensagem: 'Falha interna ao processar requisição no Gateway.',
      status: 'error',
      service: 'Projeto Olympos Gateway',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Comparação de strings em tempo constante para mitigar ataques de temporização (CWE-208).
 */
function compararTempoConstante_(strA, strB) {
  const a = String(strA || '');
  const b = String(strB || '');
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return diff === 0;
}

/**
 * Matriz de controle de acesso RBAC no servidor (defesa em profundidade contra bypass de UI — CWE-862).
 */
function verificarAutorizacaoRotaRbac_(action, sessaoAtiva) {
  const role = String(
    (sessaoAtiva && sessaoAtiva.perfil && (sessaoAtiva.perfil.id || sessaoAtiva.perfil.role)) ||
    (sessaoAtiva && sessaoAtiva.role) ||
    ''
  ).trim().toUpperCase();

  if (role === 'ADMIN_GABINETE') {
    return { ok: true };
  }

  const MATRIZ_ROTAS_POR_PAPEL = {
    // Rotas exclusivas do Gabinete / Moderador
    'atualizar_contador_md': ['ADMIN_GABINETE'],
    'memorias_salvar': ['ADMIN_GABINETE'],
    'memorias_limpar': ['ADMIN_GABINETE'],
    'snapshot_dedalo': ['ADMIN_GABINETE'],
    'prometheus_boletim_config_salvar': ['ADMIN_GABINETE'],
    'prometheus_config_emails': ['ADMIN_GABINETE'],
    'prometheus_organizar_planilhas': ['ADMIN_GABINETE'],
    'usuario_criar': ['ADMIN_GABINETE'],
    'supabase_sync': ['ADMIN_GABINETE'],

    // Rotas autorizadas para RH / Comissão e Jurídico (além de ADMIN_GABINETE)
    'portarias_gerar_lote': ['RH_COMISSAO'],
    'portarias_parar_lote': ['RH_COMISSAO'],
    'licenca_cadastrar': ['RH_COMISSAO'],
    'cadastrarLicencaDiretoHub': ['RH_COMISSAO'],
    'supabase_upsert_servidor': ['RH_COMISSAO'],
    'supabase_registrar_licenca': ['RH_COMISSAO'],
    'cadmo_disparar_coleta': ['RH_COMISSAO'],

    // Rotas autorizadas para Pedagógico & Eventos (além de ADMIN_GABINETE)
    'certificados_higienizar': ['PEDAGOGICO_EVENTOS'],
    'certificados_executar': ['PEDAGOGICO_EVENTOS'],

    // Rotas compartilhadas de expediente documental
    'oficio_emitir': ['RH_COMISSAO', 'PEDAGOGICO_EVENTOS', 'JURIDICO'],
    'reservar_numero_md': ['RH_COMISSAO', 'PEDAGOGICO_EVENTOS', 'JURIDICO']
  };

  const permitidos = MATRIZ_ROTAS_POR_PAPEL[action];
  if (!permitidos) {
    // Rotas autenticadas de consulta/diagnóstico permanecem liberadas para qualquer sessão autenticada válida
    return { ok: true };
  }

  if (permitidos.indexOf(role) !== -1) {
    return { ok: true };
  }

  return {
    ok: false,
    code: 'FORBIDDEN_RBAC',
    mensagem: 'Acesso negado: o perfil "' + (role || 'DESCONHECIDO') + '" não possui permissão para executar a ação "' + action + '".'
  };
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Normaliza as respostas do Gateway para garantir contrato consistente { ok: boolean, ... } em todas as frentes.
 */
function normalizarRespostaGateway_(obj) {
  if (obj === null || obj === undefined) {
    return { ok: false, mensagem: 'Resposta vazia do servidor.' };
  }
  if (Array.isArray(obj)) {
    return { ok: true, data: obj };
  }
  if (typeof obj === 'object') {
    if (obj.ok === undefined) {
      obj.ok = (obj.status !== 'ERROR' && obj.status !== 'FALHA');
    }
    return obj;
  }
  return { ok: true, resultado: obj };
}

/**
 * Validação de Assinatura Criptográfica HMAC-SHA256 enviada pela Edge Function gas-gateway.
 * Previne falsificação de requisições e ataques de repetição (Replay Attacks) com tolerância de 5 min.
 */
function verificarAssinaturaHmacGateway_(payload, secretToken) {
  if (!payload || !secretToken) {
    return false;
  }
  const signatureFornecida = payload.gateway_signature || payload.signature;
  const timestampFornecido = payload.gateway_timestamp || payload.timestamp;
  if (!signatureFornecida || !timestampFornecido) {
    return false;
  }

  // Janela anti-replay: rejeita se a requisição tiver mais de 5 minutos (300.000 ms)
  const agora = Date.now();
  const ts = Number(timestampFornecido);
  if (isNaN(ts) || Math.abs(agora - ts) > 300000) {
    console.warn('[verificarAssinaturaHmacGateway_] Timestamp expirado ou fora da tolerância anti-replay (5 min):', ts);
    return false;
  }

  const action = payload.action || payload.modulo || '';
  const dados = payload.dados || payload.data || {};
  const canonicalString = action + ':' + timestampFornecido + ':' + JSON.stringify(dados);

  try {
    const rawSig = Utilities.computeHmacSha256Signature(canonicalString, secretToken);
    const signatureHex = rawSig.map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
    return compararTempoConstante_(signatureHex, String(signatureFornecida).toLowerCase());
  } catch (e) {
    console.error('[verificarAssinaturaHmacGateway_] Falha ao computar HMAC:', e);
    return false;
  }
}

/**
 * Rate Limiter Distribuído de Custo Zero utilizando Google Apps Script CacheService.
 * Garante chaves <= 250 caracteres através de hashing SHA-256 seguro.
 *
 * @param {string} identificador IP, ID de usuário ou hash da sessão.
 * @param {string} acao Nome da rota executada.
 * @param {number} maximoTentativas Número máximo de requisições permitidas na janela.
 * @param {number} janelaSegundos Tempo de retenção da janela em segundos.
 * @returns {{ permitido: boolean, restantes: number, resetEm: number, mensagem?: string }}
 */
function verificarRateLimitGas_(identificador, acao, maximoTentativas, janelaSegundos) {
  if (!identificador || !acao) {
    return { permitido: true, restantes: maximoTentativas, resetEm: 0 };
  }

  const idLimpo = String(identificador).trim().toLowerCase();
  const rawChave = 'rl_' + acao + '_' + idLimpo;

  // Garante que a chave nunca exceda 250 caracteres (limite estrito do GAS)
  let cacheKey = rawChave;
  if (cacheKey.length > 200) {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cacheKey);
    const hashHex = digest.map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
    cacheKey = 'rl_' + acao + '_' + hashHex;
  }

  const cache = CacheService.getScriptCache();
  const valorAtual = cache.get(cacheKey);
  const contagem = valorAtual ? parseInt(valorAtual, 10) : 0;

  if (contagem >= maximoTentativas) {
    console.warn('[RateLimit GAS] Limite excedido para [' + acao + '] por [' + idLimpo + ']: ' + contagem + '/' + maximoTentativas);
    return {
      permitido: false,
      restantes: 0,
      resetEm: janelaSegundos,
      mensagem: 'Limite de operações excedido para a ação "' + acao + '". Por segurança, aguarde alguns minutos antes de tentar novamente.'
    };
  }

  // Incrementa contador e armazena na chave com expiração
  const novaContagem = contagem + 1;
  cache.put(cacheKey, String(novaContagem), janelaSegundos || 60);

  return {
    permitido: true,
    restantes: Math.max(0, maximoTentativas - novaContagem),
    resetEm: janelaSegundos
  };
}

/**
 * Roteador central unificado para chamadas HTTP (GitHub Pages / GitHub Actions via doPost)
 * e chamadas diretas de cliente GAS (google.script.run.executarAcaoHubClient).
 */
function rotearAcaoGatewayHub(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, mensagem: 'Payload inválido ou vazio.' };
  }

  const action = payload.action || payload.modulo;

  // 0. Ação pública de ping / status / healthcheck (sem autenticação)
  if (action === 'ping' || action === 'status' || action === 'health' || payload.api === '1') {
    return {
      ok: true,
      status: 'online',
      service: 'Projeto Olympos Gateway',
      timestamp: new Date().toISOString()
    };
  }

  // 1. Ações públicas de autenticação com rate limiting anti-força bruta
  if (action === 'auth_login') {
    const identLogin = payload.client_ip || payload.usuario || 'desconhecido';
    const rlLogin = verificarRateLimitGas_(identLogin, 'auth_login', 5, 900); // 5 tentativas / 15 min
    if (!rlLogin.permitido) {
      return { ok: false, code: 'RATE_LIMIT_EXCEEDED', mensagem: rlLogin.mensagem };
    }
    return autenticarUsuarioHub(payload.usuario, payload.senha);
  }

  if (action === 'usuario_criar') {
    const identCriar = payload.client_ip || payload.admin_id || payload.token || 'admin';
    const rlCriar = verificarRateLimitGas_(identCriar, 'usuario_criar', 10, 3600); // 10 cadastros / hora
    if (!rlCriar.permitido) {
      return { ok: false, code: 'RATE_LIMIT_EXCEEDED', mensagem: rlCriar.mensagem };
    }
  }

  if (action === 'auth_check') {
    return validarSessaoHub(payload.token || payload._token || payload.access_token || payload.sessionToken);
  }

  if (action === 'auth_jwt_verify') {
    return typeof SupabaseGasClient !== 'undefined'
      ? SupabaseGasClient.verifyToken(payload.jwtToken || payload.token || payload._token || payload.access_token)
      : { ok: false, mensagem: 'Módulo SupabaseGasClient não carregado.' };
  }

  // 2. Ações de integração do Gateway Edge ou Webhook Prometheus
  const tokenSecreto = PropertiesService.getScriptProperties().getProperty('OLYMPOS_SECRET_TOKEN');
  const isGatewayProxy = Boolean(tokenSecreto) && verificarAssinaturaHmacGateway_(payload, tokenSecreto);
  const tokenFornecido = payload.token || payload._token || payload.access_token;
  const isWebhookPrometheus = (
    Boolean(tokenSecreto) &&
    compararTempoConstante_(tokenFornecido, tokenSecreto) &&
    action === 'fogo_prometheus'
  );

  // 3. Ações públicas de leitura do painel (consultas estritamente somente-leitura, sem mutação em Drive/Sheets)
  const isAcaoLeituraPublica = (
    action === 'prometheus_status' ||
    action === 'prometheus_extrair_linhas' ||
    action === 'overview_get' ||
    action === 'carregarDadosVisaoGeralHub' ||
    action === 'cadmo_status'
  );

  // 4. Ações do Frontend Web (validadas por Gateway HMAC Fast-Path ou Token de Sessão/JWT Supabase + Autorização RBAC por Rota)
  let sessaoAtiva = null;
  if (!isWebhookPrometheus && !isAcaoLeituraPublica) {
    if (isGatewayProxy && payload.gateway_user_id) {
      // FAST PATH: Token já validado pelo Supabase na Edge Function gas-gateway.
      // Elimina o roundtrip externo de UrlFetchApp.fetch() poupando a cota diária do GAS!
      sessaoAtiva = {
        ok: true,
        usuario: payload.gateway_user_email || 'usuario@smeb.gov.br',
        nome: payload.gateway_user_email || 'Operador SMEB',
        userId: payload.gateway_user_id,
        perfil: OLYMPOS_IDS.PERFIS_RBAC[payload.gateway_user_role] || OLYMPOS_IDS.PERFIS_RBAC.RH_COMISSAO
      };
    } else {
      // SLOW PATH / CONTINGÊNCIA: Validação direta legada via CacheService ou Supabase REST
      const tokenSessao = payload.token || payload._token || payload.access_token || payload.sessionToken;
      sessaoAtiva = validarSessaoHub(tokenSessao);
    }

    if (!sessaoAtiva.ok) {
      return { ok: false, code: 'AUTH_REQUIRED', mensagem: 'Sessão expirada ou não autorizada. Faça login novamente via Supabase.' };
    }
    const checkRbac = verificarAutorizacaoRotaRbac_(action, sessaoAtiva);
    if (!checkRbac.ok) {
      return checkRbac;
    }
  }

  // Rate Limiting para ações de alto consumo de cotas (MailApp / DriveApp)
  if (action === 'prometheus_boletim_disparar' || action === 'prometheus_test_email') {
    const identEmail = (sessaoAtiva && (sessaoAtiva.userId || sessaoAtiva.usuario)) || 'admin';
    const rlEmail = verificarRateLimitGas_(identEmail, 'boletim_email', 3, 600); // 3 envios / 10 min
    if (!rlEmail.permitido) {
      return { ok: false, code: 'EMAIL_QUOTA_PROTECTION', mensagem: rlEmail.mensagem };
    }
  }

  if (action === 'certificados_executar' || action === 'portarias_gerar_lote') {
    const identLote = (sessaoAtiva && (sessaoAtiva.userId || sessaoAtiva.usuario)) || 'admin';
    const rlLote = verificarRateLimitGas_(identLote, action, 5, 3600); // 5 lotes / hora
    if (!rlLote.permitido) {
      return { ok: false, code: 'BATCH_QUOTA_PROTECTION', mensagem: rlLote.mensagem };
    }
  }

  if (action === 'fogo_prometheus') {
    const rlPrometheus = verificarRateLimitGas_('webhook_prometheus', 'fogo_prometheus', 30, 3600);
    if (!rlPrometheus.permitido) {
      return { ok: false, code: 'RATE_LIMIT_EXCEEDED', mensagem: rlPrometheus.mensagem };
    }
  }

  // Roteamento de Ações do Backend V2
  switch (action) {
    // Automação Diário Oficial (Fogo de Prometheus — Frente GAS + GitHub Actions)
    case 'fogo_prometheus':
      return normalizarRespostaGateway_(processarPacotePrometheus(payload));
    case 'olho_apolo_sync':
      return normalizarRespostaGateway_({ ok: true, numeracao: sincronizarNumeracaoApolo2026() });
    case 'prometheus_status':
      return normalizarRespostaGateway_({ ok: true, data: carregarPainelPrometheus() });
    case 'prometheus_extrair_linhas':
      return normalizarRespostaGateway_({ ok: true, data: extrairLinhasPlanilhasDiario(payload.limite || 15) });
    case 'prometheus_organizar_planilhas':
      return normalizarRespostaGateway_(padronizarNomesPlanilhasPastaDiario(payload.folderId));
    case 'prometheus_sync_manual':
      return normalizarRespostaGateway_(sincronizarManualPrometheusParaHelio());
    case 'prometheus_resumo_chat':
      return normalizarRespostaGateway_(dispararResumoGoogleChatManual());
    case 'prometheus_disparar_coleta':
      return normalizarRespostaGateway_(dispararColetaPrometheusRemota(payload.dataInicio, payload.dataFim));
    case 'prometheus_boletim_config_obter':
    case 'prometheus_get_config': {
      const props = PropertiesService.getScriptProperties();
      const destinatarios = props.getProperty('BOLETIM_DESTINATARIOS_EMAIL') ||
                            props.getProperty('EMAIL_PARTICULAR') ||
                            props.getProperty('EMAIL_RESUMO_PARTICULAR') || '';
      return normalizarRespostaGateway_({ ok: true, destinatarios: destinatarios });
    }
    case 'prometheus_boletim_config_salvar':
    case 'prometheus_config_emails': {
      const novos = String(payload.destinatarios || '').trim();
      const props = PropertiesService.getScriptProperties();
      props.setProperty('BOLETIM_DESTINATARIOS_EMAIL', novos);
      props.setProperty('EMAIL_PARTICULAR', novos);
      return normalizarRespostaGateway_({ ok: true, mensagem: 'Destinatários do Boletim Diário salvos com sucesso!' });
    }
    case 'prometheus_boletim_disparar':
    case 'prometheus_test_email':
      return normalizarRespostaGateway_(dispararBoletimEmailManual(payload.destinatarios));

    // Automação O Papiro de Cadmo (ETL Intermunicipal RN — Frente GAS + GitHub Actions)
    case 'cadmo_status':
      return normalizarRespostaGateway_({ ok: true, data: carregarPainelPapiroCadmo() });
    case 'cadmo_disparar_coleta':
      return normalizarRespostaGateway_(dispararColetaPapiroCadmoRemota(payload.competencia, payload.filtroEnte));

    // Visão Geral e Indicadores
    case 'overview_get':
    case 'carregarDadosVisaoGeralHub': {
      const perfilFiltro = sessaoAtiva && sessaoAtiva.perfil ? sessaoAtiva.perfil.id : (payload.perfilOverride || null);
      return normalizarRespostaGateway_({ ok: true, data: carregarDadosVisaoGeralHub(perfilFiltro) });
    }

    // Governança de Memórias .md
    case 'atualizar_contador_md': {
      const valorAlvo = payload.novo_valor !== undefined
        ? payload.novo_valor
        : {
            proximoOficio2026: payload.novo_oficio,
            proximaPortaria2026: payload.nova_portaria,
            signatarioTitular: payload.novo_signatario
          };
      return normalizarRespostaGateway_({
        ok: true,
        numeracao: atualizarContadorManualApolo(payload.tipo || 'GERAL', valorAlvo, payload.motivo)
      });
    }
    case 'reservar_numero_md':
      return normalizarRespostaGateway_(reservarProximoNumeroDocumentoApolo(payload.tipo, payload.detalhe));
    case 'registrar_recado_md':
      return normalizarRespostaGateway_(registrarAlertaMemoriaOlympos(payload.arquivo_md || payload.arquivo, payload.linha));
    case 'memorias_salvar':
      return normalizarRespostaGateway_(salvarEdicaoMemoriaOlympos(payload.arquivo, payload.conteudo));
    case 'memorias_limpar':
      return normalizarRespostaGateway_(limparPendenciasMemoriaOlympos(payload.arquivo));
    case 'snapshot_dedalo':
      return normalizarRespostaGateway_(gerarSnapshotSemanalMemoriasDedalo());

    // Pincel de Homero (Portarias, Ofícios & Licenças)
    case 'portarias_catalogo':
      return normalizarRespostaGateway_(listarPlanilhasEAbaPincel(payload.operacao));
    case 'portarias_dry_run':
      return normalizarRespostaGateway_(executarDiagnosticoPincelHomero(payload.spreadsheetId, payload.sheetName, payload.operacao));
    case 'portarias_ler_planilha':
    case 'portarias_obter_dados':
      return normalizarRespostaGateway_(obterDadosLinhasPlanilhaPincel(payload.spreadsheetId, payload.sheetName, payload.operacao, payload.limiteLinhas));
    case 'portarias_gerar_lote':
      return normalizarRespostaGateway_(iniciarGeracaoLotePincelHomero(payload.spreadsheetId, payload.sheetName, payload.operacao));
    case 'portarias_status_lote':
      return normalizarRespostaGateway_(obterStatusLotePincelHomero());
    case 'portarias_parar_lote':
      return normalizarRespostaGateway_(pararGeracaoLotePincelHomero());
    case 'licenca_cadastrar':
    case 'cadastrarLicencaDiretoHub':
      return normalizarRespostaGateway_(cadastrarLicencaDiretoHub(payload.dados || payload));
    case 'oficio_emitir':
      return normalizarRespostaGateway_(gerarOficioPadraoHomero(payload.dadosOficio || payload));

    // Lira de Orfeu (Certificados & Declarações)
    case 'certificados_catalogo':
      return normalizarRespostaGateway_(listarPlanilhasLiraOrfeu());
    case 'certificados_higienizar':
      return normalizarRespostaGateway_(higienizarAbaLiraRemoto(payload.spreadsheetId, payload.sheetName));
    case 'certificados_executar':
      return normalizarRespostaGateway_(executarLoteLiraOrfeuRemoto(payload.spreadsheetId, payload.sheetName, payload.modalidade));

    // Integração e Sincronização Supabase & Gestão de Usuários RBAC
    case 'usuario_criar': {
      const roleSessao = (sessaoAtiva && sessaoAtiva.perfil && (sessaoAtiva.perfil.id || sessaoAtiva.perfil.role)) || '';
      if (!sessaoAtiva || !sessaoAtiva.ok || roleSessao !== 'ADMIN_GABINETE') {
        return {
          ok: false,
          code: 'FORBIDDEN',
          mensagem: 'Acesso negado: apenas o Moderador (ADMIN_GABINETE) pode cadastrar novos usuários.'
        };
      }
      const dadosCriacao = payload.dados || payload;
      const autorUid = sessaoAtiva.userId || sessaoAtiva.usuario || 'ADMIN_GABINETE';
      return normalizarRespostaGateway_(
        typeof SupabaseGasClient !== 'undefined'
          ? SupabaseGasClient.criarUsuarioAdmin(dadosCriacao, autorUid)
          : { ok: false, mensagem: 'SupabaseGasClient não disponível.' }
      );
    }
    case 'supabase_sync':
      return normalizarRespostaGateway_(typeof SupabaseGasClient !== 'undefined' ? SupabaseGasClient.sincronizarComSupabase() : { ok: false, mensagem: 'SupabaseGasClient não disponível.' });
    case 'supabase_upsert_servidor':
      return normalizarRespostaGateway_(typeof SupabaseGasClient !== 'undefined' ? SupabaseGasClient.upsertServidor(payload.servidor || payload.dados) : { ok: false, mensagem: 'SupabaseGasClient não disponível.' });
    case 'supabase_registrar_licenca':
      return normalizarRespostaGateway_(typeof SupabaseGasClient !== 'undefined' ? SupabaseGasClient.registrarLicenca(payload.licenca || payload.dados) : { ok: false, mensagem: 'SupabaseGasClient não disponível.' });

    // Busca Global Unificada
    case 'busca_global':
    case 'pesquisarAcervoGlobalMultiAno':
      return normalizarRespostaGateway_(pesquisarAcervoGlobalMultiAno(payload.termo, payload.filtroAno));

    default:
      return { ok: false, mensagem: `Ação desconhecida: ${action}` };
  }
}

/**
 * Ponto de entrada unificado para chamadas via google.script.run quando a interface é aberta diretamente no GAS.
 */
function executarAcaoHubClient(payload) {
  try {
    return rotearAcaoGatewayHub(payload || {});
  } catch (err) {
    console.error('Erro em executarAcaoHubClient:', err);
    return { ok: false, mensagem: err.message };
  }
}

/**
 * Gateway de API JSON para o Frontend desacoplado (GitHub Pages), Fogo de Prometheus e extensões.
 * Suporta CORS Simple Requests (POST com Content-Type: text/plain;charset=utf-8 e body JSON).
 * Nunca lança exceção não tratada, sempre retornando ContentService com MIME JSON.
 */
function doPost(e) {
  try {
    let payload = {};

    // 1. Suporte a CORS Simple Request: lê JSON em postData.contents (Content-Type: text/plain;charset=utf-8)
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        if (e.parameter && Object.keys(e.parameter).length > 0) {
          payload = Object.assign({}, e.parameter);
        } else {
          return responderJSON({
            ok: false,
            mensagem: 'JSON inválido no corpo da requisição: ' + jsonErr.message,
            status: 'error',
            service: 'Projeto Olympos Gateway',
            timestamp: new Date().toISOString()
          });
        }
      }
    } else if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      payload = Object.assign({}, e.parameter);
    } else {
      return responderJSON({
        ok: false,
        mensagem: 'Payload ausente na requisição POST.',
        status: 'error',
        service: 'Projeto Olympos Gateway',
        timestamp: new Date().toISOString()
      });
    }

    // 2. Mescla query parameters com body payload para suportar parâmetros via URL
    if (e && e.parameter) {
      for (const key in e.parameter) {
        if (payload[key] === undefined) {
          payload[key] = e.parameter[key];
        }
      }
    }

    // 3. Lê token do body, query param ou headers defensivamente
    if (!payload.token) {
      payload.token = payload._token || payload.access_token || payload.sessionToken;
    }
    if (!payload.token && e && e.parameter) {
      payload.token = e.parameter.token || e.parameter._token || e.parameter.access_token;
    }
    if (!payload.token && e && e.headers) {
      const authHeader = e.headers['authorization'] || e.headers['Authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        payload.token = authHeader.substring(7).trim();
      } else if (authHeader) {
        payload.token = authHeader.trim();
      }
    }

    // 4. Captura assinaturas HMAC de cabeçalho do Edge Gateway (x-olympos-signature e timestamp)
    if (e && e.headers) {
      if (!payload.gateway_signature) {
        payload.gateway_signature = e.headers['x-olympos-signature'] || e.headers['X-Olympos-Signature'] ||
                                    e.headers['x-olympos-gateway-signature'] || e.headers['X-Olympos-Gateway-Signature'];
      }
      if (!payload.gateway_timestamp) {
        payload.gateway_timestamp = e.headers['x-olympos-timestamp'] || e.headers['X-Olympos-Timestamp'] ||
                                    e.headers['x-olympos-gateway-timestamp'] || e.headers['X-Olympos-Gateway-Timestamp'];
      }
    }

    const resultado = rotearAcaoGatewayHub(payload);
    return responderJSON(resultado);
  } catch (err) {
    console.error('Erro crítico no gateway doPost:', err);
    return responderJSON({
      ok: false,
      mensagem: 'Falha interna ao processar requisição no Gateway.',
      status: 'error',
      service: 'Projeto Olympos Gateway',
      timestamp: new Date().toISOString()
    });
  }
}

function responderJSON(obj, statusHttp) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Autentica o usuário com base em senha/hash.
 * Suporta integração com Planilha de Acessos futura ou credenciais setoriais seguras de inicialização.
 */
function autenticarUsuarioHub(usuario, senha) {
  const userLimpo = String(usuario || '').trim().toLowerCase();
  const passLimpa = String(senha || '').trim();

  if (!userLimpo || !passLimpa) {
    return { ok: false, mensagem: 'Informe usuário e senha para acessar.' };
  }

  const props = PropertiesService.getScriptProperties();
  const planilhaAcessosId = props.getProperty('OLYMPOS_ACESSOS_SHEET_ID') || OLYMPOS_IDS.PLANILHA_ACESSOS_ID;
  let usuarioAutenticado = null;

  // 1. Verificação na Planilha de Acessos caso configurada
  if (planilhaAcessosId) {
    try {
      const ss = SpreadsheetApp.openById(planilhaAcessosId);
      const sheet = ss.getSheetByName('Acessos') || ss.getSheets()[0];
      const rows = sheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        const u = String(rows[i][0] || '').trim().toLowerCase();
        const nome = String(rows[i][1] || '').trim();
        const perfilId = String(rows[i][2] || '').trim().toUpperCase();
        const hashArmazenado = String(rows[i][3] || '').trim();
        const salt = String(rows[i][4] || '').trim();
        const ativo = String(rows[i][5] || 'SIM').trim().toUpperCase();

        if (u === userLimpo) {
          if (ativo !== 'SIM' && ativo !== 'ATIVO' && ativo !== 'TRUE') {
            return { ok: false, mensagem: 'Este usuário está inativo ou suspenso.' };
          }

          // Validação estrita de hash SHA-256 com salt em tempo constante (sem fallback em texto plano)
          const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, passLimpa + salt);
          const hashCalculado = rawHash.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

          if (hashArmazenado.length === 64 && compararTempoConstante_(hashCalculado, hashArmazenado.toLowerCase())) {
            usuarioAutenticado = {
              usuario: u,
              nome: nome || u,
              perfilId: perfilId in OLYMPOS_IDS.PERFIS_RBAC ? perfilId : 'PEDAGOGICO_EVENTOS'
            };
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Aviso ao consultar planilha de acessos:', e);
    }
  }

  // 2. Validação e Autenticação integrada com Supabase Auth
  if (!usuarioAutenticado && typeof SupabaseGasClient !== 'undefined' && SupabaseGasClient.estaConfigurado()) {
    try {
      const cfg = SupabaseGasClient.getConfig();
      const endpoint = cfg.url + '/auth/v1/token?grant_type=password';
      const emailFinal = userLimpo.includes('@') ? userLimpo : (userLimpo + '@smeb.exemplo.gov.br');
      const options = {
        method: 'POST',
        headers: {
          'apikey': cfg.anonKey || cfg.serviceRoleKey,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          email: emailFinal,
          password: passLimpa
        }),
        muteHttpExceptions: true
      };

      const res = UrlFetchApp.fetch(endpoint, options);
      if (res.getResponseCode() === 200) {
        const authData = JSON.parse(res.getContentText());
        const user = authData.user;
        const perfil = SupabaseGasClient.obterPerfilUsuario(user.id);
        const perfilId = (perfil && perfil.role) || (user.app_metadata && user.app_metadata.role) || 'RH_COMISSAO';

        usuarioAutenticado = {
          usuario: user.email,
          nome: (perfil && (perfil.full_name || perfil.nome_completo)) || user.email,
          perfilId: perfilId in OLYMPOS_IDS.PERFIS_RBAC ? perfilId : 'ADMIN_GABINETE',
          jwtToken: authData.access_token
        };
      }
    } catch (eSupabase) {
      console.warn('[autenticarUsuarioHub] Falha ao consultar Supabase Auth:', eSupabase);
    }
  }

  if (!usuarioAutenticado) {
    return { ok: false, mensagem: 'Credenciais inválidas. Verifique seu e-mail e senha cadastrados no Supabase Auth.' };
  }

  // 3. Emissão de Token de Sessão em CacheService (6 horas com chave segura <= 250 chars)
  const sessionToken = usuarioAutenticado.jwtToken || ('tok_' + Utilities.getUuid().replace(/-/g, ''));
  const perfilInfo = OLYMPOS_IDS.PERFIS_RBAC[usuarioAutenticado.perfilId] || OLYMPOS_IDS.PERFIS_RBAC.ADMIN_GABINETE;

  const dadosSessao = {
    usuario: usuarioAutenticado.usuario,
    nome: usuarioAutenticado.nome,
    perfil: perfilInfo,
    emitidoEm: new Date().toISOString()
  };

  try {
    const cacheKey = gerarCacheKeyToken_(sessionToken);
    const cache = CacheService.getScriptCache();
    cache.put(cacheKey, JSON.stringify(dadosSessao), 21600); // 6 horas
  } catch (eCache) {
    console.warn('[autenticarUsuarioHub] Aviso ao armazenar sessão no CacheService:', eCache);
  }

  return {
    ok: true,
    token: sessionToken,
    usuario: usuarioAutenticado.usuario,
    nome: usuarioAutenticado.nome,
    perfil: perfilInfo,
    mensagem: `Bem-vindo(a), ${usuarioAutenticado.nome}!`
  };
}

/**
 * Gera chave segura para CacheService (limite do Google Apps Script: 250 caracteres).
 * Para tokens extensos (ex.: JWT Supabase de 800+ caracteres), gera digest SHA-256 de 64 caracteres.
 */
function gerarCacheKeyToken_(token) {
  if (!token) return '';
  const str = String(token).trim();
  if (str.length <= 150) {
    return str;
  }
  try {
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str);
    return 'jwt_' + raw.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  } catch (e) {
    return 'tok_' + str.substring(0, 40) + '_' + str.length;
  }
}

/**
 * Valida o Token de Sessão no CacheService ou via Supabase JWT.
 * Previne rigorosamente o erro GAS "Argumento grande demais: key".
 */
function validarSessaoHub(token) {
  if (!token) return { ok: false, mensagem: 'Token não fornecido.' };
  const cleanToken = String(token).trim();

  // 1. Verificação primária no CacheService com chave encurtada/segura
  try {
    const cacheKey = gerarCacheKeyToken_(cleanToken);
    const cache = CacheService.getScriptCache();
    const raw = cache.get(cacheKey);
    if (raw) {
      const dados = JSON.parse(raw);
      return {
        ok: true,
        usuario: dados.usuario,
        nome: dados.nome,
        perfil: dados.perfil
      };
    }
  } catch (eCache) {
    // Continua para verificação direta via Supabase Auth
  }

  // 2. Validação direta via Supabase Auth (se for JWT ou contingência)
  if (typeof SupabaseGasClient !== 'undefined' && (cleanToken.startsWith('eyJ') || cleanToken.indexOf('.') !== -1)) {
    try {
      const resJwt = SupabaseGasClient.verifyToken(cleanToken);
      if (resJwt && resJwt.ok) {
        const role = (resJwt.perfil && (resJwt.perfil.role || resJwt.perfil.perfilId)) || 'RH_COMISSAO';
        const perfilInfo = OLYMPOS_IDS.PERFIS_RBAC[role] || OLYMPOS_IDS.PERFIS_RBAC.RH_COMISSAO;
        const infoSessao = {
          ok: true,
          usuario: resJwt.email,
          nome: (resJwt.perfil && (resJwt.perfil.full_name || resJwt.perfil.nome_completo)) || resJwt.email,
          perfil: perfilInfo,
          userId: resJwt.userId
        };

        // Cacheia resultado com chave segura para evitar roundtrips excessivos
        try {
          const cacheKey = gerarCacheKeyToken_(cleanToken);
          CacheService.getScriptCache().put(cacheKey, JSON.stringify(infoSessao), 3600); // 1 hora
        } catch (ePut) {}

        return infoSessao;
      }
    } catch (eJwt) {
      console.warn('[validarSessaoHub] Erro ao validar JWT no Supabase:', eJwt);
    }
  }

  return { ok: false, mensagem: 'Sessão inválida ou expirada.' };
}

/**
 * Resolve o perfil de acesso RBAC por sessão ou e-mail.
 */
function obterPerfilUsuarioAtivo(perfilOverrideOpt) {
  let email = '';
  try {
    if (typeof Session !== 'undefined' && Session.getActiveUser) {
      email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    }
  } catch (e) {}

  const perfis = OLYMPOS_IDS.PERFIS_RBAC;
  let perfilId = perfilOverrideOpt || '';

  if (!perfilId && email) {
    if (email.includes('evento') || email.includes('pedagog') || email.includes('formacao')) {
      perfilId = 'PEDAGOGICO_EVENTOS';
    } else if (email.includes('rh') || email.includes('pessoal') || email.includes('comissao')) {
      perfilId = 'RH_COMISSAO';
    } else if (email.includes('juridico') || email.includes('procuradoria')) {
      perfilId = 'JURIDICO';
    }
  }

  const perfilEscolhido = perfis[perfilId] || perfis.ADMIN_GABINETE;

  return {
    email: email || 'usuario@smeb.cearamirim.rn.gov.br',
    perfilId: perfilEscolhido.id,
    nomePerfil: perfilEscolhido.nome,
    abasPermitidas: perfilEscolhido.abasPermitidas,
    podeEditarMemorias: perfilEscolhido.podeEditarMemorias,
    podeGerarSnapshot: perfilEscolhido.podeGerarSnapshot,
    podeCadastrarLicenca: perfilEscolhido.podeCadastrarLicenca,
    perfisDisponiveis: Object.keys(perfis).map(k => ({
      id: perfis[k].id,
      nome: perfis[k].nome
    }))
  };
}

/**
 * Busca Global Unificada Multi-Ano Recursiva (Acervo 2025 + Pastas Ativas 2026).
 * Corrige o problema relatado: busca por tokens flexíveis (ex: "portaria 163" localiza "Portaria_163_2026"),
 * explora subpastas até 2 níveis e remove IDs técnicos dos resultados.
 * @param {string} termoBusca Termo parcial do arquivo, servidor ou número.
 * @param {string} [filtroAno] 'TODOS', '2026' ou '2025'.
 */
function pesquisarAcervoGlobalMultiAno(termoBusca, filtroAno) {
  const termoLimpo = String(termoBusca || '').trim();
  const termoNorm = termoLimpo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Decompõe a pesquisa em tokens para match independente da ordem e de separadores
  const tokens = termoNorm
    .replace(/[_\-.\/]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  const anoAlvo = String(filtroAno || 'TODOS').toUpperCase();
  const pastasIniciais = [];

  if (anoAlvo === 'TODOS' || anoAlvo === '2026') {
    Object.keys(OLYMPOS_IDS.SETORES_2026).forEach(chaveSetor => {
      pastasIniciais.push({
        ano: '2026',
        setor: `${chaveSetor.replace(/_/g, ' ')} (2026)`,
        folderId: OLYMPOS_IDS.SETORES_2026[chaveSetor],
        nivel: 0
      });
    });
  }

  if (anoAlvo === 'TODOS' || anoAlvo === '2025') {
    Object.keys(OLYMPOS_IDS.ACERVO_2025).forEach(chaveAcervo => {
      pastasIniciais.push({
        ano: '2025',
        setor: `Acervo ${chaveAcervo.replace(/_/g, ' ')} (2025)`,
        folderId: OLYMPOS_IDS.ACERVO_2025[chaveAcervo],
        nivel: 0
      });
    });
  }

  const resultados = [];
  const filaPastas = [...pastasIniciais];
  let pastasVaridas = 0;

  while (filaPastas.length > 0 && pastasVaridas < 30 && resultados.length < 50) {
    const item = filaPastas.shift();
    pastasVaridas++;

    try {
      const folder = DriveApp.getFolderById(item.folderId);
      if (!folder) continue;

      // 1. Varrer arquivos na pasta atual
      const files = folder.getFiles();
      let inspecionados = 0;

      while (files.hasNext() && inspecionados < 100 && resultados.length < 50) {
        const f = files.next();
        inspecionados++;
        const nomeOriginal = f.getName();
        const nomeNorm = String(nomeOriginal)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[_\-.\/]/g, ' ');

        let matches = false;
        if (tokens.length === 0 || termoNorm === '*') {
          matches = true;
        } else {
          // Todos os tokens informados devem estar presentes no nome normalizado
          matches = tokens.every(token => nomeNorm.includes(token));
        }

        if (matches) {
          const dt = f.getDateCreated ? f.getDateCreated() : new Date();
          resultados.push({
            nome: nomeOriginal,
            ano: item.ano,
            setor: item.setor,
            dataCriacao: Utilities.formatDate(dt, 'America/Fortaleza', 'dd/MM/yyyy'),
            timestamp: dt.getTime ? dt.getTime() : 0,
            url: f.getUrl ? f.getUrl() : ''
          });
        }
      }

      // 2. Se nível de recursão permitir (máximo 1 nível de subpastas para performance segura)
      if (item.nivel < 1) {
        const subfolders = folder.getFolders();
        while (subfolders.hasNext() && filaPastas.length < 40) {
          const sf = subfolders.next();
          filaPastas.push({
            ano: item.ano,
            setor: `${item.setor} ➔ ${sf.getName()}`,
            folderId: sf.getId(),
            nivel: item.nivel + 1
          });
        }
      }
    } catch (e) {
      console.warn(`Aviso ao pesquisar pasta ${item.setor}:`, e);
    }
  }

  // Ordena prioritariamente por data mais recente
  resultados.sort((a, b) => b.timestamp - a.timestamp);

  return {
    ok: true,
    termo: termoBusca,
    filtroAno: anoAlvo,
    totalEncontrados: resultados.length,
    resultados: resultados.slice(0, 35)
  };
}

/**
 * Carrega os dados consolidados da Aba 1 (Visão Geral, Olho de Apolo, Cota MailApp, RBAC e 11 Memórias .md).
 */
function carregarDadosVisaoGeralHub(perfilOverrideOpt) {
  let cotaEmail = 0;
  try {
    cotaEmail = MailApp.getRemainingDailyQuota();
  } catch (e) {
    console.warn('Falha ao ler cota MailApp:', e);
  }

  const numeracao = obterOuSincronizarNumeracaoApolo(false);
  const memorias = listarTodasMemoriasOlympos();
  const statusPrometheus = obterStatusWebhookPrometheus();
  const perfilRbac = obterPerfilUsuarioAtivo(perfilOverrideOpt);

  return {
    cotaEmailRestante: cotaEmail,
    numeracao: numeracao,
    memorias: memorias,
    personasExtras: OLYMPOS_IDS.PERSONAS_EXTRAS || [],
    linksOficiais: OLYMPOS_IDS.LINKS_OFICIAIS_UI || {},
    statusPrometheus: statusPrometheus,
    perfilRbac: perfilRbac,
    atualizadoEm: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss')
  };
}
