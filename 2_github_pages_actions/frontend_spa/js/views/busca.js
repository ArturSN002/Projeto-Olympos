/**
 * Hub Olympos V2.1 — Página Modular 9: Busca Global Recursiva Multi-Ano (2025–2026)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.busca = (function() {
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
        tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center" style="padding: 24px;">' + window.OlymposApp.escapeHtml((res && res.mensagem) || 'Falha na pesquisa.') + '</td></tr>';
        statusMsg.textContent = 'Não foi possível concluir a busca.';
        return;
      }

      const resultados = res.resultados || [];
      statusMsg.textContent = resultados.length + ' arquivo(s) localizado(s) para "' + termo + '" em ' + elapsed + ' ms.';

      if (resultados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center" style="padding: 28px;">Nenhum documento encontrado para os termos informados.</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      resultados.forEach(function(item) {
        const tr = document.createElement('tr');
        const dt = item.dataCriacao || item.dataModificacao || '--';
        const url = item.url || '';

        tr.innerHTML =
          '<td><span class="pill-badge ' + (item.ano === '2026' ? 'pill-green' : 'pill-blue') + '">' + window.OlymposApp.escapeHtml(item.ano || '2026') + '</span></td>' +
          '<td style="font-size:12.5px; font-weight:600; color:var(--text-secondary);">' + window.OlymposApp.escapeHtml(item.setor || '') + '</td>' +
          '<td style="font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">' + window.OlymposApp.escapeHtml(dt) + '</td>' +
          '<td style="font-weight:600; color:var(--text-main);">' + window.OlymposApp.escapeHtml(item.nome || '') + '</td>' +
          '<td class="text-right">' +
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
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Pesquisar Acervo';
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
