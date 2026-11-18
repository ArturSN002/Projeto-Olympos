/**
 * Hub Olympos V2.1 — Página Modular 1: Visão Geral do Gabinete + Constelação das 17 Personas
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.visaoGeral = (function() {
  let isLoaded = false;
  let lastOverviewData = null;

  const APOLO_MEMORIA_URL = 'https://drive.google.com/file/d/1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_/view';

  function init() {
    bindEvents();
    bindSpotlightInteractions();
    renderizarConstelacao17Personas(lastOverviewData ? lastOverviewData.memorias : null);
    atualizarTelemetriaCientifica();
    renderizarWidgetEventosAgenda();
    if (!isLoaded) {
      definirEstadoInicialNumeracao();
      carregarDados();
    }
  }

  function bindSpotlightInteractions() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    const cards = document.querySelectorAll('.spotlight-card');
    cards.forEach(function(card) {
      if (card._boundSpotlight) return;
      card._boundSpotlight = true;
      card.addEventListener('mousemove', function(e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
      });
    });
  }

  function atualizarTelemetriaCientifica() {
    // 1. Chamados SMEB
    const elChamados = document.getElementById('heroTelemetryChamados');
    if (elChamados) {
      if (window.OlymposSignals && typeof window.OlymposSignals.getActiveQueue === 'function') {
        const fila = window.OlymposSignals.getActiveQueue();
        elChamados.textContent = fila.length + ' demandas';
      } else {
        elChamados.textContent = 'Fila Ativa';
      }
    }

    // 2. Agenda Escolar • Eventos Externos
    const elAgenda = document.getElementById('heroTelemetryAgenda');
    if (elAgenda) {
      let pendentesCount = 0;
      if (window.OlymposViews && window.OlymposViews.calendario && typeof window.OlymposViews.calendario.obterEventosAgendaCustom === 'function') {
        const evts = window.OlymposViews.calendario.obterEventosAgendaCustom();
        pendentesCount = evts.filter(function(e) { return (e.status || 'PENDENTE').toUpperCase() !== 'CONCLUIDO'; }).length;
      }
      elAgenda.textContent = pendentesCount + ' pendente(s)';
    }
  }

  function renderizarWidgetEventosAgenda() {
    const container = document.getElementById('listaEventosExternosVisaoGeral');
    const kpiPendentes = document.getElementById('kpiAgendaPendentes');
    if (!container) return;

    let eventos = [];
    if (window.OlymposViews && window.OlymposViews.calendario && typeof window.OlymposViews.calendario.obterEventosAgendaCustom === 'function') {
      eventos = window.OlymposViews.calendario.obterEventosAgendaCustom();
    }

    const pendentes = eventos.filter(function(ev) {
      return (ev.status || 'PENDENTE').toUpperCase() !== 'CONCLUIDO';
    });

    if (kpiPendentes) {
      kpiPendentes.textContent = pendentes.length + ' pendência(s)';
    }

    if (pendentes.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="padding: 24px; text-align: center; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-hairline);">
          <span class="svg-icon-inline" style="width: 2rem; height: 2rem; margin-bottom: 6px;">${window.OlymposIcons ? window.OlymposIcons.ui('party') : ''}</span>
          <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem;">Todos os eventos externos e compromissos da agenda estão concluídos.</p>
        </div>
      `;
      return;
    }

    // Ordena por data mais próxima
    pendentes.sort(function(a, b) {
      return String(a.dataInicio || '').localeCompare(String(b.dataInicio || ''));
    });

    const html = pendentes.map(function(ev) {
      const dataFmt = ev.dataInicio ? (ev.dataInicio.split('-').reverse().join('/')) : '--';
      return `
        <div class="evento-agenda-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: var(--bg-surface); border: 1px solid var(--border-hairline); border-radius: var(--radius-md); gap: 12px; margin-bottom: 8px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="pill-badge pill-amber" style="font-size: 0.68rem;">${window.OlymposIcons ? window.OlymposIcons.ui('hourglass') : ''} Pendente</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${dataFmt}${ev.horario ? ' • ' + ev.horario : ''}</span>
              ${ev.setor ? `<span style="font-size: 0.72rem; color: var(--text-secondary); background: var(--bg-tonal); padding: 1px 6px; border-radius: 4px;">${ev.setor}</span>` : ''}
            </div>
            <h5 style="margin: 0 0 2px 0; font-size: 0.92rem; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${window.OlymposApp ? window.OlymposApp.escapeHtml(ev.titulo) : ev.titulo}</h5>
            ${ev.local ? `<p style="margin: 0; font-size: 0.78rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${window.OlymposIcons ? window.OlymposIcons.ui('mapPin') : ''} ${window.OlymposApp ? window.OlymposApp.escapeHtml(ev.local) : ev.local}</p>` : ''}
          </div>
          <button type="button" class="btn btn-primary btn-sm" style="font-size: 0.78rem; padding: 4px 10px; white-space: nowrap;" onclick="window.concluirEventoAgenda('${ev.id}')">
            ${window.OlymposIcons ? window.OlymposIcons.ui('check') : ''} Concluir
          </button>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  function definirEstadoInicialNumeracao() {
    const elOf = document.getElementById('kpiProximoOficio');
    const elUltOf = document.getElementById('kpiUltimoOficio');
    const elPt = document.getElementById('kpiProximaPortaria');
    const elUltPt = document.getElementById('kpiUltimaPortaria');

    if (elOf) elOf.textContent = '--';
    if (elUltOf) {
      elUltOf.innerHTML = '<span>Último emitido: --</span>' +
        '<a href="' + APOLO_MEMORIA_URL + '" target="_blank" rel="noopener noreferrer" class="folder-chip" data-requires-auth="true" data-access-roles="ADMIN_GABINETE,RH_COMISSAO,PEDAGOGICO_EVENTOS,JURIDICO">Memória de Apolo ↗</a>';
    }
    if (elPt) elPt.textContent = '--';
    if (elUltPt) {
      elUltPt.innerHTML = '<span>Última emitida: --</span>' +
        '<a href="' + APOLO_MEMORIA_URL + '" target="_blank" rel="noopener noreferrer" class="folder-chip" data-requires-auth="true" data-access-roles="ADMIN_GABINETE,RH_COMISSAO,PEDAGOGICO_EVENTOS,JURIDICO">Memória de Apolo ↗</a>';
    }
    if (window.OlymposApp && typeof window.OlymposApp.aplicarControleAcessoModularEDrive === 'function') {
      window.OlymposApp.aplicarControleAcessoModularEDrive();
    }

    const inOf = document.getElementById('inputProximoOficioMd');
    const inPt = document.getElementById('inputProximaPortariaMd');
    if (inOf) {
      inOf.value = '';
      inOf.placeholder = '--';
    }
    if (inPt) {
      inPt.value = '';
      inPt.placeholder = '--';
    }

    const inputOficioForm = document.getElementById('oficioNumeroInput');
    if (inputOficioForm) {
      inputOficioForm.value = '';
      inputOficioForm.placeholder = '--';
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

  function consultarFallbackSupabase() {
    console.info('[VisaoGeral] Gateway GAS indisponível ou sem resposta válida. Consultando espelho dinâmico no Supabase...');
    if (window.OlymposSupabase && typeof window.OlymposSupabase.carregarNumeracaoGabinete === 'function') {
      window.OlymposSupabase.carregarNumeracaoGabinete().then(function(numData) {
        if (numData) {
          atualizarKpis({ numeracao: numData });
          isLoaded = true;
        }
      }).catch(function(eNum) {
        console.warn('[VisaoGeral] Falha na consulta de contingência via Supabase:', eNum);
      });
    }
  }

  function carregarDados() {
    renderizarConstelacao17Personas(lastOverviewData ? lastOverviewData.memorias : null);
    if (!lastOverviewData) {
      definirEstadoInicialNumeracao();
    }

    // 1. Consulta prioritária à fonte oficial (_memoria_apolo.md no Drive via Gateway GAS).
    // Enquanto a resposta não chega, os contadores permanecem com "--" (zero números estáticos).
    window.OlymposApi.chamar('overview_get', {}, function(res) {
      const data = (res && res.data) ? res.data : res;
      if (data && (data.numeracao || data.memorias)) {
        lastOverviewData = data;
        atualizarKpis(data);
        if (data.memorias) renderizarConstelacao17Personas(data.memorias || []);
        isLoaded = true;
        if (data.numeracao && window.OlymposSupabase && typeof window.OlymposSupabase.sincronizarNumeracaoGabinete === 'function') {
          window.OlymposSupabase.sincronizarNumeracaoGabinete(data.numeracao);
        }
        console.log('[Olympos Visão Geral] Dados dinâmicos do Gabinete recebidos do Drive/GAS:', data);
      } else {
        consultarFallbackSupabase();
      }
    }, function() {
      consultarFallbackSupabase();
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
          '<a href="' + window.OlymposApp.escapeHtml(memUrl) + '" target="_blank" rel="noopener" class="folder-chip" data-requires-auth="true" data-access-roles="ADMIN_GABINETE,RH_COMISSAO,PEDAGOGICO_EVENTOS,JURIDICO">Memória de Apolo ↗</a>';
      }

      if (elPt) elPt.textContent = ptVal !== null ? ('Nº ' + ptVal) : '--';
      if (elUltPt) {
        elUltPt.innerHTML = '<span>Última emitida: ' + (ultPt !== null ? ('Nº ' + ultPt) : '--') + '</span>' +
          '<a href="' + window.OlymposApp.escapeHtml(memUrl) + '" target="_blank" rel="noopener" class="folder-chip" data-requires-auth="true" data-access-roles="ADMIN_GABINETE,RH_COMISSAO,PEDAGOGICO_EVENTOS,JURIDICO">Memória de Apolo ↗</a>';
      }

      if (window.OlymposApp && typeof window.OlymposApp.aplicarControleAcessoModularEDrive === 'function') {
        window.OlymposApp.aplicarControleAcessoModularEDrive();
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

    atualizarTelemetriaCientifica();
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
    renderizarWidgetEventosAgenda: renderizarWidgetEventosAgenda,
    atualizarTelemetriaCientifica: atualizarTelemetriaCientifica,
    getLastOverviewData: function() { return lastOverviewData; }
  };
})();
