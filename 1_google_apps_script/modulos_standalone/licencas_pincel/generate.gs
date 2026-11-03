/**
 * Remove caracteres invisíveis (Word Joiner \u2060, Zero-Width Space \u200B-\u200D, BOM \uFEFF) e espaços duplos.
 * @param {*} valor Valor bruto da célula.
 * @returns {string} Texto higienizado.
 */
function limparTextoOlympos(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/[\u200B-\u200D\uFEFF\u2060]/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Substitui marcadores no DocumentApp escapando '$' no texto de substituição para evitar bug de backreference RegExp.
 */
function safeReplaceText_(body, pattern, replacement) {
  const safeVal = String(replacement === null || replacement === undefined ? '' : replacement).replace(/\$/g, '$$$$');
  body.replaceText(pattern, safeVal);
}

/**
 * Aplica negrito (e opcionalmente tamanho de fonte) usando cálculo literal de índice (indexOf),
 * imune a erros de RegExp com "?", "??" ou parênteses como "Professor(a)".
 * Utiliza cursor progressivo com fallback para evitar falso positivo em números curtos (ex: matrícula "1" em "Art. 1º").
 * @param {GoogleAppsScript.Document.Text} textElement Elemento de texto.
 * @param {string[]} variaveisParaNegritar Substrings exatas para negritar.
 * @param {number} [fontSize] Tamanho da fonte opcional (ex: 12).
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

/**
 * Valida se todos os campos obrigatórios da licença estão preenchidos, sem "?" ou "??", e com datas válidas.
 * @param {Array} rowData Dados da linha.
 * @param {string} sheetType Tipo normalizado da aba (PREMIO, NAO_REMUNERADA ou ANULACAO).
 * @param {object} columnMap Mapeamento de colunas.
 */
function validarDadosLicenca(rowData, sheetType, columnMap) {
  const tipo = resolveLicenseSheetType(sheetType);
  const inconsistencias = [];

  function checarCampo(nomeCampo, valor) {
    const str = limparTextoOlympos(valor);
    if (!str || str === '?' || str === '??' || str.includes('?')) {
      inconsistencias.push(nomeCampo);
    }
  }

  if (tipo === CONSTANTS.SHEET_NAMES.ANULACAO) {
    checarCampo('Portaria a Anular', rowData[columnMap.PORTARIA_ANULAR - 1]);
    checarCampo('Parecer Jurídico', rowData[columnMap.PARECER - 1]);
  } else {
    checarCampo('Nome Completo', rowData[columnMap.NOME - 1]);
    checarCampo('Matrícula', rowData[columnMap.MATRICULA - 1]);
    checarCampo('Cargo', rowData[columnMap.CARGO - 1]);
    checarCampo('Número da Portaria', rowData[columnMap.PORTARIA - 1]);
    checarCampo('Data de Início', rowData[columnMap.DATA_INICIO - 1]);

    if (tipo === CONSTANTS.SHEET_NAMES.PREMIO) {
      checarCampo('Período Aquisitivo', rowData[columnMap.PERIODO_AQUISITIVO - 1]);
    } else if (tipo === CONSTANTS.SHEET_NAMES.NAO_REMUNERADA) {
      checarCampo('Anos Afastados', rowData[columnMap.ANOS_AFASTADOS - 1]);
      const anosNum = parseInt(limparTextoOlympos(rowData[columnMap.ANOS_AFASTADOS - 1]), 10);
      if (!inconsistencias.includes('Anos Afastados') && (isNaN(anosNum) || anosNum <= 0)) {
        inconsistencias.push('Anos Afastados (deve ser número > 0)');
      }
    }

    if (!inconsistencias.includes('Data de Início') && !criarDataSemFuso(rowData[columnMap.DATA_INICIO - 1])) {
      inconsistencias.push('Data de Início (formato inválido)');
    }
  }

  if (inconsistencias.length > 0) {
    throw new Error(`Campos pendentes ou com '?': ${inconsistencias.join(', ')}`);
  }
}

/**
 * Localiza automaticamente a portaria original nas abas "Premio" ou "Não remunerada"
 * quando uma portaria da aba "Anulação de licença" é gerada, inserindo o carimbo
 * "ANULADA PELA PORTARIA Nº X/2026" com link cruzado para o documento de anulação.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss Planilha ativa.
 * @param {string} portariaAnuladaRaw Número/identificador da portaria a anular.
 * @param {string} parecerJuridico Número do parecer jurídico.
 * @param {string} urlPortariaAnulacao URL do documento de anulação gerado.
 * @param {string} [anoRef] Ano de referência (ex: "2026").
 * @returns {object} Metadados da revogação cruzada realizada.
 */
function registrarRevogacaoCruzadaLicenca(ss, portariaAnuladaRaw, parecerJuridico, urlPortariaAnulacao, anoRef) {
  if (!ss) return { revogadaEncontrada: false };

  const alvoBruto = limparTextoOlympos(portariaAnuladaRaw);
  if (!alvoBruto) return { revogadaEncontrada: false };

  const matchNumAlvo = alvoBruto.match(/(\d{1,4})/);
  const numAlvoInt = matchNumAlvo ? parseInt(matchNumAlvo[1], 10) : null;
  const ano = limparTextoOlympos(anoRef) || '2026';
  const numExibicao = matchNumAlvo ? matchNumAlvo[1] : alvoBruto;
  const carimbo = `ANULADA PELA PORTARIA Nº ${numExibicao}/${ano} (Parecer ${limparTextoOlympos(parecerJuridico)}) — ${urlPortariaAnulacao}`;

  const abasBusca = [CONSTANTS.SHEET_NAMES.PREMIO, CONSTANTS.SHEET_NAMES.NAO_REMUNERADA];

  for (let a = 0; a < abasBusca.length; a++) {
    const nomeAba = abasBusca[a];
    const sheetOrigem = ss.getSheetByName(nomeAba);
    if (!sheetOrigem) continue;

    const colMap = getColumnsForSheet(nomeAba);
    const startRow = CONSTANTS.HEADER_ROWS + 1;
    const lastRow = sheetOrigem.getLastRow();
    if (lastRow < startRow) continue;

    const numRows = lastRow - CONSTANTS.HEADER_ROWS;
    const lastCol = Math.max(sheetOrigem.getLastColumn(), colMap.STATUS);
    const rows = sheetOrigem.getRange(startRow, 1, numRows, lastCol).getValues();

    for (let i = 0; i < rows.length; i++) {
      const portariaLinha = limparTextoOlympos(rows[i][colMap.PORTARIA - 1]);
      if (!portariaLinha) continue;

      const matchLinha = portariaLinha.match(/(\d{1,4})/);
      const numLinhaInt = matchLinha ? parseInt(matchLinha[1], 10) : null;

      const bateExato = portariaLinha.toLowerCase() === alvoBruto.toLowerCase();
      const bateNumero = numAlvoInt !== null && numLinhaInt !== null && numAlvoInt === numLinhaInt;

      if (bateExato || bateNumero) {
        const linhaPlanilha = startRow + i;
        const servidor = limparTextoOlympos(rows[i][colMap.NOME - 1]);
        sheetOrigem.getRange(linhaPlanilha, colMap.STATUS).setValue(carimbo);
        return {
          revogadaEncontrada: true,
          abaOrigem: nomeAba,
          linhaOrigem: linhaPlanilha,
          servidor: servidor,
          carimbo: carimbo
        };
      }
    }
  }

  return {
    revogadaEncontrada: false,
    carimbo: carimbo
  };
}

/**
 * Diagnóstico Pré-Voo (Dry-Run): Audita todas as linhas pendentes da aba sem criar arquivos no Google Drive.
 * @param {string} sheetName Nome da aba.
 * @returns {object} Relatório detalhado do Dry-Run.
 */
function executarDiagnosticoPreVoo(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`A aba "${sheetName}" não foi encontrada.`);

  const columnMap = getColumnsForSheet(sheetName);
  const startRow = CONSTANTS.HEADER_ROWS + 1;
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), columnMap.STATUS);

  if (lastRow < startRow) {
    return { totalLinhas: 0, jaGeradas: 0, totalPendentes: 0, validas: 0, invalidas: 0, erros: [] };
  }

  const allValues = sheet.getRange(startRow, 1, lastRow - CONSTANTS.HEADER_ROWS, lastCol).getValues();
  const erros = [];
  let totalPendentes = 0;
  let jaGeradas = 0;
  let validas = 0;

  allValues.forEach((rowData, index) => {
    const numLinha = startRow + index;
    const identificador = limparTextoOlympos(rowData[(columnMap.NOME || columnMap.PORTARIA_ANULAR) - 1]);
    const statusAtual = limparTextoOlympos(rowData[columnMap.STATUS - 1]);

    if (!identificador && !limparTextoOlympos(rowData[(columnMap.PORTARIA || columnMap.PARECER) - 1])) return;
    if (statusAtual.toUpperCase() === CONSTANTS.STATUS_GENERATED.toUpperCase()) {
      jaGeradas++;
      return;
    }

    totalPendentes++;
    try {
      validarDadosLicenca(rowData, sheetName, columnMap);
      validas++;
    } catch (e) {
      erros.push({
        linha: numLinha,
        servidor: identificador || '(Sem identificação)',
        motivo: e.message
      });
    }
  });

  return {
    totalLinhas: jaGeradas + totalPendentes,
    jaGeradas: jaGeradas,
    totalPendentes: totalPendentes,
    validas: validas,
    invalidas: erros.length,
    erros: erros
  };
}

/**
 * Processa um lote de linhas da planilha com leitura em bloco (Batch Read) e controle de tempo (250s).
 * @param {string} sheetName O nome da aba que está sendo processada.
 */
function generateBatch(sheetName) {
  const startTime = Date.now();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    console.error(`A aba "${sheetName}" não foi encontrada.`);
    resetProcess(false);
    return { status: 'ERROR', message: `A aba "${sheetName}" não foi encontrada.` };
  }

  try {
    const settings = getSettings();
    const columnMap = getColumnsForSheet(sheetName);
    const startRow = CONSTANTS.HEADER_ROWS + 1;
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), columnMap.STATUS);
    const rowCount = lastRow - CONSTANTS.HEADER_ROWS;

    if (rowCount <= 0) {
      resetProcess(false);
      return { status: 'COMPLETED', message: 'Nenhuma linha de dados na planilha.' };
    }

    // Leitura única em memória de toda a planilha
    const allValues = sheet.getRange(startRow, 1, rowCount, lastCol).getValues();

    let stateJSON = props.getProperty(CONSTANTS.STATE_KEYS.GENERATION_STATE);
    let state;

    if (!stateJSON) {
      const pendingRows = [];
      allValues.forEach((row, index) => {
        const statusValue = limparTextoOlympos(row[columnMap.STATUS - 1]).toUpperCase();
        const idPrincipal = limparTextoOlympos(row[(columnMap.NOME || columnMap.PORTARIA_ANULAR) - 1]);
        if (idPrincipal && (statusValue === '' || statusValue === 'GERANDO...' || statusValue.startsWith('PENDENTE'))) {
          pendingRows.push(startRow + index);
        }
      });

      if (pendingRows.length === 0) {
        resetProcess(false);
        return { status: 'COMPLETED', message: 'Nenhuma licença pendente para gerar.' };
      }

      state = {
        sheetName: sheetName,
        pendingRows: pendingRows,
        total: pendingRows.length,
        processedCount: 0
      };
    } else {
      state = JSON.parse(stateJSON);
      if (state.sheetName !== sheetName) {
        throw new Error(`Outra geração já está em andamento para a aba "${state.sheetName}".`);
      }
    }

    const templateFile = DriveApp.getFileById(settings.templateId);
    const destinationFolder = DriveApp.getFolderById(settings.folderId);

    const startIndex = state.processedCount;
    const endIndex = Math.min(startIndex + CONSTANTS.BATCH_SIZE, state.total);

    for (let i = startIndex; i < endIndex; i++) {
      // Trava preventiva de tempo (4m10s) antes do limite de 6 minutos do GAS
      if (Date.now() - startTime > CONSTANTS.MAX_EXECUTION_TIME_MS) {
        break;
      }

      const currentRow = state.pendingRows[i];
      const rowData = allValues[currentRow - startRow];
      const statusCell = sheet.getRange(currentRow, columnMap.STATUS);

      try {
        statusCell.setValue(CONSTANTS.STATUS_GENERATING);
        const result = createLicenseDocument(rowData, sheetName, settings, templateFile, destinationFolder);

        sheet.getRange(currentRow, columnMap.ARQUIVO).setValue(result.file.getUrl());

        if (result.endDate && columnMap.DATA_TERMINO) {
          sheet.getRange(currentRow, columnMap.DATA_TERMINO).setValue(result.endDate);
        }

        // Sugestão 3.2.3: Se for Anulação de Licença, carimba automaticamente a aba original (Premio ou Não remunerada)
        if (resolveLicenseSheetType(sheetName) === CONSTANTS.SHEET_NAMES.ANULACAO) {
          const revogacao = registrarRevogacaoCruzadaLicenca(
            ss,
            rowData[columnMap.PORTARIA_ANULAR - 1],
            rowData[columnMap.PARECER - 1],
            result.file.getUrl(),
            settings.anoRef
          );
          if (revogacao.revogadaEncontrada) {
            statusCell.setValue(`${CONSTANTS.STATUS_GENERATED} (Revogou linha ${revogacao.linhaOrigem} em ${revogacao.abaOrigem})`);
          } else {
            statusCell.setValue(CONSTANTS.STATUS_GENERATED);
          }
        } else {
          statusCell.setValue(CONSTANTS.STATUS_GENERATED);
        }
      } catch (e) {
        statusCell.setValue(`Erro: ${e.message}`);
        console.error(`Erro na linha ${currentRow}: ${e.stack || e.message}`);
      } finally {
        state.processedCount++;
        if (state.processedCount % 5 === 0 || state.processedCount === endIndex) {
          props.setProperties({
            [CONSTANTS.STATE_KEYS.PROCESSED_ITEMS]: state.processedCount.toString(),
            [CONSTANTS.STATE_KEYS.TOTAL_ITEMS]: state.total.toString()
          });
        }
      }
    }

    SpreadsheetApp.flush();

    if (state.processedCount < state.total) {
      props.setProperties({
        [CONSTANTS.STATE_KEYS.GENERATION_STATE]: JSON.stringify(state),
        [CONSTANTS.STATE_KEYS.CURRENT_ROW]: String(state.pendingRows[state.processedCount]),
        [CONSTANTS.STATE_KEYS.PROCESSED_ITEMS]: state.processedCount.toString(),
        [CONSTANTS.STATE_KEYS.TOTAL_ITEMS]: state.total.toString()
      });
      limparGatilhosAntigos('continueGeneration');
      ScriptApp.newTrigger('continueGeneration').timeBased().after(45 * 1000).create();

      return {
        status: 'IN_PROGRESS',
        processed: state.processedCount,
        total: state.total
      };
    } else {
      ss.toast('Geração de licenças concluída com sucesso!');
      resetProcess(false);
      return {
        status: 'COMPLETED',
        message: `Concluído! Todos os ${state.total} registros foram processados.`
      };
    }
  } catch (error) {
    ss.toast(`Erro crítico: ${error.message}`);
    console.error('Erro ao gerar lote: ', error);
    resetProcess(false);
    return { status: 'ERROR', message: error.message };
  }
}

function limparGatilhosAntigos(handlerName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
}

/**
 * Cria um único documento de licença com base nos dados da linha.
 * Valida todos os dados ANTES de chamar template.makeCopy() e aplica negrito via indexOf.
 */
function createLicenseDocument(rowData, sheetType, settings, templateFileOpt, destinationFolderOpt) {
  const resolvedType = resolveLicenseSheetType(sheetType);
  const columnMap = getColumnsForSheet(resolvedType);
  const config = settings || getSettings();

  // 1. Fail-Fast: Valida todos os campos antes de criar cópia no Google Drive
  validarDadosLicenca(rowData, resolvedType, columnMap);

  const hoje = new Date();
  const isRepublicado = limparTextoOlympos(rowData[columnMap.REPUBLICACAO - 1]).toUpperCase() === 'SIM';
  const isRetroativo = limparTextoOlympos(rowData[columnMap.RETROATIVO - 1]).toUpperCase() === 'SIM';

  const placeholders = {
    '\\{\\{secretario\\}\\}': limparTextoOlympos(config.secretario).toUpperCase(),
    '\\{\\{republicado\\}\\}': isRepublicado ? '*Republicado por incorreção' : '',
    '\\{\\{dataPubCab\\}\\}': formatarDataPorExtenso(hoje, true),
    '\\{\\{DataPubRod\\}\\}': formatarDataPorExtenso(hoje, false)
  };

  let fileName = "";
  let dataFinalFormatada = "";
  let dataInicioFormatada = "";
  let dadosArtigo = null;

  const anoReferencia = limparTextoOlympos(config.anoRef);

  // 2. Prepara e valida textos e datas antes de criar o arquivo no Drive
  if (resolvedType === CONSTANTS.SHEET_NAMES.PREMIO || resolvedType === CONSTANTS.SHEET_NAMES.NAO_REMUNERADA) {
    const nomeCompleto = limparTextoOlympos(rowData[columnMap.NOME - 1]);
    const nomeCompletoUpper = nomeCompleto.toUpperCase();
    const numeroPortaria = limparTextoOlympos(rowData[columnMap.PORTARIA - 1]);
    const mat = limparTextoOlympos(rowData[columnMap.MATRICULA - 1]);
    const cargo = limparTextoOlympos(rowData[columnMap.CARGO - 1]);

    const dataInicioObj = criarDataSemFuso(rowData[columnMap.DATA_INICIO - 1]);
    if (!dataInicioObj) throw new Error("Data de Início inválida.");

    let dataFinalObj;
    if (resolvedType === CONSTANTS.SHEET_NAMES.PREMIO) {
      dataFinalObj = calcularDataFinalDias(dataInicioObj, 89);
    } else {
      const anosAfastados = limparTextoOlympos(rowData[columnMap.ANOS_AFASTADOS - 1]);
      dataFinalObj = calcularDataFinalAnos(dataInicioObj, anosAfastados);
    }
    if (!dataFinalObj) throw new Error("Não foi possível calcular a Data de Término.");

    dataInicioFormatada = formatarData(dataInicioObj);
    dataFinalFormatada = formatarData(dataFinalObj);

    const periodo = `${dataInicioFormatada} a ${dataFinalFormatada}`;
    const art1 = 'Art. 1º.';
    const art2 = 'Art. 2º.';

    const textoLicenca = (resolvedType === CONSTANTS.SHEET_NAMES.PREMIO)
      ? `Licença Prêmio de 90 (noventa) dias, referente ao ${limparTextoOlympos(rowData[columnMap.PERIODO_AQUISITIVO - 1])}º período aquisitivo, a contar de ${periodo}`
      : `Licença sem remuneração de ${limparTextoOlympos(rowData[columnMap.ANOS_AFASTADOS - 1])} ano(s), a contar de ${periodo}`;

    const textoCompletoArt1 = `${art1} Conceder a(o) servidor(a) ${nomeCompletoUpper} - Matrícula nº ${mat}, categoria funcional ${cargo}, integrante do quadro de pessoal da Secretaria Municipal de Educação Básica, ${textoLicenca}.`;

    const artigo02TextoRestante = isRetroativo
      ? `Esta portaria entra em vigor na data de sua publicação, retroagindo seus efeitos à ${dataInicioFormatada}.`
      : `Esta portaria entra em vigor na data de sua publicação, revogando-se as disposições em contrário.`;

    fileName = `Portaria Nº${numeroPortaria.replace(/\//g, '-')}_${anoReferencia} - ${sheetType} - ${nomeCompleto}`;
    placeholders['\\{\\{portaria\\}\\}'] = numeroPortaria;

    dadosArtigo = {
      art1,
      art2,
      nomeCompletoUpper,
      mat,
      cargo,
      periodo,
      textoCompletoArt1,
      artigo02TextoRestante
    };
  } else if (resolvedType === CONSTANTS.SHEET_NAMES.ANULACAO) {
    const numeroPortaria = limparTextoOlympos(rowData[columnMap.PORTARIA_ANULAR - 1]);
    const parecer = limparTextoOlympos(rowData[columnMap.PARECER - 1]);
    fileName = `Portaria de Anulação Nº${numeroPortaria.replace(/\//g, '-')}_${anoReferencia}`;
    placeholders['\\{\\{portaria\\}\\}'] = numeroPortaria;
    placeholders['\\{\\{artigo01\\}\\}'] = `Art. 1º. Torna-se sem efeito a portaria Nº ${numeroPortaria} - SMEB, em razão do que constante no parecer jurídico Nº ${parecer}.`;
  }

  // 3. Cria a cópia física no Drive somente com tudo validado
  const template = templateFileOpt || DriveApp.getFileById(config.templateId);
  const destinationFolder = destinationFolderOpt || DriveApp.getFolderById(config.folderId);
  const newFile = template.makeCopy(fileName, destinationFolder);
  const doc = DocumentApp.openById(newFile.getId());
  const body = doc.getBody();

  for (const marker in placeholders) {
    safeReplaceText_(body, marker, placeholders[marker] || '');
  }

  // 4. Formatação de Artigo 01 e Artigo 02 para Prêmio e Não Remunerada (usando indexOf)
  if (dadosArtigo) {
    const rangeElement = body.findText('\\{\\{artigo01\\}\\}');
    if (rangeElement) {
      const textElement = rangeElement.getElement().asText();
      textElement.setText(dadosArtigo.textoCompletoArt1);
      textElement.setBold(false);
      textElement.setFontSize(12);
      aplicarNegritoLiteral(
        textElement,
        [dadosArtigo.art1, dadosArtigo.nomeCompletoUpper, dadosArtigo.mat, dadosArtigo.cargo, dadosArtigo.periodo],
        12
      );
    }

    const rangeArtigo02 = body.findText('\\{\\{artigo02\\}\\}');
    if (rangeArtigo02) {
      const textElement02 = rangeArtigo02.getElement().asText();
      textElement02.setText('');
      textElement02.appendText(dadosArtigo.art2 + ' ');
      textElement02.setBold(0, dadosArtigo.art2.length - 1, true);
      textElement02.setFontSize(0, dadosArtigo.art2.length - 1, 12);

      const boldEndOffset = textElement02.getText().length;
      textElement02.appendText(dadosArtigo.artigo02TextoRestante);
      textElement02.setBold(boldEndOffset, textElement02.getText().length - 1, false);
      textElement02.setFontSize(boldEndOffset, textElement02.getText().length - 1, 12);
    }
  }

  doc.saveAndClose();
  return { file: newFile, endDate: dataFinalFormatada };
}

/**
 * Lê as configurações da aba "Configurações" em uma única leitura em lote (A2:D2).
 * @returns {object} Um objeto com as configurações.
 */
function getSettings() {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONSTANTS.SHEET_NAMES.CONFIG);
  if (!configSheet) throw new Error('Aba "Configurações" não encontrada.');

  const rowValues = configSheet.getRange('A2:D2').getValues()[0];
  const defaultTpl = (CONSTANTS.DEFAULTS && CONSTANTS.DEFAULTS.TEMPLATE_ID_LICENCA) || '1AwMpqn0RUP9uDw7YPcPP0TsZ5MZ71Nr2gSlbRRXZ7iw';
  const settings = {
    templateId: limparTextoOlympos(rowValues[0]) || defaultTpl,
    folderId: limparTextoOlympos(rowValues[1]),
    anoRef: limparTextoOlympos(rowValues[2]) || '2026',
    secretario: limparTextoOlympos(rowValues[3])
  };

  if (!settings.templateId || !settings.folderId || !settings.secretario) {
    throw new Error('Verifique se todos os campos na aba "Configurações" estão preenchidos.');
  }
  return settings;
}
