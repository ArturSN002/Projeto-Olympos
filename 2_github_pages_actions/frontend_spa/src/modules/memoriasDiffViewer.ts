/** Diff de linhas LCS puro em TS (ZERO deps) + contagem X / 60 linhas. */
export type DiffLineType = 'equal' | 'add' | 'remove';

export interface DiffLineItem {
  tipo: DiffLineType;
  texto: string;
  numLinha: number;
  numLinhaOriginal?: number;
  numLinhaNova?: number;
}

export interface DiffResumo {
  adicionadas: number;
  removidas: number;
  iguais: number;
  linhasOriginais: number;
  linhasNovas: number;
  contagemLinhaTexto: string;
}

export const LIMITE_LINHAS_MEMORIA = 60;

const escDef = (v: string): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const splitL = (t: string): string[] => {
  const s = String(t ?? '').replace(/\r\n/g, '\n');
  return s === '' ? [] : s.split('\n');
};

export function contarLinhasMemoria(t: string): number { return splitL(t).length; }
export function formatarContagemLinhas(t: string, lim = LIMITE_LINHAS_MEMORIA): string { return `${contarLinhasMemoria(t)} / ${lim} linhas`; }

export function calcularDiffLinhas(textoOriginal: string, textoNovo: string): DiffLineItem[] {
  const a = splitL(textoOriginal), b = splitL(textoNovo), m = a.length, n = b.length;
  if (!m && !n) return [];
  if (m * n > 400000) {
    return [
      ...a.map((texto, k): DiffLineItem => ({ tipo: 'remove', texto, numLinha: k + 1, numLinhaOriginal: k + 1 })),
      ...b.map((texto, k): DiffLineItem => ({ tipo: 'add', texto, numLinha: k + 1, numLinhaNova: k + 1 }))
    ];
  }
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLineItem[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      out.push({ tipo: 'equal', texto: b[j], numLinha: j + 1, numLinhaOriginal: i + 1, numLinhaNova: j + 1 });
      i++; j++;
    } else if (j === n || (i < m && dp[i + 1][j] >= dp[i][j + 1])) {
      out.push({ tipo: 'remove', texto: a[i], numLinha: i + 1, numLinhaOriginal: i + 1 });
      i++;
    } else {
      out.push({ tipo: 'add', texto: b[j], numLinha: j + 1, numLinhaNova: j + 1 });
      j++;
    }
  }
  return out;
}

export function resumirDiffLinhas(diff: DiffLineItem[], orig?: string, novo?: string): DiffResumo {
  let adicionadas = 0, removidas = 0, iguais = 0;
  for (const l of diff) l.tipo === 'add' ? adicionadas++ : l.tipo === 'remove' ? removidas++ : iguais++;
  const linhasOriginais = orig !== undefined ? contarLinhasMemoria(orig) : iguais + removidas;
  const linhasNovas = novo !== undefined ? contarLinhasMemoria(novo) : iguais + adicionadas;
  return { adicionadas, removidas, iguais, linhasOriginais, linhasNovas, contagemLinhaTexto: `${linhasNovas} / ${LIMITE_LINHAS_MEMORIA} linhas` };
}

export function renderDiffHtml(diff: DiffLineItem[], escapeFn: (v: string) => string = escDef): string {
  const esc = typeof escapeFn === 'function' ? escapeFn : escDef;
  const r = resumirDiffLinhas(diff), cls = r.linhasNovas > LIMITE_LINHAS_MEMORIA ? 'pill-red' : 'pill-gold';
  const hdr = `<div class="diff-viewer-header"><span>Comparação Visual (Diff LCS)</span><div class="diff-summary-badges"><span class="pill-badge pill-green">+${r.adicionadas}</span><span class="pill-badge pill-red">-${r.removidas}</span><span class="pill-badge ${cls}">${esc(r.contagemLinhaTexto)}</span></div></div>`;
  if (!diff.length) return `<div class="diff-viewer-wrap">${hdr}<div style="padding:12px;font-size:12px;color:var(--text-muted);">Documento vazio.</div></div>`;
  const rows = diff.map((l) => `<tr class="diff-line-row diff-line--${l.tipo}"><td class="diff-line-num">${l.numLinha}</td><td class="diff-line-sign" aria-hidden="true">${l.tipo === 'add' ? '+' : l.tipo === 'remove' ? '-' : ' '}</td><td class="diff-line-text">${l.texto === '' ? '&nbsp;' : esc(l.texto)}</td></tr>`).join('');
  return `<div class="diff-viewer-wrap">${hdr}<div class="diff-lines-scroll"><table class="diff-table" aria-label="Diferenças linha a linha"><tbody>${rows}</tbody></table></div></div>`;
}
