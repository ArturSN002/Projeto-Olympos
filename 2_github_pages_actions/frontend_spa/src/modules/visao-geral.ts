import visaoGeralHtml from '../templates/pages/visao-geral.html?raw';
import '../../js/memorias_catalogo.js';
import '../../js/views/visaoGeral.js';

export const routeId = 'visao-geral';
export const htmlTemplate = visaoGeralHtml;

export async function mount(): Promise<void> {
  // visaoGeral.js registra window.OlymposViews.visaoGeral
}
