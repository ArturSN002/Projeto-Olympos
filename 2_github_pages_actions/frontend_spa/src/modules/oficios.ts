import oficiosHtml from '../templates/pages/oficios.html?raw';
import { mountOficioRichEditor } from './oficiosRichEditor';
import { mountDocumentosAcervo } from './documentosAcervo';
import { openSnippetsDrawer, type SnippetInsertResult } from '../core/snippetsDrawer';
import {
  clearPendingDispatchContext,
  getPendingDispatchContext,
  registrarVinculoDocumentoNaPendencia,
  type PendingDispatchContext
} from './chamadosTimelineDrawer';
import '../../js/views/oficios.js';

export const routeId = 'oficios';
export const htmlTemplate = oficiosHtml;

let activeOficioDispatchCtx: PendingDispatchContext | null = null;

function aplicarTextoNoEditorOficio(texto: string, conteudoJson?: Record<string, any> | null, modo: 'replace' | 'append' = 'replace'): void {
  const textarea = document.getElementById('oficioCorpoInput') as HTMLTextAreaElement | null;
  const host = document.getElementById('oficioRichEditorHost');
  const pmEl = document.querySelector('#oficioRichEditorSurface .ProseMirror') as any;
  const editorInst = pmEl?.editor || pmEl?.pmViewDesc?.editor || null;

  if (modo === 'append' && editorInst?.commands?.insertContent) {
    const payload = conteudoJson && Array.isArray(conteudoJson.content) ? conteudoJson.content : texto;
    editorInst.chain().focus().insertContent(payload).run();
    return;
  }

  const textoAtual = window.OlymposOficioEditor?.getCorpoTextoPlano?.() || textarea?.value || '';
  const novoTexto = modo === 'append' && textoAtual.trim()
    ? `${textoAtual.trim()}\n\n${texto.trim()}`
    : texto;

  if (textarea) {
    textarea.value = novoTexto;
  }
  if (host) {
    host.dataset.tiptapMounted = '';
  }
  mountOficioRichEditor();
}

function atualizarBannerDispatchOficio(ctx: PendingDispatchContext | null): void {
  const banner = document.getElementById('oficioDispatchContextBanner');
  const titleEl = document.getElementById('oficioDispatchBannerTitle');
  const metaEl = document.getElementById('oficioDispatchBannerMeta');
  if (!banner) return;

  if (!ctx) {
    banner.classList.add('hidden');
    banner.style.display = 'none';
    return;
  }

  if (titleEl) {
    titleEl.textContent = `Despacho vinculado ao Protocolo #${ctx.numeroProtocolo}`;
  }
  if (metaEl) {
    metaEl.textContent = `${ctx.destinatario} • ${ctx.assunto}`;
  }
  banner.classList.remove('hidden');
  banner.style.display = 'flex';
}

export function aplicarPendingDispatchContextOficio(): void {
  const ctx = getPendingDispatchContext();
  if (!ctx || ctx.tipo !== 'OFICIO') {
    if (!activeOficioDispatchCtx) {
      atualizarBannerDispatchOficio(null);
    }
    return;
  }

  activeOficioDispatchCtx = ctx;
  const destInput = document.getElementById('oficioDestinatarioInput') as HTMLInputElement | null;
  const assuntoInput = document.getElementById('oficioAssuntoInput') as HTMLInputElement | null;

  if (destInput) destInput.value = ctx.destinatario || '';
  if (assuntoInput) assuntoInput.value = ctx.assunto || '';
  if (ctx.corpoBase) {
    aplicarTextoNoEditorOficio(ctx.corpoBase, null, 'replace');
  }
  atualizarBannerDispatchOficio(ctx);
}

export async function vincularOficioEmitidoAPendencia(opts: {
  fileId?: string;
  numero?: string | number;
  url?: string;
  documentoId?: number | null;
}): Promise<boolean> {
  const ctx = activeOficioDispatchCtx || getPendingDispatchContext();
  if (!ctx || ctx.tipo !== 'OFICIO' || !ctx.pendenciaId) return false;

  let documentoId = opts.documentoId ?? null;
  const client = window.OlymposSupabase?.getClient?.();
  if (client && documentoId === null && opts.fileId) {
    try {
      const { data } = await client
        .from('documentos_emitidos')
        .select('id')
        .eq('drive_file_id', opts.fileId)
        .limit(1)
        .maybeSingle();
      if (data?.id !== undefined && data?.id !== null) {
        documentoId = Number(data.id);
      }
    } catch {
      // fallback segue via URL/numero no helper
    }
  }

  const numeroFormatado = opts.numero ? `Ofício Nº ${opts.numero}/2026 - GS/SMEB` : null;
  const ok = await registrarVinculoDocumentoNaPendencia(ctx.pendenciaId, {
    documentoId,
    numero: numeroFormatado,
    url: opts.url || null
  });

  if (ok) {
    activeOficioDispatchCtx = null;
    clearPendingDispatchContext();
    atualizarBannerDispatchOficio(null);
    window.OlymposApp?.showToast?.(`Ofício vinculado automaticamente ao Protocolo #${ctx.numeroProtocolo}!`);
  }
  return ok;
}

function bindOficioOnda2Controls(): void {
  const btnSnippet = document.getElementById('btnOficioInserirSnippet') as any;
  if (btnSnippet && !btnSnippet._boundSnippet) {
    btnSnippet._boundSnippet = true;
    btnSnippet.addEventListener('click', () => {
      void openSnippetsDrawer({
        categoriaInicial: 'OFICIO',
        onInsert: (result: SnippetInsertResult) => {
          aplicarTextoNoEditorOficio(result.textoInterpolado, result.conteudoJsonInterpolado, 'append');
          window.OlymposApp?.showToast?.(`Modelo "${result.snippet.titulo}" inserido no expediente!`);
        }
      });
    });
  }

  const btnClearCtx = document.getElementById('btnLimparOficioDispatchCtx') as any;
  if (btnClearCtx && !btnClearCtx._boundClearCtx) {
    btnClearCtx._boundClearCtx = true;
    btnClearCtx.addEventListener('click', () => {
      activeOficioDispatchCtx = null;
      clearPendingDispatchContext();
      atualizarBannerDispatchOficio(null);
    });
  }
}

if (typeof window !== 'undefined') {
  (window as any).OlymposOficiosBridge = {
    aplicarPendingDispatchContext: aplicarPendingDispatchContextOficio,
    vincularOficioEmitidoAPendencia
  };
}

export async function mount(): Promise<void> {
  mountOficioRichEditor();
  bindOficioOnda2Controls();
  aplicarPendingDispatchContextOficio();
  mountDocumentosAcervo({
    containerId: 'oficiosAcervoRoot',
    tipo: 'OFICIO',
    showSubcategoriaFilter: false
  });
}
