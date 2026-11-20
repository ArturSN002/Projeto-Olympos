import auditoriaHtml from '../templates/pages/auditoria.html?raw';

export const routeId = 'auditoria';
export const htmlTemplate = auditoriaHtml;

interface AuditLogRow {
  id: number;
  table_name: string;
  record_id?: string | null;
  action: string;
  performed_by?: string | null;
  role_at_action?: string | null;
  old_data?: unknown;
  new_data?: unknown;
  timestamp: string;
}

let logsCache: AuditLogRow[] = [];
let paginaAtual = 1;
const ITENS_POR_PAGINA = 20;

function esc(val: unknown): string {
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(val ?? ''));
  }
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isModeradorAtivo(): boolean {
  if (window.OlymposApp && typeof window.OlymposApp.isModerador === 'function') {
    return Boolean(window.OlymposApp.isModerador());
  }
  return false;
}

function renderTabela(): void {
  const tbody = document.getElementById('tabelaAuditoriaBody');
  if (!tbody) return;

  if (!logsCache.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center" style="padding:24px;">Nenhum evento encontrado para os filtros informados.</td></tr>';
    return;
  }

  const pag = window.OlymposPagination && typeof window.OlymposPagination.paginarLista === 'function'
    ? window.OlymposPagination.paginarLista(logsCache, paginaAtual, ITENS_POR_PAGINA)
    : { items: logsCache.slice(0, ITENS_POR_PAGINA), paginaAtual: 1, totalItens: logsCache.length };

  paginaAtual = pag.paginaAtual;

  tbody.innerHTML = pag.items
    .map((row: AuditLogRow) => {
      const ts = row.timestamp ? new Date(row.timestamp).toLocaleString('pt-BR', { timeZone: 'UTC' }) : '--';
      const diffPayload = JSON.stringify({ old: row.old_data ?? null, new: row.new_data ?? null }, null, 2);
      return (
        '<tr>' +
          `<td data-label="Data/Hora (UTC)"><code>${esc(ts)}</code></td>` +
          `<td data-label="Ação"><span class="pill-badge pill-gold">${esc(row.action)}</span></td>` +
          `<td data-label="Tabela / Recurso"><code>${esc(row.table_name)}</code></td>` +
          `<td data-label="Ator / Papel">${esc(row.role_at_action || 'N/I')}<br><small class="text-muted">${esc(row.performed_by || 'sistema')}</small></td>` +
          `<td data-label="Detalhes (Diff JSON)"><details><summary style="cursor:pointer; font-size:12px;">Ver JSON</summary><pre class="audit-json-diff">${esc(diffPayload)}</pre></details></td>` +
        '</tr>'
      );
    })
    .join('');

  if (window.OlymposPagination && typeof window.OlymposPagination.renderizarControles === 'function') {
    window.OlymposPagination.renderizarControles({
      barEl: 'auditoriaPaginacaoBar',
      containers: 'auditoriaPaginacaoControles',
      infoEl: 'auditoriaPaginacaoInfo',
      totalItens: logsCache.length,
      paginaAtual,
      itensPorPagina: ITENS_POR_PAGINA,
      rotuloItem: 'eventos auditados',
      ocultarSePaginaUnica: true,
      onPageChange: (nova: number) => {
        paginaAtual = nova;
        renderTabela();
      }
    });
  }
}

async function carregarLogs(): Promise<void> {
  const negadoEl = document.getElementById('auditoriaAcessoNegado');
  const painelEl = document.getElementById('auditoriaPainelConteudo');
  const tbody = document.getElementById('tabelaAuditoriaBody');

  const autorizado = isModeradorAtivo();
  if (negadoEl) negadoEl.classList.toggle('hidden', autorizado);
  if (painelEl) painelEl.classList.toggle('hidden', !autorizado);
  if (!autorizado) return;

  const client = window.OlymposSupabase && typeof window.OlymposSupabase.getClient === 'function'
    ? window.OlymposSupabase.getClient()
    : null;
  if (!client || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center" style="padding:24px;">Consultando trilha de auditoria no Supabase...</td></tr>';

  const acao = (document.getElementById('auditoriaFiltroAcao') as HTMLSelectElement | null)?.value.trim() || '';
  const tabela = (document.getElementById('auditoriaFiltroTabela') as HTMLInputElement | null)?.value.trim() || '';
  const dataInicio = (document.getElementById('auditoriaFiltroDataInicio') as HTMLInputElement | null)?.value || '';
  const dataFim = (document.getElementById('auditoriaFiltroDataFim') as HTMLInputElement | null)?.value || '';

  try {
    let query = client
      .from('audit_logs')
      .select('id, table_name, record_id, action, performed_by, role_at_action, old_data, new_data, timestamp')
      .order('timestamp', { ascending: false })
      .limit(250);

    if (acao) query = query.eq('action', acao);
    if (tabela) query = query.ilike('table_name', `%${tabela}%`);
    if (dataInicio) query = query.gte('timestamp', `${dataInicio}T00:00:00Z`);
    if (dataFim) query = query.lte('timestamp', `${dataFim}T23:59:59Z`);

    const { data, error } = await query;
    if (error) throw error;

    logsCache = (data || []) as AuditLogRow[];
    paginaAtual = 1;
    renderTabela();
  } catch (err: any) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px; color:var(--danger, #ef4444);">Falha ao consultar audit_logs (verifique se MFA aal2 está ativo): ${esc(err?.message || err)}</td></tr>`;
  }
}

function exportarCsv(): void {
  if (!isModeradorAtivo() || !logsCache.length) return;
  const header = ['id', 'timestamp', 'action', 'table_name', 'role_at_action', 'performed_by', 'record_id'];
  const csvRows = [header.join(';')];
  for (const r of logsCache) {
    csvRows.push([
      r.id,
      r.timestamp,
      r.action,
      r.table_name,
      r.role_at_action || '',
      r.performed_by || '',
      r.record_id || ''
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  }
  const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `audit_logs_olympos_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

function bindEvents(): void {
  const bind = (id: string, evt: string, fn: () => void) => {
    const el = document.getElementById(id) as any;
    if (el && !el._boundAudit) {
      el._boundAudit = true;
      el.addEventListener(evt, fn);
    }
  };
  bind('auditoriaAtualizarBtn', 'click', carregarLogs);
  bind('auditoriaExportarCsvBtn', 'click', exportarCsv);
  bind('auditoriaFiltroAcao', 'change', carregarLogs);
  bind('auditoriaFiltroTabela', 'change', carregarLogs);
  bind('auditoriaFiltroDataInicio', 'change', carregarLogs);
  bind('auditoriaFiltroDataFim', 'change', carregarLogs);
}

const auditoriaView = {
  init() {
    bindEvents();
    carregarLogs();
  },
  carregarLogs,
  exportarCsv
};

if (typeof window !== 'undefined') {
  window.OlymposViews = window.OlymposViews || {};
  window.OlymposViews.auditoria = auditoriaView;
}

export async function mount(): Promise<void> {
  // controlador registrado acima
}
