import certificadosHtml from '../templates/pages/certificados.html?raw';
import certificadosModalsHtml from '../templates/modals/certificadosModals.html?raw';
import { mountBatchImporter } from '../core/batchImporter';
import { renderBundleExportBar, updateBundleExportBar, type BundleDocumentItem } from '../core/pdfBundler';
import '../../js/certificados_crypto.js';
import '../../js/views/certificados.js';
import '../../js/views/liraOrfeu.js';

export const routeId = 'certificados';
export const htmlTemplate = certificadosHtml;
export const modalTemplates = [
  { id: 'modalLiraNovaAba', html: certificadosModalsHtml }
];

function coletarCertificadosParaBundle(): BundleDocumentItem[] {
  const items: BundleDocumentItem[] = [];
  const seenUrls = new Set<string>();

  const collectFromList = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.job-link-item').forEach((row, idx) => {
      const nameEl = row.querySelector('.job-link-name');
      const metaEl = row.querySelector('.job-link-meta');
      const linkEl = row.querySelector('a[href]') as HTMLAnchorElement | null;
      const url = linkEl?.href || '';
      if (url && seenUrls.has(url)) return;
      if (url) seenUrls.add(url);
      const titulo = nameEl?.textContent?.trim() || `Certificado_${idx + 1}`;
      items.push({
        nome: titulo,
        titulo,
        detalhe: metaEl?.textContent?.trim() || '',
        url
      });
    });
  };

  collectFromList('liraGeneratedPdfsList');
  collectFromList('liraGeneratedLinksList');

  const tbody = document.getElementById('liraTabelaParticipantesBody');
  if (tbody) {
    tbody.querySelectorAll('tr').forEach((tr) => {
      const cells = tr.querySelectorAll('td');
      const linkEl = tr.querySelector('a[href]') as HTMLAnchorElement | null;
      const url = linkEl?.href || '';
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      const nomePart = cells[1]?.textContent?.trim() || 'Participante';
      const emailPart = cells[2]?.textContent?.trim() || '';
      const chPart = cells[4]?.textContent?.trim() || '';
      items.push({
        nome: `Certificado_${nomePart}`,
        titulo: `Certificado — ${nomePart}`,
        identificador: nomePart,
        detalhe: [emailPart, chPart].filter(Boolean).join(' • '),
        url
      });
    });
  }

  return items;
}

export async function mount(): Promise<void> {
  // certificados_crypto + certificados + liraOrfeu + Importador Inteligente (ORFEU) + ZIP Bundler
  const batchRoot = document.getElementById('certificadosBatchImporterRoot');
  if (batchRoot && !batchRoot.dataset.batchMounted) {
    batchRoot.dataset.batchMounted = '1';
    mountBatchImporter({
      containerId: 'certificadosBatchImporterRoot',
      mode: 'ORFEU'
    });
  }

  const bundleRoot = document.getElementById('certificadosBundleExportRoot');
  if (bundleRoot && !bundleRoot.dataset.bundleMounted) {
    bundleRoot.dataset.bundleMounted = '1';
    renderBundleExportBar('certificadosBundleExportRoot', coletarCertificadosParaBundle, {
      tituloIndice: 'Consolidado de Certificados (A Lira de Orfeu) — SMEB Ceará-Mirim/RN',
      nomeZip: `Certificados_Lira_Orfeu_${new Date().toISOString().slice(0, 10)}.zip`
    });

    const syncBundle = () => {
      updateBundleExportBar('certificadosBundleExportRoot', coletarCertificadosParaBundle);
    };
    const tbody = document.getElementById('liraTabelaParticipantesBody');
    const doneBox = document.getElementById('liraCompletedJobBox');
    if (tbody) {
      new MutationObserver(syncBundle).observe(tbody, { childList: true, subtree: true });
    }
    if (doneBox) {
      new MutationObserver(syncBundle).observe(doneBox, { childList: true, subtree: true });
    }
  }
}
