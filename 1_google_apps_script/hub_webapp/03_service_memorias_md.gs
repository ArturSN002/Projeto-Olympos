/**
 * @fileoverview Serviço de Governança das Memórias Operacionais .md das Personas Olympos.
 * Versão 3.0.0 — Resolução Canônica, Auto-Cicatrização, Mutex LockService e Deduplicação Ativa.
 */

/**
 * Obtém diretamente a pasta 00_Memorias_MD pelo ID oficial (1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu).
 */
function obterOuCriarPastaMemoriasOlympos() {
  if (OLYMPOS_IDS.PASTA_MEMORIAS_MD) {
    try {
      const pastaMemDireta = DriveApp.getFolderById(OLYMPOS_IDS.PASTA_MEMORIAS_MD);
      if (pastaMemDireta) return pastaMemDireta;
    } catch (e) {
      console.warn('Falha ao abrir pasta de memórias por ID direto:', e);
    }
  }

  if (OLYMPOS_IDS.PASTA_OLYMPO) {
    try {
      const pastaOlympo = DriveApp.getFolderById(OLYMPOS_IDS.PASTA_OLYMPO);
      if (pastaOlympo) {
        const itMem = pastaOlympo.getFoldersByName('00_Memorias_MD');
        return itMem.hasNext() ? itMem.next() : pastaOlympo.createFolder('00_Memorias_MD');
      }
    } catch (e) {}
  }

  const raiz = DriveApp.getFolderById(OLYMPOS_IDS.RAIZ_SMEB);
  const itOlympo = raiz.getFoldersByName('Olympo');
  const pastaOlympos = itOlympo.hasNext() ? itOlympo.next() : raiz.createFolder('Olympo');
  const itMem = pastaOlympos.getFoldersByName('00_Memorias_MD');
  return itMem.hasNext() ? itMem.next() : pastaOlympos.createFolder('00_Memorias_MD');
}

/**
 * Normaliza qualquer variação de entrada para o slug canônico (ex: '_memoria_zeus.md', 'Zeus', '_memoria_dionísio' -> 'zeus', 'dionisio').
 * @param {string} nomeOuSlug
 * @return {string} Slug limpo em minúsculas sem prefixos, extensões ou diacríticos
 */
function extrairSlugMemoria_(nomeOuSlug) {
  if (!nomeOuSlug) return '';
  return String(nomeOuSlug)
    .trim()
    .toLowerCase()
    .replace(/^_+memoria_+/, '')
    .replace(/\.md$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Obtém ou resolve o arquivo de memória canônico único de uma persona.
 * NUNCA gera duplicatas. Resolve deterministicamente por:
 * 1. Cache ScriptProperties (MEMORIA_ID_<slug>) -> O(1)
 * 2. ID Fixo em OLYMPOS_IDS.MAPA_MEMORIAS_ID -> O(1)
 * 3. LockService (Mutex 15s) para evitar race conditions
 * 4. Double-check do cache sob lock
 * 5. Varredura na pasta 00_Memorias_MD por arquivos correspondentes
 * 6. Se múltiplos: elege o canônico (tamanho de bytes/mais recente), renomeia para canônico e move duplicatas para a lixeira
 * 7. Se zero: cria uma única vez sob lock
 * 8. Grava ID canônico no ScriptProperties ('MEMORIA_ID_' + slug)
 * 9. Libera o lock e retorna o arquivo canônico
 *
 * @param {string} nomeOuSlug Ex: '_memoria_zeus.md', 'zeus', '_memoria_apolo'
 * @return {GoogleAppsScript.Drive.File} Arquivo canônico definitivo no Google Drive
 */
function obterArquivoMemoriaCanonico_(nomeOuSlug) {
  const chaveOriginal = String(nomeOuSlug || '').trim();
  const slug = extrairSlugMemoria_(chaveOriginal);
  if (!slug) {
    throw new Error('Identificador de memória inválido ou vazio: ' + chaveOriginal);
  }

  const nomePadrao = `_memoria_${slug}.md`;
  const propKey = `MEMORIA_ID_${slug}`;
  const propKeyUpper = `MEMORIA_ID_${slug.toUpperCase()}`;
  let props = null;

  try {
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
      props = PropertiesService.getScriptProperties();
    }
  } catch (eProps) {
    console.warn('[Memórias] ScriptProperties indisponível:', eProps);
  }

  // 1. TENTATIVA PRIORITÁRIA POR ID ESTÁTICO CANÔNICO EM OLYMPOS_IDS.MAPA_MEMORIAS_ID (O(1))
  const mapa = (typeof OLYMPOS_IDS !== 'undefined' && OLYMPOS_IDS.MAPA_MEMORIAS_ID) || {};
  const idEstatico = mapa[slug] || mapa[nomePadrao] || mapa[`_memoria_${slug}`] || mapa[chaveOriginal];

  if (idEstatico && typeof idEstatico === 'string' && idEstatico.trim() !== '') {
    if (typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
      try {
        const arqEst = DriveApp.getFileById(idEstatico.trim());
        if (arqEst && !arqEst.isTrashed()) {
          if (props) {
            try {
              props.setProperty(propKey, arqEst.getId());
              props.setProperty(propKeyUpper, arqEst.getId());
              props.setProperty(`OLYMPOS_MEMORIA_ID_${slug.toUpperCase()}`, arqEst.getId());
            } catch (eSet) {}
          }
          return arqEst;
        }
      } catch (e) {
        console.warn(`[Memórias] ID estático para ${slug} (${idEstatico}) falhou ou não existe no Drive:`, e);
      }
    }
  }

  // 2. TENTATIVA POR CACHE DINÂMICO EM SCRIPT PROPERTIES (O(1))
  if (props) {
    let idCache = props.getProperty(propKey) || props.getProperty(propKeyUpper) || props.getProperty(`OLYMPOS_MEMORIA_ID_${slug.toUpperCase()}`);
    if (idCache && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
      try {
        const arqCache = DriveApp.getFileById(idCache);
        if (arqCache && !arqCache.isTrashed()) {
          return arqCache;
        }
      } catch (e) {
        console.warn(`[Memórias] ID em cache para ${slug} (${idCache}) inválido ou inacessível. Limpando cache...`);
        try {
          props.deleteProperty(propKey);
          props.deleteProperty(propKeyUpper);
          props.deleteProperty(`OLYMPOS_MEMORIA_ID_${slug.toUpperCase()}`);
        } catch (eDel) {}
      }
    }
  }

  // 3. MUTEX VIA LOCKSERVICE (Prevenção estrita de Race Conditions e Criação Concorrente)
  let lock = null;
  let temLock = false;
  if (typeof LockService !== 'undefined' && LockService.getScriptLock) {
    try {
      lock = LockService.getScriptLock();
      if (lock && typeof lock.waitLock === 'function') {
        lock.waitLock(15000); // 15 segundos de timeout
        temLock = true;
      }
    } catch (eLock) {
      console.warn(`[Memórias] Timeout ao aguardar lock para ${slug} (15s):`, eLock);
    }
  }

  try {
    // 4. DOUBLE-CHECK DO ID ESTÁTICO E CACHE SOB LOCK
    if (idEstatico && typeof idEstatico === 'string' && idEstatico.trim() !== '' && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
      try {
        const arqEstLock = DriveApp.getFileById(idEstatico.trim());
        if (arqEstLock && !arqEstLock.isTrashed()) {
          return arqEstLock;
        }
      } catch (e) {}
    }
    if (props) {
      const idRecheck = props.getProperty(propKey) || props.getProperty(propKeyUpper) || props.getProperty(`OLYMPOS_MEMORIA_ID_${slug.toUpperCase()}`);
      if (idRecheck && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
        try {
          const arqRecheck = DriveApp.getFileById(idRecheck);
          if (arqRecheck && !arqRecheck.isTrashed()) {
            return arqRecheck;
          }
        } catch (e) {}
      }
    }

    // 5. VARREDURA NA PASTA 00_Memorias_MD POR MATCHES EXATOS E VARIANTES
    const pastaMem = obterOuCriarPastaMemoriasOlympos();
    const candidatos = [];
    const idsVistos = {};

    if (pastaMem && typeof pastaMem.getFilesByName === 'function') {
      const variantesBusca = [
        nomePadrao,
        `_memoria_${slug}`,
        slug,
        chaveOriginal
      ];

      variantesBusca.forEach(termo => {
        if (!termo) return;
        try {
          const it = pastaMem.getFilesByName(termo);
          while (it && it.hasNext()) {
            const f = it.next();
            if (f && !f.isTrashed()) {
              const fid = f.getId();
              if (!idsVistos[fid]) {
                idsVistos[fid] = true;
                candidatos.push(f);
              }
            }
          }
        } catch (eBusca) {
          console.warn(`[Memórias] Erro ao buscar filesByName(${termo}):`, eBusca);
        }
      });
    }

    let arquivoCanonico = null;

    // 6. TRATAMENTO DE CANDIDATOS ENCONTRADOS
    if (candidatos.length === 1) {
      arquivoCanonico = candidatos[0];
      try {
        if (typeof arquivoCanonico.setName === 'function' && arquivoCanonico.getName() !== nomePadrao) {
          arquivoCanonico.setName(nomePadrao);
        }
      } catch (eRen) {}
    } else if (candidatos.length > 1) {
      // DEDUPLICAÇÃO ATIVA E EXPURGO DE DUPLICATAS ÓRFÃS
      console.warn(`[Memórias] DUPLICAÇÃO DETECTADA: ${candidatos.length} arquivos para a persona ${slug}. Iniciando eleição canônica e higienização...`);

      // Ranking: Maior conteúdo (tamanho em bytes) > Mais recentemente atualizado
      candidatos.sort((a, b) => {
        let tamA = 0;
        let tamB = 0;
        try { tamA = (typeof a.getSize === 'function') ? a.getSize() : 0; } catch (e) {}
        try { tamB = (typeof b.getSize === 'function') ? b.getSize() : 0; } catch (e) {}
        if (tamB !== tamA) return tamB - tamA;

        let dtA = 0;
        let dtB = 0;
        try { dtA = (typeof a.getLastUpdated === 'function') ? a.getLastUpdated().getTime() : 0; } catch (e) {}
        try { dtB = (typeof b.getLastUpdated === 'function') ? b.getLastUpdated().getTime() : 0; } catch (e) {}
        return dtB - dtA;
      });

      arquivoCanonico = candidatos[0];
      try {
        if (typeof arquivoCanonico.setName === 'function' && arquivoCanonico.getName() !== nomePadrao) {
          arquivoCanonico.setName(nomePadrao);
        }
      } catch (eRen) {}

      // Mover as duplicatas órfãs para a lixeira
      for (let i = 1; i < candidatos.length; i++) {
        const dup = candidatos[i];
        console.warn(`[Memórias] Expurgando duplicata órfã de ${slug}: ID ${dup.getId()} (${dup.getName()})`);
        try {
          if (typeof dup.setName === 'function') {
            dup.setName(`[DUPLICATA_EXPURGADA_${Date.now()}]_${dup.getName()}`);
          }
          if (typeof dup.setTrashed === 'function') {
            dup.setTrashed(true);
          }
        } catch (eTrash) {
          console.error(`Erro ao mover duplicata ${dup.getId()} para a lixeira:`, eTrash);
        }
      }
    } else {
      // 7. CRIAÇÃO OU RESOLUÇÃO POR ID ESTÁTICO SOB LOCK
      if (idEstatico && typeof idEstatico === 'string' && idEstatico.trim() !== '' && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
        try {
          const arqPorIdFixo = DriveApp.getFileById(idEstatico.trim());
          if (arqPorIdFixo && !arqPorIdFixo.isTrashed()) {
            arquivoCanonico = arqPorIdFixo;
          }
        } catch (eFixo) {
          console.warn(`[Memórias] Falha ao recuperar arquivo por ID canônico fixo ${idEstatico}:`, eFixo);
        }
      }

      if (!arquivoCanonico) {
        console.log(`[Memórias] Criando arquivo definitivo canônico para ${slug}: ${nomePadrao}`);
        const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');
        const conteudoInicial = criarConteudoInicialMemoria_(nomePadrao, null, agora);
        arquivoCanonico = pastaMem.createFile(nomePadrao, conteudoInicial, MimeType.PLAIN_TEXT);
      }
    }

    // 8. PERSISTÊNCIA DO ID CANÔNICO EM SCRIPT PROPERTIES
    if (arquivoCanonico && props) {
      try {
        const idCanonico = arquivoCanonico.getId();
        props.setProperty(propKey, idCanonico);
        props.setProperty(propKeyUpper, idCanonico);
        props.setProperty(`OLYMPOS_MEMORIA_ID_${slug.toUpperCase()}`, idCanonico);
      } catch (eSave) {
        console.warn(`[Memórias] Falha ao gravar cache no ScriptProperties para ${slug}:`, eSave);
      }
    }

    return arquivoCanonico;
  } finally {
    // 9. LIBERAÇÃO DO LOCK
    if (temLock && lock && typeof lock.releaseLock === 'function') {
      try {
        lock.releaseLock();
      } catch (eRel) {}
    }
  }
}

/**
 * Localiza o arquivo de memória garantindo canonização, deduplicação e idempotência.
 * Refatorado para delegar diretamente para obterArquivoMemoriaCanonico_(nomeArquivoMd).
 * Mantém assinatura legada (nomeArquivoMd, pastaMemOpt) para compatibilidade retroativa integral.
 *
 * @param {string} nomeArquivoMd Nome do arquivo ou slug da persona
 * @param {GoogleAppsScript.Drive.Folder} [pastaMemOpt] Pasta opcional de memórias
 * @return {GoogleAppsScript.Drive.File|null}
 */
function obterArquivoMemoriaDireto_(nomeArquivoMd, pastaMemOpt) {
  try {
    return obterArquivoMemoriaCanonico_(nomeArquivoMd);
  } catch (err) {
    console.warn(`[Memórias] Falha ao resolver memória canônica para '${nomeArquivoMd}':`, err);

    // Fallback defensivo em caso de exceção no LockService ou ScriptProperties
    const chave = String(nomeArquivoMd || '').trim();
    const chaveSemMd = chave.replace(/\.md$/i, '');
    const chaveComMd = chaveSemMd + '.md';

    const mapaIds = (typeof OLYMPOS_IDS !== 'undefined' && OLYMPOS_IDS.MAPA_MEMORIAS_ID) || {};
    const idFixo = mapaIds[chave] || mapaIds[chaveSemMd] || mapaIds[chaveComMd];

    if (idFixo && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
      try {
        const arqId = DriveApp.getFileById(idFixo);
        if (arqId && !arqId.isTrashed()) return arqId;
      } catch (e) {}
    }

    const pastaMem = pastaMemOpt || obterOuCriarPastaMemoriasOlympos();
    if (pastaMem && typeof pastaMem.getFilesByName === 'function') {
      const itComMd = pastaMem.getFilesByName(chaveComMd);
      while (itComMd.hasNext()) {
        const f = itComMd.next();
        if (!f.isTrashed()) return f;
      }
      const itSemMd = pastaMem.getFilesByName(chaveSemMd);
      while (itSemMd.hasNext()) {
        const f = itSemMd.next();
        if (!f.isTrashed()) return f;
      }
    }

    return null;
  }
}

/**
 * Função Administrativa de Saneamento Global:
 * Varre o catálogo completo das 17 personas (e personas operacionais), resolve e deduplica
 * todas as memórias no Google Drive, limpa duplicatas órfãs e persiste todos os IDs no ScriptProperties.
 *
 * @return {Object} Relatório detalhado da reconciliação com status de cada persona.
 */
function reconciliarTodasMemoriasDefinitivasOlympos() {
  const relatorio = [];
  const catalogo = (typeof OLYMPOS_IDS !== 'undefined' && (OLYMPOS_IDS.CATALOGO_17_PERSONAS || OLYMPOS_IDS.MEMORIAS_PADRAO)) || [];

  catalogo.forEach(persona => {
    const nomeArquivo = persona.arquivo || `_memoria_${persona.slug || persona.deus.toLowerCase()}.md`;
    const nomePersona = persona.nome || persona.deus || persona.slug;
    const slugPersona = persona.slug || extrairSlugMemoria_(nomeArquivo);

    try {
      const arq = obterArquivoMemoriaCanonico_(nomeArquivo);
      const conteudo = lerConteudoMemoria_(arq);
      const totalLinhas = conteudo ? conteudo.split('\n').length : 0;

      relatorio.push({
        persona: nomePersona,
        slug: slugPersona,
        arquivo: nomeArquivo,
        idCanonico: arq.getId(),
        url: typeof arq.getUrl === 'function' ? arq.getUrl() : `https://drive.google.com/file/d/${arq.getId()}/view`,
        linhas: totalLinhas,
        status: 'CONCILIADO_E_PROTEGIDO'
      });
    } catch (err) {
      relatorio.push({
        persona: nomePersona,
        slug: slugPersona,
        arquivo: nomeArquivo,
        status: 'ERRO',
        mensagem: err.message || String(err)
      });
    }
  });

  return {
    executadoEm: new Date().toISOString(),
    totalPersonas: catalogo.length,
    sucessos: relatorio.filter(r => r.status === 'CONCILIADO_E_PROTEGIDO').length,
    erros: relatorio.filter(r => r.status === 'ERRO').length,
    resultados: relatorio
  };
}

/**
 * Lê o conteúdo textual de um arquivo de memória por objeto ou por ID.
 * Suporta tanto Google Docs (DocumentApp) quanto arquivos de texto / Markdown (DriveApp).
 *
 * @param {GoogleAppsScript.Drive.File|string} arquivoOuId Arquivo do Drive ou ID canônico
 * @return {string} Conteúdo textual completo em UTF-8
 */
function lerConteudoMemoria_(arquivoOuId) {
  if (!arquivoOuId) return '';
  try {
    let driveFile = null;
    let fileId = '';
    let mime = '';

    if (typeof arquivoOuId === 'string') {
      fileId = arquivoOuId.trim();
      if (typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
        driveFile = DriveApp.getFileById(fileId);
        mime = typeof driveFile.getMimeType === 'function' ? driveFile.getMimeType() : '';
      }
    } else if (typeof arquivoOuId === 'object' && arquivoOuId !== null) {
      driveFile = arquivoOuId;
      fileId = typeof driveFile.getId === 'function' ? driveFile.getId() : '';
      mime = typeof driveFile.getMimeType === 'function' ? driveFile.getMimeType() : '';
    }

    const isGoogleDocs = (
      mime === 'application/vnd.google-apps.document' ||
      (typeof MimeType !== 'undefined' && mime === MimeType.GOOGLE_DOCS)
    );

    // Se for Google Docs, lê via DocumentApp
    if (isGoogleDocs && typeof DocumentApp !== 'undefined' && DocumentApp.openById) {
      return DocumentApp.openById(fileId).getBody().getText() || '';
    }

    // Caso contrário, lê via Blob UTF-8 do arquivo Drive
    if (driveFile && typeof driveFile.getBlob === 'function') {
      return driveFile.getBlob().getDataAsString('UTF-8') || '';
    }
    if (fileId && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
      return DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8') || '';
    }
  } catch (e) {
    console.warn('Aviso ao ler arquivo de memória:', e);
  }
  return '';
}

/**
 * Grava o conteúdo textual em um arquivo de memória in-place com LockService.
 * Verifica o mimeType do arquivo canônico:
 * - Se for MimeType.GOOGLE_DOCS (application/vnd.google-apps.document): DocumentApp.openById(id).getBody().setText(conteudo)
 * - Caso contrário: DriveApp.getFileById(id).setContent(conteudo)
 * NUNCA cria novos arquivos nem altera os IDs canônicos.
 *
 * @param {GoogleAppsScript.Drive.File|string} arquivoOuId Arquivo do Drive ou ID canônico
 * @param {string} textoFinal Conteúdo textual a ser gravado in-place
 */
function gravarConteudoMemoria_(arquivoOuId, textoFinal) {
  if (!arquivoOuId) return;
  let lock = null;
  try {
    if (typeof LockService !== 'undefined' && LockService.getScriptLock) {
      lock = LockService.getScriptLock();
      if (lock && typeof lock.tryLock === 'function') {
        lock.tryLock(10000);
      }
    }

    let driveFile = null;
    let fileId = '';
    let mime = '';

    if (typeof arquivoOuId === 'string') {
      fileId = arquivoOuId.trim();
      if (typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
        driveFile = DriveApp.getFileById(fileId);
        mime = typeof driveFile.getMimeType === 'function' ? driveFile.getMimeType() : '';
      }
    } else if (typeof arquivoOuId === 'object' && arquivoOuId !== null) {
      driveFile = arquivoOuId;
      fileId = typeof driveFile.getId === 'function' ? driveFile.getId() : '';
      mime = typeof driveFile.getMimeType === 'function' ? driveFile.getMimeType() : '';
    }

    const isGoogleDocs = (
      mime === 'application/vnd.google-apps.document' ||
      (typeof MimeType !== 'undefined' && mime === MimeType.GOOGLE_DOCS)
    );

    // 1. Se Google Docs: DocumentApp.openById(id).getBody().setText(conteudo)
    if (isGoogleDocs && typeof DocumentApp !== 'undefined' && DocumentApp.openById) {
      const doc = DocumentApp.openById(fileId);
      doc.getBody().setText(textoFinal);
      doc.saveAndClose();
      return;
    }

    // 2. Caso contrário: DriveApp.getFileById(id).setContent(conteudo)
    if (driveFile && typeof driveFile.setContent === 'function') {
      driveFile.setContent(textoFinal);
    } else if (fileId && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
      DriveApp.getFileById(fileId).setContent(textoFinal);
    }
  } finally {
    if (lock && typeof lock.releaseLock === 'function') {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}

/**
 * Cria o conteúdo padrão inicial de um arquivo _memoria_<deus>.md.
 */
function criarConteudoInicialMemoria_(nomeArquivoMd, linhaInicial, agora) {
  const chaveLimpa = String(nomeArquivoMd || '').replace('_memoria_', '').replace(/\.md$/i, '').toLowerCase();
  const tituloPersona = chaveLimpa.toUpperCase();
  const piso = (OLYMPOS_IDS.ESTADO_GLOBAL_MD && OLYMPOS_IDS.ESTADO_GLOBAL_MD.PISO_INICIAL_2026) || {
    proximoOficio2026: 155,
    ultimoOficio2026: 154,
    proximaPortaria2026: 163,
    ultimaPortaria2026: 162,
    proximoMemorando2026: 1,
    proximoParecerJuridico2026: 1,
    proximoEditalPss2026: 1,
    signatarioTitular: 'Secretário(a) Municipal de Educação Básica',
    cargoSignatario: 'Secretário(a) Municipal de Educação Básica',
    anoExercicioAtivo: '2026'
  };

  const linhasEstado = ['- Status_Setor: Ativo'];
  if (chaveLimpa === 'apolo') {
    linhasEstado.push(
      `- Proximo_Oficio_2026: ${piso.proximoOficio2026}`,
      `- Ultimo_Oficio_2026: ${piso.ultimoOficio2026}`,
      `- Proxima_Portaria_2026: ${piso.proximaPortaria2026}`,
      `- Ultima_Portaria_2026: ${piso.ultimaPortaria2026}`,
      `- Proximo_Memorando_2026: ${piso.proximoMemorando2026}`,
      `- Proximo_Parecer_Juridico_2026: ${piso.proximoParecerJuridico2026}`,
      `- Proximo_Edital_PSS_2026: ${piso.proximoEditalPss2026}`,
      `- Signatario_Titular_SMEB: ${piso.signatarioTitular}`,
      `- Cargo_Signatario_SMEB: ${piso.cargoSignatario}`,
      `- Ano_Exercicio_Ativo: ${piso.anoExercicioAtivo}`
    );
  }

  return [
    `# Memória Operacional — ${tituloPersona}`,
    `Atualizado em: ${agora}`,
    ``,
    `## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)`,
    linhaInicial ? `- ${linhaInicial}` : `- Sem novos alertas na caixa de entrada.`,
    ``,
    `## 1. Estado Atual e Contadores Ativos (2026)`,
    ...linhasEstado,
    ``,
    `## 2. Pendências Críticas em Aberto (Máximo 10 itens)`,
    `- [ ] Nenhuma pendência crítica registrada.`,
    ``,
    `## 3. Histórico Recente — Rolling Log (Últimos 5 registros)`,
    `- [${agora}] Arquivo de memória conectado pelo Hub Olympos.`
  ].join('\n');
}

/**
 * Insere um alerta no bloco "## 0. Caixa de Entrada" mantendo o teto rígido de 60 linhas.
 * VEDAÇÃO ABSOLUTA: Se o arquivo não existir por ID fixo, não cria arquivos órfãos automaticamente.
 */
function registrarAlertaMemoriaOlympos(nomeArquivoMd, novaLinhaAlerta) {
  const pastaMem = obterOuCriarPastaMemoriasOlympos();
  const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');

  let arquivo = obterArquivoMemoriaDireto_(nomeArquivoMd, pastaMem);
  if (!arquivo) {
    console.error(`Erro crítico: Memória ${nomeArquivoMd} não encontrada. Criação automática de arquivos órfãos bloqueada.`);
    return {
      status: 'ERRO_NAO_ENCONTRADO',
      mensagem: `Arquivo ${nomeArquivoMd} não foi localizado por ID fixo nem na pasta oficial. Criação bloqueada para evitar duplicatas.`
    };
  }

  let conteudo = lerConteudoMemoria_(arquivo);
  if (!conteudo || !conteudo.trim()) {
    conteudo = criarConteudoInicialMemoria_(nomeArquivoMd, novaLinhaAlerta, agora);
    gravarConteudoMemoria_(arquivo, conteudo);
    return { status: 'ATUALIZADO', arquivo: nomeArquivoMd, id: arquivo.getId(), totalLinhas: conteudo.split('\n').length };
  }

  // Inserir alerta logo abaixo de "## 0. Caixa de Entrada"
  const marcadorCaixa = '## 0. Caixa de Entrada';
  const linhas = conteudo.split('\n');
  const novasLinhas = [];
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
    if (linhas[i].startsWith(marcadorCaixa)) {
      novasLinhas.push(`- ${novaLinhaAlerta}`);
      inseriuCaixa = true;
    }
  }

  if (!inseriuCaixa) {
    novasLinhas.unshift(`- ${novaLinhaAlerta}`);
  }

  // Trava rígida de 60 linhas para proteger TPM das skills
  const textoFinal = novasLinhas.slice(0, 60).join('\n');
  gravarConteudoMemoria_(arquivo, textoFinal);

  return {
    status: 'ATUALIZADO',
    arquivo: nomeArquivoMd,
    id: arquivo.getId(),
    totalLinhas: Math.min(novasLinhas.length, 60)
  };
}

/**
 * Lista todos os arquivos _memoria_<deus>.md do catálogo de memórias (17 Personas + Especializadas).
 * Acesso canônico determinístico via obterArquivoMemoriaCanonico_ e cache de IDs fixos.
 * VEDAÇÃO ABSOLUTA: Jamais cria arquivos .md duplicados soltos no Google Drive.
 *
 * @return {Array<Object>} Lista de cartões de memória para o painel de controle
 */
function listarTodasMemoriasOlympos() {
  const pastaMem = obterOuCriarPastaMemoriasOlympos();
  const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');
  const resultado = [];
  const listaMemorias = (typeof OLYMPOS_IDS !== 'undefined' && OLYMPOS_IDS.MEMORIAS_PADRAO) || [];

  listaMemorias.forEach(meta => {
    let arquivo = null;
    const nomeOuSlug = meta.arquivo || meta.slug || meta.deus;

    try {
      arquivo = obterArquivoMemoriaCanonico_(nomeOuSlug);
    } catch (e) {
      if (meta.id && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
        try {
          arquivo = DriveApp.getFileById(meta.id);
        } catch (e2) {}
      }
    }

    let conteudo = '';
    let statusArquivo = 'ATIVO';

    if (arquivo && !arquivo.isTrashed()) {
      conteudo = lerConteudoMemoria_(arquivo);
      if (!conteudo || !conteudo.trim()) {
        conteudo = criarConteudoInicialMemoria_(meta.arquivo, null, agora);
        gravarConteudoMemoria_(arquivo, conteudo);
      }
    } else {
      statusArquivo = 'INDISPONIVEL';
      conteudo = `# Memória ${meta.deus || meta.nome} Indisponível\nVerifique se o arquivo ID ${meta.id} não foi removido para a lixeira.`;
    }

    const idResolvido = (arquivo && !arquivo.isTrashed()) ? arquivo.getId() : (meta.id || '');

    resultado.push(extrairResumoCardMemoria_(
      meta.arquivo,
      meta.deus || meta.nome,
      meta.dominio,
      meta.icone,
      arquivo,
      conteudo,
      statusArquivo,
      idResolvido
    ));
  });

  return resultado;
}

function extrairResumoCardMemoria_(nomeArquivo, deus, dominio, icone, arquivoDrive, conteudo, statusArquivo, idFixo) {
  const linhas = String(conteudo || '').split('\n');
  let atualizadoEm = '';
  const alertasCaixa = [];
  let lendoCaixa = false;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (l.startsWith('Atualizado em:')) {
      atualizadoEm = l.replace('Atualizado em:', '').trim();
    } else if (l.startsWith('## 0. Caixa de Entrada')) {
      lendoCaixa = true;
    } else if (l.startsWith('## 1.')) {
      lendoCaixa = false;
    } else if (lendoCaixa && l.startsWith('- ') && l !== '- Sem novos alertas na caixa de entrada.') {
      alertasCaixa.push(l.substring(2));
    }
  }

  const fileUrl = arquivoDrive && typeof arquivoDrive.getUrl === 'function'
    ? arquivoDrive.getUrl()
    : `https://drive.google.com/file/d/${idFixo}/view`;

  return {
    arquivo: nomeArquivo,
    deus: deus,
    dominio: dominio,
    icone: icone || 'scroll',
    id: idFixo,
    url: fileUrl,
    statusArquivo: statusArquivo || 'ATIVO',
    atualizadoEm: atualizadoEm,
    totalLinhas: linhas.length,
    totalAlertas: alertasCaixa.length,
    alertasRecentes: alertasCaixa.slice(0, 4),
    conteudoCompleto: conteudo
  };
}

/**
 * Limpa a Caixa de Entrada e as Pendências de um arquivo _memoria_<deus>.md.
 */
function limparPendenciasMemoriaOlympos(nomeArquivoMd) {
  const pastaMem = obterOuCriarPastaMemoriasOlympos();
  const arquivo = obterArquivoMemoriaDireto_(nomeArquivoMd, pastaMem);
  const agora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');

  if (!arquivo) {
    throw new Error(`Arquivo ${nomeArquivoMd} não encontrado por ID fixo.`);
  }

  const conteudo = lerConteudoMemoria_(arquivo);
  const linhas = conteudo.split('\n');
  const novasLinhas = [];

  let secaoAtual = '';
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.startsWith('Atualizado em:')) {
      novasLinhas.push(`Atualizado em: ${agora}`);
      continue;
    }
    if (l.startsWith('## 0. Caixa de Entrada')) {
      secaoAtual = 'CAIXA';
      novasLinhas.push(l);
      novasLinhas.push('- Sem novos alertas na caixa de entrada.');
      novasLinhas.push('');
      continue;
    }
    if (l.startsWith('## 1.')) {
      secaoAtual = 'ESTADO';
      novasLinhas.push(l);
      continue;
    }
    if (l.startsWith('## 2. Pendências Críticas')) {
      secaoAtual = 'PENDENCIAS';
      novasLinhas.push(l);
      novasLinhas.push('- [ ] Nenhuma pendência crítica registrada.');
      novasLinhas.push('');
      continue;
    }
    if (l.startsWith('## 3.')) {
      secaoAtual = 'HISTORICO';
      novasLinhas.push(l);
      novasLinhas.push(`- [${agora}] Caixa de entrada e pendências higienizadas pelo Hub Olympos.`);
      continue;
    }

    if (secaoAtual !== 'CAIXA' && secaoAtual !== 'PENDENCIAS') {
      novasLinhas.push(l);
    }
  }

  const textoFinal = novasLinhas.slice(0, 60).join('\n');
  gravarConteudoMemoria_(arquivo, textoFinal);

  return {
    status: 'LIMPO',
    arquivo: nomeArquivoMd,
    conteudoCompleto: textoFinal
  };
}

/**
 * Permite editar manualmente o conteúdo de um arquivo _memoria_<deus>.md pelo painel respeitando o limite de 60 linhas.
 * Suporta identificação direta por ID do Google Drive ou por nome/slug de arquivo.
 * Realiza gravação estritamente in-place pelo ID canônico existente sem criar arquivos duplicados.
 */
function salvarEdicaoMemoriaOlympos(nomeArquivoOuId, novoConteudo) {
  const pastaMem = obterOuCriarPastaMemoriasOlympos();
  let arquivo = null;

  // Se o identificador for um ID direto do Google Drive (30+ caracteres sem extensão)
  const idCandidato = String(nomeArquivoOuId || '').trim();
  if (idCandidato.length >= 25 && !idCandidato.includes('/') && !idCandidato.includes('.') && typeof DriveApp !== 'undefined' && DriveApp.getFileById) {
    try {
      const arqPorId = DriveApp.getFileById(idCandidato);
      if (arqPorId && !arqPorId.isTrashed()) {
        arquivo = arqPorId;
      }
    } catch (eId) {}
  }

  if (!arquivo) {
    arquivo = obterArquivoMemoriaDireto_(nomeArquivoOuId, pastaMem);
  }

  if (!arquivo) {
    throw new Error(`Arquivo de memória '${nomeArquivoOuId}' não encontrado.`);
  }

  const textoFinal = String(novoConteudo || '').split('\n').slice(0, 60).join('\n');
  gravarConteudoMemoria_(arquivo, textoFinal);
  return {
    ok: true,
    status: 'SALVO',
    arquivo: typeof arquivo.getName === 'function' ? arquivo.getName() : nomeArquivoOuId,
    id: typeof arquivo.getId === 'function' ? arquivo.getId() : idCandidato,
    totalLinhas: textoFinal.split('\n').length
  };
}

/**
 * Gera um Snapshot Semanal de Auditoria compactado (.zip) de todos os 11 arquivos _memoria_<deus>.md.
 */
function gerarSnapshotSemanalMemoriasDedalo() {
  const memorias = listarTodasMemoriasOlympos();
  const dataHoje = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd');
  const dataHora = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd HH:mm');
  const pastaBackupDedalo = DriveApp.getFolderById(OLYMPOS_IDS.BACKUP_MAQUINA_LOCAL_DEDALO);

  const blobsParaZip = [];
  const manifesto = {
    geradoEm: dataHora,
    pastaDestinoId: OLYMPOS_IDS.BACKUP_MAQUINA_LOCAL_DEDALO,
    totalMemorias: memorias.length,
    arquivos: []
  };

  memorias.forEach(m => {
    const conteudo = m.conteudoCompleto || '';
    blobsParaZip.push(Utilities.newBlob(conteudo, 'text/markdown', m.arquivo));
    manifesto.arquivos.push({
      arquivo: m.arquivo,
      deus: m.deus,
      totalLinhas: m.totalLinhas,
      totalAlertas: m.totalAlertas
    });
  });

  const jsonManifesto = JSON.stringify(manifesto, null, 2);
  blobsParaZip.push(Utilities.newBlob(jsonManifesto, 'application/json', `manifesto_snapshot_${dataHoje}.json`));

  const nomeZip = `Snapshot_Memorias_Olympos_${dataHoje}.zip`;
  let arquivoSalvo = null;

  if (typeof Utilities.zip === 'function') {
    const zipBlob = Utilities.zip(blobsParaZip, nomeZip);
    arquivoSalvo = pastaBackupDedalo.createFile(zipBlob);
  } else {
    arquivoSalvo = pastaBackupDedalo.createFile(nomeZip, jsonManifesto, MimeType.PLAIN_TEXT);
  }

  const urlSnapshot = arquivoSalvo.getUrl();
  registrarAlertaMemoriaOlympos(
    '_memoria_dedalo.md',
    `[${dataHora}] [SNAPSHOT AUDITORIA]: Backup semanal de ${memorias.length} memórias salvo em ${nomeZip} (${urlSnapshot})`
  );

  return {
    status: 'SNAPSHOT_CRIADO',
    nomeArquivo: nomeZip,
    id: arquivoSalvo.getId(),
    url: urlSnapshot,
    totalMemorias: memorias.length,
    geradoEm: dataHora
  };
}
