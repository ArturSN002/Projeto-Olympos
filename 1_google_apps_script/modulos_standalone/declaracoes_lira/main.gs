/**
 * @fileoverview Ponto de entrada principal da Lira de Orfeu (Certificados e Declarações).
 */

const BATCH_PROPERTY_KEY = 'CERTIFICATE_GENERATION_LAST_ROW';
const BATCH_TOTAL_KEY = 'CERTIFICATE_GENERATION_TOTAL';
const BATCH_PROCESSED_COUNT_KEY = 'CERTIFICATE_PROCESSED_COUNT';
const BATCH_SHEET_NAME_KEY = 'SHEET_NAME_FOR_BATCH';
const BATCH_START_ROW_KEY = 'CERTIFICATE_START_ROW';
const BATCH_MODALITY_KEY = 'CERTIFICATE_MODALITY';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Lira de Orfeu (Certificados/Declarações)')
    .addItem('Abrir Painel Lateral', 'showSidebar')
    .addSeparator()
    .addItem('🔍 Higienizar Lista (Remover Invisíveis e Corrigir E-mails)', 'higienizarAbaAtivaMenu')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('interface')
    .evaluate()
    .setTitle('Lira de Orfeu — Certificados e Declarações');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSheetNames() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(sheet => sheet.getName());
}

function getBatchProcessStatus() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const lastRow = allProps[BATCH_PROPERTY_KEY];
    const sheetName = allProps[BATCH_SHEET_NAME_KEY];
    const total = allProps[BATCH_TOTAL_KEY];
    const processed = allProps[BATCH_PROCESSED_COUNT_KEY];
    const startRow = allProps[BATCH_START_ROW_KEY];
    const modality = allProps[BATCH_MODALITY_KEY] || 'DECLARACAO';
    const remainingQuota = getRemainingEmailQuota();

    if (lastRow && sheetName) {
      return {
        isRunning: true,
        sheetName,
        modality,
        lastRow: Number(lastRow),
        processedCount: processed !== undefined ? Number(processed) : Math.max(0, Number(lastRow) - Number(startRow)),
        total: Number(total),
        startRow: Number(startRow),
        remainingQuota
      };
    }
    return { isRunning: false, remainingQuota };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Calcula quantos participantes precisam de certificados/declarações.
 */
function calculateTotalParticipants(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const startRow = CONFIG.PARTICIPANTS.START_ROW;
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return 0;

  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 3).getValues();
  let count = 0;
  data.forEach(row => {
    const email = limparTextoLira(row[CONFIG.PARTICIPANTS.COLUMN_EMAIL - 1]);
    const name = limparTextoLira(row[CONFIG.PARTICIPANTS.COLUMN_NAME - 1]);
    const status = limparTextoLira(row[CONFIG.PARTICIPANTS.COLUMN_CERT_STATUS - 1]);
    if (email && name && !status) {
      count++;
    }
  });
  return count;
}

function startCertificateGeneration(sheetName, modality) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    resetBatchProcess(false);

    // Higieniza nomes (\u2060 / Title Case) e e-mails (@gamil.com) antes de gerar os PDFs
    higienizarAbaParticipantes(sheetName);

    const total = calculateTotalParticipants(sheetName);
    if (total === 0) {
      return { started: false, message: 'Nenhum participante pendente para gerar documentos nesta aba.' };
    }

    const modNorm = normalizarModalidadeLira(modality);
    const props = PropertiesService.getScriptProperties();
    props.setProperties({
      [BATCH_PROPERTY_KEY]: String(CONFIG.PARTICIPANTS.START_ROW),
      [BATCH_SHEET_NAME_KEY]: sheetName,
      [BATCH_TOTAL_KEY]: String(total),
      [BATCH_PROCESSED_COUNT_KEY]: '0',
      [BATCH_START_ROW_KEY]: String(CONFIG.PARTICIPANTS.START_ROW),
      [BATCH_MODALITY_KEY]: modNorm
    });

    continueCertificateGeneration();
    return { started: true, message: `Processo iniciado no modo ${modNorm}.` };
  } finally {
    lock.releaseLock();
  }
}

function continueCertificateGeneration() {
  const props = PropertiesService.getScriptProperties();
  const lastRowProcessed = parseInt(props.getProperty(BATCH_PROPERTY_KEY), 10);
  const sheetName = props.getProperty(BATCH_SHEET_NAME_KEY);

  if (!sheetName || isNaN(lastRowProcessed)) {
    return;
  }

  generateCertificateBatch(sheetName, lastRowProcessed);
}

function resetBatchProcess(showToast = true) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    limparGatilhosCertificados_();
    const props = PropertiesService.getScriptProperties();
    props.deleteAllProperties();

    if (showToast) {
      SpreadsheetApp.getActiveSpreadsheet().toast('O processo de geração foi interrompido pelo usuário.');
    }
    console.log("Processo de geração em lotes foi resetado.");
    return { success: true, message: 'Processo interrompido.' };
  } finally {
    lock.releaseLock();
  }
}
