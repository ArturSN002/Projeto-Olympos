/**
 * Hub Olympos V2.1 — Página Modular 2: Emissão de Ofícios (Padrão PR/2018 Híbrido)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.oficios = (function() {
  let numeracaoSetoresCache = [];
  let setorSelecionado = '';

  function getSetorAlvoOficio() {
    const rbac = window.OlymposRbac;
    const podeEscolher = rbac && typeof rbac.temPermissao === 'function'
      && (rbac.isModerador() || rbac.temPermissao('oficios.ver_todos_setores'));
    const sel = document.getElementById('oficioSetorSelect');
    if (podeEscolher && sel && sel.value) {
      return String(sel.value).toUpperCase();
    }
    const meuSetor = (rbac && typeof rbac.getSetorAtual === 'function' && rbac.getSetorAtual()) || 'GABINETE';
    return meuSetor === 'MODERADOR' ? ((sel && sel.value) || 'GABINETE') : meuSetor;
  }

  function atualizarBannerSerieSetorial() {
    const rbac = window.OlymposRbac;
    const setorCod = getSetorAlvoOficio();
    setorSelecionado = setorCod;
    const info = (rbac && rbac.SETORES_MAP && rbac.SETORES_MAP[setorCod]) || {
      codigo: 'GABINETE',
      nome: 'Gabinete da Secretaria',
      siglaOficio: 'GS',
      pisoOficio2026: null
    };
    const itemNum = numeracaoSetoresCache.find(function(n) { return n.setor_codigo === setorCod; });
    const badgeEl = document.getElementById('oficioSerieBadge');
    const proxEl = document.getElementById('oficioSerieProxNumero');
    const pastaEl = document.getElementById('oficioSeriePastaNome');
    const inputNum = document.getElementById('oficioNumeroInput');

    if (badgeEl) {
      badgeEl.textContent = 'Série: ' + info.siglaOficio + ' — ' + info.nome;
    }
    if (pastaEl) {
      pastaEl.textContent = setorCod === 'GABINETE' ? 'Ofícios 2026 (Raiz GS)' : ('Ofícios 2026 - ' + info.siglaOficio);
    }

    let proxLiveVal = null;
    if (setorCod === 'GABINETE') {
      // Gabinete segue exclusivamente a Memória de Apolo (sem seed estático 155)
      const apoloCache = (typeof window !== 'undefined' && window.OlymposApoloCache) ? window.OlymposApoloCache : null;
      if (apoloCache && apoloCache.fonteApoloDisponivel !== false && Number(apoloCache.proximoOficio2026) > 0) {
        proxLiveVal = Number(apoloCache.proximoOficio2026);
      } else {
        const kpiElem = document.getElementById('kpiProximoOficio');
        const txtKpi = kpiElem && kpiElem.textContent ? String(kpiElem.textContent) : '';
        const m = txtKpi && txtKpi.indexOf('--') === -1 ? txtKpi.match(/\d+/) : null;
        if (m) proxLiveVal = Number(m[0]);
      }
    } else {
      proxLiveVal = itemNum && itemNum.proximo_numero ? Number(itemNum.proximo_numero) : null;
    }

    if (proxEl) {
      if (proxLiveVal) {
        proxEl.textContent = String(proxLiveVal).padStart(3, '0') + '/2026';
      } else if (setorCod === 'GABINETE') {
        proxEl.textContent = '-- (Memória de Apolo)';
      } else {
        proxEl.textContent = '-- (Piso ' + String(info.pisoOficio2026 || 1).padStart(3, '0') + '/2026)';
      }
    }
    const userEdited = Boolean(inputNum && inputNum.dataset && inputNum.dataset.userEdited);
    if (inputNum && !userEdited) {
      if (proxLiveVal) {
        inputNum.value = String(proxLiveVal);
      } else if (setorCod === 'GABINETE') {
        inputNum.value = '';
        inputNum.placeholder = '--';
      }
    }
  }

  async function carregarNumeracaoSetorialOficios() {
    const setorCod = getSetorAlvoOficio();
    if (setorCod !== 'GABINETE' && window.OlymposSupabase && typeof window.OlymposSupabase.listarNumeracaoVisivel === 'function') {
      try {
        const res = await window.OlymposSupabase.listarNumeracaoVisivel(2026);
        if (res && res.ok && Array.isArray(res.oficios)) {
          numeracaoSetoresCache = res.oficios;
        }
      } catch (_eNum) {}
    } else if (setorCod === 'GABINETE') {
      const hasApoloCache = Boolean(
        typeof window !== 'undefined' &&
        window.OlymposApoloCache &&
        window.OlymposApoloCache.fonteApoloDisponivel !== false &&
        Number(window.OlymposApoloCache.proximoOficio2026) > 0
      );
      if (!hasApoloCache && window.OlymposSupabase && typeof window.OlymposSupabase.carregarNumeracaoGabinete === 'function') {
        try {
          const cab = await window.OlymposSupabase.carregarNumeracaoGabinete();
          if (cab && Number(cab.proximoOficio2026) > 0) {
            window.OlymposApoloCache = cab;
          }
        } catch (_eCab) {}
      }
      if ((!window.OlymposApoloCache || !window.OlymposApoloCache.proximoOficio2026) &&
          window.OlymposViews && window.OlymposViews.visaoGeral && typeof window.OlymposViews.visaoGeral.recarregar === 'function') {
        window.OlymposViews.visaoGeral.recarregar();
      }
    }
    atualizarBannerSerieSetorial();
  }

  function init() {
    bindEvents();
    const sel = document.getElementById('oficioSetorSelect');
    const rbac = window.OlymposRbac;
    if (sel && rbac && typeof rbac.getSetorAtual === 'function') {
      const s = rbac.getSetorAtual();
      if (s && s !== 'MODERADOR') sel.value = s;
    }
    sugerirProximoNumero();
    void carregarNumeracaoSetorialOficios();
    if (window.OlymposOficiosBridge && typeof window.OlymposOficiosBridge.aplicarPendingDispatchContext === 'function') {
      window.OlymposOficiosBridge.aplicarPendingDispatchContext();
    }
  }

  function bindEvents() {
    const btnGerar = document.getElementById('gerarOficioRapidoBtn');
    if (btnGerar && !btnGerar._bound) {
      btnGerar._bound = true;
      btnGerar.addEventListener('click', handleGerarOficio);
    }

    const selSetor = document.getElementById('oficioSetorSelect');
    if (selSetor && !selSetor._bound && typeof selSetor.addEventListener === 'function') {
      selSetor._bound = true;
      selSetor.addEventListener('change', function() {
        const inputNum = document.getElementById('oficioNumeroInput');
        if (inputNum && inputNum.dataset) delete inputNum.dataset.userEdited;
        atualizarBannerSerieSetorial();
      });
    }

    const inputNum = document.getElementById('oficioNumeroInput');
    if (inputNum && !inputNum._boundUserEdit && typeof inputNum.addEventListener === 'function') {
      inputNum._boundUserEdit = true;
      inputNum.addEventListener('input', function() {
        if (inputNum.dataset) inputNum.dataset.userEdited = inputNum.value ? '1' : '';
      });
    }

    const btnCloseEmbed = document.getElementById('oficioFecharEmbedBtn');
    if (btnCloseEmbed && !btnCloseEmbed._bound) {
      btnCloseEmbed._bound = true;
      btnCloseEmbed.addEventListener('click', function() {
        const wrap = document.getElementById('oficioDocsEmbedWrap');
        const iframe = document.getElementById('oficioDocsEmbedIframe');
        if (wrap) wrap.classList.add('hidden');
        if (iframe) iframe.setAttribute('src', 'about:blank');
      });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !window._olymposOficiosApoloBound) {
      window._olymposOficiosApoloBound = true;
      window.addEventListener('olympos:apolo-numeracao-atualizada', function() {
        atualizarBannerSerieSetorial();
      });
    }
  }

  function sugerirProximoNumero() {
    const kpiElem = document.getElementById('kpiProximoOficio');
    const inputNumero = document.getElementById('oficioNumeroInput');
    if (kpiElem && inputNumero) {
      if (kpiElem.textContent.includes('--')) {
        inputNumero.value = '';
        inputNumero.placeholder = '--';
      } else {
        const match = kpiElem.textContent.match(/\d+/);
        if (match) inputNumero.value = match[0];
      }
    }
  }

  function extrairFileIdDeUrl(url) {
    const m = String(url || '').match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : '';
  }

  function handleGerarOficio() {
    const numero = document.getElementById('oficioNumeroInput').value.trim();
    const destinatario = document.getElementById('oficioDestinatarioInput').value.trim();
    const assunto = document.getElementById('oficioAssuntoInput').value.trim();
    const fecho = document.getElementById('oficioFechoSelect').value;
    const btn = document.getElementById('gerarOficioRapidoBtn');
    const outBox = document.getElementById('oficioRapidoOutput');

    const richEditor = window.OlymposOficioEditor;
    const corpoJson = richEditor && typeof richEditor.getCorpoJson === 'function' ? richEditor.getCorpoJson() : null;
    const presetPr2018 = richEditor && typeof richEditor.getPresetConfig === 'function'
      ? richEditor.getPresetConfig()
      : { indentFirstLine: true, lineSpacing: 1.15 };
    const corpo = (richEditor && typeof richEditor.getCorpoTextoPlano === 'function'
      ? richEditor.getCorpoTextoPlano()
      : document.getElementById('oficioCorpoInput').value.trim());

    if (!destinatario || !assunto || (!corpo && !corpoJson)) {
      window.OlymposApp.showToast('Preencha Destinatário, Assunto e Texto Oficial do Ofício.', true);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Gerando Ofício no Google Docs...';
    outBox.classList.add('hidden');

    const setorCod = getSetorAlvoOficio();
    const rbac = window.OlymposRbac;
    const setorMeta = (rbac && rbac.SETORES_MAP && rbac.SETORES_MAP[setorCod]) || {
      nome: 'Gabinete da Secretaria',
      siglaOficio: 'GS'
    };

    window.OlymposApi.chamar('oficio_emitir', {
      numero: numero,
      destinatario: destinatario,
      assunto: assunto,
      corpo: corpo,
      corpoJson: corpoJson,
      presetPr2018: presetPr2018,
      fecho: fecho,
      setorCodigo: setorCod,
      siglaSetor: setorMeta.siglaOficio,
      setorNome: setorMeta.nome
    }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Emitir Ofício no Google Docs';

      const urlFinal = res && (res.url || res.urlArquivo);
      if (res && res.ok && urlFinal) {
        const fileId = res.fileId || extrairFileIdDeUrl(urlFinal);
        const editNovaAbaUrl = fileId ? ('https://docs.google.com/document/d/' + encodeURIComponent(fileId) + '/edit') : urlFinal;
        const embedUrl = fileId ? ('https://docs.google.com/document/d/' + encodeURIComponent(fileId) + '/edit?embedded=true') : '';
        const pdfUrl = (res.pdfExportUrl) || (fileId ? ('https://docs.google.com/document/d/' + encodeURIComponent(fileId) + '/export?format=pdf') : '');
        const siglaOut = res.siglaSetor || setorMeta.siglaOficio || 'GS';

        window.OlymposApp.showToast('Ofício Nº ' + res.numero + '/2026 (' + siglaOut + ') emitido com sucesso!');

        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '✓';
        outBox.innerHTML =
          '<div class="job-result-header">' +
            '<div class="job-result-title">' +
              '<span class="job-done-badge">' + checkSvg + '</span>' +
              '<span>Finalização Confirmada — Ofício Nº ' + window.OlymposApp.escapeHtml(res.numero) + '/2026 - ' + window.OlymposApp.escapeHtml(siglaOut) + '/SMEB</span>' +
            '</div>' +
          '</div>' +
          '<div style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 12px;">' +
            (setorCod === 'GABINETE'
              ? 'Expediente gravado na pasta <strong>Ofícios 2026</strong> com formatação PR/2018 e numeração atualizada em <code>_memoria_apolo.md</code>.'
              : 'Expediente gravado na subpasta setorial <strong>Ofícios 2026 - ' + window.OlymposApp.escapeHtml(siglaOut) + '</strong> com formatação PR/2018 (numeração setorial independente).') +
          '</div>' +
          '<div class="button-group" style="margin-bottom: 12px; flex-wrap: wrap;">' +
            '<a href="' + window.OlymposApp.escapeHtml(editNovaAbaUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Editar no Google Docs (Nova Aba) ↗</a>' +
            (embedUrl ? '<button type="button" id="btnAbrirOficioEmbutido" class="btn btn-secondary btn-sm">Abrir Editor Embutido (Experimental)</button>' : '') +
            (pdfUrl ? '<a href="' + window.OlymposApp.escapeHtml(pdfUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm">Baixar PDF</a>' : '') +
            '<button type="button" id="btnAtualizarAcervoOficio" class="btn btn-ghost btn-sm">Atualizar Tabela de Ofícios</button>' +
          '</div>' +
          '<div class="job-links-list" id="oficioGeneratedList"></div>';

        outBox.classList.remove('hidden');

        const btnEmbed = document.getElementById('btnAbrirOficioEmbutido');
        if (btnEmbed && embedUrl) {
          btnEmbed.addEventListener('click', function() {
            const wrap = document.getElementById('oficioDocsEmbedWrap');
            const iframe = document.getElementById('oficioDocsEmbedIframe');
            if (iframe) iframe.setAttribute('src', embedUrl);
            if (wrap) {
              wrap.classList.remove('hidden');
              wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }

        const btnRefreshAcervo = document.getElementById('btnAtualizarAcervoOficio');
        if (btnRefreshAcervo) {
          btnRefreshAcervo.addEventListener('click', function() {
            if (window.OlymposDocumentosAcervo && typeof window.OlymposDocumentosAcervo.recarregar === 'function') {
              window.OlymposDocumentosAcervo.recarregar('OFICIO');
            }
          });
        }

        window.OlymposApp.renderizarItensLinksGerados(
          document.getElementById('oficioGeneratedList'),
          [{
            titulo: res.nomeArquivo || ('Ofício Nº ' + res.numero + '/2026 - GS/SMEB'),
            detalhe: destinatario + ' • ' + assunto,
            url: urlFinal
          }]
        );

        document.getElementById('oficioDestinatarioInput').value = '';
        document.getElementById('oficioAssuntoInput').value = '';
        document.getElementById('oficioCorpoInput').value = '';
        if (richEditor && typeof richEditor.clear === 'function') {
          richEditor.clear();
        }
        if (res.numero) {
          const prox = parseInt(String(res.numero), 10) + 1;
          const inpNum = document.getElementById('oficioNumeroInput');
          if (inpNum && !isNaN(prox)) {
            delete inpNum.dataset.userEdited;
            inpNum.value = String(prox);
          }
        }
        void carregarNumeracaoSetorialOficios();
        if (window.OlymposOficiosBridge && typeof window.OlymposOficiosBridge.vincularOficioEmitidoAPendencia === 'function') {
          window.OlymposOficiosBridge.vincularOficioEmitidoAPendencia({
            fileId: fileId,
            numero: res.numero,
            url: urlFinal,
            documentoId: res.documentoId || res.documentId || null
          });
        }
        if (window.OlymposDocumentosAcervo && typeof window.OlymposDocumentosAcervo.recarregar === 'function') {
          window.OlymposDocumentosAcervo.recarregar('OFICIO');
        }
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao gerar ofício.', true);
      }
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Emitir Ofício no Google Docs';
      window.OlymposApp.showToast('Erro ao emitir ofício: ' + err.message, true);
    });
  }

  return {
    init: init
  };
})();
