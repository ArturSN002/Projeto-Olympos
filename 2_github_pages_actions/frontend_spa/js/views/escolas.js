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

  var CATEGORIAS_INSTITUCIONAIS = [
    'Escola',
    'Centro de Educação Infantil',
    'Instituição'
  ];

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
      var raw = localStorage.getItem(STORAGE_KEY);
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
   * Inicializa o mapa Leaflet 1.9.4
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

      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors • SMEB Ceará-Mirim'
      }).addTo(leafletMap);

      markersLayer = window.L.layerGroup().addTo(leafletMap);

      leafletMap.on('click', function(e) {
        tratarCliqueMapa(e);
      });
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
        window.OlymposApp.showToast('📍 Coordenadas capturadas do clique no mapa!');
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
      badge.innerHTML = '✓ Coordenadas dentro da delimitação territorial de Ceará-Mirim/RN';
    } else {
      badge.className = 'pill-badge pill-amber';
      badge.innerHTML = '⚠️ Atenção: Ponto fora dos limites territoriais típicos de Ceará-Mirim';
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

  /**
   * Renderiza todos os marcadores no mapa Leaflet
   */
  function renderizarMarcadores() {
    if (!leafletMap || !markersLayer) return;
    markersLayer.clearLayers();
    markerMap = {};

    var escolas = obterEscolasFiltradas();

    escolas.forEach(function(escola) {
      var lat = parseFloat(escola.lat);
      var lng = parseFloat(escola.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      var rede = escola.rede || 'Municipal';
      var catInst = normalizarCategoriaInstitucional(escola.categoria, escola.nome);
      var corCalculada = obterCorPorRedeECategoria(rede, catInst, escola.zona, escola.nome);
      var iconeCalculado = obterIconePorRedeECategoria(rede, catInst, escola.zona, escola.nome, escola.segmentos);

      var cor = escola.cor || corCalculada;
      var icone = escola.icone || iconeCalculado;

      var textCor = (cor === '#FACC15') ? '#1E293B' : '#FFFFFF';
      var fontSize = (icone === 'II') ? '10px' : '11px';

      var markerHtml =
        '<div style="background:' + cor + '; width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.38); display: flex; align-items: center; justify-content: center; font-size: ' + fontSize + '; color: ' + textCor + '; font-weight: 800; cursor: pointer; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">' +
        icone +
        '</div>';

      var divIcon = window.L.divIcon({
        className: 'cadmo-leaflet-divicon escola-leaflet-divicon',
        html: markerHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14]
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

      var popupHtml =
        '<div class="cadmo-map-popup escola-map-popup">' +
          '<div class="escola-popup-header">' +
            '<span class="pill-badge pill-rede ' + redeClass + '">' + escapeHtml(rede) + '</span>' +
            '<span class="escola-popup-meta-tag">' + escapeHtml(catInst) + ' • ' + escapeHtml(escola.zona || 'Urbana') + '</span>' +
          '</div>' +
          '<strong class="escola-popup-title">' + escapeHtml(escola.nome) + '</strong>' +
          '<div class="escola-popup-segmentos">' + segmentosHtml + '</div>' +
          (escola.bairroDistrito ? '<div class="escola-popup-detail">📍 <strong>Bairro/Distrito:</strong> ' + escapeHtml(escola.bairroDistrito) + '</div>' : '') +
          (escola.endereco ? '<div class="escola-popup-address">' + escapeHtml(escola.endereco) + '</div>' : '') +
          (escola.inep ? '<div class="escola-popup-detail">INEP: <code>' + escapeHtml(escola.inep) + '</code></div>' : '') +
          (escola.telefone ? '<div class="escola-popup-detail">📞 ' + escapeHtml(escola.telefone) + '</div>' : '') +
          '<div class="escola-popup-coords">' +
            lat.toFixed(6) + ', ' + lng.toFixed(6) +
          '</div>' +
          '<div class="escola-popup-actions">' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.abrirModalEdicao(\'' + escola.id + '\')">✏️ Editar</button>' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.excluirEscola(\'' + escola.id + '\')">🗑️ Excluir</button>' +
            '<a href="' + rotaUrl + '" target="_blank" rel="noopener" class="btn-map-action">🗺️ Rota</a>' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.copiarCoordenadas(' + lat + ', ' + lng + ')">📋 Copiar</button>' +
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
    if (!tbody) return;

    var lista = obterEscolasFiltradas();
    if (contagem) {
      contagem.textContent = 'Exibindo ' + lista.length + ' de ' + obterEscolas().length + ' unidades cadastradas';
    }

    if (lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding: 32px;">Nenhuma unidade escolar encontrada com os filtros aplicados.</td></tr>';
      return;
    }

    var html = '';
    lista.forEach(function(escola) {
      var lat = parseFloat(escola.lat);
      var lng = parseFloat(escola.lng);
      var rede = escola.rede || 'Municipal';
      var catInst = normalizarCategoriaInstitucional(escola.categoria, escola.nome);
      var corCalc = obterCorPorRedeECategoria(rede, catInst, escola.zona, escola.nome);
      var cor = (catInst === 'Escola' && escola.cor === '#F59E0B') ? corCalc : (escola.cor || corCalc);
      var redeClass = 'pill-rede-' + (rede.toLowerCase());
      var segmentos = Array.isArray(escola.segmentos) && escola.segmentos.length > 0
        ? escola.segmentos
        : normalizarSegmentosDeCategoria(catInst, escola.nome);
      var segsHtml = segmentos.map(function(s) {
        return '<span class="pill-segmento">' + escapeHtml(s) + '</span>';
      }).join('');

      html += '<tr data-escola-id="' + escola.id + '">';
      html += '<td data-label="Unidade Escolar">';
      html +=   '<div style="display: flex; align-items: center; gap: 8px;">';
      html +=     '<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: ' + cor + ';"></span>';
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
      html += '<td data-label="Ações" class="text-right" style="white-space: nowrap;">';
      html +=   '<div class="escola-row-actions" style="display: inline-flex; gap: 6px; flex-wrap: wrap;">';
      html +=     '<button type="button" class="btn btn-secondary btn-mini" title="Visualizar e centralizar no mapa" onclick="window.OlymposViews.escolas.centralizarEscola(' + lat + ', ' + lng + ', \'' + escola.id + '\')">📍 Mapa</button>';
      html +=     '<button type="button" class="btn btn-secondary btn-mini" title="Editar informações cadastrais" onclick="window.OlymposViews.escolas.abrirModalEdicao(\'' + escola.id + '\')">✏️ Editar</button>';
      html +=     '<button type="button" class="btn btn-ghost btn-mini" style="color: #EF4444;" title="Excluir escola" onclick="window.OlymposViews.escolas.excluirEscola(\'' + escola.id + '\')">🗑️</button>';
      html +=   '</div>';
      html += '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
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
        renderizarInterface();
      });
    }

    // Novos Selects Dropdown (M3)
    var selCat = document.getElementById('escolaFiltroCategoriaSelect') || document.getElementById('selectFiltroCategoriaEscolas');
    if (selCat && !selCat._bound) {
      selCat._bound = true;
      selCat.addEventListener('change', function() {
        activeCategoryFilter = selCat.value || 'todas';
        renderizarInterface();
      });
    }

    var selRede = document.getElementById('escolaFiltroRedeSelect') || document.getElementById('selectFiltroRedeEscolas');
    if (selRede && !selRede._bound) {
      selRede._bound = true;
      selRede.addEventListener('change', function() {
        activeRedeFilter = selRede.value || 'todas';
        renderizarInterface();
      });
    }

    var selSeg = document.getElementById('escolaFiltroSegmentoSelect') || document.getElementById('selectFiltroSegmentoEscolas');
    if (selSeg && !selSeg._bound) {
      selSeg._bound = true;
      selSeg.addEventListener('change', function() {
        activeSegmentFilter = selSeg.value || 'todos';
        renderizarInterface();
      });
    }

    var selZona = document.getElementById('escolaFiltroZonaSelect') || document.getElementById('selectFiltroZonaEscolas');
    if (selZona && !selZona._bound) {
      selZona._bound = true;
      selZona.addEventListener('change', function() {
        activeZonaFilter = selZona.value || 'todas';
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
    var icone = obterIconePorRedeECategoria(rede, categoria, zona, nome);

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
    setFiltroRede: setFiltroRede,
    setFiltroSegmento: setFiltroSegmento,
    setFiltroCategoria: setFiltroCategoria,
    setFiltroZona: setFiltroZona
  };
})();
