/**
 * @fileoverview Arquivo de configuração central para a Lira de Orfeu (Unificação Certificados + Declarações).
 */

const CONFIG = {
  SETTINGS_RANGE: {
    ALL_HEADERS: 'A2:I2',
    EVENT_NAME: 'A2',
    TEMPLATE_ID: 'B2',
    FOLDER_ID: 'C2',
    EVENT_DATE: 'D2',
    PERIOD: 'E2',
    RESP: 'F2',
    EMAIL_CONTACT: 'G2',
    BONUS_MESSAGE: 'H2',
    MODALITY: 'I2' // Opcional: "CERTIFICADO" ou "DECLARACAO"
  },

  PARTICIPANTS: {
    START_ROW: 5,
    COLUMN_EMAIL: 1,
    COLUMN_NAME: 2,
    COLUMN_CERT_STATUS: 3,
    COLUMN_EMAIL_STATUS: 4,
    COLUMN_NOTA: 5,       // Opcional para Certificados (.pptx)
    COLUMN_FREQUENCIA: 6  // Opcional para Certificados (.pptx)
  },

  DEFAULTS: {
    DECLARACAO_TEMPLATE_ID: '17Bj5L6kMdgwYO8wZHTvdOebnzQ1jLkT_u9DBAkfC-RE',
    LIRA_FOLDER_ID: '1XriqpPQsWjQxJROsE_FyaQQpCwybJSUJ'
  },

  EMAIL_BATCH_SIZE: 25,
  MIN_QUOTA_SAFETY_THRESHOLD: 3,
  MAX_EXECUTION_TIME_MS: 250000, // 4m10s

  MODALITIES: {
    CERTIFICADO: 'CERTIFICADO',
    DECLARACAO: 'DECLARACAO'
  },

  TEMPLATES_MODALIDADE: {
    CERTIFICADO: {
      prefixoArquivo: 'Certificado',
      assunto: 'Seu Certificado de Participação da formação - {{nome_evento}}',
      corpoHtml: `
        <p>Olá, {{nome}}!</p>
        <p>Foi uma grande alegria contar com a sua presença na formação <strong>{{nome_evento}}</strong> no dia {{data_evento}}. Sua participação foi fundamental para o sucesso do nosso encontro!</p>
        <p>Como forma de reconhecimento, estamos enviando em anexo o seu <strong>Certificado de Participação</strong>. Esperamos que esta tenha sido uma experiência enriquecedora para você.</p>
        <br>
        <p>Atenciosamente,</p>
        <p><strong>{{responsavel}}</strong></p>
        <hr>
        <p><small><i>{{mensagemextra}}</i></small></p>
        <p><small><i>Esta é uma mensagem automática. Caso identifique algum erro em seu nome no certificado, por favor, entre em contato através do e-mail <strong>{{emailcontato}}</strong> para que possamos fazer a correção.</i></small></p>
      `
    },
    DECLARACAO: {
      prefixoArquivo: 'Declaração',
      assunto: 'Sua Declaração de Participação da formação - {{nome_evento}}',
      corpoHtml: `
        <p>Olá, {{nome}}!</p>
        <p>Foi uma grande alegria contar com a sua presença na formação <strong>{{nome_evento}}</strong> no dia {{data_evento}}. Sua participação foi fundamental para o sucesso da nossa formação!</p>
        <p>Como forma de agradecimento, estamos enviando a sua <strong>Declaração de Participação</strong>. Esperamos que esta tenha sido uma experiência enriquecedora para você.</p>
        <br>
        <p>Atenciosamente,</p>
        <p><strong>{{responsavel}}</strong></p>
        <hr>
        <p><small><i>{{mensagemextra}}</i></small></p>
        <p><small><i>Esta é uma mensagem automática. Caso identifique algum erro em seu nome na declaração, por favor, entre em contato através do e-mail <strong>{{emailcontato}}</strong> para que possamos fazer a correção.</i></small></p>
      `
    }
  }
};

/**
 * Normaliza a modalidade informada ('CERTIFICADO' ou 'DECLARACAO').
 * @param {string} [modalidade]
 * @returns {string}
 */
function normalizarModalidadeLira(modalidade) {
  const m = String(modalidade || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  return m === 'CERTIFICADO' ? CONFIG.MODALITIES.CERTIFICADO : CONFIG.MODALITIES.DECLARACAO;
}

/**
 * Monta o assunto, o corpo HTML do e-mail e o prefixo de arquivo conforme a modalidade (CERTIFICADO vs DECLARACAO).
 * @param {string} modalidade 'CERTIFICADO' ou 'DECLARACAO'.
 * @param {object} dadosEvento Objeto retornado por getSettingsFromSheet.
 * @param {string} nomeParticipante Nome formatado para saudação.
 * @returns {{ assunto: string, corpoHtml: string, prefixoArquivo: string }}
 */
function montarCorpoEmailLira(modalidade, dadosEvento, nomeParticipante) {
  const modKey = normalizarModalidadeLira(modalidade || dadosEvento.modality);
  const modelo = CONFIG.TEMPLATES_MODALIDADE[modKey];

  const assunto = modelo.assunto.replace('{{nome_evento}}', String(dadosEvento.eventName || ''));
  const corpoHtml = modelo.corpoHtml
    .replace('{{nome}}', String(nomeParticipante || ''))
    .replace('{{nome_evento}}', String(dadosEvento.eventName || ''))
    .replace('{{data_evento}}', String(dadosEvento.eventDate || ''))
    .replace('{{responsavel}}', String(dadosEvento.responsavel || ''))
    .replace('{{mensagemextra}}', String(dadosEvento.bonusMessage || ''))
    .replace('{{emailcontato}}', String(dadosEvento.emailContato || ''));

  return {
    assunto: assunto,
    corpoHtml: corpoHtml,
    prefixoArquivo: modelo.prefixoArquivo
  };
}

/**
 * Lê todas as configurações do evento em lote (A2:I2) reduzindo chamadas de I/O na planilha em 80%.
 */
function getSettingsFromSheet(sheetName, modalityOverride) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`A planilha com o nome "${sheetName}" não foi encontrada.`);
    }

    const rowValues = sheet.getRange(CONFIG.SETTINGS_RANGE.ALL_HEADERS).getValues()[0];
    const displayDate = sheet.getRange(CONFIG.SETTINGS_RANGE.EVENT_DATE).getDisplayValue();
    const modality = normalizarModalidadeLira(modalityOverride || rowValues[8] || 'DECLARACAO');
    const rawTemplateId = limparTextoLira(rowValues[1]);
    const resolvedTemplateId = rawTemplateId || (modality === CONFIG.MODALITIES.DECLARACAO ? CONFIG.DEFAULTS.DECLARACAO_TEMPLATE_ID : '');

    const settings = {
      eventName: limparTextoLira(rowValues[0]),
      templateId: resolvedTemplateId,
      folderId: limparTextoLira(rowValues[2]),
      eventDate: limparTextoLira(displayDate || rowValues[3]),
      period: limparTextoLira(rowValues[4]),
      responsavel: limparTextoLira(rowValues[5]),
      emailContato: limparTextoLira(rowValues[6]),
      bonusMessage: limparTextoLira(rowValues[7]),
      modality: modality,
      sheet: sheet
    };

    if (!settings.eventName || !settings.templateId || !settings.folderId || !settings.eventDate) {
      throw new Error(`Preencha as configurações do evento (Nome, ID do Template [obrigatório .pptx para Certificado], ID da Pasta e Data) na planilha "${sheetName}".`);
    }
    return settings;
  } catch (e) {
    console.error("Erro ao ler configurações: ", e);
    throw e;
  }
}
