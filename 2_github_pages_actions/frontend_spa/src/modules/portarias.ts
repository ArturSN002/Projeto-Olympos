import portariasHtml from '../templates/pages/portarias.html?raw';
import '../../js/views/portarias.js';
import '../../js/views/licencas.js';

export const routeId = 'portarias';
export const htmlTemplate = portariasHtml;

export async function mount(): Promise<void> {
  // portarias.js e licencas.js carregados sob demanda
}
