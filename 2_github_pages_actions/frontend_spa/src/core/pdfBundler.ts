/**
 * Onda 3 — Empacotador ZIP (fflate) e Consolidador de PDF Único FEMURN (pdf-lib).
 * Ambas as bibliotecas são carregadas exclusivamente via dynamic `await import(...)`.
 */

import '../styles/onda3.css';

export interface BundleDocumentItem {
  nome?: string;
  titulo?: string;
  identificador?: string;
  detalhe?: string;
  numero?: string | number;
  url?: string;
  pdfUrl?: string;
  conteudo?: Uint8Array | ArrayBuffer | string;
  bytes?: Uint8Array | ArrayBuffer;
  buffer?: Uint8Array | ArrayBuffer;
}

export type BundleItemsSource =
  | Array<BundleDocumentItem | Uint8Array | ArrayBuffer>
  | (() => Array<BundleDocumentItem | Uint8Array | ArrayBuffer>);

const barItemsRegistry = new Map<string, BundleItemsSource>();

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(v));
  }
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileName(raw: string, fallback: string): string {
  const clean = String(raw || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || fallback;
}

function sanitizeWinAnsi(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\u2197|\u2192/g, '->')
    .replace(/\u2022/g, '*')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function triggerBrowserDownload(bytes: Uint8Array, fileName: string, mimeType: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function toUint8Array(raw: Uint8Array | ArrayBuffer | undefined): Uint8Array | null {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  return null;
}

async function tryFetchPdfBytes(url: string | undefined): Promise<Uint8Array | null> {
  const cleanUrl = String(url || '').trim();
  if (!/^https:\/\//i.test(cleanUrl)) return null;
  // Evita fetch em URLs de edição do Google Docs que não retornam binário PDF via CORS
  if (cleanUrl.includes('docs.google.com/document/d/') && !cleanUrl.includes('export?format=pdf')) {
    return null;
  }
  try {
    const res = await fetch(cleanUrl, { mode: 'cors' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Verifica assinatura %PDF-
    if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return bytes;
    }
    return null;
  } catch {
    return null;
  }
}

function wrapTextByChars(text: string, maxChars: number): string[] {
  const words = sanitizeWinAnsi(text).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + ' ' + w).length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function empacotarZipDocumentos(
  arquivos: Array<BundleDocumentItem | { nome: string; conteudo: Uint8Array | ArrayBuffer | string }>,
  nomeZip = 'documentos_smeb_olympos.zip'
): Promise<Uint8Array> {
  const list = Array.isArray(arquivos) ? arquivos : [];
  const fflate = await import('fflate');

  const zipMap: Record<string, Uint8Array> = {};
  const manifestLines: string[] = [
    'HUB OLYMPOS — SMEB CEARA-MIRIM/RN',
    `Pacote gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total de itens: ${list.length}`,
    ''
  ];

  const usedNames = new Set<string>();
  const reserveName = (rawName: string, defaultExt: string): string => {
    let base = sanitizeFileName(rawName, `documento_${usedNames.size + 1}`);
    if (!/\.[a-z0-9]{2,5}$/i.test(base)) {
      base += defaultExt;
    }
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      const dot = base.lastIndexOf('.');
      candidate = dot > 0 ? `${base.slice(0, dot)}_${suffix}${base.slice(dot)}` : `${base}_${suffix}`;
      suffix++;
    }
    usedNames.add(candidate);
    return candidate;
  };

  for (let i = 0; i < list.length; i++) {
    const item = list[i] || {};
    const label = item.nome || (item as BundleDocumentItem).titulo || (item as BundleDocumentItem).identificador || `Documento_${i + 1}`;
    const rawBytes =
      toUint8Array((item as BundleDocumentItem).bytes) ||
      toUint8Array((item as BundleDocumentItem).buffer) ||
      (typeof item.conteudo !== 'string' ? toUint8Array(item.conteudo) : null);

    if (rawBytes && rawBytes.byteLength > 0) {
      const fname = reserveName(label, '.pdf');
      zipMap[fname] = rawBytes;
      manifestLines.push(`${i + 1}. ${fname} (${rawBytes.byteLength} bytes)`);
      continue;
    }

    if (typeof item.conteudo === 'string') {
      const fname = reserveName(label, '.txt');
      zipMap[fname] = fflate.strToU8(item.conteudo);
      manifestLines.push(`${i + 1}. ${fname} (texto)`);
      continue;
    }

    const docItem = item as BundleDocumentItem;
    const fetchedPdf = await tryFetchPdfBytes(docItem.pdfUrl || docItem.url);
    if (fetchedPdf) {
      const fname = reserveName(label, '.pdf');
      zipMap[fname] = fetchedPdf;
      manifestLines.push(`${i + 1}. ${fname} (PDF baixado)`);
      continue;
    }

    const metaText = [
      `Documento: ${label}`,
      docItem.identificador ? `Identificador/Servidor: ${docItem.identificador}` : '',
      docItem.numero ? `Número: ${docItem.numero}` : '',
      docItem.detalhe ? `Detalhe: ${docItem.detalhe}` : '',
      docItem.url ? `URL Oficial: ${docItem.url}` : '',
      docItem.pdfUrl ? `URL PDF: ${docItem.pdfUrl}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const metaName = reserveName(`${label}_ficha`, '.txt');
    zipMap[metaName] = fflate.strToU8(metaText || `Item ${i + 1}`);
    manifestLines.push(`${i + 1}. ${metaName} (metadados/link)`);
  }

  zipMap['00_INDICE_PACOTE_SMEB.txt'] = fflate.strToU8(manifestLines.join('\n'));
  const zipped = fflate.zipSync(zipMap, { level: 6 });

  const finalZipName = nomeZip.toLowerCase().endsWith('.zip') ? nomeZip : `${nomeZip}.zip`;
  triggerBrowserDownload(zipped, finalZipName, 'application/zip');
  return zipped;
}

export async function gerarPdfUnicoConsolidado(
  arquivosPdfBuffersOuDados: Array<BundleDocumentItem | Uint8Array | ArrayBuffer>,
  tituloIndice = 'Consolidado Oficial para Publicação FEMURN — SMEB Ceará-Mirim/RN'
): Promise<Uint8Array> {
  const list = Array.isArray(arquivosPdfBuffersOuDados) ? arquivosPdfBuffersOuDados : [];
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const outDoc = await PDFDocument.create();
  const fontRegular = await outDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28; // A4 portrait
  const PAGE_H = 841.89;
  const MARGIN = 48;

  // 1. Folha de Índice Sumário
  let indexPage = outDoc.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;

  const drawIndexHeader = (page: any, isContinuation: boolean) => {
    page.drawText(sanitizeWinAnsi('PREFEITURA MUNICIPAL DE CEARA-MIRIM/RN - SMEB'), {
      x: MARGIN,
      y: PAGE_H - MARGIN,
      size: 10,
      font: fontBold,
      color: rgb(0.25, 0.3, 0.38)
    });
    page.drawText(
      sanitizeWinAnsi(isContinuation ? `${tituloIndice} (Cont.)` : tituloIndice),
      {
        x: MARGIN,
        y: PAGE_H - MARGIN - 18,
        size: 13.5,
        font: fontBold,
        color: rgb(0.06, 0.09, 0.16)
      }
    );
    page.drawText(
      sanitizeWinAnsi(`Gerado em ${new Date().toLocaleString('pt-BR')} | Total de atos no volume: ${list.length}`),
      {
        x: MARGIN,
        y: PAGE_H - MARGIN - 35,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.35, 0.4, 0.48)
      }
    );
    page.drawLine({
      start: { x: MARGIN, y: PAGE_H - MARGIN - 45 },
      end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 45 },
      thickness: 1.2,
      color: rgb(0.15, 0.25, 0.45)
    });
    return PAGE_H - MARGIN - 66;
  };

  cursorY = drawIndexHeader(indexPage, false);

  if (list.length === 0) {
    indexPage.drawText('Nenhum documento informado para consolidacao neste volume.', {
      x: MARGIN,
      y: cursorY,
      size: 11,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.42)
    });
  } else {
    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      const item: BundleDocumentItem =
        raw instanceof Uint8Array || raw instanceof ArrayBuffer
          ? { nome: `Documento PDF #${i + 1}`, bytes: raw }
          : (raw || {});
      const label = item.titulo || item.nome || item.identificador || `Ato Oficial #${i + 1}`;
      const sub = [item.identificador && item.identificador !== label ? item.identificador : '', item.detalhe || '']
        .filter(Boolean)
        .join(' - ');
      const lineText = `${i + 1}. ${label}${sub ? ` (${sub})` : ''}`;
      const wrapped = wrapTextByChars(lineText, 84);

      for (const ln of wrapped) {
        if (cursorY < MARGIN + 24) {
          indexPage = outDoc.addPage([PAGE_W, PAGE_H]);
          cursorY = drawIndexHeader(indexPage, true);
        }
        indexPage.drawText(ln, {
          x: MARGIN,
          y: cursorY,
          size: 10,
          font: fontRegular,
          color: rgb(0.1, 0.14, 0.2)
        });
        cursorY -= 15;
      }
      cursorY -= 3;
    }
  }

  // 2. Mesclagem dos PDFs ou geração de Ficha Resumo Vetorial
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const item: BundleDocumentItem =
      raw instanceof Uint8Array || raw instanceof ArrayBuffer
        ? { nome: `Documento PDF #${i + 1}`, bytes: raw }
        : (raw || {});

    const directBytes =
      toUint8Array(item.bytes) ||
      toUint8Array(item.buffer) ||
      (typeof item.conteudo !== 'string' ? toUint8Array(item.conteudo) : null);

    let pdfBytes = directBytes;
    if (!pdfBytes && (item.pdfUrl || item.url)) {
      pdfBytes = await tryFetchPdfBytes(item.pdfUrl || item.url);
    }

    let mergedSuccessfully = false;
    if (pdfBytes && pdfBytes.byteLength > 0) {
      try {
        const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const copiedPages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        for (const p of copiedPages) {
          outDoc.addPage(p);
        }
        mergedSuccessfully = copiedPages.length > 0;
      } catch {
        mergedSuccessfully = false;
      }
    }

    if (!mergedSuccessfully) {
      const fichaPage = outDoc.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - MARGIN;

      fichaPage.drawText(sanitizeWinAnsi(`ATO ${i + 1} DE ${list.length} • FICHA RESUMO OFICIAL SMEB`), {
        x: MARGIN,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.25, 0.3, 0.38)
      });
      y -= 24;

      const title = item.titulo || item.nome || `Documento #${i + 1}`;
      for (const tLine of wrapTextByChars(title, 62)) {
        fichaPage.drawText(tLine, {
          x: MARGIN,
          y,
          size: 14,
          font: fontBold,
          color: rgb(0.06, 0.09, 0.16)
        });
        y -= 20;
      }

      y -= 6;
      fichaPage.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 0.8,
        color: rgb(0.75, 0.78, 0.84)
      });
      y -= 22;

      const fields: Array<[string, string]> = [
        ['Identificador / Servidor', String(item.identificador || '--')],
        ['Numero / Referencia', String(item.numero || '--')],
        ['Detalhamento', String(item.detalhe || 'Documento institucional indexado no Hub Olympos.')],
        ['Conteudo / Texto', typeof item.conteudo === 'string' ? item.conteudo : ''],
        ['Link Canonico', String(item.url || item.pdfUrl || '--')]
      ];

      for (const [k, v] of fields) {
        if (!v) continue;
        fichaPage.drawText(sanitizeWinAnsi(`${k}:`), {
          x: MARGIN,
          y,
          size: 10,
          font: fontBold,
          color: rgb(0.2, 0.25, 0.35)
        });
        y -= 15;
        for (const vLine of wrapTextByChars(v, 82)) {
          if (y < MARGIN + 24) break;
          fichaPage.drawText(vLine, {
            x: MARGIN + 8,
            y,
            size: 10,
            font: fontRegular,
            color: rgb(0.1, 0.12, 0.16)
          });
          y -= 14;
        }
        y -= 8;
      }
    }
  }

  const outBytes = await outDoc.save();
  const outName = `${sanitizeFileName(tituloIndice, 'Consolidado_FEMURN_SMEB')}.pdf`;
  triggerBrowserDownload(outBytes, outName, 'application/pdf');
  return outBytes;
}

export function updateBundleExportBar(containerId: string, items: BundleItemsSource): void {
  barItemsRegistry.set(containerId, items);
  const countEl = document.getElementById(`${containerId}-bundle-count`);
  if (countEl) {
    const resolved = typeof items === 'function' ? items() : items;
    countEl.textContent = `${Array.isArray(resolved) ? resolved.length : 0} item(ns) no lote`;
  }
}

export function renderBundleExportBar(
  containerId: string,
  items: BundleItemsSource,
  options?: { tituloIndice?: string; nomeZip?: string }
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  barItemsRegistry.set(containerId, items);
  const resolved = typeof items === 'function' ? items() : items;
  const count = Array.isArray(resolved) ? resolved.length : 0;
  const uid = `bundle_${containerId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  container.innerHTML =
    `<div class="bundle-export-bar" id="${uid}-bar">` +
      `<div class="bundle-export-info">` +
        `<span class="pill-badge pill-gold" id="${containerId}-bundle-count">${esc(count)} item(ns) no lote</span>` +
        `<span>Empacote os documentos emitidos em arquivo único para arquivo ou envio à FEMURN.</span>` +
      `</div>` +
      `<div class="bundle-export-actions">` +
        `<button type="button" id="${uid}-zip-btn" class="btn btn-secondary btn-sm">Exportar ZIP</button>` +
        `<button type="button" id="${uid}-pdf-btn" class="btn btn-primary btn-sm">Gerar PDF Único (FEMURN)</button>` +
      `</div>` +
    `</div>`;

  const resolveItems = () => {
    const src = barItemsRegistry.get(containerId);
    const list = typeof src === 'function' ? src() : src;
    return Array.isArray(list) ? list : [];
  };

  const zipBtn = document.getElementById(`${uid}-zip-btn`) as HTMLButtonElement | null;
  const pdfBtn = document.getElementById(`${uid}-pdf-btn`) as HTMLButtonElement | null;

  zipBtn?.addEventListener('click', async () => {
    const list = resolveItems();
    if (list.length === 0) {
      window.OlymposApp?.showToast?.('Nenhum documento gerado disponível para empacotar.', true);
      return;
    }
    zipBtn.disabled = true;
    const oldLabel = zipBtn.textContent;
    zipBtn.textContent = 'Compactando ZIP...';
    try {
      await empacotarZipDocumentos(
        list as Array<BundleDocumentItem>,
        options?.nomeZip || `Lote_SMEB_${new Date().toISOString().slice(0, 10)}.zip`
      );
      window.OlymposApp?.showToast?.(`Arquivo ZIP gerado com ${list.length} documento(s)!`);
    } catch (err: any) {
      window.OlymposApp?.showToast?.(`Erro ao gerar ZIP: ${err?.message || 'falha'}`, true);
    } finally {
      zipBtn.disabled = false;
      zipBtn.textContent = oldLabel || 'Exportar ZIP';
    }
  });

  pdfBtn?.addEventListener('click', async () => {
    const list = resolveItems();
    if (list.length === 0) {
      window.OlymposApp?.showToast?.('Nenhum documento gerado disponível para consolidar em PDF.', true);
      return;
    }
    pdfBtn.disabled = true;
    const oldLabel = pdfBtn.textContent;
    pdfBtn.textContent = 'Mesclando PDF Único...';
    try {
      await gerarPdfUnicoConsolidado(
        list,
        options?.tituloIndice || 'Consolidado Oficial para Publicação FEMURN — SMEB Ceará-Mirim/RN'
      );
      window.OlymposApp?.showToast?.(`PDF Único (FEMURN) gerado com ${list.length} documento(s)!`);
    } catch (err: any) {
      window.OlymposApp?.showToast?.(`Erro ao gerar PDF Único: ${err?.message || 'falha'}`, true);
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = oldLabel || 'Gerar PDF Único (FEMURN)';
    }
  });
}

if (typeof window !== 'undefined') {
  (window as any).OlymposPdfBundler = {
    empacotarZipDocumentos,
    gerarPdfUnicoConsolidado,
    renderBundleExportBar,
    updateBundleExportBar
  };
}
