/**
 * Hub Olympos V2.1 — Página Modular 4: Cadastro Direto de Licenças no Hub
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.licencas = (function() {
  function init() {
    bindEvents();
    configurarDataInicial();
    alternarCamposPorModalidade();
  }

  function bindEvents() {
    const selMod = document.getElementById('licModalidadeSelect');
    if (selMod && !selMod._bound) {
      selMod._bound = true;
      selMod.addEventListener('change', alternarCamposPorModalidade);
    }

    const dtInicio = document.getElementById('licDataInicioInput');
    if (dtInicio && !dtInicio._bound) {
      dtInicio._bound = true;
      dtInicio.addEventListener('change', autoCalcularTermino);
    }

    const inAnos = document.getElementById('licAnosInput');
    if (inAnos && !inAnos._bound) {
      inAnos._bound = true;
      inAnos.addEventListener('input', autoCalcularTermino);
    }

    const form = document.getElementById('formCadastroLicenca');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        handleSalvarLicenca();
      });
    }
  }

  function configurarDataInicial() {
    const dt = document.getElementById('licDataInicioInput');
    if (dt && !dt.value) {
      dt.value = new Date().toISOString().split('T')[0];
      autoCalcularTermino();
    }
  }

  function alternarCamposPorModalidade() {
    const mod = document.getElementById('licModalidadeSelect').value;
    const toggle = function(id, show) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !show);
    };

    const isAnulacao = mod === 'ANULACAO';
    toggle('grpLicNome', !isAnulacao);
    toggle('grpLicMatricula', !isAnulacao);
    toggle('grpLicCargo', !isAnulacao);
    toggle('grpLicDataInicio', !isAnulacao);
    toggle('grpLicDataTermino', !isAnulacao);

    toggle('grpLicPeriodoAquisitivo', mod === 'PREMIO');
    toggle('grpLicAnosAfastados', mod === 'NAO_REMUNERADA');
    toggle('grpLicPortariaAnular', isAnulacao);
    toggle('grpLicParecer', isAnulacao);

    autoCalcularTermino();
  }

  function autoCalcularTermino() {
    const mod = document.getElementById('licModalidadeSelect').value;
    const dtInicioVal = document.getElementById('licDataInicioInput').value;
    const dtTerminoInput = document.getElementById('licDataTerminoInput');
    if (!dtInicioVal || !dtTerminoInput) return;

    if (mod === 'PREMIO') {
      const d = new Date(dtInicioVal + 'T12:00:00');
      d.setDate(d.getDate() + 89);
      dtTerminoInput.value = d.toISOString().split('T')[0];
    } else if (mod === 'NAO_REMUNERADA') {
      const anos = parseInt(document.getElementById('licAnosInput').value, 10);
      if (!isNaN(anos) && anos > 0) {
        const d = new Date(dtInicioVal + 'T12:00:00');
        d.setFullYear(d.getFullYear() + anos);
        d.setDate(d.getDate() - 1);
        dtTerminoInput.value = d.toISOString().split('T')[0];
      }
    }
  }

  function handleSalvarLicenca() {
    const mod = document.getElementById('licModalidadeSelect').value;
    const nome = document.getElementById('licNomeInput').value.trim();
    const matricula = document.getElementById('licMatriculaInput').value.trim();
    const cargo = document.getElementById('licCargoInput').value.trim();
    const portariaAnular = document.getElementById('licPortariaAnularInput').value.trim();
    const parecer = document.getElementById('licParecerInput').value.trim();
    const btn = document.getElementById('btnSalvarLicenca');
    const outBox = document.getElementById('licencaOutputFeedback');

    if (mod === 'ANULACAO') {
      if (!portariaAnular || !parecer) {
        window.OlymposApp.showToast('Informe a Portaria a Anular e o Parecer Jurídico.', true);
        return;
      }
    } else if (!nome || !matricula || !cargo) {
      window.OlymposApp.showToast('Preencha Nome Completo, Matrícula e Cargo Funcional.', true);
      return;
    }

    const payload = {
      tipoLicenca: mod,
      nome: nome,
      matricula: matricula,
      cargo: cargo,
      periodoAquisitivo: document.getElementById('licPeriodoInput').value.trim(),
      anosAfastados: document.getElementById('licAnosInput').value.trim(),
      portariaAnular: portariaAnular,
      parecer: parecer,
      dataInicio: document.getElementById('licDataInicioInput').value,
      dataTermino: document.getElementById('licDataTerminoInput').value,
      numPortaria: document.getElementById('licNumPortariaInput').value.trim() || 'AUTO',
      republicacao: document.getElementById('licRepublicadoCheck').checked ? 'SIM' : 'NÃO',
      retroativo: document.getElementById('licRetroativoCheck').checked ? 'SIM' : 'NÃO',
      gerarDocumentoAgora: document.getElementById('licGerarAgoraCheck').checked
    };

    btn.disabled = true;
    btn.textContent = 'Gravando na planilha e gerando ato...';
    outBox.classList.add('hidden');

    window.OlymposApi.chamar('licenca_cadastrar', payload, function(res) {
      btn.disabled = false;
      btn.textContent = 'Registrar Licença e Gerar Ato';

      if (res && res.ok) {
        window.OlymposApp.showToast(res.mensagem || 'Licença registrada com sucesso!');
        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '✓';
        const urlDoc = res.urlArquivo || res.urlDocumento || '';
        const urlPlan = res.planilhaUrl || 'https://docs.google.com/spreadsheets/d/1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc/edit';

        outBox.innerHTML =
          '<div class="job-result-header">' +
            '<div class="job-result-title">' +
              '<span class="job-done-badge">' + checkSvg + '</span>' +
              '<span>Finalização Confirmada — ' + window.OlymposApp.escapeHtml(res.servidor || nome || ('Anulação ' + portariaAnular)) + '</span>' +
            '</div>' +
            '<a href="' + window.OlymposApp.escapeHtml(urlPlan) + '" target="_blank" rel="noopener" class="folder-chip">Abrir Planilha de Licenças ↗</a>' +
          '</div>' +
          '<div style="font-size: 13.5px; color: var(--text-secondary);">' +
            window.OlymposApp.escapeHtml(res.mensagem || 'Registro gravado na planilha oficial.') +
          '</div>' +
          '<div class="job-links-list" id="licencaGeneratedLinks"></div>';

        outBox.classList.remove('hidden');

        const listaArquivos = [];
        if (urlDoc) {
          listaArquivos.push({
            titulo: 'Portaria de Licença Nº ' + (res.numeroPortaria || '--') + '/2026',
            identificador: res.servidor || nome,
            detalhe: res.dataTermino ? ('Término calculado: ' + res.dataTermino) : ('Aba ' + (res.aba || '')),
            url: urlDoc
          });
        } else {
          listaArquivos.push({
            titulo: 'Linha Cadastrada na Planilha Oficial (' + (res.aba || mod) + ')',
            identificador: res.servidor || nome,
            detalhe: 'Pronta para geração futura em lote',
            url: urlPlan
          });
        }

        window.OlymposApp.renderizarItensLinksGerados(
          document.getElementById('licencaGeneratedLinks'),
          listaArquivos
        );

        document.getElementById('licNomeInput').value = '';
        document.getElementById('licMatriculaInput').value = '';
        if (window.OlymposViews && window.OlymposViews.visaoGeral) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao cadastrar licença.', true);
      }
    }, function(err) {
      btn.disabled = false;
      btn.textContent = 'Registrar Licença e Gerar Ato';
      window.OlymposApp.showToast('Erro ao registrar licença: ' + err.message, true);
    });
  }

  return {
    init: init
  };
})();
