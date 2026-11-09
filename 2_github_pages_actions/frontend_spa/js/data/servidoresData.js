/**
 * Base de Dados Unificada de Servidores Públicos — Projeto Olympos
 * Cobre os 5 Entes Monitorados: Ceará-Mirim, Governo do RN (SEEC), Natal, Parnamirim e São Gonçalo do Amarante.
 * Abrange os 5 Quadros Funcionais: Docente, Administrativo, Apoio, Técnico e Operacional.
 * Conformidade estrita com a LGPD: CPFs mascarados no padrão ###.XXX.XXX-## sem dígitos verificadores reais.
 */
(function(root) {
  'use strict';

  function normalizarTexto(txt) {
    return String(txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizarMatricula(mat) {
    return String(mat || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase().replace(/^0+/, '');
  }

  function parseCargaHoraria(ch) {
    if (typeof ch === 'number') return ch;
    var m = String(ch || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 30;
  }

  function converterDocenteCearaMirim(d) {
    var mat = String(d.m || d.matricula || '').trim();
    var nome = String(d.n || d.nome || '').trim();
    var cpf = d.c || d.cpfMascarado || '###.***.***-##';
    var cargo = d.g || d.cargo || 'PROFESSOR NIVEL SUPERIOR';
    var ch = parseCargaHoraria(d.h || d.cargaHoraria || 30);
    var lot = d.l || d.lotacao || 'SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA';
    return {
      id: mat || ('cm_' + normalizarTexto(nome).replace(/\s+/g, '_')),
      matricula: mat,
      m: mat,
      nome: nome,
      n: nome,
      cpfMascarado: cpf,
      c: cpf,
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Docente",
      cargo: cargo,
      g: cargo,
      funcao: "Docência Municipal",
      cargaHoraria: ch,
      cargaHorariaTexto: ch + "h",
      h: ch + "h",
      lotacao: lot,
      l: lot,
      lotacaoId: "smeb_sede",
      turno: "Matutino/Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2010-02-15"
    };
  }

  function converterServidorEstadoRN(d) {
    var mat = String(d.m || d.matricula || '').trim();
    var nome = String(d.n || d.nome || '').trim();
    var cpf = d.c || d.cpfMascarado || '###.***.***-##';
    var cargo = d.g || d.cargo || 'PROFESSOR EFETIVO';
    var ch = parseCargaHoraria(d.h || d.cargaHoraria || 30);
    var lot = d.l || d.lotacao || 'SEEC / Governo do Estado do RN';
    var quadro = d.quadro || (normalizarTexto(cargo).indexOf('especialista') !== -1 ? 'Técnico' : 'Docente');
    return {
      id: mat || ('rn_' + normalizarTexto(nome).replace(/\s+/g, '_')),
      matricula: mat,
      m: mat,
      nome: nome,
      n: nome,
      cpfMascarado: cpf,
      c: cpf,
      ente: d.ente || "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: d.orgao || "SEEC / Governo do Estado do RN",
      quadro: quadro,
      cargo: cargo,
      g: cargo,
      funcao: d.funcao || "Docência / Gestão Estadual",
      cargaHoraria: ch,
      cargaHorariaTexto: ch + "h",
      h: ch + "h",
      lotacao: lot,
      l: lot,
      lotacaoId: d.lotacaoId || "seec_rn",
      turno: d.turno || "Matutino",
      regime: d.regime || "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: d.dataAdmissao || "2008-03-10"
    };
  }

  // --- 1. BASE CEARÁ-MIRIM (SMEB) ---
  var SERVIDORES_CEARA_MIRIM = [
    {
      id: "0010016",
      matricula: "0010016",
      m: "0010016",
      nome: "ODJAIME CAMARA DE ARAUJO",
      n: "ODJAIME CAMARA DE ARAUJO",
      cpfMascarado: "###.487.734-##",
      c: "###.487.734-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Docente",
      cargo: "PROFESSOR NIVEL SUPERIOR",
      g: "PROFESSOR NIVEL SUPERIOR",
      funcao: "Docência Anos Finais (História)",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      l: "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      lotacaoId: "smeb_sede",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2010-02-15"
    },
    {
      id: "0010024",
      matricula: "0010024",
      m: "0010024",
      nome: "MARIA MARGARETH DA SILVA PEREIRA",
      n: "MARIA MARGARETH DA SILVA PEREIRA",
      cpfMascarado: "###.218.904-##",
      c: "###.218.904-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Docente",
      cargo: "PROFESSOR NIVEL SUPERIOR",
      g: "PROFESSOR NIVEL SUPERIOR",
      funcao: "Gestão Escolar e Docência",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E.M. ADELE DE OLIVEIRA",
      l: "E.M. ADELE DE OLIVEIRA",
      lotacaoId: "esc_001",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2012-03-01"
    },
    {
      id: "0010032",
      matricula: "0010032",
      m: "0010032",
      nome: "ANA PAULA RIBEIRO DE SOUZA",
      n: "ANA PAULA RIBEIRO DE SOUZA",
      cpfMascarado: "###.334.814-##",
      c: "###.334.814-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Docente",
      cargo: "PROFESSOR DE EDUCACAO INFANTIL",
      g: "PROFESSOR DE EDUCACAO INFANTIL",
      funcao: "Docência Infantil",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "CEI PROFESSORA MARIA DE FATIMA",
      l: "CEI PROFESSORA MARIA DE FATIMA",
      lotacaoId: "esc_cei_01",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2015-08-10"
    },
    {
      id: "0042105",
      matricula: "0042105",
      m: "0042105",
      nome: "LUCAS MENDES COSTA",
      n: "LUCAS MENDES COSTA",
      cpfMascarado: "###.552.194-##",
      c: "###.552.194-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Administrativo",
      cargo: "AGENTE ADMINISTRATIVO",
      g: "AGENTE ADMINISTRATIVO",
      funcao: "Protocolo e Gestão de Documentos",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      l: "SECRETARIA MUNICIPAL DE EDUCAÇÃO BÁSICA",
      lotacaoId: "smeb_sede",
      turno: "Integral",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2018-05-14"
    },
    {
      id: "0042189",
      matricula: "0042189",
      m: "0042189",
      nome: "JULIANA FREIRE BARRETO",
      n: "JULIANA FREIRE BARRETO",
      cpfMascarado: "###.771.604-##",
      c: "###.771.604-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Administrativo",
      cargo: "SECRETARIO ESCOLAR",
      g: "SECRETARIO ESCOLAR",
      funcao: "Secretaria e Registro Acadêmico",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. AUGUSTO XAVIER",
      l: "E.M. AUGUSTO XAVIER",
      lotacaoId: "esc_002",
      turno: "Matutino/Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2019-02-01"
    },
    {
      id: "0038912",
      matricula: "0038912",
      m: "0038912",
      nome: "TEREZA CRISTINA FARIAS",
      n: "TEREZA CRISTINA FARIAS",
      cpfMascarado: "###.892.344-##",
      c: "###.892.344-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Apoio",
      cargo: "MERENDEIRA ESCOLAR",
      g: "MERENDEIRA ESCOLAR",
      funcao: "Preparação e Distribuição da Alimentação Escolar",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. ADELE DE OLIVEIRA",
      l: "E.M. ADELE DE OLIVEIRA",
      lotacaoId: "esc_001",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2014-06-20"
    },
    {
      id: "0038988",
      matricula: "0038988",
      m: "0038988",
      nome: "JOAO PAULO BEZERRA CAVALCANTE",
      n: "JOAO PAULO BEZERRA CAVALCANTE",
      cpfMascarado: "###.621.434-##",
      c: "###.621.434-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Apoio",
      cargo: "MOTORISTA DE TRANSPORTE ESCOLAR",
      g: "MOTORISTA DE TRANSPORTE ESCOLAR",
      funcao: "Condução de Ônibus Escolar (Rota Rural)",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SMEB - SETOR DE TRANSPORTES",
      l: "SMEB - SETOR DE TRANSPORTES",
      lotacaoId: "smeb_transp",
      turno: "Matutino/Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2016-04-11"
    },
    {
      id: "0051204",
      matricula: "0051204",
      m: "0051204",
      nome: "FELIPE AGUIAR NOBREGA",
      n: "FELIPE AGUIAR NOBREGA",
      cpfMascarado: "###.430.884-##",
      c: "###.430.884-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Técnico",
      cargo: "PSICOLOGO EDUCACIONAL",
      g: "PSICOLOGO EDUCACIONAL",
      funcao: "Apoio Psicossocial à Comunidade Escolar",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "SMEB - NUCLEO DE APOIO PSICOSSOCIAL",
      l: "SMEB - NUCLEO DE APOIO PSICOSSOCIAL",
      lotacaoId: "smeb_psico",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2021-03-15"
    },
    {
      id: "0051280",
      matricula: "0051280",
      m: "0051280",
      nome: "BEATRIZ CARVALHO DE MACEDO",
      n: "BEATRIZ CARVALHO DE MACEDO",
      cpfMascarado: "###.918.274-##",
      c: "###.918.274-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Técnico",
      cargo: "ASSISTENTE SOCIAL EDUCACIONAL",
      g: "ASSISTENTE SOCIAL EDUCACIONAL",
      funcao: "Acompanhamento de Frequência e Vulnerabilidade",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "SMEB - NUCLEO DE APOIO PSICOSSOCIAL",
      l: "SMEB - NUCLEO DE APOIO PSICOSSOCIAL",
      lotacaoId: "smeb_psico",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2021-04-01"
    },
    {
      id: "0024501",
      matricula: "0024501",
      m: "0024501",
      nome: "MANOEL VICENTE DOS SANTOS",
      n: "MANOEL VICENTE DOS SANTOS",
      cpfMascarado: "###.112.594-##",
      c: "###.112.594-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Operacional",
      cargo: "AUXILIAR DE SERVICOS GERAIS (ASG)",
      g: "AUXILIAR DE SERVICOS GERAIS (ASG)",
      funcao: "Manutenção, Limpeza e Conservação Predial",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. AUGUSTO XAVIER",
      l: "E.M. AUGUSTO XAVIER",
      lotacaoId: "esc_002",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2011-09-01"
    },
    {
      id: "0024599",
      matricula: "0024599",
      m: "0024599",
      nome: "FRANCISCA HELENA ALVES",
      n: "FRANCISCA HELENA ALVES",
      cpfMascarado: "###.834.724-##",
      c: "###.834.724-##",
      ente: "SMEB Ceará-Mirim",
      enteId: "ceara_mirim",
      orgao: "Secretaria Municipal de Educação Básica",
      quadro: "Operacional",
      cargo: "CUIDADOR DE ALUNOS COM DEFICIENCIA",
      g: "CUIDADOR DE ALUNOS COM DEFICIENCIA",
      funcao: "Apoio e Acessibilidade em Sala de Aula",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. ADELE DE OLIVEIRA",
      l: "E.M. ADELE DE OLIVEIRA",
      lotacaoId: "esc_001",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2020-01-20"
    }
  ];

  // --- 2. BASE GOVERNO DO ESTADO DO RN (SEEC) ---
  var SERVIDORES_ESTADO_RN = [
    {
      id: "184920-1",
      matricula: "184920-1",
      m: "184920-1",
      nome: "ODJAIME CAMARA DE ARAUJO",
      n: "ODJAIME CAMARA DE ARAUJO",
      cpfMascarado: "###.487.734-##",
      c: "###.487.734-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (HISTÓRIA)",
      g: "PROFESSOR EFETIVO (HISTÓRIA)",
      funcao: "Docência Anos Finais e Ensino Médio",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E. E. Augusto Severo (Natal)",
      l: "E. E. Augusto Severo (Natal)",
      lotacaoId: "ee_augusto_severo",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2008-03-10"
    },
    {
      id: "192341-2",
      matricula: "192341-2",
      m: "192341-2",
      nome: "FRANCISCO DE ASSIS MEDEIROS",
      n: "FRANCISCO DE ASSIS MEDEIROS",
      cpfMascarado: "###.781.904-##",
      c: "###.781.904-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (MATEMÁTICA)",
      g: "PROFESSOR EFETIVO (MATEMÁTICA)",
      funcao: "Docência Ensino Fundamental e Médio",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      l: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      lotacaoId: "ce_monsenhor_urbano",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2011-04-15"
    },
    {
      id: "178923-4",
      matricula: "178923-4",
      m: "178923-4",
      nome: "MARIA APARECIDA DA SILVA COSTA",
      n: "MARIA APARECIDA DA SILVA COSTA",
      cpfMascarado: "###.654.124-##",
      c: "###.654.124-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (LÍNGUA PORTUGUESA)",
      g: "PROFESSOR EFETIVO (LÍNGUA PORTUGUESA)",
      funcao: "Docência Anos Finais",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E. E. Desembargador Silvino Bezerra (Ceará-Mirim)",
      l: "E. E. Desembargador Silvino Bezerra (Ceará-Mirim)",
      lotacaoId: "ee_silvino_bezerra",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2006-02-01"
    },
    {
      id: "204891-0",
      matricula: "204891-0",
      m: "204891-0",
      nome: "JOSE CARLOS DO NASCIMENTO",
      n: "JOSE CARLOS DO NASCIMENTO",
      cpfMascarado: "###.321.984-##",
      c: "###.321.984-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (GEOGRAFIA)",
      g: "PROFESSOR EFETIVO (GEOGRAFIA)",
      funcao: "Docência Ensino Médio",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E. E. Professor Edgar Barbosa (Natal)",
      l: "E. E. Professor Edgar Barbosa (Natal)",
      lotacaoId: "ee_edgar_barbosa",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2013-08-20"
    },
    {
      id: "211904-8",
      matricula: "211904-8",
      m: "211904-8",
      nome: "ANA CLAUDIA BEZERRA LIMA",
      n: "ANA CLAUDIA BEZERRA LIMA",
      cpfMascarado: "###.908.434-##",
      c: "###.908.434-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (CIÊNCIAS BIOLÓGICAS)",
      g: "PROFESSOR EFETIVO (CIÊNCIAS BIOLÓGICAS)",
      funcao: "Docência Ensino Fundamental e Médio",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E. E. Walter Duarte Pereira (Natal)",
      l: "E. E. Walter Duarte Pereira (Natal)",
      lotacaoId: "ee_walter_duarte",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2015-02-15"
    },
    {
      id: "198762-3",
      matricula: "198762-3",
      m: "198762-3",
      nome: "MARCOS ANTONIO ALVES PEREIRA",
      n: "MARCOS ANTONIO ALVES PEREIRA",
      cpfMascarado: "###.145.894-##",
      c: "###.145.894-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (EDUCAÇÃO FÍSICA)",
      g: "PROFESSOR EFETIVO (EDUCAÇÃO FÍSICA)",
      funcao: "Docência e Práticas Esportivas",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      l: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      lotacaoId: "ce_monsenhor_urbano",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2012-10-01"
    },
    {
      id: "165432-9",
      matricula: "165432-9",
      m: "165432-9",
      nome: "LUCIA DE FATIMA RODRIGUES",
      n: "LUCIA DE FATIMA RODRIGUES",
      cpfMascarado: "###.678.914-##",
      c: "###.678.914-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Técnico",
      cargo: "ESPECIALISTA EM EDUCAÇÃO (PEDAGOGIA)",
      g: "ESPECIALISTA EM EDUCAÇÃO (PEDAGOGIA)",
      funcao: "Coordenação Pedagógica Regional",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "DIREC Natal / Sede SEEC RN",
      l: "DIREC Natal / Sede SEEC RN",
      lotacaoId: "direc_natal",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2004-03-20"
    },
    {
      id: "223401-5",
      matricula: "223401-5",
      m: "223401-5",
      nome: "RAIMUNDO NONATO FERREIRA",
      n: "RAIMUNDO NONATO FERREIRA",
      cpfMascarado: "###.890.124-##",
      c: "###.890.124-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (LÍNGUA INGLESA)",
      g: "PROFESSOR EFETIVO (LÍNGUA INGLESA)",
      funcao: "Docência Anos Finais",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E. E. Desembargador Silvino Bezerra (Ceará-Mirim)",
      l: "E. E. Desembargador Silvino Bezerra (Ceará-Mirim)",
      lotacaoId: "ee_silvino_bezerra",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2016-09-12"
    },
    {
      id: "189045-7",
      matricula: "189045-7",
      m: "189045-7",
      nome: "SANDRA REGINA DE SOUZA",
      n: "SANDRA REGINA DE SOUZA",
      cpfMascarado: "###.234.564-##",
      c: "###.234.564-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (ARTES)",
      g: "PROFESSOR EFETIVO (ARTES)",
      funcao: "Docência e Projetos Culturais",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E. E. Dinarte Mariz (Natal)",
      l: "E. E. Dinarte Mariz (Natal)",
      lotacaoId: "ee_dinarte_mariz",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2009-05-18"
    },
    {
      id: "201984-6",
      matricula: "201984-6",
      m: "201984-6",
      nome: "PAULO ROBERTO TAVARES",
      n: "PAULO ROBERTO TAVARES",
      cpfMascarado: "###.567.894-##",
      c: "###.567.894-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Docente",
      cargo: "PROFESSOR EFETIVO (FÍSICA/QUÍMICA)",
      g: "PROFESSOR EFETIVO (FÍSICA/QUÍMICA)",
      funcao: "Docência Ensino Médio",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      l: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      lotacaoId: "ce_monsenhor_urbano",
      turno: "Noturno",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2013-01-28"
    },
    {
      id: "154321-7",
      matricula: "154321-7",
      m: "154321-7",
      nome: "CLARA BEATRIZ VASCONCELOS",
      n: "CLARA BEATRIZ VASCONCELOS",
      cpfMascarado: "###.412.984-##",
      c: "###.412.984-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Administrativo",
      cargo: "ASSISTENTE ADMINISTRATIVO ESTADUAL",
      g: "ASSISTENTE ADMINISTRATIVO ESTADUAL",
      funcao: "Gestão de Recursos Humanos e Lotação",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "DIREC 01 - Natal / SEEC Sede",
      l: "DIREC 01 - Natal / SEEC Sede",
      lotacaoId: "direc_natal",
      turno: "Integral",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2005-07-15"
    },
    {
      id: "142109-8",
      matricula: "142109-8",
      m: "142109-8",
      nome: "SEBASTIAO GOMES DA SILVA",
      n: "SEBASTIAO GOMES DA SILVA",
      cpfMascarado: "###.301.774-##",
      c: "###.301.774-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Apoio",
      cargo: "MOTORISTA GOVERNAMENTAL",
      g: "MOTORISTA GOVERNAMENTAL",
      funcao: "Transporte Oficial e Logística Educacional",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SEEC / Sede Gabinete",
      l: "SEEC / Sede Gabinete",
      lotacaoId: "seec_sede",
      turno: "Integral",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2003-11-03"
    },
    {
      id: "131908-4",
      matricula: "131908-4",
      m: "131908-4",
      nome: "ANTONIO CLAUDIO DE SOUZA",
      n: "ANTONIO CLAUDIO DE SOUZA",
      cpfMascarado: "###.894.214-##",
      c: "###.894.214-##",
      ente: "Governo do Estado (SEEC)",
      enteId: "governo_rn",
      orgao: "SEEC / Governo do Estado do RN",
      quadro: "Operacional",
      cargo: "AUXILIAR DE SERVICOS GERAIS (ASG ESTADUAL)",
      g: "AUXILIAR DE SERVICOS GERAIS (ASG ESTADUAL)",
      funcao: "Zeladoria e Limpeza Predial Escolar",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      l: "Colégio Estadual Monsenhor Urbano (Ceará-Mirim)",
      lotacaoId: "ce_monsenhor_urbano",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2001-08-14"
    }
  ];

  // --- 3. BASE NATAL (SME NATAL) ---
  var SERVIDORES_NATAL = [
    {
      id: "082341-9",
      matricula: "082341-9",
      m: "082341-9",
      nome: "FABIO HENRIQUE BEZERRA",
      n: "FABIO HENRIQUE BEZERRA",
      cpfMascarado: "###.512.804-##",
      c: "###.512.804-##",
      ente: "SME Natal",
      enteId: "natal",
      orgao: "Secretaria Municipal de Educação de Natal",
      quadro: "Docente",
      cargo: "PROFESSOR DE ANOS FINAIS - HISTORIA",
      g: "PROFESSOR DE ANOS FINAIS - HISTORIA",
      funcao: "Docência Anos Finais",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E.M. PROFESSOR DJALMA MARANHAO",
      l: "E.M. PROFESSOR DJALMA MARANHAO",
      lotacaoId: "em_djalma_maranhao",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2014-03-10"
    },
    {
      id: "071982-3",
      matricula: "071982-3",
      m: "071982-3",
      nome: "CAMILA DANTAS DE ALBUQUERQUE",
      n: "CAMILA DANTAS DE ALBUQUERQUE",
      cpfMascarado: "###.639.114-##",
      c: "###.639.114-##",
      ente: "SME Natal",
      enteId: "natal",
      orgao: "Secretaria Municipal de Educação de Natal",
      quadro: "Administrativo",
      cargo: "ASSISTENTE DE SECRETARIA ESCOLAR",
      g: "ASSISTENTE DE SECRETARIA ESCOLAR",
      funcao: "Documentação Escolar e Matrículas",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SME NATAL - SEDE",
      l: "SME NATAL - SEDE",
      lotacaoId: "sme_natal_sede",
      turno: "Integral",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2017-09-01"
    },
    {
      id: "065412-1",
      matricula: "065412-1",
      m: "065412-1",
      nome: "IVANILDO CANDIDO PEREIRA",
      n: "IVANILDO CANDIDO PEREIRA",
      cpfMascarado: "###.784.304-##",
      c: "###.784.304-##",
      ente: "SME Natal",
      enteId: "natal",
      orgao: "Secretaria Municipal de Educação de Natal",
      quadro: "Apoio",
      cargo: "MOTORISTA DE TRANSPORTE ESCOLAR",
      g: "MOTORISTA DE TRANSPORTE ESCOLAR",
      funcao: "Transporte de Alunos Polo Zona Norte",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SME NATAL - FROTAS",
      l: "SME NATAL - FROTAS",
      lotacaoId: "sme_natal_frotas",
      turno: "Matutino/Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2013-05-19"
    },
    {
      id: "059871-4",
      matricula: "059871-4",
      m: "059871-4",
      nome: "JULIANA ROCHA TAVARES",
      n: "JULIANA ROCHA TAVARES",
      cpfMascarado: "###.920.444-##",
      c: "###.920.444-##",
      ente: "SME Natal",
      enteId: "natal",
      orgao: "Secretaria Municipal de Educação de Natal",
      quadro: "Técnico",
      cargo: "NUTRICIONISTA ESCOLAR",
      g: "NUTRICIONISTA ESCOLAR",
      funcao: "Fiscalização e Elaboração de Cardápios PNAE",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "SME NATAL - ALIMENTACAO ESCOLAR",
      l: "SME NATAL - ALIMENTACAO ESCOLAR",
      lotacaoId: "sme_natal_pnae",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2019-11-04"
    },
    {
      id: "041239-8",
      matricula: "041239-8",
      m: "041239-8",
      nome: "MARIA DO CARMO SILVA",
      n: "MARIA DO CARMO SILVA",
      cpfMascarado: "###.159.224-##",
      c: "###.159.224-##",
      ente: "SME Natal",
      enteId: "natal",
      orgao: "Secretaria Municipal de Educação de Natal",
      quadro: "Operacional",
      cargo: "AUXILIAR DE SERVICOS GERAIS",
      g: "AUXILIAR DE SERVICOS GERAIS",
      funcao: "Limpeza e Conservação Polo Natal",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. PROFESSOR DJALMA MARANHAO",
      l: "E.M. PROFESSOR DJALMA MARANHAO",
      lotacaoId: "em_djalma_maranhao",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2010-06-25"
    }
  ];

  // --- 4. BASE PARNAMIRIM (SEMEC PARNAMIRIM) ---
  var SERVIDORES_PARNAMIRIM = [
    {
      id: "091245-6",
      matricula: "091245-6",
      m: "091245-6",
      nome: "ROBERTA KELLY NOGUEIRA",
      n: "ROBERTA KELLY NOGUEIRA",
      cpfMascarado: "###.841.674-##",
      c: "###.841.674-##",
      ente: "SEMEC Parnamirim",
      enteId: "parnamirim",
      orgao: "Secretaria Municipal de Educação e Cultura de Parnamirim",
      quadro: "Docente",
      cargo: "PROFESSOR DE ENSINO FUNDAMENTAL",
      g: "PROFESSOR DE ENSINO FUNDAMENTAL",
      funcao: "Docência Anos Iniciais",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E.M. PRESIDENTE ROOSEVELT",
      l: "E.M. PRESIDENTE ROOSEVELT",
      lotacaoId: "em_pres_roosevelt",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2016-02-18"
    },
    {
      id: "084512-3",
      matricula: "084512-3",
      m: "084512-3",
      nome: "GABRIEL MONTEIRO SOUZA",
      n: "GABRIEL MONTEIRO SOUZA",
      cpfMascarado: "###.329.814-##",
      c: "###.329.814-##",
      ente: "SEMEC Parnamirim",
      enteId: "parnamirim",
      orgao: "Secretaria Municipal de Educação e Cultura de Parnamirim",
      quadro: "Administrativo",
      cargo: "AGENTE DE ADMINISTRACAO ESCOLAR",
      g: "AGENTE DE ADMINISTRACAO ESCOLAR",
      funcao: "Atendimento ao Cidadão e Protocolo",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SEMEC PARNAMIRIM - SEDE",
      l: "SEMEC PARNAMIRIM - SEDE",
      lotacaoId: "semec_sede",
      turno: "Integral",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2018-08-01"
    },
    {
      id: "078921-0",
      matricula: "078921-0",
      m: "078921-0",
      nome: "ELIZABETH SOARES LIMA",
      n: "ELIZABETH SOARES LIMA",
      cpfMascarado: "###.471.954-##",
      c: "###.471.954-##",
      ente: "SEMEC Parnamirim",
      enteId: "parnamirim",
      orgao: "Secretaria Municipal de Educação e Cultura de Parnamirim",
      quadro: "Apoio",
      cargo: "MERENDEIRA SEMEC",
      g: "MERENDEIRA SEMEC",
      funcao: "Preparação de Alimentos e Higiene",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. SENADOR DUARTE FILHO",
      l: "E.M. SENADOR DUARTE FILHO",
      lotacaoId: "em_duarte_filho",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2015-05-12"
    },
    {
      id: "063214-5",
      matricula: "063214-5",
      m: "063214-5",
      nome: "TIAGO ALEXANDRE MOREIRA",
      n: "TIAGO ALEXANDRE MOREIRA",
      cpfMascarado: "###.602.134-##",
      c: "###.602.134-##",
      ente: "SEMEC Parnamirim",
      enteId: "parnamirim",
      orgao: "Secretaria Municipal de Educação e Cultura de Parnamirim",
      quadro: "Técnico",
      cargo: "TECNICO DE SUPORTE TI EDUCACIONAL",
      g: "TECNICO DE SUPORTE TI EDUCACIONAL",
      funcao: "Infraestrutura de Redes e Laboratórios de Informática",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SEMEC PARNAMIRIM - NTI",
      l: "SEMEC PARNAMIRIM - NTI",
      lotacaoId: "semec_nti",
      turno: "Integral",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2020-09-15"
    },
    {
      id: "051874-2",
      matricula: "051874-2",
      m: "051874-2",
      nome: "FRANCISCO CANINDE RAMOS",
      n: "FRANCISCO CANINDE RAMOS",
      cpfMascarado: "###.748.204-##",
      c: "###.748.204-##",
      ente: "SEMEC Parnamirim",
      enteId: "parnamirim",
      orgao: "Secretaria Municipal de Educação e Cultura de Parnamirim",
      quadro: "Operacional",
      cargo: "AGENTE OPERACIONAL DE LIMPEZA E APOIO",
      g: "AGENTE OPERACIONAL DE LIMPEZA E APOIO",
      funcao: "Serviços Gerais e Apoio Logístico",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. PRESIDENTE ROOSEVELT",
      l: "E.M. PRESIDENTE ROOSEVELT",
      lotacaoId: "em_pres_roosevelt",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2012-11-20"
    }
  ];

  // --- 5. BASE SÃO GONÇALO DO AMARANTE (SME SGA) ---
  var SERVIDORES_SGA = [
    {
      id: "076541-2",
      matricula: "076541-2",
      m: "076541-2",
      nome: "ALDENOR FRANCISCO DE LIMA",
      n: "ALDENOR FRANCISCO DE LIMA",
      cpfMascarado: "###.992.314-##",
      c: "###.992.314-##",
      ente: "SME São Gonçalo do Amarante",
      enteId: "sga",
      orgao: "Secretaria Municipal de Educação de São Gonçalo do Amarante",
      quadro: "Docente",
      cargo: "PROFESSOR DE EDUCACAO BASICA",
      g: "PROFESSOR DE EDUCACAO BASICA",
      funcao: "Docência Anos Finais (Geografia)",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "E.M. VICENTE DE PAULA",
      l: "E.M. VICENTE DE PAULA",
      lotacaoId: "em_vicente_paula",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2015-03-23"
    },
    {
      id: "083219-4",
      matricula: "083219-4",
      m: "083219-4",
      nome: "PATRICIA GOMES DA SILVEIRA",
      n: "PATRICIA GOMES DA SILVEIRA",
      cpfMascarado: "###.118.744-##",
      c: "###.118.744-##",
      ente: "SME São Gonçalo do Amarante",
      enteId: "sga",
      orgao: "Secretaria Municipal de Educação de São Gonçalo do Amarante",
      quadro: "Administrativo",
      cargo: "ASSISTENTE ADMINISTRATIVO MUNICIPAL",
      g: "ASSISTENTE ADMINISTRATIVO MUNICIPAL",
      funcao: "Controle de Atos e Folha",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "SME SGA - PROTOCOLO",
      l: "SME SGA - PROTOCOLO",
      lotacaoId: "sme_sga_protocolo",
      turno: "Integral",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2017-06-12"
    },
    {
      id: "064128-9",
      matricula: "064128-9",
      m: "064128-9",
      nome: "JOSE NILTON BARBOSA",
      n: "JOSE NILTON BARBOSA",
      cpfMascarado: "###.554.214-##",
      c: "###.554.214-##",
      ente: "SME São Gonçalo do Amarante",
      enteId: "sga",
      orgao: "Secretaria Municipal de Educação de São Gonçalo do Amarante",
      quadro: "Apoio",
      cargo: "VIGIA ESCOLAR",
      g: "VIGIA ESCOLAR",
      funcao: "Segurança Patrimonial e Controle de Acesso",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. SANTA TEREZINHA",
      l: "E.M. SANTA TEREZINHA",
      lotacaoId: "em_santa_terezinha",
      turno: "Noturno",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2013-09-02"
    },
    {
      id: "079812-3",
      matricula: "079812-3",
      m: "079812-3",
      nome: "MARCELA GUIMARAES PINTO",
      n: "MARCELA GUIMARAES PINTO",
      cpfMascarado: "###.891.334-##",
      c: "###.891.334-##",
      ente: "SME São Gonçalo do Amarante",
      enteId: "sga",
      orgao: "Secretaria Municipal de Educação de São Gonçalo do Amarante",
      quadro: "Técnico",
      cargo: "ASSISTENTE SOCIAL EDUCACIONAL",
      g: "ASSISTENTE SOCIAL EDUCACIONAL",
      funcao: "Atendimento Social Integrado",
      cargaHoraria: 30,
      cargaHorariaTexto: "30h",
      h: "30h",
      lotacao: "SME SGA - SETOR SOCIAL",
      l: "SME SGA - SETOR SOCIAL",
      lotacaoId: "sme_sga_social",
      turno: "Vespertino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2019-04-16"
    },
    {
      id: "049871-5",
      matricula: "049871-5",
      m: "049871-5",
      nome: "SEVERINO RAMOS DOS SANTOS",
      n: "SEVERINO RAMOS DOS SANTOS",
      cpfMascarado: "###.723.104-##",
      c: "###.723.104-##",
      ente: "SME São Gonçalo do Amarante",
      enteId: "sga",
      orgao: "Secretaria Municipal de Educação de São Gonçalo do Amarante",
      quadro: "Operacional",
      cargo: "AUXILIAR DE MANUTENCAO E SERVICOS GERAIS",
      g: "AUXILIAR DE MANUTENCAO E SERVICOS GERAIS",
      funcao: "Manutenção Predial e Pequenos Reparos",
      cargaHoraria: 40,
      cargaHorariaTexto: "40h",
      h: "40h",
      lotacao: "E.M. VICENTE DE PAULA",
      l: "E.M. VICENTE DE PAULA",
      lotacaoId: "em_vicente_paula",
      turno: "Matutino",
      regime: "Efetivo / Estatutário",
      situacao: "Ativo",
      status: "ATIVO",
      dataAdmissao: "2011-01-10"
    }
  ];

  // Coleção consolidada unificada de todos os servidores
  var OLYMPOS_SERVIDORES_UNIFICADOS = [].concat(
    SERVIDORES_CEARA_MIRIM,
    SERVIDORES_ESTADO_RN,
    SERVIDORES_NATAL,
    SERVIDORES_PARNAMIRIM,
    SERVIDORES_SGA
  );

  var BASE_CONSOLIDADA_DINAMICA = null;
  var RESUMO_KPIS_DINAMICO = null;
  var promessaCarregamentoBase = null;

  // --- API CANÔNICA window.OlymposServidores ---
  var OlymposServidores = {
    /**
     * Retorna array consolidado de todos os servidores cadastrados nos 16 entes.
     * Prioriza a base consolidada dinâmica (47k+ registros) quando carregada.
     */
    obterTodos: function() {
      if (BASE_CONSOLIDADA_DINAMICA && BASE_CONSOLIDADA_DINAMICA.length > 0) {
        return BASE_CONSOLIDADA_DINAMICA;
      }

      var fonteDocentes = null;
      if (typeof root !== 'undefined' && root.DOCENTES_CEARA_MIRIM && Array.isArray(root.DOCENTES_CEARA_MIRIM)) {
        fonteDocentes = root.DOCENTES_CEARA_MIRIM;
      } else if (typeof window !== 'undefined' && window.DOCENTES_CEARA_MIRIM && Array.isArray(window.DOCENTES_CEARA_MIRIM)) {
        fonteDocentes = window.DOCENTES_CEARA_MIRIM;
      } else if (typeof window !== 'undefined' && window.OlymposViews && window.OlymposViews.papiroCadmo && typeof window.OlymposViews.papiroCadmo.obterDocentesCearaMirim === 'function') {
        fonteDocentes = window.OlymposViews.papiroCadmo.obterDocentesCearaMirim();
      }

      var cearaServidores = SERVIDORES_CEARA_MIRIM;
      if (fonteDocentes && fonteDocentes.length > 0) {
        var docentesDerivados = fonteDocentes.map(converterDocenteCearaMirim);
        var outrosQuadrosCM = SERVIDORES_CEARA_MIRIM.filter(function(s) {
          return normalizarTexto(s.quadro) !== 'docente';
        });
        cearaServidores = docentesDerivados.concat(outrosQuadrosCM);
      }

      var fonteEstado = null;
      if (typeof root !== 'undefined' && root.SERVIDORES_ESTADO_RN && Array.isArray(root.SERVIDORES_ESTADO_RN)) {
        fonteEstado = root.SERVIDORES_ESTADO_RN;
      } else if (typeof window !== 'undefined' && window.SERVIDORES_ESTADO_RN && Array.isArray(window.SERVIDORES_ESTADO_RN)) {
        fonteEstado = window.SERVIDORES_ESTADO_RN;
      } else if (typeof window !== 'undefined' && window.OlymposViews && window.OlymposViews.papiroCadmo && window.OlymposViews.papiroCadmo.SERVIDORES_ESTADO_RN) {
        fonteEstado = window.OlymposViews.papiroCadmo.SERVIDORES_ESTADO_RN;
      }

      var estadoServidores = SERVIDORES_ESTADO_RN;
      if (fonteEstado && fonteEstado.length > 0) {
        var estadoDerivados = fonteEstado.map(converterServidorEstadoRN);
        var outrosQuadrosEstado = SERVIDORES_ESTADO_RN.filter(function(s) {
          return normalizarTexto(s.quadro) !== 'docente';
        });
        var matsEstado = {};
        estadoDerivados.forEach(function(s) { matsEstado[s.matricula] = true; });
        var complementares = outrosQuadrosEstado.filter(function(s) { return !matsEstado[s.matricula]; });
        estadoServidores = estadoDerivados.concat(complementares);
      }

      return [].concat(
        cearaServidores,
        estadoServidores,
        SERVIDORES_NATAL,
        SERVIDORES_PARNAMIRIM,
        SERVIDORES_SGA
      );
    },

    /**
     * Carrega de forma assíncrona o catálogo consolidado completo (JSON otimizado dos 16 entes)
     * @returns {Promise<Array>} Array de servidores consolidados
     */
    carregarBaseConsolidadaAsync: function() {
      if (BASE_CONSOLIDADA_DINAMICA && BASE_CONSOLIDADA_DINAMICA.length > 0) {
        return Promise.resolve(BASE_CONSOLIDADA_DINAMICA);
      }
      if (promessaCarregamentoBase) {
        return promessaCarregamentoBase;
      }

      promessaCarregamentoBase = fetch('data/servidores_consolidados.json')
        .then(function(resp) {
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          return resp.json();
        })
        .then(function(lista) {
          if (!Array.isArray(lista) || lista.length === 0) {
            throw new Error('Formato inválido de servidores_consolidados.json');
          }
          var formatados = lista.map(function(item) {
            var nome = String(item.n || item.nome || '').trim();
            var mat = String(item.m || item.matricula || '').trim();
            var ente = String(item.e || item.ente || 'Ente Federativo').trim();
            var cargo = String(item.g || item.cargo || 'Cargo não informado').trim();
            var ch = parseCargaHoraria(item.h || item.cargaHoraria);
            var lot = String(item.l || item.lotacao || 'Lotação não informada').trim();
            var cpf = String(item.c || item.cpf || '###.***.***-##').trim();
            var situacao = String(item.s || item.situacao || 'ATIVO').trim();

            var quadro = 'Administrativo';
            var normG = normalizarTexto(cargo);
            if (normG.indexOf('prof') !== -1 || normG.indexOf('docen') !== -1 || normG.indexOf('pedag') !== -1 || normG.indexOf('educad') !== -1 || normG.indexOf('magist') !== -1) {
              quadro = 'Docente';
            } else if (normG.indexOf('diretor') !== -1 || normG.indexOf('coordenad') !== -1 || normG.indexOf('gestao') !== -1) {
              quadro = 'Gestão Escolar';
            } else if (normG.indexOf('psicol') !== -1 || normG.indexOf('assistente social') !== -1 || normG.indexOf('especial') !== -1 || normG.indexOf('nutric') !== -1 || normG.indexOf('tecnic') !== -1) {
              quadro = 'Técnico';
            } else if (normG.indexOf('merend') !== -1 || normG.indexOf('motor') !== -1 || normG.indexOf('asg') !== -1 || normG.indexOf('vigia') !== -1 || normG.indexOf('guarda') !== -1 || normG.indexOf('servicos gerais') !== -1) {
              quadro = 'Apoio';
            }

            var enteId = normalizarTexto(ente).replace(/[^a-z0-9]/g, '_');

            return {
              id: mat ? (enteId + '_' + mat) : ('serv_' + Math.random().toString(36).substr(2, 9)),
              matricula: mat,
              m: mat,
              nome: nome,
              n: nome,
              cpfMascarado: cpf,
              c: cpf,
              ente: ente,
              enteId: enteId,
              orgao: lot || ente,
              quadro: quadro,
              cargo: cargo,
              g: cargo,
              funcao: cargo,
              cargaHoraria: ch,
              cargaHorariaTexto: (ch > 0 ? (ch + 'h') : '30h'),
              h: (ch > 0 ? (ch + 'h') : '30h'),
              lotacao: lot,
              l: lot,
              situacao: situacao,
              status: situacao,
              regime: 'Efetivo / Estatutário'
            };
          });

          BASE_CONSOLIDADA_DINAMICA = formatados;
          OLYMPOS_SERVIDORES_UNIFICADOS = formatados;
          console.info('[OlymposServidores] Base consolidada intermunicipal carregada: ' + formatados.length + ' servidores.');
          return formatados;
        })
        .catch(function(err) {
          console.warn('[OlymposServidores] Fallback para base semente local: ' + err.message);
          promessaCarregamentoBase = null;
          return OlymposServidores.obterTodos();
        });

      return promessaCarregamentoBase;
    },

    /**
     * Retorna as métricas de resumo dos KPIs oficiais (via Supabase RPC ou fallback local)
     */
    obterResumoKpisAsync: function() {
      if (RESUMO_KPIS_DINAMICO) {
        return Promise.resolve(RESUMO_KPIS_DINAMICO);
      }

      function lerArquivoLocal() {
        return fetch('data/resumo_kpis.json')
          .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function(d) {
            RESUMO_KPIS_DINAMICO = d;
            return d;
          });
      }

      // Tenta via Supabase RPC primeiro se configurado
      try {
        if (window.OlymposSupabase && typeof window.OlymposSupabase.getClient === 'function') {
          var sb = window.OlymposSupabase.getClient();
          if (sb && typeof sb.rpc === 'function') {
            return sb.rpc('obter_resumo_kpis_folha', { p_competencia: 'todas' })
              .then(function(resp) {
                if (resp && resp.data && resp.data.total_acervo) {
                  RESUMO_KPIS_DINAMICO = resp.data;
                  return resp.data;
                }
                return lerArquivoLocal();
              })
              .catch(function() {
                return lerArquivoLocal();
              });
          }
        }
      } catch (e) {}

      return lerArquivoLocal().catch(function() {
        return null;
      });
    },

    /**
     * Filtra servidores por ente federativo
     * @param {string} enteId ('ceara_mirim', 'governo_rn', 'natal', 'parnamirim', 'sga')
     */
    obterPorEnte: function(enteId) {
      var norm = normalizarTexto(enteId).replace(/[^a-z0-9]/g, '');
      return this.obterTodos().filter(function(s) {
        var sEnteId = normalizarTexto(s.enteId || '').replace(/[^a-z0-9]/g, '');
        var sEnteNome = normalizarTexto(s.ente || '').replace(/[^a-z0-9]/g, '');
        return sEnteId.indexOf(norm) !== -1 || sEnteNome.indexOf(norm) !== -1;
      });
    },

    /**
     * Filtra servidores por quadro funcional
     * @param {string} quadro ('Docente', 'Administrativo', 'Apoio', 'Técnico', 'Operacional')
     */
    obterPorQuadro: function(quadro) {
      var norm = normalizarTexto(quadro);
      return this.obterTodos().filter(function(s) {
        return normalizarTexto(s.quadro) === norm;
      });
    },

    /**
     * Busca abrangente por termo com filtros opcionais
     * @param {string} termo - Nome, matrícula, cargo ou lotação
     * @param {Object} [filtros] - { ente, quadro, regime, situacao, vinculos }
     */
    buscar: function(termo, filtros) {
      filtros = filtros || {};
      var termoNorm = normalizarTexto(termo);
      var termoMat = normalizarMatricula(termo);

      var lista = this.obterTodos().filter(function(s) {
        // Filtro por termo
        if (termoNorm) {
          var nomeNorm = normalizarTexto(s.nome);
          var matNorm = normalizarMatricula(s.matricula);
          var cargoNorm = normalizarTexto(s.cargo);
          var lotNorm = normalizarTexto(s.lotacao);
          var orgaoNorm = normalizarTexto(s.orgao);
          var enteNorm = normalizarTexto(s.ente);

          var matchNome = nomeNorm.indexOf(termoNorm) !== -1;
          var matchMat = matNorm && (matNorm.indexOf(termoMat) !== -1 || termoMat.indexOf(matNorm) !== -1);
          var matchCargo = cargoNorm.indexOf(termoNorm) !== -1;
          var matchLot = lotNorm.indexOf(termoNorm) !== -1;
          var matchOrgao = orgaoNorm.indexOf(termoNorm) !== -1;
          var matchEnte = enteNorm.indexOf(termoNorm) !== -1;

          if (!matchNome && !matchMat && !matchCargo && !matchLot && !matchOrgao && !matchEnte) {
            return false;
          }
        }

        // Filtro Ente
        if (filtros.ente && filtros.ente !== 'todos') {
          var eFiltro = normalizarTexto(filtros.ente).replace(/[^a-z0-9]/g, '');
          var sEnteId = normalizarTexto(s.enteId || '').replace(/[^a-z0-9]/g, '');
          var sEnte = normalizarTexto(s.ente || '').replace(/[^a-z0-9]/g, '');
          if (sEnteId.indexOf(eFiltro) === -1 && sEnte.indexOf(eFiltro) === -1) {
            return false;
          }
        }

        // Filtro Quadro
        if (filtros.quadro && filtros.quadro !== 'todos') {
          var qFiltro = normalizarTexto(filtros.quadro);
          var sQuadro = normalizarTexto(s.quadro);
          if (sQuadro.indexOf(qFiltro) === -1) {
            return false;
          }
        }

        // Filtro Regime
        if (filtros.regime && filtros.regime !== 'todos') {
          var rFiltro = normalizarTexto(filtros.regime);
          var sRegime = normalizarTexto(s.regime);
          if (sRegime.indexOf(rFiltro) === -1) {
            return false;
          }
        }

        // Filtro Situação
        if (filtros.situacao && filtros.situacao !== 'todos') {
          var sitFiltro = normalizarTexto(filtros.situacao);
          var sSituacao = normalizarTexto(s.situacao);
          if (sSituacao.indexOf(sitFiltro) === -1) {
            return false;
          }
        }

        return true;
      });

      return lista;
    },

    /**
     * Retorna o dossiê consolidado de um servidor com análise constitucional de acumulação (CF/88 Art. 37, XVI)
     * @param {string} matriculaOuNome - Matrícula ou nome do servidor
     */
    obterDossie: function(matriculaOuNome) {
      if (!matriculaOuNome) return null;
      var termoNorm = normalizarTexto(matriculaOuNome);
      var termoMat = normalizarMatricula(matriculaOuNome);

      var todos = this.obterTodos();

      // Localiza o servidor semente
      var servidorEncontrado = null;
      for (var i = 0; i < todos.length; i++) {
        var s = todos[i];
        if (normalizarMatricula(s.matricula) === termoMat || normalizarTexto(s.nome) === termoNorm || normalizarTexto(s.nome).indexOf(termoNorm) !== -1) {
          servidorEncontrado = s;
          break;
        }
      }

      if (!servidorEncontrado) return null;

      // Consolida todos os vínculos de mesmo nome/CPF
      var nomeNormAlvo = normalizarTexto(servidorEncontrado.nome);
      var vinculos = [];
      var matriculas = [];
      var cargaHorariaTotal = 0;

      todos.forEach(function(s) {
        if (normalizarTexto(s.nome) === nomeNormAlvo) {
          if (matriculas.indexOf(s.matricula) === -1) {
            matriculas.push(s.matricula);
          }
          var ch = parseCargaHoraria(s.cargaHoraria || s.cargaHorariaTexto);
          cargaHorariaTotal += ch;

          vinculos.push({
            id: s.id,
            ente: s.ente,
            enteId: s.enteId,
            orgao: s.orgao,
            quadro: s.quadro,
            cargo: s.cargo,
            funcao: s.funcao,
            cargaHoraria: ch,
            cargaHorariaTexto: s.cargaHorariaTexto || (ch + 'h'),
            lotacao: s.lotacao,
            turno: s.turno,
            regime: s.regime,
            situacao: s.situacao,
            dataAdmissao: s.dataAdmissao
          });
        }
      });

      // Auditoria Constitucional CF/88 Art. 37, XVI
      var auditoria = {
        totalVinculos: vinculos.length,
        cargaHorariaTotal: cargaHorariaTotal,
        acumulacaoLicita: true,
        enquadramentoLegal: '',
        parecerTexto: '',
        alertaStatus: 'REGULAR'
      };

      if (vinculos.length === 1) {
        auditoria.acumulacaoLicita = true;
        auditoria.enquadramentoLegal = 'Vínculo Único';
        auditoria.parecerTexto = 'Servidor possui vínculo funcional único de ' + cargaHorariaTotal + 'h semanais. Situação plenamente regular perante a CF/88.';
        auditoria.alertaStatus = 'REGULAR';
      } else if (vinculos.length === 2) {
        var v1 = vinculos[0];
        var v2 = vinculos[1];
        var isV1Doc = normalizarTexto(v1.quadro) === 'docente' || normalizarTexto(v1.cargo).indexOf('professor') !== -1;
        var isV2Doc = normalizarTexto(v2.quadro) === 'docente' || normalizarTexto(v2.cargo).indexOf('professor') !== -1;
        var isV1Tec = normalizarTexto(v1.quadro) === 'tecnico' || normalizarTexto(v1.cargo).indexOf('psicologo') !== -1 || normalizarTexto(v1.cargo).indexOf('assistente social') !== -1 || normalizarTexto(v1.cargo).indexOf('especialista') !== -1;
        var isV2Tec = normalizarTexto(v2.quadro) === 'tecnico' || normalizarTexto(v2.cargo).indexOf('psicologo') !== -1 || normalizarTexto(v2.cargo).indexOf('assistente social') !== -1 || normalizarTexto(v2.cargo).indexOf('especialista') !== -1;

        if (isV1Doc && isV2Doc) {
          auditoria.enquadramentoLegal = 'CF/88 Art. 37, XVI, a (Dois cargos de professor)';
          if (cargaHorariaTotal <= 60) {
            auditoria.acumulacaoLicita = true;
            auditoria.alertaStatus = 'REGULAR';
            auditoria.parecerTexto = 'Acúmulo lícito de 2 cargos de professor com jornada compatível de ' + cargaHorariaTotal + 'h semanais (teto de 60h respeitado).';
          } else {
            auditoria.acumulacaoLicita = false;
            auditoria.alertaStatus = 'ALERTA_CARGA';
            auditoria.parecerTexto = 'Jornada total acumulada de ' + cargaHorariaTotal + 'h semanais excede o teto jurisprudencial de 60h do TCU/TCE-RN.';
          }
        } else if ((isV1Doc && isV2Tec) || (isV2Doc && isV1Tec)) {
          auditoria.enquadramentoLegal = 'CF/88 Art. 37, XVI, b (Um cargo de professor com outro técnico/científico)';
          if (cargaHorariaTotal <= 60) {
            auditoria.acumulacaoLicita = true;
            auditoria.alertaStatus = 'REGULAR';
            auditoria.parecerTexto = 'Acúmulo lícito de 1 cargo docente com 1 cargo técnico/científico, totalizando ' + cargaHorariaTotal + 'h semanais.';
          } else {
            auditoria.acumulacaoLicita = false;
            auditoria.alertaStatus = 'ALERTA_CARGA';
            auditoria.parecerTexto = 'Acúmulo atende aos cargos, mas jornada de ' + cargaHorariaTotal + 'h excede o limite jurisprudencial de 60h semanais.';
          }
        } else {
          auditoria.acumulacaoLicita = false;
          auditoria.alertaStatus = 'INCOMPATIVEL';
          auditoria.enquadramentoLegal = 'CF/88 Art. 37, XVI (Vínculos inacumuláveis)';
          auditoria.parecerTexto = 'Cargos não contemplados nas exceções de acúmulo da Constituição Federal de 1988.';
        }
      } else {
        auditoria.acumulacaoLicita = false;
        auditoria.alertaStatus = 'INCOMPATIVEL';
        auditoria.enquadramentoLegal = 'CF/88 Art. 37, XVI (Vedação expressa a mais de 2 vínculos)';
        auditoria.parecerTexto = 'Servidor com ' + vinculos.length + ' vínculos ativos identificados. Vedada expressamente a tríplice acumulação.';
      }

      return {
        id: servidorEncontrado.id,
        nome: servidorEncontrado.nome,
        cpfMascarado: servidorEncontrado.cpfMascarado,
        matriculas: matriculas,
        entePrincipal: servidorEncontrado.ente,
        quadroPrincipal: servidorEncontrado.quadro,
        cargoPrincipal: servidorEncontrado.cargo,
        lotacaoPrincipal: servidorEncontrado.lotacao,
        vinculos: vinculos,
        auditoria: auditoria
      };
    }
  };

  // Exportação compatível com Browser (window) e Node.js
  if (typeof root !== 'undefined') {
    root.SERVIDORES_CEARA_MIRIM = SERVIDORES_CEARA_MIRIM;
    root.SERVIDORES_ESTADO_RN = SERVIDORES_ESTADO_RN;
    root.SERVIDORES_NATAL = SERVIDORES_NATAL;
    root.SERVIDORES_PARNAMIRIM = SERVIDORES_PARNAMIRIM;
    root.SERVIDORES_SGA = SERVIDORES_SGA;
    root.OLYMPOS_SERVIDORES_UNIFICADOS = OLYMPOS_SERVIDORES_UNIFICADOS;
    root.OlymposServidores = OlymposServidores;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SERVIDORES_CEARA_MIRIM: SERVIDORES_CEARA_MIRIM,
      SERVIDORES_ESTADO_RN: SERVIDORES_ESTADO_RN,
      SERVIDORES_NATAL: SERVIDORES_NATAL,
      SERVIDORES_PARNAMIRIM: SERVIDORES_PARNAMIRIM,
      SERVIDORES_SGA: SERVIDORES_SGA,
      OLYMPOS_SERVIDORES_UNIFICADOS: OLYMPOS_SERVIDORES_UNIFICADOS,
      OlymposServidores: OlymposServidores
    };
  }
})(typeof window !== 'undefined' ? window : this);
