/**
 * Hub Olympos V2.3 — Módulo de Visualização e Gestão: Escolas, CEIs e Instituições de Ceará-Mirim
 * Georreferenciamento de precisão com Leaflet.js 1.9.4, marcadores circulares temáticos,
 * sincronização automática imediata com Supabase (`public.escolas` + `public.catalogos_json`),
 * Categorias Institucionais padronizadas ('Escola', 'Centro de Educação Infantil', 'Instituição'),
 * popups ricos legíveis nos modos claro/escuro e CRUD completo na interface.
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.escolas = (function() {
  'use strict';

  var STORAGE_KEY = 'olympos_escolas_municipais';
  var leafletMap = null;
  var maplibreLayer = null;
  var cartoTileLayer = null;
  var themeObserverMapa = null;
  var markersLayer = null;
  var tempClickMarker = null;
  var markerMap = {}; // id -> L.marker
  var observerEscolas = null;
  var supabaseInicialCarregado = false;

  var activeCategoryFilter = 'todas';
  var activeZonaFilter = 'todas';
  var activeRedeFilter = 'todas';
  var activeSegmentFilter = 'todos';
  var currentSearchTerm = '';
  var paginaTabelaAtual = 1;
  var ITENS_TABELA_POR_PAGINA = 15;

  var CATEGORIAS_INSTITUCIONAIS = [
    'Escola',
    'Centro de Educação Infantil',
    'Instituição'
  ];

  function podeEditar() {
    return Boolean(
      window.OlymposApp &&
      typeof window.OlymposApp.podeEditarMapa === 'function' &&
      window.OlymposApp.podeEditarMapa()
    );
  }

  function atualizarPermissoesMapa() {
    var canEdit = podeEditar();
    ['btnNovaEscola', 'btnImportarEscolasJson', 'btnRestaurarEscolasPadrao', 'escolasCoordLiveDisplay'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('hidden', !canEdit);
      el.style.display = canEdit ? '' : 'none';
      el.setAttribute('aria-hidden', canEdit ? 'false' : 'true');
    });
    if (!canEdit) {
      fecharModal();
    }
    if (leafletMap && markersLayer) {
      renderizarMarcadores();
    }
    var tbody = document.getElementById('tabelaEscolasBody');
    if (tbody) {
      renderizarTabela();
    }
  }

  // Bounding box territorial aproximada de Ceará-Mirim/RN (do litoral de Muriú/Jacumã ao extremo norte em São Miguel/Riachão)
  var BOUNDS_CEARA_MIRIM = {
    minLat: -5.750000,
    maxLat: -5.460000,
    minLng: -35.600000,
    maxLng: -35.210000
  };

  /**
   * Normaliza qualquer categoria legada ou informada nos 3 tipos institucionais oficiais:
   * 'Escola', 'Centro de Educação Infantil' ou 'Instituição'.
   * Garante que uma Escola ofertando Ed. Infantil + Ens. Fundamental I jamais vire CEI.
   */
  function normalizarCategoriaInstitucional(cat, nome) {
    var c = String(cat || '').trim();
    var cLow = c.toLowerCase();
    var nLow = String(nome || '').trim().toLowerCase();

    if (
      c === 'Instituição' ||
      cLow === 'instituicao' ||
      cLow.includes('institui') ||
      cLow.includes('sede') ||
      nLow.includes('smeb sede') ||
      nLow.includes('secretaria') ||
      nLow.includes('ifrn')
    ) {
      return 'Instituição';
    }

    if (
      c === 'Centro de Educação Infantil' ||
      c === 'Educação Infantil' ||
      c === 'Educação Infantil (CEI)' ||
      cLow === 'cei' ||
      cLow === 'cmei' ||
      cLow === 'creche' ||
      /^c\.?e\.?i\.?\b/i.test(nLow) ||
      /^cmei\b/i.test(nLow) ||
      nLow.includes('centro de educação infantil')
    ) {
      return 'Centro de Educação Infantil';
    }

    return 'Escola';
  }

  /**
   * Converte uma categoria em segmentos educacionais canônicos caso segmentos não tenha sido informado
   */
  function normalizarSegmentosDeCategoria(cat, nome) {
    var catInst = normalizarCategoriaInstitucional(cat, nome);
    var cLow = String(cat || '').toLowerCase();

    if (catInst === 'Centro de Educação Infantil') {
      return ['Ed. Infantil'];
    }
    if (catInst === 'Instituição') {
      if (String(nome || '').toLowerCase().includes('ifrn')) {
        return ['Ensino Médio', 'Ensino Técnico'];
      }
      return ['Sede Administrativa'];
    }
    if (cLow.includes('especial')) {
      return ['Educação Especial'];
    }
    if (cLow.includes('medio') || cLow.includes('médio')) {
      return ['Ensino Médio'];
    }
    return ['Ens. Fundamental I', 'Ens. Fundamental II'];
  }

  /**
   * Ponto de entrada chamado pelo roteador modular.
   * Renderiza de imediato e dispara sincronização automática com o Supabase (`escolas` / `catalogos_json`).
   */
  function init() {
    garantirBancoInicial();
    bindEvents();
    inicializarMapa();
    atualizarPermissoesMapa();
    renderizarInterface();
    observarVisibilidadePagina();
    sincronizarInicialComSupabase();
  }

  /**
   * Carrega imediatamente as coordenadas e registros oficiais armazenados no Supabase
   * assim que o usuário entra na interface, atualizando localStorage, KPIs, mapa e tabela.
   */
  function sincronizarInicialComSupabase() {
    if (supabaseInicialCarregado) return;
    if (!window.OlymposSupabase || typeof window.OlymposSupabase.carregarEscolas !== 'function') return;

    supabaseInicialCarregado = true;
    try {
      var promessa = window.OlymposSupabase.carregarEscolas();
      if (promessa && typeof promessa.then === 'function') {
        promessa.then(function(listaRemota) {
          if (Array.isArray(listaRemota) && listaRemota.length > 0) {
            console.log('[Olympos Supabase] Escolas recebidas do banco (' + listaRemota.length + ' unidades):', listaRemota);
            var saneadas = listaRemota.map(sanitizarRegistroEscola);
            salvarEscolas(saneadas);
            renderizarInterface();
          }
        }).catch(function(err) {
          console.warn('[EscolasView] Falha ao sincronizar catálogo inicial do Supabase:', err);
        });
      }
    } catch (eSync) {
      console.warn('[EscolasView] Exceção ao disparar carga inicial do Supabase:', eSync);
    }
  }

  /**
   * Garante integridade de categoria institucional, cor e símbolo de cada unidade
   */
  function sanitizarRegistroEscola(esc) {
    if (!esc) return esc;
    var copia = Object.assign({}, esc);

    if (typeof copia.nome === 'string' && copia.nome.includes('CMEI')) {
      copia.nome = copia.nome.replace(/\bCMEI\b/g, 'CEI');
    }

    if (!copia.rede || !['Municipal', 'Estadual', 'Federal', 'Privada'].includes(copia.rede)) {
      copia.rede = 'Municipal';
    }

    var catAntiga = copia.categoria;
    copia.categoria = normalizarCategoriaInstitucional(catAntiga, copia.nome);

    if (!Array.isArray(copia.segmentos) || copia.segmentos.length === 0) {
      copia.segmentos = normalizarSegmentosDeCategoria(catAntiga, copia.nome);
    }

    var corEsperada = obterCorPorRedeECategoria(copia.rede, copia.categoria, copia.zona, copia.nome);
    var iconeEsperado = obterIconePorRedeECategoria(copia.rede, copia.categoria, copia.zona, copia.nome, copia.segmentos);

    // Auto-repara unidades do tipo 'Escola' multi-segmento que haviam recebido indevidamente símbolo 'C' ou cor de CEI
    if (copia.categoria === 'Escola' && Array.isArray(copia.segmentos) && copia.segmentos.length > 1) {
      if (copia.icone === 'C') copia.icone = iconeEsperado;
      if (copia.cor === '#F59E0B') copia.cor = corEsperada;
    }

    copia.cor = copia.cor || corEsperada;
    copia.icone = copia.icone || iconeEsperado;

    return copia;
  }

  /**
   * Garante inicialização no localStorage a partir do catálogo semente e auto-repara categorias/símbolos
   */
  function garantirBancoInicial() {
    try {
      var gravado = localStorage.getItem(STORAGE_KEY);
      if (!gravado || gravado === '[]') {
        var legado = localStorage.getItem('olympos_escolas_ceara_mirim_v1') || localStorage.getItem('olympos_escolas_ceara_mirim');
        if (legado && legado !== '[]') {
          try {
            var arrLeg = JSON.parse(legado);
            if (Array.isArray(arrLeg) && arrLeg.length > 0) {
              var saneadoLeg = arrLeg.filter(Boolean).map(sanitizarRegistroEscola);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(saneadoLeg));
              return;
            }
          } catch (eLeg) {}
        }
        var semente = (typeof window.BANCO_SEMENTE_ESCOLAS !== 'undefined' && Array.isArray(window.BANCO_SEMENTE_ESCOLAS))
          ? window.BANCO_SEMENTE_ESCOLAS.map(sanitizarRegistroEscola)
          : [];
        if (semente.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(semente));
        }
      } else {
        try {
          var arr = JSON.parse(gravado);
          if (Array.isArray(arr)) {
            var antesStr = JSON.stringify(arr);
            var saneadoArr = arr.filter(Boolean).map(sanitizarRegistroEscola);
            var depoisStr = JSON.stringify(saneadoArr);
            if (antesStr !== depoisStr) {
              localStorage.setItem(STORAGE_KEY, depoisStr);
            }
          }
        } catch (eMig) {
          console.warn('[EscolasView] Erro na auto-migração de escolas:', eMig);
        }
      }
    } catch (e) {
      console.warn('[EscolasView] LocalStorage inacessível:', e);
    }
  }

  /**
   * Retorna lista de escolas do localStorage ou semente
   */
  function obterEscolas() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('olympos_escolas_ceara_mirim_v1') || localStorage.getItem('olympos_escolas_ceara_mirim');
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          return arr.filter(Boolean).map(sanitizarRegistroEscola);
        }
      }
    } catch (e) {
      console.warn('[EscolasView] Erro ao ler escolas do localStorage:', e);
    }
    if (typeof window.BANCO_SEMENTE_ESCOLAS !== 'undefined' && Array.isArray(window.BANCO_SEMENTE_ESCOLAS)) {
      return window.BANCO_SEMENTE_ESCOLAS.slice();
    }
    return [];
  }

  /**
   * Persiste lista de escolas no localStorage
   */
  function salvarEscolas(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      console.error('[EscolasView] Erro ao salvar escolas:', e);
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Erro ao salvar dados no armazenamento local.', true);
      }
      return false;
    }
  }

  /**
   * Obtém o estilo vetorial MapLibre GL JS (OpenFreeMap / Carto) e o fallback raster Carto conforme o tema ativo
   */
  function obterConfigEstiloMapa() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var carto = (typeof window !== 'undefined' && window.OlymposCarto) ? window.OlymposCarto : null;
    return {
      isDark: isDark,
      openFreeMapStyle: isDark
        ? 'https://tiles.openfreemap.org/styles/dark'
        : 'https://tiles.openfreemap.org/styles/liberty',
      cartoGlStyle: carto && typeof carto.getStyleUrl === 'function'
        ? carto.getStyleUrl(isDark)
        : (isDark
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'),
      cartoRasterUrl: carto && typeof carto.getRasterTileUrl === 'function'
        ? carto.getRasterTileUrl(isDark)
        : (isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'),
      transformRequest: carto && typeof carto.transformRequest === 'function' ? carto.transformRequest : undefined,
      attribution: '&copy; <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> • SMEB Ceará-Mirim'
    };
  }

  /**
   * Aplica ou atualiza a camada base MapLibre GL JS + Carto / OpenFreeMap no mapa
   */
  function aplicarCamadaBaseMapa() {
    if (!leafletMap || typeof window.L === 'undefined') return;
    var cfg = obterConfigEstiloMapa();

    // Camada base Carto Retina (Voyager / Dark Matter) de alta velocidade + suporte vetorial MapLibre GL JS (autenticado via CARTO_API_KEY)
    if (cartoTileLayer) {
      cartoTileLayer.setUrl(cfg.cartoRasterUrl);
    } else {
      cartoTileLayer = window.L.tileLayer(cfg.cartoRasterUrl, {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: cfg.attribution
      }).addTo(leafletMap);
    }

    if (typeof window.maplibregl !== 'undefined' && typeof window.L.maplibreGL === 'function') {
      try {
        if (maplibreLayer && typeof maplibreLayer.getMaplibreMap === 'function') {
          var glMap = maplibreLayer.getMaplibreMap();
          if (glMap && typeof glMap.setStyle === 'function') {
            glMap.setStyle(cfg.cartoGlStyle);
          }
        } else {
          var glOpts = {
            style: cfg.cartoGlStyle,
            attributionControl: false
          };
          if (typeof cfg.transformRequest === 'function') {
            glOpts.transformRequest = cfg.transformRequest;
          }
          var layer = window.L.maplibreGL(glOpts);
          if (layer) {
            layer.on('error', function(err) {
              console.warn('[EscolasView] MapLibre GL error, fallback raster mantido:', err);
              if (maplibreLayer && leafletMap && leafletMap.hasLayer(maplibreLayer)) {
                try { leafletMap.removeLayer(maplibreLayer); } catch(e) {}
              }
            });
            maplibreLayer = layer.addTo(leafletMap);
          }
        }
      } catch (eGl) {
        console.warn('[EscolasView] Fallback Carto Raster ativo (WebGL indisponível):', eGl);
      }
    }
  }

  /**
   * Inicializa o mapa interativo com MapLibre GL JS + Carto / OpenFreeMap (e bridge Leaflet)
   */
  function inicializarMapa() {
    var mapEl = document.getElementById('mapaEscolasCearaMirim') || document.getElementById('mapaEscolas');
    if (!mapEl || typeof window.L === 'undefined') return;

    if (!leafletMap) {
      leafletMap = window.L.map(mapEl.id, {
        center: [-5.634, -35.428],
        zoom: 11,
        zoomControl: true,
        scrollWheelZoom: true
      });

      aplicarCamadaBaseMapa();

      markersLayer = window.L.layerGroup().addTo(leafletMap);

      leafletMap.on('click', function(e) {
        tratarCliqueMapa(e);
      });

      if (!themeObserverMapa && typeof MutationObserver !== 'undefined') {
        themeObserverMapa = new MutationObserver(function() {
          aplicarCamadaBaseMapa();
        });
        themeObserverMapa.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme']
        });
      }
    }

    setTimeout(function() {
      if (leafletMap) leafletMap.invalidateSize();
    }, 150);

    renderizarMarcadores();
  }

  /**
   * Trata clique interativo no mapa
   */
  function tratarCliqueMapa(e) {
    if (!podeEditar()) {
      return;
    }
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    var liveDisplay = document.getElementById('escolasCoordLiveDisplay');
    if (liveDisplay) {
      liveDisplay.textContent = 'Lat: ' + lat.toFixed(6) + ' | Lng: ' + lng.toFixed(6);
    }

    var modal = document.getElementById('modalCadastroEscola') || document.getElementById('modalEscola');
    var isModalAberto = modal && !modal.classList.contains('hidden') && modal.style.display !== 'none';

    if (isModalAberto) {
      var inLat = document.getElementById('escolaLatitude');
      var inLng = document.getElementById('escolaLongitude');
      if (inLat && inLng) {
        inLat.value = lat.toFixed(6);
        inLng.value = lng.toFixed(6);
        validarCoordenadasForm();
      }

      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Coordenadas capturadas do clique no mapa!');
      }
    }

    if (leafletMap) {
      if (tempClickMarker) {
        leafletMap.removeLayer(tempClickMarker);
      }
      var clickIcon = window.L.divIcon({
        className: 'escola-click-divicon',
        html: '<div style="width: 14px; height: 14px; border-radius: 50%; background: #EF4444; border: 2px solid #FFFFFF; box-shadow: 0 0 0 4px rgba(239,68,68,0.35); animation: pulse 1.5s infinite;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      tempClickMarker = window.L.marker([lat, lng], { icon: clickIcon, zIndexOffset: 1000 }).addTo(leafletMap);

      if (!isModalAberto) {
        setTimeout(function() {
          if (tempClickMarker && leafletMap) {
            leafletMap.removeLayer(tempClickMarker);
            tempClickMarker = null;
          }
        }, 4000);
      }
    }
  }

  /**
   * Valida se latitude e longitude estão na bounding box de Ceará-Mirim
   */
  function estaEmCearaMirim(lat, lng) {
    var nLat = parseFloat(lat);
    var nLng = parseFloat(lng);
    if (isNaN(nLat) || isNaN(nLng)) return false;
    return nLat >= BOUNDS_CEARA_MIRIM.minLat &&
           nLat <= BOUNDS_CEARA_MIRIM.maxLat &&
           nLng >= BOUNDS_CEARA_MIRIM.minLng &&
           nLng <= BOUNDS_CEARA_MIRIM.maxLng;
  }

  /**
   * Atualiza badge visual de validação no formulário
   */
  function validarCoordenadasForm() {
    var inLat = document.getElementById('escolaLatitude');
    var inLng = document.getElementById('escolaLongitude');
    var badge = document.getElementById('escolaCoordValidacaoBadge');
    if (!badge || !inLat || !inLng) return;

    var lat = parseFloat(inLat.value);
    var lng = parseFloat(inLng.value);

    if (isNaN(lat) || isNaN(lng)) {
      badge.className = 'pill-badge pill-muted';
      badge.textContent = 'Informe latitude e longitude decimais válidas.';
      return;
    }

    if (estaEmCearaMirim(lat, lng)) {
      badge.className = 'pill-badge pill-green';
      badge.innerHTML = (window.OlymposIcons ? window.OlymposIcons.ui('check') : '') + ' Coordenadas dentro da delimitação territorial de Ceará-Mirim/RN';
    } else {
      badge.className = 'pill-badge pill-amber';
      badge.innerHTML = (window.OlymposIcons ? window.OlymposIcons.ui('alertTriangle') : '') + ' Atenção: Ponto fora dos limites territoriais típicos de Ceará-Mirim';
    }
  }

  /**
   * Determina a cor visual do marcador estritamente pela Categoria Institucional e Zona.
   * Somente 'Centro de Educação Infantil' recebe o âmbar (#F59E0B).
   */
  function obterCorPorCategoria(categoria, zona, nome) {
    var catInst = normalizarCategoriaInstitucional(categoria, nome);
    var zon = String(zona || '').toLowerCase();

    if (catInst === 'Instituição') return '#D4AF37'; // Dourado Instituição / Sede
    if (catInst === 'Centro de Educação Infantil') return '#F59E0B'; // Âmbar exclusivo CEI
    if (zon.includes('rural')) return '#10B981'; // Verde Escola Rural
    return '#38BDF8'; // Azul Escola Urbana
  }

  /**
   * Determina o ícone ou letra no centro do marcador circular estritamente pela Categoria Institucional.
   * Escolas ('Escola') jamais recebem 'C' mesmo que ofertem Ed. Infantil + Ens. Fundamental I.
   */
  function obterIconePorCategoria(categoria, zona, nome) {
    var catInst = normalizarCategoriaInstitucional(categoria, nome);
    var zon = String(zona || '').toLowerCase();

    if (catInst === 'Instituição') return '★';
    if (catInst === 'Centro de Educação Infantil') return 'C';
    if (zon.includes('rural')) return 'R';
    return 'U';
  }

  /**
   * Determina a cor visual do marcador considerando rede e zona:
   * - Rede Municipal: Urbana = Verde claro (#22C55E), Rural = Verde escuro (#166534)
   * - Rede Estadual: Urbana = Amarelo claro (#FACC15), Rural = Laranja (#EA580C)
   * - Rede Federal: Urbana = Azul claro (#38BDF8), Rural = Azul escuro (#1E40AF)
   * - Rede Privada: Urbana = Vermelho (#EF4444), Rural = Rosa (#EC4899)
   */
  function obterCorPorRedeECategoria(rede, categoria, zona, nome) {
    var r = String(rede || 'Municipal').toLowerCase();
    var z = String(zona || 'Urbana').toLowerCase();
    var isRural = z.includes('rural');

    if (r === 'estadual') {
      return isRural ? '#EA580C' : '#FACC15';
    }
    if (r === 'federal') {
      return isRural ? '#1E40AF' : '#38BDF8';
    }
    if (r === 'privada') {
      return isRural ? '#EC4899' : '#EF4444';
    }
    // Municipal (padrão)
    return isRural ? '#166534' : '#22C55E';
  }

  /**
   * Determina o ícone ou símbolo do marcador com base nos segmentos atendidos:
   * - Educação Infantil ou CEI: 'C'
   * - Ensino Fundamental I: 'I'
   * - Ensino Fundamental II: 'II'
   * - Nível Médio / Técnico: 'M'
   * - Mais de um segmento: 'X'
   * - Sede Administrativa / Inclusão Especial: '★'
   */
  function obterIconePorRedeECategoria(rede, categoria, zona, nome, segmentos) {
    var nLow = String(nome || '').toLowerCase();
    if (nLow.includes('smeb sede') || nLow.includes('cemai')) {
      return '★';
    }

    var segs = Array.isArray(segmentos) ? segmentos : [];
    if (segs.length === 0) {
      segs = normalizarSegmentosDeCategoria(categoria, nome);
    }

    var validSegs = segs.filter(function(s) {
      return !s.includes('Sede') && !s.includes('Especial');
    });

    if (validSegs.length > 1) {
      return 'X';
    }

    if (validSegs.length === 1) {
      var s = validSegs[0].toLowerCase();
      if (s.includes('infantil') || s.includes('creche') || s.includes('cei')) return 'C';
      if (s.includes('fundamental i') || s.includes('anos iniciais')) return 'I';
      if (s.includes('fundamental ii') || s.includes('anos finais')) return 'II';
      if (s.includes('médio') || s.includes('medio') || s.includes('técnico') || s.includes('tecnico')) return 'M';
    }

    var catInst = normalizarCategoriaInstitucional(categoria, nome);
    if (catInst === 'Centro de Educação Infantil') return 'C';
    if (catInst === 'Instituição') return '★';

    return 'I';
  }

  var MAP_GLYPHS_SVGS = {
    cei: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="8" height="9" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/><path d="M8 11V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v7"/><circle cx="12" cy="7.5" r="1"/></svg>',
    inst_sede: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10L12 4l9 6"/><path d="M5 10h14M6 20h12M7.5 10v10M12 10v10M16.5 10v10"/></svg>',
    inst_especial: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.5-9-9.5C1.5 7.5 4.5 4 8 4c1.9 0 3.2 1 4 2.2C12.8 5 14.1 4 16 4c3.5 0 6.5 3.5 5 7.5-2 5-9 9.5-9 9.5z"/><path d="M12 9v4M10 11h4"/></svg>',
    inst_tecnico: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    inst_generic: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="2.2"/></svg>',
    seg_infantil: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c2 2.5 4 4.5 4 7a4 4 0 0 1-8 0c0-2.5 2-4.5 4-7z"/><path d="M12 14v7M8 18h8"/></svg>',
    seg_fund1: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M12 7v6"/></svg>',
    seg_fund2: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M10 7v6M14 7v6"/></svg>',
    seg_medio: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    seg_eja: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 8.5 8.5A9 9 0 1 1 12 3z"/><path d="M15 7h4M17 5v4"/></svg>',
    seg_especial: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-4-8.5-8.5A5 5 0 0 1 12 6.5a5 5 0 0 1 8.5 6C18.5 17 12 21 12 21z"/></svg>',
    seg_tecnico: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 19 6 19 18 12 22 5 18 5 6"/><circle cx="12" cy="12" r="2.5"/></svg>',
    combo_infantil_fund1: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l9-6 9 6v10H3V10z"/><circle cx="9.5" cy="14" r="1.5"/><path d="M14.5 12v4"/></svg>',
    combo_infantil_fund1_fund2: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16M6 15h12M8 10h8M10 5h4"/></svg>',
    combo_fund1_fund2: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/><path d="M7 9v6M17 9v6"/></svg>',
    combo_fund2_medio: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 13v5h10v-5"/><path d="M10 15.5h4"/></svg>',
    combo_eja_fund1_fund2: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4a5 5 0 0 0 6 7A7 7 0 1 1 9 4z"/><path d="M14 14h7v6h-7z"/></svg>',
    combo_multi: '<svg viewBox="0 0 24 24" width="__SZ__" height="__SZ__" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>'
  };

  function normalizarChaveSegmento_(seg) {
    var s = String(seg || '').toLowerCase();
    if (s.includes('sede')) return 'sede';
    if (s.includes('especial') || s.includes('inclus')) return 'especial';
    if (s.includes('infantil') || s.includes('creche') || s.includes('cei')) return 'infantil';
    if (s.includes('fundamental ii') || s.includes('anos finais')) return 'fund2';
    if (s.includes('fundamental i') || s.includes('anos iniciais')) return 'fund1';
    if (s.includes('técnico') || s.includes('tecnico')) return 'tecnico';
    if (s.includes('médio') || s.includes('medio')) return 'medio';
    if (s.includes('eja')) return 'eja';
    return 'fund1';
  }

  function resolverGlyphKeyEscola_(escola, catInst, segmentos) {
    var nLow = String((escola && escola.nome) || '').toLowerCase();
    if (catInst === 'Centro de Educação Infantil') return { key: 'cei', sig: 'cei' };
    if (nLow.includes('smeb sede') || segmentos.some(function(s) { return s.toLowerCase().includes('sede'); })) {
      return { key: 'inst_sede', sig: 'inst_sede' };
    }
    if (nLow.includes('cemai') || (catInst === 'Instituição' && segmentos.some(function(s) { return s.toLowerCase().includes('especial'); }))) {
      return { key: 'inst_especial', sig: 'inst_especial' };
    }
    if (catInst === 'Instituição') {
      if (segmentos.some(function(s) { var l = s.toLowerCase(); return l.includes('técnico') || l.includes('tecnico'); })) {
        return { key: 'inst_tecnico', sig: 'inst_tecnico' };
      }
      return { key: 'inst_generic', sig: 'inst_generic' };
    }

    var uniq = [];
    segmentos.forEach(function(s) {
      var k = normalizarChaveSegmento_(s);
      if (uniq.indexOf(k) === -1) uniq.push(k);
    });
    uniq.sort();
    var sig = uniq.join('+');

    if (uniq.length <= 1) {
      var single = uniq[0] || 'fund1';
      return { key: 'seg_' + single, sig: sig || 'fund1' };
    }
    if (sig === 'fund1+infantil') return { key: 'combo_infantil_fund1', sig: sig };
    if (sig === 'fund1+fund2+infantil') return { key: 'combo_infantil_fund1_fund2', sig: sig };
    if (sig === 'fund1+fund2') return { key: 'combo_fund1_fund2', sig: sig };
    if (sig === 'fund2+medio') return { key: 'combo_fund2_medio', sig: sig };
    if (sig === 'eja+fund1+fund2') return { key: 'combo_eja_fund1_fund2', sig: sig };
    return { key: 'combo_multi', sig: sig };
  }

  /**
   * Gera emblema SVG específico e delimitado (<= 32px) para cada combinação de Categoria, Rede, Zona e Segmentos.
   */
  function obterIconeEscola(escola, sizePx) {
    var esc = escola || {};
    var redeRaw = String(esc.rede || 'Municipal').trim();
    var redeNorm = ['Municipal', 'Estadual', 'Federal', 'Privada'].includes(redeRaw) ? redeRaw : 'Municipal';
    var zonaNorm = String(esc.zona || 'Urbana').toLowerCase().includes('rural') ? 'Rural' : 'Urbana';
    var catInst = normalizarCategoriaInstitucional(esc.categoria, esc.nome);
    var segs = Array.isArray(esc.segmentos) && esc.segmentos.length > 0
      ? esc.segmentos
      : normalizarSegmentosDeCategoria(catInst, esc.nome);

    var cor = obterCorPorRedeECategoria(redeNorm, catInst, zonaNorm, esc.nome);
    var ink = (cor === '#FACC15') ? '#1E293B' : '#FFFFFF';
    var sz = (typeof sizePx === 'number' && sizePx >= 18 && sizePx <= 32) ? sizePx : 28;
    var svgSz = Math.max(12, Math.round(sz * 0.54));

    var resolved = resolverGlyphKeyEscola_(esc, catInst, segs);
    var rawSvg = MAP_GLYPHS_SVGS[resolved.key] || MAP_GLYPHS_SVGS.seg_fund1;
    var svgHtml = rawSvg.replace(/__SZ__/g, String(svgSz));

    var radius = (catInst === 'Centro de Educação Infantil')
      ? '8px'
      : (catInst === 'Instituição' ? '6px' : '50%');
    var borderStyle = zonaNorm === 'Rural'
      ? ('border: 2px dashed #FFFFFF; outline: 1.5px solid ' + cor + ';')
      : 'border: 2.5px solid #FFFFFF;';
    var ringShadow = catInst === 'Instituição'
      ? 'box-shadow: 0 0 0 1.5px #D4AF37, 0 2px 6px rgba(0,0,0,0.4);'
      : 'box-shadow: 0 2px 6px rgba(0,0,0,0.38);';

    var titleText = escapeHtml(catInst + ' • ' + redeNorm + ' (' + zonaNorm + ') — ' + segs.join(', '));
    return (
      '<div class="escola-marker-badge" data-cat="' + escapeHtml(catInst) + '" data-rede="' + escapeHtml(redeNorm) + '" data-zona="' + escapeHtml(zonaNorm) + '" data-combo="' + escapeHtml(resolved.sig) + '" title="' + titleText + '" style="background:' + cor + '; width:' + sz + 'px; height:' + sz + 'px; border-radius:' + radius + '; ' + borderStyle + ' ' + ringShadow + ' color:' + ink + '; cursor:pointer;">' +
        svgHtml +
      '</div>'
    );
  }

  /**
   * Renderiza todos os marcadores no mapa Leaflet
   */
  function renderizarMarcadores() {
    if (!leafletMap || !markersLayer) return;
    markersLayer.clearLayers();
    markerMap = {};

    var escolas = obterEscolasFiltradas();
    var canEdit = podeEditar();

    escolas.forEach(function(escola) {
      var lat = parseFloat(escola.lat);
      var lng = parseFloat(escola.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      var rede = escola.rede || 'Municipal';
      var catInst = normalizarCategoriaInstitucional(escola.categoria, escola.nome);
      var markerHtml = obterIconeEscola(escola, 28);

      var divIcon = window.L.divIcon({
        className: 'cadmo-leaflet-divicon escola-leaflet-divicon',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -15]
      });

      var marker = window.L.marker([lat, lng], { icon: divIcon });

      var rotaUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + lat.toFixed(6) + ',' + lng.toFixed(6);

      var segmentos = Array.isArray(escola.segmentos) && escola.segmentos.length > 0
        ? escola.segmentos
        : normalizarSegmentosDeCategoria(catInst, escola.nome);

      var segmentosHtml = segmentos.map(function(seg) {
        return '<span class="pill-segmento-mini">' + escapeHtml(seg) + '</span>';
      }).join(' ');

      var redeClass = 'pill-rede-' + (rede.toLowerCase());

      var icPin = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('mapPin') : '';
      var icEdit = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('edit') : '';
      var icTrash = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('trash') : '';
      var icCompass = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('compass') : '';
      var icCopy = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('copyClip') : '';

      var editActionsHtml = canEdit
        ? (
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.abrirModalEdicao(\'' + escapeHtml(escola.id) + '\')">' + icEdit + ' Editar</button>' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.excluirEscola(\'' + escapeHtml(escola.id) + '\')">' + icTrash + ' Excluir</button>'
          )
        : '';

      var popupHtml =
        '<div class="cadmo-map-popup escola-map-popup">' +
          '<div class="escola-popup-header">' +
            '<span class="pill-badge pill-rede ' + redeClass + '">' + escapeHtml(rede) + '</span>' +
            '<span class="escola-popup-meta-tag">' + escapeHtml(catInst) + ' • ' + escapeHtml(escola.zona || 'Urbana') + '</span>' +
          '</div>' +
          '<strong class="escola-popup-title">' + escapeHtml(escola.nome) + '</strong>' +
          '<div class="escola-popup-segmentos">' + segmentosHtml + '</div>' +
          (escola.bairroDistrito ? '<div class="escola-popup-detail">' + icPin + ' <strong>Bairro/Distrito:</strong> ' + escapeHtml(escola.bairroDistrito) + '</div>' : '') +
          (escola.endereco ? '<div class="escola-popup-address">' + escapeHtml(escola.endereco) + '</div>' : '') +
          (escola.inep ? '<div class="escola-popup-detail">INEP: <code>' + escapeHtml(escola.inep) + '</code></div>' : '') +
          (escola.telefone ? '<div class="escola-popup-detail">Tel: ' + escapeHtml(escola.telefone) + '</div>' : '') +
          '<div class="escola-popup-coords">' +
            lat.toFixed(6) + ', ' + lng.toFixed(6) +
          '</div>' +
          '<div class="escola-popup-actions">' +
            editActionsHtml +
            '<a href="' + rotaUrl + '" target="_blank" rel="noopener" class="btn-map-action">' + icCompass + ' Rota</a>' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.copiarCoordenadas(' + lat + ', ' + lng + ')">' + icCopy + ' Copiar</button>' +
          '</div>' +
        '</div>';

      marker.bindPopup(popupHtml);
      markersLayer.addLayer(marker);
      markerMap[escola.id] = marker;
    });
  }

  /**
   * Filtra lista conforme busca textual, rede, segmento, categoria institucional e zona
   */
  function obterEscolasFiltradas() {
    var todas = obterEscolas();
    var termo = (currentSearchTerm || '').trim().toLowerCase();
    var filtroCat = String(activeCategoryFilter || 'todas').toLowerCase();
    var filtroZona = String(activeZonaFilter || 'todas').toLowerCase();
    var filtroRede = activeRedeFilter;
    var filtroSeg = activeSegmentFilter;

    var termoNormalizado = termo;
    var termoAlternativo = null;
    if (termo === 'cmei') {
      termoAlternativo = 'cei';
    } else if (termo === 'cei') {
      termoAlternativo = 'cmei';
    }

    return todas.filter(function(item) {
      var catInst = normalizarCategoriaInstitucional(item.categoria, item.nome);
      var catLow = catInst.toLowerCase();
      var zon = String(item.zona || 'Urbana').toLowerCase();
      var rede = String(item.rede || 'Municipal');
      var segmentos = Array.isArray(item.segmentos) && item.segmentos.length > 0
        ? item.segmentos
        : normalizarSegmentosDeCategoria(catInst, item.nome);

      // 1. Filtro por Rede
      if (filtroRede && filtroRede !== 'todas') {
        if (rede.toLowerCase() !== filtroRede.toLowerCase()) {
          return false;
        }
      }

      // 2. Filtro por Segmento (Inclusivo)
      if (filtroSeg && filtroSeg !== 'todos') {
        var matchSeg = segmentos.some(function(s) {
          return s.toLowerCase() === filtroSeg.toLowerCase();
        });
        if (!matchSeg) {
          return false;
        }
      }

      // 3. Filtro de Categoria Institucional (e aliases legados)
      if (filtroCat && filtroCat !== 'todas') {
        if (filtroCat === 'escola' || filtroCat === 'escolas') {
          if (catInst !== 'Escola') return false;
        } else if (filtroCat === 'cei' || filtroCat === 'cmei' || filtroCat === 'centro de educação infantil') {
          if (catInst !== 'Centro de Educação Infantil') return false;
        } else if (filtroCat === 'instituicao' || filtroCat === 'instituição' || filtroCat === 'sede') {
          if (catInst !== 'Instituição') return false;
        } else if (filtroCat === 'urbana') {
          if (zon !== 'urbana') return false;
        } else if (filtroCat === 'rural') {
          if (zon !== 'rural') return false;
        }
      }

      // 4. Filtro de Zona dedicado
      if (filtroZona && filtroZona !== 'todas') {
        if (zon !== filtroZona) return false;
      }

      // 5. Filtro de Busca Textual
      if (termoNormalizado) {
        var strNome = String(item.nome || '').toLowerCase();
        var strBairro = String(item.bairroDistrito || '').toLowerCase();
        var strEndereco = String(item.endereco || '').toLowerCase();
        var strInep = String(item.inep || '').toLowerCase();
        var strRede = rede.toLowerCase();
        var strSegs = segmentos.join(' ').toLowerCase();

        var matchPadrao = strNome.includes(termoNormalizado) ||
                          strBairro.includes(termoNormalizado) ||
                          strEndereco.includes(termoNormalizado) ||
                          strInep.includes(termoNormalizado) ||
                          strRede.includes(termoNormalizado) ||
                          strSegs.includes(termoNormalizado) ||
                          catLow.includes(termoNormalizado);

        var matchAlt = termoAlternativo ? (strNome.includes(termoAlternativo) || catLow.includes(termoAlternativo)) : false;

        if (!matchPadrao && !matchAlt) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Renderiza todos os blocos da interface: KPIs, Tabela e Marcadores
   */
  function renderizarInterface() {
    renderizarKpis();
    renderizarMarcadores();
    renderizarTabela();
  }

  /**
   * Atualiza cartões numéricos KPI usando estritamente a Categoria Institucional normalizada
   */
  function renderizarKpis() {
    var todas = obterEscolas();
    var totalMunicipal = 0;
    var urbanasMun = 0;
    var ruraisMun = 0;
    var ceisMun = 0;
    var estaduais = 0;
    var federais = 0;
    var privadas = 0;

    todas.forEach(function(item) {
      var rede = String(item.rede || 'Municipal').toLowerCase();
      var catInst = normalizarCategoriaInstitucional(item.categoria, item.nome);
      var zon = String(item.zona || '').toLowerCase();

      if (rede === 'estadual') {
        estaduais++;
      } else if (rede === 'federal') {
        federais++;
      } else if (rede === 'privada') {
        privadas++;
      } else {
        totalMunicipal++;
        if (catInst === 'Centro de Educação Infantil') {
          ceisMun++;
        } else if (zon === 'rural') {
          ruraisMun++;
        } else {
          urbanasMun++;
        }
      }
    });

    var elTotal = document.getElementById('kpiEscolasTotal');
    var elUrbanas = document.getElementById('kpiEscolasUrbanas');
    var elRurais = document.getElementById('kpiEscolasRurais');
    var elCeis = document.getElementById('kpiEscolasCeis') || document.getElementById('kpiEscolasCmeis');
    var elEstaduais = document.getElementById('kpiEscolasEstaduais');
    var elFederais = document.getElementById('kpiEscolasFederais');
    var elPrivadas = document.getElementById('kpiEscolasPrivadas');

    if (elTotal) elTotal.textContent = totalMunicipal;
    if (elUrbanas) elUrbanas.textContent = urbanasMun;
    if (elRurais) elRurais.textContent = ruraisMun;
    if (elCeis) elCeis.textContent = ceisMun;
    if (elEstaduais) elEstaduais.textContent = estaduais;
    if (elFederais) elFederais.textContent = federais;
    if (elPrivadas) elPrivadas.textContent = privadas;
  }

  /**
   * Renderiza a listagem tabular das escolas
   */
  function renderizarTabela() {
    var tbody = document.getElementById('tabelaEscolasBody');
    var contagem = document.getElementById('escolasContagemExibida');
    var pagBar = document.getElementById('escolasPaginacaoBar');
    if (!tbody) return;

    var lista = obterEscolasFiltradas();
    var totalAcervo = obterEscolas().length;

    if (lista.length === 0) {
      if (contagem) {
        contagem.textContent = 'Exibindo 0 de ' + totalAcervo + ' unidades cadastradas';
      }
      if (pagBar) pagBar.classList.add('hidden');
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding: 32px;">Nenhuma unidade escolar encontrada com os filtros aplicados.</td></tr>';
      return;
    }

    var pag = (window.OlymposPagination && typeof window.OlymposPagination.paginarLista === 'function')
      ? window.OlymposPagination.paginarLista(lista, paginaTabelaAtual, ITENS_TABELA_POR_PAGINA)
      : { items: lista, paginaAtual: 1, totalPaginas: 1, totalItens: lista.length, inicio: 1, fim: lista.length };
    paginaTabelaAtual = pag.paginaAtual;

    if (contagem) {
      contagem.textContent = 'Exibindo ' + pag.inicio + '–' + pag.fim + ' de ' + lista.length + ' escolas filtradas (Total acervo: ' + totalAcervo + ')';
    }

    var canEdit = podeEditar();
    var html = '';
    pag.items.forEach(function(escola) {
      var lat = parseFloat(escola.lat);
      var lng = parseFloat(escola.lng);
      var rede = escola.rede || 'Municipal';
      var catInst = normalizarCategoriaInstitucional(escola.categoria, escola.nome);
      var redeClass = 'pill-rede-' + (rede.toLowerCase());
      var segmentos = Array.isArray(escola.segmentos) && escola.segmentos.length > 0
        ? escola.segmentos
        : normalizarSegmentosDeCategoria(catInst, escola.nome);
      var segsHtml = segmentos.map(function(s) {
        return '<span class="pill-segmento">' + escapeHtml(s) + '</span>';
      }).join('');
      var iconBadgeHtml = obterIconeEscola(escola, 22);

      html += '<tr data-escola-id="' + escapeHtml(escola.id) + '">';
      html += '<td data-label="Unidade Escolar">';
      html +=   '<div style="display: flex; align-items: center; gap: 8px;">';
      html +=     iconBadgeHtml;
      html +=     '<div>';
      html +=       '<strong style="color: var(--text-main); font-size: 13px;">' + escapeHtml(escola.nome) + '</strong>';
      html +=       '<div style="font-size: 11px; color: var(--text-muted);">' + escapeHtml(catInst) + (escola.inep ? ' • INEP: <code>' + escapeHtml(escola.inep) + '</code>' : '') + '</div>';
      html +=     '</div>';
      html +=   '</div>';
      html += '</td>';
      html += '<td data-label="Rede"><span class="pill-badge pill-rede ' + redeClass + '">' + escapeHtml(rede) + '</span></td>';
      html += '<td data-label="Segmentos Atendidos">' + segsHtml + '</td>';
      html += '<td data-label="Zona"><span style="font-size: 12px; font-weight: 600;">' + escapeHtml(escola.zona || 'Urbana') + '</span></td>';
      html += '<td data-label="Bairro / Distrito">' + escapeHtml(escola.bairroDistrito || '—') + '</td>';
      html += '<td data-label="Coordenadas">';
      html +=   '<span style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-secondary);">' +
                  lat.toFixed(6) + ', ' + lng.toFixed(6) +
                '</span>';
      html += '</td>';
      var icPinRow = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('mapPin') : '';
      var icEditRow = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('edit') : '';
      var icTrashRow = window.OlymposIcons ? window.OlymposIcons.fromEmojiOrKey('trash') : '';
      html += '<td data-label="Ações" class="text-right" style="white-space: nowrap;">';
      html +=   '<div class="escola-row-actions" style="display: inline-flex; gap: 6px; flex-wrap: wrap;">';
      html +=     '<button type="button" class="btn btn-secondary btn-mini" title="Visualizar e centralizar no mapa" onclick="window.OlymposViews.escolas.centralizarEscola(' + lat + ', ' + lng + ', \'' + escapeHtml(escola.id) + '\')">' + icPinRow + ' Mapa</button>';
      if (canEdit) {
        html +=   '<button type="button" class="btn btn-secondary btn-mini" title="Editar informações cadastrais" onclick="window.OlymposViews.escolas.abrirModalEdicao(\'' + escapeHtml(escola.id) + '\')">' + icEditRow + ' Editar</button>';
        html +=   '<button type="button" class="btn btn-ghost btn-mini" style="color: #EF4444;" title="Excluir escola" onclick="window.OlymposViews.escolas.excluirEscola(\'' + escapeHtml(escola.id) + '\')">' + icTrashRow + '</button>';
      }
      html +=   '</div>';
      html += '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;

    if (window.OlymposPagination && typeof window.OlymposPagination.renderizarControles === 'function') {
      var pagRes = window.OlymposPagination.renderizarControles({
        barEl: 'escolasPaginacaoBar',
        containers: 'escolasPaginacaoControles',
        infoEl: 'escolasPaginacaoInfo',
        totalItens: pag.totalItens,
        paginaAtual: paginaTabelaAtual,
        itensPorPagina: ITENS_TABELA_POR_PAGINA,
        rotuloItem: 'unidades escolares',
        onPageChange: function(novaPagina) {
          paginaTabelaAtual = novaPagina;
          renderizarTabela();
        }
      });
      paginaTabelaAtual = pagRes.paginaAtual;
    }
  }

  /**
   * Vincula ouvintes de eventos da página
   */
  function bindEvents() {
    var inBusca = document.getElementById('escolaBuscaInput');
    if (inBusca && !inBusca._bound) {
      inBusca._bound = true;
      inBusca.addEventListener('input', function() {
        currentSearchTerm = inBusca.value;
        paginaTabelaAtual = 1;
        renderizarInterface();
      });
    }

    // Novos Selects Dropdown (M3)
    var selCat = document.getElementById('escolaFiltroCategoriaSelect') || document.getElementById('selectFiltroCategoriaEscolas');
    if (selCat && !selCat._bound) {
      selCat._bound = true;
      selCat.addEventListener('change', function() {
        activeCategoryFilter = selCat.value || 'todas';
        paginaTabelaAtual = 1;
        renderizarInterface();
      });
    }

    var selRede = document.getElementById('escolaFiltroRedeSelect') || document.getElementById('selectFiltroRedeEscolas');
    if (selRede && !selRede._bound) {
      selRede._bound = true;
      selRede.addEventListener('change', function() {
        activeRedeFilter = selRede.value || 'todas';
        paginaTabelaAtual = 1;
        renderizarInterface();
      });
    }

    var selSeg = document.getElementById('escolaFiltroSegmentoSelect') || document.getElementById('selectFiltroSegmentoEscolas');
    if (selSeg && !selSeg._bound) {
      selSeg._bound = true;
      selSeg.addEventListener('change', function() {
        activeSegmentFilter = selSeg.value || 'todos';
        paginaTabelaAtual = 1;
        renderizarInterface();
      });
    }

    var selZona = document.getElementById('escolaFiltroZonaSelect') || document.getElementById('selectFiltroZonaEscolas');
    if (selZona && !selZona._bound) {
      selZona._bound = true;
      selZona.addEventListener('change', function() {
        activeZonaFilter = selZona.value || 'todas';
        paginaTabelaAtual = 1;
        renderizarInterface();
      });
    }

    // Fallback para botões de filtro / data-attributes
    document.querySelectorAll('[data-filtro-rede]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-rede]').forEach(function(b) {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          activeRedeFilter = btn.getAttribute('data-filtro-rede') || 'todas';
          paginaTabelaAtual = 1;
          renderizarInterface();
        });
      }
    });

    document.querySelectorAll('[data-filtro-segmento]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-segmento]').forEach(function(b) {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          activeSegmentFilter = btn.getAttribute('data-filtro-segmento') || 'todos';
          paginaTabelaAtual = 1;
          renderizarInterface();
        });
      }
    });

    document.querySelectorAll('[data-filtro-categoria]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-categoria]').forEach(function(b) {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          activeCategoryFilter = btn.getAttribute('data-filtro-categoria') || 'todas';
          paginaTabelaAtual = 1;
          renderizarInterface();
        });
      }
    });

    document.querySelectorAll('[data-filtro-zona]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-zona]').forEach(function(b) {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          activeZonaFilter = btn.getAttribute('data-filtro-zona') || 'todas';
          paginaTabelaAtual = 1;
          renderizarInterface();
        });
      }
    });

    var btnNovo = document.getElementById('btnNovaEscola');
    if (btnNovo && !btnNovo._bound) {
      btnNovo._bound = true;
      btnNovo.addEventListener('click', function() {
        abrirModalCadastro();
      });
    }

    var btnRecentralizar = document.getElementById('btnRecentralizarMapaEscolas');
    if (btnRecentralizar && !btnRecentralizar._bound) {
      btnRecentralizar._bound = true;
      btnRecentralizar.addEventListener('click', function() {
        recentralizarMapa();
      });
    }

    var btnExportar = document.getElementById('btnExportarEscolasJson');
    if (btnExportar && !btnExportar._bound) {
      btnExportar._bound = true;
      btnExportar.addEventListener('click', function() {
        exportarJson();
      });
    }

    var btnImportar = document.getElementById('btnImportarEscolasJson');
    var inputArquivo = document.getElementById('escolasImportFileInput');
    if (btnImportar && inputArquivo && !btnImportar._bound) {
      btnImportar._bound = true;
      btnImportar.addEventListener('click', function() {
        inputArquivo.click();
      });
      inputArquivo.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (file) {
          importarJson(file);
          inputArquivo.value = '';
        }
      });
    }

    var btnRestaurar = document.getElementById('btnRestaurarEscolasPadrao');
    if (btnRestaurar && !btnRestaurar._bound) {
      btnRestaurar._bound = true;
      btnRestaurar.addEventListener('click', function() {
        restaurarPadroes();
      });
    }

    var form = document.getElementById('formCadastroEscola') || document.getElementById('formEscola');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', salvarEscolaSubmit);
    }

    var btnFecharModal = document.getElementById('closeModalCadastroEscolaBtn') || document.getElementById('closeModalEscolaBtn');
    if (btnFecharModal && !btnFecharModal._bound) {
      btnFecharModal._bound = true;
      btnFecharModal.addEventListener('click', fecharModal);
    }
    var btnCancelarModal = document.getElementById('btnCancelarModalEscola');
    if (btnCancelarModal && !btnCancelarModal._bound) {
      btnCancelarModal._bound = true;
      btnCancelarModal.addEventListener('click', fecharModal);
    }

    var inLat = document.getElementById('escolaLatitude');
    var inLng = document.getElementById('escolaLongitude');
    if (inLat && !inLat._bound) {
      inLat._bound = true;
      inLat.addEventListener('input', validarCoordenadasForm);
    }
    if (inLng && !inLng._bound) {
      inLng._bound = true;
      inLng.addEventListener('input', validarCoordenadasForm);
    }

    window.addEventListener('resize', function() {
      if (leafletMap) leafletMap.invalidateSize();
    });
  }

  /**
   * Abre modal em modo de inclusão (Create)
   */
  function abrirModalCadastro(lat, lng) {
    if (!podeEditar()) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Edição do mapa restrita ao Gabinete Executivo e Moderador.', true);
      }
      return;
    }
    var modal = document.getElementById('modalCadastroEscola') || document.getElementById('modalEscola');
    var titulo = document.getElementById('modalCadastroEscolaTitulo') || document.getElementById('modalEscolaTitulo');
    var form = document.getElementById('formCadastroEscola') || document.getElementById('formEscola');
    if (!modal || !form) return;

    form.reset();
    var inId = document.getElementById('escolaId');
    if (inId) inId.value = '';

    var inRede = document.getElementById('escolaRede');
    if (inRede) inRede.value = 'Municipal';

    var inCat = document.getElementById('escolaCategoria');
    if (inCat) inCat.value = 'Escola';

    document.querySelectorAll('input[name="escolaSegmentos"]').forEach(function(ck) {
      ck.checked = (ck.value === 'Ens. Fundamental I');
    });

    if (titulo) titulo.textContent = 'Cadastrar Nova Unidade Escolar';

    var inLat = document.getElementById('escolaLatitude');
    var inLng = document.getElementById('escolaLongitude');
    if (inLat && inLng) {
      if (typeof lat === 'number' && typeof lng === 'number') {
        inLat.value = lat.toFixed(6);
        inLng.value = lng.toFixed(6);
      } else {
        inLat.value = '-5.634000';
        inLng.value = '-35.428000';
      }
      validarCoordenadasForm();
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    var inNome = document.getElementById('escolaNome');
    if (inNome) inNome.focus();
  }

  /**
   * Abre modal em modo de edição (Update)
   */
  function abrirModalEdicao(id) {
    if (!podeEditar()) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Edição do mapa restrita ao Gabinete Executivo e Moderador.', true);
      }
      return;
    }
    var modal = document.getElementById('modalCadastroEscola') || document.getElementById('modalEscola');
    var titulo = document.getElementById('modalCadastroEscolaTitulo') || document.getElementById('modalEscolaTitulo');
    var form = document.getElementById('formCadastroEscola') || document.getElementById('formEscola');
    if (!modal || !form) return;

    var escolas = obterEscolas();
    var escola = escolas.find(function(e) { return e.id === id; });
    if (!escola) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Unidade escolar não localizada para edição.', true);
      }
      return;
    }

    form.reset();

    var inId = document.getElementById('escolaId');
    var inNome = document.getElementById('escolaNome');
    var inInep = document.getElementById('escolaInep');
    var inRede = document.getElementById('escolaRede');
    var inCat = document.getElementById('escolaCategoria');
    var inZona = document.getElementById('escolaZona');
    var inBairro = document.getElementById('escolaBairroDistrito');
    var inEnd = document.getElementById('escolaEndereco');
    var inTel = document.getElementById('escolaTelefone');
    var inDir = document.getElementById('escolaDiretor');
    var inLat = document.getElementById('escolaLatitude');
    var inLng = document.getElementById('escolaLongitude');

    var catInst = normalizarCategoriaInstitucional(escola.categoria, escola.nome);

    if (inId) inId.value = escola.id;
    if (inNome) inNome.value = escola.nome || '';
    if (inInep) inInep.value = escola.inep || '';
    if (inRede) inRede.value = escola.rede || 'Municipal';
    if (inCat) inCat.value = CATEGORIAS_INSTITUCIONAIS.includes(catInst) ? catInst : 'Escola';
    if (inZona) inZona.value = escola.zona || 'Urbana';
    if (inBairro) inBairro.value = escola.bairroDistrito || '';
    if (inEnd) inEnd.value = escola.endereco || '';
    if (inTel) inTel.value = escola.telefone || '';
    if (inDir) inDir.value = escola.diretor || '';
    if (inLat) inLat.value = parseFloat(escola.lat).toFixed(6);
    if (inLng) inLng.value = parseFloat(escola.lng).toFixed(6);

    var segs = Array.isArray(escola.segmentos) && escola.segmentos.length > 0
      ? escola.segmentos
      : normalizarSegmentosDeCategoria(catInst, escola.nome);

    document.querySelectorAll('input[name="escolaSegmentos"]').forEach(function(ck) {
      ck.checked = segs.includes(ck.value);
    });

    validarCoordenadasForm();

    if (titulo) titulo.textContent = 'Editar Unidade: ' + escola.nome;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  /**
   * Fecha o modal de cadastro/edição
   */
  function fecharModal() {
    var modal = document.getElementById('modalCadastroEscola') || document.getElementById('modalEscola');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  /**
   * Salva dados submetidos pelo formulário (Create ou Update) sem jamais sobrescrever
   * a Categoria Institucional com a lista de segmentos.
   */
  function salvarEscolaSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!podeEditar()) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Edição do mapa restrita ao Gabinete Executivo e Moderador.', true);
      }
      return;
    }

    var inId = document.getElementById('escolaId');
    var inNome = document.getElementById('escolaNome');
    var inInep = document.getElementById('escolaInep');
    var inRede = document.getElementById('escolaRede');
    var inCat = document.getElementById('escolaCategoria');
    var inZona = document.getElementById('escolaZona');
    var inBairro = document.getElementById('escolaBairroDistrito');
    var inEnd = document.getElementById('escolaEndereco');
    var inTel = document.getElementById('escolaTelefone');
    var inDir = document.getElementById('escolaDiretor');
    var inLat = document.getElementById('escolaLatitude');
    var inLng = document.getElementById('escolaLongitude');

    var nome = (inNome ? inNome.value : '').trim();
    var inep = (inInep ? inInep.value : '').trim();
    var rede = (inRede ? inRede.value : 'Municipal').trim() || 'Municipal';
    var categoria = normalizarCategoriaInstitucional(inCat ? inCat.value : 'Escola', nome);
    var zona = (inZona ? inZona.value : 'Urbana').trim();
    var bairro = (inBairro ? inBairro.value : '').trim();
    var endereco = (inEnd ? inEnd.value : '').trim();
    var telefone = (inTel ? inTel.value : '').trim();
    var diretor = (inDir ? inDir.value : '').trim();
    var lat = parseFloat(inLat ? inLat.value : '');
    var lng = parseFloat(inLng ? inLng.value : '');

    if (!nome) {
      alert('O nome da unidade escolar é obrigatório.');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      alert('Latitude e longitude devem ser números válidos.');
      return;
    }

    var segmentos = [];
    document.querySelectorAll('input[name="escolaSegmentos"]:checked').forEach(function(ck) {
      if (ck.value) segmentos.push(ck.value);
    });
    if (segmentos.length === 0) {
      segmentos = normalizarSegmentosDeCategoria(categoria, nome);
    }

    var id = (inId ? inId.value : '').trim();
    var escolas = obterEscolas();
    var cor = obterCorPorRedeECategoria(rede, categoria, zona, nome);
    var icone = obterIconePorRedeECategoria(rede, categoria, zona, nome, segmentos);

    var escolaObjeto = null;

    if (id) {
      var idx = escolas.findIndex(function(item) { return item.id === id; });
      if (idx !== -1) {
        escolas[idx].nome = nome;
        escolas[idx].inep = inep;
        escolas[idx].rede = rede;
        escolas[idx].segmentos = segmentos;
        escolas[idx].categoria = categoria;
        escolas[idx].zona = zona;
        escolas[idx].bairroDistrito = bairro;
        escolas[idx].endereco = endereco;
        escolas[idx].telefone = telefone;
        escolas[idx].diretor = diretor;
        escolas[idx].lat = lat;
        escolas[idx].lng = lng;
        escolas[idx].cor = cor;
        escolas[idx].icone = icone;
        escolaObjeto = escolas[idx];
      }
    } else {
      var novoId = 'esc_' + Date.now();
      escolaObjeto = {
        id: novoId,
        nome: nome,
        inep: inep,
        rede: rede,
        segmentos: segmentos,
        categoria: categoria,
        zona: zona,
        bairroDistrito: bairro,
        endereco: endereco,
        telefone: telefone,
        diretor: diretor,
        lat: lat,
        lng: lng,
        cor: cor,
        icone: icone,
        turnos: ['Matutino', 'Vespertino']
      };
      escolas.unshift(escolaObjeto);
      id = novoId;
    }

    salvarEscolas(escolas);
    fecharModal();
    renderizarInterface();

    // Sincroniza registro individual e o arquivo JSON completo no Supabase
    if (escolaObjeto && window.OlymposSupabase) {
      if (typeof window.OlymposSupabase.sincronizarEscola === 'function') {
        window.OlymposSupabase.sincronizarEscola(escolaObjeto);
      }
      if (typeof window.OlymposSupabase.sincronizarCatalogoEscolasJson === 'function') {
        window.OlymposSupabase.sincronizarCatalogoEscolasJson(escolas);
      }
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Unidade escolar salva com sucesso!');
    }

    centralizarEscola(lat, lng, id);
  }

  /**
   * Exclui uma unidade escolar com confirmação amigável e sincroniza com Supabase
   */
  function excluirEscola(id) {
    if (!podeEditar()) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Edição do mapa restrita ao Gabinete Executivo e Moderador.', true);
      }
      return;
    }
    var escolas = obterEscolas();
    var escola = escolas.find(function(e) { return e.id === id; });
    var nome = escola ? escola.nome : 'esta unidade';

    if (!confirm('Deseja realmente remover "' + nome + '" do mapa municipal?')) {
      return;
    }

    var filtradas = escolas.filter(function(e) { return e.id !== id; });
    salvarEscolas(filtradas);
    renderizarInterface();

    if (window.OlymposSupabase) {
      if (typeof window.OlymposSupabase.excluirEscola === 'function') {
        window.OlymposSupabase.excluirEscola(id);
      }
      if (typeof window.OlymposSupabase.sincronizarCatalogoEscolasJson === 'function') {
        window.OlymposSupabase.sincronizarCatalogoEscolasJson(filtradas);
      }
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Unidade escolar removida do mapa.');
    }
  }

  /**
   * Centraliza a visualização do mapa em uma unidade específica e abre seu popup
   */
  function centralizarEscola(lat, lng, id) {
    if (!leafletMap) return;

    var nLat = parseFloat(lat);
    var nLng = parseFloat(lng);
    if (isNaN(nLat) || isNaN(nLng)) return;

    leafletMap.flyTo([nLat, nLng], 15, {
      duration: 1.2
    });

    setTimeout(function() {
      if (id && markerMap[id]) {
        markerMap[id].openPopup();
      }
    }, 600);

    var outer = document.querySelector('.escola-map-outer') || document.getElementById('mapaEscolasCearaMirim');
    if (outer && typeof outer.scrollIntoView === 'function') {
      outer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Recentraliza o mapa para a visão global de Ceará-Mirim
   */
  function recentralizarMapa() {
    if (leafletMap) {
      leafletMap.flyTo([-5.634, -35.428], 11, { duration: 1.0 });
    }
  }

  /**
   * Copia coordenadas geográficas para a área de transferência
   */
  function copiarCoordenadas(lat, lng) {
    var texto = lat.toFixed(6) + ', ' + lng.toFixed(6);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function() {
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Coordenadas copiadas: ' + texto);
        }
      });
    } else {
      prompt('Copie as coordenadas:', texto);
    }
  }

  /**
   * Exporta os registros em arquivo JSON
   */
  function exportarJson() {
    var escolas = obterEscolas();
    var jsonStr = JSON.stringify(escolas, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'escolas_cearamirim_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Arquivo JSON de escolas exportado com sucesso!');
    }
  }

  /**
   * Importa arquivo JSON com validação de formato e sincronização com Supabase
   */
  function importarJson(file) {
    if (!podeEditar()) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Importação restrita ao Gabinete Executivo e Moderador.', true);
      }
      return;
    }
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(evt) {
      try {
        var dados = JSON.parse(evt.target.result);
        if (!Array.isArray(dados)) {
          alert('O arquivo deve conter uma lista JSON de unidades escolares.');
          return;
        }

        var validas = dados.filter(function(item) {
          return item && item.nome && !isNaN(parseFloat(item.lat)) && !isNaN(parseFloat(item.lng));
        }).map(sanitizarRegistroEscola);

        if (validas.length === 0) {
          alert('Nenhuma unidade escolar válida localizada no arquivo JSON.');
          return;
        }

        if (confirm('Foram identificadas ' + validas.length + ' escolas válidas. Deseja substituir a base atual?')) {
          salvarEscolas(validas);
          renderizarInterface();

          if (window.OlymposSupabase) {
            if (typeof window.OlymposSupabase.sincronizarCatalogoEscolasJson === 'function') {
              window.OlymposSupabase.sincronizarCatalogoEscolasJson(validas);
            }
            if (typeof window.OlymposSupabase.sincronizarEscola === 'function') {
              validas.forEach(function(item) {
                window.OlymposSupabase.sincronizarEscola(item);
              });
            }
          }

          if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
            window.OlymposApp.showToast('Importação concluída: ' + validas.length + ' unidades carregadas!');
          }
        }
      } catch (err) {
        console.error('[EscolasView] Erro ao ler JSON:', err);
        alert('Erro ao interpretar o arquivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  /**
   * Restaura o catálogo semente oficial de 25 unidades
   */
  function restaurarPadroes() {
    if (!podeEditar()) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Restauração restrita ao Gabinete Executivo e Moderador.', true);
      }
      return;
    }
    if (confirm('Deseja restaurar o catálogo oficial de unidades de Ceará-Mirim? Modificações manuais serão redefinidas.')) {
      if (typeof window.BANCO_SEMENTE_ESCOLAS !== 'undefined' && Array.isArray(window.BANCO_SEMENTE_ESCOLAS)) {
        var padrao = window.BANCO_SEMENTE_ESCOLAS.map(sanitizarRegistroEscola);
        salvarEscolas(padrao);
        renderizarInterface();
        recentralizarMapa();

        if (window.OlymposSupabase && typeof window.OlymposSupabase.sincronizarCatalogoEscolasJson === 'function') {
          window.OlymposSupabase.sincronizarCatalogoEscolasJson(padrao);
        }

        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Catálogo oficial de escolas restaurado com sucesso!');
        }
      }
    }
  }

  /**
   * Observa quando a view de escolas torna-se visível para reajustar Leaflet
   */
  function observarVisibilidadePagina() {
    var pageEscolas = document.getElementById('page-escolas');
    if (!pageEscolas || observerEscolas) return;

    observerEscolas = new MutationObserver(function() {
      if (!pageEscolas.classList.contains('hidden')) {
        if (leafletMap) {
          setTimeout(function() {
            leafletMap.invalidateSize();
          }, 120);
        }
        sincronizarInicialComSupabase();
      }
    });

    observerEscolas.observe(pageEscolas, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  /**
   * Sanitiza strings para HTML
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setFiltroRede(rede) {
    activeRedeFilter = rede || 'todas';
    var sel = document.getElementById('escolaFiltroRedeSelect') || document.getElementById('selectFiltroRedeEscolas');
    if (sel) sel.value = activeRedeFilter;
    renderizarInterface();
  }

  function setFiltroSegmento(seg) {
    activeSegmentFilter = seg || 'todos';
    var sel = document.getElementById('escolaFiltroSegmentoSelect') || document.getElementById('selectFiltroSegmentoEscolas');
    if (sel) sel.value = activeSegmentFilter;
    renderizarInterface();
  }

  function setFiltroCategoria(cat) {
    activeCategoryFilter = cat || 'todas';
    var sel = document.getElementById('escolaFiltroCategoriaSelect') || document.getElementById('selectFiltroCategoriaEscolas');
    if (sel) sel.value = activeCategoryFilter;
    renderizarInterface();
  }

  function setFiltroZona(zona) {
    activeZonaFilter = zona || 'todas';
    var sel = document.getElementById('escolaFiltroZonaSelect') || document.getElementById('selectFiltroZonaEscolas');
    if (sel) sel.value = activeZonaFilter;
    renderizarInterface();
  }

  // API pública
  return {
    init: init,
    abrirModalCadastro: abrirModalCadastro,
    abrirModalEdicao: abrirModalEdicao,
    fecharModal: fecharModal,
    salvarEscolaSubmit: salvarEscolaSubmit,
    excluirEscola: excluirEscola,
    centralizarEscola: centralizarEscola,
    recentralizarMapa: recentralizarMapa,
    copiarCoordenadas: copiarCoordenadas,
    exportarJson: exportarJson,
    importarJson: importarJson,
    restaurarPadroes: restaurarPadroes,
    renderizarKpis: renderizarKpis,
    obterEscolas: obterEscolas,
    obterEscolasFiltradas: obterEscolasFiltradas,
    estaEmCearaMirim: estaEmCearaMirim,
    normalizarCategoriaInstitucional: normalizarCategoriaInstitucional,
    obterCorPorCategoria: obterCorPorCategoria,
    obterIconePorCategoria: obterIconePorCategoria,
    obterCorPorRedeECategoria: obterCorPorRedeECategoria,
    obterIconePorRedeECategoria: obterIconePorRedeECategoria,
    obterIconeEscola: obterIconeEscola,
    atualizarPermissoesMapa: atualizarPermissoesMapa,
    setFiltroRede: setFiltroRede,
    setFiltroSegmento: setFiltroSegmento,
    setFiltroCategoria: setFiltroCategoria,
    setFiltroZona: setFiltroZona
  };
})();
