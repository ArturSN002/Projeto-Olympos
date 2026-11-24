/**
 * Onda 1 (Sprint 1.1 — Item 7): Tabela Reutilizável do Acervo Emitido (Ofícios & Portarias)
 * Consulta paginada no Supabase (`public.documentos_emitidos`) + sincronização incremental Drive.
 */

export interface DocumentoEmitidoRow {
  id: number;
  drive_file_id: string;
  tipo: 'OFICIO' | 'PORTARIA';
  subcategoria: string;
  pasta_drive_id: string;
  setor_codigo?: string | null;
  sigla_setor?: string | null;
  numero: number | null;
  ano: number | null;
  nome_arquivo: string;
  assunto_ou_titulo: string | null;
  destinatario_ou_servidor: string | null;
  mime_type: string | null;
  drive_url: string;
  pdf_export_url: string | null;
  criado_em: string | null;
  modificado_em: string | null;
  sincronizado_em: string;
}

export type AcervoSortKey =
  | 'data_desc'
  | 'data_asc'
  | 'nome_asc'
  | 'nome_desc'
  | 'numero_desc'
  | 'numero_asc';

export interface AcervoMountConfig {
  containerId: string;
  tipo: 'OFICIO' | 'PORTARIA';
  showSubcategoriaFilter?: boolean;
}

interface AcervoInstanceState {
  config: AcervoMountConfig;
  page: number;
  pageSize: number;
  total: number;
  searchTerm: string;
  subcategoria: string;
  setorFiltro: string;
  supportsSetorCols: boolean;
  mesFiltro: string;
  sortBy: AcervoSortKey;
  loading: boolean;
  syncing: boolean;
  errorMsg: string;
  items: DocumentoEmitidoRow[];
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

const instances = new Map<string, AcervoInstanceState>();

const SUBCATEGORIA_LABELS: Record<string, string> = {
  GERAL: 'Geral',
  LICENCA: 'Licença',
  LICENCA_PUBLICADA: 'Licença Publicada',
  READAPTACAO: 'Readaptação',
  FEMURN_PUBLICADA: 'FEMURN Publicada'
};

function esc(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(val));
  }
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizarUrlSegura(url: string | null | undefined): string {
  const raw = String(url || '').trim();
  if (/^https:\/\//i.test(raw)) return raw;
  return '';
}

function formatarDataHoraCurta(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function montarShellAcervo(root: HTMLElement, st: AcervoInstanceState): void {
  const tipo = st.config.tipo;
  const prefix = `acervo-${tipo.toLowerCase()}`;
  const isPortaria = tipo === 'PORTARIA';
  const rbac = (window as any).OlymposRbac;
  const canViewAllSectors = Boolean(
    rbac && (rbac.isModerador?.() || rbac.temPermissao?.('oficios.ver_todos_setores'))
  );
  const meuSetor = (rbac && rbac.getSetorAtual?.()) || 'GABINETE';
  if (!isPortaria && !canViewAllSectors) {
    st.setorFiltro = meuSetor === 'MODERADOR' ? 'TODOS' : meuSetor;
  }

  root.innerHTML =
    '<div class="acervo-toolbar">' +
      '<div class="acervo-filters">' +
        `<input type="search" id="${prefix}-search" class="input-clean acervo-search-input" placeholder="Buscar por nº, arquivo, servidor ou assunto..." autocomplete="off" aria-label="Buscar documentos emitidos" />` +
        (!isPortaria && canViewAllSectors
          ? `<select id="${prefix}-setor" class="input-clean acervo-select" aria-label="Filtrar ofícios por setor">` +
              '<option value="TODOS">Todos os Setores (9)</option>' +
              '<option value="GABINETE">Gabinete (GS)</option>' +
              '<option value="PEDAGOGICO">Pedagógico (PED)</option>' +
              '<option value="ADMINISTRATIVO">Administrativo (ADM)</option>' +
              '<option value="JURIDICO">Assessoria Jurídica (JUR)</option>' +
              '<option value="NUTRICAO">Nutrição (NUT)</option>' +
              '<option value="RECURSOS_HUMANOS">Recursos Humanos (RH)</option>' +
              '<option value="TRANSPORTE_ESCOLAR">Transporte Escolar (TRANS)</option>' +
              '<option value="FINANCEIRO_TESOURARIA">Financeiro e Tesouraria (FIN)</option>' +
              '<option value="ENGENHARIA">Engenharia (ENG)</option>' +
            '</select>'
          : '') +
        (st.config.showSubcategoriaFilter
          ? `<select id="${prefix}-subcat" class="input-clean acervo-select" aria-label="Filtrar subcategoria">` +
              '<option value="TODAS">Todas as Pastas 2026</option>' +
              '<option value="GERAL">Portarias Gerais</option>' +
              '<option value="LICENCA">Licenças (Ativas)</option>' +
              '<option value="LICENCA_PUBLICADA">Licenças Publicadas</option>' +
              '<option value="READAPTACAO">Readaptações</option>' +
              '<option value="FEMURN_PUBLICADA">Publicadas na FEMURN</option>' +
            '</select>'
          : '') +
        `<input type="month" id="${prefix}-month" class="input-clean acervo-month-input" aria-label="Filtrar por mês e ano" title="Filtrar por mês de emissão" />` +
        `<select id="${prefix}-sort" class="input-clean acervo-select acervo-sort-select" aria-label="Ordenar documentos" title="Ordenar acervo">` +
          '<option value="data_desc">Data (mais recentes)</option>' +
          '<option value="data_asc">Data (mais antigos)</option>' +
          '<option value="nome_asc">Nome (A → Z)</option>' +
          '<option value="nome_desc">Nome (Z → A)</option>' +
          '<option value="numero_desc">Número (maior → menor)</option>' +
          '<option value="numero_asc">Número (menor → maior)</option>' +
        '</select>' +
      '</div>' +
      '<div class="acervo-actions-bar">' +
        `<button type="button" id="${prefix}-refresh-btn" class="btn btn-ghost btn-sm">Atualizar</button>` +
        `<button type="button" id="${prefix}-sync-btn" class="btn btn-secondary btn-sm">Sincronizar Drive agora</button>` +
      '</div>' +
    '</div>' +
    `<div id="${prefix}-status" class="acervo-status-line" aria-live="polite"></div>` +
    `<div id="${prefix}-table-wrap" class="table-wrapper acervo-table-wrap">` +
      '<div class="output-panel">Carregando índice de documentos...</div>' +
    '</div>' +
    `<div id="${prefix}-pagination" class="olympos-pagination-bar hidden">` +
      `<span id="${prefix}-pag-info" class="olympos-pagination-info"></span>` +
      `<div id="${prefix}-pag-controls" class="olympos-pagination-controls"></div>` +
    '</div>';

  const searchEl = document.getElementById(`${prefix}-search`) as HTMLInputElement | null;
  const setorEl = document.getElementById(`${prefix}-setor`) as HTMLSelectElement | null;
  const subcatEl = document.getElementById(`${prefix}-subcat`) as HTMLSelectElement | null;
  const monthEl = document.getElementById(`${prefix}-month`) as HTMLInputElement | null;
  const sortEl = document.getElementById(`${prefix}-sort`) as HTMLSelectElement | null;
  const refreshBtn = document.getElementById(`${prefix}-refresh-btn`);
  const syncBtn = document.getElementById(`${prefix}-sync-btn`);
  const tableWrap = document.getElementById(`${prefix}-table-wrap`);

  if (setorEl) {
    setorEl.value = st.setorFiltro || 'TODOS';
    setorEl.addEventListener('change', () => {
      st.setorFiltro = setorEl.value || 'TODOS';
      st.page = 1;
      void consultarDocumentos(st);
    });
  }

  if (searchEl) {
    searchEl.value = st.searchTerm;
    searchEl.addEventListener('input', () => {
      if (st.debounceTimer) clearTimeout(st.debounceTimer);
      st.debounceTimer = setTimeout(() => {
        st.searchTerm = searchEl.value.trim();
        st.page = 1;
        void consultarDocumentos(st);
      }, 250);
    });
  }

  if (subcatEl) {
    subcatEl.value = st.subcategoria;
    subcatEl.addEventListener('change', () => {
      st.subcategoria = subcatEl.value || 'TODAS';
      st.page = 1;
      void consultarDocumentos(st);
    });
  }

  if (monthEl) {
    monthEl.value = st.mesFiltro;
    monthEl.addEventListener('change', () => {
      st.mesFiltro = monthEl.value || '';
      st.page = 1;
      void consultarDocumentos(st);
    });
  }

  if (sortEl) {
    sortEl.value = st.sortBy;
    sortEl.addEventListener('change', () => {
      st.sortBy = (sortEl.value as AcervoSortKey) || 'data_desc';
      st.page = 1;
      void consultarDocumentos(st);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      void consultarDocumentos(st);
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      executarSyncDrive(st);
    });
  }

  if (tableWrap) {
    tableWrap.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      const sortBtn = target?.closest?.('[data-acervo-sort-col]') as HTMLElement | null;
      if (sortBtn) {
        const col = sortBtn.getAttribute('data-acervo-sort-col');
        if (col === 'numero') {
          st.sortBy = st.sortBy === 'numero_desc' ? 'numero_asc' : 'numero_desc';
        } else if (col === 'nome') {
          st.sortBy = st.sortBy === 'nome_asc' ? 'nome_desc' : 'nome_asc';
        } else if (col === 'data') {
          st.sortBy = st.sortBy === 'data_desc' ? 'data_asc' : 'data_desc';
        }
        if (sortEl) sortEl.value = st.sortBy;
        st.page = 1;
        void consultarDocumentos(st);
        return;
      }

      const copyBtn = target?.closest?.('[data-copy-doc-url]') as HTMLElement | null;
      if (copyBtn) {
        const url = copyBtn.getAttribute('data-copy-doc-url') || '';
        const titulo = copyBtn.getAttribute('data-copy-doc-label') || 'link do documento';
        if (url && window.OlymposApp && typeof window.OlymposApp.copiarTexto === 'function') {
          window.OlymposApp.copiarTexto(url, titulo);
        } else if (url && navigator.clipboard) {
          navigator.clipboard.writeText(url).catch(() => {});
        }
      }
    });
  }

  if (isPortaria && subcatEl) {
    subcatEl.title = 'Filtrar pasta oficial de portarias 2026';
  }
}

function renderizarTabela(st: AcervoInstanceState): void {
  const prefix = `acervo-${st.config.tipo.toLowerCase()}`;
  const statusEl = document.getElementById(`${prefix}-status`);
  const wrapEl = document.getElementById(`${prefix}-table-wrap`);
  const pagBar = document.getElementById(`${prefix}-pagination`);
  const pagInfo = document.getElementById(`${prefix}-pag-info`);
  const pagControls = document.getElementById(`${prefix}-pag-controls`);

  if (!wrapEl) return;

  if (st.loading) {
    if (statusEl) statusEl.textContent = 'Consultando índice oficial...';
    wrapEl.innerHTML = '<div class="output-panel">Carregando registros do acervo...</div>';
    return;
  }

  if (st.errorMsg) {
    if (statusEl) statusEl.textContent = st.errorMsg;
    wrapEl.innerHTML = `<div class="output-panel" style="color: var(--danger);">${esc(st.errorMsg)}</div>`;
    if (pagBar) pagBar.classList.add('hidden');
    return;
  }

  if (statusEl) {
    statusEl.textContent = `${st.total} documento(s) indexado(s) • Página ${st.page} de ${Math.max(1, Math.ceil(st.total / st.pageSize))}`;
  }

  if (!st.items || st.items.length === 0) {
    wrapEl.innerHTML =
      '<div class="output-panel">' +
        'Nenhum documento encontrado para os filtros atuais. ' +
        'Se as pastas ainda não foram indexadas hoje, clique em <strong>Sincronizar Drive agora</strong>.' +
      '</div>';
    if (pagBar) pagBar.classList.add('hidden');
    return;
  }

  const showSubcat = st.config.tipo === 'PORTARIA';
  const showSetorCol = st.config.tipo === 'OFICIO' && st.supportsSetorCols;
  const sortArrow = (col: 'numero' | 'nome' | 'data'): string => {
    if (st.sortBy === `${col}_asc`) return ' ↑';
    if (st.sortBy === `${col}_desc`) return ' ↓';
    return '';
  };

  let html = '<table class="clean-table table-responsive-cards" style="font-size: 13px;">';
  html += '<thead><tr>' +
    `<th style="width: 104px;"><button type="button" class="acervo-sort-th-btn" data-acervo-sort-col="numero" title="Ordenar por número">Nº / Ano${sortArrow('numero')}</button></th>` +
    (showSubcat ? '<th style="width: 150px;">Pasta</th>' : '') +
    (showSetorCol ? '<th style="width: 110px;">Setor</th>' : '') +
    `<th><button type="button" class="acervo-sort-th-btn" data-acervo-sort-col="nome" title="Ordenar por nome">Documento &amp; Destinatário / Assunto${sortArrow('nome')}</button></th>` +
    `<th style="width: 118px;"><button type="button" class="acervo-sort-th-btn" data-acervo-sort-col="data" title="Ordenar por data">Data${sortArrow('data')}</button></th>` +
    '<th class="text-right" style="width: 245px;">Ações</th>' +
  '</tr></thead><tbody>';

  for (const row of st.items) {
    const numFmt = row.numero !== null && row.numero !== undefined
      ? `${String(row.numero).padStart(3, '0')}/${row.ano || 2026}`
      : `--/${row.ano || 2026}`;
    const subcatLbl = SUBCATEGORIA_LABELS[row.subcategoria] || row.subcategoria;
    const siglaSetorLbl = row.sigla_setor || row.setor_codigo || 'GS';
    const docsUrl = sanitizarUrlSegura(row.drive_url);
    const fallbackPdf = row.drive_file_id
      ? `https://docs.google.com/document/d/${encodeURIComponent(row.drive_file_id)}/export?format=pdf`
      : '';
    const pdfUrl = sanitizarUrlSegura(row.pdf_export_url || fallbackPdf);
    const dataFmt = formatarDataHoraCurta(row.modificado_em || row.criado_em || row.sincronizado_em);
    const detalheSec = [row.destinatario_ou_servidor, row.assunto_ou_titulo]
      .filter((v) => Boolean(v && String(v).trim()))
      .join(' • ');

    html += '<tr>' +
      `<td data-label="Nº / Ano"><code>${esc(numFmt)}</code></td>` +
      (showSubcat ? `<td data-label="Pasta"><span class="pill-badge pill-blue" style="font-size:11px;">${esc(subcatLbl)}</span></td>` : '') +
      (showSetorCol ? `<td data-label="Setor"><span class="setor-pill" style="font-size:11px;">${esc(siglaSetorLbl)}</span></td>` : '') +
      '<td data-label="Documento">' +
        `<div style="font-weight: 600; color: var(--text-main); word-break: break-word;">${esc(row.nome_arquivo)}</div>` +
        (detalheSec ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${esc(detalheSec)}</div>` : '') +
      '</td>' +
      `<td data-label="Data">${esc(dataFmt)}</td>` +
      '<td data-label="Ações" class="text-right">' +
        '<div style="display: inline-flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;">' +
          (docsUrl ? `<a href="${esc(docsUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Abrir Docs</a>` : '') +
          (pdfUrl ? `<a href="${esc(pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm">PDF</a>` : '') +
          (docsUrl ? `<button type="button" class="btn btn-ghost btn-sm" data-copy-doc-url="${esc(docsUrl)}" data-copy-doc-label="${esc(row.nome_arquivo)}">Copiar Link</button>` : '') +
        '</div>' +
      '</td>' +
    '</tr>';
  }
  html += '</tbody></table>';
  wrapEl.innerHTML = html;

  const totalPages = Math.max(1, Math.ceil(st.total / st.pageSize));
  if (pagBar && pagInfo && pagControls) {
    if (st.total <= st.pageSize) {
      pagBar.classList.add('hidden');
    } else {
      pagBar.classList.remove('hidden');
      const startItem = (st.page - 1) * st.pageSize + 1;
      const endItem = Math.min(st.total, st.page * st.pageSize);
      pagInfo.textContent = `Exibindo ${startItem}–${endItem} de ${st.total} documento(s)`;
      pagControls.innerHTML = '';

      const btnPrev = document.createElement('button');
      btnPrev.type = 'button';
      btnPrev.className = 'btn btn-secondary btn-mini';
      btnPrev.textContent = 'Anterior';
      btnPrev.disabled = st.page <= 1;
      btnPrev.addEventListener('click', () => {
        if (st.page > 1) {
          st.page--;
          void consultarDocumentos(st);
        }
      });

      const pageSpan = document.createElement('span');
      pageSpan.style.fontSize = '12px';
      pageSpan.style.fontFamily = 'var(--font-mono)';
      pageSpan.textContent = ` ${st.page} / ${totalPages} `;

      const btnNext = document.createElement('button');
      btnNext.type = 'button';
      btnNext.className = 'btn btn-secondary btn-mini';
      btnNext.textContent = 'Próxima';
      btnNext.disabled = st.page >= totalPages;
      btnNext.addEventListener('click', () => {
        if (st.page < totalPages) {
          st.page++;
          void consultarDocumentos(st);
        }
      });

      pagControls.appendChild(btnPrev);
      pagControls.appendChild(pageSpan);
      pagControls.appendChild(btnNext);
    }
  }
}

async function consultarDocumentos(st: AcervoInstanceState): Promise<void> {
  const sessao = window.OlymposApp?.getSession?.();
  if (!sessao || !sessao.perfil) {
    st.loading = false;
    st.items = [];
    st.total = 0;
    st.errorMsg = 'Autenticação institucional necessária para consultar o acervo de documentos.';
    renderizarTabela(st);
    return;
  }

  const client = window.OlymposSupabase?.getClient?.();
  if (!client) {
    st.loading = false;
    st.errorMsg = 'Cliente Supabase indisponível nesta sessão.';
    renderizarTabela(st);
    return;
  }

  st.loading = true;
  st.errorMsg = '';
  renderizarTabela(st);

  try {
    const from = (st.page - 1) * st.pageSize;
    const to = from + st.pageSize - 1;

    const selectCols = st.supportsSetorCols
      ? 'id,drive_file_id,tipo,subcategoria,pasta_drive_id,setor_codigo,sigla_setor,numero,ano,nome_arquivo,assunto_ou_titulo,destinatario_ou_servidor,mime_type,drive_url,pdf_export_url,criado_em,modificado_em,sincronizado_em'
      : 'id,drive_file_id,tipo,subcategoria,pasta_drive_id,numero,ano,nome_arquivo,assunto_ou_titulo,destinatario_ou_servidor,mime_type,drive_url,pdf_export_url,criado_em,modificado_em,sincronizado_em';

    let query = client
      .from('documentos_emitidos')
      .select(selectCols, { count: 'exact' })
      .eq('tipo', st.config.tipo);

    switch (st.sortBy) {
      case 'data_asc':
        query = query
          .order('modificado_em', { ascending: true, nullsFirst: false })
          .order('numero', { ascending: true, nullsFirst: false });
        break;
      case 'nome_asc':
        query = query
          .order('nome_arquivo', { ascending: true, nullsFirst: false })
          .order('modificado_em', { ascending: false, nullsFirst: false });
        break;
      case 'nome_desc':
        query = query
          .order('nome_arquivo', { ascending: false, nullsFirst: false })
          .order('modificado_em', { ascending: false, nullsFirst: false });
        break;
      case 'numero_desc':
        query = query
          .order('numero', { ascending: false, nullsFirst: false })
          .order('ano', { ascending: false, nullsFirst: false });
        break;
      case 'numero_asc':
        query = query
          .order('numero', { ascending: true, nullsFirst: false })
          .order('ano', { ascending: true, nullsFirst: false });
        break;
      case 'data_desc':
      default:
        query = query
          .order('modificado_em', { ascending: false, nullsFirst: false })
          .order('numero', { ascending: false, nullsFirst: false });
        break;
    }

    if (st.subcategoria && st.subcategoria !== 'TODAS') {
      query = query.eq('subcategoria', st.subcategoria);
    }

    if (st.supportsSetorCols && st.config.tipo === 'OFICIO' && st.setorFiltro && st.setorFiltro !== 'TODOS') {
      query = query.eq('setor_codigo', st.setorFiltro);
    }

    if (st.mesFiltro && /^\d{4}-\d{2}$/.test(st.mesFiltro)) {
      const [yStr, mStr] = st.mesFiltro.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const startIso = `${yStr}-${mStr}-01T00:00:00Z`;
      const nextDate = new Date(Date.UTC(y, m, 1));
      const endIso = nextDate.toISOString();
      query = query.gte('modificado_em', startIso).lt('modificado_em', endIso);
    }

    if (st.searchTerm) {
      const sanitized = st.searchTerm.replace(/[%_,()]/g, ' ').trim();
      if (sanitized) {
        const pattern = `*${sanitized}*`;
        query = query.or(
          `nome_arquivo.ilike.${pattern},destinatario_ou_servidor.ilike.${pattern},assunto_ou_titulo.ilike.${pattern}`
        );
      }
    }

    const { data, error, count } = await query.range(from, to);
    if (error && st.supportsSetorCols && (error.code === '42703' || String(error.message || '').includes('setor_codigo'))) {
      st.supportsSetorCols = false;
      await consultarDocumentos(st);
      return;
    }
    st.loading = false;

    if (error) {
      st.errorMsg = `Não foi possível consultar documentos_emitidos: ${error.message}`;
      st.items = [];
      st.total = 0;
    } else {
      st.items = Array.isArray(data) ? data : [];
      st.total = typeof count === 'number' ? count : st.items.length;
    }
  } catch (err: any) {
    st.loading = false;
    st.errorMsg = `Erro de rede ao consultar acervo: ${err?.message || 'falha desconhecida'}`;
    st.items = [];
    st.total = 0;
  }

  renderizarTabela(st);
}

function executarSyncDrive(st: AcervoInstanceState): void {
  if (st.syncing) return;
  const prefix = `acervo-${st.config.tipo.toLowerCase()}`;
  const syncBtn = document.getElementById(`${prefix}-sync-btn`) as HTMLButtonElement | null;

  if (!window.OlymposApi || typeof window.OlymposApi.chamar !== 'function') {
    window.OlymposApp?.showToast?.('Gateway GAS não disponível para sincronização.', true);
    return;
  }

  st.syncing = true;
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Sincronizando Drive...';
  }

  window.OlymposApi.chamar(
    'documentos_sincronizar_pastas',
    { tipo: st.config.tipo, forcarCompleto: false },
    (res: any) => {
      st.syncing = false;
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sincronizar Drive agora';
      }
      if (res && res.ok) {
        window.OlymposApp?.showToast?.(res.mensagem || 'Acervo sincronizado com sucesso!');
        st.page = 1;
        void consultarDocumentos(st);
      } else {
        window.OlymposApp?.showToast?.((res && res.mensagem) || 'Falha ao sincronizar pastas do Drive.', true);
      }
    },
    (err: any) => {
      st.syncing = false;
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sincronizar Drive agora';
      }
      window.OlymposApp?.showToast?.(`Erro ao sincronizar Drive: ${err?.message || 'falha'}`, true);
    }
  );
}

export function mountDocumentosAcervo(config: AcervoMountConfig): void {
  const root = document.getElementById(config.containerId);
  if (!root) return;

  let st = instances.get(config.containerId);
  if (!st) {
    st = {
      config,
      page: 1,
      pageSize: 25,
      total: 0,
      searchTerm: '',
      subcategoria: 'TODAS',
      setorFiltro: 'TODOS',
      supportsSetorCols: true,
      mesFiltro: '',
      sortBy: 'data_desc',
      loading: false,
      syncing: false,
      errorMsg: '',
      items: [],
      debounceTimer: null
    };
    instances.set(config.containerId, st);
  }

  if (!root.dataset.acervoMounted) {
    root.dataset.acervoMounted = '1';
    montarShellAcervo(root, st);
  }
  void consultarDocumentos(st);
}

export function recarregarAcervoPorTipo(tipo?: 'OFICIO' | 'PORTARIA'): void {
  for (const st of instances.values()) {
    if (!tipo || st.config.tipo === tipo) {
      st.page = 1;
      void consultarDocumentos(st);
    }
  }
}

if (typeof window !== 'undefined') {
  window.OlymposDocumentosAcervo = {
    mount: mountDocumentosAcervo,
    recarregar: recarregarAcervoPorTipo
  };
}
