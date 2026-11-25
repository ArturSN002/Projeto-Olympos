/**
 * Hub Olympos — A Forja de Hefesto (Inventário Patrimonial & Almoxarifado SMEB)
 * - Modo Público QR Code (`?item=...` sem permissão `inventario.ver`): exibe cartão enxuto de conferência patrimonial.
 * - Modo Gestão (`inventario.ver` / `cadastrar` / `movimentar` / `baixar_ajustar`):
 *   controle de bens unitários (`SMEB-PAT-...`), consumíveis (`SMEB-CON-...`), movimentação em lote,
 *   impressão de etiquetas QR, exportação XLSX segura e integração híbrida Supabase + Google Drive/Docs.
 */

import '../styles/inventario.css';
import inventarioHtml from '../templates/pages/inventario.html?raw';
import inventarioModalsHtml from '../templates/modals/inventarioModals.html?raw';
import { enhanceTable } from '../core/tableStandard';
import { ensureEscolasSeedData } from '../core/lazyData';
import { sanitizeRowsForExport } from '../core/safeSpreadsheet';
import {
  abrirImpressaoEtiquetasQr,
  buildInventarioItemUrl,
  extrairCodigoDeLeituraQr,
  iniciarLeitorCameraQr,
  renderQrSvg
} from './inventario/qrPatrimonio';
import {
  enviarAnexoInventarioDrive,
  gerarTermoEntregaDrive,
  InventarioTipoAnexo,
  obterPastaDriveInventario
} from './inventario/inventarioDriveClient';

export const routeId = 'inventario';
export const htmlTemplate = inventarioHtml;
export const modalTemplates = [{ id: 'modalInventarioEntrada', html: inventarioModalsHtml }];

interface EscolaRef {
  id: string;
  inep: string;
  nome: string;
  diretor: string;
  zona?: string;
}

interface InventarioItem {
  id: string;
  codigo_unico: string;
  lote_id: string;
  tombamento_prefeitura: string | null;
  numero_serie: string | null;
  nome_detalhado: string;
  categoria: string;
  descricao: string | null;
  marca_modelo: string | null;
  estado_conservacao: string;
  status_item: string;
  data_entrada_deposito: string | null;
  data_saida_deposito: string | null;
  data_ultima_movimentacao: string | null;
  lotacao_atual_tipo: string;
  lotacao_atual_escola_id: string | null;
  lotacao_atual_setor_codigo: string | null;
  lotacao_atual_nome: string;
  ambiente_detalhe: string | null;
  lotacao_anterior_nome: string | null;
  responsavel_atual_nome: string | null;
  observacoes: string | null;
}

interface InventarioLote {
  id: string;
  codigo_lote: string;
  nome_item: string;
  categoria: string;
  modo_rastreio: 'UNITARIO_CODIGO' | 'CONSUMIVEL_QUANTITATIVO';
  unidade_medida: string;
  descricao: string | null;
  marca_modelo: string | null;
  fornecedor_origem: string | null;
  documento_entrada: string | null;
  valor_unitario: number | null;
  data_entrada_deposito: string;
  quantidade_entrada: number;
  saldo_atual_deposito: number;
  estoque_minimo: number;
  observacoes: string | null;
}

interface InventarioMovimentacao {
  id: string;
  remessa_codigo: string;
  item_id: string | null;
  lote_id: string | null;
  tipo_movimentacao: string;
  quantidade: number;
  origem_nome: string;
  destino_nome: string;
  destino_ambiente: string | null;
  recebido_por_nome: string | null;
  recebido_por_cargo: string | null;
  motivo_observacao: string | null;
  termo_drive_url: string | null;
  realizado_em: string;
}

interface InventarioAnexo {
  id: string;
  item_id: string | null;
  lote_id: string | null;
  movimentacao_id: string | null;
  remessa_codigo: string | null;
  tipo_anexo: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  drive_file_id: string;
  drive_view_url: string;
  legenda: string | null;
  criado_em: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  MOBILIARIO: 'Mobiliário',
  INFORMATICA: 'Informática & TI',
  ELETRODOMESTICO: 'Eletrodoméstico',
  AUDIOVISUAL: 'Audiovisual',
  EXPEDIENTE: 'Expediente',
  LIMPEZA: 'Limpeza',
  PEDAGOGICO: 'Pedagógico',
  ESPORTE: 'Esporte & Lazer',
  FERRAMENTA: 'Ferramentas',
  OUTRO: 'Outro'
};

const STATUS_LABELS: Record<string, string> = {
  EM_ESTOQUE: 'Em Estoque',
  ALOCADO: 'Alocado',
  EM_MANUTENCAO: 'Em Manutenção',
  BAIXADO: 'Baixado'
};

const ESTADO_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  BOM: 'Bom',
  REGULAR: 'Regular',
  AVARIADO: 'Avariado',
  INSERVIVEL: 'Inservível'
};

const LOTACAO_LABELS: Record<string, string> = {
  DEPOSITO: 'Depósito Central',
  ESCOLA: 'Escola',
  SETOR_SEDE: 'Setor SMEB',
  EXTERNO_MANUTENCAO: 'Manutenção Externa',
  BAIXADO: 'Baixado'
};

const MOV_LABELS: Record<string, string> = {
  ENTRADA_DEPOSITO: 'Entrada no Depósito',
  REPOSICAO_CONSUMIVEL: 'Reposição de Estoque',
  SAIDA_ESCOLA: 'Saída p/ Escola',
  SAIDA_SETOR: 'Saída p/ Setor',
  TRANSFERENCIA: 'Transferência entre Locais',
  RETORNO_DEPOSITO: 'Devolução ao Depósito',
  ENVIO_MANUTENCAO: 'Envio Manutenção',
  RETORNO_MANUTENCAO: 'Retorno Manutenção',
  ATUALIZACAO_ESTADO: 'Atualização de Estado',
  BAIXA_PATRIMONIAL: 'Baixa Patrimonial'
};

const ANEXO_LABELS: Record<string, string> = {
  FOTO_ENTRADA: 'Foto Entrada',
  FOTO_ENTREGA: 'Foto Entrega',
  FOTO_AVARIA: 'Foto Avaria',
  TERMO_ENTREGA_DOCS: 'Termo Google Docs',
  TERMO_ASSINADO_SCAN: 'Termo Assinado',
  NOTA_FISCAL: 'Nota Fiscal',
  LAUDO: 'Laudo Técnico',
  OUTRO: 'Outro'
};

const state = {
  mounted: false,
  tab: 'itens' as 'itens' | 'consumiveis' | 'historico',
  itens: [] as InventarioItem[],
  lotes: [] as InventarioLote[],
  movs: [] as InventarioMovimentacao[],
  anexos: [] as InventarioAnexo[],
  escolas: [] as EscolaRef[],
  selectedIds: new Set<string>(),
  movTargetIds: [] as string[],
  dossieItem: null as InventarioItem | null,
  stopCameraFn: null as null | (() => void),
  lastQrHandled: ''
};

function esc(val: unknown): string {
  const fn = (window as any).OlymposApp?.escapeHtml;
  if (typeof fn === 'function') return fn(val);
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(msg: string, isErr = false): void {
  const fn = (window as any).OlymposApp?.showToast;
  if (typeof fn === 'function') {
    fn(msg, isErr);
  }
}

function getSb(): any {
  const sb = (window as any).OlymposSupabase?.getClient?.();
  if (!sb) throw new Error('Supabase não inicializado.');
  return sb;
}

function temPerm(perm: string): boolean {
  const rbac = (window as any).OlymposRbac;
  return Boolean(rbac && typeof rbac.temPermissao === 'function' && rbac.temPermissao(perm));
}

function getHashQrCodigo(): string {
  const hash = String(window.location.hash || '');
  const qIdx = hash.indexOf('?');
  if (qIdx < 0) return '';
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  const raw = params.get('item') || params.get('codigo') || params.get('lote') || '';
  return extrairCodigoDeLeituraQr(raw);
}

function fmtDataBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = String(iso).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function fmtDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
}

function badgeStatusHtml(status: string): string {
  const label = STATUS_LABELS[status] || status;
  const cls =
    status === 'EM_ESTOQUE'
      ? 'status-badge success'
      : status === 'ALOCADO'
      ? 'status-badge info'
      : status === 'EM_MANUTENCAO'
      ? 'status-badge warning'
      : 'status-badge danger';
  return `<span class="${cls}">${esc(label)}</span>`;
}

function badgeEstadoHtml(estado: string): string {
  const label = ESTADO_LABELS[estado] || estado;
  const cls =
    estado === 'NOVO' || estado === 'BOM'
      ? 'status-badge success'
      : estado === 'REGULAR'
      ? 'status-badge warning'
      : 'status-badge danger';
  return `<span class="${cls}">${esc(label)}</span>`;
}

function openModal(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  (window as any).OlymposRbac?.aplicarAtributosPermissaoDom?.(el);
}

function closeModal(id: string): void {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  if (id === 'modalInventarioQrScanner') {
    pararCameraScanner();
  }
}

function pararCameraScanner(): void {
  if (state.stopCameraFn) {
    try {
      state.stopCameraFn();
    } catch {
      // ignore stop errors
    }
    state.stopCameraFn = null;
  }
  const video = document.getElementById('invScannerVideo');
  const btn = document.getElementById('btnInvScannerCameraToggle');
  if (video) video.classList.add('hidden');
  if (btn) btn.textContent = 'Ativar Câmera';
}

async function carregarCatalogoEscolas(): Promise<void> {
  const map = new Map<string, EscolaRef>();
  try {
    const seeds = await ensureEscolasSeedData();
    if (Array.isArray(seeds)) {
      seeds.forEach((e: any) => {
        const id = String(e.id || e.inep || '').trim();
        if (!id || !e.nome) return;
        map.set(id, {
          id,
          inep: String(e.inep || id),
          nome: String(e.nome),
          diretor: String(e.diretor || e.gestor || ''),
          zona: String(e.zona || '')
        });
      });
    }
  } catch {
    // continua com fallback do banco
  }

  try {
    const sb = getSb();
    const { data } = await sb
      .from('escolas')
      .select('id,inep,nome,diretor,zona')
      .order('nome', { ascending: true });
    if (Array.isArray(data)) {
      data.forEach((e: any) => {
        const id = String(e.id || '').trim();
        if (!id || !e.nome) return;
        const prev = map.get(id);
        map.set(id, {
          id,
          inep: String(e.inep || prev?.inep || ''),
          nome: String(e.nome),
          diretor: String(e.diretor || prev?.diretor || ''),
          zona: String(e.zona || prev?.zona || '')
        });
      });
    }
  } catch {
    // usa seed se leitura direta de escolas falhar
  }

  state.escolas = Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  popularSelectsEscolasESetores();
}

function popularSelectsEscolasESetores(): void {
  const escolaSel = document.getElementById('invMovEscolaSelect') as HTMLSelectElement | null;
  if (escolaSel) {
    escolaSel.innerHTML =
      '<option value="">Selecione a escola...</option>' +
      state.escolas
        .map(
          (e) =>
            `<option value="${esc(e.id)}">${esc(e.nome)}${e.inep ? ` (INEP ${esc(e.inep)})` : ''}</option>`
        )
        .join('');
  }

  const datalist = document.getElementById('invEscolasDatalist');
  if (datalist) {
    const setoresObj: Record<string, any> = (window as any).OlymposRbac?.SETORES_ORGANIZACIONAIS || {};
    const optionsEscolas = state.escolas.map((e) => `<option value="${esc(e.nome)}"></option>`).join('');
    const optionsSetores = Object.values(setoresObj)
      .map((s: any) => `<option value="${esc(s?.nome || s?.codigo || '')}"></option>`)
      .join('');
    datalist.innerHTML = optionsEscolas + optionsSetores;
  }

  const setorSel = document.getElementById('invMovSetorSelect') as HTMLSelectElement | null;
  if (setorSel) {
    const setoresObj: Record<string, any> = (window as any).OlymposRbac?.SETORES_ORGANIZACIONAIS || {};
    const setores = Object.entries(setoresObj);
    setorSel.innerHTML =
      '<option value="">Selecione o setor...</option>' +
      setores
        .map(([code, meta]) => `<option value="${esc(code)}">${esc(meta?.nome || code)}</option>`)
        .join('');
  }
}

async function consultarQrPublico(rawCodigo: string): Promise<void> {
  const code = extrairCodigoDeLeituraQr(rawCodigo);
  const bodyEl = document.getElementById('invPublicQrCardBody');
  const inputEl = document.getElementById('invPublicQrInput') as HTMLInputElement | null;
  if (inputEl && code) inputEl.value = code;
  if (!bodyEl) return;

  if (!code) {
    bodyEl.innerHTML = `
      <div class="inv-meta-item">
        <small>Conferência Patrimonial</small>
        <strong>Informe ou leia um código patrimonial para exibir a ficha pública.</strong>
      </div>`;
    return;
  }

  bodyEl.innerHTML = `<div class="inv-meta-item"><small>Consultando...</small><strong>Verificando registro ${esc(code)} na base SMEB...</strong></div>`;
  try {
    const sb = getSb();
    const { data, error } = await sb.rpc('rpc_inventario_consultar_qr_publico', { p_codigo: code });
    if (error) throw error;
    if (!data || data.encontrado !== true) {
      bodyEl.innerHTML = `
        <div class="inv-meta-item">
          <small>Código não encontrado</small>
          <strong>Nenhum bem ou lote localizado para o identificador ${esc(code)}.</strong>
        </div>`;
      return;
    }

    const isCons = data.tipo_registro === 'CONSUMIVEL';
    const metaCards = [
      { k: 'Código SMEB', v: data.codigo || code },
      { k: 'Nome do Bem', v: data.nome || '—' },
      { k: 'Categoria', v: CATEGORIA_LABELS[data.categoria] || data.categoria || '—' },
      { k: 'Marca / Modelo', v: data.marca_modelo || 'Não informado' },
      { k: 'Estado / Conservação', v: isCons ? `${data.saldo_atual_deposito ?? 0} ${data.unidade_medida || 'UN'} em depósito` : ESTADO_LABELS[data.estado_conservacao] || data.estado_conservacao || '—' },
      { k: 'Status', v: isCons ? 'Consumível Controlado' : STATUS_LABELS[data.status] || data.status || '—' },
      { k: 'Lotação Atual', v: `${data.lotacao_atual_nome || 'Depósito Central SMEB'}${data.ambiente_detalhe ? ` • ${data.ambiente_detalhe}` : ''}` },
      { k: 'Lotação Anterior', v: data.lotacao_anterior_nome || 'Sem movimentação anterior' },
      { k: 'Entrada no Depósito', v: fmtDataBr(data.data_entrada_deposito) },
      { k: 'Última Saída / Mov.', v: data.data_saida_deposito ? fmtDataBr(data.data_saida_deposito) : fmtDataHoraBr(data.data_ultima_movimentacao) }
    ];

    if (data.tombamento_prefeitura) {
      metaCards.splice(1, 0, { k: 'Tombamento Prefeitura', v: data.tombamento_prefeitura });
    }

    bodyEl.innerHTML = `
      <div class="inv-meta-grid">
        ${metaCards
          .map(
            (m) => `
          <div class="inv-meta-item">
            <small>${esc(m.k)}</small>
            <strong>${esc(m.v)}</strong>
          </div>`
          )
          .join('')}
      </div>
      <p class="inv-submeta" style="margin-top: 0.75rem;">
        Visualização pública enxuta. Notas fiscais, valores, fornecedores, fotos no Drive e registro de entrega requerem acesso autenticado do setor Administrativo/Gabinete.
      </p>`;
  } catch (err: any) {
    bodyEl.innerHTML = `<div class="inv-meta-item"><small>Erro na consulta</small><strong>${esc(err?.message || 'Não foi possível consultar este código.')}</strong></div>`;
  }
}

async function carregarDadosCompletos(): Promise<void> {
  const sb = getSb();
  const [itensRes, lotesRes, movsRes, anexosRes] = await Promise.all([
    sb.from('inventario_itens').select('*').order('atualizado_em', { ascending: false }).limit(800),
    sb.from('inventario_catalogo_lotes').select('*').order('criado_em', { ascending: false }).limit(400),
    sb.from('inventario_movimentacoes').select('*').order('realizado_em', { ascending: false }).limit(400),
    sb.from('inventario_anexos').select('*').order('criado_em', { ascending: false }).limit(500)
  ]);

  if (itensRes.error) throw itensRes.error;
  if (lotesRes.error) throw lotesRes.error;
  if (movsRes.error) throw movsRes.error;
  if (anexosRes.error) throw anexosRes.error;

  state.itens = Array.isArray(itensRes.data) ? itensRes.data : [];
  state.lotes = Array.isArray(lotesRes.data) ? lotesRes.data : [];
  state.movs = Array.isArray(movsRes.data) ? movsRes.data : [];
  state.anexos = Array.isArray(anexosRes.data) ? anexosRes.data : [];

  popularFiltroCategorias();
  atualizarKpis();
  renderAllTables();
}

function popularFiltroCategorias(): void {
  const sel = document.getElementById('invFilterCategoria') as HTMLSelectElement | null;
  if (!sel) return;
  const current = sel.value;
  const cats = new Set<string>();
  state.itens.forEach((i) => cats.add(i.categoria));
  state.lotes.forEach((l) => cats.add(l.categoria));
  const list = Array.from(cats).filter(Boolean).sort();
  sel.innerHTML =
    '<option value="">Categoria: Todas</option>' +
    list.map((c) => `<option value="${esc(c)}">${esc(CATEGORIA_LABELS[c] || c)}</option>`).join('');
  if (current && list.includes(current)) {
    sel.value = current;
  }
}

function atualizarKpis(): void {
  const totalItens = state.itens.length;
  const emDeposito = state.itens.filter((i) => i.status_item === 'EM_ESTOQUE').length;
  const alocados = state.itens.filter((i) => i.status_item === 'ALOCADO' || i.status_item === 'EM_MANUTENCAO').length;
  const consumiveis = state.lotes.filter((l) => l.modo_rastreio === 'CONSUMIVEL_QUANTITATIVO');
  const alertasMinimo = consumiveis.filter((l) => Number(l.saldo_atual_deposito) <= Number(l.estoque_minimo)).length;

  const setText = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText('invKpiTotalItens', String(totalItens));
  setText('invKpiEmDeposito', String(emDeposito));
  setText('invKpiAlocados', String(alocados));
  setText('invKpiConsumiveisBaixos', `${consumiveis.length} (${alertasMinimo} alerta)`);
}

function getItensFiltrados(): InventarioItem[] {
  const q = ((document.getElementById('invSearchInput') as HTMLInputElement | null)?.value || '').trim().toLowerCase();
  const status = (document.getElementById('invFilterStatus') as HTMLSelectElement | null)?.value || '';
  const cat = (document.getElementById('invFilterCategoria') as HTMLSelectElement | null)?.value || '';
  const lot = (document.getElementById('invFilterLotacao') as HTMLSelectElement | null)?.value || '';
  const est = (document.getElementById('invFilterEstado') as HTMLSelectElement | null)?.value || '';

  return state.itens.filter((item) => {
    if (status && item.status_item !== status) return false;
    if (cat && item.categoria !== cat) return false;
    if (lot && item.lotacao_atual_tipo !== lot) return false;
    if (est && item.estado_conservacao !== est) return false;
    if (q) {
      const hay = [
        item.codigo_unico,
        item.tombamento_prefeitura,
        item.numero_serie,
        item.nome_detalhado,
        item.marca_modelo,
        item.lotacao_atual_nome,
        item.lotacao_anterior_nome,
        item.responsavel_atual_nome
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function atualizarBatchBar(): void {
  const bar = document.getElementById('invBatchBar');
  const txt = document.getElementById('invBatchCountText');
  if (!bar || !txt) return;
  const count = state.selectedIds.size;
  txt.textContent = `${count} item(ns) selecionado(s)`;
  bar.classList.toggle('hidden', count === 0);
}

function renderTabelaItens(): void {
  const tbody = document.getElementById('invItensTbody');
  if (!tbody) return;
  const rows = getItensFiltrados();
  const podeMovimentar = temPerm('inventario.movimentar');

  if (rows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Nenhum bem encontrado para os filtros aplicados.</td></tr>';
  } else {
    tbody.innerHTML = rows
      .map((it) => {
        const checked = state.selectedIds.has(it.id) ? 'checked' : '';
        const anexosCount = state.anexos.filter((a) => a.item_id === it.id).length;
        return `
        <tr>
          <td>
            <input type="checkbox" class="inv-row-check" data-id="${esc(it.id)}" ${checked} aria-label="Selecionar ${esc(it.codigo_unico)}" />
          </td>
          <td data-sort-value="${esc(it.codigo_unico)}">
            <span class="inv-code-pill">${esc(it.codigo_unico)}</span>
            ${it.tombamento_prefeitura ? `<div class="inv-submeta">Tomb.: ${esc(it.tombamento_prefeitura)}</div>` : ''}
          </td>
          <td>
            <strong>${esc(it.nome_detalhado)}</strong>
            <div class="inv-submeta">
              ${esc(it.marca_modelo || it.descricao || 'Sem detalhes adicionais')}
              ${anexosCount > 0 ? ` • 📎 ${anexosCount}` : ''}
            </div>
          </td>
          <td>${esc(CATEGORIA_LABELS[it.categoria] || it.categoria)}</td>
          <td>${badgeEstadoHtml(it.estado_conservacao)}</td>
          <td>${badgeStatusHtml(it.status_item)}</td>
          <td>
            <strong>${esc(it.lotacao_atual_nome)}</strong>
            ${it.ambiente_detalhe ? `<div class="inv-submeta">${esc(it.ambiente_detalhe)}</div>` : ''}
          </td>
          <td>${esc(it.lotacao_anterior_nome || '—')}</td>
          <td data-sort-value="${esc(it.data_entrada_deposito || '')}">
            <div>Ent.: ${esc(fmtDataBr(it.data_entrada_deposito))}</div>
            <div class="inv-submeta">Saída: ${esc(fmtDataBr(it.data_saida_deposito))}</div>
          </td>
          <td>
            <div class="inv-header-actions">
              <button type="button" class="btn btn-secondary btn-sm inv-btn-dossie" data-id="${esc(it.id)}">Dossiê / QR</button>
              ${
                podeMovimentar
                  ? `<button type="button" class="btn btn-primary btn-sm inv-btn-mover" data-id="${esc(it.id)}">Movimentar</button>`
                  : ''
              }
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  enhanceTable(document.getElementById('invItensTable') as HTMLTableElement | null);
  atualizarBatchBar();
}

function renderTabelaLotes(): void {
  const tbody = document.getElementById('invLotesTbody');
  if (!tbody) return;
  const q = ((document.getElementById('invSearchInput') as HTMLInputElement | null)?.value || '').trim().toLowerCase();
  const cat = (document.getElementById('invFilterCategoria') as HTMLSelectElement | null)?.value || '';
  const podeMovimentar = temPerm('inventario.movimentar');

  const rows = state.lotes.filter((l) => {
    if (cat && l.categoria !== cat) return false;
    if (q) {
      const hay = [l.codigo_lote, l.nome_item, l.marca_modelo, l.fornecedor_origem, l.documento_entrada]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (rows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Nenhum lote ou consumível registrado ainda.</td></tr>';
  } else {
    tbody.innerHTML = rows
      .map((l) => {
        const isCons = l.modo_rastreio === 'CONSUMIVEL_QUANTITATIVO';
        const alerta = isCons && Number(l.saldo_atual_deposito) <= Number(l.estoque_minimo);
        return `
        <tr>
          <td><span class="inv-code-pill">${esc(l.codigo_lote)}</span></td>
          <td><span class="status-badge ${isCons ? 'warning' : 'info'}">${isCons ? 'Consumível' : 'Unitário'}</span></td>
          <td>
            <strong>${esc(l.nome_item)}</strong>
            <div class="inv-submeta">${esc(l.marca_modelo || l.fornecedor_origem || l.documento_entrada || '—')}</div>
          </td>
          <td>${esc(CATEGORIA_LABELS[l.categoria] || l.categoria)}</td>
          <td>${esc(l.quantidade_entrada)} ${esc(l.unidade_medida)}</td>
          <td>
            <strong class="${alerta ? 'text-danger' : ''}">${esc(l.saldo_atual_deposito)} ${esc(l.unidade_medida)}</strong>
            ${alerta ? '<div class="inv-submeta" style="color: #dc2626;">Abaixo do mínimo</div>' : ''}
          </td>
          <td>${isCons ? `${esc(l.estoque_minimo)} ${esc(l.unidade_medida)}` : '—'}</td>
          <td data-sort-value="${esc(l.data_entrada_deposito)}">${esc(fmtDataBr(l.data_entrada_deposito))}</td>
          <td>
            ${
              isCons && podeMovimentar
                ? `<button type="button" class="btn btn-primary btn-sm inv-btn-cons-mov" data-lote-id="${esc(l.id)}">Movimentar Saldo</button>`
                : `<button type="button" class="btn btn-secondary btn-sm inv-btn-filtrar-lote" data-lote-id="${esc(l.id)}">Ver Itens</button>`
            }
          </td>
        </tr>`;
      })
      .join('');
  }
  enhanceTable(document.getElementById('invLotesTable') as HTMLTableElement | null);
}

function renderTabelaMovs(): void {
  const tbody = document.getElementById('invMovsTbody');
  if (!tbody) return;
  const itemById = new Map(state.itens.map((i) => [i.id, i]));
  const loteById = new Map(state.lotes.map((l) => [l.id, l]));

  if (state.movs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Nenhuma movimentação registrada até o momento.</td></tr>';
  } else {
    tbody.innerHTML = state.movs
      .map((m) => {
        const it = m.item_id ? itemById.get(m.item_id) : undefined;
        const lt = m.lote_id ? loteById.get(m.lote_id) : undefined;
        const ref = it ? `${it.codigo_unico} • ${it.nome_detalhado}` : lt ? `${lt.codigo_lote} • ${lt.nome_item}` : 'Remessa';
        return `
        <tr>
          <td data-sort-value="${esc(m.realizado_em)}">${esc(fmtDataHoraBr(m.realizado_em))}</td>
          <td><span class="inv-code-pill">${esc(m.remessa_codigo)}</span></td>
          <td>${esc(MOV_LABELS[m.tipo_movimentacao] || m.tipo_movimentacao)}</td>
          <td>${esc(ref)}</td>
          <td>${esc(m.quantidade || 1)}</td>
          <td>${esc(m.origem_nome)}</td>
          <td>
            <strong>${esc(m.destino_nome)}</strong>
            ${m.destino_ambiente ? `<div class="inv-submeta">${esc(m.destino_ambiente)}</div>` : ''}
          </td>
          <td>${esc(m.recebido_por_nome || '—')}</td>
          <td>
            ${
              m.termo_drive_url
                ? `<a href="${esc(m.termo_drive_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Abrir Docs</a>`
                : '<span class="inv-submeta">—</span>'
            }
          </td>
        </tr>`;
      })
      .join('');
  }
  enhanceTable(document.getElementById('invMovsTable') as HTMLTableElement | null);
}

function renderAllTables(): void {
  renderTabelaItens();
  renderTabelaLotes();
  renderTabelaMovs();
}

function switchTab(tab: 'itens' | 'consumiveis' | 'historico'): void {
  state.tab = tab;
  document.querySelectorAll<HTMLButtonElement>('[data-inv-tab]').forEach((btn) => {
    const active = btn.dataset.invTab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.getElementById('invTabItens')?.classList.toggle('hidden', tab !== 'itens');
  document.getElementById('invTabConsumiveis')?.classList.toggle('hidden', tab !== 'consumiveis');
  document.getElementById('invTabHistorico')?.classList.toggle('hidden', tab !== 'historico');
  renderAllTables();
}

function abrirModalEntrada(): void {
  const form = document.getElementById('formInvEntrada') as HTMLFormElement | null;
  if (form) form.reset();
  const dataEl = document.getElementById('invEntradaData') as HTMLInputElement | null;
  if (dataEl) {
    dataEl.value = new Date().toISOString().slice(0, 10);
  }
  atualizarCamposModoEntrada();
  openModal('modalInventarioEntrada');
}

function atualizarCamposModoEntrada(): void {
  const modo = (document.getElementById('invEntradaModo') as HTMLSelectElement | null)?.value || 'UNITARIO_CODIGO';
  const isCons = modo === 'CONSUMIVEL_QUANTITATIVO';
  document.getElementById('invEntradaConsumivelRow')?.classList.toggle('hidden', !isCons);
  document.getElementById('invEntradaUnitarioRow')?.classList.toggle('hidden', isCons);
  const hint = document.getElementById('invEntradaQtdHint');
  if (hint) {
    hint.textContent = isCons
      ? 'Material consumível: apenas 1 lote será criado com o saldo total informado.'
      : 'Para itens unitários: máx. 250 códigos únicos gerados por operação.';
  }
}

async function handleSubmitEntrada(e: Event): Promise<void> {
  e.preventDefault();
  const btn = document.getElementById('btnInvEntradaSubmit') as HTMLButtonElement | null;
  const modo = (document.getElementById('invEntradaModo') as HTMLSelectElement).value;
  const nome = (document.getElementById('invEntradaNome') as HTMLInputElement).value.trim();
  const categoria = (document.getElementById('invEntradaCategoria') as HTMLSelectElement).value;
  const qtd = Number((document.getElementById('invEntradaQtd') as HTMLInputElement).value || 1);
  const unidade = (document.getElementById('invEntradaUnidade') as HTMLInputElement).value.trim() || 'UN';
  const dataEntrada = (document.getElementById('invEntradaData') as HTMLInputElement).value;
  const marca = (document.getElementById('invEntradaMarca') as HTMLInputElement).value.trim();
  const fornecedor = (document.getElementById('invEntradaFornecedor') as HTMLInputElement).value.trim();
  const docEntrada = (document.getElementById('invEntradaDoc') as HTMLInputElement).value.trim();
  const descricao = (document.getElementById('invEntradaDescricao') as HTMLTextAreaElement).value.trim();
  const estado = (document.getElementById('invEntradaEstado') as HTMLSelectElement).value;
  const estoqueMin = Number((document.getElementById('invEntradaEstoqueMin') as HTMLInputElement).value || 0);
  const valorRaw = (document.getElementById('invEntradaValorUnit') as HTMLInputElement).value;
  const seriaisText = (document.getElementById('invEntradaSeriais') as HTMLTextAreaElement).value;
  const seriais = seriaisText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const fileEl = document.getElementById('invEntradaFotoFile') as HTMLInputElement | null;
  const fotoFile = fileEl?.files?.[0] || null;
  const fotoTipo = ((document.getElementById('invEntradaFotoTipo') as HTMLSelectElement).value || 'FOTO_ENTRADA') as InventarioTipoAnexo;

  if (modo === 'UNITARIO_CODIGO' && (qtd < 1 || qtd > 250)) {
    toast('Para bens unitários, informe entre 1 e 250 unidades por lote.', true);
    return;
  }
  if (modo === 'CONSUMIVEL_QUANTITATIVO' && (qtd < 1 || qtd > 5000)) {
    toast('Para consumíveis, informe entre 1 e 5.000 unidades por lançamento.', true);
    return;
  }

  if (btn) btn.disabled = true;
  try {
    const sb = getSb();
    const { data, error } = await sb.rpc('rpc_inventario_registrar_entrada_lote', {
      p_payload: {
        modo_rastreio: modo,
        nome_item: nome,
        categoria,
        unidade_medida: unidade,
        quantidade: qtd,
        data_entrada_deposito: dataEntrada,
        marca_modelo: marca || null,
        fornecedor_origem: fornecedor || null,
        documento_entrada: docEntrada || null,
        descricao: descricao || null,
        estado_conservacao: estado || 'NOVO',
        estoque_minimo: estoqueMin,
        valor_unitario: valorRaw ? Number(valorRaw) : null,
        numeros_serie: seriais
      }
    });
    if (error) throw error;

    if (fotoFile && data?.lote_id) {
      try {
        await enviarAnexoInventarioDrive({
          file: fotoFile,
          loteId: data.lote_id,
          itemId: Array.isArray(data.itens_ids) && data.itens_ids.length === 1 ? data.itens_ids[0] : null,
          remessaCodigo: data.remessa_codigo || null,
          tipoAnexo: fotoTipo,
          codigoRef: data.codigo_lote || 'LOTE',
          legenda: `Entrada no depósito — ${nome}`
        });
      } catch (upErr: any) {
        toast(`Entrada salva (${data.codigo_lote}), mas o anexo no Drive falhou: ${upErr?.message || ''}`, true);
      }
    }

    closeModal('modalInventarioEntrada');
    toast(`Entrada registrada (${data?.codigo_lote || 'OK'}): ${qtd} ${unidade} adicionado(s).`);
    await carregarDadosCompletos();
  } catch (err: any) {
    toast(err?.message || 'Erro ao registrar entrada no inventário.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function atualizarDestinoMovUI(): void {
  const destTipo = (document.getElementById('invMovDestinoTipo') as HTMLSelectElement | null)?.value || 'ESCOLA';
  document.getElementById('invMovEscolaGroup')?.classList.toggle('hidden', destTipo !== 'ESCOLA');
  document.getElementById('invMovSetorGroup')?.classList.toggle('hidden', destTipo !== 'SETOR_SEDE');
  document
    .getElementById('invMovDestinoTextoGroup')
    ?.classList.toggle('hidden', destTipo === 'ESCOLA' || destTipo === 'SETOR_SEDE');

  const nomeEl = document.getElementById('invMovDestinoNome') as HTMLInputElement | null;
  if (nomeEl && destTipo === 'DEPOSITO') nomeEl.value = 'Depósito Central SMEB';
  if (nomeEl && destTipo === 'BAIXADO') nomeEl.value = 'Baixa Patrimonial Definitiva';
}

function abrirModalMovimentar(itemIds: string[]): void {
  if (!itemIds || itemIds.length === 0) return;
  state.movTargetIds = [...itemIds];
  const form = document.getElementById('formInvMov') as HTMLFormElement | null;
  if (form) form.reset();

  const items = state.itens.filter((i) => itemIds.includes(i.id));
  const resumo = document.getElementById('invMovResumoText');
  if (resumo) {
    resumo.textContent =
      items.length === 1
        ? `${items[0].codigo_unico} — ${items[0].nome_detalhado}`
        : `${items.length} itens selecionados (${items
            .slice(0, 3)
            .map((i) => i.codigo_unico)
            .join(', ')}${items.length > 3 ? '...' : ''})`;
  }
  atualizarDestinoMovUI();
  openModal('modalInventarioMovimentar');
}

async function handleSubmitMovimentar(e: Event): Promise<void> {
  e.preventDefault();
  if (state.movTargetIds.length === 0) return;
  const btn = document.getElementById('btnInvMovSubmit') as HTMLButtonElement | null;

  const tipoMov = (document.getElementById('invMovTipo') as HTMLSelectElement).value;
  const destTipo = (document.getElementById('invMovDestinoTipo') as HTMLSelectElement).value;
  const escolaId = (document.getElementById('invMovEscolaSelect') as HTMLSelectElement).value;
  const setorCode = (document.getElementById('invMovSetorSelect') as HTMLSelectElement).value;
  const destNomeManual = (document.getElementById('invMovDestinoNome') as HTMLInputElement).value.trim();
  const ambiente = (document.getElementById('invMovAmbiente') as HTMLInputElement).value.trim();
  const estado = (document.getElementById('invMovEstado') as HTMLSelectElement).value;
  const recebidoPor = (document.getElementById('invMovRecebidoPor') as HTMLInputElement).value.trim();
  const recebidoCargo = (document.getElementById('invMovRecebidoCargo') as HTMLInputElement).value.trim();
  const motivo = (document.getElementById('invMovMotivo') as HTMLTextAreaElement).value.trim();
  const fileEl = document.getElementById('invMovAnexoFile') as HTMLInputElement | null;
  const anexoFile = fileEl?.files?.[0] || null;
  const gerarTermo = (document.getElementById('invMovGerarTermo') as HTMLInputElement | null)?.checked ?? false;

  const escolaRef = state.escolas.find((es) => es.id === escolaId);
  const setoresObj: Record<string, any> = (window as any).OlymposRbac?.SETORES_ORGANIZACIONAIS || {};
  let destNome = destNomeManual;
  if (destTipo === 'ESCOLA') {
    if (!escolaRef) {
      toast('Selecione a escola de destino.', true);
      return;
    }
    destNome = escolaRef.nome;
  } else if (destTipo === 'SETOR_SEDE') {
    if (!setorCode) {
      toast('Selecione o setor da SMEB.', true);
      return;
    }
    destNome = setoresObj[setorCode]?.nome || setorCode;
  } else if (!destNome) {
    destNome = LOTACAO_LABELS[destTipo] || destTipo;
  }

  const targetItemsBefore = state.itens.filter((i) => state.movTargetIds.includes(i.id));
  const origemNome = targetItemsBefore[0]?.lotacao_atual_nome || 'Depósito Central SMEB';

  if (btn) btn.disabled = true;
  try {
    const sb = getSb();
    const { data, error } = await sb.rpc('rpc_inventario_movimentar_itens', {
      p_payload: {
        item_ids: state.movTargetIds,
        tipo_movimentacao: tipoMov,
        destino_tipo: destTipo,
        destino_escola_id: destTipo === 'ESCOLA' ? escolaId : null,
        destino_setor_codigo: destTipo === 'SETOR_SEDE' ? setorCode : null,
        destino_nome: destNome,
        destino_ambiente: ambiente || null,
        estado_conservacao: estado || null,
        recebido_por_nome: recebidoPor || null,
        recebido_por_cargo: recebidoCargo || null,
        motivo_observacao: motivo || null
      }
    });
    if (error) throw error;

    const remessa = String(data?.remessa_codigo || '');
    if (anexoFile && remessa) {
      try {
        await enviarAnexoInventarioDrive({
          file: anexoFile,
          itemId: state.movTargetIds.length === 1 ? state.movTargetIds[0] : null,
          remessaCodigo: remessa,
          tipoAnexo: 'FOTO_ENTREGA',
          codigoRef: remessa,
          legenda: `Entrega em ${destNome}`
        });
      } catch (upErr: any) {
        toast(`Movimentação concluída (${remessa}), mas anexo falhou: ${upErr?.message || ''}`, true);
      }
    }

    if (gerarTermo && remessa) {
      try {
        const session = (window as any).OlymposApp?.getSession?.();
        const termoRes = await gerarTermoEntregaDrive({
          remessaCodigo: remessa,
          tipoMovimentacao: MOV_LABELS[tipoMov] || tipoMov,
          origemNome,
          destinoNome: destNome,
          destinoAmbiente: ambiente,
          destinoInep: escolaRef?.inep || '',
          recebidoPorNome: recebidoPor,
          recebidoPorCargo: recebidoCargo,
          motivoObservacao: motivo,
          operadorNome: session?.nome || session?.email || 'Servidor SMEB',
          itens: targetItemsBefore.map((it) => ({
            codigoUnico: it.codigo_unico,
            nomeDetalhado: it.nome_detalhado,
            numeroSerie: it.numero_serie || '',
            tombamento: it.tombamento_prefeitura || '',
            categoria: CATEGORIA_LABELS[it.categoria] || it.categoria,
            estadoConservacao: ESTADO_LABELS[estado || it.estado_conservacao] || it.estado_conservacao,
            quantidade: 1,
            unidade: 'UN'
          }))
        });
        toast(`Movimentação ${remessa} salva e Termo gerado no Google Docs!`, false);
        if (termoRes.docUrl) {
          window.open(termoRes.docUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (termoErr: any) {
        toast(`Movimentação ${remessa} concluída (Termo Docs não gerado: ${termoErr?.message || ''})`, true);
      }
    } else {
      toast(`Movimentação concluída — Remessa ${remessa}.`);
    }

    state.selectedIds.clear();
    closeModal('modalInventarioMovimentar');
    await carregarDadosCompletos();
  } catch (err: any) {
    toast(err?.message || 'Erro ao movimentar itens.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalConsumivel(loteId: string): void {
  const lote = state.lotes.find((l) => l.id === loteId);
  if (!lote) return;
  const form = document.getElementById('formInvConsMov') as HTMLFormElement | null;
  if (form) form.reset();
  (document.getElementById('invConsLoteId') as HTMLInputElement).value = lote.id;
  const resEl = document.getElementById('invConsResumoText');
  if (resEl) {
    resEl.textContent = `${lote.codigo_lote} — ${lote.nome_item} (Saldo atual: ${lote.saldo_atual_deposito} ${lote.unidade_medida})`;
  }
  openModal('modalInventarioConsumivelMov');
}

async function handleSubmitConsumivel(e: Event): Promise<void> {
  e.preventDefault();
  const btn = document.getElementById('btnInvConsSubmit') as HTMLButtonElement | null;
  const loteId = (document.getElementById('invConsLoteId') as HTMLInputElement).value;
  const tipo = (document.getElementById('invConsTipo') as HTMLSelectElement).value;
  const qtd = Number((document.getElementById('invConsQuantidade') as HTMLInputElement).value || 0);
  const destTipo = (document.getElementById('invConsDestinoTipo') as HTMLSelectElement).value;
  const destNome = (document.getElementById('invConsDestinoNome') as HTMLInputElement).value.trim();
  const recebedor = (document.getElementById('invConsRecebedor') as HTMLInputElement).value.trim();
  const obs = (document.getElementById('invConsObs') as HTMLTextAreaElement).value.trim();

  if (btn) btn.disabled = true;
  try {
    const sb = getSb();
    const { data, error } = await sb.rpc('rpc_inventario_movimentar_consumivel', {
      p_payload: {
        lote_id: loteId,
        tipo_movimentacao: tipo,
        quantidade: qtd,
        destino_tipo: destTipo,
        destino_nome: destNome,
        recebido_por_nome: recebedor || null,
        motivo_observacao: obs || null
      }
    });
    if (error) throw error;
    closeModal('modalInventarioConsumivelMov');
    toast(`Estoque atualizado — Remessa ${data?.remessa_codigo || ''} (Novo saldo: ${data?.saldo_atual_deposito ?? 0}).`);
    await carregarDadosCompletos();
  } catch (err: any) {
    toast(err?.message || 'Erro ao movimentar estoque de consumível.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function abrirDossieItem(item: InventarioItem): Promise<void> {
  state.dossieItem = item;
  const title = document.getElementById('modalInvDossieTitle');
  if (title) title.textContent = `Dossiê: ${item.codigo_unico} — ${item.nome_detalhado}`;
  const pill = document.getElementById('invDossieCodigoPill');
  if (pill) pill.textContent = item.codigo_unico;

  const qrBox = document.getElementById('invDossieQrSvg');
  if (qrBox) {
    qrBox.innerHTML = '<div class="inv-submeta">Gerando QR Code...</div>';
    renderQrSvg(buildInventarioItemUrl(item.codigo_unico), 170)
      .then((svg) => {
        if (state.dossieItem?.id === item.id) {
          qrBox.innerHTML = svg;
        }
      })
      .catch(() => {
        qrBox.innerHTML = '<div class="inv-submeta">Falha ao gerar SVG QR.</div>';
      });
  }

  const metaGrid = document.getElementById('invDossieMetaGrid');
  if (metaGrid) {
    const fields = [
      { k: 'Nome Detalhado', v: item.nome_detalhado },
      { k: 'Categoria', v: CATEGORIA_LABELS[item.categoria] || item.categoria },
      { k: 'Tombamento / Série', v: [item.tombamento_prefeitura, item.numero_serie].filter(Boolean).join(' • ') || '—' },
      { k: 'Marca / Modelo', v: item.marca_modelo || '—' },
      { k: 'Estado / Status', v: `${ESTADO_LABELS[item.estado_conservacao] || item.estado_conservacao} • ${STATUS_LABELS[item.status_item] || item.status_item}` },
      { k: 'Lotação Atual', v: `${item.lotacao_atual_nome}${item.ambiente_detalhe ? ` (${item.ambiente_detalhe})` : ''}` },
      { k: 'Lotação Anterior', v: item.lotacao_anterior_nome || 'Nenhuma' },
      { k: 'Responsável Recebedor', v: item.responsavel_atual_nome || '—' },
      { k: 'Chegada no Depósito', v: fmtDataBr(item.data_entrada_deposito) },
      { k: 'Saída do Depósito', v: fmtDataBr(item.data_saida_deposito) }
    ];
    metaGrid.innerHTML = fields
      .map((f) => `<div class="inv-meta-item"><small>${esc(f.k)}</small><strong>${esc(f.v)}</strong></div>`)
      .join('');
  }

  renderDossieAnexosEHistorico(item);
  openModal('modalInventarioDossie');
}

function renderDossieAnexosEHistorico(item: InventarioItem): void {
  const anexosGrid = document.getElementById('invDossieAnexosGrid');
  if (anexosGrid) {
    const rel = state.anexos.filter((a) => a.item_id === item.id || (a.lote_id === item.lote_id && !a.item_id));
    if (rel.length === 0) {
      anexosGrid.innerHTML = '<div class="inv-submeta">Nenhum anexo enviado ao Google Drive para este bem ainda.</div>';
    } else {
      anexosGrid.innerHTML = rel
        .map(
          (a) => `
          <div class="inv-anexo-card">
            <span class="status-badge info">${esc(ANEXO_LABELS[a.tipo_anexo] || a.tipo_anexo)}</span>
            <strong style="font-size: 0.85rem; word-break: break-word;">${esc(a.nome_arquivo)}</strong>
            <span class="inv-submeta">${esc(fmtDataHoraBr(a.criado_em))}</span>
            <a href="${esc(a.drive_view_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Abrir no Drive</a>
          </div>`
        )
        .join('');
    }
  }

  const histBody = document.getElementById('invDossieHistTbody');
  if (histBody) {
    const movsItem = state.movs.filter((m) => m.item_id === item.id || (m.lote_id === item.lote_id && m.tipo_movimentacao === 'ENTRADA_DEPOSITO'));
    histBody.innerHTML =
      movsItem.length === 0
        ? '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Sem histórico registrado.</td></tr>'
        : movsItem
            .map(
              (m) => `
            <tr>
              <td>${esc(fmtDataHoraBr(m.realizado_em))}</td>
              <td><span class="inv-code-pill">${esc(m.remessa_codigo)}</span></td>
              <td>${esc(MOV_LABELS[m.tipo_movimentacao] || m.tipo_movimentacao)}</td>
              <td>${esc(m.origem_nome)}</td>
              <td>${esc(m.destino_nome)}</td>
              <td>${esc(m.recebido_por_nome || '—')}</td>
              <td>${m.termo_drive_url ? `<a href="${esc(m.termo_drive_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm">Docs</a>` : '—'}</td>
            </tr>`
            )
            .join('');
    enhanceTable(document.getElementById('invDossieHistTable') as HTMLTableElement | null);
  }
}

async function handleSubmitDossieAnexo(e: Event): Promise<void> {
  e.preventDefault();
  if (!state.dossieItem) return;
  const fileEl = document.getElementById('invDossieAnexoFile') as HTMLInputElement | null;
  const file = fileEl?.files?.[0];
  if (!file) return;
  const tipo = ((document.getElementById('invDossieAnexoTipo') as HTMLSelectElement).value || 'FOTO_ENTREGA') as InventarioTipoAnexo;
  const btn = document.getElementById('btnInvDossieEnviarAnexo') as HTMLButtonElement | null;

  if (btn) btn.disabled = true;
  try {
    await enviarAnexoInventarioDrive({
      file,
      itemId: state.dossieItem.id,
      loteId: state.dossieItem.lote_id,
      tipoAnexo: tipo,
      codigoRef: state.dossieItem.codigo_unico,
      legenda: `${state.dossieItem.codigo_unico} — ${tipo}`
    });
    if (fileEl) fileEl.value = '';
    toast('Anexo enviado com sucesso para a pasta do Inventário no Google Drive.');
    await carregarDadosCompletos();
    const updated = state.itens.find((i) => i.id === state.dossieItem?.id);
    if (updated) {
      state.dossieItem = updated;
      renderDossieAnexosEHistorico(updated);
    }
  } catch (err: any) {
    toast(err?.message || 'Erro ao enviar anexo para o Drive.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalEditarItem(item: InventarioItem): void {
  (document.getElementById('invEditItemId') as HTMLInputElement).value = item.id;
  (document.getElementById('invEditTombamento') as HTMLInputElement).value = item.tombamento_prefeitura || '';
  (document.getElementById('invEditSerie') as HTMLInputElement).value = item.numero_serie || '';
  (document.getElementById('invEditNome') as HTMLInputElement).value = item.nome_detalhado || '';
  (document.getElementById('invEditMarca') as HTMLInputElement).value = item.marca_modelo || '';
  (document.getElementById('invEditEstado') as HTMLSelectElement).value = item.estado_conservacao || 'BOM';
  (document.getElementById('invEditObs') as HTMLTextAreaElement).value = item.observacoes || '';
  openModal('modalInventarioEditarItem');
}

async function handleSubmitEditarItem(e: Event): Promise<void> {
  e.preventDefault();
  const id = (document.getElementById('invEditItemId') as HTMLInputElement).value;
  const btn = document.getElementById('btnInvEditarSubmit') as HTMLButtonElement | null;
  if (!id) return;

  if (btn) btn.disabled = true;
  try {
    const sb = getSb();
    const { error } = await sb
      .from('inventario_itens')
      .update({
        tombamento_prefeitura: (document.getElementById('invEditTombamento') as HTMLInputElement).value.trim() || null,
        numero_serie: (document.getElementById('invEditSerie') as HTMLInputElement).value.trim() || null,
        nome_detalhado: (document.getElementById('invEditNome') as HTMLInputElement).value.trim(),
        marca_modelo: (document.getElementById('invEditMarca') as HTMLInputElement).value.trim() || null,
        estado_conservacao: (document.getElementById('invEditEstado') as HTMLSelectElement).value,
        observacoes: (document.getElementById('invEditObs') as HTMLTextAreaElement).value.trim() || null
      })
      .eq('id', id);
    if (error) throw error;

    closeModal('modalInventarioEditarItem');
    toast('Cadastro patrimonial atualizado.');
    await carregarDadosCompletos();
    const updated = state.itens.find((i) => i.id === id);
    if (updated && state.dossieItem?.id === id) {
      await abrirDossieItem(updated);
    }
  } catch (err: any) {
    toast(err?.message || 'Erro ao atualizar cadastro do bem.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function exportarInventarioXlsx(): Promise<void> {
  try {
    const XLSX: any = await import('xlsx');
    const itensRows = sanitizeRowsForExport(
      getItensFiltrados().map((it) => ({
        'Código SMEB': it.codigo_unico,
        'Tombamento Prefeitura': it.tombamento_prefeitura || '',
        'Nº de Série': it.numero_serie || '',
        'Nome do Bem': it.nome_detalhado,
        Categoria: CATEGORIA_LABELS[it.categoria] || it.categoria,
        'Marca / Modelo': it.marca_modelo || '',
        Conservação: ESTADO_LABELS[it.estado_conservacao] || it.estado_conservacao,
        Status: STATUS_LABELS[it.status_item] || it.status_item,
        'Lotação Atual': it.lotacao_atual_nome,
        Ambiente: it.ambiente_detalhe || '',
        'Lotação Anterior': it.lotacao_anterior_nome || '',
        'Data Chegada Depósito': fmtDataBr(it.data_entrada_deposito),
        'Data Saída Depósito': fmtDataBr(it.data_saida_deposito),
        Responsável: it.responsavel_atual_nome || ''
      }))
    );

    const consRows = sanitizeRowsForExport(
      state.lotes
        .filter((l) => l.modo_rastreio === 'CONSUMIVEL_QUANTITATIVO')
        .map((l) => ({
          'Código Lote': l.codigo_lote,
          Material: l.nome_item,
          Categoria: CATEGORIA_LABELS[l.categoria] || l.categoria,
          Unidade: l.unidade_medida,
          'Qtd. Entrada': l.quantidade_entrada,
          'Saldo Depósito': l.saldo_atual_deposito,
          'Estoque Mínimo': l.estoque_minimo,
          'Data Entrada': fmtDataBr(l.data_entrada_deposito)
        }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itensRows), 'Itens Tombados');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consRows), 'Consumiveis');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Inventario_SMEB_CearaMirim_${stamp}.xlsx`);
    toast('Planilha XLSX exportada com sanitização de segurança.');
  } catch (err: any) {
    toast(err?.message || 'Falha ao exportar XLSX.', true);
  }
}

async function abrirPorCodigoDetectado(rawText: string): Promise<void> {
  const code = extrairCodigoDeLeituraQr(rawText);
  if (!code) return;
  closeModal('modalInventarioQrScanner');

  if (!temPerm('inventario.ver')) {
    await consultarQrPublico(code);
    return;
  }

  const found = state.itens.find((i) => i.codigo_unico.toUpperCase() === code || (i.tombamento_prefeitura || '').toUpperCase() === code);
  if (found) {
    await abrirDossieItem(found);
    return;
  }

  const searchInput = document.getElementById('invSearchInput') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = code;
    renderAllTables();
  }
  await consultarQrPublico(code);
  toast(`Código ${code} não localizado na lista local; filtro aplicado.`);
}

async function toggleCameraScanner(): Promise<void> {
  const video = document.getElementById('invScannerVideo') as HTMLVideoElement | null;
  const statusEl = document.getElementById('invScannerStatus');
  const btn = document.getElementById('btnInvScannerCameraToggle');
  if (!video || !btn) return;

  if (state.stopCameraFn) {
    pararCameraScanner();
    if (statusEl) statusEl.textContent = 'Câmera pausada.';
    return;
  }

  video.classList.remove('hidden');
  btn.textContent = 'Parar Câmera';
  if (statusEl) statusEl.textContent = 'Iniciando câmera... aponte para o QR Code.';

  state.stopCameraFn = await iniciarLeitorCameraQr(
    video,
    (codigo) => {
      state.stopCameraFn = null;
      if (statusEl) statusEl.textContent = `Código detectado: ${codigo}`;
      void abrirPorCodigoDetectado(codigo);
    },
    (errMsg) => {
      pararCameraScanner();
      if (statusEl) statusEl.textContent = errMsg;
    }
  );
}

function bindEventsOnce(): void {
  const page = document.getElementById('page-inventario');
  if (!page || page.dataset.invBound === '1') return;
  page.dataset.invBound = '1';

  document.querySelectorAll<HTMLElement>('[data-inv-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-inv-close-modal');
      if (target) closeModal(target);
    });
  });

  document.getElementById('btnInvPublicEntrar')?.addEventListener('click', () => {
    (window as any).OlymposApp?.solicitarLogin?.();
  });

  document.getElementById('invPublicQrSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (document.getElementById('invPublicQrInput') as HTMLInputElement | null)?.value || '';
    void consultarQrPublico(val);
  });

  document.getElementById('btnInvPublicAbrirScanner')?.addEventListener('click', () => {
    openModal('modalInventarioQrScanner');
  });

  document.getElementById('btnInvNovaEntrada')?.addEventListener('click', abrirModalEntrada);
  document.getElementById('btnInvRecarregar')?.addEventListener('click', () => void recarregar());
  document.getElementById('btnInvLerQr')?.addEventListener('click', () => {
    openModal('modalInventarioQrScanner');
    setTimeout(() => document.getElementById('invScannerInput')?.focus(), 80);
  });

  document.getElementById('btnInvImprimirQr')?.addEventListener('click', async () => {
    const selected = state.itens.filter((i) => state.selectedIds.has(i.id));
    const list = (selected.length > 0 ? selected : getItensFiltrados().slice(0, 30)).map((i) => ({
      codigo: i.codigo_unico,
      nome: i.nome_detalhado,
      categoria: CATEGORIA_LABELS[i.categoria] || i.categoria,
      lote: i.lote_id
    }));
    if (list.length === 0) {
      toast('Nenhum item disponível para gerar etiquetas QR.', true);
      return;
    }
    await abrirImpressaoEtiquetasQr(list);
  });

  document.getElementById('btnInvImprimirSelecionados')?.addEventListener('click', async () => {
    const selected = state.itens
      .filter((i) => state.selectedIds.has(i.id))
      .map((i) => ({
        codigo: i.codigo_unico,
        nome: i.nome_detalhado,
        categoria: CATEGORIA_LABELS[i.categoria] || i.categoria
      }));
    if (selected.length > 0) {
      await abrirImpressaoEtiquetasQr(selected);
    }
  });

  document.getElementById('btnInvExportarXlsx')?.addEventListener('click', () => void exportarInventarioXlsx());

  document.getElementById('btnInvAbrirPastaDrive')?.addEventListener('click', async () => {
    try {
      const res = await obterPastaDriveInventario();
      if (res?.folderUrl) {
        window.open(res.folderUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      toast(err?.message || 'Não foi possível localizar a pasta do Inventário no Drive.', true);
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-inv-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = (btn.dataset.invTab as 'itens' | 'consumiveis' | 'historico') || 'itens';
      switchTab(t);
    });
  });

  ['invSearchInput', 'invFilterStatus', 'invFilterCategoria', 'invFilterLotacao', 'invFilterEstado'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => renderAllTables());
    document.getElementById(id)?.addEventListener('change', () => renderAllTables());
  });

  document.getElementById('invCheckAll')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    const visiveis = getItensFiltrados();
    visiveis.forEach((it) => {
      if (checked) state.selectedIds.add(it.id);
      else state.selectedIds.delete(it.id);
    });
    renderTabelaItens();
  });

  document.getElementById('btnInvLimparSelecao')?.addEventListener('click', () => {
    state.selectedIds.clear();
    renderTabelaItens();
  });

  document.getElementById('btnInvMovimentarLote')?.addEventListener('click', () => {
    abrirModalMovimentar(Array.from(state.selectedIds));
  });

  document.getElementById('invItensTbody')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const check = target.closest('.inv-row-check') as HTMLInputElement | null;
    if (check) {
      const id = check.dataset.id || '';
      if (id) {
        if (check.checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
        atualizarBatchBar();
      }
      return;
    }

    const dossieBtn = target.closest('.inv-btn-dossie') as HTMLElement | null;
    if (dossieBtn) {
      const item = state.itens.find((i) => i.id === dossieBtn.dataset.id);
      if (item) void abrirDossieItem(item);
      return;
    }

    const moverBtn = target.closest('.inv-btn-mover') as HTMLElement | null;
    if (moverBtn && moverBtn.dataset.id) {
      abrirModalMovimentar([moverBtn.dataset.id]);
    }
  });

  document.getElementById('invLotesTbody')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const consBtn = target.closest('.inv-btn-cons-mov') as HTMLElement | null;
    if (consBtn && consBtn.dataset.loteId) {
      abrirModalConsumivel(consBtn.dataset.loteId);
      return;
    }
    const loteBtn = target.closest('.inv-btn-filtrar-lote') as HTMLElement | null;
    if (loteBtn && loteBtn.dataset.loteId) {
      const lote = state.lotes.find((l) => l.id === loteBtn.dataset.loteId);
      if (lote) {
        const search = document.getElementById('invSearchInput') as HTMLInputElement | null;
        if (search) search.value = lote.nome_item;
        switchTab('itens');
      }
    }
  });

  document.getElementById('invEntradaModo')?.addEventListener('change', atualizarCamposModoEntrada);
  document.getElementById('formInvEntrada')?.addEventListener('submit', (e) => void handleSubmitEntrada(e));

  document.getElementById('invMovTipo')?.addEventListener('change', (e) => {
    const tipo = (e.target as HTMLSelectElement).value;
    const destSel = document.getElementById('invMovDestinoTipo') as HTMLSelectElement | null;
    if (destSel) {
      const autoMap: Record<string, string> = {
        SAIDA_ESCOLA: 'ESCOLA',
        SAIDA_SETOR: 'SETOR_SEDE',
        RETORNO_DEPOSITO: 'DEPOSITO',
        ENVIO_MANUTENCAO: 'EXTERNO_MANUTENCAO',
        BAIXA_PATRIMONIAL: 'BAIXADO'
      };
      if (autoMap[tipo]) {
        destSel.value = autoMap[tipo];
        atualizarDestinoMovUI();
      }
    }
  });
  document.getElementById('invConsTipo')?.addEventListener('change', (e) => {
    const tipo = (e.target as HTMLSelectElement).value;
    const destTipo = document.getElementById('invConsDestinoTipo') as HTMLSelectElement | null;
    const destNome = document.getElementById('invConsDestinoNome') as HTMLInputElement | null;
    if (tipo === 'REPOSICAO_CONSUMIVEL') {
      if (destTipo) destTipo.value = 'DEPOSITO';
      if (destNome) destNome.value = 'Depósito Central SMEB';
    } else if (tipo === 'SAIDA_SETOR' && destTipo) {
      destTipo.value = 'SETOR_SEDE';
    } else if (tipo === 'SAIDA_ESCOLA' && destTipo) {
      destTipo.value = 'ESCOLA';
    }
  });
  document.getElementById('invMovDestinoTipo')?.addEventListener('change', atualizarDestinoMovUI);
  document.getElementById('invMovEscolaSelect')?.addEventListener('change', (e) => {
    const id = (e.target as HTMLSelectElement).value;
    const escRef = state.escolas.find((es) => es.id === id);
    const recEl = document.getElementById('invMovRecebidoPor') as HTMLInputElement | null;
    const cargoEl = document.getElementById('invMovRecebidoCargo') as HTMLInputElement | null;
    if (escRef && recEl && !recEl.value.trim() && escRef.diretor) {
      recEl.value = escRef.diretor;
      if (cargoEl && !cargoEl.value.trim()) {
        cargoEl.value = 'Diretor(a) Escolar';
      }
    }
  });
  document.getElementById('formInvMov')?.addEventListener('submit', (e) => void handleSubmitMovimentar(e));
  document.getElementById('formInvConsMov')?.addEventListener('submit', (e) => void handleSubmitConsumivel(e));

  document.getElementById('btnInvDossieImprimirQr')?.addEventListener('click', async () => {
    if (!state.dossieItem) return;
    await abrirImpressaoEtiquetasQr([
      {
        codigo: state.dossieItem.codigo_unico,
        nome: state.dossieItem.nome_detalhado,
        categoria: CATEGORIA_LABELS[state.dossieItem.categoria] || state.dossieItem.categoria
      }
    ]);
  });

  document.getElementById('btnInvDossieMovimentar')?.addEventListener('click', () => {
    if (!state.dossieItem) return;
    closeModal('modalInventarioDossie');
    abrirModalMovimentar([state.dossieItem.id]);
  });

  document.getElementById('btnInvDossieEditar')?.addEventListener('click', () => {
    if (!state.dossieItem) return;
    abrirModalEditarItem(state.dossieItem);
  });

  document.getElementById('formInvDossieAnexo')?.addEventListener('submit', (e) => void handleSubmitDossieAnexo(e));
  document.getElementById('formInvEditarItem')?.addEventListener('submit', (e) => void handleSubmitEditarItem(e));

  document.getElementById('formInvScannerManual')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (document.getElementById('invScannerInput') as HTMLInputElement | null)?.value || '';
    void abrirPorCodigoDetectado(val);
  });

  document.getElementById('btnInvScannerCameraToggle')?.addEventListener('click', () => void toggleCameraScanner());

  window.addEventListener('hashchange', () => {
    if (!String(window.location.hash || '').startsWith('#inventario')) return;
    const code = getHashQrCodigo();
    if (code && code !== state.lastQrHandled) {
      state.lastQrHandled = code;
      void abrirPorCodigoDetectado(code);
    }
  });
}

async function recarregar(): Promise<void> {
  const pubSec = document.getElementById('invPublicQrSection');
  const staffSec = document.getElementById('invStaffSection');
  const qrCodigo = getHashQrCodigo();

  const canView = temPerm('inventario.ver');
  if (pubSec) pubSec.classList.toggle('hidden', canView);
  if (staffSec) staffSec.classList.toggle('hidden', !canView);

  const badge = document.getElementById('invViewModeBadge');
  if (badge) {
    const canWrite = temPerm('inventario.cadastrar') || temPerm('inventario.movimentar');
    badge.textContent = canWrite ? 'Acesso Operacional (Cadastro & Movimentação)' : 'Acesso Somente Leitura';
  }

  (window as any).OlymposRbac?.aplicarAtributosPermissaoDom?.(document.getElementById('page-inventario'));

  if (!canView) {
    if (qrCodigo) {
      state.lastQrHandled = qrCodigo;
      await consultarQrPublico(qrCodigo);
    }
    return;
  }

  await Promise.all([carregarCatalogoEscolas(), carregarDadosCompletos()]);

  if (qrCodigo && qrCodigo !== state.lastQrHandled) {
    state.lastQrHandled = qrCodigo;
    const item = state.itens.find((i) => i.codigo_unico.toUpperCase() === qrCodigo);
    if (item) {
      await abrirDossieItem(item);
    } else {
      await consultarQrPublico(qrCodigo);
    }
  }
}

export async function mount(): Promise<void> {
  bindEventsOnce();
  state.mounted = true;

  const apiObj = {
    recarregar,
    abrirDossiePorCodigo: (codigo: string) => abrirPorCodigoDetectado(codigo),
    buscarQrPublico: (codigo: string) => consultarQrPublico(codigo)
  };

  (window as any).OlymposInventario = apiObj;
  (window as any).OlymposViews = (window as any).OlymposViews || {};
  (window as any).OlymposViews.inventario = apiObj;

  await recarregar();
}
