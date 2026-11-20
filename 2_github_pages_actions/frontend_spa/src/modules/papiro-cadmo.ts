import papiroHtml from '../templates/pages/papiro-cadmo.html?raw';
import { loadMapStack } from '../core/lazyLibs';
import { ensureEscolasSeedData, ensurePermutasData } from '../core/lazyData';

export const routeId = 'papiro-cadmo';
export const htmlTemplate = papiroHtml;

export async function mount(): Promise<void> {
  await Promise.all([loadMapStack(), ensurePermutasData(), ensureEscolasSeedData()]);
  await import('../../js/views/papiroCadmo.js');
}
