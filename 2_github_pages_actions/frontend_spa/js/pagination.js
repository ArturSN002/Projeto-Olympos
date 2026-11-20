/**
 * Hub Olympos — Helper Reutilizável de Paginação (Padrão Tabela de Servidores)
 * Centraliza cálculo de janelas de página, fatiamento seguro e renderização dos botões Ant / 1..N / Próx.
 */
(function(root) {
  'use strict';

  function resolverElemento(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') {
      return typeof document !== 'undefined' ? document.getElementById(ref) : null;
    }
    return ref;
  }

  function calcularJanela(paginaAtual, totalPaginas, maxBotoes) {
    var max = (typeof maxBotoes === 'number' && maxBotoes > 0) ? maxBotoes : 5;
    var total = Math.max(1, parseInt(totalPaginas, 10) || 1);
    var atual = Math.min(Math.max(1, parseInt(paginaAtual, 10) || 1), total);
    var startPage = Math.max(1, atual - Math.floor(max / 2));
    var endPage = Math.min(total, startPage + max - 1);
    if (endPage - startPage < max - 1) {
      startPage = Math.max(1, endPage - max + 1);
    }
    return { startPage: startPage, endPage: endPage };
  }

  function paginarLista(lista, paginaAtual, itensPorPagina) {
    var arr = Array.isArray(lista) ? lista : [];
    var perPage = Math.max(1, parseInt(itensPorPagina, 10) || 20);
    var totalItens = arr.length;
    var totalPaginas = Math.max(1, Math.ceil(totalItens / perPage));
    var pag = parseInt(paginaAtual, 10) || 1;
    if (pag < 1) pag = 1;
    if (pag > totalPaginas) pag = totalPaginas;

    var inicioIndice = (pag - 1) * perPage;
    var items = arr.slice(inicioIndice, inicioIndice + perPage);
    var inicio = totalItens === 0 ? 0 : inicioIndice + 1;
    var fim = Math.min(pag * perPage, totalItens);

    return {
      items: items,
      paginaAtual: pag,
      totalPaginas: totalPaginas,
      totalItens: totalItens,
      itensPorPagina: perPage,
      inicio: inicio,
      fim: fim,
      inicioIndice: inicioIndice
    };
  }

  function gerarBotoesHtml(paginaAtual, totalPaginas, maxBotoes) {
    var iconLeft = (typeof window !== 'undefined' && window.OlymposIcons && typeof window.OlymposIcons.ui === 'function')
      ? window.OlymposIcons.ui('arrowLeft')
      : '&laquo;';
    var iconRight = (typeof window !== 'undefined' && window.OlymposIcons && typeof window.OlymposIcons.ui === 'function')
      ? window.OlymposIcons.ui('arrowRight')
      : '&raquo;';

    var janela = calcularJanela(paginaAtual, totalPaginas, maxBotoes);
    var isFirst = paginaAtual <= 1;
    var isLast = paginaAtual >= totalPaginas;

    var parts = [];
    parts.push(
      '<button type="button" class="btn-mini' + (isFirst ? ' disabled' : '') + '"' +
        (isFirst ? ' disabled="disabled" aria-disabled="true"' : '') +
        ' data-ir-pag="ant" title="Página Anterior">' + iconLeft + ' Ant</button>'
    );

    for (var p = janela.startPage; p <= janela.endPage; p++) {
      parts.push(
        '<button type="button" class="btn-mini' + (p === paginaAtual ? ' active' : '') + '"' +
          (p === paginaAtual ? ' aria-current="page"' : '') +
          ' data-ir-pag="' + p + '">' + p + '</button>'
      );
    }

    parts.push(
      '<button type="button" class="btn-mini' + (isLast ? ' disabled' : '') + '"' +
        (isLast ? ' disabled="disabled" aria-disabled="true"' : '') +
        ' data-ir-pag="prox" title="Próxima Página">Próx ' + iconRight + '</button>'
    );

    return parts.join('');
  }

  function renderizarControles(config) {
    var cfg = config || {};
    var totalItens = Math.max(0, parseInt(cfg.totalItens, 10) || 0);
    var itensPorPagina = Math.max(1, parseInt(cfg.itensPorPagina, 10) || 20);
    var totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
    var paginaAtual = Math.min(Math.max(1, parseInt(cfg.paginaAtual, 10) || 1), totalPaginas);
    var inicio = totalItens === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1;
    var fim = Math.min(paginaAtual * itensPorPagina, totalItens);
    var rotuloItem = cfg.rotuloItem || 'registros';
    var rotuloVazio = cfg.rotuloVazio || 'Nenhum registro localizado';

    var statusEl = resolverElemento(cfg.statusEl || cfg.statusId);
    if (statusEl) {
      statusEl.textContent = totalItens === 0
        ? rotuloVazio
        : ('Exibindo ' + inicio + '–' + fim + ' de ' + totalItens + ' ' + rotuloItem);
    }

    var infoEl = resolverElemento(cfg.infoEl || cfg.infoId);
    if (infoEl) {
      infoEl.textContent = 'Página ' + paginaAtual + ' de ' + totalPaginas + ' (' + totalItens + ' resultados)';
    }

    var barEl = resolverElemento(cfg.barEl || cfg.barId);
    var esconderBarra = (totalItens === 0) || (Boolean(cfg.ocultarSePaginaUnica) && totalPaginas <= 1);
    if (barEl && barEl.classList) {
      barEl.classList.toggle('hidden', esconderBarra);
    }

    var sourceContainers = cfg.containers || cfg.containerIds;
    var rawContainers = Array.isArray(sourceContainers)
      ? sourceContainers
      : (sourceContainers
          ? [sourceContainers]
          : (cfg.container
              ? [cfg.container]
              : (cfg.containerId ? [cfg.containerId] : [])));

    var botoesHtml = esconderBarra ? '' : gerarBotoesHtml(paginaAtual, totalPaginas, cfg.maxBotoes || 5);

    rawContainers.forEach(function(ref) {
      var container = resolverElemento(ref);
      if (!container) return;
      container.innerHTML = botoesHtml;
      if (!botoesHtml) return;

      container.querySelectorAll('button[data-ir-pag]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var target = this.getAttribute('data-ir-pag');
          var nextPage = paginaAtual;
          if (target === 'ant') {
            if (paginaAtual > 1) nextPage = paginaAtual - 1;
          } else if (target === 'prox') {
            if (paginaAtual < totalPaginas) nextPage = paginaAtual + 1;
          } else {
            var parsed = parseInt(target, 10);
            if (!isNaN(parsed)) nextPage = parsed;
          }

          if (nextPage !== paginaAtual && typeof cfg.onPageChange === 'function') {
            cfg.onPageChange(nextPage);
          }
        });
      });
    });

    return {
      paginaAtual: paginaAtual,
      totalPaginas: totalPaginas,
      totalItens: totalItens,
      inicio: inicio,
      fim: fim
    };
  }

  var OlymposPagination = {
    calcularJanela: calcularJanela,
    paginarLista: paginarLista,
    renderizarControles: renderizarControles
  };

  if (typeof root !== 'undefined') {
    root.OlymposPagination = OlymposPagination;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OlymposPagination;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
