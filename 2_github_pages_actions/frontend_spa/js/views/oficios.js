/**
 * Hub Olympos V2.1 — Página Modular 2: Emissão de Ofícios (Padrão PR/2018 Híbrido)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.oficios = (function() {
  function init() {
    bindEvents();
    sugerirProximoNumero();
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

    window.OlymposApi.chamar('oficio_emitir', {
      numero: numero,
      destinatario: destinatario,
      assunto: assunto,
      corpo: corpo,
      corpoJson: corpoJson,
      presetPr2018: presetPr2018,
      fecho: fecho
    }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Emitir Ofício no Google Docs';

      const urlFinal = res && (res.url || res.urlArquivo);
      if (res && res.ok && urlFinal) {
        const fileId = res.fileId || extrairFileIdDeUrl(urlFinal);
        const editNovaAbaUrl = fileId ? ('https://docs.google.com/document/d/' + encodeURIComponent(fileId) + '/edit') : urlFinal;
        const embedUrl = fileId ? ('https://docs.google.com/document/d/' + encodeURIComponent(fileId) + '/edit?embedded=true') : '';
        const pdfUrl = (res.pdfExportUrl) || (fileId ? ('https://docs.google.com/document/d/' + encodeURIComponent(fileId) + '/export?format=pdf') : '');

        window.OlymposApp.showToast('Ofício Nº ' + res.numero + '/2026 emitido com sucesso!');

        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '✓';
        outBox.innerHTML =
          '<div class="job-result-header">' +
            '<div class="job-result-title">' +
              '<span class="job-done-badge">' + checkSvg + '</span>' +
              '<span>Finalização Confirmada — Ofício Nº ' + window.OlymposApp.escapeHtml(res.numero) + '/2026 - GS/SMEB</span>' +
            '</div>' +
          '</div>' +
          '<div style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 12px;">' +
            'Expediente gravado na pasta <strong>Ofícios 2026</strong> com formatação PR/2018 e numeração atualizada em <code>_memoria_apolo.md</code>.' +
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
          if (!isNaN(prox)) document.getElementById('oficioNumeroInput').value = String(prox);
        }
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
