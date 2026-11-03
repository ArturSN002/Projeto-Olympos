/**
 * @fileoverview Funções auxiliares e higienizador pré-voo da Lira de Orfeu.
 */

const MAPA_DOMINIOS_CORRECAO = {
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
};

const PREPOSICOES_MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
const NUMERAIS_ROMANOS = new Set(['ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'jr']);

/**
 * Remove caracteres invisíveis de WhatsApp (\u2060 Word Joiner, \u200B-\u200D Zero-Width, \uFEFF BOM) e espaços extras.
 * @param {*} valor
 * @returns {string}
 */
function limparTextoLira(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/[\u200B-\u200D\uFEFF\u2060]/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Valida a sintaxe básica de um endereço de e-mail antes do envio via MailApp.
 * @param {string} email
 * @returns {boolean}
 */
function validarSintaxeEmailLira(email) {
  const limpo = limparTextoLira(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo);
}

/**
 * Corrige erros comuns de digitação em domínios de e-mail (@gamil.com, @gmial.com, @gmal.com -> @gmail.com).
 * @param {string} emailBruto
 * @returns {{ email: string, foiCorrigido: boolean }}
 */
function corrigirDominioEmail(emailBruto) {
  const limpo = limparTextoLira(emailBruto).toLowerCase().replace(/\s+/g, '');
  if (!limpo || !limpo.includes('@')) {
    return { email: limpo, foiCorrigido: limpo !== String(emailBruto || '') };
  }

  const partes = limpo.split('@');
  const usuario = partes[0];
  const dominio = partes.slice(1).join('@').replace(/\.+$/, '');
  const dominioCorrigido = MAPA_DOMINIOS_CORRECAO[dominio] || dominio;
  const emailFinal = `${usuario}@${dominioCorrigido}`;

  return {
    email: emailFinal,
    foiCorrigido: emailFinal !== String(emailBruto || '')
  };
}

/**
 * Converte nomes em minúsculas ou despadronizados (ex: "wilzanir gonzaga da Silva")
 * para Title Case respeitando preposições, hifens ("Silva-Santos"), apóstrofos ("D'Arc") e numerais romanos.
 * @param {string} nomeBruto
 * @returns {{ nome: string, foiCorrigido: boolean }}
 */
function formatarNomeTitleCase(nomeBruto) {
  const limpo = limparTextoLira(nomeBruto);
  if (!limpo) return { nome: '', foiCorrigido: false };

  const palavras = limpo.split(' ');
  const formatadas = palavras.map((palavra, index) => {
    const lower = palavra.toLowerCase();
    if (index > 0 && PREPOSICOES_MINUSCULAS.has(lower)) {
      return lower;
    }
    if (NUMERAIS_ROMANOS.has(lower)) {
      return lower.toUpperCase();
    }
    // Trata nomes compostos com hífen ou apóstrofo (ex: Silva-Santos, D'Arc)
    return lower
      .split(/([-'])/)
      .map(seg => (seg === '-' || seg === "'" || !seg) ? seg : seg.charAt(0).toUpperCase() + seg.slice(1))
      .join('');
  });

  const nomeFinal = formatadas.join(' ');
  return {
    nome: nomeFinal,
    foiCorrigido: nomeFinal !== String(nomeBruto || '')
  };
}

/**
 * Higieniza automaticamente a aba de participantes (remove \u2060, corrige @gamil.com e aplica Title Case)
 * e retorna o diagnóstico completo com duplicatas e e-mails inválidos.
 * @param {string} sheetName Nome da aba.
 * @returns {object} Relatório de higienização e duplicatas.
 */
function higienizarAbaParticipantes(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getActiveSheet();
  if (!sheet) {
    throw new Error(`Planilha "${sheetName}" não encontrada.`);
  }

  const startRow = CONFIG.PARTICIPANTS.START_ROW;
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) {
    return {
      aba: sheet.getName(),
      nomesHigienizados: 0,
      emailsCorrigidos: 0,
      emailsInvalidos: [],
      emails: [],
      names: []
    };
  }

  const numRows = lastRow - startRow + 1;
  const range = sheet.getRange(startRow, 1, numRows, 2);
  const values = range.getValues();

  let nomesHigienizados = 0;
  let emailsCorrigidos = 0;
  let houveAlteracao = false;

  const emailCounts = {};
  const nameCounts = {};
  const emailsInvalidos = [];

  for (let i = 0; i < values.length; i++) {
    const rawEmail = values[i][CONFIG.PARTICIPANTS.COLUMN_EMAIL - 1];
    const rawName = values[i][CONFIG.PARTICIPANTS.COLUMN_NAME - 1];

    if (rawEmail && String(rawEmail).trim() !== '') {
      const resEmail = corrigirDominioEmail(rawEmail);
      if (resEmail.foiCorrigido) {
        values[i][CONFIG.PARTICIPANTS.COLUMN_EMAIL - 1] = resEmail.email;
        emailsCorrigidos++;
        houveAlteracao = true;
      }
      if (resEmail.email) {
        emailCounts[resEmail.email] = (emailCounts[resEmail.email] || 0) + 1;
        if (!validarSintaxeEmailLira(resEmail.email)) {
          emailsInvalidos.push(`Linha ${startRow + i}: ${resEmail.email}`);
        }
      }
    }

    if (rawName && String(rawName).trim() !== '') {
      const resNome = formatarNomeTitleCase(rawName);
      if (resNome.foiCorrigido) {
        values[i][CONFIG.PARTICIPANTS.COLUMN_NAME - 1] = resNome.nome;
        nomesHigienizados++;
        houveAlteracao = true;
      }
      if (resNome.nome) {
        nameCounts[resNome.nome] = (nameCounts[resNome.nome] || 0) + 1;
      }
    }
  }

  if (houveAlteracao) {
    range.setValues(values);
    SpreadsheetApp.flush();
  }

  const duplicateEmails = Object.keys(emailCounts).filter(k => emailCounts[k] > 1);
  const duplicateNames = Object.keys(nameCounts).filter(k => nameCounts[k] > 1);

  return {
    aba: sheet.getName(),
    nomesHigienizados: nomesHigienizados,
    emailsCorrigidos: emailsCorrigidos,
    emailsInvalidos: emailsInvalidos,
    emails: duplicateEmails,
    names: duplicateNames
  };
}

/**
 * Mantém a assinatura original checkForDuplicates, executando também a higienização pré-voo da aba.
 * @param {string} sheetName O nome da aba (planilha) a ser verificada.
 * @returns {object} Objeto com listas de nomes e e-mails duplicados e contadores de higienização.
 */
function checkForDuplicates(sheetName) {
  return higienizarAbaParticipantes(sheetName);
}

/**
 * Ação rápida chamada diretamente pelo menu da planilha para higienizar a aba ativa.
 */
function higienizarAbaAtivaMenu() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const relatorio = higienizarAbaParticipantes(sheet.getName());
  const msg = `Higienização concluída em "${relatorio.aba}": ${relatorio.nomesHigienizados} nome(s) padronizado(s), ${relatorio.emailsCorrigidos} e-mail(s) corrigido(s).`;
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Lira de Orfeu', 8);
  return relatorio;
}

/**
 * Extrai o ID do arquivo de uma URL do Google Drive.
 * @param {string} url A URL do arquivo.
 * @returns {string} O ID do arquivo.
 */
function getIdFromUrl(url) {
  const match = String(url || '').match(/[-\w]{25,}/);
  if (match) {
    return match[0];
  }
  throw new Error("Não foi possível extrair o ID do arquivo da URL: " + url);
}

/**
 * Formata o nome completo para uma saudação (primeiro e segundo nomes, ignorando palavras curtas).
 * @param {string} fullName O nome completo do participante.
 * @returns {string} O nome formatado para saudação.
 */
function getSalutationName(fullName) {
  const limpo = formatarNomeTitleCase(fullName).nome;
  if (!limpo) return "";
  const parts = limpo.split(' ').filter(part => part.length > 2);
  return parts.slice(0, 2).join(' ');
}

/**
 * Sugestão 3.3.1: Gera um código/hash único de autenticidade (ex: SMEB-2026-A8F39C12)
 * a partir dos dados do participante e do evento.
 * @param {string} nomeParticipante
 * @param {string} emailParticipante
 * @param {string} nomeEvento
 * @param {string} dataEvento
 * @returns {string} Código de validação único.
 */
function gerarHashAutenticidadeLira(nomeParticipante, emailParticipante, nomeEvento, dataEvento) {
  const semente = `${limparTextoLira(nomeParticipante).toUpperCase()}|${limparTextoLira(emailParticipante).toLowerCase()}|${limparTextoLira(nomeEvento)}|${limparTextoLira(dataEvento)}`;

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

  // Fallback determinístico FNV-1a 32-bit em puro JS
  let hash1 = 0x811c9dc5;
  let hash2 = 0x01000193;
  for (let i = 0; i < semente.length; i++) {
    const ch = semente.charCodeAt(i);
    hash1 ^= ch;
    hash1 = Math.imul(hash1, 0x01000193) >>> 0;
    hash2 ^= (ch + i);
    hash2 = Math.imul(hash2, 0x85ebca6b) >>> 0;
  }
  const hexFallback = (hash1.toString(16).padStart(8, '0') + hash2.toString(16).padStart(2, '0')).substring(0, 10).toUpperCase();
  return `SMEB-2026-${hexFallback}`;
}

/**
 * Sugestão 3.3.1: Grava o registro de autenticidade na aba pública "Registro_Autenticidade" da planilha.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss Planilha do evento.
 * @param {object} registro Objeto com { hash, nome, email, evento, modalidade, dataEvento, urlPdf }.
 */
function registrarAutenticidadeCertificado(ss, registro) {
  if (!ss || !registro || !registro.hash) return null;
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

  const emitidoEm = (typeof Utilities !== 'undefined' && Utilities.formatDate)
    ? Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss')
    : new Date().toISOString();

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

  return {
    abaRegistro: nomeAba,
    hash: registro.hash,
    emitidoEm: emitidoEm
  };
}

/**
 * Sugestão 3.3.1: Insere o QR Code de validação e o código hash no rodapé/canto inferior do documento (Google Docs ou Slides).
 * @param {object} docOrPresentation Objeto retornado por DocumentApp.openById ou SlidesApp.openById.
 * @param {string} codigoHash Código de validação único (ex: SMEB-2026-A8F39C12).
 * @param {string} nomeParticipante Nome do participante.
 * @param {string} nomeEvento Nome do evento.
 */
function inserirQrCodeEHashValidacao(docOrPresentation, codigoHash, nomeParticipante, nomeEvento) {
  if (!docOrPresentation || !codigoHash) return false;
  const textoValidacao = `VALIDAÇÃO SMEB CEARÁ-MIRIM/RN | Código: ${codigoHash} | Titular: ${nomeParticipante} | Evento: ${nomeEvento}`;
  const qrApiUrl = `https://quickchart.io/qr?size=140&margin=1&text=${encodeURIComponent(textoValidacao)}`;

  let qrBlob = null;
  try {
    if (typeof UrlFetchApp !== 'undefined' && UrlFetchApp.fetch) {
      const resp = UrlFetchApp.fetch(qrApiUrl, { muteHttpExceptions: true });
      if (resp && resp.getResponseCode && resp.getResponseCode() === 200) {
        qrBlob = resp.getBlob().setName(`QR_${codigoHash}.png`);
      }
    }
  } catch (e) {
    // Em modo offline ou sandbox sem rede externa, segue com carimbo textual do hash
  }

  // Caso 1: Google Docs (body)
  if (typeof docOrPresentation.getBody === 'function') {
    const body = docOrPresentation.getBody();
    safeReplaceTextLira_(body, '\\{\\{codigo_validacao\\}\\}', codigoHash);
    safeReplaceTextLira_(body, '\\{\\{hash\\}\\}', codigoHash);

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
    return true;
  }

  // Caso 2: Google Slides (slides)
  if (typeof docOrPresentation.getSlides === 'function') {
    const slides = docOrPresentation.getSlides();
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
    return true;
  }

  return false;
}
