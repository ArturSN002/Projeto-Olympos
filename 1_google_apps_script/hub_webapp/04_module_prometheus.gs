/**
 * @fileoverview Módulo 1 — Fogo de Prometheus (Receptor de Publicações FEMURN, Planilha-Índice NER e Resumos no Google Chat).
 * Versão 2.0.0 — Fixação da Planilha Única e Prevenção de Duplicidades.
 */

const PROMETHEUS_CONFIG = {
  FOLDER_PORTARIAS_2026: OLYMPOS_IDS.SETORES_2026.PORTARIAS,
  FOLDER_GABINETE_2026: OLYMPOS_IDS.SETORES_2026.GABINETE,
  FOLDER_JURIDICO_2026: OLYMPOS_IDS.SETORES_2026.ASSESSORIA_JURIDICA,
  FOLDER_RAIZ_SMEB: OLYMPOS_IDS.RAIZ_SMEB,
  PROP_LAST_SYNC: 'PROMETHEUS_LAST_SYNC_META',
  PLANILHA_ID_OFICIAL: OLYMPOS_IDS.PLANILHA_DIARIO_OFICIAL || '1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY',
  ABA_DESTINO: OLYMPOS_IDS.ABA_DIARIO_OFICIAL || 'Publicações'
};

/**
 * Extrai ou normaliza entidades estruturadas (NER: Servidores, Matrículas, Nº do Ato).
 */
function extrairEntidadesNerPrometheus_(pub) {
  if (pub.entidades_ner && (pub.entidades_ner.numero_ato || (pub.entidades_ner.servidores && pub.entidades_ner.servidores.length))) {
    return {
      numeroAto: pub.entidades_ner.numero_ato || '',
      servidores: pub.entidades_ner.servidores || [],
      matriculas: pub.entidades_ner.matriculas || []
    };
  }

  const texto = `${pub.titulo_ato || pub.resumo || ''} ${pub.resumo_texto || ''}`;
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
 * Alimenta EXCLUSIVAMENTE a planilha-índice oficial (ID Fixo: 1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY).
 * VEDAÇÃO ABSOLUTA: Jamais cria uma nova planilha.
 * Deduplica registros por Código FEMURN + Data para garantir idempotência.
 */
function registrarIndicePlanilhaDiarioOficial2026(resultadosSalvos) {
  if (!resultadosSalvos || resultadosSalvos.length === 0) return null;
  const planilhaId = PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL;

  try {
    let ss = null;
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.openById) {
      ss = SpreadsheetApp.openById(planilhaId);
    }
    if (!ss) {
      console.error(`Falha crítica: Não foi possível abrir a planilha oficial de Diário Oficial (ID: ${planilhaId}).`);
      registrarAlertaMemoriaOlympos('_memoria_helio.md', `[FALHA PLANILHA]: Impossível abrir planilha oficial do Diário Oficial.`);
      return null;
    }

    let sheet = ss.getSheetByName(PROMETHEUS_CONFIG.ABA_DESTINO);
    if (!sheet) {
      // Se não existir a aba nomeada, tenta a primeira aba ou cria a aba na MESMA planilha
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
      // Lê coluna de códigos (Coluna B) para deduplicação
      const dadosColCodigo = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      dadosColCodigo.forEach(r => {
        const cod = String(r[0] || '').trim();
        if (cod) codigosExistentes.add(cod);
      });
    }

    const linhasParaInserir = [];
    resultadosSalvos.forEach(r => {
      const chaveCod = String(r.codigo || '').trim();
      if (chaveCod && codigosExistentes.has(chaveCod)) {
        // Já indexado nesta planilha
        return;
      }

      linhasParaInserir.push([
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

    if (linhasParaInserir.length > 0) {
      const proximaLinha = sheet.getLastRow() + 1;
      sheet.getRange(proximaLinha, 1, linhasParaInserir.length, 9).setValues(linhasParaInserir);
      SpreadsheetApp.flush();
    }

    return {
      planilha: ss.getName(),
      id: planilhaId,
      linhasInseridas: linhasParaInserir.length,
      duplicadasIgnoradas: resultadosSalvos.length - linhasParaInserir.length
    };
  } catch (e) {
    console.error('Erro crítico ao gravar índice na planilha oficial:', e);
    registrarAlertaMemoriaOlympos('_memoria_helio.md', `[ERRO PLANILHA FEMURN]: ${e.message}`);
    return null;
  }
}

/**
 * Envia o Resumo Executivo de publicações para o Espaço do Google Chat da SMEB ou E-mail.
 */
function enviarResumoEspacoGoogleChat(dataRef, resultadosSalvos) {
  const props = PropertiesService.getScriptProperties();
  const chatWebhookUrl = (props.getProperty('GOOGLE_CHAT_WEBHOOK_URL') || '').trim();
  const emailParticular = (props.getProperty('EMAIL_RESUMO_PARTICULAR') || '').trim();
  const total = (resultadosSalvos || []).length;

  const linhasTexto = [
    `🔥 *Fogo de Prometheus — Resumo Diário FEMURN (${dataRef})*`,
    total > 0
      ? `📌 *${total} publicação(ões)* da Educação / SMEB Ceará-Mirim arquivada(s) no Google Drive:`
      : `ℹ️ Nenhuma publicação referente à SMEB / Educação foi localizada na edição de ${dataRef}.`
  ];

  const widgets = [];
  (resultadosSalvos || []).slice(0, 15).forEach((r, idx) => {
    const infoNer = (r.servidores && r.servidores.length > 0)
      ? ` | 👤 ${r.servidores.join(', ')}${r.matriculas && r.matriculas.length ? ` (Mat. ${r.matriculas.join(', ')})` : ''}`
      : '';
    linhasTexto.push(`${idx + 1}. *[${r.categoria}]* ${r.titulo} (${r.orgao})${infoNer} • <${r.urlDrive}|Abrir PDF>`);

    widgets.push({
      decoratedText: {
        topLabel: `${r.categoria} • ${r.orgao}`,
        text: `<b>${r.titulo}</b>${infoNer}`,
        wrapText: true,
        button: {
          text: 'Abrir PDF',
          onClick: { openLink: { url: r.urlDrive } }
        }
      }
    });
  });

  const payloadChat = {
    text: linhasTexto.join('\n'),
    cardsV2: total > 0 ? [{
      cardId: `prometheus-hub-${String(dataRef).replace(/\//g, '-')}`,
      card: {
        header: {
          title: '🔥 Fogo de Prometheus — Resumo Diário FEMURN',
          subtitle: `SMEB Ceará-Mirim/RN • Edição ${dataRef} (${total} atos)`
        },
        sections: [{ widgets: widgets }]
      }
    }] : []
  };

  let enviadoChat = false;
  let enviadoEmail = false;

  if (chatWebhookUrl && chatWebhookUrl.startsWith('https://chat.googleapis.com/') && typeof UrlFetchApp !== 'undefined' && UrlFetchApp.fetch) {
    try {
      UrlFetchApp.fetch(chatWebhookUrl, {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        payload: JSON.stringify(payloadChat),
        muteHttpExceptions: true
      });
      enviadoChat = true;
    } catch (e) {
      console.warn('Falha no webhook Google Chat:', e);
    }
  }

  const destinoEmail = emailParticular || (chatWebhookUrl.includes('@') && !chatWebhookUrl.startsWith('http') ? chatWebhookUrl : '');
  if (destinoEmail && typeof MailApp !== 'undefined' && MailApp.sendEmail) {
    try {
      const itensHtml = (resultadosSalvos || []).map((r) => {
        const nerHtml = (r.servidores && r.servidores.length > 0)
          ? `<div style="font-size:12px;color:#475569;margin-top:4px;">👤 <b>Servidor(es):</b> ${r.servidores.join(', ')}${r.matriculas && r.matriculas.length ? ` (Mat.: ${r.matriculas.join(', ')})` : ''}</div>`
          : '';
        return `<li style="margin-bottom:10px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <span style="font-size:11px;font-weight:bold;color:#1e40af;background:#dbeafe;padding:2px 6px;border-radius:4px;">${r.categoria}</span>
          <strong style="margin-left:6px;color:#0f172a;">${r.titulo}</strong> <span style="color:#64748b;font-size:12px;">(${r.orgao})</span>
          ${nerHtml}
          <div style="margin-top:6px;"><a href="${r.urlDrive}" style="color:#2563eb;font-weight:bold;text-decoration:none;font-size:12px;">📄 Abrir PDF no Google Drive ➔</a></div>
        </li>`;
      }).join('');

      const htmlBody = `<div style="font-family:sans-serif;max-width:640px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;">
        <div style="background:#1e3a8a;color:#fff;padding:14px 18px;">
          <h3 style="margin:0;font-size:16px;">🔥 Fogo de Prometheus — Resumo Diário FEMURN (${dataRef})</h3>
          <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">SMEB Ceará-Mirim/RN • ${total} publicação(ões) arquivada(s)</p>
        </div>
        <div style="padding:16px;">
          ${total > 0 ? `<ul style="list-style:none;padding:0;margin:0;">${itensHtml}</ul>` : `<p style="color:#475569;">ℹ️ Nenhuma publicação referente à SMEB / Educação foi localizada na edição de ${dataRef}.</p>`}
        </div>
      </div>`;

      MailApp.sendEmail({
        to: destinoEmail,
        subject: `🔥 [Fogo de Prometheus] Resumo FEMURN (${dataRef}) — ${total} ato(s)`,
        body: linhasTexto.join('\n'),
        htmlBody: htmlBody
      });
      enviadoEmail = true;
    } catch (e) {
      console.warn('Aviso ao enviar resumo para e-mail:', e);
    }
  }

  return {
    enviado: enviadoChat || enviadoEmail,
    viaChat: enviadoChat,
    viaEmail: enviadoEmail,
    totalAtos: total
  };
}

/**
 * Permite disparar manualmente o Resumo Executivo ao Espaço do Google Chat ou e-mail pelo Hub Olympos.
 */
function dispararResumoGoogleChatManual() {
  const painel = carregarPainelPrometheus();
  const dataRef = Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy');
  const itensConvertidos = (painel.arquivosDrive || []).slice(0, 10).map((arq, i) => ({
    codigo: `DOC${i + 1}`,
    data: dataRef,
    orgao: arq.setor,
    categoria: arq.setor.includes('Portarias') ? 'PORTARIA' : 'ATO_GABINETE',
    titulo: arq.nome,
    servidores: [],
    matriculas: [],
    urlDrive: arq.url
  }));

  const res = enviarResumoEspacoGoogleChat(dataRef, itensConvertidos);
  return {
    status: 'OK',
    enviadoAoWebhook: res.enviado,
    totalItensResumo: itensConvertidos.length,
    mensagem: res.enviado
      ? `Resumo com ${itensConvertidos.length} ato(s) enviado com sucesso!`
      : `Resumo gerado para ${itensConvertidos.length} ato(s). Configure GOOGLE_CHAT_WEBHOOK_URL nas Script Properties para disparo externo.`
  };
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
  const ner = extrairEntidadesNerPrometheus_(pub);
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
  const alertasDespachados = [];
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

    const ner = extrairEntidadesNerPrometheus_(pub);

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
      alertasDespachados.push('Hera (Permuta/RH)');
    } else if (categoria === 'EDITAL_PSS') {
      registrarAlertaMemoriaOlympos('_memoria_nike.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
      alertasDespachados.push('Nike (Edital/PSS)');
    } else if (categoria === 'NORMATIVO_JURIDICO') {
      registrarAlertaMemoriaOlympos('_memoria_temis.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
      alertasDespachados.push('Têmis (Normativo Jurídico)');
    }
  });

  const resumoDia = resultadosSalvos.length > 0
    ? resultadosSalvos.map(r => `[${r.orgao}] ${r.titulo} -> ${r.urlDrive}`).join(' | ')
    : 'Nenhuma publicação da SMEB/Educação localizada nesta edição.';

  let resIndice = null;
  let lock = null;
  try {
    if (typeof LockService !== 'undefined' && LockService.getScriptLock) {
      lock = LockService.getScriptLock();
      lock.tryLock(25000);
    }
    registrarAlertaMemoriaOlympos('_memoria_helio.md', `[${dataISO}] Edição FEMURN (${resultadosSalvos.length} atos): ${resumoDia}`);

    // Grava exclusivamente na planilha oficial de ID 1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY
    resIndice = registrarIndicePlanilhaDiarioOficial2026(resultadosSalvos);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }

  // Envia resumo para o Espaço do Google Chat / E-mail
  const statusChat = enviarResumoEspacoGoogleChat(dataRef, resultadosSalvos);

  const metaSync = {
    ultimaExecucao: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss'),
    dataReferencia: dataRef,
    totalSalvos: resultadosSalvos.length,
    alertasSetoriais: alertasDespachados,
    indiceGravado: resIndice,
    publicacoes: resultadosSalvos.slice(0, 25)
  };
  PropertiesService.getScriptProperties().setProperty(PROMETHEUS_CONFIG.PROP_LAST_SYNC, JSON.stringify(metaSync));

  return {
    status: 'OK',
    data: dataRef,
    salvos: resultadosSalvos.length,
    planilhaOficial: PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL,
    indice: resIndice,
    detalhes: resultadosSalvos,
    notificacao: statusChat
  };
}

/**
 * Retorna o status atual do Webhook Fogo de Prometheus e as últimas publicações da SMEB/Gabinete salvas nas pastas de 2026.
 */
function obterStatusWebhookPrometheus() {
  const props = PropertiesService.getScriptProperties();
  const rawMeta = props.getProperty(PROMETHEUS_CONFIG.PROP_LAST_SYNC);
  const temTokenConfigurado = Boolean(props.getProperty('OLYMPOS_SECRET_TOKEN'));

  if (rawMeta) {
    try {
      const parsed = JSON.parse(rawMeta);
      parsed.webhookAtivo = temTokenConfigurado;
      return parsed;
    } catch (e) {
      console.warn('Erro ao ler PROMETHEUS_LAST_SYNC_META:', e);
    }
  }

  return {
    webhookAtivo: temTokenConfigurado,
    ultimaExecucao: 'Aguardando primeiro disparo da VM GitHub Actions',
    dataReferencia: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy'),
    totalSalvos: 0,
    alertasSetoriais: [],
    publicacoes: []
  };
}

/**
 * Varre as pastas de Portarias 2026, Gabinete 2026 e Jurídico 2026 em busca dos últimos PDFs da FEMURN.
 */
function carregarPainelPrometheus() {
  const statusWebhook = obterStatusWebhookPrometheus();
  const arquivosRecentes = [];

  const pastasParaVarrer = [
    { id: PROMETHEUS_CONFIG.FOLDER_PORTARIAS_2026, setor: 'Portarias 2026' },
    { id: PROMETHEUS_CONFIG.FOLDER_GABINETE_2026, setor: 'Gabinete 2026' },
    { id: PROMETHEUS_CONFIG.FOLDER_JURIDICO_2026, setor: 'Assessoria Jurídica 2026' }
  ];

  pastasParaVarrer.forEach(p => {
    try {
      const folder = DriveApp.getFolderById(p.id);
      const it = folder.getFiles();
      let count = 0;
      while (it.hasNext() && count < 15) {
        const f = it.next();
        const nome = f.getName();
        if (nome.includes('FEMURN') || nome.toLowerCase().endsWith('.pdf')) {
          arquivosRecentes.push({
            nome: nome,
            setor: p.setor,
            dataCriacao: Utilities.formatDate(f.getDateCreated(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm'),
            timestamp: f.getDateCreated().getTime(),
            url: f.getUrl()
          });
          count++;
        }
      }
    } catch (e) {
      console.warn(`Não foi possível listar pasta ${p.setor}:`, e);
    }
  });

  arquivosRecentes.sort((a, b) => b.timestamp - a.timestamp);

  return {
    statusWebhook: statusWebhook,
    planilhaOficialUrl: `https://docs.google.com/spreadsheets/d/${PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL}/edit`,
    arquivosDrive: arquivosRecentes.slice(0, 20)
  };
}

/**
 * Dispara sincronização manual das publicações encontradas no Drive para _memoria_helio.md.
 */
function sincronizarManualPrometheusParaHelio() {
  const painel = carregarPainelPrometheus();
  const hojeISO = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd');
  const qtd = painel.arquivosDrive.length;
  const amostra = painel.arquivosDrive
    .slice(0, 5)
    .map(a => `[${a.setor}] ${a.nome} (${a.url})`)
    .join(' | ');

  const texto = qtd > 0
    ? `[${hojeISO}] [SYNC MANUAL HUB]: ${qtd} documento(s) monitorado(s) nas pastas 2026. Destaques: ${amostra}`
    : `[${hojeISO}] [SYNC MANUAL HUB]: Verificação manual concluída. Nenhum novo PDF FEMURN nas pastas 2026.`;

  registrarAlertaMemoriaOlympos('_memoria_helio.md', texto);
  return {
    ok: true,
    status: 'OK',
    mensagem: 'Memória de Hélio (_memoria_helio.md) sincronizada com sucesso!',
    totalMonitorados: qtd
  };
}

/**
 * Ponte Bidirecional GAS ➔ GitHub Actions:
 * Dispara remotamente um workflow_dispatch no repositório unificado do Hub Olympos
 * quando GITHUB_PAT e GITHUB_REPO estiverem configurados nas Script Properties.
 */
function dispararWorkflowGitHubOlympos_(workflowFileName, inputsObj) {
  const props = PropertiesService.getScriptProperties();
  const pat = String(props.getProperty('GITHUB_PAT') || '').trim();
  const repo = String(props.getProperty('GITHUB_REPO') || '').trim();
  const branch = String(props.getProperty('GITHUB_REF') || 'main').trim();

  if (!pat || !repo) {
    return {
      ok: true,
      disparadoRemotamente: false,
      configurado: false,
      workflow: workflowFileName,
      mensagem: 'Integração pronta no código. Para disparo 1-clique direto pelo Hub, defina GITHUB_REPO (ex: usuario/olympos-smeb) e GITHUB_PAT nas Script Properties do GAS, ou acione via aba Actions no GitHub.'
    };
  }

  const endpoint = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFileName}/dispatches`;
  const resp = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({
      ref: branch,
      inputs: inputsObj || {}
    }),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code === 204 || code === 200) {
    return {
      ok: true,
      disparadoRemotamente: true,
      configurado: true,
      workflow: workflowFileName,
      repo: repo,
      urlActions: `https://github.com/${repo}/actions`,
      mensagem: `Execução remota iniciada no GitHub Actions (${workflowFileName} em ${repo}@${branch}). Os resultados chegarão ao Hub em instantes.`
    };
  }

  return {
    ok: false,
    disparadoRemotamente: false,
    configurado: true,
    statusHttp: code,
    mensagem: `GitHub API respondeu HTTP ${code}: ${String(resp.getContentText() || '').substring(0, 180)}`
  };
}

/**
 * Dispara sob demanda o Fogo de Prometheus (GitHub Actions -> Webhook GAS Hub Olympos).
 */
function dispararColetaPrometheusRemota(dataInicio, dataFim) {
  const inputs = {};
  if (dataInicio) inputs.data_inicio = String(dataInicio).trim();
  if (dataFim) inputs.data_fim = String(dataFim).trim();
  return dispararWorkflowGitHubOlympos_('fogo_prometheus_cron.yml', inputs);
}

/**
 * Carrega o painel ao vivo de O Papiro de Cadmo inspecionando a pasta oficial de CSVs consolidados
 * e fornecendo os links oficiais (sem expor IDs técnicos na interface).
 */
function carregarPainelPapiroCadmo() {
  const props = PropertiesService.getScriptProperties();
  const repo = String(props.getProperty('GITHUB_REPO') || '').trim();
  const temGitHubBridge = Boolean(props.getProperty('GITHUB_PAT') && repo);
  const arquivosCsv = [];

  try {
    const folder = DriveApp.getFolderById(OLYMPOS_IDS.SUBPROJETOS.PAPIRO_CADMO_PASTA);
    const files = folder.getFiles();
    let count = 0;
    while (files.hasNext() && count < 25) {
      const f = files.next();
      const nome = f.getName();
      if (nome.toLowerCase().endsWith('.csv') || nome.toLowerCase().includes('servidores-intermunicipais')) {
        const mComp = nome.match(/(20\d{2}-\d{2})/);
        arquivosCsv.push({
          nome: nome,
          competencia: mComp ? mComp[1] : 'Consolidado',
          dataCriacao: Utilities.formatDate(f.getDateCreated(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm'),
          timestamp: f.getDateCreated().getTime(),
          tamanhoKb: Math.max(1, Math.round((f.getSize ? f.getSize() : 1024) / 1024)),
          url: f.getUrl()
        });
        count++;
      }
    }
  } catch (e) {
    console.warn('Aviso ao inspecionar pasta do Papiro de Cadmo:', e);
  }

  arquivosCsv.sort((a, b) => b.timestamp - a.timestamp);

  return {
    pastaConsolidadaUrl: OLYMPOS_IDS.LINKS_OFICIAIS_UI.pastaPapiroCadmo,
    planilhaPermutasUrl: OLYMPOS_IDS.LINKS_OFICIAIS_UI.planilhaPermutas,
    workflowConfigurado: temGitHubBridge,
    urlGitHubActions: repo ? `https://github.com/${repo}/actions` : '',
    ultimaCompetencia: arquivosCsv.length > 0 ? arquivosCsv[0].competencia : 'Aguardando 1º ciclo mensal (Dia 12)',
    ultimoUploadEm: arquivosCsv.length > 0 ? arquivosCsv[0].dataCriacao : '--',
    totalArquivosCsv: arquivosCsv.length,
    arquivosCsv: arquivosCsv.slice(0, 12)
  };
}

/**
 * Dispara sob demanda o ETL mensal O Papiro de Cadmo via GitHub Actions.
 */
function dispararColetaPapiroCadmoRemota(competencia, filtroEnte) {
  const inputs = {};
  if (competencia) inputs.competencia = String(competencia).trim();
  if (filtroEnte) inputs.filtro_ente = String(filtroEnte).trim();
  return dispararWorkflowGitHubOlympos_('papiro_cadmo_mensal.yml', inputs);
}
