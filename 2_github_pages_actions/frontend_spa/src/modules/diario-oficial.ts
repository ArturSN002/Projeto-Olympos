import diarioHtml from '../templates/pages/diario-oficial.html?raw';
import { enriquecerCardsDiarioComRadar } from './diarioRadarBadges';
import '../../js/views/diarioOficial.js';

export const routeId = 'diario-oficial';
export const htmlTemplate = diarioHtml;

export async function mount(): Promise<void> {
  // diarioOficial.js carregado sob demanda + badges preditivos do Radar FEMURN
  const pageEl = document.getElementById('page-diario-oficial');
  void enriquecerCardsDiarioComRadar(pageEl);
}
