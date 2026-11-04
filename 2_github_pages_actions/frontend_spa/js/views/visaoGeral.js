/**
 * Hub Olympos V2.1 — Página Modular 1: Visão Geral do Gabinete + Constelação das 17 Personas
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.visaoGeral = (function() {
  let isLoaded = false;
  let lastOverviewData = null;

  function init() {
    bindEvents();
    renderizarConstelacao17Personas(lastOverviewData ? lastOverviewData.memorias : null);
    if (!isLoaded) {
      carregarDados();
    }
  }

  function bindEvents() {
    const bindClick = function(id, fn) {
      const el = document.getElementById(id);
      if (el && !el._bound) {
        el._bound = true;
        el.addEventListener('click', fn);
      }
    };

    bindClick('copyOficioBtn', function() {
      window.OlymposApp.copiarKpi('kpiProximoOficio', 'Próximo Ofício 2026');
    });
    bindClick('copyPortariaBtn', function() {
      window.OlymposApp.copiarKpi('kpiProximaPortaria', 'Próxima Portaria 2026');
    });
    bindClick('reserveOficioBtn', function() { reservarNumero('OFICIO'); });
    bindClick('reservePortariaBtn', function() { reservarNumero('PORTARIA'); });
    bindClick('editOficioBtn', function() { window.OlymposApp.abrirModalContadores(); });
    bindClick('editPortariaBtn', function() { window.OlymposApp.abrirModalContadores(); });
  }

  function carregarDados() {
    // Verifica se há sessão institucional ou token configurado antes de chamar endpoint protegido
    const sessao = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;
    const jwtToken = (window.OlymposApi && typeof window.OlymposApi.getJwtToken === 'function')
      ? window.OlymposApi.getJwtToken()
      : null;

    // Se não há sessão autenticada, renderiza o catálogo local das 17 personas sem emitir erro de rede
    if (!sessao && !jwtToken) {
      renderizarConstelacao17Personas(lastOverviewData ? lastOverviewData.memorias : null);
      return;
    }

    window.OlymposApi.chamar('overview_get', {}, function(res) {
      const data = (res && res.data) ? res.data : res;
      if (data && (data.numeracao || data.memorias)) {
        lastOverviewData = data;
        atualizarKpis(data);
        renderizarConstelacao17Personas(data.memorias || []);
        isLoaded = true;
      }
    }, function(err) {
      // Degradação graciosa para catálogo local sem poluir o console com advertências
      renderizarConstelacao17Personas(lastOverviewData ? lastOverviewData.memorias : null);
    });
  }

  function atualizarKpis(data) {
    if (!data) return;

    if (data.numeracao) {
      const n = data.numeracao;
      const ofVal = (n.proximoOficio2026 !== undefined && n.proximoOficio2026 !== null)
        ? n.proximoOficio2026
        : ((n.proximoOficio !== undefined && n.proximoOficio !== null) ? n.proximoOficio : null);
      const ptVal = (n.proximaPortaria2026 !== undefined && n.proximaPortaria2026 !== null)
        ? n.proximaPortaria2026
        : ((n.proximaPortaria !== undefined && n.proximaPortaria !== null) ? n.proximaPortaria : null);
      const ultOf = (n.ultimoOficio2026 !== undefined && n.ultimoOficio2026 !== null)
        ? n.ultimoOficio2026
        : (ofVal !== null ? (ofVal - 1) : null);
      const ultPt = (n.ultimaPortaria2026 !== undefined && n.ultimaPortaria2026 !== null)
        ? n.ultimaPortaria2026
        : (ptVal !== null ? (ptVal - 1) : null);
      const memUrl = n.arquivoUrl || 'https://drive.google.com/file/d/1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_/view';

      const elOf = document.getElementById('kpiProximoOficio');
      const elUltOf = document.getElementById('kpiUltimoOficio');
      const elPt = document.getElementById('kpiProximaPortaria');
      const elUltPt = document.getElementById('kpiUltimaPortaria');

      if (elOf) elOf.textContent = ofVal !== null ? ('Nº ' + ofVal) : '--';
      if (elUltOf) {
        elUltOf.innerHTML = '<span>Último emitido: ' + (ultOf !== null ? ('Nº ' + ultOf) : '--') + '</span>' +
          '<a href="' + window.OlymposApp.escapeHtml(memUrl) + '" target="_blank" rel="noopener" class="folder-chip">Memória de Apolo ↗</a>';
      }

      if (elPt) elPt.textContent = ptVal !== null ? ('Nº ' + ptVal) : '--';
      if (elUltPt) {
        elUltPt.innerHTML = '<span>Última emitida: ' + (ultPt !== null ? ('Nº ' + ultPt) : '--') + '</span>' +
          '<a href="' + window.OlymposApp.escapeHtml(memUrl) + '" target="_blank" rel="noopener" class="folder-chip">Memória de Apolo ↗</a>';
      }

      const inOf = document.getElementById('inputProximoOficioMd');
      const inPt = document.getElementById('inputProximaPortariaMd');
      const inSig = document.getElementById('inputSignatarioMd');
      if (inOf && ofVal !== null) inOf.value = ofVal;
      if (inPt && ptVal !== null) inPt.value = ptVal;
      if (inSig && (n.signatarioTitular || n.signatario)) {
        inSig.value = n.signatarioTitular || n.signatario;
      }

      const inputOficioForm = document.getElementById('oficioNumeroInput');
      if (inputOficioForm && !inputOficioForm.value && ofVal !== null) {
        inputOficioForm.value = String(ofVal);
      }
    }

    const cota = data.cotaEmailRestante !== undefined ? data.cotaEmailRestante : data.cotaEmail;
    if (cota !== undefined) {
      const elCota = document.getElementById('kpiCotaEmail');
      if (elCota) elCota.textContent = cota + ' envios';
    }

    if (data.statusPrometheus) {
      const meta = document.getElementById('kpiPrometheusMeta');
      if (meta && data.statusPrometheus.ultimaExecucao) {
        meta.textContent = 'Fogo de Prometheus: ' + data.statusPrometheus.ultimaExecucao;
      }
    }
  }

  function renderizarConstelacao17Personas(memoriasLive) {
    const container = document.getElementById('homePersonasConstellation');
    if (!container || !window.OlymposIcons) return;

    const catalogo = window.OlymposIcons.getCatalogo17Personas();
    const mapaLive = {};
    (memoriasLive || []).forEach(function(m) {
      if (m.arquivo) mapaLive[m.arquivo] = m;
    });

    container.innerHTML = '';
    catalogo.forEach(function(p) {
      const live = p.arquivo ? mapaLive[p.arquivo] : null;
      const isHost = p.tipo === 'anfitriao';
      const svg = window.OlymposIcons.get(p.id);
      const linhasInfo = live && live.totalLinhas !== undefined
        ? (live.totalLinhas + ' / 60 linhas • ' + p.arquivo)
        : (isHost ? ('Anfitriã: ' + p.anfitriao) : p.arquivo);

      const tile = document.createElement('div');
      tile.className = 'home-persona-tile';
      tile.title = 'Clique para abrir ' + p.nome + ' na página Personas & Memórias';
      tile.innerHTML =
        '<div class="persona-emblem ' + (isHost ? 'is-host-routed' : '') + '" aria-hidden="true">' + svg + '</div>' +
        '<div class="home-persona-info">' +
          '<div class="home-persona-top">' +
            '<span class="home-persona-name">' + window.OlymposApp.escapeHtml(p.nome) + '</span>' +
            '<span class="home-persona-layer">' + window.OlymposApp.escapeHtml(p.camada) + '</span>' +
          '</div>' +
          '<div class="home-persona-domain">' + window.OlymposApp.escapeHtml(p.dominio) + '</div>' +
          '<div class="home-persona-meta">' + window.OlymposApp.escapeHtml(linhasInfo) + '</div>' +
        '</div>';

      tile.addEventListener('click', function() {
        window.OlymposRouter.navegarPara('personas');
        const filtro = document.getElementById('memoriaSearchInput');
        if (filtro) {
          filtro.value = p.nome;
          filtro.dispatchEvent(new Event('input'));
        }
      });

      container.appendChild(tile);
    });
  }

  function reservarNumero(tipo) {
    const desc = prompt('Informe a finalidade/destinatário para reservar o próximo ' + tipo + ' em _memoria_apolo.md:', 'Emissão pelo Gabinete SMEB');
    if (!desc) return;

    window.OlymposApi.chamar('reservar_numero_md', { tipo: tipo, detalhe: desc }, function(res) {
      if (res && res.ok) {
        const codigo = res.numeroFormatado || res.codigoOficial || (res.numeroReservado + '/2026');
        window.OlymposApp.showToast(tipo + ' reservado: Nº ' + codigo + ' (Próximo: ' + res.proximoDisponivel + ')');
        carregarDados();
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao reservar número.', true);
      }
    }, function(err) {
      window.OlymposApp.showToast('Erro ao reservar número: ' + err.message, true);
    });
  }

  return {
    init: init,
    recarregar: carregarDados,
    getLastOverviewData: function() { return lastOverviewData; }
  };
})();
