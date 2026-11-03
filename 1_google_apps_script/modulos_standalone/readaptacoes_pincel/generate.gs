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
 * Consulta o contador do Olho de Apolo (varrendo a pasta Portarias 2026, o cache em ScriptProperties e as linhas da planilha)
 * e aloca automaticamente o próximo número sequencial de Portaria disponível.
 * @param {GoogleAppsScript.Drive.Folder} [destinationFolderOpt] Pasta de destino configurada.
 * @param {Array<Array<*>>} [allSheetRowsOpt] Matriz opcional de linhas da planilha para evitar colisão local.
 * @param {number} [portariaColIndexOpt] Índice 1-based da coluna de portaria.
 * @returns {string} Próximo número sequencial formatado (ex: "089").
 */
function alocarProximoNumeroPortariaApolo(destinationFolderOpt, allSheetRowsOpt, portariaColIndexOpt) {
  const props = PropertiesService.getScriptProperties();
  let maior = parseInt(props.getProperty(CONSTANTS.OLHO_APOLO.COUNTER_KEY), 10) || 0;

  // 1. Verifica cache compartilhado do Olho de Apolo (se existir)
  const rawApoloCache = props.getProperty(CONSTANTS.OLHO_APOLO.CACHE_KEY);
  if (rawApoloCache) {
    try {
      const parsed = JSON.parse(rawApoloCache);
      const ultimoCache = parseInt(parsed.ultimaPortaria2026, 10);
      if (!isNaN(ultimoCache) && ultimoCache > maior) {
        maior = ultimoCache;
      }
    } catch (e) {}
  }

  // 2. Verifica números já preenchidos na própria planilha
  if (Array.isArray(allSheetRowsOpt) && portariaColIndexOpt) {
    allSheetRowsOpt.forEach(row => {
      const val = limparTextoOlympos(row[portariaColIndexOpt - 1]);
      const match = val.match(/^(\d{1,4})(?:[\/\-]\d{4})?$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maior && n < 5000) maior = n;
      }
    });
  }

  // 3. Varre a pasta oficial Portarias 2026 (ou pasta de destino) para garantir sincronia com o Drive
  const regexPortaria = /portaria[\s_\-]*n?[º°]?[\s_\-]*(\d{1,4})/i;
  const pastasParaChecar = [];
  if (destinationFolderOpt) pastasParaChecar.push(destinationFolderOpt);
  try {
    if (typeof DriveApp !== 'undefined' && DriveApp.getFolderById) {
      pastasParaChecar.push(DriveApp.getFolderById(CONSTANTS.OLHO_APOLO.PORTARIAS_2026_FOLDER_ID));
    }
  } catch (e) {}

  pastasParaChecar.forEach(folder => {
    if (!folder || typeof folder.getFiles !== 'function') return;
    try {
      const files = folder.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        const nome = f.getName();
        if (/[\/_\-]202[0-5]\b/.test(nome)) continue;
        const m = nome.match(regexPortaria);
        if (m && m[1]) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maior && num < 5000) {
            maior = num;
          }
        }
      }
    } catch (e) {}
  });

  const proximo = maior + 1;
  const proximoFormatado = String(proximo).padStart(3, '0');

  props.setProperty(CONSTANTS.OLHO_APOLO.COUNTER_KEY, String(proximo));
  return proximoFormatado;
}

/**
 * Valida se todos os campos críticos da portaria estão preenchidos, sem "?" ou "??", e com datas válidas.
 * Suporta auto-numeração via Olho de Apolo quando `permitirAutoNumeracaoApolo` é true e `numPortaria` está vazio.
 * @param {object} dados Objeto com os campos extraídos da linha.
 */
function validarDadosPortaria(dados) {
  const obrigatorios = [
    { nome: 'Proc. Adm./Parecer', valor: dados.procAdm },
    { nome: 'Nome Completo', valor: dados.nomeCompleto },
    { nome: 'Matrícula', valor: dados.matricula },
    { nome: 'Cargo', valor: dados.cargo },
    { nome: 'Função Readaptada', valor: dados.funcao },
    { nome: 'Data de Início', valor: dados.dataInicio }
  ];

  const strPortaria = limparTextoOlympos(dados.numPortaria);
  const autoNumAtiva = Boolean(dados.permitirAutoNumeracaoApolo);

  if (!autoNumAtiva || strPortaria.includes('?')) {
    obrigatorios.push({ nome: 'Número de Portaria', valor: dados.numPortaria });
  }

  if (dados.exigirDataPub) {
    obrigatorios.push({ nome: 'Data de Publicação', valor: dados.dataPub });
  }

  const inconsistencias = [];
  obrigatorios.forEach(item => {
    const str = limparTextoOlympos(item.valor);
    if (!str || str === '?' || str === '??' || str.includes('?')) {
      inconsistencias.push(item.nome);
    }
  });

  if (dados.dataPub !== undefined && dados.dataPub !== null && String(dados.dataPub).trim() !== '') {
    const strPub = limparTextoOlympos(dados.dataPub);
    if (strPub.includes('?') || !criarDataSemFuso(dados.dataPub)) {
      if (!inconsistencias.includes('Data de Publicação')) {
        inconsistencias.push('Data de Publicação');
      }
    }
  }

  if (!inconsistencias.includes('Data de Início') && !criarDataSemFuso(dados.dataInicio)) {
    inconsistencias.push('Data de Início (formato inválido)');
  }

  if (inconsistencias.length > 0) {
    throw new Error(`Campos pendentes ou com '?': ${inconsistencias.join(', ')}`);
  }
}

/**
 * Aplica negrito usando cálculo literal de índice (indexOf), 100% imune a erros de RegExp com "?" ou "(a)".
 * Utiliza cursor progressivo com fallback para evitar falso positivo em números curtos (ex: matrícula "1" em "Art. 1º").
 * @param {GoogleAppsScript.Document.Text} textElement Elemento de texto do parágrafo.
 * @param {string[]} variaveisParaNegritar Lista de substrings exatas que devem receber negrito.
 * @param {number} [fontSize] Tamanho de fonte opcional a aplicar.
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
 * Diagnóstico Pré-Voo (Dry-Run): Verifica todas as linhas pendentes da aba sem criar arquivos no Google Drive.
 * Contabiliza linhas que receberão numeração sequencial automática pelo Olho de Apolo.
 * @param {string} sheetName Nome da aba a auditar.
 * @returns {object} Relatório detalhado de linhas válidas, auto-numeráveis, geradas e inconsistências.
 */
function executarDiagnosticoPreVoo(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`A aba "${sheetName}" não foi encontrada.`);

  const col = getColumnsForSheet(sheetName);
  const startRow = CONSTANTS.HEADER_ROWS + 1;
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 12);

  if (lastRow < startRow) {
    return { totalLinhas: 0, jaGeradas: 0, totalPendentes: 0, validas: 0, autoNumeradasApolo: 0, invalidas: 0, erros: [] };
  }

  const allValues = sheet.getRange(startRow, 1, lastRow - CONSTANTS.HEADER_ROWS, lastCol).getValues();
  const erros = [];
  let totalPendentes = 0;
  let jaGeradas = 0;
  let validas = 0;
  let autoNumeradasApolo = 0;

  allValues.forEach((rowData, index) => {
    const numLinha = startRow + index;
    const nomeServidor = limparTextoOlympos(rowData[col.NOME - 1]);
    const statusAtual = limparTextoOlympos(rowData[col.STATUS - 1]);
    const numPortariaBruto = limparTextoOlympos(rowData[col.PORTARIA - 1]);

    if (!nomeServidor && !numPortariaBruto) return;
    if (statusAtual.toUpperCase() === CONSTANTS.STATUS_GENERATED.toUpperCase()) {
      jaGeradas++;
      return;
    }

    totalPendentes++;
    try {
      validarDadosPortaria({
        procAdm: rowData[col.PARECER - 1],
        nomeCompleto: nomeServidor,
        matricula: rowData[col.MATRICULA - 1],
        cargo: rowData[col.CARGO - 1],
        funcao: rowData[col.FUNCAO - 1],
        dataInicio: rowData[col.DATA_INICIO - 1],
        numPortaria: numPortariaBruto,
        dataPub: rowData[col.DATA_PUBLICACAO - 1],
        permitirAutoNumeracaoApolo: true
      });
      validas++;
      if (!numPortariaBruto || numPortariaBruto.toUpperCase() === 'AUTO') {
        autoNumeradasApolo++;
      }
    } catch (e) {
      erros.push({
        linha: numLinha,
        servidor: nomeServidor || '(Sem nome)',
        motivo: e.message
      });
    }
  });

  return {
    totalLinhas: jaGeradas + totalPendentes,
    jaGeradas: jaGeradas,
    totalPendentes: totalPendentes,
    validas: validas,
    autoNumeradasApolo: autoNumeradasApolo,
    invalidas: erros.length,
    erros: erros
  };
}

/**
 * Processa um lote de linhas da planilha com leitura única em memória (Batch Read),
 * auto-numeração sequencial via Olho de Apolo e controle de tempo (250s).
 * @param {string} sheetName Nome da aba a processar.
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
    const col = getColumnsForSheet(sheetName);
    const startRow = CONSTANTS.HEADER_ROWS + 1;
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 12);
    const rowCount = lastRow - CONSTANTS.HEADER_ROWS;

    if (rowCount <= 0) {
      resetProcess(false);
      return { status: 'COMPLETED', message: 'Nenhuma linha de dados na planilha.' };
    }

    const allValues = sheet.getRange(startRow, 1, rowCount, lastCol).getValues();

    let stateJSON = props.getProperty(CONSTANTS.STATE_KEYS.GENERATION_STATE);
    let state;

    if (!stateJSON) {
      const pendingRows = [];
      allValues.forEach((row, index) => {
        const statusAtual = row[col.STATUS - 1];
        const nomeServidor = limparTextoOlympos(row[col.NOME - 1]);
        if (nomeServidor && isPendingGenerationStatus_(statusAtual)) {
          pendingRows.push(startRow + index);
        }
      });

      if (pendingRows.length === 0) {
        resetProcess(false);
        return { status: 'COMPLETED', message: 'Nenhuma portaria pendente para gerar.' };
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
      if (Date.now() - startTime > CONSTANTS.MAX_EXECUTION_TIME_MS) {
        break;
      }

      const currentRow = state.pendingRows[i];
      const rowData = allValues[currentRow - startRow];
      const statusCell = sheet.getRange(currentRow, col.STATUS);

      try {
        statusCell.setValue(CONSTANTS.STATUS_GENERATING);

        // Sugestão 3.1.1: Se Número da Portaria estiver vazio (ou "AUTO"), aloca automaticamente via Olho de Apolo
        const numPortariaAtual = limparTextoOlympos(rowData[col.PORTARIA - 1]);
        if (!numPortariaAtual || numPortariaAtual.toUpperCase() === 'AUTO') {
          // Valida primeiro os demais campos antes de consumir um número sequencial
          validarDadosPortaria({
            procAdm: rowData[col.PARECER - 1],
            nomeCompleto: rowData[col.NOME - 1],
            matricula: rowData[col.MATRICULA - 1],
            cargo: rowData[col.CARGO - 1],
            funcao: rowData[col.FUNCAO - 1],
            dataInicio: rowData[col.DATA_INICIO - 1],
            numPortaria: numPortariaAtual,
            dataPub: rowData[col.DATA_PUBLICACAO - 1],
            permitirAutoNumeracaoApolo: true
          });
          const novoNumApolo = alocarProximoNumeroPortariaApolo(destinationFolder, allValues, col.PORTARIA);
          rowData[col.PORTARIA - 1] = novoNumApolo;
          sheet.getRange(currentRow, col.PORTARIA).setValue(novoNumApolo);
        }

        const result = createReadaptationDocument(rowData, sheetName, settings, templateFile, destinationFolder);
        sheet.getRange(currentRow, col.ARQUIVO).setValue(result.file.getUrl());
        statusCell.setValue(CONSTANTS.STATUS_GENERATED);
      } catch (e) {
        const errorMessage = normalizeRowErrorMessage_(e);
        statusCell.setValue(`Erro: ${errorMessage}`);
        console.error(`Erro na linha ${currentRow}: ${e && e.stack ? e.stack : errorMessage}`);
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
      ss.toast('Geração de portarias de readaptação concluída!');
      resetProcess(false);
      return {
        status: 'COMPLETED',
        message: `Concluído! Todos os ${state.total} registros foram processados.`
      };
    }
  } catch (error) {
    ss.toast(`Erro fatal: ${error.message}`);
    console.error('Erro ao gerar lote: ', error);
    resetProcess(false);
    return { status: 'ERROR', message: error.message };
  }
}

/**
 * Remove gatilhos anteriores da mesma função para evitar concorrência.
 */
function limparGatilhosAntigos(handlerName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
}

/**
 * Verifica se a linha ainda precisa ser processada.
 */
function isPendingGenerationStatus_(status) {
  const value = limparTextoOlympos(status).toUpperCase();
  return value === '' || value === 'GERANDO...' || value.startsWith('PENDENTE');
}

function normalizeRowErrorMessage_(error) {
  const message = error && error.message ? error.message : String(error || 'Erro desconhecido');
  return message.length > 240 ? message.substring(0, 237) + '...' : message;
}

/**
 * Cria o documento de Readaptação somente APÓS validar todos os campos e sem usar RegExp em variáveis.
 */
function createReadaptationDocument(rowData, sheetName, settings, templateFileOpt, destinationFolderOpt) {
  const col = getColumnsForSheet(sheetName || CONSTANTS.SHEET_NAMES.READAPTACAO);
  const config = settings || getSettings();

  const numParecer = limparTextoOlympos(rowData[col.PARECER - 1]);
  const nomeCompleto = limparTextoOlympos(rowData[col.NOME - 1]).toUpperCase();
  const matricula = limparTextoOlympos(rowData[col.MATRICULA - 1]);
  const cargo = limparTextoOlympos(rowData[col.CARGO - 1]);
  const funcao = limparTextoOlympos(rowData[col.FUNCAO - 1]);
  const dataInicioBruta = rowData[col.DATA_INICIO - 1];
  let numPortaria = limparTextoOlympos(rowData[col.PORTARIA - 1]);
  const isRepublicado = limparTextoOlympos(rowData[col.REPUBLICACAO - 1]).toUpperCase() === 'SIM';
  const isRetroativo = limparTextoOlympos(rowData[col.RETROATIVO - 1]).toUpperCase() === 'SIM';
  const dataPubBruta = rowData[col.DATA_PUBLICACAO - 1];

  // Auto-numeração Olho de Apolo também suportada em chamadas diretas a createReadaptationDocument
  if (!numPortaria || numPortaria.toUpperCase() === 'AUTO') {
    validarDadosPortaria({
      procAdm: numParecer,
      nomeCompleto: nomeCompleto,
      matricula: matricula,
      cargo: cargo,
      funcao: funcao,
      dataInicio: dataInicioBruta,
      numPortaria: numPortaria,
      dataPub: dataPubBruta,
      permitirAutoNumeracaoApolo: true
    });
    numPortaria = alocarProximoNumeroPortariaApolo(destinationFolderOpt);
    rowData[col.PORTARIA - 1] = numPortaria;
  }

  // 1. Fail-Fast: Valida antes de criar cópia física no Google Drive (Zero Arquivos Órfãos)
  validarDadosPortaria({
    procAdm: numParecer,
    nomeCompleto: nomeCompleto,
    matricula: matricula,
    cargo: cargo,
    funcao: funcao,
    dataInicio: dataInicioBruta,
    numPortaria: numPortaria,
    dataPub: dataPubBruta
  });

  const dataInicioObj = criarDataSemFuso(dataInicioBruta);
  if (!dataInicioObj) {
    throw new Error("Data de Início inválida na coluna F.");
  }
  const dataPubObj = criarDataSemFuso(dataPubBruta) || new Date();

  const dataInicioFormatada = formatarData(dataInicioObj);
  const dataPubCabFormatada = formatarDataPorExtenso(dataPubObj, true);
  const dataPubRodFormatada = formatarDataPorExtenso(dataPubObj, false);

  // 2. Monta os textos dos Artigos 1º e 2º antes de tocar no Google Drive
  const textoArt1 = `Conceder a(o) servidor(a) ${nomeCompleto} - Matrícula nº ${matricula}, categoria funcional ${cargo}, integrante do quadro de pessoal da Secretaria Municipal de Educação Básica, readaptação de função em razão de limitação ocupacional verificada e atestada por meio de inspeção médica, devendo o(a) mesmo(a) exercer a função de ${funcao}.`;

  let artigo02Texto;
  if (isRetroativo && config.isTemporary && config.tempDuration) {
    artigo02Texto = `Esta portaria entra em vigor na data de sua publicação, retroagindo seus efeitos à ${dataInicioFormatada}, devendo o(a) servidor(a) submeter-se à nova avaliação médica pericial após o decurso do prazo de ${config.tempDuration} (${config.tempDurationExtenso || config.tempDuration}) ano(s) a contar da referida data, revogando-se as disposições em contrário.`;
  } else if (isRetroativo) {
    artigo02Texto = `Esta portaria entra em vigor na data de sua publicação, retroagindo seus efeitos à ${dataInicioFormatada}.`;
  } else {
    artigo02Texto = `Esta portaria entra em vigor na data de sua publicação, revogando-se as disposições em contrário.`;
  }

  // 3. Somente após validação 100% concluída cria a cópia do template no Drive
  const template = templateFileOpt || DriveApp.getFileById(config.templateId);
  const destinationFolder = destinationFolderOpt || DriveApp.getFolderById(config.folderId);
  const fileName = `Portaria Nº${String(numPortaria).replace(/\//g, '-')}_${config.anoRef} - Readaptação - ${nomeCompleto}`;

  const newFile = template.makeCopy(fileName, destinationFolder);
  const doc = DocumentApp.openById(newFile.getId());
  const body = doc.getBody();

  const placeholders = {
    '\\{\\{secretario\\}\\}': String(config.secretario || '').toUpperCase(),
    '\\{\\{portaria\\}\\}': numPortaria,
    '\\{\\{parecer\\}\\}': numParecer,
    '\\{\\{dataPubCab\\}\\}': dataPubCabFormatada,
    '\\{\\{DataPubRod\\}\\}': dataPubRodFormatada
  };

  for (const marker in placeholders) {
    safeReplaceText_(body, marker, placeholders[marker] || '');
  }

  const pRepublicado = body.findText('\\{\\{republicado\\}\\}');
  if (pRepublicado) {
    const elRep = pRepublicado.getElement();
    if (isRepublicado) {
      elRep.asText().setText('*Republicado por incorreção');
    } else {
      const parent = elRep.getParent();
      if (parent && parent.getType && parent.getType() === DocumentApp.ElementType.PARAGRAPH && body.getNumChildren && body.getNumChildren() > 1) {
        parent.removeFromParent();
      } else {
        safeReplaceText_(body, '\\{\\{republicado\\}\\}', '');
      }
    }
  }

  // 4. Aplica Artigo 1º e negrito literal (indexOf) nas variáveis (sem RegExp)
  const rangeElement = body.findText('\\{\\{artigo01\\}\\}');
  if (rangeElement) {
    const textElement = rangeElement.getElement().asText();
    textElement.setText(textoArt1);
    textElement.setBold(false);
    aplicarNegritoLiteral(textElement, [nomeCompleto, matricula, cargo, funcao]);
  }

  // 5. Aplica Artigo 2º
  safeReplaceText_(body, '\\{\\{artigo02\\}\\}', artigo02Texto);

  doc.saveAndClose();
  return { file: newFile, url: newFile.getUrl(), numPortaria: numPortaria };
}

/**
 * Lê as configurações da aba "Configurações" em uma única chamada em lote (A2:G2).
 */
function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(CONSTANTS.SHEET_NAMES.CONFIG);
  if (!configSheet) throw new Error(`Aba "${CONSTANTS.SHEET_NAMES.CONFIG}" não encontrada.`);

  const rowValues = configSheet.getRange('A2:G2').getValues()[0];
  const defaultTpl = (CONSTANTS.DEFAULTS && CONSTANTS.DEFAULTS.TEMPLATE_ID_READAPTACAO) || '1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce54';
  const settings = {
    templateId: limparTextoOlympos(rowValues[0]) || defaultTpl,
    folderId: limparTextoOlympos(rowValues[1]),
    anoRef: limparTextoOlympos(rowValues[2]) || '2026',
    secretario: limparTextoOlympos(rowValues[3]),
    isTemporary: limparTextoOlympos(rowValues[4]).toUpperCase() === 'SIM',
    tempDuration: limparTextoOlympos(rowValues[5]),
    tempDurationExtenso: limparTextoOlympos(rowValues[6])
  };

  if (!settings.templateId || !settings.folderId) {
    throw new Error('IDs de template ou pasta não configurados na aba "Configurações".');
  }
  return settings;
}

/**
 * Alias de compatibilidade com a especificação unificada do Pincel de Homero.
 */
function getConfiguration() {
  return getSettings();
}
