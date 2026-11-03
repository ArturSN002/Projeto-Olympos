/**
 * @fileoverview Dicionário fixo com todos os IDs reais de 2025/2026, Automações, Subprojetos e Perfis RBAC da SMEB.
 * Versão 2.0.0 — Hub Olympos
 */

const OLYMPOS_IDS = {
  RAIZ_SMEB: '18k1Xq0BGSJ8PHfVn9633Bky1EHHCENg6',
  PASTA_OLYMPO: '1W9mGmQCrX8BRPsGcK_vqUwfXw1dRmSya',
  PASTA_MEMORIAS_MD: '1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu',
  PASTA_TRANSPARENCIA_PORTAIS: '1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD',
  AUTOMACOES: '1gd5oe_lZELzk5gNredslf8MeR-rOxEI1',
  PROJETOS_E_CSV_SERVIDORES: '1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD',
  BACKUP_MAQUINA_LOCAL_DEDALO: '1utZF8Najg1mdeGiHJuqxMmMlhvDrYr5j',

  // Planilha Oficial Fixa do Diário Oficial (FEMURN 2026) - IMUTÁVEL (NUNCA CRIAR NOVA)
  PLANILHA_DIARIO_OFICIAL: '1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY',
  PLANILHA_FEMURN: '1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY',
  ABA_DIARIO_OFICIAL: 'Publicações',

  // Planilha Oficial de Permutas (O Papiro de Cadmo / Hera)
  PLANILHA_PERMUTAS: '1fOZHe871yxu6UdF0vsRzjSzQBc7AVFRZZtx3JSCdwCY',

  // Planilha de Acessos Futura (Login e Credenciais com Hash SHA-256)
  PLANILHA_ACESSOS_ID: '', // Configurável via Script Properties 'OLYMPOS_ACESSOS_SHEET_ID'

  MODELOS_DOCS: {
    LICENCA: '1AwMpqn0RUP9uDw7YPcPP0TsZ5MZ71Nr2gSlbRRXZ7iw',
    OFICIO: '1HgPOD0BzOO3t33eN2DuRjrH64vnuoJnxyp5VX6ec8Xw',
    READAPTACAO: '1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce5',
    DECLARACAO: '17Bj5L6kMdgwYO8wZHTvdOebnzQ1jLkT_u9DBAkfC-RE'
  },

  // Estado Global e Contadores Sequenciais persistidos em arquivo .md no Google Drive
  // Vinculado exclusivamente ao ID Canônico de _memoria_apolo (1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_)
  ESTADO_GLOBAL_MD: {
    ARQUIVO_CONTADORES_ID: '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_',
    NOME_ARQUIVO: '_memoria_apolo.md',
    PISO_INICIAL_2026: {
      proximoOficio2026: 155,
      ultimoOficio2026: 154,
      proximaPortaria2026: 163,
      ultimaPortaria2026: 162,
      proximoMemorando2026: 1,
      proximoParecerJuridico2026: 1,
      proximoEditalPss2026: 1,
      signatarioTitular: 'Secretário(a) Municipal de Educação Básica',
      cargoSignatario: 'Secretário(a) Municipal de Educação Básica',
      anoExercicioAtivo: '2026'
    }
  },

  SETORES_2026: {
    GERAL: '1ZuZBYDg08_KgYNAPcpxy-f5fP6HY4USY',
    GABINETE: '16YaFjfO6DRPVzJtRzLsynrOI0llNXQ8L',
    ASSESSORIA_JURIDICA: '1N6UgdyGTVdIP4PW02dDBstsi4LIhgmRJ',
    PERMUTAS: '1SDBCXU3LjI0Qnf6E6O6SLqRjctHz70k0',
    PROCESSOS_SELETIVOS: '1Kwqo9s_AA3wsFajVw_l3rO69P8keNwlU',
    PORTARIAS: '1QEewN0R3bCksLxLhmOSFq20EQYI3g64Q',
    OFICIOS: '1UMHKKCWgJTq4YtcWni1ixL6tHKwyLpcK',
    PEDAGOGICO: '1Zsfr3zH_OPXnOloE788lNXIEPbRBP7md',
    ADMINISTRATIVO: '17e4cQONqIreUTftuJ1mYTUEIVk87g-ko',
    PORTARIAS_FEMURN_PUBLICADAS: '17Dq3ST3Vv5soKFpvol9jL_gtixdxXqLp',
    PORTARIAS_LICENCAS: '1So_-b_tFmr_nL2VwsbMaRCz_lUzvBUnj',
    PORTARIAS_LICENCAS_PUBLICADAS: '1ABKy7nu7DWdI5ayGZ19mfV3So4htrMda',
    PLANILHA_CONTROLE_LICENCAS: '1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc',
    PORTARIAS_READAPTACOES: '174FW9KKkpfRY8NDOydG1rDGlZnnXUkxQ',
    PLANILHA_CONTROLE_READAPTACOES: '1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0'
  },

  ACERVO_2025: {
    GERAL: '1CAt0hJR3fiuJxPVEojTxG2NORzOTM735',
    GENERICOS: '1CAt0hJR3fiuJxPVEojTxG2NORzOTM735',
    GABINETE: '1vN6P_o0g98z4JyCfrRwBtfJBecDu1Kkx',
    ADMINISTRATIVO: '1H57IBTB5rZJ7SH3S7ry_hOC0BUcqie0A',
    PEDAGOGICO: '1oLKjvbiws9vW6Z-rFPu9zBph_QvxcKZw',
    PERMUTAS: '1SGUh4UhIk1AzIH8A9L7Y3HOPKxjvXR68',
    PROCESSOS_SELETIVOS: '1AW3QJ3GQVaRwAkLCCHAQ5FT8EJXFSzgG'
  },

  SUBPROJETOS: {
    LIRA_PASTA: '1XriqpPQsWjQxJROsE_FyaQQpCwybJSUJ',
    LIRA_SCRIPT: '1xYscUFkl_RGLr4-8ivnxI1DWEejvjSuhzHC4CiMd2pgV2kTmdeSADm2n',
    PINCEL_LICENCAS_PASTA: '1So_-b_tFmr_nL2VwsbMaRCz_lUzvBUnj',
    PINCEL_LICENCAS_PLANILHA: '1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc',
    PINCEL_LICENCAS_SCRIPT: '1EN9S1TWbrEKPGp09RyKLwg04MKUdfgQn2f8kMt69XBugYCsGCFr_vK83',
    PINCEL_READAPT_PASTA: '174FW9KKkpfRY8NDOydG1rDGlZnnXUkxQ',
    PINCEL_READAPT_PLANILHA: '1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0',
    PINCEL_READAPT_SCRIPT: '1OdAWEmWPfZTxeBaiMrQDuTO-pqYyrKBcryDvQrxUnJP3-aN706a-lLqB',
    PAPIRO_CADMO_PASTA: '1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD'
  },

  MAPA_MEMORIAS_ID: {
    // 11 Memórias Históricas Provisionadas com IDs Canônicos Oficiais
    'apolo':              '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_',
    '_memoria_apolo':     '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_',
    '_memoria_apolo.md':  '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_',

    'atena':              '1bngNddimtP8nMmfhUJEa1YvkSEcmZ69Q',
    '_memoria_atena':     '1bngNddimtP8nMmfhUJEa1YvkSEcmZ69Q',
    '_memoria_atena.md':  '1bngNddimtP8nMmfhUJEa1YvkSEcmZ69Q',

    'dedalo':             '16U0x5463ldiyxjgbN5IyiYNoCQQ4BdF-',
    'dédalo':             '16U0x5463ldiyxjgbN5IyiYNoCQQ4BdF-',
    '_memoria_dedalo':    '16U0x5463ldiyxjgbN5IyiYNoCQQ4BdF-',
    '_memoria_dedalo.md': '16U0x5463ldiyxjgbN5IyiYNoCQQ4BdF-',

    'helio':              '1JGVVV1umqhKa06nKDK5h_6TD34_Z2v90',
    'hélio':              '1JGVVV1umqhKa06nKDK5h_6TD34_Z2v90',
    '_memoria_helio':     '1JGVVV1umqhKa06nKDK5h_6TD34_Z2v90',
    '_memoria_helio.md':  '1JGVVV1umqhKa06nKDK5h_6TD34_Z2v90',

    'hera':               '1nV-BkugwDaDiqgvodP6VV-gNFi5tRMXh',
    '_memoria_hera':      '1nV-BkugwDaDiqgvodP6VV-gNFi5tRMXh',
    '_memoria_hera.md':   '1nV-BkugwDaDiqgvodP6VV-gNFi5tRMXh',

    'hermes':             '1yKxawxSXKGzT-qCWfNPN3cqVgIzcoLWH',
    '_memoria_hermes':    '1yKxawxSXKGzT-qCWfNPN3cqVgIzcoLWH',
    '_memoria_hermes.md': '1yKxawxSXKGzT-qCWfNPN3cqVgIzcoLWH',

    'hestia':             '1uUuHvJ-fsjlqK_CWrin-YBBp_0VmiJKnSBiujFUP8VM',
    'héstia':             '1uUuHvJ-fsjlqK_CWrin-YBBp_0VmiJKnSBiujFUP8VM',
    '_memoria_hestia':    '1uUuHvJ-fsjlqK_CWrin-YBBp_0VmiJKnSBiujFUP8VM',
    '_memoria_hestia.md': '1uUuHvJ-fsjlqK_CWrin-YBBp_0VmiJKnSBiujFUP8VM',

    'homero':             '1JTB1SMgjq9Ws4E4RDBVAkH2GmCK1Fv6Q',
    '_memoria_homero':    '1JTB1SMgjq9Ws4E4RDBVAkH2GmCK1Fv6Q',
    '_memoria_homero.md': '1JTB1SMgjq9Ws4E4RDBVAkH2GmCK1Fv6Q',

    'nike':               '13ziWkZGuh3HSTvSjE8fXlqoPTEc-kHze',
    'níke':               '13ziWkZGuh3HSTvSjE8fXlqoPTEc-kHze',
    '_memoria_nike':      '13ziWkZGuh3HSTvSjE8fXlqoPTEc-kHze',
    '_memoria_nike.md':   '13ziWkZGuh3HSTvSjE8fXlqoPTEc-kHze',

    'orfeu':              '1OUIM7SUDvEtnn08kIMyedRnp1UHKiWhF',
    '_memoria_orfeu':     '1OUIM7SUDvEtnn08kIMyedRnp1UHKiWhF',
    '_memoria_orfeu.md':  '1OUIM7SUDvEtnn08kIMyedRnp1UHKiWhF',

    'temis':              '1cGAfAIynCD6xbwg7HpAx3_GLy6q0yOwt',
    'têmis':              '1cGAfAIynCD6xbwg7HpAx3_GLy6q0yOwt',
    '_memoria_temis':     '1cGAfAIynCD6xbwg7HpAx3_GLy6q0yOwt',
    '_memoria_temis.md':  '1cGAfAIynCD6xbwg7HpAx3_GLy6q0yOwt',

    // Personas Complementares do Catálogo Oficial de 17 Personas (Auto-resolvidas e Cacheadas via ScriptProperties)
    'zeus':               '',
    '_memoria_zeus':      '',
    '_memoria_zeus.md':   '',

    'hefesto':            '',
    '_memoria_hefesto':   '',
    '_memoria_hefesto.md': '',

    'demeter':            '',
    'deméter':            '',
    '_memoria_demeter':   '',
    '_memoria_demeter.md': '',

    'poseidon':           '',
    '_memoria_poseidon':  '',
    '_memoria_poseidon.md': '',

    'cronos':             '',
    '_memoria_cronos':    '',
    '_memoria_cronos.md': '',

    'ares':               '',
    '_memoria_ares':      '',
    '_memoria_ares.md':   '',

    'afrodite':           '',
    '_memoria_afrodite':  '',
    '_memoria_afrodite.md': '',

    'dionisio':           '',
    'dionísio':           '',
    '_memoria_dionisio':  '',
    '_memoria_dionisio.md': '',

    'artemis':            '',
    'ártemis':            '',
    '_memoria_artemis':   '',
    '_memoria_artemis.md': '',

    'hades':              '',
    '_memoria_hades':     '',
    '_memoria_hades.md':  '',

    'prometeu':           '',
    '_memoria_prometeu':  '',
    '_memoria_prometeu.md': ''
  },

  // Matriz Oficial Canônica das 17 Personas da Governança SMEB
  CATALOGO_17_PERSONAS: [
    { slug: 'zeus',     nome: 'Zeus',     arquivo: '_memoria_zeus.md',     camada: 'Camada 1 — Governança e Roteamento Macro', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Gabinete Executivo, Triagem Macro, Roteamento Zero-Latency e Governança Global', icone: 'zeus' },
    { slug: 'apolo',    nome: 'Apolo',    arquivo: '_memoria_apolo.md',    camada: 'Camada 2 — Gestão e Expedição de Atos', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Numeração Sequencial de Ofícios e Portarias', icone: 'apolo' },
    { slug: 'hermes',   nome: 'Hermes',   arquivo: '_memoria_hermes.md',   camada: 'Camada 2 — Logística e Operações de Campo', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Transporte Escolar, Frotas e Logística Operacional', icone: 'hermes' },
    { slug: 'hefesto',  nome: 'Hefesto',  arquivo: '_memoria_hefesto.md',  camada: 'Camada 2 — Infraestrutura, Obras e Patrimônio', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Infraestrutura Escolar, Manutenção e Obras', icone: 'hefesto' },
    { slug: 'demeter',  nome: 'Deméter',  arquivo: '_memoria_demeter.md',  camada: 'Camada 2 — Suprimentos Nutricionais e PNAE', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Alimentação Escolar e Gestão PNAE', icone: 'demeter' },
    { slug: 'poseidon', nome: 'Poseidon', arquivo: '_memoria_poseidon.md', camada: 'Camada 2 — Segurança Hídrica e Infraestrutura Sanitária', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Segurança Hídrica e Infraestrutura Sanitária', icone: 'poseidon' },
    { slug: 'hestia',   nome: 'Héstia',   arquivo: '_memoria_hestia.md',   camada: 'Camada 2 — Segurança Documental, Recepção e Triagem', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Governança Central, Despacho e Segurança Documental', icone: 'hestia' },
    { slug: 'cronos',   nome: 'Cronos',   arquivo: '_memoria_cronos.md',   camada: 'Camada 2 — Auditoria Temporal e Continuidade Histórica', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Auditoria Temporal e Continuidade Histórica', icone: 'cronos' },
    { slug: 'hera',     nome: 'Hera',     arquivo: '_memoria_hera.md',     camada: 'Camada 2 — Recursos Humanos e Gestão de Pessoas', perfilRbac: 'RH_COMISSAO',       dominio: 'Gestão de Pessoas, Lotação, Atestos e Permutas', icone: 'hera' },
    { slug: 'ares',     nome: 'Ares',     arquivo: '_memoria_ares.md',     camada: 'Camada 2 — Disciplina Funcional e Resolução de Conflitos', perfilRbac: 'RH_COMISSAO',       dominio: 'Mediação de Conflitos e Disciplina Funcional', icone: 'ares' },
    { slug: 'afrodite', nome: 'Afrodite', arquivo: '_memoria_afrodite.md', camada: 'Camada 2 — Saúde Mental, Clima Escolar e Valorização Humana', perfilRbac: 'RH_COMISSAO',       dominio: 'Saúde Mental, Clima Escolar e Valorização dos Servidores', icone: 'afrodite' },
    { slug: 'atena',    nome: 'Atena',    arquivo: '_memoria_atena.md',    camada: 'Camada 2 — Gestão Pedagógica e Ensino-Aprendizagem', perfilRbac: 'PEDAGOGICO_EVENTOS',dominio: 'Coordenação Pedagógica, Currículo e BNCC', icone: 'atena' },
    { slug: 'dionisio', nome: 'Dionísio', arquivo: '_memoria_dionisio.md', camada: 'Camada 2 — Eventos, Cultura e Esporte Escolar', perfilRbac: 'PEDAGOGICO_EVENTOS',dominio: 'Eventos Culturais, Esporte Escolar e JEMs', icone: 'dionisio' },
    { slug: 'temis',    nome: 'Têmis',    arquivo: '_memoria_temis.md',    camada: 'Camada 2 — Assessoria Jurídica e Controle de Legalidade', perfilRbac: 'JURIDICO',          dominio: 'Assessoria Jurídica e Pareceres Técnicos', icone: 'temis' },
    { slug: 'artemis',  nome: 'Ártemis',  arquivo: '_memoria_artemis.md',  camada: 'Camada 2 — Conformidade Regulatória e Auditoria Jurídica', perfilRbac: 'JURIDICO',          dominio: 'Conformidade Regulatória e Auditoria FUNDEB', icone: 'artemis' },
    { slug: 'hades',    nome: 'Hades',    arquivo: '_memoria_hades.md',    camada: 'Camada 2 — Contencioso Estratégico e Gestão de Riscos Graves', perfilRbac: 'JURIDICO',          dominio: 'Contencioso Estratégico e Gestão de Riscos Graves', icone: 'hades' },
    { slug: 'prometeu', nome: 'Prometeu', arquivo: '_memoria_prometeu.md', camada: 'Camada 2 — Coleta de Inteligência e Monitoramento Oficial', perfilRbac: 'ADMIN_GABINETE',    dominio: 'Vigilância Ativa do Diário Oficial e Inteligência FEMURN', icone: 'prometeu' }
  ],

  // Mapeamento Completo de Memórias Operacionais para Listagem no Painel (17 Personas + Especializadas)
  MEMORIAS_PADRAO: [
    { id: '', arquivo: '_memoria_zeus.md', deus: 'Zeus', slug: 'zeus', camada: 'Camada 1 — Governança e Roteamento Macro', perfilRbac: 'ADMIN_GABINETE', dominio: 'Gabinete Executivo, Triagem Macro, Roteamento Zero-Latency e Governança Global', icone: 'zeus' },
    { id: '1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_', arquivo: '_memoria_apolo.md', deus: 'Apolo', slug: 'apolo', camada: 'Camada 2 — Gestão e Expedição de Atos', perfilRbac: 'ADMIN_GABINETE', dominio: 'Numeração Sequencial de Ofícios e Portarias', icone: 'apolo' },
    { id: '1yKxawxSXKGzT-qCWfNPN3cqVgIzcoLWH', arquivo: '_memoria_hermes.md', deus: 'Hermes', slug: 'hermes', camada: 'Camada 2 — Logística e Operações de Campo', perfilRbac: 'ADMIN_GABINETE', dominio: 'Transporte Escolar, Frotas e Logística Operacional', icone: 'hermes' },
    { id: '', arquivo: '_memoria_hefesto.md', deus: 'Hefesto', slug: 'hefesto', camada: 'Camada 2 — Infraestrutura, Obras e Patrimônio', perfilRbac: 'ADMIN_GABINETE', dominio: 'Infraestrutura Escolar, Manutenção e Obras', icone: 'hefesto' },
    { id: '', arquivo: '_memoria_demeter.md', deus: 'Deméter', slug: 'demeter', camada: 'Camada 2 — Suprimentos Nutricionais e PNAE', perfilRbac: 'ADMIN_GABINETE', dominio: 'Alimentação Escolar e Gestão PNAE', icone: 'demeter' },
    { id: '', arquivo: '_memoria_poseidon.md', deus: 'Poseidon', slug: 'poseidon', camada: 'Camada 2 — Segurança Hídrica e Infraestrutura Sanitária', perfilRbac: 'ADMIN_GABINETE', dominio: 'Segurança Hídrica e Infraestrutura Sanitária', icone: 'poseidon' },
    { id: '1uUuHvJ-fsjlqK_CWrin-YBBp_0VmiJKnSBiujFUP8VM', arquivo: '_memoria_hestia.md', deus: 'Héstia', slug: 'hestia', camada: 'Camada 2 — Segurança Documental, Recepção e Triagem', perfilRbac: 'ADMIN_GABINETE', dominio: 'Governança Central, Despacho e Segurança Documental', icone: 'hestia' },
    { id: '', arquivo: '_memoria_cronos.md', deus: 'Cronos', slug: 'cronos', camada: 'Camada 2 — Auditoria Temporal e Continuidade Histórica', perfilRbac: 'ADMIN_GABINETE', dominio: 'Auditoria Temporal e Continuidade Histórica', icone: 'cronos' },
    { id: '1nV-BkugwDaDiqgvodP6VV-gNFi5tRMXh', arquivo: '_memoria_hera.md', deus: 'Hera', slug: 'hera', camada: 'Camada 2 — Recursos Humanos e Gestão de Pessoas', perfilRbac: 'RH_COMISSAO', dominio: 'Gestão de Pessoas, Lotação, Atestos e Permutas', icone: 'hera' },
    { id: '', arquivo: '_memoria_ares.md', deus: 'Ares', slug: 'ares', camada: 'Camada 2 — Disciplina Funcional e Resolução de Conflitos', perfilRbac: 'RH_COMISSAO', dominio: 'Mediação de Conflitos e Disciplina Funcional', icone: 'ares' },
    { id: '', arquivo: '_memoria_afrodite.md', deus: 'Afrodite', slug: 'afrodite', camada: 'Camada 2 — Saúde Mental, Clima Escolar e Valorização Humana', perfilRbac: 'RH_COMISSAO', dominio: 'Saúde Mental, Clima Escolar e Valorização dos Servidores', icone: 'afrodite' },
    { id: '1bngNddimtP8nMmfhUJEa1YvkSEcmZ69Q', arquivo: '_memoria_atena.md', deus: 'Atena', slug: 'atena', camada: 'Camada 2 — Gestão Pedagógica e Ensino-Aprendizagem', perfilRbac: 'PEDAGOGICO_EVENTOS', dominio: 'Coordenação Pedagógica, Currículo e BNCC', icone: 'atena' },
    { id: '', arquivo: '_memoria_dionisio.md', deus: 'Dionísio', slug: 'dionisio', camada: 'Camada 2 — Eventos, Cultura e Esporte Escolar', perfilRbac: 'PEDAGOGICO_EVENTOS', dominio: 'Eventos Culturais, Esporte Escolar e JEMs', icone: 'dionisio' },
    { id: '1cGAfAIynCD6xbwg7HpAx3_GLy6q0yOwt', arquivo: '_memoria_temis.md', deus: 'Têmis', slug: 'temis', camada: 'Camada 2 — Assessoria Jurídica e Controle de Legalidade', perfilRbac: 'JURIDICO', dominio: 'Assessoria Jurídica e Pareceres Técnicos', icone: 'temis' },
    { id: '', arquivo: '_memoria_artemis.md', deus: 'Ártemis', slug: 'artemis', camada: 'Camada 2 — Conformidade Regulatória e Auditoria Jurídica', perfilRbac: 'JURIDICO', dominio: 'Conformidade Regulatória e Auditoria FUNDEB', icone: 'artemis' },
    { id: '', arquivo: '_memoria_hades.md', deus: 'Hades', slug: 'hades', camada: 'Camada 2 — Contencioso Estratégico e Gestão de Riscos Graves', perfilRbac: 'JURIDICO', dominio: 'Contencioso Estratégico e Gestão de Riscos Graves', icone: 'hades' },
    { id: '', arquivo: '_memoria_prometeu.md', deus: 'Prometeu', slug: 'prometeu', camada: 'Camada 2 — Coleta de Inteligência e Monitoramento Oficial', perfilRbac: 'ADMIN_GABINETE', dominio: 'Vigilância Ativa do Diário Oficial e Inteligência FEMURN', icone: 'prometeu' },

    // Personas Operacionais e Subprojetos Integrados (com IDs Canônicos Físicos)
    { id: '1JTB1SMgjq9Ws4E4RDBVAkH2GmCK1Fv6Q', arquivo: '_memoria_homero.md', deus: 'Homero', slug: 'homero', camada: 'Camada 3A', perfilRbac: 'RH_COMISSAO', dominio: 'Redação Oficial, Portarias de Licenças e Readaptações', icone: 'homero' },
    { id: '16U0x5463ldiyxjgbN5IyiYNoCQQ4BdF-', arquivo: '_memoria_dedalo.md', deus: 'Dédalo', slug: 'dedalo', camada: 'Camada 4', perfilRbac: 'ADMIN_GABINETE', dominio: 'Arquitetura Técnica, Infraestrutura e Backups', icone: 'dedalo' },
    { id: '1OUIM7SUDvEtnn08kIMyedRnp1UHKiWhF', arquivo: '_memoria_orfeu.md', deus: 'Orfeu', slug: 'orfeu', camada: 'Camada 3A', perfilRbac: 'PEDAGOGICO_EVENTOS', dominio: 'Certificados, Eventos e Declarações (A Lira)', icone: 'orfeu' },
    { id: '13ziWkZGuh3HSTvSjE8fXlqoPTEc-kHze', arquivo: '_memoria_nike.md', deus: 'Nike', slug: 'nike', camada: 'Camada 2', perfilRbac: 'RH_COMISSAO', dominio: 'Processos Seletivos Simplificados (PSS)', icone: 'nike' },
    { id: '1JGVVV1umqhKa06nKDK5h_6TD34_Z2v90', arquivo: '_memoria_helio.md', deus: 'Hélio', slug: 'helio', camada: 'Camada 3A', perfilRbac: 'ADMIN_GABINETE', dominio: 'Vigilância do Diário Oficial FEMURN', icone: 'helio' }
  ],

  // Personas sem arquivo próprio de memória (encaminham alertas para personas anfitriãs)
  PERSONAS_EXTRAS: [
    { nome: 'Cadmo', camada: 'Camada 3B', dominio: 'Localizador Cadastral & O Papiro de Cadmo (16 Entes RN)', anfitriao: 'Hera', arquivoAnfitriao: '_memoria_hera.md', icone: 'cadmo' },
    { nome: 'Arquimedes', camada: 'Camada 4', dominio: 'Ciência de Dados Educacionais, Censo e Indicadores', anfitriao: 'Dédalo', arquivoAnfitriao: '_memoria_dedalo.md', icone: 'arquimedes' },
    { nome: 'Íris', camada: 'Camada 3B', dominio: 'Comunicação Ágil, Avisos Setoriais e Google Chat', anfitriao: 'Héstia', arquivoAnfitriao: '_memoria_hestia.md', icone: 'iris' },
    { nome: 'Sólon', camada: 'Camada 3B', dominio: 'Técnica Legislativa e Constitucionalidade Municipal', anfitriao: 'Têmis', arquivoAnfitriao: '_memoria_temis.md', icone: 'solon' }
  ],

  // Links oficiais resolvidos para exibição amigável sem expor IDs técnicos na interface
  LINKS_OFICIAIS_UI: {
    planilhaDiarioOficial: 'https://docs.google.com/spreadsheets/d/1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY/edit',
    planilhaPermutas: 'https://docs.google.com/spreadsheets/d/1fOZHe871yxu6UdF0vsRzjSzQBc7AVFRZZtx3JSCdwCY/edit',
    planilhaLicencas: 'https://docs.google.com/spreadsheets/d/1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc/edit',
    planilhaReadaptacoes: 'https://docs.google.com/spreadsheets/d/1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0/edit',
    pastaPapiroCadmo: 'https://drive.google.com/drive/folders/1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD',
    pastaMemoriasMd: 'https://drive.google.com/drive/folders/1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu',
    pastaOficios2026: 'https://drive.google.com/drive/folders/1UMHKKCWgJTq4YtcWni1ixL6tHKwyLpcK',
    pastaPortarias2026: 'https://drive.google.com/drive/folders/1QEewN0R3bCksLxLhmOSFq20EQYI3g64Q',
    pastaLicencas: 'https://drive.google.com/drive/folders/1So_-b_tFmr_nL2VwsbMaRCz_lUzvBUnj',
    pastaReadaptacoes: 'https://drive.google.com/drive/folders/174FW9KKkpfRY8NDOydG1rDGlZnnXUkxQ',
    pastaLiraOrfeu: 'https://drive.google.com/drive/folders/1XriqpPQsWjQxJROsE_FyaQQpCwybJSUJ',
    pastaRaizSmeb: 'https://drive.google.com/drive/folders/18k1Xq0BGSJ8PHfVn9633Bky1EHHCENg6'
  },

  PERFIS_RBAC: {
    ADMIN_GABINETE: {
      id: 'ADMIN_GABINETE',
      nome: 'Gabinete & Governança Total (Héstia)',
      abasPermitidas: [
        'visao-geral', 'oficios', 'portarias', 'licencas', 'certificados',
        'diario-oficial', 'papiro-cadmo', 'personas', 'busca', 'configuracoes'
      ],
      podeEditarMemorias: true,
      podeGerarSnapshot: true,
      podeCadastrarLicenca: true
    },
    RH_COMISSAO: {
      id: 'RH_COMISSAO',
      nome: 'RH & Comissão de Portarias (Homero / Hera / Cadmo)',
      abasPermitidas: [
        'visao-geral', 'oficios', 'portarias', 'licencas',
        'diario-oficial', 'papiro-cadmo', 'personas', 'busca', 'configuracoes'
      ],
      podeEditarMemorias: false,
      podeGerarSnapshot: false,
      podeCadastrarLicenca: true
    },
    PEDAGOGICO_EVENTOS: {
      id: 'PEDAGOGICO_EVENTOS',
      nome: 'Pedagógico & Eventos (Orfeu / Atena)',
      abasPermitidas: [
        'visao-geral', 'oficios', 'certificados', 'personas', 'busca', 'configuracoes'
      ],
      podeEditarMemorias: false,
      podeGerarSnapshot: false,
      podeCadastrarLicenca: false
    },
    JURIDICO: {
      id: 'JURIDICO',
      nome: 'Assessoria Jurídica (Têmis / Hélio / Sólon)',
      abasPermitidas: [
        'visao-geral', 'oficios', 'portarias', 'diario-oficial',
        'papiro-cadmo', 'personas', 'busca', 'configuracoes'
      ],
      podeEditarMemorias: false,
      podeGerarSnapshot: false,
      podeCadastrarLicenca: false
    }
  }
};
