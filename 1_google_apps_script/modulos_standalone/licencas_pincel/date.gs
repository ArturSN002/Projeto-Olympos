/**
 * Cria um objeto Date ancorado às 12:00:00 a partir de uma string (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO)
 * ou objeto Date nativo do Google Sheets, eliminando deslocamentos de fuso horário (GMT vs America/Fortaleza).
 * @param {string | Date} dateInput A data de entrada.
 * @returns {Date | null} O objeto de data seguro ou nulo se a entrada for inválida.
 */
function criarDataSemFuso(dateInput) {
  if (dateInput === null || dateInput === undefined || dateInput === '') return null;

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    // Ancora ao meio-dia mantendo o ano/mês/dia locais para evitar recuo de 1 dia por fuso
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0);
  }

  if (typeof dateInput !== 'string') return null;

  const texto = dateInput.trim();
  if (!texto || texto.includes('?')) return null;

  // Formato ISO com ou sem horário: YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  const matchISO = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (matchISO) {
    const ano = parseInt(matchISO[1], 10);
    const mes = parseInt(matchISO[2], 10) - 1;
    const dia = parseInt(matchISO[3], 10);
    return validarComponentesData_(ano, mes, dia);
  }

  // Formato BR com barras ou hifens: DD/MM/YYYY ou DD-MM-YYYY
  const matchBR = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchBR) {
    const dia = parseInt(matchBR[1], 10);
    const mes = parseInt(matchBR[2], 10) - 1;
    const ano = parseInt(matchBR[3], 10);
    return validarComponentesData_(ano, mes, dia);
  }

  return null;
}

/**
 * Valida se dia/mês/ano formam uma data real no calendário (rejeitando ex: 31/02/2026).
 */
function validarComponentesData_(ano, mesZeroBased, dia) {
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
 * Formata um objeto de data para o padrão dd/MM/yyyy.
 * @param {Date} dataObjeto O objeto de data.
 * @returns {string} A data formatada.
 */
function formatarData(dataObjeto) {
  if (!dataObjeto || isNaN(dataObjeto.getTime())) return "";
  return Utilities.formatDate(dataObjeto, "America/Fortaleza", "dd/MM/yyyy");
}

/**
 * Adiciona um número de dias a uma data.
 * @param {Date} dataObjeto A data inicial.
 * @param {number} dias O número de dias a adicionar.
 * @returns {Date | null} A nova data.
 */
function calcularDataFinalDias(dataObjeto, dias) {
  if (!dataObjeto || isNaN(dataObjeto.getTime())) return null;
  const novaData = new Date(dataObjeto.getTime());
  novaData.setDate(novaData.getDate() + dias);
  return novaData;
}

/**
 * Adiciona um número de anos a uma data.
 * @param {Date} dataObjeto A data inicial.
 * @param {number} anos O número de anos a adicionar.
 * @returns {Date | null} A nova data (subtraindo um dia para fechar o período).
 */
function calcularDataFinalAnos(dataObjeto, anos) {
  if (!dataObjeto || isNaN(dataObjeto.getTime())) return null;
  const anosNum = parseInt(anos, 10);
  if (isNaN(anosNum) || anosNum <= 0) return null;
  const novaData = new Date(dataObjeto.getTime());
  novaData.setFullYear(novaData.getFullYear() + anosNum);
  novaData.setDate(novaData.getDate() - 1);
  return novaData;
}

/**
 * Formata uma data por extenso (ex: "01 de janeiro de 2024").
 * @param {Date} dataObjeto A data a ser formatada.
 * @param {boolean} maiuscula Se o mês deve ser em maiúsculas.
 * @returns {string} A data formatada por extenso.
 */
function formatarDataPorExtenso(dataObjeto, maiuscula = false) {
  if (!dataObjeto || isNaN(dataObjeto.getTime())) return "";
  const dia = String(dataObjeto.getDate()).padStart(2, '0');
  const ano = dataObjeto.getFullYear();
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  let mes = meses[dataObjeto.getMonth()];

  if (maiuscula) {
    return `${dia} DE ${mes.toUpperCase()} DE ${ano}`;
  } else {
    mes = mes.charAt(0).toUpperCase() + mes.slice(1);
    return `${dia} de ${mes} de ${ano}`;
  }
}
