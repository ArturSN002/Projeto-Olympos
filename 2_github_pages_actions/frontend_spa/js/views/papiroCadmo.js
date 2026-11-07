/**
 * Hub Olympos V2.1 — Página Modular 7: O Papiro de Cadmo (ETL Mensal de Permutas RN)
 * Painel Georreferenciado de Permutas & Motor de Matching da Persona Hera (Leaflet.js + OSM)
 * Integrado à Base Oficial da Transparência de Ceará-Mirim (4.182 servidores / 890 docentes ativos)
 * Auditoria Constitucional de Acumulação de Vínculos (CF/88 Art. 37, XVI - Teto 60h)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.papiroCadmo = (function() {
  let isStatusLoaded = false;
  let leafletMap = null;
  let markersLayer = null;
  let routeLayer = null;
  let observerCadmo = null;
  let abaAtiva = 'permutas'; // 'permutas', 'vinculos' ou 'docentes'
  let termoBuscaServidor = '';

  const BANCO_STORAGE_KEY = 'olympos_permutas_banco';

  // Catálogo Georreferenciado Oficial das 15 Secretarias Municipais de Educação Parceiras (RN)
  const PONTOS_GEORREFERENCIADOS = [
    { id: 'sme_ceara_mirim', nome: 'SMEB Sede (Ceará-Mirim)', municipio: 'Ceará-Mirim', regiao: 'Grande Natal', tipo: 'Sede Administrativa SMEB', coords: [-5.6344, -35.4245], cor: '#D4AF37', icone: '★', endereco: 'Rua General João Varela, 120, Centro', contato: '(84) 3274-5900' },
    { id: 'sme_natal', nome: 'SME Natal (Polo Natal)', municipio: 'Natal', regiao: 'Grande Natal / Metrópole', tipo: 'Secretaria Municipal Parceira', coords: [-5.7890, -35.2020], cor: '#10B981', icone: '🏛️', endereco: 'Rua Fabrício Pedroza, 915, Petrópolis', contato: '(84) 3232-4700' },
    { id: 'sme_extremoz', nome: 'SME Extremoz (Polo Extremoz)', municipio: 'Extremoz', regiao: 'Grande Natal', tipo: 'Secretaria Municipal Parceira', coords: [-5.7067, -35.3069], cor: '#8B5CF6', icone: '🏛️', endereco: 'Rua Capitão José da Penha, s/n, Centro', contato: '(84) 3279-4910' },
    { id: 'sme_sga', nome: 'SME São Gonçalo do Amarante (Polo SGA)', municipio: 'São Gonçalo do Amarante', regiao: 'Grande Natal', tipo: 'Secretaria Municipal Parceira', coords: [-5.7928, -35.3300], cor: '#F59E0B', icone: '🏛️', endereco: 'Rua Coronel Estevam, s/n, Centro', contato: '(84) 3278-4850' },
    { id: 'sme_macaiba', nome: 'SME Macaíba (Polo Macaíba)', municipio: 'Macaíba', regiao: 'Grande Natal', tipo: 'Secretaria Municipal Parceira', coords: [-5.8569, -35.3531], cor: '#EC4899', icone: '🏛️', endereco: 'Rua Doutor Pedro Velho, s/n, Centro', contato: '(84) 3271-6510' },
    { id: 'sme_parnamirim', nome: 'SEMEC Parnamirim (Polo Parnamirim)', municipio: 'Parnamirim', regiao: 'Grande Natal', tipo: 'Secretaria Municipal Parceira', coords: [-5.9156, -35.2628], cor: '#06B6D4', icone: '🏛️', endereco: 'Rua Tenente Medeiros, 105, Cohabinal', contato: '(84) 3645-1234' },
    { id: 'sme_nisia_floresta', nome: 'SME Nísia Floresta', municipio: 'Nísia Floresta', regiao: 'Litoral Sul / Agreste', tipo: 'Secretaria Municipal Parceira', coords: [-6.0169, -35.2089], cor: '#14B8A6', icone: '🏛️', endereco: 'Rua Cônego Calazans, Centro', contato: '(84) 3277-2200' },
    { id: 'sme_monte_alegre', nome: 'SME Monte Alegre', municipio: 'Monte Alegre', regiao: 'Agreste Potiguar', tipo: 'Secretaria Municipal Parceira', coords: [-6.0644, -35.3325], cor: '#6366F1', icone: '🏛️', endereco: 'Rua Pedro Alves, Centro', contato: '(84) 3276-2215' },
    { id: 'sme_ielmo_marinho', nome: 'SME Ielmo Marinho', municipio: 'Ielmo Marinho', regiao: 'Região Potengi', tipo: 'Secretaria Municipal Parceira', coords: [-5.8211, -35.5314], cor: '#A855F7', icone: '🏛️', endereco: 'Rua Manoel Camilo, Centro', contato: '(84) 3269-0120' },
    { id: 'sme_spp', nome: 'SME São Paulo do Potengi', municipio: 'São Paulo do Potengi', regiao: 'Região Potengi', tipo: 'Secretaria Municipal Parceira', coords: [-5.8947, -35.7628], cor: '#E11D48', icone: '🏛️', endereco: 'Rua Bento Urbano, Centro', contato: '(84) 3251-2250' },
    { id: 'sme_joao_camara', nome: 'SME João Câmara', municipio: 'João Câmara', regiao: 'Região Mato Grande', tipo: 'Secretaria Municipal Parceira', coords: [-5.5375, -35.8197], cor: '#D97706', icone: '🏛️', endereco: 'Rua Vereador José Severiano, Centro', contato: '(84) 3262-2510' },
    { id: 'sme_poco_branco', nome: 'SME Poço Branco', municipio: 'Poço Branco', regiao: 'Região Mato Grande', tipo: 'Secretaria Municipal Parceira', coords: [-5.6239, -35.6606], cor: '#0284C7', icone: '🏛️', endereco: 'Rua Francisco de Assis, Centro', contato: '(84) 3264-0130' },
    { id: 'sme_taipu', nome: 'SME Taipú', municipio: 'Taipú', regiao: 'Região Mato Grande', tipo: 'Secretaria Municipal Parceira', coords: [-5.6217, -35.5358], cor: '#0D9488', icone: '🏛️', endereco: 'Praça 10 de Março, Centro', contato: '(84) 3265-0105' },
    { id: 'sme_touros', nome: 'SME Touros', municipio: 'Touros', regiao: 'Litoral Norte', tipo: 'Secretaria Municipal Parceira', coords: [-5.1989, -35.4608], cor: '#2563EB', icone: '🏛️', endereco: 'Av. 27 de Março, Centro', contato: '(84) 3263-2210' },
    { id: 'sme_rio_do_fogo', nome: 'SME Rio do Fogo', municipio: 'Rio do Fogo', regiao: 'Litoral Norte', tipo: 'Secretaria Municipal Parceira', coords: [-5.2750, -35.3814], cor: '#059669', icone: '🏛️', endereco: 'Rua José Severiano, Centro', contato: '(84) 3694-0112' },
    { id: 'seec_rn', nome: 'SEEC / Governo do Estado do RN', municipio: 'Governo do Estado do RN (SEEC)', regiao: 'Estadual', tipo: 'Secretaria de Estado da Educação (SEEC/RN)', coords: [-5.8278, -35.2156], cor: '#3B82F6', icone: '🌐', endereco: 'Centro Administrativo do Estado, Bloco I, BR-101, Natal/RN', contato: '(84) 3232-1300 / seec@rn.gov.br' }
  ];

  const STORAGE_KEY_SECRETARIAS = 'olympos_secretarias_parceiras';

  function obterPontosSecretarias() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SECRETARIAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return PONTOS_GEORREFERENCIADOS.map(function(padrao) {
            const custom = parsed.find(function(p) { return p.id === padrao.id; });
            if (custom) {
              return {
                id: padrao.id,
                nome: custom.nome || padrao.nome,
                municipio: custom.municipio || padrao.municipio,
                regiao: custom.regiao || padrao.regiao,
                tipo: custom.tipo || padrao.tipo,
                coords: (Array.isArray(custom.coords) && custom.coords.length === 2 && !isNaN(custom.coords[0]) && !isNaN(custom.coords[1]))
                  ? [Number(custom.coords[0]), Number(custom.coords[1])]
                  : padrao.coords,
                cor: custom.cor || padrao.cor,
                icone: custom.icone || padrao.icone,
                endereco: custom.endereco || padrao.endereco,
                contato: custom.contato || padrao.contato
              };
            }
            return Object.assign({}, padrao);
          });
        }
      }
    } catch (e) {
      console.warn('[PapiroCadmo] Erro ao carregar secretarias do localStorage:', e);
    }
    return PONTOS_GEORREFERENCIADOS.map(function(p) { return Object.assign({}, p); });
  }

  function obterEscolasDinamicasCadmo() {
    // 1. Tenta API modular de Escolas
    if (window.OlymposViews && window.OlymposViews.escolas && typeof window.OlymposViews.escolas.obterEscolas === 'function') {
      try {
        const arr = window.OlymposViews.escolas.obterEscolas();
        if (Array.isArray(arr) && arr.length > 0) return arr;
      } catch (e) {
        console.warn('[PapiroCadmo] Erro ao obter escolas via módulo:', e);
      }
    }
    // 2. Tenta LocalStorage (chaves oficial e interoperável)
    try {
      const raw = localStorage.getItem('olympos_escolas_ceara_mirim') || localStorage.getItem('olympos_escolas_municipais');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch (e) {
      console.warn('[PapiroCadmo] Erro ao analisar localStorage de escolas:', e);
    }
    // 3. Fallback para catálogo semente de escolasCearaMirim.js
    if (typeof window.BANCO_SEMENTE_ESCOLAS !== 'undefined' && Array.isArray(window.BANCO_SEMENTE_ESCOLAS)) {
      return window.BANCO_SEMENTE_ESCOLAS;
    }
    return [];
  }

  function obterTodosPontosMapa() {
    const pontos = obterPontosSecretarias();
    const escolas = obterEscolasDinamicasCadmo();

    escolas.forEach(function(esc) {
      if (esc.nome && esc.nome.includes('SMEB Sede')) return;
      if (typeof esc.lat !== 'number' || typeof esc.lng !== 'number') return;

      const ehCei = esc.categoria === 'Centro de Educação Infantil' || /^c\.?e\.?i\.?\b/i.test(esc.nome || '');
      const corPadrao = esc.zona === 'Rural' ? '#10B981' : (ehCei ? '#F59E0B' : '#38BDF8');
      pontos.push({
        id: esc.id || ('esc_' + Math.random().toString(36).substr(2, 6)),
        nome: esc.nome + ' (Ceará-Mirim)',
        nomeSimples: esc.nome,
        municipio: 'Ceará-Mirim',
        regiao: 'Ceará-Mirim • ' + (esc.zona || 'Urbana'),
        tipo: esc.categoria || 'Escola Municipal',
        coords: [esc.lat, esc.lng],
        cor: esc.cor || corPadrao,
        icone: (esc.icone === 'C' && !ehCei) ? (esc.zona === 'Rural' ? 'R' : 'U') : (esc.icone || (esc.zona === 'Rural' ? 'R' : (ehCei ? 'C' : 'U'))),
        endereco: esc.endereco || '',
        inep: esc.inep || '',
        isEscolaDinamica: true
      });
    });

    return pontos;
  }

  // Base Real de Referência Cadastral dos 890 Docentes Ativos de Ceará-Mirim (Fonte: Portal da Transparência TopSolutions)
  let DOCENTES_CEARA_MIRIM = [{"m": "0010016", "n": "ODJAIME CAMARA DE ARAUJO", "c": "###.487.734-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0051391", "n": "ELIANE XAVIER", "c": "###.132.534-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0051683", "n": "LENIVALDO EDUARDO LOPES DE OLIVEIRA", "c": "###.241.304-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0051994", "n": "MARIA JAQUELINE BARBOSA", "c": "###.732.784-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0052044", "n": "MARIA ELIELSA GARCIA", "c": "###.343.214-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0060195", "n": "ROSANA PALHANO DE OLIVEIRA SILVA", "c": "###.659.564-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0060691", "n": "ELIANE LOPES FREIRE DE SOUSA", "c": "###.816.024-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0060880", "n": "FRANCISCA SORIENE DANTAS", "c": "###.559.274-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0060942", "n": "JOSIDALVA DA SILVA", "c": "###.888.084-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0061086", "n": "MARGARIDA OLIVEIRA DA SILVA", "c": "###.556.324-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0061124", "n": "JOANA MARIA DA SILVA", "c": "###.127.344-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0061159", "n": "LIEGE SILVA DE OLIVEIRA", "c": "###.900.264-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0061175", "n": "MARIA DA GLORIA DE CASTRO SIQUEIRA", "c": "###.934.764-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. HELENA VILAR RIBEIRO DANTAS (MINAMORA)"}, {"m": "0061191", "n": "MARIA DA CONCEICAO DA LUZ SILVA", "c": "###.041.594-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO/Diretor Escolar Nível II (GV)", "h": "40h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0061213", "n": "MARINALVA ARAUJO DE SOUZA", "c": "###.327.874-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0061249", "n": "ANA CARLA BEZERRA MARTINIANO GUIMARAES", "c": "###.280.444-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0061256", "n": "ADRIANA SIQUEIRA JERONIMO PALHANO", "c": "###.147.864-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0061388", "n": "JOANA DARC FERREIRA DA SILVA", "c": "###.522.484-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0061575", "n": "MARIA DO SOCORRO PINHEIRO DE ANDRADE", "c": "###.934.504-##", "g": "PROFESSOR EDUCAÇÃO INFANTIL - MAGISTERIO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0061583", "n": "JOANA DARC BARBOSA DA SILVA ANTONIO", "c": "###.152.394-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0061591", "n": "ANA CRISTINA GALDINO DE SOUZA CAVALCANTI", "c": "###.660.604-##", "g": "PROFESSOR EDUCAÇÃO INFANTIL - MAGISTERIO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0061605", "n": "MARIA DO ROSARIO DA SILVA", "c": "###.451.374-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0061647", "n": "LILIAN SOUZA DA SILVA REVOREDO", "c": "###.003.764-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0061949", "n": "SILVANA PATRICIA COCENTINO BRANDAO", "c": "###.812.604-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0062384", "n": "GENI DARC SANTIAGO DA SILVA PESSOA", "c": "###.120.954-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0062392", "n": "LEOLINA DO NASCIMENTO BARBOSA", "c": "###.509.944-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0062414", "n": "ALESSANDRO DE SOUZA RODRIGUES", "c": "###.695.994-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "0062422", "n": "ANILDA XAVIER DE OLIVEIRA", "c": "###.742.984-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. HELENA VILAR RIBEIRO DANTAS (MINAMORA)"}, {"m": "0062431", "n": "MARCIA MARIA FERREIRA DA ROCHA", "c": "###.629.594-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0062449", "n": "FRANCISCA LUCIENE BATISTA FERNANDES", "c": "###.369.954-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0062457", "n": "MARIA LUIZA DE CASTRO PONTES", "c": "###.096.334-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO/Diretor Escolar Nível III (GD)", "h": "40h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0062465", "n": "ANA CARLA GOMES DA SILVA", "c": "###.191.894-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0062473", "n": "MARIA DA CONCEICAO NETA DE MELO", "c": "###.147.914-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0062481", "n": "MARIA DAS GRACAS TEIXEIRA DA ROCHA", "c": "###.887.204-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0062511", "n": "MARIA DA CONCEICAO DIONIZIO DE MOURA", "c": "###.118.654-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0062686", "n": "KIVIA KECIA BARBOSA DE QUEIROZ", "c": "###.349.174-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0063045", "n": "MARIA DE LUJAN SILVA RODRIGUES", "c": "###.143.124-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0063224", "n": "SONIA REGINA FREIRE BARBOSA", "c": "###.593.924-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0063232", "n": "ZULEICA CAMARA COELHO ALVES", "c": "###.268.054-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0066518", "n": "THETIS SANTIAGO COELHO", "c": "###.336.634-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0066561", "n": "HOZANA FERNANDES DA SILVA", "c": "###.586.574-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0066992", "n": "MARIA APARECIDA DA COSTA DELMIRO", "c": "###.441.704-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0067034", "n": "NAIR OLIVEIRA DA SILVA", "c": "###.485.574-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0067342", "n": "ADRIANA CANELA DE OLIVEIRA LEWIS", "c": "###.063.954-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0067603", "n": "CRISTINA SEVERO MARINHO", "c": "###.506.034-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0067630", "n": "IRANIR NOBRE CAMARA", "c": "###.985.734-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0067638", "n": "LIEGE MARIA DA SILVA", "c": "###.613.454-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0067646", "n": "LEDA DE OLIVEIRA", "c": "###.372.314-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0067661", "n": "PAULO HENRIQUE FONSECA DOS SANTOS", "c": "###.635.534-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0067711", "n": "HELENA DA TRINDADE PEREIRA", "c": "###.681.484-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0067734", "n": "SUZANA MARIA GALDINO DA SILVA", "c": "###.545.964-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0067794", "n": "ALEXANDRE CESAR DA FONSECA", "c": "###.746.824-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0067808", "n": "SONIA MARIA DA SILVA TEODORO", "c": "###.759.004-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "0067940", "n": "FRANCISCA MARIA BARROS DA SILVA", "c": "###.930.914-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0068375", "n": "SOLANGE MARIA DA COSTA DOS SANTOS", "c": "###.309.634-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0068392", "n": "VERONICA SILVA DA CUNHA", "c": "###.357.024-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0068413", "n": "JOSE CLAUDIO RIBEIRO DA SILVA", "c": "###.871.084-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0068520", "n": "JEANE CRISTINA CORREIA DA SILVA", "c": "###.656.264-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0069729", "n": "VANUSA MARIA LIMA DO NASCIMENTO", "c": "###.411.374-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0069738", "n": "JONAS DE SA DANTAS", "c": "###.804.684-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0069754", "n": "ROSANGELA LIMA MESSIAS", "c": "###.787.494-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0069762", "n": "KYARA ANDREA PEREIRA RAMALHO DA SILVA", "c": "###.285.804-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0069811", "n": "KATILENE ROSANE CASTRO CAMARA DANTAS", "c": "###.798.094-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0069819", "n": "MARIA DAS DORES DA SILVA CAMARA", "c": "###.613.344-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "0069835", "n": "EDNILZA DO NASCIMENTO SILVA", "c": "###.548.144-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "0069843", "n": "MARICELIA SILVA DO NASCIMENTO", "c": "###.119.724-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. CONCEICAO MARQUES (RIO DOS INDIOS)"}, {"m": "0070212", "n": "JOAO BATISTA LOPES DE SOUZA", "c": "###.799.684-##", "g": "PROFESSOR NIVEL - MAGISTERIO/Assessor Especial de Cultura e Eventos", "h": "30h", "l": "SECRETARIA MUNICIPAL DE CULTURA E EVENTOS"}, {"m": "0070301", "n": "VANIA SUELY BARBOSA DANTAS", "c": "###.877.274-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0070557", "n": "JOAO MARIA LOPES DE LIMA", "c": "###.416.564-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0070671", "n": "JOSE FARIAS DA SILVA", "c": "###.642.614-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0070671", "n": "JOSE FARIAS DA SILVA", "c": "###.642.614-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0070859", "n": "JOAO MARIA ALVES DE LIMA", "c": "###.238.004-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0071367", "n": "MARIA JOSE DUARTE DE OLIVEIRA", "c": "###.857.684-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0071588", "n": "FRANCISCO EMIDIO DA SILVA", "c": "###.356.564-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0071961", "n": "JOSE DOS SANTOS BARACHO", "c": "###.152.304-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "0072110", "n": "MARIA DA CONCEICAO CLAUDINO", "c": "###.670.314-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0072731", "n": "ANTONIA MARIA DA CRUZ MEDEIROS", "c": "###.607.264-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FRANCISCO DE ASSIS SANTANA"}, {"m": "0072916", "n": "FRANCISCO DE ASSIS CAVALCANTI PEREIRA", "c": "###.055.424-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0072925", "n": "MARIA GORETTI DA SILVA RODRIGUES", "c": "###.155.964-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0073084", "n": "MARIA DE FATIMA FAGUNDES DE MELO SILVEIRA", "c": "###.404.894-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073114", "n": "VANUSA DA CRUZ BRANDAO", "c": "###.357.024-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "BIBLIOTECA MUNICIPAL"}, {"m": "0073122", "n": "ADRIANA MOREIRA DE OLIVEIRA", "c": "###.689.464-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "0073211", "n": "ELIONE DE SOUZA LEANDRO ARAUJO", "c": "###.472.144-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0073230", "n": "LADJANE CAMARA BEZERRA DA SILVA", "c": "###.706.934-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0073238", "n": "LAECIO FERNANDES MORAIS", "c": "###.378.104-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0073246", "n": "LUCINEIDE SOUZA E SILVA", "c": "###.598.724-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073262", "n": "JAIME SILVESTRE DE OLIVEIRA", "c": "###.358.134-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0073289", "n": "VERIDIANA MARIA GERMANO DA SILVA", "c": "###.065.224-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073301", "n": "ANTONIO SERGIO MEDEIROS DA SILVEIRA", "c": "###.099.884-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0073327", "n": "FRANCISCO VITORINO DE ANDRADE JUNIOR", "c": "###.600.014-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073335", "n": "LEA MARIA BARRETO DE OLIVEIRA", "c": "###.736.164-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0073378", "n": "FERNANDO ANTONIO DE CASTRO SIQUEIRA", "c": "###.996.204-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0073386", "n": "FRANCISCA CRISTINA SILVA SOBRAL", "c": "###.405.264-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073408", "n": "JOAO MARIA DE CASTRO PONTES", "c": "###.082.044-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0073424", "n": "MARIA ELISSANDRA ARAUJO DE LIMA", "c": "###.805.654-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0073432", "n": "MARIA LUCIA SILVA DE MEDEIROS", "c": "###.001.114-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0073441", "n": "MOACIR RAMOS DA SILVA", "c": "###.881.234-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073467", "n": "TERESA CRISTINA DE OLIVEIRA MEDEIROS PAIVA", "c": "###.070.904-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0073483", "n": "ENEAS DANTAS TORRES", "c": "###.141.464-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073491", "n": "ERIBERTO MOREIRA DE OLIVEIRA", "c": "###.201.904-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073513", "n": "JAILSON FERNANDES TORRES", "c": "###.642.824-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0073513", "n": "JAILSON FERNANDES TORRES", "c": "###.642.824-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0073521", "n": "JOARACY COSTA DE LIMA PEIXOTO", "c": "###.522.194-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0073548", "n": "LAECIO LUIZ DE OLIVEIRA", "c": "###.200.864-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0073581", "n": "NIVALDO DE LIMA ALVES", "c": "###.477.654-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0073611", "n": "RAQUEL CRISTINA SOUZA DA CRUZ BELMIRO", "c": "###.341.354-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0073661", "n": "FRANCISCA DE ANDRADE SILVA FERNANDES", "c": "###.549.454-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0073688", "n": "IVONILSON SIMIAO SEVERO", "c": "###.379.934-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0073696", "n": "JANETE SOUZA DO NASCIMENTO", "c": "###.908.794-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "0073710", "n": "JEAN CARLOS DOS SANTOS", "c": "###.801.264-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0073718", "n": "JOAO MARIA DA CRUZ SILVA", "c": "###.317.604-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0073742", "n": "MARIA DALIA ALVES DE LIMA", "c": "###.077.294-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0073751", "n": "MARIA DE FATIMA DE LIMA", "c": "###.318.954-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "0073793", "n": "CRISTOVAM VIRGINIO DE LIMA", "c": "###.966.004-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0073823", "n": "MARIA DO SOCORRO SILVA SOBRAL", "c": "###.794.844-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0073831", "n": "ADRIANA MACHADO FREIRE PRAXEDES", "c": "###.369.384-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0073850", "n": "ANA CARLA RAMALHO MARTINIANO", "c": "###.512.814-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0073866", "n": "CLENEILDA NICACIO DA SILVA", "c": "###.931.134-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0073891", "n": "ELISANGELA OLIVEIRA DA SILVA", "c": "###.203.854-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0073912", "n": "EDUARDO LIMA DE MIRANDA JUNIOR", "c": "###.422.084-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0073939", "n": "SONIA CAMPOS BARBOSA", "c": "###.120.764-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0073947", "n": "CLEONEIDE MARIA MACIEL DA SILVEIRA", "c": "###.877.224-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0073963", "n": "MARIA DA CONCEICAO SILVA CANDIDO", "c": "###.696.114-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0074145", "n": "MARIA LINDALCI DO NASCIMENTO", "c": "###.508.664-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MANOEL DANTAS BARRETO (JACOCA)"}, {"m": "0074162", "n": "MARIA DA CONCEICAO DE SOUZA DUARTE", "c": "###.013.224-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0074234", "n": "VITORIA MARIA DA CRUZ AZEVEDO BEZERRA", "c": "###.570.494-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0074277", "n": "MARINALVA NOGUEIRA DE ARAUJO", "c": "###.659.014-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0074293", "n": "NATERCIA MARIA LINS DE OLIVEIRA", "c": "###.466.924-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0074331", "n": "LUIZ DE OLIVEIRA FERNANDES", "c": "###.822.754-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0074358", "n": "MANOEL DE OLIVEIRA FERNANDES", "c": "###.492.694-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "0074366", "n": "NECI GRACIANO DA ROCHA", "c": "###.052.654-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0074382", "n": "ERINALDO DOS SANTOS SILVA", "c": "###.849.554-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ARY ALECRIM PACHECO (PEDREGULHO)"}, {"m": "0074421", "n": "MARIO COSTA JUNIOR", "c": "###.535.504-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0074439", "n": "SILVANEIDE DANTAS SARAIVA", "c": "###.515.324-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0074455", "n": "ARLINDA SAMY VIANA PEREIRA", "c": "###.140.804-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0074463", "n": "SOLANGE MARIA SILVA DO NASCIMENTO", "c": "###.157.364-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0074587", "n": "ROSANGELA MARIA RAMALHO DO NASCIMENTO", "c": "###.770.074-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0074609", "n": "MARIA SANDRA SILVA DE MORAIS", "c": "###.125.484-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0074660", "n": "ELBA DE ANDRADE SOUZA VIEIRA", "c": "###.179.574-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0074668", "n": "JOANA MARIA BEZERRA DANTAS", "c": "###.872.084-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0074684", "n": "GERINALDO MOURA DA SILVA", "c": "###.849.804-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0074714", "n": "JOAO MARIA FERNANDES DA SILVA", "c": "###.351.594-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0074722", "n": "FRANCENILDA NOGUEIRA DA SILVA", "c": "###.773.784-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0074731", "n": "JOSE BEZERRA JACOME", "c": "###.576.864-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0074749", "n": "VALDENICE OLIVEIRA DA SILVA FERNANDES", "c": "###.851.614-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0074800", "n": "LUCICLEY BARBOSA DOS SANTOS", "c": "###.101.474-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0074811", "n": "LUCIENE CARLOS DE MELO", "c": "###.542.014-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0074830", "n": "MARIA LUCINEIDE DO NASCIMENTO DE PAULA", "c": "###.520.494-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0074854", "n": "JOSE DA SILVA BEZERRA", "c": "###.389.984-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0074862", "n": "LUCIENE SOARES DE BRITO", "c": "###.653.114-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0074871", "n": "ELISANGELA DE SOUZA LEANDRO DOS SANTOS", "c": "###.889.884-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0074889", "n": "JEANE KATIUSCIA FRANCA DA SILVA", "c": "###.439.804-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0074901", "n": "LUCIANA FREIRE SOBRAL", "c": "###.128.744-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0074919", "n": "CRISTIANE MARIA DA SILVA PEREIRA", "c": "###.475.824-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0074935", "n": "LUCIA MARIA DE MEDEIROS VIEIRA", "c": "###.268.454-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0074943", "n": "JOSE ADRIAO DA SILVA", "c": "###.456.534-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0075036", "n": "LUCIMAR ROZENDO DE MEDEIROS", "c": "###.425.044-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "0075044", "n": "LUCIENE ROZENDO DE MEDEIROS", "c": "###.619.154-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "0075061", "n": "ANNA PATRICIA DA COSTA DE SOUZA", "c": "###.538.504-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0075095", "n": "MARIA DA CONCEICAO DA SILVA NOGUEIRA", "c": "###.334.434-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0075117", "n": "MARIA DA CONCEICAO CAMPOS DE SA SILVA", "c": "###.563.994-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0075125", "n": "ELIZANGELA DE PAIVA LEITE", "c": "###.332.284-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0075133", "n": "ANA CELIA BARBOSA", "c": "###.455.374-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0075141", "n": "IVANA GOMES CAMARA DA SILVA", "c": "###.303.474-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0075160", "n": "SIMONE MARIA DO NASCIMENTO", "c": "###.576.104-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "0075176", "n": "ELIENE DE SOUZA FIRMIANO NOGUEIRA", "c": "###.377.444-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0075184", "n": "WILLIAM BARBOSA DA SILVA", "c": "###.596.354-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0075311", "n": "FATIMA MARIA MOURA DE SOUSA", "c": "###.487.184-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0075591", "n": "ROBSOM OLIVEIRA DE LIMA", "c": "###.129.504-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MANOEL DANTAS BARRETO (JACOCA)"}, {"m": "0075656", "n": "MARIA DA CONCEICAO BRITO DA COSTA", "c": "###.220.324-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0075664", "n": "AMARA PEREIRA DA SILVA", "c": "###.352.824-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0075796", "n": "JOANA MARIA FERNANDES FERREIRA", "c": "###.755.154-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0075818", "n": "ROSA MARIA DE SOUZA", "c": "###.908.764-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0075851", "n": "MARIA SIMONE DE FRANCA SILVA SANTOS", "c": "###.548.244-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0075877", "n": "MARIA DA CONCEICAO DO NASCIMENTO ALVES", "c": "###.482.494-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. JOSE VENANCIO (VARZEA DE DENTRO)"}, {"m": "0075885", "n": "GILMAR RODRIGUES DA SILVA", "c": "###.049.024-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0075893", "n": "MARIA DA CONCEICAO SEVERO DA SILVA TORRES", "c": "###.515.304-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0075915", "n": "JOSE ADALBERTO TAVARES", "c": "###.423.424-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0075923", "n": "FRANCISCA MARIA PEREIRA", "c": "###.545.204-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0075931", "n": "MARIA CELIA TORRES DA CRUZ", "c": "###.794.244-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0075966", "n": "MARIA APARECIDA DE OLIVEIRA SILVA BARBOSA", "c": "###.884.474-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0075991", "n": "MARIA DA CONCEICAO CERQUEIRA DA SILVA", "c": "###.861.824-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0076032", "n": "CLAUDIA NUNES DA SILVA ARAGAO", "c": "###.241.414-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "0076041", "n": "MARIA DAS DORES DE GOIS ALVES", "c": "###.061.124-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO/Diretor Escolar Nível III (GD)", "h": "40h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0076059", "n": "JOSIWAGNA CAMARA PESSOA", "c": "###.734.964-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0076091", "n": "MARIA EDILENE DE LIMA", "c": "###.558.924-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0076105", "n": "MARIA LINDALVA SANTANA PIMENTEL", "c": "###.417.284-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0076113", "n": "MARIA DE FATIMA BARACHO LINO", "c": "###.330.074-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0076140", "n": "CINTIA FERREIRA GOMES", "c": "###.594.464-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0076148", "n": "PAULINO ALVES DE SOUZA NETO", "c": "###.129.554-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0076156", "n": "MARIA GORETTI DOS SANTOS", "c": "###.124.834-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0076181", "n": "FRANCISCA DE ASSIS DA SILVA", "c": "###.408.394-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0076211", "n": "ELIANE GOMES DA SILVA", "c": "###.668.974-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0076261", "n": "AMANCIO SOARES DA SILVA JUNIOR", "c": "###.992.274-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0076288", "n": "FRANCISCO CANINDE FREIRE DA SILVA", "c": "###.659.914-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0076296", "n": "LUZINETE DO NASCIMENTO VICENTE", "c": "###.692.474-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0076318", "n": "ENILDA COSTA DE OLIVEIRA", "c": "###.108.734-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ARY ALECRIM PACHECO (PEDREGULHO)"}, {"m": "0076334", "n": "TACIA MARIA DE OLIVEIRA MEDEIROS", "c": "###.762.474-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0076407", "n": "RITA DE CACIA NOBERTO", "c": "###.636.954-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0076415", "n": "CELIA MARIA DA SILVA", "c": "###.403.304-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0076423", "n": "CHRISTIANY DE FATIMA RODRIGUES DE LIMA", "c": "###.611.954-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0076431", "n": "FERNANDO JUSSIEU DA SILVA", "c": "###.785.404-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "0076458", "n": "JAQUELINE BARBOSA DA SILVA", "c": "###.153.764-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0076466", "n": "SILVANEIDE DIONIZIO MOURA DA SILVA", "c": "###.122.044-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0076474", "n": "ELINETE VIEIRA BARBOSA DIAS", "c": "###.815.534-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0076482", "n": "MARIA DE FATIMA LINHARES DANTAS", "c": "###.194.584-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0076504", "n": "JOSE ROBERTO SILVA ALVES", "c": "###.105.194-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0076521", "n": "LUIZ OLIVEIRA DE ALMEIDA", "c": "###.102.434-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0076555", "n": "CECILIA MATIAS DO NASCIMENTO", "c": "###.346.514-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0076598", "n": "RUI LEMOS SOARES FILHO", "c": "###.633.264-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0076709", "n": "FRANCISCO DAS CHAGAS DA SILVA ARAUJO", "c": "###.851.804-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0076717", "n": "ELAINE CRISTINA COELHO DA COSTA", "c": "###.126.044-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0076741", "n": "MARIA DAS GRACAS OLIVEIRA DA SILVA", "c": "###.762.334-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0076777", "n": "REGINA LUCIA OLIVEIRA DA SILVA", "c": "###.954.624-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0076857", "n": "ROSEANE BARBOSA SILVA DAS FLORES", "c": "###.644.814-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0076865", "n": "MARIA DO SOCORRO DE LIMA", "c": "###.315.504-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0076873", "n": "DARILENE RODRIGUES DE SOUZA", "c": "###.360.224-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. HELENA VILAR RIBEIRO DANTAS (MINAMORA)"}, {"m": "0076881", "n": "ADAILTON ALVES DA SILVEIRA", "c": "###.137.304-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "0076954", "n": "ELIANE GOMES ELEUTERIO BARROS", "c": "###.712.904-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0076962", "n": "ELIZETE CAMARA DA SILVA ARAUJO", "c": "###.926.134-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0076971", "n": "EVANIA XAVIER DA SILVA TEIXEIRA", "c": "###.075.054-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0077063", "n": "MARIA DO ROSARIO FONSECA DOS SANTOS BYONE", "c": "###.406.664-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0077217", "n": "MARIA ADRIANA PALHARES DOS SANTOS", "c": "###.778.404-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0077314", "n": "SUELY MARIA CAMARA", "c": "###.886.934-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MANOEL DANTAS BARRETO (JACOCA)"}, {"m": "0077454", "n": "ROMILDA NASCIMENTO DE MOURA", "c": "###.809.944-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0077489", "n": "SILVANA KARLA DA SILVA GENESIO", "c": "###.785.364-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0077497", "n": "MARIA AUXILIADORA AMARAL DE FREITAS MENDES", "c": "###.546.674-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0077535", "n": "DALVANIRA RODRIGUES DA CRUZ LIMA", "c": "###.773.004-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0077642", "n": "MANOEL CARVALHO FERREIRA", "c": "###.628.004-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0077896", "n": "FRANCISCA DE OLIVEIRA RAFAEL", "c": "###.425.904-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0077918", "n": "JOSIANA MARIA DA SILVA SANTOS", "c": "###.989.134-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0078001", "n": "ANTONIA GOMES MIGUEL DE MEDEIROS", "c": "###.417.504-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0078019", "n": "CONCEICAO CEZARIA CRUZ DE PAIVA OLIVEIRA", "c": "###.564.194-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0078027", "n": "MARIA DA GLORIA FERREIRA DOS SANTOS", "c": "###.490.594-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0078035", "n": "SONEIDE CAMPOS BARBOSA DE MACEDO", "c": "###.059.174-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0078070", "n": "GILCA MARIA RODRIGUES FERREIRA", "c": "###.177.084-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0078691", "n": "MARIA LUCINEIDE RODRIGUES DA SILVA NICACIO", "c": "###.545.704-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0078737", "n": "REJANE SOARES DA SILVA OLIVEIRA", "c": "###.733.484-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0078762", "n": "MARIA SUERDA RIBEIRO DA SILVA", "c": "###.556.054-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0078861", "n": "FRANCISCO MARCIO BARBOSA DA SILVA", "c": "###.552.484-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0078923", "n": "JEANE FERREIRA DE MELO SILVA", "c": "###.791.594-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0078932", "n": "MARIA LUIZA MOREIRA RIBEIRO", "c": "###.432.414-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0078949", "n": "JAILZA RODRIGUES DE LIMA", "c": "###.694.874-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0079001", "n": "GENILSON CARLOS DA SILVA BARBOSA", "c": "###.036.654-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0079007", "n": "SIDNEY SPINOLA DE SOUZA", "c": "###.016.254-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0079032", "n": "IVETE GERMANO DE SOUZA SILVA", "c": "###.930.397-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0079058", "n": "EDSON JOSE DANTAS TORRES", "c": "###.366.854-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0079075", "n": "ISABEL MARIA NASCIMENTO PEREIRA", "c": "###.585.194-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0079075", "n": "ISABEL MARIA NASCIMENTO PEREIRA", "c": "###.585.194-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0079092", "n": "MARUSKA ROCHELLY DA LUZ SILVA", "c": "###.988.154-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0079104", "n": "PEDRO TORRES DA ROCHA", "c": "###.399.364-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0079122", "n": "SHIRLEY CABRAL LEMOS", "c": "###.567.614-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0079148", "n": "MARCELO SENA DA SILVA", "c": "###.508.844-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0079164", "n": "KATYA SUSANA DANTAS", "c": "###.079.784-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "0079172", "n": "ROSEANE NOBRE DE SOUZA DIAS", "c": "###.045.914-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0079252", "n": "CASSIANO RICARDO SANTOS DA COSTA", "c": "###.929.244-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0079310", "n": "CARLOS BEZERRA DO NASCIMENTO", "c": "###.937.004-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0079326", "n": "MARIA LUCINEIDE DE OLIVEIRA", "c": "###.658.704-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0079342", "n": "MARILEIDE FERNANDES DA SILVA", "c": "###.476.924-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0079342", "n": "MARILEIDE FERNANDES DA SILVA", "c": "###.476.924-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0079361", "n": "ROSILENE LISBOA DA COSTA SILVA", "c": "###.690.194-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0079393", "n": "MARIA DA CONCEICAO OLIVEIRA DA LUZ", "c": "###.884.814-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0079415", "n": "MARCIA MARIA DE LIMA PEREIRA", "c": "###.621.524-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0079449", "n": "CLAUDIA RODRIGUES DOS SANTOS", "c": "###.472.574-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0079474", "n": "FABIANA FERNANDES SIQUEIRA CAVALCANTI", "c": "###.875.064-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0079531", "n": "ADEIZIA KACIA MATIAS DO NASCIMENTO MACEDO", "c": "###.053.014-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0079547", "n": "MARIA DO SOCORRO SOARES NOBRE", "c": "###.379.674-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0079555", "n": "MARIA GIVANILDA DA SILVA", "c": "###.469.434-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO/Vice Diretor de Escola (CS)", "h": "40h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0079563", "n": "MARIA DA CONCEICAO PALHARES DE SOUZA", "c": "###.559.184-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0079620", "n": "ANDREIA MARIA PACHECO DE ARAUJO", "c": "###.472.304-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "0079636", "n": "RAQUEL ROCHA PACHECO", "c": "###.869.114-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "0079644", "n": "DIEGIA DAMASCENO SOBRAL", "c": "###.408.194-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0079694", "n": "JOSE WALTER FERNANDES", "c": "###.102.174-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0079695", "n": "EDVONEIDE FERNANDES DA SILVA", "c": "###.260.774-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0079717", "n": "MARILENE RIBEIRO GOMES", "c": "###.483.914-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0079742", "n": "MAGNOLIA MARIA MARQUES", "c": "###.596.184-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0079759", "n": "LUIZ ANTONIO DANTAS DA COSTA", "c": "###.943.054-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0079768", "n": "NORMA MARIA DA CONCEICAO", "c": "###.636.104-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0079806", "n": "JACIARA DE SOUZA CAMPOS", "c": "###.885.124-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0079821", "n": "ANDRE GUILHERME FERNANDES COSTA", "c": "###.750.934-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0079841", "n": "MARIA CELIA DE MELO", "c": "###.350.834-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0079849", "n": "MARIA DALVA DA SILVA", "c": "###.749.474-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0079857", "n": "MARIA BETANIA SOUTO SANTIAGO", "c": "###.830.804-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0079865", "n": "NAILMA FERNANDES DE ARAUJO SILVA", "c": "###.882.904-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0079900", "n": "ANITA PRAXEDES", "c": "###.110.544-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0079930", "n": "REGILMA DA SILVA FREITAS", "c": "###.473.014-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0079938", "n": "TANIA MARIA DA ROCHA FERNANDES", "c": "###.206.094-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0079989", "n": "EWERTON LUCIANO SILVA SOBRAL", "c": "###.312.804-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0079997", "n": "ZILMA FERREIRA DA COSTA SANTOS SILVA", "c": "###.167.664-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0082335", "n": "RUBIANA DO NASCIMENTO FERREIRA", "c": "###.556.154-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0088342", "n": "ROCHELINE SILVA DE PAIVA", "c": "###.791.924-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0089631", "n": "MAGNA MARIA BARBOSA BRANDAO", "c": "###.898.074-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0090002", "n": "MARIA MARGARETE DE MELO", "c": "###.942.475-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0090020", "n": "ELIDIANE COELHO DA COSTA", "c": "###.669.454-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0090751", "n": "LAERCIO DE SOUZA SOARES JUNIOR", "c": "###.802.124-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0093130", "n": "FERNANDA LIMA DA CAMARA", "c": "###.116.424-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "0093629", "n": "ADRIANA OLIVEIRA DOS SANTOS", "c": "###.050.134-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0093785", "n": "JOSENILDO DE FREITAS", "c": "###.965.894-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0094530", "n": "DERLLY JANS CAVALCANTE DA SILVA LIMA", "c": "###.537.414-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0094651", "n": "IRANILMA LIMA DE ANDRADE", "c": "###.719.564-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. CONCEICAO MARQUES (RIO DOS INDIOS)"}, {"m": "0110663", "n": "LUIZ ANTONIO TEIXEIRA DA SILVA", "c": "###.148.954-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "0111252", "n": "MADSON ALEX DE SOUZA ASSIS", "c": "###.507.964-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0910570", "n": "FLAVIA KATHEINNY COUTINHO FERNANDES", "c": "###.235.084-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0910600", "n": "MARIA SILDETE DE FRANCA SILVA", "c": "###.889.454-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0910619", "n": "ARIANNE RAYLA PEREIRA NERI", "c": "###.025.664-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. FRANCISCO DE ASSIS SANTANA"}, {"m": "0910902", "n": "MARIA DA CONCEICAO FELIX MARTINS DE BRITO", "c": "###.450.104-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0911674", "n": "FRUTUOSO MARTINS DE OLIVEIRA NETO", "c": "###.151.514-##", "g": "C - PROFESSOR DE MATEMATICA", "h": "25h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0911682", "n": "DAMIAO MASSENA DE SOUZA", "c": "###.849.674-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0911739", "n": "LUCIANA RODRIGUES DE LIMA", "c": "###.967.574-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0911879", "n": "MARIANA LUIZA SANTIAGO", "c": "###.417.414-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. ARY ALECRIM PACHECO (PEDREGULHO)"}, {"m": "0911976", "n": "ANTONIO ANSELMO DA SILVA NETO", "c": "###.761.104-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0912107", "n": "RONILSON FERREIRA VIRGINIO", "c": "###.017.474-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "0912166", "n": "MARIA DAS DORES NICACIO PINHEIRO", "c": "###.257.714-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "0912174", "n": "FABIO ALEXANDRE SILVA DO NASCIMENTO", "c": "###.585.714-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0912212", "n": "TATIANA TEODORO PEREIRA", "c": "###.694.994-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "0912298", "n": "LUIZ FLAVIO MARTINS DE LIMA", "c": "###.688.314-##", "g": "C - PROFESSOR DE LINGUA INGLESA", "h": "25h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "0912476", "n": "SHYGEAK SERGIO DE SOUZA SILVA", "c": "###.863.014-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0912492", "n": "FABIANA DE FREITAS LEANDRO SILVA", "c": "###.794.594-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0912557", "n": "JARLIANE GOMES", "c": "###.743.664-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MANOEL DANTAS BARRETO (JACOCA)"}, {"m": "0912735", "n": "ROSE MEIRE LOURENCO TEIXEIRA DA FONSECA", "c": "###.905.214-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "0912743", "n": "VELUCIA NASCIMENTO DE ARAUJO", "c": "###.233.714-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0912832", "n": "LUCI ROZENDO DE MEDEIROS", "c": "###.946.174-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "0912972", "n": "EMANUEL DA SILVA FERREIRA PRAXEDES", "c": "###.556.824-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0913090", "n": "FLAVIA JULIANA LUCAS DA CRUZ", "c": "###.616.194-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0913120", "n": "MARIA CONCEICAO BEZERRA FERREIRA", "c": "###.088.324-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. FRANCISCO DE ASSIS SANTANA"}, {"m": "0913294", "n": "ADRIANA VARELA DA SILVA SOUZA", "c": "###.111.174-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ROTARY"}, {"m": "0913472", "n": "ANA PAULA LOLO DA SILVA FREITAS", "c": "###.438.044-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0913618", "n": "MARIA APARECIDA GERONIMO DE LIMA", "c": "###.683.374-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0913812", "n": "SILVETE VITAL DE OLIVEIRA", "c": "###.705.774-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0913901", "n": "ELIUDE MARIA LINS DE LIMA", "c": "###.069.424-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0914037", "n": "ANGELA MARIA SOUSA DE OLIVEIRA", "c": "###.701.264-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0914487", "n": "JARDENIA PATRICIA NASCIMENTO DA SILVA ASSUNCAO", "c": "###.090.574-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0914649", "n": "MARIA DE FATIMA FELIX MARTINS NOBRE", "c": "###.355.064-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0914690", "n": "ZANNIELA KARENINY CAMPOS DE MELO LINS", "c": "###.842.214-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0914827", "n": "TAZIANA ESTEVAM PIMENTEL", "c": "###.069.434-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0914886", "n": "MARIA AUXILIADORA DE SOUZA SILVA", "c": "###.276.074-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. MENINO JESUS"}, {"m": "0914894", "n": "VANESSA FERNANDES DA COSTA", "c": "###.096.874-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0915220", "n": "FERNANDA ARAUJO SILVA DA ROCHA", "c": "###.138.544-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0915246", "n": "KEYLA PINHEIRO DE LIMA DANTAS", "c": "###.489.764-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0915319", "n": "ELIANE DIAS DE OLIVEIRA SILVA", "c": "###.475.704-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0915475", "n": "IZABEL CRISTINA LOPES DE SOUZA", "c": "###.561.414-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0915475", "n": "IZABEL CRISTINA LOPES DE SOUZA", "c": "###.561.414-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0915866", "n": "DEYSE RAPHAELY CHAGAS DE MELO", "c": "###.506.464-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0915971", "n": "ERIKA CAMARA RIBEIRO", "c": "###.808.324-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0916005", "n": "RAFAELA BEZERRA ESTEVAM DE LIMA", "c": "###.778.404-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0916013", "n": "ANA RAQUEL PALHANO DE OLIVEIRA SILVA", "c": "###.684.044-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0916110", "n": "REGIA MARIA ROCHA DE LIMA", "c": "###.820.584-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0916137", "n": "ELIZILANTE BEZERRA NASCIMENTO", "c": "###.702.354-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0916714", "n": "RUBENS DA SILVA", "c": "###.012.294-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0916730", "n": "ADRIANA SALES DA SILVA", "c": "###.748.834-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0918016", "n": "IVONEIDE DE ALMEIDA DANTAS AZEVEDO", "c": "###.463.664-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0918024", "n": "JOAO MARIA DOS SANTOS SILVA", "c": "###.421.644-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0918032", "n": "JUNIOR DA SILVA BARBOSA", "c": "###.153.824-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0918040", "n": "MARIA DO SOCORRO GARCIA DE FIGUEIREDO", "c": "###.282.564-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0918067", "n": "BRUNO ANTUNES FERREIRA DE QUEIROZ", "c": "###.535.704-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "0918075", "n": "SARA REGINA DE LIMA BATISTA", "c": "###.750.104-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0918083", "n": "ANA GARCIA DE FIGUEIREDO", "c": "###.281.674-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0918113", "n": "JOSYMEIRE DA SILVA SILVEIRA", "c": "###.883.284-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0918121", "n": "FRANCISCA MARLIETE DA SILVA", "c": "###.357.994-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0918156", "n": "MARIA CLIVANDIR LEITE SILVA", "c": "###.696.254-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0918172", "n": "MARIA DAS GRACAS ANSELMO E SILVA", "c": "###.218.944-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0918210", "n": "ELIZANGELA XAVIER LEITE PEREIRA", "c": "###.141.304-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0918237", "n": "ILZA CLEMENTE DA SILVA", "c": "###.698.194-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "0918270", "n": "ROSA MARIA DE MELO CAMPOS", "c": "###.885.104-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0918318", "n": "CLETO BELO SOARES JUNIOR", "c": "###.076.934-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0918334", "n": "SIMONE CLEMENTE DE SOUZA", "c": "###.935.154-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0918385", "n": "PRICILA SILVA DOS SANTOS", "c": "###.226.704-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0918393", "n": "IATAGAM RIBEIRO RODRIGUES", "c": "###.877.344-##", "g": "PROFESSOR DE ARTES - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0918636", "n": "ALCIONE LIMA DA SILVA", "c": "###.558.274-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MANOEL DANTAS BARRETO (JACOCA)"}, {"m": "0927252", "n": "MARIA JOSE DA SILVA", "c": "###.728.544-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0927317", "n": "MARCILAINE DOS SANTOS TAVARES", "c": "###.528.984-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0927430", "n": "FELIPE FRANCISCO DO NASCIMENTO", "c": "###.831.304-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0927449", "n": "MARIA JOSE DA SILVA PAULO", "c": "###.324.884-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0927457", "n": "AVANEIDE MARTILIANO DUVAL DE SOUZA", "c": "###.610.274-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0927465", "n": "FRANCINEIDE FERREIRA DE MORAIS", "c": "###.795.454-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0927473", "n": "PAULO JOSE DA ROCHA NETO", "c": "###.610.794-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0927481", "n": "MICHELLE APARECIDA DA SILVA PONTES", "c": "###.601.764-##", "g": "PROFESSOR EDUCAÇÃO INFANTIL - MAGISTERIO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0927511", "n": "ADRIANA MARIA RAMOS VARELA CAVALCANTI SOUTO", "c": "###.685.074-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0927520", "n": "ALBERTINA DE LIMA SILVA", "c": "###.253.694-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0927538", "n": "JAIRO ALVES DE SOUZA", "c": "###.848.734-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0927546", "n": "JANIANE NASCIMENTO DE SOUZA", "c": "###.379.654-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0927562", "n": "ALDEZIA GOMES DA SILVA", "c": "###.168.374-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0927589", "n": "MARIA LINDONEIDE DA SILVA", "c": "###.768.254-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0927619", "n": "ELDA DE ANDRADE SOUZA", "c": "###.126.104-##", "g": "PROFESSOR EDUCAÇÃO INFANTIL - MAGISTERIO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0927627", "n": "SAMAYA FAGUNDES DA CRUZ FREITAS", "c": "###.611.454-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0927635", "n": "PORFIRIA DANTAS DE ARAUJO MEDEIROS", "c": "###.908.484-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0927660", "n": "DALVANICE MARQUES DA SILVA MACEDO", "c": "###.917.244-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0927937", "n": "RAIMUNDO CARVALHO DE QUEIROZ NETO", "c": "###.100.244-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0927945", "n": "MARIA LUCIA DA SILVA BEZERRA", "c": "###.034.094-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0927953", "n": "ELIENE RODRIGUES ONOFRE", "c": "###.805.064-##", "g": "PROFESSOR EDUCAÇÃO INFANTIL - MAGISTERIO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0927988", "n": "WOBJAKSON SOARES DOS SANTOS", "c": "###.281.594-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0927996", "n": "ALEIDE FRANCA DOS RAMOS MARTINS", "c": "###.610.124-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0928160", "n": "JOSE HITALO SANTANA", "c": "###.133.194-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0928208", "n": "SAMARA OLIVEIRA DE ALMEIDA", "c": "###.870.587-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0928437", "n": "MARIA DA CONCEICAO TAVARES DE OLIVEIRA NEVES", "c": "###.982.824-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0928470", "n": "CAZILMA BATISTA PALHARES", "c": "###.993.804-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0928500", "n": "CARLOS CESAR DE ARAUJO", "c": "###.589.114-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0928623", "n": "SARA TATIANE TAVARES BARRETO", "c": "###.572.484-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "0929816", "n": "MARTA DE MEDEIROS ARAUJO", "c": "###.497.304-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0932272", "n": "INGRID RESENDE DE BRITO", "c": "###.201.204-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "0933040", "n": "AMANDA CLEMENTE DA SILVA COSTA", "c": "###.888.894-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "0933198", "n": "RENATA MORAIS DO NASCIMENTO", "c": "###.981.244-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0934143", "n": "VALDIANA NAZARIO DA SILVA", "c": "###.821.957-##", "g": "C - PROFESSOR DE MATEMATICA", "h": "25h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0934178", "n": "RUTENIA REGINALDO DA TRINDADE", "c": "###.831.404-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUA)"}, {"m": "0934232", "n": "RAFAELA DA SILVA FERREIRA", "c": "###.805.644-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0935093", "n": "ITANILMA MARIA MARTINS", "c": "###.552.474-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0939781", "n": "DOUGLAS ALEXANDRE DO NASCIMENTO", "c": "###.325.344-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª ALZIRA DE SA PEREIRA (PROJ. SANTA AGUEDA)"}, {"m": "0940461", "n": "PATRICIA VIEIRA DE SENA", "c": "###.693.634-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0940828", "n": "LILIANA DO NASCIMENTO LOURENÇO", "c": "###.922.224-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0941689", "n": "MICHAEL DOUGLAS ARAUJO FERNANDES", "c": "###.765.874-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0941905", "n": "RAI LIMA DA SILVA", "c": "###.523.614-##", "g": "C - PROFESSOR DE CIENCIAS", "h": "25h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0942197", "n": "MICHELLINE SIQUEIRA JERONIMO", "c": "###.296.684-##", "g": "C - PROFESSOR DE HISTORIA", "h": "25h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0945277", "n": "FERNANDA GRAZIELLA DE ARAUJO", "c": "###.812.584-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "0945285", "n": "JOAO PAULO DE ALBUQUERQUE SIQUEIRA SILVA", "c": "###.794.474-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0945293", "n": "LILIA LETICIA FERREIRA DA SILVA", "c": "###.094.164-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0945315", "n": "LEONARDO MEDEIROS DA SILVA", "c": "###.546.804-##", "g": "PROFESSOR DE ARTES - SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0945323", "n": "JUCAA KLOSOUSKI DE ALMEIDA", "c": "###.316.604-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0945331", "n": "ANA LUIZA OLIVEIRA DANTAS", "c": "###.695.874-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0945340", "n": "ADRIEL APARECIDO DANTAS DE SOUZA", "c": "###.524.824-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0945358", "n": "JUCILENE FERREIRA DO NASCIMENTO SILVA DE MELO", "c": "###.039.324-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0945366", "n": "RAISSA ELIZABETH DE CASTRO MAGALHAES", "c": "###.854.794-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0945374", "n": "RENATA PAIVA DE SOUSA SARAIVA VARELA", "c": "###.895.234-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0945382", "n": "RITA DE CASSIA DOS SANTOS LOPES", "c": "###.645.663-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "0945390", "n": "PAMELA KALINE ANDRADE BARBALHO LIRA", "c": "###.242.924-##", "g": "PROFESSOR DE ARTES - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0945412", "n": "ROBERTO CARLOS BARBOZA FERNANDES", "c": "###.588.494-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0945420", "n": "RICELLI CORREIA DOS SANTOS", "c": "###.860.254-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "0945439", "n": "ANA KARLA DE ARAUJO TEIXEIRA", "c": "###.245.684-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ALZIRA DE SA PEREIRA (PROJ. SANTA AGUEDA)"}, {"m": "0945455", "n": "THAYNA DE CARVALHO FERREIRA", "c": "###.506.244-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0945463", "n": "LAURA BEATRIZ PEIXOTO PAIVA", "c": "###.601.094-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "0945480", "n": "ANA PAULA MEDEIROS DA SILVA", "c": "###.403.424-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "0945501", "n": "NEIRIVAN BATISTA SOARES", "c": "###.512.504-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0945510", "n": "RENATO CESAR DE SOUZA BEZERRA", "c": "###.860.804-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0945536", "n": "DANIEL SOUZA DA CRUZ", "c": "###.499.364-##", "g": "PROFESSOR DE ARTES - SUPERIOR", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "0945560", "n": "YARA CAMILA MACEDO LOPES", "c": "###.444.634-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0945579", "n": "ANDSON JOSE MALAQUIAS TORRES", "c": "###.001.024-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0945587", "n": "LEOTO BARBOSA DE SOUSA", "c": "###.513.704-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0945617", "n": "JOBSON DA SILVA FERREIRA", "c": "###.120.534-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0945625", "n": "MARIA BEATRIZ RUFINO CARNEIRO CALAÇA", "c": "###.700.184-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. PROFª MARIA DE LOURDES FERREIRA DO NASCIMENTO (PRIMEIRA LAGOA)"}, {"m": "0945633", "n": "OZIEL NASCIMENTO MARQUES", "c": "###.564.814-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0945641", "n": "PRISCYLLA MARIA FIRMINO DE LIMA", "c": "###.535.634-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0945650", "n": "FRANCISCO VALDECIO DE MELO BEZERRA", "c": "###.130.444-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "0945676", "n": "FRANCISCO BATISTA CAVALCANTE NETO", "c": "###.751.754-##", "g": "PROFESSOR DE ENSINO RELIGIOSO - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0945706", "n": "FABRICIO JUNIOR DA SILVA MOURA", "c": "###.120.044-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0945714", "n": "PATRICIA KELLY DA SILVA ROCHA", "c": "###.126.444-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0945722", "n": "DEBORA INGRID DA COSTA NASCIMENTO RIFAUSTO", "c": "###.667.214-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0945730", "n": "ALDAIR CORDEIRO DA SILVA", "c": "###.386.134-##", "g": "PROFESSOR DE ARTES - SUPERIOR", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0945765", "n": "MARIA HELENA MENDES DE LIMA MARTINS", "c": "###.557.674-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0945773", "n": "ALINE MACIEL SANTOS", "c": "###.476.824-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0945781", "n": "INGRID DA SILVA FERREIRA", "c": "###.326.864-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "0945790", "n": "YURIANE KALINE FREITAS DE OLIVEIRA FREIRE", "c": "###.600.174-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0945803", "n": "MARIA JUSSARA CRUZ DA SILVA", "c": "###.271.184-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0945820", "n": "MARCELLY IDALINA LEITE RODRIGUES RAMOS", "c": "###.088.007-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0945838", "n": "FERNANDO COSTA GOMES", "c": "###.246.114-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0945846", "n": "SOLANGE MARIA MIRANDA FERNANDES DE ATAIDE", "c": "###.993.394-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0945854", "n": "MARIA DAS DORES MACIEL VASCONCELOS VALDIVINO", "c": "###.148.014-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0945862", "n": "JOSEILSON GOMES FARIAS", "c": "###.848.014-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUA)"}, {"m": "0945897", "n": "JANAINA FERNANDES PINHEIRO", "c": "###.857.024-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0945919", "n": "LARISSA FRANCA FERREIRA", "c": "###.471.024-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0945927", "n": "WEDSLEY WANDERLY SILVA MELO", "c": "###.205.114-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0945943", "n": "AMANDA CRISTINA SILVA DOS SANTOS", "c": "###.338.114-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0945951", "n": "NAYRENE DA COSTA DE OLIVEIRA", "c": "###.178.384-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0946745", "n": "JEDIEL LUCAS DE OLIVEIRA DANTAS", "c": "###.824.444-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0946753", "n": "JUSSARA SOARES DE LIMA MIRANDA DA SILVA", "c": "###.990.964-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0946770", "n": "EUDSON FERREIRA DA SILVA", "c": "###.040.834-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0946788", "n": "JESSICA ALEXINA ALVES DO NASCIMENTO", "c": "###.726.034-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "0946788", "n": "JESSICA ALEXINA ALVES DO NASCIMENTO", "c": "###.726.034-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0946818", "n": "FELIPE FRANCA DE MELO", "c": "###.620.884-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0946826", "n": "ROBERT CHARLES DE OLIVEIRA", "c": "###.382.574-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0946842", "n": "MARIA ESTELA DOS SANTOS LIRA", "c": "###.993.428-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0946869", "n": "DANIEL SILVA DESCHAMPS PINTO", "c": "###.482.094-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0946877", "n": "DANIELE LORENA GOMES", "c": "###.108.964-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0946885", "n": "LUANA NASCIMENTO DOS SANTOS", "c": "###.198.774-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0946893", "n": "WILLIAN WALLACE GOMES DE OLIVEIRA", "c": "###.054.644-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "0946923", "n": "JOSHUA DAVINCI NUNES ROCHA", "c": "###.933.114-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0946931", "n": "ARTHUR ANTONIO ZUZA ALVES", "c": "###.018.224-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0946974", "n": "JENNIFER KATARINA MIRANDA DA SILVA", "c": "###.469.174-##", "g": "PROFESSOR DE ARTES - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0946982", "n": "CAMILLA DANIELLY SILVA DAS NEVES", "c": "###.467.684-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0946990", "n": "PABLO PEREIRA DE OLIVEIRA", "c": "###.024.164-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "0947032", "n": "BONIFACIO HENRIQUE DOS SANTOS NETO", "c": "###.685.254-##", "g": "PROFESSOR DE ENSINO RELIGIOSO - SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0947059", "n": "JADSON SILVA DANTAS", "c": "###.529.524-##", "g": "PROFESSOR DE ENSINO RELIGIOSO - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0948179", "n": "LUAN HENRIQUE GOMES DA SILVA", "c": "###.733.544-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0949450", "n": "YASMENIA EVELYN MONTEIRO DE BARROS", "c": "###.496.964-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "0949868", "n": "ISABELLE MARIA GOMES RIBEIRO", "c": "###.392.954-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "0949892", "n": "ALVARO RAMON SOUTO OLIVEIRA", "c": "###.732.664-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "0949906", "n": "GEOVANINO GEONI PEREIRA LIMA", "c": "###.777.654-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0950106", "n": "GILIANA DE SOUZA LUCAS ANDRADE", "c": "###.580.344-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0950238", "n": "ALANA APRIGIO DA SILVA", "c": "###.982.154-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0950270", "n": "MILENA FERNANDA LOPES DE SOUZA", "c": "###.362.984-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0950297", "n": "GERLAIMA ALVES DE OLIVEIRA MEDEIROS", "c": "###.118.184-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0950300", "n": "ALAIDE ANGELICA DE MENEZES CABRAL CARVALHO", "c": "###.189.774-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª BELARMINA CAMPOS (LOGRADOURO)"}, {"m": "0950319", "n": "ERIC INACIO DE MEDEIROS", "c": "###.568.514-##", "g": "PROFESSOR DE ARTES - SUPERIOR", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "0950386", "n": "EXPEDITA KETSIA ALVES BARBOZA DE OLIVEIRA", "c": "###.407.114-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. ROTARY"}, {"m": "0950408", "n": "GIOVANNI ROBERTO PROTASIO BENTES FILHO", "c": "###.187.984-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0950556", "n": "KILVIA KALIDIA SALES DE LIMA", "c": "###.358.634-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0950980", "n": "FABIANA COELHO DE OLIVEIRA NASCIMENTO", "c": "###.630.954-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "0951021", "n": "VALERIA GOMES DA SILVA", "c": "###.578.694-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0951129", "n": "ALINE RAFAELA LOPES DA SILVA CARNEIRO", "c": "###.199.034-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFª BELARMINA CAMPOS (LOGRADOURO)"}, {"m": "0951145", "n": "ANA BEATRIZ SANTANA ALVES", "c": "###.223.574-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "0951188", "n": "ELIZANGELA MARIA DE LEMOS PADRE", "c": "###.529.294-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0951250", "n": "MARCOS ANTONIO VICTOR DE ARAUJO", "c": "###.530.494-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0951269", "n": "DIANA FARIAS OLIVEIRA", "c": "###.647.994-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0951277", "n": "HERTA CAMILA DA SILVA CABRAL", "c": "###.257.184-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MANOEL DANTAS BARRETO (JACOCA)"}, {"m": "0951595", "n": "PAULO ROBERTO PAULINO DO NASCIMENTO", "c": "###.172.764-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0951609", "n": "CLARISSE CAROLINE DE OLIVEIRA E SILVA", "c": "###.951.614-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "0951846", "n": "JOSILENE FERREIRA DE LIMA SOARES", "c": "###.093.644-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0951900", "n": "MARIA LUCICLEIDE VARELA SOUZA DE OLIVEIRA", "c": "###.250.154-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "0952044", "n": "RITA DE CASSIA DA SILVA", "c": "###.805.334-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0952222", "n": "MELANIA PEREIRA DE ANDRADE", "c": "###.854.764-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "0952230", "n": "SARAH RUTH ALVES DA SILVA", "c": "###.221.474-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "0952249", "n": "JOSEMAR NICACIO DA SILVEIRA", "c": "###.678.714-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0952257", "n": "JANIELLE THALITA DE OLIVEIRA MARTINS", "c": "###.614.174-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0952265", "n": "DAYANA FERREIRA DE FRANCA", "c": "###.416.764-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0952273", "n": "PEDRO ARTHUR DE SOUZA GOMES", "c": "###.807.134-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "0952281", "n": "MICAEL RAMON CABRAL DA SILVA", "c": "###.966.794-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0952346", "n": "LEIMOS CAMPOS SANTOS", "c": "###.129.634-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "0953288", "n": "ALINE DE SOUSA ARAUJO BELO", "c": "###.408.934-##", "g": "PROFESSOR - CEDIDO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "0953709", "n": "ANA PAULA ALVES DE OLIVEIRA", "c": "###.164.054-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. MONSENHOR RUY MIRANDA (PROJETO SANTA AGUEDA)"}, {"m": "0953717", "n": "IONEIDE MARCIA DA SILVA", "c": "###.532.594-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. JOAQUIM FERNANDES SOBRAL (TABUAO)"}, {"m": "0953725", "n": "MARCIA COSTA SILVA", "c": "###.144.444-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "0953741", "n": "ROSEANE DOS SANTOS SILVA DO NASCIMENTO", "c": "###.127.684-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUA)"}, {"m": "0953750", "n": "MICARLA RAMOS DA SILVA", "c": "###.071.744-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "0953768", "n": "CIBELLY LOURENÇO DE MEDEIROS", "c": "###.188.994-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "0953776", "n": "SHIRLLEY CRISTINA PINTO DOS SANTOS ALVES", "c": "###.145.944-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0953792", "n": "SIMONE SHIRLEY DIAS GABRIEL", "c": "###.087.484-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ROTARY"}, {"m": "0953806", "n": "TAMIRES DOS SANTOS LIMA", "c": "###.520.584-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "0953830", "n": "ARTHUR FELIPE LIMA FREITAS", "c": "###.014.214-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "0953849", "n": "IDAIANY KEILA DA SILVA ROCHA", "c": "###.744.094-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ROTARY"}, {"m": "0953865", "n": "ALIDIAN DANIELLE DA SILVA FERREIRA", "c": "###.109.364-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "0953873", "n": "KELLY APARECIDA DA SILVA FREIRE", "c": "###.967.174-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ROTARY"}, {"m": "0953881", "n": "EDNAZIA DA CRUZ GOMES", "c": "###.801.074-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. PROFª MARIA DE LOURDES FERREIRA DO NASCIMENTO (PRIMEIRA LAGOA)"}, {"m": "0954039", "n": "MARIA ALICE NICACIO EVANGELISTA", "c": "###.220.174-##", "g": "C - PROFESSOR DE HISTORIA", "h": "25h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0954950", "n": "GEILZA DE LIMA ABDIAS DA SILVA", "c": "###.466.954-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "0954969", "n": "BIANCA GISELE PINHEIRO DO NASCIMENTO", "c": "###.777.234-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0954977", "n": "JOSE GABRIEL SILVA DA FONSECA", "c": "###.233.234-##", "g": "PROFESSOR DE ENSINO RELIGIOSO - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0955167", "n": "ANA ELZA DE MOURA", "c": "###.944.824-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0955175", "n": "KALYANE KARINE CALDAS DANTAS DA SILVA", "c": "###.221.064-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "0955191", "n": "ANGELICA FIRMINO CAVALCANTI DO NASCIMENTO", "c": "###.176.104-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. JOAQUIM FERNANDES SOBRAL (TABUAO)"}, {"m": "0955264", "n": "MARIA CLARA GOMES DO NASCIMENTO", "c": "###.273.144-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0955396", "n": "KATIA PATRICIA GOMES DA SILVA", "c": "###.602.754-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0955400", "n": "GILNEIMAR FRANCISCO DIAS PEREIRA", "c": "###.851.964-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0955434", "n": "JARSON DOS SANTOS ARAUJO", "c": "###.823.454-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "0955442", "n": "NAYARA PATRICIA LOURENCO DE MACEDO CAVALCANTI", "c": "###.767.244-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "0956015", "n": "CLENIA WISLLENE FERREIRA DE LIRA MEDEIROS", "c": "###.842.764-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0956023", "n": "EVYA ELIZABETH LINS DE LIMA SILVA", "c": "###.178.104-##", "g": "C - PROFESSOR DE LINGUA PORTUGUESA", "h": "25h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "0956031", "n": "LARISSA GLEISSE DO NASCIMENTO SILVA CORTEZ GOMES", "c": "###.439.604-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "0956260", "n": "ALEXANDRE PEREIRA DA SILVA", "c": "###.105.564-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0956600", "n": "MONIQUE ANDRADE MORAIS", "c": "###.840.364-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0956732", "n": "KACIA MARIA DA SILVA ALVES", "c": "###.933.114-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "0956830", "n": "IVANISE FRANCA NASCIMENTO REVOREDO", "c": "###.603.174-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "0957135", "n": "JOSE RICARDO PAULO DE LIMA", "c": "###.614.564-##", "g": "C - PROFESSOR DE HISTORIA", "h": "25h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "0957283", "n": "SHELLYMARA SOUZA TAVARES DE OLIVEIRA", "c": "###.612.864-##", "g": "C - PROFESSOR DE MATEMATICA", "h": "25h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0957313", "n": "ALINNE MAYARA SILVA DE MACEDO COSTA", "c": "###.969.234-##", "g": "C - PROFESSOR DE MATEMATICA", "h": "25h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "0957372", "n": "VICTOR BEZERRA MENDES", "c": "###.362.604-##", "g": "C - PROFESSOR DE EDUCAÇÃO FISICA", "h": "25h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0957704", "n": "JOSENILDO VICENTE DA SILVA", "c": "###.383.184-##", "g": "C - PROFESSOR DE MATEMATICA", "h": "25h", "l": "E.M. HELENA VILAR RIBEIRO DANTAS (MINAMORA)"}, {"m": "0957887", "n": "RAFAELA MEIRELES OLIVEIRA DE MEDEIROS", "c": "###.282.564-##", "g": "C - PROFESSOR DE LINGUA PORTUGUESA", "h": "25h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "0957933", "n": "BRENDA RAISSE DA SILVA MORAIS", "c": "###.947.014-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "0957941", "n": "DANNIEL CHRISTIAN ULRICH", "c": "###.967.876-##", "g": "C - PROFESSOR DE HISTORIA", "h": "25h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "0958093", "n": "MARIA DE LOURDES DA COSTA MELO", "c": "###.855.394-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "0958107", "n": "ADEIZA DE MOURA GOMES", "c": "###.630.314-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "9288133", "n": "ANA WILMA SILVA DOS SANTOS", "c": "###.947.474-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9288158", "n": "SANZYA KARLA DE LIMA LIRA DE ARAUJO", "c": "###.952.454-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9288173", "n": "FERNANDA DO NASCIMENTO PEREIRA DE SOUZA", "c": "###.236.564-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9288182", "n": "HELICARLA NYELY BATISTA DE MORAIS", "c": "###.600.654-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR - PÓS GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9288190", "n": "MARCOS ANTONIO GOMES DA COSTA", "c": "###.463.764-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "9288194", "n": "ADEILMA DA CONCEICAO FELIX", "c": "###.530.284-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9288225", "n": "GILDEANE FERREIRA DO NASCIMENTO", "c": "###.045.424-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "9288226", "n": "MARIA JOSE LIMA DA SILVA", "c": "###.886.784-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9288237", "n": "MIZIARA PAULINO DE SOUZA", "c": "###.884.904-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUA)"}, {"m": "9288242", "n": "ADEIZA FERNANDES DE SOUZA COSTA", "c": "###.385.254-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "9288243", "n": "BARBARA NUNES", "c": "###.246.214-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "9288245", "n": "FABIO GOMES DA SILVA", "c": "###.616.124-##", "g": "C - PROFESSOR DE LINGUA PORTUGUESA", "h": "25h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9288265", "n": "ANA MARIA DE SOUZA BANDEIRA", "c": "###.448.884-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9288270", "n": "MARCIA ARRUDA CAMARA", "c": "###.787.618-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9288281", "n": "JACQUELINE ANDRADE DOS SANTOS", "c": "###.157.894-##", "g": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9288285", "n": "ERILVA GOMES LEITE", "c": "###.630.774-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "9288286", "n": "CRISTIANE LUIZ DE SOUZA CAMARA", "c": "###.755.754-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9288345", "n": "CRISTIANA ALVES SOARES", "c": "###.756.424-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "9288457", "n": "ADRIANA DE SOUSA MARANHAO", "c": "###.952.374-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9289062", "n": "JUCIARA RAFAEL LUIZ", "c": "###.634.964-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9289070", "n": "KARLA CRISTINA OLIVEIRA DA SILVA", "c": "###.910.874-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9289100", "n": "MARIA CELIA SILVA LOPES", "c": "###.630.814-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "9289160", "n": "RICARDO GOMES FERREIRA", "c": "###.448.504-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "9289364", "n": "VANESSA MELLO PEREIRA", "c": "###.293.154-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. CONCEICAO MARQUES (RIO DOS INDIOS)"}, {"m": "9289445", "n": "ANDRE FREIRE DA SILVA", "c": "###.366.044-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9289569", "n": "MARIA RAQUEL COSTA DE ARAUJO", "c": "###.027.324-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUA)"}, {"m": "9289585", "n": "RENATA ROGERIA DO NASCIMENTO OLIVEIRA", "c": "###.089.244-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9289666", "n": "LILIAN RODRIGUES DE SOUZA", "c": "###.652.338-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. HELENA VILAR RIBEIRO DANTAS (MINAMORA)"}, {"m": "9289798", "n": "ADINA NEIDE DOS SANTOS BRITO", "c": "###.338.044-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "9289801", "n": "INGRID SANTOS DE LIMA SILVA", "c": "###.233.834-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "9290923", "n": "JOVANICE LOPES DA SILVA MACHADO", "c": "###.608.944-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9291253", "n": "ANAIDE OLIVEIRA DA SILVA", "c": "###.237.654-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "9291512", "n": "MARIA VÂNIA XAVIER DA CUNHA", "c": "###.100.904-##", "g": "PROFESSOR NIVEL SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9291873", "n": "JOÃO PAULO SANTOS DE MACEDO", "c": "###.705.674-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "9292187", "n": "MARIA JOSIANE SILVA DE ANDRADE", "c": "###.371.754-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9292748", "n": "ELIANE DE CASTRO CABRAL", "c": "###.189.164-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ARY ALECRIM PACHECO (PEDREGULHO)"}, {"m": "9292756", "n": "ADEMILTON DUARTE DA SILVA", "c": "###.145.654-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "9292756", "n": "ADEMILTON DUARTE DA SILVA", "c": "###.145.654-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "9292837", "n": "GILDEZIA MARIA DE SOUZA", "c": "###.554.364-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9293051", "n": "MARIA ELIZANGELA GOMES DO NASCIMENTO", "c": "###.982.484-##", "g": "C - PROFESSOR DE LINGUA PORTUGUESA", "h": "25h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9293086", "n": "RUANA MARLA CAMARA ANTUNES FERREIRA", "c": "###.704.534-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9293108", "n": "MANOEL FELIPE DA SILVA", "c": "###.310.654-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9293248", "n": "SUELY DE OLIVEIRA LOPES", "c": "###.349.244-##", "g": "PROFESSOR NIVEL - MAGISTERIO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9293264", "n": "DALVACY DA COSTA ALVES DE SOUZA", "c": "###.031.794-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "9293280", "n": "LIDIA DA COSTA GOMES", "c": "###.440.334-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9293825", "n": "LUCAS CAMPELO DE MACEDO ARAUJO", "c": "###.879.854-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ROTARY"}, {"m": "9294155", "n": "DALYANA OLIVEIRA DE MORAIS TAVARES", "c": "###.821.014-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9294163", "n": "LEILMA SILVA DE SOUZA", "c": "###.306.294-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "9295747", "n": "RILDENE FAUSTINO DOS SANTOS", "c": "###.504.924-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. SEVERINO PINHEIRO DA SILVA (MINEIRO)"}, {"m": "9296980", "n": "ELIZANGELA DA COSTA PEREIRA", "c": "###.662.334-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9297138", "n": "AGDA CHRISTINA DA SILVA SANTOS", "c": "###.969.424-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9297278", "n": "THIAGO FELIPE MAIA LISBOA", "c": "###.222.434-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9297626", "n": "TIAGO DE MACEDO LEITE TRINDADE", "c": "###.968.584-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "9297740", "n": "LIDIANE FERREIRA DO ROSÁRIO SILVA", "c": "###.517.854-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. CONCEICAO MARQUES (RIO DOS INDIOS)"}, {"m": "9299785", "n": "JORDAN CASTRO DA SILVA", "c": "###.966.804-##", "g": "C - PROFESSOR DE EDUCAÇÃO FISICA", "h": "25h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9300015", "n": "JEANE KARLA DE MELO PEREIRA", "c": "###.507.094-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9300147", "n": "MATHEUS FREITAS DE SOUZA", "c": "###.282.934-##", "g": "C - PROFESSOR DE EDUCAÇÃO FISICA", "h": "25h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9300821", "n": "JESSICA LIRA DA SILVA", "c": "###.730.464-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9301119", "n": "ANAJARA DO NASCIMENTO SOUZA", "c": "###.067.394-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "9301216", "n": "LAUDICEIA NOBERTO DE LIMA CARDOSO", "c": "###.798.434-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "9301267", "n": "CASSIO THYAGO DE ANDRADE", "c": "###.564.754-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9301968", "n": "ELZA MARIA DE OLIVEIRA SOARES", "c": "###.733.144-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ROTARY"}, {"m": "9302140", "n": "KHETLYN MARIA SOUSA DA SILVA DUARTE", "c": "###.855.264-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "9302263", "n": "THAIS BEZERRA DA SILVA", "c": "###.788.514-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9302271", "n": "KARIELE SOUZA DE ARAUJO NOBRE", "c": "###.245.644-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "9302328", "n": "MARIA EVANIA OLIVEIRA DE MORAIS", "c": "###.966.314-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "9302620", "n": "ELIANA TORRES DA SILVA", "c": "###.713.614-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. MANOEL DANTAS BARRETO (JACOCA)"}, {"m": "9303669", "n": "ERITANILDO SANTOS DE LEMOS", "c": "###.641.184-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "9304290", "n": "NAYANA PAULA SILVA LAZARO", "c": "###.211.854-##", "g": "C - PROFESSOR DE CIENCIAS", "h": "25h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9304304", "n": "SHEYLLA MIRIS DE LIMA SANTOS LISBOA", "c": "###.785.344-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9304975", "n": "CAROLINE CAMPOS DE OLIVEIRA RODRIGUES", "c": "###.535.564-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. FRANCISCO DE ASSIS SANTANA"}, {"m": "9305041", "n": "ANA KAROLAYNE SILVESTRE DOS SANTOS", "c": "###.363.204-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "9307168", "n": "FRANSUELE INACIO FERREIRA", "c": "###.104.074-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. SEVERINO PINHEIRO DA SILVA (MINEIRO)"}, {"m": "9309900", "n": "KARINA BEZERRA DO NASCIMENTO", "c": "###.258.714-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9309900", "n": "KARINA BEZERRA DO NASCIMENTO", "c": "###.258.714-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9309934", "n": "FRANCISCA MARIA DANTAS", "c": "###.574.724-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "9310304", "n": "VALERIA DE MELO FERREIRA", "c": "###.664.394-##", "g": "PROFESSOR DE INGLÊS - PÓS GRADUAÇÃO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9310320", "n": "EDINILTON CARLOS DAS CHAGAS", "c": "###.664.314-##", "g": "PROFESSOR DE INGLÊS - PÓS GRADUAÇÃO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9310339", "n": "GABRIELA DE OLIVEIRA SANTOS", "c": "###.020.024-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "9310347", "n": "ANDRE LUIZ RODRIGUES MARINHO", "c": "###.780.684-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9310355", "n": "JOAO MARIA DA SILVA LOPES", "c": "###.847.444-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9310371", "n": "THAISA RAPHAELA DE FREITAS REVOREDO CARDOSO", "c": "###.608.144-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9310398", "n": "MANOEL AMARO MINERVINO DE CARVALHO", "c": "###.062.024-##", "g": "PROFESSOR DE MATEMÁTICA - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9310401", "n": "ROSANE DE SOUZA SILVA", "c": "###.145.221-##", "g": "PROFESSOR DE MATEMÁTICA - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9310428", "n": "JOAO CLAUDIO ROCHA DE SOUZA", "c": "###.305.724-##", "g": "PROFESSOR DE MATEMÁTICA - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9310487", "n": "JEYMERSSON GALVAO ARAUJO", "c": "###.947.584-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9310495", "n": "JOSE MAURICIO MOREIRA DOS SANTOS", "c": "###.656.573-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9310517", "n": "LUCIANA CRISTINA BRANDAO DE ARAUJO", "c": "###.371.554-##", "g": "PROFESSOR DE GEOGRAFIA - POS-GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9310533", "n": "JEFFERSON ANDRE LIMA DE SOUZA", "c": "###.785.994-##", "g": "PROFESSOR DE GEOGRAFIA - POS-GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9310541", "n": "ROSEANE DOS SANTOS MEDEIROS", "c": "###.171.544-##", "g": "PROFESSOR DE GEOGRAFIA - POS-GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9310584", "n": "CLEICY CORDEIRO DA SILVA", "c": "###.936.004-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. JOAQUIM FERNANDES SOBRAL (TABUAO)"}, {"m": "9310754", "n": "ANILEIDE GOMES LEITE GALVAO", "c": "###.241.054-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9310762", "n": "ANA ANITA ALEXSANDRA SEIXAS DE CASTRO FREITAS", "c": "###.784.284-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9310770", "n": "DAISE MARIA CUNHA DE SOUSA CARVALHO", "c": "###.979.884-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9310797", "n": "KLAYTA BENIGNO RAMALHO DANTAS", "c": "###.295.084-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9310843", "n": "MARIA APARECIDA NUNES DE OLIVEIRA", "c": "###.660.274-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9310932", "n": "MARILIA ARAUJO DA SILVA", "c": "###.184.934-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "9310959", "n": "MYCARLA NELY RODRIGUES DOS SANTOS LAUAR", "c": "###.439.404-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - PÓS GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9310983", "n": "ANGELA MARIA DE SOUZA NUNES", "c": "###.642.404-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. VIRGILIO LUIZ (MATAS)"}, {"m": "9310991", "n": "FABYANA SOARES DE OLIVEIRA", "c": "###.097.164-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9311009", "n": "GREYCE KELLY BARBOSA CIRIACO SILVA", "c": "###.851.024-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9311017", "n": "JEAN PIERRE BEHLING", "c": "###.894.129-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9311041", "n": "LILIANA MARIA ATALIBA DA SILVA", "c": "###.155.874-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9311050", "n": "LOUISE KARLA DO NASCIMENTO OLIVEIRA", "c": "###.832.614-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "9311068", "n": "LUANA MIRYAN MARQUES DE OLIVEIRA", "c": "###.460.394-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9311076", "n": "MARCUS VINICIUS DA COSTA SILVA", "c": "###.535.074-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9311092", "n": "THALLES AGGEO LIMA DE MEDEIROS", "c": "###.186.624-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9311114", "n": "WENDELL SOARES DE OLIVEIRA LINS", "c": "###.933.364-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9311173", "n": "MARIA ELIENE PEREIRA DA SILVA", "c": "###.870.164-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUA)"}, {"m": "9311181", "n": "VERA LUCIA CAMPOS DA SILVA", "c": "###.619.214-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª BELARMINA CAMPOS (LOGRADOURO)"}, {"m": "9311203", "n": "YARA PRISCILA SOARES DA CAMARA", "c": "###.712.224-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9311203", "n": "YARA PRISCILA SOARES DA CAMARA", "c": "###.712.224-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9311211", "n": "RAFAELLY COUTINHO FERNANDES", "c": "###.890.634-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "9311220", "n": "EDUARDO CAMARA GONCALO", "c": "###.655.824-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9311254", "n": "LOUSIANE DANIELE DA SILVA", "c": "###.806.704-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "9311270", "n": "WAGNAR DA SILVA ARAUJO", "c": "###.501.504-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "9311297", "n": "ROSIMEIRI ANGELA DA CUNHA PEREIRA", "c": "###.272.804-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9311327", "n": "SARA DANTAS FILGUEIRA DE MOURA", "c": "###.458.114-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9311386", "n": "DEBORAH ENIRLES AMORIM FERREIRA", "c": "###.539.294-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "9311394", "n": "JANAINA SILVA DOS SANTOS", "c": "###.724.724-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9311408", "n": "MARIA DE FATIMA SALES", "c": "###.329.564-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA DE LOURDES DE OLIVEIRA (GRAVATA)"}, {"m": "9311416", "n": "DAIANNY CABRAL DE PAULA", "c": "###.483.304-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO/Diretor Escolar Nível III (GD)", "h": "40h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9311440", "n": "JANEIDE LOPES DE LIMA COSTA", "c": "###.242.214-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "9311459", "n": "LIVIA GARCIA DA COSTA ROCHA", "c": "###.322.214-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9311475", "n": "JOYCE ANDRADE COSTA", "c": "###.969.534-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "9311483", "n": "ELIANE FERREIRA DO NASCIMENTO REIS", "c": "###.973.474-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "9311491", "n": "ANNE KAROLINE OLIVEIRA DANTAS", "c": "###.834.434-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "9311505", "n": "ORLANDO BEZERRA", "c": "###.061.194-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª BELARMINA CAMPOS (LOGRADOURO)"}, {"m": "9311513", "n": "LEYLYAN CARDOSO DA SILVA", "c": "###.970.644-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "9311548", "n": "LUCILENE INACIO SALDANHA", "c": "###.072.184-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9311556", "n": "JOSE RANILSON DE ANDRADE", "c": "###.268.574-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "9311564", "n": "FABIANA JUSSARA DE ARAUJO SOUZA", "c": "###.918.294-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. HELENA VILAR RIBEIRO DANTAS (MINAMORA)"}, {"m": "9311580", "n": "LUIZ FERNANDO MAURICIO DE SOUZA", "c": "###.585.084-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "9311599", "n": "JOVANGELA MARTINS DE ARAUJO", "c": "###.155.914-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9311602", "n": "JULIANA CRISTINA DA COSTA E SILVA", "c": "###.054.724-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9311610", "n": "ELAINY CRISTINA DE SOUZA CRUZ", "c": "###.782.154-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ROTARY"}, {"m": "9311637", "n": "IVANALDO AGAPITO DA SILVA", "c": "###.265.394-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "9311645", "n": "ELIZANE DE OLIVEIRA COSTA", "c": "###.553.104-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9311670", "n": "MARIA LAISE DE OLIVEIRA", "c": "###.456.264-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9311696", "n": "CAMILA DE OLIVEIRA GUERRA", "c": "###.844.034-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9311700", "n": "EDINEIDE PINHEIRO RODRIGUES", "c": "###.014.954-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "9311718", "n": "DANIEL BRUNO LOBO DE LIMA", "c": "###.208.864-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "9311750", "n": "SONIA CORREIA FELIX", "c": "###.737.574-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9311777", "n": "JOSEFA JAILMA DA SILVA ARAUJO", "c": "###.564.304-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "9311793", "n": "SONIA MARIA SILVEIRA DE ASSIS", "c": "###.997.954-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9311807", "n": "SALESIA BARBOSA DE SOUZA SILVA", "c": "###.793.214-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. PROFª MARIA DE LOURDES FERREIRA DO NASCIMENTO (PRIMEIRA LAGOA)"}, {"m": "9311815", "n": "ROSANGELA DA SILVA ALVARO FRANCA", "c": "###.510.094-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "9311823", "n": "KALUZA LUNARA BEZERRA DA SILVA BRITO", "c": "###.852.004-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9311831", "n": "JARLENE DA SILVA AMERICO", "c": "###.465.384-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9311840", "n": "FRANCISCA DIOGENES DOS SANTOS TARGINO", "c": "###.024.624-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "9311858", "n": "PRISCILA DE OLIVEIRA TEIXEIRA", "c": "###.164.544-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9311866", "n": "SORAIA SALGUEIRO DA SILVA", "c": "###.856.824-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9311874", "n": "INGRID PACHECO LOBATO DA SILVA", "c": "###.489.114-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9311882", "n": "MANUELLY VITORIA DE SOUZA FREIRE XAVIER", "c": "###.908.214-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9311890", "n": "HORTENCIA SOARES BARBOSA RIBEIRO DE MELO", "c": "###.789.444-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. PROFª MARIA DE LOURDES FERREIRA DO NASCIMENTO (PRIMEIRA LAGOA)"}, {"m": "9311904", "n": "ADEILMA BRAZ DE LIMA", "c": "###.570.694-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9311912", "n": "ELIANE CARNEIRO DA SILVA OLIVEIRA", "c": "###.578.484-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9311920", "n": "MARIA DO CARMO DANTAS DE ARAUJO QUINTILIANO", "c": "###.486.724-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. PROFª MARIA DE LOURDES FERREIRA DO NASCIMENTO (PRIMEIRA LAGOA)"}, {"m": "9311947", "n": "MARCIONILLA THATIELLY SILVA DO NASCIMENTO FERNANDES", "c": "###.491.504-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9311947", "n": "MARCIONILLA THATIELLY SILVA DO NASCIMENTO FERNANDES", "c": "###.491.504-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9311955", "n": "MAURILEIA ALVES DE OLIVEIRA", "c": "###.859.434-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9311963", "n": "MARIA ELIZANGELA SOUZA DA SILVA SOARES", "c": "###.136.554-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9311971", "n": "MICARLA  DA CRUZ SILVA", "c": "###.198.124-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9311998", "n": "POLYANA DA NOBREGA BARBOSA", "c": "###.900.334-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. MONSENHOR RUY MIRANDA (PROJETO SANTA AGUEDA)"}, {"m": "9312005", "n": "MARIA APARECIDA DE AQUINO COSTA", "c": "###.620.454-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9312013", "n": "WALLACE EWERTON DE LIMA COSTA", "c": "###.716.164-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9312030", "n": "FRANCISCA SILVANA DE OLIVEIRA RODRIGUES", "c": "###.794.084-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)"}, {"m": "9312030", "n": "FRANCISCA SILVANA DE OLIVEIRA RODRIGUES", "c": "###.794.084-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "9312048", "n": "CLAUDIA MARGARIDA DE OLIVEIRA", "c": "###.742.604-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "9312064", "n": "DALIJANE MARQUES HERMINIO", "c": "###.628.974-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "9312072", "n": "FRANCISCA LORENA DE LIMA PEREIRA", "c": "###.086.124-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9312080", "n": "KEISIANE PATRICIO DOS SANTOS", "c": "###.800.984-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. JOAQUIM FERNANDES SOBRAL (TABUAO)"}, {"m": "9312099", "n": "DAIANE MELO DE OLIVEIRA", "c": "###.352.074-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "9312102", "n": "MARIA JUVANETE MENDES DA SILVA", "c": "###.601.004-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9312102", "n": "MARIA JUVANETE MENDES DA SILVA", "c": "###.601.004-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "9312110", "n": "FLAVIA REGINA MENDES DE ALMEIDA FONSECA", "c": "###.997.334-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9312110", "n": "FLAVIA REGINA MENDES DE ALMEIDA FONSECA", "c": "###.997.334-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9312129", "n": "WILZANIR GONZAGA DA SILVA", "c": "###.692.424-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "9312137", "n": "CECY CARLOS DE CASTRO", "c": "###.397.003-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "9312161", "n": "MARINEIDE DANIEL PEREIRA", "c": "###.756.304-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9312170", "n": "VANESSA CRISTINA OLIVEIRA DA SILVA", "c": "###.986.844-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9312188", "n": "ERICKA MARTINERI DE BRITO", "c": "###.484.824-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "9312196", "n": "MARIA DA CONCEICAO ALVES DA SILVA", "c": "###.966.754-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9312200", "n": "MARIA ELIANE DA SILVA COSTA MEDEIROS", "c": "###.737.744-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9312226", "n": "MAYARA CRISTINA DA SILVA", "c": "###.691.684-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. JOSE VENANCIO (VARZEA DE DENTRO)"}, {"m": "9312234", "n": "MACEDO SILVA DE OLIVEIRA", "c": "###.543.764-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. FRANCISCO DE ASSIS SANTANA"}, {"m": "9312242", "n": "ELIZABETH PEREIRA DE SOUZA", "c": "###.287.064-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9312250", "n": "IVANISE LOPES DA SILVA LIMA", "c": "###.292.294-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9312269", "n": "LORENA SILVA RENOVATO", "c": "###.765.144-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "9312285", "n": "KALLYNNY VARELA BORGES DA SILVA", "c": "###.279.224-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "9312323", "n": "LUCIMARIA EDIVANIA ALVES", "c": "###.770.674-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9312382", "n": "DEBORA CRISTINA SILVA RAMOS", "c": "###.169.714-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9312579", "n": "SANDRA TEIXEIRA MACIEL", "c": "###.325.784-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUA)"}, {"m": "9312587", "n": "JOAO VITOR CALDAS DE ARAUJO", "c": "###.230.994-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMA)"}, {"m": "9312609", "n": "MARCIA ELIZABETH MATOS DE QUEIROZ", "c": "###.528.684-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "9312617", "n": "LILIAN LIZANIA MACEDO DA COSTA", "c": "###.284.824-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "9312625", "n": "JAIANE VIEIRA DA CONCEICAO", "c": "###.316.864-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9312633", "n": "IRIAN COSTA DA SILVA", "c": "###.715.104-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "9312641", "n": "MARJORIE SULLAMITA DE OLIVEIRA MARTINS ARAUJO", "c": "###.147.524-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9312650", "n": "MAXIMILIANA DOS SANTOS MENDES", "c": "###.631.194-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9312668", "n": "LARA SOUZA DA CRUZ", "c": "###.358.574-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "CENTRO MUNICIPAL DE APOIO A INCLUSÃO  - CEMAI"}, {"m": "9312730", "n": "MARILEIDE DE QUEIROZ", "c": "###.036.004-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9312749", "n": "ANGELICA MICHELLY ALVES BANDEIRA", "c": "###.366.124-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. FRANCISCO DE ASSIS SANTANA"}, {"m": "9312757", "n": "LUIZA CARLA ALBUQUERQUE DE MEDEIROS", "c": "###.769.204-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "9312773", "n": "KAINARA FRANCLEIDE MENDES SILVA", "c": "###.803.874-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9312781", "n": "MAXILENE DA SILVA BRITO", "c": "###.757.624-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9312889", "n": "RIVALDO FERNANDES PEREIRA", "c": "###.750.054-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR/Assessor Governamental Especial de Administração", "h": "0h", "l": "SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO"}, {"m": "9312897", "n": "LIDIANE CRISTINA DE SOUZA", "c": "###.774.934-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9312960", "n": "MYLLER DENNER DA SILVA SOUZA", "c": "###.056.064-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9313133", "n": "ANA CLAUDINE DE CARVALHO MOUSINHO", "c": "###.255.474-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9313176", "n": "KAIQUE FERNANDES DE OLIVEIRA", "c": "###.711.094-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9313338", "n": "ARIANE MEDEIROS VILLELA", "c": "###.755.394-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9313346", "n": "EVODYA SYNTYK GOMES DE OLIVEIRA MARINHO COSTA", "c": "###.504.594-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9313613", "n": "MARIA LUCIANA BENTO DA COSTA", "c": "###.642.654-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR - PÓS GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9313648", "n": "RAYANE KAROLINE SILVA ALVES DE SOUSA", "c": "###.407.944-##", "g": "PROFESSOR DE INGLÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9313940", "n": "GLEISSE MICAELA RODRIGUES DE SOUZA SILVA", "c": "###.739.354-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9314555", "n": "SIBELY KARLA SOUZA DA SILVEIRA", "c": "###.217.854-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. JOAQUIM FERNANDES SOBRAL (TABUAO)"}, {"m": "9315276", "n": "MARCIO LUIZ NASCIMENTO DE LIMA", "c": "###.842.944-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)"}, {"m": "9315284", "n": "MARICELIO DE CARVALHO DOS SANTOS", "c": "###.941.124-##", "g": "PROFESSOR DE MATEMÁTICA - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "9315292", "n": "CARLOS GUSTAVO FERREIRA DA CAMARA", "c": "###.478.554-##", "g": "PROFESSOR DE GEOGRAFIA - POS-GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9315306", "n": "MARIA ELIANE CAETANO", "c": "###.087.834-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "9315314", "n": "JOSIMEIRE BEZERRA MARQUES OLIVEIRA", "c": "###.418.364-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR - PÓS GRADUADO", "h": "30h", "l": "E.M. ALCIDES CAMARA DE SOUZA (CAPELA)"}, {"m": "9315322", "n": "MARCIO DANTAS DE MEDEIROS", "c": "###.623.664-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9315330", "n": "ELAINE CRISTINA GOMES DE LIMA", "c": "###.847.554-##", "g": "PROFESSOR DE PORTUGUÊS - POS GRADUAÇÃO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9315349", "n": "MARIA DE FATIMA VIEIRA ALVES", "c": "###.325.854-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9315365", "n": "ROSELEIDE VITORINO DA SILVA", "c": "###.837.504-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "9315616", "n": "PAULA FRANCINETE REBOUCAS DE OLIVEIRA", "c": "###.589.324-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. SERGIO VARELA SANTIAGO (COQUEIROS)"}, {"m": "9315624", "n": "MARIA LIDIVANIA DA SILVA DURVAL", "c": "###.524.714-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9315632", "n": "VALDEIZA GOMES DE ANDRADE DOS SANTOS", "c": "###.736.934-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "9315640", "n": "FRANCISCO GILMARIO DOS SANTOS", "c": "###.972.464-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9315659", "n": "KEILA MARTINS GRACIANO", "c": "###.246.314-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9315780", "n": "MONICA REJANE DA SILVA PEREIRA DANTAS", "c": "###.098.214-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9316540", "n": "NEILDE BARBOSA MELO", "c": "###.756.734-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. JOSE VENANCIO (VARZEA DE DENTRO)"}, {"m": "9316574", "n": "TELANY CRISTINA LOPES", "c": "###.514.244-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9316604", "n": "CINARA BEZERRA DE ALMEIDA", "c": "###.113.944-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9316612", "n": "DANIELLE CRISTINA SILVA DE MACEDO", "c": "###.403.574-##", "g": "PROFESSOR DE PORTUGUÊS - POS GRADUAÇÃO", "h": "30h", "l": "E.M. PROFº ALBERTO NICACIO DA COSTA BARBOSA"}, {"m": "9316760", "n": "MARCIO MELO DA SILVA", "c": "###.860.794-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9316906", "n": "ANDRE VITOR NUNES CRUZ", "c": "###.913.294-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9317465", "n": "IARA CARVALHO DA SILVA", "c": "###.669.164-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. PROFª MARIA DE LOURDES FERREIRA DO NASCIMENTO (PRIMEIRA LAGOA)"}, {"m": "9317643", "n": "LEONARDO LIMA DA SILVA", "c": "###.953.094-##", "g": "C - PROFESSOR DE LINGUA PORTUGUESA", "h": "25h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "9317880", "n": "ALDEMIR PATRICIO DA SILVA", "c": "###.411.084-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9317899", "n": "RICARDO HENRIQUE ARAUJO DA SILVA", "c": "###.242.614-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "9317902", "n": "PEDRO HENRIQUE TAVARES", "c": "###.066.354-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9317910", "n": "JHONATAN SILVA DA CRUZ", "c": "###.782.332-##", "g": "PROFESSOR DE INGLÊS - PÓS GRADUAÇÃO", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9317929", "n": "RAPHAEL CAVALCANTI NEGREIROS DA SILVA", "c": "###.022.324-##", "g": "PROFESSOR DE GEOGRAFIA - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9317937", "n": "GEZILDA CORDEIRO DA SILVA BARBOZA", "c": "###.429.804-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. MONSENHOR RUY MIRANDA (PROJETO SANTA AGUEDA)"}, {"m": "9317945", "n": "HALYNE KARLA RAMOS", "c": "###.571.704-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9317953", "n": "JADSON LUCAS PINHEIRO DE CARVALHO", "c": "###.460.654-##", "g": "PROFESSOR DE HISTÓRIA - SUPERIOR", "h": "30h", "l": "E.M. DR. AUGUSTO MEIRA"}, {"m": "9317961", "n": "GISELE DA SILVA BATISTA", "c": "###.815.004-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9317988", "n": "SORAIA MARIA DO NASCIMENTO SILVA", "c": "###.709.634-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. FELIPE CAMARAO (RAPOSA)"}, {"m": "9317996", "n": "SONIA MARIA DA SILVA SOUZA", "c": "###.448.784-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9318003", "n": "APARECIDA MICHELE DA SILVA", "c": "###.202.204-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9318011", "n": "CAMILA DA SILVA NERES", "c": "###.167.794-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "9318020", "n": "AINE PEREIRA DE ALCANTARA SALDANHA", "c": "###.390.275-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9318038", "n": "OLANY LIMA VIEIRA DA SILVA SOUZA", "c": "###.435.854-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9318054", "n": "LUIZ FERNANDO DA SILVA", "c": "###.520.424-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9318062", "n": "PATRICIA GOMES TOMAS", "c": "###.792.944-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFº JOAO GABRIEL DE OLIVEIRA (ANINGAS)"}, {"m": "9318070", "n": "MARIA DE FATIMA GONCALVES", "c": "###.267.174-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ROTARY"}, {"m": "9318089", "n": "MARIA LUIZA RUFINO DA COSTA E SILVA", "c": "###.385.244-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9318097", "n": "ANA PAULA FARIAS DE BARROS COSTA", "c": "###.141.094-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. ROTARY"}, {"m": "9318100", "n": "CARLOS BATISTA DE OLIVEIRA", "c": "###.945.934-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "9318119", "n": "ROCIANY DANIELLY AVELINO", "c": "###.738.094-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "9318127", "n": "DAVID VASCONCELOS SOUTO", "c": "###.802.534-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9318135", "n": "ELIONAY DE LIMA BASTOS", "c": "###.757.154-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. JOSE ADELINO (PRIMEIRA LAGOA)"}, {"m": "9318143", "n": "GESSICA KALINY XAVIER DE ARAGAO ALVES FAGUNDES", "c": "###.011.124-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9318151", "n": "WYCLIF CARVALHO DE GOES", "c": "###.932.504-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9318160", "n": "ELISANDRA PEREIRA ANGELO", "c": "###.845.634-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9318178", "n": "RAIANE GOMES DA SILVA SOUZA", "c": "###.812.174-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9318186", "n": "MARIA DA CONCEICAO DA SILVA", "c": "###.015.104-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9318194", "n": "LUIZ GUSTAVO MOREIRA DE OLIVEIRA", "c": "###.630.784-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9318208", "n": "CRISTINA FERNANDES DA FONSECA", "c": "###.961.204-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9318216", "n": "ZUELIA MARIA EUFRASIO", "c": "###.695.364-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9318224", "n": "JOSE OSCAR MARTINS", "c": "###.678.164-##", "g": "PROFESSOR DE CIÊNCIAS BIOLOGICAS - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9318259", "n": "MARIA ALCIONE TEIXEIRA DO NASCIMENTO", "c": "###.633.684-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª BELARMINA CAMPOS (LOGRADOURO)"}, {"m": "9318267", "n": "MARIA DAS VITORIAS LIMA CAMPELO", "c": "###.085.084-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9318275", "n": "CARLOS JUNIOR SOUSA SILVA", "c": "###.566.934-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9318283", "n": "ALEXSANDRA SILVA CAMPOS", "c": "###.152.894-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9318291", "n": "ERIKA JANAINA SANTIAGO MOREIRA FREIRE", "c": "###.396.324-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9318305", "n": "DARIO YGOR ALBUQUERQUE DA SILVA VALDIVINO", "c": "###.509.194-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9318313", "n": "LINDERCLEIBSON SOUZA DA SILVA", "c": "###.418.844-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9318321", "n": "DANIEL FERREIRA PITANGA", "c": "###.418.014-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - SUPERIOR", "h": "30h", "l": "E.M. RUY PEREIRA JUNIOR (MURIU)"}, {"m": "9318348", "n": "CLAYTON PAULO DE OLIVEIRA ARAUJO", "c": "###.076.444-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9318356", "n": "MARILEIA LABRE DANTAS", "c": "###.315.204-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA"}, {"m": "9318372", "n": "JESSICA THUIZA OLIVEIRA DOS SANTOS", "c": "###.850.544-##", "g": "PROFESSOR DE PORTUGUÊS - POS GRADUAÇÃO", "h": "30h", "l": "E.M. DR. JULIO GOMES DE SENNA"}, {"m": "9318399", "n": "MARIA DA SOLIDADE OLIVEIRA FALCAO", "c": "###.265.264-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. PROFª MARA CABRAL (BOA VISTA)"}, {"m": "9318402", "n": "ISABELA MORAES PINHEIRO D' AZEVEDO", "c": "###.019.516-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9318410", "n": "ISABEL BEATRIZ DE MEDEIROS COSTA LUCAS", "c": "###.296.974-##", "g": "PROFESSOR DE MATEMÁTICA - SUPERIOR", "h": "30h", "l": "E.M. PROFª NEUMA FERREIRA JANUARIO - CERU (COQUEIROS)"}, {"m": "9318429", "n": "MARIA DAS GRACAS CARLOS NUNES", "c": "###.227.284-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "9318437", "n": "DAMIANA DE LIMA", "c": "###.906.784-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - PÓS GRADUADO", "h": "30h", "l": "E.M. EMIDIO FERREIRA DA SILVA (RIO DOS INDIOS)"}, {"m": "9318445", "n": "SAMELA RITCHELY ANTUNES DE SENA", "c": "###.849.604-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9318453", "n": "MARIO GOMES BOTELHO JUNIOR", "c": "###.833.904-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9318453", "n": "MARIO GOMES BOTELHO JUNIOR", "c": "###.833.904-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)"}, {"m": "9318461", "n": "ANDREZZA DE FATIMA SILVA DE MEDEIROS", "c": "###.329.674-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9318470", "n": "CLARA VIVIANE MARQUES DE MACEDO MOURA", "c": "###.910.744-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9318488", "n": "ROSEANNE NAZARE MONTEIRO DE SOUZA", "c": "###.738.924-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)"}, {"m": "9318496", "n": "MARCILIO SILVA DOS SANTOS", "c": "###.479.514-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. MARIO PINHEIRO DA SILVA"}, {"m": "9318542", "n": "CHRISTIANE DONATA DANTAS TEIXEIRA", "c": "###.647.504-##", "g": "PROFESSOR DE EDUCAÇÃO FÍSICA - POS GRADUADO", "h": "30h", "l": "E.M. PROFª MARIA BERNADETE BARBOSA (MASSARANDUBA)"}, {"m": "9318569", "n": "SEVERINO CORREIA DE OLIVEIRA", "c": "###.539.614-##", "g": "PROFESSOR DE PORTUGUÊS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9318593", "n": "FRANCISCO PATRIQUE SILVA DE MELO", "c": "###.017.935-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA"}, {"m": "9318607", "n": "ANA PAULA GONCALVES BARBOSA", "c": "###.898.384-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9318607", "n": "ANA PAULA GONCALVES BARBOSA", "c": "###.898.384-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9318658", "n": "ERIKA RIBEIRO DE LIMA", "c": "###.547.742-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9321535", "n": "ANDRIELLE ALVES DA COSTA", "c": "###.189.704-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "9321594", "n": "RUBIANA MARIA REGINALDO DA TRINDADE", "c": "###.342.954-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PAULO FREIRE (MANIBU)"}, {"m": "9322922", "n": "ALINE DE SOUZA RODRIGUES", "c": "###.095.984-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. FRANCISCO DE ASSIS SANTANA"}, {"m": "9323449", "n": "FERNANDA HELOIZA DE SOUZA FRUTUOSO", "c": "###.841.014-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. MONSENHOR RUI MIRANDA"}, {"m": "9324194", "n": "DINAIZIA FERREIRA SOARES DO NASCIMENTO", "c": "###.292.774-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9324305", "n": "IZANA MARIA DAMASCENA FRANCA", "c": "###.508.244-##", "g": "C - PROFESSOR DE CIENCIAS", "h": "25h", "l": "E.M. MADALENA ANTUNES PEREIRA"}, {"m": "9325581", "n": "ERIKY JOSEPH GOMES DOS SANTOS", "c": "###.896.264-##", "g": "C - PROFESSOR DE MATEMATICA", "h": "25h", "l": "E.M. PROFª MARIA ESTER PAIVA (MASSANGANA)"}, {"m": "9327037", "n": "RAFAEL ANTONIO SILVA DOS SANTOS", "c": "###.644.864-##", "g": "PROFESSOR DE EDUCAÇÃO ESPECIAL - SUPERIOR", "h": "30h", "l": "E.M. FERDINANDO PEREIRA DO COUTO (TERRA DA SANTA)"}, {"m": "9328343", "n": "MARILIA FERNANDES DA LUZ PINHEIRO", "c": "###.845.224-##", "g": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR", "h": "30h", "l": "E.M. PROFª ADELE DE OLIVEIRA"}, {"m": "9328360", "n": "THYAGO THAYRONNE CAMPOS PINHEIRO", "c": "###.904.884-##", "g": "C - PROFESSOR DE ANOS INICIAIS", "h": "25h", "l": "E.M. ROTARY"}, {"m": "9330437", "n": "FRANCISCA EVA VILMA DANTAS SILVA NASCIMENTO", "c": "###.936.784-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9330445", "n": "JANIARA DE AZEVEDO SILVA DE OLIVEIRA", "c": "###.962.924-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9330453", "n": "DANIELLE PEREIRA DE SOUZA", "c": "###.742.534-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9330461", "n": "POLIANE REGIA DE ARAUJO", "c": "###.694.754-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9330461", "n": "POLIANE REGIA DE ARAUJO", "c": "###.694.754-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "E.M. PROFª ILCA MIRANDA PACHECO (SÃO MIGUEL)"}, {"m": "9330470", "n": "CLEUSA MARIA DUARTE", "c": "###.656.844-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. BRASILIANO JERONIMO DA SILVA (ALTO DO SITIO)"}, {"m": "9330496", "n": "GISLAINE GOMES DE OLIVEIRA", "c": "###.439.154-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MENINO JESUS"}, {"m": "9330500", "n": "NAZIANE VIRGINIA MIRANDA DA CRUZ", "c": "###.199.604-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PROFª ALZIRA DE SA PEREIRA (PROJ. SANTA AGUEDA)"}, {"m": "9330526", "n": "MEIRE LUCIA RAMALHO DE OLIVEIRA SANTANA", "c": "###.772.994-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9330534", "n": "TUANNY CAVALCANTI LEITE", "c": "###.183.034-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9330542", "n": "THAMISY FERREIRA DA SILVA", "c": "###.590.434-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. ROSILDA RODRIGUES DUARTE (GRAVATÁ)"}, {"m": "9330550", "n": "DANIELLA DA SILVA  FREIRE", "c": "###.940.574-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9330569", "n": "RENATA GOMES TEIXEIRA MATOS DA  ROCHA", "c": "###.182.884-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. VEREADOR RAFAEL FERNANDES SOBRAL"}, {"m": "9330577", "n": "MICHELLE TEIXEIRA FREIRE DA COSTA", "c": "###.742.864-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9330674", "n": "KELIA  SIMONE DE SOUZA RAMOS DIAS", "c": "###.299.274-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "E.M. PEDRO SALOMÃO (CAIANA)"}, {"m": "9330771", "n": "MARILIA VANESSA BERNARDINO DA SILVA", "c": "###.206.987-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9330780", "n": "ROSE THATIANE NUNES DE ARAUJO", "c": "###.490.114-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - POS GRADUADO", "h": "30h", "l": "C.E.I. MARIA ALICE DE BRITO (MASSARANDUBA)"}, {"m": "9331107", "n": "ELAINE CRISTINA NOGUEIRA GUILHERME", "c": "###.254.704-##", "g": "C - PROFESSOR DA EDUCAÇÃO INFANTIL", "h": "25h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}, {"m": "9331107", "n": "ELAINE CRISTINA NOGUEIRA GUILHERME", "c": "###.254.704-##", "g": "PROFESSOR DE EDUCAÇÃO INFANTIL - SUPERIOR", "h": "30h", "l": "C.E.I. DR RUI PEREIRA DOS SANTOS"}];

  // Intenções Iniciais de Permuta baseadas em Servidores Reais de Ceará-Mirim e Polos Parceiros
  const BANCO_INICIAL_PERMUTAS = [
  {
    "id": "perm_real_001",
    "nome": "ODJAIME CAMARA DE ARAUJO",
    "matricula": "0010016",
    "cargo": "Professor dos Anos Finais",
    "disciplina": "História",
    "cargaHoraria": "30h",
    "origem": "E. M. Alice Garcia Freire (Ceará-Mirim)",
    "municipioOrigem": "Ceará-Mirim",
    "destino": "Natal",
    "turno": "Matutino",
    "dataCadastro": "2026-10-25"
  },
  {
    "id": "perm_real_002",
    "nome": "RENATO SOARES CAVALCANTI",
    "matricula": "084910-2",
    "cargo": "Professor dos Anos Finais",
    "disciplina": "História",
    "cargaHoraria": "30h",
    "origem": "Polo Natal (Zona Norte - SME)",
    "municipioOrigem": "Natal",
    "destino": "Ceará-Mirim",
    "turno": "Matutino",
    "dataCadastro": "2026-10-26"
  },
  {
    "id": "perm_real_003",
    "nome": "LENIVALDO EDUARDO LOPES DE OLIVEIRA",
    "matricula": "0051683",
    "cargo": "Professor dos Anos Iniciais",
    "disciplina": "Polivalente / Pedagogia",
    "cargaHoraria": "30h",
    "origem": "E. M. Prefeito Roberto Varela (Ceará-Mirim)",
    "municipioOrigem": "Ceará-Mirim",
    "destino": "Extremoz",
    "turno": "Vespertino",
    "dataCadastro": "2026-10-28"
  },
  {
    "id": "perm_real_004",
    "nome": "CLARA BEATRIZ NOGUEIRA",
    "matricula": "041280-9",
    "cargo": "Professor dos Anos Iniciais",
    "disciplina": "Polivalente / Pedagogia",
    "cargaHoraria": "30h",
    "origem": "Polo Extremoz (SME Centro)",
    "municipioOrigem": "Extremoz",
    "destino": "Ceará-Mirim",
    "turno": "Vespertino",
    "dataCadastro": "2026-10-29"
  },
  {
    "id": "perm_real_005",
    "nome": "MARIA JAQUELINE BARBOSA",
    "matricula": "0051994",
    "cargo": "Professor dos Anos Finais",
    "disciplina": "Matemática",
    "cargaHoraria": "30h",
    "origem": "E. M. Monsenhor Celso Cicco (Ceará-Mirim)",
    "municipioOrigem": "Ceará-Mirim",
    "destino": "São Gonçalo do Amarante",
    "turno": "Matutino",
    "dataCadastro": "2026-11-01"
  },
  {
    "id": "perm_real_006",
    "nome": "FELIPE TAVARES DE MOURA",
    "matricula": "058210-3",
    "cargo": "Professor dos Anos Finais",
    "disciplina": "Matemática",
    "cargaHoraria": "30h",
    "origem": "Polo São Gonçalo do Amarante (SME Centro)",
    "municipioOrigem": "São Gonçalo do Amarante",
    "destino": "Ceará-Mirim",
    "turno": "Matutino",
    "dataCadastro": "2026-11-02"
  },
  {
    "id": "perm_real_007",
    "nome": "ELIANE XAVIER",
    "matricula": "0051391",
    "cargo": "Especialista em Educação",
    "disciplina": "Polivalente / Pedagogia",
    "cargaHoraria": "30h",
    "origem": "E. M. Augusto Severo (Ceará-Mirim)",
    "municipioOrigem": "Ceará-Mirim",
    "destino": "Macaíba",
    "turno": "Integral",
    "dataCadastro": "2026-11-03"
  },
  {
    "id": "perm_real_008",
    "nome": "GABRIELA GOMES PESSOA",
    "matricula": "091340-1",
    "cargo": "Especialista em Educação",
    "disciplina": "Polivalente / Pedagogia",
    "cargaHoraria": "30h",
    "origem": "Polo Macaíba (SME Centro)",
    "municipioOrigem": "Macaíba",
    "destino": "Ceará-Mirim",
    "turno": "Integral",
    "dataCadastro": "2026-11-03"
  },
  {
    "id": "perm_real_009",
    "nome": "ODJAIME CAMARA DE ARAUJO",
    "matricula": "0010016",
    "cargo": "Professor dos Anos Finais",
    "disciplina": "História",
    "cargaHoraria": "30h",
    "origem": "E. M. Alice Garcia Freire (Ceará-Mirim)",
    "municipioOrigem": "Ceará-Mirim",
    "destino": "Governo do Estado do RN (SEEC)",
    "turno": "Matutino",
    "dataCadastro": "2026-11-04"
  },
  {
    "id": "perm_real_010",
    "nome": "FRANCISCO DE ASSIS MEDEIROS",
    "matricula": "192341-2",
    "cargo": "Professor dos Anos Finais",
    "disciplina": "Matemática",
    "cargaHoraria": "30h",
    "origem": "Colégio Estadual Monsenhor Urbano (SEEC)",
    "municipioOrigem": "Governo do Estado do RN (SEEC)",
    "destino": "Ceará-Mirim",
    "turno": "Matutino",
    "dataCadastro": "2026-11-04"
  }
];

  // Vínculos da Transparência de Referência e Cruzamentos Intermunicipais / Estaduais (CF/88 Art. 37, XVI)
  let VINCULOS_TRANSPARENCIA = [
  {
    "servidor_referencia": {
      "municipio": "Ceará-Mirim",
      "matricula": "0010016",
      "nome_completo": "ODJAIME CAMARA DE ARAUJO",
      "cpf_mascarado": "###.487.734-##",
      "cpf_miolo": "487734",
      "cargo": "PROFESSOR NIVEL SUPERIOR",
      "escola_origem": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      "carga_horaria": 30,
      "status": "ATIVO"
    },
    "vinculo_externo_detectado": {
      "ente_origem": "Governo do Estado do RN (SEEC)",
      "matricula": "184920-1",
      "cargo": "PROFESSOR EFETIVO",
      "lotacao_orgao": "E. E. Augusto Severo (Natal)",
      "carga_horaria": 30,
      "situacao_vinculo": "ATIVO"
    },
    "auditoria_constitucional": {
      "carga_horaria_total": 60,
      "acumulacao_legal": true,
      "enquadramento": "Art. 37, XVI, 'a' da CF/88 (dois cargos de professor)",
      "parecer_hera": "Acumulação regular de 2 vínculos docentes (60h semanais). Recomendada compatibilização de turnos (Matutino / Vespertino)."
    },
    "potencial_permuta": {
      "polo_parceiro": "Polo Natal (Zona Norte - SME)",
      "otimizacao_logistica": "Redução estimada de 28 km de deslocamento diário com integração logística ao segundo vínculo."
    }
  },
  {
    "servidor_referencia": {
      "municipio": "Ceará-Mirim",
      "matricula": "0051683",
      "nome_completo": "LENIVALDO EDUARDO LOPES DE OLIVEIRA",
      "cpf_mascarado": "###.241.304-##",
      "cpf_miolo": "241304",
      "cargo": "PROFESSOR NIVEL SUPERIOR",
      "escola_origem": "E.M. PROFª MARIA ANTONIETA PEREIRA VARELA",
      "carga_horaria": 30,
      "status": "ATIVO"
    },
    "vinculo_externo_detectado": {
      "ente_origem": "Prefeitura Municipal de Natal (SME Natal)",
      "matricula": "084921-5",
      "cargo": "PROFESSOR DE ANOS FINAIS",
      "lotacao_orgao": "E. M. Professor Waldson Pinheiro (Zona Norte)",
      "carga_horaria": 30,
      "situacao_vinculo": "ATIVO"
    },
    "auditoria_constitucional": {
      "carga_horaria_total": 60,
      "acumulacao_legal": true,
      "enquadramento": "Art. 37, XVI, 'a' da CF/88 (dois cargos de professor)",
      "parecer_hera": "Acumulação constitucionalmente lícita de 2 cargos de professor (30h + 30h = 60h semanais). Turnos compatíveis."
    },
    "potencial_permuta": {
      "polo_parceiro": "Polo Natal (Zona Norte - SME)",
      "otimizacao_logistica": "Oportunidade de alinhamento com a rede de Natal ZN, otimizando 30 km diários."
    }
  },
  {
    "servidor_referencia": {
      "municipio": "Ceará-Mirim",
      "matricula": "0051391",
      "nome_completo": "ELIANE XAVIER",
      "cpf_mascarado": "###.132.534-##",
      "cpf_miolo": "132534",
      "cargo": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO",
      "escola_origem": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)",
      "carga_horaria": 30,
      "status": "ATIVO"
    },
    "vinculo_externo_detectado": {
      "ente_origem": "Prefeitura Municipal de Extremoz (SME)",
      "matricula": "041280-9",
      "cargo": "PROFESSOR DE EDUCAÇÃO BÁSICA",
      "lotacao_orgao": "E. M. Almirante Tamandaré (Extremoz)",
      "carga_horaria": 30,
      "situacao_vinculo": "ATIVO"
    },
    "auditoria_constitucional": {
      "carga_horaria_total": 60,
      "acumulacao_legal": true,
      "enquadramento": "Art. 37, XVI, 'a' da CF/88 (dois cargos de professor)",
      "parecer_hera": "Vínculos docentes harmônicos e regulares (60h semanais totais). Recomenda-se acompanhamento de assiduidade."
    },
    "potencial_permuta": {
      "polo_parceiro": "Polo Extremoz (SME Centro)",
      "otimizacao_logistica": "Redução de 34 km no eixo rodoviário BR-101 / RN-160 com aproximação à residência e segundo polo."
    }
  },
  {
    "servidor_referencia": {
      "municipio": "Ceará-Mirim",
      "matricula": "0051994",
      "nome_completo": "MARIA JAQUELINE BARBOSA",
      "cpf_mascarado": "###.732.784-##",
      "cpf_miolo": "732784",
      "cargo": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO",
      "escola_origem": "E.M. MARIO PINHEIRO DA SILVA",
      "carga_horaria": 30,
      "status": "ATIVO"
    },
    "vinculo_externo_detectado": {
      "ente_origem": "Prefeitura Municipal de São Gonçalo do Amarante (SME SGA)",
      "matricula": "058210-3",
      "cargo": "PROFESSOR ANOS INICIAIS",
      "lotacao_orgao": "E. M. Vicente de Paula (SGA)",
      "carga_horaria": 30,
      "situacao_vinculo": "ATIVO"
    },
    "auditoria_constitucional": {
      "carga_horaria_total": 60,
      "acumulacao_legal": true,
      "enquadramento": "Art. 37, XVI, 'a' da CF/88 (dois cargos de professor)",
      "parecer_hera": "Conformidade estrita com o Art. 37, XVI, 'a' da CF/88. Carga horária total de 60h dentro do limite prudencial."
    },
    "potencial_permuta": {
      "polo_parceiro": "Polo São Gonçalo do Amarante (SME Centro)",
      "otimizacao_logistica": "Economia de até 40 km semanais via anel viário metropolitano."
    }
  },
  {
    "servidor_referencia": {
      "municipio": "Ceará-Mirim",
      "matricula": "0070671",
      "nome_completo": "JOSE FARIAS DA SILVA",
      "cpf_mascarado": "###.312.454-##",
      "cpf_miolo": "312454",
      "cargo": "PROFESSOR FUNDAMENTAL ANOS INICIAIS - SUPERIOR",
      "escola_origem": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      "carga_horaria": 30,
      "status": "ATIVO"
    },
    "vinculo_externo_detectado": {
      "ente_origem": "Prefeitura Municipal de Ceará-Mirim (Vínculo 2)",
      "matricula": "0070671",
      "cargo": "PROFESSOR NIVEL SUPERIOR PÓS-GRADUADO",
      "lotacao_orgao": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      "carga_horaria": 30,
      "situacao_vinculo": "ATIVO"
    },
    "auditoria_constitucional": {
      "carga_horaria_total": 60,
      "acumulacao_legal": true,
      "enquadramento": "Art. 37, XVI, 'a' da CF/88 (dois cargos de professor)",
      "parecer_hera": "Duplo vínculo municipal interno ativo em Ceará-Mirim. Acumulação lícita de 2 matrículas de magistério (30h + 30h = 60h semanais)."
    },
    "potencial_permuta": {
      "polo_parceiro": "Polo Ceará-Mirim (Rede SMEB)",
      "otimizacao_logistica": "Atuação concentrada na própria rede municipal com compatibilização horária regular."
    }
  },
  {
    "servidor_referencia": {
      "municipio": "Ceará-Mirim",
      "matricula": "0067734",
      "nome_completo": "SUZANA MARIA GALDINO DA SILVA",
      "cpf_mascarado": "###.945.894-##",
      "cpf_miolo": "945894",
      "cargo": "C - PROFESSOR DE ANOS INICIAIS",
      "escola_origem": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      "carga_horaria": 25,
      "status": "ATIVO"
    },
    "vinculo_externo_detectado": {
      "ente_origem": "Prefeitura Municipal de Ceará-Mirim (Vínculo 2)",
      "matricula": "0067734",
      "cargo": "MERENDEIRO",
      "lotacao_orgao": "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      "carga_horaria": 40,
      "situacao_vinculo": "ATIVO"
    },
    "auditoria_constitucional": {
      "carga_horaria_total": 65,
      "acumulacao_legal": false,
      "enquadramento": "Não enquadrado nas exceções constitucionais de acumulação remunerada",
      "parecer_hera": "Alerta de inconformidade: jornada total de 65h semanais (40h Merendeiro + 25h Professor) ultrapassa o limite de 60h e combina cargo não técnico com magistério, violando o Art. 37, XVI da CF/88."
    },
    "potencial_permuta": {
      "polo_parceiro": "Comissão de Acúmulo de Cargos (SMEB / SEAD)",
      "otimizacao_logistica": "Requer instauração de processo administrativo de opção de regime ou redução de jornada."
    }
  }
];

  // Base Referencial Canônica de Servidores Efetivos da Rede Estadual (SEEC/RN)
  const SERVIDORES_ESTADO_RN = [
    { n: 'ODJAIME CAMARA DE ARAUJO', m: '184920-1', g: 'PROFESSOR EFETIVO (HISTÓRIA)', h: '30h', l: 'E. E. Augusto Severo (Natal)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'FRANCISCO DE ASSIS MEDEIROS', m: '192341-2', g: 'PROFESSOR EFETIVO (MATEMÁTICA)', h: '30h', l: 'Colégio Estadual Monsenhor Urbano (Ceará-Mirim)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'MARIA APARECIDA DA SILVA COSTA', m: '178923-4', g: 'PROFESSOR EFETIVO (LÍNGUA PORTUGUESA)', h: '30h', l: 'E. E. Desembargador Silvino Bezerra (Ceará-Mirim)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'JOSE CARLOS DO NASCIMENTO', m: '204891-0', g: 'PROFESSOR EFETIVO (GEOGRAFIA)', h: '30h', l: 'E. E. Professor Edgar Barbosa (Natal)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'ANA CLAUDIA BEZERRA LIMA', m: '211904-8', g: 'PROFESSOR EFETIVO (CIÊNCIAS BIOLÓGICAS)', h: '30h', l: 'E. E. Walter Duarte Pereira (Natal)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'MARCOS ANTONIO ALVES PEREIRA', m: '198762-3', g: 'PROFESSOR EFETIVO (EDUCAÇÃO FÍSICA)', h: '30h', l: 'Colégio Estadual Monsenhor Urbano (Ceará-Mirim)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'LUCIA DE FATIMA RODRIGUES', m: '165432-9', g: 'ESPECIALISTA EM EDUCAÇÃO (PEDAGOGIA)', h: '30h', l: 'DIREC Natal / Sede SEEC RN', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'RAIMUNDO NONATO FERREIRA', m: '223401-5', g: 'PROFESSOR EFETIVO (LÍNGUA INGLESA)', h: '30h', l: 'E. E. Desembargador Silvino Bezerra (Ceará-Mirim)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'SANDRA REGINA DE SOUZA', m: '189045-7', g: 'PROFESSOR EFETIVO (ARTES)', h: '30h', l: 'E. E. Dinarte Mariz (Natal)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' },
    { n: 'PAULO ROBERTO TAVARES', m: '201984-6', g: 'PROFESSOR EFETIVO (FÍSICA/QUÍMICA)', h: '30h', l: 'Colégio Estadual Monsenhor Urbano (Ceará-Mirim)', ente: 'Governo do Estado (SEEC)', orgao: 'SEEC / Governo do Estado do RN' }
  ];

  const PORTAIS = [
    { nome: 'Governo do Estado do RN (SEEC)', regiao: 'Estadual', tecnologia: 'Playwright SPA (SEAD/COPES)', url: 'https://remuneracao.rn.gov.br/table-people', dataUltimoCsv: '12/10/2026' },
    { nome: 'Ceará-Mirim (Base Local SMEB)', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://pmcearamirimrn.transparencia.topsolutionsrn.com.br/servidores', dataUltimoCsv: '12/10/2026' },
    { nome: 'Natal', regiao: 'Grande Natal', tecnologia: 'Portal Transparência SME • CSV', url: 'https://www.natal.rn.gov.br/transparencia', dataUltimoCsv: '12/10/2026' },
    { nome: 'Parnamirim', regiao: 'Grande Natal', tecnologia: 'Portal Transparência • CSV', url: 'https://transparencia.parnamirim.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'São Gonçalo do Amarante', regiao: 'Grande Natal', tecnologia: 'TopSolutions / Exportação CSV', url: 'https://saogoncalo.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'Macaíba', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://macaiba.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'Extremoz', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://extremoz.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'Nísia Floresta', regiao: 'Agreste / Litoral', tecnologia: 'TopSolutions RN • CSV', url: 'https://nisiafloresta.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'Monte Alegre', regiao: 'Agreste', tecnologia: 'TopSolutions RN • CSV', url: 'https://montealegre.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'Ielmo Marinho', regiao: 'Potengi', tecnologia: 'TopSolutions RN • CSV', url: 'https://ielmomarinho.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'São Paulo do Potengi', regiao: 'Potengi', tecnologia: 'TopSolutions RN • CSV', url: 'https://saopaulodopotengi.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'João Câmara', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://joaocamara.rn.gov.br', dataUltimoCsv: '31/12/2024' },
    { nome: 'Poço Branco', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://pocobranco.rn.gov.br', dataUltimoCsv: '31/07/2026' },
    { nome: 'Taipú', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://taipu.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'Touros', regiao: 'Litoral Norte', tecnologia: 'TopSolutions RN • CSV', url: 'https://touros.rn.gov.br', dataUltimoCsv: '12/10/2026' },
    { nome: 'Rio do Fogo', regiao: 'Litoral Norte', tecnologia: 'TopSolutions RN • CSV', url: 'https://riodofogo.rn.gov.br', dataUltimoCsv: '31/07/2026' }
  ];

  function normalizarTexto(txt) {
    if (!txt) return '';
    return String(txt)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  function normalizarMatriculaComparacao(matRaw) {
    return String(matRaw || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
  }

  function extrairMioloCpf(cpf) {
    if (!cpf) return '';
    const digits = String(cpf).replace(/\D/g, '');
    if (digits.length === 6) return digits;
    if (digits.length === 11) return digits.slice(3, 9);
    return digits.length >= 6 ? digits.slice(0, 6) : digits;
  }

  function parseCargaHoraria(ch) {
    if (!ch) return 30;
    const match = String(ch).match(/\d+/);
    if (match) {
      const val = parseInt(match[0], 10);
      return val > 0 ? val : 30;
    }
    return 30;
  }

  function auditarAcumulacaoCF37(cargoA, chA, cargoB, chB, enteA, enteB) {
    const chNumA = parseCargaHoraria(chA);
    const chNumB = parseCargaHoraria(chB);
    const chTotal = chNumA + chNumB;

    const normA = normalizarTexto(cargoA);
    const normB = normalizarTexto(cargoB);

    const isDocenteA = normA.includes('PROFESSOR') || normA.includes('DOCENTE') || normA.includes('PEDAGOGO') || normA.includes('EDUCADOR') || normA.includes('MAGISTERIO');
    const isDocenteB = normB.includes('PROFESSOR') || normB.includes('DOCENTE') || normB.includes('PEDAGOGO') || normB.includes('EDUCADOR') || normB.includes('MAGISTERIO');

    const isTecnicoA = (normA.includes('TECNICO') || normA.includes('ANALISTA') || normA.includes('ESPECIALISTA')) && !isDocenteA;
    const isTecnicoB = (normB.includes('TECNICO') || normB.includes('ANALISTA') || normB.includes('ESPECIALISTA')) && !isDocenteB;

    let enquadramento = 'Não enquadrado nas exceções constitucionais de acumulação remunerada';
    let legal = false;

    if (isDocenteA && isDocenteB) {
      legal = true;
      enquadramento = "Art. 37, XVI, 'a' da CF/88 (dois cargos de professor)";
    } else if ((isDocenteA && isTecnicoB) || (isTecnicoA && isDocenteB)) {
      legal = true;
      enquadramento = "Art. 37, XVI, 'b' da CF/88 (um cargo de professor com outro técnico ou científico)";
    }

    let parecer = '';
    if (!legal) {
      parecer = 'Vínculos incompatíveis com o caput do Art. 37, XVI da CF/88. Acumulação remunerada não autorizada entre ' + (enteA || 'Ceará-Mirim') + ' e ' + (enteB || 'ente externo') + '.';
    } else if (chTotal > 60) {
      legal = false;
      parecer = 'Alerta de incompatibilidade: a soma das cargas horárias (' + chNumA + 'h + ' + chNumB + 'h = ' + chTotal + 'h semanais) ultrapassa o teto de 60h semanais do TCU/STJ.';
    } else {
      parecer = 'Acumulação lícita e regular conforme ' + enquadramento + '. Carga horária total acumulada de ' + chTotal + 'h semanais dentro do teto constitucional de 60 horas.';
    }

    return {
      carga_horaria_total: chTotal,
      acumulacao_legal: legal,
      enquadramento: enquadramento,
      parecer_hera: parecer
    };
  }

  /**
   * Retorna a coleção consolidada e sincronizada de servidores para o Papiro de Cadmo.
   * Unifica os 5 Entes Monitorados (Ceará-Mirim, SEEC-RN, Natal, Parnamirim e SGA)
   * e todos os quadros (Docente, Administrativo, Apoio, Técnico, Operacional).
   * @returns {Array<Object>} Lista de servidores deduplicada
   */
  function obterColecaoServidoresCadmo() {
    const servidoresMap = new Map();

    function registrar(s, entePadrao) {
      if (!s) return;
      const nome = s.nome || s.n;
      if (!nome) return;
      const mat = s.matricula || s.m || '';
      const cargo = s.cargo || s.g || 'Servidor Público';
      const ente = s.ente || s.orgao || entePadrao || 'Ceará-Mirim';
      const ch = s.h || (s.cargaHoraria ? s.cargaHoraria + 'h' : '30h');
      const lot = s.lotacao || s.l || '';
      const quadro = s.quadro || 'Docente';
      const key = normalizarTexto(nome) + '|' + normalizarMatriculaComparacao(mat);

      if (!servidoresMap.has(key)) {
        servidoresMap.set(key, {
          n: String(nome).trim(),
          nome: String(nome).trim(),
          m: String(mat).trim(),
          matricula: String(mat).trim(),
          g: String(cargo).trim(),
          cargo: String(cargo).trim(),
          h: String(ch).trim(),
          cargaHorariaTexto: String(ch).trim(),
          l: String(lot).trim(),
          lotacao: String(lot).trim(),
          ente: String(ente).trim(),
          quadro: quadro
        });
      }
    }

    // 1. Base Ceará-Mirim (preserva retrocompatibilidade)
    (DOCENTES_CEARA_MIRIM || []).forEach(function(d) {
      registrar(d, 'SMEB Ceará-Mirim');
    });

    // 2. Servidores do Governo do Estado (SEEC/RN)
    (SERVIDORES_ESTADO_RN || []).forEach(function(d) {
      registrar(d, 'Governo do Estado (SEEC)');
    });

    // 3. Catálogo Unificado Olympos (5 Entes: Ceará-Mirim, RN, Natal, Parnamirim, SGA)
    const unificados = (typeof window !== 'undefined' && window.OlymposServidores && typeof window.OlymposServidores.obterTodos === 'function')
      ? window.OlymposServidores.obterTodos()
      : (typeof global !== 'undefined' && global.OlymposServidores && typeof global.OlymposServidores.obterTodos === 'function' ? global.OlymposServidores.obterTodos() : []);

    (unificados || []).forEach(function(s) {
      registrar(s, s.ente || 'Público');
    });

    return Array.from(servidoresMap.values());
  }

  /**
   * Sincroniza a coleção de servidores unificada atualizando o datalist do formulário,
   * badges estatísticos e os cruzamentos de vínculos.
   * @param {boolean} [notificarUsuario=false] Se true, emite toast de confirmação
   */
  function sincronizarServidoresUnificados(notificarUsuario) {
    popularDatalistServidores();
    const servidores = obterColecaoServidoresCadmo();

    // Atualiza badge de contagem se existir
    const badgeRef = document.getElementById('cadmoBadgeBaseRef');
    if (badgeRef) {
      badgeRef.innerHTML = '<span class="status-dot"></span> ' + servidores.length + ' Servidores Sincronizados (5 Entes Monitorados)';
    }

    if (notificarUsuario && typeof window !== 'undefined' && window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Papiro de Cadmo: ' + servidores.length + ' servidores sincronizados com sucesso!', false);
    }

    return servidores;
  }

  function popularDatalistServidores() {
    const datalist = document.getElementById('listaServidoresCearaMirim');
    if (!datalist) return;
    datalist.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const servidores = obterColecaoServidoresCadmo();
    servidores.forEach(function(d) {
      const opt = document.createElement('option');
      opt.value = d.n;
      opt.label = d.m + ' • ' + d.g + ' (' + (d.ente ? d.ente + ' - ' : '') + d.h + ')';
      opt.dataset.matricula = d.m;
      opt.dataset.cargo = d.g;
      opt.dataset.ch = d.h;
      opt.dataset.lotacao = d.l || '';
      opt.dataset.ente = d.ente || '';
      opt.dataset.quadro = d.quadro || '';
      fragment.appendChild(opt);
    });
    datalist.appendChild(fragment);
  }

  function configurarAutofillServidor() {
    const inputNome = document.getElementById('permutaNome');
    if (!inputNome || inputNome._autofillBound) return;
    inputNome._autofillBound = true;

    function preencher(valRaw) {
      if (!valRaw) return;
      const termo = normalizarTexto(valRaw);
      const valTrim = String(valRaw).trim();
      const colecao = obterColecaoServidoresCadmo();

      const achado = colecao.find(function(d) {
        const dNomeNorm = normalizarTexto(d.n || d.nome);
        const dMat = String(d.m || d.matricula || '').trim();
        return dNomeNorm === termo ||
               dMat === valTrim ||
               (valTrim.length >= 3 && dMat.includes(valTrim)) ||
               (valTrim.length > 5 && dNomeNorm.includes(termo));
      });

      if (achado) {
        const inMat = document.getElementById('permutaMatricula');
        if (inMat) inMat.value = achado.m || achado.matricula;

        const selCH = document.getElementById('permutaCargaHoraria');
        if (selCH) {
          const chRaw = achado.h || (achado.cargaHoraria ? achado.cargaHoraria + 'h' : '30h');
          const chFormat = chRaw.includes('h') ? chRaw : (chRaw + 'h');
          for (let i = 0; i < selCH.options.length; i++) {
            if (selCH.options[i].value === chFormat) {
              selCH.selectedIndex = i;
              break;
            }
          }
        }

        const selCargo = document.getElementById('permutaCargo');
        if (selCargo) {
          const gNorm = normalizarTexto(achado.g || achado.cargo);
          if (gNorm.includes('INFANTIL')) {
            selCargo.value = 'Professor de Educação Infantil';
          } else if (gNorm.includes('INICIAIS') || gNorm.includes('MAGISTERIO') || gNorm.includes('POLIVALENTE')) {
            selCargo.value = 'Professor dos Anos Iniciais';
          } else if (gNorm.includes('PEDAGOGO') || gNorm.includes('ESPECIALISTA')) {
            selCargo.value = 'Especialista em Educação';
          } else if (gNorm.includes('APOIO') || gNorm.includes('ASSISTENTE')) {
            selCargo.value = 'Assistente de Apoio Pedagógico';
          } else {
            selCargo.value = 'Professor dos Anos Finais';
          }
        }

        const selDisc = document.getElementById('permutaDisciplina');
        if (selDisc) {
          const gNorm = normalizarTexto(achado.g || achado.cargo);
          if (gNorm.includes('MATEMATICA')) selDisc.value = 'Matemática';
          else if (gNorm.includes('PORTUGUES')) selDisc.value = 'Língua Portuguesa';
          else if (gNorm.includes('HISTORIA')) selDisc.value = 'História';
          else if (gNorm.includes('GEOGRAFIA')) selDisc.value = 'Geografia';
          else if (gNorm.includes('CIENCIAS') || gNorm.includes('BIOLOGICAS')) selDisc.value = 'Ciências Biológicas';
          else if (gNorm.includes('INGLES')) selDisc.value = 'Língua Inglesa';
          else if (gNorm.includes('FISICA')) selDisc.value = 'Educação Física';
          else if (gNorm.includes('ARTES')) selDisc.value = 'Artes';
          else selDisc.value = 'Polivalente / Pedagogia';
        }

        const selOrig = document.getElementById('permutaEscolaOrigem');
        if (selOrig && (achado.l || achado.lotacao)) {
          const lotRaw = achado.l || achado.lotacao;
          const lotNorm = normalizarTexto(lotRaw);
          for (let i = 0; i < selOrig.options.length; i++) {
            const optNorm = normalizarTexto(selOrig.options[i].value);
            if (lotNorm.includes(optNorm) || optNorm.includes(lotNorm)) {
              selOrig.selectedIndex = i;
              break;
            }
          }
        }
      }
    }

    inputNome.addEventListener('input', function(e) {
      preencher(e.target.value);
    });
    inputNome.addEventListener('change', function(e) {
      preencher(e.target.value);
    });
  }

  function configurarUploadCsv() {
    const btn = document.getElementById('btnCarregarCsvTransparencia');
    const input = document.getElementById('cadmoUploadCsvInput');
    if (!btn || !input || btn._uploadBound) return;
    btn._uploadBound = true;

    btn.addEventListener('click', function() {
      input.click();
    });

    input.addEventListener('change', function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        const text = evt.target.result;
        processarArquivoCsv(text, file.name);
      };
      reader.onerror = function() {
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Erro ao ler arquivo CSV.', true);
        }
      };
      reader.readAsText(file, 'utf-8');
      input.value = '';
    });
  }

  function processarArquivoCsv(textoCsv, nomeArquivo) {
    try {
      const linhas = textoCsv.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
      if (linhas.length < 2) {
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Arquivo CSV vazio ou sem linhas suficientes.', true);
        }
        return;
      }

      // Detecta separador (; ou , ou \t)
      let sep = ';';
      if (linhas[0].includes(';') || (linhas[2] && linhas[2].includes(';'))) sep = ';';
      else if (linhas[0].includes(',') || (linhas[2] && linhas[2].includes(','))) sep = ',';
      else if (linhas[0].includes('\t')) sep = '\t';

      // Detecta linha de cabeçalho
      let headerIdx = 0;
      for (let i = 0; i < Math.min(10, linhas.length); i++) {
        const lNorm = normalizarTexto(linhas[i]);
        if (lNorm.includes('MATRICULA') || lNorm.includes('NOME') || lNorm.includes('CPF') || lNorm.includes('CARGO')) {
          headerIdx = i;
          break;
        }
      }

      const headers = linhas[headerIdx].split(sep).map(function(h) {
        return normalizarTexto(h.replace(/["']/g, ''));
      });

      const idxMat = headers.findIndex(function(h) { return h.includes('MATRICULA'); });
      const idxNome = headers.findIndex(function(h) { return h.includes('NOME') || h.includes('SERVIDOR'); });
      const idxCpf = headers.findIndex(function(h) { return h.includes('CPF'); });
      const idxCargo = headers.findIndex(function(h) { return h.includes('CARGO'); });
      const idxCH = headers.findIndex(function(h) { return h.includes('CARGA') || h.includes('CH') || h.includes('JORNADA'); });
      const idxLot = headers.findIndex(function(h) { return h.includes('LOTACAO') || h.includes('ORGAO') || h.includes('SECRETARIA'); });
      const idxStatus = headers.findIndex(function(h) { return h.includes('SITUACAO') || h.includes('VINCULO') || h.includes('STATUS') || h.includes('INATIVACAO'); });

      if (idxNome === -1) {
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Coluna de Nome não identificada no CSV.', true);
        }
        return;
      }

      const novosServidores = [];
      for (let i = headerIdx + 1; i < linhas.length; i++) {
        const cols = linhas[i].split(sep).map(function(c) { return c.replace(/^["']|["']$/g, '').trim(); });
        if (cols.length <= idxNome) continue;
        const nome = cols[idxNome];
        if (!nome) continue;

        const mat = idxMat !== -1 ? cols[idxMat] : ('00' + (i * 13));
        const cpf = idxCpf !== -1 ? cols[idxCpf] : '';
        const cargo = idxCargo !== -1 ? cols[idxCargo] : 'PROFESSOR';
        const ch = idxCH !== -1 ? cols[idxCH] : '30h';
        const lot = idxLot !== -1 ? cols[idxLot] : '';
        const status = idxStatus !== -1 ? cols[idxStatus] : 'Ativo';

        novosServidores.push({
          m: mat,
          n: nome.toUpperCase(),
          c: cpf,
          g: cargo.toUpperCase(),
          h: ch || '30h',
          l: lot,
          status: status
        });
      }

      // Verifica se o arquivo é da folha de Ceará-Mirim ou de outro ente
      const isCearaMirim = normalizarTexto(nomeArquivo).includes('CEARA') || normalizarTexto(linhas[0]).includes('CEARA MIRIM');

      if (isCearaMirim) {
        const servidoresValidos = novosServidores.filter(function(s) {
          return !normalizarTexto(s.status).includes('INATIVO') && !normalizarTexto(s.status).includes('EXONERADO');
        });
        if (servidoresValidos.length > 0) {
          DOCENTES_CEARA_MIRIM = servidoresValidos;
          popularDatalistServidores();
        }
        const badgeRef = document.getElementById('cadmoBadgeBaseRef');
        if (badgeRef) {
          badgeRef.textContent = 'Ceará-Mirim (' + novosServidores.length + ' servidores carregados via ' + nomeArquivo + ')';
        }
        if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
          window.OlymposApp.showToast('Base de Ceará-Mirim atualizada com sucesso (' + novosServidores.length + ' servidores)!');
        }
      } else {
        // Ente externo: realiza cruzamento dinâmico
        const nomeEnte = nomeArquivo.replace(/\.csv$/i, '').replace(/[-_]/g, ' ').toUpperCase();
        let novosCruzamentos = 0;

        novosServidores.forEach(function(ext) {
          const normExt = normalizarTexto(ext.n);
          const mioloExt = extrairMioloCpf(ext.c);

          const matchCeara = DOCENTES_CEARA_MIRIM.find(function(c) {
            if (normalizarTexto(c.n) !== normExt) return false;
            const mioloC = extrairMioloCpf(c.c);
            if (mioloC && mioloExt && mioloC !== mioloExt) return false;
            return true;
          });

          if (matchCeara) {
            const audit = auditarAcumulacaoCF37(matchCeara.g, matchCeara.h, ext.g, ext.h, 'Ceará-Mirim', nomeEnte);
            VINCULOS_TRANSPARENCIA.unshift({
              servidor_referencia: {
                municipio: 'Ceará-Mirim',
                matricula: matchCeara.m,
                nome_completo: matchCeara.n,
                cpf_mascarado: matchCeara.c,
                cpf_miolo: extrairMioloCpf(matchCeara.c),
                cargo: matchCeara.g,
                escola_origem: matchCeara.l || 'SMEB Ceará-Mirim',
                carga_horaria: parseCargaHoraria(matchCeara.h),
                status: 'ATIVO'
              },
              vinculo_externo_detectado: {
                ente_origem: nomeEnte,
                matricula: ext.m,
                cargo: ext.g,
                lotacao_orgao: ext.l || nomeEnte,
                carga_horaria: parseCargaHoraria(ext.h),
                situacao_vinculo: ext.status || 'ATIVO'
              },
              auditoria_constitucional: audit,
              potencial_permuta: {
                polo_parceiro: 'Polo ' + nomeEnte,
                otimizacao_logistica: 'Oportunidade de permuta com redução de trajeto vinculada a ' + nomeEnte + '.'
              }
            });
            novosCruzamentos++;
          }
        });

        if (novosCruzamentos > 0) {
          alternarAbaResultados('vinculos');
          executarCruzamentoVinculosHera();
          if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
            window.OlymposApp.showToast('Cruzamento de vínculos: ' + novosCruzamentos + ' correspondência(s) encontrada(s) em ' + nomeEnte + '!');
          }
        } else {
          if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
            window.OlymposApp.showToast('Nenhum servidor com acúmulo correspondente localizado nesta planilha.');
          }
        }
      }
    } catch (err) {
      console.error('[PapiroCadmo] Erro ao processar CSV:', err);
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Erro ao processar estrutura do CSV: ' + err.message, true);
      }
    }
  }

  function init() {
    bindEvents();
    renderizarPortais('');
    if (!isStatusLoaded) {
      carregarStatusDrive();
    }
    garantirBancoPermutasInicial();
    popularDatalistServidores();
    configurarAutofillServidor();
    configurarUploadCsv();
    popularSelectsFormularioPermuta();
    inicializarMapa();
    executarMatchingHera();
    observarVisibilidadePagina();
    alternarColapsoHera(false);
    sincronizarServidoresUnificados(false);
    const totalServidoresSincronizados = obterColecaoServidoresCadmo().length;
    console.log('[Olympos Permutas] Bases carregadas: ' + totalServidoresSincronizados + ' servidores sincronizados (5 Entes), ' + (VINCULOS_TRANSPARENCIA || []).length + ' cruzamentos de vínculos.');
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
        if (abaAtiva === 'vinculos') {
          executarCruzamentoVinculosHera();
        } else {
          executarMatchingHera();
        }
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
        const abrirIntencao = wrapper.classList.contains('hidden');
        alternarModoPainelSuperior(abrirIntencao ? 'intencao' : 'consulta');
      });
    }

    const btnModoConsulta = document.getElementById('btnModoConsultaServidor');
    if (btnModoConsulta && !btnModoConsulta._bound) {
      btnModoConsulta._bound = true;
      btnModoConsulta.addEventListener('click', function() {
        alternarModoPainelSuperior('consulta');
      });
    }

    const btnModoIntencao = document.getElementById('btnModoIntencaoPermuta');
    if (btnModoIntencao && !btnModoIntencao._bound) {
      btnModoIntencao._bound = true;
      btnModoIntencao.addEventListener('click', function() {
        alternarModoPainelSuperior('intencao');
      });
    }

    const formConsultaSrv = document.getElementById('formConsultaServidorCadmo');
    const inConsultaSrv = document.getElementById('consultaServidorInput');
    const btnLimparConsultaSrv = document.getElementById('btnLimparConsultaServidor');

    if (formConsultaSrv && !formConsultaSrv._bound) {
      formConsultaSrv._bound = true;
      formConsultaSrv.addEventListener('submit', function(e) {
        e.preventDefault();
        executarConsultaServidorCard(inConsultaSrv ? inConsultaSrv.value : '');
      });
    }

    if (inConsultaSrv && !inConsultaSrv._bound) {
      inConsultaSrv._bound = true;
      inConsultaSrv.addEventListener('input', function() {
        const val = (inConsultaSrv.value || '').trim();
        if (!val) {
          limparConsultaServidorCard();
        } else if (val.length >= 2) {
          executarConsultaServidorCard(val);
        }
      });
    }

    if (btnLimparConsultaSrv && !btnLimparConsultaSrv._bound) {
      btnLimparConsultaSrv._bound = true;
      btnLimparConsultaSrv.addEventListener('click', function() {
        limparConsultaServidorCard();
      });
    }

    const tabPermutas = document.getElementById('tabAbaPermutas');
    const tabVinculos = document.getElementById('tabAbaVinculos');
    const tabDocentes = document.getElementById('tabAbaDocentesGeral');
    if (tabPermutas && !tabPermutas._bound) {
      tabPermutas._bound = true;
      tabPermutas.addEventListener('click', function() {
        alternarAbaResultados('permutas');
      });
    }
    if (tabVinculos && !tabVinculos._bound) {
      tabVinculos._bound = true;
      tabVinculos.addEventListener('click', function() {
        alternarAbaResultados('vinculos');
      });
    }
    if (tabDocentes && !tabDocentes._bound) {
      tabDocentes._bound = true;
      tabDocentes.addEventListener('click', function() {
        alternarAbaResultados('docentes');
      });
    }

    // Campo de busca em tempo real de servidores em permutas
    const inBuscaServidor = document.getElementById('cadmoBuscaServidorInput');
    const btnLimparBusca = document.getElementById('btnLimparBuscaServidor');
    const btnRemoverFiltro = document.getElementById('btnRemoverFiltroPesquisa');

    if (inBuscaServidor && !inBuscaServidor._bound) {
      inBuscaServidor._bound = true;
      inBuscaServidor.addEventListener('input', function(e) {
        termoBuscaServidor = (e.target.value || '').trim();
        if (termoBuscaServidor) {
          console.log('[Olympos Permutas] Pesquisa de servidor disparada para: "' + termoBuscaServidor + '"');
        }
        if (btnLimparBusca) {
          if (termoBuscaServidor) {
            btnLimparBusca.classList.remove('hidden');
            btnLimparBusca.style.display = 'block';
          } else {
            btnLimparBusca.classList.add('hidden');
            btnLimparBusca.style.display = 'none';
          }
        }
        renderizarAbaAtivaComFiltro();
      });
    }

    if (btnLimparBusca && !btnLimparBusca._bound) {
      btnLimparBusca._bound = true;
      btnLimparBusca.addEventListener('click', function() {
        limparBuscaServidor();
      });
    }

    if (btnRemoverFiltro && !btnRemoverFiltro._bound) {
      btnRemoverFiltro._bound = true;
      btnRemoverFiltro.addEventListener('click', function() {
        limparBuscaServidor();
      });
    }

    // Trigger de alternância do container colapsável Hera
    const heraHeader = document.getElementById('heraCollapsibleHeader');
    if (heraHeader && !heraHeader._bound) {
      heraHeader._bound = true;
      heraHeader.addEventListener('click', function() {
        alternarColapsoHera();
      });
      heraHeader.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          alternarColapsoHera();
        }
      });
    }

    const btnToggleHera = document.getElementById('btnToggleHeraMatching');
    if (btnToggleHera && !btnToggleHera._bound) {
      btnToggleHera._bound = true;
      btnToggleHera.addEventListener('click', function(e) {
        e.stopPropagation();
        alternarColapsoHera();
      });
    }

    // Eventos do Modal de Edição de Secretarias Parceiras
    const btnGerenciarSec = document.getElementById('btnGerenciarSecretarias');
    if (btnGerenciarSec && !btnGerenciarSec._bound) {
      btnGerenciarSec._bound = true;
      btnGerenciarSec.addEventListener('click', function() {
        abrirModalEdicaoSecretaria();
      });
    }

    const selectPontoModal = document.getElementById('editSecSelectPonto');
    if (selectPontoModal && !selectPontoModal._bound) {
      selectPontoModal._bound = true;
      selectPontoModal.addEventListener('change', function() {
        carregarDadosPontoNoModal(this.value);
      });
    }

    const btnFecharModalSec = document.getElementById('closeModalEdicaoSecretariaBtn');
    if (btnFecharModalSec && !btnFecharModalSec._bound) {
      btnFecharModalSec._bound = true;
      btnFecharModalSec.addEventListener('click', function() {
        fecharModalEdicaoSecretaria();
      });
    }

    const btnCancelarModalSec = document.getElementById('btnCancelarEdicaoSecretaria');
    if (btnCancelarModalSec && !btnCancelarModalSec._bound) {
      btnCancelarModalSec._bound = true;
      btnCancelarModalSec.addEventListener('click', function() {
        fecharModalEdicaoSecretaria();
      });
    }

    const btnRestaurarPadraoSec = document.getElementById('btnRestaurarPadraoSecretarias');
    if (btnRestaurarPadraoSec && !btnRestaurarPadraoSec._bound) {
      btnRestaurarPadraoSec._bound = true;
      btnRestaurarPadraoSec.addEventListener('click', function() {
        restaurarPadraoSecretarias();
      });
    }

    const formEdicaoSec = document.getElementById('formEdicaoSecretaria');
    if (formEdicaoSec && !formEdicaoSec._bound) {
      formEdicaoSec._bound = true;
      formEdicaoSec.addEventListener('submit', function(e) {
        salvarEdicaoSecretaria(e);
      });
    }

    const modalSec = document.getElementById('modalEdicaoSecretaria');
    if (modalSec && !modalSec._bound) {
      modalSec._bound = true;
      modalSec.addEventListener('click', function(e) {
        if (e.target === modalSec) {
          fecharModalEdicaoSecretaria();
        }
      });
    }

    window.addEventListener('resize', function() {
      if (leafletMap) {
        leafletMap.invalidateSize();
      }
    });
  }

  function alternarAbaResultados(aba) {
    abaAtiva = aba;
    const tabP = document.getElementById('tabAbaPermutas');
    const tabV = document.getElementById('tabAbaVinculos');
    const tabD = document.getElementById('tabAbaDocentesGeral');
    if (tabP) {
      if (aba === 'permutas') tabP.classList.add('active');
      else tabP.classList.remove('active');
    }
    if (tabV) {
      if (aba === 'vinculos') tabV.classList.add('active');
      else tabV.classList.remove('active');
    }
    if (tabD) {
      if (aba === 'docentes') tabD.classList.add('active');
      else tabD.classList.remove('active');
    }

    renderizarAbaAtivaComFiltro();
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
      // Saneamento: se for nulo, vazio ou contiver os dados fictícios legados (ex: 2026-1042 ou Mariana Medeiros), atualiza com a base real
      if (!gravado || gravado === '[]' || gravado.includes('2026-1042') || gravado.includes('Mariana Medeiros')) {
        localStorage.setItem(BANCO_STORAGE_KEY, JSON.stringify(BANCO_INICIAL_PERMUTAS));
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
        if (Array.isArray(arr) && arr.length > 0) {
          // Filtra entradas legadas do mock fictício se ainda existirem
          const filtrado = arr.filter(function(item) {
            const mat = String(item.matricula || '');
            const nome = String(item.nome || '');
            return !mat.startsWith('2026-') && !nome.includes('Mariana Medeiros') && !nome.includes('Carlos Eduardo Nogueira');
          });
          if (filtrado.length > 0) return filtrado;
        }
      }
    } catch (e) {
      console.warn('[PapiroCadmo] Erro ao analisar banco de permutas:', e);
    }
    return BANCO_INICIAL_PERMUTAS.slice();
  }

  function extrairMunicipioOrigem(nomeOrigem) {
    const str = String(nomeOrigem || '').toLowerCase();
    if (str.includes('governo do estado') || str.includes('seec') || str.includes('estadual')) return 'Governo do Estado (SEEC)';
    if (str.includes('ceará-mirim') || str.includes('ceara-mirim') || str.includes('smeb')) return 'Ceará-Mirim';
    if (str.includes('natal')) return 'Natal';
    if (str.includes('extremoz')) return 'Extremoz';
    if (str.includes('são gonçalo') || str.includes('sao goncalo') || str.includes('sga')) return 'São Gonçalo do Amarante';
    if (str.includes('macaíba') || str.includes('macaiba')) return 'Macaíba';
    if (str.includes('parnamirim')) return 'Parnamirim';
    if (str.includes('nísia') || str.includes('nisia')) return 'Nísia Floresta';
    if (str.includes('monte alegre')) return 'Monte Alegre';
    if (str.includes('ielmo marinho') || str.includes('ielmo')) return 'Ielmo Marinho';
    if (str.includes('potengi') || str.includes('são paulo') || str.includes('sao paulo')) return 'São Paulo do Potengi';
    if (str.includes('joão câmara') || str.includes('joao camara') || str.includes('câmara') || str.includes('camara')) return 'João Câmara';
    if (str.includes('poço branco') || str.includes('poco branco')) return 'Poço Branco';
    if (str.includes('taipú') || str.includes('taipu')) return 'Taipú';
    if (str.includes('touros')) return 'Touros';
    if (str.includes('rio do fogo')) return 'Rio do Fogo';
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

    const todosPontos = obterTodosPontosMapa();

    todosPontos.forEach(function(ponto) {
      const isSede = ponto.tipo.includes('Sede');
      const isSecretaria = ponto.tipo.includes('Secretaria Municipal') || (ponto.id && ponto.id.startsWith('sme_'));
      const iconeDisplay = ponto.icone || (isSede ? '★' : (isSecretaria ? '🏛️' : 'E'));

      const markerHtml =
        '<div style="background:' + ponto.cor + '; width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: ' + (isSecretaria && !isSede ? '11px' : '10px') + '; color: #fff; font-weight: bold;">' +
        iconeDisplay +
        '</div>';

      const customIcon = window.L.divIcon({
        className: 'cadmo-leaflet-divicon',
        html: markerHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14]
      });

      const badgeTipo = isSede
        ? '<span class="pill-badge pill-gold" style="font-size:10px;">★ Sede SMEB</span>'
        : (isSecretaria
          ? '<span class="pill-badge pill-green" style="font-size:10px;">🏛️ Secretaria Parceira</span>'
          : '<span class="pill-badge pill-blue" style="font-size:10px;">🏫 Rede Municipal</span>');

      const btnEditarSec = (isSecretaria || isSede)
        ? '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10.5px; padding:3px 8px; border-color: var(--brand-gold, #D4AF37); color: var(--brand-gold, #D4AF37);" onclick="window.OlymposViews.papiroCadmo.abrirModalEdicaoSecretaria(\'' + window.OlymposApp.escapeHtml(ponto.id) + '\')">✏️ Editar Polo</button>'
        : '';

      const popupContent =
        '<div class="cadmo-map-popup" style="font-family: var(--font-body, sans-serif); min-width: 230px; padding: 4px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:6px;">' +
            '<div style="display:flex; align-items:center; gap:6px;">' +
              '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + ponto.cor + ';"></span>' +
              '<strong style="font-size:12.5px; color: #0B1120;">' + window.OlymposApp.escapeHtml(ponto.nomeSimples || ponto.nome) + '</strong>' +
            '</div>' +
            badgeTipo +
          '</div>' +
          '<div style="font-size:11.5px; color: #475569; margin-bottom:6px;">' +
            'Município: <strong>' + window.OlymposApp.escapeHtml(ponto.municipio) + '</strong> • ' + window.OlymposApp.escapeHtml(ponto.tipo) +
            (ponto.inep ? ('<br/><span style="color:#64748B;">INEP: ' + window.OlymposApp.escapeHtml(ponto.inep) + '</span>') : '') +
            (ponto.endereco ? ('<br/><span style="color:#64748B;">End: ' + window.OlymposApp.escapeHtml(ponto.endereco) + '</span>') : '') +
            (ponto.contato ? ('<br/><span style="color:#64748B;">Contato: ' + window.OlymposApp.escapeHtml(ponto.contato) + '</span>') : '') +
          '</div>' +
          '<div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">' +
            '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10.5px; padding:3px 8px;" onclick="window.OlymposViews.papiroCadmo.definirOrigemForm(\'' + window.OlymposApp.escapeHtml(ponto.nome) + '\')">Definir Origem</button>' +
            '<button type="button" class="btn btn-primary btn-sm" style="font-size:10.5px; padding:3px 8px;" onclick="window.OlymposViews.papiroCadmo.definirDestinoForm(\'' + window.OlymposApp.escapeHtml(ponto.municipio) + '\')">Definir Destino</button>' +
            btnEditarSec +
          '</div>' +
        '</div>';

      const marker = window.L.marker(ponto.coords, { icon: customIcon }).bindPopup(popupContent);
      markersLayer.addLayer(marker);
    });
  }

  function popularSelectsFormularioPermuta() {
    const selOrig = document.getElementById('permutaEscolaOrigem');
    const selDest = document.getElementById('permutaPoloDestino');
    const secretarias = obterPontosSecretarias();

    if (selOrig) {
      const valorOrigAtual = selOrig.value;
      const escolas = obterEscolasDinamicasCadmo();

      let htmlOrig = '<optgroup label="Ceará-Mirim — SMEB (Sede &amp; Escolas da Rede)">';
      htmlOrig += '<option value="SMEB Sede (Ceará-Mirim)">SMEB Sede (Ceará-Mirim)</option>';
      escolas.forEach(function(esc) {
        if (esc.nome && esc.nome.includes('SMEB Sede')) return;
        const val = esc.nome + ' (Ceará-Mirim)';
        htmlOrig += '<option value="' + window.OlymposApp.escapeHtml(val) + '">' + window.OlymposApp.escapeHtml(val) + '</option>';
      });
      htmlOrig += '</optgroup>';

      htmlOrig += '<optgroup label="Governo do Estado do RN">';
      htmlOrig += '<option value="Governo do Estado do RN (SEEC)">Governo do Estado do RN (SEEC)</option>';
      htmlOrig += '</optgroup>';

      htmlOrig += '<optgroup label="Secretarias Municipais Parceiras (Polos Intermunicipais)">';
      secretarias.forEach(function(sec) {
        if (sec.municipio === 'Ceará-Mirim') return;
        htmlOrig += '<option value="' + window.OlymposApp.escapeHtml(sec.nome) + '">' + window.OlymposApp.escapeHtml(sec.nome) + '</option>';
      });
      htmlOrig += '</optgroup>';

      selOrig.innerHTML = htmlOrig;
      if (valorOrigAtual) selOrig.value = valorOrigAtual;
    }

    if (selDest) {
      const valorDestAtual = selDest.value;
      let htmlDest = '';
      secretarias.forEach(function(sec) {
        let desc = '';
        if (sec.id === 'seec_rn' || sec.municipio.includes('Governo')) {
          desc = 'Governo do Estado do RN (SEEC)';
        } else if (sec.municipio === 'Ceará-Mirim') {
          desc = 'Ceará-Mirim (Rede Municipal SMEB)';
        } else {
          desc = sec.municipio + ' (' + sec.nome.split('(')[0].trim() + ')';
        }
        htmlDest += '<option value="' + window.OlymposApp.escapeHtml(sec.municipio) + '">' + window.OlymposApp.escapeHtml(desc) + '</option>';
      });
      selDest.innerHTML = htmlDest;
      if (valorDestAtual) selDest.value = valorDestAtual;
    }
  }

  function alternarColapsoHera(forcado) {
    const body = document.getElementById('heraCollapsibleBody');
    const header = document.getElementById('heraCollapsibleHeader');
    const btnToggle = document.getElementById('btnToggleHeraMatching');
    const label = document.getElementById('heraToggleLabel');
    if (!body || !header) return;

    const isCurrentlyCollapsed = body.classList.contains('is-collapsed');
    const newStateCollapsed = typeof forcado === 'boolean' ? forcado : !isCurrentlyCollapsed;

    body.classList.toggle('is-collapsed', newStateCollapsed);
    if (newStateCollapsed) {
      body.style.display = 'none';
    } else {
      body.style.display = '';
    }
    header.setAttribute('aria-expanded', String(!newStateCollapsed));
    if (btnToggle) btnToggle.classList.toggle('hera-chevron-rotated', newStateCollapsed);
    if (label) label.textContent = newStateCollapsed ? 'Expandir' : 'Recolher';
  }

  function abrirModalEdicaoSecretaria(pontoId) {
    const modal = document.getElementById('modalEdicaoSecretaria');
    if (!modal) return;

    const selectPonto = document.getElementById('editSecSelectPonto');
    const secretarias = obterPontosSecretarias();

    if (selectPonto) {
      let optionsHtml = '';
      secretarias.forEach(function(p) {
        optionsHtml += '<option value="' + window.OlymposApp.escapeHtml(p.id) + '">' +
          window.OlymposApp.escapeHtml(p.nome) + ' (' + window.OlymposApp.escapeHtml(p.municipio) + ')' +
          '</option>';
      });
      selectPonto.innerHTML = optionsHtml;
    }

    const idAlvo = pontoId || (secretarias[0] ? secretarias[0].id : 'sme_ceara_mirim');
    carregarDadosPontoNoModal(idAlvo);

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function fecharModalEdicaoSecretaria() {
    const modal = document.getElementById('modalEdicaoSecretaria');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  function carregarDadosPontoNoModal(pontoId) {
    const secretarias = obterPontosSecretarias();
    const ponto = secretarias.find(function(p) { return p.id === pontoId; }) || secretarias[0];
    if (!ponto) return;

    const inputId = document.getElementById('editSecId');
    const inputNome = document.getElementById('editSecNome');
    const inputMun = document.getElementById('editSecMunicipio');
    const inputContato = document.getElementById('editSecContato');
    const inputLat = document.getElementById('editSecLat');
    const inputLng = document.getElementById('editSecLng');
    const selectPonto = document.getElementById('editSecSelectPonto');

    if (inputId) inputId.value = ponto.id;
    if (inputNome) inputNome.value = ponto.nome || '';
    if (inputMun) inputMun.value = ponto.municipio || '';
    if (inputContato) inputContato.value = ponto.contato || '';
    if (inputLat && Array.isArray(ponto.coords)) inputLat.value = ponto.coords[0];
    if (inputLng && Array.isArray(ponto.coords)) inputLng.value = ponto.coords[1];
    if (selectPonto && selectPonto.value !== ponto.id) selectPonto.value = ponto.id;
  }

  function salvarEdicaoSecretaria(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const inputId = document.getElementById('editSecId');
    const inputNome = document.getElementById('editSecNome');
    const inputMun = document.getElementById('editSecMunicipio');
    const inputContato = document.getElementById('editSecContato');
    const inputLat = document.getElementById('editSecLat');
    const inputLng = document.getElementById('editSecLng');

    if (!inputId || !inputNome || !inputMun || !inputLat || !inputLng) return;

    const pontoId = inputId.value;
    const nome = inputNome.value.trim();
    const municipio = inputMun.value.trim();
    const contato = inputContato ? inputContato.value.trim() : '';
    const lat = parseFloat(inputLat.value);
    const lng = parseFloat(inputLng.value);

    if (!nome || !municipio) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Preencha o Nome e o Município da secretaria parceira.', 'error');
      }
      return;
    }

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Coordenadas de latitude e longitude inválidas.', 'error');
      }
      return;
    }

    const secretarias = obterPontosSecretarias();
    const idx = secretarias.findIndex(function(p) { return p.id === pontoId; });
    if (idx === -1) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Secretaria parceira não encontrada.', 'error');
      }
      return;
    }

    secretarias[idx].nome = nome;
    secretarias[idx].municipio = municipio;
    secretarias[idx].contato = contato;
    secretarias[idx].coords = [lat, lng];
    if (pontoId === 'sme_ceara_mirim') {
      secretarias[idx].nomeSimples = nome;
    }

    try {
      localStorage.setItem(STORAGE_KEY_SECRETARIAS, JSON.stringify(secretarias));
    } catch (err) {
      console.warn('[PapiroCadmo] Erro ao salvar no localStorage:', err);
    }

    if (window.OlymposSupabase && typeof window.OlymposSupabase.sincronizarSecretariaParceira === 'function') {
      window.OlymposSupabase.sincronizarSecretariaParceira(secretarias[idx]).catch(function(eSup) {
        console.warn('[PapiroCadmo] Falha na sincronização assíncrona da secretaria com Supabase:', eSup);
      });
    }

    plotarMarcadores();
    popularSelectsFormularioPermuta();
    fecharModalEdicaoSecretaria();

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Secretaria parceira "' + nome + '" salva com sucesso!', 'success');
    }
  }

  function restaurarPadraoSecretarias() {
    try {
      localStorage.removeItem(STORAGE_KEY_SECRETARIAS);
    } catch (err) {
      console.warn('[PapiroCadmo] Erro ao limpar localStorage:', err);
    }

    plotarMarcadores();
    popularSelectsFormularioPermuta();
    fecharModalEdicaoSecretaria();

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Pontos das 15 secretarias parceiras restaurados para os padrões originais!', 'info');
    }
  }

  function definirOrigemForm(nomePonto) {
    const sel = document.getElementById('permutaEscolaOrigem');
    if (!sel) return;
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === nomePonto || sel.options[i].text === nomePonto) {
        sel.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found) {
      for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.includes(nomePonto) || nomePonto.includes(sel.options[i].value)) {
          sel.selectedIndex = i;
          found = true;
          break;
        }
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
    const mNorm = String(municipio || '').toLowerCase().trim();
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value.toLowerCase() === mNorm || sel.options[i].text.toLowerCase().includes(mNorm)) {
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

    const sOrigA = String(munOrigA || '').toLowerCase();
    const sDestA = String(munDestA || '').toLowerCase();
    const sOrigB = String(munOrigB || '').toLowerCase();
    const sDestB = String(munDestB || '').toLowerCase();

    const rotaInversaExata = Boolean(sOrigA && sDestB && sOrigB && sDestA) &&
                             (sOrigA === sDestB) &&
                             (sOrigB === sDestA);

    if (rotaInversaExata) {
      ptsRota = 30;
    } else if ((sOrigA && sDestB && sOrigA === sDestB) || (sOrigB && sDestA && sOrigB === sDestA)) {
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

  // =========================================================================
  // MOTOR DE BUSCA EM TEMPO REAL DE SERVIDORES EM PERMUTAS
  // =========================================================================

  function normalizarBusca(txt) {
    if (!txt) return '';
    return String(txt)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  function filtrarMatchesPorTermo(matches, termo) {
    if (!termo) return matches;
    const q = normalizarBusca(termo);
    return matches.filter(function(m) {
      const a = m.candidatoA || {};
      const b = m.candidatoB || {};
      const corpusA = [a.nome, a.matricula, a.cargo, a.disciplina, a.origem, a.destino, a.municipioOrigem].map(normalizarBusca).join(' ');
      const corpusB = [b.nome, b.matricula, b.cargo, b.disciplina, b.origem, b.destino, b.municipioOrigem].map(normalizarBusca).join(' ');
      return corpusA.includes(q) || corpusB.includes(q);
    });
  }

  function filtrarVinculosPorTermo(vinculos, termo) {
    if (!termo) return vinculos;
    const q = normalizarBusca(termo);
    return vinculos.filter(function(v) {
      const sr = v.servidor_referencia || {};
      const ve = v.vinculo_externo_detectado || {};
      const corpusSr = [sr.nome_completo, sr.matricula, sr.cargo, sr.escola_origem, sr.municipio].map(normalizarBusca).join(' ');
      const corpusVe = [ve.ente_origem, ve.matricula, ve.cargo, ve.lotacao_orgao].map(normalizarBusca).join(' ');
      return corpusSr.includes(q) || corpusVe.includes(q);
    });
  }

  function filtrarDocentesPorTermo(docentes, termo) {
    if (!termo) return docentes;
    const q = normalizarBusca(termo);
    return docentes.filter(function(d) {
      const corpus = [d.n, d.m, d.g, d.l, d.h, d.ente || '', d.orgao || '', d.municipio || ''].map(normalizarBusca).join(' ');
      return corpus.includes(q);
    });
  }

  function atualizarResumoBusca(encontrados, total, tipo) {
    const row = document.getElementById('cadmoResumoBuscaRow');
    const texto = document.getElementById('cadmoResumoBuscaTexto');
    if (!row || !texto) return;

    if (termoBuscaServidor) {
      row.classList.remove('hidden');
      row.style.display = 'flex';
      const rotulo = tipo === 'permutas' ? 'oportunidade(s)' : (tipo === 'vinculos' ? 'vínculo(s)' : 'docente(s)');
      texto.innerHTML = 'Filtro ativo: "<strong>' + window.OlymposApp.escapeHtml(termoBuscaServidor) + '</strong>" — <strong>' + encontrados + '</strong> de ' + total + ' ' + rotulo + ' exibido(s)';
    } else {
      row.classList.add('hidden');
      row.style.display = 'none';
    }
  }

  function limparBuscaServidor() {
    termoBuscaServidor = '';
    const inBusca = document.getElementById('cadmoBuscaServidorInput');
    const btnLimpar = document.getElementById('btnLimparBuscaServidor');
    if (inBusca) inBusca.value = '';
    if (btnLimpar) {
      btnLimpar.classList.add('hidden');
      btnLimpar.style.display = 'none';
    }
    renderizarAbaAtivaComFiltro();
  }

  function renderizarAbaAtivaComFiltro() {
    if (abaAtiva === 'vinculos') {
      executarCruzamentoVinculosHera();
    } else if (abaAtiva === 'docentes') {
      executarListagemDocentesGeral();
    } else {
      executarMatchingHera();
    }
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

    const matchesFiltrados = filtrarMatchesPorTermo(matches, termoBuscaServidor);

    if (badgeTotal) {
      if (termoBuscaServidor) {
        badgeTotal.textContent = matchesFiltrados.length + ' de ' + matches.length + ' oportunidades';
      } else {
        badgeTotal.textContent = matches.length + (matches.length === 1 ? ' oportunidade' : ' oportunidades');
      }
    }

    const previewPill = document.getElementById('heraMatchPreviewPill');
    if (previewPill) {
      if (matchesFiltrados.length > 0) {
        previewPill.textContent = 'Top Match: ' + matchesFiltrados[0].resultado.score + '% (' + matchesFiltrados[0].resultado.nivel + ')';
        previewPill.classList.remove('hidden');
      } else {
        previewPill.classList.add('hidden');
      }
    }

    atualizarResumoBusca(matchesFiltrados.length, matches.length, 'permutas');

    if (matchesFiltrados.length === 0) {
      if (termoBuscaServidor) {
        container.innerHTML =
          '<div class="output-panel text-center" style="padding: 32px 20px;">' +
            '<div style="font-size: 1.8rem; margin-bottom: 8px;">🔍</div>' +
            '<strong style="display:block; font-size:15px; margin-bottom:6px; color:var(--text-main);">Nenhum servidor ou oportunidade de permuta localizada</strong>' +
            '<p style="font-size:13px; color:var(--text-muted); max-width:480px; margin:0 auto 14px;">Não foram identificadas permutas para o termo "<strong>' + window.OlymposApp.escapeHtml(termoBuscaServidor) + '</strong>". Tente buscar por matrícula funcional de 7 dígitos, nome, escola de lotação ou município.</p>' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="window.OlymposViews.papiroCadmo.limparBuscaServidor()">Limpar Busca</button>' +
          '</div>';
      } else {
        container.innerHTML =
          '<div class="output-panel text-center" style="padding: 32px 20px;">' +
            '<div style="font-size: 1.8rem; margin-bottom: 8px;">🤝</div>' +
            '<strong style="display:block; font-size:15px; margin-bottom:6px; color:var(--text-main);">Nenhum cruzamento de permuta recíproca identificado ainda</strong>' +
            '<p style="font-size:13px; color:var(--text-muted); max-width:480px; margin:0 auto 16px;">Cadastre novas intenções de permuta no formulário acima para que o motor de inteligência da persona Hera processe os cruzamentos recíprocos.</p>' +
          '</div>';
      }
      return;
    }

    let html = '<div class="hera-matches-grid">';
    matchesFiltrados.forEach(function(m, idx) {
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

  function executarCruzamentoVinculosHera() {
    const container = document.getElementById('resultadoMatchingHera');
    const badgeTotal = document.getElementById('badgeTotalMatches');
    if (!container) return;

    const vinculos = VINCULOS_TRANSPARENCIA || [];
    const vinculosFiltrados = filtrarVinculosPorTermo(vinculos, termoBuscaServidor);

    if (badgeTotal) {
      if (termoBuscaServidor) {
        badgeTotal.textContent = vinculosFiltrados.length + ' de ' + vinculos.length + ' vínculos';
      } else {
        badgeTotal.textContent = vinculos.length + (vinculos.length === 1 ? ' vínculo identificado' : ' vínculos identificados');
      }
    }

    const previewPill = document.getElementById('heraMatchPreviewPill');
    if (previewPill) {
      previewPill.textContent = 'Acúmulos: ' + vinculosFiltrados.length;
      previewPill.classList.remove('hidden');
    }

    atualizarResumoBusca(vinculosFiltrados.length, vinculos.length, 'vinculos');

    if (vinculosFiltrados.length === 0) {
      if (termoBuscaServidor) {
        container.innerHTML =
          '<div class="output-panel text-center" style="padding: 32px 20px;">' +
            '<div style="font-size: 1.8rem; margin-bottom: 8px;">🔍</div>' +
            '<strong style="display:block; font-size:15px; margin-bottom:6px; color:var(--text-main);">Nenhum vínculo externo localizado</strong>' +
            '<p style="font-size:13px; color:var(--text-muted); max-width:480px; margin:0 auto 14px;">Não foram identificados vínculos externos para o termo "<strong>' + window.OlymposApp.escapeHtml(termoBuscaServidor) + '</strong>". Tente buscar por matrícula funcional, nome do servidor ou ente parceiro.</p>' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="window.OlymposViews.papiroCadmo.limparBuscaServidor()">Limpar Busca</button>' +
          '</div>';
      } else {
        container.innerHTML =
          '<div class="output-panel text-center" style="padding: 32px 20px;">' +
            '<div style="font-size: 1.8rem; margin-bottom: 8px;">🏛️</div>' +
            '<strong style="display:block; font-size:15px; margin-bottom:6px; color:var(--text-main);">Nenhum vínculo externo localizado</strong>' +
            '<p style="font-size:13px; color:var(--text-muted); max-width:480px; margin:0 auto 16px;">Carregue arquivos CSV adicionais de outros entes federativos (SEEC/RN, Natal, Extremoz, etc.) para auditar acúmulos de cargo.</p>' +
          '</div>';
      }
      return;
    }

    let html = '<div class="hera-matches-grid">';
    vinculosFiltrados.forEach(function(v, idx) {
      const sr = v.servidor_referencia;
      const ve = v.vinculo_externo_detectado;
      const ac = v.auditoria_constitucional;
      const pp = v.potencial_permuta;

      const isLegal = ac.acumulacao_legal;
      const badgeConformidade = isLegal
        ? '<span class="pill-badge pill-green" style="font-size:11.5px;">⚖️ Em Conformidade (60h)</span>'
        : '<span class="pill-badge pill-red" style="font-size:11.5px;">⚠️ Alerta Inconformidade</span>';

      html +=
        '<div class="match-card-hera" id="vinculoCard_' + idx + '">' +
          '<div class="match-card-header">' +
            '<div style="display: flex; align-items: center; gap: 8px;">' +
              badgeConformidade +
              '<span class="pill-badge pill-gold" style="font-size:11px;">' + ac.carga_horaria_total + 'h semanais</span>' +
              '<span class="selo-hera-badge">CF/88 Art. 37, XVI</span>' +
            '</div>' +
            '<button type="button" class="btn btn-primary btn-sm" ' +
              'onclick="window.OlymposViews.papiroCadmo.preencherFormComVinculo(\'' + window.OlymposApp.escapeHtml(sr.nome_completo) + '\', \'' + window.OlymposApp.escapeHtml(sr.matricula) + '\', \'' + window.OlymposApp.escapeHtml(sr.cargo) + '\', \'' + sr.carga_horaria + 'h\', \'' + window.OlymposApp.escapeHtml(ve.ente_origem) + '\')">' +
              '⚡ Criar Intenção de Permuta' +
            '</button>' +
          '</div>' +

          '<div class="match-candidatos-row">' +
            '<div class="candidato-box">' +
              '<div class="candidato-badge-tag" style="background: var(--brand-gold-glow, rgba(212,175,55,0.15)); color: var(--brand-gold);">🏛️ Ceará-Mirim (Âncora Cadastral)</div>' +
              '<strong class="candidato-nome">' + window.OlymposApp.escapeHtml(sr.nome_completo) + '</strong>' +
              '<div class="candidato-meta">Matrícula: <strong>' + window.OlymposApp.escapeHtml(sr.matricula) + '</strong> • ' + sr.carga_horaria + 'h semanais (CPF: ' + window.OlymposApp.escapeHtml(sr.cpf_mascarado) + ')</div>' +
              '<div class="candidato-cargo">' + window.OlymposApp.escapeHtml(sr.cargo) + '</div>' +
              '<div class="candidato-meta" style="margin-top:4px; font-size:11px; color:var(--text-muted);">Lotação: ' + window.OlymposApp.escapeHtml(sr.escola_origem) + '</div>' +
            '</div>' +

            '<div class="match-connector-icon">' +
              '<div class="connector-circle" style="background: ' + (isLegal ? 'rgba(16,185,129,0.15); color: #10B981;' : 'rgba(239,68,68,0.15); color: #EF4444;') + '">' + (isLegal ? '⚖️' : '⚠️') + '</div>' +
            '</div>' +

            '<div class="candidato-box">' +
              '<div class="candidato-badge-tag" style="background: rgba(56,189,248,0.15); color: #38BDF8;">🌐 ' + window.OlymposApp.escapeHtml(ve.ente_origem) + '</div>' +
              '<strong class="candidato-nome">' + window.OlymposApp.escapeHtml(sr.nome_completo) + '</strong>' +
              '<div class="candidato-meta">Matrícula: <strong>' + window.OlymposApp.escapeHtml(ve.matricula) + '</strong> • ' + ve.carga_horaria + 'h semanais • ' + window.OlymposApp.escapeHtml(ve.situacao_vinculo) + '</div>' +
              '<div class="candidato-cargo">' + window.OlymposApp.escapeHtml(ve.cargo) + '</div>' +
              '<div class="candidato-meta" style="margin-top:4px; font-size:11px; color:var(--text-muted);">Lotação: ' + window.OlymposApp.escapeHtml(ve.lotacao_orgao) + '</div>' +
            '</div>' +
          '</div>' +

          '<div class="parecer-hera-box" style="border-left-color: ' + (isLegal ? '#10B981' : '#EF4444') + ';">' +
            '<span class="parecer-hera-icon">' + (isLegal ? '⚖️' : '⚠️') + '</span>' +
            '<div>' +
              '<strong style="display:block; font-size:12px; margin-bottom:2px; color:var(--text-main);">' + window.OlymposApp.escapeHtml(ac.enquadramento) + '</strong>' +
              '<p class="parecer-hera-text" style="margin:0;">' + window.OlymposApp.escapeHtml(ac.parecer_hera) + '</p>' +
              '<div style="margin-top:6px; font-size:11.5px; color:var(--brand-gold); display:flex; align-items:center; gap:4px;">' +
                '<span>🚀 <strong>Potencial de Permuta:</strong> ' + window.OlymposApp.escapeHtml(pp.polo_parceiro) + ' — ' + window.OlymposApp.escapeHtml(pp.otimizacao_logistica) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function preencherFormComVinculo(nome, matricula, cargo, ch, destino) {
    const inNome = document.getElementById('permutaNome');
    if (inNome) inNome.value = nome;

    const inMat = document.getElementById('permutaMatricula');
    if (inMat) inMat.value = matricula;

    const selCH = document.getElementById('permutaCargaHoraria');
    if (selCH) selCH.value = ch;

    const selDest = document.getElementById('permutaPoloDestino');
    if (selDest) {
      const dNorm = normalizarTexto(destino);
      if (dNorm.includes('NATAL') || dNorm.includes('SEEC')) selDest.value = 'Natal';
      else if (dNorm.includes('EXTREMOZ')) selDest.value = 'Extremoz';
      else if (dNorm.includes('SAO GONCALO') || dNorm.includes('SGA')) selDest.value = 'São Gonçalo do Amarante';
      else if (dNorm.includes('MACAIBA')) selDest.value = 'Macaíba';
    }

    alternarModoPainelSuperior('intencao');

    const form = document.getElementById('formPermutaCadmo');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Dados do servidor ' + nome + ' transferidos para o formulário de permuta!');
    }
  }

  function preencherFormComDocente(nome, matricula, cargo, ch, lotacao) {
    const inNome = document.getElementById('permutaNome');
    if (inNome) inNome.value = nome;

    const inMat = document.getElementById('permutaMatricula');
    if (inMat) inMat.value = matricula;

    const selCH = document.getElementById('permutaCargaHoraria');
    if (selCH && ch) {
      const chFmt = ch.includes('h') ? ch : (ch + 'h');
      for (let i = 0; i < selCH.options.length; i++) {
        if (selCH.options[i].value === chFmt) {
          selCH.selectedIndex = i;
          break;
        }
      }
    }

    const selCargo = document.getElementById('permutaCargo');
    if (selCargo && cargo) {
      const gNorm = normalizarBusca(cargo);
      if (gNorm.includes('INFANTIL')) {
        selCargo.value = 'Professor de Educação Infantil';
      } else if (gNorm.includes('INICIAIS') || gNorm.includes('MAGISTERIO') || gNorm.includes('POLIVALENTE')) {
        selCargo.value = 'Professor dos Anos Iniciais';
      } else if (gNorm.includes('PEDAGOGO') || gNorm.includes('ESPECIALISTA')) {
        selCargo.value = 'Especialista em Educação';
      } else {
        selCargo.value = 'Professor dos Anos Finais';
      }
    }

    const selOrig = document.getElementById('permutaEscolaOrigem');
    if (selOrig && lotacao) {
      const lotNorm = normalizarBusca(lotacao);
      for (let i = 0; i < selOrig.options.length; i++) {
        const optNorm = normalizarBusca(selOrig.options[i].value);
        if (lotNorm.includes(optNorm) || optNorm.includes(lotNorm)) {
          selOrig.selectedIndex = i;
          break;
        }
      }
    }

    alternarModoPainelSuperior('intencao');

    const form = document.getElementById('formPermutaCadmo');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Professor(a) ' + nome + ' transferido(a) para o formulário de permuta!');
    }
  }

  /**
   * Alterna entre a seção padrão de Consulta de Servidor (Nome/Matrícula) e o formulário de Intenção de Permuta.
   * @param {'consulta'|'intencao'} modo
   */
  function alternarModoPainelSuperior(modo) {
    const isIntencao = modo === 'intencao';
    const painelConsulta = document.getElementById('painelConsultaServidorCadmo');
    const wrapperForm = document.getElementById('wrapperFormPermuta');
    const btnModoConsulta = document.getElementById('btnModoConsultaServidor');
    const btnModoIntencao = document.getElementById('btnModoIntencaoPermuta');
    const btnHeaderToggle = document.getElementById('btnAlternarFormPermuta');

    if (painelConsulta) painelConsulta.classList.toggle('hidden', isIntencao);
    if (wrapperForm) wrapperForm.classList.toggle('hidden', !isIntencao);

    if (btnModoConsulta) {
      btnModoConsulta.classList.toggle('active', !isIntencao);
      btnModoConsulta.setAttribute('aria-selected', String(!isIntencao));
    }
    if (btnModoIntencao) {
      btnModoIntencao.classList.toggle('active', isIntencao);
      btnModoIntencao.setAttribute('aria-selected', String(isIntencao));
    }
    if (btnHeaderToggle) {
      btnHeaderToggle.setAttribute('aria-expanded', String(isIntencao));
      btnHeaderToggle.innerHTML = isIntencao ? '<span>🔍 Consultar Servidor</span>' : '<span>📝 Intenção de Permuta</span>';
    }
  }

  function normalizarMatriculaComparacao(matRaw) {
    return String(matRaw || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
  }

  /**
   * Busca informações consolidadas sobre determinado servidor a partir do Nome ou Matrícula,
   * unificando vínculos da SMEB Ceará-Mirim, SEEC/RN, Transparência Intermunicipal e intenções de permuta.
   * @param {string} termoRaw Nome completo/parcial ou matrícula funcional
   * @returns {Array<Object>} Lista de dossiês consolidados dos servidores localizados
   */
  function buscarInformacoesServidor(termoRaw) {
    const termoLimpo = String(termoRaw || '').trim();
    if (!termoLimpo) return [];

    const termoNorm = normalizarBusca(termoLimpo);
    const tokensNome = termoNorm.split(' ').filter(Boolean);
    const termoMatDigitos = normalizarMatriculaComparacao(termoLimpo);
    const isBuscaNumerica = /\d/.test(termoLimpo);

    function correspondeAoTermo(nomeSrv, matSrv) {
      const nNorm = normalizarBusca(nomeSrv);
      const mRawNorm = normalizarBusca(matSrv);
      const mDig = normalizarMatriculaComparacao(matSrv);

      if (isBuscaNumerica && termoMatDigitos.length >= 2) {
        if (mRawNorm.includes(termoNorm) || mDig === termoMatDigitos || (termoMatDigitos.length >= 3 && mDig.includes(termoMatDigitos))) {
          return true;
        }
      }
      if (tokensNome.length > 0) {
        return tokensNome.every(function(tk) {
          return nNorm.includes(tk) || mRawNorm.includes(tk);
        });
      }
      return false;
    }

    const dossiePorChave = {};

    function obterOuCriarDossie(nomeOriginal) {
      const chave = normalizarBusca(nomeOriginal);
      if (!chave) return null;
      if (!dossiePorChave[chave]) {
        dossiePorChave[chave] = {
          chave: chave,
          nome: String(nomeOriginal || '').trim(),
          cpfMascarado: null,
          matriculas: [],
          vinculos: [],
          intencoesPermuta: [],
          parecerExternoHera: null
        };
      }
      return dossiePorChave[chave];
    }

    function adicionarVinculo(dossie, vinculo) {
      if (!dossie || !vinculo) return;
      const matStr = String(vinculo.matricula || '').trim();
      const matKey = normalizarBusca(vinculo.ente) + '|' + normalizarMatriculaComparacao(matStr) + '|' + normalizarBusca(vinculo.cargo);
      const jaExiste = dossie.vinculos.some(function(v) {
        return (normalizarBusca(v.ente) + '|' + normalizarMatriculaComparacao(v.matricula) + '|' + normalizarBusca(v.cargo)) === matKey;
      });
      if (!jaExiste) {
        dossie.vinculos.push(vinculo);
      }
      if (matStr && dossie.matriculas.indexOf(matStr) === -1) {
        dossie.matriculas.push(matStr);
      }
    }

    // 1. Identifica quais chaves de servidores batem com o termo (Nome ou Matrícula) em qualquer base
    const chavesEncontradas = {};

    (DOCENTES_CEARA_MIRIM || []).forEach(function(d) {
      if (correspondeAoTermo(d.n, d.m)) {
        chavesEncontradas[normalizarBusca(d.n)] = true;
      }
    });

    (SERVIDORES_ESTADO_RN || []).forEach(function(d) {
      if (correspondeAoTermo(d.n, d.m)) {
        chavesEncontradas[normalizarBusca(d.n)] = true;
      }
    });

    const servidoresUnificados = (typeof window !== 'undefined' && window.OlymposServidores && typeof window.OlymposServidores.obterTodos === 'function')
      ? window.OlymposServidores.obterTodos()
      : (typeof global !== 'undefined' && global.OlymposServidores && typeof global.OlymposServidores.obterTodos === 'function' ? global.OlymposServidores.obterTodos() : []);

    (servidoresUnificados || []).forEach(function(s) {
      const nomeS = s.nome || s.n;
      const matS = s.matricula || s.m;
      if (correspondeAoTermo(nomeS, matS)) {
        chavesEncontradas[normalizarBusca(nomeS)] = true;
      }
    });

    (VINCULOS_TRANSPARENCIA || []).forEach(function(v) {
      const sr = v.servidor_referencia || {};
      const ve = v.vinculo_externo_detectado || {};
      if (correspondeAoTermo(sr.nome_completo, sr.matricula) || correspondeAoTermo(sr.nome_completo, ve.matricula)) {
        chavesEncontradas[normalizarBusca(sr.nome_completo)] = true;
      }
    });

    const bancoPermutas = obterBancoPermutas() || [];
    bancoPermutas.forEach(function(p) {
      if (correspondeAoTermo(p.nome, p.matricula)) {
        chavesEncontradas[normalizarBusca(p.nome)] = true;
      }
    });

    const listaChaves = Object.keys(chavesEncontradas);
    if (listaChaves.length === 0) return [];

    // 2. Para cada servidor identificado, consolida TODOS os vínculos municipais, estaduais, externos e intenções
    (DOCENTES_CEARA_MIRIM || []).forEach(function(d) {
      const k = normalizarBusca(d.n);
      if (!chavesEncontradas[k]) return;
      const dossie = obterOuCriarDossie(d.n);
      adicionarVinculo(dossie, {
        ente: d.ente || 'SMEB Ceará-Mirim',
        matricula: d.m,
        cargo: d.g,
        cargaHoraria: parseCargaHoraria(d.h),
        cargaHorariaTexto: String(d.h || '30h'),
        lotacao: d.l || 'Rede Municipal SMEB Ceará-Mirim',
        situacao: 'Efetivo / Ativo'
      });
    });

    (SERVIDORES_ESTADO_RN || []).forEach(function(d) {
      const k = normalizarBusca(d.n);
      if (!chavesEncontradas[k]) return;
      const dossie = obterOuCriarDossie(d.n);
      adicionarVinculo(dossie, {
        ente: d.ente || 'Governo do Estado (SEEC/RN)',
        matricula: d.m,
        cargo: d.g,
        cargaHoraria: parseCargaHoraria(d.h),
        cargaHorariaTexto: String(d.h || '30h'),
        lotacao: d.l || 'Rede Estadual SEEC/RN',
        situacao: 'Efetivo / Ativo'
      });
    });

    (servidoresUnificados || []).forEach(function(s) {
      const nomeS = s.nome || s.n;
      const k = normalizarBusca(nomeS);
      if (!chavesEncontradas[k]) return;
      const dossie = obterOuCriarDossie(nomeS);
      if (s.cpfMascarado && !dossie.cpfMascarado) {
        dossie.cpfMascarado = s.cpfMascarado;
      }
      adicionarVinculo(dossie, {
        ente: s.ente || s.orgao || 'Ente Federativo',
        matricula: s.matricula || s.m,
        cargo: s.cargo || s.g,
        cargaHoraria: parseCargaHoraria(s.cargaHoraria || s.h),
        cargaHorariaTexto: String(s.cargaHorariaTexto || s.h || '30h'),
        lotacao: s.lotacao || s.l || 'Lotação não informada',
        situacao: s.situacao || s.status || 'Efetivo / Ativo'
      });
    });

    (VINCULOS_TRANSPARENCIA || []).forEach(function(v) {
      const sr = v.servidor_referencia || {};
      const ve = v.vinculo_externo_detectado || {};
      const k = normalizarBusca(sr.nome_completo);
      if (!chavesEncontradas[k]) return;
      const dossie = obterOuCriarDossie(sr.nome_completo);
      if (sr.cpf_mascarado && !dossie.cpfMascarado) {
        dossie.cpfMascarado = sr.cpf_mascarado;
      }
      if (sr.matricula) {
        adicionarVinculo(dossie, {
          ente: 'SMEB Ceará-Mirim',
          matricula: sr.matricula,
          cargo: sr.cargo || 'Professor',
          cargaHoraria: parseCargaHoraria(sr.carga_horaria),
          cargaHorariaTexto: sr.carga_horaria + 'h',
          lotacao: sr.escola_origem || 'Rede Municipal SMEB Ceará-Mirim',
          situacao: 'Efetivo / Ativo'
        });
      }
      if (ve.matricula) {
        adicionarVinculo(dossie, {
          ente: ve.ente_origem || 'Ente Externo',
          matricula: ve.matricula,
          cargo: ve.cargo || 'Cargo Público',
          cargaHoraria: parseCargaHoraria(ve.carga_horaria),
          cargaHorariaTexto: ve.carga_horaria + 'h',
          lotacao: ve.lotacao_orgao || ve.ente_origem || 'Órgão Externo',
          situacao: ve.situacao_vinculo || 'Ativo'
        });
      }
      if (v.auditoria_constitucional) {
        dossie.parecerExternoHera = {
          auditoria: v.auditoria_constitucional,
          potencialPermuta: v.potencial_permuta || null
        };
      }
    });

    bancoPermutas.forEach(function(p) {
      const k = normalizarBusca(p.nome);
      if (!chavesEncontradas[k]) return;
      const dossie = obterOuCriarDossie(p.nome);
      dossie.intencoesPermuta.push(p);
      if (dossie.vinculos.length === 0) {
        adicionarVinculo(dossie, {
          ente: p.municipioOrigem || 'SMEB Ceará-Mirim',
          matricula: p.matricula,
          cargo: p.cargo + (p.disciplina ? ' (' + p.disciplina + ')' : ''),
          cargaHoraria: parseCargaHoraria(p.cargaHoraria),
          cargaHorariaTexto: p.cargaHoraria || '30h',
          lotacao: p.origem || 'Unidade Escolar',
          situacao: 'Com Intenção de Permuta'
        });
      }
    });

    // 3. Calcula carga horária total e auditoria constitucional CF/88 Art. 37, XVI
    const resultados = Object.keys(dossiePorChave).map(function(k) {
      const d = dossiePorChave[k];
      const chTotal = d.vinculos.reduce(function(acc, item) {
        return acc + (Number(item.cargaHoraria) || 0);
      }, 0);

      let auditoria = null;
      if (d.parecerExternoHera && d.parecerExternoHera.auditoria) {
        auditoria = {
          regular: Boolean(d.parecerExternoHera.auditoria.acumulacao_legal) && chTotal <= 60,
          enquadramento: d.parecerExternoHera.auditoria.enquadramento,
          parecer: d.parecerExternoHera.auditoria.parecer_hera,
          potencialPermuta: d.parecerExternoHera.potencialPermuta
        };
      } else if (d.vinculos.length === 1) {
        auditoria = {
          regular: chTotal <= 60,
          enquadramento: 'Vínculo Funcional Único',
          parecer: 'Servidor possui 1 vínculo ativo identificado (' + chTotal + 'h semanais), apto para análise de permuta intermunicipal.',
          potencialPermuta: null
        };
      } else if (d.vinculos.length === 2) {
        const vA = d.vinculos[0];
        const vB = d.vinculos[1];
        const auditCalc = auditarAcumulacaoCF37(vA.cargo, vA.cargaHoraria, vB.cargo, vB.cargaHoraria, vA.ente, vB.ente);
        auditoria = {
          regular: auditCalc.acumulacao_legal,
          enquadramento: auditCalc.enquadramento,
          parecer: auditCalc.parecer_hera,
          potencialPermuta: null
        };
      } else {
        auditoria = {
          regular: false,
          enquadramento: 'Alerta CF/88 Art. 37, XVI (Múltiplos Vínculos)',
          parecer: 'Foram identificados ' + d.vinculos.length + ' vínculos ativos somando ' + chTotal + 'h semanais. A Constituição Federal autoriza no máximo 2 vínculos cumuláveis (teto de 60h).',
          potencialPermuta: null
        };
      }

      return {
        nome: d.nome,
        cpfMascarado: d.cpfMascarado,
        matriculas: d.matriculas,
        cargaHorariaTotal: chTotal,
        totalVinculos: d.vinculos.length,
        vinculos: d.vinculos,
        auditoriaConstitucional: auditoria,
        intencoesPermuta: d.intencoesPermuta
      };
    });

    resultados.sort(function(a, b) {
      if (b.totalVinculos !== a.totalVinculos) return b.totalVinculos - a.totalVinculos;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    return resultados;
  }

  function focarLotacaoServidorNoMapa(lotacao) {
    if (!leafletMap || !lotacao) return;
    const lotNorm = normalizarBusca(lotacao);
    const pontos = obterTodosPontosMapa();
    let alvo = pontos.find(function(p) {
      const pNorm = normalizarBusca(p.nomeSimples || p.nome);
      return pNorm && (lotNorm.includes(pNorm) || pNorm.includes(lotNorm));
    });
    if (!alvo) {
      const munNorm = normalizarBusca(extrairMunicipioOrigem(lotacao));
      alvo = pontos.find(function(p) {
        return normalizarBusca(p.municipio) === munNorm;
      });
    }
    if (alvo && Array.isArray(alvo.coords)) {
      leafletMap.setView(alvo.coords, 14, { animate: true });
      const mapEl = document.getElementById('mapaPermutasCadmo');
      if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Unidade localizada no mapa: ' + (alvo.nomeSimples || alvo.nome));
      }
    }
  }

  function limparConsultaServidorCard() {
    const input = document.getElementById('consultaServidorInput');
    const btnLimpar = document.getElementById('btnLimparConsultaServidor');
    const badge = document.getElementById('badgeStatusConsultaServidor');
    const box = document.getElementById('resultadoConsultaServidorCadmo');

    if (input) input.value = '';
    if (btnLimpar) btnLimpar.classList.add('hidden');
    if (badge) {
      badge.className = 'pill-badge pill-gold';
      badge.textContent = 'Pronto para consulta';
    }
    if (box) {
      box.innerHTML =
        '<div class="servidor-lookup-empty">' +
          '<span>💡 Informe o <strong>nome</strong> (completo ou parcial) ou a <strong>matrícula funcional</strong> acima para exibir a ficha consolidada de vínculos, carga horária acumulada, lotação escolar e compatibilidade de permuta.</span>' +
        '</div>';
    }
  }

  function executarConsultaServidorCard(termoOpcional) {
    const input = document.getElementById('consultaServidorInput');
    const btnLimpar = document.getElementById('btnLimparConsultaServidor');
    const badge = document.getElementById('badgeStatusConsultaServidor');
    const box = document.getElementById('resultadoConsultaServidorCadmo');

    const termo = String(termoOpcional !== undefined ? termoOpcional : (input ? input.value : '')).trim();
    if (input && input.value.trim() !== termo) {
      input.value = termo;
    }

    if (!termo) {
      limparConsultaServidorCard();
      return [];
    }

    if (btnLimpar) btnLimpar.classList.remove('hidden');

    const encontrados = buscarInformacoesServidor(termo);
    if (!box) return encontrados;

    if (encontrados.length === 0) {
      if (badge) {
        badge.className = 'pill-badge pill-red';
        badge.textContent = '0 encontrados';
      }
      box.innerHTML =
        '<div class="servidor-lookup-empty">' +
          '🔍 Nenhum servidor encontrado para <strong>"' + window.OlymposApp.escapeHtml(termo) + '"</strong>. Verifique a grafia do nome ou o número da matrícula.' +
        '</div>';
      return [];
    }

    if (badge) {
      badge.className = 'pill-badge pill-green';
      badge.textContent = encontrados.length + (encontrados.length === 1 ? ' servidor localizado' : ' servidores localizados');
    }

    const exibidos = encontrados.slice(0, 15);
    let html = '';
    if (encontrados.length > exibidos.length) {
      html += '<div style="margin-bottom: 10px; font-size: 12px; color: var(--text-muted);">Exibindo os primeiros <strong>' + exibidos.length + '</strong> de <strong>' + encontrados.length + '</strong> servidores correspondentes. Refine o nome ou informe a matrícula exata.</div>';
    }

    html += '<div class="servidor-dossie-list">';
    exibidos.forEach(function(srv) {
      const aud = srv.auditoriaConstitucional || { regular: true, enquadramento: '', parecer: '' };
      const badgeLegal = aud.regular
        ? '<span class="pill-badge pill-green" style="font-size:11px;">⚖️ Regular (' + srv.cargaHorariaTotal + 'h semanais)</span>'
        : '<span class="pill-badge pill-red" style="font-size:11px;">⚠️ Alerta CF/88 (' + srv.cargaHorariaTotal + 'h semanais)</span>';

      const primeiroVinculo = srv.vinculos[0] || {};
      const cpfTag = srv.cpfMascarado
        ? '<span>CPF: <strong>' + window.OlymposApp.escapeHtml(srv.cpfMascarado) + '</strong></span>'
        : '';

      html +=
        '<div class="servidor-dossie-card">' +
          '<div class="servidor-dossie-top">' +
            '<div>' +
              '<h5 class="servidor-dossie-nome">' + window.OlymposApp.escapeHtml(srv.nome) + '</h5>' +
              '<div class="servidor-dossie-sub">' +
                '<span>Matrícula(s): <strong>' + window.OlymposApp.escapeHtml(srv.matriculas.join(', ')) + '</strong></span>' +
                cpfTag +
                '<span>Vínculos ativos: <strong>' + srv.totalVinculos + '</strong></span>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
              badgeLegal +
              '<button type="button" class="btn btn-primary btn-sm" style="font-size:11.5px; padding:4px 10px;" ' +
                'onclick="window.OlymposViews.papiroCadmo.preencherFormComDocente(\'' + window.OlymposApp.escapeHtml(srv.nome) + '\', \'' + window.OlymposApp.escapeHtml(primeiroVinculo.matricula || '') + '\', \'' + window.OlymposApp.escapeHtml(primeiroVinculo.cargo || '') + '\', \'' + window.OlymposApp.escapeHtml(primeiroVinculo.cargaHorariaTexto || '30h') + '\', \'' + window.OlymposApp.escapeHtml(primeiroVinculo.lotacao || '') + '\')">' +
                '⚡ Iniciar Permuta' +
              '</button>' +
            '</div>' +
          '</div>' +

          '<div class="servidor-vinculos-grid">';

      srv.vinculos.forEach(function(v) {
        const isEstadual = String(v.ente || '').includes('Estado') || String(v.ente || '').includes('SEEC');
        const isSMEB = String(v.ente || '').includes('Ceará-Mirim') || String(v.ente || '').includes('SMEB');
        const pillClass = isSMEB ? 'pill-gold' : (isEstadual ? 'pill-blue' : 'pill-green');

        html +=
          '<div class="servidor-vinculo-item">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">' +
              '<span class="pill-badge ' + pillClass + '" style="font-size:10.5px;">🏛️ ' + window.OlymposApp.escapeHtml(v.ente) + '</span>' +
              '<span style="font-family:var(--font-mono); font-size:11.5px; font-weight:700; color:var(--text-main);">Mat. ' + window.OlymposApp.escapeHtml(v.matricula) + '</span>' +
            '</div>' +
            '<strong style="font-size:12.5px; color:var(--text-main);">' + window.OlymposApp.escapeHtml(v.cargo) + '</strong>' +
            '<div class="servidor-vinculo-meta">Carga Horária: <strong>' + window.OlymposApp.escapeHtml(v.cargaHorariaTexto) + '</strong> • ' + window.OlymposApp.escapeHtml(v.situacao) + '</div>' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:2px;">' +
              '<span class="servidor-vinculo-meta">📍 ' + window.OlymposApp.escapeHtml(v.lotacao) + '</span>' +
              '<button type="button" class="btn-mini" onclick="window.OlymposViews.papiroCadmo.focarLotacaoServidorNoMapa(\'' + window.OlymposApp.escapeHtml(v.lotacao) + '\')">Mapa</button>' +
            '</div>' +
          '</div>';
      });

      html += '</div>';

      if (aud.parecer) {
        html +=
          '<div class="parecer-hera-box" style="margin-top:10px; border-left-color:' + (aud.regular ? '#10B981' : '#EF4444') + ';">' +
            '<span class="parecer-hera-icon">' + (aud.regular ? '⚖️' : '⚠️') + '</span>' +
            '<div>' +
              '<strong style="display:block; font-size:11.5px; color:var(--text-main);">' + window.OlymposApp.escapeHtml(aud.enquadramento) + '</strong>' +
              '<p class="parecer-hera-text" style="margin:2px 0 0 0; font-size:12px;">' + window.OlymposApp.escapeHtml(aud.parecer) + '</p>' +
            '</div>' +
          '</div>';
      }

      if (srv.intencoesPermuta && srv.intencoesPermuta.length > 0) {
        const ip = srv.intencoesPermuta[0];
        html +=
          '<div style="margin-top:8px; padding:8px 12px; border-radius:8px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); font-size:12px; color:var(--text-main);">' +
            '🤝 <strong>Intenção de Permuta Ativa:</strong> Origem em <em>' + window.OlymposApp.escapeHtml(ip.origem) + '</em> → Destino desejado: <strong>' + window.OlymposApp.escapeHtml(ip.destino) + '</strong> (' + window.OlymposApp.escapeHtml(ip.turno || 'Turno flexível') + ').' +
          '</div>';
      }

      html += '</div>';
    });

    html += '</div>';
    box.innerHTML = html;
    return encontrados;
  }

  function executarListagemDocentesGeral() {
    const container = document.getElementById('resultadoMatchingHera');
    const badgeTotal = document.getElementById('badgeTotalMatches');
    if (!container) return;

    const todosDocentes = obterColecaoServidoresCadmo();
    const docentesFiltrados = filtrarDocentesPorTermo(todosDocentes, termoBuscaServidor);

    if (badgeTotal) {
      if (termoBuscaServidor) {
        badgeTotal.textContent = docentesFiltrados.length + ' de ' + todosDocentes.length + ' servidores';
      } else {
        badgeTotal.textContent = todosDocentes.length + ' servidores na base';
      }
    }

    const previewPill = document.getElementById('heraMatchPreviewPill');
    if (previewPill) {
      previewPill.textContent = 'Servidores: ' + docentesFiltrados.length;
      previewPill.classList.remove('hidden');
    }

    atualizarResumoBusca(docentesFiltrados.length, todosDocentes.length, 'docentes');

    if (docentesFiltrados.length === 0) {
      container.innerHTML =
        '<div class="output-panel text-center" style="padding: 32px 20px;">' +
          '<div style="font-size: 1.8rem; margin-bottom: 8px;">🔍</div>' +
          '<strong style="display:block; font-size:15px; margin-bottom:6px; color:var(--text-main);">Nenhum servidor localizado na base oficial</strong>' +
          '<p style="font-size:13px; color:var(--text-muted); max-width:480px; margin:0 auto 14px;">Não foram identificados servidores para o termo "<strong>' + window.OlymposApp.escapeHtml(termoBuscaServidor) + '</strong>". Busque por matrícula funcional, nome, lotação, cargo ou ente (SMEB, Governo do Estado, Natal, Parnamirim, SGA).</p>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="window.OlymposViews.papiroCadmo.limparBuscaServidor()">Limpar Busca</button>' +
        '</div>';
      return;
    }

    const limiteExibicao = 80;
    const exibidos = docentesFiltrados.slice(0, limiteExibicao);

    let html = '<div style="margin-bottom: 8px; font-size: 12px; color: var(--text-muted); display:flex; justify-content:space-between; align-items:center;">' +
      '<span>Exibindo <strong>' + exibidos.length + '</strong> de <strong>' + docentesFiltrados.length + '</strong> servidores ativos (5 Entes Monitorados)</span>' +
      (docentesFiltrados.length > limiteExibicao ? '<span class="pill-badge pill-gold" style="font-size:11px;">Refine a busca para ver resultados específicos</span>' : '') +
      '</div>';

    html += '<div class="table-responsive" style="max-height: 480px; overflow-y: auto;">' +
      '<table class="data-table" style="width:100%; font-size:12.5px;">' +
        '<thead>' +
          '<tr>' +
            '<th style="width:90px;">Matrícula</th>' +
            '<th>Nome do Servidor</th>' +
            '<th style="width:180px;">Ente / Vínculo</th>' +
            '<th>Cargo / Função</th>' +
            '<th style="width:70px; text-align:center;">C.H.</th>' +
            '<th>Escola / Lotação</th>' +
            '<th style="width:130px; text-align:right;">Ação</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>';

    exibidos.forEach(function(d) {
      const nomeSrv = d.n || d.nome;
      const matSrv = d.m || d.matricula;
      const cargoSrv = d.g || d.cargo;
      const chSrv = d.h || d.cargaHorariaTexto || '30h';
      const lotSrv = d.l || d.lotacao || '';

      const isEstado = String(d.ente || '').includes('Governo') || String(d.ente || '').includes('SEEC');
      const isNatal = String(d.ente || '').includes('Natal');
      const isParnamirim = String(d.ente || '').includes('Parnamirim');
      const isSGA = String(d.ente || '').includes('São Gonçalo') || String(d.ente || '').includes('SGA');
      let enteBadge = '<span class="pill-badge pill-gold" style="font-size:10.5px;">🏛️ SMEB Ceará-Mirim</span>';
      if (isEstado) {
        enteBadge = '<span class="pill-badge pill-blue" style="font-size:10.5px;">🌐 Governo do Estado (SEEC)</span>';
      } else if (isNatal) {
        enteBadge = '<span class="pill-badge pill-purple" style="font-size:10.5px;">🏛️ SME Natal</span>';
      } else if (isParnamirim) {
        enteBadge = '<span class="pill-badge pill-teal" style="font-size:10.5px;">🏛️ SME Parnamirim</span>';
      } else if (isSGA) {
        enteBadge = '<span class="pill-badge pill-green" style="font-size:10.5px;">🏛️ SME São Gonçalo</span>';
      }

      html +=
        '<tr>' +
          '<td style="font-family:var(--font-mono); font-weight:600; color:var(--text-main);">' + window.OlymposApp.escapeHtml(matSrv) + '</td>' +
          '<td><strong>' + window.OlymposApp.escapeHtml(nomeSrv) + '</strong></td>' +
          '<td>' + enteBadge + '</td>' +
          '<td style="font-size:11.5px; color:var(--text-secondary);">' + window.OlymposApp.escapeHtml(cargoSrv) + '</td>' +
          '<td style="text-align:center;"><span class="pill-badge pill-green" style="font-size:11px;">' + window.OlymposApp.escapeHtml(chSrv) + '</span></td>' +
          '<td style="font-size:11.5px; color:var(--text-muted);">' + window.OlymposApp.escapeHtml(lotSrv || (isEstado ? 'Rede Estadual SEEC/RN' : 'SMEB / Rede Municipal')) + '</td>' +
          '<td style="text-align:right;">' +
            '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 8px;" ' +
              'onclick="window.OlymposViews.papiroCadmo.preencherFormComDocente(\'' + window.OlymposApp.escapeHtml(nomeSrv) + '\', \'' + window.OlymposApp.escapeHtml(matSrv) + '\', \'' + window.OlymposApp.escapeHtml(cargoSrv) + '\', \'' + window.OlymposApp.escapeHtml(chSrv) + '\', \'' + window.OlymposApp.escapeHtml(lotSrv) + '\')">' +
              '⚡ Permuta' +
            '</button>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  function tracarRotaPermuta(origemA, origemB, score) {
    if (!leafletMap || !routeLayer) return;
    routeLayer.clearLayers();

    // Localiza coordenadas de A e B
    let coordA = null;
    let coordB = null;

    const todos = obterTodosPontosMapa();
    todos.forEach(function(p) {
      if (!coordA && (p.nome === origemA || origemA.includes(p.nome) || p.nome.includes(origemA))) {
        coordA = p.coords;
      }
      if (!coordB && (p.nome === origemB || origemB.includes(p.nome) || p.nome.includes(origemB))) {
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

      alternarAbaResultados('permutas');
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

      const dataCsv = p.dataUltimoCsv || '12/10/2026';
      card.innerHTML =
        '<div>' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">' +
            '<strong style="font-family:var(--font-display); font-size:13.5px; color:var(--text-main);">' + window.OlymposApp.escapeHtml(p.nome) + '</strong>' +
            '<span class="pill-badge pill-green">Dia 12</span>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--text-muted);">' + window.OlymposApp.escapeHtml(p.regiao) + ' • ' + window.OlymposApp.escapeHtml(p.tecnologia) + '</div>' +
          '<div class="portal-csv-date-box" style="display:flex; align-items:center; gap:5px; font-size:11.5px; color:var(--text-secondary); margin-top:6px; background:var(--bg-tonal); padding:3px 8px; border-radius:var(--radius-sm,6px); border:1px solid var(--border-hairline);">' +
            '<span aria-hidden="true">📥</span> <span>Último CSV:</span> <strong class="portal-csv-date" style="color:var(--brand-gold); font-family:var(--font-mono); font-size:11px;">' + window.OlymposApp.escapeHtml(dataCsv) + '</strong>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">' +
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
    executarCruzamentoVinculosHera: executarCruzamentoVinculosHera,
    tracarRotaPermuta: tracarRotaPermuta,
    preencherFormComVinculo: preencherFormComVinculo,
    processarArquivoCsv: processarArquivoCsv,
    alternarColapsoHera: alternarColapsoHera,
    obterEscolasDinamicasCadmo: obterEscolasDinamicasCadmo,
    obterTodosPontosMapa: obterTodosPontosMapa,
    popularSelectsFormularioPermuta: popularSelectsFormularioPermuta,
    obterPontosSecretarias: obterPontosSecretarias,
    abrirModalEdicaoSecretaria: abrirModalEdicaoSecretaria,
    fecharModalEdicaoSecretaria: fecharModalEdicaoSecretaria,
    salvarEdicaoSecretaria: salvarEdicaoSecretaria,
    restaurarPadraoSecretarias: restaurarPadraoSecretarias,
    PONTOS_GEORREFERENCIADOS: PONTOS_GEORREFERENCIADOS,
    sincronizarServidores: sincronizarServidoresUnificados,
    obterTodosServidores: obterColecaoServidoresCadmo,
    obterDocentesCearaMirim: function() { return DOCENTES_CEARA_MIRIM; },
    obterVinculosTransparencia: function() { return VINCULOS_TRANSPARENCIA; },
    preencherFormComDocente: preencherFormComDocente,
    executarListagemDocentesGeral: executarListagemDocentesGeral,
    limparBuscaServidor: limparBuscaServidor,
    filtrarMatchesPorTermo: filtrarMatchesPorTermo,
    normalizarBusca: normalizarBusca,
    alternarModoPainelSuperior: alternarModoPainelSuperior,
    buscarInformacoesServidor: buscarInformacoesServidor,
    consultarServidorPorNomeOuMatricula: buscarInformacoesServidor,
    executarConsultaServidorCard: executarConsultaServidorCard,
    limparConsultaServidorCard: limparConsultaServidorCard,
    focarLotacaoServidorNoMapa: focarLotacaoServidorNoMapa
  };
})();
