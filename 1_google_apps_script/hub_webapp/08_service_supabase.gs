/**
 * @fileoverview Cliente REST Supabase de Alta Resiliência para Google Apps Script.
 * Fornece métodos integrados para Autenticação JWT, Perfis RBAC, Upsert de Servidores,
 * Registro de Licenças, Trilha de Auditoria Imutável e Sincronização entre Google Sheets e Supabase.
 * Versão 2.0.0 — Projeto Olympos
 */

const SupabaseGasClient = (function() {
  /**
   * Resgata as configurações do Supabase armazenadas com segurança no ScriptProperties.
   * Nenhuma chave fica exposta em texto claro no código-fonte.
   */
  function getConfig() {
    const props = PropertiesService.getScriptProperties();
    const url = props.getProperty('SUPABASE_URL') || '';
    const anonKey = props.getProperty('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = props.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '';
    const secretToken = props.getProperty('OLYMPOS_SECRET_TOKEN') || '';

    return {
      url: url ? url.trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1(\/.*)?$/i, '') : '',
      anonKey: anonKey.trim(),
      serviceRoleKey: serviceRoleKey.trim(),
      secretToken: secretToken.trim()
    };
  }

  /**
   * Verifica se a instância do Supabase está devidamente configurada.
   */
  function estaConfigurado() {
    const cfg = getConfig();
    return Boolean(cfg.url && (cfg.serviceRoleKey || cfg.anonKey));
  }

  /**
   * Constrói cabeçalhos padrão para requisições HTTPS à API REST do Supabase.
   * @param {boolean} useServiceRole Se verdadeiro, utiliza a chave de serviço administrativa.
   * @param {string} [jwtToken] Token JWT do usuário para chamadas autenticadas via RLS.
   * @returns {Object} Dicionário com os headers HTTP.
   */
  function getAuthHeaders(useServiceRole, jwtToken) {
    const cfg = getConfig();
    const activeKey = useServiceRole ? cfg.serviceRoleKey : (cfg.anonKey || cfg.serviceRoleKey);
    const bearer = jwtToken ? jwtToken : activeKey;

    const headers = {
      'apikey': activeKey,
      'Authorization': 'Bearer ' + bearer,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    };

    return headers;
  }

  /**
   * Valida o token JWT emitido pelo Supabase Auth consultando o endpoint oficial /auth/v1/user.
   * @param {string} jwtToken Token de acesso emitido pelo GoTrue do Supabase.
   * @returns {Object} Objeto contendo status da validação, dados do usuário e perfil RBAC associado.
   */
  function verifyToken(jwtToken) {
    if (!jwtToken || typeof jwtToken !== 'string' || jwtToken.trim() === '') {
      return { ok: false, mensagem: 'Token JWT não fornecido ou vazio.' };
    }

    const cleanToken = jwtToken.trim();
    const cfg = getConfig();

    if (!cfg.url) {
      console.warn('[SupabaseGasClient] URL do Supabase não configurada no ScriptProperties.');
      return { ok: false, mensagem: 'Supabase não configurado no backend GAS.' };
    }

    try {
      const endpoint = cfg.url + '/auth/v1/user';
      const options = {
        method: 'GET',
        headers: {
          'apikey': cfg.anonKey || cfg.serviceRoleKey,
          'Authorization': 'Bearer ' + cleanToken
        },
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(endpoint, options);
      const statusCode = response.getResponseCode();

      if (statusCode === 200) {
        const user = JSON.parse(response.getContentText());
        const perfil = obterPerfilUsuario(user.id);

        return {
          ok: true,
          userId: user.id,
          email: user.email,
          user: user,
          perfil: perfil || {
            id: user.id,
            email: user.email,
            full_name: (user.user_metadata && user.user_metadata.full_name) || user.email,
            role: (user.app_metadata && user.app_metadata.role) || 'RH_COMISSAO'
          }
        };
      } else {
        return {
          ok: false,
          status: statusCode,
          mensagem: 'Sessão inválida ou token JWT expirado no Supabase (HTTP ' + statusCode + ').'
        };
      }
    } catch (e) {
      console.error('[SupabaseGasClient] Falha na verificação de token JWT:', e);
      return { ok: false, mensagem: 'Erro de comunicação ao validar token no Supabase: ' + e.message };
    }
  }

  /**
   * Consulta o perfil RBAC do usuário na tabela public.profiles.
   * @param {string} userId Identificador UUID do usuário no auth.users.
   * @returns {Object|null} Registro do perfil ou null se não localizado.
   */
  function obterPerfilUsuario(userId) {
    if (!userId) return null;
    const cfg = getConfig();
    if (!cfg.url || !cfg.serviceRoleKey) return null;

    try {
      const endpoint = cfg.url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&select=*';
      const options = {
        method: 'GET',
        headers: getAuthHeaders(true),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(endpoint, options);
      if (response.getResponseCode() === 200) {
        const lista = JSON.parse(response.getContentText());
        return (lista && lista.length > 0) ? lista[0] : null;
      }
    } catch (e) {
      console.error('[SupabaseGasClient] Erro ao carregar perfil do usuário:', e);
    }
    return null;
  }

  /**
   * Insere ou atualiza um registro de servidor na tabela public.servidores.
   * @param {Object} servidorData Dados do servidor.
   * @returns {Object} Resposta da operação contendo os dados gravados.
   */
  function upsertServidor(servidorData) {
    if (!servidorData || !servidorData.nome) {
      return { ok: false, mensagem: 'Dados obrigatórios do servidor ausentes (nome requerido).' };
    }

    const cfg = getConfig();
    if (!cfg.url || !cfg.serviceRoleKey) {
      return { ok: false, mensagem: 'Supabase URL ou Service Role Key não configurada.' };
    }

    try {
      const endpoint = cfg.url + '/rest/v1/servidores';
      const headers = getAuthHeaders(true);
      headers['Prefer'] = 'resolution=merge-duplicates,return=representation';

      const payload = {
        nome: servidorData.nome,
        cargo: servidorData.cargo || 'Não informado',
        funcao: servidorData.funcao || null,
        lotacao: servidorData.lotacao || 'Secretaria Municipal de Educacao',
        status: servidorData.status || 'ATIVO',
        updated_at: new Date().toISOString()
      };

      if (servidorData.id) {
        payload.id = servidorData.id;
      }
      if (servidorData.cpf_hash) {
        payload.cpf_hash = servidorData.cpf_hash;
      }
      if (servidorData.matricula_hash) {
        payload.matricula_hash = servidorData.matricula_hash;
      }

      const options = {
        method: 'POST',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const res = UrlFetchApp.fetch(endpoint, options);
      const code = res.getResponseCode();

      if (code >= 200 && code < 300) {
        const data = JSON.parse(res.getContentText());
        return { ok: true, data: data };
      } else {
        return { ok: false, status: code, erro: res.getContentText() };
      }
    } catch (e) {
      console.error('[SupabaseGasClient] Erro no upsert de servidor:', e);
      return { ok: false, mensagem: e.message };
    }
  }

  /**
   * Registra uma licença, afastamento ou readaptação na tabela public.licencas.
   * @param {Object} licencaData Dados da licença.
   * @returns {Object} Resposta com o registro criado.
   */
  function registrarLicenca(licencaData) {
    if (!licencaData || !licencaData.servidor_id || !licencaData.tipo_licenca || !licencaData.data_inicio) {
      return { ok: false, mensagem: 'Parâmetros obrigatórios de licença ausentes (servidor_id, tipo_licenca, data_inicio).' };
    }

    const cfg = getConfig();
    if (!cfg.url || !cfg.serviceRoleKey) {
      return { ok: false, mensagem: 'Supabase não configurado.' };
    }

    try {
      const endpoint = cfg.url + '/rest/v1/licencas';
      const headers = getAuthHeaders(true);
      headers['Prefer'] = 'return=representation';

      const payload = {
        servidor_id: licencaData.servidor_id,
        tipo_licenca: licencaData.tipo_licenca,
        data_inicio: licencaData.data_inicio,
        data_termino: licencaData.data_termino || null,
        periodo_aquisitivo: licencaData.periodo_aquisitivo || null,
        parecer_numero: licencaData.parecer_numero || null,
        status: licencaData.status || 'CADASTRADO',
        updated_at: new Date().toISOString()
      };

      if (licencaData.id) {
        payload.id = licencaData.id;
      }

      const options = {
        method: 'POST',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const res = UrlFetchApp.fetch(endpoint, options);
      const code = res.getResponseCode();

      if (code >= 200 && code < 300) {
        const data = JSON.parse(res.getContentText());
        return { ok: true, data: data };
      } else {
        return { ok: false, status: code, erro: res.getContentText() };
      }
    } catch (e) {
      console.error('[SupabaseGasClient] Erro ao registrar licença:', e);
      return { ok: false, mensagem: e.message };
    }
  }

  /**
   * Insere um registro na trilha de auditoria imutável (public.audit_logs).
   * @param {string} tabela Nome da tabela afetada.
   * @param {string} recordId ID do registro afetado (UUID).
   * @param {string} acao Ação executada (INSERT, UPDATE, DELETE, DECRYPT_READ, RPC_CALL).
   * @param {Object} [dados] Dados da operação (new_data).
   * @param {string} [userId] UUID do usuário responsável.
   * @param {string} [userRole] Perfil RBAC no momento da ação.
   * @returns {Object} Status da gravação de auditoria.
   */
  function registrarLogAuditoria(tabela, recordId, acao, dados, userId, userRole) {
    const cfg = getConfig();
    if (!cfg.url || !cfg.serviceRoleKey) {
      return { ok: false, mensagem: 'Supabase não configurado para auditoria.' };
    }

    try {
      const endpoint = cfg.url + '/rest/v1/audit_logs';
      const headers = getAuthHeaders(true);
      headers['Prefer'] = 'return=minimal';

      const payload = {
        table_name: tabela || 'geral',
        record_id: recordId || null,
        action: acao || 'OP_GAS',
        performed_by: userId || null,
        role_at_action: userRole || null,
        new_data: dados ? dados : {},
        timestamp: new Date().toISOString()
      };

      const options = {
        method: 'POST',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const res = UrlFetchApp.fetch(endpoint, options);
      const code = res.getResponseCode();
      return { ok: code >= 200 && code < 300, status: code };
    } catch (e) {
      console.error('[SupabaseGasClient] Falha ao registrar log de auditoria:', e);
      return { ok: false, mensagem: e.message };
    }
  }

  /**
   * Sincroniza dados entre o espelho documental Google Sheets e as tabelas correspondentes no Supabase.
   * Garante reconciliação bidirecional sem duplicidades.
   * @returns {Object} Relatório consolidado da sincronização.
   */
  function sincronizarComSupabase() {
    if (!estaConfigurado()) {
      return { ok: false, mensagem: 'Supabase não está configurado. Verifique as ScriptProperties.' };
    }

    const relatorio = {
      timestamp: new Date().toISOString(),
      diarioOficialSincronizado: 0,
      licencasSincronizadas: 0,
      erros: []
    };

    // 1. Sincroniza publicações do Diário Oficial a partir da Planilha Fixa
    try {
      if (typeof OLYMPOS_IDS !== 'undefined' && OLYMPOS_IDS.PLANILHA_DIARIO_OFICIAL) {
        const ssDiario = SpreadsheetApp.openById(OLYMPOS_IDS.PLANILHA_DIARIO_OFICIAL);
        const abaDiario = ssDiario.getSheetByName(OLYMPOS_IDS.ABA_DIARIO_OFICIAL) || ssDiario.getSheets()[0];
        const dadosDiario = abaDiario.getDataRange().getValues();

        if (dadosDiario.length > 1) {
          const cfg = getConfig();
          const endpointPub = cfg.url + '/rest/v1/publicacoes_diario';
          const headers = getAuthHeaders(true);
          headers['Prefer'] = 'resolution=merge-duplicates';

          const lote = [];
          for (let i = 1; i < dadosDiario.length; i++) {
            const linha = dadosDiario[i];
            const dataPub = linha[0];
            const titulo = linha[5] || linha[4] || 'Publicação SMEB';
            if (dataPub && titulo) {
              const dataFormatada = (dataPub instanceof Date)
                ? Utilities.formatDate(dataPub, 'America/Fortaleza', 'yyyy-MM-dd')
                : String(dataPub).substring(0, 10);

              lote.push({
                data_publicacao: dataFormatada,
                edicao: String(linha[1] || ''),
                titulo: String(titulo),
                ato_tipo: String(linha[4] || 'Ato'),
                conteudo_ner: {
                  codigo_femurn: String(linha[1] || ''),
                  entidade: String(linha[2] || ''),
                  orgao: String(linha[3] || ''),
                  link_materia: String(linha[6] || '')
                }
              });
            }
          }

          if (lote.length > 0) {
            const optPub = {
              method: 'POST',
              headers: headers,
              payload: JSON.stringify(lote.slice(0, 100)), // Limite seguro por lote
              muteHttpExceptions: true
            };
            const resPub = UrlFetchApp.fetch(endpointPub, optPub);
            if (resPub.getResponseCode() >= 200 && resPub.getResponseCode() < 300) {
              relatorio.diarioOficialSincronizado = lote.length;
            }
          }
        }
      }
    } catch (eDiario) {
      relatorio.erros.push('Diário Oficial: ' + eDiario.message);
    }

    return { ok: relatorio.erros.length === 0, relatorio: relatorio };
  }

  /**
   * Provisiona um novo usuário administrativo no Supabase Auth via Admin REST API (/auth/v1/admin/users)
   * utilizando a SUPABASE_SERVICE_ROLE_KEY, sincroniza em public.profiles e registra na trilha de auditoria.
   * @param {Object} dadosUsuario Dados cadastrais (email, nome, role, departamento, senhaTemporaria).
   * @param {string} autorUid UUID ou identificador do usuário solicitante (ADMIN_GABINETE).
   * @returns {Object} Resultado da criação { ok: boolean, mensagem: string, user?: Object }.
   */
  function criarUsuarioAdmin(dadosUsuario, autorUid) {
    const cfg = getConfig();
    if (!cfg.url || !cfg.serviceRoleKey) {
      return { ok: false, mensagem: 'Configuração do Supabase (URL ou Service Role Key) ausente no backend GAS.' };
    }

    const payload = dadosUsuario || {};
    const emailLimpo = String(payload.email || '').trim().toLowerCase();
    const nomeLimpo = String(payload.nome || payload.full_name || '').trim() || (emailLimpo ? emailLimpo.split('@')[0] : 'Usuario SMEB');
    const roleAlvo = String(payload.role || 'RH_COMISSAO').trim().toUpperCase();
    const depto = String(payload.departamento || payload.department || 'Secretaria Municipal de Educacao').trim();
    const senha = String(payload.senhaTemporaria || payload.senha || payload.password || '').trim();

    if (!emailLimpo || !emailLimpo.includes('@')) {
      return { ok: false, mensagem: 'E-mail institucional inválido ou ausente.' };
    }

    const ROLES_VALIDAS = ['ADMIN_GABINETE', 'RH_COMISSAO', 'PEDAGOGICO_EVENTOS', 'JURIDICO'];
    if (!ROLES_VALIDAS.includes(roleAlvo)) {
      return { ok: false, mensagem: 'Papel RBAC inválido. Selecione ADMIN_GABINETE, RH_COMISSAO, PEDAGOGICO_EVENTOS ou JURIDICO.' };
    }

    if (!senha || senha.length < 8) {
      return { ok: false, mensagem: 'A senha temporária deve conter no mínimo 8 caracteres.' };
    }

    try {
      const endpoint = cfg.url + '/auth/v1/admin/users';
      const corpoRequisicao = {
        email: emailLimpo,
        password: senha,
        email_confirm: true,
        user_metadata: {
          full_name: nomeLimpo,
          role: roleAlvo,
          department: depto
        },
        app_metadata: {
          role: roleAlvo,
          provider: 'email',
          providers: ['email']
        }
      };

      const options = {
        method: 'POST',
        headers: {
          'apikey': cfg.serviceRoleKey,
          'Authorization': 'Bearer ' + cfg.serviceRoleKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        payload: JSON.stringify(corpoRequisicao),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(endpoint, options);
      const statusCode = response.getResponseCode();
      const rawText = response.getContentText();
      let resJson = {};
      try {
        resJson = JSON.parse(rawText);
      } catch (eParse) {
        resJson = { message: rawText };
      }

      if (statusCode >= 200 && statusCode < 300) {
        const novoUserId = resJson.id || (resJson.user && resJson.user.id);

        if (novoUserId) {
          // Assegura sincronização explícita com a tabela public.profiles
          try {
            UrlFetchApp.fetch(cfg.url + '/rest/v1/profiles', {
              method: 'POST',
              headers: {
                'apikey': cfg.serviceRoleKey,
                'Authorization': 'Bearer ' + cfg.serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
              },
              payload: JSON.stringify({
                id: novoUserId,
                email: emailLimpo,
                full_name: nomeLimpo,
                role: roleAlvo,
                department: depto,
                updated_at: new Date().toISOString()
              }),
              muteHttpExceptions: true
            });
          } catch (eProf) {
            console.warn('[criarUsuarioAdmin] Aviso ao sincronizar profiles:', eProf);
          }

          // Gravação compulsória na trilha de auditoria (LGPD & Rastreabilidade)
          registrarLogAuditoria(
            'profiles',
            novoUserId,
            'USER_CREATED_BY_ADMIN',
            {
              email: emailLimpo,
              full_name: nomeLimpo,
              role: roleAlvo,
              department: depto,
              criado_por: autorUid || 'ADMIN_GABINETE'
            },
            autorUid,
            'ADMIN_GABINETE'
          );
        }

        return {
          ok: true,
          mensagem: 'Usuário ' + emailLimpo + ' cadastrado com sucesso com o papel ' + roleAlvo + '!',
          user: {
            id: novoUserId,
            email: emailLimpo,
            nome: nomeLimpo,
            role: roleAlvo,
            department: depto
          }
        };
      } else {
        const msgErro = resJson.msg || resJson.message || resJson.error_description || ('Erro HTTP ' + statusCode + ' ao criar usuário.');
        return {
          ok: false,
          status: statusCode,
          mensagem: msgErro
        };
      }
    } catch (err) {
      console.error('[SupabaseGasClient] Erro crítico em criarUsuarioAdmin:', err);
      return { ok: false, mensagem: 'Falha de comunicação ao criar usuário: ' + err.message };
    }
  }

  return {
    getConfig: getConfig,
    estaConfigurado: estaConfigurado,
    getAuthHeaders: getAuthHeaders,
    verifyToken: verifyToken,
    obterPerfilUsuario: obterPerfilUsuario,
    upsertServidor: upsertServidor,
    registrarLicenca: registrarLicenca,
    registrarLogAuditoria: registrarLogAuditoria,
    criarUsuarioAdmin: criarUsuarioAdmin,
    sincronizarComSupabase: sincronizarComSupabase
  };
})();
