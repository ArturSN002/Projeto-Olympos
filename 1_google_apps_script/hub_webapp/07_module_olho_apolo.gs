/**
 * @fileoverview Módulo 4 — Olho de Apolo & Gerenciador de Contadores/Parâmetros em Arquivo .md no Google Drive.
 * Fonte da Verdade: _memoria_apolo (ID Oficial: 1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_) na pasta 00_Memorias_MD (1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu).
 * Valores Iniciais Oficiais 2026: Próximo Ofício = 155 (Último = 154) | Próxima Portaria = 163 (Última = 162).
 */

const APOLO_PROP_CACHE_KEY = 'OLHO_APOLO_LAST_NUMBERS_2026';

/**
 * Retorna os valores piso/padrão de 2026 definidos em OLYMPOS_IDS.ESTADO_GLOBAL_MD.
 */
function obterPisoPadraoApolo2026_() {
  const cfg = (typeof OLYMPOS_IDS !== 'undefined' && OLYMPOS_IDS.ESTADO_GLOBAL_MD && OLYMPOS_IDS.ESTADO_GLOBAL_MD.PISO_INICIAL_2026) || {};
  return {
    proximoOficio2026: parseInt(cfg.proximoOficio2026, 10) || 155,
    ultimoOficio2026: parseInt(cfg.ultimoOficio2026, 10) || 154,
    proximaPortaria2026: parseInt(cfg.proximaPortaria2026, 10) || 163,
    ultimaPortaria2026: parseInt(cfg.ultimaPortaria2026, 10) || 162,
    proximoMemorando2026: parseInt(cfg.proximoMemorando2026, 10) || 1,
    proximoParecerJuridico2026: parseInt(cfg.proximoParecerJuridico2026, 10) || 1,
    proximoEditalPss2026: parseInt(cfg.proximoEditalPss2026, 10) || 1,
    signatarioTitular: cfg.signatarioTitular || 'Secretário(a) Municipal de Educação Básica',
    cargoSignatario: cfg.cargoSignatario || 'Secretário(a) Municipal de Educação Básica',
    anoExercicioAtivo: cfg.anoExercicioAtivo || '2026'
  };
}

/**
 * Localiza o arquivo .md vinculado para armazenar a numeração de Ofícios, Portarias e Parâmetros Globais.
 * Prioriza ScriptProperty 'OLYMPOS_CONTADORES_MD_ID', depois OLYMPOS_IDS.ESTADO_GLOBAL_MD.ARQUIVO_CONTADORES_ID (1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_).
 */
function obterArquivoContadoresMdApolo_() {
  let idAlvo = '';
  try {
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
      idAlvo = String(PropertiesService.getScriptProperties().getProperty('OLYMPOS_CONTADORES_MD_ID') || '').trim();
    }
  } catch (e) {}

  if (!idAlvo && typeof OLYMPOS_IDS !== 'undefined' && OLYMPOS_IDS.ESTADO_GLOBAL_MD) {
    idAlvo = OLYMPOS_IDS.ESTADO_GLOBAL_MD.ARQUIVO_CONTADORES_ID;
  }
  if (!idAlvo) {
    idAlvo = '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_';
  }

  if (idAlvo && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
    try {
      const arq = DriveApp.getFileById(idAlvo);
      if (arq) return arq;
    } catch (e) {}
  }

  if (typeof obterArquivoMemoriaDireto_ === 'function') {
    const fallbackArq = obterArquivoMemoriaDireto_('_memoria_apolo.md');
    if (fallbackArq) return fallbackArq;
  }

  return null;
}

/**
 * Extrai os contadores e parâmetros estruturados da seção "## 1. Estado Atual e Contadores Ativos (2026)"
 * do conteúdo textual do arquivo .md no Google Drive.
 */
function extrairEstadoNumeracaoDeTextoMd_(conteudoMd) {
  const piso = obterPisoPadraoApolo2026_();
  const texto = String(conteudoMd || '');
  let encontrouChavesNumeracao = false;

  function lerInteiro(regexList, valorDefault) {
    for (let i = 0; i < regexList.length; i++) {
      const m = texto.match(regexList[i]);
      if (m && m[1]) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n >= 0 && n < 50000) {
          encontrouChavesNumeracao = true;
          return n;
        }
      }
    }
    return valorDefault;
  }

  function lerTexto(regexList, valorDefault) {
    for (let i = 0; i < regexList.length; i++) {
      const m = texto.match(regexList[i]);
      if (m && m[1] && m[1].trim()) {
        return m[1].trim();
      }
    }
    return valorDefault;
  }

  const proximoOficio2026 = lerInteiro(
    [
      /Proximo_Oficio_2026\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i,
      /Pr[oó]ximo\s+Of[ií]cio(?:\s+2026)?\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i
    ],
    piso.proximoOficio2026
  );

  const ultimoOficio2026 = lerInteiro(
    [
      /Ultimo_Oficio_2026\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i,
      /[UÚ]ltimo\s+Of[ií]cio(?:\s+2026)?\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i
    ],
    Math.max(0, proximoOficio2026 - 1)
  );

  const proximaPortaria2026 = lerInteiro(
    [
      /Proxima_Portaria_2026\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i,
      /Pr[oó]xima\s+Portaria(?:\s+2026)?\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i
    ],
    piso.proximaPortaria2026
  );

  const ultimaPortaria2026 = lerInteiro(
    [
      /Ultima_Portaria_2026\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i,
      /[UÚ]ltima\s+Portaria(?:\s+2026)?\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i
    ],
    Math.max(0, proximaPortaria2026 - 1)
  );

  const proximoMemorando2026 = lerInteiro(
    [/Proximo_Memorando_2026\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i],
    piso.proximoMemorando2026
  );

  const proximoParecerJuridico2026 = lerInteiro(
    [/Proximo_Parecer_Juridico_2026\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i],
    piso.proximoParecerJuridico2026
  );

  const proximoEditalPss2026 = lerInteiro(
    [/Proximo_Edital_PSS_2026\s*:\s*(?:n?[º°]?\s*)?(\d{1,5})/i],
    piso.proximoEditalPss2026
  );

  const signatarioTitular = lerTexto(
    [/Signatario_Titular_SMEB\s*:\s*([^\n\r]+)/i],
    piso.signatarioTitular
  );

  const cargoSignatario = lerTexto(
    [/Cargo_Signatario_SMEB\s*:\s*([^\n\r]+)/i],
    piso.cargoSignatario
  );

  const anoExercicioAtivo = lerTexto(
    [/Ano_Exercicio_Ativo\s*:\s*([^\n\r]+)/i],
    piso.anoExercicioAtivo
  );

  return {
    encontrouChavesNoMd: encontrouChavesNumeracao,
    proximoOficio2026: proximoOficio2026,
    ultimoOficio2026: proximoOficio2026 > 0 ? proximoOficio2026 - 1 : ultimoOficio2026,
    proximaPortaria2026: proximaPortaria2026,
    ultimaPortaria2026: proximaPortaria2026 > 0 ? proximaPortaria2026 - 1 : ultimaPortaria2026,
    proximoMemorando2026: proximoMemorando2026,
    proximoParecerJuridico2026: proximoParecerJuridico2026,
    proximoEditalPss2026: proximoEditalPss2026,
    signatarioTitular: signatarioTitular,
    cargoSignatario: cargoSignatario,
    anoExercicioAtivo: anoExercicioAtivo
  };
}

/**
 * Atualiza a seção "## 1. Estado Atual e Contadores Ativos (2026)" dentro de _memoria_apolo.md
 * (ID: 1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_) preservando alertas e pendências e registrando trilha no Rolling Log.
 */
function gravarEstadoNumeracaoNoArquivoMd_(novosValores, notaHistoricoOpt) {
  const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');
  let arquivo = obterArquivoContadoresMdApolo_();
  const estadoAtual = Object.assign(obterPisoPadraoApolo2026_(), novosValores || {});

  estadoAtual.proximoOficio2026 = parseInt(estadoAtual.proximoOficio2026, 10) || 155;
  estadoAtual.ultimoOficio2026 = Math.max(0, estadoAtual.proximoOficio2026 - 1);
  estadoAtual.proximaPortaria2026 = parseInt(estadoAtual.proximaPortaria2026, 10) || 163;
  estadoAtual.ultimaPortaria2026 = Math.max(0, estadoAtual.proximaPortaria2026 - 1);
  estadoAtual.proximoMemorando2026 = parseInt(estadoAtual.proximoMemorando2026, 10) || 1;
  estadoAtual.proximoParecerJuridico2026 = parseInt(estadoAtual.proximoParecerJuridico2026, 10) || 1;
  estadoAtual.proximoEditalPss2026 = parseInt(estadoAtual.proximoEditalPss2026, 10) || 1;

  const blocoEstado = [
    '## 1. Estado Atual e Contadores Ativos (2026)',
    '- Status_Setor: Ativo',
    `- Proximo_Oficio_2026: ${estadoAtual.proximoOficio2026}`,
    `- Ultimo_Oficio_2026: ${estadoAtual.ultimoOficio2026}`,
    `- Proxima_Portaria_2026: ${estadoAtual.proximaPortaria2026}`,
    `- Ultima_Portaria_2026: ${estadoAtual.ultimaPortaria2026}`,
    `- Proximo_Memorando_2026: ${estadoAtual.proximoMemorando2026}`,
    `- Proximo_Parecer_Juridico_2026: ${estadoAtual.proximoParecerJuridico2026}`,
    `- Proximo_Edital_PSS_2026: ${estadoAtual.proximoEditalPss2026}`,
    `- Signatario_Titular_SMEB: ${estadoAtual.signatarioTitular}`,
    `- Cargo_Signatario_SMEB: ${estadoAtual.cargoSignatario}`,
    `- Ano_Exercicio_Ativo: ${estadoAtual.anoExercicioAtivo}`
  ];

  if (!arquivo && typeof obterOuCriarPastaMemoriasOlympos === 'function') {
    // Tenta pelo ID fixo oficial sem criar arquivos duplicados
    try {
      arquivo = DriveApp.getFileById('1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_');
    } catch (e) {
      console.error('Falha crítica ao recuperar arquivo de contadores Apolo por ID fixo:', e);
    }
  }

  if (arquivo) {
    let conteudo = typeof lerConteudoMemoria_ === 'function' ? lerConteudoMemoria_(arquivo) : '';
    if (!conteudo || !conteudo.trim()) {
      conteudo = criarConteudoInicialMemoria_('_memoria_apolo.md', null, agora);
    }

    const linhas = conteudo.split('\n');
    const novasLinhas = [];
    let dentroSecao1 = false;
    let inseriuSecao1 = false;

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (linha.startsWith('Atualizado em:')) {
        novasLinhas.push(`Atualizado em: ${agora}`);
        continue;
      }
      if (linha.startsWith('## 1.')) {
        dentroSecao1 = true;
        inseriuSecao1 = true;
        blocoEstado.forEach(b => novasLinhas.push(b));
        novasLinhas.push('');
        continue;
      }
      if (dentroSecao1) {
        if (linha.startsWith('## 2.') || linha.startsWith('## 3.')) {
          dentroSecao1 = false;
        } else {
          continue;
        }
      }
      novasLinhas.push(linha);
      if (notaHistoricoOpt && linha.startsWith('## 3.')) {
        novasLinhas.push(`- [${agora}] ${notaHistoricoOpt}`);
      }
    }

    if (!inseriuSecao1) {
      novasLinhas.push('');
      blocoEstado.forEach(b => novasLinhas.push(b));
    }

    const textoFinal = novasLinhas.slice(0, 60).join('\n');
    if (typeof gravarConteudoMemoria_ === 'function') {
      gravarConteudoMemoria_(arquivo, textoFinal);
    } else if (typeof arquivo.setContent === 'function') {
      arquivo.setContent(textoFinal);
    }
  }

  const resultado = {
    arquivoId: arquivo && typeof arquivo.getId === 'function' ? arquivo.getId() : '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_',
    arquivoUrl: arquivo && typeof arquivo.getUrl === 'function' ? arquivo.getUrl() : 'https://drive.google.com/file/d/1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_/view',
    ultimoOficio2026: estadoAtual.ultimoOficio2026,
    proximoOficio2026: estadoAtual.proximoOficio2026,
    ultimaPortaria2026: estadoAtual.ultimaPortaria2026,
    proximaPortaria2026: estadoAtual.proximaPortaria2026,
    proximoMemorando2026: estadoAtual.proximoMemorando2026,
    proximoParecerJuridico2026: estadoAtual.proximoParecerJuridico2026,
    proximoEditalPss2026: estadoAtual.proximoEditalPss2026,
    signatarioTitular: estadoAtual.signatarioTitular,
    cargoSignatario: estadoAtual.cargoSignatario,
    anoExercicioAtivo: estadoAtual.anoExercicioAtivo,
    sincronizadoEm: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss')
  };

  try {
    PropertiesService.getScriptProperties().setProperty(APOLO_PROP_CACHE_KEY, JSON.stringify(resultado));
  } catch (e) {}

  return resultado;
}

/**
 * Lê o estado atual de numeração diretamente do arquivo .md no Google Drive (1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_).
 * Se o arquivo ainda não contiver as chaves de numeração 2026, inicializa com Ofício 155 e Portaria 163.
 */
function lerEstadoNumeracaoDoArquivoMd_() {
  const arquivo = obterArquivoContadoresMdApolo_();
  if (!arquivo) {
    return Object.assign(obterPisoPadraoApolo2026_(), {
      arquivoId: '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_',
      arquivoUrl: 'https://drive.google.com/file/d/1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_/view',
      sincronizadoEm: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss')
    });
  }

  const conteudo = typeof lerConteudoMemoria_ === 'function' ? lerConteudoMemoria_(arquivo) : '';
  const extraido = extrairEstadoNumeracaoDeTextoMd_(conteudo);

  if (!extraido.encontrouChavesNoMd) {
    return gravarEstadoNumeracaoNoArquivoMd_(
      extraido,
      'Contadores 2026 inicializados no .md (Próximo Ofício: 155 | Próxima Portaria: 163).'
    );
  }

  const resultado = {
    arquivoId: typeof arquivo.getId === 'function' ? arquivo.getId() : '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_',
    arquivoUrl: typeof arquivo.getUrl === 'function' ? arquivo.getUrl() : 'https://drive.google.com/file/d/1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_/view',
    ultimoOficio2026: extraido.ultimoOficio2026,
    proximoOficio2026: extraido.proximoOficio2026,
    ultimaPortaria2026: extraido.ultimaPortaria2026,
    proximaPortaria2026: extraido.proximaPortaria2026,
    proximoMemorando2026: extraido.proximoMemorando2026,
    proximoParecerJuridico2026: extraido.proximoParecerJuridico2026,
    proximoEditalPss2026: extraido.proximoEditalPss2026,
    signatarioTitular: extraido.signatarioTitular,
    cargoSignatario: extraido.cargoSignatario,
    anoExercicioAtivo: extraido.anoExercicioAtivo,
    sincronizadoEm: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss')
  };

  try {
    PropertiesService.getScriptProperties().setProperty(APOLO_PROP_CACHE_KEY, JSON.stringify(resultado));
  } catch (e) {}

  return resultado;
}

/**
 * Varre automaticamente as pastas Ofícios de 2026 e Portarias de 2026,
 * reconcilia de forma inteligente (Smart Reconcile — sem regredir valores manuais já salvos no .md)
 * e atualiza _memoria_apolo.md (1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_).
 */
function sincronizarNumeracaoApolo2026() {
  const piso = obterPisoPadraoApolo2026_();
  const estadoMd = lerEstadoNumeracaoDoArquivoMd_();

  const maxOficioPasta = detectarMaiorNumeroNaPasta(
    OLYMPOS_IDS.SETORES_2026.OFICIOS,
    /of[ií]cio[\s_\-]*n?[º°]?[\s_\-]*(\d{1,4})/i
  );
  const maxPortariaPasta = detectarMaiorNumeroNaPasta(
    OLYMPOS_IDS.SETORES_2026.PORTARIAS,
    /portaria[\s_\-]*n?[º°]?[\s_\-]*(\d{1,4})/i
  );

  // Smart Reconcile: Nunca regride abaixo do valor registrado manualmente no .md nem do piso inicial (155 / 163),
  // mas avança automaticamente caso novos arquivos tenham sido adicionados nas pastas de 2026.
  const proximoOficioReconciliado = Math.max(
    estadoMd.proximoOficio2026 || piso.proximoOficio2026,
    maxOficioPasta + 1,
    piso.proximoOficio2026
  );
  const proximaPortariaReconciliada = Math.max(
    estadoMd.proximaPortaria2026 || piso.proximaPortaria2026,
    maxPortariaPasta + 1,
    piso.proximaPortaria2026
  );

  const resumo = `Sincronizado (Drive + .md) -> Próximo Ofício 2026: nº ${proximoOficioReconciliado} (Último: ${proximoOficioReconciliado - 1}) | Próxima Portaria 2026: nº ${proximaPortariaReconciliada} (Última: ${proximaPortariaReconciliada - 1})`;

  const novoEstado = Object.assign({}, estadoMd, {
    proximoOficio2026: proximoOficioReconciliado,
    ultimoOficio2026: proximoOficioReconciliado - 1,
    proximaPortaria2026: proximaPortariaReconciliada,
    ultimaPortaria2026: proximaPortariaReconciliada - 1
  });

  return gravarEstadoNumeracaoNoArquivoMd_(novoEstado, `[OLHO DE APOLO]: ${resumo}`);
}

/**
 * Retorna a numeração lendo prioritariamente o arquivo .md no Google Drive (1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_)
 * para refletir imediatamente qualquer edição manual feita pelo usuário no arquivo .md ou no Hub.
 * Se forcarVarredura = true, varre também as pastas do Drive e reconcilia.
 */
function obterOuSincronizarNumeracaoApolo(forcarVarredura) {
  if (forcarVarredura) {
    return sincronizarNumeracaoApolo2026();
  }
  return lerEstadoNumeracaoDoArquivoMd_();
}

/**
 * Permite ao usuário ajustar manualmente o Próximo Número de Ofício, Portaria (ou outros contadores e Signatário)
 * diretamente pelo Hub Olympos, gravando o novo valor no arquivo .md (1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_).
 * @param {string} tipoDocumento 'OFICIO', 'PORTARIA', 'MEMORANDO', 'PARECER', 'EDITAL_PSS' ou 'GERAL'.
 * @param {number|Object} novoValor Número inteiro do próximo ato ou objeto completo de parâmetros.
 * @param {string} [motivoOpt] Observação opcional (ex.: "Ofício 155 emitido manualmente para SINFRA").
 */
function atualizarContadorManualApolo(tipoDocumento, novoValor, motivoOpt) {
  const estadoAtual = lerEstadoNumeracaoDoArquivoMd_();
  const tipo = String(tipoDocumento || '').trim().toUpperCase();
  const motivo = String(motivoOpt || 'Ajuste manual pelo Hub Olympos').trim();
  let descricaoLog = '';

  if (typeof novoValor === 'object' && novoValor !== null) {
    if (novoValor.proximoOficio2026 !== undefined) {
      const nOf = parseInt(novoValor.proximoOficio2026, 10);
      if (!isNaN(nOf) && nOf > 0) estadoAtual.proximoOficio2026 = nOf;
    }
    if (novoValor.proximaPortaria2026 !== undefined) {
      const nPt = parseInt(novoValor.proximaPortaria2026, 10);
      if (!isNaN(nPt) && nPt > 0) estadoAtual.proximaPortaria2026 = nPt;
    }
    if (novoValor.proximoMemorando2026 !== undefined) {
      const nMem = parseInt(novoValor.proximoMemorando2026, 10);
      if (!isNaN(nMem) && nMem > 0) estadoAtual.proximoMemorando2026 = nMem;
    }
    if (novoValor.proximoParecerJuridico2026 !== undefined) {
      const nPar = parseInt(novoValor.proximoParecerJuridico2026, 10);
      if (!isNaN(nPar) && nPar > 0) estadoAtual.proximoParecerJuridico2026 = nPar;
    }
    if (novoValor.proximoEditalPss2026 !== undefined) {
      const nEd = parseInt(novoValor.proximoEditalPss2026, 10);
      if (!isNaN(nEd) && nEd > 0) estadoAtual.proximoEditalPss2026 = nEd;
    }
    if (novoValor.signatarioTitular) {
      estadoAtual.signatarioTitular = String(novoValor.signatarioTitular).trim();
    }
    if (novoValor.cargoSignatario) {
      estadoAtual.cargoSignatario = String(novoValor.cargoSignatario).trim();
    }
    descricaoLog = `[AJUSTE MANUAL .MD]: Ofício -> nº ${estadoAtual.proximoOficio2026} | Portaria -> nº ${estadoAtual.proximaPortaria2026} (${motivo})`;
  } else {
    const num = parseInt(novoValor, 10);
    if (isNaN(num) || num < 1 || num > 50000) {
      throw new Error('Informe um número sequencial válido maior que zero.');
    }
    if (tipo === 'OFICIO') {
      estadoAtual.proximoOficio2026 = num;
      descricaoLog = `[AJUSTE MANUAL .MD]: Próximo Ofício 2026 definido para nº ${num} (${motivo})`;
    } else if (tipo === 'PORTARIA') {
      estadoAtual.proximaPortaria2026 = num;
      descricaoLog = `[AJUSTE MANUAL .MD]: Próxima Portaria 2026 definida para nº ${num} (${motivo})`;
    } else if (tipo === 'MEMORANDO') {
      estadoAtual.proximoMemorando2026 = num;
      descricaoLog = `[AJUSTE MANUAL .MD]: Próximo Memorando 2026 definido para nº ${num} (${motivo})`;
    } else if (tipo === 'PARECER') {
      estadoAtual.proximoParecerJuridico2026 = num;
      descricaoLog = `[AJUSTE MANUAL .MD]: Próximo Parecer Jurídico 2026 definido para nº ${num} (${motivo})`;
    } else if (tipo === 'EDITAL_PSS') {
      estadoAtual.proximoEditalPss2026 = num;
      descricaoLog = `[AJUSTE MANUAL .MD]: Próximo Edital PSS 2026 definido para nº ${num} (${motivo})`;
    } else {
      throw new Error(`Tipo de contador desconhecido: ${tipo}`);
    }
  }

  return gravarEstadoNumeracaoNoArquivoMd_(estadoAtual, descricaoLog);
}

/**
 * Reserva atomicamente o número atual de Ofício ou Portaria (para uso manual imediato ou automação),
 * incrementa o contador em +1 no arquivo .md (1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_) e retorna o número reservado.
 * @param {string} tipoDocumento 'OFICIO' ou 'PORTARIA'.
 * @param {string} [assuntoOuDestinatario] Identificação opcional do documento que consumiu o número.
 */
function reservarProximoNumeroDocumentoApolo(tipoDocumento, assuntoOuDestinatario) {
  const estadoAtual = lerEstadoNumeracaoDoArquivoMd_();
  const tipo = String(tipoDocumento || '').trim().toUpperCase();
  const detalhe = String(assuntoOuDestinatario || 'Emissão avulsa/manual').trim();
  let numeroReservado = 0;
  let proximoAposReserva = 0;

  if (tipo === 'OFICIO') {
    numeroReservado = estadoAtual.proximoOficio2026;
    proximoAposReserva = numeroReservado + 1;
    estadoAtual.proximoOficio2026 = proximoAposReserva;
  } else if (tipo === 'PORTARIA') {
    numeroReservado = estadoAtual.proximaPortaria2026;
    proximoAposReserva = numeroReservado + 1;
    estadoAtual.proximaPortaria2026 = proximoAposReserva;
  } else {
    throw new Error(`Tipo inválido para reserva rápida: ${tipo}`);
  }

  const logReserva = `[RESERVA Nº ${numeroReservado}/2026 - ${tipo}]: Utilizado para "${detalhe}". Próximo disponível no .md: nº ${proximoAposReserva}.`;
  const estadoSalvo = gravarEstadoNumeracaoNoArquivoMd_(estadoAtual, logReserva);

  return {
    tipo: tipo,
    numeroReservado: numeroReservado,
    numeroFormatado: `${String(numeroReservado).padStart(3, '0')}/2026`,
    proximoDisponivel: proximoAposReserva,
    detalhe: detalhe,
    numeracaoAtualizada: estadoSalvo
  };
}

function detectarMaiorNumeroNaPasta(folderId, regexPadrao) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  let maior = 0;

  while (files.hasNext()) {
    const file = files.next();
    const nome = file.getName();
    // Ignorar documentos antigos (2020-2025) caso tenham sido movidos por engano para a pasta 2026
    if (/[\/_\-]202[0-5]\b/.test(nome)) continue;
    const match = nome.match(regexPadrao);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maior && num < 5000) {
        maior = num;
      }
    }
  }
  return maior;
}
