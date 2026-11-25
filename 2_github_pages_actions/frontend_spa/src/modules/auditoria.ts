import '../styles/onda2.css';
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

export interface BackupRunRow {
  id: number;
  tipo: 'SUPABASE_DR' | 'MEMORIAS_22' | string;
  status: 'OK' | 'ERRO' | 'ALERTA' | string;
  arquivo_nome: string;
  tamanho_bytes: number | null;
  checksum_sha256: string | null;
  detalhes_json: unknown;
  executado_em: string;
}

let logsCache: AuditLogRow[] = [];
let backupRunsCache: BackupRunRow[] = [];
let auditSortBy: 'timestamp_desc' | 'timestamp_asc' | 'action_asc' | 'action_desc' | 'table_name_asc' | 'table_name_desc' | 'role_at_action_asc' | 'role_at_action_desc' = 'timestamp_desc';
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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isModeradorAtivo(): boolean {
  if (window.OlymposApp && typeof window.OlymposApp.isModerador === 'function') {
    return Boolean(window.OlymposApp.isModerador());
  }
  return false;
}

function getSupabaseClient(): any {
  return window.OlymposSupabase && typeof window.OlymposSupabase.getClient === 'function'
    ? window.OlymposSupabase.getClient()
    : null;
}

function formatarBytes(bytes: number | null | undefined): string {
  const n = Number(bytes || 0);
  if (!n || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB (${n.toLocaleString('pt-BR')} B)`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB (${n.toLocaleString('pt-BR')} B)`;
}

function formatarUtc(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'UTC' });
}

function ordenarLogsCache(): AuditLogRow[] {
  const cmp = (a: unknown, b: unknown) =>
    String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
  const copy = logsCache.slice();
  copy.sort((a, b) => {
    switch (auditSortBy) {
      case 'timestamp_asc':
        return Date.parse(a.timestamp || '') - Date.parse(b.timestamp || '');
      case 'action_asc':
        return cmp(a.action, b.action) || (Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''));
      case 'action_desc':
        return cmp(b.action, a.action) || (Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''));
      case 'table_name_asc':
        return cmp(a.table_name, b.table_name) || (Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''));
      case 'table_name_desc':
        return cmp(b.table_name, a.table_name) || (Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''));
      case 'role_at_action_asc':
        return cmp(a.role_at_action, b.role_at_action) || (Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''));
      case 'role_at_action_desc':
        return cmp(b.role_at_action, a.role_at_action) || (Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''));
      case 'timestamp_desc':
      default:
        return Date.parse(b.timestamp || '') - Date.parse(a.timestamp || '');
    }
  });
  return copy;
}

function atualizarIndicadoresAudit(): void {
  const tbl = document.getElementById('tabelaAuditoriaLogs');
  if (!tbl) return;
  const dirDesc = auditSortBy.endsWith('_desc');
  const colAtiva = auditSortBy.replace(/_(?:asc|desc)$/, '');
  tbl.querySelectorAll<HTMLElement>('th[data-audit-sort]').forEach((th) => {
    const col = th.getAttribute('data-audit-sort') || '';
    const ind = th.querySelector('.th-sort-indicator');
    if (col === colAtiva) {
      th.setAttribute('aria-sort', dirDesc ? 'descending' : 'ascending');
      if (ind) ind.textContent = dirDesc ? '▼' : '▲';
    } else {
      th.setAttribute('aria-sort', 'none');
      if (ind) ind.textContent = '↕';
    }
  });
}

function renderTabela(): void {
  const tbody = document.getElementById('tabelaAuditoriaBody');
  if (!tbody) return;

  const ordenados = ordenarLogsCache();
  atualizarIndicadoresAudit();

  if (!ordenados.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center" style="padding:24px;">Nenhum evento encontrado para os filtros informados.</td></tr>';
    return;
  }

  const pag = window.OlymposPagination && typeof window.OlymposPagination.paginarLista === 'function'
    ? window.OlymposPagination.paginarLista(ordenados, paginaAtual, ITENS_POR_PAGINA)
    : { items: ordenados.slice(0, ITENS_POR_PAGINA), paginaAtual: 1, totalItens: ordenados.length };

  paginaAtual = pag.paginaAtual;

  tbody.innerHTML = pag.items
    .map((row: AuditLogRow) => {
      const ts = formatarUtc(row.timestamp);
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

  const client = getSupabaseClient();
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

function renderBackupRuns(): void {
  const tbody = document.getElementById('tabelaBackupRunsBody');
  const kpiSup = document.getElementById('drKpiUltimoSupabase');
  const kpiMem = document.getElementById('drKpiUltimoMemorias');

  const ultimoSup = backupRunsCache.find((b) => b.tipo === 'SUPABASE_DR');
  const ultimoMem = backupRunsCache.find((b) => b.tipo === 'MEMORIAS_22');

  if (kpiSup) {
    kpiSup.textContent = ultimoSup
      ? `${ultimoSup.status} • ${formatarUtc(ultimoSup.executado_em)}`
      : 'Sem registros';
  }
  if (kpiMem) {
    kpiMem.textContent = ultimoMem
      ? `${ultimoMem.status} • ${formatarUtc(ultimoMem.executado_em)}`
      : 'Sem registros';
  }

  if (!tbody) return;
  if (!backupRunsCache.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding:24px;">Nenhuma execução de backup encontrada em public.backup_runs.</td></tr>';
    return;
  }

  tbody.innerHTML = backupRunsCache
    .map((b) => {
      const badgeCls = b.status === 'OK' ? 'pill-green' : b.status === 'ALERTA' ? 'pill-amber' : 'pill-red';
      const sha = b.checksum_sha256 ? String(b.checksum_sha256) : '';
      const shaCurto = sha ? `${sha.slice(0, 14)}…` : '--';
      const detalhes = JSON.stringify(b.detalhes_json ?? {}, null, 2);

      return (
        '<tr>' +
          `<td data-label="Tipo"><span class="pill-badge pill-blue">${esc(b.tipo)}</span></td>` +
          `<td data-label="Status"><span class="pill-badge ${badgeCls}">${esc(b.status)}</span></td>` +
          `<td data-label="Arquivo"><code>${esc(b.arquivo_nome)}</code></td>` +
          `<td data-label="Tamanho">${esc(formatarBytes(b.tamanho_bytes))}</td>` +
          `<td data-label="Checksum SHA-256"><code title="${esc(sha)}">${esc(shaCurto)}</code></td>` +
          `<td data-label="Executado em (UTC)"><code>${esc(formatarUtc(b.executado_em))}</code></td>` +
          `<td data-label="Detalhes (JSON)"><details><summary style="cursor:pointer; font-size:12px;">Ver JSON</summary><pre class="audit-json-diff">${esc(detalhes)}</pre></details></td>` +
        '</tr>'
      );
    })
    .join('');
}

export async function carregarBackupRuns(): Promise<void> {
  if (!isModeradorAtivo()) return;
  const client = getSupabaseClient();
  const tbody = document.getElementById('tabelaBackupRunsBody');
  if (!client || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding:24px;">Consultando histórico de backups em public.backup_runs...</td></tr>';

  try {
    const { data, error } = await client
      .from('backup_runs')
      .select('id, tipo, status, arquivo_nome, tamanho_bytes, checksum_sha256, detalhes_json, executado_em')
      .order('executado_em', { ascending: false })
      .limit(50);

    if (error) throw error;
    backupRunsCache = (data || []) as BackupRunRow[];
    renderBackupRuns();
  } catch (err: any) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:24px; color:var(--danger, #ef4444);">Falha ao consultar backup_runs: ${esc(err?.message || err)}</td></tr>`;
  }
}

export async function executarVerificacaoAnomalias(): Promise<void> {
  if (!isModeradorAtivo()) return;
  const client = getSupabaseClient();
  const btn = document.getElementById('btnVerificarAnomaliasAgora') as HTMLButtonElement | null;
  const box = document.getElementById('drAnomaliasResultadoBox');
  const kpi = document.getElementById('drKpiAnomaliasStatus');
  if (!client) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verificando anomalias...';
  }

  try {
    const { data, error } = await client.rpc('verificar_anomalias_operacionais');
    if (error) throw error;

    const total = Number(data?.anomalias_detectadas ?? 0);
    const anomalias = Array.isArray(data?.anomalias) ? data.anomalias : [];
    const metricas = data?.metricas || {};

    if (kpi) {
      kpi.textContent = total > 0 ? `${total} anomalia(s) detectada(s)` : 'Saudável (0 anomalias)';
      kpi.style.color = total > 0 ? 'var(--danger, #F87171)' : 'var(--success, #34D399)';
    }

    if (box) {
      box.classList.remove('hidden', 'has-anomalies', 'is-healthy');
      box.classList.add(total > 0 ? 'has-anomalies' : 'is-healthy');

      const metricasHtml =
        `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">` +
          `Falhas AUTH/FORBIDDEN (15min): <strong>${esc(metricas.auth_fail_15min ?? 0)}</strong> • ` +
          `Revelações PII (10min): <strong>${esc(metricas.pii_reveal_10min ?? 0)}</strong> • ` +
          `Último SUPABASE_DR OK: <strong>${esc(formatarUtc(metricas.ultimo_supabase_dr_ok))}</strong>` +
        '</div>';

      const listaHtml = anomalias.length
        ? `<ul style="margin:8px 0 0; padding-left:18px; font-size:0.82rem;">` +
          anomalias
            .map((a: any) => {
              const desc = a.mensagem || JSON.stringify(a);
              return `<li><strong>[${esc(a.severidade || 'CRITICO')}] ${esc(a.codigo || 'ANOMALIA')}</strong>: ${esc(desc)}</li>`;
            })
            .join('') +
          '</ul>'
        : '<div style="font-size:0.82rem; margin-top:4px;">Todos os indicadores operacionais e backups estão dentro dos parâmetros esperados.</div>';

      box.innerHTML =
        `<div style="font-weight:700; font-size:0.88rem;">Verificação concluída (${esc(formatarUtc(data?.verificado_em))})</div>` +
        metricasHtml +
        listaHtml;
    }

    window.OlymposNotifications?.refresh?.();
    window.OlymposApp?.showToast?.(
      total > 0
        ? `Atenção: ${total} anomalia(s) operacional(is) detectada(s) e registrada(s) no Sino.`
        : 'Auditoria de Saúde DR concluída sem anomalias!',
      total > 0
    );
  } catch (err: any) {
    if (box) {
      box.classList.remove('hidden', 'is-healthy');
      box.classList.add('has-anomalies');
      box.textContent = `Falha ao executar verificar_anomalias_operacionais: ${err?.message || err}`;
    }
    window.OlymposApp?.showToast?.(`Erro ao verificar anomalias: ${err?.message || 'falha'}`, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Verificar Anomalias Agora';
    }
  }
}

export function alternarSubtabAuditoria(tab: 'logs' | 'saude-dr'): void {
  const btnLogs = document.getElementById('subtabBtnAuditoriaLogs');
  const btnDr = document.getElementById('subtabBtnAuditoriaSaudeDr');
  const paneLogs = document.getElementById('auditoriaSubpaneLogs');
  const paneDr = document.getElementById('auditoriaSubpaneSaudeDr');
  const isDr = tab === 'saude-dr';

  if (btnLogs) {
    btnLogs.classList.toggle('active', !isDr);
    btnLogs.setAttribute('aria-selected', !isDr ? 'true' : 'false');
  }
  if (btnDr) {
    btnDr.classList.toggle('active', isDr);
    btnDr.setAttribute('aria-selected', isDr ? 'true' : 'false');
  }
  if (paneLogs) paneLogs.classList.toggle('hidden', isDr);
  if (paneDr) paneDr.classList.toggle('hidden', !isDr);

  if (isDr) {
    void carregarBackupRuns();
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
  bind('subtabBtnAuditoriaLogs', 'click', () => alternarSubtabAuditoria('logs'));
  bind('subtabBtnAuditoriaSaudeDr', 'click', () => alternarSubtabAuditoria('saude-dr'));
  bind('btnAtualizarBackupRuns', 'click', () => { void carregarBackupRuns(); });
  bind('btnVerificarAnomaliasAgora', 'click', () => { void executarVerificacaoAnomalias(); });

  const tblAudit = document.getElementById('tabelaAuditoriaLogs') as any;
  if (tblAudit && !tblAudit._auditSortBound) {
    tblAudit._auditSortBound = true;
    tblAudit.querySelectorAll('th[data-audit-sort]').forEach((th: HTMLElement) => {
      const toggleAudit = () => {
        const col = th.getAttribute('data-audit-sort') || 'timestamp';
        const defDir = col === 'timestamp' ? 'desc' : 'asc';
        if (auditSortBy === `${col}_asc`) auditSortBy = `${col}_desc` as any;
        else if (auditSortBy === `${col}_desc`) auditSortBy = `${col}_asc` as any;
        else auditSortBy = `${col}_${defDir}` as any;
        paginaAtual = 1;
        renderTabela();
      };
      th.addEventListener('click', toggleAudit);
      th.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggleAudit();
        }
      });
    });
  }
}

const auditoriaView = {
  init() {
    bindEvents();
    carregarLogs();
  },
  carregarLogs,
  exportarCsv,
  carregarBackupRuns,
  executarVerificacaoAnomalias,
  alternarSubtab: alternarSubtabAuditoria
};

if (typeof window !== 'undefined') {
  window.OlymposViews = window.OlymposViews || {};
  window.OlymposViews.auditoria = auditoriaView;
}

export async function mount(): Promise<void> {
  bindEvents();
}
