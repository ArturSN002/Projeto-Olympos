/**
 * Cria o menu personalizado na planilha quando ela é aberta.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Licenças')
    .addItem('Abrir', 'showSidebar')
    .addToUi();
}

/**
 * Exibe a barra lateral (sidebar) com a interface do usuário.
 */
function showSidebar() {
  const html = HtmlService.createTemplateFromFile('interface')
    .evaluate()
    .setTitle('Pincel de Homero — Licenças');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Retorna os nomes das abas que podem ser processadas, excluindo a de Configurações.
 * @returns {string[]} Lista de nomes de abas.
 */
function getSheetNames() {
  const excludedSheet = CONSTANTS.SHEET_NAMES.CONFIG;
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .map(sheet => sheet.getName())
    .filter(name => name !== excludedSheet);
}

/**
 * Executa o Diagnóstico Pré-Voo (Dry-Run) para a aba selecionada.
 * @param {string} sheetName Nome da aba.
 * @returns {object} Resultado do diagnóstico.
 */
function runPreFlightCheck(sheetName) {
  if (!sheetName || typeof sheetName !== 'string' || sheetName.trim() === "") {
    throw new Error('Selecione uma aba válida para o diagnóstico.');
  }
  return executarDiagnosticoPreVoo(sheetName);
}

/**
 * Inicia o processo de geração de documentos para a aba selecionada.
 * @param {string} sheetName O nome da aba a ser processada.
 * @returns {object} Um objeto indicando se o processo foi iniciado.
 */
function startGenerationProcess(sheetName) {
  if (!sheetName || typeof sheetName !== 'string' || sheetName.trim() === "") {
    return { started: false, message: 'Erro crítico: Nome de aba inválido.' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { started: false, message: 'O sistema está ocupado. Tente novamente em alguns segundos.' };
  }

  try {
    resetProcess(false);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return { started: false, message: `A aba "${sheetName}" não foi encontrada.` };
    }

    const totalRows = sheet.getLastRow();
    if (totalRows < 2) {
      return { started: false, message: 'Planilha vazia.' };
    }

    const columnMap = getColumnsForSheet(sheetName);
    const allValues = sheet.getRange(2, 1, totalRows - 1, Math.max(sheet.getLastColumn(), columnMap.STATUS)).getValues();

    const pendingRows = [];
    for (let i = 0; i < allValues.length; i++) {
      const row = allValues[i];
      const idPrincipal = limparTextoOlympos(row[(columnMap.NOME || columnMap.PORTARIA_ANULAR) - 1]);
      const val = limparTextoOlympos(row[columnMap.STATUS - 1]).toUpperCase();
      if (idPrincipal && (val === '' || val === 'GERANDO...' || val.startsWith('PENDENTE'))) {
        pendingRows.push(i + 2);
      }
    }

    if (pendingRows.length === 0) {
      return { started: false, message: 'Todas as licenças já foram geradas.' };
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
    ScriptApp.newTrigger('continueGeneration')
      .timeBased()
      .after(300)
      .create();

    return { started: true, message: 'Processo iniciado.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Função acionada por gatilho para continuar o processo de geração.
 */
function continueGeneration() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const sheetName = props.getProperty(CONSTANTS.STATE_KEYS.SHEET_NAME);

    if (!sheetName) {
      console.warn("Gatilho executado, mas nenhuma aba foi encontrada nas propriedades. Interrompendo.");
      resetProcess(false);
      return;
    }

    console.log(`Gatilho disparado. Continuando processo para a aba: "${sheetName}"`);
    generateBatch(sheetName);
  } catch (e) {
    console.error(`Erro crítico em continueGeneration: ${e.message}`);
    resetProcess(false);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retorna o status atual do processo em lote.
 * @returns {object} Objeto com o estado da geração.
 */
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

/**
 * Interrompe o processo de geração, deletando gatilhos e propriedades.
 * @param {boolean} showToast - Se deve exibir uma notificação para o usuário.
 * @returns {object} Objeto de sucesso.
 */
function resetProcess(showToast = true) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    limparGatilhosAntigos('continueGeneration');
    PropertiesService.getScriptProperties().deleteAllProperties();

    if (showToast) {
      SpreadsheetApp.getActiveSpreadsheet().toast('O processo foi interrompido pelo usuário.');
    }
    console.log("Processo de geração em lotes foi resetado.");
    return { success: true, message: 'Processo interrompido.' };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

/**
 * Inclui o conteúdo de outros arquivos (CSS/JS) no HTML principal.
 * @param {string} filename O nome do arquivo a ser incluído.
 * @returns {string} O conteúdo do arquivo.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
