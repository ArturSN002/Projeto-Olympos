import oficiosHtml from '../templates/pages/oficios.html?raw';
import '../../js/views/oficios.js';

export const routeId = 'oficios';
export const htmlTemplate = oficiosHtml;

export async function mount(): Promise<void> {
  // oficios.js registra window.OlymposViews.oficios
}
