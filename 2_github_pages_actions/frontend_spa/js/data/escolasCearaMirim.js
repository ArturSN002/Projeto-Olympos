/**
 * Catálogo Semente Oficial — Escolas, CEIs e Instituições de Ceará-Mirim/RN
 * Secretaria Municipal de Educação Básica (SMEB)
 * Georreferenciamento de precisão (Latitude / Longitude) para visualização cartográfica no Leaflet.js
 * Suporte a Multi-Redes (Municipal, Estadual, Federal, Privada), Multi-Segmentos Simultâneos
 * e Categorias Institucionais padronizadas ('Escola', 'Centro de Educação Infantil', 'Instituição').
 * Padrão V2.03: Ícones por Segmento (C, I, II, M, X) e Cores por Rede/Zona.
 */
(function(root) {
  'use strict';

  var BANCO_SEMENTE_ESCOLAS = [
  {
    "id": "esc_000",
    "nome": "SMEB Sede — Secretaria Municipal de Educação Básica",
    "inep": "",
    "categoria": "Instituição",
    "zona": "Urbana",
    "bairroDistrito": "Santa Águeda",
    "endereco": "Rua Heráclito Vilar, nº 720, Ceará-Mirim",
    "lat": -5.6349,
    "lng": -35.4213,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "smeb@cearamirim.rn.gov.br",
    "diretor": "Maria Margareth da Silva Pereira",
    "cor": "#22C55E",
    "icone": "★",
    "rede": "Municipal",
    "segmentos": [
      "Sede Administrativa"
    ]
  },
  {
    "id": "esc_001",
    "nome": "E.M. ADELE DE OLIVEIRA",
    "inep": "24052248",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "Centro",
    "endereco": "Rua Santo Antônio, nº 273, Centro, Ceará-Mirim",
    "lat": -5.643802,
    "lng": -35.423708,
    "turnos": [
      "Matutino",
      "Vespertino",
      "Noturno"
    ],
    "telefone": "98862-0738",
    "diretor": "Sônia Maria da Silva",
    "cor": "#22C55E",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I",
      "Ens. Fundamental II",
      "EJA"
    ]
  },
  {
    "id": "esc_002",
    "nome": "E.M. PROF. ALBERTO NICÁCIO DA COSTA BARBOSA",
    "inep": "24086029",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "Santa Águeda",
    "endereco": "Rua Vicente Barbosa, nº 921, Santa Águeda, Ceará-Mirim",
    "lat": -5.631341,
    "lng": -35.425295,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99214-7633",
    "diretor": "Fazya Gracielle Soares Dantas Pinheiro",
    "cor": "#22C55E",
    "icone": "II",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_003",
    "nome": "E.M. DR. AUGUSTO MEIRA",
    "inep": "24052434",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "São Geraldo",
    "endereco": "Rua Olinto José Meira, nº 224, São Geraldo, Ceará-Mirim",
    "lat": -5.640317,
    "lng": -35.428857,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99619-6413",
    "diretor": "Maria Cristina da Silva",
    "cor": "#22C55E",
    "icone": "II",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_004",
    "nome": "E.M. DR. JULIO GOMES DE SENNA",
    "inep": "24052450",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "Conjunto COHAB",
    "endereco": "Rua das Algarobas, S/N, Conjunto COHAB, Ceará-Mirim",
    "lat": -5.646079,
    "lng": -35.417957,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99404-2941",
    "diretor": "Eriberto Bezerra de Brito",
    "cor": "#22C55E",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I",
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_005",
    "nome": "E.M. MADALENA ANTUNES PEREIRA",
    "inep": "24052574",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "Santa Águeda",
    "endereco": "Rua Jorge Fernandes Câmara, nº 130, Santa Águeda, Ceará-Mirim",
    "lat": -5.6326,
    "lng": -35.4252,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99126-2975",
    "diretor": "Mirian Carvalho Ferreira da Silva",
    "cor": "#22C55E",
    "icone": "II",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_006",
    "nome": "E.M. MARIA ANTONIETA PEREIRA VARELA",
    "inep": "24066400",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "São Geraldo",
    "endereco": "Rua Olinto José Meira, nº 346, São Geraldo, Ceará-Mirim",
    "lat": -5.640385,
    "lng": -35.429659,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99121-7968",
    "diretor": "Maria das Dores da Silva Góis",
    "cor": "#22C55E",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_007",
    "nome": "E.M. MÁRIO PINHEIRO DA SILVA",
    "inep": "24052590",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "Nova Descoberta",
    "endereco": "Rua Leovigildo Cavalcanti, nº 181, Nova Descoberta, Ceará-Mirim",
    "lat": -5.647945,
    "lng": -35.43375,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99490-4351",
    "diretor": "Maria Cristina de Oliveira Barbosa",
    "cor": "#22C55E",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_008",
    "nome": "E.M. ROTARY",
    "inep": "24052655",
    "categoria": "Escola",
    "zona": "Urbana",
    "bairroDistrito": "Passa e Fica",
    "endereco": "Travessa Prisco Rocha, nº 661, Passa e Fica, Ceará-Mirim",
    "lat": -5.649693,
    "lng": -35.42738,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99154-7523",
    "diretor": "Maurício Marlisson dos Santos Pessoa",
    "cor": "#22C55E",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_009",
    "nome": "E.M. ANTÃO MELO DA SILVA (PONTA DO MATO)",
    "inep": "24052620",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Ponta do Mato",
    "endereco": "Logradouro Compositor José Luiz, nº 650, Ponta do Mato, Ceará-Mirim",
    "lat": -5.69,
    "lng": -35.4639,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99162-4435",
    "diretor": "Adriana Nicácio da Silva",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_010",
    "nome": "E.M. ALCIDES CÂMARA DE SOUZA (CAPELA)",
    "inep": "24052256",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Capela",
    "endereco": "Rua Alcides Câmara de Souza, S/N, Capela, Ceará-Mirim",
    "lat": -5.610268,
    "lng": -35.448749,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "98810-7409",
    "diretor": "Maria do Carmo Nascimento da Silva",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I",
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_011",
    "nome": "E.M. PROFA ALZIRA DA SÁ PEREIRA (PROJETO SANTA ÁGUEDA II)",
    "inep": "24052418",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Projeto Santa Águeda II",
    "endereco": "Povoado Santa Águeda, nº 150-A, Zona Rural, Ceará-Mirim",
    "lat": -5.493694,
    "lng": -35.460678,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99423-4548",
    "diretor": "Iriscélia dos Santos Melo",
    "cor": "#166534",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_012",
    "nome": "E.M. ARY ALECRIM PACHECO (PEDREGULHO)",
    "inep": "24079944",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "São José Pedregulho",
    "endereco": "Rua Santa Luzia, nº 30, São José Pedregulho, Ceará-Mirim",
    "lat": -5.582149,
    "lng": -35.475642,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99198-1693",
    "diretor": "Sanzia Maria dos Santos",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_013",
    "nome": "E.M. RUY PEREIRA JÚNIOR (MURIÚ)",
    "inep": "24052280",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Muriú",
    "endereco": "Avenida Antonio Basilio, S/N, Muriú, Ceará-Mirim",
    "lat": -5.5633,
    "lng": -35.2414,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99970-0455",
    "diretor": "Fabiana Sérgia Nobre Varela",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_014",
    "nome": "E.M. BELARMINA CAMPOS (LOGRADOURO)",
    "inep": "24052299",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Logradouro / Primeira Lagoa",
    "endereco": "Povoado Logradouro, nº 8824, Primeira Lagoa, Ceará-Mirim",
    "lat": -5.6885,
    "lng": -35.5443,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99936-4670",
    "diretor": "Amanda Gomes de Lima",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_015",
    "nome": "E.M. BRASILIANO JERÔNIMO DA SILVA (ALTO DO SÍTIO)",
    "inep": "24052396",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Sítio",
    "endereco": "Rua Principal, S/N, Povoado de Sítio, Ceará-Mirim",
    "lat": -5.61541,
    "lng": -35.295748,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99158-2501",
    "diretor": "Jeane Gomes Baracho",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_016",
    "nome": "E.M. BRASILIANO MARQUES DE ARAÚJO (JACUMÃ)",
    "inep": "24052302",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Praia de Jacumã",
    "endereco": "Praia de Jacumã, S/N, Praia de Jacumã, Ceará-Mirim",
    "lat": -5.585302,
    "lng": -35.228221,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99987-1861",
    "diretor": "Lecijane de Oliveira de Assis",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_017",
    "nome": "E.M. CERU – PROF.ª NEUMA FERREIRA JANUÁRIO (COQUEIROS)",
    "inep": "24052060",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Coqueiros",
    "endereco": "Povoado Coqueiros, nº 639, Coqueiros, Ceará-Mirim",
    "lat": -5.605941,
    "lng": -35.299655,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99899-8848",
    "diretor": "Glayson Barbosa do Nascimento",
    "cor": "#166534",
    "icone": "II",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_018",
    "nome": "E.M. CONCEIÇÃO MARQUES (RIO DOS ÍNDIOS)",
    "inep": "24052310",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Rio dos Índios de Cima",
    "endereco": "Povoado Rio dos Índios de Cima, nº 312, Zona Rural, Ceará-Mirim",
    "lat": -5.593177,
    "lng": -35.337241,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99170-2049",
    "diretor": "Sebastião da Silva Marques",
    "cor": "#166534",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_019",
    "nome": "E.M. EMÍDIO FERREIRA DA SILVA (RIO DOS ÍNDIOS)",
    "inep": "24052469",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Rio dos Índios de Cima",
    "endereco": "Povoado Rio dos Índios de Cima, nº 690, Rio dos Índios de Cima, Ceará-Mirim",
    "lat": -5.591263,
    "lng": -35.343849,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99185-9588",
    "diretor": "Andreza Silva do Nascimento",
    "cor": "#166534",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_020",
    "nome": "E.M. EMILIA PETRONILA DA ROCHA (RIACHÃO)",
    "inep": "24071188",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Riachão",
    "endereco": "Povoado Riachão, nº 2, Riachão, Ceará-Mirim",
    "lat": -5.51981,
    "lng": -35.387443,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99180-2268",
    "diretor": "Dalvani Silva de Oliveira",
    "cor": "#166534",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_021",
    "nome": "E.M. FELIPE CAMARÃO (RAPOSA)",
    "inep": "24052477",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Raposa",
    "endereco": "Povoado Raposa, nº 11-Y, Zona Rural, Ceará-Mirim",
    "lat": -5.6611,
    "lng": -35.3355,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99211-7914",
    "diretor": "Maria da Conceição de Araújo Rodrigues",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_022",
    "nome": "E.M. FERDINANDO PEREIRA COUTO (TERRA DA SANTA)",
    "inep": "24071668",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Terra da Santa",
    "endereco": "Rua Principal, nº 932, Terra da Santa, Ceará-Mirim",
    "lat": -5.63611,
    "lng": -35.44839,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99670-0945",
    "diretor": "Maria da Conceição Silva Barbosa",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_023",
    "nome": "E.M. FRANCISCO DE ASSIS SANTANA",
    "inep": "24091359",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Assentamento Espírito Santo",
    "endereco": "Assentamento Espírito Santo, S/N, Assentamento Espírito Santo, Ceará-Mirim",
    "lat": -5.65017,
    "lng": -35.48568,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99460-8079",
    "diretor": "Francisco Germanico Luiz",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_024",
    "nome": "E.M. GONÇALO TEIXEIRA DA SILVA (LAGOA GRANDE)",
    "inep": "24052493",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Lagoa Grande",
    "endereco": "Povoado Lagoa Grande, nº 38, Lagoa Grande, Ceará-Mirim",
    "lat": -5.6361,
    "lng": -35.3868,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99153-8080",
    "diretor": "Alda Lúcia Melo de Paiva Medeiros",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_025",
    "nome": "E.M. HELENA VILAR RIBEIRO DANTAS (MINAMORA)",
    "inep": "24052515",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Minamora",
    "endereco": "Povoado Minamora, nº 1, Minamora, Ceará-Mirim",
    "lat": -5.5368,
    "lng": -35.4312,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99482-6284 / 99401-4374",
    "diretor": "Fernanda Souza do Nascimento",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_026",
    "nome": "E.M. PROFA. ILÇA MIRANDA PACHECO (SÃO MIGUEL)",
    "inep": "24052388",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "São Miguel",
    "endereco": "Povoado São Miguel, nº 21, Zona Rural, Ceará-Mirim",
    "lat": -5.473922,
    "lng": -35.367004,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99439-7606",
    "diretor": "Raimunda Rosângela da Silva",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_027",
    "nome": "E.M. PROF. JOÃO GABRIEL DE OLIVEIRA (ANINGAS)",
    "inep": "24052329",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Aningas",
    "endereco": "Povoado de Aningas, S/N, Povoado de Aningas, Ceará-Mirim",
    "lat": -5.533783,
    "lng": -35.305532,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99235-1954",
    "diretor": "Maria Aparecida dos Santos",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_028",
    "nome": "E.M. JOAQUIM FERNANDES SOBRAL (TABUÃO)",
    "inep": "24052531",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Tabuão",
    "endereco": "Povoado Tabuão, nº 45, Tabuão, Ceará-Mirim",
    "lat": -5.6422,
    "lng": -35.3647,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99122-8618",
    "diretor": "Waleska Vivianny Ferreira de Lima",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_029",
    "nome": "E.M. JOSÉ ADELINO (PRIMEIRA LAGOA)",
    "inep": "24052558",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Comunidade Primeira Lagoa",
    "endereco": "Rua São Sebastião, nº 5, Comunidade Primeira Lagoa, Ceará-Mirim",
    "lat": -5.6945,
    "lng": -35.5285,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99131-2193",
    "diretor": "Sergio Marçal de Barros",
    "cor": "#166534",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_030",
    "nome": "E.M. JOSÉ VENÂNCIO (VÁRZEA DE DENTRO)",
    "inep": "24052566",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Várzea de Dentro",
    "endereco": "Povoado Várzea de Dentro, nº 1, Várzea de Dentro, Ceará-Mirim",
    "lat": -5.6186,
    "lng": -35.4767,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "98149-1349",
    "diretor": "Francinilma Rocha dos Santos",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_031",
    "nome": "E.M. MANOEL DANTAS BARRETO (JACOCA)",
    "inep": "24071200",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Jacoca",
    "endereco": "Povoado Jacoca, nº 57, Jacoca, Ceará-Mirim",
    "lat": -5.664705,
    "lng": -35.452623,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99450-2126",
    "diretor": "Maria Jaciara Pereira de Lima",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_032",
    "nome": "E.M. MANOEL PEREIRA DOS SANTOS (PRIMAVERA)",
    "inep": "24052221",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Sítio Primavera",
    "endereco": "Sítio Primavera, S/N, Sítio Primavera, Ceará-Mirim",
    "lat": -5.58051,
    "lng": -35.393033,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99415-8025",
    "diretor": "Wedna Melo dos Santos de Andrade",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_033",
    "nome": "E.M. MARA CABRAL (BOA VISTA)",
    "inep": "24052337",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Boa Vista",
    "endereco": "Povoado de Boa Vista, S/N, Povoado de Boa Vista, Ceará-Mirim",
    "lat": -5.598,
    "lng": -35.3211,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99135-1266",
    "diretor": "Jayne Lima Ribeiro",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_034",
    "nome": "E.M. PROFA MARIA DE LOURDES DE OLIVEIRA (GRAVATÁ)",
    "inep": "24082228",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Distrito de Gravatá",
    "endereco": "Distrito de Gravatá, S/N, Distrito de Gravatá, Ceará-Mirim",
    "lat": -5.59407,
    "lng": -35.408782,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99166-6626",
    "diretor": "Maria da Conceição da Luz",
    "cor": "#166534",
    "icone": "I",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_035",
    "nome": "E.M. PROF.ª MARIA ESTER PAIVA (MASSANGANA)",
    "inep": "24052353",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Massangana",
    "endereco": "Povoado de Massangana, S/N, Povoado de Massangana, Ceará-Mirim",
    "lat": -5.646398,
    "lng": -35.35106,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99127-6425",
    "diretor": "Rayana Lopes de Souza",
    "cor": "#166534",
    "icone": "II",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_036",
    "nome": "E.M. MONSENHOR RUI MIRANDA (PROJETO SANTA ÁGUEDA I)",
    "inep": "24075523",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Projeto Santa Águeda I",
    "endereco": "Povoado Santa Águeda, nº 77, Zona Rural, Ceará-Mirim",
    "lat": -5.506462,
    "lng": -35.449452,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99101-3086",
    "diretor": "Rejaneide Pires Macedo Nascimento",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_037",
    "nome": "E.M. PEDRO JUSTINO DOS SANTOS (TAMANDUÁ)",
    "inep": "24052612",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Sítio Tamanduá",
    "endereco": "Sítio Tamanduá, S/N, Sítio Tamanduá, Ceará-Mirim",
    "lat": -5.575,
    "lng": -35.382,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99149-4077",
    "diretor": "Jacira Soares do Nascimento",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_038",
    "nome": "E.M. PEDRO SALOMÃO (CAIANA)",
    "inep": "24052345",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Caiana",
    "endereco": "Povoado de Caiana, S/N, Povoado de Caiana, Ceará-Mirim",
    "lat": -5.587797,
    "lng": -35.27108,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99430-3421",
    "diretor": "Josenice Lima Ribeiro Martins",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_039",
    "nome": "E.M. PAULO FREIRE (MANIBÚ)",
    "inep": "24090581",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Comunidade Manibú",
    "endereco": "Comunidade Manibú, S/N, Comunidade Manibú, Ceará-Mirim",
    "lat": -5.5302,
    "lng": -35.474,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99155-3802",
    "diretor": "Kaline Oliveira da Silva",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I",
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_040",
    "nome": "E.M. PROF.ª MARIA BERNADETE BARBOSA (MASSARANDUBA)",
    "inep": "24052426",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Massaranduba",
    "endereco": "Rua Massaranduba, nº 346, Massaranduba, Ceará-Mirim",
    "lat": -5.721942,
    "lng": -35.365365,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "98895-3914",
    "diretor": "Rejane Avelino Justino Fernandes",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental I",
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_041",
    "nome": "E.M. SÉRGIO VARELA SANTIAGO (COQUEIROS)",
    "inep": "24052663",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Coqueiros",
    "endereco": "Povoado Coqueiros, nº 661, Coqueiros, Ceará-Mirim",
    "lat": -5.6043,
    "lng": -35.3041,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "98873-8964",
    "diretor": "Francisco de Assis Praxedes",
    "cor": "#166534",
    "icone": "X",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ]
  },
  {
    "id": "esc_042",
    "nome": "E.M. VIRGILIO LUIZ (MATAS)",
    "inep": "24052671",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Matas",
    "endereco": "Povoado Matas, nº 42, Matas, Ceará-Mirim",
    "lat": -5.598656,
    "lng": -35.482889,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99164-8041",
    "diretor": "Idayane da Silva Ferreira",
    "cor": "#166534",
    "icone": "II",
    "rede": "Municipal",
    "segmentos": [
      "Ens. Fundamental II"
    ]
  },
  {
    "id": "esc_043",
    "nome": "E.M. SEVERINO PINHEIRO DA SILVA",
    "inep": "24052361",
    "categoria": "Escola",
    "zona": "Rural",
    "bairroDistrito": "Mineiros",
    "endereco": "Povoado Mineiros, nº 57, Mineiros, Ceará-Mirim",
    "lat": -5.57868,
    "lng": -35.49071,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99205-1338",
    "diretor": "Francinalva da Silva Araújo",
    "cor": "#166534",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_044",
    "nome": "CEI MARIA ALICE DE BRITO (MASSARANDUBA)",
    "inep": "24077321",
    "categoria": "Centro de Educação Infantil",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Massaranduba",
    "endereco": "BR 406 KM 156, S/N, Povoado de Massaranduba, Ceará-Mirim",
    "lat": -5.721755,
    "lng": -35.366342,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99605-1840",
    "diretor": "Francisca Rassiana M. Nascimento",
    "cor": "#166534",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_045",
    "nome": "CEI ROSILDA RODRIGUES DUARTE (GRAVATÁ)",
    "inep": "24082236",
    "categoria": "Centro de Educação Infantil",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Gravatá",
    "endereco": "Povoado de Gravatá, S/N, Povoado de Gravatá, Ceará-Mirim",
    "lat": -5.595009,
    "lng": -35.408872,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99423-4747",
    "diretor": "Maria de Fátima Souza do Nascimento Costa",
    "cor": "#166534",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_046",
    "nome": "CEI MARIA DE LOURDES (PRIMEIRA LAGOA)",
    "inep": "24077240",
    "categoria": "Centro de Educação Infantil",
    "zona": "Rural",
    "bairroDistrito": "Povoado de Primeira Lagoa",
    "endereco": "Povoado de Primeira Lagoa, S/N, Povoado de Primeira Lagoa, Ceará-Mirim",
    "lat": -5.694942,
    "lng": -35.52665,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99485-9229",
    "diretor": "Célia Maria Praxedes da Silva",
    "cor": "#166534",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_047",
    "nome": "CEI MENINO JESUS",
    "inep": "24077380",
    "categoria": "Centro de Educação Infantil",
    "zona": "Urbana",
    "bairroDistrito": "Nova Descoberta",
    "endereco": "Rua Prisco Rocha, nº 1711, Nova Descoberta, Ceará-Mirim",
    "lat": -5.6476,
    "lng": -35.4332,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99428-5926",
    "diretor": "Alessandra Araújo da Silva Frutuoso",
    "cor": "#22C55E",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_048",
    "nome": "CEI VER. RAFAEL F. SOBRAL",
    "inep": "24063665",
    "categoria": "Centro de Educação Infantil",
    "zona": "Urbana",
    "bairroDistrito": "Centro",
    "endereco": "Av. Luiz Lopes Varela, nº 610, Centro, Ceará-Mirim",
    "lat": -5.6404125,
    "lng": -35.4201687,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99491-0332",
    "diretor": "Maria do Socorro Silva de Brito",
    "cor": "#22C55E",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_049",
    "nome": "CEI MONSENHOR RUI MIRANDA",
    "inep": "24072338",
    "categoria": "Centro de Educação Infantil",
    "zona": "Urbana",
    "bairroDistrito": "Centro",
    "endereco": "Rua José Olímpio Alves Pereira, nº 196, Centro, Ceará-Mirim",
    "lat": -5.6366,
    "lng": -35.421,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99448-8174",
    "diretor": "Maria Luiza de Castro Pontes",
    "cor": "#22C55E",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_050",
    "nome": "CEI RUI PEREIRA DOS SANTOS",
    "inep": "24082805",
    "categoria": "Centro de Educação Infantil",
    "zona": "Rural",
    "bairroDistrito": "Conjunto Novos Tempos",
    "endereco": "Rua Rio Sem Dinheiro, S/N, Conjunto Novos Tempos, Ceará-Mirim",
    "lat": -5.6399,
    "lng": -35.4395,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99468-7179",
    "diretor": "Rejane Cassiano Dias",
    "cor": "#166534",
    "icone": "C",
    "rede": "Municipal",
    "segmentos": [
      "Ed. Infantil"
    ]
  },
  {
    "id": "esc_051",
    "nome": "Centro Municipal de Apoio à Inclusão — CEMAI",
    "inep": "24081400",
    "categoria": "Instituição",
    "zona": "Urbana",
    "bairroDistrito": "Centro",
    "endereco": "Rua Prefeito Edgar Varela, nº 564, Centro, Ceará-Mirim",
    "lat": -5.6415,
    "lng": -35.4228,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "99149-5856",
    "diretor": "Marinalva de Castro da Silva",
    "cor": "#22C55E",
    "icone": "★",
    "rede": "Municipal",
    "segmentos": [
      "Educação Especial"
    ]
  },
  {
    "id": "esc_est_001",
    "nome": "Colégio Estadual Monsenhor Urbano",
    "inep": "24021020",
    "rede": "Estadual",
    "categoria": "Escola",
    "segmentos": [
      "Ens. Fundamental II",
      "Ensino Médio"
    ],
    "zona": "Urbana",
    "bairroDistrito": "Centro",
    "endereco": "Rua General João Varela, 250, Centro, Ceará-Mirim/RN",
    "lat": -5.6322,
    "lng": -35.4248,
    "turnos": [
      "Matutino",
      "Vespertino",
      "Noturno"
    ],
    "telefone": "(84) 3274-5930",
    "diretor": "Gestão Escolar 7ª DIREC",
    "cor": "#FACC15",
    "icone": "X"
  },
  {
    "id": "esc_est_002",
    "nome": "E. E. Desembargador Silvino Bezerra",
    "inep": "24021021",
    "rede": "Estadual",
    "categoria": "Escola",
    "segmentos": [
      "Ens. Fundamental I",
      "Ens. Fundamental II"
    ],
    "zona": "Urbana",
    "bairroDistrito": "São Geraldo",
    "endereco": "Rua Santa Luzia, s/n, São Geraldo, Ceará-Mirim/RN",
    "lat": -5.6365,
    "lng": -35.4215,
    "turnos": [
      "Matutino",
      "Vespertino",
      "Noturno"
    ],
    "telefone": "(84) 3274-5931",
    "diretor": "Gestão Escolar SEEC/RN",
    "cor": "#FACC15",
    "icone": "X"
  },
  {
    "id": "esc_fed_001",
    "nome": "IFRN — Campus Ceará-Mirim",
    "inep": "24021022",
    "rede": "Federal",
    "categoria": "Instituição",
    "segmentos": [
      "Ensino Médio",
      "Ensino Técnico"
    ],
    "zona": "Urbana",
    "bairroDistrito": "Planalto / BR-406",
    "endereco": "Rodovia BR-406, Km 145, Planalto, Ceará-Mirim/RN",
    "lat": -5.6275,
    "lng": -35.4412,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "(84) 4005-4100",
    "diretor": "Diretoria Geral IFRN",
    "cor": "#38BDF8",
    "icone": "X"
  },
  {
    "id": "esc_priv_001",
    "nome": "Colégio Santa Águeda (Rede Privada)",
    "inep": "24021023",
    "rede": "Privada",
    "categoria": "Escola",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I",
      "Ens. Fundamental II"
    ],
    "zona": "Urbana",
    "bairroDistrito": "Santa Águeda",
    "endereco": "Av. Enéas Cavalcante, 280, Santa Águeda, Ceará-Mirim/RN",
    "lat": -5.6318,
    "lng": -35.4221,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "(84) 3274-2100",
    "diretor": "Coordenação Pedagógica CSA",
    "cor": "#EF4444",
    "icone": "X"
  },
  {
    "id": "esc_priv_002",
    "nome": "Educandário Sagrada Família (Rede Privada)",
    "inep": "24021024",
    "rede": "Privada",
    "categoria": "Escola",
    "segmentos": [
      "Ed. Infantil",
      "Ens. Fundamental I"
    ],
    "zona": "Urbana",
    "bairroDistrito": "Centro",
    "endereco": "Rua Coronel Meira e Sá, 142, Centro, Ceará-Mirim/RN",
    "lat": -5.6341,
    "lng": -35.4233,
    "turnos": [
      "Matutino",
      "Vespertino"
    ],
    "telefone": "(84) 3274-1580",
    "diretor": "Direção Pedagógica ESF",
    "cor": "#EF4444",
    "icone": "X"
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
