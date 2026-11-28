/**
 * Onda 6 — Sprint 6.2 & 6.3: Chat Interno em Tempo Real (Supabase Realtime + WebSocket).
 * Zero exposição de email/CPF (usa rpc_diretorio_interno_minimo).
 * Suporta: conversas diretas 1-a-1, grupos setoriais/temáticos, paginação cursor (id < oldest),
 * ações operacionais ("Transformar em Pendência", "Promover para o Mural"),
 * exportação local .xlsx lazy e arquivamento incremental Google Sheets via HMAC Gateway.
 */

import '../styles/onda6.css';
import chatHtml from '../templates/pages/chat.html?raw';
import { subscribeChatRoomRealtime, ChatRoomSubscriptionHandle, ChatRealtimeRow } from './comunicacao/realtimeClient';
import { chatUnreadByRoomSignal, onChatUnreadUpdated, refreshChatUnreadCounts } from '../core/chatBadge';
import { sanitizeRowsForExport } from '../core/safeSpreadsheet';
import { uploadComunicacaoAnexo, createAnexoSignedUrl, validateAnexoFile } from './comunicacao/anexosStorage';

export const routeId = 'chat';
export const htmlTemplate = chatHtml;

interface DirectoryUser {
  id: string;
  full_name: string;
  role_code: string;
  department: string;
}

interface ChatSalaRow {
  id: string;
  tipo: 'DIRETA' | 'GRUPO_SETORIAL' | 'GRUPO_TEMATICO';
  chave_direta: string | null;
  nome: string | null;
  setor_vinculado: string | null;
  arquivamento_drive_ativo: boolean;
  criado_por: string;
  ultima_mensagem_em: string | null;
  criado_em: string;
  displayName?: string;
  displaySub?: string;
  meuPapel?: string;
}

const PAGE_SIZE = 50;

let currentUserId = '';
let currentUserRole = '';
let directoryUsers: DirectoryUser[] = [];
const directoryMap = new Map<string, DirectoryUser>();
let rooms: ChatSalaRow[] = [];
let activeRoomId: string | null = null;
let messages: ChatRealtimeRow[] = [];
let oldestLoadedId: number | null = null;
let hasOlderMessages = false;
let editingMessageId: number | null = null;
let roomSubscription: ChatRoomSubscriptionHandle | null = null;
let badgeUnsubscribe: (() => void) | null = null;
let sidebarSearch = '';
let msgSearch = '';
let hashLeaveBound = false;
let mountInFlight: Promise<void> | null = null;
let pendingAnexoFile: File | null = null;

function updatePendingAnexoBar(): void {
  const bar = document.getElementById('chatPendingAnexoBar');
  const inp = document.getElementById('chatInputAnexo') as HTMLInputElement | null;
  if (!bar) return;
  if (!pendingAnexoFile) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    if (inp) inp.value = '';
    return;
  }
  const kb = Math.max(1, Math.round(pendingAnexoFile.size / 1024));
  bar.classList.remove('hidden');
  bar.innerHTML = `<span>📎 <strong>${esc(pendingAnexoFile.name)}</strong> (${kb} KB)</span><button type="button" id="btnChatRemoverAnexo" class="btn btn-ghost btn-sm" aria-label="Remover anexo">Remover</button>`;
}

function esc(v: unknown): string {
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(v ?? ''));
  }
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg: string, isErr = false): void {
  if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
    window.OlymposApp.showToast(msg, isErr);
  }
}

function formatHora(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function isModeratorOrGab(): boolean {
  return currentUserRole === 'MODERADOR' || currentUserRole === 'ADMIN_GABINETE';
}

async function resolveSession(): Promise<void> {
  const sess = window.OlymposApp?.getSession?.();
  currentUserRole = String(sess?.perfil?.id || '');
  if (sess?.user?.id) {
    currentUserId = String(sess.user.id);
    return;
  }
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;
  try {
    const res = await client.auth.getUser();
    currentUserId = res?.data?.user?.id || '';
  } catch {
    currentUserId = '';
  }
}

async function loadDirectory(): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;
  const { data, error } = await client.rpc('rpc_diretorio_interno_minimo');
  if (error || !Array.isArray(data)) return;
  directoryUsers = data as DirectoryUser[];
  directoryMap.clear();
  directoryUsers.forEach((u) => {
    directoryMap.set(u.id, u);
  });
}

function resolveAuthorLabel(uid: string): { nome: string; setor: string } {
  const found = directoryMap.get(uid);
  if (found) {
    return { nome: found.full_name, setor: found.department || found.role_code };
  }
  if (uid === currentUserId) {
    const sess = window.OlymposApp?.getSession?.();
    return {
      nome: String(sess?.nome || 'Você'),
      setor: String(sess?.department || currentUserRole || 'SMEB')
    };
  }
  return { nome: 'Equipe SMEB', setor: 'SMEB' };
}

async function loadRooms(): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  const listEl = document.getElementById('chatRoomList');
  if (!client || !currentUserId) {
    if (listEl) listEl.innerHTML = '<div class="chat-empty-state">Autentique-se para acessar o Chat Interno.</div>';
    return;
  }

  const { data: salasData, error } = await client
    .from('chat_salas')
    .select('id,tipo,chave_direta,nome,setor_vinculado,arquivamento_drive_ativo,criado_por,ultima_mensagem_em,criado_em')
    .is('arquivada_em', null)
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
    .order('criado_em', { ascending: false });

  if (error) {
    if (listEl) listEl.innerHTML = '<div class="chat-empty-state">Falha ao carregar conversas.</div>';
    showToast('Erro ao carregar salas do Chat: ' + error.message, true);
    return;
  }

  const rawRooms = (Array.isArray(salasData) ? salasData : []) as ChatSalaRow[];
  const roomIds = rawRooms.map((r) => r.id);
  const participantsByRoom = new Map<string, Array<{ user_id: string; papel_sala: string }>>();

  if (roomIds.length > 0) {
    const { data: partData } = await client
      .from('chat_participantes')
      .select('sala_id,user_id,papel_sala')
      .in('sala_id', roomIds);
    if (Array.isArray(partData)) {
      partData.forEach((p: any) => {
        const arr = participantsByRoom.get(p.sala_id) || [];
        arr.push({ user_id: p.user_id, papel_sala: p.papel_sala });
        participantsByRoom.set(p.sala_id, arr);
      });
    }
  }

  rooms = rawRooms.map((room) => {
    const parts = participantsByRoom.get(room.id) || [];
    const me = parts.find((p) => p.user_id === currentUserId);
    let displayName = room.nome || 'Sala SMEB';
    let displaySub = room.setor_vinculado || (room.tipo === 'GRUPO_SETORIAL' ? 'Grupo Setorial' : 'Grupo Temático');

    if (room.tipo === 'DIRETA') {
      const other = parts.find((p) => p.user_id !== currentUserId);
      const otherInfo = other ? directoryMap.get(other.user_id) : undefined;
      displayName = otherInfo?.full_name || 'Conversa Direta 1-a-1';
      displaySub = otherInfo ? `${otherInfo.department || otherInfo.role_code} • 1-a-1` : 'Conversa 1-a-1 (Privada)';
    }

    return {
      ...room,
      displayName,
      displaySub,
      meuPapel: me?.papel_sala || 'MEMBRO'
    };
  });

  renderRoomList();
}

function renderRoomList(): void {
  const listEl = document.getElementById('chatRoomList');
  if (!listEl) return;

  const q = sidebarSearch.trim().toLowerCase();
  const unreadMap = chatUnreadByRoomSignal.value;
  const visible = rooms.filter((r) => {
    if (!q) return true;
    return `${r.displayName || ''} ${r.displaySub || ''}`.toLowerCase().includes(q);
  });

  if (visible.length === 0) {
    listEl.innerHTML =
      '<div class="chat-empty-state">Nenhuma conversa ativa. Use <strong>+ Direta</strong> ou <strong>+ Grupo</strong>.</div>';
    return;
  }

  const diretas = visible.filter((r) => r.tipo === 'DIRETA');
  const grupos = visible.filter((r) => r.tipo !== 'DIRETA');

  const renderItem = (r: ChatSalaRow): string => {
    const isActive = r.id === activeRoomId;
    const unread = Number(unreadMap[r.id] || 0);
    return `
      <button
        type="button"
        class="chat-room-item ${isActive ? 'is-active' : ''}"
        data-sala-id="${esc(r.id)}"
        role="listitem"
      >
        <div class="chat-room-item-top">
          <span class="chat-room-name">${esc(r.displayName)}</span>
          ${unread > 0 ? `<span class="chat-unread-pill">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>
        <div class="chat-room-sub">
          <span>${esc(r.displaySub)}</span>
          <span>${esc(formatHora(r.ultima_mensagem_em || r.criado_em))}</span>
        </div>
      </button>
    `;
  };

  let html = '';
  if (grupos.length > 0) {
    html += '<div class="chat-room-group-label">Grupos Setoriais &amp; Temáticos</div>';
    html += grupos.map(renderItem).join('');
  }
  if (diretas.length > 0) {
    html += '<div class="chat-room-group-label">Conversas Diretas (1-a-1)</div>';
    html += diretas.map(renderItem).join('');
  }
  listEl.innerHTML = html;
}

function renderActiveHeader(): void {
  const room = rooms.find((r) => r.id === activeRoomId) || null;
  const titleEl = document.getElementById('chatThreadTitle');
  const subEl = document.getElementById('chatThreadSub');
  const inputEl = document.getElementById('chatComposerInput') as HTMLTextAreaElement | null;
  const attachBtn = document.getElementById('btnChatAnexarArquivo') as HTMLButtonElement | null;
  const sendBtn = document.getElementById('btnChatEnviar') as HTMLButtonElement | null;
  const toggleDriveBtn = document.getElementById('btnChatToggleDriveArchive');
  const exportDriveBtn = document.getElementById('btnChatExportarDrive');
  const exportXlsxBtn = document.getElementById('btnChatExportarXlsx');

  if (!room) {
    if (titleEl) titleEl.textContent = 'Selecione uma conversa';
    if (subEl) subEl.textContent = 'Escolha uma conversa direta ou grupo na lista ao lado.';
    if (inputEl) inputEl.disabled = true;
    if (attachBtn) attachBtn.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    toggleDriveBtn?.classList.add('hidden');
    exportDriveBtn?.classList.add('hidden');
    exportXlsxBtn?.classList.add('hidden');
    return;
  }

  if (titleEl) titleEl.textContent = room.displayName || 'Sala SMEB';
  if (subEl) subEl.textContent = room.displaySub || '';
  if (inputEl) inputEl.disabled = false;
  if (attachBtn) attachBtn.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  exportXlsxBtn?.classList.remove('hidden');

  if (exportDriveBtn) {
    exportDriveBtn.classList.remove('hidden');
    exportDriveBtn.textContent = room.tipo === 'DIRETA' ? 'Exportar Drive (Privado)' : 'Arquivar Drive';
  }

  if (toggleDriveBtn) {
    const canToggle = room.tipo === 'GRUPO_SETORIAL' && (room.meuPapel === 'ADMIN_SALA' || isModeratorOrGab());
    toggleDriveBtn.classList.toggle('hidden', !canToggle);
    toggleDriveBtn.textContent = `Arquivo Drive: ${room.arquivamento_drive_ativo ? 'ON' : 'OFF'}`;
  }
}

function renderMessages(): void {
  const pane = document.getElementById('chatMessagesPane');
  if (!pane) return;

  if (!activeRoomId) {
    pane.innerHTML =
      '<div class="chat-empty-state">Selecione uma conversa ou inicie um novo contato interno em <strong>+ Direta</strong>.</div>';
    return;
  }

  const q = msgSearch.trim().toLowerCase();
  const visible = messages.filter((m) => {
    if (!q) return true;
    const text = m.excluida_em ? '' : m.conteudo;
    return text.toLowerCase().includes(q);
  });

  const olderBtnHtml = hasOlderMessages
    ? '<div class="chat-load-older-wrap"><button type="button" id="btnChatCarregarAntigas" class="btn btn-secondary btn-sm">Carregar mensagens anteriores</button></div>'
    : '';

  if (visible.length === 0) {
    pane.innerHTML =
      olderBtnHtml +
      '<div class="chat-empty-state">Nenhuma mensagem registrada nesta sala ainda. Inicie a conversa abaixo.</div>';
    return;
  }

  const rowsHtml = visible
    .map((m) => {
      const isMine = m.remetente_id === currentUserId;
      const isDeleted = Boolean(m.excluida_em);
      const author = resolveAuthorLabel(m.remetente_id);
      const text = isDeleted ? '[Mensagem removida pelo autor]' : m.conteudo;
      const anexoMeta = !isDeleted && m.referencia_entidade_json && typeof m.referencia_entidade_json === 'object'
        ? (m.referencia_entidade_json as any).anexo
        : null;
      const anexoBtnHtml =
        anexoMeta && anexoMeta.path
          ? `<div class="chat-msg-anexo"><button type="button" class="btn btn-secondary btn-sm" data-msg-action="open-anexo" data-msg-id="${m.id}" data-anexo-path="${esc(anexoMeta.path)}">📎 ${esc(anexoMeta.nome || 'Abrir Anexo')}</button></div>`
          : '';

      return `
        <div class="chat-message-row ${isMine ? 'is-mine' : ''} ${isDeleted ? 'is-deleted' : ''}" data-msg-id="${m.id}">
          <div class="chat-msg-meta">
            <strong>${esc(isMine ? 'Você' : author.nome)}</strong>
            <span>(${esc(author.setor)})</span>
            <span>• ${esc(formatHora(m.enviada_em))}</span>
            ${m.editada_em && !isDeleted ? '<span>(editada)</span>' : ''}
          </div>
          <div class="chat-msg-bubble">${esc(text)}${anexoBtnHtml}</div>
          ${
            !isDeleted
              ? `<div class="chat-msg-actions">
                   <button type="button" class="chat-msg-action-btn" data-msg-action="pendencia" data-msg-id="${m.id}">Transformar em Pendência</button>
                   <button type="button" class="chat-msg-action-btn" data-msg-action="mural" data-msg-id="${m.id}">Promover para o Mural</button>
                   ${
                     isMine
                       ? `<button type="button" class="chat-msg-action-btn" data-msg-action="editar" data-msg-id="${m.id}">Editar</button>
                          <button type="button" class="chat-msg-action-btn" data-msg-action="excluir" data-msg-id="${m.id}">Excluir</button>`
                       : ''
                   }
                 </div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  pane.innerHTML = olderBtnHtml + rowsHtml;
}

async function openRoom(salaId: string): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client || !salaId) return;

  activeRoomId = salaId;
  editingMessageId = null;
  pendingAnexoFile = null;
  updatePendingAnexoBar();
  messages = [];
  oldestLoadedId = null;
  hasOlderMessages = false;

  const shell = document.getElementById('chatLayoutShell');
  if (shell && window.innerWidth <= 860) {
    shell.classList.add('is-mobile-thread-open');
  }

  renderRoomList();
  renderActiveHeader();

  if (roomSubscription) {
    roomSubscription.unsubscribe();
    roomSubscription = null;
  }

  const { data, error } = await client
    .from('chat_mensagens')
    .select('id,sala_id,remetente_id,conteudo,referencia_entidade_json,editada_em,excluida_em,enviada_em')
    .eq('sala_id', salaId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    showToast('Erro ao carregar mensagens da sala: ' + error.message, true);
    return;
  }

  const desc = Array.isArray(data) ? (data as ChatRealtimeRow[]) : [];
  hasOlderMessages = desc.length === PAGE_SIZE;
  messages = desc.slice().reverse();
  oldestLoadedId = messages.length > 0 ? messages[0].id : null;

  renderMessages();
  const pane = document.getElementById('chatMessagesPane');
  if (pane) pane.scrollTop = pane.scrollHeight;

  await markRoomAsRead(salaId);

  roomSubscription = subscribeChatRoomRealtime(salaId, {
    onInsert: (row) => {
      if (row.sala_id !== activeRoomId) return;
      if (!messages.some((m) => m.id === row.id)) {
        messages.push(row);
        renderMessages();
        const paneEl = document.getElementById('chatMessagesPane');
        if (paneEl) paneEl.scrollTop = paneEl.scrollHeight;
      }
      if (row.remetente_id !== currentUserId) {
        void markRoomAsRead(salaId);
      }
    },
    onUpdate: (row) => {
      if (row.sala_id !== activeRoomId) return;
      const idx = messages.findIndex((m) => m.id === row.id);
      if (idx >= 0) {
        messages[idx] = row;
        renderMessages();
      }
    }
  });
}

async function loadOlderMessages(): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client || !activeRoomId || oldestLoadedId === null) return;

  const { data, error } = await client
    .from('chat_mensagens')
    .select('id,sala_id,remetente_id,conteudo,referencia_entidade_json,editada_em,excluida_em,enviada_em')
    .eq('sala_id', activeRoomId)
    .lt('id', oldestLoadedId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  if (error || !Array.isArray(data)) return;

  const olderAsc = (data as ChatRealtimeRow[]).slice().reverse();
  hasOlderMessages = data.length === PAGE_SIZE;
  if (olderAsc.length > 0) {
    messages = [...olderAsc, ...messages];
    oldestLoadedId = messages[0].id;
  }
  renderMessages();
}

async function markRoomAsRead(salaId: string): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;
  try {
    await client.rpc('rpc_chat_marcar_sala_lida', { p_sala_id: salaId });
    await refreshChatUnreadCounts();
  } catch {
    // ignore read pointer errors
  }
}

async function handleSendOrEditMessage(ev?: Event): Promise<void> {
  if (ev) ev.preventDefault();
  const client = window.OlymposSupabase?.getClient?.();
  const input = document.getElementById('chatComposerInput') as HTMLTextAreaElement | null;
  const sendBtn = document.getElementById('btnChatEnviar') as HTMLButtonElement | null;
  if (!client || !activeRoomId || !currentUserId || !input) return;

  const rawConteudo = input.value.trim();
  const hasAnexo = editingMessageId === null && Boolean(pendingAnexoFile);
  if (!rawConteudo && !hasAnexo) return;
  const conteudo = rawConteudo || (pendingAnexoFile ? `📎 Anexo: ${pendingAnexoFile.name}` : '');

  if (sendBtn) sendBtn.disabled = true;
  try {
    if (editingMessageId !== null) {
      const targetId = editingMessageId;
      const { error } = await client
        .from('chat_mensagens')
        .update({ conteudo, editada_em: new Date().toISOString() })
        .eq('id', targetId)
        .eq('remetente_id', currentUserId);
      if (error) {
        showToast('Erro ao editar mensagem: ' + error.message, true);
        return;
      }
      const editIso = new Date().toISOString();
      const idx = messages.findIndex((m) => m.id === targetId);
      if (idx >= 0) {
        messages[idx] = { ...messages[idx], conteudo, editada_em: editIso };
        renderMessages();
      }
      editingMessageId = null;
      if (sendBtn) sendBtn.textContent = 'Enviar';
      input.value = '';
      showToast('Mensagem atualizada.');
    } else {
      let refJson: Record<string, any> | null = null;
      if (pendingAnexoFile) {
        const up = await uploadComunicacaoAnexo(pendingAnexoFile, {
          kind: 'chat',
          salaId: activeRoomId,
          userId: currentUserId
        });
        refJson = { anexo: up };
      }

      const { data, error } = await client
        .from('chat_mensagens')
        .insert({
          sala_id: activeRoomId,
          remetente_id: currentUserId,
          conteudo,
          referencia_entidade_json: refJson
        })
        .select('id,sala_id,remetente_id,conteudo,referencia_entidade_json,editada_em,excluida_em,enviada_em')
        .single();

      if (error) {
        showToast('Falha ao enviar mensagem: ' + error.message, true);
        return;
      }
      input.value = '';
      pendingAnexoFile = null;
      updatePendingAnexoBar();
      if (data && !messages.some((m) => m.id === (data as ChatRealtimeRow).id)) {
        messages.push(data as ChatRealtimeRow);
        renderMessages();
        const pane = document.getElementById('chatMessagesPane');
        if (pane) pane.scrollTop = pane.scrollHeight;
      }
    }
  } catch (err: any) {
    showToast(err?.message || 'Erro ao enviar mensagem ou anexo.', true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

async function handleMessageAction(action: string, msgId: number): Promise<void> {
  const msg = messages.find((m) => m.id === msgId);
  const room = rooms.find((r) => r.id === activeRoomId);
  if (!msg || !room) return;

  if (action === 'open-anexo') {
    const path = (msg.referencia_entidade_json as any)?.anexo?.path || '';
    if (path) {
      try {
        const url = await createAnexoSignedUrl(path, 120);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err: any) {
        showToast(err?.message || 'Não foi possível abrir anexo.', true);
      }
    }
    return;
  }

  if (action === 'pendencia') {
    try {
      sessionStorage.setItem(
        'olympos_chat_prefill_pendencia',
        JSON.stringify({
          titulo: `Solicitação originada no Chat (${room.displayName || 'Sala SMEB'})`,
          justificativa: msg.conteudo,
          referenciaChat: {
            sala_id: room.id,
            sala_nome: room.displayName || 'Sala SMEB',
            mensagem_id: msg.id
          }
        })
      );
      window.OlymposRouter?.navegarPara?.('chamados');
    } catch {
      showToast('Não foi possível encaminhar para Nova Pendência.', true);
    }
    return;
  }

  if (action === 'mural') {
    try {
      sessionStorage.setItem(
        'olympos_chat_prefill_mural',
        JSON.stringify({
          titulo: `Comunicado (${room.displayName || 'Chat SMEB'})`,
          resumo: msg.conteudo.slice(0, 900),
          conteudo_md: msg.conteudo
        })
      );
      window.OlymposRouter?.navegarPara?.('mural');
    } catch {
      showToast('Não foi possível encaminhar para o Mural.', true);
    }
    return;
  }

  if (action === 'editar' && msg.remetente_id === currentUserId) {
    editingMessageId = msg.id;
    const input = document.getElementById('chatComposerInput') as HTMLTextAreaElement | null;
    const sendBtn = document.getElementById('btnChatEnviar') as HTMLButtonElement | null;
    if (input) {
      input.value = msg.conteudo;
      input.focus();
    }
    if (sendBtn) sendBtn.textContent = 'Salvar Edição';
    return;
  }

  if (action === 'excluir' && msg.remetente_id === currentUserId) {
    const client = window.OlymposSupabase?.getClient?.();
    if (!client) return;
    const deletedIso = new Date().toISOString();
    const { error } = await client
      .from('chat_mensagens')
      .update({ excluida_em: deletedIso })
      .eq('id', msg.id)
      .eq('remetente_id', currentUserId);
    if (error) {
      showToast('Erro ao remover mensagem: ' + error.message, true);
      return;
    }
    const idx = messages.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
      messages[idx] = { ...messages[idx], excluida_em: deletedIso };
      renderMessages();
    }
    showToast('Mensagem removida.');
  }
}

async function handleToggleDriveArchiveFlag(): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  const room = rooms.find((r) => r.id === activeRoomId);
  if (!client || !room || room.tipo !== 'GRUPO_SETORIAL') return;

  const nextVal = !room.arquivamento_drive_ativo;
  const { error } = await client
    .from('chat_salas')
    .update({ arquivamento_drive_ativo: nextVal })
    .eq('id', room.id);

  if (error) {
    showToast('Erro ao alterar arquivamento no Drive (verifique permissão/2FA): ' + error.message, true);
    return;
  }
  room.arquivamento_drive_ativo = nextVal;
  renderActiveHeader();
  showToast(`Arquivamento automático em Google Sheets ${nextVal ? 'ativado' : 'desativado'}.`);
}

async function handleExportDriveIncremental(): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  const room = rooms.find((r) => r.id === activeRoomId);
  if (!client || !room) return;

  const modo = room.tipo === 'DIRETA' ? 'PRIVADO_SOB_DEMANDA' : 'GRUPO_INCREMENTAL';
  if (room.tipo === 'DIRETA') {
    const ok = window.confirm(
      'Conversas diretas 1-a-1 NÃO vão para a pasta coletiva. Deseja gerar uma cópia privada sob demanda no Drive de Exports?'
    );
    if (!ok) return;
  }

  const [{ data: metaRows }, { data: batchRows, error: batchErr }] = await Promise.all([
    client.from('chat_arquivos_drive').select('drive_spreadsheet_id,ultima_mensagem_id_arquivada').eq('sala_id', room.id).maybeSingle(),
    client.rpc('rpc_chat_obter_lote_arquivamento', { p_sala_id: room.id, p_limite: 500 })
  ]);

  if (batchErr) {
    showToast('Falha ao obter lote incremental: ' + batchErr.message, true);
    return;
  }

  const msgsLote = Array.isArray(batchRows) ? batchRows : [];
  if (msgsLote.length === 0) {
    showToast('Nenhuma nova mensagem pendente de arquivamento para esta sala.');
    return;
  }

  if (!window.OlymposApi || typeof window.OlymposApi.chamar !== 'function') {
    showToast('Gateway HMAC OlymposApi indisponível no momento.', true);
    return;
  }

  const btn = document.getElementById('btnChatExportarDrive') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  window.OlymposApi.chamar(
    'chat_exportar_planilha_drive',
    {
      dados: {
        salaId: room.id,
        tipoSala: room.tipo,
        nomeSala: room.displayName || room.nome || room.id.slice(0, 8),
        modo,
        spreadsheetId: metaRows?.drive_spreadsheet_id || '',
        ultimaMensagemIdArquivada: Number(metaRows?.ultima_mensagem_id_arquivada || 0),
        mensagens: msgsLote
      }
    },
    (res: any) => {
      if (btn) btn.disabled = false;
      const total = Number(res?.totalAdicionadas || msgsLote.length);
      showToast(`Arquivamento Drive concluído (${total} mensagens sincronizadas).`);
    },
    (err: any) => {
      if (btn) btn.disabled = false;
      showToast('Falha no arquivamento Drive: ' + (err?.message || 'Erro de comunicação'), true);
    }
  );
}

async function handleExportXlsxLocal(): Promise<void> {
  const room = rooms.find((r) => r.id === activeRoomId);
  if (!room || messages.length === 0) {
    showToast('Não há mensagens carregadas nesta conversa para exportar.', true);
    return;
  }

  const XLSX = await import('xlsx');
  const rows = messages.map((m) => {
    const author = resolveAuthorLabel(m.remetente_id);
    return {
      ID_Mensagem: m.id,
      Data_Hora: formatHora(m.enviada_em),
      Usuario: author.nome,
      Setor_Perfil: author.setor,
      Mensagem: m.excluida_em ? '[Mensagem removida pelo autor]' : m.conteudo,
      Status: m.excluida_em ? 'REMOVIDA' : m.editada_em ? 'EDITADA' : 'ATIVA'
    };
  });

  const ws = XLSX.utils.json_to_sheet(sanitizeRowsForExport(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historico_Chat');
  const safeName = (room.displayName || 'Chat_SMEB').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
  XLSX.writeFile(wb, `Olympos_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast('Histórico exportado localmente em .xlsx.');
}

function renderDirectoryModalList(filterText = ''): void {
  const box = document.getElementById('chatDirResults');
  if (!box) return;
  const q = filterText.trim().toLowerCase();
  const candidates = directoryUsers.filter((u) => {
    if (u.id === currentUserId) return false;
    if (!q) return true;
    return `${u.full_name} ${u.department} ${u.role_code}`.toLowerCase().includes(q);
  });

  if (candidates.length === 0) {
    const msgVazia = directoryUsers.length <= 1
      ? 'Nenhum outro colega cadastrado no diretório interno ainda (novos servidores aparecem aqui após cadastro em Ajustes > Usuários). Use <strong>+ Grupo</strong> para criar uma sala imediatamente.'
      : 'Nenhum colega encontrado para o filtro digitado.';
    box.innerHTML = `<div class="chat-member-dept">${msgVazia}</div>`;
    return;
  }

  box.innerHTML = candidates
    .map(
      (u) => `
      <button type="button" class="chat-member-option" data-direct-uid="${esc(u.id)}" style="width:100%;border:0;background:transparent;text-align:left;">
        <span class="chat-member-option-info"><strong>${esc(u.full_name)}</strong></span>
        <span class="chat-member-dept">${esc(u.department || u.role_code)}</span>
      </button>
    `
    )
    .join('');
}

function renderGroupMembersChecklist(): void {
  const box = document.getElementById('chatGrupoMembrosList');
  if (!box) return;
  const others = directoryUsers.filter((u) => u.id !== currentUserId);
  if (others.length === 0) {
    box.innerHTML = '<div class="chat-member-dept">Nenhum outro servidor listado no diretório interno.</div>';
    return;
  }

  box.innerHTML = others
    .map(
      (u) => `
      <label class="chat-member-option">
        <span class="chat-member-option-info">
          <input type="checkbox" name="chatGrupoMembro" value="${esc(u.id)}" />
          <span>${esc(u.full_name)}</span>
        </span>
        <span class="chat-member-dept">${esc(u.department || u.role_code)}</span>
      </label>
    `
    )
    .join('');
}

async function handleCreateDirectRoom(otherUid: string): Promise<void> {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client || !otherUid) return;

  const { data, error } = await client.rpc('rpc_chat_obter_ou_criar_sala_direta', {
    p_outro_user_id: otherUid
  });

  if (error || !data) {
    showToast('Erro ao abrir conversa direta: ' + (error?.message || 'falha desconhecida'), true);
    return;
  }

  const modal = document.getElementById('modalNovoChatDireto');
  if (modal) window.OlymposModalManager?.closeModal?.(modal);

  await loadRooms();
  await openRoom(String(data));
}

async function handleCreateGroupSubmit(ev: Event): Promise<void> {
  ev.preventDefault();
  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;

  const nome = ((document.getElementById('chatGrupoNome') as HTMLInputElement | null)?.value || '').trim();
  const tipo = (document.getElementById('chatGrupoTipo') as HTMLSelectElement | null)?.value || 'GRUPO_SETORIAL';
  const setor = ((document.getElementById('chatGrupoSetor') as HTMLInputElement | null)?.value || '').trim() || null;
  const driveOn = tipo === 'GRUPO_SETORIAL' && Boolean((document.getElementById('chatGrupoDriveArchive') as HTMLInputElement | null)?.checked);
  const membros = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="chatGrupoMembro"]:checked')).map(
    (el) => el.value
  );

  if (nome.length < 2) {
    showToast('Informe um nome válido para o grupo.', true);
    return;
  }

  const btn = document.getElementById('btnCriarChatGrupoSubmit') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  try {
    const { data, error } = await client.rpc('rpc_chat_criar_grupo', {
      p_nome: nome,
      p_tipo: tipo,
      p_setor_vinculado: setor,
      p_membros: membros,
      p_arquivamento_drive: driveOn
    });

    if (error || !data) {
      showToast('Erro ao criar grupo: ' + (error?.message || 'falha desconhecida'), true);
      return;
    }

    const modal = document.getElementById('modalNovoChatGrupo');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
    (document.getElementById('formNovoChatGrupo') as HTMLFormElement | null)?.reset();
    showToast('Grupo criado com sucesso.');
    await loadRooms();
    await openRoom(String(data));
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindEventsOnce(): void {
  const page = document.getElementById('page-chat');
  if (!page || page.dataset.chatBound === '1') return;
  page.dataset.chatBound = '1';

  document.getElementById('btnChatIrMural')?.addEventListener('click', () => {
    window.OlymposRouter?.navegarPara?.('mural');
  });

  document.getElementById('btnChatAtualizarSalas')?.addEventListener('click', () => {
    void refreshChatState();
  });

  document.getElementById('btnChatVoltarLista')?.addEventListener('click', () => {
    document.getElementById('chatLayoutShell')?.classList.remove('is-mobile-thread-open');
  });

  document.getElementById('chatSidebarSearch')?.addEventListener('input', (ev) => {
    sidebarSearch = (ev.target as HTMLInputElement)?.value || '';
    renderRoomList();
  });

  document.getElementById('chatMsgSearchInput')?.addEventListener('input', (ev) => {
    msgSearch = (ev.target as HTMLInputElement)?.value || '';
    renderMessages();
  });

  document.getElementById('chatRoomList')?.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-sala-id]');
    if (btn?.dataset.salaId) {
      void openRoom(btn.dataset.salaId);
    }
  });

  document.getElementById('chatMessagesPane')?.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement | null;
    if (target?.id === 'btnChatCarregarAntigas') {
      void loadOlderMessages();
      return;
    }
    const btn = target?.closest<HTMLButtonElement>('[data-msg-action]');
    if (btn?.dataset.msgAction && btn?.dataset.msgId) {
      void handleMessageAction(btn.dataset.msgAction, Number(btn.dataset.msgId));
    }
  });

  document.getElementById('chatComposerForm')?.addEventListener('submit', (ev) => {
    void handleSendOrEditMessage(ev);
  });

  document.getElementById('btnChatAnexarArquivo')?.addEventListener('click', () => {
    document.getElementById('chatInputAnexo')?.click();
  });

  document.getElementById('chatInputAnexo')?.addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement)?.files?.[0] || null;
    if (!file) return;
    const valid = validateAnexoFile(file);
    if (!valid.ok) {
      showToast(valid.message, true);
      (ev.target as HTMLInputElement).value = '';
      return;
    }
    pendingAnexoFile = file;
    updatePendingAnexoBar();
  });

  document.getElementById('chatPendingAnexoBar')?.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('#btnChatRemoverAnexo');
    if (btn) {
      pendingAnexoFile = null;
      updatePendingAnexoBar();
    }
  });

  document.getElementById('chatComposerInput')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      void handleSendOrEditMessage();
    }
  });

  document.getElementById('btnNovoChatDireto')?.addEventListener('click', () => {
    const modal = document.getElementById('modalNovoChatDireto');
    const search = document.getElementById('chatDirSearch') as HTMLInputElement | null;
    if (search) search.value = '';
    renderDirectoryModalList('');
    if (modal) window.OlymposModalManager?.openModal?.(modal);
    if (directoryUsers.length <= 1) {
      void loadDirectory().then(() => renderDirectoryModalList(search?.value || ''));
    }
  });

  document.getElementById('btnFecharChatDireto')?.addEventListener('click', () => {
    const modal = document.getElementById('modalNovoChatDireto');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
  });

  document.getElementById('chatDirSearch')?.addEventListener('input', (ev) => {
    renderDirectoryModalList((ev.target as HTMLInputElement)?.value || '');
  });

  document.getElementById('chatDirResults')?.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-direct-uid]');
    if (btn?.dataset.directUid) {
      void handleCreateDirectRoom(btn.dataset.directUid);
    }
  });

  document.getElementById('btnNovoChatGrupo')?.addEventListener('click', () => {
    renderGroupMembersChecklist();
    const modal = document.getElementById('modalNovoChatGrupo');
    if (modal) window.OlymposModalManager?.openModal?.(modal);
    if (directoryUsers.length <= 1) {
      void loadDirectory().then(() => renderGroupMembersChecklist());
    }
  });

  document.getElementById('btnFecharChatGrupo')?.addEventListener('click', () => {
    const modal = document.getElementById('modalNovoChatGrupo');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
  });

  document.getElementById('btnCancelarChatGrupo')?.addEventListener('click', () => {
    const modal = document.getElementById('modalNovoChatGrupo');
    if (modal) window.OlymposModalManager?.closeModal?.(modal);
  });

  document.getElementById('formNovoChatGrupo')?.addEventListener('submit', (ev) => {
    void handleCreateGroupSubmit(ev);
  });

  document.getElementById('btnChatToggleDriveArchive')?.addEventListener('click', () => {
    void handleToggleDriveArchiveFlag();
  });

  document.getElementById('btnChatExportarDrive')?.addEventListener('click', () => {
    void handleExportDriveIncremental();
  });

  document.getElementById('btnChatExportarXlsx')?.addEventListener('click', () => {
    void handleExportXlsxLocal();
  });

  if (!hashLeaveBound) {
    hashLeaveBound = true;
    window.addEventListener('hashchange', () => {
      const current = window.location.hash.replace('#', '').trim().split(/[/?]/)[0];
      if (current !== 'chat') {
        unmount();
      }
    });
  }
}

async function refreshChatState(): Promise<void> {
  await resolveSession();
  await loadDirectory();
  await loadRooms();
  await refreshChatUnreadCounts();
  renderActiveHeader();
}

export async function mount(): Promise<void> {
  if (mountInFlight) return mountInFlight;
  bindEventsOnce();
  if (!badgeUnsubscribe) {
    badgeUnsubscribe = onChatUnreadUpdated(() => {
      renderRoomList();
    });
  }
  mountInFlight = (async () => {
    try {
      await refreshChatState();
      if (activeRoomId && rooms.some((r) => r.id === activeRoomId)) {
        await openRoom(activeRoomId);
      }
    } finally {
      mountInFlight = null;
    }
  })();
  return mountInFlight;
}

export function unmount(): void {
  if (roomSubscription) {
    roomSubscription.unsubscribe();
    roomSubscription = null;
  }
  if (badgeUnsubscribe) {
    badgeUnsubscribe();
    badgeUnsubscribe = null;
  }
}

window.OlymposChat = {
  recarregar: refreshChatState,
  abrirSala: openRoom
};

if (typeof window !== 'undefined') {
  window.OlymposViews = window.OlymposViews || {};
  window.OlymposViews.chat = {
    init: () => {
      void mount();
    }
  };
}
