import escolasHtml from '../templates/pages/escolas.html?raw';
import escolasModalsHtml from '../templates/modals/escolasModals.html?raw';
import { loadMapStack } from '../core/lazyLibs';
import { ensureEscolasSeedData } from '../core/lazyData';

export const routeId = 'escolas';
export const htmlTemplate = escolasHtml;
export const modalTemplates = [
  { id: 'modalCadastroEscola', html: escolasModalsHtml }
];

export async function mount(): Promise<void> {
  await Promise.all([loadMapStack(), ensureEscolasSeedData()]);
  await import('../../js/views/escolas.js');
}
