const CONSTANTS = {
  SHEET_NAMES: {
    PREMIO: "Premio",
    NAO_REMUNERADA: "Não remunerada",
    ANULACAO: "Anulação de licença",
    CONFIG: "Configurações"
  },

  CONFIG_CELLS: {
    TEMPLATE_ID: 'A2',
    FOLDER_ID: 'B2',
    ANO_REF: 'C2',
    SECRETARIO: 'D2'
  },

  DEFAULTS: {
    TEMPLATE_ID_LICENCA: '1AwMpqn0RUP9uDw7YPcPP0TsZ5MZ71Nr2gSlbRRXZ7iw',
    TEMPLATE_ID_OFICIO: '1HgPOD0BzOO3t33eN2DuRjrH64vnuoJnxyp5VX6ec8Xw',
    FOLDER_ID_LICENCAS: '1tBiQ2z-LDVHZIvBuP7aKEkVLtzxK-pEJ'
  },

  STATE_KEYS: {
    CURRENT_ROW: 'LICENSE_GENERATION_CURRENT_ROW',
    TOTAL_ITEMS: 'LICENSE_GENERATION_TOTAL',
    PROCESSED_ITEMS: 'LICENSE_GENERATION_PROCESSED',
    SHEET_NAME: 'SHEET_NAME_FOR_BATCH',
    GENERATION_STATE: 'generationState'
  },

  STATUS_GENERATED: 'Gerado',
  STATUS_GENERATING: 'Gerando...',
  STATUS_PENDING_DATA: 'Pendente: Dados incompletos',
  HEADER_ROWS: 1,
  BATCH_SIZE: 15, // Processa até 15 linhas por lote com trava preventiva de tempo
  MAX_EXECUTION_TIME_MS: 250000 // 4m10s (margem segura antes dos 6 min do GAS)
};
