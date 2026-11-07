/**
 * Hub Olympos V2.2 — Módulo de Visualização: Calendário Escolar & Agenda Intersetorial
 * Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)
 * 
 * Gestão e controle integral do calendário letivo:
 * - Ano 2026 Oficial: 203 dias letivos (Fev 7, Mar 23, Abr 21, Mai 21, Jun 19, Jul 15, Ago 21, Set 22, Out 19, Nov 19, Dez 16)
 * - 4 Bimestres: 1º (19/02 a 23/04 - 45d), 2º (24/04 a 25/06 - 46d), 3º (13/07 a 28/09 - 56d), 4º (29/09 a 23/12 - 56d)
 * - Recesso Escolar: 29/06/2026 a 13/07/2026
 * - Cronograma de Matrículas: Renovação, Transferência Interna, Alunos Novos, NEE
 * - Feriados e Facultativos: Nacionais, Religiosos e Municipais de Ceará-Mirim (30/07 Emancipação, 08/12 Padroeira)
 * - 8 Sábados Letivos Temáticos
 * - Jornadas Pedagógicas: SMEB e Escolar
 * - Semanas Comemorativas e Exames Finais
 * - Ano 2027 Planejamento: Dados preliminares com 202 dias letivos previstos
 * - Visualizações: Mês (grade mensal interativa) e Bimestre (cards executivos)
 * - Filtros por Categoria de Evento
 * - Exportador iCal (.ics) RFC 5545 para Google Calendar
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.calendario = (function() {
  'use strict';

  // Chaves de armazenamento e estado
  var STORAGE_AGENDA_KEY = 'olympos_calendario_agenda_custom';
  var STORAGE_CUSTOM_KEY = 'olympos_calendario_eventos_custom';
  var _hojeData = new Date();
  var selectedYear = (_hojeData.getFullYear() === 2027) ? 2027 : 2026;
  var selectedMonth = (function() {
    var m = _hojeData.getMonth();
    return (m >= 0 && m <= 11) ? m : 1;
  })();
  var activeTab = 'mes'; // 'mes' ou 'bimestre'
  var activeCategory = 'todos';
  var activeSector = 'todos';
  var selectedDate = null;
  var eventsBound = false;

  // Nomes canônicos em Português
  var MESES_NOMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  var DIAS_SEMANA_NOMES = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  // =========================================================================
  // BASE DE DADOS CANÔNICA: 2026 OFICIAL & 2027 PLANEJAMENTO
  // =========================================================================

  var DADOS_2026 = {
    ano: 2026,
    status: 'OFICIAL_HOMOLOGADO',
    statusDescricao: 'Calendário Oficial Homologado • Resolução CME nº 004/2025',
    totalDiasLetivos: 203,
    metaLdb: 200,
    diasPorMes: {
      0: 0,   // Janeiro: 0 dias letivos (Férias / Matrículas)
      1: 7,   // Fevereiro: 7 dias (Início em 19/02)
      2: 23,  // Março: 23 dias (inclui 2 sábados letivos)
      3: 21,  // Abril: 21 dias (inclui término do 1º bim e início do 2º bim)
      4: 21,  // Maio: 21 dias (inclui 1 sábado letivo)
      5: 19,  // Junho: 19 dias (inclui 1 sábado letivo; aulas até 25/06)
      6: 15,  // Julho: 15 dias (recesso até 13/07; aulas retornam 13/07)
      7: 21,  // Agosto: 21 dias (inclui 1 sábado letivo)
      8: 22,  // Setembro: 22 dias (inclui 1 sábado letivo; término 3º bim e início 4º bim)
      9: 19,  // Outubro: 19 dias (inclui 1 sábado letivo)
      10: 19, // Novembro: 19 dias (inclui 1 sábado letivo)
      11: 16  // Dezembro: 16 dias (aulas até 23/12; conselho final)
    },
    bimestres: [
      {
        id: 1,
        numeroRomano: 'I',
        titulo: '1º Bimestre Letivo',
        dataInicio: '2026-02-19',
        dataFim: '2026-04-23',
        diasLetivos: 45,
        distribuicaoMeses: 'Fev: 7d | Mar: 23d | Abr: 15d',
        sabadosLetivos: [
          { data: '2026-03-07', tema: 'Acolhimento, Família na Escola e Gestão Democrática' },
          { data: '2026-03-28', tema: 'Letramento, Poesia e Identidade Literária de Ceará-Mirim' }
        ],
        marcos: [
          '19/02: Início oficial do 1º Bimestre Letivo',
          '07/03: 1º Sábado Letivo Temático (Família na Escola)',
          '28/03: 2º Sábado Letivo Temático (Letramento e Poesia)',
          '13 a 17/04: Semana Municipal do Livro Infantil',
          '20 a 23/04: Avaliações Bimestrais e Fechamento de Médias'
        ]
      },
      {
        id: 2,
        numeroRomano: 'II',
        titulo: '2º Bimestre Letivo',
        dataInicio: '2026-04-24',
        dataFim: '2026-06-25',
        diasLetivos: 46,
        distribuicaoMeses: 'Abr: 6d | Mai: 21d | Jun: 19d',
        sabadosLetivos: [
          { data: '2026-05-09', tema: 'Diálogos Comunitários, Saúde Emocional e Valorização da Vida' },
          { data: '2026-06-06', tema: 'Meio Ambiente, Sustentabilidade e Ecossistema do Rio Ceará-Mirim' }
        ],
        marcos: [
          '24/04: Início do 2º Bimestre Letivo',
          '09/05: 3º Sábado Letivo Temático (Saúde Emocional)',
          '01 a 05/06: Semana do Meio Ambiente e Recursos Hídricos',
          '06/06: 4º Sábado Letivo Temático (Sustentabilidade)',
          '22 a 25/06: Avaliações Bimestrais e Conselho de Classe',
          '26/06: Plantão Pedagógico e Devolutiva às Famílias'
        ]
      },
      {
        id: 3,
        numeroRomano: 'III',
        titulo: '3º Bimestre Letivo',
        dataInicio: '2026-07-13',
        dataFim: '2026-09-28',
        diasLetivos: 56,
        distribuicaoMeses: 'Jul: 15d | Ago: 21d | Set: 20d',
        sabadosLetivos: [
          { data: '2026-08-15', tema: 'Folclore, Tradições Populares e Memória Cultural Potiguar' },
          { data: '2026-09-19', tema: 'Cultura de Paz, Diversidade e Práticas Restaurativas na Escola' }
        ],
        marcos: [
          '13/07: Retorno do Recesso e Início do 3º Bimestre',
          '30/07: Feriado Municipal (Emancipação de Ceará-Mirim)',
          '15/08: 5º Sábado Letivo Temático (Folclore e Cultura)',
          '01 a 07/09: Semana da Pátria, Cidadania e Desfile Cívico',
          '19/09: 6º Sábado Letivo Temático (Cultura de Paz)',
          '22 a 28/09: Avaliações Bimestrais e Recuperação Paralela'
        ]
      },
      {
        id: 4,
        numeroRomano: 'IV',
        titulo: '4º Bimestre Letivo',
        dataInicio: '2026-09-29',
        dataFim: '2026-12-23',
        diasLetivos: 56,
        distribuicaoMeses: 'Set: 2d | Out: 19d | Nov: 19d | Dez: 16d',
        sabadosLetivos: [
          { data: '2026-10-24', tema: 'Feira de Ciências, Inovação Tecnológica e Saberes SMEB' },
          { data: '2026-11-21', tema: 'Consciência Negra, Educação Antirracista e Patrimônio Cultural' }
        ],
        marcos: [
          '29/09: Início do 4º Bimestre Letivo',
          '13 a 16/10: Semana da Criança, Ludicidade e Direitos da Infância',
          '24/10: 7º Sábado Letivo Temático (Feira de Ciências)',
          '21/11: 8º Sábado Letivo Temático (Consciência Negra)',
          '08/12: Feriado Municipal (Padroeira de Ceará-Mirim)',
          '14 a 18/12: Exames Finais e Recuperação Final',
          '21 a 23/12: Conselho de Classe Final e Encerramento do Ano Letivo'
        ]
      }
    ],
    recesso: {
      dataInicio: '2026-06-29',
      dataFim: '2026-07-13',
      dias: 15,
      descricao: 'Recesso Escolar Discente do Meio de Ano (Parada estratégica da frota e planejamento)'
    },
    eventos: [
      // MATRÍCULAS 2026
      {
        id: 'mat-2026-01',
        dataInicio: '2026-01-05',
        dataFim: '2026-01-16',
        titulo: 'Renovação de Matrícula (Alunos Veteranos)',
        descricao: 'Período obrigatório para renovação de matrícula dos estudantes já matriculados na Rede Municipal de Ensino de Ceará-Mirim.',
        categoria: 'matricula',
        letivo: false,
        setor: 'Gabinete SMEB & Gestão Escolar',
        cor: '#3B82F6',
        icone: '📝'
      },
      {
        id: 'mat-2026-02',
        dataInicio: '2026-01-19',
        dataFim: '2026-01-23',
        titulo: 'Transferência Interna entre Escolas da Rede',
        descricao: 'Requerimento de transferência entre escolas municipais (polo urbano, polos rurais e litoral).',
        categoria: 'matricula',
        letivo: false,
        setor: 'Secretarias Escolares',
        cor: '#3B82F6',
        icone: '🔄'
      },
      {
        id: 'mat-2026-03',
        dataInicio: '2026-01-26',
        dataFim: '2026-02-06',
        titulo: 'Matrícula de Alunos Novos (Rede SMEB)',
        descricao: 'Abertura de vagas para novos estudantes na Educação Infantil (CEI/Creches) e Ensino Fundamental (Anos Iniciais e Finais).',
        categoria: 'matricula',
        letivo: false,
        setor: 'SMEB / Central de Matrículas',
        cor: '#2563EB',
        icone: '🎒'
      },
      {
        id: 'mat-2026-04',
        dataInicio: '2026-02-02',
        dataFim: '2026-02-13',
        titulo: 'Atendimento e Encaminhamento de Alunos com NEE',
        descricao: 'Acolhimento especializado, triagem pedagógica e alocação de profissionais de apoio e salas de recursos multifuncionais (AEE).',
        categoria: 'matricula',
        letivo: false,
        setor: 'Coordenação de Educação Especial / Atena',
        cor: '#8B5CF6',
        icone: '♿'
      },

      // JORNADAS PEDAGÓGICAS 2026
      {
        id: 'jor-2026-01',
        dataInicio: '2026-02-09',
        dataFim: '2026-02-11',
        titulo: 'Jornada Pedagógica SMEB — Rede Municipal',
        descricao: 'Encontro formativo e de planejamento estratégico com toda a rede de professores, gestores e coordenadores da SMEB.',
        categoria: 'jornada',
        letivo: false,
        setor: 'Atena Pedagógico & Gabinete SMEB',
        cor: '#A855F7',
        icone: '🎓'
      },
      {
        id: 'jor-2026-02',
        dataInicio: '2026-02-12',
        dataFim: '2026-02-13',
        titulo: 'Jornada Pedagógica Escolar (Unidades de Ensino)',
        descricao: 'Planejamento local nas unidades escolares, organização dos espaços pedagógicos, acolhimento e plano de curso anual.',
        categoria: 'jornada',
        letivo: false,
        setor: 'Equipes Gestoras e Docentes',
        cor: '#9333EA',
        icone: '🏫'
      },

      // FERIADOS E PONTOS FACULTATIVOS 2026
      {
        id: 'fer-2026-01',
        dataInicio: '2026-01-01',
        dataFim: '2026-01-01',
        titulo: 'Confraternização Universal (Ano Novo)',
        descricao: 'Feriado Nacional (Lei Federal nº 10.607/2002).',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '🎉'
      },
      {
        id: 'fer-2026-02',
        dataInicio: '2026-01-20',
        dataFim: '2026-01-20',
        titulo: 'Dia de São Sebastião (Feriado Religioso)',
        descricao: 'Feriado religioso e tradição comunitária em diversos distritos e polos de Ceará-Mirim.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Religioso / Municipal',
        cor: '#EF4444',
        icone: '⛪'
      },
      {
        id: 'fer-2026-03',
        dataInicio: '2026-02-16',
        dataFim: '2026-02-18',
        titulo: 'Carnaval e Quarta-feira de Cinzas',
        descricao: 'Ponto Facultativo nas repartições públicas municipais e recesso de Carnaval.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Ponto Facultativo',
        cor: '#F97316',
        icone: '🎭'
      },
      {
        id: 'fer-2026-04',
        dataInicio: '2026-04-03',
        dataFim: '2026-04-03',
        titulo: 'Sexta-feira da Paixão de Cristo',
        descricao: 'Feriado Nacional / Religioso (Lei Federal nº 9.093/1995).',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional Religioso',
        cor: '#EF4444',
        icone: '✝️'
      },
      {
        id: 'fer-2026-05',
        dataInicio: '2026-04-21',
        dataFim: '2026-04-21',
        titulo: 'Tiradentes',
        descricao: 'Feriado Nacional em memória de Joaquim José da Silva Xavier.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '🏛️'
      },
      {
        id: 'fer-2026-06',
        dataInicio: '2026-05-01',
        dataFim: '2026-05-01',
        titulo: 'Dia Mundial do Trabalho',
        descricao: 'Feriado Nacional consagrado aos trabalhadores.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '🔨'
      },
      {
        id: 'fer-2026-07',
        dataInicio: '2026-06-04',
        dataFim: '2026-06-04',
        titulo: 'Corpus Christi',
        descricao: 'Ponto Facultativo / Celebração religiosa católica tradicional.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Ponto Facultativo',
        cor: '#F97316',
        icone: '🕊️'
      },
      {
        id: 'fer-2026-08',
        dataInicio: '2026-07-30',
        dataFim: '2026-07-30',
        titulo: 'Emancipação Política de Ceará-Mirim (168 Anos)',
        descricao: 'Feriado Municipal de Ceará-Mirim/RN (Lei Orgânica Municipal). Celebração cívica da autonomia do município.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Municipal Ceará-Mirim',
        cor: '#DC2626',
        icone: '🌴'
      },
      {
        id: 'fer-2026-09',
        dataInicio: '2026-09-07',
        dataFim: '2026-09-07',
        titulo: 'Independência do Brasil',
        descricao: 'Feriado Nacional da Independência e Desfile Cívico Municipal de Ceará-Mirim.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '🇧🇷'
      },
      {
        id: 'fer-2026-10',
        dataInicio: '2026-10-12',
        dataFim: '2026-10-12',
        titulo: 'Nossa Senhora Aparecida (Padroeira do Brasil)',
        descricao: 'Feriado Nacional e Dia das Crianças (Lei Federal nº 6.802/1980).',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '👑'
      },
      {
        id: 'fer-2026-11',
        dataInicio: '2026-11-02',
        dataFim: '2026-11-02',
        titulo: 'Finados',
        descricao: 'Feriado Nacional (Lei Federal nº 10.607/2002).',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '🕯️'
      },
      {
        id: 'fer-2026-12',
        dataInicio: '2026-11-15',
        dataFim: '2026-11-15',
        titulo: 'Proclamação da República',
        descricao: 'Feriado Nacional da Proclamação da República Federativa do Brasil.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '⚖️'
      },
      {
        id: 'fer-2026-13',
        dataInicio: '2026-11-20',
        dataFim: '2026-11-20',
        titulo: 'Dia Nacional de Zumbi e da Consciência Negra',
        descricao: 'Feriado Nacional (Lei Federal nº 14.759/2023). Celebração e reflexão sobre a história e luta afro-brasileira.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '✊🏿'
      },
      {
        id: 'fer-2026-14',
        dataInicio: '2026-12-08',
        dataFim: '2026-12-08',
        titulo: 'Nossa Senhora da Conceição (Padroeira de Ceará-Mirim)',
        descricao: 'Feriado Municipal de Ceará-Mirim/RN consagrado à padroeira da cidade.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Municipal Ceará-Mirim',
        cor: '#DC2626',
        icone: '✨'
      },
      {
        id: 'fer-2026-15',
        dataInicio: '2026-12-25',
        dataFim: '2026-12-25',
        titulo: 'Natal',
        descricao: 'Feriado Nacional de celebração natalina.',
        categoria: 'feriado',
        letivo: false,
        tipoFeriado: 'Nacional',
        cor: '#EF4444',
        icone: '🎄'
      },

      // RECESSO ESCOLAR
      {
        id: 'rec-2026-01',
        dataInicio: '2026-06-29',
        dataFim: '2026-07-13',
        titulo: 'Recesso Escolar Discente do Meio de Ano',
        descricao: 'Período oficial de recesso das atividades escolares discentes. Manutenção predial das escolas e revisão da frota do transporte escolar.',
        categoria: 'feriado',
        letivo: false,
        setor: 'Rede Municipal SMEB',
        cor: '#64748B',
        icone: '🏖️'
      },

      // 8 SÁBADOS LETIVOS TEMÁTICOS (2026)
      {
        id: 'sab-2026-01',
        dataInicio: '2026-03-07',
        dataFim: '2026-03-07',
        titulo: '1º Sábado Letivo: Acolhimento, Família na Escola e Gestão Democrática',
        descricao: 'Integração família-escola, apresentação dos projetos pedagógicos da unidade e fortalecimento dos conselhos escolares.',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 1,
        setor: 'Atena Pedagógico & Escolas',
        cor: '#F59E0B',
        icone: '👨‍👩‍👧‍👦'
      },
      {
        id: 'sab-2026-02',
        dataInicio: '2026-03-28',
        dataFim: '2026-03-28',
        titulo: '2º Sábado Letivo: Letramento, Poesia e Identidade Literária de Ceará-Mirim',
        descricao: 'Oficinas literárias, cordel, homenagem a escritores cearamirinenses e estímulo ao gosto pela leitura.',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 1,
        setor: 'Coordenação de Linguagens / Atena',
        cor: '#F59E0B',
        icone: '📖'
      },
      {
        id: 'sab-2026-03',
        dataInicio: '2026-05-09',
        dataFim: '2026-05-09',
        titulo: '3º Sábado Letivo: Diálogos Comunitários, Saúde Emocional e Valorização da Vida',
        descricao: 'Ações socioemocionais, rodas de conversa sobre convivência fraterna e parceria com as Unidades Básicas de Saúde (PSE).',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 2,
        setor: 'Atena & Saúde Escolar (PSE)',
        cor: '#F59E0B',
        icone: '🌱'
      },
      {
        id: 'sab-2026-04',
        dataInicio: '2026-06-06',
        dataFim: '2026-06-06',
        titulo: '4º Sábado Letivo: Meio Ambiente, Sustentabilidade e o Rio Ceará-Mirim',
        descricao: 'Projetos de sustentabilidade, preservação do bioma local, mutirão ecológico e conscientização ambiental.',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 2,
        setor: 'Ciências da Natureza / Meio Ambiente',
        cor: '#F59E0B',
        icone: '🌊'
      },
      {
        id: 'sab-2026-05',
        dataInicio: '2026-08-15',
        dataFim: '2026-08-15',
        titulo: '5º Sábado Letivo: Folclore, Tradições Populares e Memória Potiguar',
        descricao: 'Mostra cultural com pastoril, boi de reis, lendas locais, culinária e manifestações do folclore do Vale.',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 3,
        setor: 'Dionísio Cultura & Humanidades',
        cor: '#F59E0B',
        icone: '🎭'
      },
      {
        id: 'sab-2026-06',
        dataInicio: '2026-09-19',
        dataFim: '2026-09-19',
        titulo: '6º Sábado Letivo: Cultura de Paz, Diversidade e Práticas Restaurativas',
        descricao: 'Comemoração ao Dia Internacional da Paz, mediação de conflitos e valorização do respeito mútuo nas salas de aula.',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 3,
        setor: 'Comissão de Paz & Direitos Humanos',
        cor: '#F59E0B',
        icone: '🕊️'
      },
      {
        id: 'sab-2026-07',
        dataInicio: '2026-10-24',
        dataFim: '2026-10-24',
        titulo: '7º Sábado Letivo: Feira de Ciências, Inovação Tecnológica e Saberes SMEB',
        descricao: 'Exposição de experimentos científicos, robótica pedagógica, tecnologias digitais e pesquisa escolar.',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 4,
        setor: 'Dédalo Inovação & Tecnologias',
        cor: '#F59E0B',
        icone: '🔬'
      },
      {
        id: 'sab-2026-08',
        dataInicio: '2026-11-21',
        dataFim: '2026-11-21',
        titulo: '8º Sábado Letivo: Consciência Negra, Educação Antirracista e Patrimônio',
        descricao: 'Culminância das atividades da Semana da Consciência Negra, capoeira, arte afro e literatura quilombola.',
        categoria: 'sabado_letivo',
        letivo: true,
        bimestre: 4,
        setor: 'Diversidade Étnico-Racial / Atena',
        cor: '#F59E0B',
        icone: '🪘'
      },

      // SEMANAS COMEMORATIVAS & EXAMES FINAIS
      {
        id: 'sem-2026-01',
        dataInicio: '2026-04-13',
        dataFim: '2026-04-17',
        titulo: 'Semana Municipal do Livro Infantil e Monteiro Lobato',
        descricao: 'Cirandas de leitura, contação de histórias e feira de livros nas salas de leitura e bibliotecas escolares.',
        categoria: 'letivo',
        letivo: true,
        bimestre: 1,
        setor: 'Atena & Bibliotecas Escolares',
        cor: '#10B981',
        icone: '📚'
      },
      {
        id: 'sem-2026-02',
        dataInicio: '2026-06-01',
        dataFim: '2026-06-05',
        titulo: 'Semana do Meio Ambiente e Preservação dos Recursos Hídricos',
        descricao: 'Projetos interdisciplinares de conservação dos mananciais do Vale do Ceará-Mirim.',
        categoria: 'letivo',
        letivo: true,
        bimestre: 2,
        setor: 'Educação Ambiental',
        cor: '#10B981',
        icone: '🌿'
      },
      {
        id: 'sem-2026-03',
        dataInicio: '2026-09-01',
        dataFim: '2026-09-07',
        titulo: 'Semana da Pátria e Cidadania',
        descricao: 'Atividades cívicas nas escolas municipais e preparação para o tradicional Desfile de 7 de Setembro.',
        categoria: 'letivo',
        letivo: true,
        bimestre: 3,
        setor: 'SMEB / Gabinete',
        cor: '#10B981',
        icone: '🇧🇷'
      },
      {
        id: 'sem-2026-04',
        dataInicio: '2026-10-13',
        dataFim: '2026-10-16',
        titulo: 'Semana da Criança, Ludicidade e Direitos da Infância',
        descricao: 'Gincanas, brinquedotecas, espetáculos teatrais e alimentação escolar festiva.',
        categoria: 'letivo',
        letivo: true,
        bimestre: 4,
        setor: 'Educação Infantil & Fundamental',
        cor: '#10B981',
        icone: '🎈'
      },
      {
        id: 'exa-2026-01',
        dataInicio: '2026-12-14',
        dataFim: '2026-12-18',
        titulo: 'Exames Finais e Recuperação da Aprendizagem',
        descricao: 'Período reservado para aplicação dos exames finais para estudantes com pendência pedagógica.',
        categoria: 'exame',
        letivo: true,
        bimestre: 4,
        setor: 'Coordenação Pedagógica / Escolas',
        cor: '#E11D48',
        icone: '📋'
      },
      {
        id: 'exa-2026-02',
        dataInicio: '2026-12-21',
        dataFim: '2026-12-23',
        titulo: 'Conselho de Classe Final e Encerramento do Ano Letivo',
        descricao: 'Conselho final dos professores, deliberação de aprovações/reprovações e publicação dos resultados no Censo Escolar.',
        categoria: 'exame',
        letivo: true,
        bimestre: 4,
        setor: 'Conselho Escolar & SMEB',
        cor: '#E11D48',
        icone: '🏆'
      }
    ]
  };

  // =========================================================================
  // BASE DE DADOS: 2027 PLANEJAMENTO PRELIMINAR
  // =========================================================================

  var DADOS_2027 = {
    ano: 2027,
    status: 'PLANEJAMENTO_PRELIMINAR',
    statusDescricao: 'Planejamento Preliminar • Proposta Técnica SMEB 2027 (Previsão de 202 Dias Letivos)',
    totalDiasLetivos: 202,
    metaLdb: 200,
    diasPorMes: {
      0: 0,   // Janeiro
      1: 10,  // Fevereiro (Início 15/02)
      2: 21,  // Março
      3: 21,  // Abril
      4: 21,  // Maio
      5: 20,  // Junho (Recesso a partir de 28/06)
      6: 15,  // Julho (Retorno em 12/07)
      7: 21,  // Agosto
      8: 21,  // Setembro
      9: 20,  // Outubro
      10: 19, // Novembro
      11: 13  // Dezembro (Término 22/12)
    },
    bimestres: [
      {
        id: 1,
        numeroRomano: 'I',
        titulo: '1º Bimestre Letivo (2027 Estimado)',
        dataInicio: '2027-02-15',
        dataFim: '2027-04-23',
        diasLetivos: 48,
        distribuicaoMeses: 'Fev: 10d | Mar: 21d | Abr: 17d',
        sabadosLetivos: [
          { data: '2027-03-13', tema: 'Acolhimento Comunitário e Parceria Família-Escola' }
        ],
        marcos: [
          '15/02/2027: Previsão de início das aulas (1º Bimestre)',
          '13/03/2027: Sábado Letivo Temático de Acolhimento',
          '20 a 23/04/2027: Avaliações do 1º Bimestre'
        ]
      },
      {
        id: 2,
        numeroRomano: 'II',
        titulo: '2º Bimestre Letivo (2027 Estimado)',
        dataInicio: '2027-04-26',
        dataFim: '2027-06-25',
        diasLetivos: 45,
        distribuicaoMeses: 'Abr: 4d | Mai: 21d | Jun: 20d',
        sabadosLetivos: [
          { data: '2027-05-15', tema: 'Saúde, Convivência e Bem-Estar Escolar' },
          { data: '2027-06-05', tema: 'Semana do Meio Ambiente e Rio Ceará-Mirim' }
        ],
        marcos: [
          '26/04/2027: Início do 2º Bimestre Letivo',
          '15/05/2027: Sábado Letivo Temático',
          '21 a 25/06/2027: Avaliações Bimestrais e Conselho de Classe'
        ]
      },
      {
        id: 3,
        numeroRomano: 'III',
        titulo: '3º Bimestre Letivo (2027 Estimado)',
        dataInicio: '2027-07-12',
        dataFim: '2027-09-24',
        diasLetivos: 54,
        distribuicaoMeses: 'Jul: 15d | Ago: 21d | Set: 18d',
        sabadosLetivos: [
          { data: '2027-08-14', tema: 'Patrimônio Histórico e Identidade Cearamirinense' }
        ],
        marcos: [
          '12/07/2027: Retorno do Recesso e Início do 3º Bimestre',
          '30/07/2027: Feriado Municipal (Emancipação Política)',
          '01 a 07/09/2027: Semana da Pátria e Desfile Cívico',
          '20 a 24/09/2027: Avaliações do 3º Bimestre'
        ]
      },
      {
        id: 4,
        numeroRomano: 'IV',
        titulo: '4º Bimestre Letivo (2027 Estimado)',
        dataInicio: '2027-09-27',
        dataFim: '2027-12-22',
        diasLetivos: 55,
        distribuicaoMeses: 'Set: 3d | Out: 20d | Nov: 19d | Dez: 13d',
        sabadosLetivos: [
          { data: '2027-10-23', tema: 'Mostra Científica e Tecnológica SMEB' },
          { data: '2027-11-20', tema: 'Dia da Consciência Negra e Igualdade Racial' }
        ],
        marcos: [
          '27/09/2027: Início do 4º Bimestre Letivo',
          '23/10/2027: Mostra Científica Municipal',
          '08/12/2027: Feriado Municipal (Padroeira)',
          '13 a 17/12/2027: Exames Finais',
          '20 a 22/12/2027: Conselho de Classe e Encerramento'
        ]
      }
    ],
    recesso: {
      dataInicio: '2027-06-28',
      dataFim: '2027-07-11',
      dias: 14,
      descricao: 'Recesso Escolar Discente do Meio de Ano (Previsão de 14 dias)'
    },
    eventos: [
      // MATRÍCULAS 2027
      {
        id: 'mat-2027-01',
        dataInicio: '2027-01-04',
        dataFim: '2027-01-15',
        titulo: 'Renovação de Matrícula (Previsão 2027)',
        descricao: 'Renovação dos alunos veteranos da Rede Municipal de Ensino.',
        categoria: 'matricula',
        letivo: false,
        setor: 'SMEB & Escolas',
        cor: '#3B82F6',
        icone: '📝'
      },
      {
        id: 'mat-2027-02',
        dataInicio: '2027-01-18',
        dataFim: '2027-01-22',
        titulo: 'Transferências Internas (Previsão 2027)',
        descricao: 'Remanejamento de alunos entre escolas da rede.',
        categoria: 'matricula',
        letivo: false,
        setor: 'SMEB',
        cor: '#3B82F6',
        icone: '🔄'
      },
      {
        id: 'mat-2027-03',
        dataInicio: '2027-01-25',
        dataFim: '2027-02-05',
        titulo: 'Matrícula de Alunos Novos (Previsão 2027)',
        descricao: 'Vagas para novos alunos na Educação Infantil e Ensino Fundamental.',
        categoria: 'matricula',
        letivo: false,
        setor: 'Central de Matrículas',
        cor: '#2563EB',
        icone: '🎒'
      },
      {
        id: 'mat-2027-04',
        dataInicio: '2027-02-01',
        dataFim: '2027-02-12',
        titulo: 'Acolhimento Alunos com NEE (Previsão 2027)',
        descricao: 'Triagem e alocação pedagógica de alunos da Educação Especial.',
        categoria: 'matricula',
        letivo: false,
        setor: 'Educação Especial / Atena',
        cor: '#8B5CF6',
        icone: '♿'
      },

      // JORNADAS PEDAGÓGICAS 2027
      {
        id: 'jor-2027-01',
        dataInicio: '2027-02-01',
        dataFim: '2027-02-05',
        titulo: 'Jornada Pedagógica SMEB 2027 (Previsão)',
        descricao: 'Abertura do ano letivo com diretores, coordenadores e professores da rede.',
        categoria: 'jornada',
        letivo: false,
        setor: 'Atena & Gabinete',
        cor: '#A855F7',
        icone: '🎓'
      },
      {
        id: 'jor-2027-02',
        dataInicio: '2027-02-08',
        dataFim: '2027-02-10',
        titulo: 'Jornada Pedagógica nas Escolas 2027',
        descricao: 'Planejamento das equipes escolares e acolhimento docente.',
        categoria: 'jornada',
        letivo: false,
        setor: 'Escolas Municipais',
        cor: '#9333EA',
        icone: '🏫'
      },

      // FERIADOS 2027
      {
        id: 'fer-2027-01',
        dataInicio: '2027-01-01',
        dataFim: '2027-01-01',
        titulo: 'Confraternização Universal (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '🎉'
      },
      {
        id: 'fer-2027-02',
        dataInicio: '2027-01-20',
        dataFim: '2027-01-20',
        titulo: 'Dia de São Sebastião (Feriado Religioso)',
        descricao: 'Feriado religioso e tradição cultural local.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '⛪'
      },
      {
        id: 'fer-2027-03',
        dataInicio: '2027-02-08',
        dataFim: '2027-02-10',
        titulo: 'Carnaval e Quarta-feira de Cinzas (2027)',
        descricao: 'Ponto facultativo municipal.',
        categoria: 'feriado',
        letivo: false,
        cor: '#F97316',
        icone: '🎭'
      },
      {
        id: 'fer-2027-04',
        dataInicio: '2027-03-26',
        dataFim: '2027-03-26',
        titulo: 'Sexta-feira da Paixão de Cristo (2027)',
        descricao: 'Feriado Nacional / Religioso.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '✝️'
      },
      {
        id: 'fer-2027-05',
        dataInicio: '2027-04-21',
        dataFim: '2027-04-21',
        titulo: 'Tiradentes (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '🏛️'
      },
      {
        id: 'fer-2027-06',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-01',
        titulo: 'Dia do Trabalho (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '🔨'
      },
      {
        id: 'fer-2027-07',
        dataInicio: '2027-05-27',
        dataFim: '2027-05-27',
        titulo: 'Corpus Christi (2027)',
        descricao: 'Ponto Facultativo.',
        categoria: 'feriado',
        letivo: false,
        cor: '#F97316',
        icone: '🕊️'
      },
      {
        id: 'fer-2027-08',
        dataInicio: '2027-07-30',
        dataFim: '2027-07-30',
        titulo: 'Emancipação Política de Ceará-Mirim (169 Anos)',
        descricao: 'Feriado Municipal de Ceará-Mirim/RN.',
        categoria: 'feriado',
        letivo: false,
        cor: '#DC2626',
        icone: '🌴'
      },
      {
        id: 'fer-2027-09',
        dataInicio: '2027-09-07',
        dataFim: '2027-09-07',
        titulo: 'Independência do Brasil (2027)',
        descricao: 'Feriado Nacional e Desfile Cívico.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '🇧🇷'
      },
      {
        id: 'fer-2027-10',
        dataInicio: '2027-10-12',
        dataFim: '2027-10-12',
        titulo: 'N. Sra. Aparecida (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '👑'
      },
      {
        id: 'fer-2027-11',
        dataInicio: '2027-11-02',
        dataFim: '2027-11-02',
        titulo: 'Finados (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '🕯️'
      },
      {
        id: 'fer-2027-12',
        dataInicio: '2027-11-15',
        dataFim: '2027-11-15',
        titulo: 'Proclamação da República (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '⚖️'
      },
      {
        id: 'fer-2027-13',
        dataInicio: '2027-11-20',
        dataFim: '2027-11-20',
        titulo: 'Dia Nacional de Zumbi e da Consciência Negra (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '✊🏿'
      },
      {
        id: 'fer-2027-14',
        dataInicio: '2027-12-08',
        dataFim: '2027-12-08',
        titulo: 'Nossa Senhora da Conceição (Padroeira 2027)',
        descricao: 'Feriado Municipal de Ceará-Mirim/RN.',
        categoria: 'feriado',
        letivo: false,
        cor: '#DC2626',
        icone: '✨'
      },
      {
        id: 'fer-2027-15',
        dataInicio: '2027-12-25',
        dataFim: '2027-12-25',
        titulo: 'Natal (2027)',
        descricao: 'Feriado Nacional.',
        categoria: 'feriado',
        letivo: false,
        cor: '#EF4444',
        icone: '🎄'
      },

      // RECESSO ESCOLAR 2027
      {
        id: 'rec-2027-01',
        dataInicio: '2027-06-28',
        dataFim: '2027-07-11',
        titulo: 'Recesso Escolar Discente (Previsão 2027)',
        descricao: 'Recesso escolar de meio de ano estimado em 14 dias corridos.',
        categoria: 'feriado',
        letivo: false,
        cor: '#64748B',
        icone: '🏖️'
      },

      // EXAMES FINAIS 2027
      {
        id: 'exa-2027-01',
        dataInicio: '2027-12-13',
        dataFim: '2027-12-17',
        titulo: 'Exames Finais e Recuperação (Previsão 2027)',
        descricao: 'Aplicação de exames finais.',
        categoria: 'exame',
        letivo: true,
        bimestre: 4,
        cor: '#E11D48',
        icone: '📋'
      },
      {
        id: 'exa-2027-02',
        dataInicio: '2027-12-20',
        dataFim: '2027-12-22',
        titulo: 'Conselho de Classe Final (Previsão 2027)',
        descricao: 'Conselho de classe e encerramento do ano letivo de 2027.',
        categoria: 'exame',
        letivo: true,
        bimestre: 4,
        cor: '#E11D48',
        icone: '🏆'
      }
    ]
  };

  // =========================================================================
  // GESTÃO DA AGENDA INTERSETORIAL (CRUD & SUPABASE PERSISTENCE)
  // =========================================================================

  /**
   * Obtém os eventos customizados da agenda intersetorial armazenados localmente
   */
  function obterEventosAgendaCustom(anoFiltro) {
    try {
      var raw = localStorage.getItem(STORAGE_AGENDA_KEY) || localStorage.getItem(STORAGE_CUSTOM_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          if (anoFiltro) {
            return parsed.filter(function(e) {
              return !e.ano || Number(e.ano) === Number(anoFiltro);
            });
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Calendario] Erro ao carregar eventos da agenda do localStorage:', e);
    }
    return [];
  }

  /**
   * Grava lista completa de eventos customizados no localStorage
   */
  function salvarListaAgendaCustom(lista) {
    try {
      localStorage.setItem(STORAGE_AGENDA_KEY, JSON.stringify(lista));
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn('[Calendario] Erro ao salvar eventos da agenda no localStorage:', e);
    }
  }

  /**
   * Retorna todos os eventos (oficiais do ano + agenda intersetorial customizada)
   */
  function obterTodosEventos(dados) {
    var oficiais = (dados && Array.isArray(dados.eventos)) ? dados.eventos : [];
    var custom = obterEventosAgendaCustom((dados && dados.ano) ? dados.ano : selectedYear);
    return oficiais.concat(custom);
  }

  /**
   * Salva ou atualiza um evento da agenda
   */
  function salvarEventoAgenda(evento) {
    if (!evento || !evento.titulo || !evento.dataInicio) {
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Título e data de início são obrigatórios!', true);
      }
      return false;
    }

    var lista = obterEventosAgendaCustom();
    var id = evento.id;
    var agoraIso = new Date().toISOString();
    var anoEvt = evento.dataInicio ? parseInt(evento.dataInicio.split('-')[0], 10) : selectedYear;

    var dadosNormalizados = {
      id: id || ('age_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
      ano: anoEvt,
      titulo: String(evento.titulo).trim(),
      dataInicio: evento.dataInicio,
      dataFim: evento.dataFim || evento.dataInicio,
      horario: evento.horario || '',
      setor: evento.setor || 'Gabinete SMEB',
      categoria: evento.categoria || 'agenda_intersetorial',
      local: evento.local || '',
      descricao: evento.descricao || '',
      publicoAlvo: evento.publicoAlvo || '',
      letivo: false, // RIGOR LDB: eventos da agenda intersetorial NUNCA alteram os 203 dias letivos
      cor: evento.cor || '#8B5CF6',
      icone: evento.icone || '🗓️',
      custom: true,
      updated_at: agoraIso
    };

    var idx = lista.findIndex(function(e) { return e.id === dadosNormalizados.id; });
    if (idx >= 0) {
      lista[idx] = Object.assign({}, lista[idx], dadosNormalizados);
    } else {
      lista.push(dadosNormalizados);
    }

    salvarListaAgendaCustom(lista);

    // Sincronização assíncrona com Supabase
    if (window.OlymposSupabase && typeof window.OlymposSupabase.salvarAgendaEvento === 'function') {
      window.OlymposSupabase.salvarAgendaEvento(dadosNormalizados).catch(function(eSup) {
        console.warn('[Calendario] Sincronização em segundo plano com Supabase falhou:', eSup);
      });
    }

    fecharModalFormAgenda();
    renderizar();

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Evento "' + dadosNormalizados.titulo + '" registrado com sucesso na Agenda!');
    }
    return true;
  }

  /**
   * Exclui um evento da agenda customizada
   */
  function excluirEventoAgenda(id) {
    if (!id) return;
    var lista = obterEventosAgendaCustom();
    var novaLista = lista.filter(function(e) { return e.id !== id; });
    salvarListaAgendaCustom(novaLista);

    // Sincronização assíncrona com Supabase
    if (window.OlymposSupabase && typeof window.OlymposSupabase.excluirAgendaEvento === 'function') {
      window.OlymposSupabase.excluirAgendaEvento(id).catch(function(eSup) {
        console.warn('[Calendario] Falha ao excluir do Supabase:', eSup);
      });
    }

    fecharModalFormAgenda();
    fecharModalDetalhesDia();
    renderizar();

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Evento da agenda excluído com sucesso!');
    }
  }

  /**
   * Abre o modal de formulário da agenda para criar ou editar
   */
  function abrirModalFormAgenda(evOuData) {
    var modal = document.getElementById('modalFormAgendaEvento');
    var form = document.getElementById('formAgendaEventoCalendario');
    var tituloModal = document.getElementById('modalFormAgendaTitulo');
    var btnExcluir = document.getElementById('btnExcluirEventoAgenda');
    if (!modal || !form) return;

    form.reset();

    var idIn = document.getElementById('agendaEventoId');
    var tituloIn = document.getElementById('agendaTitulo');
    var dataInicioIn = document.getElementById('agendaDataInicio');
    var dataFimIn = document.getElementById('agendaDataFim');
    var horarioIn = document.getElementById('agendaHorario');
    var setorIn = document.getElementById('agendaSetor');
    var catIn = document.getElementById('agendaCategoria');
    var localIn = document.getElementById('agendaLocal');
    var descIn = document.getElementById('agendaDescricao');

    var eventoEncontrado = null;
    if (typeof evOuData === 'string' && evOuData.indexOf('age_') === 0) {
      var todos = obterEventosAgendaCustom();
      eventoEncontrado = todos.find(function(e) { return e.id === evOuData; });
    } else if (typeof evOuData === 'object' && evOuData !== null) {
      eventoEncontrado = evOuData;
    }

    if (eventoEncontrado) {
      if (tituloModal) tituloModal.textContent = 'Editar Evento da Agenda';
      if (btnExcluir) {
        btnExcluir.classList.remove('hidden');
        btnExcluir.style.display = 'block';
      }
      if (idIn) idIn.value = eventoEncontrado.id || '';
      if (tituloIn) tituloIn.value = eventoEncontrado.titulo || '';
      if (dataInicioIn) dataInicioIn.value = eventoEncontrado.dataInicio || '';
      if (dataFimIn) dataFimIn.value = eventoEncontrado.dataFim || eventoEncontrado.dataInicio || '';
      if (horarioIn) horarioIn.value = eventoEncontrado.horario || '';
      if (setorIn && eventoEncontrado.setor) setorIn.value = eventoEncontrado.setor;
      if (catIn && eventoEncontrado.categoria) catIn.value = eventoEncontrado.categoria;
      if (localIn) localIn.value = eventoEncontrado.local || '';
      if (descIn) descIn.value = eventoEncontrado.descricao || '';
    } else {
      if (tituloModal) tituloModal.textContent = 'Novo Evento da Agenda Intersetorial';
      if (btnExcluir) {
        btnExcluir.classList.add('hidden');
        btnExcluir.style.display = 'none';
      }
      if (idIn) idIn.value = '';

      var dataPadrao = (typeof evOuData === 'string' && evOuData.match(/^\d{4}-\d{2}-\d{2}$/))
        ? evOuData
        : (selectedYear + '-' + padZero(selectedMonth + 1) + '-15');
      if (dataInicioIn) dataInicioIn.value = dataPadrao;
      if (dataFimIn) dataFimIn.value = dataPadrao;
      if (horarioIn) horarioIn.value = '09:00 - 11:30';
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  /**
   * Fecha o modal de formulário da agenda
   */
  function fecharModalFormAgenda() {
    var modal = document.getElementById('modalFormAgendaEvento');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  function setSetor(setor) {
    activeSector = setor || 'todos';
    var sel = document.getElementById('selectFiltroSetorCalendario');
    if (sel && sel.value !== activeSector) sel.value = activeSector;
    renderizarMesView();
  }

  /**
   * Ponto de entrada chamado pelo router modular
   */
  function init() {
    var selMes = document.getElementById('selectMesCalendario');
    if (selMes) selMes.value = String(selectedMonth);
    bindEvents();
    renderizar();

    // Sincronização em segundo plano da agenda do Supabase
    if (window.OlymposSupabase && typeof window.OlymposSupabase.carregarAgendaEventos === 'function') {
      window.OlymposSupabase.carregarAgendaEventos(selectedYear).then(function(eventosSup) {
        if (Array.isArray(eventosSup) && eventosSup.length > 0) {
          var locais = obterEventosAgendaCustom();
          var mapLocais = {};
          locais.forEach(function(l) { mapLocais[l.id] = l; });
          eventosSup.forEach(function(s) {
            mapLocais[s.id] = Object.assign({}, mapLocais[s.id] || {}, s);
          });
          salvarListaAgendaCustom(Object.keys(mapLocais).map(function(k) { return mapLocais[k]; }));
          renderizar();
        }
      }).catch(function(err) {
        console.warn('[Calendario] Carregamento inicial do Supabase em background:', err);
      });
    }
  }

  /**
   * Vincula ouvintes de eventos da interface (executado uma única vez)
   */
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    // Alternador de Ano: 2026 vs 2027
    var btn2026 = document.getElementById('btnAno2026');
    var btn2027 = document.getElementById('btnAno2027');
    if (btn2026) {
      btn2026.addEventListener('click', function() { setAno(2026); });
    }
    if (btn2027) {
      btn2027.addEventListener('click', function() { setAno(2027); });
    }

    // Abas de visualização: Mês vs Bimestre
    var btnTabMes = document.getElementById('btnCalTabMes');
    var btnTabBimestre = document.getElementById('btnCalTabBimestre');
    if (btnTabMes) {
      btnTabMes.addEventListener('click', function() { setTab('mes'); });
    }
    if (btnTabBimestre) {
      btnTabBimestre.addEventListener('click', function() { setTab('bimestre'); });
    }

    // Navegação de Mês
    var btnMesAnt = document.getElementById('btnMesAnterior');
    var btnMesProx = document.getElementById('btnMesProximo');
    var btnMesHoje = document.getElementById('btnMesHoje');
    var selMes = document.getElementById('selectMesCalendario');

    if (btnMesAnt) {
      btnMesAnt.addEventListener('click', function() {
        if (selectedMonth > 0) {
          setMes(selectedMonth - 1);
        } else {
          setMes(11);
        }
      });
    }
    if (btnMesProx) {
      btnMesProx.addEventListener('click', function() {
        if (selectedMonth < 11) {
          setMes(selectedMonth + 1);
        } else {
          setMes(0);
        }
      });
    }
    if (btnMesHoje) {
      btnMesHoje.addEventListener('click', function() {
        // Redireciona para o mês atual ou fevereiro (início oficial)
        var hoje = new Date();
        if (hoje.getFullYear() === selectedYear) {
          setMes(hoje.getMonth());
        } else {
          setMes(1); // Fevereiro
        }
      });
    }
    if (selMes) {
      selMes.addEventListener('change', function(e) {
        var val = parseInt(e.target.value, 10);
        if (!isNaN(val)) setMes(val);
      });
    }

    // Filtros de Categoria (Pills)
    var filterContainer = document.getElementById('calFilterPillsContainer');
    if (filterContainer) {
      filterContainer.addEventListener('click', function(e) {
        var pill = e.target.closest('.cal-pill');
        if (!pill) return;
        var cat = pill.getAttribute('data-category');
        if (cat) setFiltro(cat);
      });
    }

    // Botões de Exportação iCal (.ics)
    var btnExport = document.getElementById('btnExportarIcal');
    if (btnExport) {
      btnExport.addEventListener('click', function() { exportarIcal(); });
    }
    var btnExportTop = document.getElementById('btnExportarIcalTop');
    if (btnExportTop) {
      btnExportTop.addEventListener('click', function() { exportarIcal(); });
    }

    // Botão + Novo Evento da Agenda
    var btnNovoEvt = document.getElementById('btnNovoEventoAgenda');
    if (btnNovoEvt) {
      btnNovoEvt.addEventListener('click', function() {
        abrirModalFormAgenda();
      });
    }

    // Filtro por Setor Homologado
    var selSetor = document.getElementById('selectFiltroSetorCalendario');
    if (selSetor) {
      selSetor.addEventListener('change', function(e) {
        setSetor(e.target.value);
      });
    }

    // Formulário do Modal de Evento da Agenda
    var formAgenda = document.getElementById('formAgendaEventoCalendario');
    if (formAgenda) {
      formAgenda.addEventListener('submit', function(e) {
        e.preventDefault();
        var id = (document.getElementById('agendaEventoId') ? document.getElementById('agendaEventoId').value : '') || '';
        var titulo = (document.getElementById('agendaTitulo') ? document.getElementById('agendaTitulo').value : '') || '';
        var dataInicio = (document.getElementById('agendaDataInicio') ? document.getElementById('agendaDataInicio').value : '') || '';
        var dataFim = (document.getElementById('agendaDataFim') ? document.getElementById('agendaDataFim').value : '') || '';
        var horario = (document.getElementById('agendaHorario') ? document.getElementById('agendaHorario').value : '') || '';
        var setor = (document.getElementById('agendaSetor') ? document.getElementById('agendaSetor').value : '') || '';
        var categoria = (document.getElementById('agendaCategoria') ? document.getElementById('agendaCategoria').value : '') || '';
        var local = (document.getElementById('agendaLocal') ? document.getElementById('agendaLocal').value : '') || '';
        var descricao = (document.getElementById('agendaDescricao') ? document.getElementById('agendaDescricao').value : '') || '';

        salvarEventoAgenda({
          id: id,
          titulo: titulo,
          dataInicio: dataInicio,
          dataFim: dataFim,
          horario: horario,
          setor: setor,
          categoria: categoria,
          local: local,
          descricao: descricao
        });
      });
    }

    // Botão Excluir Evento da Agenda
    var btnExcluirAgenda = document.getElementById('btnExcluirEventoAgenda');
    if (btnExcluirAgenda) {
      btnExcluirAgenda.addEventListener('click', function() {
        var idIn = document.getElementById('agendaEventoId');
        if (idIn && idIn.value && confirm('Deseja realmente excluir este evento da agenda intersetorial?')) {
          excluirEventoAgenda(idIn.value);
        }
      });
    }

    // Cancelar e Fechar Modal da Agenda
    var btnCancelarAgenda = document.getElementById('btnCancelarFormAgenda');
    var btnCloseAgendaX = document.getElementById('closeModalFormAgendaBtn');
    var modalAgendaBackdrop = document.getElementById('modalFormAgendaEvento');

    if (btnCancelarAgenda) {
      btnCancelarAgenda.addEventListener('click', fecharModalFormAgenda);
    }
    if (btnCloseAgendaX) {
      btnCloseAgendaX.addEventListener('click', fecharModalFormAgenda);
    }
    if (modalAgendaBackdrop) {
      modalAgendaBackdrop.addEventListener('click', function(e) {
        if (e.target === modalAgendaBackdrop) fecharModalFormAgenda();
      });
    }

    // Modal de Detalhes do Dia
    var btnFecharModal = document.getElementById('btnFecharModalDetalhesDia');
    var btnCloseModalX = document.getElementById('closeModalDetalhesDiaBtn');
    var modalBackdrop = document.getElementById('modalDetalhesDiaCalendario');

    if (btnFecharModal) {
      btnFecharModal.addEventListener('click', fecharModalDetalhesDia);
    }
    if (btnCloseModalX) {
      btnCloseModalX.addEventListener('click', fecharModalDetalhesDia);
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) fecharModalDetalhesDia();
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        fecharModalDetalhesDia();
        fecharModalFormAgenda();
      }
    });
  }

  /**
   * Alterna o ano selecionado
   */
  function setAno(ano) {
    selectedYear = parseInt(ano, 10) || 2026;
    renderizar();
    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Exibindo ' + (selectedYear === 2026 ? '2026 Oficial' : '2027 Planejamento'));
    }
  }

  /**
   * Alterna a aba ativa
   */
  function setTab(tab) {
    activeTab = tab === 'bimestre' ? 'bimestre' : 'mes';
    renderizarTabs();
  }

  /**
   * Altera o mês exibido
   */
  function setMes(mesIndex) {
    selectedMonth = Math.max(0, Math.min(11, mesIndex));
    var sel = document.getElementById('selectMesCalendario');
    if (sel) sel.value = String(selectedMonth);
    renderizarMesView();
  }

  /**
   * Aplica filtro por categoria
   */
  function setFiltro(cat) {
    activeCategory = cat || 'todos';
    var pills = document.querySelectorAll('#calFilterPillsContainer .cal-pill');
    pills.forEach(function(p) {
      if (p.getAttribute('data-category') === activeCategory) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
    renderizarMesView();
  }

  /**
   * Obtém a base de dados do ano selecionado
   */
  function getDadosAtivos() {
    return selectedYear === 2027 ? DADOS_2027 : DADOS_2026;
  }

  /**
   * Renderização mestra do módulo
   */
  function renderizar() {
    var dados = getDadosAtivos();

    // 1. Atualizar Seletor de Ano
    var btn2026 = document.getElementById('btnAno2026');
    var btn2027 = document.getElementById('btnAno2027');
    if (btn2026 && btn2027) {
      if (selectedYear === 2026) {
        btn2026.classList.add('active');
        btn2027.classList.remove('active');
      } else {
        btn2026.classList.remove('active');
        btn2027.classList.add('active');
      }
    }

    // 2. Renderizar KPIs Executivos
    renderizarKpis(dados);

    // 3. Atualizar Contadores dos Filtros
    renderizarContadoresFiltros(dados);

    // 4. Renderizar Abas e Visualizações
    renderizarTabs();
  }

  /**
   * Renderiza os 5 KPIs no topo do painel
   */
  function renderizarKpis(dados) {
    var kpiDias = document.getElementById('calKpiDiasLetivos');
    var kpiDiasMeta = document.getElementById('calKpiDiasLetivosMeta');
    var kpiBimestres = document.getElementById('calKpiBimestres');
    var kpiBimestresMeta = document.getElementById('calKpiBimestresMeta');
    var kpiRecesso = document.getElementById('calKpiRecesso');
    var kpiRecessoMeta = document.getElementById('calKpiRecessoMeta');
    var kpiSabados = document.getElementById('calKpiSabados');
    var kpiSabadosMeta = document.getElementById('calKpiSabadosMeta');
    var kpiMatriculas = document.getElementById('calKpiMatriculas');
    var kpiMatriculasMeta = document.getElementById('calKpiMatriculasMeta');

    if (kpiDias) kpiDias.textContent = String(dados.totalDiasLetivos);
    if (kpiDiasMeta) {
      kpiDiasMeta.textContent = selectedYear === 2026
        ? 'Oficial: 203d (Meta LDB: 200d)'
        : 'Estimado: 202d (Meta LDB: 200d)';
    }

    if (kpiBimestres) kpiBimestres.textContent = String(dados.bimestres.length);
    if (kpiBimestresMeta) {
      var b1 = dados.bimestres[0];
      var b4 = dados.bimestres[dados.bimestres.length - 1];
      kpiBimestresMeta.textContent = formatarDataCurta(b1.dataInicio) + ' a ' + formatarDataCurta(b4.dataFim);
    }

    if (kpiRecesso) kpiRecesso.textContent = String(dados.recesso.dias) + 'd';
    if (kpiRecessoMeta) {
      kpiRecessoMeta.textContent = formatarDataCurta(dados.recesso.dataInicio) + ' a ' + formatarDataCurta(dados.recesso.dataFim);
    }

    // Contagem de sábados letivos
    var totalSabados = 0;
    dados.bimestres.forEach(function(b) {
      totalSabados += (b.sabadosLetivos || []).length;
    });
    if (kpiSabados) kpiSabados.textContent = String(totalSabados);
    if (kpiSabadosMeta) {
      kpiSabadosMeta.textContent = selectedYear === 2026 ? '8 Sábados Temáticos' : '6 Sábados Estimados';
    }

    // Contagem de etapas de matrícula
    var matriculasCount = dados.eventos.filter(function(e) {
      return e.categoria === 'matricula';
    }).length;
    if (kpiMatriculas) kpiMatriculas.textContent = String(matriculasCount || 4);
    if (kpiMatriculasMeta) {
      kpiMatriculasMeta.textContent = 'Renovação, Rede, Novos & NEE';
    }
  }

  /**
   * Atualiza contadores numéricos nas pílulas de filtro
   */
  function renderizarContadoresFiltros(dados) {
    var counts = {
      todos: 0,
      letivo: 0,
      feriado: 0,
      matricula: 0,
      jornada: 0,
      sabado_letivo: 0,
      exame: 0,
      agenda: 0
    };

    var todos = obterTodosEventos(dados);
    todos.forEach(function(ev) {
      counts.todos++;
      if (counts[ev.categoria] !== undefined) {
        counts[ev.categoria]++;
      }
      if (ev.custom || ev.categoria === 'agenda_intersetorial' || ev.categoria === 'reuniao' || ev.categoria === 'capacitacao') {
        counts.agenda++;
      }
    });

    // Atualiza badges
    var map = {
      countFiltroTodos: counts.todos,
      countFiltroLetivos: counts.letivo,
      countFiltroFeriados: counts.feriado,
      countFiltroMatriculas: counts.matricula,
      countFiltroJornadas: counts.jornada,
      countFiltroSabados: counts.sabado_letivo,
      countFiltroExames: counts.exame,
      countFiltroAgenda: counts.agenda
    };

    Object.keys(map).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(map[id]);
    });
  }

  /**
   * Alterna a visibilidade das abas (Mês x Bimestre)
   */
  function renderizarTabs() {
    var viewMes = document.getElementById('calendarioViewMes');
    var viewBimestre = document.getElementById('calendarioViewBimestre');
    var btnTabMes = document.getElementById('btnCalTabMes');
    var btnTabBimestre = document.getElementById('btnCalTabBimestre');

    if (activeTab === 'mes') {
      if (viewMes) {
        viewMes.classList.remove('hidden');
        viewMes.style.display = 'block';
      }
      if (viewBimestre) {
        viewBimestre.classList.add('hidden');
        viewBimestre.style.display = 'none';
      }
      if (btnTabMes) {
        btnTabMes.classList.add('active');
        btnTabMes.setAttribute('aria-selected', 'true');
      }
      if (btnTabBimestre) {
        btnTabBimestre.classList.remove('active');
        btnTabBimestre.setAttribute('aria-selected', 'false');
      }
      renderizarMesView();
    } else {
      if (viewMes) {
        viewMes.classList.add('hidden');
        viewMes.style.display = 'none';
      }
      if (viewBimestre) {
        viewBimestre.classList.remove('hidden');
        viewBimestre.style.display = 'block';
      }
      if (btnTabMes) {
        btnTabMes.classList.remove('active');
        btnTabMes.setAttribute('aria-selected', 'false');
      }
      if (btnTabBimestre) {
        btnTabBimestre.classList.add('active');
        btnTabBimestre.setAttribute('aria-selected', 'true');
      }
      renderizarBimestresView();
    }
  }

  /**
   * Renderiza a visão Mês a Mês (Grade do Calendário e Linha do Tempo)
   */
  function renderizarMesView() {
    var dados = getDadosAtivos();
    var tituloMes = document.getElementById('calTituloMes');
    var subtituloMes = document.getElementById('calSubtituloMes');
    var bannerResumo = document.getElementById('calResumoMes');
    var gridDias = document.getElementById('calGridDias');
    var listaEventos = document.getElementById('calListaEventosMes');

    var nomeMes = MESES_NOMES[selectedMonth];
    var diasLetivosDoMes = dados.diasPorMes[selectedMonth] || 0;

    if (tituloMes) {
      tituloMes.textContent = nomeMes + ' de ' + selectedYear;
    }
    if (subtituloMes) {
      subtituloMes.textContent = diasLetivosDoMes + ' dias letivos no mês • ' + dados.statusDescricao;
    }

    // Banner informativo do mês
    if (bannerResumo) {
      var sabadosNoMes = contarSabadosLetivosNoMes(dados, selectedYear, selectedMonth);
      var feriadosNoMes = contarFeriadosNoMes(dados, selectedYear, selectedMonth);
      var infoHtml = '<div class="cal-summary-card">';
      infoHtml += '  <div class="cal-summary-col"><span class="cal-summary-num">' + diasLetivosDoMes + '</span><span class="cal-summary-lbl">Dias Letivos</span></div>';
      infoHtml += '  <div class="cal-summary-divider"></div>';
      infoHtml += '  <div class="cal-summary-col"><span class="cal-summary-num">' + sabadosNoMes + '</span><span class="cal-summary-lbl">Sábados Letivos</span></div>';
      infoHtml += '  <div class="cal-summary-divider"></div>';
      infoHtml += '  <div class="cal-summary-col"><span class="cal-summary-num">' + feriadosNoMes + '</span><span class="cal-summary-lbl">Feriados / Recessos</span></div>';
      infoHtml += '  <div class="cal-summary-divider"></div>';
      infoHtml += '  <div class="cal-summary-text"><strong>' + nomeMes + '/' + selectedYear + ':</strong> ' + obterDestaqueMes(dados, selectedMonth) + '</div>';
      infoHtml += '</div>';
      bannerResumo.innerHTML = infoHtml;
    }

    // Montagem da grade mensal (7 colunas x N linhas)
    if (gridDias) {
      gridDias.innerHTML = montarGradeDiasHtml(dados, selectedYear, selectedMonth);
      vincularCliquesGradeDias(dados);
    }

    // Linha do tempo dos eventos do mês selecionado
    if (listaEventos) {
      listaEventos.innerHTML = montarListaEventosMesHtml(dados, selectedYear, selectedMonth);
    }
  }

  /**
   * Monta o HTML da grade de dias para o mês especificado
   */
  function montarGradeDiasHtml(dados, ano, mes) {
    var primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 (Dom) a 6 (Sáb)
    var diasNoMes = new Date(ano, mes + 1, 0).getDate();
    var diasMesAnterior = new Date(ano, mes, 0).getDate();

    var html = '';

    // 1. Dias do mês anterior para preencher a primeira semana
    for (var i = primeiroDiaSemana - 1; i >= 0; i--) {
      var diaAnt = diasMesAnterior - i;
      html += '<div class="cal-day-cell fora-mes" data-day="' + diaAnt + '" data-fora="prev">';
      html += '  <div class="cal-day-header"><span class="cal-day-number">' + diaAnt + '</span></div>';
      html += '</div>';
    }

    // 2. Dias do mês atual
    var hoje = new Date();
    var ehMesAtualReal = (hoje.getFullYear() === ano && hoje.getMonth() === mes);
    var diaHojeReal = hoje.getDate();

    for (var dia = 1; dia <= diasNoMes; dia++) {
      var dataStr = ano + '-' + padZero(mes + 1) + '-' + padZero(dia);
      var diaSemana = new Date(ano, mes, dia).getDay();
      var ehFimDeSemana = (diaSemana === 0 || diaSemana === 6);

      // Obter eventos para a data
      var eventosDoDia = obterEventosNaData(dados, dataStr);

      // Se há filtro ativo e a data não possui evento da categoria, verifica se deve ocultar
      var atendeFiltro = true;
      if (activeCategory !== 'todos') {
        atendeFiltro = eventosDoDia.some(function(ev) {
          if (activeCategory === 'agenda_intersetorial') {
            return ev.custom || ev.categoria === 'agenda_intersetorial' || ev.categoria === 'reuniao' || ev.categoria === 'capacitacao';
          }
          return ev.categoria === activeCategory;
        });
      }
      if (atendeFiltro && activeSector !== 'todos') {
        atendeFiltro = eventosDoDia.some(function(ev) {
          return ev.setor && (ev.setor === activeSector || ev.setor.includes(activeSector));
        });
      }

      // Classificação do dia
      var ehLetivo = isDiaLetivo(dados, ano, mes, dia, diaSemana, eventosDoDia);
      var ehSabadoLetivo = diaSemana === 6 && ehLetivo;
      var ehFeriado = eventosDoDia.some(function(ev) { return ev.categoria === 'feriado'; });
      var ehRecesso = isDataNoRecesso(dados, dataStr);
      var ehJornada = eventosDoDia.some(function(ev) { return ev.categoria === 'jornada'; });
      var ehMatricula = eventosDoDia.some(function(ev) { return ev.categoria === 'matricula'; });
      var ehExame = eventosDoDia.some(function(ev) { return ev.categoria === 'exame'; });
      var ehAgenda = eventosDoDia.some(function(ev) {
        return ev.custom || ev.categoria === 'agenda_intersetorial' || ev.categoria === 'reuniao' || ev.categoria === 'capacitacao';
      });

      var classes = ['cal-day-cell'];
      if (!atendeFiltro) classes.push('cal-day-dimmed');
      if (ehMesAtualReal && dia === diaHojeReal) classes.push('hoje');
      if (ehFeriado) classes.push('feriado');
      if (ehRecesso) classes.push('recesso');
      if (ehSabadoLetivo) classes.push('sabado-letivo');
      if (ehJornada) classes.push('jornada');
      if (ehMatricula) classes.push('matricula');
      if (ehExame) classes.push('exame');
      if (ehLetivo && !ehSabadoLetivo) classes.push('letivo');
      if (ehAgenda) classes.push('tem-agenda');
      if (ehFimDeSemana && !ehSabadoLetivo && !ehFeriado && !ehRecesso) classes.push('fim-de-semana');

      html += '<div class="' + classes.join(' ') + '" data-date="' + dataStr + '" tabindex="0" role="button" aria-label="Dia ' + dia + ' de ' + MESES_NOMES[mes] + '">';
      html += '  <div class="cal-day-header">';
      html += '    <span class="cal-day-number">' + dia + '</span>';

      // Badges resumidos no cabeçalho do dia
      if (ehFeriado) {
        html += '    <span class="cal-day-tag feriado" title="Feriado">Feriado</span>';
      } else if (ehRecesso) {
        html += '    <span class="cal-day-tag recesso" title="Recesso Escolar">Recesso</span>';
      } else if (ehSabadoLetivo) {
        html += '    <span class="cal-day-tag sabado" title="Sábado Letivo Temático">Sáb Letivo</span>';
      } else if (ehJornada) {
        html += '    <span class="cal-day-tag jornada" title="Jornada Pedagógica">Jornada</span>';
      } else if (ehMatricula) {
        html += '    <span class="cal-day-tag matricula" title="Matrículas">Matrícula</span>';
      } else if (ehExame) {
        html += '    <span class="cal-day-tag exame" title="Exames Finais">Exame</span>';
      } else if (ehAgenda) {
        html += '    <span class="cal-day-tag agenda" title="Possui compromisso da Agenda Intersetorial">🗓️ Agenda</span>';
      } else if (ehLetivo) {
        html += '    <span class="cal-day-tag letivo" title="Dia Letivo Regular">Letivo</span>';
      }
      html += '  </div>';

      // Ordenar eventos para priorizar visualização de chips da agenda intersetorial
      eventosDoDia.sort(function(a, b) {
        var aPri = (a.custom || a.categoria === 'agenda_intersetorial' || a.categoria === 'reuniao' || a.categoria === 'capacitacao') ? 1 : 0;
        var bPri = (b.custom || b.categoria === 'agenda_intersetorial' || b.categoria === 'reuniao' || b.categoria === 'capacitacao') ? 1 : 0;
        return bPri - aPri;
      });

      // Eventos e chips do dia
      html += '  <div class="cal-day-events">';
      for (var evIdx = 0; evIdx < Math.min(2, eventosDoDia.length); evIdx++) {
        var ev = eventosDoDia[evIdx];
        var isCustomEvt = ev.custom || (typeof ev.id === 'string' && ev.id.indexOf('age_') === 0);
        var icone = ev.icone || (isCustomEvt ? '🗓️' : '📌');
        var tituloCurto = ev.titulo.length > 28 ? ev.titulo.substring(0, 26) + '...' : ev.titulo;
        var chipCategoria = ev.categoria || 'agenda_intersetorial';
        html += '    <div class="cal-event-chip ' + chipCategoria + '" title="' + escapeAttr(ev.titulo + (ev.setor ? ' (' + ev.setor + ')' : '')) + '">';
        html += '      <span class="cal-chip-icon">' + icone + '</span>';
        html += '      <span class="cal-chip-text">' + escapeHtml(tituloCurto) + '</span>';
        html += '    </div>';
      }
      if (eventosDoDia.length > 2) {
        html += '    <div class="cal-event-more">+' + (eventosDoDia.length - 2) + ' mais</div>';
      }
      html += '  </div>';
      html += '</div>';
    }

    // 3. Dias do mês seguinte para completar o grid (múltiplo de 7)
    var totalCelulas = primeiroDiaSemana + diasNoMes;
    var celulasRestantes = (7 - (totalCelulas % 7)) % 7;
    for (var j = 1; j <= celulasRestantes; j++) {
      html += '<div class="cal-day-cell fora-mes" data-day="' + j + '" data-fora="next">';
      html += '  <div class="cal-day-header"><span class="cal-day-number">' + j + '</span></div>';
      html += '</div>';
    }

    return html;
  }

  /**
   * Conecta evento de clique nos dias do calendário
   */
  function vincularCliquesGradeDias(dados) {
    var cells = document.querySelectorAll('#calGridDias .cal-day-cell:not(.fora-mes)');
    cells.forEach(function(cell) {
      cell.addEventListener('click', function() {
        var dataStr = cell.getAttribute('data-date');
        if (dataStr) {
          abrirModalDetalhesDia(dataStr);
        }
      });
      cell.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var dataStr = cell.getAttribute('data-date');
          if (dataStr) abrirModalDetalhesDia(dataStr);
        }
      });
    });
  }

  /**
   * Monta a lista de eventos do mês selecionado
   */
  function montarListaEventosMesHtml(dados, ano, mes) {
    var inicioMesStr = ano + '-' + padZero(mes + 1) + '-01';
    var fimMesStr = ano + '-' + padZero(mes + 1) + '-' + padZero(new Date(ano, mes + 1, 0).getDate());

    var todos = obterTodosEventos(dados);
    var eventosMes = todos.filter(function(ev) {
      // Evento intercepta o mês atual
      return (ev.dataInicio <= fimMesStr && ev.dataFim >= inicioMesStr);
    });

    if (activeSector !== 'todos') {
      eventosMes = eventosMes.filter(function(ev) {
        return !ev.setor || ev.setor === activeSector || ev.setor.includes(activeSector);
      });
    }

    if (activeCategory !== 'todos') {
      eventosMes = eventosMes.filter(function(ev) {
        if (activeCategory === 'agenda_intersetorial') {
          return ev.custom || ev.categoria === 'agenda_intersetorial' || ev.categoria === 'reuniao' || ev.categoria === 'capacitacao';
        }
        return ev.categoria === activeCategory;
      });
    }

    if (eventosMes.length === 0) {
      return '<div class="cal-empty-state"><p>Nenhum evento registrado com os filtros ativos para este mês.</p></div>';
    }

    // Ordena por data de início
    eventosMes.sort(function(a, b) {
      return a.dataInicio.localeCompare(b.dataInicio);
    });

    var html = '<div class="cal-timeline-list">';
    eventosMes.forEach(function(ev) {
      var isCustomEvt = ev.custom || (typeof ev.id === 'string' && ev.id.indexOf('age_') === 0);
      var icone = ev.icone || (isCustomEvt ? '🗓️' : '📅');
      var periodoFormatado = formatarPeriodoEvento(ev.dataInicio, ev.dataFim);

      html += '<div class="cal-timeline-item ' + ev.categoria + '">';
      html += '  <div class="cal-timeline-marker">' + icone + '</div>';
      html += '  <div class="cal-timeline-content">';
      html += '    <div class="cal-timeline-header" style="display:flex; justify-content:space-between; align-items:center;">';
      html += '      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">';
      html += '        <span class="cal-timeline-date">' + periodoFormatado + '</span>';
      html += '        <span class="cal-pill-badge ' + ev.categoria + '">' + formatarCategoriaLabel(ev.categoria) + '</span>';
      if (ev.bimestre) {
        html += '        <span class="cal-pill-badge bimestre">' + ev.bimestre + 'º Bimestre</span>';
      }
      html += '      </div>';
      if (isCustomEvt) {
        html += '      <button type="button" class="btn btn-ghost btn-sm" style="font-size:11px; padding:2px 8px; color:var(--brand-gold);" onclick="window.OlymposViews.calendario.abrirModalFormAgenda(\'' + escapeAttr(ev.id) + '\')">✏️ Editar</button>';
      }
      html += '    </div>';
      html += '    <h5 class="cal-timeline-title">' + escapeHtml(ev.titulo) + '</h5>';
      html += '    <p class="cal-timeline-desc">' + escapeHtml(ev.descricao) + '</p>';
      if (ev.setor || ev.horario || ev.local) {
        html += '    <div class="cal-timeline-meta" style="display:flex; gap:12px; flex-wrap:wrap; font-size:11.5px; color:var(--text-muted);">';
        if (ev.setor) html += '    <div><strong>Setor:</strong> ' + escapeHtml(ev.setor) + '</div>';
        if (ev.horario) html += '    <div><strong>Horário:</strong> ' + escapeHtml(ev.horario) + '</div>';
        if (ev.local) html += '    <div><strong>Local:</strong> ' + escapeHtml(ev.local) + '</div>';
        html += '    </div>';
      }
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';

    return html;
  }

  /**
   * Renderiza a visão por Bimestre (4 cards executivos ricos)
   */
  function renderizarBimestresView() {
    var dados = getDadosAtivos();
    var gridBimestres = document.getElementById('calBimestresGrid');
    if (!gridBimestres) return;

    var html = '';
    dados.bimestres.forEach(function(bim) {
      var percMeta = Math.min(100, Math.round((bim.diasLetivos / (dados.totalDiasLetivos / 4)) * 100));

      html += '<div class="cal-bimestre-card surface-card">';
      html += '  <div class="cal-bim-header">';
      html += '    <div class="cal-bim-title-wrap">';
      html += '      <span class="cal-bim-badge">Bimestre ' + bim.numeroRomano + '</span>';
      html += '      <h3 class="cal-bim-title">' + escapeHtml(bim.titulo) + '</h3>';
      html += '    </div>';
      html += '    <div class="cal-bim-kpi-badge">';
      html += '      <span class="cal-bim-kpi-num">' + bim.diasLetivos + '</span>';
      html += '      <span class="cal-bim-kpi-lbl">dias letivos</span>';
      html += '    </div>';
      html += '  </div>';

      html += '  <div class="cal-bim-periodo">';
      html += '    <span>📅 <strong>Período:</strong> ' + formatarDataExtensa(bim.dataInicio) + ' até ' + formatarDataExtensa(bim.dataFim) + '</span>';
      html += '  </div>';

      html += '  <div class="cal-bim-progress-section">';
      html += '    <div class="cal-bim-progress-meta">';
      html += '      <span>Meta de Dias: ' + bim.diasLetivos + ' dias</span>';
      html += '      <span>' + bim.distribuicaoMeses + '</span>';
      html += '    </div>';
      html += '    <div class="cal-progress-bar">';
      html += '      <div class="cal-progress-fill" style="width: 100%;"></div>';
      html += '    </div>';
      html += '  </div>';

      // Sábados Letivos Temáticos do Bimestre
      if (bim.sabadosLetivos && bim.sabadosLetivos.length > 0) {
        html += '  <div class="cal-bim-sabados">';
        html += '    <div class="cal-bim-section-subtitle">⭐ Sábados Letivos Temáticos</div>';
        html += '    <ul class="cal-bim-list">';
        bim.sabadosLetivos.forEach(function(sab) {
          html += '      <li><strong>' + formatarDataCurta(sab.data) + ':</strong> ' + escapeHtml(sab.tema) + '</li>';
        });
        html += '    </ul>';
        html += '  </div>';
      }

      // Marcos Principais do Bimestre
      if (bim.marcos && bim.marcos.length > 0) {
        html += '  <div class="cal-bim-marcos">';
        html += '    <div class="cal-bim-section-subtitle">📌 Principais Marcos &amp; Prazos</div>';
        html += '    <ul class="cal-bim-list">';
        bim.marcos.forEach(function(marco) {
          html += '      <li>' + escapeHtml(marco) + '</li>';
        });
        html += '    </ul>';
        html += '  </div>';
      }

      html += '  <div class="cal-bim-footer">';
      html += '    <button type="button" class="btn btn-secondary btn-sm btn-ver-bim-mes" data-mes-inicio="' + obterMesDeData(bim.dataInicio) + '">';
      html += '      <span>🔍 Explorar no Calendário Mensal</span>';
      html += '    </button>';
      html += '  </div>';
      html += '</div>';
    });

    gridBimestres.innerHTML = html;

    // Vincula botões de ação dos bimestres
    var btnsVerMes = gridBimestres.querySelectorAll('.btn-ver-bim-mes');
    btnsVerMes.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var mesIdx = parseInt(btn.getAttribute('data-mes-inicio'), 10);
        if (!isNaN(mesIdx)) {
          setTab('mes');
          setMes(mesIdx);
        }
      });
    });
  }

  /**
   * Abre modal detalhado ao clicar em qualquer dia do mês
   */
  function abrirModalDetalhesDia(dataStr) {
    var dados = getDadosAtivos();
    var modal = document.getElementById('modalDetalhesDiaCalendario');
    var tituloEl = document.getElementById('modalDetalhesDiaTitulo');
    var badgeEl = document.getElementById('modalDetalhesDiaBadge');
    var bodyEl = document.getElementById('modalDetalhesDiaBody');

    if (!modal || !bodyEl) return;

    var partes = dataStr.split('-');
    var ano = parseInt(partes[0], 10);
    var mes = parseInt(partes[1], 10) - 1;
    var dia = parseInt(partes[2], 10);
    var dateObj = new Date(ano, mes, dia);
    var diaSemana = dateObj.getDay();

    var eventosDoDia = obterEventosNaData(dados, dataStr);
    var ehLetivo = isDiaLetivo(dados, ano, mes, dia, diaSemana, eventosDoDia);
    var ehSabadoLetivo = (diaSemana === 6 && ehLetivo);
    var ehRecesso = isDataNoRecesso(dados, dataStr);

    // Título e Badge
    if (tituloEl) {
      tituloEl.textContent = dia + ' de ' + MESES_NOMES[mes] + ' de ' + ano + ' (' + DIAS_SEMANA_NOMES[diaSemana] + ')';
    }
    if (badgeEl) {
      badgeEl.textContent = ehLetivo ? '📚 Dia Letivo Homologado' : (ehRecesso ? '🏖️ Recesso Escolar' : '📅 Agenda SMEB');
    }

    var html = '<div class="cal-modal-content-wrap">';

    // Status Legal do Dia
    html += '<div class="cal-modal-status-box ' + (ehLetivo ? 'letivo' : (ehRecesso ? 'recesso' : 'neutro')) + '">';
    html += '  <div class="cal-modal-status-header">';
    html += '    <span class="cal-modal-status-icon">' + (ehLetivo ? '✅' : (ehRecesso ? '🏖️' : 'ℹ️')) + '</span>';
    html += '    <div>';
    html += '      <h4 class="cal-modal-status-title">' + (ehLetivo ? 'Dia Letivo Homologado (Computa p/ os ' + dados.totalDiasLetivos + ' dias)' : 'Dia Não Letivo') + '</h4>';
    html += '      <p class="cal-modal-status-sub">' + (ehSabadoLetivo ? 'Sábado Letivo Temático Homologado' : (ehRecesso ? 'Recesso Escolar Discente' : (diaSemana === 0 || diaSemana === 6 ? 'Fim de Semana Regular' : 'Atividades administrativas / Recesso'))) + '</p>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // Lista de Eventos Cadastrados no Dia
    html += '<div class="cal-modal-events-list">';
    html += '  <h5 class="cal-modal-subtitle">Eventos &amp; Ocorrências nesta Data (' + eventosDoDia.length + ')</h5>';

    if (eventosDoDia.length === 0) {
      html += '  <p class="cal-modal-no-events">Nenhum evento especial registrado para esta data. Atividades escolares de acordo com a rotina letiva.</p>';
    } else {
      eventosDoDia.forEach(function(ev) {
        var isCustom = ev.custom || (typeof ev.id === 'string' && ev.id.indexOf('age_') === 0);
        html += '<div class="cal-modal-event-card ' + ev.categoria + '">';
        html += '  <div class="cal-modal-event-head">';
        html += '    <span class="cal-modal-event-icon">' + (ev.icone || (isCustom ? '🗓️' : '📌')) + '</span>';
        html += '    <div style="flex:1;">';
        html += '      <div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '        <span class="cal-pill-badge ' + ev.categoria + '">' + formatarCategoriaLabel(ev.categoria) + '</span>';
        if (isCustom) {
          html += '        <button type="button" class="btn btn-ghost btn-sm" style="font-size:11px; padding:2px 8px; color:var(--brand-gold);" onclick="window.OlymposViews.calendario.abrirModalFormAgenda(\'' + escapeAttr(ev.id) + '\')">✏️ Editar</button>';
        }
        html += '      </div>';
        html += '      <h5 class="cal-modal-event-title">' + escapeHtml(ev.titulo) + '</h5>';
        html += '    </div>';
        html += '  </div>';
        html += '  <p class="cal-modal-event-desc">' + escapeHtml(ev.descricao) + '</p>';
        html += '  <div class="cal-modal-event-meta">';
        if (ev.setor) {
          html += '    <div><strong>Setor:</strong> ' + escapeHtml(ev.setor) + '</div>';
        }
        if (ev.horario) {
          html += '    <div><strong>Horário:</strong> ' + escapeHtml(ev.horario) + '</div>';
        }
        if (ev.local) {
          html += '    <div><strong>Local:</strong> ' + escapeHtml(ev.local) + '</div>';
        }
        if (ev.bimestre) {
          html += '    <div><strong>Bimestre:</strong> ' + ev.bimestre + 'º Bimestre</div>';
        }
        html += '  </div>';
        html += '</div>';
      });
    }
    html += '</div>';

    // Botão de ação rápida para agendar evento na data inspecionada
    html += '<div style="margin: 12px 0 16px 0; display:flex; justify-content:flex-end;">';
    html += '  <button type="button" class="btn btn-secondary btn-sm" style="font-size:12px; display:inline-flex; align-items:center; gap:6px;" onclick="window.OlymposViews.calendario.abrirModalFormAgenda(\'' + dataStr + '\')">';
    html += '    <span>+ Agendar Evento nesta Data</span>';
    html += '  </button>';
    html += '</div>';

    // Informações Logísticas e Operacionais
    html += '<div class="cal-modal-logistics-box">';
    html += '  <h5 class="cal-modal-subtitle">Impacto Operacional &amp; Logístico</h5>';
    html += '  <div class="cal-modal-logistics-grid">';
    html += '    <div class="cal-log-item"><span class="cal-log-icon">🚌</span><div><strong>Transporte Escolar:</strong> ' + (ehLetivo ? 'Operação Regular em todas as 48 rotas' : 'Suspenso / Rotas especiais se houver evento') + '</div></div>';
    html += '    <div class="cal-log-item"><span class="cal-log-icon">🍲</span><div><strong>Alimentação Escolar:</strong> ' + (ehLetivo ? 'Cardápio padrão nutricional servido nas escolas' : 'Não servido (recesso/feriado)') + '</div></div>';
    html += '    <div class="cal-log-item"><span class="cal-log-icon">🏛️</span><div><strong>Secretaria Municipal:</strong> Expediente normal na SMEB (Gabinete e Diretorias)</div></div>';
    html += '  </div>';
    html += '</div>';

    html += '</div>'; // fim cal-modal-content-wrap

    bodyEl.innerHTML = html;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  /**
   * Fecha o modal de detalhes do dia
   */
  function fecharModalDetalhesDia() {
    var modal = document.getElementById('modalDetalhesDiaCalendario');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  // =========================================================================
  // EXPORTAÇÃO iCAL (.ICS) COMPATÍVEL COM RFC 5545 E GOOGLE CALENDAR
  // =========================================================================

  /**
   * Gera e dispara o download do arquivo .ics do calendário oficial/planejado
   */
  function exportarIcal() {
    var dados = getDadosAtivos();
    var agora = new Date();
    var dtStamp = formatarIcalTimestamp(agora);

    var linhas = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SMEB Ceara-Mirim//Hub Olympos Calendario Escolar//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Calendário Escolar SMEB Ceará-Mirim ' + selectedYear,
      'X-WR-TIMEZONE:America/Fortaleza',
      'X-WR-CALDESC:Calendário Escolar Oficial (' + dados.totalDiasLetivos + ' dias letivos) - Secretaria Municipal de Educação Básica de Ceará-Mirim/RN'
    ];

    var todos = obterTodosEventos(dados);
    todos.forEach(function(ev) {
      var uid = 'evt-' + selectedYear + '-' + ev.id + '@olympos.smeb.cearamirim.rn.gov.br';
      var dtStart = formatarIcalDate(ev.dataInicio);
      var dtEnd = formatarIcalDateFimExclusiva(ev.dataFim || ev.dataInicio);

      linhas.push('BEGIN:VEVENT');
      linhas.push('UID:' + uid);
      linhas.push('DTSTAMP:' + dtStamp);
      linhas.push('DTSTART;VALUE=DATE:' + dtStart);
      linhas.push('DTEND;VALUE=DATE:' + dtEnd);
      linhas.push('SUMMARY:' + sanitizarIcalTexto(ev.titulo));
      var descPartes = [];
      if (ev.descricao) descPartes.push(ev.descricao);
      if (ev.setor) descPartes.push('Responsável: ' + ev.setor);
      if (ev.horario) descPartes.push('Horário: ' + ev.horario);
      if (ev.local) descPartes.push('Local: ' + ev.local);
      linhas.push('DESCRIPTION:' + sanitizarIcalTexto(descPartes.join(' | ')));
      linhas.push('LOCATION:' + sanitizarIcalTexto(ev.local || 'Ceará-Mirim - RN'));
      linhas.push('CATEGORIES:' + sanitizarIcalTexto(formatarCategoriaLabel(ev.categoria) + (ev.setor ? ',' + ev.setor : '')));
      linhas.push('STATUS:CONFIRMED');
      linhas.push('TRANSP:' + (ev.letivo ? 'OPAQUE' : 'TRANSPARENT'));
      linhas.push('END:VEVENT');
    });

    linhas.push('END:VCALENDAR');

    var icsContent = linhas.join('\r\n') + '\r\n';

    try {
      var blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = 'calendario_escolar_smeb_' + selectedYear + '.ics';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Calendário ' + selectedYear + ' exportado com sucesso (.ics)!');
      }
    } catch (err) {
      console.error('[calendario.js] Falha ao exportar iCal:', err);
      if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
        window.OlymposApp.showToast('Erro ao exportar arquivo .ics');
      }
    }
  }

  // =========================================================================
  // MÉTODOS AUXILIARES E REGRAS DE NEGÓCIO DO CALENDÁRIO
  // =========================================================================

  function obterEventosNaData(dados, dataStr) {
    var todos = obterTodosEventos(dados);
    return todos.filter(function(ev) {
      return (ev.dataInicio <= dataStr && ev.dataFim >= dataStr);
    });
  }

  function isDataNoRecesso(dados, dataStr) {
    if (!dados.recesso) return false;
    return (dados.recesso.dataInicio <= dataStr && dados.recesso.dataFim >= dataStr);
  }

  /**
   * Determina com precisão se uma data é considerada dia letivo oficial
   */
  function isDiaLetivo(dados, ano, mes, dia, diaSemana, eventosDoDia) {
    var dataStr = ano + '-' + padZero(mes + 1) + '-' + padZero(dia);

    // 1. Se estiver no recesso escolar discente, NÃO é dia letivo
    if (isDataNoRecesso(dados, dataStr)) {
      return false;
    }

    // 2. Se for feriado ou ponto facultativo, NÃO é dia letivo
    var ehFeriado = eventosDoDia.some(function(ev) {
      return !ev.custom && ev.categoria === 'feriado';
    });
    if (ehFeriado) return false;

    // 3. Se for jornada pedagógica (sem alunos), NÃO é dia letivo de alunos
    var ehJornada = eventosDoDia.some(function(ev) {
      return !ev.custom && ev.categoria === 'jornada';
    });
    if (ehJornada) return false;

    // 4. Se for sábado letivo temático homologado, É dia letivo
    var ehSabadoLetivo = eventosDoDia.some(function(ev) {
      return !ev.custom && ev.categoria === 'sabado_letivo';
    });
    if (ehSabadoLetivo) return true;

    // 5. Domingo e sábados não letivos NÃO são dias letivos
    if (diaSemana === 0 || diaSemana === 6) return false;

    // 6. Verificação do período letivo oficial 2026 (19/02 a 23/12)
    if (ano === 2026) {
      if (dataStr < '2026-02-19') return false;
      if (dataStr > '2026-12-23') return false;
      return true;
    }

    // 7. Verificação do período letivo 2027 (15/02 a 22/12)
    if (ano === 2027) {
      if (dataStr < '2027-02-15') return false;
      if (dataStr > '2027-12-22') return false;
      return true;
    }

    return false;
  }

  function contarSabadosLetivosNoMes(dados, ano, mes) {
    var mesPrefix = ano + '-' + padZero(mes + 1);
    var count = 0;
    dados.eventos.forEach(function(ev) {
      if (ev.categoria === 'sabado_letivo' && ev.dataInicio.indexOf(mesPrefix) === 0) {
        count++;
      }
    });
    return count;
  }

  function contarFeriadosNoMes(dados, ano, mes) {
    var mesPrefix = ano + '-' + padZero(mes + 1);
    var count = 0;
    dados.eventos.forEach(function(ev) {
      if (ev.categoria === 'feriado' && (ev.dataInicio.indexOf(mesPrefix) === 0 || ev.dataFim.indexOf(mesPrefix) === 0)) {
        count++;
      }
    });
    return count;
  }

  function obterDestaqueMes(dados, mes) {
    if (selectedYear === 2026) {
      var destaques2026 = {
        0: 'Período de férias e matrículas (Renovação, Rede, Novos e NEE).',
        1: 'Jornada Pedagógica SMEB e Início das Aulas em 19/02 (7 dias letivos).',
        2: '23 dias letivos com 2 Sábados Letivos Temáticos (Família na Escola e Poesia).',
        3: 'Encerramento do 1º Bimestre (23/04) e Início do 2º Bimestre (24/04).',
        4: '21 dias letivos com Sábado Letivo Temático de Saúde Emocional (09/05).',
        5: 'Semana do Meio Ambiente e Fechamento do 2º Bimestre (25/06). Recesso inicia 29/06.',
        6: 'Recesso Escolar até 13/07. Aulas retornam 13/07 (Início do 3º Bimestre).',
        7: '21 dias letivos com Sábado Letivo Temático do Folclore Potiguar (15/08).',
        8: 'Semana da Pátria e Encerramento do 3º Bimestre (28/09). Início 4º Bim (29/09).',
        9: 'Semana da Criança e Sábado Letivo Temático de Feira de Ciências (24/10).',
        10: 'Sábado Letivo Temático da Consciência Negra e Educação Antirracista (21/11).',
        11: 'Encerramento das Aulas (23/12), Exames Finais e Conselho de Classe Final.'
      };
      return destaques2026[mes] || 'Atividades regulares do calendário escolar.';
    }
    return 'Planejamento preliminar para o exercício de 2027.';
  }

  function formatarCategoriaLabel(cat) {
    var labels = {
      todos: 'Todos os Eventos',
      letivo: 'Dias Letivos',
      feriado: 'Feriados / Recessos',
      matricula: 'Matrículas',
      jornada: 'Jornadas Pedagógicas',
      sabado_letivo: 'Sábados Letivos',
      exame: 'Exames & Avaliações',
      comemorativa: 'Semanas Comemorativas',
      agenda_intersetorial: 'Agenda Intersetorial',
      reuniao: 'Reunião Setorial',
      capacitacao: 'Capacitação / Formação',
      visita_tecnica: 'Visita Técnica',
      audiencia: 'Audiência Pública'
    };
    return labels[cat] || cat;
  }

  function formatarDataCurta(dataIso) {
    if (!dataIso) return '';
    var p = dataIso.split('-');
    return p[2] + '/' + p[1];
  }

  function formatarDataExtensa(dataIso) {
    if (!dataIso) return '';
    var p = dataIso.split('-');
    var d = parseInt(p[2], 10);
    var m = parseInt(p[1], 10) - 1;
    return d + ' de ' + MESES_NOMES[m];
  }

  function formatarPeriodoEvento(inicio, fim) {
    if (!inicio) return '';
    if (inicio === fim || !fim) {
      return formatarDataExtensa(inicio);
    }
    return formatarDataCurta(inicio) + ' a ' + formatarDataCurta(fim);
  }

  function obterMesDeData(dataIso) {
    if (!dataIso) return 0;
    var partes = dataIso.split('-');
    return parseInt(partes[1], 10) - 1;
  }

  function padZero(num) {
    return num < 10 ? '0' + num : String(num);
  }

  function formatarIcalDate(dataIso) {
    return dataIso.replace(/-/g, '');
  }

  function formatarIcalDateFimExclusiva(dataIso) {
    // RFC 5545 requer que DTEND para eventos de dia inteiro seja o dia seguinte à data final inclusiva
    var partes = dataIso.split('-');
    var ano = parseInt(partes[0], 10);
    var mes = parseInt(partes[1], 10) - 1;
    var dia = parseInt(partes[2], 10);
    var nextDay = new Date(ano, mes, dia + 1);
    var y = nextDay.getFullYear();
    var m = padZero(nextDay.getMonth() + 1);
    var d = padZero(nextDay.getDate());
    return '' + y + m + d;
  }

  function formatarIcalTimestamp(d) {
    return '' + d.getUTCFullYear() +
      padZero(d.getUTCMonth() + 1) +
      padZero(d.getUTCDate()) + 'T' +
      padZero(d.getUTCHours()) +
      padZero(d.getUTCMinutes()) +
      padZero(d.getUTCSeconds()) + 'Z';
  }

  function sanitizarIcalTexto(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // =========================================================================
  // API PÚBLICA EXPOSTA
  // =========================================================================

  return {
    init: init,
    setAno: setAno,
    setTab: setTab,
    setFiltro: setFiltro,
    setMes: setMes,
    setSetor: setSetor,
    exportarIcal: exportarIcal,
    abrirModalDetalhesDia: abrirModalDetalhesDia,
    fecharModalDetalhesDia: fecharModalDetalhesDia,
    abrirModalFormAgenda: abrirModalFormAgenda,
    fecharModalFormAgenda: fecharModalFormAgenda,
    salvarEventoAgenda: salvarEventoAgenda,
    excluirEventoAgenda: excluirEventoAgenda,
    obterEventosAgendaCustom: obterEventosAgendaCustom,
    getDadosAno: function(ano) {
      return (ano === 2027) ? DADOS_2027 : DADOS_2026;
    }
  };
})();
