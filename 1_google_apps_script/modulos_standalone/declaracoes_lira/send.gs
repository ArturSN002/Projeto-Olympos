/**
 * @fileoverview Contém a lógica para enviar os Certificados/Declarações por e-mail com proteção de cota diária MailApp,
 * validação de sintaxe de e-mail por linha e isolamento de falhas.
 */

/**
 * Retorna a cota diária restante de envio de e-mails da conta Google atual.
 * @returns {number}
 */
function getRemainingEmailQuota() {
  try {
    return MailApp.getRemainingDailyQuota();
  } catch (e) {
    console.warn('Não foi possível consultar MailApp.getRemainingDailyQuota():', e);
    return 0;
  }
}

/**
 * Envia os Certificados ou Declarações por e-mail respeitando o limite de segurança da cota diária (> 3).
 * @param {string} sheetName Nome da aba.
 * @param {string} [modalityOverride] 'CERTIFICADO' ou 'DECLARACAO'.
 * @returns {string} Mensagem de resumo do lote enviado.
 */
function sendCertificates(sheetName, modalityOverride) {
  try {
    const settings = getSettingsFromSheet(sheetName, modalityOverride);
    const sheet = settings.sheet;
    const startRow = CONFIG.PARTICIPANTS.START_ROW;
    const lastRow = sheet.getLastRow();

    if (lastRow < startRow) {
      return 'Nenhum participante encontrado nesta aba.';
    }

    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 4).getValues();
    let emailsSentThisBatch = 0;
    let marcadosPendenteCota = 0;
    let errosDeEnvio = 0;

    // Consulta única da cota antes do loop (evita 25 chamadas RPC desnecessárias)
    let cotaRestante = MailApp.getRemainingDailyQuota();

    for (let i = 0; i < data.length; i++) {
      if (emailsSentThisBatch >= CONFIG.EMAIL_BATCH_SIZE) {
        break;
      }

      const row = data[i];
      const rawEmail = row[CONFIG.PARTICIPANTS.COLUMN_EMAIL - 1];
      const rawName = row[CONFIG.PARTICIPANTS.COLUMN_NAME - 1];
      const certificateUrl = limparTextoLira(row[CONFIG.PARTICIPANTS.COLUMN_CERT_STATUS - 1]);
      const sendStatus = limparTextoLira(row[CONFIG.PARTICIPANTS.COLUMN_EMAIL_STATUS - 1]);

      if (sendStatus === 'Enviado' || !certificateUrl || !rawName || !rawEmail) {
        continue;
      }

      const currentLine = startRow + i;

      // Verificador de Cota Diária (proteção obrigatória quando cota <= 3)
      if (cotaRestante <= CONFIG.MIN_QUOTA_SAFETY_THRESHOLD) {
        sheet.getRange(currentLine, CONFIG.PARTICIPANTS.COLUMN_EMAIL_STATUS)
          .setValue('Pendente Envio (Aguardando renovação de cota 24h)');
        marcadosPendenteCota++;
        continue;
      }

      const emailCorrigido = corrigirDominioEmail(rawEmail).email;
      const nomeCorrigido = formatarNomeTitleCase(rawName).nome;

      if (emailCorrigido !== rawEmail) {
        sheet.getRange(currentLine, CONFIG.PARTICIPANTS.COLUMN_EMAIL).setValue(emailCorrigido);
      }
      if (nomeCorrigido !== rawName) {
        sheet.getRange(currentLine, CONFIG.PARTICIPANTS.COLUMN_NAME).setValue(nomeCorrigido);
      }

      if (!validarSintaxeEmailLira(emailCorrigido)) {
        sheet.getRange(currentLine, CONFIG.PARTICIPANTS.COLUMN_EMAIL_STATUS)
          .setValue(`Erro: E-mail inválido (${emailCorrigido})`);
        errosDeEnvio++;
        continue;
      }

      try {
        const pdfFile = DriveApp.getFileById(getIdFromUrl(certificateUrl));
        const salutationName = getSalutationName(nomeCorrigido);
        const dadosEmail = montarCorpoEmailLira(settings.modality, settings, salutationName);

        MailApp.sendEmail({
          to: emailCorrigido,
          subject: dadosEmail.assunto,
          htmlBody: dadosEmail.corpoHtml,
          attachments: [pdfFile.getAs(MimeType.PDF)]
        });

        sheet.getRange(currentLine, CONFIG.PARTICIPANTS.COLUMN_EMAIL_STATUS).setValue('Enviado');
        emailsSentThisBatch++;
        cotaRestante--;
      } catch (rowErr) {
        sheet.getRange(currentLine, CONFIG.PARTICIPANTS.COLUMN_EMAIL_STATUS)
          .setValue(`Erro: ${rowErr.message}`);
        errosDeEnvio++;
      }
    }

    SpreadsheetApp.flush();
    const cotaFinal = MailApp.getRemainingDailyQuota();

    if (marcadosPendenteCota > 0) {
      // Sugestão 3.3.2: Agenda automaticamente um gatilho para as 08:00 do dia seguinte após renovação da cota
      const infoAgendamento = agendarReenvioAutomaticoPosCota(sheetName, settings.modality);
      return `${emailsSentThisBatch} e-mail(s) enviado(s). Cota diária atingiu o limite de segurança (${cotaFinal} restantes): ${marcadosPendenteCota} registro(s) retido(s) e reagendado(s) automaticamente para ${infoAgendamento.horarioAgendado}.`;
    }

    if (emailsSentThisBatch === 0 && errosDeEnvio === 0) {
      return `Nenhum e-mail novo para enviar nesta planilha (Cota diária restante: ${cotaFinal}).`;
    }

    const sufixoErro = errosDeEnvio > 0 ? ` (${errosDeEnvio} linha(s) com erro de endereço/anexo)` : '';
    return `${emailsSentThisBatch} e-mail(s) enviado(s) neste lote (${settings.modality})${sufixoErro}. Cota diária restante: ${cotaFinal}.`;
  } catch (error) {
    console.error('Erro ao enviar e-mails:', error);
    throw new Error(`Ocorreu um erro ao enviar: ${error.message}`);
  }
}

/**
 * Sugestão 3.3.2: Agenda automaticamente um gatilho (ScriptApp.newTrigger) para as 08:00 da manhã
 * do dia seguinte quando a trava de segurança de cota diária (<= 3) pausar os disparos.
 * @param {string} sheetName Nome da aba pendente.
 * @param {string} modality Modalidade ('CERTIFICADO' ou 'DECLARACAO').
 * @returns {{ agendado: boolean, horarioAgendado: string, timestamp: number }}
 */
function agendarReenvioAutomaticoPosCota(sheetName, modality) {
  const props = PropertiesService.getScriptProperties();
  const agora = new Date();
  const amanha08h = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 8, 0, 0);
  const horarioFormatado = (typeof Utilities !== 'undefined' && Utilities.formatDate)
    ? Utilities.formatDate(amanha08h, 'America/Fortaleza', 'dd/MM/yyyy HH:mm')
    : amanha08h.toISOString();

  const dadosFila = {
    sheetName: sheetName,
    modality: modality || 'DECLARACAO',
    agendadoEm: agora.toISOString(),
    horarioAgendado: horarioFormatado
  };

  props.setProperty('LIRA_AUTO_RESUME_QUEUE', JSON.stringify(dadosFila));

  // Remove gatilhos anteriores da mesma função para evitar duplicidade
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'retomarEnvioPosCotaLira') {
      ScriptApp.deleteTrigger(t);
    }
  });

  const tb = ScriptApp.newTrigger('retomarEnvioPosCotaLira').timeBased();
  if (typeof tb.at === 'function') {
    tb.at(amanha08h).create();
  } else if (typeof tb.after === 'function') {
    const msAteAmanha08h = Math.max(60000, amanha08h.getTime() - agora.getTime());
    tb.after(msAteAmanha08h).create();
  }

  return {
    agendado: true,
    horarioAgendado: horarioFormatado,
    timestamp: amanha08h.getTime()
  };
}

/**
 * Sugestão 3.3.2: Handler invocado automaticamente às 08:00 do dia seguinte pelo gatilho de retomada pós-cota.
 */
function retomarEnvioPosCotaLira() {
  const props = PropertiesService.getScriptProperties();
  const rawQueue = props.getProperty('LIRA_AUTO_RESUME_QUEUE');
  if (!rawQueue) return { status: 'EMPTY_QUEUE' };

  const fila = JSON.parse(rawQueue);
  props.deleteProperty('LIRA_AUTO_RESUME_QUEUE');

  const resultado = sendCertificates(fila.sheetName, fila.modality);
  return {
    status: 'RESUMED',
    sheetName: fila.sheetName,
    modality: fila.modality,
    resultado: resultado
  };
}
