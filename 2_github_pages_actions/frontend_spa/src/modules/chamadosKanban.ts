/**
 * Onda 2: Quadro Kanban de Pendências com 4 Colunas, Drag-and-Drop HTML5,
 * Controles Acessíveis por Teclado, Vínculo de Documento e Timeline Drawer.
 * REGRA CRÍTICA: ZERO envio de e-mail ao solicitante em qualquer mudança de status.
 */

import '../styles/onda2.css';
import { openChamadoTimelineDrawer } from './chamadosTimelineDrawer';

export type KanbanStatus = 'RECEBIDO' | 'EM_ANALISE' | 'AGUARDANDO_ANEXO' | 'RESOLVIDO';

export interface KanbanColumnDef {
  status: KanbanStatus;
  titulo: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { status: 'RECEBIDO', titulo: 'Recebido' },
  { status: 'EM_ANALISE', titulo: 'Em Análise' },
  { status: 'AGUARDANDO_ANEXO', titulo: 'Aguardando Anexo' },
  { status: 'RESOLVIDO', titulo: 'Resolvido' }
];

let activeContainerId = 'chamadosKanbanRoot';
let kanbanActive = false;
let draggedTicketId: string | null = null;
let signalUnsubscribe: (() => void) | null = null;

function esc(val: unknown): string {
  if (val === null || val === undefined) return '';
  const app = (window as any).OlymposApp;
  if (app && typeof app.escapeHtml === 'function') {
    return app.escapeHtml(String(val));
  }
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizarUrlSegura(url: unknown): string {
  const raw = String(url || '').trim();
  if (/^https?:\/\/\S+/i.test(raw)) return raw;
  return '';
}

function getSupabaseClient(): any {
  const supa = (window as any).OlymposSupabase;
  if (!supa) return null;
  return typeof supa.getClient === 'function' ? supa.getClient() : supa.client || null;
}

function getOperadorNome(): string {
  const sess = (window as any).OlymposApp?.getSession?.();
  return String(sess?.nome || sess?.email || 'Operador Hub Olympos');
}

async function getCurrentAuthUid(): Promise<string | null> {
  const sess = (window as any).OlymposApp?.getSession?.();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cand = sess?.user?.id || sess?.profile?.id || sess?.userId || sess?.id || '';
  if (uuidRe.test(String(cand))) return String(cand);

  const supa = (window as any).OlymposSupabase;
  if (supa && typeof supa.getSession === 'function') {
    try {
      const sbSess = await supa.getSession();
      const uid = sbSess?.user?.id || '';
      if (uuidRe.test(String(uid))) return String(uid);
    } catch {
      // ignora
    }
  }
  return null;
}

export function normalizeKanbanStatus(rawStatus: unknown): KanbanStatus | 'CANCELADO' {
  const st = String(rawStatus || '').trim().toUpperCase();
  if (st === 'CANCELADO') return 'CANCELADO';
  if (st === 'RESOLVIDO' || st === 'CONCLUIDO') return 'RESOLVIDO';
  if (st === 'AGUARDANDO_ANEXO') return 'AGUARDANDO_ANEXO';
  if (st === 'EM_ANALISE' || st === 'EM_ANDAMENTO' || st === 'EM_ATENDIMENTO') return 'EM_ANALISE';
  return 'RECEBIDO';
}

function obterTicketsParaKanban(): any[] {
  const signals = (window as any).OlymposSignals;
  if (!signals) return [];
  const rawList: any[] = Array.isArray(signals.tickets?.value) ? signals.tickets.value : [];
  const urgFilter = String(signals.filterUrgencia?.value || 'TODOS');
  const setorFilter = String(signals.filterSetor?.value || 'TODOS');
  const statusFilter = String(signals.filterStatus?.value || 'ABERTOS');
  const query = String(signals.searchQuery?.value || '').trim().toLowerCase();

  const now = Date.now();
  return rawList
    .map((t) => {
      const item = { ...t };
      const stNorm = normalizeKanbanStatus(item.status);
      item._kanbanStatus = stNorm;
      const dt = new Date(item.criado_em || item.carimbo_data_hora || item.created_at || now);
      const ageHours = isNaN(dt.getTime()) ? 0 : Math.max(0, (now - dt.getTime()) / 3600000);
      const isOrigUrgent =
        item.urgencia === true ||
        item.urgente === true ||
        ['sim', 'true', '1'].includes(String(item.urgencia ?? item.urgente_solicitado ?? '').trim().toLowerCase());
      const isLido = Boolean(item.lido_em || item.lido || stNorm !== 'RECEBIDO');
      const isFinalizado = Boolean(item.finalizado_em || stNorm === 'RESOLVIDO' || stNorm === 'CANCELADO');
      const escalonado = !isOrigUrgent && !isLido && !isFinalizado && ageHours >= 24;
      item.urgencia_ativa = Boolean(item.urgencia_ativa || isOrigUrgent || escalonado);
      item.escalonado_24h = Boolean(item.escalonado_24h || escalonado);
      return item;
    })
    .filter((item) => {
      if (item._kanbanStatus === 'CANCELADO') return false;
      if (statusFilter === 'EM_ATENDIMENTO' && item._kanbanStatus !== 'EM_ANALISE') return false;
      if (statusFilter === 'CONCLUIDOS' && item._kanbanStatus !== 'RESOLVIDO') return false;
      if (urgFilter === 'URGENTE' && !item.urgencia_ativa) return false;
      if (urgFilter === 'PADRAO' && item.urgencia_ativa) return false;
      if (setorFilter !== 'TODOS' && String(item.setor || '').toLowerCase() !== setorFilter.toLowerCase()) {
        return false;
      }
      if (query) {
        const hay = [
          item.id,
          item.numero_protocolo,
          item.nome,
          item.nome_completo,
          item.email,
          item.setor,
          item.assunto_tipo,
          item.justificativa,
          item.descricao,
          item.documento_vinculado_numero
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
}

export async function moverPendenciaParaStatus(
  ticketId: string | number,
  novoStatus: KanbanStatus
): Promise<boolean> {
  const signals = (window as any).OlymposSignals;
  const list: any[] = signals?.tickets?.peek?.() || [];
  const ticket = list.find((t) => String(t.id) === String(ticketId));
  if (!ticket) return false;

  const statusAnterior = normalizeKanbanStatus(ticket.status);
  if (statusAnterior === novoStatus) return true;

  const nowIso = new Date().toISOString();
  const operador = getOperadorNome();
  const patch: Record<string, any> = { status: novoStatus };

  if (novoStatus !== 'RECEBIDO' && !ticket.lido_em) {
    patch.lido_em = nowIso;
    patch.atendido_por = operador;
  }
  if (novoStatus === 'RESOLVIDO') {
    patch.finalizado_em = nowIso;
    patch.resolvido_por = operador;
    patch.observacoes_resolucao = 'Movido para Resolvido no quadro Kanban (sem disparo de e-mail)';
  } else if (statusAnterior === 'RESOLVIDO') {
    patch.finalizado_em = null;
  }

  // Atualização otimista no OlymposSignals (ZERO disparo de e-mail ao solicitante!)
  signals?.updateTicket?.(ticketId, patch);
  renderKanbanBoard();

  const labelNovo = KANBAN_COLUMNS.find((c) => c.status === novoStatus)?.titulo || novoStatus;
  (window as any).OlymposApp?.showToast?.(
    `Pendência #${ticket.numero_protocolo || ticketId} movida para ${labelNovo}.`,
    'info'
  );
  (window as any).OlymposShortcuts?.anunciarLeitorTela?.(
    `Pendência ${ticket.numero_protocolo || ticketId} movida para ${labelNovo}.`
  );

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const dbPatch: Record<string, any> = { status: novoStatus };
    if (patch.lido_em !== undefined) dbPatch.lido_em = patch.lido_em;
    if (patch.finalizado_em !== undefined) dbPatch.finalizado_em = patch.finalizado_em;
    if (patch.resolvido_por !== undefined) dbPatch.resolvido_por = patch.resolvido_por;
    if (patch.observacoes_resolucao !== undefined) dbPatch.observacoes_resolucao = patch.observacoes_resolucao;

    const { error } = await client
      .from('pendencias_solicitacoes')
      .update(dbPatch)
      .eq('id', ticketId);
    if (error) throw error;

    const autorId = await getCurrentAuthUid();
    await client.from('pendencias_comentarios').insert({
      pendencia_id: Number(ticketId) || ticketId,
      autor_id: autorId,
      tipo_evento: 'MUDANCA_STATUS',
      conteudo: `Status alterado de ${statusAnterior} para ${novoStatus} por ${operador}.`
    });
    return true;
  } catch (err) {
    console.warn('[Kanban] Falha ao persistir mudança de status no Supabase:', err);
    return false;
  }
}

function renderCardHtml(ticket: any, colIndex: number): string {
  const idSafe = esc(ticket.id);
  const proto = String(ticket.numero_protocolo || ticket.id);
  const nome = String(ticket.nome || ticket.nome_completo || 'Solicitante SMEB');
  const assunto = String(ticket.assunto_tipo || ticket.justificativa || ticket.descricao || 'Sem assunto');
  const setor = String(ticket.setor || 'Geral');
  const dataLim = String(ticket.data_limite_entrega || ticket.dia_entrega || 'Conforme fila');
  const isUrgent = Boolean(ticket.urgencia_ativa);

  const prevCol = colIndex > 0 ? KANBAN_COLUMNS[colIndex - 1] : null;
  const nextCol = colIndex < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[colIndex + 1] : null;

  const docNum = ticket.documento_vinculado_numero;
  const docUrl = sanitizarUrlSegura(ticket.documento_vinculado_url);
  const docBadge = docNum || docUrl
    ? docUrl
      ? `<a href="${esc(docUrl)}" target="_blank" rel="noopener noreferrer" class="kanban-card-doc-badge" data-stop-card-open="1">${esc(docNum || 'Documento')} ↗</a>`
      : `<span class="kanban-card-doc-badge">${esc(docNum)}</span>`
    : '';

  return (
    `<article class="kanban-card${isUrgent ? ' is-urgent' : ''}" draggable="true" data-kanban-card-id="${idSafe}">` +
      '<div class="kanban-card-top">' +
        `<span class="kanban-card-protocol">#${esc(proto)}</span>` +
        (isUrgent
          ? `<span class="pill-badge pill-red" style="font-size:10px;">${ticket.escalonado_24h ? '24H' : 'URGENTE'}</span>`
          : '') +
      '</div>' +
      `<button type="button" class="kanban-card-open-btn" data-open-timeline="${idSafe}" aria-label="Abrir timeline da pendência #${esc(proto)}">` +
        `<div class="kanban-card-title">${esc(nome)}</div>` +
        `<div class="kanban-card-subject">${esc(assunto)}</div>` +
      '</button>' +
      '<div class="kanban-card-meta">' +
        `<span>${esc(setor)}</span>` +
        `<span>• Prazo: ${esc(dataLim)}</span>` +
      '</div>' +
      docBadge +
      '<div class="kanban-card-move-controls">' +
        `<button type="button" class="kanban-move-btn" data-move-ticket="${idSafe}" data-move-to="${prevCol ? prevCol.status : ''}" ${prevCol ? '' : 'disabled'} aria-label="${prevCol ? esc(`Mover #${proto} para ${prevCol.titulo}`) : 'Primeira coluna'}">← ${prevCol ? esc(prevCol.titulo) : ''}</button>` +
        `<button type="button" class="kanban-move-btn" data-move-ticket="${idSafe}" data-move-to="${nextCol ? nextCol.status : ''}" ${nextCol ? '' : 'disabled'} aria-label="${nextCol ? esc(`Mover #${proto} para ${nextCol.titulo}`) : 'Última coluna'}">${nextCol ? esc(nextCol.titulo) : ''} →</button>` +
      '</div>' +
    '</article>'
  );
}

export function renderKanbanBoard(): void {
  const root = document.getElementById(activeContainerId);
  if (!root || !kanbanActive) return;

  const tickets = obterTicketsParaKanban();
  const grouped = new Map<KanbanStatus, any[]>();
  for (const col of KANBAN_COLUMNS) {
    grouped.set(col.status, []);
  }
  for (const t of tickets) {
    const st = t._kanbanStatus as KanbanStatus;
    if (grouped.has(st)) {
      grouped.get(st)!.push(t);
    }
  }

  const colsHtml = KANBAN_COLUMNS.map((col, colIndex) => {
    const items = grouped.get(col.status) || [];
    const bodyHtml = items.length
      ? items.map((t) => renderCardHtml(t, colIndex)).join('')
      : '<div class="kanban-empty-col">Nenhuma pendência nesta etapa.</div>';

    return (
      `<section class="kanban-column" data-kanban-col="${col.status}" aria-label="Coluna ${esc(col.titulo)}">` +
        '<header class="kanban-column-header">' +
          `<h3 class="kanban-column-title"><span class="kanban-col-dot kanban-col-dot--${col.status}" aria-hidden="true"></span>${esc(col.titulo)}</h3>` +
          `<span class="pill-badge pill-gray">${items.length}</span>` +
        '</header>' +
        `<div class="kanban-column-body" data-kanban-dropzone="${col.status}">${bodyHtml}</div>` +
      '</section>'
    );
  }).join('');

  root.innerHTML = `<div class="kanban-board-wrap"><div class="kanban-board-grid">${colsHtml}</div></div>`;
  bindKanbanInteractions(root);
}

function bindKanbanInteractions(root: HTMLElement): void {
  if ((root as any)._boundKanbanRoot) return;
  (root as any)._boundKanbanRoot = true;

  root.addEventListener('click', (ev) => {
    const target = ev.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;

    if (target.closest('[data-stop-card-open]')) {
      return;
    }

    const moveBtn = target.closest('[data-move-ticket]') as HTMLButtonElement | null;
    if (moveBtn && !moveBtn.disabled) {
      const ticketId = moveBtn.getAttribute('data-move-ticket');
      const destino = moveBtn.getAttribute('data-move-to') as KanbanStatus | null;
      if (ticketId && destino) {
        void moverPendenciaParaStatus(ticketId, destino);
      }
      return;
    }

    const openBtn = target.closest('[data-open-timeline]') as HTMLElement | null;
    if (openBtn) {
      const ticketId = openBtn.getAttribute('data-open-timeline');
      if (ticketId) void openChamadoTimelineDrawer(ticketId);
      return;
    }

    const cardEl = target.closest('[data-kanban-card-id]') as HTMLElement | null;
    if (cardEl && !target.closest('.kanban-card-move-controls')) {
      const ticketId = cardEl.getAttribute('data-kanban-card-id');
      if (ticketId) void openChamadoTimelineDrawer(ticketId);
    }
  });

  root.addEventListener('dragstart', (ev) => {
    const raw = ev.target as Element | null;
    const card = raw && typeof raw.closest === 'function' ? (raw.closest('[data-kanban-card-id]') as HTMLElement | null) : null;
    if (!card) return;
    draggedTicketId = card.getAttribute('data-kanban-card-id');
    card.classList.add('is-dragging');
    if (ev.dataTransfer && draggedTicketId) {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', draggedTicketId);
    }
  });

  root.addEventListener('dragend', (ev) => {
    const raw = ev.target as Element | null;
    const card = raw && typeof raw.closest === 'function' ? (raw.closest('[data-kanban-card-id]') as HTMLElement | null) : null;
    if (card) card.classList.remove('is-dragging');
    root.querySelectorAll('.kanban-column.is-drag-over').forEach((c) => c.classList.remove('is-drag-over'));
    draggedTicketId = null;
  });

  root.addEventListener('dragover', (ev) => {
    const raw = ev.target as Element | null;
    const col = raw && typeof raw.closest === 'function' ? (raw.closest('[data-kanban-col]') as HTMLElement | null) : null;
    if (!col) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    col.classList.add('is-drag-over');
  });

  root.addEventListener('dragleave', (ev) => {
    const raw = ev.target as Element | null;
    const col = raw && typeof raw.closest === 'function' ? (raw.closest('[data-kanban-col]') as HTMLElement | null) : null;
    if (!col) return;
    const related = ev.relatedTarget as Node | null;
    if (!related || !col.contains(related)) {
      col.classList.remove('is-drag-over');
    }
  });

  root.addEventListener('drop', (ev) => {
    const raw = ev.target as Element | null;
    const col = raw && typeof raw.closest === 'function' ? (raw.closest('[data-kanban-col]') as HTMLElement | null) : null;
    if (!col) return;
    ev.preventDefault();
    col.classList.remove('is-drag-over');
    const destino = col.getAttribute('data-kanban-col') as KanbanStatus | null;
    const ticketId = draggedTicketId || ev.dataTransfer?.getData('text/plain') || '';
    if (ticketId && destino) {
      void moverPendenciaParaStatus(ticketId, destino);
    }
  });
}

export function setKanbanViewMode(mode: 'tabela' | 'kanban'): void {
  kanbanActive = mode === 'kanban';
  const btnTabela = document.getElementById('btnChamadosViewTabela');
  const btnKanban = document.getElementById('btnChamadosViewKanban');
  const listaEl = document.getElementById('chamadosListaContainer');
  const pagBar = document.getElementById('chamadosPaginacaoBar');
  const kanbanRoot = document.getElementById(activeContainerId);

  if (btnTabela) {
    btnTabela.classList.toggle('is-active', !kanbanActive);
    btnTabela.setAttribute('aria-pressed', !kanbanActive ? 'true' : 'false');
  }
  if (btnKanban) {
    btnKanban.classList.toggle('is-active', kanbanActive);
    btnKanban.setAttribute('aria-pressed', kanbanActive ? 'true' : 'false');
  }
  if (listaEl) listaEl.classList.toggle('hidden', kanbanActive);
  if (pagBar && kanbanActive) pagBar.classList.add('hidden');
  if (kanbanRoot) kanbanRoot.classList.toggle('hidden', !kanbanActive);

  if (kanbanActive) {
    renderKanbanBoard();
  } else if ((window as any).OlymposViews?.chamados?.renderFila) {
    (window as any).OlymposViews.chamados.renderFila();
  }
}

export function mountChamadosKanban(containerId: string = 'chamadosKanbanRoot'): void {
  activeContainerId = containerId;
  const signals = (window as any).OlymposSignals;
  if (signals && typeof signals.subscribe === 'function') {
    if (signalUnsubscribe) {
      try { signalUnsubscribe(); } catch {}
    }
    signalUnsubscribe = signals.subscribe(() => {
      if (kanbanActive) renderKanbanBoard();
    });
  }
}

export const OlymposChamadosKanban = {
  mount: mountChamadosKanban,
  render: renderKanbanBoard,
  setMode: setKanbanViewMode,
  moverStatus: moverPendenciaParaStatus,
  normalizeStatus: normalizeKanbanStatus
};

if (typeof window !== 'undefined') {
  (window as any).OlymposChamadosKanban = OlymposChamadosKanban;
}
