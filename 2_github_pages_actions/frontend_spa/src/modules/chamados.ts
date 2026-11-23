import '../styles/onda2.css';
import chamadosHtml from '../templates/pages/chamados.html?raw';
import '../../js/views/chamados.js';
import { mountChamadosKanban, renderKanbanBoard, setKanbanViewMode } from './chamadosKanban';
import { openChamadoTimelineDrawer } from './chamadosTimelineDrawer';

export const routeId = 'chamados';
export const htmlTemplate = chamadosHtml;

function bindChamadosOnda2Events(): void {
  const btnTabela = document.getElementById('btnChamadosViewTabela') as any;
  const btnKanban = document.getElementById('btnChamadosViewKanban') as any;

  if (btnTabela && !btnTabela._boundOnda2) {
    btnTabela._boundOnda2 = true;
    btnTabela.addEventListener('click', () => {
      setKanbanViewMode('tabela');
    });
  }

  if (btnKanban && !btnKanban._boundOnda2) {
    btnKanban._boundOnda2 = true;
    btnKanban.addEventListener('click', () => {
      setKanbanViewMode('kanban');
    });
  }

  // Re-renderiza o Kanban quando filtros da toolbar são alterados
  const refreshKanban = () => renderKanbanBoard();
  const busca = document.getElementById('chamadosBuscaInput') as any;
  if (busca && !busca._boundKanbanFilter) {
    busca._boundKanbanFilter = true;
    busca.addEventListener('input', refreshKanban);
  }
  const setor = document.getElementById('chamadosSetorSelect') as any;
  if (setor && !setor._boundKanbanFilter) {
    setor._boundKanbanFilter = true;
    setor.addEventListener('change', refreshKanban);
  }
  const statusGroup = document.getElementById('filterStatusGroup') as any;
  if (statusGroup && !statusGroup._boundKanbanFilter) {
    statusGroup._boundKanbanFilter = true;
    statusGroup.addEventListener('click', () => setTimeout(refreshKanban, 0));
  }
  const urgGroup = document.getElementById('filterUrgenciaGroup') as any;
  if (urgGroup && !urgGroup._boundKanbanFilter) {
    urgGroup._boundKanbanFilter = true;
    urgGroup.addEventListener('click', () => setTimeout(refreshKanban, 0));
  }

  // Clique no card na visão Tabela/Lista abre o Timeline Drawer (ignorando botões de ação e links)
  const lista = document.getElementById('chamadosListaContainer') as any;
  if (lista && !lista._boundTimelineClick) {
    lista._boundTimelineClick = true;
    lista.addEventListener('click', (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('button, a, input, select, .chamado-actions, .chamado-anexos')) {
        return;
      }
      const card = target.closest('.chamado-card[data-id]') as HTMLElement | null;
      if (card) {
        const id = card.getAttribute('data-id');
        if (id) void openChamadoTimelineDrawer(id);
      }
    });
  }
}

export async function mount(): Promise<void> {
  mountChamadosKanban('chamadosKanbanRoot');
  bindChamadosOnda2Events();
}
