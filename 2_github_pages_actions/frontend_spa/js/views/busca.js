/**
 * Hub Olympos V2.1 — Página Modular 9: Busca Global Recursiva Multi-Ano (2025–2026)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.busca = (function() {
  let resultadosCache = [];
  let sortModeBusca = 'data_desc';
  let paginaAtual = 1;
  const ITENS_POR_PAGINA = 15;

  function init() {
    bindEvents();
  }

  function bindEvents() {
    const btnBuscar = document.getElementById('pageBuscaExecBtn');
    if (btnBuscar && !btnBuscar._bound) {
      btnBuscar._bound = true;
      btnBuscar.addEventListener('click', executarBusca);
    }

    const inSearch = document.getElementById('pageBuscaInput');
    if (inSearch && !inSearch._bound) {
      inSearch._bound = true;
      inSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') executarBusca();
      });
    }

    document.querySelectorAll('[data-quick-query]').forEach(function(chip) {
      if (!chip._bound) {
        chip._bound = true;
        chip.addEventListener('click', function() {
          const q = chip.getAttribute('data-quick-query');
          dispararComTermo(q);
        });
      }
    });

    const selSortBusca = document.getElementById('pageBuscaSortSelect');
    if (selSortBusca && !selSortBusca._bound) {
      selSortBusca._bound = true;
      selSortBusca.addEventListener('change', function() {
        sortModeBusca = selSortBusca.value || 'data_desc';
        paginaAtual = 1;
        renderizarResultados();
      });
    }

    const tblBusca = document.getElementById('pageBuscaTable');
    if (tblBusca && !tblBusca._sortBound) {
      tblBusca._sortBound = true;
      tblBusca.querySelectorAll('th[data-busca-sort]').forEach(function(th) {
        const toggleBusca = function() {
          const col = th.getAttribute('data-busca-sort') || 'data';
          const defDir = (col === 'data' || col === 'ano') ? 'desc' : 'asc';
          if (sortModeBusca === col + '_asc') sortModeBusca = col + '_desc';
          else if (sortModeBusca === col + '_desc') sortModeBusca = col + '_asc';
          else sortModeBusca = col + '_' + defDir;
          if (selSortBusca && Array.from(selSortBusca.options).some(function(o) { return o.value === sortModeBusca; })) {
            selSortBusca.value = sortModeBusca;
          }
          paginaAtual = 1;
          renderizarResultados();
        };
        th.addEventListener('click', toggleBusca);
        th.addEventListener('keydown', function(ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            toggleBusca();
          }
        });
      });
    }
  }

  function ocultarPaginacao() {
    const bar = document.getElementById('buscaPaginacaoBar');
    if (bar) bar.classList.add('hidden');
  }

  function parseDataBuscaTs(item) {
    const raw = String((item && (item.dataCriacao || item.dataModificacao)) || '').trim();
    const mBr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (mBr) return Date.UTC(Number(mBr[3]), Number(mBr[2]) - 1, Number(mBr[1]));
    const ts = Date.parse(raw);
    return isNaN(ts) ? 0 : ts;
  }

  function ordenarResultadosBusca(lista) {
    const modo = String(sortModeBusca || 'data_desc');
    const cmp = function(a, b) {
      return String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
    };
    const copia = (lista || []).slice();
    copia.sort(function(a, b) {
      if (modo === 'data_asc') return (parseDataBuscaTs(a) - parseDataBuscaTs(b)) || cmp(a.nome, b.nome);
      if (modo === 'nome_asc') return cmp(a.nome, b.nome);
      if (modo === 'nome_desc') return cmp(b.nome, a.nome);
      if (modo === 'setor_asc') return cmp(a.setor, b.setor) || cmp(a.nome, b.nome);
      if (modo === 'setor_desc') return cmp(b.setor, a.setor) || cmp(a.nome, b.nome);
      if (modo === 'ano_asc') return (Number(a.ano || 0) - Number(b.ano || 0)) || cmp(a.nome, b.nome);
      if (modo === 'ano_desc') return (Number(b.ano || 0) - Number(a.ano || 0)) || (parseDataBuscaTs(b) - parseDataBuscaTs(a));
      return (parseDataBuscaTs(b) - parseDataBuscaTs(a)) || cmp(a.nome, b.nome);
    });
    return copia;
  }

  function atualizarIndicadoresSortBusca() {
    const tbl = document.getElementById('pageBuscaTable');
    if (!tbl) return;
    const parts = String(sortModeBusca || 'data_desc').split('_');
    const colAtiva = parts[0];
    const dirAtiva = parts[1] === 'desc' ? 'descending' : 'ascending';
    tbl.querySelectorAll('th[data-busca-sort]').forEach(function(th) {
      const c = th.getAttribute('data-busca-sort');
      const ind = th.querySelector('.th-sort-indicator');
      if (c === colAtiva) {
        th.setAttribute('aria-sort', dirAtiva);
        if (ind) ind.textContent = dirAtiva === 'ascending' ? '▲' : '▼';
      } else {
        th.setAttribute('aria-sort', 'none');
        if (ind) ind.textContent = '↕';
      }
    });
  }

  function renderizarResultados() {
    const tbody = document.getElementById('pageBuscaTableBody');
    if (!tbody) return;

    const ordenada = ordenarResultadosBusca(resultadosCache);
    atualizarIndicadoresSortBusca();

    if (!Array.isArray(ordenada) || ordenada.length === 0) {
      ocultarPaginacao();
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center" style="padding: 28px;">Nenhum documento encontrado para os termos informados.</td></tr>';
      return;
    }

    const pag = (window.OlymposPagination && typeof window.OlymposPagination.paginarLista === 'function')
      ? window.OlymposPagination.paginarLista(ordenada, paginaAtual, ITENS_POR_PAGINA)
      : { items: ordenada, paginaAtual: 1, totalPaginas: 1, totalItens: ordenada.length, inicio: 1, fim: ordenada.length };
    paginaAtual = pag.paginaAtual;

    tbody.innerHTML = '';
    pag.items.forEach(function(item) {
      const tr = document.createElement('tr');
      const dt = item.dataCriacao || item.dataModificacao || '--';
      const url = item.url || '';

      tr.innerHTML =
        '<td data-label="Ano"><span class="pill-badge ' + (item.ano === '2026' ? 'pill-green' : 'pill-blue') + '">' + window.OlymposApp.escapeHtml(item.ano || '2026') + '</span></td>' +
        '<td data-label="Setor" style="font-size:12.5px; font-weight:600; color:var(--text-secondary);">' + window.OlymposApp.escapeHtml(item.setor || '') + '</td>' +
        '<td data-label="Criação" style="font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">' + window.OlymposApp.escapeHtml(dt) + '</td>' +
        '<td data-label="Título do Arquivo" style="font-weight:600; color:var(--text-main);">' + window.OlymposApp.escapeHtml(item.nome || '') + '</td>' +
        '<td data-label="Acesso" class="text-right">' +
          '<div class="button-group" style="justify-content:flex-end;">' +
            (url ? '<button type="button" class="btn btn-ghost btn-sm btn-copy-search-url">Copiar</button>' : '') +
            (url ? '<a href="' + window.OlymposApp.escapeHtml(url) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Abrir ↗</a>' : '') +
          '</div>' +
        '</td>';

      const copyBtn = tr.querySelector('.btn-copy-search-url');
      if (copyBtn && url) {
        copyBtn.addEventListener('click', function() {
          window.OlymposApp.copiarTexto(url, 'Link de ' + (item.nome || 'documento'));
        });
      }

      tbody.appendChild(tr);
    });

    if (window.OlymposPagination && typeof window.OlymposPagination.renderizarControles === 'function') {
      const pagRes = window.OlymposPagination.renderizarControles({
        barEl: 'buscaPaginacaoBar',
        containers: 'buscaPaginacaoControles',
        infoEl: 'buscaPaginacaoInfo',
        totalItens: pag.totalItens,
        paginaAtual: paginaAtual,
        itensPorPagina: ITENS_POR_PAGINA,
        rotuloItem: 'documentos',
        onPageChange: function(novaPagina) {
          paginaAtual = novaPagina;
          renderizarResultados();
        }
      });
      paginaAtual = pagRes.paginaAtual;
    }
  }

  function executarBusca() {
    const termo = document.getElementById('pageBuscaInput').value.trim();
    const ano = document.getElementById('pageBuscaAnoSelect').value;
    const btn = document.getElementById('pageBuscaExecBtn');
    const tbody = document.getElementById('pageBuscaTableBody');
    const statusMsg = document.getElementById('pageBuscaStatusMsg');

    if (!termo || (termo !== '*' && termo.length < 2)) {
      window.OlymposApp.showToast('Informe ao menos 2 caracteres (ou * para listar recentes).', true);
      return;
    }

    paginaAtual = 1;
    resultadosCache = [];
    ocultarPaginacao();

    btn.disabled = true;
    btn.textContent = 'Varrendo Drive...';
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center" style="padding: 28px;">Inspecionando pastas setoriais e subpastas recursivamente...</td></tr>';
    statusMsg.textContent = 'Consultando acervos oficiais (' + ano + ')...';

    const t0 = performance.now();
    window.OlymposApi.chamar('pesquisarAcervoGlobalMultiAno', { termo: termo, filtroAno: ano }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Pesquisar Acervo';
      const elapsed = Math.round(performance.now() - t0);

      if (!res || !res.ok) {
        ocultarPaginacao();
        tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center" style="padding: 24px;">' + window.OlymposApp.escapeHtml((res && res.mensagem) || 'Falha na pesquisa.') + '</td></tr>';
        statusMsg.textContent = 'Não foi possível concluir a busca.';
        return;
      }

      resultadosCache = res.resultados || [];
      statusMsg.textContent = resultadosCache.length + ' arquivo(s) localizado(s) para "' + termo + '" em ' + elapsed + ' ms.';
      renderizarResultados();
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Pesquisar Acervo';
      ocultarPaginacao();
      tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center" style="padding: 24px;">Erro: ' + window.OlymposApp.escapeHtml(err.message) + '</td></tr>';
      statusMsg.textContent = 'Falha na comunicação com o motor de busca.';
    });
  }

  function dispararComTermo(termo) {
    const inSearch = document.getElementById('pageBuscaInput');
    if (inSearch) inSearch.value = termo;
    executarBusca();
  }

  return {
    init: init,
    dispararComTermo: dispararComTermo
  };
})();
