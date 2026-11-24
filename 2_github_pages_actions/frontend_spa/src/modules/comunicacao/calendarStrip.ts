/**
 * Faixa horizontal "Próximos Eventos da Agenda Intersetorial" para o Mural Compartilhado.
 * Reutiliza public.calendario_agenda (15 dias futuros) e fornece opcoes de vinculo para publicacoes.
 */

export interface AgendaEventoResumo {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string | null;
  horario: string | null;
  setor: string;
  categoria: string | null;
  local: string | null;
}

function escapeHtml(val: unknown): string {
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(val ?? ''));
  }
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function calcularContagemRegressiva(dataIso: string, hojeIso: string): { label: string; isToday: boolean } {
  if (!dataIso) return { label: '--', isToday: false };
  const [hy, hm, hd] = hojeIso.split('-').map(Number);
  const [ey, em, ed] = dataIso.slice(0, 10).split('-').map(Number);
  const tHoje = Date.UTC(hy, hm - 1, hd);
  const tEv = Date.UTC(ey, em - 1, ed);
  const diffDias = Math.round((tEv - tHoje) / 86400000);
  if (diffDias <= 0) return { label: 'Hoje', isToday: true };
  if (diffDias === 1) return { label: 'Amanhã', isToday: false };
  return { label: `Em ${diffDias}d`, isToday: false };
}

function formatarDataBr(dataIso: string): string {
  const s = String(dataIso || '').slice(0, 10);
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : s;
}

export async function carregarProximosEventosAgenda(dias = 15): Promise<AgendaEventoResumo[]> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return [];

  const hoje = new Date();
  const hojeIso = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const limite = new Date(hoje.getTime() + dias * 86400000);
  const limiteIso = new Date(limite.getTime() - limite.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const { data, error } = await client
    .from('calendario_agenda')
    .select('id,titulo,data_inicio,data_fim,horario,setor,categoria,local')
    .gte('data_inicio', hojeIso)
    .lte('data_inicio', limiteIso)
    .neq('status', 'CANCELADO')
    .order('data_inicio', { ascending: true })
    .limit(12);

  if (error || !Array.isArray(data)) return [];
  return data as AgendaEventoResumo[];
}

export async function renderMuralCalendarStrip(
  containerEl: HTMLElement | null,
  onSelectEvento?: (evento: AgendaEventoResumo) => void
): Promise<AgendaEventoResumo[]> {
  if (!containerEl) return [];

  const eventos = await carregarProximosEventosAgenda(15);
  const hoje = new Date();
  const hojeIso = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  if (eventos.length === 0) {
    containerEl.innerHTML =
      '<div class="mural-event-pill-meta">Nenhum evento previsto para os próximos 15 dias na Agenda Intersetorial.</div>';
    return [];
  }

  containerEl.innerHTML = eventos
    .map((ev) => {
      const countdown = calcularContagemRegressiva(ev.data_inicio, hojeIso);
      const dataStr = formatarDataBr(ev.data_inicio);
      const horaStr = ev.horario ? ` às ${escapeHtml(ev.horario)}` : '';
      const localStr = ev.local ? ` • ${escapeHtml(ev.local)}` : '';
      return `
        <button type="button" class="mural-event-pill" data-evento-id="${escapeHtml(ev.id)}">
          <div class="mural-event-pill-top">
            <span class="mural-countdown-badge ${countdown.isToday ? 'is-today' : ''}">${escapeHtml(countdown.label)}</span>
            <span>${escapeHtml(dataStr)}${horaStr}</span>
          </div>
          <div class="mural-event-pill-title" title="${escapeHtml(ev.titulo)}">${escapeHtml(ev.titulo)}</div>
          <div class="mural-event-pill-meta">${escapeHtml(ev.setor || 'SMEB')}${localStr}</div>
        </button>
      `;
    })
    .join('');

  containerEl.querySelectorAll<HTMLButtonElement>('.mural-event-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const evId = btn.dataset.eventoId;
      const encontrado = eventos.find((item) => item.id === evId);
      if (encontrado && onSelectEvento) {
        onSelectEvento(encontrado);
      } else if (window.OlymposRouter?.navegarPara) {
        window.OlymposRouter.navegarPara('calendario');
      }
    });
  });

  return eventos;
}
