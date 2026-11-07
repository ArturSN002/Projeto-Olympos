/**
 * @fileoverview Módulo 2 — Lira de Orfeu (Motor Unificado de Certificados e Declarações no Hub Olympos).
 * Opera remotamente sobre as planilhas da pasta compartilhada (1XriqpPQsWjQxJROsE_FyaQQpCwybJSUJ).
 */

const LIRA_HUB_CONFIG = {
  START_ROW: 5,
  COL_EMAIL: 1,
  COL_NAME: 2,
  COL_CERT_STATUS: 3,
  COL_EMAIL_STATUS: 4,
  COL_NOTA: 5,       // Opcional para Certificados (.pptx)
  COL_FREQUENCIA: 6, // Opcional para Certificados (.pptx)
  DEFAULT_DECLARACAO_TEMPLATE_ID: '17Bj5L6kMdgwYO8wZHTvdOebnzQ1jLkT_u9DBAkfC-RE',
  BATCH_SIZE: 15,
  EMAIL_BATCH_SIZE: 25,
  MIN_QUOTA_SAFETY: 3,
  MAX_EXECUTION_TIME_MS: 250000, // 4m10s
  DOMINIOS_TYPO: {
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmail.com.br': 'gmail.com',
    'gmail.co': 'gmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com'
  },
  PREPOSICOES: new Set(['da', 'de', 'do', 'das', 'dos', 'e']),
  ROMANOS: new Set(['ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'jr'])
};

/**
 * Lista todas as planilhas e abas de eventos existentes na pasta da Lira de Orfeu.
 */
function listarPlanilhasLiraOrfeu() {
  const folder = DriveApp.getFolderById(OLYMPOS_IDS.SUBPROJETOS.LIRA_PASTA);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  const planilhas = [];

  while (files.hasNext()) {
    const file = files.next();
    try {
      const ss = SpreadsheetApp.openById(file.getId());
      const abas = ss.getSheets().map(s => s.getName());
      planilhas.push({
        id: file.getId(),
        nome: file.getName(),
        url: file.getUrl(),
        abas: abas
      });
    } catch (e) {
      console.warn(`Erro ao ler planilha Lira ${file.getName()}:`, e);
    }
  }

  let cotaRestante = 0;
  try {
    cotaRestante = MailApp.getRemainingDailyQuota();
  } catch (e) {}

  return {
    folderId: OLYMPOS_IDS.SUBPROJETOS.LIRA_PASTA,
    cotaRestante: cotaRestante,
    planilhas: planilhas
  };
}

function validarSintaxeEmailLiraHub_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limparTextoOlympos(email));
}

function corrigirEmailLiraHub_(emailBruto) {
  const limpo = limparTextoOlympos(emailBruto).toLowerCase().replace(/\s+/g, '');
  if (!limpo || !limpo.includes('@')) {
    return { email: limpo, alterado: limpo !== String(emailBruto || '') };
  }
  const partes = limpo.split('@');
  const user = partes[0];
  const dom = partes.slice(1).join('@').replace(/\.+$/, '');
  const domCorrigido = LIRA_HUB_CONFIG.DOMINIOS_TYPO[dom] || dom;
  const finalEmail = `${user}@${domCorrigido}`;
  return { email: finalEmail, alterado: finalEmail !== String(emailBruto || '') };
}

function formatarNomeTitleCaseLiraHub_(nomeBruto) {
  const limpo = limparTextoOlympos(nomeBruto);
  if (!limpo) return { nome: '', alterado: false };
  const palavras = limpo.split(' ').map((w, idx) => {
    const low = w.toLowerCase();
    if (idx > 0 && LIRA_HUB_CONFIG.PREPOSICOES.has(low)) return low;
    if (LIRA_HUB_CONFIG.ROMANOS.has(low)) return low.toUpperCase();
    return low
      .split(/([-'])/)
      .map(seg => (seg === '-' || seg === "'" || !seg) ? seg : seg.charAt(0).toUpperCase() + seg.slice(1))
      .join('');
  });
  const finalNome = palavras.join(' ');
  return { nome: finalNome, alterado: finalNome !== String(nomeBruto || '') };
}

/**
 * 1. Higienizar Aba (Limpar \u2060, corrigir @gamil.com e aplicar Title Case) remotamente pelo Hub.
 */
function higienizarAbaLiraRemoto(spreadsheetId, sheetName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada.`);

  const startRow = LIRA_HUB_CONFIG.START_ROW;
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) {
    return { nomesCorrigidos: 0, emailsCorrigidos: 0, duplicatasEmails: [], duplicatasNomes: [] };
  }

  const numRows = lastRow - startRow + 1;
  const range = sheet.getRange(startRow, 1, numRows, 2);
  const values = range.getValues();

  let nomesCorrigidos = 0;
  let emailsCorrigidos = 0;
  let alterouPlanilha = false;
  const mapEmails = {};
  const mapNomes = {};

  for (let i = 0; i < values.length; i++) {
    const rawEmail = values[i][0];
    const rawName = values[i][1];

    if (rawEmail && String(rawEmail).trim() !== '') {
      const rEmail = corrigirEmailLiraHub_(rawEmail);
      if (rEmail.alterado) {
        values[i][0] = rEmail.email;
        emailsCorrigidos++;
        alterouPlanilha = true;
      }
      if (rEmail.email) mapEmails[rEmail.email] = (mapEmails[rEmail.email] || 0) + 1;
    }

    if (rawName && String(rawName).trim() !== '') {
      const rNome = formatarNomeTitleCaseLiraHub_(rawName);
      if (rNome.alterado) {
        values[i][1] = rNome.nome;
        nomesCorrigidos++;
        alterouPlanilha = true;
      }
      if (rNome.nome) mapNomes[rNome.nome] = (mapNomes[rNome.nome] || 0) + 1;
    }
  }

  if (alterouPlanilha) {
    range.setValues(values);
    SpreadsheetApp.flush();
  }

  return {
    planilha: ss.getName(),
    aba: sheetName,
    nomesCorrigidos: nomesCorrigidos,
    emailsCorrigidos: emailsCorrigidos,
    duplicatasEmails: Object.keys(mapEmails).filter(k => mapEmails[k] > 1),
    duplicatasNomes: Object.keys(mapNomes).filter(k => mapNomes[k] > 1)
  };
}

/**
 * Monta o corpo de e-mail parametrizado por modalidade (CERTIFICADO vs DECLARACAO).
 */
function montarCorpoEmailLira(modalidade, dadosEvento, nomeParticipante) {
  const isCert = String(modalidade || '').toUpperCase() === 'CERTIFICADO';
  const tipoDoc = isCert ? 'Certificado' : 'Declaração';
  const pronome = isCert ? 'o seu <strong>Certificado de Participação</strong>' : 'a sua <strong>Declaração de Participação</strong>';

  const assunto = `${isCert ? 'Seu Certificado' : 'Sua Declaração'} de Participação da formação - ${dadosEvento.eventName}`;
  const corpoHtml = `
    <p>Olá, ${nomeParticipante}!</p>
    <p>Foi uma grande alegria contar com a sua presença na formação <strong>${dadosEvento.eventName}</strong> no dia ${dadosEvento.eventDate}. Sua participação foi fundamental para o sucesso da nossa formação!</p>
    <p>Como forma de agradecimento, estamos enviando ${pronome}. Esperamos que esta tenha sido uma experiência enriquecedora para você.</p>
    <br>
    <p>Atenciosamente,</p>
    <p><strong>${dadosEvento.responsavel}</strong></p>
    <hr>
    <p><small><i>${dadosEvento.bonusMessage || ''}</i></small></p>
    <p><small><i>Esta é uma mensagem automática. Caso identifique algum erro em seu nome, por favor, entre em contato através do e-mail <strong>${dadosEvento.emailContato}</strong> para que possamos fazer a correção.</i></small></p>
  `;

  return { prefixo: tipoDoc, assunto: assunto, corpoHtml: corpoHtml };
}

/**
 * Renderiza o PDF do participante na Lira de Orfeu:
 * - Declaração: utiliza modelo fixo Google Docs (17Bj5L6kMdgwYO8wZHTvdOebnzQ1jLkT_u9DBAkfC-RE)
 * - Certificado: utiliza o arquivo .pptx / Google Slides específico do evento (com {{nome_completo}} por padrão e opcionais {{nota}} e {{frequencia}}).
 */
function preencherTemplateEExportarPdfLiraHub_(templateFile, outputFolder, fileName, modalidade, dadosEvento, dadosParticipante, codigoHash) {
  const mime = typeof templateFile.getMimeType === 'function' ? String(templateFile.getMimeType() || '') : '';
  const nomeTpl = typeof templateFile.getName === 'function' ? String(templateFile.getName() || '') : '';
  const isCert = String(modalidade || '').toUpperCase() === 'CERTIFICADO';
  const isPptxOrSlides =
    mime.includes('presentation') ||
    nomeTpl.toLowerCase().endsWith('.pptx') ||
    (isCert && typeof SlidesApp !== 'undefined' && mime !== 'application/vnd.google-apps.document' && mime !== '');

  let copyFile = null;

  // Conversão automática de arquivo .pptx binário para Google Slides temporário quando Drive API v2/v3 está ativa
  if (
    (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || nomeTpl.toLowerCase().endsWith('.pptx')) &&
    typeof Drive !== 'undefined' &&
    Drive.Files &&
    typeof Drive.Files.copy === 'function'
  ) {
    try {
      const resource = {
        title: fileName,
        name: fileName,
        mimeType: 'application/vnd.google-apps.presentation',
        parents: [{ id: outputFolder.getId() }]
      };
      const copiedMeta = Drive.Files.copy(resource, templateFile.getId());
      if (copiedMeta && copiedMeta.id) {
        copyFile = DriveApp.getFileById(copiedMeta.id);
      }
    } catch (e) {}
  }

  if (!copyFile) {
    copyFile = templateFile.makeCopy(fileName, outputFolder);
  }

  const name = dadosParticipante.name;
  const nota = dadosParticipante.nota || '';
  const frequencia = dadosParticipante.frequencia || '';

  let processadoComoSlides = false;
  if (isPptxOrSlides && typeof SlidesApp !== 'undefined' && typeof SlidesApp.openById === 'function') {
    try {
      const presentation = SlidesApp.openById(copyFile.getId());
      const slides = presentation.getSlides();
      slides.forEach(slide => {
        if (typeof slide.replaceAllText === 'function') {
          slide.replaceAllText('{{nome_completo}}', name);
          slide.replaceAllText('{{NOME_COMPLETO}}', name.toUpperCase());
          slide.replaceAllText('{{nome}}', name);
          slide.replaceAllText('{{nota}}', nota);
          slide.replaceAllText('{{NOTA}}', nota);
          slide.replaceAllText('{{frequencia}}', frequencia);
          slide.replaceAllText('{{frequência}}', frequencia);
          slide.replaceAllText('{{FREQUENCIA}}', frequencia);
          slide.replaceAllText('{{nome_evento}}', dadosEvento.eventName || '');
          slide.replaceAllText('{{data_evento}}', dadosEvento.eventDate || '');
          slide.replaceAllText('{{periodo}}', dadosEvento.period || '');
          slide.replaceAllText('{{responsavel}}', dadosEvento.responsavel || '');
          slide.replaceAllText('{{emailcontato}}', dadosEvento.emailContato || '');
        }
      });
      inserirQrCodeValidacaoLiraHub_(presentation, codigoHash, name, dadosEvento.eventName);
      presentation.saveAndClose();
      processadoComoSlides = true;
    } catch (errSlides) {}
  }

  if (!processadoComoSlides) {
    const doc = DocumentApp.openById(copyFile.getId());
    const body = doc.getBody();

    safeReplaceTextPincel_(body, '\\{\\{nome_completo\\}\\}', name);
    safeReplaceTextPincel_(body, '\\{\\{nome\\}\\}', name);
    safeReplaceTextPincel_(body, '\\{\\{nota\\}\\}', nota);
    safeReplaceTextPincel_(body, '\\{\\{frequencia\\}\\}', frequencia);
    safeReplaceTextPincel_(body, '\\{\\{nome_evento\\}\\}', dadosEvento.eventName);
    safeReplaceTextPincel_(body, '\\{\\{data_evento\\}\\}', dadosEvento.eventDate);
    safeReplaceTextPincel_(body, '\\{\\{periodo\\}\\}', dadosEvento.period);
    safeReplaceTextPincel_(body, '\\{\\{responsavel\\}\\}', dadosEvento.responsavel);
    safeReplaceTextPincel_(body, '\\{\\{emailcontato\\}\\}', dadosEvento.emailContato);

    inserirQrCodeValidacaoLiraHub_(doc, codigoHash, name, dadosEvento.eventName);
    doc.saveAndClose();
  }

  const pdfBlob = copyFile.getAs('application/pdf');
  const pdfFile = outputFolder.createFile(pdfBlob).setName(fileName + '.pdf');
  const pdfUrl = pdfFile.getUrl();
  copyFile.setTrashed(true);
  return pdfUrl;
}

/**
 * 2. Gerar PDFs e Disparar E-mails para a planilha/aba selecionada na Lira de Orfeu.
 * Utiliza leitura única em lote de A2:H2, trava de tempo de 250s e contador local de cota MailApp.
 */
function executarLoteLiraOrfeuRemoto(spreadsheetId, sheetName, modalidade) {
  const startTime = Date.now();
  const relHig = higienizarAbaLiraRemoto(spreadsheetId, sheetName);

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  const cfgValues = sheet.getRange('A2:H2').getValues()[0];
  const displayDate = sheet.getRange('D2').getDisplayValue();
  const isCert = String(modalidade || '').toUpperCase() === 'CERTIFICADO';
  const rawTemplateId = limparTextoOlympos(cfgValues[1]);
  const defaultDeclId = (OLYMPOS_IDS.MODELOS_DOCS && OLYMPOS_IDS.MODELOS_DOCS.DECLARACAO) || LIRA_HUB_CONFIG.DEFAULT_DECLARACAO_TEMPLATE_ID;

  const dadosEvento = {
    eventName: limparTextoOlympos(cfgValues[0]),
    templateId: rawTemplateId || (!isCert ? defaultDeclId : ''),
    folderId: limparTextoOlympos(cfgValues[2]),
    eventDate: limparTextoOlympos(displayDate || cfgValues[3]),
    period: limparTextoOlympos(cfgValues[4]),
    responsavel: limparTextoOlympos(cfgValues[5]),
    emailContato: limparTextoOlympos(cfgValues[6]),
    bonusMessage: limparTextoOlympos(cfgValues[7])
  };

  if (!dadosEvento.eventName || !dadosEvento.templateId || !dadosEvento.folderId) {
    throw new Error('Preencha Nome do Evento (A2), ID do Template (B2 — obrigatório .pptx por evento em Certificados) e ID da Pasta (C2) na aba selecionada.');
  }

  const startRow = LIRA_HUB_CONFIG.START_ROW;
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) {
    return { pdfsGerados: 0, emailsEnviados: 0, pendentesCota: 0, cotaRestante: MailApp.getRemainingDailyQuota() };
  }

  const outputFolder = DriveApp.getFolderById(dadosEvento.folderId);
  const templateFile = DriveApp.getFileById(dadosEvento.templateId);
  const numRows = lastRow - startRow + 1;
  const numCols = typeof sheet.getLastColumn === 'function' ? Math.max(4, Math.min(sheet.getLastColumn(), 6)) : 4;
  const data = sheet.getRange(startRow, 1, numRows, numCols).getValues();

  let pdfsGerados = 0;
  let emailsEnviados = 0;
  let pendentesCota = 0;
  let cotaRestante = MailApp.getRemainingDailyQuota();
  const arquivosGerados = [];

  for (let i = 0; i < data.length; i++) {
    if (Date.now() - startTime > LIRA_HUB_CONFIG.MAX_EXECUTION_TIME_MS) {
      break;
    }

    const currentRow = startRow + i;
    const email = limparTextoOlympos(data[i][0]);
    const name = limparTextoOlympos(data[i][1]);
    let pdfUrl = limparTextoOlympos(data[i][2]);
    let emailStatus = limparTextoOlympos(data[i][3]);
    const notaOpt = data[i].length >= 5 ? limparTextoOlympos(data[i][4]) : '';
    const frequenciaOpt = data[i].length >= 6 ? limparTextoOlympos(data[i][5]) : '';

    if (!email || !name) continue;

    const infoModalidade = montarCorpoEmailLira(modalidade, dadosEvento, name.split(' ').filter(p => p.length > 2).slice(0, 2).join(' '));
    let codigoHashGerado = '';
    let gerouNestaExecucao = false;

    // Passo A: Gerar PDF se ainda não existir (100% independente da cota de e-mail)
    if (!pdfUrl && pdfsGerados < LIRA_HUB_CONFIG.BATCH_SIZE) {
      const codigoHash = gerarHashAutenticidadeLiraHub_(name, email, dadosEvento.eventName, dadosEvento.eventDate);
      codigoHashGerado = codigoHash;
      const fileName = `${infoModalidade.prefixo} - ${dadosEvento.eventName} - ${name}`;
      pdfUrl = preencherTemplateEExportarPdfLiraHub_(
        templateFile,
        outputFolder,
        fileName,
        modalidade,
        dadosEvento,
        { name: name, nota: notaOpt, frequencia: frequenciaOpt },
        codigoHash
      );
      sheet.getRange(currentRow, LIRA_HUB_CONFIG.COL_CERT_STATUS).setValue(pdfUrl);

      // Sugestão 3.3.1: Grava hash na aba pública "Registro_Autenticidade"
      registrarAutenticidadeLiraHub_(ss, {
        hash: codigoHash,
        nome: name,
        email: email,
        evento: dadosEvento.eventName,
        modalidade: modalidade,
        dataEvento: dadosEvento.eventDate,
        urlPdf: pdfUrl
      });

      pdfsGerados++;
      gerouNestaExecucao = true;
    }

    // Passo B: Enviar e-mail se já tiver PDF e não tiver sido enviado
    if (pdfUrl && emailStatus !== 'Enviado' && emailsEnviados < LIRA_HUB_CONFIG.EMAIL_BATCH_SIZE) {
      if (cotaRestante <= LIRA_HUB_CONFIG.MIN_QUOTA_SAFETY) {
        emailStatus = 'Pendente Envio (Aguardando renovação de cota 24h)';
        sheet.getRange(currentRow, LIRA_HUB_CONFIG.COL_EMAIL_STATUS).setValue(emailStatus);
        pendentesCota++;
        if (pdfUrl) {
          arquivosGerados.push({
            linha: currentRow,
            identificador: name,
            detalhe: `${email} • ${emailStatus}`,
            hash: codigoHashGerado,
            url: pdfUrl,
            novo: gerouNestaExecucao
          });
        }
        continue;
      }

      if (!validarSintaxeEmailLiraHub_(email)) {
        emailStatus = `Erro: E-mail inválido (${email})`;
        sheet.getRange(currentRow, LIRA_HUB_CONFIG.COL_EMAIL_STATUS).setValue(emailStatus);
        if (pdfUrl) {
          arquivosGerados.push({
            linha: currentRow,
            identificador: name,
            detalhe: emailStatus,
            hash: codigoHashGerado,
            url: pdfUrl,
            novo: gerouNestaExecucao
          });
        }
        continue;
      }

      const matchId = pdfUrl.match(/[-\w]{25,}/);
      if (matchId) {
        try {
          const pdfDriveFile = DriveApp.getFileById(matchId[0]);
          MailApp.sendEmail({
            to: email,
            subject: infoModalidade.assunto,
            htmlBody: infoModalidade.corpoHtml,
            attachments: [pdfDriveFile.getAs(MimeType.PDF)]
          });
          emailStatus = 'Enviado';
          sheet.getRange(currentRow, LIRA_HUB_CONFIG.COL_EMAIL_STATUS).setValue('Enviado');
          emailsEnviados++;
          cotaRestante--;
        } catch (errMail) {
          emailStatus = `Erro: ${errMail.message}`;
          sheet.getRange(currentRow, LIRA_HUB_CONFIG.COL_EMAIL_STATUS).setValue(emailStatus);
        }
      }
    }

    if (pdfUrl && (gerouNestaExecucao || arquivosGerados.length < 30)) {
      arquivosGerados.push({
        linha: currentRow,
        identificador: name,
        detalhe: `${email} • ${emailStatus || 'PDF Disponível'}`,
        hash: codigoHashGerado,
        url: pdfUrl,
        novo: gerouNestaExecucao
      });
    }
  }

  SpreadsheetApp.flush();
  const cotaFinal = MailApp.getRemainingDailyQuota();
  const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');

  let agendamentoPosCota = null;
  if (pendentesCota > 0) {
    // Sugestão 3.3.2: Agenda retomada automática para as 08:00 do dia seguinte
    agendamentoPosCota = agendarReenvioAutomaticoPosCotaHub_(spreadsheetId, sheetName, modalidade);
  }

  registrarAlertaMemoriaOlympos(
    '_memoria_orfeu.md',
    `[${agora}] Evento "${dadosEvento.eventName}" (${modalidade}): ${pdfsGerados} PDF(s) com QR/Hash, ${emailsEnviados} e-mail(s) enviado(s), Cota restante: ${cotaFinal}${agendamentoPosCota ? ` | Auto-Resume agendado para ${agendamentoPosCota.horarioAgendado}` : ''}.`
  );

  return {
    ok: true,
    evento: dadosEvento.eventName,
    modalidade: modalidade,
    pastaDestinoUrl: outputFolder.getUrl(),
    higienizacao: relHig,
    pdfsGerados: pdfsGerados,
    emailsEnviados: emailsEnviados,
    pendentesCota: pendentesCota,
    cotaRestante: cotaFinal,
    agendamentoPosCota: agendamentoPosCota,
    arquivosGerados: arquivosGerados
  };
}

/**
 * Sugestão 3.3.1 (Hub): Gera código hash único de validação (ex: SMEB-2026-A8F39C12).
 */
function gerarHashAutenticidadeLiraHub_(nome, email, evento, dataEvento) {
  const semente = `${limparTextoOlympos(nome).toUpperCase()}|${limparTextoOlympos(email).toLowerCase()}|${limparTextoOlympos(evento)}|${limparTextoOlympos(dataEvento)}`;
  try {
    if (typeof Utilities !== 'undefined' && Utilities.computeDigest && Utilities.DigestAlgorithm) {
      const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, semente);
      const hex = digest
        .slice(0, 5)
        .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      return `SMEB-2026-${hex}`;
    }
  } catch (e) {}

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < semente.length; i++) {
    const ch = semente.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `SMEB-2026-${(h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(2, '0')).substring(0, 10).toUpperCase()}`;
}

/**
 * Constrói payload canônico para certificados da Lira de Orfeu (RFC 8785).
 */
function gerarPayloadCanonicoCertificadoLiraHub_(codigoHash, aluno, email, evento, dataEvento, cargaHoraria) {
  let hashAluno = 'anon_hash';
  try {
    if (typeof Utilities !== 'undefined' && Utilities.computeDigest) {
      const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email || aluno || '').toLowerCase());
      hashAluno = digest.slice(0, 8).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    }
  } catch (e) {}

  return {
    cert_id: codigoHash,
    event_date: String(dataEvento || '2026-11-07'),
    event_name: String(evento || 'Formação SMEB'),
    event_type: 'CERTIFICADO',
    hours: Number(cargaHoraria || 40),
    issued_at: new Date().toISOString(),
    issuer: 'SMEB Ceará-Mirim/RN',
    recipient_id_hash: hashAluno,
    recipient_name: String(aluno || 'Participante')
  };
}

/**
 * Gera token assinado para o certificado da Lira de Orfeu.
 */
function gerarTokenCertificadoLiraHub_(codigoHash, aluno, email, evento, dataEvento, cargaHoraria) {
  const payload = gerarPayloadCanonicoCertificadoLiraHub_(codigoHash, aluno, email, evento, dataEvento, cargaHoraria);
  const sortedKeys = Object.keys(payload).sort();
  const canonicalObj = {};
  sortedKeys.forEach(function(k) { canonicalObj[k] = payload[k]; });
  const canonicalJson = JSON.stringify(canonicalObj);

  let payloadB64 = '';
  let sigB64 = '';
  try {
    if (typeof Utilities !== 'undefined' && Utilities.base64EncodeWebSafe) {
      payloadB64 = Utilities.base64EncodeWebSafe(canonicalJson).replace(/=+$/, '');
      const secret = PropertiesService.getScriptProperties().getProperty('OLYMPOS_SECRET_TOKEN') || 'OLYMPOS_SECRET_TOKEN_PROD';
      const sigBytes = Utilities.computeHmacSha256Signature(canonicalJson, secret);
      sigB64 = Utilities.base64EncodeWebSafe(sigBytes).replace(/=+$/, '');
    }
  } catch (e) {}

  return {
    token: (payloadB64 && sigB64) ? (payloadB64 + '.' + sigB64) : codigoHash,
    payload: payload,
    canonicalJson: canonicalJson
  };
}

function inserirQrCodeValidacaoLiraHub_(doc, codigoHash, nome, evento, dataEvento, cargaHoraria) {
  if (!doc || !codigoHash) return;
  const tokenInfo = gerarTokenCertificadoLiraHub_(codigoHash, nome, '', evento, dataEvento, cargaHoraria);
  const textoValidacao = `https://smeb-cearamirim.github.io/hub-olympos-frontend/#certificados?v=${encodeURIComponent(tokenInfo.token)}`;
  const qrUrl = `https://quickchart.io/qr?size=140&margin=1&text=${encodeURIComponent(textoValidacao)}`;

  let qrBlob = null;
  try {
    if (typeof UrlFetchApp !== 'undefined' && UrlFetchApp.fetch) {
      const resp = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
      if (resp && resp.getResponseCode && resp.getResponseCode() === 200) {
        qrBlob = resp.getBlob().setName(`QR_${codigoHash}.png`);
      }
    }
  } catch (e) {}

  if (typeof doc.getBody === 'function') {
    const body = doc.getBody();
    safeReplaceTextPincel_(body, '\\{\\{codigo_validacao\\}\\}', codigoHash);
    safeReplaceTextPincel_(body, '\\{\\{hash\\}\\}', codigoHash);
    safeReplaceTextPincel_(body, '\\{\\{token_validacao\\}\\}', tokenInfo.token);
    if (qrBlob && typeof body.appendImage === 'function') {
      const img = body.appendImage(qrBlob);
      if (img && typeof img.setWidth === 'function') {
        img.setWidth(72);
        img.setHeight(72);
      }
    }
    if (typeof body.appendParagraph === 'function') {
      const p = body.appendParagraph(`Autenticidade verificável — Código SMEB: ${codigoHash}`);
      if (p && typeof p.setFontSize === 'function') p.setFontSize(8);
    }
    return;
  }

  if (typeof doc.getSlides === 'function') {
    const slides = doc.getSlides();
    if (slides && slides.length > 0) {
      const slide = slides[0];
      if (typeof slide.replaceAllText === 'function') {
        slide.replaceAllText('{{codigo_validacao}}', codigoHash);
        slide.replaceAllText('{{hash}}', codigoHash);
      }
      if (qrBlob && typeof slide.insertImage === 'function') {
        slide.insertImage(qrBlob, 610, 420, 72, 72);
      }
      if (typeof slide.insertTextBox === 'function') {
        slide.insertTextBox(`Código: ${codigoHash}`, 580, 495, 130, 22);
      }
    }
  }
}

function registrarAutenticidadeLiraHub_(ss, registro) {
  if (!ss || !registro || !registro.hash) return;
  const nomeAba = 'Registro_Autenticidade';
  let sheetReg = ss.getSheetByName(nomeAba);
  if (!sheetReg && typeof ss.insertSheet === 'function') {
    sheetReg = ss.insertSheet(nomeAba);
    if (sheetReg && typeof sheetReg.appendRow === 'function') {
      sheetReg.appendRow([
        'Código de Validação (Hash)',
        'Participante',
        'E-mail',
        'Evento / Formação',
        'Modalidade',
        'Data do Evento',
        'Emitido em',
        'URL do PDF Oficial'
      ]);
    }
  }
  const emitidoEm = Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss');
  if (sheetReg && typeof sheetReg.appendRow === 'function') {
    sheetReg.appendRow([
      registro.hash,
      registro.nome,
      registro.email,
      registro.evento,
      registro.modalidade,
      registro.dataEvento,
      emitidoEm,
      registro.urlPdf || ''
    ]);
  }
}

/**
 * Sugestão 3.3.2 (Hub): Agenda retomada automática dos envios para as 08:00 do dia seguinte após renovação da cota.
 */
function agendarReenvioAutomaticoPosCotaHub_(spreadsheetId, sheetName, modalidade) {
  const props = PropertiesService.getScriptProperties();
  const agora = new Date();
  const amanha08h = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 8, 0, 0);
  const horarioFormatado = Utilities.formatDate(amanha08h, 'America/Fortaleza', 'dd/MM/yyyy HH:mm');

  const itemFila = {
    spreadsheetId: spreadsheetId,
    sheetName: sheetName,
    modalidade: modalidade || 'DECLARACAO',
    horarioAgendado: horarioFormatado
  };
  props.setProperty('LIRA_HUB_AUTO_RESUME_QUEUE', JSON.stringify(itemFila));

  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'retomarEnvioPosCotaLiraHub') {
      ScriptApp.deleteTrigger(t);
    }
  });

  const tb = ScriptApp.newTrigger('retomarEnvioPosCotaLiraHub').timeBased();
  if (typeof tb.at === 'function') {
    tb.at(amanha08h).create();
  } else if (typeof tb.after === 'function') {
    tb.after(Math.max(60000, amanha08h.getTime() - agora.getTime())).create();
  }

  return { agendado: true, horarioAgendado: horarioFormatado };
}

function retomarEnvioPosCotaLiraHub() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('LIRA_HUB_AUTO_RESUME_QUEUE');
  if (!raw) return { status: 'EMPTY_QUEUE' };
  const fila = JSON.parse(raw);
  props.deleteProperty('LIRA_HUB_AUTO_RESUME_QUEUE');
  return executarLoteLiraOrfeuRemoto(fila.spreadsheetId, fila.sheetName, fila.modalidade);
}
