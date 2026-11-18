/**
 * Hub Olympos V2.1 — Página Modular 6: Diário Oficial FEMURN (Fogo de Prometheus — 2 Frentes)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.diarioOficial = (function() {
  let publicacoesUnificadas = [];
  let isLoaded = false;

  function init() {
    bindEvents();
    if (!isLoaded) {
      carregarPainel();
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

    bind('prometheusSyncBtn', 'click', sincronizarMemoriaManual);
    bind('prometheusChatSummaryBtn', 'click', dispararResumoChat);
    bind('prometheusTriggerActionBtn', 'click', dispararColetaGitHubActions);
    bind('prometheusPeriodFilter', 'change', renderizarTabela);
    bind('prometheusSectorFilter', 'change', renderizarTabela);
    bind('prometheusSortFilter', 'change', renderizarTabela);
    bind('prometheusSearchInput', 'input', renderizarTabela);

    // Ordenação por clique nos cabeçalhos da tabela
    const thData = document.getElementById('thDiarioData');
    if (thData && !thData._bound) {
      thData._bound = true;
      thData.addEventListener('click', function() {
        const sortSelect = document.getElementById('prometheusSortFilter');
        if (!sortSelect) return;
        sortSelect.value = (sortSelect.value === 'DATA_DESC') ? 'DATA_ASC' : 'DATA_DESC';
        renderizarTabela();
      });
    }

    const thSetor = document.getElementById('thDiarioSetor');
    if (thSetor && !thSetor._bound) {
      thSetor._bound = true;
      thSetor.addEventListener('click', function() {
        const sortSelect = document.getElementById('prometheusSortFilter');
        if (!sortSelect) return;
        sortSelect.value = (sortSelect.value === 'NOME_AZ') ? 'NOME_ZA' : 'NOME_AZ';
        renderizarTabela();
      });
    }

    bind('diarioSalvarBoletimEmailBtn', 'click', function() {
      const inEl = document.getElementById('diarioBoletimEmailInput');
      if (window.OlymposApp && typeof window.OlymposApp.salvarBoletimEmails === 'function') {
        window.OlymposApp.salvarBoletimEmails(inEl ? inEl.value : '');
      }
    });
  }

  function integrarPublicacoesSupabase(lista) {
    if (!Array.isArray(lista) || lista.length === 0) return;
    const urlsVistas = new Set(publicacoesUnificadas.map(function(x) { return x.url; }));
    const codigosVistos = new Set(publicacoesUnificadas.map(function(x) { return x.codigo; }).filter(Boolean));

    lista.forEach(function(item) {
      const ner = item.conteudo_ner || {};
      const cat = (item.ato_tipo || 'PORTARIA').toUpperCase();
      let setor = item.orgao || 'Gabinete 2026';
      if (cat.includes('PORTARIA')) setor = 'Portarias 2026';
      else if (cat.includes('EDITAL') || cat.includes('PSS') || cat.includes('JURIDICO')) setor = 'Assessoria Jurídica 2026';

      const codigo = item.codigo_femurn || item.edicao || (item.numero_ato ? ('Ato ' + item.numero_ato) : (ner.numero_ato ? ('Ato ' + ner.numero_ato) : ''));
      const url = item.url_drive || item.url_arquivo || item.urlDrive || (ner.url_materia || ner.link_pdf) || 'https://drive.google.com/drive/folders/1qGq5uqxOtN_V63itUheYatLIcj5R86O3';
      if (codigo && codigosVistos.has(codigo)) return;
      if (url && urlsVistas.has(url) && !codigo) return;
      if (url) urlsVistas.add(url);
      if (codigo) codigosVistos.add(codigo);

      publicacoesUnificadas.push({
        data: item.data_publicacao || item.data || '--',
        setor: setor,
        categoria: cat,
        titulo: item.titulo || 'Publicação FEMURN',
        codigo: codigo,
        servidores: (Array.isArray(item.servidores_envolvidos) && item.servidores_envolvidos.length > 0) ? item.servidores_envolvidos : (ner.servidores || []),
        matriculas: (Array.isArray(item.matriculas) && item.matriculas.length > 0) ? item.matriculas : (ner.matriculas || []),
        url: url
      });
    });

    console.log('[Olympos Diário Oficial] Acervo oficial unificado (' + publicacoesUnificadas.length + ' atos):', publicacoesUnificadas);
    renderizarTabela();
  }

  function integrarLinhasPlanilhas(linhas) {
    if (!Array.isArray(linhas) || linhas.length === 0) return;
    const chavesVistas = new Set(publicacoesUnificadas.map(function(x) {
      return (x.url || '') + '|' + (x.codigo || '') + '|' + (x.titulo || '');
    }));

    linhas.forEach(function(item) {
      const chave = (item.url || '') + '|' + (item.codigo || '') + '|' + (item.titulo || '');
      if (chavesVistas.has(chave)) return;
      chavesVistas.add(chave);

      const cat = (item.categoria || 'ATO_OFICIAL').toUpperCase();
      let setor = item.setor || 'Gabinete 2026';
      if (cat.includes('PORTARIA')) setor = 'Portarias 2026';
      else if (cat.includes('EDITAL') || cat.includes('PSS') || cat.includes('JURIDICO')) setor = 'Assessoria Jurídica 2026';

      publicacoesUnificadas.push({
        data: item.data || '--',
        setor: setor,
        categoria: cat,
        titulo: item.titulo || 'Publicação Oficial',
        codigo: item.codigo || (item.numeroAto ? ('Ato ' + item.numeroAto) : ''),
        servidores: item.servidores || [],
        matriculas: item.matriculas || [],
        url: item.url || '',
        origem: item.planilhaNome ? ('Planilha: ' + item.planilhaNome) : 'Planilha Diária'
      });
    });

    console.log('[Olympos Diário Oficial] Linhas de planilhas integradas (' + linhas.length + ' novas, total acumulado: ' + publicacoesUnificadas.length + ')');
    renderizarTabela();
  }

  function parseDataPublicacao(dataStr) {
    if (!dataStr) return null;
    if (dataStr instanceof Date) return isNaN(dataStr.getTime()) ? null : dataStr;
    const s = String(dataStr).trim();
    // yyyy-mm-dd
    const mIso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (mIso) {
      return new Date(parseInt(mIso[1], 10), parseInt(mIso[2], 10) - 1, parseInt(mIso[3], 10));
    }
    // dd-mm-yyyy or dd/mm/yyyy
    const mPt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (mPt) {
      return new Date(parseInt(mPt[3], 10), parseInt(mPt[2], 10) - 1, parseInt(mPt[1], 10));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function verificarFiltroPeriodo(dataStr, filtroPeriodo) {
    if (!filtroPeriodo || filtroPeriodo === 'TODOS') return true;

    const dataAto = parseDataPublicacao(dataStr);
    if (!dataAto) {
      return true;
    }

    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const timestampAto = dataAto.getTime();
    const msPorDia = 24 * 60 * 60 * 1000;

    if (filtroPeriodo === 'SEMANA') {
      const diaSemana = hoje.getDay();
      const diffSegunda = (diaSemana === 0 ? -6 : 1) - diaSemana;
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() + diffSegunda);
      inicioSemana.setHours(0, 0, 0, 0);

      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6);
      fimSemana.setHours(23, 59, 59, 999);

      const limiteSeteDias = new Date(hoje.getTime() - 7 * msPorDia);

      return (timestampAto >= inicioSemana.getTime() && timestampAto <= fimSemana.getTime()) ||
             (timestampAto >= limiteSeteDias.getTime() && timestampAto <= fimSemana.getTime());
    }

    if (filtroPeriodo === '15DIAS') {
      const limite15 = new Date(hoje.getTime() - 15 * msPorDia);
      return timestampAto >= limite15.getTime();
    }

    if (filtroPeriodo === 'MES') {
      return (dataAto.getFullYear() === hoje.getFullYear() && dataAto.getMonth() === hoje.getMonth());
    }

    if (filtroPeriodo === '30DIAS') {
      const limite30 = new Date(hoje.getTime() - 30 * msPorDia);
      return timestampAto >= limite30.getTime();
    }

    return true;
  }

  function carregarPainel() {
    const inDiario = document.getElementById('diarioBoletimEmailInput');
    if (inDiario && !inDiario.value) {
      inDiario.value = localStorage.getItem('olympos_boletim_emails') || '';
    }

    const tbody = document.getElementById('prometheusTableBody');
    if (tbody && window.OlymposApp && typeof window.OlymposApp.renderSkeletonTable === 'function') {
      window.OlymposApp.renderSkeletonTable(tbody, 5, 4, ['15%', '20%', '50%', '15%']);
    }

    // 1. Carrega imediatamente do Supabase (publicacoes_diario) — Prioridade SSOT Zero-Latency (~45ms)
    if (window.OlymposSupabase && typeof window.OlymposSupabase.carregarPublicacoesDiario === 'function') {
      window.OlymposSupabase.carregarPublicacoesDiario().then(function(listaSupabase) {
        if (Array.isArray(listaSupabase) && listaSupabase.length > 0) {
          isLoaded = true;
          integrarPublicacoesSupabase(listaSupabase);
          const stElem = document.getElementById('promWebhookStatus');
          const lrElem = document.getElementById('promLastRun');
          if (stElem) stElem.textContent = 'Acervo do Diário Oficial Conectado • Base Atualizada';
          if (lrElem) lrElem.textContent = 'Última sincronização: Base Atualizada';
        }
      }).catch(function(eSup) {
        console.warn('[DiarioOficial] Consulta Supabase em fallback:', eSup);
      });
    }

    // 2. Consulta Gateway GAS para obter status do webhook (escaneamento de pastas Drive desativado em prol do SSOT)
    window.OlymposApi.chamar('prometheus_status', {}, function(res) {
      const data = (res && res.data) ? res.data : res;
      const stElem = document.getElementById('promWebhookStatus');
      const lrElem = document.getElementById('promLastRun');
      const sheetBtn = document.getElementById('promSheetLinkBtn');

      if (!data || data.status === 'ERRO' || !data.statusWebhook) {
        isLoaded = true;
        if (stElem && publicacoesUnificadas.length === 0) {
          stElem.textContent = 'Integração Pronta • Base de atos oficiais disponível para consulta';
        }
        if (lrElem && publicacoesUnificadas.length === 0) {
          lrElem.textContent = 'Última sincronização: Acervo oficial 2026 atualizado';
        }
        renderizarTabela();
        return;
      }
      isLoaded = true;

      const sw = (typeof data.statusWebhook === 'object' && data.statusWebhook) ? data.statusWebhook : {};

      if (stElem) {
        stElem.textContent = sw.webhookAtivo
          ? 'Atualizações Diárias Ativas (00:10 BRT)'
          : 'Acervo do Diário Oficial Conectado • Base Atualizada';
      }
      if (lrElem) {
        lrElem.textContent = 'Última sincronização: ' + (sw.ultimaExecucao || 'Base Atualizada') +
          (sw.totalSalvos !== undefined ? (' • ' + sw.totalSalvos + ' ato(s) na última edição') : '');
      }
      if (sheetBtn) {
        sheetBtn.href = data.planilhaOficialUrl || 'https://docs.google.com/spreadsheets/d/1tU6rvgB2jNGaGqHK1oecNMQX7-5QcB8Q-1fNgzWcZqs/edit';
      }

      // Extrai linhas das planilhas diárias se houver
      if (Array.isArray(data.linhasPlanilhas) && data.linhasPlanilhas.length > 0) {
        integrarLinhasPlanilhas(data.linhasPlanilhas);
      }

      // Mescla publicações ricas com NER do último webhook
      const urlsVistas = new Set(publicacoesUnificadas.map(function(x) { return x.url; }));

      (sw.publicacoes || []).forEach(function(p) {
        const url = p.urlDrive || p.url || '';
        if (url && urlsVistas.has(url)) return;
        if (url) urlsVistas.add(url);
        let setor = 'Gabinete 2026';
        if (p.categoria === 'PORTARIA') setor = 'Portarias 2026';
        else if (String(p.entidade || '').includes('Câmara')) setor = 'Assessoria Jurídica 2026';

        publicacoesUnificadas.push({
          data: p.data || sw.dataReferencia || '--',
          setor: setor,
          categoria: p.categoria || 'ATO_OFICIAL',
          titulo: p.titulo || 'Publicação FEMURN',
          codigo: p.codigo || '',
          servidores: p.servidores || [],
          matriculas: p.matriculas || [],
          url: url
        });
      });

      // NOTA: Escaneamento de pastas do Drive desativado conforme especificação SSOT.
      // Atos oficiais são consumidos exclusivamente de public.publicacoes_diario.

      renderizarTabela();
    }, function(err) {
      console.info('[DiarioOficial] Painel GAS offline ou não autenticado. Mantendo dados Supabase.');
      isLoaded = true;
      renderizarTabela();
    });
  }

  function renderizarTabela() {
    const tbody = document.getElementById('prometheusTableBody');
    if (!tbody) return;

    const periodSelect = document.getElementById('prometheusPeriodFilter');
    const periodFilter = periodSelect ? periodSelect.value : 'SEMANA';
    const sectorFilter = document.getElementById('prometheusSectorFilter').value;
    const termFilter = document.getElementById('prometheusSearchInput').value.toLowerCase().trim();

    const filtered = publicacoesUnificadas.filter(function(p) {
      const matchPeriod = verificarFiltroPeriodo(p.data, periodFilter);
      const matchSector = (sectorFilter === 'TODOS' || p.setor === sectorFilter);
      const blob = [p.titulo, p.codigo, p.categoria, (p.servidores || []).join(' '), (p.matriculas || []).join(' '), p.origem || ''].join(' ').toLowerCase();
      const matchTerm = (!termFilter || blob.includes(termFilter));
      return matchPeriod && matchSector && matchTerm;
    });

    const sortSelect = document.getElementById('prometheusSortFilter');
    const sortFilter = sortSelect ? sortSelect.value : 'DATA_DESC';

    const indData = document.getElementById('sortIndicatorData');
    const indNome = document.getElementById('sortIndicatorNome');
    if (indData) indData.innerHTML = window.OlymposIcons ? window.OlymposIcons.ui(sortFilter === 'DATA_DESC' ? 'chevronDown' : (sortFilter === 'DATA_ASC' ? 'chevronUp' : 'arrowUpDown')) : '';
    if (indNome) indNome.innerHTML = window.OlymposIcons ? window.OlymposIcons.ui(sortFilter === 'NOME_AZ' ? 'chevronDown' : (sortFilter === 'NOME_ZA' ? 'chevronUp' : 'arrowUpDown')) : '';

    filtered.sort(function(a, b) {
      if (sortFilter === 'DATA_DESC') {
        const da = parseDataPublicacao(a.data);
        const db = parseDataPublicacao(b.data);
        const ta = da ? da.getTime() : 0;
        const tb = db ? db.getTime() : 0;
        return tb - ta;
      } else if (sortFilter === 'DATA_ASC') {
        const da = parseDataPublicacao(a.data);
        const db = parseDataPublicacao(b.data);
        const ta = da ? da.getTime() : 0;
        const tb = db ? db.getTime() : 0;
        return ta - tb;
      } else if (sortFilter === 'NOME_AZ') {
        return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR');
      } else if (sortFilter === 'NOME_ZA') {
        return (b.titulo || '').localeCompare(a.titulo || '', 'pt-BR');
      }
      return 0;
    });

    const activeBadge = document.getElementById('prometheusActivePeriodBadge');
    const countSummary = document.getElementById('prometheusCountSummary');
    if (activeBadge && periodSelect) {
      const opt = periodSelect.options[periodSelect.selectedIndex];
      activeBadge.textContent = opt ? opt.text.replace(/^[^\wÀ-ÿ]+/g, '').trim() : 'Esta Semana';
    }
    if (countSummary) {
      countSummary.textContent = 'Exibindo ' + filtered.length + ' ato(s) • Total no acervo: ' + publicacoesUnificadas.length + ' ato(s)';
    }

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      const isPeriodoRestrito = (periodFilter === 'SEMANA' || periodFilter === '15DIAS' || periodFilter === 'MES');
      const mensagemVazia = isPeriodoRestrito && !termFilter && sectorFilter === 'TODOS'
        ? 'Nenhuma publicação localizada no período selecionado (' + (activeBadge ? activeBadge.textContent : 'Esta Semana') + '). O acervo monitorado conta com ' + publicacoesUnificadas.length + ' ato(s) de edições anteriores.'
        : 'Não foram encontrados atos oficiais ou arquivos para os filtros e termos selecionados. Tente ajustar os parâmetros de pesquisa ou ampliar o período.';

      tbody.innerHTML =
        '<tr>' +
          '<td colspan="4" style="padding: 28px 12px; border: none;">' +
            '<div class="empty-state-card">' +
              '<div class="empty-state-icon">' + (window.OlymposIcons ? window.OlymposIcons.ui('newspaper') : '') + '</div>' +
              '<div class="empty-state-title">Nenhuma publicação localizada no período</div>' +
              '<div class="empty-state-desc">' + mensagemVazia + '</div>' +
              '<div class="empty-state-actions">' +
                (isPeriodoRestrito ? '<button type="button" id="diarioVerTodoAcervoBtn" class="btn btn-accent btn-sm">Ver Todo o Acervo (' + publicacoesUnificadas.length + ')</button>' : '') +
                '<button type="button" id="diarioLimparFiltrosBtn" class="btn btn-secondary btn-sm">Limpar Filtros</button>' +
                '<button type="button" id="diarioAtualizarListaBtn" class="btn btn-primary btn-sm">Atualizar Lista</button>' +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>';

      const btnVerTudo = document.getElementById('diarioVerTodoAcervoBtn');
      if (btnVerTudo) {
        btnVerTudo.addEventListener('click', function() {
          if (periodSelect) periodSelect.value = 'TODOS';
          renderizarTabela();
        });
      }

      const btnClear = document.getElementById('diarioLimparFiltrosBtn');
      if (btnClear) {
        btnClear.addEventListener('click', function() {
          if (periodSelect) periodSelect.value = 'SEMANA';
          const sec = document.getElementById('prometheusSectorFilter');
          const srch = document.getElementById('prometheusSearchInput');
          if (sec) sec.value = 'TODOS';
          if (srch) srch.value = '';
          renderizarTabela();
        });
      }

      const btnRefresh = document.getElementById('diarioAtualizarListaBtn');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
          carregarPainel();
        });
      }
      return;
    }

    filtered.forEach(function(item) {
      const tr = document.createElement('tr');
      const nerBadges = [];
      if (item.codigo) nerBadges.push('Cód. ' + window.OlymposApp.escapeHtml(item.codigo));
      if (item.servidores && item.servidores.length) nerBadges.push('Servidor(es): ' + window.OlymposApp.escapeHtml(item.servidores.join(', ')));
      if (item.matriculas && item.matriculas.length) nerBadges.push('Mat.: ' + window.OlymposApp.escapeHtml(item.matriculas.join(', ')));
      if (item.planilhaNome) {
        const iconHtml = window.OlymposIcons
          ? (typeof window.OlymposIcons.inline === 'function' ? window.OlymposIcons.inline('fileText', 12) : window.OlymposIcons.ui('fileText', 12))
          : '';
        nerBadges.push(iconHtml + ' ' + window.OlymposApp.escapeHtml(item.planilhaNome));
      }

      tr.innerHTML =
        '<td data-label="Data" style="font-family:var(--font-mono); font-size:12px;">' + window.OlymposApp.escapeHtml(item.data) + '</td>' +
        '<td data-label="Setor">' +
          '<span class="pill-badge pill-blue">' + window.OlymposApp.escapeHtml(item.setor) + '</span>' +
        '</td>' +
        '<td data-label="Ato Oficial">' +
          '<div style="font-weight:600; color:var(--text-main);">' + window.OlymposApp.escapeHtml(item.titulo) + '</div>' +
          (nerBadges.length ? '<div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">' + nerBadges.join(' • ') + '</div>' : '') +
        '</td>' +
        '<td data-label="Documento" class="text-right">' +
          (item.url
            ? '<a href="' + window.OlymposApp.escapeHtml(item.url) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Abrir PDF ↗</a>'
            : '<span class="text-muted">--</span>') +
        '</td>';

      tbody.appendChild(tr);
    });
  }

  function sincronizarMemoriaManual() {
    window.OlymposApp.showToast('Sincronizando documentos 2026 com _memoria_helio.md...');
    window.OlymposApi.chamar('prometheus_sync_manual', {}, function(res) {
      if (res && res.ok) {
        window.OlymposApp.showToast(res.mensagem || 'Memória de Hélio sincronizada!');
        carregarPainel();
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao sincronizar.', true);
      }
    });
  }

  function dispararResumoChat() {
    window.OlymposApp.showToast('Enviando resumo executivo ao Google Chat / E-mail...');
    window.OlymposApi.chamar('prometheus_resumo_chat', {}, function(res) {
      if (res && res.ok) {
        window.OlymposApp.showToast(res.mensagem || 'Resumo processado com sucesso!');
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao enviar resumo.', true);
      }
    });
  }

  function dispararColetaGitHubActions() {
    const dt = prompt('Data opcional para varredura na FEMURN (DD/MM/AAAA). Deixe vazio para coletar a edição de hoje:', '');
    if (dt === null) return;

    window.OlymposApp.showToast('Solicitando atualização diária das publicações...');
    window.OlymposApi.chamar('prometheus_disparar_coleta', {
      dataInicio: dt.trim(),
      dataFim: dt.trim()
    }, function(res) {
      if (res && res.ok) {
        window.OlymposApp.showToast(res.mensagem || 'Solicitação enviada com sucesso!');
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Não foi possível disparar remotamente.', true);
      }
    }, function(err) {
      window.OlymposApp.showToast('Erro: ' + err.message, true);
    });
  }

  return {
    init: init
  };
})();
