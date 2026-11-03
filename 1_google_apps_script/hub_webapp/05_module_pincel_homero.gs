/**
 * @fileoverview Módulo 3 — Pincel de Homero (Motor Unificado de Portarias de Licenças e Readaptações).
 * Conecta as pastas de Licenças (1tBiQ2z-LDVHZIvBuP7aKEkVLtzxK-pEJ) e Readaptações (1OH88mnT_Umm3d6viKtttJqF-9ccB1_yi).
 */

const PINCEL_CONSTANTS = {
  CONFIG_SHEET: 'Configurações',
  STATUS_GENERATED: 'Gerado',
  STATUS_GENERATING: 'Gerando...',
  BATCH_SIZE: 15,
  MAX_EXECUTION_TIME_MS: 250000, // 4m10s
  PROP_STATE_KEY: 'PINCEL_HOMERO_BATCH_STATE',

  COL_READAPTACAO: {
    PARECER: 1,
    NOME: 2,
    MATRICULA: 3,
    CARGO: 4,
    FUNCAO: 5,
    DATA_INICIO: 6,
    PORTARIA: 7,
    REPUBLICACAO: 8,
    RETROATIVO: 9,
    STATUS: 10,
    ARQUIVO: 11,
    DATA_PUBLICACAO: 12
  },

  COL_LICENCA_PREMIO: {
    NOME: 1,
    MATRICULA: 2,
    CARGO: 3,
    PERIODO_AQUISITIVO: 4,
    PORTARIA: 5,
    DATA_INICIO: 6,
    DATA_TERMINO: 7,
    REPUBLICACAO: 8,
    RETROATIVO: 9,
    ARQUIVO: 10,
    STATUS: 11
  },

  COL_LICENCA_NAO_REMUNERADA: {
    NOME: 1,
    MATRICULA: 2,
    CARGO: 3,
    ANOS_AFASTADOS: 4,
    PORTARIA: 5,
    DATA_INICIO: 6,
    DATA_TERMINO: 7,
    REPUBLICACAO: 8,
    RETROATIVO: 9,
    ARQUIVO: 10,
    STATUS: 11
  },

  COL_LICENCA_ANULACAO: {
    PORTARIA_ANULAR: 1,
    PARECER: 2,
    REPUBLICACAO: 3,
    RETROATIVO: 4,
    ARQUIVO: 5,
    STATUS: 6
  }
};

/**
 * Remove caracteres invisíveis (\u2060, \u200B-\u200D, \uFEFF) e espaços múltiplos.
 */
function limparTextoOlympos(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/[\u200B-\u200D\uFEFF\u2060]/g, '').trim().replace(/\s+/g, ' ');
}

function safeReplaceTextPincel_(body, pattern, replacement) {
  const safeVal = String(replacement === null || replacement === undefined ? '' : replacement).replace(/\$/g, '$$$$');
  body.replaceText(pattern, safeVal);
}

/**
 * Aplica negrito usando cálculo literal de índice (indexOf) com cursor progressivo e fallback,
 * imune a erros de RegExp com "?" ou "(a)" e a falsos positivos em números curtos.
 */
function aplicarNegritoLiteral(textElement, variaveisParaNegritar, fontSize) {
  const textoParagrafo = textElement.getText();
  let cursorBusca = 0;

  variaveisParaNegritar.forEach(termoBruto => {
    const termo = limparTextoOlympos(termoBruto);
    if (!termo) return;

    let posInicial = textoParagrafo.indexOf(termo, cursorBusca);
    if (posInicial === -1) {
      posInicial = textoParagrafo.indexOf(termo, 0);
    }

    while (posInicial !== -1) {
      const posFinal = posInicial + termo.length - 1;
      textElement.setBold(posInicial, posFinal, true);
      if (fontSize) {
        textElement.setFontSize(posInicial, posFinal, fontSize);
      }
      cursorBusca = Math.max(cursorBusca, posFinal + 1);
      posInicial = textoParagrafo.indexOf(termo, posInicial + termo.length);
    }
  });
}

function validarComponentesDataPincel_(ano, mesZeroBased, dia) {
  if (ano < 1900 || ano > 2100 || mesZeroBased < 0 || mesZeroBased > 11 || dia < 1 || dia > 31) {
    return null;
  }
  const dt = new Date(ano, mesZeroBased, dia, 12, 0, 0);
  if (
    isNaN(dt.getTime()) ||
    dt.getFullYear() !== ano ||
    dt.getMonth() !== mesZeroBased ||
    dt.getDate() !== dia
  ) {
    return null;
  }
  return dt;
}

/**
 * Converte data string (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) ou Date em objeto Date seguro ancorado às 12:00.
 */
function criarDataSemFusoPincel_(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0);
  }
  if (typeof dateInput !== 'string') return null;

  const texto = dateInput.trim();
  if (!texto || texto.includes('?')) return null;

  const matchISO = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (matchISO) {
    return validarComponentesDataPincel_(parseInt(matchISO[1], 10), parseInt(matchISO[2], 10) - 1, parseInt(matchISO[3], 10));
  }
  const matchBR = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchBR) {
    return validarComponentesDataPincel_(parseInt(matchBR[3], 10), parseInt(matchBR[2], 10) - 1, parseInt(matchBR[1], 10));
  }
  return null;
}

function formatarDataCurtaPincel_(dataObjeto) {
  if (!dataObjeto || isNaN(dataObjeto.getTime())) return '';
  return Utilities.formatDate(dataObjeto, 'America/Fortaleza', 'dd/MM/yyyy');
}

function formatarDataPorExtensoPincel_(dataObjeto, maiuscula) {
  if (!dataObjeto || isNaN(dataObjeto.getTime())) return '';
  const dia = String(dataObjeto.getDate()).padStart(2, '0');
  const ano = dataObjeto.getFullYear();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  let mes = meses[dataObjeto.getMonth()];
  if (maiuscula) return `${dia} DE ${mes.toUpperCase()} DE ${ano}`;
  mes = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${dia} de ${mes} de ${ano}`;
}

/**
 * Lista todas as planilhas e suas abas nas pastas de Licenças ou Readaptações,
 * garantindo o carregamento direto da planilha oficial de Licenças (1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc).
 * @param {string} operacao 'LICENCAS' ou 'READAPTACOES'.
 */
function listarPlanilhasEAbaPincel(operacao) {
  const folderId = operacao === 'LICENCAS'
    ? OLYMPOS_IDS.SUBPROJETOS.PINCEL_LICENCAS_PASTA
    : OLYMPOS_IDS.SUBPROJETOS.PINCEL_READAPT_PASTA;

  const idPlanilhaLicencasOficial = OLYMPOS_IDS.SUBPROJETOS.PINCEL_LICENCAS_PLANILHA || '1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc';
  const planilhas = [];
  const idsAdicionados = new Set();

  function adicionarPlanilhaPorId(sheetId) {
    if (!sheetId || idsAdicionados.has(sheetId)) return;
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      const abas = ss.getSheets()
        .map(s => s.getName())
        .filter(n => n !== PINCEL_CONSTANTS.CONFIG_SHEET);
      planilhas.push({
        id: sheetId,
        nome: ss.getName(),
        url: ss.getUrl ? ss.getUrl() : `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        abas: abas
      });
      idsAdicionados.add(sheetId);
    } catch (e) {
      console.warn(`Aviso ao abrir planilha ${sheetId}:`, e);
    }
  }

  // 1. Se a modalidade for LICENCAS, carrega prioritariamente a planilha oficial 1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc
  if (operacao === 'LICENCAS') {
    adicionarPlanilhaPorId(idPlanilhaLicencasOficial);
  }

  // 2. Varre também a pasta operacional correspondente por planilhas adicionais
  try {
    const folder = DriveApp.getFolderById(folderId);
    if (folder && typeof folder.getFilesByType === 'function') {
      const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
      while (files.hasNext()) {
        const file = files.next();
        const fId = file.getId();
        // Evita misturar a planilha de Licenças quando estiver na visão de Readaptações
        if (operacao === 'READAPTACOES' && fId === idPlanilhaLicencasOficial) continue;
        adicionarPlanilhaPorId(fId);
      }
    }
  } catch (e) {
    console.warn(`Aviso ao listar pasta ${folderId}:`, e);
  }

  return {
    operacao: operacao,
    folderId: folderId,
    planilhas: planilhas
  };
}

/**
 * Resolve o mapeamento de colunas de acordo com o nome da aba e a operação,
 * priorizando a identificação das abas de Licenças (Premio, Não remunerada, Anulação de licença).
 */
function obterColunasPincel_(operacao, sheetName) {
  const norm = String(sheetName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (norm.includes('anulacao')) {
    return { tipo: 'ANULACAO', col: PINCEL_CONSTANTS.COL_LICENCA_ANULACAO };
  }
  if (norm.includes('remunerada')) {
    return { tipo: 'NAO_REMUNERADA', col: PINCEL_CONSTANTS.COL_LICENCA_NAO_REMUNERADA };
  }
  if (norm.includes('premio') || operacao === 'LICENCAS') {
    return { tipo: 'PREMIO', col: PINCEL_CONSTANTS.COL_LICENCA_PREMIO };
  }
  return { tipo: 'READAPTACAO', col: PINCEL_CONSTANTS.COL_READAPTACAO };
}

/**
 * Valida uma linha de Portaria (Licença ou Readaptação) para garantir ausência de "?", "??" ou campos vazios.
 * Permite Número de Portaria vazio quando `permitirAutoNumApolo` for verdadeiro.
 */
function validarLinhaPincel_(rowData, tipo, col, permitirAutoNumApolo) {
  const inconsistencias = [];
  function exigir(label, val) {
    const s = limparTextoOlympos(val);
    if (!s || s === '?' || s === '??' || s.includes('?')) {
      inconsistencias.push(label);
    }
  }

  if (tipo === 'READAPTACAO') {
    exigir('Proc. Adm./Parecer', rowData[col.PARECER - 1]);
    exigir('Nome Completo', rowData[col.NOME - 1]);
    exigir('Matrícula', rowData[col.MATRICULA - 1]);
    exigir('Cargo', rowData[col.CARGO - 1]);
    exigir('Função Readaptada', rowData[col.FUNCAO - 1]);
    exigir('Data de Início', rowData[col.DATA_INICIO - 1]);
    const strPort = limparTextoOlympos(rowData[col.PORTARIA - 1]);
    if (!permitirAutoNumApolo || strPort.includes('?')) {
      exigir('Número de Portaria', rowData[col.PORTARIA - 1]);
    }
    if (!inconsistencias.includes('Data de Início') && !criarDataSemFusoPincel_(rowData[col.DATA_INICIO - 1])) {
      inconsistencias.push('Data de Início (inválida)');
    }
  } else if (tipo === 'ANULACAO') {
    exigir('Portaria a Anular', rowData[col.PORTARIA_ANULAR - 1]);
    exigir('Parecer Jurídico', rowData[col.PARECER - 1]);
  } else {
    exigir('Nome Completo', rowData[col.NOME - 1]);
    exigir('Matrícula', rowData[col.MATRICULA - 1]);
    exigir('Cargo', rowData[col.CARGO - 1]);
    const strPortLic = limparTextoOlympos(rowData[col.PORTARIA - 1]);
    if (!permitirAutoNumApolo || strPortLic.includes('?')) {
      exigir('Número de Portaria', rowData[col.PORTARIA - 1]);
    }
    exigir('Data de Início', rowData[col.DATA_INICIO - 1]);
    if (tipo === 'PREMIO') {
      exigir('Período Aquisitivo', rowData[col.PERIODO_AQUISITIVO - 1]);
    } else {
      exigir('Anos Afastados', rowData[col.ANOS_AFASTADOS - 1]);
    }
    if (!inconsistencias.includes('Data de Início') && !criarDataSemFusoPincel_(rowData[col.DATA_INICIO - 1])) {
      inconsistencias.push('Data de Início (inválida)');
    }
  }

  if (inconsistencias.length > 0) {
    throw new Error(`Campos pendentes ou com '?': ${inconsistencias.join(', ')}`);
  }
}

/**
 * Sugestão 3.1.1 no Hub: Aloca o próximo número sequencial de Portaria via Olho de Apolo (.md 1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn)
 * quando vazio em Readaptações ou Licenças, persistindo imediatamente o incremento no arquivo .md no Drive.
 */
function alocarProximoNumeroPortariaPincelApolo_(allValues, colPortaria) {
  const estadoApolo = obterOuSincronizarNumeracaoApolo(false);
  let maior = parseInt(estadoApolo.ultimaPortaria2026, 10) || 162;

  if (Array.isArray(allValues) && colPortaria) {
    allValues.forEach(r => {
      const val = limparTextoOlympos(r[colPortaria - 1]);
      const m = val.match(/^(\d{1,4})(?:[\/\-]\d{4})?$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maior && n < 5000) maior = n;
      }
    });
  }

  const proximo = maior + 1;
  estadoApolo.ultimaPortaria2026 = proximo;
  estadoApolo.proximaPortaria2026 = proximo + 1;
  if (typeof gravarEstadoNumeracaoNoArquivoMd_ === 'function') {
    gravarEstadoNumeracaoNoArquivoMd_(
      estadoApolo,
      `[AUTO-NUMERAÇÃO PINCEL]: Portaria nº ${proximo}/2026 alocada automaticamente. Próxima disponível: nº ${proximo + 1}.`
    );
  } else {
    PropertiesService.getScriptProperties().setProperty(APOLO_PROP_CACHE_KEY, JSON.stringify(estadoApolo));
  }
  return String(proximo).padStart(3, '0');
}

/**
 * Sugestão 3.2.3 no Hub: Registra carimbo de revogação cruzada nas abas Premio ou Não remunerada ao gerar Anulação.
 */
function registrarRevogacaoCruzadaPincel_(ss, portariaAnuladaRaw, parecerJuridico, urlPortariaAnulacao, anoRef) {
  if (!ss) return { revogadaEncontrada: false };
  const alvoBruto = limparTextoOlympos(portariaAnuladaRaw);
  if (!alvoBruto) return { revogadaEncontrada: false };

  const matchNumAlvo = alvoBruto.match(/(\d{1,4})/);
  const numAlvoInt = matchNumAlvo ? parseInt(matchNumAlvo[1], 10) : null;
  const ano = limparTextoOlympos(anoRef) || '2026';
  const numExibicao = matchNumAlvo ? matchNumAlvo[1] : alvoBruto;
  const carimbo = `ANULADA PELA PORTARIA Nº ${numExibicao}/${ano} (Parecer ${limparTextoOlympos(parecerJuridico)}) — ${urlPortariaAnulacao}`;

  const abasBusca = ['Premio', 'Não remunerada'];
  for (let a = 0; a < abasBusca.length; a++) {
    const nomeAba = abasBusca[a];
    const sheetOrigem = ss.getSheetByName(nomeAba);
    if (!sheetOrigem) continue;

    const { col } = obterColunasPincel_('LICENCAS', nomeAba);
    const lastRow = sheetOrigem.getLastRow();
    if (lastRow < 2) continue;

    const rows = sheetOrigem.getRange(2, 1, lastRow - 1, Math.max(sheetOrigem.getLastColumn(), col.STATUS)).getValues();
    for (let i = 0; i < rows.length; i++) {
      const portLinha = limparTextoOlympos(rows[i][col.PORTARIA - 1]);
      if (!portLinha) continue;
      const mLinha = portLinha.match(/(\d{1,4})/);
      const numLinhaInt = mLinha ? parseInt(mLinha[1], 10) : null;
      if (portLinha.toLowerCase() === alvoBruto.toLowerCase() || (numAlvoInt !== null && numAlvoInt === numLinhaInt)) {
        const linhaPlanilha = i + 2;
        sheetOrigem.getRange(linhaPlanilha, col.STATUS).setValue(carimbo);
        return { revogadaEncontrada: true, abaOrigem: nomeAba, linhaOrigem: linhaPlanilha, carimbo: carimbo };
      }
    }
  }
  return { revogadaEncontrada: false, carimbo: carimbo };
}

/**
 * 1. Diagnóstico Pré-Voo (Dry-Run): Varre a aba selecionada e lista qualquer linha com "?", "??" ou vazia.
 */
function executarDiagnosticoPincelHomero(spreadsheetId, sheetName, operacao) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada.`);

  const { tipo, col } = obterColunasPincel_(operacao, sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), col.STATUS || 12);

  if (lastRow < 2) {
    return { totalPendentes: 0, validas: 0, invalidas: 0, erros: [] };
  }

  const allValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const erros = [];
  let totalPendentes = 0;
  let validas = 0;

  allValues.forEach((row, idx) => {
    const numLinha = idx + 2;
    const idCol = (col.NOME || col.PORTARIA_ANULAR) - 1;
    const identificador = limparTextoOlympos(row[idCol]);
    const statusAtual = limparTextoOlympos(row[col.STATUS - 1]).toUpperCase();

    if (!identificador && !limparTextoOlympos(row[(col.PORTARIA || col.PARECER) - 1])) return;
    if (statusAtual === PINCEL_CONSTANTS.STATUS_GENERATED.toUpperCase()) return;

    totalPendentes++;
    try {
      const permiteAutoNum = (tipo === 'READAPTACAO' || tipo === 'PREMIO' || tipo === 'NAO_REMUNERADA');
      validarLinhaPincel_(row, tipo, col, permiteAutoNum);
      validas++;
    } catch (e) {
      erros.push({
        linha: numLinha,
        servidor: identificador || '(Sem nome)',
        motivo: e.message
      });
    }
  });

  return {
    planilha: ss.getName(),
    aba: sheetName,
    operacao: operacao,
    totalPendentes: totalPendentes,
    validas: validas,
    invalidas: erros.length,
    erros: erros
  };
}

/**
 * 2. Inicia a Geração de Portarias em Lote pelo Hub Olympos.
 */
function iniciarGeracaoLotePincelHomero(spreadsheetId, sheetName, operacao) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada.`);

  const { col } = obterColunasPincel_(operacao, sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { started: false, message: 'A aba selecionada está vazia.' };
  }

  const allValues = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), col.STATUS)).getValues();
  const pendingRows = [];

  allValues.forEach((row, idx) => {
    const idCol = (col.NOME || col.PORTARIA_ANULAR) - 1;
    const identificador = limparTextoOlympos(row[idCol]);
    const statusAtual = limparTextoOlympos(row[col.STATUS - 1]).toUpperCase();
    if (identificador && statusAtual !== PINCEL_CONSTANTS.STATUS_GENERATED.toUpperCase()) {
      pendingRows.push(idx + 2);
    }
  });

  if (pendingRows.length === 0) {
    return { started: false, message: 'Nenhuma portaria pendente para gerar nesta aba.' };
  }

  const state = {
    spreadsheetId: spreadsheetId,
    sheetName: sheetName,
    operacao: operacao,
    pendingRows: pendingRows,
    total: pendingRows.length,
    processedCount: 0,
    generatedFiles: [],
    errors: []
  };

  const props = PropertiesService.getScriptProperties();
  props.setProperty(PINCEL_CONSTANTS.PROP_STATE_KEY, JSON.stringify(state));

  processarLotePincelHomero();
  return {
    started: true,
    total: state.total,
    message: `Geração iniciada para ${state.total} portaria(s) em "${sheetName}".`
  };
}

/**
 * Executa um lote de geração de Portarias (Readaptação ou Licença) com Fail-Fast e Batch Read.
 */
function processarLotePincelHomero() {
  const startTime = Date.now();
  const props = PropertiesService.getScriptProperties();
  const stateJSON = props.getProperty(PINCEL_CONSTANTS.PROP_STATE_KEY);
  if (!stateJSON) return { status: 'IDLE' };

  const state = JSON.parse(stateJSON);

  try {
    const ss = SpreadsheetApp.openById(state.spreadsheetId);
    const sheet = ss.getSheetByName(state.sheetName);
    const configSheet = ss.getSheetByName(PINCEL_CONSTANTS.CONFIG_SHEET);
    if (!sheet || !configSheet) {
      throw new Error('Aba de dados ou aba "Configurações" não localizada na planilha.');
    }

    // Leitura em lote das configurações (A2:D2) em 1 única chamada RPC com fallback para os IDs oficiais dos Modelos Docs
    const cfgRow = configSheet.getRange('A2:D2').getValues()[0];
    const templatePadrao = state.operacao === 'LICENCAS'
      ? (OLYMPOS_IDS.MODELOS_DOCS && OLYMPOS_IDS.MODELOS_DOCS.LICENCA) || '1AwMpqn0RUP9uDw7YPcPP0TsZ5MZ71Nr2gSlbRRXZ7iw'
      : (OLYMPOS_IDS.MODELOS_DOCS && OLYMPOS_IDS.MODELOS_DOCS.READAPTACAO) || '1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce54';
    const pastaPadrao = state.operacao === 'LICENCAS'
      ? OLYMPOS_IDS.SUBPROJETOS.PINCEL_LICENCAS_PASTA
      : OLYMPOS_IDS.SUBPROJETOS.PINCEL_READAPT_PASTA;
    const estadoGlobalMd = typeof obterOuSincronizarNumeracaoApolo === 'function'
      ? obterOuSincronizarNumeracaoApolo(false)
      : {};
    const settings = {
      templateId: limparTextoOlympos(cfgRow[0]) || templatePadrao,
      folderId: limparTextoOlympos(cfgRow[1]) || pastaPadrao,
      anoRef: limparTextoOlympos(cfgRow[2]) || estadoGlobalMd.anoExercicioAtivo || '2026',
      secretario: limparTextoOlympos(cfgRow[3]) || estadoGlobalMd.signatarioTitular || 'Secretário(a) Municipal de Educação Básica'
    };

    const { tipo, col } = obterColunasPincel_(state.operacao, state.sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), col.STATUS || 12);
    const allValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const templateFile = DriveApp.getFileById(settings.templateId);
    const destinationFolder = DriveApp.getFolderById(settings.folderId);

    const startIndex = state.processedCount;
    const endIndex = Math.min(startIndex + PINCEL_CONSTANTS.BATCH_SIZE, state.total);

    for (let i = startIndex; i < endIndex; i++) {
      if (Date.now() - startTime > PINCEL_CONSTANTS.MAX_EXECUTION_TIME_MS) {
        break;
      }

      const currentRow = state.pendingRows[i];
      const rowData = allValues[currentRow - 2];
      const statusCell = sheet.getRange(currentRow, col.STATUS);

      try {
        statusCell.setValue(PINCEL_CONSTANTS.STATUS_GENERATING);

        // Sugestão 3.1.1: Auto-numeração Olho de Apolo para Readaptações e Licenças quando Número de Portaria estiver vazio
        if (tipo === 'READAPTACAO' || tipo === 'PREMIO' || tipo === 'NAO_REMUNERADA') {
          const numPortAtual = limparTextoOlympos(rowData[col.PORTARIA - 1]);
          if (!numPortAtual || numPortAtual.toUpperCase() === 'AUTO') {
            validarLinhaPincel_(rowData, tipo, col, true);
            const novoNum = alocarProximoNumeroPortariaPincelApolo_(allValues, col.PORTARIA);
            rowData[col.PORTARIA - 1] = novoNum;
            sheet.getRange(currentRow, col.PORTARIA).setValue(novoNum);
          }
        }

        const resultado = gerarDocumentoPortariaUnificado_(
          rowData,
          tipo,
          col,
          state.sheetName,
          settings,
          templateFile,
          destinationFolder
        );
        sheet.getRange(currentRow, col.ARQUIVO).setValue(resultado.url);
        if (resultado.endDate && col.DATA_TERMINO) {
          sheet.getRange(currentRow, col.DATA_TERMINO).setValue(resultado.endDate);
        }

        if (!state.generatedFiles) state.generatedFiles = [];
        if (!state.errors) state.errors = [];

        state.generatedFiles.push({
          linha: currentRow,
          identificador: String(rowData[(col.NOME || col.PORTARIA_ANULAR) - 1] || '').trim(),
          matricula: col.MATRICULA ? String(rowData[col.MATRICULA - 1] || '').trim() : '',
          portaria: String(rowData[(col.PORTARIA || col.PORTARIA_ANULAR) - 1] || '').trim(),
          url: resultado.url
        });

        // Sugestão 3.2.3: Carimbo de revogação cruzada quando gerar Anulação de Licença
        if (tipo === 'ANULACAO') {
          const rev = registrarRevogacaoCruzadaPincel_(
            ss,
            rowData[col.PORTARIA_ANULAR - 1],
            rowData[col.PARECER - 1],
            resultado.url,
            settings.anoRef
          );
          if (rev.revogadaEncontrada) {
            statusCell.setValue(`${PINCEL_CONSTANTS.STATUS_GENERATED} (Revogou linha ${rev.linhaOrigem} em ${rev.abaOrigem})`);
          } else {
            statusCell.setValue(PINCEL_CONSTANTS.STATUS_GENERATED);
          }
        } else {
          statusCell.setValue(PINCEL_CONSTANTS.STATUS_GENERATED);
        }
      } catch (e) {
        statusCell.setValue(`Erro: ${e.message}`);
        if (!state.errors) state.errors = [];
        state.errors.push({
          linha: currentRow,
          identificador: String(rowData[(col.NOME || col.PORTARIA_ANULAR) - 1] || `Linha ${currentRow}`).trim(),
          motivo: e.message
        });
      }

      state.processedCount++;
    }

    SpreadsheetApp.flush();

    if (state.processedCount < state.total) {
      props.setProperty(PINCEL_CONSTANTS.PROP_STATE_KEY, JSON.stringify(state));
      limparGatilhosPincel_();
      ScriptApp.newTrigger('processarLotePincelHomero').timeBased().after(45 * 1000).create();
      return {
        status: 'IN_PROGRESS',
        processed: state.processedCount,
        total: state.total
      };
    } else {
      const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');
      const finalJobData = {
        operacao: state.operacao,
        sheetName: state.sheetName,
        total: state.total,
        processed: state.processedCount,
        generatedFiles: state.generatedFiles || [],
        errors: state.errors || [],
        completedAt: agora
      };
      props.setProperty('PINCEL_HOMERO_LAST_COMPLETED_JOB', JSON.stringify(finalJobData));

      registrarAlertaMemoriaOlympos(
        '_memoria_homero.md',
        `[${agora}] Lote concluído (${state.operacao} - ${state.sheetName}): ${state.total} portaria(s) processada(s).`
      );
      pararGeracaoLotePincelHomero();
      return {
        status: 'COMPLETED',
        processed: state.total,
        total: state.total,
        generatedFiles: state.generatedFiles || [],
        errors: state.errors || []
      };
    }
  } catch (err) {
    pararGeracaoLotePincelHomero();
    return { status: 'ERROR', message: err.message };
  }
}

function gerarDocumentoPortariaUnificado_(rowData, tipo, col, sheetName, settings, templateFile, destinationFolder) {
  // 1. Fail-Fast antes de criar arquivo no Google Drive
  validarLinhaPincel_(rowData, tipo, col);

  const hoje = new Date();
  const isRepublicado = limparTextoOlympos(rowData[col.REPUBLICACAO - 1]).toUpperCase() === 'SIM';
  const isRetroativo = limparTextoOlympos(rowData[col.RETROATIVO - 1]).toUpperCase() === 'SIM';

  if (tipo === 'READAPTACAO') {
    const numParecer = limparTextoOlympos(rowData[col.PARECER - 1]);
    const nomeCompleto = limparTextoOlympos(rowData[col.NOME - 1]).toUpperCase();
    const matricula = limparTextoOlympos(rowData[col.MATRICULA - 1]);
    const cargo = limparTextoOlympos(rowData[col.CARGO - 1]);
    const funcao = limparTextoOlympos(rowData[col.FUNCAO - 1]);
    const numPortaria = limparTextoOlympos(rowData[col.PORTARIA - 1]);
    const dataInicioObj = criarDataSemFusoPincel_(rowData[col.DATA_INICIO - 1]);
    const dataPubObj = criarDataSemFusoPincel_(rowData[col.DATA_PUBLICACAO - 1]) || hoje;

    const dataInicioFormatada = formatarDataCurtaPincel_(dataInicioObj);
    const textoArt1 = `Conceder a(o) servidor(a) ${nomeCompleto} - Matrícula nº ${matricula}, categoria funcional ${cargo}, integrante do quadro de pessoal da Secretaria Municipal de Educação Básica, readaptação de função em razão de limitação ocupacional verificada e atestada por meio de inspeção médica, devendo o(a) mesmo(a) exercer a função de ${funcao}.`;
    const artigo02Texto = isRetroativo
      ? `Esta portaria entra em vigor na data de sua publicação, retroagindo seus efeitos à ${dataInicioFormatada}.`
      : `Esta portaria entra em vigor na data de sua publicação, revogando-se as disposições em contrário.`;

    const fileName = `Portaria Nº${numPortaria.replace(/\//g, '-')}_${settings.anoRef} - Readaptação - ${nomeCompleto}`;
    const newFile = templateFile.makeCopy(fileName, destinationFolder);
    const doc = DocumentApp.openById(newFile.getId());
    const body = doc.getBody();

    safeReplaceTextPincel_(body, '\\{\\{secretario\\}\\}', settings.secretario.toUpperCase());
    safeReplaceTextPincel_(body, '\\{\\{portaria\\}\\}', numPortaria);
    safeReplaceTextPincel_(body, '\\{\\{parecer\\}\\}', numParecer);
    safeReplaceTextPincel_(body, '\\{\\{republicado\\}\\}', isRepublicado ? '*Republicado por incorreção' : '');
    safeReplaceTextPincel_(body, '\\{\\{dataPubCab\\}\\}', formatarDataPorExtensoPincel_(dataPubObj, true));
    safeReplaceTextPincel_(body, '\\{\\{DataPubRod\\}\\}', formatarDataPorExtensoPincel_(dataPubObj, false));

    const rangeArt1 = body.findText('\\{\\{artigo01\\}\\}');
    if (rangeArt1) {
      const textElement = rangeArt1.getElement().asText();
      textElement.setText(textoArt1);
      textElement.setBold(false);
      aplicarNegritoLiteral(textElement, [nomeCompleto, matricula, cargo, funcao]);
    }

    safeReplaceTextPincel_(body, '\\{\\{artigo02\\}\\}', artigo02Texto);
    doc.saveAndClose();
    return { url: newFile.getUrl() };
  }

  if (tipo === 'ANULACAO') {
    const numeroPortaria = limparTextoOlympos(rowData[col.PORTARIA_ANULAR - 1]);
    const parecer = limparTextoOlympos(rowData[col.PARECER - 1]);
    const fileName = `Portaria de Anulação Nº${numeroPortaria.replace(/\//g, '-')}_${settings.anoRef}`;
    const newFile = templateFile.makeCopy(fileName, destinationFolder);
    const doc = DocumentApp.openById(newFile.getId());
    const body = doc.getBody();

    safeReplaceTextPincel_(body, '\\{\\{secretario\\}\\}', settings.secretario.toUpperCase());
    safeReplaceTextPincel_(body, '\\{\\{portaria\\}\\}', numeroPortaria);
    safeReplaceTextPincel_(body, '\\{\\{republicado\\}\\}', isRepublicado ? '*Republicado por incorreção' : '');
    safeReplaceTextPincel_(body, '\\{\\{dataPubCab\\}\\}', formatarDataPorExtensoPincel_(hoje, true));
    safeReplaceTextPincel_(body, '\\{\\{DataPubRod\\}\\}', formatarDataPorExtensoPincel_(hoje, false));
    safeReplaceTextPincel_(body, '\\{\\{artigo01\\}\\}', `Art. 1º. Torna-se sem efeito a portaria Nº ${numeroPortaria} - SMEB, em razão do que constante no parecer jurídico Nº ${parecer}.`);

    doc.saveAndClose();
    return { url: newFile.getUrl() };
  }

  // PREMIO ou NAO_REMUNERADA
  const nomeCompleto = limparTextoOlympos(rowData[col.NOME - 1]);
  const nomeCompletoUpper = nomeCompleto.toUpperCase();
  const numeroPortaria = limparTextoOlympos(rowData[col.PORTARIA - 1]);
  const mat = limparTextoOlympos(rowData[col.MATRICULA - 1]);
  const cargo = limparTextoOlympos(rowData[col.CARGO - 1]);
  const dataInicioObj = criarDataSemFusoPincel_(rowData[col.DATA_INICIO - 1]);

  let dataFinalObj = new Date(dataInicioObj.getTime());
  if (tipo === 'PREMIO') {
    dataFinalObj.setDate(dataFinalObj.getDate() + 89);
  } else {
    const anos = parseInt(limparTextoOlympos(rowData[col.ANOS_AFASTADOS - 1]), 10);
    dataFinalObj.setFullYear(dataFinalObj.getFullYear() + anos);
    dataFinalObj.setDate(dataFinalObj.getDate() - 1);
  }

  const dataInicioFormatada = formatarDataCurtaPincel_(dataInicioObj);
  const dataFinalFormatada = formatarDataCurtaPincel_(dataFinalObj);
  const periodo = `${dataInicioFormatada} a ${dataFinalFormatada}`;
  const art1 = 'Art. 1º.';
  const art2 = 'Art. 2º.';

  const textoLicenca = (tipo === 'PREMIO')
    ? `Licença Prêmio de 90 (noventa) dias, referente ao ${limparTextoOlympos(rowData[col.PERIODO_AQUISITIVO - 1])}º período aquisitivo, a contar de ${periodo}`
    : `Licença sem remuneração de ${limparTextoOlympos(rowData[col.ANOS_AFASTADOS - 1])} ano(s), a contar de ${periodo}`;

  const textoCompletoArt1 = `${art1} Conceder a(o) servidor(a) ${nomeCompletoUpper} - Matrícula nº ${mat}, categoria funcional ${cargo}, integrante do quadro de pessoal da Secretaria Municipal de Educação Básica, ${textoLicenca}.`;
  const artigo02TextoRestante = isRetroativo
    ? `Esta portaria entra em vigor na data de sua publicação, retroagindo seus efeitos à ${dataInicioFormatada}.`
    : `Esta portaria entra em vigor na data de sua publicação, revogando-se as disposições em contrário.`;

  const fileName = `Portaria Nº${numeroPortaria.replace(/\//g, '-')}_${settings.anoRef} - ${sheetName} - ${nomeCompleto}`;
  const newFile = templateFile.makeCopy(fileName, destinationFolder);
  const doc = DocumentApp.openById(newFile.getId());
  const body = doc.getBody();

  safeReplaceTextPincel_(body, '\\{\\{secretario\\}\\}', settings.secretario.toUpperCase());
  safeReplaceTextPincel_(body, '\\{\\{portaria\\}\\}', numeroPortaria);
  safeReplaceTextPincel_(body, '\\{\\{republicado\\}\\}', isRepublicado ? '*Republicado por incorreção' : '');
  safeReplaceTextPincel_(body, '\\{\\{dataPubCab\\}\\}', formatarDataPorExtensoPincel_(hoje, true));
  safeReplaceTextPincel_(body, '\\{\\{DataPubRod\\}\\}', formatarDataPorExtensoPincel_(hoje, false));

  const rangeArt1 = body.findText('\\{\\{artigo01\\}\\}');
  if (rangeArt1) {
    const textElement = rangeArt1.getElement().asText();
    textElement.setText(textoCompletoArt1);
    textElement.setBold(false);
    textElement.setFontSize(12);
    aplicarNegritoLiteral(textElement, [art1, nomeCompletoUpper, mat, cargo, periodo], 12);
  }

  const rangeArt2 = body.findText('\\{\\{artigo02\\}\\}');
  if (rangeArt2) {
    const textElement02 = rangeArt2.getElement().asText();
    textElement02.setText('');
    textElement02.appendText(art2 + ' ');
    textElement02.setBold(0, art2.length - 1, true);
    textElement02.setFontSize(0, art2.length - 1, 12);
    const boldEnd = textElement02.getText().length;
    textElement02.appendText(artigo02TextoRestante);
    textElement02.setBold(boldEnd, textElement02.getText().length - 1, false);
    textElement02.setFontSize(boldEnd, textElement02.getText().length - 1, 12);
  }

  doc.saveAndClose();
  return { url: newFile.getUrl(), endDate: dataFinalFormatada };
}

function obterStatusLotePincelHomero() {
  const props = PropertiesService.getScriptProperties();
  const stateJSON = props.getProperty(PINCEL_CONSTANTS.PROP_STATE_KEY);
  const lastJobJSON = props.getProperty('PINCEL_HOMERO_LAST_COMPLETED_JOB');
  const ultimoLote = lastJobJSON ? JSON.parse(lastJobJSON) : null;

  if (!stateJSON) {
    return {
      isRunning: false,
      ultimoLoteConcluido: ultimoLote
    };
  }

  const state = JSON.parse(stateJSON);
  return {
    isRunning: true,
    operacao: state.operacao,
    sheetName: state.sheetName,
    processed: state.processedCount,
    total: state.total,
    generatedFiles: state.generatedFiles || [],
    errors: state.errors || [],
    ultimoLoteConcluido: ultimoLote
  };
}

function pararGeracaoLotePincelHomero() {
  limparGatilhosPincel_();
  PropertiesService.getScriptProperties().deleteProperty(PINCEL_CONSTANTS.PROP_STATE_KEY);
  return { status: 'STOPPED', message: 'Processo interrompido com sucesso.' };
}

function limparGatilhosPincel_() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'processarLotePincelHomero') {
      ScriptApp.deleteTrigger(t);
    }
  });
}

/**
 * Gera um Ofício Oficial individual na pasta Ofícios de 2026 (1H4bJXClx66Mr5PmRmSQBQLHDpAaKwdab)
 * a partir do Modelo Oficial de Ofício no Google Docs (1HgPOD0BzOO3t33eN2DuRjrH64vnuoJnxyp5VX6ec8Xw),
 * consumindo e atualizando automaticamente o contador Proximo_Oficio_2026 no arquivo .md (1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn).
 */
function gerarOficioPadraoHomero(dadosOficio) {
  const estadoApolo = obterOuSincronizarNumeracaoApolo(false);
  const numExplicito = limparTextoOlympos(dadosOficio && dadosOficio.numero);
  const numInt = numExplicito ? (parseInt(numExplicito, 10) || estadoApolo.proximoOficio2026) : estadoApolo.proximoOficio2026;
  const numOficio = numExplicito || String(numInt).padStart(3, '0');

  const destinatario = limparTextoOlympos(dadosOficio && dadosOficio.destinatario);
  const cargoDestinatario = limparTextoOlympos(dadosOficio && dadosOficio.cargoDestinatario) || '';
  const orgaoDestinatario = limparTextoOlympos(dadosOficio && dadosOficio.orgaoDestinatario) || '';
  const assunto = limparTextoOlympos(dadosOficio && dadosOficio.assunto);
  const corpoTexto = limparTextoOlympos(dadosOficio && dadosOficio.corpo);
  const vocativo = limparTextoOlympos(dadosOficio && dadosOficio.vocativo) || 'Senhor(a),';
  const fecho = limparTextoOlympos(dadosOficio && dadosOficio.fecho) || 'Atenciosamente,';
  const signatario = limparTextoOlympos(dadosOficio && dadosOficio.signatario) || estadoApolo.signatarioTitular || 'Secretário(a) Municipal de Educação Básica';
  const cargoSignatario = limparTextoOlympos(dadosOficio && dadosOficio.cargoSignatario) || estadoApolo.cargoSignatario || 'Secretário(a) Municipal de Educação Básica';

  if (!destinatario || !assunto || !corpoTexto) {
    throw new Error('Destinatário, Assunto e Corpo do texto são obrigatórios para emitir o Ofício.');
  }

  const templateId = (OLYMPOS_IDS.MODELOS_DOCS && OLYMPOS_IDS.MODELOS_DOCS.OFICIO) || '1HgPOD0BzOO3t33eN2DuRjrH64vnuoJnxyp5VX6ec8Xw';
  const folderId = (dadosOficio && dadosOficio.folderId) || OLYMPOS_IDS.SETORES_2026.OFICIOS;

  const templateFile = DriveApp.getFileById(templateId);
  const folder = DriveApp.getFolderById(folderId);
  const hoje = new Date();
  const dataExtenso = formatarDataPorExtensoPincel_(hoje, false);

  const fileName = `Ofício nº ${numOficio.replace(/\//g, '-')}_2026 - ${destinatario} - ${assunto}`.substring(0, 120);
  const newFile = templateFile.makeCopy(fileName, folder);
  const doc = DocumentApp.openById(newFile.getId());
  const body = doc.getBody();

  safeReplaceTextPincel_(body, '\\{\\{num_oficio\\}\\}', numOficio);
  safeReplaceTextPincel_(body, '\\{\\{oficio\\}\\}', numOficio);
  safeReplaceTextPincel_(body, '\\{\\{numero\\}\\}', numOficio);
  safeReplaceTextPincel_(body, '\\{\\{data_extenso\\}\\}', dataExtenso);
  safeReplaceTextPincel_(body, '\\{\\{data\\}\\}', dataExtenso);
  safeReplaceTextPincel_(body, '\\{\\{destinatario\\}\\}', destinatario);
  safeReplaceTextPincel_(body, '\\{\\{cargo_destinatario\\}\\}', cargoDestinatario);
  safeReplaceTextPincel_(body, '\\{\\{orgao_destinatario\\}\\}', orgaoDestinatario);
  safeReplaceTextPincel_(body, '\\{\\{assunto\\}\\}', assunto);
  safeReplaceTextPincel_(body, '\\{\\{vocativo\\}\\}', vocativo);
  safeReplaceTextPincel_(body, '\\{\\{corpo_texto\\}\\}', corpoTexto);
  safeReplaceTextPincel_(body, '\\{\\{corpo\\}\\}', corpoTexto);
  safeReplaceTextPincel_(body, '\\{\\{fecho\\}\\}', fecho);
  safeReplaceTextPincel_(body, '\\{\\{signatario\\}\\}', signatario);
  safeReplaceTextPincel_(body, '\\{\\{cargo_signatario\\}\\}', cargoSignatario);

  doc.saveAndClose();
  const url = newFile.getUrl();
  const agora = Utilities.formatDate(hoje, 'America/Fortaleza', 'yyyy-MM-dd HH:mm');

  // Avança automaticamente o contador Proximo_Oficio_2026 no arquivo .md (1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn)
  const novoProximoOficio = Math.max(estadoApolo.proximoOficio2026, numInt) + 1;
  let numeracaoAtualizada = estadoApolo;
  if (typeof gravarEstadoNumeracaoNoArquivoMd_ === 'function') {
    numeracaoAtualizada = gravarEstadoNumeracaoNoArquivoMd_(
      Object.assign({}, estadoApolo, { proximoOficio2026: novoProximoOficio }),
      `[HOMERO/APOLO]: Emitido Ofício nº ${numOficio}/2026 - ${assunto} (${url}). Próximo: nº ${novoProximoOficio}.`
    );
  }
  registrarAlertaMemoriaOlympos('_memoria_homero.md', `[${agora}] Emitido Ofício nº ${numOficio}/2026 para ${destinatario} (${url})`);

  return {
    status: 'OK',
    numero: numOficio,
    proximoOficio2026: novoProximoOficio,
    numeracaoAtualizada: numeracaoAtualizada,
    nomeArquivo: fileName,
    url: url
  };
}

/**
 * Cadastra uma nova Licença (Prêmio, Não Remunerada ou Anulação) diretamente pelo Hub Olympos.
 * Insere a linha na planilha oficial (1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc) com validação de campos,
 * cálculo automático de data de término (para Prêmio) e suporte a geração imediata da Portaria.
 * @param {Object} dados Parâmetros preenchidos no formulário do Hub.
 */
function cadastrarLicencaDiretoHub(dados) {
  if (!dados) throw new Error('Dados da licença não fornecidos.');

  const tipo = String(dados.tipoLicenca || 'PREMIO').toUpperCase();
  const planilhaId = OLYMPOS_IDS.SUBPROJETOS.PINCEL_LICENCAS_PLANILHA || '1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc';
  const ss = SpreadsheetApp.openById(planilhaId);
  if (!ss) throw new Error('Não foi possível abrir a planilha oficial de Licenças.');

  let nomeAba = 'Premio';
  if (tipo === 'NAO_REMUNERADA') {
    nomeAba = 'Não remunerada';
  } else if (tipo === 'ANULACAO') {
    nomeAba = 'Anulação de licença';
  }

  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    // Busca por aproximação de nome de aba caso acentuação varie
    const abas = ss.getSheets();
    for (let i = 0; i < abas.length; i++) {
      const n = abas[i].getName().toLowerCase();
      if (tipo === 'ANULACAO' && n.includes('anula')) { sheet = abas[i]; break; }
      if (tipo === 'NAO_REMUNERADA' && n.includes('remunera')) { sheet = abas[i]; break; }
      if (tipo === 'PREMIO' && n.includes('premio')) { sheet = abas[i]; break; }
    }
  }

  if (!sheet) throw new Error(`Aba "${nomeAba}" não encontrada na planilha de Licenças.`);

  const { col } = obterColunasPincel_('LICENCAS', sheet.getName());
  const configSheet = ss.getSheetByName(PINCEL_CONSTANTS.CONFIG_SHEET);
  const cfgRow = configSheet ? configSheet.getRange('A2:D2').getValues()[0] : [];
  const settings = {
    templateId: limparTextoOlympos(cfgRow[0]) || (OLYMPOS_IDS.MODELOS_DOCS && OLYMPOS_IDS.MODELOS_DOCS.LICENCA),
    folderId: limparTextoOlympos(cfgRow[1]) || OLYMPOS_IDS.SUBPROJETOS.PINCEL_LICENCAS_PASTA,
    anoRef: limparTextoOlympos(cfgRow[2]) || '2026',
    secretario: limparTextoOlympos(cfgRow[3]) || 'Secretário(a) Municipal de Educação Básica'
  };

  const dtInicioObj = criarDataSemFusoPincel_(dados.dataInicio);
  let dtInicioFmt = dtInicioObj ? formatarDataCurtaPincel_(dtInicioObj) : limparTextoOlympos(dados.dataInicio);

  let dtTerminoFmt = '';
  if (dados.dataTermino) {
    const dtTermObj = criarDataSemFusoPincel_(dados.dataTermino);
    dtTerminoFmt = dtTermObj ? formatarDataCurtaPincel_(dtTermObj) : limparTextoOlympos(dados.dataTermino);
  } else if (dtInicioObj && tipo === 'PREMIO') {
    // Cálculo padrão de 90 dias para licença-prêmio
    const dtCalc = new Date(dtInicioObj.getTime() + 89 * 24 * 3600 * 1000);
    dtTerminoFmt = formatarDataCurtaPincel_(dtCalc);
  }

  let numPortaria = limparTextoOlympos(dados.numPortaria);
  if (!numPortaria || numPortaria.toUpperCase() === 'AUTO') {
    const lastRowExistente = sheet.getLastRow();
    const allVal = lastRowExistente > 1 ? sheet.getRange(2, 1, lastRowExistente - 1, col.PORTARIA).getValues() : [];
    numPortaria = alocarProximoNumeroPortariaPincelApolo_(allVal, col.PORTARIA);
  }

  const republicacaoStr = (dados.republicacao === true || String(dados.republicacao).toUpperCase() === 'SIM') ? 'SIM' : 'NÃO';
  const retroativoStr = (dados.retroativo === true || String(dados.retroativo).toUpperCase() === 'SIM') ? 'SIM' : 'NÃO';

  // Montar linha de acordo com as colunas da aba
  let novaLinha = [];
  if (tipo === 'PREMIO') {
    novaLinha = [
      limparTextoOlympos(dados.nome).toUpperCase(),
      limparTextoOlympos(dados.matricula),
      limparTextoOlympos(dados.cargo).toUpperCase(),
      limparTextoOlympos(dados.periodoAquisitivo),
      numPortaria,
      dtInicioFmt,
      dtTerminoFmt,
      republicacaoStr,
      retroativoStr,
      '', // Arquivo (URL)
      'Pendente' // Status
    ];
  } else if (tipo === 'NAO_REMUNERADA') {
    novaLinha = [
      limparTextoOlympos(dados.nome).toUpperCase(),
      limparTextoOlympos(dados.matricula),
      limparTextoOlympos(dados.cargo).toUpperCase(),
      limparTextoOlympos(dados.anosAfastados),
      numPortaria,
      dtInicioFmt,
      dtTerminoFmt,
      republicacaoStr,
      retroativoStr,
      '', // Arquivo (URL)
      'Pendente' // Status
    ];
  } else { // ANULACAO
    novaLinha = [
      limparTextoOlympos(dados.portariaAnular),
      limparTextoOlympos(dados.parecer),
      republicacaoStr,
      retroativoStr,
      '', // Arquivo (URL)
      'Pendente' // Status
    ];
  }

  sheet.appendRow(novaLinha);
  const rowNumber = sheet.getLastRow();
  SpreadsheetApp.flush();

  let urlGerada = '';
  let statusGeracao = 'CADASTRADO';

  if (dados.gerarDocumentoAgora) {
    try {
      const templateFile = DriveApp.getFileById(settings.templateId);
      const destinationFolder = DriveApp.getFolderById(settings.folderId);
      const resDoc = gerarDocumentoPortariaUnificado_(
        novaLinha,
        tipo,
        col,
        sheet.getName(),
        settings,
        templateFile,
        destinationFolder
      );

      urlGerada = resDoc.url;
      sheet.getRange(rowNumber, col.ARQUIVO).setValue(urlGerada);
      if (resDoc.endDate && col.DATA_TERMINO) {
        sheet.getRange(rowNumber, col.DATA_TERMINO).setValue(resDoc.endDate);
      }

      if (tipo === 'ANULACAO') {
        const rev = registrarRevogacaoCruzadaPincel_(ss, dados.portariaAnular, dados.parecer, urlGerada, settings.anoRef);
        const statusMsg = rev.revogadaEncontrada
          ? `${PINCEL_CONSTANTS.STATUS_GENERATED} (Revogou linha ${rev.linhaOrigem} em ${rev.abaOrigem})`
          : PINCEL_CONSTANTS.STATUS_GENERATED;
        sheet.getRange(rowNumber, col.STATUS).setValue(statusMsg);
      } else {
        sheet.getRange(rowNumber, col.STATUS).setValue(PINCEL_CONSTANTS.STATUS_GENERATED);
      }

      statusGeracao = 'GERADO_COM_SUCESSO';
    } catch (e) {
      sheet.getRange(rowNumber, col.STATUS).setValue(`Erro: ${e.message}`);
      throw new Error(`Licença cadastrada na linha ${rowNumber}, mas falhou ao gerar o Google Docs: ${e.message}`);
    }
  }

  return {
    status: statusGeracao,
    linha: rowNumber,
    aba: sheet.getName(),
    tipo: tipo,
    numeroPortaria: numPortaria,
    servidor: dados.nome || dados.portariaAnular,
    urlArquivo: urlGerada,
    mensagem: urlGerada
      ? `Portaria nº ${numPortaria}/2026 gerada com sucesso! Link disponível no painel.`
      : `Licença inserida com sucesso na aba "${sheet.getName()}" (Linha ${rowNumber}) com Portaria nº ${numPortaria}.`
  };
}
