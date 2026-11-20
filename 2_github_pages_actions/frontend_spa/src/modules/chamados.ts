import chamadosHtml from '../templates/pages/chamados.html?raw';
import '../../js/views/chamados.js';

export const routeId = 'chamados';
export const htmlTemplate = chamadosHtml;

export async function mount(): Promise<void> {
  // chamados.js registra window.OlymposViews.chamados
}
