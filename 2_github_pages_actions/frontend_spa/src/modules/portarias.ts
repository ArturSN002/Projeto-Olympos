import portariasHtml from '../templates/pages/portarias.html?raw';
import { mountDocumentosAcervo } from './documentosAcervo';
import { mountBatchImporter } from '../core/batchImporter';
import { renderBundleExportBar, updateBundleExportBar, type BundleDocumentItem } from '../core/pdfBundler';
import {
  clearPendingDispatchContext,
  getPendingDispatchContext,
  registrarVinculoDocumentoNaPendencia,
  type PendingDispatchContext
} from './chamadosTimelineDrawer';
import '../../js/views/portarias.js';
import '../../js/views/licencas.js';

export const routeId = 'portarias';
export const htmlTemplate = portariasHtml;

let activePortariaDispatchCtx: PendingDispatchContext | null = null;
let portariaHooksInstalled = false;
let licencaObserverInstalled = false;

function coletarPortariasGeradasParaBundle(): BundleDocumentItem[] {
  const items: BundleDocumentItem[] = [];
  const seen = new Set<string>();

  const collectFromList = (containerId: string) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll('.job-link-item').forEach((row, idx) => {
      const titulo = row.querySelector('.job-link-name')?.textContent?.trim() || `Portaria_${idx + 1}`;
      const detalhe = row.querySelector('.job-link-meta')?.textContent?.trim() || '';
      const link = row.querySelector('a[href]') as HTMLAnchorElement | null;
      const url = link?.href || '';
      if (url && seen.has(url)) return;
      if (url) seen.add(url);
      items.push({ nome: titulo, titulo, detalhe, url });
    });
  };

  collectFromList('jobLinksList');
  collectFromList('licencaGeneratedLinks');
  return items;
}

function coletarPortariasAcervoParaBundle(): BundleDocumentItem[] {
  const wrap = document.getElementById('acervo-portaria-table-wrap');
  if (!wrap) return [];
  const items: BundleDocumentItem[] = [];
  wrap.querySelectorAll('tbody tr').forEach((tr, idx) => {
    const numTxt = tr.querySelector('td[data-label="Nº / Ano"]')?.textContent?.trim() || '';
    const docTitle = tr.querySelector('td[data-label="Documento"] div:first-child')?.textContent?.trim() || `Portaria_${idx + 1}`;
    const docMeta = tr.querySelector('td[data-label="Documento"] div:nth-child(2)')?.textContent?.trim() || '';
    const links = Array.from(tr.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const pdfLink = links.find((a) => a.textContent?.trim().toUpperCase() === 'PDF')?.href || '';
    const docLink = links[0]?.href || '';
    items.push({
      nome: docTitle,
      titulo: docTitle,
      numero: numTxt,
      detalhe: docMeta,
      url: docLink,
      pdfUrl: pdfLink || undefined
    });
  });
  return items;
}

function atualizarBannerDispatchPortaria(ctx: PendingDispatchContext | null): void {
  const banner = document.getElementById('portariasDispatchContextBanner');
  const titleEl = document.getElementById('portariasDispatchBannerTitle');
  const metaEl = document.getElementById('portariasDispatchBannerMeta');
  if (!banner) return;

  if (!ctx) {
    banner.classList.add('hidden');
    banner.style.display = 'none';
    return;
  }

  if (titleEl) {
    titleEl.textContent = `Portaria vinculada ao Protocolo #${ctx.numeroProtocolo}`;
  }
  if (metaEl) {
    metaEl.textContent = `${ctx.destinatario} • ${ctx.assunto}`;
  }
  banner.classList.remove('hidden');
  banner.style.display = 'flex';
}

function aplicarPendingDispatchContextPortaria(): void {
  const ctx = getPendingDispatchContext();
  if (!ctx || ctx.tipo !== 'PORTARIA') {
    if (!activePortariaDispatchCtx) {
      atualizarBannerDispatchPortaria(null);
    }
    return;
  }

  activePortariaDispatchCtx = ctx;
  atualizarBannerDispatchPortaria(ctx);

  const nomeInput = document.getElementById('licNomeInput') as HTMLInputElement | null;
  if (nomeInput && !nomeInput.value.trim()) {
    nomeInput.value = ctx.solicitanteNome || ctx.destinatario || '';
  }

  const portariasView = window.OlymposViews?.portarias;
  if (portariasView && typeof portariasView.alternarSubtab === 'function') {
    portariasView.alternarSubtab('licencas');
  }
}

function instalarHooksSubtabPortarias(): void {
  const portariasView = window.OlymposViews?.portarias;
  if (portariasView && typeof portariasView.alternarSubtab === 'function' && !portariaHooksInstalled) {
    portariaHooksInstalled = true;
    const origAlternar = portariasView.alternarSubtab.bind(portariasView);
    const origInit = typeof portariasView.init === 'function' ? portariasView.init.bind(portariasView) : null;

    portariasView.alternarSubtab = function (tabKey: string) {
      const btnIntel = document.getElementById('subtabBtnPortariasLoteInteligente');
      const paneIntel = document.getElementById('subpanePortariasLoteInteligente');

      if (tabKey === 'lote-inteligente') {
        document.querySelectorAll('#page-portarias .subnav-tab').forEach((btn) => {
          const isTarget = btn.id === 'subtabBtnPortariasLoteInteligente';
          btn.classList.toggle('active', isTarget);
          btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });
        document.querySelectorAll('#page-portarias .subtab-pane').forEach((pane) => {
          const isTarget = pane.id === 'subpanePortariasLoteInteligente';
          pane.classList.toggle('hidden', !isTarget);
        });
        return;
      }

      if (btnIntel) {
        btnIntel.classList.remove('active');
        btnIntel.setAttribute('aria-selected', 'false');
      }
      if (paneIntel) {
        paneIntel.classList.add('hidden');
      }
      origAlternar(tabKey);
    };

    if (origInit) {
      portariasView.init = function () {
        origInit();
        aplicarPendingDispatchContextPortaria();
      };
    }
  }

  const btnLoteIntel = document.getElementById('subtabBtnPortariasLoteInteligente') as any;
  if (btnLoteIntel && !btnLoteIntel._boundIntel) {
    btnLoteIntel._boundIntel = true;
    btnLoteIntel.addEventListener('click', () => {
      window.OlymposViews?.portarias?.alternarSubtab?.('lote-inteligente');
    });
  }

  const btnClearCtx = document.getElementById('btnLimparPortariasDispatchCtx') as any;
  if (btnClearCtx && !btnClearCtx._boundClearCtx) {
    btnClearCtx._boundClearCtx = true;
    btnClearCtx.addEventListener('click', () => {
      activePortariaDispatchCtx = null;
      clearPendingDispatchContext();
      atualizarBannerDispatchPortaria(null);
    });
  }
}

function instalarObserverVinculoLicenca(): void {
  if (licencaObserverInstalled) return;
  const feedbackBox = document.getElementById('licencaOutputFeedback');
  if (!feedbackBox) return;
  licencaObserverInstalled = true;

  new MutationObserver(() => {
    updateBundleExportBar('portariasBundleExportRoot', coletarPortariasGeradasParaBundle);
    const ctx = activePortariaDispatchCtx || getPendingDispatchContext();
    if (!ctx || ctx.tipo !== 'PORTARIA' || !ctx.pendenciaId) return;

    const firstDocLink = feedbackBox.querySelector('#licencaGeneratedLinks a[href*="docs.google.com/document"]') as HTMLAnchorElement | null;
    if (!firstDocLink?.href) return;

    const itemRow = firstDocLink.closest('.job-link-item');
    const titulo = itemRow?.querySelector('.job-link-name')?.textContent?.trim() || null;

    void registrarVinculoDocumentoNaPendencia(ctx.pendenciaId, {
      numero: titulo,
      url: firstDocLink.href
    }).then((ok) => {
      if (ok) {
        activePortariaDispatchCtx = null;
        clearPendingDispatchContext();
        atualizarBannerDispatchPortaria(null);
        window.OlymposApp?.showToast?.(`Portaria vinculada ao Protocolo #${ctx.numeroProtocolo}!`);
      }
    });
  }).observe(feedbackBox, { childList: true, subtree: true });
}

export async function mount(): Promise<void> {
  instalarHooksSubtabPortarias();
  instalarObserverVinculoLicenca();

  const batchRoot = document.getElementById('portariasBatchImporterRoot');
  if (batchRoot && !batchRoot.dataset.batchMounted) {
    batchRoot.dataset.batchMounted = '1';
    mountBatchImporter({
      containerId: 'portariasBatchImporterRoot',
      mode: 'HOMERO'
    });
  }

  const bundleRoot = document.getElementById('portariasBundleExportRoot');
  if (bundleRoot && !bundleRoot.dataset.bundleMounted) {
    bundleRoot.dataset.bundleMounted = '1';
    renderBundleExportBar('portariasBundleExportRoot', coletarPortariasGeradasParaBundle, {
      tituloIndice: 'Consolidado Oficial de Portarias para Publicação FEMURN — SMEB Ceará-Mirim/RN',
      nomeZip: `Portarias_SMEB_${new Date().toISOString().slice(0, 10)}.zip`
    });
    const jobLinksList = document.getElementById('jobLinksList');
    if (jobLinksList) {
      new MutationObserver(() => {
        updateBundleExportBar('portariasBundleExportRoot', coletarPortariasGeradasParaBundle);
      }).observe(jobLinksList, { childList: true, subtree: true });
    }
  }

  mountDocumentosAcervo({
    containerId: 'portariasAcervoRoot',
    tipo: 'PORTARIA',
    showSubcategoriaFilter: true
  });

  const acervoBundleRoot = document.getElementById('portariasAcervoBundleExportRoot');
  if (acervoBundleRoot && !acervoBundleRoot.dataset.bundleMounted) {
    acervoBundleRoot.dataset.bundleMounted = '1';
    renderBundleExportBar('portariasAcervoBundleExportRoot', coletarPortariasAcervoParaBundle, {
      tituloIndice: 'Acervo Consolidado de Portarias FEMURN — SMEB Ceará-Mirim/RN',
      nomeZip: `Acervo_Portarias_SMEB_${new Date().toISOString().slice(0, 10)}.zip`
    });
    const acervoRoot = document.getElementById('portariasAcervoRoot');
    if (acervoRoot) {
      new MutationObserver(() => {
        updateBundleExportBar('portariasAcervoBundleExportRoot', coletarPortariasAcervoParaBundle);
      }).observe(acervoRoot, { childList: true, subtree: true });
    }
  }

  aplicarPendingDispatchContextPortaria();
}
