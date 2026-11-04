/**
 * Hub Olympos V2.1 — Página Modular 7: O Papiro de Cadmo (ETL Mensal de Permutas RN)
 * Painel Georreferenciado de Permutas & Motor de Matching da Persona Hera (Leaflet.js + OSM)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.papiroCadmo = (function() {
  let isStatusLoaded = false;
  let leafletMap = null;
  let markersLayer = null;
  let routeLayer = null;
  let observerCadmo = null;

  const BANCO_STORAGE_KEY = 'olympos_permutas_banco';

  // Catálogo Georreferenciado de Unidades Escolares e Polos Intermunicipais
  const PONTOS_GEORREFERENCIADOS = [
    // Ceará-Mirim — Sede SMEB e Escolas Polo
    { id: 'smeb_sede', nome: 'SMEB Sede (Ceará-Mirim)', municipio: 'Ceará-Mirim', tipo: 'Sede Administrativa', coords: [-5.6344, -35.4245], cor: '#D4AF37' },
    { id: 'em_alice_garcia', nome: 'E. M. Alice Garcia Freire (Ceará-Mirim)', municipio: 'Ceará-Mirim', tipo: 'Escola Polo', coords: [-5.6338, -35.4262], cor: '#38BDF8' },
    { id: 'em_roberto_varela', nome: 'E. M. Prefeito Roberto Varela (Ceará-Mirim)', municipio: 'Ceará-Mirim', tipo: 'Escola Polo', coords: [-5.6312, -35.4210], cor: '#38BDF8' },
    { id: 'em_augusto_severo', nome: 'E. M. Augusto Severo (Ceará-Mirim)', municipio: 'Ceará-Mirim', tipo: 'Escola Polo', coords: [-5.6355, -35.4280], cor: '#38BDF8' },
    { id: 'em_celso_cicco', nome: 'E. M. Monsenhor Celso Cicco (Ceará-Mirim)', municipio: 'Ceará-Mirim', tipo: 'Escola Polo', coords: [-5.6420, -35.4190], cor: '#38BDF8' },
    { id: 'em_julio_senna', nome: 'E. M. Dr. Júlio Senna (Gravatá - Ceará-Mirim)', municipio: 'Ceará-Mirim', tipo: 'Escola Polo Rural', coords: [-5.6025, -35.4650], cor: '#38BDF8' },
    { id: 'em_barao', nome: 'E. M. Barão de Ceará-Mirim', municipio: 'Ceará-Mirim', tipo: 'Escola Polo', coords: [-5.6150, -35.3980], cor: '#38BDF8' },
    { id: 'em_madalena_antunes', nome: 'E. M. Madalena Antunes (Massangana - Ceará-Mirim)', municipio: 'Ceará-Mirim', tipo: 'Escola Polo Rural', coords: [-5.6710, -35.4520], cor: '#38BDF8' },

    // Polos Metropolitanos Parceiros (Grande Natal e Região Metropolitana)
    { id: 'polo_natal_zn', nome: 'Polo Natal (Zona Norte - SME)', municipio: 'Natal', tipo: 'Polo Metropolitano', coords: [-5.7550, -35.2600], cor: '#10B981' },
    { id: 'polo_natal_zs', nome: 'Polo Natal (Zona Sul / Centro - SME)', municipio: 'Natal', tipo: 'Polo Metropolitano', coords: [-5.8150, -35.2100], cor: '#10B981' },
    { id: 'polo_extremoz', nome: 'Polo Extremoz (SME Centro)', municipio: 'Extremoz', tipo: 'Polo Metropolitano', coords: [-5.7067, -35.3069], cor: '#8B5CF6' },
    { id: 'polo_sga', nome: 'Polo São Gonçalo do Amarante (SME Centro)', municipio: 'São Gonçalo do Amarante', tipo: 'Polo Metropolitano', coords: [-5.7928, -35.3300], cor: '#F59E0B' },
    { id: 'polo_macaiba', nome: 'Polo Macaíba (SME Centro)', municipio: 'Macaíba', tipo: 'Polo Metropolitano', coords: [-5.8569, -35.3531], cor: '#EC4899' }
  ];

  // Amostra inicial de intenções de permuta salvas em localStorage para demonstração imediata
  const BANCO_INICIAL_AMOSTRA = [
    {
      id: 'perm_001',
      nome: 'Mariana Medeiros da Silva',
      matricula: '2026-1042',
      cargo: 'Professor dos Anos Iniciais',
      disciplina: 'Polivalente / Pedagogia',
      cargaHoraria: '30h',
      origem: 'E. M. Alice Garcia Freire (Ceará-Mirim)',
      municipioOrigem: 'Ceará-Mirim',
      destino: 'Natal',
      turno: 'Matutino',
      dataCadastro: '2026-10-25'
    },
    {
      id: 'perm_002',
      nome: 'Carlos Eduardo Nogueira',
      matricula: '2026-3081',
      cargo: 'Professor dos Anos Iniciais',
      disciplina: 'Polivalente / Pedagogia',
      cargaHoraria: '30h',
      origem: 'Polo Natal (Zona Norte - SME)',
      municipioOrigem: 'Natal',
      destino: 'Ceará-Mirim',
      turno: 'Matutino',
      dataCadastro: '2026-10-26'
    },
    {
      id: 'perm_003',
      nome: 'Fernanda de Lima Souza',
      matricula: '2026-2155',
      cargo: 'Professor dos Anos Finais',
      disciplina: 'Matemática',
      cargaHoraria: '30h',
      origem: 'E. M. Prefeito Roberto Varela (Ceará-Mirim)',
      municipioOrigem: 'Ceará-Mirim',
      destino: 'Extremoz',
      turno: 'Vespertino',
      dataCadastro: '2026-10-28'
    },
    {
      id: 'perm_004',
      nome: 'Roberto Rocha Brandão',
      matricula: '2026-5120',
      cargo: 'Professor dos Anos Finais',
      disciplina: 'Matemática',
      cargaHoraria: '30h',
      origem: 'Polo Extremoz (SME Centro)',
      municipioOrigem: 'Extremoz',
      destino: 'Ceará-Mirim',
      turno: 'Vespertino',
      dataCadastro: '2026-10-29'
    },
    {
      id: 'perm_005',
      nome: 'Juliana Beatriz Santos',
      matricula: '2026-6401',
      cargo: 'Professor dos Anos Finais',
      disciplina: 'Língua Portuguesa',
      cargaHoraria: '20h',
      origem: 'E. M. Monsenhor Celso Cicco (Ceará-Mirim)',
      municipioOrigem: 'Ceará-Mirim',
      destino: 'São Gonçalo do Amarante',
      turno: 'Matutino',
      dataCadastro: '2026-11-01'
    },
    {
      id: 'perm_006',
      nome: 'Marcos Vinícius Dantas',
      matricula: '2026-7890',
      cargo: 'Professor dos Anos Finais',
      disciplina: 'Língua Portuguesa',
      cargaHoraria: '30h',
      origem: 'Polo São Gonçalo do Amarante (SME Centro)',
      municipioOrigem: 'São Gonçalo do Amarante',
      destino: 'Ceará-Mirim',
      turno: 'Matutino',
      dataCadastro: '2026-11-02'
    },
    {
      id: 'perm_007',
      nome: 'Ana Cláudia Fontes',
      matricula: '2026-8012',
      cargo: 'Especialista em Educação',
      disciplina: 'Polivalente / Pedagogia',
      cargaHoraria: '40h',
      origem: 'E. M. Augusto Severo (Ceará-Mirim)',
      municipioOrigem: 'Ceará-Mirim',
      destino: 'Macaíba',
      turno: 'Integral',
      dataCadastro: '2026-11-03'
    },
    {
      id: 'perm_008',
      nome: 'Pedro Henrique Guedes',
      matricula: '2026-9134',
      cargo: 'Especialista em Educação',
      disciplina: 'Polivalente / Pedagogia',
      cargaHoraria: '40h',
      origem: 'Polo Macaíba (SME Centro)',
      municipioOrigem: 'Macaíba',
      destino: 'Ceará-Mirim',
      turno: 'Integral',
      dataCadastro: '2026-11-03'
    }
  ];

  const PORTAIS = [
    { nome: 'Governo do Estado do RN (SEEC)', regiao: 'Estadual', tecnologia: 'Playwright SPA (SEAD/COPES)', url: 'https://remuneracao.rn.gov.br/table-people' },
    { nome: 'Ceará-Mirim (Base Local SMEB)', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://pmcearamirimrn.transparencia.topsolutionsrn.com.br/servidores' },
    { nome: 'Natal', regiao: 'Grande Natal', tecnologia: 'Portal Transparência SME • CSV', url: 'https://www.natal.rn.gov.br/transparencia' },
    { nome: 'Parnamirim', regiao: 'Grande Natal', tecnologia: 'Portal Transparência • CSV', url: 'https://transparencia.parnamirim.rn.gov.br' },
    { nome: 'São Gonçalo do Amarante', regiao: 'Grande Natal', tecnologia: 'TopSolutions / Exportação CSV', url: 'https://saogoncalo.rn.gov.br' },
    { nome: 'Macaíba', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://macaiba.rn.gov.br' },
    { nome: 'Extremoz', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://extremoz.rn.gov.br' },
    { nome: 'Nísia Floresta', regiao: 'Agreste / Litoral', tecnologia: 'TopSolutions RN • CSV', url: 'https://nisiafloresta.rn.gov.br' },
    { nome: 'Monte Alegre', regiao: 'Agreste', tecnologia: 'TopSolutions RN • CSV', url: 'https://montealegre.rn.gov.br' },
    { nome: 'Ielmo Marinho', regiao: 'Potengi', tecnologia: 'TopSolutions RN • CSV', url: 'https://ielmomarinho.rn.gov.br' },
    { nome: 'São Paulo do Potengi', regiao: 'Potengi', tecnologia: 'TopSolutions RN • CSV', url: 'https://saopaulodopotengi.rn.gov.br' },
    { nome: 'João Câmara', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://joaocamara.rn.gov.br' },
    { nome: 'Poço Branco', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://pocobranco.rn.gov.br' },
    { nome: 'Taipú', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://taipu.rn.gov.br' },
    { nome: 'Touros', regiao: 'Litoral Norte', tecnologia: 'TopSolutions RN • CSV', url: 'https://touros.rn.gov.br' },
    { nome: 'Rio do Fogo', regiao: 'Litoral Norte', tecnologia: 'TopSolutions RN • CSV', url: 'https://riodofogo.rn.gov.br' }
  ];

  function init() {
    bindEvents();
    renderizarPortais('');
    if (!isStatusLoaded) {
      carregarStatusDrive();
    }
    garantirBancoPermutasInicial();
    inicializarMapa();
    executarMatchingHera();
    observarVisibilidadePagina();
  }

  function bindEvents() {
    const inFilter = document.getElementById('cadmoPortalFilterInput');
    if (inFilter && !inFilter._bound) {
      inFilter._bound = true;
      inFilter.addEventListener('input', function() {
        renderizarPortais(inFilter.value);
      });
    }

    const btnTrigger = document.getElementById('cadmoTriggerEtlBtn');
    if (btnTrigger && !btnTrigger._bound) {
      btnTrigger._bound = true;
      btnTrigger.addEventListener('click', dispararColetaMensal);
    }

    const formPermuta = document.getElementById('formPermutaCadmo');
    if (formPermuta && !formPermuta._bound) {
      formPermuta._bound = true;
      formPermuta.addEventListener('submit', salvarNovaIntencaoPermuta);
    }

    const btnLimpar = document.getElementById('btnLimparFormPermuta');
    if (btnLimpar && !btnLimpar._bound) {
      btnLimpar._bound = true;
      btnLimpar.addEventListener('click', function() {
        if (formPermuta) formPermuta.reset();
      });
    }

    const btnRecalcular = document.getElementById('btnRecalcularMatchesHera');
    if (btnRecalcular && !btnRecalcular._bound) {
      btnRecalcular._bound = true;
      btnRecalcular.addEventListener('click', function() {
        executarMatchingHera();
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Algoritmo de matching da persona Hera recalculado com sucesso!');
        }
      });
    }

    const btnToggleForm = document.getElementById('btnAlternarFormPermuta');
    if (btnToggleForm && !btnToggleForm._bound) {
      btnToggleForm._bound = true;
      btnToggleForm.addEventListener('click', function() {
        const wrapper = document.getElementById('wrapperFormPermuta');
        if (!wrapper) return;
        const isHidden = wrapper.classList.toggle('hidden');
        btnToggleForm.setAttribute('aria-expanded', String(!isHidden));
        btnToggleForm.textContent = isHidden ? '+ Nova Intenção' : '− Ocultar Formulário';
      });
    }

    window.addEventListener('resize', function() {
      if (leafletMap) {
        leafletMap.invalidateSize();
      }
    });
  }

  function observarVisibilidadePagina() {
    const pageCadmo = document.getElementById('page-papiro-cadmo');
    if (!pageCadmo || observerCadmo) return;

    observerCadmo = new MutationObserver(function() {
      if (!pageCadmo.classList.contains('hidden') && leafletMap) {
        setTimeout(function() {
          leafletMap.invalidateSize();
        }, 120);
      }
    });

    observerCadmo.observe(pageCadmo, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  function garantirBancoPermutasInicial() {
    try {
      const gravado = localStorage.getItem(BANCO_STORAGE_KEY);
      if (!gravado || gravado === '[]') {
        localStorage.setItem(BANCO_STORAGE_KEY, JSON.stringify(BANCO_INICIAL_AMOSTRA));
      }
    } catch (e) {
      console.warn('[PapiroCadmo] LocalStorage inacessível para banco de permutas:', e);
    }
  }

  function obterBancoPermutas() {
    try {
      const raw = localStorage.getItem(BANCO_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {
      console.warn('[PapiroCadmo] Erro ao analisar banco de permutas:', e);
    }
    return BANCO_INICIAL_AMOSTRA.slice();
  }

  function extrairMunicipioOrigem(nomeOrigem) {
    const str = String(nomeOrigem || '').toLowerCase();
    if (str.includes('ceará-mirim') || str.includes('ceara-mirim') || str.includes('smeb')) return 'Ceará-Mirim';
    if (str.includes('natal')) return 'Natal';
    if (str.includes('extremoz')) return 'Extremoz';
    if (str.includes('são gonçalo') || str.includes('sao goncalo') || str.includes('sga')) return 'São Gonçalo do Amarante';
    if (str.includes('macaíba') || str.includes('macaiba')) return 'Macaíba';
    return 'Ceará-Mirim';
  }

  function inicializarMapa() {
    const mapEl = document.getElementById('mapaPermutasCadmo');
    if (!mapEl || typeof window.L === 'undefined') return;

    if (!leafletMap) {
      leafletMap = window.L.map('mapaPermutasCadmo', {
        center: [-5.634, -35.428],
        zoom: 10,
        zoomControl: true,
        scrollWheelZoom: false
      });

      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(leafletMap);

      markersLayer = window.L.layerGroup().addTo(leafletMap);
      routeLayer = window.L.layerGroup().addTo(leafletMap);

      plotarMarcadores();
    }

    setTimeout(function() {
      if (leafletMap) leafletMap.invalidateSize();
    }, 150);
  }

  function plotarMarcadores() {
    if (!leafletMap || !markersLayer) return;
    markersLayer.clearLayers();

    PONTOS_GEORREFERENCIADOS.forEach(function(ponto) {
      const isSede = ponto.tipo.includes('Sede');
      const isPolo = ponto.tipo.includes('Polo Metropolitano');

      const markerHtml =
        '<div style="background:' + ponto.cor + '; width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; font-weight: bold;">' +
        (isSede ? '★' : (isPolo ? 'P' : 'E')) +
        '</div>';

      const customIcon = window.L.divIcon({
        className: 'cadmo-leaflet-divicon',
        html: markerHtml,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12]
      });

      const popupContent =
        '<div class="cadmo-map-popup" style="font-family: var(--font-body, sans-serif); min-width: 210px; padding: 4px;">' +
          '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
            '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + ponto.cor + ';"></span>' +
            '<strong style="font-size:12.5px; color: #0B1120;">' + window.OlymposApp.escapeHtml(ponto.nome) + '</strong>' +
          '</div>' +
          '<div style="font-size:11.5px; color: #475569; margin-bottom:8px;">' +
            'Município: <strong>' + window.OlymposApp.escapeHtml(ponto.municipio) + '</strong> • ' + window.OlymposApp.escapeHtml(ponto.tipo) +
          '</div>' +
          '<div style="display:flex; gap:6px; margin-top:8px;">' +
            '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10.5px; padding:3px 8px;" onclick="window.OlymposViews.papiroCadmo.definirOrigemForm(\'' + window.OlymposApp.escapeHtml(ponto.nome) + '\')">Definir Origem</button>' +
            '<button type="button" class="btn btn-primary btn-sm" style="font-size:10.5px; padding:3px 8px;" onclick="window.OlymposViews.papiroCadmo.definirDestinoForm(\'' + window.OlymposApp.escapeHtml(ponto.municipio) + '\')">Definir Destino</button>' +
          '</div>' +
        '</div>';

      const marker = window.L.marker(ponto.coords, { icon: customIcon }).bindPopup(popupContent);
      markersLayer.addLayer(marker);
    });
  }

  function definirOrigemForm(nomePonto) {
    const sel = document.getElementById('permutaEscolaOrigem');
    if (!sel) return;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === nomePonto) {
        sel.selectedIndex = i;
        break;
      }
    }
    const wrapper = document.getElementById('wrapperFormPermuta');
    if (wrapper && wrapper.classList.contains('hidden')) {
      wrapper.classList.remove('hidden');
    }
    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Origem preenchida: ' + nomePonto);
    }
  }

  function definirDestinoForm(municipio) {
    const sel = document.getElementById('permutaPoloDestino');
    if (!sel) return;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value.toLowerCase() === municipio.toLowerCase()) {
        sel.selectedIndex = i;
        break;
      }
    }
    const wrapper = document.getElementById('wrapperFormPermuta');
    if (wrapper && wrapper.classList.contains('hidden')) {
      wrapper.classList.remove('hidden');
    }
    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Destino preenchido: ' + municipio);
    }
  }

  /**
   * Motor de Matching Automático da Persona Hera:
   * Pontuação ponderada:
   *  1. Cargo / Disciplina: 40 pontos
   *  2. Carga Horária: 30 pontos
   *  3. Rota Inversa de Permuta: 30 pontos
   * Total: 0 a 100%
   * Badges: Excelente (>= 80%), Boa (>= 60%), Regular (< 60%)
   */
  function calcularCompatibilidadeHera(intA, intB) {
    // 1. Cargo & Disciplina (40 pts)
    let ptsCargo = 0;
    const mesmoCargo = intA.cargo === intB.cargo;
    const mesmaDisciplina = intA.disciplina === intB.disciplina;

    if (mesmoCargo && mesmaDisciplina) {
      ptsCargo = 40;
    } else if (mesmoCargo) {
      ptsCargo = 28;
    } else if (mesmaDisciplina) {
      ptsCargo = 18;
    } else {
      ptsCargo = 0;
    }

    // 2. Carga Horária (30 pts)
    let ptsCH = 0;
    const chA = parseInt(intA.cargaHoraria, 10) || 30;
    const chB = parseInt(intB.cargaHoraria, 10) || 30;
    const diffCH = Math.abs(chA - chB);

    if (diffCH === 0) {
      ptsCH = 30;
    } else if (diffCH <= 10) {
      ptsCH = 16; // Requer compensação de carga horária pela comissão
    } else {
      ptsCH = 0;
    }

    // 3. Rota Inversa de Permuta (30 pts)
    let ptsRota = 0;
    const munOrigA = intA.municipioOrigem || extrairMunicipioOrigem(intA.origem);
    const munDestA = intA.destino;
    const munOrigB = intB.municipioOrigem || extrairMunicipioOrigem(intB.origem);
    const munDestB = intB.destino;

    const rotaInversaExata = (munOrigA.toLowerCase() === munDestB.toLowerCase()) &&
                             (munOrigB.toLowerCase() === munDestA.toLowerCase());

    if (rotaInversaExata) {
      ptsRota = 30;
    } else if (munOrigA.toLowerCase() === munDestB.toLowerCase() || munOrigB.toLowerCase() === munDestA.toLowerCase()) {
      ptsRota = 18;
    } else {
      ptsRota = 5;
    }

    const scoreTotal = ptsCargo + ptsCH + ptsRota;

    let nivel = 'Regular';
    let badgeClass = 'badge-regular';
    let parecerHera = 'Parecer Hera: Requer análise curricular detalhada e adequação de carga horária pela Comissão de RH.';

    if (scoreTotal >= 80) {
      nivel = 'Excelente';
      badgeClass = 'badge-excelente';
      parecerHera = 'Parecer Hera: Compatibilidade pedagógica e rota geográfica recíproca perfeitas. Deferimento prioritário recomendado.';
    } else if (scoreTotal >= 60) {
      nivel = 'Boa';
      badgeClass = 'badge-boa';
      parecerHera = 'Parecer Hera: Viabilidade operacional confirmada. Necessário alinhamento de turno ou ajuste funcional leve.';
    }

    return {
      score: scoreTotal,
      nivel: nivel,
      badgeClass: badgeClass,
      ptsCargo: ptsCargo,
      ptsCH: ptsCH,
      ptsRota: ptsRota,
      parecerHera: parecerHera
    };
  }

  function executarMatchingHera() {
    const container = document.getElementById('resultadoMatchingHera');
    const badgeTotal = document.getElementById('badgeTotalMatches');
    if (!container) return;

    const banco = obterBancoPermutas();
    const matches = [];

    // Cruzamento combinatório de pares (i < j)
    for (let i = 0; i < banco.length; i++) {
      for (let j = i + 1; j < banco.length; j++) {
        const intA = banco[i];
        const intB = banco[j];

        // Evita cruzar mesma pessoa ou matrícula
        if (intA.matricula === intB.matricula) continue;

        const resultado = calcularCompatibilidadeHera(intA, intB);

        // Considera match relevante se score >= 50 ou se rota inversa for compatível
        if (resultado.score >= 50) {
          matches.push({
            candidatoA: intA,
            candidatoB: intB,
            resultado: resultado
          });
        }
      }
    }

    // Ordenação decrescente por score de compatibilidade
    matches.sort(function(a, b) {
      return b.resultado.score - a.resultado.score;
    });

    if (badgeTotal) {
      badgeTotal.textContent = matches.length + (matches.length === 1 ? ' oportunidade' : ' oportunidades');
    }

    if (matches.length === 0) {
      container.innerHTML =
        '<div class="output-panel text-center" style="padding: 32px 20px;">' +
          '<div style="font-size: 1.8rem; margin-bottom: 8px;">🤝</div>' +
          '<strong style="display:block; font-size:15px; margin-bottom:6px; color:var(--text-main);">Nenhum cruzamento com compatibilidade mínima identificado ainda</strong>' +
          '<p style="font-size:13px; color:var(--text-muted); max-width:480px; margin:0 auto 16px;">Cadastre novas intenções de permuta no formulário acima para que o motor de inteligência da persona Hera processe os cruzamentos recíprocos.</p>' +
        '</div>';
      return;
    }

    let html = '<div class="hera-matches-grid">';
    matches.forEach(function(m, idx) {
      const res = m.resultado;
      const cA = m.candidatoA;
      const cB = m.candidatoB;

      html +=
        '<div class="match-card-hera" id="matchCard_' + idx + '">' +
          '<div class="match-card-header">' +
            '<div style="display: flex; align-items: center; gap: 8px;">' +
              '<span class="badge-compatibilidade ' + res.badgeClass + '">' + res.score + '% • ' + res.nivel + '</span>' +
              '<span class="selo-hera-badge" title="Instrução validada pela Persona Hera">⚡ Selo Hera</span>' +
            '</div>' +
            '<button type="button" class="btn btn-secondary btn-sm btn-tracar-rota" ' +
              'onclick="window.OlymposViews.papiroCadmo.tracarRotaPermuta(\'' + window.OlymposApp.escapeHtml(cA.origem) + '\', \'' + window.OlymposApp.escapeHtml(cB.origem) + '\', ' + res.score + ')">' +
              '🗺️ Ver Rota no Mapa' +
            '</button>' +
          '</div>' +

          '<div class="match-candidatos-row">' +
            '<div class="candidato-box">' +
              '<div class="candidato-badge-tag">Servidor(a) A</div>' +
              '<strong class="candidato-nome">' + window.OlymposApp.escapeHtml(cA.nome) + '</strong>' +
              '<div class="candidato-meta">Matrícula: ' + window.OlymposApp.escapeHtml(cA.matricula) + ' • ' + window.OlymposApp.escapeHtml(cA.cargaHoraria) + ' (' + window.OlymposApp.escapeHtml(cA.turno) + ')</div>' +
              '<div class="candidato-cargo">' + window.OlymposApp.escapeHtml(cA.cargo) + ' — ' + window.OlymposApp.escapeHtml(cA.disciplina) + '</div>' +
              '<div class="rota-chip-container">' +
                '<span class="rota-chip-origem">' + window.OlymposApp.escapeHtml(cA.origem) + '</span>' +
                '<span class="rota-arrow">➔</span>' +
                '<span class="rota-chip-destino">' + window.OlymposApp.escapeHtml(cA.destino) + '</span>' +
              '</div>' +
            '</div>' +

            '<div class="match-connector-icon">' +
              '<div class="connector-circle">⇄</div>' +
            '</div>' +

            '<div class="candidato-box">' +
              '<div class="candidato-badge-tag">Servidor(a) B</div>' +
              '<strong class="candidato-nome">' + window.OlymposApp.escapeHtml(cB.nome) + '</strong>' +
              '<div class="candidato-meta">Matrícula: ' + window.OlymposApp.escapeHtml(cB.matricula) + ' • ' + window.OlymposApp.escapeHtml(cB.cargaHoraria) + ' (' + window.OlymposApp.escapeHtml(cB.turno) + ')</div>' +
              '<div class="candidato-cargo">' + window.OlymposApp.escapeHtml(cB.cargo) + ' — ' + window.OlymposApp.escapeHtml(cB.disciplina) + '</div>' +
              '<div class="rota-chip-container">' +
                '<span class="rota-chip-origem">' + window.OlymposApp.escapeHtml(cB.origem) + '</span>' +
                '<span class="rota-arrow">➔</span>' +
                '<span class="rota-chip-destino">' + window.OlymposApp.escapeHtml(cB.destino) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="match-score-breakdown">' +
            '<div class="score-pill-item">' +
              '<span class="score-pill-label">Cargo &amp; Disciplina</span>' +
              '<span class="score-pill-val">' + res.ptsCargo + ' / 40 pts</span>' +
            '</div>' +
            '<div class="score-pill-item">' +
              '<span class="score-pill-label">Carga Horária</span>' +
              '<span class="score-pill-val">' + res.ptsCH + ' / 30 pts</span>' +
            '</div>' +
            '<div class="score-pill-item">' +
              '<span class="score-pill-label">Rota Inversa</span>' +
              '<span class="score-pill-val">' + res.ptsRota + ' / 30 pts</span>' +
            '</div>' +
          '</div>' +

          '<div class="parecer-hera-box">' +
            '<span class="parecer-hera-icon">⚖️</span>' +
            '<p class="parecer-hera-text">' + window.OlymposApp.escapeHtml(res.parecerHera) + '</p>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function tracarRotaPermuta(origemA, origemB, score) {
    if (!leafletMap || !routeLayer) return;
    routeLayer.clearLayers();

    // Localiza coordenadas de A e B
    let coordA = null;
    let coordB = null;

    PONTOS_GEORREFERENCIADOS.forEach(function(p) {
      if (p.nome === origemA || origemA.includes(p.nome) || p.nome.includes(origemA)) {
        coordA = p.coords;
      }
      if (p.nome === origemB || origemB.includes(p.nome) || p.nome.includes(origemB)) {
        coordB = p.coords;
      }
    });

    if (!coordA) coordA = [-5.6344, -35.4245];
    if (!coordB) coordB = [-5.7550, -35.2600];

    const corLinha = score >= 80 ? '#10B981' : (score >= 60 ? '#D4AF37' : '#64748B');

    const polyline = window.L.polyline([coordA, coordB], {
      color: corLinha,
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.95
    }).addTo(routeLayer);

    const bounds = window.L.latLngBounds([coordA, coordB]);
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });

    // Scroll suave até o mapa
    const mapWrapper = document.getElementById('mapaPermutasCadmo');
    if (mapWrapper) {
      mapWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Rota de permuta traçada no mapa cartográfico!');
    }
  }

  function salvarNovaIntencaoPermuta(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nome = (document.getElementById('permutaNome')?.value || '').trim();
    const matricula = (document.getElementById('permutaMatricula')?.value || '').trim();
    const cargo = (document.getElementById('permutaCargo')?.value || '').trim();
    const disciplina = (document.getElementById('permutaDisciplina')?.value || '').trim();
    const cargaHoraria = (document.getElementById('permutaCargaHoraria')?.value || '').trim();
    const turno = (document.getElementById('permutaTurno')?.value || '').trim();
    const origem = (document.getElementById('permutaEscolaOrigem')?.value || '').trim();
    const destino = (document.getElementById('permutaPoloDestino')?.value || '').trim();

    if (!nome || !matricula || !cargo || !disciplina || !origem || !destino) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Por favor, preencha todos os campos obrigatórios da permuta.', true);
      }
      return;
    }

    const novaIntencao = {
      id: 'perm_' + Date.now(),
      nome: nome,
      matricula: matricula,
      cargo: cargo,
      disciplina: disciplina,
      cargaHoraria: cargaHoraria,
      turno: turno,
      origem: origem,
      municipioOrigem: extrairMunicipioOrigem(origem),
      destino: destino,
      dataCadastro: new Date().toISOString().slice(0, 10)
    };

    try {
      const banco = obterBancoPermutas();
      banco.unshift(novaIntencao);
      localStorage.setItem(BANCO_STORAGE_KEY, JSON.stringify(banco));

      const form = document.getElementById('formPermutaCadmo');
      if (form) form.reset();

      executarMatchingHera();

      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Intenção de permuta gravada com sucesso! Persona Hera recalculou as compatibilidades.');
      }
    } catch (err) {
      console.error('[PapiroCadmo] Erro ao gravar intenção no localStorage:', err);
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Erro ao salvar intenção de permuta.', true);
      }
    }
  }

  function carregarStatusDrive() {
    window.OlymposApi.chamar('cadmo_status', {}, function(res) {
      const data = (res && res.data) ? res.data : res;
      if (!data) return;
      isStatusLoaded = true;

      const compEl = document.getElementById('cadmoLastCompetencia');
      const metaEl = document.getElementById('cadmoLastUploadMeta');
      const listEl = document.getElementById('cadmoCsvFilesList');

      if (compEl) compEl.textContent = data.ultimaCompetencia || 'Ciclo Mensal Configurado (Todo dia 12)';
      if (metaEl) {
        metaEl.textContent = data.totalArquivosCsv > 0
          ? (data.totalArquivosCsv + ' base(s) CSV consolidada(s) no Drive • Última atualização: ' + (data.ultimoUploadEm || '--'))
          : 'Pipeline pronto no GitHub Actions. Os arquivos servidores-intermunicipais-AAAA-MM.csv aparecerão automaticamente aqui.';
      }

      if (listEl) {
        const arqs = data.arquivosCsv || [];
        if (arqs.length === 0) {
          listEl.innerHTML = 'Nenhuma base <code>servidores-intermunicipais-AAAA-MM.csv</code> localizada ainda na pasta do Setor Pessoal.';
        } else {
          listEl.className = 'job-links-list';
          window.OlymposApp.renderizarItensLinksGerados(
            listEl,
            arqs.map(function(a) {
              return {
                titulo: a.nome,
                detalhe: 'Competência ' + a.competencia + ' • ' + a.dataCriacao + ' • ' + a.tamanhoKb + ' KB',
                url: a.url
              };
            })
          );
        }
      }
    }, function() {
      const listEl = document.getElementById('cadmoCsvFilesList');
      if (listEl) {
        listEl.innerHTML = 'Conecte-se ao Gateway GAS para listar os arquivos CSV consolidados na pasta do Setor Pessoal.';
      }
    });
  }

  function renderizarPortais(termoRaw) {
    const grid = document.getElementById('cadmoPortaisGrid');
    if (!grid) return;

    const termo = String(termoRaw || '').toLowerCase().trim();
    const filtrados = PORTAIS.filter(function(p) {
      if (!termo) return true;
      return p.nome.toLowerCase().includes(termo) ||
        p.regiao.toLowerCase().includes(termo) ||
        p.tecnologia.toLowerCase().includes(termo);
    });

    grid.innerHTML = '';
    filtrados.forEach(function(p) {
      const card = document.createElement('div');
      card.className = 'output-panel';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';
      card.style.gap = '10px';

      card.innerHTML =
        '<div>' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">' +
            '<strong style="font-family:var(--font-display); font-size:13.5px; color:var(--text-main);">' + window.OlymposApp.escapeHtml(p.nome) + '</strong>' +
            '<span class="pill-badge pill-green">Dia 12</span>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--text-muted);">' + window.OlymposApp.escapeHtml(p.regiao) + ' • ' + window.OlymposApp.escapeHtml(p.tecnologia) + '</div>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted);">Fallback SIAI/TCE-RN</span>' +
          '<a href="' + window.OlymposApp.escapeHtml(p.url) + '" target="_blank" rel="noopener" class="folder-chip" style="padding:3px 10px; font-size:11px;">Portal ↗</a>' +
        '</div>';

      grid.appendChild(card);
    });
  }

  function dispararColetaMensal() {
    const comp = prompt('Competência opcional (AAAA-MM, ex: 2026-09). Deixe vazio para coletar o mês anterior completo:', '');
    if (comp === null) return;

    window.OlymposApp.showToast('Acionando pipeline O Papiro de Cadmo no GitHub Actions...');
    window.OlymposApi.chamar('cadmo_disparar_coleta', { competencia: comp.trim() }, function(res) {
      if (res && res.ok) {
        window.OlymposApp.showToast(res.mensagem || 'Pipeline O Papiro de Cadmo acionado!');
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao acionar coleta.', true);
      }
    }, function(err) {
      window.OlymposApp.showToast('Erro: ' + err.message, true);
    });
  }

  return {
    init: init,
    definirOrigemForm: definirOrigemForm,
    definirDestinoForm: definirDestinoForm,
    executarMatchingHera: executarMatchingHera,
    tracarRotaPermuta: tracarRotaPermuta
  };
})();
