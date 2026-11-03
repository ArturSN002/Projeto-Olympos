const COLUMNS = {
  PREMIO: {
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
  NAO_REMUNERADA: {
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
  ANULACAO: {
    PORTARIA_ANULAR: 1,
    PARECER: 2,
    REPUBLICACAO: 3,
    RETROATIVO: 4,
    ARQUIVO: 5,
    STATUS: 6
  }
};

/**
 * Normaliza o tipo de aba de licença (PREMIO, NAO_REMUNERADA ou ANULACAO).
 * @param {string} sheetName Nome da aba.
 * @returns {string} Tipo normalizado.
 */
function resolveLicenseSheetType(sheetName) {
  const norm = String(sheetName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (norm === 'premio' || norm.includes('premio')) {
    return CONSTANTS.SHEET_NAMES.PREMIO;
  }
  if (norm === 'nao remunerada' || norm.includes('remunerada')) {
    return CONSTANTS.SHEET_NAMES.NAO_REMUNERADA;
  }
  if (norm.includes('anulacao')) {
    return CONSTANTS.SHEET_NAMES.ANULACAO;
  }
  return sheetName;
}

/**
 * Retorna o objeto de mapeamento de colunas para a aba especificada.
 * @param {string} sheetName O nome da aba.
 * @returns {object} O mapeamento de colunas.
 */
function getColumnsForSheet(sheetName) {
  const resolved = resolveLicenseSheetType(sheetName);
  switch (resolved) {
    case CONSTANTS.SHEET_NAMES.PREMIO:
      return COLUMNS.PREMIO;
    case CONSTANTS.SHEET_NAMES.NAO_REMUNERADA:
      return COLUMNS.NAO_REMUNERADA;
    case CONSTANTS.SHEET_NAMES.ANULACAO:
      return COLUMNS.ANULACAO;
    default:
      throw new Error("Mapeamento de colunas não encontrado para a aba: " + sheetName);
  }
}
