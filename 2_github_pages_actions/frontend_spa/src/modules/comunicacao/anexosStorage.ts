/**
 * Onda 14 — Helper seguro para anexos no bucket privado `comunicacao-anexos`.
 * Valida MIME/extensão e tamanho (máx. 5 MB), sanitiza nome de arquivo e gera URLs assinadas (TTL curto).
 */

export const COMUNICACAO_BUCKET_ID = 'comunicacao-anexos';
export const MAX_ANEXO_BYTES = 5 * 1024 * 1024;

export const ALLOWED_ANEXO_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain'
};

export interface UploadedAnexoMeta {
  path: string;
  nome: string;
  mime: string;
  size: number;
}

export function sanitizeAnexoFilename(rawName: string): string {
  const clean = String(rawName || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (clean || 'arquivo').slice(-80);
}

export function validateAnexoFile(file: File): { ok: true; mime: string } | { ok: false; message: string } {
  if (!file) return { ok: false, message: 'Nenhum arquivo selecionado.' };
  if (file.size <= 0) return { ok: false, message: 'O arquivo selecionado está vazio.' };
  if (file.size > MAX_ANEXO_BYTES) {
    return { ok: false, message: 'Anexo excede o limite máximo de 5 MB.' };
  }
  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || EXT_TO_MIME[ext] || '').toLowerCase();
  if (!mime || !ALLOWED_ANEXO_MIME_TYPES.has(mime)) {
    return {
      ok: false,
      message: 'Formato não permitido. Utilize PDF, PNG, JPG, WEBP, DOCX, XLSX ou TXT.'
    };
  }
  return { ok: true, mime };
}

export async function uploadComunicacaoAnexo(
  file: File,
  scope: { kind: 'mural'; userId: string } | { kind: 'chat'; salaId: string; userId: string }
): Promise<UploadedAnexoMeta> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) {
    throw new Error('Cliente Supabase indisponível para upload de anexo.');
  }
  const valid = validateAnexoFile(file);
  if (!valid.ok) {
    throw new Error(valid.message);
  }

  const safeName = sanitizeAnexoFilename(file.name);
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path =
    scope.kind === 'mural'
      ? `mural/${scope.userId}/${stamp}_${safeName}`
      : `chat/${scope.salaId}/${scope.userId}/${stamp}_${safeName}`;

  const { error } = await client.storage
    .from(COMUNICACAO_BUCKET_ID)
    .upload(path, file, { contentType: valid.mime, upsert: false });

  if (error) {
    throw new Error(`Falha ao enviar anexo: ${error.message}`);
  }

  return {
    path,
    nome: file.name || safeName,
    mime: valid.mime,
    size: file.size
  };
}

export async function createAnexoSignedUrl(path: string, expiresInSeconds = 120): Promise<string> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client || !path) {
    throw new Error('Caminho do anexo ou cliente Supabase inválido.');
  }
  const { data, error } = await client.storage
    .from(COMUNICACAO_BUCKET_ID)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Não foi possível gerar URL assinada temporária.');
  }
  return data.signedUrl;
}
