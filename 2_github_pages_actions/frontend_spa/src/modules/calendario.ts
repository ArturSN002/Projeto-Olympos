import calendarioHtml from '../templates/pages/calendario.html?raw';
import '../../js/views/calendario.js';

export const routeId = 'calendario';
export const htmlTemplate = calendarioHtml;

export async function mount(): Promise<void> {
  // calendario.js registra window.OlymposViews.calendario
}
