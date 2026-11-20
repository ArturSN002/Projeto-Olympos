/**
 * Hub Olympos V3.0 — Página Modular: Certificados & Declarações (A Lira de Orfeu)
 * 
 * Funcionalidades V3:
 * - F12: Criação dinâmica de abas de eventos com metadados A2:H2 e Linha 4 na UI e GAS
 * - F13: Novos campos opcionais de participantes (Nota e Carga Horária) nos templates e ECDSA
 * - F14: Gestão completa de participantes (listagem interativa, inclusão rápida e importação em lote)
 * - F15: Desmembramento estrito dos 3 gatilhos independentes:
 *        1. Higienizar Lista
 *        2. Somente Gerar Certificados (PDF) — estritamente ZERO chamadas ao MailApp
 *        3. Somente Enviar E-mails — estritamente ZERO geração/recriação de PDFs
 *        + Atalho composto mantido (Executar Ambos: Gerar + Enviar)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.certificados = (function() {
  'use strict';

  let catalog = [];
  let isCatalogLoaded = false;
  let currentParticipants = [];
  let currentMetadata = {};
  let paginaParticipantes = 1;
  const ITENS_PARTICIPANTES_POR_PAGINA = 20;

  function init() {
    bindEvents();
    if (!isCatalogLoaded) {
      carregarCatalogo();
    }
    verificarTokenUrl();
  }

  async function verificarTokenUrl() {
    const hash = window.location.hash || '';
    let token = '';
    if (hash.includes('?v=')) {
      token = hash.split('?v=')[1];
    } else if (window.location.search && window.location.search.includes('v=')) {
      const match = window.location.search.match(/v=([^&]+)/);
      if (match) token = match[1];
    }
    if (!token) return;

    token = decodeURIComponent(token);
    if (window.OlymposCertificadosCrypto) {
      const res = await window.OlymposCertificadosCrypto.verificarCertificadoOffline(token);
      exibirBadgeAutenticidade(res);
    }
  }

  function exibirBadgeAutenticidade(resultado) {
    const container = document.getElementById('liraDoneBox') || document.getElementById('view-certificados') || document.getElementById('page-certificados');
    if (!container) return;

    let badge = document.getElementById('liraCryptoValidationBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'liraCryptoValidationBadge';
      badge.style.cssText = 'padding:14px; margin-bottom:16px; border-radius:10px; font-size:13px; line-height:1.5; display:block;';
      if (container.firstChild) {
        container.insertBefore(badge, container.firstChild);
      } else {
        container.appendChild(badge);
      }
    }

    if (resultado && resultado.valido) {
      const c = resultado.certificado || {};
      badge.className = 'pill-badge pill-green';
      badge.innerHTML = '<strong>' + (window.OlymposIcons ? window.OlymposIcons.ui('check') : '') + ' Certificado Autêntico Verificado</strong><br>' +
        'Titular: <strong>' + (window.OlymposApp ? window.OlymposApp.escapeHtml(c.recipient_name || '--') : (c.recipient_name || '--')) + '</strong> • ' +
        'Evento: <strong>' + (window.OlymposApp ? window.OlymposApp.escapeHtml(c.event_name || '--') : (c.event_name || '--')) + '</strong> • ' +
        'Carga Horária: <strong>' + (c.hours || '--') + 'h</strong> • ' +
        'ID: <code>' + (window.OlymposApp ? window.OlymposApp.escapeHtml(c.cert_id || '--') : (c.cert_id || '--')) + '</code> ' +
        '<span style="font-size:11px;opacity:0.8;">(validado offline em ' + (resultado.tempoMs || '<2') + 'ms)</span>';
    } else {
      badge.className = 'pill-badge pill-amber';
      badge.innerHTML = '<strong>' + (window.OlymposIcons ? window.OlymposIcons.ui('alertTriangle') : '') + ' Assinatura Inválida ou Não Reconhecida</strong><br>' +
        'O token fornecido não pôde ser autenticado pela chave pública institucional da SMEB Ceará-Mirim/RN.';
    }
  }

  function bindEvents() {
    // 1. Mudança de Planilha
    const selPlan = document.getElementById('liraPlanilhaSelect');
    if (selPlan && !selPlan._bound) {
      selPlan._bound = true;
      selPlan.addEventListener('change', handlePlanilhaChange);
    }

    // 2. Mudança de Aba
    const selAba = document.getElementById('liraAbaSelect');
    if (selAba && !selAba._bound) {
      selAba._bound = true;
      selAba.addEventListener('change', carregarParticipantesAba);
    }

    // 3. Os 3 Gatilhos Independentes
    const btnClean = document.getElementById('liraHigienizarBtn');
    if (btnClean && !btnClean._bound) {
      btnClean._bound = true;
      btnClean.addEventListener('click', executarHigienizacao);
    }

    const btnGerarPdf = document.getElementById('liraGerarPdfsBtn');
    if (btnGerarPdf && !btnGerarPdf._bound) {
      btnGerarPdf._bound = true;
      btnGerarPdf.addEventListener('click', executarGerarPdfs);
    }

    const btnEnviarEmail = document.getElementById('liraEnviarEmailsBtn');
    if (btnEnviarEmail && !btnEnviarEmail._bound) {
      btnEnviarEmail._bound = true;
      btnEnviarEmail.addEventListener('click', executarEnviarEmails);
    }

    // 4. Atalho Composto (Executar Ambos)
    const btnExec = document.getElementById('liraExecutarBtn');
    if (btnExec && !btnExec._bound) {
      btnExec._bound = true;
      btnExec.addEventListener('click', executarLoteLira);
    }

    // 5. Botão "+ Nova Aba de Evento"
    const btnNovaAba = document.getElementById('liraNovaAbaBtn');
    if (btnNovaAba && !btnNovaAba._bound) {
      btnNovaAba._bound = true;
      btnNovaAba.addEventListener('click', abrirModalNovaAba);
    }

    const btnCloseNovaAba = document.getElementById('closeModalLiraNovaAbaBtn');
    if (btnCloseNovaAba && !btnCloseNovaAba._bound) {
      btnCloseNovaAba._bound = true;
      btnCloseNovaAba.addEventListener('click', fecharModalNovaAba);
    }

    const btnCancelNovaAba = document.getElementById('btnCancelarNovaAbaLira');
    if (btnCancelNovaAba && !btnCancelNovaAba._bound) {
      btnCancelNovaAba._bound = true;
      btnCancelNovaAba.addEventListener('click', fecharModalNovaAba);
    }

    const formNovaAba = document.getElementById('formLiraNovaAba');
    if (formNovaAba && !formNovaAba._bound) {
      formNovaAba._bound = true;
      formNovaAba.addEventListener('submit', salvarNovaAba);
    }

    // 6. Gestão de Participantes: Formulário Rápido
    const formQuickAdd = document.getElementById('liraFormQuickAdd');
    if (formQuickAdd && !formQuickAdd._bound) {
      formQuickAdd._bound = true;
      formQuickAdd.addEventListener('submit', adicionarParticipanteRapido);
    }

    // 7. Gestão de Participantes: Colar em Lote
    const btnColarLote = document.getElementById('liraColarLoteBtn');
    if (btnColarLote && !btnColarLote._bound) {
      btnColarLote._bound = true;
      btnColarLote.addEventListener('click', abrirModalColarLote);
    }

    const btnCloseColarLote = document.getElementById('closeModalLiraColarLoteBtn');
    if (btnCloseColarLote && !btnCloseColarLote._bound) {
      btnCloseColarLote._bound = true;
      btnCloseColarLote.addEventListener('click', fecharModalColarLote);
    }

    const btnCancelColarLote = document.getElementById('btnCancelarLiraColarLote');
    if (btnCancelColarLote && !btnCancelColarLote._bound) {
      btnCancelColarLote._bound = true;
      btnCancelColarLote.addEventListener('click', fecharModalColarLote);
    }

    const btnProcessarLote = document.getElementById('btnProcessarLiraColarLote');
    if (btnProcessarLote && !btnProcessarLote._bound) {
      btnProcessarLote._bound = true;
      btnProcessarLote.addEventListener('click', processarColarLote);
    }

    // 8. Botão Atualizar Lista de Participantes
    const btnRecarregar = document.getElementById('liraRecarregarParticipantesBtn');
    if (btnRecarregar && !btnRecarregar._bound) {
      btnRecarregar._bound = true;
      btnRecarregar.addEventListener('click', carregarParticipantesAba);
    }
  }

  function carregarCatalogo() {
    const planSelect = document.getElementById('liraPlanilhaSelect');
    if (!planSelect) return;
    planSelect.innerHTML = '<option value="">Carregando planilhas de eventos...</option>';

    window.OlymposApi.chamar('certificados_catalogo', {}, function(res) {
      catalog = Array.isArray(res) ? res : ((res && res.planilhas) || []);
      isCatalogLoaded = true;
      planSelect.innerHTML = '';

      if (res && res.cotaRestante !== undefined) {
        atualizarBadgeCota(res.cotaRestante);
      }

      if (catalog.length === 0) {
        planSelect.innerHTML = '<option value="">Nenhuma planilha encontrada na pasta da Lira</option>';
        handlePlanilhaChange();
        return;
      }

      catalog.forEach(function(item, idx) {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.nome + ' (' + ((item.abas && item.abas.length) || 0) + ' abas)';
        if (idx === 0) opt.selected = true;
        planSelect.appendChild(opt);
      });

      handlePlanilhaChange();
    }, function(err) {
      planSelect.innerHTML = '<option value="">Falha ao listar planilhas</option>';
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Erro ao consultar eventos: ' + err.message, true);
      }
    });
  }

  function atualizarBadgeCota(cota) {
    const badge = document.getElementById('liraCotaBadge');
    if (!badge) return;
    badge.textContent = 'Envios Disponíveis: ' + (cota !== undefined ? cota : '--');
    if (cota !== undefined && cota <= 10) {
      badge.className = 'pill-badge pill-amber';
    } else {
      badge.className = 'pill-badge pill-blue';
    }
  }

  function handlePlanilhaChange() {
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const abaSelect = document.getElementById('liraAbaSelect');
    if (!abaSelect) return;
    abaSelect.innerHTML = '';

    const found = catalog.find(function(c) { return c.id === planId; });
    if (!found || !found.abas || !found.abas.length) {
      abaSelect.innerHTML = '<option value="">Nenhuma aba de participantes</option>';
      renderizarTabelaParticipantes([]);
      return;
    }

    found.abas.forEach(function(aba, idx) {
      const opt = document.createElement('option');
      opt.value = aba;
      opt.textContent = aba;
      if (idx === 0) opt.selected = true;
      abaSelect.appendChild(opt);
    });

    carregarParticipantesAba();
  }

  function carregarParticipantesAba() {
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const sheetName = document.getElementById('liraAbaSelect') ? document.getElementById('liraAbaSelect').value : '';
    const contagem = document.getElementById('liraParticipantesContagem');
    const tbody = document.getElementById('liraTabelaParticipantesBody');

    if (!planId || !sheetName) {
      if (contagem) contagem.textContent = 'Nenhuma aba selecionada';
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding: 24px;">Selecione uma planilha e aba para carregar os participantes.</td></tr>';
      return;
    }

    if (contagem) contagem.textContent = 'Carregando participantes da aba ' + sheetName + '...';
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding: 24px;">Lendo registros da planilha...</td></tr>';

    window.OlymposApi.chamar('certificados_listar_participantes', {
      spreadsheetId: planId,
      sheetName: sheetName
    }, function(res) {
      if (res && res.ok) {
        currentMetadata = res.metadados || {};
        currentParticipants = res.participantes || [];
        renderizarTabelaParticipantes(currentParticipants);
      } else {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-danger text-center" style="padding: 20px;">' + ((res && res.mensagem) || 'Erro ao carregar participantes.') + '</td></tr>';
        if (contagem) contagem.textContent = 'Erro ao ler aba';
      }
    }, function(err) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-danger text-center" style="padding: 20px;">Falha: ' + (window.OlymposApp ? window.OlymposApp.escapeHtml(err.message) : err.message) + '</td></tr>';
      if (contagem) contagem.textContent = 'Falha na conexão';
    });
  }

  function renderizarPaginaParticipantes() {
    const tbody = document.getElementById('liraTabelaParticipantesBody');
    const contagem = document.getElementById('liraParticipantesContagem');
    const pagBar = document.getElementById('certificadosPaginacaoBar');
    if (!tbody) return;

    const lista = currentParticipants || [];
    if (lista.length === 0) {
      if (contagem) {
        contagem.textContent = '0 participante(s) cadastrado(s)' + (currentMetadata.eventName ? ' • Evento: ' + currentMetadata.eventName : '');
      }
      if (pagBar) pagBar.classList.add('hidden');
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding: 24px;">Nenhum participante cadastrado nesta aba. Use o formulário acima ou "Colar em Lote".</td></tr>';
      return;
    }

    const pag = (window.OlymposPagination && typeof window.OlymposPagination.paginarLista === 'function')
      ? window.OlymposPagination.paginarLista(lista, paginaParticipantes, ITENS_PARTICIPANTES_POR_PAGINA)
      : { items: lista, paginaAtual: 1, totalPaginas: 1, totalItens: lista.length, inicio: 1, fim: lista.length };
    paginaParticipantes = pag.paginaAtual;

    if (contagem) {
      contagem.textContent = 'Exibindo ' + pag.inicio + '–' + pag.fim + ' de ' + lista.length + ' participante(s)' + (currentMetadata.eventName ? ' • Evento: ' + currentMetadata.eventName : '');
    }

    const escape = window.OlymposApp && window.OlymposApp.escapeHtml ? window.OlymposApp.escapeHtml : function(s) { return s || ''; };

    let html = '';
    pag.items.forEach(function(p) {
      let pdfCell = '<span class="text-muted">Pendente</span>';
      if (p.pdfUrl) {
        pdfCell = '<a href="' + escape(p.pdfUrl) + '" target="_blank" rel="noopener" class="folder-chip" style="font-size:11px; padding:3px 8px;">PDF Oficial ↗</a>';
      }

      let statusCell = '<span class="text-muted">Não enviado</span>';
      if (p.emailStatus === 'Enviado') {
        statusCell = '<span class="pill-badge pill-green" style="font-size:11px;">' + (window.OlymposIcons ? window.OlymposIcons.ui('check') : '') + ' Enviado</span>';
      } else if (p.emailStatus && p.emailStatus.startsWith('Erro')) {
        statusCell = '<span class="pill-badge pill-amber" style="font-size:11px;" title="' + escape(p.emailStatus) + '">' + (window.OlymposIcons ? window.OlymposIcons.ui('alertTriangle') : '') + ' Erro Envio</span>';
      } else if (p.emailStatus) {
        statusCell = '<span class="pill-badge pill-gold" style="font-size:11px;" title="' + escape(p.emailStatus) + '">' + escape(p.emailStatus.substring(0, 18)) + '...</span>';
      }

      html += '<tr>' +
        '<td style="font-family:monospace; font-size:11.5px; color:var(--text-muted);">' + (p.linha || '--') + '</td>' +
        '<td><strong>' + escape(p.nome) + '</strong></td>' +
        '<td style="font-size:12px;">' + escape(p.email) + '</td>' +
        '<td style="font-size:12px; text-align:center;">' + (p.nota ? escape(p.nota) : '<span class="text-muted">--</span>') + '</td>' +
        '<td style="font-size:12px; text-align:center;">' + (p.cargaHoraria ? escape(p.cargaHoraria) : '<span class="text-muted">' + (currentMetadata.period || '--') + '</span>') + '</td>' +
        '<td>' + pdfCell + '</td>' +
        '<td>' + statusCell + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;

    if (window.OlymposPagination && typeof window.OlymposPagination.renderizarControles === 'function') {
      const pagRes = window.OlymposPagination.renderizarControles({
        barEl: 'certificadosPaginacaoBar',
        containers: 'certificadosPaginacaoControles',
        infoEl: 'certificadosPaginacaoInfo',
        totalItens: pag.totalItens,
        paginaAtual: paginaParticipantes,
        itensPorPagina: ITENS_PARTICIPANTES_POR_PAGINA,
        rotuloItem: 'participantes',
        onPageChange: function(novaPagina) {
          paginaParticipantes = novaPagina;
          renderizarPaginaParticipantes();
        }
      });
      paginaParticipantes = pagRes.paginaAtual;
    }
  }

  function renderizarTabelaParticipantes(participantes) {
    currentParticipants = Array.isArray(participantes) ? participantes : [];
    paginaParticipantes = 1;
    renderizarPaginaParticipantes();
  }

  function adicionarParticipanteRapido(e) {
    if (e && e.preventDefault) e.preventDefault();
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const sheetName = document.getElementById('liraAbaSelect') ? document.getElementById('liraAbaSelect').value : '';

    if (!planId || !sheetName) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Selecione uma planilha e aba antes de adicionar participantes.', true);
      }
      return;
    }

    const inpNome = document.getElementById('liraQuickNome');
    const inpEmail = document.getElementById('liraQuickEmail');
    const inpNota = document.getElementById('liraQuickNota');
    const inpCarga = document.getElementById('liraQuickCarga');
    const btnAdd = document.getElementById('liraQuickAddBtn');

    const nome = inpNome ? inpNome.value.trim() : '';
    const email = inpEmail ? inpEmail.value.trim() : '';
    const nota = inpNota ? inpNota.value.trim() : '';
    const cargaHoraria = inpCarga ? inpCarga.value.trim() : '';

    if (!nome || !email) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Preencha o nome completo e o e-mail do participante.', true);
      }
      return;
    }

    if (btnAdd) {
      btnAdd.disabled = true;
      btnAdd.textContent = 'Salvando...';
    }

    window.OlymposApi.chamar('certificados_salvar_participante', {
      spreadsheetId: planId,
      sheetName: sheetName,
      participante: {
        linha: null,
        nome: nome,
        email: email,
        nota: nota,
        cargaHoraria: cargaHoraria
      }
    }, function(res) {
      if (btnAdd) {
        btnAdd.disabled = false;
        btnAdd.textContent = '+ Adicionar';
      }
      if (res && res.ok) {
        if (inpNome) inpNome.value = '';
        if (inpEmail) inpEmail.value = '';
        if (inpNota) inpNota.value = '';
        if (inpCarga) inpCarga.value = '';
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast('Participante adicionado com sucesso!');
        }
        carregarParticipantesAba();
      } else {
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast('Erro ao salvar participante: ' + ((res && res.mensagem) || 'Erro desconhecido'), true);
        }
      }
    }, function(err) {
      if (btnAdd) {
        btnAdd.disabled = false;
        btnAdd.textContent = '+ Adicionar';
      }
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Falha na requisição: ' + err.message, true);
      }
    });
  }

  // --- Modal Nova Aba ---
  function abrirModalNovaAba() {
    const modal = document.getElementById('modalLiraNovaAba');
    const feedback = document.getElementById('liraNovaAbaFeedback');
    const form = document.getElementById('formLiraNovaAba');
    if (feedback) feedback.classList.add('hidden');
    if (form) form.reset();
    if (modal) modal.classList.remove('hidden');
  }

  function fecharModalNovaAba() {
    const modal = document.getElementById('modalLiraNovaAba');
    if (modal) modal.classList.add('hidden');
  }

  function salvarNovaAba(e) {
    if (e && e.preventDefault) e.preventDefault();
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const feedback = document.getElementById('liraNovaAbaFeedback');
    const btnSalvar = document.getElementById('btnSalvarNovaAbaLira');

    if (!planId) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Selecione uma planilha no menu principal antes de criar uma aba.', true);
      }
      return;
    }

    const form = document.getElementById('formLiraNovaAba');
    if (!form) return;

    const nomeAba = form.nomeAba ? form.nomeAba.value.trim() : '';
    const modalidade = form.modalidade ? form.modalidade.value : 'CERTIFICADO';
    const eventName = form.eventName ? form.eventName.value.trim() : '';
    const templateId = form.templateId ? form.templateId.value.trim() : '';
    const folderId = form.folderId ? form.folderId.value.trim() : '';
    const eventDate = form.eventDate ? form.eventDate.value.trim() : '';
    const period = form.period ? form.period.value.trim() : '40h';
    const responsavel = form.responsavel ? form.responsavel.value.trim() : '';
    const emailContato = form.emailContato ? form.emailContato.value.trim() : '';
    const bonusMessage = form.bonusMessage ? form.bonusMessage.value.trim() : '';

    if (!nomeAba || !eventName || !eventDate) {
      if (feedback) {
        feedback.innerHTML = '<span class="text-danger">Preencha Nome da Aba, Nome do Evento e Data do Evento.</span>';
        feedback.classList.remove('hidden');
      }
      return;
    }

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Criando aba na planilha...';
    }
    if (feedback) {
      feedback.innerHTML = 'Criando nova aba de evento e estruturando metadados A2:H2...';
      feedback.classList.remove('hidden');
    }

    window.OlymposApi.chamar('certificados_criar_aba', {
      spreadsheetId: planId,
      dadosAba: {
        nomeAba: nomeAba,
        modalidade: modalidade,
        eventName: eventName,
        templateId: templateId,
        folderId: folderId,
        eventDate: eventDate,
        period: period,
        responsavel: responsavel,
        emailContato: emailContato,
        bonusMessage: bonusMessage
      }
    }, function(res) {
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = '+ Criar Aba de Evento';
      }
      if (res && res.ok) {
        fecharModalNovaAba();
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast('Nova aba "' + nomeAba + '" criada com sucesso!');
        }
        // Atualiza o catálogo local
        const found = catalog.find(function(c) { return c.id === planId; });
        if (found) {
          found.abas = found.abas || [];
          if (found.abas.indexOf(nomeAba) === -1) {
            found.abas.push(nomeAba);
          }
        }
        // Atualiza o select de abas e seleciona a nova
        const abaSelect = document.getElementById('liraAbaSelect');
        if (abaSelect) {
          const opt = document.createElement('option');
          opt.value = nomeAba;
          opt.textContent = nomeAba;
          opt.selected = true;
          abaSelect.appendChild(opt);
          abaSelect.value = nomeAba;
        }
        carregarParticipantesAba();
      } else {
        if (feedback) {
          feedback.innerHTML = '<span class="text-danger">Erro: ' + ((res && res.mensagem) || 'Falha ao criar aba.') + '</span>';
        }
      }
    }, function(err) {
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = '+ Criar Aba de Evento';
      }
      if (feedback) {
        feedback.innerHTML = '<span class="text-danger">Falha na chamada: ' + (window.OlymposApp ? window.OlymposApp.escapeHtml(err.message) : err.message) + '</span>';
      }
    });
  }

  // --- Modal Colar em Lote ---
  function abrirModalColarLote() {
    const modal = document.getElementById('modalLiraColarLote');
    const textarea = document.getElementById('liraColarLoteTextarea');
    const feedback = document.getElementById('liraColarLoteFeedback');
    if (textarea) textarea.value = '';
    if (feedback) feedback.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  function fecharModalColarLote() {
    const modal = document.getElementById('modalLiraColarLote');
    if (modal) modal.classList.add('hidden');
  }

  function processarColarLote() {
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const sheetName = document.getElementById('liraAbaSelect') ? document.getElementById('liraAbaSelect').value : '';
    const textarea = document.getElementById('liraColarLoteTextarea');
    const feedback = document.getElementById('liraColarLoteFeedback');
    const btn = document.getElementById('btnProcessarLiraColarLote');

    if (!planId || !sheetName) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Selecione uma planilha e aba antes de importar.', true);
      }
      return;
    }

    const texto = textarea ? textarea.value.trim() : '';
    if (!texto) {
      if (feedback) {
        feedback.innerHTML = '<span class="text-danger">Cole os dados dos participantes na caixa de texto.</span>';
        feedback.classList.remove('hidden');
      }
      return;
    }

    const linhas = texto.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
    const participantes = [];

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      let partes = [];
      if (linha.includes('\t')) {
        partes = linha.split('\t');
      } else if (linha.includes(';')) {
        partes = linha.split(';');
      } else if (linha.includes(',')) {
        partes = linha.split(',');
      } else {
        partes = [linha];
      }

      let email = '';
      let nome = '';
      let nota = '';
      let carga = '';

      // Heurística de detecção de email nas duas primeiras colunas
      if (partes[0] && partes[0].includes('@')) {
        email = partes[0].trim();
        nome = partes[1] ? partes[1].trim() : '';
        nota = partes[2] ? partes[2].trim() : '';
        carga = partes[3] ? partes[3].trim() : '';
      } else if (partes[1] && partes[1].includes('@')) {
        nome = partes[0].trim();
        email = partes[1].trim();
        nota = partes[2] ? partes[2].trim() : '';
        carga = partes[3] ? partes[3].trim() : '';
      } else {
        nome = partes[0] ? partes[0].trim() : '';
        email = partes[1] ? partes[1].trim() : '';
      }

      if (email || nome) {
        participantes.push({
          email: email,
          nome: nome,
          nota: nota,
          cargaHoraria: carga
        });
      }
    }

    if (participantes.length === 0) {
      if (feedback) {
        feedback.innerHTML = '<span class="text-danger">Nenhum participante válido identificado nas linhas coladas.</span>';
        feedback.classList.remove('hidden');
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Importando ' + participantes.length + ' participante(s)...';
    }
    if (feedback) {
      feedback.innerHTML = 'Enviando ' + participantes.length + ' participante(s) para a planilha...';
      feedback.classList.remove('hidden');
    }

    window.OlymposApi.chamar('certificados_salvar_lote', {
      spreadsheetId: planId,
      sheetName: sheetName,
      participantes: participantes
    }, function(res) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Importar Participantes';
      }
      if (res && res.ok) {
        fecharModalColarLote();
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast(res.inseridos + ' participante(s) importado(s) com sucesso!');
        }
        carregarParticipantesAba();
      } else {
        if (feedback) {
          feedback.innerHTML = '<span class="text-danger">Erro ao importar: ' + ((res && res.mensagem) || 'Falha no lote') + '</span>';
        }
      }
    }, function(err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Importar Participantes';
      }
      if (feedback) {
        feedback.innerHTML = '<span class="text-danger">Falha na importação: ' + (window.OlymposApp ? window.OlymposApp.escapeHtml(err.message) : err.message) + '</span>';
      }
    });
  }

  // --- Gatilho 1: Higienização ---
  function executarHigienizacao() {
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const sheetName = document.getElementById('liraAbaSelect') ? document.getElementById('liraAbaSelect').value : '';
    const out = document.getElementById('liraOutput');

    if (!planId || !sheetName) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Selecione uma planilha e uma aba de participantes.', true);
      }
      return;
    }

    if (out) out.innerHTML = 'Padronizando nomes em Title Case, removendo espaços invisíveis e corrigindo domínios de e-mail...';

    window.OlymposApi.chamar('certificados_higienizar', {
      spreadsheetId: planId,
      sheetName: sheetName
    }, function(res) {
      if (res && res.ok) {
        const dupEmails = (res.duplicatasEmails && res.duplicatasEmails.length) || 0;
        const dupNomes = (res.duplicatasNomes && res.duplicatasNomes.length) || 0;
        const escape = window.OlymposApp && window.OlymposApp.escapeHtml ? window.OlymposApp.escapeHtml : function(s) { return s || ''; };
        if (out) {
          out.innerHTML =
            '<div style="font-family:var(--font-display); font-weight:700; color:var(--text-main); margin-bottom:8px;">' +
              'Higienização Pré-Voo Concluída — ' + escape(res.aba || sheetName) +
            '</div>' +
            '<div style="display:flex; flex-wrap:wrap; gap:8px;">' +
              '<span class="pill-badge pill-green">Nomes ajustados: ' + (res.nomesCorrigidos || 0) + '</span>' +
              '<span class="pill-badge pill-blue">E-mails corrigidos: ' + (res.emailsCorrigidos || 0) + '</span>' +
              '<span class="pill-badge ' + ((dupEmails + dupNomes) > 0 ? 'pill-gold' : 'pill-green') + '">Duplicidades sinalizadas: ' + (dupEmails + dupNomes) + '</span>' +
            '</div>';
        }
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast('Lista de participantes padronizada com sucesso!');
        }
        carregarParticipantesAba();
      } else {
        if (out) out.innerHTML = '<span class="text-danger">' + ((res && res.mensagem) || 'Falha ao higienizar aba.') + '</span>';
      }
    }, function(err) {
      if (out) out.innerHTML = '<span class="text-danger">Erro: ' + (window.OlymposApp ? window.OlymposApp.escapeHtml(err.message) : err.message) + '</span>';
    });
  }

  // --- Gatilho 2: Somente Gerar PDFs ---
  function executarGerarPdfs() {
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const sheetName = document.getElementById('liraAbaSelect') ? document.getElementById('liraAbaSelect').value : '';
    const modalidade = document.getElementById('liraModalidadeSelect') ? document.getElementById('liraModalidadeSelect').value : 'CERTIFICADO';
    const out = document.getElementById('liraOutput');
    const doneBox = document.getElementById('liraCompletedJobBox');
    const btn = document.getElementById('liraGerarPdfsBtn');

    if (!planId || !sheetName) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Selecione uma planilha e uma aba válidas.', true);
      }
      return;
    }

    if (!confirm('Iniciar a geração dos certificados em PDF para a aba "' + sheetName + '"? (Esta etapa gera apenas os documentos, sem envio de e-mails)')) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Gerando certificados em PDF...';
    }
    if (doneBox) doneBox.classList.add('hidden');
    if (out) out.innerHTML = 'Gerando certificados em PDF e salvando na pasta oficial...';

    window.OlymposApi.chamar('certificados_gerar_pdfs', {
      spreadsheetId: planId,
      sheetName: sheetName,
      modalidade: modalidade
    }, function(res) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '2. Somente Gerar Certificados (PDF)';
      }

      if (res && res.ok) {
        const pdfs = res.pdfsGerados !== undefined ? res.pdfsGerados : 0;
        const arquivos = res.arquivosGerados || [];
        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '';
        const escape = window.OlymposApp && window.OlymposApp.escapeHtml ? window.OlymposApp.escapeHtml : function(s) { return s || ''; };

        if (doneBox) {
          doneBox.innerHTML =
            '<div class="job-result-header">' +
              '<div class="job-result-title">' +
                '<span class="job-done-badge">' + checkSvg + '</span>' +
                '<span>Geração de Certificados Concluída — ' + escape(res.evento || 'Evento') + '</span>' +
              '</div>' +
              '<div class="button-group">' +
                (arquivos.length > 0 ? '<button type="button" id="liraCopyAllPdfsBtn" class="btn btn-secondary btn-sm">Copiar Todos os Links</button>' : '') +
                (res.pastaDestinoUrl ? '<a href="' + escape(res.pastaDestinoUrl) + '" target="_blank" rel="noopener" class="folder-chip">Abrir Pasta do Evento ↗</a>' : '') +
              '</div>' +
            '</div>' +
            '<div style="font-size:13.5px; color:var(--text-secondary);">' +
              '<strong>' + pdfs + ' certificado(s) gerado(s)</strong> com QR Code de autenticidade (nenhum e-mail enviado).' +
            '</div>' +
            '<div class="job-links-list" id="liraGeneratedPdfsList"></div>';

          doneBox.classList.remove('hidden');

          if (window.OlymposApp && window.OlymposApp.renderizarItensLinksGerados) {
            window.OlymposApp.renderizarItensLinksGerados(
              document.getElementById('liraGeneratedPdfsList'),
              arquivos
            );
          }

          const copyAll = document.getElementById('liraCopyAllPdfsBtn');
          if (copyAll && arquivos.length > 0) {
            copyAll.addEventListener('click', function() {
              const txt = arquivos.map(function(a) { return (a.identificador || 'Participante') + ': ' + (a.url || ''); }).join('\n');
              if (window.OlymposApp && window.OlymposApp.copiarTexto) {
                window.OlymposApp.copiarTexto(txt, arquivos.length + ' link(s) de certificados');
              }
            });
          }
        }

        if (out) out.innerHTML = 'PDFs gerados com sucesso! Links individuais disponíveis acima.';
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast(pdfs + ' PDF(s) gerado(s) com sucesso!');
        }
        carregarParticipantesAba();
      } else {
        if (out) out.innerHTML = '<span class="text-danger">' + ((res && res.mensagem) || 'Falha na geração de PDFs.') + '</span>';
      }
    }, function(err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '2. Somente Gerar Certificados (PDF)';
      }
      if (out) out.innerHTML = '<span class="text-danger">Erro na geração: ' + (window.OlymposApp ? window.OlymposApp.escapeHtml(err.message) : err.message) + '</span>';
    });
  }

  // --- Gatilho 3: Somente Enviar E-mails ---
  function executarEnviarEmails() {
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const sheetName = document.getElementById('liraAbaSelect') ? document.getElementById('liraAbaSelect').value : '';
    const modalidade = document.getElementById('liraModalidadeSelect') ? document.getElementById('liraModalidadeSelect').value : 'CERTIFICADO';
    const out = document.getElementById('liraOutput');
    const doneBox = document.getElementById('liraCompletedJobBox');
    const btn = document.getElementById('liraEnviarEmailsBtn');

    if (!planId || !sheetName) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Selecione uma planilha e uma aba válidas.', true);
      }
      return;
    }

    if (!confirm('Iniciar envio de e-mails para participantes com PDF gerado na aba "' + sheetName + '"? (Não recria PDFs)')) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Disparando e-mails oficiais...';
    }
    if (doneBox) doneBox.classList.add('hidden');
    if (out) out.innerHTML = 'Enviando e-mails oficiais com o certificado em anexo...';

    window.OlymposApi.chamar('certificados_enviar_emails', {
      spreadsheetId: planId,
      sheetName: sheetName,
      modalidade: modalidade
    }, function(res) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '3. Somente Enviar E-mails';
      }

      if (res && res.ok) {
        const emails = res.emailsEnviados !== undefined ? res.emailsEnviados : 0;
        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '';
        const escape = window.OlymposApp && window.OlymposApp.escapeHtml ? window.OlymposApp.escapeHtml : function(s) { return s || ''; };

        if (res.cotaRestante !== undefined) {
          atualizarBadgeCota(res.cotaRestante);
        }

        if (doneBox) {
          doneBox.innerHTML =
            '<div class="job-result-header">' +
              '<div class="job-result-title">' +
                '<span class="job-done-badge">' + checkSvg + '</span>' +
                '<span>Envio de E-mails Concluído — ' + escape(res.evento || 'Evento') + '</span>' +
              '</div>' +
            '</div>' +
            '<div style="font-size:13.5px; color:var(--text-secondary);">' +
              '<strong>' + emails + ' e-mail(s) oficial(is) enviado(s)</strong> • Envios restantes hoje: <strong>' + (res.cotaRestante !== undefined ? res.cotaRestante : '--') + '</strong>' +
              (res.agendamentoPosCota ? ' • Retomada automática agendada para ' + escape(res.agendamentoPosCota.horarioAgendado) : '') +
            '</div>';
          doneBox.classList.remove('hidden');
        }

        if (out) out.innerHTML = 'Envio finalizado com sucesso. Status atualizado na planilha.';
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast(emails + ' e-mail(s) enviado(s) com sucesso!');
        }
        carregarParticipantesAba();
      } else {
        if (out) out.innerHTML = '<span class="text-danger">' + ((res && res.mensagem) || 'Falha no envio de e-mails.') + '</span>';
      }
    }, function(err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '3. Somente Enviar E-mails';
      }
      if (out) out.innerHTML = '<span class="text-danger">Erro no envio: ' + (window.OlymposApp ? window.OlymposApp.escapeHtml(err.message) : err.message) + '</span>';
    });
  }

  // --- Atalho Composto: Executar Ambos (Gerar + Enviar) ---
  function executarLoteLira() {
    const planId = document.getElementById('liraPlanilhaSelect') ? document.getElementById('liraPlanilhaSelect').value : '';
    const sheetName = document.getElementById('liraAbaSelect') ? document.getElementById('liraAbaSelect').value : '';
    const modalidade = document.getElementById('liraModalidadeSelect') ? document.getElementById('liraModalidadeSelect').value : 'CERTIFICADO';
    const out = document.getElementById('liraOutput');
    const doneBox = document.getElementById('liraCompletedJobBox');
    const btn = document.getElementById('liraExecutarBtn');

    if (!planId || !sheetName) {
      if (window.OlymposApp && window.OlymposApp.showToast) {
        window.OlymposApp.showToast('Selecione uma planilha e uma aba válidas.', true);
      }
      return;
    }

    if (!confirm('Iniciar geração de PDFs com QR Code e envio por e-mail para a aba "' + sheetName + '"?')) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Emitindo PDFs e enviando e-mails...';
    }
    if (doneBox) doneBox.classList.add('hidden');
    if (out) out.innerHTML = 'Processando certificados (geração de PDFs e envio institucional)...';

    window.OlymposApi.chamar('certificados_executar', {
      spreadsheetId: planId,
      sheetName: sheetName,
      modalidade: modalidade
    }, function(res) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Executar Ambos (Gerar + Enviar)';
      }

      if (res && res.ok) {
        const pdfs = res.pdfsGerados !== undefined ? res.pdfsGerados : (res.gerados || 0);
        const emails = res.emailsEnviados !== undefined ? res.emailsEnviados : (res.enviados || 0);
        const arquivos = res.arquivosGerados || [];
        const checkSvg = window.OlymposIcons ? window.OlymposIcons.ui('check') : '';
        const escape = window.OlymposApp && window.OlymposApp.escapeHtml ? window.OlymposApp.escapeHtml : function(s) { return s || ''; };

        if (res.cotaRestante !== undefined) {
          atualizarBadgeCota(res.cotaRestante);
        }

        if (doneBox) {
          doneBox.innerHTML =
            '<div class="job-result-header">' +
              '<div class="job-result-title">' +
                '<span class="job-done-badge">' + checkSvg + '</span>' +
                '<span>Finalização Confirmada — ' + escape(res.evento || 'Evento') + '</span>' +
              '</div>' +
              '<div class="button-group">' +
                (arquivos.length > 0 ? '<button type="button" id="liraCopyAllBtn" class="btn btn-secondary btn-sm">Copiar Todos os Links</button>' : '') +
                (res.pastaDestinoUrl ? '<a href="' + escape(res.pastaDestinoUrl) + '" target="_blank" rel="noopener" class="folder-chip">Abrir Pasta do Evento ↗</a>' : '') +
              '</div>' +
            '</div>' +
            '<div style="font-size:13.5px; color:var(--text-secondary);">' +
              '<strong>' + pdfs + ' certificado(s) gerado(s)</strong> • <strong>' + emails + ' e-mail(s) enviado(s)</strong> • Envios restantes: <strong>' + (res.cotaRestante !== undefined ? res.cotaRestante : '--') + '</strong>' +
              (res.agendamentoPosCota ? ' • Retomada automática agendada para ' + escape(res.agendamentoPosCota.horarioAgendado) : '') +
            '</div>' +
            '<div class="job-links-list" id="liraGeneratedLinksList"></div>';

          doneBox.classList.remove('hidden');

          if (window.OlymposApp && window.OlymposApp.renderizarItensLinksGerados) {
            window.OlymposApp.renderizarItensLinksGerados(
              document.getElementById('liraGeneratedLinksList'),
              arquivos
            );
          }

          const copyAll = document.getElementById('liraCopyAllBtn');
          if (copyAll && arquivos.length > 0) {
            copyAll.addEventListener('click', function() {
              const txt = arquivos.map(function(a) { return (a.identificador || 'Participante') + ': ' + (a.url || ''); }).join('\n');
              if (window.OlymposApp && window.OlymposApp.copiarTexto) {
                window.OlymposApp.copiarTexto(txt, arquivos.length + ' link(s) de certificados');
              }
            });
          }
        }

        if (out) out.innerHTML = 'Processamento finalizado com sucesso. Os links individuais dos PDFs estão listados acima.';
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast('Certificados processados com sucesso!');
        }
        carregarParticipantesAba();
        if (window.OlymposViews && window.OlymposViews.visaoGeral && window.OlymposViews.visaoGeral.recarregar) {
          window.OlymposViews.visaoGeral.recarregar();
        }
      } else {
        if (out) out.innerHTML = '<span class="text-danger">' + ((res && res.mensagem) || 'Falha na execução do lote.') + '</span>';
      }
    }, function(err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Executar Ambos (Gerar + Enviar)';
      }
      if (out) out.innerHTML = '<span class="text-danger">Erro na execução: ' + (window.OlymposApp ? window.OlymposApp.escapeHtml(err.message) : err.message) + '</span>';
    });
  }

  return {
    init: init,
    carregarCatalogo: carregarCatalogo,
    carregarParticipantesAba: carregarParticipantesAba,
    verificarTokenUrl: verificarTokenUrl,
    exibirBadgeAutenticidade: exibirBadgeAutenticidade
  };
})();
