/**
 * Assinatura Supabase Realtime (WebSocket) isolada por sala de chat.
 * Garante unsubscribe determinístico ao trocar de sala ou sair da view #chat.
 */

export interface ChatRealtimeRow {
  id: number;
  sala_id: string;
  remetente_id: string;
  conteudo: string;
  referencia_entidade_json: Record<string, any> | null;
  editada_em: string | null;
  excluida_em: string | null;
  enviada_em: string;
}

export interface ChatRoomSubscriptionHandle {
  unsubscribe: () => void;
}

export function subscribeChatRoomRealtime(
  salaId: string,
  handlers: {
    onInsert?: (row: ChatRealtimeRow) => void;
    onUpdate?: (row: ChatRealtimeRow) => void;
    onStatusChange?: (status: string) => void;
  }
): ChatRoomSubscriptionHandle {
  const client = window.OlymposSupabase?.getClient?.();
  if (!client || !salaId) {
    return { unsubscribe: () => {} };
  }

  const channelName = `olympos-chat-sala-${salaId}-${Date.now()}`;
  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_mensagens',
        filter: `sala_id=eq.${salaId}`
      },
      (payload: any) => {
        if (payload?.new && handlers.onInsert) {
          handlers.onInsert(payload.new as ChatRealtimeRow);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_mensagens',
        filter: `sala_id=eq.${salaId}`
      },
      (payload: any) => {
        if (payload?.new && handlers.onUpdate) {
          handlers.onUpdate(payload.new as ChatRealtimeRow);
        }
      }
    )
    .subscribe((status: string) => {
      if (handlers.onStatusChange) {
        handlers.onStatusChange(status);
      }
    });

  return {
    unsubscribe: () => {
      try {
        void client.removeChannel(channel);
      } catch {
        // channel teardown best effort
      }
    }
  };
}
