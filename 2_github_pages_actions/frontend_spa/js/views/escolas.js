/**
 * Hub Olympos V2.2 — Módulo de Visualização e Gestão: Escolas Municipais de Ceará-Mirim
 * Georreferenciamento de precisão com Leaflet.js 1.9.4, marcadores circulares temáticos,
 * popups ricos, CRUD completo na própria interface com captura de coordenadas por clique,
 * persistência offline-first em localStorage e importação/exportação JSON.
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

  var activeCategoryFilter = 'todas';
  var currentSearchTerm = '';

  // Bounding box territorial aproximada de Ceará-Mirim/RN
  var BOUNDS_CEARA_MIRIM = {
    minLat: -5.750000,
    maxLat: -5.500000,
    minLng: -35.600000,
    maxLng: -35.250000
  };

  /**
   * Ponto de entrada chamado pelo roteador modular
   */
  function init() {
    garantirBancoInicial();
    bindEvents();
    inicializarMapa();
    renderizarInterface();
    observarVisibilidadePagina();
  }

  /**
   * Garante inicialização no localStorage a partir do catálogo semente
   */
  function garantirBancoInicial() {
    try {
      var gravado = localStorage.getItem(STORAGE_KEY);
      if (!gravado || gravado === '[]') {
        var semente = (typeof window.BANCO_SEMENTE_ESCOLAS !== 'undefined' && Array.isArray(window.BANCO_SEMENTE_ESCOLAS))
          ? window.BANCO_SEMENTE_ESCOLAS
          : [];
        if (semente.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(semente));
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
          return arr;
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

      // Evento de clique no mapa para captura direta de coordenadas
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

    // Atualiza visor de coordenadas em tempo real
    var liveDisplay = document.getElementById('escolasCoordLiveDisplay');
    if (liveDisplay) {
      liveDisplay.textContent = 'Lat: ' + lat.toFixed(6) + ' | Lng: ' + lng.toFixed(6);
    }

    // Se o modal de cadastro/edição estiver aberto, preenche automaticamente os campos de coordenadas
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

    // Marcador temporário de clique visual
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
      
      // Remove marcador temporário após 4 segundos se o modal não estiver aberto
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
   * Determina a cor visual do marcador a partir da categoria
   */
  function obterCorPorCategoria(categoria, zona) {
    var cat = String(categoria || '').toLowerCase();
    var zon = String(zona || '').toLowerCase();

    if (cat.includes('sede')) return '#D4AF37'; // Dourado SMEB Sede
    if (cat.includes('infantil') || cat.includes('cmei') || cat.includes('creche')) return '#F59E0B'; // Âmbar CMEI
    if (cat.includes('rural') || zon.includes('rural')) return '#10B981'; // Verde Polo Rural
    return '#38BDF8'; // Azul Urbana / Ensino Fundamental
  }

  /**
   * Determina o ícone ou letra no centro do marcador circular
   */
  function obterIconePorCategoria(categoria, zona) {
    var cat = String(categoria || '').toLowerCase();
    var zon = String(zona || '').toLowerCase();

    if (cat.includes('sede')) return '★';
    if (cat.includes('infantil') || cat.includes('cmei')) return 'C';
    if (cat.includes('rural') || zon.includes('rural')) return 'R';
    return 'U';
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

      var cor = escola.cor || obterCorPorCategoria(escola.categoria, escola.zona);
      var icone = escola.icone || obterIconePorCategoria(escola.categoria, escola.zona);

      var markerHtml =
        '<div style="background:' + cor + '; width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.38); display: flex; align-items: center; justify-content: center; font-size: 11px; color: #FFFFFF; font-weight: 700; cursor: pointer; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">' +
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

      var popupHtml =
        '<div class="cadmo-map-popup escola-map-popup" style="font-family: var(--font-sans, system-ui); font-size: 12px; line-height: 1.45; min-width: 240px; max-width: 300px;">' +
          '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">' +
            '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; color: #FFFFFF; background: ' + cor + ';">' +
              (escola.categoria || 'Escola') +
            '</span>' +
            '<span style="font-size: 10.5px; color: #64748B; font-weight: 600;">' + (escola.zona || 'Urbana') + '</span>' +
          '</div>' +
          '<strong style="font-size: 13.5px; color: #0F172A; display: block; margin-bottom: 4px;">' + escapeHtml(escola.nome) + '</strong>' +
          (escola.bairroDistrito ? '<div style="color: #475569; margin-bottom: 2px;">📍 <strong>Bairro/Distrito:</strong> ' + escapeHtml(escola.bairroDistrito) + '</div>' : '') +
          (escola.endereco ? '<div style="color: #64748B; font-size: 11px; margin-bottom: 4px;">' + escapeHtml(escola.endereco) + '</div>' : '') +
          (escola.inep ? '<div style="color: #475569; font-size: 11px;">INEP: <code>' + escapeHtml(escola.inep) + '</code></div>' : '') +
          (escola.telefone ? '<div style="color: #475569; font-size: 11px;">📞 ' + escapeHtml(escola.telefone) + '</div>' : '') +
          '<div style="background: #F1F5F9; padding: 4px 6px; border-radius: 4px; margin: 6px 0; font-family: monospace; font-size: 10.5px; color: #334155;">' +
            lat.toFixed(6) + ', ' + lng.toFixed(6) +
          '</div>' +
          '<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; border-top: 1px solid #E2E8F0; padding-top: 6px;">' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.abrirModalEdicao(\'' + escola.id + '\')">✏️ Editar</button>' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.excluirEscola(\'' + escola.id + '\')">🗑️ Excluir</button>' +
            '<a href="' + rotaUrl + '" target="_blank" rel="noopener" class="btn-map-action" style="text-decoration: none;">🗺️ Rota</a>' +
            '<button type="button" class="btn-map-action" onclick="window.OlymposViews.escolas.copiarCoordenadas(' + lat + ', ' + lng + ')">📋 Copiar</button>' +
          '</div>' +
        '</div>';

      marker.bindPopup(popupHtml);
      markersLayer.addLayer(marker);
      markerMap[escola.id] = marker;
    });
  }

  /**
   * Filtra lista conforme busca textual e pílula de categoria selecionada
   */
  function obterEscolasFiltradas() {
    var todas = obterEscolas();
    var termo = (currentSearchTerm || '').trim().toLowerCase();
    var filtro = activeCategoryFilter;

    return todas.filter(function(item) {
      // Filtro de Categoria
      if (filtro === 'sede' && !String(item.categoria || '').toLowerCase().includes('sede')) return false;
      if (filtro === 'urbana' && String(item.zona || '').toLowerCase() !== 'urbana') return false;
      if (filtro === 'rural' && String(item.zona || '').toLowerCase() !== 'rural') return false;
      if (filtro === 'cmei' && !String(item.categoria || '').toLowerCase().includes('infantil') && !String(item.categoria || '').toLowerCase().includes('cmei')) return false;

      // Filtro de Busca Textual
      if (termo) {
        var strNome = String(item.nome || '').toLowerCase();
        var strBairro = String(item.bairroDistrito || '').toLowerCase();
        var strEndereco = String(item.endereco || '').toLowerCase();
        var strInep = String(item.inep || '').toLowerCase();
        if (!strNome.includes(termo) && !strBairro.includes(termo) && !strEndereco.includes(termo) && !strInep.includes(termo)) {
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
   * Atualiza cartões numéricos KPI
   */
  function renderizarKpis() {
    var todas = obterEscolas();
    var total = todas.length;
    var urbanas = 0;
    var rurais = 0;
    var cmeis = 0;

    todas.forEach(function(item) {
      var cat = String(item.categoria || '').toLowerCase();
      var zon = String(item.zona || '').toLowerCase();
      if (cat.includes('infantil') || cat.includes('cmei')) {
        cmeis++;
      } else if (zon === 'rural' || cat.includes('rural')) {
        rurais++;
      } else {
        urbanas++;
      }
    });

    var elTotal = document.getElementById('kpiEscolasTotal');
    var elUrbanas = document.getElementById('kpiEscolasUrbanas');
    var elRurais = document.getElementById('kpiEscolasRurais');
    var elCmeis = document.getElementById('kpiEscolasCmeis');

    if (elTotal) elTotal.textContent = total;
    if (elUrbanas) elUrbanas.textContent = urbanas;
    if (elRurais) elRurais.textContent = rurais;
    if (elCmeis) elCmeis.textContent = cmeis;
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
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center" style="padding: 32px;">Nenhuma unidade escolar encontrada com os filtros aplicados.</td></tr>';
      return;
    }

    var html = '';
    lista.forEach(function(escola) {
      var lat = parseFloat(escola.lat);
      var lng = parseFloat(escola.lng);
      var cor = escola.cor || obterCorPorCategoria(escola.categoria, escola.zona);

      html += '<tr data-escola-id="' + escola.id + '">';
      html += '<td>';
      html +=   '<div style="display: flex; align-items: center; gap: 8px;">';
      html +=     '<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ' + cor + ';"></span>';
      html +=     '<div>';
      html +=       '<strong style="color: var(--text-main); font-size: 13px;">' + escapeHtml(escola.nome) + '</strong>';
      if (escola.inep) {
        html +=     '<div style="font-size: 11px; color: var(--text-muted);">INEP: <code>' + escapeHtml(escola.inep) + '</code></div>';
      }
      html +=     '</div>';
      html +=   '</div>';
      html += '</td>';
      html += '<td><span class="pill-badge pill-blue" style="font-size: 11px;">' + escapeHtml(escola.categoria || 'Fundamental') + '</span></td>';
      html += '<td><span style="font-size: 12px; font-weight: 600;">' + escapeHtml(escola.zona || 'Urbana') + '</span></td>';
      html += '<td>' + escapeHtml(escola.bairroDistrito || '—') + '</td>';
      html += '<td>';
      html +=   '<span style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-secondary);">' +
                  lat.toFixed(6) + ', ' + lng.toFixed(6) +
                '</span>';
      html += '</td>';
      html += '<td class="text-right" style="white-space: nowrap;">';
      html +=   '<div style="display: inline-flex; gap: 6px;">';
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
    // Busca instantânea
    var inBusca = document.getElementById('escolaBuscaInput');
    if (inBusca && !inBusca._bound) {
      inBusca._bound = true;
      inBusca.addEventListener('input', function() {
        currentSearchTerm = inBusca.value;
        renderizarInterface();
      });
    }

    // Pílulas de filtro de categoria
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

    // Botão Nova Escola
    var btnNovo = document.getElementById('btnNovaEscola');
    if (btnNovo && !btnNovo._bound) {
      btnNovo._bound = true;
      btnNovo.addEventListener('click', function() {
        abrirModalCadastro();
      });
    }

    // Botão Recentralizar Mapa
    var btnRecentralizar = document.getElementById('btnRecentralizarMapaEscolas');
    if (btnRecentralizar && !btnRecentralizar._bound) {
      btnRecentralizar._bound = true;
      btnRecentralizar.addEventListener('click', function() {
        recentralizarMapa();
      });
    }

    // Botão Exportar JSON
    var btnExportar = document.getElementById('btnExportarEscolasJson');
    if (btnExportar && !btnExportar._bound) {
      btnExportar._bound = true;
      btnExportar.addEventListener('click', function() {
        exportarJson();
      });
    }

    // Botão Importar JSON
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

    // Botão Restaurar Padrões
    var btnRestaurar = document.getElementById('btnRestaurarEscolasPadrao');
    if (btnRestaurar && !btnRestaurar._bound) {
      btnRestaurar._bound = true;
      btnRestaurar.addEventListener('click', function() {
        restaurarPadroes();
      });
    }

    // Formulário de Cadastro / Edição
    var form = document.getElementById('formCadastroEscola') || document.getElementById('formEscola');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', salvarEscolaSubmit);
    }

    // Fechar Modal
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

    // Atualização em tempo real da validação de coordenadas ao digitar
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

    // Redimensionamento de janela
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

    if (titulo) titulo.textContent = 'Cadastrar Nova Unidade Escolar';

    var inLat = document.getElementById('escolaLatitude');
    var inLng = document.getElementById('escolaLongitude');
    if (inLat && inLng) {
      if (typeof lat === 'number' && typeof lng === 'number') {
        inLat.value = lat.toFixed(6);
        inLng.value = lng.toFixed(6);
      } else {
        // Centro padrão de Ceará-Mirim para conveniência
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
    var inCat = document.getElementById('escolaCategoria');
    var inZona = document.getElementById('escolaZona');
    var inBairro = document.getElementById('escolaBairroDistrito');
    var inEnd = document.getElementById('escolaEndereco');
    var inTel = document.getElementById('escolaTelefone');
    var inDir = document.getElementById('escolaDiretor');
    var inLat = document.getElementById('escolaLatitude');
    var inLng = document.getElementById('escolaLongitude');

    if (inId) inId.value = escola.id;
    if (inNome) inNome.value = escola.nome || '';
    if (inInep) inInep.value = escola.inep || '';
    if (inCat) inCat.value = escola.categoria || 'Ensino Fundamental';
    if (inZona) inZona.value = escola.zona || 'Urbana';
    if (inBairro) inBairro.value = escola.bairroDistrito || '';
    if (inEnd) inEnd.value = escola.endereco || '';
    if (inTel) inTel.value = escola.telefone || '';
    if (inDir) inDir.value = escola.diretor || '';
    if (inLat) inLat.value = parseFloat(escola.lat).toFixed(6);
    if (inLng) inLng.value = parseFloat(escola.lng).toFixed(6);

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
   * Salva dados submetidos pelo formulário (Create ou Update)
   */
  function salvarEscolaSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    var inId = document.getElementById('escolaId');
    var inNome = document.getElementById('escolaNome');
    var inInep = document.getElementById('escolaInep');
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
    var categoria = (inCat ? inCat.value : 'Ensino Fundamental').trim();
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

    var id = (inId ? inId.value : '').trim();
    var escolas = obterEscolas();
    var cor = obterCorPorCategoria(categoria, zona);
    var icone = obterIconePorCategoria(categoria, zona);

    if (id) {
      // Edição de registro existente
      var idx = escolas.findIndex(function(item) { return item.id === id; });
      if (idx !== -1) {
        escolas[idx].nome = nome;
        escolas[idx].inep = inep;
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
      }
    } else {
      // Criação de novo registro
      var novoId = 'esc_' + Date.now();
      escolas.unshift({
        id: novoId,
        nome: nome,
        inep: inep,
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
      });
      id = novoId;
    }

    salvarEscolas(escolas);
    fecharModal();
    renderizarInterface();

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Unidade escolar salva com sucesso!');
    }

    // Centraliza o mapa na escola recém-salva
    centralizarEscola(lat, lng, id);
  }

  /**
   * Exclui uma unidade escolar com confirmação amigável
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

    // Rola a tela suavemente para o contêiner do mapa se necessário
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
   * Importa arquivo JSON com validação de formato
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
        });

        if (validas.length === 0) {
          alert('Nenhuma unidade escolar válida localizada no arquivo JSON.');
          return;
        }

        if (confirm('Foram identificadas ' + validas.length + ' escolas válidas. Deseja substituir a base atual?')) {
          salvarEscolas(validas);
          renderizarInterface();
          if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
            window.OlymposApp.showToast('Importação concluída: ' + validas.length + ' escolas carregadas!');
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
   * Restaura o catálogo semente oficial de 20 escolas
   */
  function restaurarPadroes() {
    if (confirm('Deseja restaurar as 20 escolas oficiais da semente de Ceará-Mirim? Modificações manuais serão redefinidas.')) {
      if (typeof window.BANCO_SEMENTE_ESCOLAS !== 'undefined' && Array.isArray(window.BANCO_SEMENTE_ESCOLAS)) {
        salvarEscolas(window.BANCO_SEMENTE_ESCOLAS.slice());
        renderizarInterface();
        recentralizarMapa();
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
      if (!pageEscolas.classList.contains('hidden') && leafletMap) {
        setTimeout(function() {
          leafletMap.invalidateSize();
        }, 120);
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
    obterEscolas: obterEscolas,
    obterEscolasFiltradas: obterEscolasFiltradas,
    estaEmCearaMirim: estaEmCearaMirim
  };
})();
