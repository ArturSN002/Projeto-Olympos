import buscaHtml from '../templates/pages/busca.html?raw';
import { loadSearchEngineStack } from '../core/lazyLibs';

export const routeId = 'busca';
export const htmlTemplate = buscaHtml;

export async function mount(): Promise<void> {
  await loadSearchEngineStack();
  await import('../../js/views/busca.js');
}
