import servidoresHtml from '../templates/pages/servidores.html?raw';
import servidoresModalHtml from '../templates/modals/servidoresModal.html?raw';
import { loadSearchEngineStack } from '../core/lazyLibs';

export const routeId = 'servidores';
export const htmlTemplate = servidoresHtml;
export const modalTemplates = [
  { id: 'modalDossieServidor', html: servidoresModalHtml }
];

export async function mount(): Promise<void> {
  await loadSearchEngineStack();
  await import('../../js/data/servidoresData.js');
  await import('../../js/views/servidores.js');
}
