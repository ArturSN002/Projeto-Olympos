/**
 * Hub Olympos V3.1 — Página Modular 8: Ecossistema Olympos (26 Personas) & 22 Memórias Google Docs
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.personas = (function() {
  let memorias = [];
  let personasExtras = [];
  let isLoaded = false;
  let activeCategoryFilter = 'TODAS';

  const EXTRAS_DEFAULT = [
    {
      nome: 'Cadmo',
      camada: 'Camada 3B',
      dominio: 'Localizador Cadastral & O Papiro de Cadmo (16 Entes RN)',
      anfitriao: 'Hera',
      arquivoAnfitriao: '_memoria_hera.md',
      idAnfitriao: '1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4',
      urlAnfitriao: 'https://docs.google.com/document/d/1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4/edit',
      icone: 'cadmo'
    },
    {
      nome: 'Arquimedes',
      camada: 'Camada 4',
      dominio: 'Ciência de Dados Educacionais, Censo e Indicadores',
      anfitriao: 'Dédalo',
      arquivoAnfitriao: '_memoria_dedalo.md',
      idAnfitriao: '1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg',
      urlAnfitriao: 'https://docs.google.com/document/d/1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg/edit',
      icone: 'arquimedes'
    },
    {
      nome: 'Íris',
      camada: 'Camada 3B',
      dominio: 'Comunicação Ágil, Avisos Setoriais e Google Chat',
      anfitriao: 'Héstia',
      arquivoAnfitriao: '_memoria_hestia.md',
      idAnfitriao: '1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q',
      urlAnfitriao: 'https://docs.google.com/document/d/1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q/edit',
      icone: 'iris'
    },
    {
      nome: 'Sólon',
      camada: 'Camada 3B',
      dominio: 'Técnica Legislativa e Constitucionalidade Municipal',
      anfitriao: 'Têmis',
      arquivoAnfitriao: '_memoria_temis.md',
      idAnfitriao: '11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A',
      urlAnfitriao: 'https://docs.google.com/document/d/11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A/edit',
      icone: 'solon'
    }
  ];

  function docsUrlFromId(id, fallbackUrl) {
    if (id && /^[a-zA-Z0-9_-]{20,}$/.test(String(id).trim())) {
      return 'https://docs.google.com/document/d/' + String(id).trim() + '/edit';
    }
    return fallbackUrl || '';
  }

  function atualizarStatusSincronizacao(texto, modo) {
    const el = document.getElementById('memoriasSyncStatus');
    if (!el) return;
    el.textContent = texto;
    el.setAttribute('data-status', modo || 'local');
  }

  function popularSelectAlertas() {
    const select = document.getElementById('quickAlertTargetSelect');
    if (!select) return;

    const prevValue = select.value;
    const base = (memorias && memorias.length)
      ? memorias.slice()
      : (window.OLYMPOS_MEMORIAS_CATALOGO ? window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas().slice() : []);
    if (!base.length) return;

    base.sort(function(a, b) {
      return String(a.deus || a.nome || '').localeCompare(String(b.deus || b.nome || ''), 'pt-BR');
    });

    select.innerHTML = '';
    base.forEach(function(m) {
      const opt = document.createElement('option');
      opt.value = m.arquivo;
      const nome = m.deus || m.nome || m.slug || m.arquivo;
      const domCurto = String(m.dominio || '').split(',')[0].split('&')[0].trim();
      opt.textContent = domCurto ? (nome + ' (' + domCurto + ')') : nome;
      select.appendChild(opt);
    });

    if (prevValue && Array.from(select.options).some(function(o) { return o.value === prevValue; })) {
      select.value = prevValue;
    } else if (Array.from(select.options).some(function(o) { return o.value === '_memoria_helio.md'; })) {
      select.value = '_memoria_helio.md';
    }
  }

  function init() {
    bindEvents();
    // Inicialização síncrona imediata a partir do catálogo consolidado das 22 memórias Google Docs
    if (window.OLYMPOS_MEMORIAS_CATALOGO) {
      memorias = window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas();
      personasExtras = window.OLYMPOS_MEMORIAS_CATALOGO.listarExtras();
      isLoaded = true;
      popularSelectAlertas();
      atualizarStatusSincronizacao('22 Google Docs carregados do catálogo local • sincronizando...', 'local');
      filtrarMemorias();
    }
    // Sincronização em background caso o Gateway GAS esteja disponível
    carregarMemorias(true);
  }

  function bindEvents() {
    const bind = function(id, evt, fn) {
      const el = document.getElementById(id);
      if (el && !el._bound) {
        el._bound = true;
        el.addEventListener(evt, fn);
      }
    };

    bind('memoriaSearchInput', 'input', filtrarMemorias);
    bind('quickAlertSendBtn', 'click', handleEnviarAlertaRapido);
    bind('copyGeminiContextBtn', 'click', copiarContextoCompletoGemini);
    bind('refreshMemoriasBtn', 'click', function() {
      carregarMemorias(false);
    });

    const filterBar = document.getElementById('memoriasFilterBar');
    if (filterBar && !filterBar._bound) {
      filterBar._bound = true;
      filterBar.addEventListener('click', function(e) {
        const btn = (e.target && typeof e.target.closest === 'function') ? e.target.closest('.memoria-filter-pill[data-filter]') : null;
        if (!btn) return;
        activeCategoryFilter = btn.getAttribute('data-filter') || 'TODAS';
        filterBar.querySelectorAll('.memoria-filter-pill').forEach(function(pill) {
          pill.classList.toggle('active', pill === btn);
        });
        filtrarMemorias();
      });
    }

    bind('syncApoloBtn', 'click', function() {
      window.OlymposApp.showToast('Sincronizando pastas 2026 com a memória Google Docs de Apolo...');
      window.OlymposApi.chamar('olho_apolo_sync', {}, function(res) {
        if (res && res.ok) {
          window.OlymposApp.showToast('Contadores e memórias Google Docs reconciliados com sucesso!');
          carregarMemorias(false);
          if (window.OlymposViews && window.OlymposViews.visaoGeral) {
            window.OlymposViews.visaoGeral.recarregar();
          }
        } else {
          window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao reconciliar contadores de Apolo.', true);
        }
      });
    });

    bind('snapshotDedaloBtn', 'click', function() {
      window.OlymposApp.showToast('Gerando Snapshot Consolidado de Dédalo no Google Drive...');
      window.OlymposApi.chamar('snapshot_dedalo', {}, function(res) {
        if (res && res.ok) {
          window.OlymposApp.showToast('Snapshot gerado: ' + (res.arquivoSnapshot || 'Backup concluído'));
          if (res.url) window.open(res.url, '_blank', 'noopener,noreferrer');
        } else {
          window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao gerar snapshot.', true);
        }
      });
    });
  }

  function mergeComCatalogo(remotas) {
    const baseCatalogo = window.OLYMPOS_MEMORIAS_CATALOGO
      ? window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas()
      : (memorias || []);
    const mapaRemotoPorId = {};
    const mapaRemotoPorArq = {};
    const mapaRemotoPorSlug = {};

    (remotas || []).forEach(function(r) {
      if (r.id) mapaRemotoPorId[r.id] = r;
      if (r.arquivo) mapaRemotoPorArq[r.arquivo] = r;
      if (r.slug) mapaRemotoPorSlug[String(r.slug).toLowerCase()] = r;
    });

    const usadas = new Set();
    const mescladas = baseCatalogo.map(function(catItem) {
      const remota = mapaRemotoPorId[catItem.id] ||
        mapaRemotoPorArq[catItem.arquivo] ||
        mapaRemotoPorSlug[String(catItem.slug || '').toLowerCase()] ||
        null;
      if (remota) usadas.add(remota);

      const temPendente = window.OLYMPOS_MEMORIAS_CATALOGO
        ? window.OLYMPOS_MEMORIAS_CATALOGO.temEdicaoLocalPendente(catItem.arquivo)
        : false;
      const localConteudo = (temPendente && window.OLYMPOS_MEMORIAS_CATALOGO)
        ? window.OLYMPOS_MEMORIAS_CATALOGO.obterConteudoLocal(catItem.arquivo)
        : null;

      let conteudo = catItem.conteudoCompleto || '';
      if (temPendente && localConteudo !== null && localConteudo !== undefined) {
        conteudo = localConteudo;
      } else if (remota && remota.conteudoCompleto) {
        conteudo = remota.conteudoCompleto;
      }

      const idDoc = catItem.id || (remota && (remota.id || remota.driveId)) || '';
      const urlDoc = docsUrlFromId(idDoc, (remota && remota.url) || catItem.url);

      return Object.assign({}, catItem, remota || {}, {
        id: idDoc,
        driveId: idDoc,
        formato: 'GOOGLE_DOCS',
        mimeType: 'application/vnd.google-apps.document',
        url: urlDoc,
        perfilRbac: catItem.perfilRbac || (remota && remota.perfilRbac) || 'ADMIN_GABINETE',
        camada: catItem.camada || (remota && remota.camada) || '',
        deus: (remota && remota.deus) || catItem.nome || catItem.deus,
        nome: (remota && remota.nome) || catItem.nome || (remota && remota.deus),
        conteudoCompleto: conteudo,
        totalLinhas: conteudo ? conteudo.split('\n').length : ((remota && remota.totalLinhas) || catItem.totalLinhas || 0),
        edicaoPendente: temPendente
      });
    });

    (remotas || []).forEach(function(r) {
      if (!usadas.has(r)) {
        const idDoc = r.id || r.driveId || '';
        mescladas.push(Object.assign({}, r, {
          id: idDoc,
          driveId: idDoc,
          formato: r.formato || 'GOOGLE_DOCS',
          url: docsUrlFromId(idDoc, r.url)
        }));
      }
    });

    return mescladas;
  }

  function aplicarRespostaRemota(data, silencioso) {
    if (!data || !data.memorias || !data.memorias.length) {
      return false;
    }

    memorias = mergeComCatalogo(data.memorias);
    if (data.personasExtras && data.personasExtras.length) {
      personasExtras = data.personasExtras.map(function(ex) {
        const hostMeta = window.OLYMPOS_MEMORIAS_CATALOGO
          ? window.OLYMPOS_MEMORIAS_CATALOGO.obterPorArquivo(ex.arquivoAnfitriao || ex.anfitriao)
          : null;
        const idHost = ex.idAnfitriao || (hostMeta && hostMeta.id) || '';
        return Object.assign({}, ex, {
          idAnfitriao: idHost,
          urlAnfitriao: ex.urlAnfitriao || docsUrlFromId(idHost)
        });
      });
    }

    isLoaded = true;
    popularSelectAlertas();
    atualizarStatusSincronizacao('Sincronizado via Google Docs (' + memorias.length + ' documentos ativos)', 'online');
    filtrarMemorias();

    if (!silencioso && window.OlymposApp) {
      window.OlymposApp.showToast(memorias.length + ' memórias Google Docs sincronizadas!');
    }
    return true;
  }

  function aplicarFallbackOffline(silencioso) {
    if (window.OLYMPOS_MEMORIAS_CATALOGO) {
      memorias = window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas();
      personasExtras = window.OLYMPOS_MEMORIAS_CATALOGO.listarExtras();
    } else {
      const cat = window.OlymposIcons ? window.OlymposIcons.getCatalogo17Personas() : [];
      memorias = cat.filter(function(p) { return p.tipo === 'memoria'; }).map(function(p) {
        return {
          deus: p.nome,
          nome: p.nome,
          arquivo: p.arquivo,
          dominio: p.dominio,
          icone: p.id,
          id: p.idDoc || '',
          formato: 'GOOGLE_DOCS',
          url: docsUrlFromId(p.idDoc),
          totalLinhas: 24,
          alertasRecentes: []
        };
      });
      personasExtras = EXTRAS_DEFAULT;
    }
    isLoaded = true;
    popularSelectAlertas();
    atualizarStatusSincronizacao('Catálogo local ativo (' + memorias.length + ' Google Docs) — Gateway offline', 'local');
    filtrarMemorias();
    if (!silencioso && window.OlymposApp) {
      window.OlymposApp.showToast('Visualização baseada no catálogo local das memórias Google Docs.');
    }
  }

  function carregarMemorias(silencioso) {
    if (!isLoaded && window.OLYMPOS_MEMORIAS_CATALOGO) {
      memorias = window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas();
      personasExtras = window.OLYMPOS_MEMORIAS_CATALOGO.listarExtras();
      isLoaded = true;
      popularSelectAlertas();
      filtrarMemorias();
    }

    atualizarStatusSincronizacao('Sincronizando memórias Google Docs...', 'syncing');

    const tentarOverviewFallback = function() {
      window.OlymposApi.chamar('overview_get', {}, function(res) {
        const data = (res && res.data) ? res.data : res;
        if (!aplicarRespostaRemota(data, silencioso)) {
          aplicarFallbackOffline(silencioso);
        }
      }, function() {
        aplicarFallbackOffline(silencioso);
      });
    };

    if (window.OlymposApi && typeof window.OlymposApi.listarMemorias === 'function') {
      window.OlymposApi.listarMemorias(function(res) {
        const data = (res && res.data) ? res.data : res;
        if (!aplicarRespostaRemota(data, silencioso)) {
          tentarOverviewFallback();
        }
      }, function() {
        tentarOverviewFallback();
      });
    } else {
      tentarOverviewFallback();
    }
  }

  function montarListaCompleta() {
    const lista = [];

    memorias.forEach(function(m) {
      const idDoc = m.id || m.driveId || '';
      lista.push({
        isHostRouted: false,
        slug: m.slug || '',
        nome: m.deus || m.nome,
        arquivo: m.arquivo,
        id: idDoc,
        driveId: idDoc,
        formato: m.formato || 'GOOGLE_DOCS',
        camada: m.camada || '',
        perfilRbac: m.perfilRbac || 'ADMIN_GABINETE',
        dominio: m.dominio || '',
        icone: m.icone || m.slug || m.deus,
        linhas: m.totalLinhas !== undefined ? m.totalLinhas : (m.linhas || 0),
        atualizadoEm: m.atualizadoEm || '',
        alertas: m.alertasRecentes || [],
        url: docsUrlFromId(idDoc, m.url),
        edicaoPendente: Boolean(m.edicaoPendente),
        rawMemoria: m
      });
    });

    const listaExtras = (personasExtras && personasExtras.length) ? personasExtras : EXTRAS_DEFAULT;
    listaExtras.forEach(function(ex) {
      const arqHost = ex.arquivoAnfitriao || ('_memoria_' + String(ex.anfitriao || 'hestia').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() + '.md');
      const hostMem = memorias.find(function(m) { return m.arquivo === arqHost; });
      const idHost = ex.idAnfitriao || (hostMem && hostMem.id) || '';
      lista.push({
        isHostRouted: true,
        nome: ex.nome,
        anfitriao: ex.anfitriao,
        arquivo: arqHost,
        idAnfitriao: idHost,
        urlAnfitriao: ex.urlAnfitriao || docsUrlFromId(idHost),
        camada: ex.camada || '',
        perfilRbac: 'ANFITRIAS',
        dominio: ex.dominio || '',
        icone: ex.icone || ex.nome
      });
    });

    return lista;
  }

  function montarListaCompleta17() {
    return montarListaCompleta();
  }

  function renderizarGrade(lista) {
    const grid = document.getElementById('memoriasGrid');
    if (!grid) return;

    grid.innerHTML = '';
    if (lista.length === 0) {
      grid.innerHTML = '<div class="output-panel">Nenhuma persona ou memória encontrada para o filtro informado.</div>';
      return;
    }

    const session = window.OlymposApp.getSession();
    const podeEditar = typeof window.OlymposApp.podeEditarMemorias === 'function'
      ? window.OlymposApp.podeEditarMemorias(session)
      : (!session || !session.perfil ? false : session.perfil.podeEditarMemorias !== false);

    lista.forEach(function(item) {
      const card = document.createElement('div');
      card.className = 'memoria-card';

      const iconSvg = window.OlymposIcons ? window.OlymposIcons.get(item.icone) : '';

      if (!item.isHostRouted) {
        const pct = Math.min(100, Math.round((item.linhas / 60) * 100));
        const alertaPreview = (item.alertas && item.alertas.length > 0)
          ? item.alertas.slice(0, 2).map(function(a) { return window.OlymposApp.escapeHtml(String(a).replace(/^-\s*/, '')); }).join('<br />')
          : 'Sem alertas pendentes na seção 2 deste documento.';

        card.innerHTML =
          '<div>' +
            '<div class="memoria-header">' +
              '<div class="persona-emblem" aria-hidden="true">' + iconSvg + '</div>' +
              '<div class="memoria-title-wrap">' +
                '<div class="memoria-name">' + window.OlymposApp.escapeHtml(item.nome) + '</div>' +
                '<div class="memoria-domain">' + window.OlymposApp.escapeHtml(item.dominio) + '</div>' +
              '</div>' +
              '<div class="memoria-badges-col">' +
                '<span class="pill-badge pill-docs">Google Docs</span>' +
                '<span class="pill-badge pill-gold">' + window.OlymposApp.escapeHtml(item.arquivo) + '</span>' +
                (item.edicaoPendente ? '<span class="pill-badge pill-red">Local pendente</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="memoria-alerts-preview" style="margin-top:12px;">' + alertaPreview + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="memoria-meter-info">' +
              '<span>Ocupação Canônica (Doc)</span>' +
              '<span class="' + (item.linhas > 52 ? 'meter-warning' : '') + '">' + item.linhas + ' / 60 linhas</span>' +
            '</div>' +
            '<div class="meter-track" style="margin-bottom:14px;">' +
              '<div class="meter-bar ' + (item.linhas > 52 ? 'meter-danger' : '') + '" style="width:' + pct + '%;"></div>' +
            '</div>' +
            '<div class="memoria-actions">' +
              '<button type="button" class="btn btn-secondary btn-sm btn-edit-md">' + (podeEditar ? 'Editar Doc' : 'Visualizar Doc') + '</button>' +
              '<button type="button" class="btn btn-ghost btn-sm btn-copy-md">Copiar Contexto</button>' +
              (item.url ? '<a href="' + window.OlymposApp.escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" class="folder-chip" style="margin-left:auto;">Google Docs ↗</a>' : '') +
            '</div>' +
          '</div>';

        const btnEdit = card.querySelector('.btn-edit-md');
        if (btnEdit) {
          btnEdit.addEventListener('click', function() {
            abrirEditor(item.id || item.arquivo);
          });
        }
        const btnCopy = card.querySelector('.btn-copy-md');
        if (btnCopy) {
          btnCopy.addEventListener('click', function() {
            copiarPersona(item.nome);
          });
        }
      } else {
        card.innerHTML =
          '<div>' +
            '<div class="memoria-header">' +
              '<div class="persona-emblem is-host-routed" aria-hidden="true">' + iconSvg + '</div>' +
              '<div class="memoria-title-wrap">' +
                '<div class="memoria-name">' + window.OlymposApp.escapeHtml(item.nome) + '</div>' +
                '<div class="memoria-domain">' + window.OlymposApp.escapeHtml(item.dominio) + '</div>' +
              '</div>' +
              '<span class="pill-badge pill-blue">Via ' + window.OlymposApp.escapeHtml(item.anfitriao) + '</span>' +
            '</div>' +
            '<div class="memoria-alerts-preview" style="margin-top:12px;">' +
              'Persona auxiliar roteada (prevenção de fragmentação): registra despachos no Google Docs de <strong>' + window.OlymposApp.escapeHtml(item.anfitriao) + '</strong> (<code>' + window.OlymposApp.escapeHtml(item.arquivo) + '</code>).' +
            '</div>' +
          '</div>' +
          '<div class="memoria-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm btn-open-host">Inspecionar Memória de ' + window.OlymposApp.escapeHtml(item.anfitriao) + '</button>' +
            (item.urlAnfitriao ? '<a href="' + window.OlymposApp.escapeHtml(item.urlAnfitriao) + '" target="_blank" rel="noopener noreferrer" class="folder-chip" style="margin-left:auto;">Doc Anfitrião ↗</a>' : '') +
          '</div>';

        const btnHost = card.querySelector('.btn-open-host');
        if (btnHost) {
          btnHost.addEventListener('click', function() {
            abrirEditor(item.idAnfitriao || item.arquivo);
          });
        }
      }

      grid.appendChild(card);
    });
  }

  function filtrarMemorias() {
    const input = document.getElementById('memoriaSearchInput');
    const termo = input ? input.value.toLowerCase().trim() : '';
    const todas = montarListaCompleta();

    const filtradasPorCategoria = todas.filter(function(item) {
      if (!activeCategoryFilter || activeCategoryFilter === 'TODAS') return true;
      if (activeCategoryFilter === 'GOOGLE_DOCS') return !item.isHostRouted;
      if (activeCategoryFilter === 'ANFITRIAS') return item.isHostRouted;
      return !item.isHostRouted && String(item.perfilRbac || '').toUpperCase() === activeCategoryFilter;
    });

    if (!termo) {
      renderizarGrade(filtradasPorCategoria);
      return;
    }

    renderizarGrade(filtradasPorCategoria.filter(function(item) {
      return item.nome.toLowerCase().includes(termo) ||
        item.dominio.toLowerCase().includes(termo) ||
        (item.arquivo && item.arquivo.toLowerCase().includes(termo)) ||
        (item.id && item.id.toLowerCase().includes(termo)) ||
        (item.anfitriao && item.anfitriao.toLowerCase().includes(termo));
    }));
  }

  function handleEnviarAlertaRapido() {
    const arq = document.getElementById('quickAlertTargetSelect').value;
    const msg = document.getElementById('quickAlertMessageInput').value.trim();

    if (!msg) {
      window.OlymposApp.showToast('Digite o recado para o Correio do Olimpo.', true);
      return;
    }

    const onSuccess = function(res) {
      if (res && res.ok !== false && res.status !== 'ERRO_NAO_ENCONTRADO') {
        window.OlymposApp.showToast('Recado gravado no documento Google Docs (' + arq + ')!');
        document.getElementById('quickAlertMessageInput').value = '';
        carregarMemorias(true);
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao gravar recado.', true);
      }
    };
    const onError = function(err) {
      window.OlymposApp.showToast('Erro ao gravar recado: ' + ((err && err.message) || 'falha de rede'), true);
    };

    if (window.OlymposApi && typeof window.OlymposApi.registrarRecadoMemoria === 'function') {
      window.OlymposApi.registrarRecadoMemoria(arq, msg, onSuccess, onError);
    } else {
      window.OlymposApi.chamar('registrar_recado_md', { arquivo_md: arq, linha: msg }, onSuccess, onError);
    }
  }

  function abrirEditor(identificador) {
    let found = memorias.find(function(m) {
      return m.id === identificador || m.arquivo === identificador || m.slug === identificador;
    });
    if (!found && window.OLYMPOS_MEMORIAS_CATALOGO) {
      found = window.OLYMPOS_MEMORIAS_CATALOGO.obterPorId(identificador) ||
        window.OLYMPOS_MEMORIAS_CATALOGO.obterPorArquivo(identificador);
    }
    if (!found) {
      found = {
        deus: identificador,
        nome: identificador,
        arquivo: identificador,
        formato: 'GOOGLE_DOCS',
        conteudoCompleto: '# ' + identificador + '\n'
      };
    }
    if (!found.conteudoCompleto && window.OLYMPOS_MEMORIAS_CATALOGO) {
      const cat = window.OLYMPOS_MEMORIAS_CATALOGO.obterPorArquivo(found.arquivo || identificador);
      if (cat && cat.conteudoCompleto) {
        found = Object.assign({}, cat, found, { conteudoCompleto: cat.conteudoCompleto });
      }
    }
    window.OlymposApp.abrirModalMemoria(found);
  }

  function copiarPersona(nomeDeus) {
    let found = memorias.find(function(m) { return m.deus === nomeDeus || m.nome === nomeDeus; });
    if (!found && window.OLYMPOS_MEMORIAS_CATALOGO) {
      found = window.OLYMPOS_MEMORIAS_CATALOGO.obterPorNome(nomeDeus);
    }
    if (!found) return;
    const nome = found.deus || found.nome;
    const docUrl = docsUrlFromId(found.id || found.driveId, found.url);
    const ctx = '### Persona: ' + nome + ' (' + found.arquivo + ')\n' +
      (found.id ? ('Google Docs ID: ' + found.id + '\nLink Oficial: ' + docUrl + '\n') : '') +
      'Domínio: ' + (found.dominio || '') + '\n' +
      'Conteúdo Operacional:\n' + (found.conteudoCompleto || '') + '\n';
    window.OlymposApp.copiarTexto(ctx, 'Contexto de ' + nome);
  }

  function copiarContextoCompletoGemini() {
    let ctx = '# Contexto Consolidado das 22 Memórias Google Docs (Hub Olympos SMEB 2026)\n\n';
    const lista = (memorias && memorias.length)
      ? memorias
      : (window.OLYMPOS_MEMORIAS_CATALOGO ? window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas() : []);
    lista.forEach(function(m) {
      const docUrl = docsUrlFromId(m.id || m.driveId, m.url);
      ctx += '## ' + (m.deus || m.nome) + ' (' + m.arquivo + ')\n';
      ctx += 'Domínio: ' + (m.dominio || '') + ' | Formato: Google Docs | Linhas: ' + (m.totalLinhas || (m.conteudoCompleto ? m.conteudoCompleto.split('\n').length : 0)) + '/60\n';
      if (docUrl) ctx += 'Google Docs: ' + docUrl + '\n';
      if (m.conteudoCompleto) ctx += m.conteudoCompleto + '\n\n';
    });
    window.OlymposApp.copiarTexto(ctx, 'Contexto consolidado das 22 memórias Google Docs');
  }

  return {
    init: init,
    abrirEditor: abrirEditor,
    copiarPersona: copiarPersona,
    recarregar: carregarMemorias,
    montarListaCompleta: montarListaCompleta,
    montarListaCompleta17: montarListaCompleta17
  };
})();
