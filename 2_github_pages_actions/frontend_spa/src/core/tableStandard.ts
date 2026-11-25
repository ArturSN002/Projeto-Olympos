/**
 * Hub Olympos — Padrão Universal de Tabelas & Ordenação (baseado em Servidores)
 * Garante que todas as tabelas utilizem `.table-wrapper.table-responsive > table.clean-table.table-responsive-cards`,
 * injeta `data-label` automático para cards mobile e habilita ordenação em colunas não-customizadas.
 */

const SKIP_SORT_COL_RE = /^(?:a[çc][õo]es|acesso|documento|detalhes)$/i;

function limparTextoCabecalho(th: HTMLElement): string {
  const clone = th.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.th-sort-indicator, .svg-icon-inline').forEach((n) => n.remove());
  return String(clone.textContent || th.textContent || '')
    .replace(/[▲▼↕⇅]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairValorOrdenavel(td: HTMLElement): { kind: 'num' | 'date' | 'str'; num: number; str: string } {
  const rawAttr = td.getAttribute('data-sort-value');
  const txt = String(rawAttr ?? td.textContent ?? '').replace(/\s+/g, ' ').trim();

  const mBrDate = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (mBrDate) {
    const ts = Date.UTC(
      Number(mBrDate[3]),
      Number(mBrDate[2]) - 1,
      Number(mBrDate[1]),
      Number(mBrDate[4] || 0),
      Number(mBrDate[5] || 0)
    );
    return { kind: 'date', num: ts, str: txt };
  }

  const mIsoDate = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIsoDate) {
    const ts = Date.parse(txt);
    if (!Number.isNaN(ts)) {
      return { kind: 'date', num: ts, str: txt };
    }
  }

  const mNum = txt.replace(/\./g, '').replace(',', '.').match(/^-?\d+(?:\.\d+)?(?=\s*(?:%|h|ms|s|b|kb|mb)?$)/i);
  if (mNum) {
    const n = Number(mNum[0]);
    if (!Number.isNaN(n)) {
      return { kind: 'num', num: n, str: txt };
    }
  }

  return { kind: 'str', num: 0, str: txt };
}

export function compareSmartValues(aRaw: string, bRaw: string, dir: 'asc' | 'desc' = 'asc'): number {
  const factor = dir === 'desc' ? -1 : 1;
  const aTxt = String(aRaw || '').replace(/\s+/g, ' ').trim();
  const bTxt = String(bRaw || '').replace(/\s+/g, ' ').trim();
  if (!aTxt && !bTxt) return 0;
  if (!aTxt) return 1;
  if (!bTxt) return -1;
  return factor * aTxt.localeCompare(bTxt, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function enhanceTable(table: HTMLTableElement | null): void {
  if (!table || table.nodeName !== 'TABLE') return;

  if (table.classList.contains('table-clean')) {
    table.classList.remove('table-clean');
  }
  table.classList.add('clean-table', 'table-responsive-cards');

  const parent = table.parentElement;
  if (parent) {
    if (parent.classList.contains('table-wrapper')) {
      parent.classList.add('table-responsive');
    } else if (parent.classList.contains('pss-table-scroll')) {
      parent.classList.add('table-wrapper', 'table-responsive');
    }
  }

  const headRow = table.tHead && table.tHead.rows && table.tHead.rows[0] ? table.tHead.rows[0] : null;
  if (!headRow) return;

  const thList = Array.from(headRow.cells) as HTMLElement[];
  const headers = thList.map(limparTextoCabecalho);

  const tbodies = Array.from(table.tBodies || []);
  for (const tbody of tbodies) {
    const rows = Array.from(tbody.rows);
    for (const row of rows) {
      const cells = Array.from(row.cells);
      if (cells.length === 1 && cells[0].hasAttribute('colspan')) continue;
      cells.forEach((td, idx) => {
        if (!td.getAttribute('data-label') && headers[idx]) {
          td.setAttribute('data-label', headers[idx]);
        }
      });
    }
  }

  if (table.getAttribute('data-custom-sort') === 'true' || table.dataset.tableStdSortBound === '1') {
    return;
  }
  table.dataset.tableStdSortBound = '1';

  thList.forEach((th, colIdx) => {
    const label = headers[colIdx] || '';
    if (!label || SKIP_SORT_COL_RE.test(label) || th.querySelector('button, select, input')) {
      return;
    }

    th.classList.add('th-sortable');
    th.setAttribute('role', 'button');
    th.setAttribute('tabindex', '0');
    if (!th.getAttribute('aria-sort')) {
      th.setAttribute('aria-sort', 'none');
    }

    if (!th.querySelector('.th-sort-indicator')) {
      const ind = document.createElement('span');
      ind.className = 'th-sort-indicator';
      ind.setAttribute('aria-hidden', 'true');
      ind.textContent = '↕';
      th.appendChild(ind);
    }

    const sortColumn = () => {
      const tbody = table.tBodies && table.tBodies[0];
      if (!tbody) return;
      const rows = Array.from(tbody.rows).filter((r) => !(r.cells.length === 1 && r.cells[0].hasAttribute('colspan')));
      if (rows.length <= 1) return;

      const cur = th.getAttribute('aria-sort') === 'ascending' ? 'ascending' : 'descending';
      const nextDir: 'asc' | 'desc' = cur === 'ascending' && th.dataset.sortedOnce === '1' ? 'desc' : 'asc';
      const factor = nextDir === 'asc' ? 1 : -1;

      thList.forEach((other) => {
        other.setAttribute('aria-sort', 'none');
        delete other.dataset.sortedOnce;
        const indEl = other.querySelector('.th-sort-indicator');
        if (indEl) indEl.textContent = '↕';
      });

      th.setAttribute('aria-sort', nextDir === 'asc' ? 'ascending' : 'descending');
      th.dataset.sortedOnce = '1';
      const activeInd = th.querySelector('.th-sort-indicator');
      if (activeInd) activeInd.textContent = nextDir === 'asc' ? '▲' : '▼';

      rows.sort((ra, rb) => {
        const ca = ra.cells[colIdx] as HTMLElement | undefined;
        const cb = rb.cells[colIdx] as HTMLElement | undefined;
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        const va = extrairValorOrdenavel(ca);
        const vb = extrairValorOrdenavel(cb);
        if (va.kind === vb.kind && (va.kind === 'num' || va.kind === 'date')) {
          return factor * (va.num - vb.num);
        }
        return factor * va.str.localeCompare(vb.str, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });

      const frag = document.createDocumentFragment();
      rows.forEach((r) => frag.appendChild(r));
      tbody.appendChild(frag);
    };

    th.addEventListener('click', sortColumn);
    th.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sortColumn();
      }
    });
  });
}

export function enhanceAll(root: ParentNode = document): void {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('table').forEach((tbl) => enhanceTable(tbl as HTMLTableElement));
}

let observerStarted = false;
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;

export function initTableStandard(): void {
  if (typeof document === 'undefined') return;
  enhanceAll(document);

  if (observerStarted || typeof MutationObserver === 'undefined') return;
  observerStarted = true;
  const obs = new MutationObserver(() => {
    if (scheduledTimer) clearTimeout(scheduledTimer);
    scheduledTimer = setTimeout(() => {
      enhanceAll(document);
    }, 80);
  });
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  }
}

const tableStdApi = {
  enhanceTable,
  enhanceAll,
  initTableStandard,
  compareSmartValues
};

if (typeof window !== 'undefined') {
  (window as any).OlymposTableStandard = tableStdApi;
}

export default tableStdApi;
