import certificadosHtml from '../templates/pages/certificados.html?raw';
import certificadosModalsHtml from '../templates/modals/certificadosModals.html?raw';
import '../../js/certificados_crypto.js';
import '../../js/views/certificados.js';
import '../../js/views/liraOrfeu.js';

export const routeId = 'certificados';
export const htmlTemplate = certificadosHtml;
export const modalTemplates = [
  { id: 'modalLiraNovaAba', html: certificadosModalsHtml }
];

export async function mount(): Promise<void> {
  // certificados_crypto + certificados + liraOrfeu
}
