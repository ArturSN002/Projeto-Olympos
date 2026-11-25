/**
 * Blindagem de Planilhas no Cliente (Onda 10 — AppSec)
 * - Limites de tamanho de arquivo (10 MB) e quantidade de linhas (10.000)
 * - Remoção de chaves perigosas anti-Prototype Pollution (__proto__, constructor, prototype)
 * - Sanitização anti-Formula Injection / DDE (=, +, -, @, \t, \r) na exportação XLSX
 */

export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 10000;
export const ALLOWED_SPREADSHEET_EXTS = new Set(['.csv', '.xlsx', '.xls', '.txt']);
export const FORBIDDEN_SPREADSHEET_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;
const PURE_SIGNED_NUMBER_RE = /^[+-]?\d+(?:[.,]\d+)?$/;

export function assertSafeSpreadsheetFile(file: { name?: string; size?: number } | null | undefined): void {
  if (!file) {
    throw new Error('Nenhum arquivo selecionado.');
  }
  const name = String(file.name || '').trim().toLowerCase();
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx >= 0 ? name.slice(dotIdx) : '';
  if (!ext || !ALLOWED_SPREADSHEET_EXTS.has(ext)) {
    throw new Error('Extensão não permitida. Envie apenas arquivos .csv, .xlsx, .xls ou .txt.');
  }
  const size = Number(file.size ?? 0);
  if (Number.isFinite(size) && size > MAX_SPREADSHEET_BYTES) {
    throw new Error('Arquivo excede o limite máximo de segurança de 10 MB para importação de planilhas.');
  }
}

export function sanitizeObjectKeys<T extends Record<string, unknown>>(row: unknown): T {
  const clean: Record<string, unknown> = {};
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return clean as T;
  }
  for (const key of Object.keys(row as Record<string, unknown>)) {
    if (FORBIDDEN_SPREADSHEET_KEYS.has(key)) continue;
    const val = (row as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      clean[key] = sanitizeObjectKeys(val);
    } else {
      clean[key] = val;
    }
  }
  return clean as T;
}

export function sanitizeSheetRows<T extends Record<string, unknown>>(
  rows: unknown[],
  maxRows = MAX_SPREADSHEET_ROWS,
): T[] {
  if (!Array.isArray(rows)) return [];
  if (rows.length > maxRows) {
    throw new Error(`Planilha excede o limite de segurança de ${maxRows} linhas por operação.`);
  }
  return rows.map((r) => sanitizeObjectKeys<T>(r));
}

export function sanitizeFormulaCell(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  if (!val) return val;
  const trimmed = val.trim();
  if (PURE_SIGNED_NUMBER_RE.test(trimmed)) {
    return val;
  }
  if (FORMULA_PREFIX_RE.test(val)) {
    return `'${val}`;
  }
  return val;
}

export function sanitizeRowsForExport<T extends Record<string, unknown>>(rows: T[]): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const cleanRow = sanitizeObjectKeys<Record<string, unknown>>(row);
    for (const key of Object.keys(cleanRow)) {
      cleanRow[key] = sanitizeFormulaCell(cleanRow[key]);
    }
    return cleanRow as T;
  });
}
