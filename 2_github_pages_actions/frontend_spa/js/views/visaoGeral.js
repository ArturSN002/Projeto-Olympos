/**
 * Hub Olympos V2.1 — Página Modular 1: Visão Geral do Gabinete + Constelação das 17 Personas
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.visaoGeral = (function() {
  let isLoaded = false;
  let isLoadingOverview = false;
  let lastOverviewData = null;
  let newsLoaded = false;
  let newsLoading = false;
  let municipalNewsCache = [];
  let activeNewsSource = 'todas';

  const APOLO_MEMORIA_URL = 'https://docs.google.com/document/d/1ZXTlg2Wk5IKZ2Sg84HOnlePCOihccPFcYTd67wHUgkM/edit';
  const PREFEITURA_SITE_URL = 'https://cearamirim.rn.gov.br/';
  const CAMARA_SITE_URL = 'https://www.cearamirim.rn.leg.br/';

  function atualizarSaudacaoVisitante() {
    const sessao = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;
    const isAuth = Boolean(sessao && sessao.perfil);

    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : (hora < 18 ? 'Boa tarde' : 'Boa noite');

    const titleEl = document.getElementById('visitanteGreetingTitle');
    if (titleEl) {
      titleEl.textContent = saudacao + '! Seja bem-vindo(a) ao Portal da Educação.';
    }

    const agendaDescEl = document.getElementById('widgetAgendaDesc');
    if (agendaDescEl) {
      agendaDescEl.textContent = isAuth
        ? 'Monitore e conclua compromissos da agenda intersetorial diretamente pela Visão Geral.'
        : 'Acompanhe os próximos eventos, audiências e datas públicas da rede municipal de ensino.';
    }

    const modTitleEl = document.getElementById('operacoesModularesTitle');
    const modDescEl = document.getElementById('operacoesModularesDesc');
    if (modTitleEl) {
      modTitleEl.textContent = isAuth
        ? 'Frentes de Automação Documental e Inteligência'
        : 'Serviços Públicos e Consultas Abertas ao Cidadão';
    }
    if (modDescEl) {
      modDescEl.textContent = isAuth
        ? 'Cada módulo opera em página dedicada para redação oficial, gestão funcional e acompanhamento documental da SMEB.'
        : 'Explore o Diário Oficial e o Mapa de Escolas da rede municipal com acesso direto e transparente.';
    }
  }

  function init() {
    bindEvents();
    bindSpotlightInteractions();
    atualizarSaudacaoVisitante();
    renderizarConstelacao17Personas(lastOverviewData ? lastOverviewData.memorias : null);
    atualizarTelemetriaCientifica();
    renderizarWidgetEventosAgenda();
    if (window.OlymposIcons && typeof window.OlymposIcons.hydrateAll === 'function') {
      window.OlymposIcons.hydrateAll();
    }
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function' && window.OlymposIcons && typeof window.OlymposIcons.get === 'function') {
      document.querySelectorAll('.visitante-qc-icon[data-persona-icon]').forEach(function(badge) {
        if (!badge.innerHTML) {
          badge.innerHTML = window.OlymposIcons.get(badge.getAttribute('data-persona-icon')) || '';
        }
      });
    }
    if (!newsLoaded && !newsLoading) {
      carregarNoticiasMunicipais(false);
    } else {
      renderizarNoticiasMunicipais();
    }
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
    const sessao = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;

    // 1. Chamados SMEB (apenas para usuários autenticados)
    const elChamados = document.getElementById('heroTelemetryChamados');
    if (elChamados) {
      if (!sessao || !sessao.perfil) {
        elChamados.textContent = '--';
      } else if (window.OlymposSignals && typeof window.OlymposSignals.getActiveQueue === 'function') {
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

    const sessao = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;
    const isAuth = Boolean(sessao && sessao.perfil);

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
          <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem;">Nenhum evento externo pendente no momento. Confira o calendário letivo completo para datas da rede.</p>
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
      const acaoEl = isAuth
        ? `<button type="button" class="btn btn-primary btn-sm" style="font-size: 0.78rem; padding: 6px 12px; white-space: nowrap;" onclick="window.concluirEventoAgenda('${ev.id}')">
            ${window.OlymposIcons ? window.OlymposIcons.ui('check') : ''} Concluir
          </button>`
        : `<span class="pill-badge pill-blue" style="font-size: 0.72rem; white-space: nowrap;">Evento Público</span>`;
      return `
        <div class="evento-agenda-card" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: var(--bg-surface); border: 1px solid var(--border-hairline); border-radius: var(--radius-md); gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
          <div style="flex: 1 1 240px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
              <span class="pill-badge pill-amber" style="font-size: 0.68rem;">${window.OlymposIcons ? window.OlymposIcons.ui('hourglass') : ''} Pendente</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${dataFmt}${ev.horario ? ' • ' + ev.horario : ''}</span>
              ${ev.setor ? `<span style="font-size: 0.72rem; color: var(--text-secondary); background: var(--bg-tonal); padding: 1px 6px; border-radius: 4px;">${ev.setor}</span>` : ''}
            </div>
            <h5 style="margin: 0 0 2px 0; font-size: 0.94rem; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${window.OlymposApp ? window.OlymposApp.escapeHtml(ev.titulo) : ev.titulo}</h5>
            ${ev.local ? `<p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${window.OlymposIcons ? window.OlymposIcons.ui('mapPin') : ''} ${window.OlymposApp ? window.OlymposApp.escapeHtml(ev.local) : ev.local}</p>` : ''}
          </div>
          ${acaoEl}
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
        '<a href="' + APOLO_MEMORIA_URL + '" target="_blank" rel="noopener noreferrer" class="folder-chip" data-requires-auth="true" data-access-roles="MODERADOR,ADMIN_GABINETE,RH_COMISSAO,PEDAGOGICO_EVENTOS,JURIDICO">Memória de Apolo ↗</a>';
    }
    if (elPt) elPt.textContent = '--';
    if (elUltPt) {
      elUltPt.innerHTML = '<span>Última emitida: --</span>' +
        '<a href="' + APOLO_MEMORIA_URL + '" target="_blank" rel="noopener noreferrer" class="folder-chip" data-requires-auth="true" data-access-roles="MODERADOR,ADMIN_GABINETE,RH_COMISSAO,PEDAGOGICO_EVENTOS,JURIDICO">Memória de Apolo ↗</a>';
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
    bindClick('btnRefreshMunicipalNews', function() { carregarNoticiasMunicipais(true); });
    bindClick('homeOpenAllMemoriasBtn', function() {
      if (window.OlymposRouter) window.OlymposRouter.navegarPara('personas');
    });
    bindClick('btnVisitanteEntrarConta', function() {
      if (window.OlymposApp && typeof window.OlymposApp.solicitarLogin === 'function') {
        window.OlymposApp.solicitarLogin();
      } else {
        const userBtn = document.getElementById('userSessionBtn');
        if (userBtn && typeof userBtn.click === 'function') userBtn.click();
      }
    });
    bindClick('btnVisitanteIrNoticias', function(e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const newsEl = document.getElementById('municipalNewsSection');
      if (newsEl && typeof newsEl.scrollIntoView === 'function') {
        newsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !window._olymposVisaoAuthBound) {
      window._olymposVisaoAuthBound = true;
      window.addEventListener('olympos:auth-changed', function() {
        atualizarSaudacaoVisitante();
        renderizarWidgetEventosAgenda();
      });
    }

    const newsFiltersEl = document.getElementById('municipalNewsFilters');
    if (newsFiltersEl && !newsFiltersEl._bound) {
      newsFiltersEl._bound = true;
      newsFiltersEl.addEventListener('click', function(e) {
        const btn = e.target && e.target.closest ? e.target.closest('[data-news-source]') : null;
        if (!btn) return;
        const src = btn.getAttribute('data-news-source') || 'todas';
        activeNewsSource = src;
        newsFiltersEl.querySelectorAll('[data-news-source]').forEach(function(pill) {
          pill.classList.toggle('active', pill === btn);
        });
        renderizarNoticiasMunicipais();
      });
    }
  }

  function sanitizarUrlHttp(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!/^https?:\/\/\S+/i.test(trimmed)) return '';
    return trimmed;
  }

  function formatarDataNoticia(iso) {
    if (!iso) return 'Recente';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Recente';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  }

  function obterEndpointNoticiasMunicipais() {
    const baseUrl =
      (window.OLYMPOS_CONFIG && window.OLYMPOS_CONFIG.SUPABASE_URL) ||
      (window.OlymposSupabase && window.OlymposSupabase.SUPABASE_URL) ||
      'https://rbwizevjvbvjwtbwwyif.supabase.co';
    return String(baseUrl).replace(/\/+$/, '') + '/functions/v1/municipal-news';
  }

  function renderizarNoticiasFallback(statusMsg) {
    const statusEl = document.getElementById('municipalNewsStatus');
    const gridEl = document.getElementById('municipalNewsGrid');
    if (statusEl) {
      statusEl.textContent = statusMsg || 'Acesse diretamente os portais oficiais de Ceará-Mirim.';
    }
    if (!gridEl) return;
    gridEl.setAttribute('data-item-count', '2');
    gridEl.innerHTML =
      '<article class="municipal-news-card">' +
        '<div class="municipal-news-body">' +
          '<div class="municipal-news-meta"><span class="municipal-news-badge is-prefeitura">Prefeitura</span><span class="municipal-news-date">Portal Oficial</span></div>' +
          '<h3 class="municipal-news-title">Prefeitura Municipal de Ceará-Mirim</h3>' +
          '<p class="municipal-news-summary">Acompanhe decretos, editais da SMEB e notícias oficiais do Poder Executivo Municipal.</p>' +
          '<a href="' + PREFEITURA_SITE_URL + '" target="_blank" rel="noopener noreferrer" class="municipal-news-link">Acessar site da Prefeitura ↗</a>' +
        '</div>' +
      '</article>' +
      '<article class="municipal-news-card">' +
        '<div class="municipal-news-body">' +
          '<div class="municipal-news-meta"><span class="municipal-news-badge is-camara">Câmara Municipal</span><span class="municipal-news-date">Poder Legislativo</span></div>' +
          '<h3 class="municipal-news-title">Câmara Municipal de Ceará-Mirim</h3>' +
          '<p class="municipal-news-summary">Consulte pautas das sessões, proposições legislativas e informativos oficiais do Legislativo.</p>' +
          '<a href="' + CAMARA_SITE_URL + '" target="_blank" rel="noopener noreferrer" class="municipal-news-link">Acessar site da Câmara Municipal ↗</a>' +
        '</div>' +
      '</article>';
  }

  function renderizarNoticiasMunicipais() {
    const gridEl = document.getElementById('municipalNewsGrid');
    if (!gridEl) return;

    document.querySelectorAll('#municipalNewsSection [data-news-footer-source]').forEach(function(link) {
      const linkSource = String(link.getAttribute('data-news-footer-source') || '').toLowerCase();
      const shouldHide = activeNewsSource !== 'todas' && linkSource !== activeNewsSource;
      link.classList.toggle('hidden', shouldHide);
    });

    const esc = (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function')
      ? window.OlymposApp.escapeHtml
      : function(v) { return String(v == null ? '' : v); };

    const filtradas = municipalNewsCache.filter(function(item) {
      if (activeNewsSource === 'todas') return true;
      return String(item.source || '').toLowerCase() === activeNewsSource;
    });

    if (filtradas.length === 0) {
      gridEl.setAttribute('data-item-count', '0');
      if (municipalNewsCache.length === 0) {
        renderizarNoticiasFallback('Não há matérias disponíveis no momento. Utilize os links diretos abaixo.');
      } else {
        gridEl.innerHTML =
          '<div class="empty-state-card" style="padding: 24px; text-align: center; grid-column: 1 / -1;">' +
            '<p style="margin: 0; color: var(--text-muted); font-size: 0.88rem;">Nenhuma matéria encontrada para o filtro selecionado.</p>' +
          '</div>';
      }
      return;
    }

    let exibidas = filtradas;
    if (filtradas.length > 6 && filtradas.length !== 8 && filtradas.length % 3 !== 0) {
      exibidas = filtradas.slice(0, Math.floor(filtradas.length / 3) * 3);
    }
    gridEl.setAttribute('data-item-count', String(exibidas.length));

    const htmlCards = exibidas.map(function(item) {
      const safeUrl = sanitizarUrlHttp(item.url || '');
      const safeImg = sanitizarUrlHttp(item.imageUrl || '');
      const isCamara = String(item.source || '').toLowerCase() === 'camara';
      const badgeClass = isCamara ? 'is-camara' : 'is-prefeitura';
      const sourceLabel = item.sourceLabel || (isCamara ? 'Câmara Municipal' : 'Prefeitura');
      const dateStr = formatarDataNoticia(item.publishedAt);
      const titleSafe = esc(item.title || 'Matéria oficial');
      const summarySafe = esc(item.summary || '');
      const linkHtml = safeUrl
        ? '<a href="' + esc(safeUrl) + '" target="_blank" rel="noopener noreferrer" class="municipal-news-link">Ler matéria completa ↗</a>'
        : '';
      const imgHtml = safeImg
        ? '<img src="' + esc(safeImg) + '" alt="' + titleSafe + '" class="municipal-news-thumb" loading="lazy" />'
        : '';

      return (
        '<article class="municipal-news-card" data-source="' + esc(item.source || 'prefeitura') + '">' +
          imgHtml +
          '<div class="municipal-news-body">' +
            '<div class="municipal-news-meta">' +
              '<span class="municipal-news-badge ' + badgeClass + '">' + esc(sourceLabel) + '</span>' +
              '<span class="municipal-news-date">' + esc(dateStr) + '</span>' +
            '</div>' +
            '<h3 class="municipal-news-title">' + titleSafe + '</h3>' +
            (summarySafe ? '<p class="municipal-news-summary">' + summarySafe + '</p>' : '') +
            linkHtml +
          '</div>' +
        '</article>'
      );
    }).join('');

    gridEl.innerHTML = htmlCards;

    gridEl.querySelectorAll('img.municipal-news-thumb').forEach(function(img) {
      img.addEventListener('error', function() {
        img.style.display = 'none';
      });
    });
  }

  function carregarNoticiasMunicipais(forcar) {
    if (newsLoading) return;
    if (newsLoaded && !forcar) {
      renderizarNoticiasMunicipais();
      return;
    }

    const statusEl = document.getElementById('municipalNewsStatus');
    const gridEl = document.getElementById('municipalNewsGrid');
    if (!gridEl) return;

    newsLoading = true;
    if (statusEl) {
      statusEl.textContent = 'Consultando portais oficiais da Prefeitura e da Câmara Municipal...';
    }

    fetch(obterEndpointNoticiasMunicipais(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })
      .then(function(resp) {
        if (!resp.ok) {
          throw new Error('HTTP ' + resp.status);
        }
        return resp.json();
      })
      .then(function(data) {
        const items = data && Array.isArray(data.items) ? data.items : [];
        const errors = data && Array.isArray(data.errors) ? data.errors : [];
        municipalNewsCache = items;
        newsLoaded = items.length > 0;

        if (statusEl) {
          if (items.length > 0 && errors.length === 0) {
            statusEl.textContent = items.length + ' matérias oficiais carregadas dos portais do município.';
          } else if (items.length > 0) {
            statusEl.textContent = items.length + ' matérias carregadas (aviso em uma fonte: ' + errors[0] + ').';
          } else {
            statusEl.textContent = 'Não foi possível obter matérias recentes agora. Utilize os portais abaixo.';
          }
        }

        renderizarNoticiasMunicipais();
      })
      .catch(function(err) {
        console.warn('[VisaoGeral] Erro ao carregar notícias municipais:', err);
        municipalNewsCache = [];
        newsLoaded = false;
        renderizarNoticiasFallback('Feed temporariamente indisponível. Acesse os portais oficiais pelos links diretos abaixo.');
      })
      .finally(function() {
        newsLoading = false;
      });
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
    const sessao = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;

    renderizarConstelacao17Personas(lastOverviewData ? lastOverviewData.memorias : null);

    if (!sessao || !sessao.perfil) {
      lastOverviewData = null;
      isLoaded = false;
      isLoadingOverview = false;
      definirEstadoInicialNumeracao();
      return;
    }

    if (isLoadingOverview) {
      return;
    }
    isLoadingOverview = true;

    if (!lastOverviewData) {
      definirEstadoInicialNumeracao();
    }

    carregarNumeracaoSetorVisaoGeral();

    // 1. Consulta prioritária à fonte oficial (_memoria_apolo.md no Drive via Gateway GAS).
    // Enquanto a resposta não chega, os contadores permanecem com "--" (zero números estáticos).
    window.OlymposApi.chamar('overview_get', {}, function(res) {
      isLoadingOverview = false;
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
      isLoadingOverview = false;
      consultarFallbackSupabase();
    });
  }

  async function carregarNumeracaoSetorVisaoGeral() {
    const rbac = window.OlymposRbac;
    const setorAtual = (rbac && typeof rbac.getSetorAtual === 'function' && rbac.getSetorAtual()) || 'GABINETE';
    const isModOuGab = setorAtual === 'MODERADOR' || setorAtual === 'GABINETE';

    const labelOf = document.getElementById('statLabelProximoOficio');
    if (labelOf) {
      const info = rbac && rbac.SETORES_MAP ? rbac.SETORES_MAP[setorAtual] : null;
      labelOf.textContent = isModOuGab
        ? 'Olho de Apolo • Próximo Ofício (GS)'
        : ('Série Setorial • Próximo Ofício (' + (info ? info.siglaOficio : setorAtual) + ')');
    }

    // Gabinete e Moderador seguem exclusivamente os contadores reais da Memória de Apolo (Google Docs)
    if (isModOuGab) {
      return;
    }

    if (window.OlymposSupabase && typeof window.OlymposSupabase.listarNumeracaoVisivel === 'function') {
      try {
        const resNum = await window.OlymposSupabase.listarNumeracaoVisivel(2026);
        if (resNum && resNum.ok && Array.isArray(resNum.oficios)) {
          const item = resNum.oficios.find(function(n) { return n.setor_codigo === setorAtual; });
          if (item) {
            const elOf = document.getElementById('kpiProximoOficio');
            const elUltOf = document.getElementById('kpiUltimoOficio');
            const sigla = item.sigla_documento || setorAtual;
            if (elOf) elOf.textContent = 'Nº ' + item.proximo_numero + ' (' + sigla + ')';
            if (elUltOf) {
              elUltOf.innerHTML = '<span>Último emitido: Nº ' + (item.ultimo_numero || 0) + ' • Série ' + sigla + '</span>';
            }
          }
        }
      } catch (_eNum) {}
    }
  }

  function atualizarKpis(data) {
    if (!data) return;

    const rbac = window.OlymposRbac;
    const setorAtual = (rbac && typeof rbac.getSetorAtual === 'function' && rbac.getSetorAtual()) || 'GABINETE';
    const isModOuGab = setorAtual === 'MODERADOR' || setorAtual === 'GABINETE';

    if (data.numeracao) {
      const n = data.numeracao;
      const apoloIndisponivel = n.fonteApoloDisponivel === false || n.origem === 'INDISPONIVEL';
      const rawOf = (n.proximoOficio2026 !== undefined && n.proximoOficio2026 !== null)
        ? n.proximoOficio2026
        : ((n.proximoOficio !== undefined && n.proximoOficio !== null) ? n.proximoOficio : null);
      const rawPt = (n.proximaPortaria2026 !== undefined && n.proximaPortaria2026 !== null)
        ? n.proximaPortaria2026
        : ((n.proximaPortaria !== undefined && n.proximaPortaria !== null) ? n.proximaPortaria : null);
      const ofVal = !apoloIndisponivel && rawOf !== null && !isNaN(Number(rawOf)) ? Number(rawOf) : null;
      const ptVal = !apoloIndisponivel && rawPt !== null && !isNaN(Number(rawPt)) ? Number(rawPt) : null;
      const ultOf = (ofVal !== null)
        ? ((n.ultimoOficio2026 !== undefined && n.ultimoOficio2026 !== null) ? Number(n.ultimoOficio2026) : Math.max(0, ofVal - 1))
        : null;
      const ultPt = (ptVal !== null)
        ? ((n.ultimaPortaria2026 !== undefined && n.ultimaPortaria2026 !== null) ? Number(n.ultimaPortaria2026) : Math.max(0, ptVal - 1))
        : null;
      const rawMemUrl = (n.arquivoUrl && String(n.arquivoUrl).includes('docs.google.com/document/d/'))
        ? n.arquivoUrl
        : '';
      const memUrl = rawMemUrl || APOLO_MEMORIA_URL;

      if (!apoloIndisponivel && (ofVal !== null || ptVal !== null)) {
        window.OlymposApoloCache = Object.assign({}, n, {
          origem: 'MEMORIA_APOLO',
          fonteApoloDisponivel: true,
          proximoOficio2026: ofVal,
          ultimoOficio2026: ultOf,
          proximaPortaria2026: ptVal,
          ultimaPortaria2026: ultPt,
          arquivoUrl: memUrl
        });
        if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('olympos:apolo-numeracao-atualizada', { detail: window.OlymposApoloCache }));
        }
      }

      const elOf = document.getElementById('kpiProximoOficio');
      const elUltOf = document.getElementById('kpiUltimoOficio');
      const elPt = document.getElementById('kpiProximaPortaria');
      const elUltPt = document.getElementById('kpiUltimaPortaria');

      if (isModOuGab) {
        if (elOf) elOf.textContent = ofVal !== null ? ('Nº ' + ofVal) : '--';
        if (elUltOf) {
          elUltOf.innerHTML = '<span>' + (ultOf !== null ? ('Último emitido: Nº ' + ultOf) : 'Aguardando Memória de Apolo') + '</span>' +
            '<a href="' + window.OlymposApp.escapeHtml(memUrl) + '" target="_blank" rel="noopener" class="folder-chip" data-requires-auth="true" data-access-roles="MODERADOR,ADMIN_GABINETE,RH_COMISSAO,PEDAGOGICO_EVENTOS,JURIDICO">Memória de Apolo ↗</a>';
        }
      }

      if (elPt) elPt.textContent = isModOuGab && ptVal !== null ? ('Nº ' + ptVal) : '--';
      if (elUltPt) {
        elUltPt.innerHTML = '<span>' + (isModOuGab && ultPt !== null ? ('Última emitida: Nº ' + ultPt) : (isModOuGab ? 'Aguardando Memória de Apolo' : 'Exclusivo do Gabinete')) + '</span>' +
          '<a href="' + window.OlymposApp.escapeHtml(memUrl) + '" target="_blank" rel="noopener" class="folder-chip" data-requires-auth="true" data-access-roles="MODERADOR,ADMIN_GABINETE">Memória de Apolo ↗</a>';
      }

      if (window.OlymposApp && typeof window.OlymposApp.aplicarControleAcessoModularEDrive === 'function') {
        window.OlymposApp.aplicarControleAcessoModularEDrive();
      }

      const inOf = document.getElementById('inputProximoOficioMd');
      const inPt = document.getElementById('inputProximaPortariaMd');
      const inSig = document.getElementById('inputSignatarioMd');
      if (inOf && isModOuGab) {
        inOf.value = ofVal !== null ? String(ofVal) : '';
        inOf.placeholder = '--';
      }
      if (inPt && isModOuGab) {
        inPt.value = ptVal !== null ? String(ptVal) : '';
        inPt.placeholder = '--';
      }
      if (inSig && (n.signatarioTitular || n.signatario)) {
        inSig.value = n.signatarioTitular || n.signatario;
      }

      const inputOficioForm = document.getElementById('oficioNumeroInput');
      if (inputOficioForm && !(inputOficioForm.dataset && inputOficioForm.dataset.userEdited) && isModOuGab) {
        inputOficioForm.value = ofVal !== null ? String(ofVal) : '';
        inputOficioForm.placeholder = '--';
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
    if (!container) return;

    const catalogoDocs = (window.OLYMPOS_MEMORIAS_CATALOGO && typeof window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas === 'function')
      ? window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas()
      : (window.OlymposIcons ? window.OlymposIcons.getCatalogo17Personas() : []);

    const mapaLivePorArq = {};
    const mapaLivePorId = {};
    (memoriasLive || []).forEach(function(m) {
      if (m.arquivo) mapaLivePorArq[m.arquivo] = m;
      if (m.id) mapaLivePorId[m.id] = m;
    });

    container.innerHTML = '';
    catalogoDocs.forEach(function(p) {
      const live = (p.id && mapaLivePorId[p.id]) || (p.arquivo && mapaLivePorArq[p.arquivo]) || null;
      const merged = live ? Object.assign({}, p, live, { id: p.id || live.id, url: p.url || live.url }) : p;
      const docId = merged.id || merged.driveId || '';
      const docUrl = (docId ? ('https://docs.google.com/document/d/' + docId + '/edit') : (merged.url || ''));
      const iconKey = merged.icone || merged.slug || merged.id || 'olymposLogo';
      const svg = window.OlymposIcons ? window.OlymposIcons.get(iconKey) : '';
      const totalLinhas = (live && live.totalLinhas !== undefined)
        ? live.totalLinhas
        : (merged.totalLinhas !== undefined ? merged.totalLinhas : 0);
      const nome = merged.nome || merged.deus || merged.arquivo;
      const linhasInfo = totalLinhas ? (totalLinhas + ' / 60 linhas') : (merged.arquivo || 'Google Docs');
      const domCurto = String(merged.dominio || '').split(',')[0].trim();

      const tile = document.createElement('div');
      tile.className = 'home-persona-tile';
      tile.title = 'Clique para abrir a memória Google Docs de ' + nome;
      tile.innerHTML =
        '<div class="persona-emblem" aria-hidden="true">' + svg + '</div>' +
        '<div class="home-persona-info">' +
          '<div class="home-persona-top">' +
            '<span class="home-persona-name">' + window.OlymposApp.escapeHtml(nome) + '</span>' +
            '<span class="home-persona-layer">Google Docs</span>' +
          '</div>' +
          '<div class="home-persona-domain">' + window.OlymposApp.escapeHtml(domCurto || merged.dominio || '') + '</div>' +
          '<div class="home-persona-footer">' +
            '<span class="home-persona-meta">' + window.OlymposApp.escapeHtml(linhasInfo) + '</span>' +
            (docUrl ? '<a href="' + window.OlymposApp.escapeHtml(docUrl) + '" target="_blank" rel="noopener noreferrer" class="home-persona-doc-link" onclick="event.stopPropagation()">Docs ↗</a>' : '') +
          '</div>' +
        '</div>';

      tile.addEventListener('click', function() {
        if (window.OlymposApp && typeof window.OlymposApp.abrirModalMemoria === 'function') {
          window.OlymposApp.abrirModalMemoria(merged);
        } else if (window.OlymposRouter) {
          window.OlymposRouter.navegarPara('personas');
        }
      });

      container.appendChild(tile);
    });
  }

  async function reservarNumero(tipo) {
    const desc = prompt('Informe a finalidade/destinatário para reservar o próximo ' + tipo + ':', 'Emissão pelo Setor SMEB');
    if (!desc) return;

    const rbac = window.OlymposRbac;
    const setorAtual = (rbac && typeof rbac.getSetorAtual === 'function' && rbac.getSetorAtual()) || 'GABINETE';
    const isModOuGab = setorAtual === 'MODERADOR' || setorAtual === 'GABINETE';
    const alvoSetor = setorAtual === 'MODERADOR' ? 'GABINETE' : setorAtual;

    // Setores especializados (não Gabinete/Moderador) utilizam série setorial no Supabase
    if (!isModOuGab && window.OlymposSupabase && typeof window.OlymposSupabase.reservarNumeroDocumento === 'function') {
      try {
        const resRpc = await window.OlymposSupabase.reservarNumeroDocumento(tipo, alvoSetor, 2026, desc);
        if (resRpc && resRpc.ok) {
          window.OlymposApp.showToast(
            tipo + ' reservado (' + (resRpc.sigla_documento || alvoSetor) + '): Nº ' + resRpc.numero_formatado + ' (Próximo: ' + resRpc.proximo_numero + ')'
          );
          void carregarNumeracaoSetorVisaoGeral();
          return;
        }
      } catch (_eRpc) {
        // segue para fallback GAS
      }
    }

    // Gabinete e Moderador reservam prioritariamente na Memória de Apolo (_memoria_apolo)
    window.OlymposApi.chamar('reservar_numero_md', { tipo: tipo, detalhe: desc }, function(res) {
      if (res && res.ok) {
        const codigo = res.numeroFormatado || res.codigoOficial || (res.numeroReservado + '/2026');
        window.OlymposApp.showToast(tipo + ' reservado na Memória de Apolo: Nº ' + codigo + ' (Próximo: ' + res.proximoDisponivel + ')');
        if (res.numeracaoAtualizada) {
          atualizarKpis({ numeracao: Object.assign({ origem: 'MEMORIA_APOLO', fonteApoloDisponivel: true }, res.numeracaoAtualizada) });
          if (window.OlymposSupabase && typeof window.OlymposSupabase.sincronizarNumeracaoGabinete === 'function') {
            window.OlymposSupabase.sincronizarNumeracaoGabinete(res.numeracaoAtualizada);
          }
        }
        isLoaded = false;
        carregarDados();
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao reservar número na Memória de Apolo.', true);
      }
    }, function(err) {
      window.OlymposApp.showToast('Erro ao reservar número: ' + err.message, true);
    });
  }

  function resetarEstadoLogout() {
    isLoaded = false;
    isLoadingOverview = false;
    lastOverviewData = null;
    if (typeof window !== 'undefined') {
      delete window.OlymposApoloCache;
    }
    definirEstadoInicialNumeracao();
    atualizarTelemetriaCientifica();
    const elChamados = document.getElementById('heroTelemetryChamados');
    if (elChamados) elChamados.textContent = '--';
  }

  return {
    init: init,
    recarregar: carregarDados,
    resetarEstadoLogout: resetarEstadoLogout,
    atualizarSaudacaoVisitante: atualizarSaudacaoVisitante,
    carregarNoticiasMunicipais: carregarNoticiasMunicipais,
    renderizarWidgetEventosAgenda: renderizarWidgetEventosAgenda,
    atualizarTelemetriaCientifica: atualizarTelemetriaCientifica,
    getLastOverviewData: function() { return lastOverviewData; }
  };
})();
