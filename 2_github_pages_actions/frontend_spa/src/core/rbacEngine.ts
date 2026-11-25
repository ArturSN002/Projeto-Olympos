/**
 * Hub Olympos — Onda 7: Motor Dinâmico de RBAC, 10 Setores e Matriz 9x45
 * Fonte única de verdade no frontend com fallback determinístico caso as
 * migrations 038–041 ainda não tenham sido aplicadas no projeto remoto.
 */

export type SetorCodigo =
  | 'MODERADOR'
  | 'GABINETE'
  | 'PEDAGOGICO'
  | 'ADMINISTRATIVO'
  | 'JURIDICO'
  | 'NUTRICAO'
  | 'RECURSOS_HUMANOS'
  | 'TRANSPORTE_ESCOLAR'
  | 'FINANCEIRO_TESOURARIA'
  | 'ENGENHARIA';

export type CargoSetor = 'MODERADOR' | 'ENCARREGADO' | 'MEMBRO';

export interface SetorInfo {
  codigo: SetorCodigo;
  nome: string;
  siglaOficio: string;
  legacyRole: string;
  mfaObrigatorioSempre: boolean;
  mfaObrigatorioEncarregado: boolean;
  pisoOficio2026: number;
  tipoNumeracao: 'GLOBAL' | 'PROPRIO';
  corHex: string;
}

export interface PermissaoCatalogoItem {
  codigo: string;
  grupo: string;
  rotulo: string;
  descricao: string;
  rotaPagina: string | null;
  exclusivoGabinete: boolean;
  somenteModerador: boolean;
  requerAal2: boolean;
  ordem: number;
}

export interface ContextoAcessoAtual {
  autenticado: boolean;
  ativo: boolean;
  setorCodigo: SetorCodigo | null;
  setorNome: string;
  siglaOficio: string;
  cargoSetor: CargoSetor | null;
  roleLegado: string;
  requerMfa: boolean;
  isModerador: boolean;
  isGabinete: boolean;
  isEncarregado: boolean;
  permissoes: string[];
  paginasPermitidas: string[];
  origem: 'rpc' | 'fallback_legado' | 'visitante';
}

export const SETORES_ORGANIZACIONAIS: SetorInfo[] = [
  {
    codigo: 'MODERADOR',
    nome: 'Moderador do Sistema',
    siglaOficio: 'MOD',
    legacyRole: 'MODERADOR',
    mfaObrigatorioSempre: true,
    mfaObrigatorioEncarregado: true,
    pisoOficio2026: 1,
    tipoNumeracao: 'GLOBAL',
    corHex: '#8b5cf6'
  },
  {
    codigo: 'GABINETE',
    nome: 'Gabinete da Secretaria',
    siglaOficio: 'GS',
    legacyRole: 'ADMIN_GABINETE',
    mfaObrigatorioSempre: true,
    mfaObrigatorioEncarregado: true,
    pisoOficio2026: 155,
    tipoNumeracao: 'PROPRIO',
    corHex: '#c99738'
  },
  {
    codigo: 'PEDAGOGICO',
    nome: 'Setor Pedagógico',
    siglaOficio: 'PED',
    legacyRole: 'PEDAGOGICO_EVENTOS',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: false,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#10b981'
  },
  {
    codigo: 'ADMINISTRATIVO',
    nome: 'Setor Administrativo',
    siglaOficio: 'ADM',
    legacyRole: 'PEDAGOGICO_EVENTOS',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: false,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#0ea5e9'
  },
  {
    codigo: 'JURIDICO',
    nome: 'Assessoria Jurídica',
    siglaOficio: 'JUR',
    legacyRole: 'JURIDICO',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: true,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#3b82f6'
  },
  {
    codigo: 'NUTRICAO',
    nome: 'Setor de Nutrição',
    siglaOficio: 'NUT',
    legacyRole: 'PEDAGOGICO_EVENTOS',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: false,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#84cc16'
  },
  {
    codigo: 'RECURSOS_HUMANOS',
    nome: 'Setor de Recursos Humanos',
    siglaOficio: 'RH',
    legacyRole: 'RH_COMISSAO',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: true,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#f59e0b'
  },
  {
    codigo: 'TRANSPORTE_ESCOLAR',
    nome: 'Setor de Transporte Escolar',
    siglaOficio: 'TRANS',
    legacyRole: 'PEDAGOGICO_EVENTOS',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: false,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#06b6d4'
  },
  {
    codigo: 'FINANCEIRO_TESOURARIA',
    nome: 'Setor Financeiro e Tesouraria',
    siglaOficio: 'FIN',
    legacyRole: 'PEDAGOGICO_EVENTOS',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: true,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#6366f1'
  },
  {
    codigo: 'ENGENHARIA',
    nome: 'Setor de Engenharia',
    siglaOficio: 'ENG',
    legacyRole: 'PEDAGOGICO_EVENTOS',
    mfaObrigatorioSempre: false,
    mfaObrigatorioEncarregado: false,
    pisoOficio2026: 1,
    tipoNumeracao: 'PROPRIO',
    corHex: '#f97316'
  }
];

export const SETORES_MAP: Record<string, SetorInfo> = Object.fromEntries(
  SETORES_ORGANIZACIONAIS.map((s) => [s.codigo, s])
);

export const PUBLIC_PAGES = ['visao-geral', 'diario-oficial', 'escolas', 'oraculo'];

export const CATALOGO_PERMISSOES: PermissaoCatalogoItem[] = [
  { codigo: 'visao_geral.ver', grupo: 'Visão Geral & TV', rotulo: 'Visualizar Visão Geral', descricao: 'Acesso aos painéis da tela inicial', rotaPagina: 'visao-geral', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 1 },
  { codigo: 'noticias.atualizar', grupo: 'Visão Geral & TV', rotulo: 'Atualizar Notícias Municipais', descricao: 'Dispara atualização manual de notícias', rotaPagina: 'visao-geral', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 2 },
  { codigo: 'kiosk.ver', grupo: 'Visão Geral & TV', rotulo: 'Acessar Modo TV (Kiosk 16:9)', descricao: 'Exibe painel executivo de TV sem dados pessoais', rotaPagina: 'kiosk', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 3 },

  { codigo: 'oficios.ver', grupo: 'Ofícios Setoriais', rotulo: 'Visualizar Ofícios do Setor', descricao: 'Acessa emissor e acervo de ofícios do próprio setor', rotaPagina: 'oficios', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 4 },
  { codigo: 'oficios.emitir', grupo: 'Ofícios Setoriais', rotulo: 'Emitir Ofícios no Google Docs', descricao: 'Gera ofícios oficiais PR/2018 na sequência do setor', rotaPagina: 'oficios', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 5 },
  { codigo: 'oficios.reservar_ajustar', grupo: 'Ofícios Setoriais', rotulo: 'Reservar / Ajustar Nº de Ofício', descricao: 'Reserva numeração ou ajusta próximo nº do setor', rotaPagina: 'oficios', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 6 },
  { codigo: 'oficios.ver_todos_setores', grupo: 'Ofícios Setoriais', rotulo: 'Ver Ofícios de Todos Setores', descricao: 'Visualiza e filtra ofícios de todos os 9 setores', rotaPagina: 'oficios', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 7 },

  { codigo: 'portarias.ver', grupo: 'Portarias & Licenças', rotulo: 'Visualizar Portarias', descricao: 'Acesso à página de Portarias e acervo oficial', rotaPagina: 'portarias', exclusivoGabinete: true, somenteModerador: false, requerAal2: true, ordem: 8 },
  { codigo: 'portarias.numerar_reservar', grupo: 'Portarias & Licenças', rotulo: 'Reservar / Ajustar Portaria', descricao: 'Reserva ou ajusta numeração oficial de portarias', rotaPagina: 'portarias', exclusivoGabinete: true, somenteModerador: false, requerAal2: true, ordem: 9 },
  { codigo: 'portarias.emitir_lote', grupo: 'Portarias & Licenças', rotulo: 'Emitir Portarias em Lote', descricao: 'Executa Pincel de Homero / Lote Inteligente', rotaPagina: 'portarias', exclusivoGabinete: true, somenteModerador: false, requerAal2: true, ordem: 10 },
  { codigo: 'portarias.licencas_cadastrar', grupo: 'Portarias & Licenças', rotulo: 'Cadastrar Licenças', descricao: 'Registra licenças prêmio, sem remuneração e anulações', rotaPagina: 'licencas', exclusivoGabinete: true, somenteModerador: false, requerAal2: true, ordem: 11 },
  { codigo: 'portarias.acervo_sincronizar', grupo: 'Portarias & Licenças', rotulo: 'Sincronizar Acervo Portarias', descricao: 'Dispara indexação incremental das pastas de portarias', rotaPagina: 'portarias', exclusivoGabinete: true, somenteModerador: false, requerAal2: true, ordem: 12 },

  { codigo: 'certificados.ver', grupo: 'Certificados & Relatórios', rotulo: 'Visualizar Certificados', descricao: 'Acessa Lira de Orfeu e lista de participantes', rotaPagina: 'certificados', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 13 },
  { codigo: 'certificados.operar', grupo: 'Certificados & Relatórios', rotulo: 'Gerar PDFs e Enviar E-mails', descricao: 'Cria abas, higieniza, gera ZIPs e dispara e-mails', rotaPagina: 'certificados', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 14 },
  { codigo: 'relatorios.ver', grupo: 'Certificados & Relatórios', rotulo: 'Visualizar Relatórios Mensais', descricao: 'Consulta prestação de contas mensal consolidada', rotaPagina: 'relatorios', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 15 },
  { codigo: 'relatorios.exportar', grupo: 'Certificados & Relatórios', rotulo: 'Exportar Relatórios PDF/XLSX', descricao: 'Exporta relatórios vetoriais PDF e planilhas XLSX', rotaPagina: 'relatorios', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 16 },

  { codigo: 'chamados.ver', grupo: 'Agenda & Pendências', rotulo: 'Visualizar Pendências', descricao: 'Acessa fila e Kanban de pendências do setor', rotaPagina: 'chamados', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 17 },
  { codigo: 'chamados.criar', grupo: 'Agenda & Pendências', rotulo: 'Criar Pendência Interna', descricao: 'Registra novas solicitações e pendências', rotaPagina: 'chamados', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 18 },
  { codigo: 'chamados.gerir', grupo: 'Agenda & Pendências', rotulo: 'Assumir / Despachar Pendências', descricao: 'Movimenta Kanban, comenta, vincula ofício e finaliza', rotaPagina: 'chamados', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 19 },
  { codigo: 'calendario.ver', grupo: 'Agenda & Pendências', rotulo: 'Visualizar Calendário', descricao: 'Acessa calendário letivo e agenda intersetorial', rotaPagina: 'calendario', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 20 },
  { codigo: 'calendario.criar_editar', grupo: 'Agenda & Pendências', rotulo: 'Criar / Editar Eventos Agenda', descricao: 'Cadastra, edita e conclui eventos na agenda', rotaPagina: 'calendario', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 21 },
  { codigo: 'calendario.excluir', grupo: 'Agenda & Pendências', rotulo: 'Excluir Eventos da Agenda', descricao: 'Remove eventos customizados do calendário', rotaPagina: 'calendario', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 22 },

  { codigo: 'servidores.ver', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Consultar Servidores (Zero-PII)', descricao: 'Pesquisa cadastro funcional sem dados pessoais cifrados', rotaPagina: 'servidores', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 23 },
  { codigo: 'servidores.revelar_pii', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Revelar PII Servidor (LGPD)', descricao: 'Decifra CPF/matrícula mediante justificativa auditada', rotaPagina: 'servidores', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 24 },
  { codigo: 'servidores.exportar', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Exportar Quadro de Servidores', descricao: 'Exporta listagens CSV/JSON e impressão funcional', rotaPagina: 'servidores', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 25 },
  { codigo: 'permutas.ver', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Visualizar Permutas & Vínculos', descricao: 'Acessa Papiro de Cadmo, Hera e Cruzador CF Art. 37', rotaPagina: 'papiro-cadmo', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 26 },
  { codigo: 'permutas.gerir', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Gerir Permutas e Coleta ETL', descricao: 'Cadastra permutas, secretarias parceiras e aciona ETL', rotaPagina: 'papiro-cadmo', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 27 },
  { codigo: 'pss.ver', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Visualizar PSS (Motor Niké)', descricao: 'Consulta editais, inscrições e fila viva de PSS', rotaPagina: 'processos-seletivos', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 28 },
  { codigo: 'pss.gerir', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Gerir Fases e Convocações PSS', descricao: 'Importa lotes, avalia, julga recursos e publica editais', rotaPagina: 'processos-seletivos', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 29 },
  { codigo: 'pss.revelar_pii', grupo: 'Pessoas, Permutas & PSS', rotulo: 'Revelar PII Candidato PSS', descricao: 'Decifra CPF/contato de candidato PSS com trilha LGPD', rotaPagina: 'processos-seletivos', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 30 },

  { codigo: 'mural.ver', grupo: 'Comunicação, Diário & Território', rotulo: 'Visualizar Mural Institucional', descricao: 'Lê comunicados no Mural e confirma ciência', rotaPagina: 'mural', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 31 },
  { codigo: 'mural.publicar', grupo: 'Comunicação, Diário & Território', rotulo: 'Publicar no Mural', descricao: 'Cria novos comunicados setoriais ou gerais no Mural', rotaPagina: 'mural', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 32 },
  { codigo: 'mural.moderar', grupo: 'Comunicação, Diário & Território', rotulo: 'Moderar / Fixar / Kiosk Mural', descricao: 'Fixa comunicados, envia ao Modo TV e arquiva publicações', rotaPagina: 'mural', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 33 },
  { codigo: 'chat.usar', grupo: 'Comunicação, Diário & Território', rotulo: 'Usar Chat Interno', descricao: 'Troca mensagens 1-a-1 e participa de grupos do setor', rotaPagina: 'chat', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 34 },
  { codigo: 'chat.criar_grupo', grupo: 'Comunicação, Diário & Território', rotulo: 'Criar Grupos no Chat', descricao: 'Cria novas salas/grupos setoriais no Chat Interno', rotaPagina: 'chat', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 35 },
  { codigo: 'diario_oficial.gerir', grupo: 'Comunicação, Diário & Território', rotulo: 'Gerir Fogo de Prometheus FEMURN', descricao: 'Aciona coleta manual, resumo e config boletim e-mail', rotaPagina: 'diario-oficial', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 36 },
  { codigo: 'escolas.editar', grupo: 'Comunicação, Diário & Território', rotulo: 'Cadastrar / Editar Escolas', descricao: 'Cria/edita unidades escolares e importa JSON no mapa', rotaPagina: 'escolas', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 37 },
  { codigo: 'busca.usar', grupo: 'Comunicação, Diário & Território', rotulo: 'Buscar no Acervo Drive', descricao: 'Realiza busca recursiva nas pastas 2025–2026 do Drive', rotaPagina: 'busca', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 38 },
  { codigo: 'oraculo.privado', grupo: 'Comunicação, Diário & Território', rotulo: 'Consultar Oráculo Interno', descricao: 'Acessa chunks internos autorizados no Oráculo Semântico', rotaPagina: 'oraculo', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 39 },

  { codigo: 'ajustes.conexao', grupo: 'Governança & Sistema', rotulo: 'Acessar Ajustes & Aparência', descricao: 'Acesso às abas Conexão, Oráculo e Tema Visual', rotaPagina: 'configuracoes', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 40 },
  { codigo: 'memorias.ler', grupo: 'Governança & Sistema', rotulo: 'Ler Memórias Google Docs', descricao: 'Visualiza diretrizes das 22 memórias operacionais', rotaPagina: 'personas', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 41 },
  { codigo: 'memorias.editar', grupo: 'Governança & Sistema', rotulo: 'Editar Memórias & Snapshots', descricao: 'Edita memórias Google Docs, compacta e restaura Dédalo', rotaPagina: 'personas', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 42 },
  { codigo: 'automacoes.gerir', grupo: 'Governança & Sistema', rotulo: 'Gerir Automações & Telegram', descricao: 'Configura boletins e vínculos operacionais do Telegram', rotaPagina: 'configuracoes', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 43 },
  { codigo: 'auditoria.ver', grupo: 'Governança & Sistema', rotulo: 'Visualizar Auditoria & Saúde DR', descricao: 'Acessa audit_logs imutáveis e backups DR', rotaPagina: 'auditoria', exclusivoGabinete: false, somenteModerador: false, requerAal2: true, ordem: 44 },
  { codigo: 'usuarios.gerir', grupo: 'Governança & Sistema', rotulo: 'Gerenciar Usuários & Matriz', descricao: 'Acesso exclusivo do Moderador para usuários e permissões', rotaPagina: 'configuracoes', exclusivoGabinete: false, somenteModerador: true, requerAal2: true, ordem: 45 },

  { codigo: 'inventario.ver', grupo: 'Patrimônio & Almoxarifado', rotulo: 'Visualizar Inventário & Estoque', descricao: 'Consulta bens tombados, consumíveis, lotes, histórico e etiquetas QR', rotaPagina: 'inventario', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 46 },
  { codigo: 'inventario.cadastrar', grupo: 'Patrimônio & Almoxarifado', rotulo: 'Cadastrar Entradas no Depósito', descricao: 'Registra chegada de lotes unitários (códigos únicos) e consumíveis no depósito', rotaPagina: 'inventario', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 47 },
  { codigo: 'inventario.movimentar', grupo: 'Patrimônio & Almoxarifado', rotulo: 'Movimentar Itens, Drive & Termos', descricao: 'Registra saídas para escolas/setores, transferências, fotos Drive e Termo Docs', rotaPagina: 'inventario', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 48 },
  { codigo: 'inventario.baixar_ajustar', grupo: 'Patrimônio & Almoxarifado', rotulo: 'Baixar Itens / Ajustar Cadastro', descricao: 'Realiza baixa patrimonial, edição estrutural e ajustes críticos de estoque', rotaPagina: 'inventario', exclusivoGabinete: false, somenteModerador: false, requerAal2: false, ordem: 49 }
];

const MATRIZ_SEEDS: Array<[SetorCodigo, string, boolean, boolean]> = [
  ['GABINETE', 'visao_geral.ver', true, true],
  ['PEDAGOGICO', 'visao_geral.ver', true, true],
  ['ADMINISTRATIVO', 'visao_geral.ver', true, true],
  ['JURIDICO', 'visao_geral.ver', true, true],
  ['NUTRICAO', 'visao_geral.ver', true, true],
  ['RECURSOS_HUMANOS', 'visao_geral.ver', true, true],
  ['TRANSPORTE_ESCOLAR', 'visao_geral.ver', true, true],
  ['FINANCEIRO_TESOURARIA', 'visao_geral.ver', true, true],
  ['ENGENHARIA', 'visao_geral.ver', true, true],

  ['GABINETE', 'noticias.atualizar', true, false],
  ['ADMINISTRATIVO', 'noticias.atualizar', true, false],

  ['GABINETE', 'kiosk.ver', true, true],
  ['PEDAGOGICO', 'kiosk.ver', true, false],
  ['ADMINISTRATIVO', 'kiosk.ver', true, false],
  ['JURIDICO', 'kiosk.ver', true, false],
  ['RECURSOS_HUMANOS', 'kiosk.ver', true, false],

  ['GABINETE', 'oficios.ver', true, true],
  ['PEDAGOGICO', 'oficios.ver', true, true],
  ['ADMINISTRATIVO', 'oficios.ver', true, true],
  ['JURIDICO', 'oficios.ver', true, true],
  ['NUTRICAO', 'oficios.ver', true, true],
  ['RECURSOS_HUMANOS', 'oficios.ver', true, true],
  ['TRANSPORTE_ESCOLAR', 'oficios.ver', true, true],
  ['FINANCEIRO_TESOURARIA', 'oficios.ver', true, true],
  ['ENGENHARIA', 'oficios.ver', true, true],

  ['GABINETE', 'oficios.emitir', true, true],
  ['PEDAGOGICO', 'oficios.emitir', true, true],
  ['ADMINISTRATIVO', 'oficios.emitir', true, true],
  ['JURIDICO', 'oficios.emitir', true, true],
  ['NUTRICAO', 'oficios.emitir', true, true],
  ['RECURSOS_HUMANOS', 'oficios.emitir', true, true],
  ['TRANSPORTE_ESCOLAR', 'oficios.emitir', true, true],
  ['FINANCEIRO_TESOURARIA', 'oficios.emitir', true, true],
  ['ENGENHARIA', 'oficios.emitir', true, true],

  ['GABINETE', 'oficios.reservar_ajustar', true, false],
  ['PEDAGOGICO', 'oficios.reservar_ajustar', true, false],
  ['ADMINISTRATIVO', 'oficios.reservar_ajustar', true, false],
  ['JURIDICO', 'oficios.reservar_ajustar', true, false],
  ['NUTRICAO', 'oficios.reservar_ajustar', true, false],
  ['RECURSOS_HUMANOS', 'oficios.reservar_ajustar', true, false],
  ['TRANSPORTE_ESCOLAR', 'oficios.reservar_ajustar', true, false],
  ['FINANCEIRO_TESOURARIA', 'oficios.reservar_ajustar', true, false],
  ['ENGENHARIA', 'oficios.reservar_ajustar', true, false],

  ['GABINETE', 'portarias.ver', true, true],
  ['GABINETE', 'portarias.numerar_reservar', true, false],
  ['GABINETE', 'portarias.emitir_lote', true, true],
  ['GABINETE', 'portarias.licencas_cadastrar', true, true],
  ['GABINETE', 'portarias.acervo_sincronizar', true, true],

  ['GABINETE', 'certificados.ver', true, true],
  ['PEDAGOGICO', 'certificados.ver', true, true],
  ['GABINETE', 'certificados.operar', true, true],
  ['PEDAGOGICO', 'certificados.operar', true, true],

  ['GABINETE', 'relatorios.ver', true, true],
  ['PEDAGOGICO', 'relatorios.ver', true, true],
  ['ADMINISTRATIVO', 'relatorios.ver', true, true],
  ['JURIDICO', 'relatorios.ver', true, true],
  ['NUTRICAO', 'relatorios.ver', true, false],
  ['RECURSOS_HUMANOS', 'relatorios.ver', true, true],
  ['TRANSPORTE_ESCOLAR', 'relatorios.ver', true, false],
  ['FINANCEIRO_TESOURARIA', 'relatorios.ver', true, true],
  ['ENGENHARIA', 'relatorios.ver', true, false],

  ['GABINETE', 'relatorios.exportar', true, false],
  ['PEDAGOGICO', 'relatorios.exportar', true, false],
  ['ADMINISTRATIVO', 'relatorios.exportar', true, false],
  ['JURIDICO', 'relatorios.exportar', true, false],
  ['NUTRICAO', 'relatorios.exportar', true, false],
  ['RECURSOS_HUMANOS', 'relatorios.exportar', true, false],
  ['TRANSPORTE_ESCOLAR', 'relatorios.exportar', true, false],
  ['FINANCEIRO_TESOURARIA', 'relatorios.exportar', true, false],
  ['ENGENHARIA', 'relatorios.exportar', true, false],

  ['GABINETE', 'chamados.ver', true, true],
  ['PEDAGOGICO', 'chamados.ver', true, true],
  ['ADMINISTRATIVO', 'chamados.ver', true, true],
  ['JURIDICO', 'chamados.ver', true, true],
  ['NUTRICAO', 'chamados.ver', true, true],
  ['RECURSOS_HUMANOS', 'chamados.ver', true, true],
  ['TRANSPORTE_ESCOLAR', 'chamados.ver', true, true],
  ['FINANCEIRO_TESOURARIA', 'chamados.ver', true, true],
  ['ENGENHARIA', 'chamados.ver', true, true],

  ['GABINETE', 'chamados.criar', true, true],
  ['PEDAGOGICO', 'chamados.criar', true, true],
  ['ADMINISTRATIVO', 'chamados.criar', true, true],
  ['JURIDICO', 'chamados.criar', true, true],
  ['NUTRICAO', 'chamados.criar', true, true],
  ['RECURSOS_HUMANOS', 'chamados.criar', true, true],
  ['TRANSPORTE_ESCOLAR', 'chamados.criar', true, true],
  ['FINANCEIRO_TESOURARIA', 'chamados.criar', true, true],
  ['ENGENHARIA', 'chamados.criar', true, true],

  ['GABINETE', 'chamados.gerir', true, true],
  ['PEDAGOGICO', 'chamados.gerir', true, false],
  ['ADMINISTRATIVO', 'chamados.gerir', true, true],
  ['JURIDICO', 'chamados.gerir', true, false],
  ['NUTRICAO', 'chamados.gerir', true, false],
  ['RECURSOS_HUMANOS', 'chamados.gerir', true, true],
  ['TRANSPORTE_ESCOLAR', 'chamados.gerir', true, false],
  ['FINANCEIRO_TESOURARIA', 'chamados.gerir', true, false],
  ['ENGENHARIA', 'chamados.gerir', true, false],

  ['GABINETE', 'calendario.ver', true, true],
  ['PEDAGOGICO', 'calendario.ver', true, true],
  ['ADMINISTRATIVO', 'calendario.ver', true, true],
  ['JURIDICO', 'calendario.ver', true, true],
  ['NUTRICAO', 'calendario.ver', true, true],
  ['RECURSOS_HUMANOS', 'calendario.ver', true, true],
  ['TRANSPORTE_ESCOLAR', 'calendario.ver', true, true],
  ['FINANCEIRO_TESOURARIA', 'calendario.ver', true, true],
  ['ENGENHARIA', 'calendario.ver', true, true],

  ['GABINETE', 'calendario.criar_editar', true, true],
  ['PEDAGOGICO', 'calendario.criar_editar', true, true],
  ['ADMINISTRATIVO', 'calendario.criar_editar', true, true],
  ['JURIDICO', 'calendario.criar_editar', true, false],
  ['NUTRICAO', 'calendario.criar_editar', true, false],
  ['RECURSOS_HUMANOS', 'calendario.criar_editar', true, true],
  ['TRANSPORTE_ESCOLAR', 'calendario.criar_editar', true, false],
  ['FINANCEIRO_TESOURARIA', 'calendario.criar_editar', true, false],
  ['ENGENHARIA', 'calendario.criar_editar', true, false],

  ['GABINETE', 'calendario.excluir', true, false],
  ['PEDAGOGICO', 'calendario.excluir', true, false],
  ['ADMINISTRATIVO', 'calendario.excluir', true, false],

  ['GABINETE', 'servidores.ver', true, true],
  ['PEDAGOGICO', 'servidores.ver', true, true],
  ['ADMINISTRATIVO', 'servidores.ver', true, true],
  ['JURIDICO', 'servidores.ver', true, true],
  ['RECURSOS_HUMANOS', 'servidores.ver', true, true],
  ['FINANCEIRO_TESOURARIA', 'servidores.ver', true, true],

  ['GABINETE', 'servidores.revelar_pii', true, false],
  ['JURIDICO', 'servidores.revelar_pii', true, false],
  ['RECURSOS_HUMANOS', 'servidores.revelar_pii', true, false],
  ['FINANCEIRO_TESOURARIA', 'servidores.revelar_pii', true, false],

  ['GABINETE', 'servidores.exportar', true, false],
  ['JURIDICO', 'servidores.exportar', true, false],
  ['RECURSOS_HUMANOS', 'servidores.exportar', true, true],
  ['FINANCEIRO_TESOURARIA', 'servidores.exportar', true, false],

  ['GABINETE', 'permutas.ver', true, true],
  ['JURIDICO', 'permutas.ver', true, true],
  ['RECURSOS_HUMANOS', 'permutas.ver', true, true],
  ['GABINETE', 'permutas.gerir', true, false],
  ['RECURSOS_HUMANOS', 'permutas.gerir', true, true],

  ['GABINETE', 'pss.ver', true, true],
  ['JURIDICO', 'pss.ver', true, true],
  ['RECURSOS_HUMANOS', 'pss.ver', true, true],
  ['GABINETE', 'pss.gerir', true, false],
  ['RECURSOS_HUMANOS', 'pss.gerir', true, true],
  ['GABINETE', 'pss.revelar_pii', true, false],
  ['JURIDICO', 'pss.revelar_pii', true, false],
  ['RECURSOS_HUMANOS', 'pss.revelar_pii', true, false],

  ['GABINETE', 'mural.ver', true, true],
  ['PEDAGOGICO', 'mural.ver', true, true],
  ['ADMINISTRATIVO', 'mural.ver', true, true],
  ['JURIDICO', 'mural.ver', true, true],
  ['NUTRICAO', 'mural.ver', true, true],
  ['RECURSOS_HUMANOS', 'mural.ver', true, true],
  ['TRANSPORTE_ESCOLAR', 'mural.ver', true, true],
  ['FINANCEIRO_TESOURARIA', 'mural.ver', true, true],
  ['ENGENHARIA', 'mural.ver', true, true],

  ['GABINETE', 'mural.publicar', true, true],
  ['PEDAGOGICO', 'mural.publicar', true, true],
  ['ADMINISTRATIVO', 'mural.publicar', true, true],
  ['JURIDICO', 'mural.publicar', true, true],
  ['NUTRICAO', 'mural.publicar', true, true],
  ['RECURSOS_HUMANOS', 'mural.publicar', true, true],
  ['TRANSPORTE_ESCOLAR', 'mural.publicar', true, true],
  ['FINANCEIRO_TESOURARIA', 'mural.publicar', true, true],
  ['ENGENHARIA', 'mural.publicar', true, true],

  ['GABINETE', 'mural.moderar', true, false],

  ['GABINETE', 'chat.usar', true, true],
  ['PEDAGOGICO', 'chat.usar', true, true],
  ['ADMINISTRATIVO', 'chat.usar', true, true],
  ['JURIDICO', 'chat.usar', true, true],
  ['NUTRICAO', 'chat.usar', true, true],
  ['RECURSOS_HUMANOS', 'chat.usar', true, true],
  ['TRANSPORTE_ESCOLAR', 'chat.usar', true, true],
  ['FINANCEIRO_TESOURARIA', 'chat.usar', true, true],
  ['ENGENHARIA', 'chat.usar', true, true],

  ['GABINETE', 'chat.criar_grupo', true, false],
  ['PEDAGOGICO', 'chat.criar_grupo', true, false],
  ['ADMINISTRATIVO', 'chat.criar_grupo', true, false],
  ['JURIDICO', 'chat.criar_grupo', true, false],
  ['NUTRICAO', 'chat.criar_grupo', true, false],
  ['RECURSOS_HUMANOS', 'chat.criar_grupo', true, false],
  ['TRANSPORTE_ESCOLAR', 'chat.criar_grupo', true, false],
  ['FINANCEIRO_TESOURARIA', 'chat.criar_grupo', true, false],
  ['ENGENHARIA', 'chat.criar_grupo', true, false],

  ['GABINETE', 'diario_oficial.gerir', true, false],
  ['JURIDICO', 'diario_oficial.gerir', true, false],

  ['GABINETE', 'escolas.editar', true, false],
  ['PEDAGOGICO', 'escolas.editar', true, false],
  ['ADMINISTRATIVO', 'escolas.editar', true, false],
  ['ENGENHARIA', 'escolas.editar', true, false],

  ['GABINETE', 'busca.usar', true, true],
  ['PEDAGOGICO', 'busca.usar', true, true],
  ['ADMINISTRATIVO', 'busca.usar', true, true],
  ['JURIDICO', 'busca.usar', true, true],
  ['NUTRICAO', 'busca.usar', true, true],
  ['RECURSOS_HUMANOS', 'busca.usar', true, true],
  ['TRANSPORTE_ESCOLAR', 'busca.usar', true, true],
  ['FINANCEIRO_TESOURARIA', 'busca.usar', true, true],
  ['ENGENHARIA', 'busca.usar', true, true],

  ['GABINETE', 'oraculo.privado', true, true],
  ['PEDAGOGICO', 'oraculo.privado', true, true],
  ['ADMINISTRATIVO', 'oraculo.privado', true, true],
  ['JURIDICO', 'oraculo.privado', true, true],
  ['NUTRICAO', 'oraculo.privado', true, true],
  ['RECURSOS_HUMANOS', 'oraculo.privado', true, true],
  ['TRANSPORTE_ESCOLAR', 'oraculo.privado', true, true],
  ['FINANCEIRO_TESOURARIA', 'oraculo.privado', true, true],
  ['ENGENHARIA', 'oraculo.privado', true, true],

  ['GABINETE', 'ajustes.conexao', true, true],
  ['PEDAGOGICO', 'ajustes.conexao', true, true],
  ['ADMINISTRATIVO', 'ajustes.conexao', true, true],
  ['JURIDICO', 'ajustes.conexao', true, true],
  ['NUTRICAO', 'ajustes.conexao', true, true],
  ['RECURSOS_HUMANOS', 'ajustes.conexao', true, true],
  ['TRANSPORTE_ESCOLAR', 'ajustes.conexao', true, true],
  ['FINANCEIRO_TESOURARIA', 'ajustes.conexao', true, true],
  ['ENGENHARIA', 'ajustes.conexao', true, true],

  ['GABINETE', 'memorias.ler', true, true],
  ['PEDAGOGICO', 'memorias.ler', true, false],
  ['ADMINISTRATIVO', 'memorias.ler', true, false],
  ['JURIDICO', 'memorias.ler', true, true],
  ['RECURSOS_HUMANOS', 'memorias.ler', true, false],
  ['FINANCEIRO_TESOURARIA', 'memorias.ler', true, false],

  ['GABINETE', 'memorias.editar', true, false],
  ['GABINETE', 'automacoes.gerir', true, false],

  ['GABINETE', 'inventario.ver', true, true],
  ['GABINETE', 'inventario.cadastrar', true, false],
  ['GABINETE', 'inventario.movimentar', true, false],
  ['GABINETE', 'inventario.baixar_ajustar', true, false],

  ['ADMINISTRATIVO', 'inventario.ver', true, true],
  ['ADMINISTRATIVO', 'inventario.cadastrar', true, true],
  ['ADMINISTRATIVO', 'inventario.movimentar', true, true],
  ['ADMINISTRATIVO', 'inventario.baixar_ajustar', true, false]
];

export const MATRIZ_PADRAO: Record<string, { ENCARREGADO: Set<string>; MEMBRO: Set<string> }> = (() => {
  const out: Record<string, { ENCARREGADO: Set<string>; MEMBRO: Set<string> }> = {};
  for (const s of SETORES_ORGANIZACIONAIS) {
    if (s.codigo !== 'MODERADOR') {
      out[s.codigo] = { ENCARREGADO: new Set<string>(), MEMBRO: new Set<string>() };
    }
  }
  for (const [setor, perm, enc, mem] of MATRIZ_SEEDS) {
    if (!out[setor]) continue;
    if (enc) out[setor].ENCARREGADO.add(perm);
    if (mem) out[setor].MEMBRO.add(perm);
  }
  return out;
})();

const CONTEXT_CACHE_KEY = 'olympos_rbac_contexto_v7';

let contextoAtual: ContextoAcessoAtual = {
  autenticado: false,
  ativo: true,
  setorCodigo: null,
  setorNome: 'Visitante',
  siglaOficio: '',
  cargoSetor: null,
  roleLegado: 'VISITANTE',
  requerMfa: false,
  isModerador: false,
  isGabinete: false,
  isEncarregado: false,
  permissoes: [],
  paginasPermitidas: [...PUBLIC_PAGES],
  origem: 'visitante'
};

export function inferirSetorPorRoleLegado(role: string | null | undefined, setorExpl?: string | null): SetorCodigo {
  const cleanSetor = String(setorExpl || '').trim().toUpperCase();
  if (cleanSetor && SETORES_MAP[cleanSetor]) {
    return cleanSetor as SetorCodigo;
  }
  const r = String(role || '').trim().toUpperCase();
  if (r === 'MODERADOR') return 'MODERADOR';
  if (r === 'ADMIN_GABINETE' || r.includes('GABINETE')) return 'GABINETE';
  if (r === 'RH_COMISSAO' || r.includes('RH')) return 'RECURSOS_HUMANOS';
  if (r === 'JURIDICO' || r.includes('JURID')) return 'JURIDICO';
  return 'PEDAGOGICO';
}

export function inferirCargoPorRoleLegado(role: string | null | undefined, cargoExpl?: string | null): CargoSetor {
  const cleanCargo = String(cargoExpl || '').trim().toUpperCase();
  if (cleanCargo === 'MODERADOR' || cleanCargo === 'ENCARREGADO' || cleanCargo === 'MEMBRO') {
    return cleanCargo;
  }
  const r = String(role || '').trim().toUpperCase();
  if (r === 'MODERADOR') return 'MODERADOR';
  if (r === 'ADMIN_GABINETE' || r === 'JURIDICO' || r === 'RH_COMISSAO') return 'ENCARREGADO';
  return 'MEMBRO';
}

export function computarRequerMfa(setor: SetorCodigo | null, cargo: CargoSetor | null, roleLegado?: string | null): boolean {
  const sExplicit = setor ? String(setor).trim().toUpperCase() : '';
  const cExplicit = cargo ? String(cargo).trim().toUpperCase() : '';
  const r = String(roleLegado || '').trim().toUpperCase();

  if (sExplicit === 'MODERADOR' || cExplicit === 'MODERADOR' || r === 'MODERADOR') return true;
  if (sExplicit === 'GABINETE' || r === 'ADMIN_GABINETE') return true;

  // Regra estrita Onda 7 quando cargo setorial for explicitamente fornecido
  if (cExplicit) {
    const setorResolvido = (sExplicit || inferirSetorPorRoleLegado(r)) as SetorCodigo;
    const info = SETORES_MAP[setorResolvido];
    if (!info) return false;
    if (info.mfaObrigatorioSempre) return true;
    return cExplicit === 'ENCARREGADO' && info.mfaObrigatorioEncarregado;
  }

  // Fallback legado quando chamado apenas com role (ex.: isRoleMfaMandatory('RH_COMISSAO'))
  return r === 'JURIDICO' || sExplicit === 'JURIDICO';
}

export function construirFallbackPorPerfil(profileOrRole: any): ContextoAcessoAtual {
  const roleStr =
    typeof profileOrRole === 'string'
      ? profileOrRole
      : String(profileOrRole?.role || profileOrRole?.perfil?.id || '').trim().toUpperCase();

  if (!roleStr || roleStr === 'VISITANTE') {
    return {
      autenticado: false,
      ativo: true,
      setorCodigo: null,
      setorNome: 'Visitante',
      siglaOficio: '',
      cargoSetor: null,
      roleLegado: 'VISITANTE',
      requerMfa: false,
      isModerador: false,
      isGabinete: false,
      isEncarregado: false,
      permissoes: [],
      paginasPermitidas: [...PUBLIC_PAGES],
      origem: 'visitante'
    };
  }

  const setorCodigo = inferirSetorPorRoleLegado(roleStr, profileOrRole?.setor_codigo);
  const cargoSetor = inferirCargoPorRoleLegado(roleStr, profileOrRole?.cargo_setor);
  const ativo = profileOrRole?.ativo !== false;
  const isMod = setorCodigo === 'MODERADOR' || cargoSetor === 'MODERADOR' || roleStr === 'MODERADOR';
  const info = SETORES_MAP[setorCodigo] || SETORES_MAP.PEDAGOGICO;

  let perms: string[] = [];
  if (isMod) {
    perms = CATALOGO_PERMISSOES.map((p) => p.codigo);
  } else if (ativo) {
    const matriz = MATRIZ_PADRAO[setorCodigo];
    const bucket = cargoSetor === 'ENCARREGADO' ? matriz?.ENCARREGADO : matriz?.MEMBRO;
    perms = bucket ? Array.from(bucket) : [];
  }

  const paginasSet = new Set<string>(PUBLIC_PAGES);
  const permSet = new Set(perms);
  for (const item of CATALOGO_PERMISSOES) {
    if (item.rotaPagina && (isMod || permSet.has(item.codigo))) {
      paginasSet.add(item.rotaPagina);
    }
  }
  if (permSet.has('chamados.ver') || isMod) paginasSet.add('pendencias');
  if (permSet.has('pss.ver') || isMod) paginasSet.add('pss');
  if (permSet.has('permutas.ver') || isMod) paginasSet.add('papiro-cadmo');
  if (permSet.has('ajustes.conexao') || isMod) paginasSet.add('configuracoes');

  // Exclusividade absoluta de Portarias & Licenças
  if (!isMod && setorCodigo !== 'GABINETE') {
    paginasSet.delete('portarias');
    paginasSet.delete('licencas');
  }

  return {
    autenticado: true,
    ativo,
    setorCodigo,
    setorNome: info.nome,
    siglaOficio: info.siglaOficio,
    cargoSetor,
    roleLegado: info.legacyRole,
    requerMfa: computarRequerMfa(setorCodigo, cargoSetor, roleStr),
    isModerador: isMod,
    isGabinete: setorCodigo === 'GABINETE',
    isEncarregado: cargoSetor === 'ENCARREGADO',
    permissoes: perms,
    paginasPermitidas: Array.from(paginasSet),
    origem: 'fallback_legado'
  };
}

export function hidratarContextoLocal(profileOrSession: any): ContextoAcessoAtual {
  const ctx = construirFallbackPorPerfil(profileOrSession?.profile || profileOrSession);
  contextoAtual = ctx;
  return ctx;
}

export async function carregarContextoAcesso(forceRefresh = false): Promise<ContextoAcessoAtual> {
  const app = typeof window !== 'undefined' ? (window as any).OlymposApp : null;
  const supa = typeof window !== 'undefined' ? (window as any).OlymposSupabase : null;
  const sessao = app && typeof app.getSession === 'function' ? app.getSession() : null;

  if (!sessao || !sessao.perfil) {
    const visit = construirFallbackPorPerfil('VISITANTE');
    contextoAtual = visit;
    return visit;
  }

  if (!forceRefresh && contextoAtual.autenticado && contextoAtual.origem === 'rpc') {
    return contextoAtual;
  }

  if (supa && typeof supa.obterContextoAcessoAtual === 'function') {
    try {
      const rpcRes = await supa.obterContextoAcessoAtual();
      if (rpcRes && rpcRes.autenticado) {
        const legRole = rpcRes.legacy_role || rpcRes.role || sessao.perfil.id;
        const setorCodigo = inferirSetorPorRoleLegado(legRole, rpcRes.setor_codigo);
        const cargoSetor = inferirCargoPorRoleLegado(legRole, rpcRes.cargo_setor);
        const isMod = setorCodigo === 'MODERADOR' || cargoSetor === 'MODERADOR' || legRole === 'MODERADOR';
        const info = SETORES_MAP[setorCodigo] || SETORES_MAP.PEDAGOGICO;
        const perms = Array.isArray(rpcRes.permissoes) ? rpcRes.permissoes.map(String) : [];
        const rawPages = Array.isArray(rpcRes.paginas_permitidas)
          ? rpcRes.paginas_permitidas.map(String)
          : [...PUBLIC_PAGES];
        const pagSet = new Set<string>([...PUBLIC_PAGES, ...rawPages]);
        if (pagSet.has('chamados')) pagSet.add('pendencias');
        if (pagSet.has('processos-seletivos')) pagSet.add('pss');
        if (!isMod && setorCodigo !== 'GABINETE') {
          pagSet.delete('portarias');
          pagSet.delete('licencas');
        }

        contextoAtual = {
          autenticado: true,
          ativo: rpcRes.ativo !== false,
          setorCodigo,
          setorNome: rpcRes.setor_nome || info.nome,
          siglaOficio: rpcRes.setor_sigla || rpcRes.sigla_oficio || info.siglaOficio,
          cargoSetor,
          roleLegado: legRole || info.legacyRole,
          requerMfa: Boolean(rpcRes.requer_mfa ?? computarRequerMfa(setorCodigo, cargoSetor, legRole)),
          isModerador: isMod,
          isGabinete: setorCodigo === 'GABINETE',
          isEncarregado: cargoSetor === 'ENCARREGADO',
          permissoes: perms,
          paginasPermitidas: Array.from(pagSet),
          origem: 'rpc'
        };
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(CONTEXT_CACHE_KEY, JSON.stringify(contextoAtual));
          }
        } catch {
          // ignore storage quota errors
        }
        return contextoAtual;
      }
    } catch (err) {
      console.warn('[OlymposRbac] RPC contexto indisponível, usando fallback legado:', err);
    }
  }

  return hidratarContextoLocal(sessao);
}

export function getContextoAtual(): ContextoAcessoAtual {
  return contextoAtual;
}

export function limparContextoAcesso(): void {
  contextoAtual = construirFallbackPorPerfil('VISITANTE');
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CONTEXT_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}

export function temPermissao(permKey: string, ctxArg?: ContextoAcessoAtual): boolean {
  const ctx = ctxArg || contextoAtual;
  const key = String(permKey || '').trim();
  if (!key) return false;
  if (!ctx.autenticado || ctx.ativo === false) return false;
  if (ctx.isModerador) return true;

  const item = CATALOGO_PERMISSOES.find((p) => p.codigo === key);
  if (item?.somenteModerador) return false;
  if (item?.exclusivoGabinete && ctx.setorCodigo !== 'GABINETE') return false;

  return ctx.permissoes.includes(key);
}

export function podeAcessarPagina(pageId: string, ctxArg?: ContextoAcessoAtual): boolean {
  const ctx = ctxArg || contextoAtual;
  const raw = String(pageId || 'visao-geral').trim().toLowerCase();
  const page = raw === 'pendencias' ? 'chamados' : raw === 'pss' ? 'processos-seletivos' : raw;

  if (!ctx.autenticado) {
    return PUBLIC_PAGES.includes(page);
  }
  if (ctx.ativo === false) return false;
  if (ctx.isModerador) return true;

  if ((page === 'portarias' || page === 'licencas') && ctx.setorCodigo !== 'GABINETE') {
    return false;
  }
  if (page === 'auditoria') {
    return ctx.permissoes.includes('auditoria.ver');
  }

  return ctx.paginasPermitidas.includes(page) || PUBLIC_PAGES.includes(page);
}

export function getSetorAtual(): SetorCodigo | null {
  return contextoAtual.setorCodigo;
}

export function getCargoAtual(): CargoSetor | null {
  return contextoAtual.cargoSetor;
}

export function getSiglaOficioAtual(): string {
  return contextoAtual.siglaOficio || 'GS';
}

export function isModerador(): boolean {
  return contextoAtual.isModerador;
}

export function isEncarregado(): boolean {
  return contextoAtual.isEncarregado;
}

export function isGabinete(): boolean {
  return contextoAtual.isGabinete;
}

export function requerMfa(): boolean {
  return contextoAtual.requerMfa;
}

export function formatarCargoSetorBadge(setor?: string | null, cargo?: string | null, roleLegado?: string | null): string {
  const sCod = inferirSetorPorRoleLegado(roleLegado, setor);
  const cCod = inferirCargoPorRoleLegado(roleLegado, cargo);
  if (sCod === 'MODERADOR' || cCod === 'MODERADOR') return 'Moderador';
  const info = SETORES_MAP[sCod];
  const nomeCurto = info ? info.nome.replace(/^Setor de\s+/i, '').replace(/^Setor\s+/i, '') : sCod;
  const cargoLabel = cCod === 'ENCARREGADO' ? 'Encarregado' : 'Membro';
  return `${cargoLabel} • ${nomeCurto}`;
}

export function aplicarAtributosPermissaoDom(rootEl?: ParentNode | null): void {
  if (typeof document === 'undefined') return;
  const root = rootEl || document;
  root.querySelectorAll('[data-perm]').forEach((el) => {
    const rawPerm = el.getAttribute('data-perm') || '';
    const permsAny = rawPerm
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (permsAny.length === 0) return;

    const ok = permsAny.some((p) => temPermissao(p));
    el.classList.toggle('hidden', !ok);
    (el as HTMLElement).style.display = ok ? '' : 'none';
    el.setAttribute('aria-hidden', ok ? 'false' : 'true');
  });
}

const OlymposRbacApi = {
  SETORES_ORGANIZACIONAIS,
  SETORES_MAP,
  PUBLIC_PAGES,
  CATALOGO_PERMISSOES,
  MATRIZ_PADRAO,
  inferirSetorPorRoleLegado,
  inferirCargoPorRoleLegado,
  computarRequerMfa,
  construirFallbackPorPerfil,
  hidratarContextoLocal,
  carregarContextoAcesso,
  getContextoAtual,
  limparContextoAcesso,
  temPermissao,
  podeAcessarPagina,
  getSetorAtual,
  getCargoAtual,
  getSiglaOficioAtual,
  isModerador,
  isEncarregado,
  isGabinete,
  requerMfa,
  formatarCargoSetorBadge,
  aplicarAtributosPermissaoDom
};

if (typeof window !== 'undefined') {
  (window as any).OlymposRbac = OlymposRbacApi;
}

export default OlymposRbacApi;
