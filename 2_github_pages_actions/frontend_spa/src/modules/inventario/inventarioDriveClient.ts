/**
 * Hub Olympos — A Forja de Hefesto (Inventário Patrimonial & Almoxarifado SMEB)
 * Cliente de integração híbrida: compactação de imagens/PDF no navegador,
 * upload para Google Drive via Edge Gateway + GAS, geração de Termo de Entrega no Google Docs
 * e registro auditável em `public.inventario_anexos` / `rpc_inventario_vincular_termo_remessa`.
 */

export type InventarioTipoAnexo =
  | 'FOTO_ENTRADA'
  | 'FOTO_ENTREGA'
  | 'FOTO_AVARIA'
  | 'TERMO_ENTREGA_DOCS'
  | 'TERMO_ASSINADO_SCAN'
  | 'NOTA_FISCAL'
  | 'LAUDO'
  | 'OUTRO';

export interface UploadAnexoParams {
  file: File;
  itemId?: string | null;
  loteId?: string | null;
  movimentacaoId?: string | null;
  remessaCodigo?: string | null;
  tipoAnexo: InventarioTipoAnexo;
  codigoRef?: string;
  legenda?: string;
}

export interface UploadAnexoResult {
  ok: boolean;
  anexo: Record<string, unknown> | null;
  viewUrl: string;
  fileId: string;
}

export interface GerarTermoEntregaParams {
  remessaCodigo: string;
  tipoMovimentacao: string;
  tipoTermo?: 'ENTREGA' | 'EMPRESTIMO' | 'EMPRÉSTIMO';
  origemNome: string;
  destinoNome: string;
  destinoAmbiente?: string;
  destinoInep?: string;
  recebidoPorNome?: string;
  recebidoPorCargo?: string;
  motivoObservacao?: string;
  operadorNome?: string;
  itens: Array<{
    modo?: 'UNITARIO' | 'CONSUMIVEL';
    codigoUnico: string;
    nomeDetalhado: string;
    marcaModelo?: string;
    numeroSerie?: string;
    tombamento?: string;
    categoria?: string;
    estadoConservacao?: string;
    quantidade?: number;
    unidade?: string;
  }>;
}

export interface GerarTermoEntregaResult {
  ok: boolean;
  docId: string;
  docUrl: string;
  nomeArquivo: string;
}

const MAX_GAS_UPLOAD_BYTES = 1_450_000;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

function getSupabaseClient(): any {
  const sb = (window as any).OlymposSupabase?.getClient?.();
  if (!sb) {
    throw new Error('Cliente Supabase indisponível.');
  }
  return sb;
}

function chamarGasAction<T = any>(action: string, dados: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const api = (window as any).OlymposApi;
    if (!api || typeof api.chamar !== 'function') {
      reject(new Error('Gateway GAS indisponível neste contexto.'));
      return;
    }
    api.chamar(
      action,
      { dados },
      (res: any) => {
        if (res && res.ok === false) {
          reject(new Error(res.mensagem || res.message || `Falha na operação ${action}.`));
          return;
        }
        resolve(res as T);
      },
      (err: Error) => reject(err || new Error(`Falha ao executar ${action}.`))
    );
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function calcularSha256Hex(buffer: ArrayBuffer): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback silencioso quando WebCrypto digest não estiver disponível
  }
  return '';
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function carregarImagemHtml(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível decodificar a imagem selecionada.'));
    img.src = url;
  });
}

export async function comprimirArquivoParaDrive(file: File): Promise<{
  base64: string;
  mimeType: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  sha256Hex: string;
}> {
  if (!file) {
    throw new Error('Selecione um arquivo válido para envio.');
  }

  const rawMime = String(file.type || '').toLowerCase();
  const safeBaseName = String(file.name || 'anexo_inventario')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 80);

  if (rawMime === 'application/pdf' || safeBaseName.toLowerCase().endsWith('.pdf')) {
    if (file.size > MAX_GAS_UPLOAD_BYTES) {
      throw new Error('PDF excede o limite de 1,4 MB para transferência segura ao Drive.');
    }
    const buf = await file.arrayBuffer();
    return {
      base64: arrayBufferToBase64(buf),
      mimeType: 'application/pdf',
      nomeArquivo: safeBaseName.toLowerCase().endsWith('.pdf') ? safeBaseName : `${safeBaseName}.pdf`,
      tamanhoBytes: buf.byteLength,
      sha256Hex: await calcularSha256Hex(buf)
    };
  }

  if (!ALLOWED_MIME_TYPES.has(rawMime) && !/\.(jpe?g|png|webp)$/i.test(safeBaseName)) {
    throw new Error('Formato não suportado. Envie imagens JPG/PNG/WebP ou documentos PDF.');
  }

  // Para imagens já enxutas (<= 1.1 MB), envia o original sem degradação
  if (file.size <= 1_100_000 && (rawMime === 'image/jpeg' || rawMime === 'image/png' || rawMime === 'image/webp')) {
    const buf = await file.arrayBuffer();
    return {
      base64: arrayBufferToBase64(buf),
      mimeType: rawMime,
      nomeArquivo: safeBaseName,
      tamanhoBytes: buf.byteLength,
      sha256Hex: await calcularSha256Hex(buf)
    };
  }

  // Compactação em Canvas para fotos de alta resolução (máx. 1600px)
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await carregarImagemHtml(objectUrl);
    const maxDim = 1600;
    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const targetW = Math.max(1, Math.round((img.naturalWidth || 1) * ratio));
    const targetH = Math.max(1, Math.round((img.naturalHeight || 1) * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Falha ao inicializar processamento gráfico da imagem.');
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const outMime = rawMime === 'image/webp' ? 'image/webp' : 'image/jpeg';
    let quality = 0.84;
    let blob = await canvasToBlob(canvas, outMime, quality);
    while (blob && blob.size > 1_200_000 && quality > 0.45) {
      quality -= 0.12;
      blob = await canvasToBlob(canvas, outMime, quality);
    }

    if (!blob || blob.size > MAX_GAS_UPLOAD_BYTES) {
      throw new Error('Imagem ainda excede o limite de 1,4 MB após compactação. Tente uma foto menor.');
    }

    const buf = await blob.arrayBuffer();
    const ext = outMime === 'image/webp' ? 'webp' : 'jpg';
    const stem = safeBaseName.replace(/\.[^.]+$/, '');
    return {
      base64: arrayBufferToBase64(buf),
      mimeType: outMime,
      nomeArquivo: `${stem}.${ext}`,
      tamanhoBytes: buf.byteLength,
      sha256Hex: await calcularSha256Hex(buf)
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function enviarAnexoInventarioDrive(params: UploadAnexoParams): Promise<UploadAnexoResult> {
  const prepared = await comprimirArquivoParaDrive(params.file);
  const nomeComPrefixo = params.codigoRef
    ? `${params.codigoRef}_${params.tipoAnexo}_${prepared.nomeArquivo}`.slice(0, 120)
    : prepared.nomeArquivo;

  const gasRes = await chamarGasAction<any>('inventario_upload_anexo_drive', {
    contentBase64: prepared.base64,
    mimeType: prepared.mimeType,
    nomeArquivo: nomeComPrefixo,
    tipoAnexo: params.tipoAnexo
  });

  const driveFileId = String(gasRes?.fileId || '');
  const driveViewUrl = String(gasRes?.viewUrl || '');
  const driveFolderId = String(gasRes?.folderId || '');
  if (!driveFileId || !driveViewUrl) {
    throw new Error('Resposta do Drive sem identificador de arquivo.');
  }

  const supabase = getSupabaseClient();
  const session = (window as any).OlymposApp?.getSession?.();
  const payloadInsert = {
    item_id: params.itemId || null,
    lote_id: params.loteId || null,
    movimentacao_id: params.movimentacaoId || null,
    remessa_codigo: params.remessaCodigo || null,
    tipo_anexo: params.tipoAnexo,
    nome_arquivo: String(gasRes?.nomeArquivo || nomeComPrefixo),
    mime_type: prepared.mimeType,
    tamanho_bytes: prepared.tamanhoBytes,
    drive_file_id: driveFileId,
    drive_view_url: driveViewUrl,
    drive_folder_id: driveFolderId || null,
    sha256_hex: prepared.sha256Hex || String(gasRes?.sha256Hex || '') || null,
    legenda: params.legenda ? String(params.legenda).trim().slice(0, 240) : null,
    enviado_por: session?.userId || null
  };

  const { data, error } = await supabase
    .from('inventario_anexos')
    .insert(payloadInsert)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Arquivo enviado ao Drive, mas falhou ao registrar no Supabase.');
  }

  return {
    ok: true,
    anexo: data || payloadInsert,
    viewUrl: driveViewUrl,
    fileId: driveFileId
  };
}

export async function gerarTermoEntregaDrive(params: GerarTermoEntregaParams): Promise<GerarTermoEntregaResult> {
  const gasRes = await chamarGasAction<any>('inventario_gerar_termo_entrega', {
    remessaCodigo: params.remessaCodigo,
    tipoMovimentacao: params.tipoMovimentacao,
    tipoTermo: params.tipoTermo || 'ENTREGA',
    origemNome: params.origemNome,
    destinoNome: params.destinoNome,
    destinoAmbiente: params.destinoAmbiente || '',
    destinoInep: params.destinoInep || '',
    recebidoPorNome: params.recebidoPorNome || '',
    recebidoPorCargo: params.recebidoPorCargo || '',
    motivoObservacao: params.motivoObservacao || '',
    operadorNome: params.operadorNome || '',
    itens: params.itens || []
  });

  const docId = String(gasRes?.docId || '');
  const docUrl = String(gasRes?.docUrl || '');
  if (!docId || !docUrl) {
    throw new Error('Google Docs não retornou o link do Termo de Entrega.');
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('rpc_inventario_vincular_termo_remessa', {
    p_remessa_codigo: params.remessaCodigo,
    p_drive_file_id: docId,
    p_drive_url: docUrl,
    p_nome_arquivo: String(gasRes?.nomeArquivo || `Termo_${params.remessaCodigo}`),
    p_folder_id: String(gasRes?.folderId || '')
  });

  if (error) {
    throw new Error(error.message || 'Termo gerado no Docs, mas houve falha ao vincular no Supabase.');
  }

  return {
    ok: true,
    docId,
    docUrl,
    nomeArquivo: String(gasRes?.nomeArquivo || `Termo_${params.remessaCodigo}`)
  };
}

export async function obterPastaDriveInventario(): Promise<{
  ok: boolean;
  folderId: string;
  folderName: string;
  folderUrl: string;
}> {
  return chamarGasAction('inventario_listar_pasta_drive', {});
}
