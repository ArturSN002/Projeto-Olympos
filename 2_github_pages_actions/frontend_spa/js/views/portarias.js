/**
 * Hub Olympos V2.1 — Página Modular 3: Portarias em Lote (O Pincel de Homero)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.portarias = (function() {
  let catalog = [];
  let pollTimer = null;
  let isCatalogLoaded = false;
  let lastGeneratedFiles = [];

  function init() {
    bindEvents();
    if (!isCatalogLoaded) {
      carregarCatalogo();
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

    bind('subtabBtnPortariasLote', 'click', function() { alternarSubtab('lote'); });
    bind('subtabBtnPortariasLicencas', 'click', function() { alternarSubtab('licencas'); });
    bind('pincelOperacaoSelect', 'change', carregarCatalogo);
    bind('pincelPlanilhaSelect', 'change', handlePlanilhaChange);
    bind('pincelDryRunBtn', 'click', executarDryRun);
    bind('pincelGenerateBtn', 'click', iniciarGeracaoLote);
    bind('pincelStopBtn', 'click', interromperLote);
    bind('copyAllJobLinksBtn', 'click', copiarTodosOsLinks);
    bind('closeJobResultBtn', 'click', function() {
      document.getElementById('pincelCompletedJobBox').classList.add('hidden');
    });
  }

  function alternarSubtab(tabKey) {
    const paneLote = document.getElementById('subpanePortariasLote');
    const paneLic = document.getElementById('subpanePortariasLicencas');
    const btnLote = document.getElementById('subtabBtnPortariasLote');
    const btnLic = document.getElementById('subtabBtnPortariasLicencas');

    const isLic = (tabKey === 'licencas');
    if (btnLote) btnLote.classList.toggle('active', !isLic);
    if (btnLic) btnLic.classList.toggle('active', isLic);
    if (paneLote) paneLote.classList.toggle('hidden', isLic);
    if (paneLic) paneLic.classList.toggle('hidden', !isLic);

    if (isLic && window.OlymposViews.licencas && typeof window.OlymposViews.licencas.init === 'function') {
      window.OlymposViews.licencas.init();
    }
  }

  function carregarCatalogo() {
    const op = document.getElementById('pincelOperacaoSelect').value;
    const planSelect = document.getElementById('pincelPlanilhaSelect');
    planSelect.innerHTML = '<option value="">Carregando planilhas oficiais...</option>';

    window.OlymposApi.chamar('portarias_catalogo', { operacao: op }, function(res) {
      catalog = Array.isArray(res) ? res : ((res && res.planilhas) || []);
      isCatalogLoaded = true;
      planSelect.innerHTML = '';

      if (catalog.length === 0) {
        planSelect.innerHTML = '<option value="">Nenhuma planilha localizada nesta modalidade</option>';
        handlePlanilhaChange();
        return;
      }

      catalog.forEach(function(item, idx) {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.nome + ' (' + ((item.abas && item.abas.length) || 0) + ' abas)';
        if (idx === 0) opt.selected = true;
        planSelect.appendChild(opt);
      });

      handlePlanilhaChange();
    }, function(err) {
      planSelect.innerHTML = '<option value="">Falha ao consultar planilhas</option>';
      window.OlymposApp.showToast('Erro ao carregar catálogo de portarias: ' + err.message, true);
    });
  }

  function handlePlanilhaChange() {
    const planId = document.getElementById('pincelPlanilhaSelect').value;
    const abaSelect = document.getElementById('pincelAbaSelect');
    abaSelect.innerHTML = '';

    const found = catalog.find(function(c) { return c.id === planId; });
    if (!found || !found.abas || found.abas.length === 0) {
      abaSelect.innerHTML = '<option value="">Nenhuma aba de dados disponível</option>';
      return;
    }

    found.abas.forEach(function(aba) {
      const opt = document.createElement('option');
      opt.value = aba;
      opt.textContent = aba;
      abaSelect.appendChild(opt);
    });
  }

  function executarDryRun() {
    const planId = document.getElementById('pincelPlanilhaSelect').value;
    const sheetName = document.getElementById('pincelAbaSelect').value;
    const op = document.getElementById('pincelOperacaoSelect').value;
    const out = document.getElementById('pincelOutput');

    if (!planId || !sheetName) {
      window.OlymposApp.showToast('Selecione uma planilha e uma aba válidas.', true);
      return;
    }

    out.innerHTML = 'Inspecionando linhas pendentes e verificando integridade dos campos obrigatórios...';

    window.OlymposApi.chamar('portarias_dry_run', {
      spreadsheetId: planId,
      sheetName: sheetName,
      operacao: op
    }, function(res) {
      if (!res || !res.ok) {
        out.innerHTML = '<span class="text-danger">' + ((res && res.mensagem) || 'Falha no diagnóstico pré-voo.') + '</span>';
        return;
      }

      const totalPend = res.totalPendentes !== undefined ? res.totalPendentes : (res.pendentes || 0);
      const validas = res.validas !== undefined ? res.validas : 0;
      const invalidas = res.invalidas !== undefined ? res.invalidas : 0;

      let html = '<div style="font-family:var(--font-display); font-weight:700; color:var(--text-main); margin-bottom:10px;">' +
        'Diagnóstico Pré-Voo — ' + window.OlymposApp.escapeHtml(res.planilha || 'Planilha') + ' (' + window.OlymposApp.escapeHtml(res.aba || sheetName) + ')' +
      '</div>';

      html += '<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:12px;">' +
        '<span class="pill-badge pill-gold">Pendentes: ' + totalPend + '</span>' +
        '<span class="pill-badge pill-green">Prontas p/ Emitir: ' + validas + '</span>' +
        '<span class="pill-badge ' + (invalidas > 0 ? 'pill-red' : 'pill-blue') + '">Inconsistências: ' + invalidas + '</span>' +
      '</div>';

      if (res.erros && res.erros.length > 0) {
        html += '<div style="max-height:140px; overflow-y:auto; padding:10px 12px; border-radius:12px; background:var(--danger-soft); color:var(--danger); font-size:12.5px; margin-bottom:12px;">';
        res.erros.forEach(function(e) {
          html += '<div style="margin-bottom:4px;">• <strong>Linha ' + e.linha + '</strong> (' + window.OlymposApp.escapeHtml(e.servidor || '') + '): ' + window.OlymposApp.escapeHtml(e.motivo) + '</div>';
        });
        html += '</div>';
      } else if (totalPend === 0) {
        html += '<div style="font-size:13px; margin-bottom:12px;">Todas as linhas desta aba já estão com status <strong>Documento Gerado</strong>.</div>';
      } else {
        html += '<div style="font-size:13px; color:var(--success); font-weight:600; margin-bottom:12px;">Nenhum erro de preenchimento encontrado! Clique em "Gerar Portarias Pendentes" para emitir os documentos.</div>';
      }

      // Tabela de Valores Reais lidos da Planilha Oficial
      if (res.amostraLinhas && res.amostraLinhas.length > 0) {
        html += '<div style="margin-top:14px; font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:6px;">Registros Identificados na Planilha (' + res.amostraLinhas.length + ' linhas)</div>';
        html += '<div class="table-wrapper" style="max-height:260px; overflow-y:auto;">';
        html += '<table class="clean-table" style="font-size:12px;">';
        html += '<thead><tr><th>Linha</th><th>Servidor(a)</th><th>Matrícula</th><th>Cargo / Função</th><th>Portaria</th><th>Status</th></tr></thead>';
        html += '<tbody>';
        res.amostraLinhas.forEach(function(item) {
          const badgeClass = item.status === 'DOCUMENTO GERADO' ? 'pill-green' : (item.valida ? 'pill-gold' : 'pill-red');
          html += '<tr>' +
            '<td><strong>' + item.linha + '</strong></td>' +
            '<td>' + window.OlymposApp.escapeHtml(item.servidor) + '</td>' +
            '<td>' + window.OlymposApp.escapeHtml(item.matricula || '—') + '</td>' +
            '<td>' + window.OlymposApp.escapeHtml(item.cargo || '—') + '</td>' +
            '<td>' + window.OlymposApp.escapeHtml(item.portaria || 'Automática') + '</td>' +
            '<td><span class="pill-badge ' + badgeClass + '" style="font-size:11px; padding:2px 8px;">' + window.OlymposApp.escapeHtml(item.status) + '</span></td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
      }

      out.innerHTML = html;
    }, function(err) {
      out.innerHTML = '<span class="text-danger">Erro no diagnóstico: ' + window.OlymposApp.escapeHtml(err.message) + '</span>';
    });
  }

  function iniciarGeracaoLote() {
    const planId = document.getElementById('pincelPlanilhaSelect').value;
    const sheetName = document.getElementById('pincelAbaSelect').value;
    const op = document.getElementById('pincelOperacaoSelect').value;
    const btnGen = document.getElementById('pincelGenerateBtn');
    const btnStop = document.getElementById('pincelStopBtn');
    const progBox = document.getElementById('pincelProgressBox');

    if (!planId || !sheetName) {
      window.OlymposApp.showToast('Selecione uma planilha e uma aba válidas.', true);
      return;
    }

    if (!confirm('Iniciar emissão oficial de portarias pendentes na aba "' + sheetName + '"?')) return;

    btnGen.classList.add('hidden');
    btnStop.classList.remove('hidden');
    progBox.classList.remove('hidden');
    document.getElementById('pincelCompletedJobBox').classList.add('hidden');
    atualizarBarraProgresso(0, 1, 'Iniciando lote no Pincel de Homero...');

    window.OlymposApi.chamar('portarias_gerar_lote', {
      spreadsheetId: planId,
      sheetName: sheetName,
      operacao: op
    }, function(res) {
      if (res && res.started === false) {
        btnGen.classList.remove('hidden');
        btnStop.classList.add('hidden');
        progBox.classList.add('hidden');
        window.OlymposApp.showToast(res.message || 'Nenhuma portaria pendente nesta aba.', true);
        return;
      }
      window.OlymposApp.showToast((res && res.message) || 'Processamento de portarias iniciado!');
      iniciarPollingStatus();
    }, function(err) {
      btnGen.classList.remove('hidden');
      btnStop.classList.add('hidden');
      progBox.classList.add('hidden');
      window.OlymposApp.showToast('Erro ao iniciar lote: ' + err.message, true);
    });
  }

  function atualizarBarraProgresso(proc, tot, label) {
    const fill = document.getElementById('pincelProgressFill');
    const num = document.getElementById('pincelProgressNumbers');
    const lbl = document.getElementById('pincelProgressLabel');
    const safeTot = Math.max(1, tot || 1);
    const pct = Math.min(100, Math.round((proc / safeTot) * 100));

    if (fill) fill.style.width = pct + '%';
    if (num) num.textContent = proc + ' / ' + tot + ' (' + pct + '%)';
    if (lbl && label) lbl.textContent = label;
  }

  function iniciarPollingStatus() {
    if (pollTimer) clearInterval(pollTimer);

    const checar = function() {
      window.OlymposApi.chamar('portarias_status_lote', {}, function(status) {
        if (!status) return;

        const emExecucao = Boolean(status.isRunning);
        if (emExecucao) {
          atualizarBarraProgresso(status.processed || 0, status.total || 1, 'Gerando documentos Google Docs em "' + (status.sheetName || '') + '"...');
          return;
        }

        clearInterval(pollTimer);
        pollTimer = null;

        document.getElementById('pincelGenerateBtn').classList.remove('hidden');
        document.getElementById('pincelStopBtn').classList.add('hidden');
        document.getElementById('pincelProgressBox').classList.add('hidden');

        const consolidado = status.ultimoLoteConcluido || status;
        exibirResultadoConclusao(consolidado);
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      }, function() {});
    };

    checar();
    pollTimer = setInterval(checar, 2400);
  }

  function interromperLote() {
    window.OlymposApi.chamar('portarias_parar_lote', {}, function() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      document.getElementById('pincelGenerateBtn').classList.remove('hidden');
      document.getElementById('pincelStopBtn').classList.add('hidden');
      document.getElementById('pincelProgressBox').classList.add('hidden');
      window.OlymposApp.showToast('Execução do lote interrompida.');
    });
  }

  function exibirResultadoConclusao(jobData) {
    const card = document.getElementById('pincelCompletedJobBox');
    const summary = document.getElementById('jobResultSummary');
    const linksList = document.getElementById('jobLinksList');

    const arquivos = jobData.generatedFiles || jobData.arquivosGerados || [];
    const erros = jobData.errors || [];
    lastGeneratedFiles = arquivos;

    card.classList.remove('hidden');
    summary.innerHTML =
      'Lote finalizado na aba <strong>' + window.OlymposApp.escapeHtml(jobData.sheetName || 'Selecionada') + '</strong>: ' +
      '<strong>' + arquivos.length + ' arquivo(s) gerado(s)</strong>' +
      (erros.length > 0 ? ' • <span class="text-danger">' + erros.length + ' linha(s) com erro</span>' : '') +
      '. Clique abaixo para acessar diretamente no Google Docs:';

    window.OlymposApp.renderizarItensLinksGerados(linksList, arquivos);
  }

  function copiarTodosOsLinks() {
    if (!lastGeneratedFiles || lastGeneratedFiles.length === 0) {
      window.OlymposApp.showToast('Nenhum link disponível para copiar.', true);
      return;
    }
    const texto = lastGeneratedFiles.map(function(a) {
      const label = a.portaria ? ('Portaria Nº ' + a.portaria + '/2026 - ' + (a.identificador || '')) : (a.identificador || 'Portaria');
      return label + ': ' + (a.url || '');
    }).join('\n');
    window.OlymposApp.copiarTexto(texto, lastGeneratedFiles.length + ' link(s) do lote');
  }

  return {
    init: init,
    alternarSubtab: alternarSubtab
  };
})();
