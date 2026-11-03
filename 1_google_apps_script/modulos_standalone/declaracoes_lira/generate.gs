/**
 * @fileoverview Contém a lógica otimizada para gerar os Certificados ou Declarações em PDF em lotes.
 * Ignora instantaneamente em memória as linhas já geradas (sem desperdiçar lotes) e respeita a trava de 250s.
 */

const BATCH_SIZE = 15;

function safeReplaceTextLira_(body, pattern, replacement) {
  const safeVal = String(replacement === null || replacement === undefined ? '' : replacement).replace(/\$/g, '$$$$');
  body.replaceText(pattern, safeVal);
}

/**
 * Verifica se o arquivo de template é uma apresentação (.pptx ou Google Slides)
 * e gera o PDF correspondente (suportando tanto Google Docs para Declarações quanto .pptx/Slides para Certificados,
 * com preenchimento padrão de {{nome_completo}} e opcional de {{nota}} e {{frequencia}}).
 */
function preencherTemplateEExportarPdfLira_(templateFile, outputFolder, newFileName, settings, dadosParticipante, codigoHash) {
  const mime = typeof templateFile.getMimeType === 'function' ? String(templateFile.getMimeType() || '') : '';
  const nomeTpl = typeof templateFile.getName === 'function' ? String(templateFile.getName() || '') : '';
  const isPptxOrSlides =
    mime.includes('presentation') ||
    nomeTpl.toLowerCase().endsWith('.pptx') ||
    (settings.modality === 'CERTIFICADO' && typeof SlidesApp !== 'undefined' && mime !== 'application/vnd.google-apps.document' && mime !== '');

  let newFile = null;

  // Se for arquivo binário .pptx no Drive e o serviço avançado Drive estiver disponível, converte em Google Slides temporário
  if (
    (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || nomeTpl.toLowerCase().endsWith('.pptx')) &&
    typeof Drive !== 'undefined' &&
    Drive.Files &&
    typeof Drive.Files.copy === 'function'
  ) {
    try {
      const resource = {
        title: newFileName,
        name: newFileName,
        mimeType: 'application/vnd.google-apps.presentation',
        parents: [{ id: outputFolder.getId() }]
      };
      const copiedMeta = Drive.Files.copy(resource, templateFile.getId());
      if (copiedMeta && copiedMeta.id) {
        newFile = DriveApp.getFileById(copiedMeta.id);
      }
    } catch (e) {}
  }

  if (!newFile) {
    newFile = templateFile.makeCopy(newFileName, outputFolder);
  }

  const name = dadosParticipante.name;
  const nota = dadosParticipante.nota || '';
  const frequencia = dadosParticipante.frequencia || '';

  let processadoComoSlides = false;
  if (isPptxOrSlides && typeof SlidesApp !== 'undefined' && typeof SlidesApp.openById === 'function') {
    try {
      const presentation = SlidesApp.openById(newFile.getId());
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
          slide.replaceAllText('{{nome_evento}}', settings.eventName || '');
          slide.replaceAllText('{{data_evento}}', settings.eventDate || '');
          slide.replaceAllText('{{periodo}}', settings.period || '');
          slide.replaceAllText('{{responsavel}}', settings.responsavel || '');
          slide.replaceAllText('{{emailcontato}}', settings.emailContato || '');
        }
      });
      inserirQrCodeEHashValidacao(presentation, codigoHash, name, settings.eventName);
      presentation.saveAndClose();
      processadoComoSlides = true;
    } catch (errSlides) {
      // Fallback para DocumentApp caso o template informado seja um Google Doc
    }
  }

  if (!processadoComoSlides) {
    const doc = DocumentApp.openById(newFile.getId());
    const body = doc.getBody();

    safeReplaceTextLira_(body, '\\{\\{nome_completo\\}\\}', name);
    safeReplaceTextLira_(body, '\\{\\{nome\\}\\}', name);
    safeReplaceTextLira_(body, '\\{\\{nota\\}\\}', nota);
    safeReplaceTextLira_(body, '\\{\\{frequencia\\}\\}', frequencia);
    safeReplaceTextLira_(body, '\\{\\{nome_evento\\}\\}', settings.eventName);
    safeReplaceTextLira_(body, '\\{\\{data_evento\\}\\}', settings.eventDate);
    safeReplaceTextLira_(body, '\\{\\{periodo\\}\\}', settings.period);
    safeReplaceTextLira_(body, '\\{\\{responsavel\\}\\}', settings.responsavel);
    safeReplaceTextLira_(body, '\\{\\{emailcontato\\}\\}', settings.emailContato);

    inserirQrCodeEHashValidacao(doc, codigoHash, name, settings.eventName);
    doc.saveAndClose();
  }

  const pdfBlob = newFile.getAs('application/pdf');
  const pdfFile = outputFolder.createFile(pdfBlob).setName(newFileName + '.pdf');
  const pdfUrl = pdfFile.getUrl();
  newFile.setTrashed(true);
  return pdfUrl;
}

function generateCertificateBatch(sheetName, startRow) {
  const startTime = Date.now();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const props = PropertiesService.getScriptProperties();
    const modality = props.getProperty(BATCH_MODALITY_KEY) || 'DECLARACAO';
    let processedCountTotal = parseInt(props.getProperty(BATCH_PROCESSED_COUNT_KEY), 10) || 0;

    const settings = getSettingsFromSheet(sheetName, modality);
    const sheet = settings.sheet;
    const lastRowInSheet = sheet.getLastRow();

    if (startRow > lastRowInSheet) {
      ss.toast('Geração de documentos concluída com sucesso!', 'Finalizado', 5);
      resetBatchProcess(false);
      return;
    }

    const outputFolder = DriveApp.getFolderById(settings.folderId);
    const templateFile = DriveApp.getFileById(settings.templateId);
    const modeloModalidade = CONFIG.TEMPLATES_MODALIDADE[settings.modality];

    const numRowsToRead = lastRowInSheet - startRow + 1;
    const numColsToRead = typeof sheet.getLastColumn === 'function' ? Math.max(4, Math.min(sheet.getLastColumn(), 6)) : 4;
    const allRows = sheet.getRange(startRow, 1, numRowsToRead, numColsToRead).getValues();

    let pdfsCreatedInBatch = 0;
    let rowsScanned = 0;

    for (let i = 0; i < allRows.length && pdfsCreatedInBatch < BATCH_SIZE; i++) {
      // Trava preventiva de tempo (4m10s) antes do limite de 6 minutos do GAS
      if (Date.now() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) {
        break;
      }

      rowsScanned++;
      const currentRow = startRow + i;
      const values = allRows[i];
      const rawEmail = values[CONFIG.PARTICIPANTS.COLUMN_EMAIL - 1];
      const rawName = values[CONFIG.PARTICIPANTS.COLUMN_NAME - 1];
      const certificateStatus = limparTextoLira(values[CONFIG.PARTICIPANTS.COLUMN_CERT_STATUS - 1]);
      const notaOpt = values.length >= 5 ? limparTextoLira(values[CONFIG.PARTICIPANTS.COLUMN_NOTA - 1]) : '';
      const frequenciaOpt = values.length >= 6 ? limparTextoLira(values[CONFIG.PARTICIPANTS.COLUMN_FREQUENCIA - 1]) : '';

      const email = corrigirDominioEmail(rawEmail).email;
      const name = formatarNomeTitleCase(rawName).nome;

      // Só contabiliza no lote quando realmente precisa gerar um novo PDF (salta já gerados em <1ms)
      if (email && name && !certificateStatus) {
        const codigoHash = gerarHashAutenticidadeLira(name, email, settings.eventName, settings.eventDate);
        const newFileName = `${modeloModalidade.prefixoArquivo} - ${settings.eventName} - ${name}`;
        const pdfUrl = preencherTemplateEExportarPdfLira_(
          templateFile,
          outputFolder,
          newFileName,
          settings,
          { name: name, nota: notaOpt, frequencia: frequenciaOpt },
          codigoHash
        );
        sheet.getRange(currentRow, CONFIG.PARTICIPANTS.COLUMN_CERT_STATUS).setValue(pdfUrl);

        // Sugestão 3.3.1: Grava o registro público de autenticidade na aba "Registro_Autenticidade"
        registrarAutenticidadeCertificado(ss, {
          hash: codigoHash,
          nome: name,
          email: email,
          evento: settings.eventName,
          modalidade: settings.modality,
          dataEvento: settings.eventDate,
          urlPdf: pdfUrl
        });

        pdfsCreatedInBatch++;
        processedCountTotal++;
      }
    }

    SpreadsheetApp.flush();
    const nextRow = startRow + rowsScanned;

    if (nextRow <= lastRowInSheet) {
      props.setProperties({
        [BATCH_PROPERTY_KEY]: String(nextRow),
        [BATCH_PROCESSED_COUNT_KEY]: String(processedCountTotal)
      });
      limparGatilhosCertificados_();
      ScriptApp.newTrigger('continueCertificateGeneration')
        .timeBased()
        .after(45 * 1000)
        .create();
    } else {
      ss.toast('Geração de documentos concluída com sucesso!', 'Finalizado', 5);
      resetBatchProcess(false);
    }
  } catch (error) {
    ss.toast(`Erro: ${error.message}. O processo foi interrompido.`, 'Erro na Geração', 10);
    console.error('Erro ao gerar lote de certificados:', error);
    resetBatchProcess(false);
    throw new Error(`Ocorreu um erro no lote: ${error.message}`);
  } finally {
    lock.releaseLock();
  }
}

function limparGatilhosCertificados_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'continueCertificateGeneration') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}
