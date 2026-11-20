/**
 * OlymposSignals — Motor de Reatividade Baseado em Signals (@preact/signals-core pattern)
 * Hub Olympos V3.0 — SMEB Ceará-Mirim/RN
 * 
 * Fornece reatividade de alto desempenho e determinística (~1.6kB) sem overhead de Virtual DOM,
 * gerenciando a fila de chamados, filtros e telemetria com ordenação cronológica estrita (criado_em ASC).
 */
(function(root) {
  'use strict';

  // --- Primitivas de Sinais (Micro-Signals Core) ---
  function signal(initialValue) {
    let _value = initialValue;
    const subscribers = new Set();

    function read() {
      return _value;
    }

    function write(newValue) {
      if (_value !== newValue) {
        _value = newValue;
        const snapshot = Array.from(subscribers);
        for (let i = 0; i < snapshot.length; i++) {
          try {
            snapshot[i](_value);
          } catch (err) {
            console.error('[Signals] Erro no subscriber:', err);
          }
        }
      }
    }

    const s = {
      get value() {
        return read();
      },
      set value(v) {
        write(v);
      },
      peek: function() {
        return _value;
      },
      subscribe: function(callback) {
        subscribers.add(callback);
        // Notificação imediata com valor atual
        try {
          callback(_value);
        } catch (err) {
          console.error('[Signals] Erro na subscrição inicial:', err);
        }
        return function unsubscribe() {
          subscribers.delete(callback);
        };
      },
      get subscribersCount() {
        return subscribers.size;
      }
    };

    return s;
  }

  function computed(fn) {
    const s = signal(fn());
    return {
      get value() {
        return fn();
      },
      subscribe: s.subscribe,
      peek: function() {
        return fn();
      }
    };
  }

  function effect(fn) {
    let cleanup = null;
    function run() {
      if (typeof cleanup === 'function') {
        try { cleanup(); } catch (e) {}
      }
      cleanup = fn();
    }
    run();
    return function stopEffect() {
      if (typeof cleanup === 'function') {
        try { cleanup(); } catch (e) {}
      }
    };
  }

  // --- Gerenciador de Estado Reativo da Fila de Chamados & Filtros ---
  const ticketsSignal = signal([]);
  const filterUrgenciaSignal = signal('TODOS'); // 'TODOS', 'URGENTE', 'PADRAO'
  const filterSetorSignal = signal('TODOS');
  const filterStatusSignal = signal('ABERTOS'); // 'ABERTOS', 'EM_ATENDIMENTO', 'CONCLUIDOS', 'TODOS'
  const searchQuerySignal = signal('');

  function parseDateSafe(val) {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    const s = String(val).trim();
    // Suporte a formato ISO ou DD/MM/YYYY HH:mm
    if (s.includes('T') || s.endsWith('Z')) {
      return new Date(s);
    }
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const hour = dmy[4] ? parseInt(dmy[4], 10) : 8;
      const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
      return new Date(year, month, day, hour, min, 0);
    }
    return new Date(s);
  }

  function isUrgentOriginal(ticket) {
    if (!ticket) return false;
    if (ticket.urgencia === true || ticket.urgente_solicitado === true || ticket.urgente === true) {
      return true;
    }
    const val = ticket.urgencia != null
      ? ticket.urgencia
      : (ticket.urgente_solicitado != null ? ticket.urgente_solicitado : (ticket.urgente || ''));
    const norm = String(val).trim().toLowerCase();
    return norm === 'sim' || norm === 'true' || norm === '1';
  }

  function computeTicketState(ticket, nowDt) {
    const item = Object.assign({}, ticket);
    const now = nowDt ? parseDateSafe(nowDt) : new Date();
    const criadoEm = parseDateSafe(item.criado_em || item.carimbo_data_hora || item.created_at || item.data_abertura);
    const diffMs = Math.max(0, now.getTime() - criadoEm.getTime());
    const idadeHoras = diffMs / (1000 * 3600);

    const isOrigUrgent = isUrgentOriginal(item);
    const statusUpper = String(item.status || '').toUpperCase();
    const isLido = !!(item.lido_em || item.lido || statusUpper === 'EM_ANDAMENTO' || statusUpper === 'EM_ATENDIMENTO' || statusUpper === 'RESOLVIDO');
    const isFinalizado = !!(item.finalizado_em || statusUpper === 'RESOLVIDO' || statusUpper === 'CONCLUIDO');

    // Regra de escalonamento 24h: se passou de 24h sem leitura ou resolução -> escalona
    const escalonado = (!isOrigUrgent && !isLido && !isFinalizado && idadeHoras >= 24);
    const urgenciaAtiva = isOrigUrgent || escalonado;

    item.urgencia_ativa = urgenciaAtiva;
    item.urgente = urgenciaAtiva;
    item.escalonado_24h = escalonado;
    item.horas_em_aberto = Math.round(idadeHoras * 10) / 10;
    item.idade_horas = item.horas_em_aberto;

    return item;
  }

  function sortChronologicalAsc(list) {
    return list.slice().sort(function(a, b) {
      const da = parseDateSafe(a.criado_em || a.carimbo_data_hora || a.created_at || a.data_abertura).getTime();
      const db = parseDateSafe(b.criado_em || b.carimbo_data_hora || b.created_at || b.data_abertura).getTime();
      return da - db;
    });
  }

  function loadTickets(tickets) {
    const sorted = sortChronologicalAsc(Array.isArray(tickets) ? tickets : []);
    ticketsSignal.value = sorted;
  }

  function addTicket(ticket) {
    if (!ticket) return;
    const current = ticketsSignal.peek().slice();
    current.push(ticket);
    ticketsSignal.value = sortChronologicalAsc(current);
  }

  function updateTicket(id, patch) {
    const current = ticketsSignal.peek().slice();
    const idx = current.findIndex(function(t) {
      return String(t.id) === String(id);
    });
    if (idx !== -1) {
      current[idx] = Object.assign({}, current[idx], patch);
      ticketsSignal.value = sortChronologicalAsc(current);
    }
  }

  function getActiveQueue(nowDt) {
    const list = ticketsSignal.value;
    const result = [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.status === 'RESOLVIDO' || t.status === 'CONCLUIDO') {
        continue;
      }
      result.push(computeTicketState(t, nowDt));
    }
    return result;
  }

  function getFilteredTickets(nowDt) {
    const rawList = ticketsSignal.value;
    const urgFilter = filterUrgenciaSignal.value;
    const setorFilter = filterSetorSignal.value;
    const statusFilter = filterStatusSignal.value;
    const query = (searchQuerySignal.value || '').trim().toLowerCase();

    const filtered = [];

    for (let i = 0; i < rawList.length; i++) {
      const enriched = computeTicketState(rawList[i], nowDt);

      // Filtro de Status
      const status = (enriched.status || 'ABERTO').toUpperCase();
      if (statusFilter === 'ABERTOS') {
        if (status === 'RESOLVIDO' || status === 'CONCLUIDO') continue;
      } else if (statusFilter === 'EM_ATENDIMENTO') {
        if (status !== 'EM_ATENDIMENTO' && status !== 'EM_ANDAMENTO') continue;
      } else if (statusFilter === 'CONCLUIDOS') {
        if (status !== 'RESOLVIDO' && status !== 'CONCLUIDO') continue;
      }

      // Filtro de Urgência
      if (urgFilter === 'URGENTE') {
        if (!enriched.urgencia_ativa) continue;
      } else if (urgFilter === 'PADRAO') {
        if (enriched.urgencia_ativa) continue;
      }

      // Filtro de Setor
      if (setorFilter && setorFilter !== 'TODOS') {
        const tSetor = String(enriched.setor || '').toLowerCase();
        if (tSetor !== setorFilter.toLowerCase()) continue;
      }

      // Filtro de Busca Textual
      if (query) {
        const haystack = [
          enriched.id,
          enriched.numero_protocolo,
          enriched.nome,
          enriched.nome_completo,
          enriched.email,
          enriched.email_solicitante,
          enriched.setor,
          enriched.assunto_tipo,
          enriched.justificativa,
          enriched.descricao,
          enriched.dia_entrega,
          enriched.data_limite_entrega,
          enriched.dia_entrega_solicitado
        ].filter(Boolean).join(' ').toLowerCase();

        if (!haystack.includes(query)) continue;
      }

      filtered.push(enriched);
    }

    // Ordenação: Mantém FIFO estrito (criado_em ASC), com chamados urgentes destacados
    return filtered;
  }

  // --- API do Namespace OlymposSignals ---
  const OlymposSignals = {
    signal: signal,
    computed: computed,
    effect: effect,

    // Sinais Reativos
    tickets: ticketsSignal,
    filterUrgencia: filterUrgenciaSignal,
    filterSetor: filterSetorSignal,
    filterStatus: filterStatusSignal,
    searchQuery: searchQuerySignal,

    // Métodos Operacionais
    loadTickets: loadTickets,
    load_tickets: loadTickets,
    addTicket: addTicket,
    add_ticket: addTicket,
    updateTicket: updateTicket,
    getActiveQueue: getActiveQueue,
    get_active_queue: getActiveQueue,
    getFilteredTickets: getFilteredTickets,

    // Subscrição Global de Mudanças na Fila
    subscribe: function(callback) {
      return ticketsSignal.subscribe(callback);
    }
  };

  if (typeof root !== 'undefined') {
    root.OlymposSignals = OlymposSignals;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OlymposSignals;
  }

  return OlymposSignals;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
