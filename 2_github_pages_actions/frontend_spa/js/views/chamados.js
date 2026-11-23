/**
 * Hub Olympos V3.0 — Página Modular 14: Central de Chamados & Pendências da SMEB
 * Conectada à tabela Supabase public.pendencias_solicitacoes e à planilha de backup (ID 1PZo4Wb2CRcPWRpTvoOLe29kT2MY3dDqoB09NDbkKOIc).
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
  let isFetchingChamados = false;
  let unsubscribeSignals = null;
  let paginaAtual = 1;
  const ITENS_POR_PAGINA = 12;

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
          paginaAtual = 1;
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
          paginaAtual = 1;
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
        paginaAtual = 1;
        carregarChamados(true);
      });
    }

    // Pílulas de Status
    const statusGroup = document.getElementById('filterStatusGroup');
    if (statusGroup && !statusGroup._bound) {
      statusGroup._bound = true;
      statusGroup.addEventListener('click', function(e) {
        const btn = (e.target && typeof e.target.closest === 'function') ? e.target.closest('.filter-pill') : null;
        if (!btn) return;
        const status = btn.getAttribute('data-status');
        if (status && window.OlymposSignals) {
          statusGroup.querySelectorAll('.filter-pill').forEach(function(p) {
            p.classList.toggle('active', p === btn);
          });
          paginaAtual = 1;
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
        const btn = (e.target && typeof e.target.closest === 'function') ? e.target.closest('.filter-pill') : null;
        if (!btn) return;
        const urg = btn.getAttribute('data-urgencia');
        if (urg && window.OlymposSignals) {
          urgGroup.querySelectorAll('.filter-pill').forEach(function(p) {
            p.classList.toggle('active', p === btn);
          });
          paginaAtual = 1;
          window.OlymposSignals.filterUrgencia.value = urg;
          renderFila();
        }
      });
    }
  }

  function obterSupabaseClient() {
    if (!window.OlymposSupabase) return null;
    if (typeof window.OlymposSupabase.getClient === 'function') {
      return window.OlymposSupabase.getClient() || window.OlymposSupabase.client || null;
    }
    return window.OlymposSupabase.client || null;
  }

  function obterOperadorAtual() {
    if (window.OlymposApp && typeof window.OlymposApp.getSession === 'function') {
      const sess = window.OlymposApp.getSession();
      if (sess && (sess.nome || sess.email)) {
        return String(sess.nome || sess.email);
      }
    }
    return 'Operador Hub Olympos';
  }

  function parseDataSegura(val, fallback) {
    if (!val) return fallback || new Date();
    if (val instanceof Date) return isNaN(val.getTime()) ? (fallback || new Date()) : val;
    const s = String(val).trim();
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmy) {
      return new Date(
        parseInt(dmy[3], 10),
        parseInt(dmy[2], 10) - 1,
        parseInt(dmy[1], 10),
        dmy[4] ? parseInt(dmy[4], 10) : 8,
        dmy[5] ? parseInt(dmy[5], 10) : 0,
        dmy[6] ? parseInt(dmy[6], 10) : 0
      );
    }
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? (fallback || new Date()) : parsed;
  }

  function extrairLinksAnexosSafe(ticket) {
    if (!ticket) return [];
    const candidatos = [];
    if (Array.isArray(ticket.anexos_links)) {
      ticket.anexos_links.forEach(function(item) {
        if (item) candidatos.push(String(item));
      });
    }
    if (ticket.anexos) {
      String(ticket.anexos).split(/[\r\n,;|]+|\s+(?=https?:\/\/)/i).forEach(function(part) {
        const trimmed = String(part || '').trim();
        if (trimmed) candidatos.push(trimmed);
      });
    }
    const vistos = {};
    const validos = [];
    for (let i = 0; i < candidatos.length; i++) {
      const raw = candidatos[i].trim();
      if (!/^https?:\/\/\S+/i.test(raw)) continue;
      if (!vistos[raw]) {
        vistos[raw] = true;
        validos.push(raw);
      }
    }
    return validos;
  }

  function carregarChamados(forcarRecarregamento) {
    const sessao = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;
    if (!sessao || !sessao.perfil) {
      armazenarNaFila([]);
      return;
    }

    if (isFetchingChamados && !forcarRecarregamento) {
      return;
    }
    isFetchingChamados = true;

    const container = document.getElementById('chamadosListaContainer');
    if (container && (!window.OlymposSignals || window.OlymposSignals.tickets.peek().length === 0 || forcarRecarregamento)) {
      container.innerHTML = '<div class="empty-state-card" style="padding: 36px; text-align: center;"><div class="empty-state-icon">' + (window.OlymposIcons ? window.OlymposIcons.ui('hourglass') : '') + '</div><p>Carregando solicitações em aberto...</p></div>';
    }

    // 1. Tenta carregar do Supabase SSOT (pendencias_solicitacoes)
    const sbClient = obterSupabaseClient();
    if (sbClient) {
      sbClient
        .from('pendencias_solicitacoes')
        .select('*')
        .order('criado_em', { ascending: true })
        .then(function(res) {
          if (!res.error && res.data && res.data.length > 0) {
            isFetchingChamados = false;
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
        isFetchingChamados = false;
        const dados = (res && res.chamados) ? res.chamados : (res && res.data ? res.data : res);
        if (Array.isArray(dados) && dados.length > 0) {
          armazenarNaFila(dados);
        } else {
          armazenarNaFila(CANONICAL_MOCK_CHAMADOS);
        }
      }, function() {
        isFetchingChamados = false;
        armazenarNaFila(CANONICAL_MOCK_CHAMADOS);
      });
    } else {
      isFetchingChamados = false;
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
    const rawDt = ticket.criado_em || ticket.carimbo_data_hora || ticket.created_at || new Date();
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
    const pagBar = document.getElementById('chamadosPaginacaoBar');

    atualizarKpisView(allTickets);

    if (!tickets || tickets.length === 0) {
      if (pagBar) pagBar.classList.add('hidden');
      container.innerHTML = `
        <div id="emptyChamadosState" class="empty-state-card" style="padding: 40px 20px; text-align: center; background: var(--bg-surface); border: 1px solid var(--border-hairline); border-radius: var(--radius-lg);">
          <div class="empty-state-icon" style="font-size: 2.2rem; margin-bottom: 8px;">${window.OlymposIcons ? window.OlymposIcons.ui('party') : ''}</div>
          <h4 style="font-size: 1.15rem; color: var(--text-primary); margin: 0 0 6px;">Nenhuma pendência encontrada</h4>
          <p style="font-size: 0.88rem; color: var(--text-secondary); margin: 0;">Não há chamados com os filtros selecionados no momento.</p>
        </div>
      `;
      return;
    }

    const esc = (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function')
      ? window.OlymposApp.escapeHtml
      : function(v) { return String(v == null ? '' : v); };
    const iconPaperclip = window.OlymposIcons ? window.OlymposIcons.ui('paperclip') : '';

    const pag = (window.OlymposPagination && typeof window.OlymposPagination.paginarLista === 'function')
      ? window.OlymposPagination.paginarLista(tickets, paginaAtual, ITENS_POR_PAGINA)
      : { items: tickets, paginaAtual: 1, totalPaginas: 1, totalItens: tickets.length, inicio: 1, fim: tickets.length, inicioIndice: 0 };
    paginaAtual = pag.paginaAtual;

    const htmlParts = [];
    for (let i = 0; i < pag.items.length; i++) {
      const t = pag.items[i];
      const isUrgent = !!t.urgencia_ativa;
      const isEscalated = !!t.escalonado_24h;
      const slaFormatado = calcularSlaCard(t, pag.inicioIndice + i);
      const status = (t.status || 'ABERTO').toUpperCase();

      const badgeUrgente = isUrgent
        ? `<span class="badge-urgente badge badge-urgent animate-pulse">${window.OlymposIcons ? window.OlymposIcons.ui('siren') : ''} ${isEscalated ? 'ESCALONADO 24H' : 'URGENTE'}</span>`
        : '';

      const actionsHtml = buildCardActions(t, status);

      const protocoloExibir = t.numero_protocolo || t.id;
      const solicitanteNome = t.nome || t.nome_completo || 'Solicitante SMEB';
      const solicitanteEmail = t.email || t.email_solicitante || '';
      const setorExibir = t.setor || 'Geral';
      const dataLimiteExibir = t.dia_entrega || t.data_limite_entrega || t.dia_entrega_solicitado || 'Conforme fila';
      const aberturaRaw = t.carimbo_data_hora || t.criado_em || t.created_at;
      const assuntoTipo = t.assunto_tipo || '';
      const justificativaExibir = t.justificativa || t.descricao || 'Sem justificativa informada.';
      const linksAnexos = extrairLinksAnexosSafe(t);

      const anexosHtml = linksAnexos.length > 0
        ? `<div class="chamado-anexos" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.82rem;">` +
            linksAnexos.map(function(url, idx) {
              const label = linksAnexos.length > 1 ? ('Ver Documento Anexo ' + (idx + 1) + ' ↗') : 'Ver Documento Anexo ↗';
              return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: underline;">${iconPaperclip} ${label}</a>`;
            }).join('') +
          `</div>`
        : '';

      const assuntoHtml = assuntoTipo
        ? `<span class="badge-assunto" style="background: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-hairline); padding: 2px 8px; border-radius: 9999px; font-size: 0.72rem; font-weight: 600;">${esc(assuntoTipo)}</span>`
        : '';

      const emailHtml = solicitanteEmail
        ? ` • <span>E-mail: <strong>${esc(solicitanteEmail)}</strong></span>`
        : '';

      const card = `
        <div class="chamado-card surface-card spotlight-card ${isUrgent ? 'chamado-urgente' : ''}"
             data-id="${esc(t.id)}"
             data-status="${esc(status)}"
             data-urgente="${isUrgent ? 'true' : 'false'}">
          <div class="chamado-header">
            <span class="chamado-id font-mono">#${esc(protocoloExibir)}</span>
            ${assuntoHtml}
            ${badgeUrgente}
            <span class="badge-sla sla-badge">Previsão: ${esc(slaFormatado)}</span>
            <span class="badge-status" style="background: var(--bg-base); color: var(--text-muted); border: 1px solid var(--border-hairline);">${esc(status)}</span>
          </div>

          <div class="chamado-body">
            <h4 class="text-primary">${esc(solicitanteNome)}</h4>
            <p class="text-secondary">
              <span>Setor: <strong>${esc(setorExibir)}</strong></span>${emailHtml} •
              <span>Data limite: <strong>${esc(dataLimiteExibir)}</strong></span> •
              <span class="text-muted">Carimbo: ${esc(formatarDataHora(aberturaRaw))} (aguardando há ${esc(t.horas_em_aberto || 0)}h)</span>
            </p>
            <div class="chamado-descricao">
              ${esc(justificativaExibir)}
            </div>
            ${anexosHtml}
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

    if (window.OlymposPagination && typeof window.OlymposPagination.renderizarControles === 'function') {
      const resPag = window.OlymposPagination.renderizarControles({
        barEl: 'chamadosPaginacaoBar',
        containers: 'chamadosPaginacaoControles',
        infoEl: 'chamadosPaginacaoInfo',
        totalItens: pag.totalItens,
        paginaAtual: paginaAtual,
        itensPorPagina: ITENS_POR_PAGINA,
        rotuloItem: 'chamados',
        rotuloVazio: 'Nenhuma pendência encontrada',
        onPageChange: function(novaPagina) {
          paginaAtual = novaPagina;
          renderFila();
        }
      });
      paginaAtual = resPag.paginaAtual;
    }
  }

  function buildCardActions(ticket, status) {
    const idSafe = window.OlymposApp ? window.OlymposApp.escapeHtml(ticket.id) : ticket.id;
    if (status === 'RESOLVIDO' || status === 'CONCLUIDO') {
      return `<span class="text-success" style="font-weight: 600; font-size: 0.82rem;">${window.OlymposIcons ? window.OlymposIcons.ui('check') : ''} Demanda concluída com sucesso</span>`;
    }

    const parts = [];
    if (status !== 'EM_ATENDIMENTO' && status !== 'EM_ANDAMENTO') {
      parts.push(`
        <button type="button" class="btn-atendimento-chamado"
                onclick="window.marcarAtendimentoChamado('${idSafe}')"
                data-action="chamados_marcar_atendimento"
                title="Marcar chamado como em atendimento">
          ${window.OlymposIcons ? window.OlymposIcons.ui('eye') : ''} Em Atendimento
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
      const st = String(t.status || '').toUpperCase();
      if (st === 'RESOLVIDO' || st === 'CONCLUIDO') {
        resolvidos++;
      } else {
        totalAbertos++;
        const dt = parseDataSegura(t.criado_em || t.carimbo_data_hora || t.created_at, now);
        if (!earliestPending || dt < earliestPending) {
          earliestPending = dt;
        }
        const isOrigUrgent = (t.urgencia === true || t.urgente === true ||
          ['sim', 'true', '1'].indexOf(String(t.urgencia != null ? t.urgencia : (t.urgente_solicitado || '')).trim().toLowerCase()) !== -1);
        const ageHours = Math.max(0, (now.getTime() - dt.getTime()) / (3600 * 1000));
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
    if (elUrgBadge) elUrgBadge.innerHTML = (window.OlymposIcons ? window.OlymposIcons.ui('siren') : '') + ' ' + urgentes + ' Urgentes';
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
    if (!elHeroChamados) return;
    const sessao = (window.OlymposApp && typeof window.OlymposApp.getSession === 'function')
      ? window.OlymposApp.getSession()
      : null;
    if (!sessao || !sessao.perfil) {
      elHeroChamados.textContent = '--';
      return;
    }
    if (!window.OlymposSignals) return;
    const fila = window.OlymposSignals.getActiveQueue();
    elHeroChamados.textContent = fila.length + ' demandas';
    if (window.OlymposViews && window.OlymposViews.visaoGeral && typeof window.OlymposViews.visaoGeral.atualizarTelemetriaCientifica === 'function') {
      window.OlymposViews.visaoGeral.atualizarTelemetriaCientifica();
    }
  }

  // --- Ações Operacionais Expostas ---

  function marcarAtendimento(id) {
    if (!id) return;
    const nowIso = new Date().toISOString();
    const operador = obterOperadorAtual();

    if (window.OlymposSignals) {
      window.OlymposSignals.updateTicket(id, {
        status: 'EM_ANDAMENTO',
        lido_em: nowIso,
        atendido_por: operador
      });
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Chamado #' + id + ' em atendimento.', 'info');
    }

    // Persistência assíncrona no backend GAS e Supabase (pendencias_solicitacoes)
    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('chamados_marcar_atendimento', {
        id: id,
        atendido_por: operador
      }, function() {}, function() {});
    }

    const sbClient = obterSupabaseClient();
    if (sbClient) {
      sbClient
        .from('pendencias_solicitacoes')
        .update({ status: 'EM_ANDAMENTO', lido_em: nowIso, atendido_por: operador })
        .eq('id', id)
        .then(function(res) {
          if (res && res.error) {
            console.warn('[Chamados] Erro ao atualizar atendimento no Supabase:', res.error);
          }
        });
    }
  }

  function finalizar(id) {
    if (!id) return;
    const nowIso = new Date().toISOString();
    const operador = obterOperadorAtual();
    const obsResolucao = 'Finalização confirmada via interface de usuário';

    // [SEGURANCA] RESTRIÇÃO ESTRITA: ZERO DISPARO DE E-MAIL AO FINALIZAR
    if (window.OlymposSignals) {
      window.OlymposSignals.updateTicket(id, {
        status: 'RESOLVIDO',
        finalizado_em: nowIso,
        resolvido_por: operador,
        observacoes_resolucao: obsResolucao
      });
    }

    if (window.OlymposApp && typeof window.OlymposApp.showToast === 'function') {
      window.OlymposApp.showToast('Chamado #' + id + ' finalizado com sucesso!', 'success');
    }

    // Persistência assíncrona no backend GAS e Supabase (ZERO e-mail)
    if (window.OlymposApi && typeof window.OlymposApi.chamar === 'function') {
      window.OlymposApi.chamar('chamados_finalizar', {
        id: id,
        resolvido_por: operador,
        observacoes: obsResolucao
      }, function() {}, function() {});
    }

    const sbClient = obterSupabaseClient();
    if (sbClient) {
      sbClient
        .from('pendencias_solicitacoes')
        .update({
          status: 'RESOLVIDO',
          finalizado_em: nowIso,
          resolvido_por: operador,
          observacoes_resolucao: obsResolucao
        })
        .eq('id', id)
        .then(function(res) {
          if (res && res.error) {
            console.warn('[Chamados] Erro ao finalizar chamado no Supabase:', res.error);
          }
        });
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
