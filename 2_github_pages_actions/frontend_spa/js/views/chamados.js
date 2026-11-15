/**
 * Hub Olympos V3.0 — Página Modular 14: Central de Chamados & Pendências da SMEB
 * Conectada à tabela Supabase public.pendencias_chamados e à planilha oficial (ID 1okAey-W8s1fFJ23t-FlmSaRSvWqNUJWze8tCYS17UNE).
 * 
 * Regras Operacionais e Arquiteturais:
 * 1. Fila de chamados ordenada da mais antiga para a mais nova (criado_em ASC / FIFO).
 * 2. SLA útil calculado pelo SlaEngine (08h00–15h00, 420 min/dia seg-sex, 90 min/tarefa).
 * 3. Escalonamento automático: chamados sem leitura após 24h ganham urgência ativa.
 * 4. Reatividade determinística via Preact Signals (window.OlymposSignals).
 * 5. REGRA MANDATÓRIA E ESTRITA: NÃO ENVIAR E-MAIL AO CONFIRMAR FINALIZAÇÃO.
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.chamados = (function() {
  'use strict';

  let isInitialized = false;
  let unsubscribeSignals = null;

  // Dados canônicos de contingência offline / demonstração local (limpo para produção SSOT)
  const CANONICAL_MOCK_CHAMADOS = [];

  function init() {
    bindDOMEvents();
    if (!isInitialized) {
      isInitialized = true;
      conectarReatividadeSignals();
      carregarChamados();
    } else {
      renderFila();
    }
  }

  function conectarReatividadeSignals() {
    if (window.OlymposSignals && typeof window.OlymposSignals.subscribe === 'function') {
      if (unsubscribeSignals) {
        try { unsubscribeSignals(); } catch (e) {}
      }
      unsubscribeSignals = window.OlymposSignals.subscribe(function() {
        renderFila();
        atualizarTelemetriaHero();
      });
    }
  }

  function bindDOMEvents() {
    // Busca universal
    const buscaInput = document.getElementById('chamadosBuscaInput');
    if (buscaInput && !buscaInput._bound) {
      buscaInput._bound = true;
      buscaInput.addEventListener('input', function(e) {
        if (window.OlymposSignals) {
          window.OlymposSignals.searchQuery.value = e.target.value;
          renderFila();
        }
      });
    }

    // Filtro de Setor
    const setorSelect = document.getElementById('chamadosSetorSelect');
    if (setorSelect && !setorSelect._bound) {
      setorSelect._bound = true;
      setorSelect.addEventListener('change', function(e) {
        if (window.OlymposSignals) {
          window.OlymposSignals.filterSetor.value = e.target.value;
          renderFila();
        }
      });
    }

    // Botão de Atualizar Fila
    const btnAtualizar = document.getElementById('chamadosAtualizarBtn');
    if (btnAtualizar && !btnAtualizar._bound) {
      btnAtualizar._bound = true;
      btnAtualizar.addEventListener('click', function() {
        carregarChamados(true);
      });
    }

    // Pílulas de Status
    const statusGroup = document.getElementById('filterStatusGroup');
    if (statusGroup && !statusGroup._bound) {
      statusGroup._bound = true;
      statusGroup.addEventListener('click', function(e) {
        const btn = e.target.closest('.filter-pill');
        if (!btn) return;
        const status = btn.getAttribute('data-status');
        if (status && window.OlymposSignals) {
          statusGroup.querySelectorAll('.filter-pill').forEach(function(p) {
            p.classList.toggle('active', p === btn);
          });
          window.OlymposSignals.filterStatus.value = status;
          renderFila();
        }
      });
    }

    // Pílulas de Urgência
    const urgGroup = document.getElementById('filterUrgenciaGroup');
    if (urgGroup && !urgGroup._bound) {
      urgGroup._bound = true;
      urgGroup.addEventListener('click', function(e) {
        const btn = e.target.closest('.filter-pill');
        if (!btn) return;
        const urg = btn.getAttribute('data-urgencia');
        if (urg && window.OlymposSignals) {
          urgGroup.querySelectorAll('.filter-pill').forEach(function(p) {
            p.classList.toggle('active', p === btn);
          });
          window.OlymposSignals.filterUrgencia.value = urg;
          renderFila();
        }
      });
    }
  }

  function carregarChamados(forcarRecarregamento) {
    const container = document.getElementById('chamadosListaContainer');
    if (container && (!window.OlymposSignals || window.OlymposSignals.tickets.peek().length === 0 || forcarRecarregamento)) {
      container.innerHTML = '<div class="empty-state-card" style="padding: 36px; text-align: center;"><div class="empty-state-icon">⏳</div><p>Carregando solicitações em aberto...</p></div>';
    }

    // 1. Tenta carregar do Supabase SSOT
    if (window.OlymposSupabase && window.OlymposSupabase.client) {
      window.OlymposSupabase.client
        .from('pendencias_chamados')
        .select('*')
        .order('created_at', { ascending: true })
        .then(function(res) {
          if (res.data && res.data.length > 0) {
            armazenarNaFila(res.data);
            return;
          }
          consultarFallbackGas();
        })
        .catch(function(err) {
          console.warn('[Chamados] Erro ao consultar Supabase, acionando fallback GAS:', err);
          consultarFallbackGas();
        });
    } else {
      consultarFallbackGas();
    }
  }

  function consultarFallbackGas() {
    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('chamados_listar', {}, function(res) {
        const dados = (res && res.chamados) ? res.chamados : (res && res.data ? res.data : res);
        if (Array.isArray(dados) && dados.length > 0) {
          armazenarNaFila(dados);
        } else {
          armazenarNaFila(CANONICAL_MOCK_CHAMADOS);
        }
      }, function() {
        armazenarNaFila(CANONICAL_MOCK_CHAMADOS);
      });
    } else {
      armazenarNaFila(CANONICAL_MOCK_CHAMADOS);
    }
  }

  function armazenarNaFila(lista) {
    if (window.OlymposSignals) {
      window.OlymposSignals.loadTickets(lista);
    }
    renderFila();
    atualizarTelemetriaHero();
  }

  function formatarDataHora(val) {
    if (!val) return '--';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return dd + '/' + mm + '/' + yyyy + ' às ' + hh + ':' + min;
  }

  function calcularSlaCard(ticket, filaIndex) {
    const rawDt = ticket.created_at || ticket.criado_em || new Date();
    if (window.SlaEngine && typeof window.SlaEngine.calcularSla === 'function') {
      try {
        const sla = window.SlaEngine.calcularSla(rawDt, filaIndex);
        return sla.textoFormatado || (sla.dataEntregaEstimada ? formatarDataHora(sla.dataEntregaEstimada) : '--');
      } catch (e) {
        return formatarDataHora(rawDt);
      }
    }
    return formatarDataHora(rawDt);
  }

  function renderFila() {
    const container = document.getElementById('chamadosListaContainer');
    if (!container) return;

    if (!window.OlymposSignals) {
      container.innerHTML = '<div class="empty-state-card"><p>Módulo de Signals não inicializado.</p></div>';
      return;
    }

    const tickets = window.OlymposSignals.getFilteredTickets();
    const allTickets = window.OlymposSignals.tickets.value;

    atualizarKpisView(allTickets);

    if (!tickets || tickets.length === 0) {
      container.innerHTML = `
        <div id="emptyChamadosState" class="empty-state-card" style="padding: 40px 20px; text-align: center; background: var(--bg-surface); border: 1px solid var(--border-hairline); border-radius: var(--radius-lg);">
          <div class="empty-state-icon" style="font-size: 2.2rem; margin-bottom: 8px;">🎉</div>
          <h4 style="font-size: 1.15rem; color: var(--text-primary); margin: 0 0 6px;">Nenhuma pendência encontrada</h4>
          <p style="font-size: 0.88rem; color: var(--text-secondary); margin: 0;">Não há chamados com os filtros selecionados no momento.</p>
        </div>
      `;
      return;
    }

    const htmlParts = [];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      const isUrgent = !!t.urgencia_ativa;
      const isEscalated = !!t.escalonado_24h;
      const slaFormatado = calcularSlaCard(t, i);
      const status = (t.status || 'ABERTO').toUpperCase();

      const badgeUrgente = isUrgent
        ? `<span class="badge-urgente badge badge-urgent animate-pulse">${isEscalated ? '🚨 ESCALONADO 24H' : 'URGENTE'}</span>`
        : '';

      const actionsHtml = buildCardActions(t, status);

      const card = `
        <div class="chamado-card surface-card spotlight-card ${isUrgent ? 'chamado-urgente' : ''}"
             data-id="${window.OlymposApp ? window.OlymposApp.escapeHtml(t.id) : t.id}"
             data-status="${status}"
             data-urgente="${isUrgent ? 'true' : 'false'}">
          <div class="chamado-header">
            <span class="chamado-id font-mono">#${window.OlymposApp ? window.OlymposApp.escapeHtml(t.id) : t.id}</span>
            ${badgeUrgente}
            <span class="badge-sla sla-badge">Previsão: ${window.OlymposApp ? window.OlymposApp.escapeHtml(slaFormatado) : slaFormatado}</span>
            <span class="badge-status" style="background: var(--bg-base); color: var(--text-muted); border: 1px solid var(--border-hairline);">${status}</span>
          </div>

          <div class="chamado-body">
            <h4 class="text-primary">${window.OlymposApp ? window.OlymposApp.escapeHtml(t.nome_completo || 'Solicitante SMEB') : (t.nome_completo || 'Solicitante SMEB')}</h4>
            <p class="text-secondary">
              <span>Setor: <strong>${window.OlymposApp ? window.OlymposApp.escapeHtml(t.setor || 'Geral') : (t.setor || 'Geral')}</strong></span> •
              <span>Dia solicitado: <strong>${window.OlymposApp ? window.OlymposApp.escapeHtml(t.dia_entrega_solicitado || 'Conforme fila') : (t.dia_entrega_solicitado || 'Conforme fila')}</strong></span> •
              <span class="text-muted">Aberto em ${formatarDataHora(t.created_at || t.criado_em)} (aguardando há ${t.horas_em_aberto || 0}h)</span>
            </p>
            <div class="chamado-descricao">
              ${window.OlymposApp ? window.OlymposApp.escapeHtml(t.descricao || 'Sem descrição informada.') : (t.descricao || 'Sem descrição informada.')}
            </div>
            ${t.anexos ? `<div style="margin-top: 6px; font-size: 0.82rem;"><a href="${window.OlymposApp ? window.OlymposApp.escapeHtml(t.anexos) : t.anexos}" target="_blank" rel="noopener" style="color: var(--accent-primary);">📎 Ver Documento Anexo ↗</a></div>` : ''}
          </div>

          <div class="chamado-actions">
            ${actionsHtml}
          </div>
        </div>
      `;
      htmlParts.push(card);
    }

    container.innerHTML = htmlParts.join('\n');
    bindSpotlightInteractions(container);
  }

  function buildCardActions(ticket, status) {
    const idSafe = window.OlymposApp ? window.OlymposApp.escapeHtml(ticket.id) : ticket.id;
    if (status === 'RESOLVIDO' || status === 'CONCLUIDO') {
      return `<span class="text-success" style="font-weight: 600; font-size: 0.82rem;">✅ Demanda concluída com sucesso</span>`;
    }

    const parts = [];
    if (status !== 'EM_ATENDIMENTO') {
      parts.push(`
        <button type="button" class="btn-atendimento-chamado"
                onclick="window.marcarAtendimentoChamado('${idSafe}')"
                data-action="chamados_marcar_atendimento"
                title="Marcar chamado como em atendimento">
          👁️ Em Atendimento
        </button>
      `);
    }

    parts.push(`
      <button type="button" class="btn btn-primary btn-finalizar-chamado"
              onclick="window.finalizarChamado('${idSafe}')"
              data-action="chamados_finalizar"
              title="Confirmar conclusão da solicitação">
        Finalizar
      </button>
    `);

    return parts.join('\n');
  }

  function bindSpotlightInteractions(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return;
    const cards = container.querySelectorAll('.spotlight-card');
    cards.forEach(function(card) {
      if (card._boundSpotlight) return;
      card._boundSpotlight = true;
      card.addEventListener('mousemove', function(e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
      });
    });
  }

  function atualizarKpisView(tickets) {
    if (!Array.isArray(tickets)) return;
    const now = new Date();
    let totalAbertos = 0;
    let urgentes = 0;
    let resolvidos = 0;
    let earliestPending = null;

    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (t.status === 'RESOLVIDO' || t.status === 'CONCLUIDO') {
        resolvidos++;
      } else {
        totalAbertos++;
        const dt = new Date(t.created_at || t.criado_em || now);
        if (!earliestPending || dt < earliestPending) {
          earliestPending = dt;
        }
        const isOrigUrgent = String(t.urgencia || t.urgente_solicitado || '').trim().toLowerCase() in { sim: 1, true: 1, '1': 1 };
        const ageHours = (now.getTime() - dt.getTime()) / (3600 * 1000);
        if (isOrigUrgent || (!t.lido_em && ageHours >= 24)) {
          urgentes++;
        }
      }
    }

    const elTotal = document.getElementById('kpiChamadosTotal');
    const elFila = document.getElementById('kpiChamadosFilaTotal');
    const elUrg = document.getElementById('kpiChamadosUrgentes');
    const elUrgBadge = document.getElementById('kpiChamadosUrgentesBadge');
    const elRes = document.getElementById('kpiChamadosResolvidos');
    const elSlaMedio = document.getElementById('kpiChamadosSlaMedio');

    if (elTotal) elTotal.textContent = String(totalAbertos);
    if (elFila) elFila.textContent = totalAbertos + ' na fila';
    if (elUrg) elUrg.textContent = String(urgentes);
    if (elUrgBadge) elUrgBadge.textContent = '🚨 ' + urgentes + ' Urgentes';
    if (elRes) elRes.textContent = String(resolvidos);

    if (elSlaMedio) {
      if (earliestPending && window.SlaEngine) {
        try {
          const pred = window.SlaEngine.calcularSla(earliestPending, totalAbertos - 1);
          elSlaMedio.textContent = pred.textoFormatado ? pred.textoFormatado.split(' ')[0] : 'Hoje';
        } catch (e) {
          elSlaMedio.textContent = '08h–15h';
        }
      } else {
        elSlaMedio.textContent = '08h–15h';
      }
    }
  }

  function atualizarTelemetriaHero() {
    const elHeroChamados = document.getElementById('heroTelemetryChamados');
    if (!elHeroChamados || !window.OlymposSignals) return;
    const fila = window.OlymposSignals.getActiveQueue();
    elHeroChamados.textContent = fila.length + ' demandas';
  }

  // --- Ações Operacionais Expostas ---

  function marcarAtendimento(id) {
    if (!id) return;
    const nowIso = new Date().toISOString();
    if (window.OlymposSignals) {
      window.OlymposSignals.updateTicket(id, {
        status: 'EM_ATENDIMENTO',
        lido_em: nowIso
      });
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Chamado #' + id + ' em atendimento.', 'info');
    }

    // Persistência assíncrona no backend
    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('chamados_marcar_atendimento', {
        id: id,
        atendido_por: 'Operador Hub Olympos'
      }, function() {}, function() {});
    }

    if (window.OlymposSupabase && window.OlymposSupabase.client) {
      window.OlymposSupabase.client
        .from('pendencias_chamados')
        .update({ status: 'EM_ATENDIMENTO', lido_em: nowIso })
        .eq('id', id)
        .then(function() {});
    }
  }

  function finalizar(id) {
    if (!id) return;
    const nowIso = new Date().toISOString();

    // 🔒 RESTRIÇÃO ESTRITA: ZERO DISPARO DE E-MAIL AO FINALIZAR
    if (window.OlymposSignals) {
      window.OlymposSignals.updateTicket(id, {
        status: 'RESOLVIDO',
        finalizado_em: nowIso
      });
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Chamado #' + id + ' finalizado com sucesso!', 'success');
    }

    // Persistência assíncrona no backend GAS e Supabase
    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('chamados_finalizar', {
        id: id,
        resolvido_por: 'Operador Hub Olympos',
        observacoes: 'Finalização confirmada via interface de usuário'
      }, function() {}, function() {});
    }

    if (window.OlymposSupabase && window.OlymposSupabase.client) {
      window.OlymposSupabase.client
        .from('pendencias_chamados')
        .update({ status: 'RESOLVIDO', finalizado_em: nowIso, observacoes: 'Finalização confirmada via interface de usuário' })
        .eq('id', id)
        .then(function() {});
    }
  }

  // Registra métodos globais para chamadas diretas via onclick do DOM
  if (typeof window !== 'undefined') {
    window.finalizarChamado = finalizar;
    window.marcarAtendimentoChamado = marcarAtendimento;
  }

  return {
    init: init,
    carregarChamados: carregarChamados,
    marcarAtendimento: marcarAtendimento,
    finalizar: finalizar,
    renderFila: renderFila
  };
})();

// Alias para acesso global
if (typeof window !== 'undefined') {
  window.OlymposChamados = window.OlymposViews.chamados;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.OlymposViews.chamados;
}
