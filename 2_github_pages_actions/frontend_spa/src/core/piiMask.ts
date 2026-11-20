/**
 * Utilitário Central de Mascaramento Dinâmico de Dados Pessoais (LGPD).
 * Garante ocultação parcial de CPF, e-mail e matrícula conforme perfil RBAC.
 */

const REVEAL_ALLOWED_ROLES = new Set([
  'MODERADOR',
  'ADMIN_GABINETE',
  'RH_COMISSAO',
  'JURIDICO'
]);

export function canRevealSensitivePii(role?: string | null): boolean {
  const normalized = String(role || '').trim().toUpperCase();
  return REVEAL_ALLOWED_ROLES.has(normalized);
}

export function maskCpf(rawCpf?: string | null): string {
  const digits = String(rawCpf || '').replace(/\D/g, '');
  if (digits.length !== 11) {
    return '***.***.***-**';
  }
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function maskEmail(rawEmail?: string | null): string {
  const email = String(rawEmail || '').trim();
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '***@***';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

export function maskMatricula(rawMat?: string | null, role?: string | null): string {
  const mat = String(rawMat || '').trim();
  if (!mat) return '—';
  const normRole = String(role || '').trim().toUpperCase();
  if (REVEAL_ALLOWED_ROLES.has(normRole)) {
    return mat;
  }
  if (mat.length <= 4) return '****';
  return `${mat.slice(0, 2)}***${mat.slice(-2)}`;
}

export const OlymposPiiMask = {
  canRevealSensitivePii,
  maskCpf,
  maskEmail,
  maskMatricula
};

if (typeof window !== 'undefined') {
  (window as any).OlymposPiiMask = OlymposPiiMask;
}
