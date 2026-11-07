/**
 * Catálogo Semente Oficial — Escolas, CEIs e Instituições de Ceará-Mirim/RN
 * Secretaria Municipal de Educação Básica (SMEB)
 * Georreferenciamento de precisão (Latitude / Longitude) para visualização cartográfica no Leaflet.js
 * Suporte a Multi-Redes (Municipal, Estadual, Federal, Privada), Multi-Segmentos Simultâneos
 * e Categorias Institucionais padronizadas ('Escola', 'Centro de Educação Infantil', 'Instituição').
 */
(function(root) {
  'use strict';

  var BANCO_SEMENTE_ESCOLAS = [
    // -------------------------------------------------------------------------
    // INSTITUIÇÃO — SEDE ADMINISTRATIVA MUNICIPAL
    // -------------------------------------------------------------------------
    {
      id: 'esc_001',
      nome: 'SMEB Sede — Secretaria Municipal de Educação Básica',
      inep: '24021000',
      rede: 'Municipal',
      categoria: 'Instituição',
      segmentos: ['Sede Administrativa'],
      zona: 'Urbana',
      bairroDistrito: 'Centro',
      endereco: 'Rua General João Varela, 120, Centro, Ceará-Mirim/RN',
      lat: -5.634400,
      lng: -35.424500,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5900',
      diretor: 'Coordenação Geral SMEB',
      cor: '#D4AF37',
      icone: '★'
    },

    // -------------------------------------------------------------------------
    // ZONA URBANA — ESCOLAS MUNICIPAIS (ENSINO FUNDAMENTAL & MULTI-SEGMENTOS)
    // -------------------------------------------------------------------------
    {
      id: 'esc_002',
      nome: 'E. M. Alice Garcia Freire',
      inep: '24021001',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ed. Infantil', 'Ens. Fundamental I'],
      zona: 'Urbana',
      bairroDistrito: 'Centro',
      endereco: 'Rua Presidente Vargas, s/n, Centro',
      lat: -5.633800,
      lng: -35.426200,
      turnos: ['Matutino', 'Vespertino', 'Noturno'],
      telefone: '(84) 3274-5911',
      diretor: 'Profª. Maria das Graças Silva',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_003',
      nome: 'E. M. Prefeito Roberto Varela',
      inep: '24021002',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Santa Águeda',
      endereco: 'Av. Enéas Cavalcante, 450, Santa Águeda',
      lat: -5.631200,
      lng: -35.421000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5912',
      diretor: 'Prof. Carlos Alberto Santos',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_004',
      nome: 'E. M. Augusto Severo',
      inep: '24021003',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Centro',
      endereco: 'Rua Coronel Meira e Sá, 85, Centro',
      lat: -5.635500,
      lng: -35.428000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5913',
      diretor: 'Profª. Francisca Moreira',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_005',
      nome: 'E. M. Monsenhor Celso Cicco',
      inep: '24021004',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Planalto',
      endereco: 'Rua Santa Luzia, 210, Planalto',
      lat: -5.642000,
      lng: -35.419000,
      turnos: ['Matutino', 'Vespertino', 'Integral'],
      telefone: '(84) 3274-5914',
      diretor: 'Prof. José Antônio de Oliveira',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_006',
      nome: 'E. M. Presidente Tancredo Neves',
      inep: '24021005',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'São Geraldo',
      endereco: 'Rua São João, s/n, Bairro São Geraldo',
      lat: -5.638000,
      lng: -35.422500,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5915',
      diretor: 'Profª. Ana Lúcia Ferreira',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_007',
      nome: 'E. M. Adele de Oliveira',
      inep: '24021006',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Passa e Fica / Centro',
      endereco: 'Rua Passa e Fica, 140, Centro',
      lat: -5.636000,
      lng: -35.423000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5916',
      diretor: 'Profª. Cláudia Regina de Souza',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_008',
      nome: 'E. M. Herônides Ferreira da Silva',
      inep: '24021007',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Cohab',
      endereco: 'Conjunto Habitacional Cohab, Rua 3',
      lat: -5.629000,
      lng: -35.418000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5917',
      diretor: 'Prof. Severino Ramos',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_009',
      nome: 'E. M. Barão de Ceará-Mirim',
      inep: '24021008',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Barão',
      endereco: 'Estrada do Barão, Km 2',
      lat: -5.615000,
      lng: -35.398000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5918',
      diretor: 'Profª. Fátima Bezerra Neves',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_010',
      nome: 'E. M. Professor Onofre Soares',
      inep: '24021009',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Nova Descoberta',
      endereco: 'Rua Projetada, 55, Nova Descoberta',
      lat: -5.645000,
      lng: -35.435000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5919',
      diretor: 'Prof. Manoel Barbosa',
      cor: '#38BDF8',
      icone: 'U'
    },
    {
      id: 'esc_011',
      nome: 'E. M. São Geraldo',
      inep: '24021010',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'São Geraldo',
      endereco: 'Travessa dos Coqueiros, 12',
      lat: -5.639500,
      lng: -35.417000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5920',
      diretor: 'Profª. Rita de Cássia',
      cor: '#38BDF8',
      icone: 'U'
    },

    // -------------------------------------------------------------------------
    // ZONA RURAL — ESCOLAS MUNICIPAIS DOS DISTRITOS E COMUNIDADES
    // -------------------------------------------------------------------------
    {
      id: 'esc_012',
      nome: 'E. M. Dr. Júlio Senna',
      inep: '24021011',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ed. Infantil', 'Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Rural',
      bairroDistrito: 'Distrito de Gravatá',
      endereco: 'Vila de Gravatá, Centro Comunitário',
      lat: -5.602500,
      lng: -35.465000,
      turnos: ['Matutino', 'Vespertino', 'Integral'],
      telefone: '(84) 3274-5921',
      diretor: 'Prof. Francisco Canindé Lima',
      cor: '#10B981',
      icone: 'R'
    },
    {
      id: 'esc_013',
      nome: 'E. M. Madalena Antunes',
      inep: '24021012',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ed. Infantil', 'Ens. Fundamental I'],
      zona: 'Rural',
      bairroDistrito: 'Distrito de Massangana',
      endereco: 'Povoado de Massangana, Estrada Principal',
      lat: -5.671000,
      lng: -35.452000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5922',
      diretor: 'Profª. Maria do Socorro Dantas',
      cor: '#10B981',
      icone: 'R'
    },
    {
      id: 'esc_014',
      nome: 'E. M. Felipe Camarão',
      inep: '24021013',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Rural',
      bairroDistrito: 'Comunidade Primeirinho',
      endereco: 'Assentamento Primeirinho, Rodovia RN-160',
      lat: -5.589000,
      lng: -35.412000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5923',
      diretor: 'Prof. Antônio Marcos',
      cor: '#10B981',
      icone: 'R'
    },
    {
      id: 'esc_015',
      nome: 'E. M. Maria do Carmo de Brito',
      inep: '24021014',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Rural',
      bairroDistrito: 'Comunidade de Pium',
      endereco: 'Zona Agrícola de Pium',
      lat: -5.578000,
      lng: -35.485000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5924',
      diretor: 'Profª. Ivonete Medeiros',
      cor: '#10B981',
      icone: 'R'
    },
    {
      id: 'esc_016',
      nome: 'E. M. Rui Barbosa',
      inep: '24021015',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Rural',
      bairroDistrito: 'Comunidade de Coqueiros',
      endereco: 'Distrito de Coqueiros, Estrada da Praia',
      lat: -5.620000,
      lng: -35.370000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5925',
      diretor: 'Prof. Edvaldo Costa',
      cor: '#10B981',
      icone: 'R'
    },
    {
      id: 'esc_017',
      nome: 'E. M. Professora Maria Alice',
      inep: '24021016',
      rede: 'Municipal',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Rural',
      bairroDistrito: 'Capela',
      endereco: 'Povoado Capela, Setor Sul',
      lat: -5.655000,
      lng: -35.385000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5926',
      diretor: 'Profª. Simone Tavares',
      cor: '#10B981',
      icone: 'R'
    },

    // -------------------------------------------------------------------------
    // CENTROS DE EDUCAÇÃO INFANTIL (CEIS) MUNICIPAIS
    // -------------------------------------------------------------------------
    {
      id: 'esc_018',
      nome: 'CEI Professora Maria de Lourdes',
      inep: '24021017',
      rede: 'Municipal',
      categoria: 'Centro de Educação Infantil',
      segmentos: ['Ed. Infantil'],
      zona: 'Urbana',
      bairroDistrito: 'Centro',
      endereco: 'Rua Aristides de Andrade, 30, Centro',
      lat: -5.632500,
      lng: -35.427000,
      turnos: ['Matutino', 'Vespertino', 'Integral'],
      telefone: '(84) 3274-5927',
      diretor: 'Profª. Joelma Pinheiro',
      cor: '#F59E0B',
      icone: 'C'
    },
    {
      id: 'esc_019',
      nome: 'CEI Menino Jesus',
      inep: '24021018',
      rede: 'Municipal',
      categoria: 'Centro de Educação Infantil',
      segmentos: ['Ed. Infantil'],
      zona: 'Urbana',
      bairroDistrito: 'Planalto',
      endereco: 'Rua São Pedro, 90, Planalto',
      lat: -5.641000,
      lng: -35.421500,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5928',
      diretor: 'Profª. Rosângela Guedes',
      cor: '#F59E0B',
      icone: 'C'
    },
    {
      id: 'esc_020',
      nome: 'CEI Tia Zezé',
      inep: '24021019',
      rede: 'Municipal',
      categoria: 'Centro de Educação Infantil',
      segmentos: ['Ed. Infantil'],
      zona: 'Urbana',
      bairroDistrito: 'Santa Águeda',
      endereco: 'Rua Projetada B, Santa Águeda',
      lat: -5.630000,
      lng: -35.420000,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-5929',
      diretor: 'Profª. Patrícia Lima',
      cor: '#F59E0B',
      icone: 'C'
    },

    // -------------------------------------------------------------------------
    // REDE ESTADUAL (SEEC/RN - 7ª DIREC)
    // -------------------------------------------------------------------------
    {
      id: 'esc_021',
      nome: 'E. E. Interventor Ubaldo Bezerra de Melo',
      inep: '24021020',
      rede: 'Estadual',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental II', 'Ensino Médio'],
      zona: 'Urbana',
      bairroDistrito: 'Centro',
      endereco: 'Rua General João Varela, 250, Centro, Ceará-Mirim/RN',
      lat: -5.632200,
      lng: -35.424800,
      turnos: ['Matutino', 'Vespertino', 'Noturno'],
      telefone: '(84) 3274-5930',
      diretor: 'Gestão Escolar 7ª DIREC',
      cor: '#2563EB',
      icone: '🏛'
    },
    {
      id: 'esc_022',
      nome: 'E. E. Desembargador Silvino Bezerra',
      inep: '24021021',
      rede: 'Estadual',
      categoria: 'Escola',
      segmentos: ['Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'São Geraldo',
      endereco: 'Rua Santa Luzia, s/n, São Geraldo, Ceará-Mirim/RN',
      lat: -5.636500,
      lng: -35.421500,
      turnos: ['Matutino', 'Vespertino', 'Noturno'],
      telefone: '(84) 3274-5931',
      diretor: 'Gestão Escolar SEEC/RN',
      cor: '#2563EB',
      icone: '🏛'
    },

    // -------------------------------------------------------------------------
    // REDE FEDERAL — INSTITUIÇÃO (IFRN — MINISTÉRIO DA EDUCAÇÃO)
    // -------------------------------------------------------------------------
    {
      id: 'esc_023',
      nome: 'IFRN — Campus Ceará-Mirim',
      inep: '24021022',
      rede: 'Federal',
      categoria: 'Instituição',
      segmentos: ['Ensino Médio', 'Ensino Técnico'],
      zona: 'Urbana',
      bairroDistrito: 'Planalto / BR-406',
      endereco: 'Rodovia BR-406, Km 145, Planalto, Ceará-Mirim/RN',
      lat: -5.627500,
      lng: -35.441200,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 4005-4100',
      diretor: 'Diretoria Geral IFRN',
      cor: '#16A34A',
      icone: '🎓'
    },

    // -------------------------------------------------------------------------
    // REDE PRIVADA DE CEARÁ-MIRIM
    // -------------------------------------------------------------------------
    {
      id: 'esc_024',
      nome: 'Colégio Santa Águeda (Rede Privada)',
      inep: '24021023',
      rede: 'Privada',
      categoria: 'Escola',
      segmentos: ['Ed. Infantil', 'Ens. Fundamental I', 'Ens. Fundamental II'],
      zona: 'Urbana',
      bairroDistrito: 'Santa Águeda',
      endereco: 'Av. Enéas Cavalcante, 280, Santa Águeda, Ceará-Mirim/RN',
      lat: -5.631800,
      lng: -35.422100,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-2100',
      diretor: 'Coordenação Pedagógica CSA',
      cor: '#9333EA',
      icone: '⭐'
    },
    {
      id: 'esc_025',
      nome: 'Educandário Sagrada Família (Rede Privada)',
      inep: '24021024',
      rede: 'Privada',
      categoria: 'Escola',
      segmentos: ['Ed. Infantil', 'Ens. Fundamental I'],
      zona: 'Urbana',
      bairroDistrito: 'Centro',
      endereco: 'Rua Coronel Meira e Sá, 142, Centro, Ceará-Mirim/RN',
      lat: -5.634100,
      lng: -35.423300,
      turnos: ['Matutino', 'Vespertino'],
      telefone: '(84) 3274-1580',
      diretor: 'Direção Pedagógica ESF',
      cor: '#9333EA',
      icone: '⭐'
    }
  ];

  // Exportação compatível com Browser (Window) e Node.js (CommonJS / Testes)
  if (typeof root !== 'undefined') {
    root.BANCO_SEMENTE_ESCOLAS = BANCO_SEMENTE_ESCOLAS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BANCO_SEMENTE_ESCOLAS;
  }
})(typeof window !== 'undefined' ? window : this);
