/**
 * Hub Olympos V2.1 — Página Modular 2: Emissão de Ofícios (Padrão PR/2018)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.oficios = (function() {
  function init() {
    bindEvents();
    sugerirProximoNumero();
  }

  function bindEvents() {
    const btnGerar = document.getElementById('gerarOficioRapidoBtn');
    if (btnGerar && !btnGerar._bound) {
      btnGerar._bound = true;
      btnGerar.addEventListener('click', handleGerarOficio);
    }
  }

  function sugerirProximoNumero() {
    const kpiElem = document.getElementById('kpiProximoOficio');
    const inputNumero = document.getElementById('oficioNumeroInput');
    if (kpiElem && inputNumero) {
      if (kpiElem.textContent.includes('--')) {
        inputNumero.value = '';
        inputNumero.placeholder = 'Carregando...';
      } else {
        const match = kpiElem.textContent.match(/\d+/);
        if (match) inputNumero.value = match[0];
      }
    }
  }

  function handleGerarOficio() {
    const numero = document.getElementById('oficioNumeroInput').value.trim();
    const destinatario = document.getElementById('oficioDestinatarioInput').value.trim();
    const assunto = document.getElementById('oficioAssuntoInput').value.trim();
    const corpo = document.getElementById('oficioCorpoInput').value.trim();
    const fecho = document.getElementById('oficioFechoSelect').value;
    const btn = document.getElementById('gerarOficioRapidoBtn');
    const outBox = document.getElementById('oficioRapidoOutput');

    if (!destinatario || !assunto) {
      window.OlymposApp.showToast('Preencha ao menos o Destinatário e o Assunto do Ofício.', true);
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
      fecho: fecho
    }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Emitir Ofício no Google Docs';

      const urlFinal = res && (res.url || res.urlArquivo);
      if (res && res.ok && urlFinal) {
        window.OlymposApp.showToast('Ofício Nº ' + res.numero + '/2026 emitido com sucesso!');

        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '✓';
        outBox.innerHTML =
          '<div class="job-result-header">' +
            '<div class="job-result-title">' +
              '<span class="job-done-badge">' + checkSvg + '</span>' +
              '<span>Finalização Confirmada — Ofício Nº ' + window.OlymposApp.escapeHtml(res.numero) + '/2026 - GS/SMEB</span>' +
            '</div>' +
          '</div>' +
          '<div style="font-size: 13.5px; color: var(--text-secondary);">' +
            'Expediente salvo na pasta <strong>Ofícios 2026</strong> e numeração atualizada em <code>_memoria_apolo.md</code>.' +
          '</div>' +
          '<div class="job-links-list" id="oficioGeneratedList"></div>';

        outBox.classList.remove('hidden');
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
        if (res.numero) {
          const prox = parseInt(String(res.numero), 10) + 1;
          if (!isNaN(prox)) document.getElementById('oficioNumeroInput').value = String(prox);
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
