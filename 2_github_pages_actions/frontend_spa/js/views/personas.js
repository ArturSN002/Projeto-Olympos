/**
 * Hub Olympos V2.1 — Página Modular 8: As 17 Personas Olympos & 11 Memórias Operacionais (.md)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.personas = (function() {
  let memorias = [];
  let personasExtras = [];
  let isLoaded = false;

  const EXTRAS_DEFAULT = [
    { nome: 'Zeus', camada: 'Camada 1', dominio: 'Oráculo Executivo e Triagem Macro de Demandas', anfitriao: 'Héstia', arquivoAnfitriao: '_memoria_hestia.md', icone: 'zeus' },
    { nome: 'Cadmo', camada: 'Camada 3B', dominio: 'Localizador Cadastral & O Papiro de Cadmo (16 Entes RN)', anfitriao: 'Hera', arquivoAnfitriao: '_memoria_hera.md', icone: 'cadmo' },
    { nome: 'Arquimedes', camada: 'Camada 4', dominio: 'Ciência de Dados Educacionais, Censo e Indicadores', anfitriao: 'Dédalo', arquivoAnfitriao: '_memoria_dedalo.md', icone: 'arquimedes' },
    { nome: 'Hefesto', camada: 'Camada 4', dominio: 'Automação DevOps, GitHub Actions e Integrações GAS', anfitriao: 'Dédalo', arquivoAnfitriao: '_memoria_dedalo.md', icone: 'hefesto' },
    { nome: 'Íris', camada: 'Camada 3B', dominio: 'Comunicação Ágil, Avisos Setoriais e Google Chat', anfitriao: 'Héstia', arquivoAnfitriao: '_memoria_hestia.md', icone: 'iris' },
    { nome: 'Sólon', camada: 'Camada 3B', dominio: 'Técnica Legislativa e Constitucionalidade Municipal', anfitriao: 'Têmis', arquivoAnfitriao: '_memoria_temis.md', icone: 'solon' }
  ];

  function init() {
    bindEvents();
    if (!isLoaded) {
      carregarMemorias();
    } else {
      filtrarMemorias();
    }
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

    bind('syncApoloBtn', 'click', function() {
      window.OlymposApp.showToast('Sincronizando pastas 2026 com _memoria_apolo.md...');
      window.OlymposApi.chamar('olho_apolo_sync', {}, function(res) {
        if (res && res.ok) {
          window.OlymposApp.showToast('Contadores e memórias reconciliados com sucesso!');
          carregarMemorias();
          if (window.OlymposViews && window.OlymposViews.visaoGeral) {
            window.OlymposViews.visaoGeral.recarregar();
          }
        }
      });
    });

    bind('snapshotDedaloBtn', 'click', function() {
      window.OlymposApp.showToast('Gerando Snapshot Consolidado de Dédalo no Google Drive...');
      window.OlymposApi.chamar('snapshot_dedalo', {}, function(res) {
        if (res && res.ok) {
          window.OlymposApp.showToast('Snapshot gerado: ' + (res.arquivoSnapshot || 'Backup concluído'));
          if (res.url) window.open(res.url, '_blank', 'noopener');
        } else {
          window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao gerar snapshot.', true);
        }
      });
    });
  }

  function carregarMemorias() {
    window.OlymposApi.chamar('overview_get', {}, function(res) {
      const data = (res && res.data) ? res.data : res;
      if (data) {
        memorias = data.memorias || [];
        personasExtras = (data.personasExtras && data.personasExtras.length) ? data.personasExtras : EXTRAS_DEFAULT;
        isLoaded = true;
        filtrarMemorias();
      }
    }, function() {
      // Fallback visual offline com catálogo das 17 personas
      const cat = window.OlymposIcons ? window.OlymposIcons.getCatalogo17Personas() : [];
      memorias = cat.filter(function(p) { return p.tipo === 'memoria'; }).map(function(p) {
        return { deus: p.nome, arquivo: p.arquivo, dominio: p.dominio, icone: p.id, totalLinhas: 24, alertasRecentes: [] };
      });
      personasExtras = EXTRAS_DEFAULT;
      filtrarMemorias();
    });
  }

  function montarListaCompleta17() {
    const lista = [];

    memorias.forEach(function(m) {
      lista.push({
        isHostRouted: false,
        nome: m.deus,
        arquivo: m.arquivo,
        dominio: m.dominio || '',
        icone: m.icone || m.deus,
        linhas: m.totalLinhas !== undefined ? m.totalLinhas : (m.linhas || 0),
        atualizadoEm: m.atualizadoEm || '',
        alertas: m.alertasRecentes || [],
        url: m.url || '',
        rawMemoria: m
      });
    });

    const listaExtras = (personasExtras && personasExtras.length) ? personasExtras : EXTRAS_DEFAULT;
    listaExtras.forEach(function(ex) {
      const arqHost = ex.arquivoAnfitriao || ('_memoria_' + String(ex.anfitriao || 'hestia').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() + '.md');
      lista.push({
        isHostRouted: true,
        nome: ex.nome,
        anfitriao: ex.anfitriao,
        arquivo: arqHost,
        dominio: ex.dominio || '',
        icone: ex.icone || ex.nome
      });
    });

    return lista;
  }

  function renderizarGrade(lista) {
    const grid = document.getElementById('memoriasGrid');
    if (!grid) return;

    grid.innerHTML = '';
    if (lista.length === 0) {
      grid.innerHTML = '<div class="output-panel">Nenhuma persona encontrada para o filtro informado.</div>';
      return;
    }

    const session = window.OlymposApp.getSession();
    const podeEditar = !session || !session.perfil || session.perfil.podeEditarMemorias !== false;

    lista.forEach(function(item) {
      const card = document.createElement('div');
      card.className = 'memoria-card';

      const iconSvg = window.OlymposIcons ? window.OlymposIcons.get(item.icone) : '';

      if (!item.isHostRouted) {
        const pct = Math.min(100, Math.round((item.linhas / 60) * 100));
        const alertaPreview = (item.alertas && item.alertas.length > 0)
          ? item.alertas.slice(0, 2).map(function(a) { return window.OlymposApp.escapeHtml(a.replace(/^-\s*/, '')); }).join('<br />')
          : 'Sem alertas pendentes na seção 2 desta memória.';

        card.innerHTML =
          '<div>' +
            '<div class="memoria-header">' +
              '<div class="persona-emblem" aria-hidden="true">' + iconSvg + '</div>' +
              '<div class="memoria-title-wrap">' +
                '<div class="memoria-name">' + window.OlymposApp.escapeHtml(item.nome) + '</div>' +
                '<div class="memoria-domain">' + window.OlymposApp.escapeHtml(item.dominio) + '</div>' +
              '</div>' +
              '<span class="pill-badge pill-gold">' + window.OlymposApp.escapeHtml(item.arquivo) + '</span>' +
            '</div>' +
            '<div class="memoria-alerts-preview" style="margin-top:12px;">' + alertaPreview + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="memoria-meter-info">' +
              '<span>Ocupação Canônica</span>' +
              '<span class="' + (item.linhas > 52 ? 'meter-warning' : '') + '">' + item.linhas + ' / 60 linhas</span>' +
            '</div>' +
            '<div class="meter-track" style="margin-bottom:14px;">' +
              '<div class="meter-bar ' + (item.linhas > 52 ? 'meter-danger' : '') + '" style="width:' + pct + '%;"></div>' +
            '</div>' +
            '<div class="memoria-actions">' +
              (podeEditar ? '<button type="button" class="btn btn-secondary btn-sm btn-edit-md">Editar .md</button>' : '') +
              '<button type="button" class="btn btn-ghost btn-sm btn-copy-md">Copiar Contexto</button>' +
              (item.url ? '<a href="' + window.OlymposApp.escapeHtml(item.url) + '" target="_blank" rel="noopener" class="folder-chip" style="margin-left:auto;">Abrir no Drive ↗</a>' : '') +
            '</div>' +
          '</div>';

        const btnEdit = card.querySelector('.btn-edit-md');
        if (btnEdit) {
          btnEdit.addEventListener('click', function() {
            abrirEditor(item.arquivo);
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
              'Persona sem arquivo isolado (prevenção de fragmentação): registra despachos diretamente em <code>' + window.OlymposApp.escapeHtml(item.arquivo) + '</code>.' +
            '</div>' +
          '</div>' +
          '<div class="memoria-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm btn-open-host">Inspecionar Memória de ' + window.OlymposApp.escapeHtml(item.anfitriao) + '</button>' +
          '</div>';

        const btnHost = card.querySelector('.btn-open-host');
        if (btnHost) {
          btnHost.addEventListener('click', function() {
            abrirEditor(item.arquivo);
          });
        }
      }

      grid.appendChild(card);
    });
  }

  function filtrarMemorias() {
    const input = document.getElementById('memoriaSearchInput');
    const termo = input ? input.value.toLowerCase().trim() : '';
    const todas = montarListaCompleta17();

    if (!termo) {
      renderizarGrade(todas);
      return;
    }

    renderizarGrade(todas.filter(function(item) {
      return item.nome.toLowerCase().includes(termo) ||
        item.dominio.toLowerCase().includes(termo) ||
        (item.arquivo && item.arquivo.toLowerCase().includes(termo)) ||
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

    window.OlymposApi.chamar('registrar_recado_md', { arquivo_md: arq, linha: msg }, function(res) {
      if (res && res.ok) {
        window.OlymposApp.showToast('Recado gravado no arquivo existente ' + arq + '!');
        document.getElementById('quickAlertMessageInput').value = '';
        carregarMemorias();
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao gravar recado.', true);
      }
    });
  }

  function abrirEditor(arquivo) {
    const found = memorias.find(function(m) { return m.arquivo === arquivo; });
    if (!found) {
      window.OlymposApp.showToast('Conecte-se ao Gateway GAS para carregar o conteúdo ao vivo de ' + arquivo + '.', true);
      return;
    }
    window.OlymposApp.abrirModalMemoria(found);
  }

  function copiarPersona(nomeDeus) {
    const found = memorias.find(function(m) { return m.deus === nomeDeus; });
    if (!found) return;
    const ctx = '### Persona: ' + found.deus + ' (' + found.arquivo + ')\n' +
      'Domínio: ' + (found.dominio || '') + '\n' +
      'Conteúdo Operacional:\n' + (found.conteudoCompleto || '') + '\n';
    window.OlymposApp.copiarTexto(ctx, 'Contexto de ' + found.deus);
  }

  function copiarContextoCompletoGemini() {
    let ctx = '# Contexto Consolidado das Memórias Operacionais (Hub Olympos SMEB 2026)\n\n';
    memorias.forEach(function(m) {
      ctx += '## ' + m.deus + ' (' + m.arquivo + ')\n';
      ctx += 'Domínio: ' + (m.dominio || '') + ' | Linhas: ' + (m.totalLinhas || 0) + '/60\n';
      if (m.conteudoCompleto) ctx += m.conteudoCompleto + '\n\n';
    });
    window.OlymposApp.copiarTexto(ctx, 'Contexto consolidado das 11 memórias');
  }

  return {
    init: init,
    abrirEditor: abrirEditor,
    copiarPersona: copiarPersona,
    recarregar: carregarMemorias
  };
})();
