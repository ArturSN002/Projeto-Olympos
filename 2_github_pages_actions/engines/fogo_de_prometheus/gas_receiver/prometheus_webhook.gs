/**
 * @fileoverview [DESCONTINUADO / UNIFICADO NO HUB OLYMPOS]
 * ATENÇÃO ARQUITETURAL (V2):
 * Este receptor standalone foi consolidado integralmente dentro do projeto único do Hub Olympos:
 *   -> hub-olympos-webapp/01_router_main.gs (action: 'fogo_prometheus')
 *   -> hub-olympos-webapp/04_module_prometheus.gs
 *
 * NÃO implante este arquivo separadamente para evitar duas URLs de Web App (/exec),
 * divisão de ScriptProperties e concorrência sem LockService sobre _memoria_helio.md
 * e sobre a planilha fixa oficial (1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY).
 * Mantido apenas como referência histórica.
 */

const PROMETHEUS_CONFIG = {
  FOLDER_PORTARIAS_2026: '1qGq5uqxOtN_V63itUheYatLIcj5R86O3',
  FOLDER_GABINETE_2026: '16YaFjfO6DRPVzJtRzLsynrOI0llNXQ8L',
  FOLDER_JURIDICO_2026: '1N6UgdyGTVdIP4PW02dDBstsi4LIhgmRJ',
  FOLDER_RAIZ_SMEB: '18k1Xq0BGSJ8PHfVn9633Bky1EHHCENg6',
  FOLDER_OLYMPO: '1W9mGmQCrX8BRPsGcK_vqUwfXw1dRmSya',
  FOLDER_MEMORIAS_MD: '1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu',
  PLANILHA_ID_OFICIAL: '1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY',
  ABA_DESTINO: 'Publicações',
  MAPA_MEMORIAS_ID: {
    '_memoria_apolo': '1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn',
    '_memoria_apolo.md': '1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn',
    '_memoria_atena': '1gIpOIxV0Ll823taKf2rOR_pdeymhTk5g',
    '_memoria_atena.md': '1gIpOIxV0Ll823taKf2rOR_pdeymhTk5g',
    '_memoria_dedalo': '1fLV4Fv_-omsYMYpqOnJbSgIofj7CP6DH',
    '_memoria_dedalo.md': '1fLV4Fv_-omsYMYpqOnJbSgIofj7CP6DH',
    '_memoria_helio': '1DUJWolZjrEwFkWZdadoxPkoqesdk33xN',
    '_memoria_helio.md': '1DUJWolZjrEwFkWZdadoxPkoqesdk33xN',
    '_memoria_hera': '1Kjz_pf3agZu3SiEonizLlMJogjmoNa5N',
    '_memoria_hera.md': '1Kjz_pf3agZu3SiEonizLlMJogjmoNa5N',
    '_memoria_hermes': '1SKm7QmOcPWZqVqk3nchO96TOS-0mHJ-Y',
    '_memoria_hermes.md': '1SKm7QmOcPWZqVqk3nchO96TOS-0mHJ-Y',
    '_memoria_hestia': '1h60ezPEWsLtiQ34BA1V3GrNAZDtwBZqj',
    '_memoria_hestia.md': '1h60ezPEWsLtiQ34BA1V3GrNAZDtwBZqj',
    '_memoria_homero': '1inxLvsP8ID3rWPcGGeGDkUZJiNVBTcOG',
    '_memoria_homero.md': '1inxLvsP8ID3rWPcGGeGDkUZJiNVBTcOG',
    '_memoria_nike': '1Sr0Qinqa2p5l0ikG-72YjRsPsaaGS4Fi',
    '_memoria_nike.md': '1Sr0Qinqa2p5l0ikG-72YjRsPsaaGS4Fi',
    '_memoria_orfeu': '1JNd8AjGoDAweU9mw9VNhgWEJpPPwgz6d',
    '_memoria_orfeu.md': '1JNd8AjGoDAweU9mw9VNhgWEJpPPwgz6d',
    '_memoria_temis': '1wqPlMFoVoxoIJvHXRNCuX5smXltGW1mh',
    '_memoria_temis.md': '1wqPlMFoVoxoIJvHXRNCuX5smXltGW1mh'
  }
};

/**
 * Extrai ou normaliza entidades estruturadas (NER: Servidores, Matrículas, Nº do Ato).
 */
function extrairEntidadesNerGas_(pub) {
  if (pub.entidades_ner && (pub.entidades_ner.numero_ato || (pub.entidades_ner.servidores && pub.entidades_ner.servidores.length))) {
    return {
      numeroAto: pub.entidades_ner.numero_ato || '',
      servidores: pub.entidades_ner.servidores || [],
      matriculas: pub.entidades_ner.matriculas || []
    };
  }

  const texto = `${pub.titulo_ato || ''} ${pub.resumo_texto || pub.resumo || ''}`;
  const mNum = texto.match(/(?:PORTARIA|EDITAL|DECRETO|LEI)\s*(?:N[º°.]?\s*)?(\d{1,4}(?:[.\/\-]\d{2,4})?)/i);
  const numeroAto = mNum ? mNum[1] : '';

  const matriculas = [];
  const regMat = /matr[íi]cula(?:\s*n[º°.]?)?\s*[:\-]?\s*([\d.\-\/]{2,14})/gi;
  let m;
  while ((m = regMat.exec(texto)) !== null) {
    if (matriculas.indexOf(m[1]) === -1) matriculas.push(m[1]);
  }

  const servidores = [];
  const regSrv = /servidor(?:\(a\)|a)?\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s']{5,65}?)(?=\s*[-–,]\s*matr[íi]cula)/gi;
  while ((m = regSrv.exec(texto)) !== null) {
    const nome = m[1].trim().toUpperCase();
    if (servidores.indexOf(nome) === -1) servidores.push(nome);
  }

  return { numeroAto: numeroAto, servidores: servidores, matriculas: matriculas };
}

/**
 * Grava EXCLUSIVAMENTE na planilha oficial fixa (ID: 1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY).
 * VEDAÇÃO ABSOLUTA: Jamais cria planilha nova. Deduplica por Código FEMURN.
 */
function registrarIndicePlanilhaDiarioOficial2026(resultadosSalvos) {
  if (!resultadosSalvos || resultadosSalvos.length === 0) return null;
  const planilhaId = PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL;

  try {
    const ss = SpreadsheetApp.openById(planilhaId);
    if (!ss) return null;

    let sheet = ss.getSheetByName(PROMETHEUS_CONFIG.ABA_DESTINO);
    if (!sheet) {
      sheet = ss.getSheets()[0] || ss.insertSheet(PROMETHEUS_CONFIG.ABA_DESTINO);
    }

    const lastRow = sheet.getLastRow();
    const codigosExistentes = new Set();

    if (lastRow === 0) {
      sheet.appendRow([
        'Data Circulação',
        'Código FEMURN',
        'Órgão',
        'Categoria',
        'Nº do Ato',
        'Título do Ato',
        'Servidores Identificados (NER)',
        'Matrículas',
        'URL do PDF no Drive'
      ]);
    } else if (lastRow > 1) {
      const dadosCol = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      dadosCol.forEach(r => {
        const cod = String(r[0] || '').trim();
        if (cod) codigosExistentes.add(cod);
      });
    }

    const novasLinhas = [];
    resultadosSalvos.forEach(r => {
      const chaveCod = String(r.codigo || '').trim();
      if (chaveCod && codigosExistentes.has(chaveCod)) {
        return;
      }
      novasLinhas.push([
        r.data,
        r.codigo,
        r.orgao,
        r.categoria,
        r.numeroAto || '',
        r.titulo,
        (r.servidores || []).join(', '),
        (r.matriculas || []).join(', '),
        r.urlDrive
      ]);
      if (chaveCod) codigosExistentes.add(chaveCod);
    });

    if (novasLinhas.length > 0) {
      const proxima = sheet.getLastRow() + 1;
      sheet.getRange(proxima, 1, novasLinhas.length, 9).setValues(novasLinhas);
      SpreadsheetApp.flush();
    }

    return { planilha: ss.getName(), id: planilhaId, linhasInseridas: novasLinhas.length };
  } catch (e) {
    console.error('Erro ao gravar índice oficial no receptor:', e);
    return null;
  }
}

/**
 * Grava alerta nos arquivos _memoria_<deus>.md acessando exclusivamente pelos IDs fixos.
 * VEDAÇÃO ABSOLUTA: Jamais cria arquivos .md órfãos. Mantém o Rolling Buffer de 60 linhas e a seção ## 0. Caixa de Entrada.
 */
function registrarAlertaMemoriaOlympos(nomeArquivoMd, novaLinha) {
  try {
    const chave = String(nomeArquivoMd || '').trim();
    const chaveSemMd = chave.replace(/\.md$/i, '');
    const idFixo = PROMETHEUS_CONFIG.MAPA_MEMORIAS_ID[chave] || PROMETHEUS_CONFIG.MAPA_MEMORIAS_ID[chaveSemMd];
    let file = null;

    if (idFixo && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
      try {
        file = DriveApp.getFileById(idFixo);
      } catch (e) {}
    }

    if (!file) {
      console.warn(`Arquivo de memória ${nomeArquivoMd} (ID: ${idFixo}) não pôde ser aberto. Bloqueada a criação de arquivo avulso.`);
      return { status: 'BLOQUEADO', motivo: 'Arquivo não localizado por ID fixo. Criação desativada.' };
    }

    const conteudo = file.getBlob().getDataAsString('UTF-8') || '';
    const linhas = conteudo.split('\n');
    const novasLinhas = [];
    const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');
    let inseriuCaixa = false;

    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i].startsWith('Atualizado em:')) {
        novasLinhas.push(`Atualizado em: ${agora}`);
        continue;
      }
      if (linhas[i].trim() === '- Sem novos alertas na caixa de entrada.') {
        continue;
      }
      novasLinhas.push(linhas[i]);
      if (linhas[i].startsWith('## 0. Caixa de Entrada')) {
        novasLinhas.push(`- ${novaLinha}`);
        inseriuCaixa = true;
      }
    }

    if (!inseriuCaixa) {
      novasLinhas.unshift(`- ${novaLinha}`);
    }

    const textoFinal = novasLinhas.slice(0, 60).join('\n');
    file.setContent(textoFinal);

    return { status: 'OK', arquivo: nomeArquivoMd, totalLinhas: Math.min(novasLinhas.length, 60) };
  } catch (e) {
    console.warn('Aviso ao gravar memória ' + nomeArquivoMd + ':', e);
    return { status: 'AVISO', erro: e.message };
  }
}

/**
 * Converte data para formato por extenso em português (ex: "29 de Outubro de 2026").
 */
function formatarDataPorExtensoPtBr_(dataStr) {
  if (!dataStr) return '';
  const partes = String(dataStr).trim().split(/[-/]/);
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  if (partes.length === 3) {
    let dia, mes, ano;
    if (partes[0].length === 4) {
      ano = partes[0]; mes = parseInt(partes[1], 10); dia = parseInt(partes[2], 10);
    } else {
      dia = parseInt(partes[0], 10); mes = parseInt(partes[1], 10); ano = partes[2];
    }
    const nomeMes = (mes >= 1 && mes <= 12) ? meses[mes - 1] : String(mes);
    return `${dia} de ${nomeMes} de ${ano}`;
  }
  return String(dataStr);
}

/**
 * Gera nome de arquivo canônico padronizado no formato:
 * "Portaria - SMEB nº 163 de 29 de Outubro de 2026.pdf"
 */
function gerarNomeArquivoPadronizado_(pub, dataISO, dataRef) {
  if (pub.nome_arquivo && String(pub.nome_arquivo).toLowerCase().endsWith('.pdf') && !pub.nome_arquivo.includes('FEMURN_')) {
    return pub.nome_arquivo;
  }
  const ner = extrairEntidadesNerGas_(pub);
  const cat = String(pub.categoria || pub.tipo_ato || 'PORTARIA').toUpperCase();
  let tipo = 'Portaria';
  if (cat.includes('EDITAL')) tipo = 'Edital';
  else if (cat.includes('DECRETO')) tipo = 'Decreto';
  else if (cat.includes('LEI')) tipo = 'Lei';
  else if (cat.includes('EXTRATO')) tipo = 'Extrato';
  else if (cat.includes('RESOLU')) tipo = 'Resolução';
  else if (cat.includes('AVISO')) tipo = 'Aviso';

  const orgao = 'SMEB';
  const dataExtenso = formatarDataPorExtensoPtBr_(pub.data_circulacao || dataRef || dataISO);
  let num = (ner && ner.numeroAto) ? String(ner.numeroAto) : '';
  if (num) {
    num = num.replace(/[\\/:*?"<>|]/g, '-').replace(/\/\d{4}$/, '').trim();
  }

  let baseNome = '';
  if (num) {
    baseNome = `${tipo} - ${orgao} nº ${num}`;
  } else if (pub.codigo_identificador || pub.codigo) {
    baseNome = `${tipo} - ${orgao} (${pub.codigo_identificador || pub.codigo})`;
  } else {
    baseNome = `${tipo} - ${orgao}`;
  }

  if (dataExtenso) {
    baseNome = `${baseNome} de ${dataExtenso}`;
  }

  baseNome = baseNome.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  return `${baseNome}.pdf`;
}

/**
 * Processa o pacote diário enviado pela VM do Fogo de Prometheus (GitHub Actions).
 */
function processarPacotePrometheus(payload) {
  const dataRef = payload.data_referencia || payload.data_execucao || Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy');
  const dataISO = dataRef.includes('/') ? dataRef.split('/').reverse().join('-') : dataRef;
  const publicacoes = payload.publicacoes || [];
  const resultadosSalvos = [];
  const cachePastas = {};

  function obterPastaCacheada(folderId) {
    if (!cachePastas[folderId]) {
      cachePastas[folderId] = DriveApp.getFolderById(folderId);
    }
    return cachePastas[folderId];
  }

  publicacoes.forEach(pub => {
    const categoria = pub.categoria || pub.tipo_ato || 'ATO_GABINETE';
    const tituloAto = pub.titulo_ato || pub.resumo || pub.nome_arquivo || 'Ato_FEMURN';
    const codId = pub.codigo_identificador || 'DOC';

    let folderId = PROMETHEUS_CONFIG.FOLDER_GABINETE_2026;
    if (String(pub.entidade || '').includes('Câmara')) {
      folderId = PROMETHEUS_CONFIG.FOLDER_JURIDICO_2026;
    } else if (categoria === 'PORTARIA') {
      folderId = PROMETHEUS_CONFIG.FOLDER_PORTARIAS_2026;
    } else if (categoria === 'NORMATIVO_JURIDICO') {
      folderId = PROMETHEUS_CONFIG.FOLDER_GABINETE_2026;
    }

    const folder = obterPastaCacheada(folderId);
    const fileName = pub.nome_arquivo || gerarNomeArquivoPadronizado_(pub, dataISO, dataRef);

    const existentes = folder.getFilesByName(fileName);
    let fileUrl = '';
    if (existentes.hasNext()) {
      fileUrl = existentes.next().getUrl();
    } else {
      const decodedBytes = Utilities.base64Decode(pub.pdf_base64);
      const blob = Utilities.newBlob(decodedBytes, 'application/pdf', fileName);
      const novoArquivo = folder.createFile(blob);
      fileUrl = novoArquivo.getUrl();
    }

    const ner = extrairEntidadesNerGas_(pub);

    resultadosSalvos.push({
      codigo: codId,
      data: dataRef,
      entidade: pub.entidade || 'Prefeitura Municipal de Ceará-Mirim',
      orgao: pub.orgao || 'SMEB',
      titulo: tituloAto,
      categoria: categoria,
      numeroAto: ner.numeroAto,
      servidores: ner.servidores,
      matriculas: ner.matriculas,
      urlDrive: fileUrl
    });

    if (categoria === 'PERMUTA_RH' || String(tituloAto).toLowerCase().includes('permuta')) {
      registrarAlertaMemoriaOlympos('_memoria_hera.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
    } else if (categoria === 'EDITAL_PSS') {
      registrarAlertaMemoriaOlympos('_memoria_nike.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
    } else if (categoria === 'NORMATIVO_JURIDICO') {
      registrarAlertaMemoriaOlympos('_memoria_temis.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
    }
  });

  const resumoDia = resultadosSalvos.length > 0
    ? resultadosSalvos.map(r => `[${r.orgao}] ${r.titulo} -> ${r.urlDrive}`).join(' | ')
    : 'Nenhuma publicação da SMEB/Educação localizada nesta edição.';

  registrarAlertaMemoriaOlympos('_memoria_helio.md', `[${dataISO}] Edição FEMURN (${resultadosSalvos.length} atos): ${resumoDia}`);

  // Grava exclusivamente na planilha oficial de ID 1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY
  const resIndice = registrarIndicePlanilhaDiarioOficial2026(resultadosSalvos);

  return {
    status: 'OK',
    data: dataRef,
    salvos: resultadosSalvos.length,
    planilhaOficial: PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL,
    indice: resIndice,
    detalhes: resultadosSalvos
  };
}

/**
 * Endpoint HTTP POST Standalone com Suporte a Ações Públicas do Hub Olympos.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ERRO', mensagem: 'Payload ausente.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || payload.modulo;

    // Ações públicas permitidas sem token secreto (Ping, Overview, Catálogo de Portarias, Status)
    if (action === 'ping' || action === 'status' || action === 'health' || payload.api === '1') {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        status: 'online',
        service: 'Projeto Olympos Gateway (Prometheus Webhook)',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'overview_get') {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        numeracao: {
          proximoOficio2026: 155,
          ultimoOficio2026: 154,
          proximaPortaria2026: 412,
          ultimaPortaria2026: 411,
          signatario: 'Maria Margareth da Silva Pereira',
          ano: 2026
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'portarias_catalogo') {
      const op = payload.operacao || 'LICENCAS';
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        planilhas: op === 'READAPTACOES' ? [
          { id: '1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0', nome: 'Planilha Oficial de Readaptações 2026', abas: ['Readaptações 2026', 'Página1'] }
        ] : [
          { id: '1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc', nome: 'Planilha Oficial de Licenças 2026', abas: ['Licenças 2026', 'Página1'] }
        ]
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'prometheus_status') {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        data: {
          statusWebhook: {
            webhookAtivo: true,
            ultimaExecucao: Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm'),
            totalSalvos: 4,
            publicacoes: []
          },
          planilhaOficialUrl: 'https://docs.google.com/spreadsheets/d/' + PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const tokenEsperado = PropertiesService.getScriptProperties().getProperty('OLYMPOS_SECRET_TOKEN');

    if (!tokenEsperado || payload.token !== tokenEsperado) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ERRO', mensagem: 'Token não autorizado.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const resultado = processarPacotePrometheus(payload);
    return ContentService.createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ERRO_CRITICO', mensagem: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
