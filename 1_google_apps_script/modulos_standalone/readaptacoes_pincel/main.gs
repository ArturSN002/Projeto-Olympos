function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Portarias')
    .addItem('Gerar Readaptações', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('interface')
    .evaluate()
    .setTitle('Pincel de Homero — Readaptações');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSheetNames() {
  const excludedSheet = CONSTANTS.SHEET_NAMES.CONFIG;
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .map(sheet => sheet.getName())
    .filter(name => name !== excludedSheet);
}

function runPreFlightCheck(sheetName) {
  if (!sheetName || sheetName.trim() === "") {
    throw new Error('Selecione uma aba válida para o diagnóstico.');
  }
  return executarDiagnosticoPreVoo(sheetName);
}

function startGenerationProcess(sheetName) {
  if (!sheetName || sheetName.trim() === "") {
    return { started: false, message: 'Erro: Nome da aba inválido.' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { started: false, message: 'Servidor ocupado. Tente novamente em alguns segundos.' };
  }

  try {
    resetProcess(false);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return { started: false, message: 'Aba não encontrada.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { started: false, message: 'Planilha vazia.' };

    const col = getColumnsForSheet(sheetName);
    const data = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 12)).getValues();

    const pendingRows = [];
    data.forEach((row, idx) => {
      const nome = limparTextoOlympos(row[col.NOME - 1]);
      const status = row[col.STATUS - 1];
      if (nome && isPendingGenerationStatus_(status)) {
        pendingRows.push(idx + 2);
      }
    });

    if (pendingRows.length === 0) {
      return { started: false, message: 'Nenhuma portaria pendente encontrada.' };
    }

    const state = {
      sheetName: sheetName,
      pendingRows: pendingRows,
      total: pendingRows.length,
      processedCount: 0
    };

    const props = PropertiesService.getScriptProperties();
    props.setProperty(CONSTANTS.STATE_KEYS.GENERATION_STATE, JSON.stringify(state));
    props.setProperty(CONSTANTS.STATE_KEYS.CURRENT_ROW, String(pendingRows[0]));
    props.setProperty(CONSTANTS.STATE_KEYS.SHEET_NAME, sheetName);
    props.setProperty(CONSTANTS.STATE_KEYS.TOTAL_ITEMS, pendingRows.length.toString());
    props.setProperty(CONSTANTS.STATE_KEYS.PROCESSED_ITEMS, '0');

    limparGatilhosAntigos('continueGeneration');
    ScriptApp.newTrigger('continueGeneration').timeBased().after(500).create();

    return { started: true, message: 'Iniciando geração em lote...' };
  } finally {
    lock.releaseLock();
  }
}

function continueGeneration() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const sheetName = props.getProperty(CONSTANTS.STATE_KEYS.SHEET_NAME);
    if (!sheetName) {
      resetProcess(false);
      return;
    }
    generateBatch(sheetName);
  } catch (e) {
    console.error(e);
    resetProcess(false);
  } finally {
    lock.releaseLock();
  }
}

function getProcessStatus() {
  const props = PropertiesService.getScriptProperties();
  const sheetName = props.getProperty(CONSTANTS.STATE_KEYS.SHEET_NAME);
  if (sheetName) {
    return {
      isRunning: true,
      sheetName: sheetName,
      processed: Number(props.getProperty(CONSTANTS.STATE_KEYS.PROCESSED_ITEMS) || 0),
      total: Number(props.getProperty(CONSTANTS.STATE_KEYS.TOTAL_ITEMS) || 1)
    };
  }
  return { isRunning: false };
}

function resetProcess(showToast = true) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    limparGatilhosAntigos('continueGeneration');
    PropertiesService.getScriptProperties().deleteAllProperties();
    if (showToast) SpreadsheetApp.getActiveSpreadsheet().toast('Processo parado.');
    return { success: true, message: 'Processo interrompido pelo usuário.' };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
