const COLUMNS = {
  READAPTACAO: {
    PARECER: 1,         // A - Proc. Adm. / Parecer
    NOME: 2,            // B - Nome Completo
    MATRICULA: 3,       // C - Matrícula
    CARGO: 4,           // D - Cargo
    FUNCAO: 5,          // E - Função Readaptada
    DATA_INICIO: 6,     // F - Data de Início
    PORTARIA: 7,        // G - Número da Portaria
    REPUBLICACAO: 8,    // H - Republicação (Sim/Não)
    RETROATIVO: 9,      // I - Retroativo (Sim/Não)
    STATUS: 10,         // J - Status da Geração
    ARQUIVO: 11,        // K - Link do Arquivo Gerado
    DATA_PUBLICACAO: 12 // L - Data de Publicação
  }
};

/**
 * Retorna o objeto de mapeamento de colunas para a aba especificada.
 * @param {string} sheetName O nome da aba.
 * @returns {object} O mapeamento de colunas (1-based).
 */
function getColumnsForSheet(sheetName) {
  if (!sheetName || sheetName === CONSTANTS.SHEET_NAMES.CONFIG) {
    throw new Error("Aba inválida para processamento de Readaptação: " + sheetName);
  }
  return COLUMNS.READAPTACAO;
}
