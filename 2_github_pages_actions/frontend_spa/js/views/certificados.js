/**
 * Hub Olympos V2.1 — Página Modular 5: Certificados & Declarações (A Lira de Orfeu)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.certificados = (function() {
  let catalog = [];
  let isCatalogLoaded = false;

  function init() {
    bindEvents();
    if (!isCatalogLoaded) {
      carregarCatalogo();
    }
  }

  function bindEvents() {
    const selPlan = document.getElementById('liraPlanilhaSelect');
    if (selPlan && !selPlan._bound) {
      selPlan._bound = true;
      selPlan.addEventListener('change', handlePlanilhaChange);
    }

    const btnClean = document.getElementById('liraHigienizarBtn');
    if (btnClean && !btnClean._bound) {
      btnClean._bound = true;
      btnClean.addEventListener('click', executarHigienizacao);
    }

    const btnExec = document.getElementById('liraExecutarBtn');
    if (btnExec && !btnExec._bound) {
      btnExec._bound = true;
      btnExec.addEventListener('click', executarLoteLira);
    }
  }

  function carregarCatalogo() {
    const planSelect = document.getElementById('liraPlanilhaSelect');
    planSelect.innerHTML = '<option value="">Carregando planilhas de eventos...</option>';

    window.OlymposApi.chamar('certificados_catalogo', {}, function(res) {
      catalog = Array.isArray(res) ? res : ((res && res.planilhas) || []);
      isCatalogLoaded = true;
      planSelect.innerHTML = '';

      if (catalog.length === 0) {
        planSelect.innerHTML = '<option value="">Nenhuma planilha encontrada na pasta da Lira</option>';
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
      planSelect.innerHTML = '<option value="">Falha ao listar planilhas</option>';
      window.OlymposApp.showToast('Erro ao consultar eventos: ' + err.message, true);
    });
  }

  function handlePlanilhaChange() {
    const planId = document.getElementById('liraPlanilhaSelect').value;
    const abaSelect = document.getElementById('liraAbaSelect');
    abaSelect.innerHTML = '';

    const found = catalog.find(function(c) { return c.id === planId; });
    if (!found || !found.abas || !found.abas.length) {
      abaSelect.innerHTML = '<option value="">Nenhuma aba de participantes</option>';
      return;
    }

    found.abas.forEach(function(aba) {
      const opt = document.createElement('option');
      opt.value = aba;
      opt.textContent = aba;
      abaSelect.appendChild(opt);
    });
  }

  function executarHigienizacao() {
    const planId = document.getElementById('liraPlanilhaSelect').value;
    const sheetName = document.getElementById('liraAbaSelect').value;
    const out = document.getElementById('liraOutput');

    if (!planId || !sheetName) {
      window.OlymposApp.showToast('Selecione uma planilha e uma aba de participantes.', true);
      return;
    }

    out.innerHTML = 'Padronizando nomes em Title Case, removendo espaços invisíveis e corrigindo domínios de e-mail...';

    window.OlymposApi.chamar('certificados_higienizar', {
      spreadsheetId: planId,
      sheetName: sheetName
    }, function(res) {
      if (res && res.ok) {
        const dupEmails = (res.duplicatasEmails && res.duplicatasEmails.length) || 0;
        const dupNomes = (res.duplicatasNomes && res.duplicatasNomes.length) || 0;
        out.innerHTML =
          '<div style="font-family:var(--font-display); font-weight:700; color:var(--text-main); margin-bottom:8px;">' +
            'Higienização Pré-Voo Concluída — ' + window.OlymposApp.escapeHtml(res.aba || sheetName) +
          '</div>' +
          '<div style="display:flex; flex-wrap:wrap; gap:8px;">' +
            '<span class="pill-badge pill-green">Nomes ajustados: ' + (res.nomesCorrigidos || 0) + '</span>' +
            '<span class="pill-badge pill-blue">E-mails corrigidos: ' + (res.emailsCorrigidos || 0) + '</span>' +
            '<span class="pill-badge ' + ((dupEmails + dupNomes) > 0 ? 'pill-gold' : 'pill-green') + '">Duplicidades sinalizadas: ' + (dupEmails + dupNomes) + '</span>' +
          '</div>';
        window.OlymposApp.showToast('Lista de participantes padronizada!');
      } else {
        out.innerHTML = '<span class="text-danger">' + ((res && res.mensagem) || 'Falha ao higienizar aba.') + '</span>';
      }
    }, function(err) {
      out.innerHTML = '<span class="text-danger">Erro: ' + window.OlymposApp.escapeHtml(err.message) + '</span>';
    });
  }

  function executarLoteLira() {
    const planId = document.getElementById('liraPlanilhaSelect').value;
    const sheetName = document.getElementById('liraAbaSelect').value;
    const modalidade = document.getElementById('liraModalidadeSelect').value;
    const out = document.getElementById('liraOutput');
    const doneBox = document.getElementById('liraCompletedJobBox');
    const btn = document.getElementById('liraExecutarBtn');

    if (!planId || !sheetName) {
      window.OlymposApp.showToast('Selecione uma planilha e uma aba válidas.', true);
      return;
    }

    if (!confirm('Iniciar geração de PDFs com QR Code e envio por e-mail para a aba "' + sheetName + '"?')) return;

    btn.disabled = true;
    btn.textContent = 'Emitindo PDFs e enviando e-mails...';
    doneBox.classList.add('hidden');
    out.innerHTML = 'Processando lote na Lira de Orfeu (geração de PDFs, gravação de hash SHA-256 e envio)...';

    window.OlymposApi.chamar('certificados_executar', {
      spreadsheetId: planId,
      sheetName: sheetName,
      modalidade: modalidade
    }, function(res) {
      btn.disabled = false;
      btn.textContent = 'Emitir PDFs e Enviar por E-mail';

      if (res && res.ok) {
        const pdfs = res.pdfsGerados !== undefined ? res.pdfsGerados : (res.gerados || 0);
        const emails = res.emailsEnviados !== undefined ? res.emailsEnviados : (res.enviados || 0);
        const arquivos = res.arquivosGerados || [];
        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '✓';

        doneBox.innerHTML =
          '<div class="job-result-header">' +
            '<div class="job-result-title">' +
              '<span class="job-done-badge">' + checkSvg + '</span>' +
              '<span>Finalização Confirmada — ' + window.OlymposApp.escapeHtml(res.evento || 'Evento') + '</span>' +
            '</div>' +
            '<div class="button-group">' +
              (arquivos.length > 0 ? '<button type="button" id="liraCopyAllBtn" class="btn btn-secondary btn-sm">Copiar Todos os Links</button>' : '') +
              (res.pastaDestinoUrl ? '<a href="' + window.OlymposApp.escapeHtml(res.pastaDestinoUrl) + '" target="_blank" rel="noopener" class="folder-chip">Abrir Pasta do Evento ↗</a>' : '') +
            '</div>' +
          '</div>' +
          '<div style="font-size:13.5px; color:var(--text-secondary);">' +
            '<strong>' + pdfs + ' novo(s) PDF(s) gerado(s)</strong> • <strong>' + emails + ' e-mail(s) enviado(s)</strong> • Cota restante: <strong>' + (res.cotaRestante !== undefined ? res.cotaRestante : '--') + '</strong>' +
            (res.agendamentoPosCota ? ' • Retomada automática agendada para ' + window.OlymposApp.escapeHtml(res.agendamentoPosCota.horarioAgendado) : '') +
          '</div>' +
          '<div class="job-links-list" id="liraGeneratedLinksList"></div>';

        doneBox.classList.remove('hidden');
        window.OlymposApp.renderizarItensLinksGerados(
          document.getElementById('liraGeneratedLinksList'),
          arquivos
        );

        const copyAll = document.getElementById('liraCopyAllBtn');
        if (copyAll && arquivos.length > 0) {
          copyAll.addEventListener('click', function() {
            const txt = arquivos.map(function(a) { return (a.identificador || 'Participante') + ': ' + (a.url || ''); }).join('\n');
            window.OlymposApp.copiarTexto(txt, arquivos.length + ' link(s) de certificados');
          });
        }

        out.innerHTML = 'Processamento finalizado com sucesso. Os links individuais dos PDFs estão listados acima.';
        window.OlymposApp.showToast('Certificados processados com sucesso!');
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        out.innerHTML = '<span class="text-danger">' + ((res && res.mensagem) || 'Falha na execução do lote.') + '</span>';
      }
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Emitir PDFs e Enviar por E-mail';
      out.innerHTML = '<span class="text-danger">Erro na execução: ' + window.OlymposApp.escapeHtml(err.message) + '</span>';
    });
  }

  return {
    init: init
  };
})();
