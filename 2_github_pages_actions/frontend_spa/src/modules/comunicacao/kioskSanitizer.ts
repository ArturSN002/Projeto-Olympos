/**
 * Sanitizador defensivo para exibição pública em TV / Modo Kiosk (LGPD).
 * Remove padrões de contato eletrônico, telefones BR e identificadores fiscais de 11 dígitos.
 */

const RE_DOC_PESSOAL_11 = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const RE_CONTATO_ELETRONICO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_TELEFONE_BR = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)(?:9\d{4}|\d{4})-?\d{4}\b/g;

export function sanitizarTextoSeguroParaTv(texto: string | null | undefined, maxLen = 140): string {
  const bruto = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!bruto) return '';

  const mascarado = bruto
    .replace(RE_DOC_PESSOAL_11, '[SIGILO]')
    .replace(RE_CONTATO_ELETRONICO, '[CONTATO RESTRITO]')
    .replace(RE_TELEFONE_BR, '[TELEFONE RESTRITO]');

  if (maxLen > 0 && mascarado.length > maxLen) {
    return `${mascarado.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return mascarado;
}
