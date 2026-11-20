/**
 * Hub Olympos V2.3 — Módulo de Visualização: Consulta Integrada de Servidores Públicos
 * Rota Dedicada: #servidores (Alias: #consulta-servidores)
 * Abrange Ceará-Mirim, Natal, Parnamirim, São Gonçalo do Amarante e Governo do RN (SEEC)
 * Suporte a todos os 5 quadros: Docente, Administrativo, Apoio, Técnico e Operacional
 * Dossiê Funcional, Auditoria CF/88 Art. 37, XVI, Paginação em Tabela e Exportação
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.servidores = (function() {
  'use strict';

  var termoBusca = '';
  var filtroEnte = 'todos';
  var filtroCargo = 'todos';
  var filtroRegime = 'todos';
  var filtroVinculos = 'todos';
  var paginaAtual = 1;
  var itensPorPagina = 20;
  var debounceTimer = null;
  var listaFiltradaCache = [];
  var servidorModalAtivo = null;
  var dossiesAgrupadosCache = null;
  var dossiesRawCountCache = -1;

  function escapeHtml(str) {
    if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
      return window.OlymposApp.escapeHtml(str);
    }
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizarTexto(txt) {
    return String(txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizarMatricula(mat) {
    return String(mat || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase().replace(/^0+/, '');
  }

  function parseCargaHoraria(ch) {
    if (typeof ch === 'number') return ch;
    var m = String(ch || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 30;
  }

  /**
   * Obtém os servidores consolidados a partir da API OlymposServidores ou fallbacks
   */
  function carregarTodosDossies() {
    var rawServidores = [];
    if (window.OlymposServidores && typeof window.OlymposServidores.obterTodos === 'function') {
      rawServidores = window.OlymposServidores.obterTodos();
    } else if (window.OLYMPOS_SERVIDORES_UNIFICADOS && Array.isArray(window.OLYMPOS_SERVIDORES_UNIFICADOS)) {
      rawServidores = window.OLYMPOS_SERVIDORES_UNIFICADOS;
    } else {
      // Fallback para bases legadas se carregadas
      if (window.SERVIDORES_CEARA_MIRIM) rawServidores = rawServidores.concat(window.SERVIDORES_CEARA_MIRIM);
      if (window.SERVIDORES_ESTADO_RN) rawServidores = rawServidores.concat(window.SERVIDORES_ESTADO_RN);
    }

    if (dossiesAgrupadosCache && dossiesRawCountCache === rawServidores.length && rawServidores.length > 0) {
      return dossiesAgrupadosCache;
    }

    // Agrupa servidores por nome canônico para formar dossiês consolidados
    var mapaDossies = {};
    var ordemNomes = [];

    rawServidores.forEach(function(s) {
      var nomeNorm = normalizarTexto(s.nome || s.n);
      if (!nomeNorm) return;

      if (!mapaDossies[nomeNorm]) {
        mapaDossies[nomeNorm] = {
          id: s.id || ('serv_' + Math.random().toString(36).substr(2, 9)),
          nome: s.nome || s.n,
          cpfMascarado: s.cpfMascarado || s.c || '###.***.***-##',
          matriculas: [],
          entes: [],
          cargos: [],
          quadros: [],
          lotacoes: [],
          vinculos: [],
          cargaHorariaTotal: 0
        };
        ordemNomes.push(nomeNorm);
      }

      var dossie = mapaDossies[nomeNorm];
      var mat = String(s.matricula || s.m || '').trim();
      if (mat && dossie.matriculas.indexOf(mat) === -1) {
        dossie.matriculas.push(mat);
      }

      var enteNome = s.ente || s.orgao || 'Ente Federativo';
      if (enteNome && dossie.entes.indexOf(enteNome) === -1) {
        dossie.entes.push(enteNome);
      }

      var cargoNome = s.cargo || s.g || 'Cargo não informado';
      if (cargoNome && dossie.cargos.indexOf(cargoNome) === -1) {
        dossie.cargos.push(cargoNome);
      }

      var quadroNome = s.quadro || 'Docente';
      if (quadroNome && dossie.quadros.indexOf(quadroNome) === -1) {
        dossie.quadros.push(quadroNome);
      }

      var lotacaoNome = s.lotacao || s.l || 'Lotação não informada';
      if (lotacaoNome && dossie.lotacoes.indexOf(lotacaoNome) === -1) {
        dossie.lotacoes.push(lotacaoNome);
      }

      var ch = parseCargaHoraria(s.cargaHoraria || s.h);

      // Evita duplicatas idênticas de vínculo
      var vId = (s.enteId || enteNome) + '|' + mat + '|' + cargoNome;
      var jaExiste = dossie.vinculos.some(function(v) {
        return ((v.enteId || v.ente) + '|' + v.matricula + '|' + v.cargo) === vId;
      });

      if (!jaExiste) {
        dossie.vinculos.push({
          id: s.id,
          matricula: mat,
          ente: enteNome,
          enteId: s.enteId || '',
          orgao: s.orgao || enteNome,
          quadro: quadroNome,
          cargo: cargoNome,
          funcao: s.funcao || '',
          cargaHoraria: ch,
          cargaHorariaTexto: s.cargaHorariaTexto || (ch + 'h'),
          lotacao: lotacaoNome,
          turno: s.turno || 'Não informado',
          regime: s.regime || 'Efetivo / Estatutário',
          situacao: s.situacao || s.status || 'Ativo',
          dataAdmissao: s.dataAdmissao || ''
        });
        dossie.cargaHorariaTotal += ch;
      }
    });

    // Calcula auditoria CF/88 Art. 37, XVI e índice de busca pré-normalizado para cada dossiê
    var listaDossies = ordemNomes.map(function(k) {
      var d = mapaDossies[k];
      d.auditoria = calcularAuditoriaCf88(d.vinculos, d.cargaHorariaTotal);
      d._searchBlob = normalizarTexto(
        d.nome + ' ' +
        d.cargos.join(' ') + ' ' +
        d.lotacoes.join(' ') + ' ' +
        d.entes.join(' ')
      );
      d._normMats = d.matriculas.map(normalizarMatricula);
      return d;
    });

    dossiesAgrupadosCache = listaDossies;
    dossiesRawCountCache = rawServidores.length;

    return listaDossies;
  }

  function calcularAuditoriaCf88(vinculos, cargaTotal) {
    var count = vinculos.length;
    var ch = cargaTotal;

    if (count <= 1) {
      return {
        tipo: 'unico',
        badgeClass: 'pill-green',
        badgeTexto: 'Vínculo Único',
        licito: true,
        parecer: 'Vínculo funcional único (' + ch + 'h semanais). Situação plenamente regular perante a CF/88.'
      };
    }

    if (count === 2) {
      var v1 = vinculos[0];
      var v2 = vinculos[1];
      var isV1Doc = normalizarTexto(v1.quadro) === 'docente' || normalizarTexto(v1.cargo).indexOf('professor') !== -1;
      var isV2Doc = normalizarTexto(v2.quadro) === 'docente' || normalizarTexto(v2.cargo).indexOf('professor') !== -1;
      var isV1Tec = normalizarTexto(v1.quadro) === 'tecnico' || normalizarTexto(v1.cargo).indexOf('psicologo') !== -1 || normalizarTexto(v1.cargo).indexOf('assistente social') !== -1 || normalizarTexto(v1.cargo).indexOf('especialista') !== -1 || normalizarTexto(v1.cargo).indexOf('nutricionista') !== -1;
      var isV2Tec = normalizarTexto(v2.quadro) === 'tecnico' || normalizarTexto(v2.cargo).indexOf('psicologo') !== -1 || normalizarTexto(v2.cargo).indexOf('assistente social') !== -1 || normalizarTexto(v2.cargo).indexOf('especialista') !== -1 || normalizarTexto(v2.cargo).indexOf('nutricionista') !== -1;

      var enquadrado = false;
      var regra = '';
      if (isV1Doc && isV2Doc) {
        enquadrado = true;
        regra = 'Dois cargos de professor (CF/88 Art. 37, XVI, a)';
      } else if ((isV1Doc && isV2Tec) || (isV2Doc && isV1Tec)) {
        enquadrado = true;
        regra = 'Um cargo docente com um técnico/científico (CF/88 Art. 37, XVI, b)';
      }

      if (enquadrado) {
        if (ch <= 60) {
          return {
            tipo: 'duplo',
            badgeClass: 'pill-gold',
            badgeTexto: 'Acúmulo Lícito (≤ 60h)',
            licito: true,
            parecer: 'Acúmulo lícito constitucional (' + regra + '). Carga horária semanal acumulada: ' + ch + 'h (teto jurisprudencial de 60h respeitado).'
          };
        } else {
          return {
            tipo: 'alerta',
            badgeClass: 'pill-amber',
            badgeTexto: 'Alerta CF/88 (> 60h)',
            licito: false,
            parecer: 'Cargos compatíveis (' + regra + '), porém a jornada semanal consolidada (' + ch + 'h) ultrapassa o limite prudencial de 60h do TCU/TCE-RN.'
          };
        }
      } else {
        return {
          tipo: 'alerta',
          badgeClass: 'pill-red',
          badgeTexto: 'Inacumulável CF/88',
          licito: false,
          parecer: 'Acúmulo vedação expressa: Cargos não contemplados nas hipóteses taxativas do Art. 37, XVI da CF/88.'
        };
      }
    }

    return {
      tipo: 'alerta',
      badgeClass: 'pill-red',
      badgeTexto: 'Tríplice Acúmulo (' + count + ' vínculos)',
      licito: false,
      parecer: 'Identificados ' + count + ' vínculos funcionais ativos. Vedação absoluta pela Constituição Federal.'
    };
  }

  /**
   * Filtra dossiês com base no termo e filtros selecionados
   */
  function filtrarDossies(todosDossies) {
    var termoNorm = normalizarTexto(termoBusca);
    var termoMat = normalizarMatricula(termoBusca);

    return todosDossies.filter(function(d) {
      // 1. Termo de Busca (via índice pré-normalizado O(1) quando disponível)
      if (termoNorm) {
        if (d._searchBlob) {
          var matchFast = d._searchBlob.indexOf(termoNorm) !== -1;
          if (!matchFast && termoMat && d._normMats) {
            matchFast = d._normMats.some(function(mNorm) {
              return mNorm && (mNorm.indexOf(termoMat) !== -1 || termoMat.indexOf(mNorm) !== -1);
            });
          }
          if (!matchFast) return false;
        } else {
          var matchNome = normalizarTexto(d.nome).indexOf(termoNorm) !== -1;
          var matchMat = d.matriculas.some(function(m) {
            var mNorm = normalizarMatricula(m);
            return mNorm && (mNorm.indexOf(termoMat) !== -1 || termoMat.indexOf(mNorm) !== -1);
          });
          var matchCargo = d.cargos.some(function(c) {
            return normalizarTexto(c).indexOf(termoNorm) !== -1;
          });
          var matchLotacao = d.lotacoes.some(function(l) {
            return normalizarTexto(l).indexOf(termoNorm) !== -1;
          });
          var matchEnte = d.entes.some(function(e) {
            return normalizarTexto(e).indexOf(termoNorm) !== -1;
          });

          if (!matchNome && !matchMat && !matchCargo && !matchLotacao && !matchEnte) {
            return false;
          }
        }
      }

      // 2. Filtro Ente
      if (filtroEnte !== 'todos') {
        var eKey = normalizarTexto(filtroEnte).replace(/[^a-z0-9]/g, '');
        var bateuEnte = d.vinculos.some(function(v) {
          var vEnteId = normalizarTexto(v.enteId || '').replace(/[^a-z0-9]/g, '');
          var vEnte = normalizarTexto(v.ente || '').replace(/[^a-z0-9]/g, '');
          return vEnteId.indexOf(eKey) !== -1 || vEnte.indexOf(eKey) !== -1;
        });
        if (!bateuEnte) return false;
      }

      // 3. Filtro Quadro / Cargo
      if (filtroCargo !== 'todos') {
        var cKey = normalizarTexto(filtroCargo);
        var bateuQuadro = d.vinculos.some(function(v) {
          var qNorm = normalizarTexto(v.quadro || '');
          var cNorm = normalizarTexto(v.cargo || '');

          if (cKey === 'docente') {
            return qNorm === 'docente' || cNorm.indexOf('professor') !== -1;
          }
          if (cKey === 'gestao') {
            return cNorm.indexOf('diretor') !== -1 || cNorm.indexOf('coordenador') !== -1 || cNorm.indexOf('gestao') !== -1;
          }
          if (cKey === 'tecnico') {
            return qNorm === 'tecnico' || cNorm.indexOf('psicologo') !== -1 || cNorm.indexOf('assistente social') !== -1 || cNorm.indexOf('especialista') !== -1 || cNorm.indexOf('nutricionista') !== -1 || cNorm.indexOf('ti') !== -1;
          }
          if (cKey === 'administrativo') {
            return qNorm === 'administrativo' || cNorm.indexOf('administrativo') !== -1 || cNorm.indexOf('secretario') !== -1;
          }
          if (cKey === 'apoio') {
            return qNorm === 'apoio' || qNorm === 'operacional' || cNorm.indexOf('merend') !== -1 || cNorm.indexOf('motorista') !== -1 || cNorm.indexOf('asg') !== -1 || cNorm.indexOf('vigia') !== -1 || cNorm.indexOf('cuidador') !== -1 || cNorm.indexOf('servicos gerais') !== -1;
          }
          return qNorm.indexOf(cKey) !== -1 || cNorm.indexOf(cKey) !== -1;
        });
        if (!bateuQuadro) return false;
      }

      // 4. Filtro Regime
      if (filtroRegime !== 'todos') {
        var rKey = normalizarTexto(filtroRegime);
        var bateuRegime = d.vinculos.some(function(v) {
          return normalizarTexto(v.regime || '').indexOf(rKey) !== -1;
        });
        if (!bateuRegime) return false;
      }

      // 5. Filtro Vínculos / CF/88
      if (filtroVinculos !== 'todos') {
        if (filtroVinculos === 'unico' && d.vinculos.length !== 1) return false;
        if (filtroVinculos === 'duplo' && (d.vinculos.length !== 2 || !d.auditoria.licito)) return false;
        if (filtroVinculos === 'alerta' && (d.auditoria.licito && d.vinculos.length <= 1)) return false;
      }

      return true;
    });
  }

  /**
   * Reseta os contadores de KPIs para o estado neutro de carregamento (--)
   */
  function zerarKpis() {
    var kpiTotalEl = document.getElementById('kpiServidoresTotal');
    var kpiMunEl = document.getElementById('kpiServidoresMunicipais');
    var kpiEstEl = document.getElementById('kpiServidoresEstaduais');
    var kpiMultEl = document.getElementById('kpiServidoresMultiplos');
    if (kpiTotalEl) kpiTotalEl.textContent = '--';
    if (kpiMunEl) kpiMunEl.textContent = '--';
    if (kpiEstEl) kpiEstEl.textContent = '--';
    if (kpiMultEl) kpiMultEl.textContent = '--';
  }

  /**
   * Exibe estado visual de carregamento na listagem
   */
  function exibirCarregando() {
    var tbody = document.getElementById('tabelaServidoresGeralBody');
    var statusEl = document.getElementById('servidoresContagemStatus');
    if (statusEl) {
      statusEl.textContent = 'Consultando quadro funcional dos entes monitorados...';
    }
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-muted text-center" style="padding: 24px;">Consultando quadro funcional dos entes monitorados...</td></tr>';
    }
  }

  /**
   * Aplica diretamente os quantitativos consolidados dos 16 entes
   */
  function aplicarKpisOficiais(kpis) {
    if (!kpis) return;
    var kpiTotalEl = document.getElementById('kpiServidoresTotal');
    var kpiMunEl = document.getElementById('kpiServidoresMunicipais');
    var kpiEstEl = document.getElementById('kpiServidoresEstaduais');
    var kpiMultEl = document.getElementById('kpiServidoresMultiplos');
    var badgeTotal = document.getElementById('kpiServidoresTotalBadge');

    if (kpiTotalEl && kpis.total_acervo) {
      kpiTotalEl.textContent = Number(kpis.total_acervo).toLocaleString('pt-BR');
    }
    if (kpiMunEl && kpis.total_municipais) {
      kpiMunEl.textContent = Number(kpis.total_municipais).toLocaleString('pt-BR');
    }
    if (kpiEstEl && kpis.total_estaduais) {
      kpiEstEl.textContent = Number(kpis.total_estaduais).toLocaleString('pt-BR');
    }
    if (kpiMultEl && kpis.total_multiplos) {
      kpiMultEl.textContent = Number(kpis.total_multiplos).toLocaleString('pt-BR');
    }
    if (badgeTotal && kpis.total_entes) {
      badgeTotal.textContent = kpis.total_entes + ' Entes';
    }
  }

  /**
   * Atualiza os KPIs no topo da tela com base nos dossiês carregados
   */
  function atualizarKpis(todosDossies) {
    var kpiTotalEl = document.getElementById('kpiServidoresTotal');
    var kpiMunEl = document.getElementById('kpiServidoresMunicipais');
    var kpiEstEl = document.getElementById('kpiServidoresEstaduais');
    var kpiMultEl = document.getElementById('kpiServidoresMultiplos');

    if (!kpiTotalEl) return;

    var totalPessoas = todosDossies.length;
    var totalVinculos = 0;
    var municipaisCount = 0;
    var estaduaisCount = 0;
    var multiplosCount = 0;

    todosDossies.forEach(function(d) {
      totalVinculos += d.vinculos.length;
      if (d.vinculos.length > 1) {
        multiplosCount++;
      }
      d.vinculos.forEach(function(v) {
        var e = normalizarTexto(v.enteId || v.ente);
        var isEstadual = e.indexOf('governo') !== -1 || e.indexOf('estado') !== -1 || e.indexOf('seec') !== -1;
        if (isEstadual) {
          estaduaisCount++;
        } else {
          municipaisCount++;
        }
      });
    });

    // Atualiza os contadores exclusivamente a partir dos dados verdadeiros carregados
    if (totalVinculos >= 40000 || kpiTotalEl.textContent === '--') {
      kpiTotalEl.textContent = totalVinculos.toLocaleString('pt-BR');
      if (kpiMunEl) kpiMunEl.textContent = municipaisCount.toLocaleString('pt-BR');
      if (kpiEstEl) kpiEstEl.textContent = estaduaisCount.toLocaleString('pt-BR');
      if (kpiMultEl) kpiMultEl.textContent = multiplosCount.toLocaleString('pt-BR');
    }
  }

  /**
   * Renderiza a visualização em Tabela Sintética
   */
  function renderizarTabela(listaPaginada) {
    var tbody = document.getElementById('tabelaServidoresGeralBody');
    if (!tbody) return;

    if (listaPaginada.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-muted text-center" style="padding: 24px;">Nenhum vínculo funcional localizado para os parâmetros informados.</td></tr>';
      return;
    }

    var html = '';
    listaPaginada.forEach(function(d) {
      var auditoria = d.auditoria;
      var entesStr = d.entes.join('; ');
      var matStr = d.matriculas.join(', ') || 'N/I';
      var cargoPrin = d.cargos[0] || 'Docente';
      var lotacaoPrin = d.lotacoes[0] || 'Lotação não informada';

      html += '<tr>' +
        '<td data-label="Servidor">' +
          '<div style="font-weight: 700; color: var(--text-main);">' + escapeHtml(d.nome) + '</div>' +
          '<div style="font-size: 11px; color: var(--text-muted);">CPF: ' + escapeHtml(d.cpfMascarado) + '</div>' +
        '</td>' +
        '<td data-label="Matrícula(s)"><span class="code-badge" style="font-size: 11.5px;">' + escapeHtml(matStr) + '</span></td>' +
        '<td data-label="Ente(s)"><span style="font-size: 12px; color: var(--text-secondary);">' + escapeHtml(entesStr) + '</span></td>' +
        '<td data-label="Cargo Principal"><span style="font-size: 12.5px; font-weight: 600;">' + escapeHtml(cargoPrin) + '</span></td>' +
        '<td data-label="Carga Horária"><span class="pill-badge pill-gold" style="font-size: 11px;">' + d.cargaHorariaTotal + 'h sem.</span></td>' +
        '<td data-label="Lotação Principal"><span style="font-size: 12px; color: var(--text-muted);">' + escapeHtml(lotacaoPrin) + '</span></td>' +
        '<td data-label="Auditoria CF/88"><span class="pill-badge ' + auditoria.badgeClass + '" style="font-size: 11px;">' + escapeHtml(auditoria.badgeTexto) + '</span></td>' +
        '<td data-label="Ações" class="text-right">' +
          '<button type="button" class="btn btn-secondary btn-sm btn-abrir-dossie-tab" data-nome="' + escapeHtml(d.nome) + '">Dossiê</button>' +
        '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('.btn-abrir-dossie-tab').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var nome = this.getAttribute('data-nome');
        abrirDossieModal(nome);
      });
    });
  }

  /**
   * Renderiza os controles numéricos de paginação via helper global OlymposPagination
   */
  function renderizarPaginacao(totalItens) {
    if (window.OlymposPagination && typeof window.OlymposPagination.renderizarControles === 'function') {
      var res = window.OlymposPagination.renderizarControles({
        containers: ['servidoresPaginacaoTopo', 'servidoresPaginacaoRodape'],
        statusEl: 'servidoresContagemStatus',
        infoEl: 'servidoresInfoPaginacao',
        totalItens: totalItens,
        paginaAtual: paginaAtual,
        itensPorPagina: itensPorPagina,
        rotuloItem: 'servidores públicos cadastrados',
        rotuloVazio: 'Nenhum servidor localizado',
        maxBotoes: 5,
        onPageChange: function(novaPagina) {
          paginaAtual = novaPagina;
          atualizarViewComCache();
        }
      });
      paginaAtual = res.paginaAtual;
      return;
    }

    var totalPaginas = Math.ceil(totalItens / itensPorPagina) || 1;
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;
  }

  /**
   * Recalcula a busca completa, filtros e re-renderiza
   */
  function atualizarConsultaCompleta() {
    var todos = carregarTodosDossies();
    atualizarKpis(todos);

    listaFiltradaCache = filtrarDossies(todos);
    paginaAtual = 1;
    atualizarViewComCache();
  }

  /**
   * Re-renderiza usando os resultados cacheados para paginação rápida (modo tabela)
   */
  function atualizarViewComCache() {
    var pag = (window.OlymposPagination && typeof window.OlymposPagination.paginarLista === 'function')
      ? window.OlymposPagination.paginarLista(listaFiltradaCache, paginaAtual, itensPorPagina)
      : {
          items: listaFiltradaCache.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina),
          paginaAtual: paginaAtual,
          totalItens: listaFiltradaCache.length
        };

    paginaAtual = pag.paginaAtual;
    var tabContainer = document.getElementById('servidoresContainerTabela');
    if (tabContainer) tabContainer.classList.remove('hidden');

    renderizarTabela(pag.items);
    renderizarPaginacao(pag.totalItens);

    // Toggle botão limpar busca
    var btnLimpar = document.getElementById('btnLimparBuscaServidores');
    if (btnLimpar) {
      btnLimpar.classList.toggle('hidden', !termoBusca);
    }
  }

  function limparTodosFiltros() {
    termoBusca = '';
    filtroEnte = 'todos';
    filtroCargo = 'todos';
    filtroRegime = 'todos';
    filtroVinculos = 'todos';

    var input = document.getElementById('servidorBuscaInput');
    if (input) input.value = '';

    // Reset selects dropdown (M3)
    var selEnte = document.getElementById('filtroEnteSelect') || document.getElementById('servidorFiltroEnteSelect');
    if (selEnte) selEnte.value = 'todos';
    var selQuadro = document.getElementById('filtroQuadroSelect') || document.getElementById('servidorFiltroQuadroSelect');
    if (selQuadro) selQuadro.value = 'todos';
    var selRegime = document.getElementById('filtroRegimeSelect') || document.getElementById('servidorFiltroRegimeSelect');
    if (selRegime) selRegime.value = 'todos';
    var selVinculos = document.getElementById('filtroVinculosSelect') || document.getElementById('servidorFiltroVinculosSelect');
    if (selVinculos) selVinculos.value = 'todos';

    // Reset pills (fallback)
    document.querySelectorAll('[data-filtro-ente]').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-filtro-ente') === 'todos');
    });
    document.querySelectorAll('[data-filtro-cargo]').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-filtro-cargo') === 'todos');
    });
    document.querySelectorAll('[data-filtro-regime]').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-filtro-regime') === 'todos');
    });
    document.querySelectorAll('[data-filtro-vinculos]').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-filtro-vinculos') === 'todos');
    });

    atualizarConsultaCompleta();
  }

  /**
   * Abre o Modal de Dossiê Funcional Completo
   */
  function abrirDossieModal(nomeOuMatricula) {
    var modal = document.getElementById('modalDossieServidor');
    var modalNome = document.getElementById('modalDossieServidorNome');
    var modalConteudo = document.getElementById('modalDossieServidorConteudo');

    if (!modal || !modalConteudo) return;

    var dossie = null;
    var todos = carregarTodosDossies();
    var termoNorm = normalizarTexto(nomeOuMatricula);

    for (var i = 0; i < todos.length; i++) {
      if (normalizarTexto(todos[i].nome) === termoNorm || todos[i].matriculas.some(function(m) { return normalizarMatricula(m) === normalizarMatricula(nomeOuMatricula); })) {
        dossie = todos[i];
        break;
      }
    }

    if (!dossie) return;
    servidorModalAtivo = dossie;

    if (modalNome) modalNome.textContent = dossie.nome;

    var auditoria = dossie.auditoria;
    var vinculosHtml = dossie.vinculos.map(function(v, idx) {
      return '<div style="background: var(--bg-surface); padding: 14px; border: 1px solid var(--border-hairline); border-radius: 8px; margin-bottom: 10px;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
          '<span class="pill-badge pill-gold">Vínculo #' + (idx + 1) + ' • ' + escapeHtml(v.ente) + '</span>' +
          '<span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">' + escapeHtml(v.matricula ? ('Matrícula: ' + v.matricula) : 'Matrícula não informada') + '</span>' +
        '</div>' +
        '<div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">' + escapeHtml(v.cargo) + (v.funcao ? (' (' + escapeHtml(v.funcao) + ')') : '') + '</div>' +
        '<div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">' +
          '<div>' + (window.OlymposIcons ? window.OlymposIcons.ui('olymposLogo') : '') + ' <strong>Lotação:</strong> ' + escapeHtml(v.lotacao) + '</div>' +
          '<div>' + (window.OlymposIcons ? window.OlymposIcons.ui('clock') : '') + ' <strong>Jornada:</strong> ' + escapeHtml(v.cargaHorariaTexto) + ' • Turno: ' + escapeHtml(v.turno) + '</div>' +
          '<div>' + (window.OlymposIcons ? window.OlymposIcons.ui('papyrusOfCadmus') : '') + ' <strong>Regime / Quadro:</strong> ' + escapeHtml(v.regime) + ' (' + escapeHtml(v.quadro) + ') • Situação: ' + escapeHtml(v.situacao) + '</div>' +
          (v.dataAdmissao ? ('<div>' + (window.OlymposIcons ? window.OlymposIcons.ui('calendar') : '') + ' <strong>Admissão:</strong> ' + escapeHtml(v.dataAdmissao) + '</div>') : '') +
        '</div>' +
      '</div>';
    }).join('');

    var boxColor = auditoria.licito ? '#10B981' : '#EF4444';

    modalConteudo.innerHTML = '<div style="margin-bottom: 16px;">' +
      '<div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; margin-bottom: 14px; padding: 10px 14px; background: var(--bg-tonal); border-radius: 8px; border: 1px solid var(--border-hairline);">' +
        '<span>CPF Mascarado: <strong>' + escapeHtml(dossie.cpfMascarado) + '</strong></span>' +
        '<span>•</span>' +
        '<span>Total de Vínculos: <strong>' + dossie.vinculos.length + '</strong></span>' +
        '<span>•</span>' +
        '<span>Jornada Total Acumulada: <strong>' + dossie.cargaHorariaTotal + 'h semanais</strong></span>' +
      '</div>' +

      '<h5 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Vínculos Funcionais Identificados</h5>' +
      vinculosHtml +

      '<div style="margin-top: 14px; padding: 12px 16px; background: var(--bg-surface); border-left: 4px solid ' + boxColor + '; border-radius: 6px; font-size: 13px;">' +
        '<div style="font-weight: 700; margin-bottom: 4px; color: var(--text-main);">Auditoria Constitucional de Acúmulo (CF/88 Art. 37, XVI)</div>' +
        '<div style="color: var(--text-secondary); line-height: 1.5;">' + escapeHtml(auditoria.parecer) + '</div>' +
      '</div>' +
    '</div>';

    modal.classList.remove('hidden');
  }

  function fecharDossieModal() {
    var modal = document.getElementById('modalDossieServidor');
    if (modal) modal.classList.add('hidden');
    servidorModalAtivo = null;
  }

  function copiarFichaDossie() {
    if (!servidorModalAtivo) return;
    var d = servidorModalAtivo;
    var texto = '========================================\n' +
      'DOSSIÊ FUNCIONAL INTEGRADO — HUB OLYMPOS\n' +
      '========================================\n' +
      'Servidor: ' + d.nome + '\n' +
      'CPF: ' + d.cpfMascarado + '\n' +
      'Matrícula(s): ' + (d.matriculas.join(', ') || 'N/I') + '\n' +
      'Carga Horária Semanal Total: ' + d.cargaHorariaTotal + 'h\n' +
      'Total de Vínculos: ' + d.vinculos.length + '\n\n' +
      '--- VÍNCULOS REGISTRADOS ---\n';

    d.vinculos.forEach(function(v, idx) {
      texto += '\n[Vínculo #' + (idx + 1) + ']\n' +
        'Ente: ' + v.ente + '\n' +
        'Matrícula: ' + (v.matricula || 'N/I') + '\n' +
        'Cargo: ' + v.cargo + '\n' +
        'Quadro: ' + v.quadro + '\n' +
        'Lotação: ' + v.lotacao + '\n' +
        'Jornada: ' + v.cargaHorariaTexto + ' (' + v.turno + ')\n' +
        'Regime: ' + v.regime + ' | Situação: ' + v.situacao + '\n';
    });

    texto += '\n--- AUDITORIA CF/88 ART. 37, XVI ---\n' +
      d.auditoria.parecer + '\n' +
      '========================================\n';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function() {
        if (window.OlymposApp && window.OlymposApp.showToast) {
          window.OlymposApp.showToast('Ficha do servidor copiada para a área de transferência!');
        } else {
          alert('Ficha do servidor copiada com sucesso!');
        }
      });
    }
  }

  /**
   * Exporta resultado atual para CSV
   */
  function exportarCsv() {
    if (!listaFiltradaCache || listaFiltradaCache.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    var csvRows = [];
    csvRows.push(['Nome', 'CPF Mascarado', 'Matrículas', 'Ente(s)', 'Cargo Principal', 'Carga Horária Total', 'Lotação Principal', 'Parecer CF88'].map(function(c) {
      return '"' + String(c).replace(/"/g, '""') + '"';
    }).join(';'));

    listaFiltradaCache.forEach(function(d) {
      var row = [
        d.nome,
        d.cpfMascarado,
        d.matriculas.join(', '),
        d.entes.join(' | '),
        d.cargos[0] || '',
        d.cargaHorariaTotal + 'h',
        d.lotacoes[0] || '',
        d.auditoria.badgeTexto + ' - ' + d.auditoria.parecer
      ];
      csvRows.push(row.map(function(c) {
        return '"' + String(c).replace(/"/g, '""') + '"';
      }).join(';'));
    });

    var blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'servidores_olympos_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Exporta catálogo atual para JSON
   */
  function exportarJson() {
    if (!listaFiltradaCache || listaFiltradaCache.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    var blob = new Blob([JSON.stringify(listaFiltradaCache, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'servidores_olympos_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Inicialização do módulo (Idempotente)
   */
  function init() {
    var viewSection = document.getElementById('page-servidores');
    if (!viewSection) return;

    // Vincula eventos se ainda não vinculados
    var buscaInput = document.getElementById('servidorBuscaInput');
    if (buscaInput && !buscaInput._bound) {
      buscaInput._bound = true;
      buscaInput.addEventListener('input', function() {
        var valor = this.value;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          termoBusca = valor;
          atualizarConsultaCompleta();
        }, 200);
      });
    }

    var btnLimpar = document.getElementById('btnLimparBuscaServidores');
    if (btnLimpar && !btnLimpar._bound) {
      btnLimpar._bound = true;
      btnLimpar.addEventListener('click', function() {
        termoBusca = '';
        if (buscaInput) buscaInput.value = '';
        atualizarConsultaCompleta();
      });
    }

    // Novos Selects Dropdown (M3)
    var selEnte = document.getElementById('filtroEnteSelect') || document.getElementById('servidorFiltroEnteSelect');
    if (selEnte && !selEnte._bound) {
      selEnte._bound = true;
      selEnte.addEventListener('change', function() {
        filtroEnte = selEnte.value || 'todos';
        atualizarConsultaCompleta();
      });
    }

    var selQuadro = document.getElementById('filtroQuadroSelect') || document.getElementById('servidorFiltroQuadroSelect');
    if (selQuadro && !selQuadro._bound) {
      selQuadro._bound = true;
      selQuadro.addEventListener('change', function() {
        filtroCargo = selQuadro.value || 'todos';
        atualizarConsultaCompleta();
      });
    }

    var selRegime = document.getElementById('filtroRegimeSelect') || document.getElementById('servidorFiltroRegimeSelect');
    if (selRegime && !selRegime._bound) {
      selRegime._bound = true;
      selRegime.addEventListener('change', function() {
        filtroRegime = selRegime.value || 'todos';
        atualizarConsultaCompleta();
      });
    }

    var selVinculos = document.getElementById('filtroVinculosSelect') || document.getElementById('servidorFiltroVinculosSelect');
    if (selVinculos && !selVinculos._bound) {
      selVinculos._bound = true;
      selVinculos.addEventListener('change', function() {
        filtroVinculos = selVinculos.value || 'todos';
        atualizarConsultaCompleta();
      });
    }

    // Filtros de Ente (Fallback pills / data attributes)
    document.querySelectorAll('[data-filtro-ente]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-ente]').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          filtroEnte = this.getAttribute('data-filtro-ente') || 'todos';
          atualizarConsultaCompleta();
        });
      }
    });

    // Filtros de Cargo/Quadro
    document.querySelectorAll('[data-filtro-cargo]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-cargo]').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          filtroCargo = this.getAttribute('data-filtro-cargo') || 'todos';
          atualizarConsultaCompleta();
        });
      }
    });

    // Filtros de Regime
    document.querySelectorAll('[data-filtro-regime]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-regime]').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          filtroRegime = this.getAttribute('data-filtro-regime') || 'todos';
          atualizarConsultaCompleta();
        });
      }
    });

    // Filtros de Vínculos / CF/88
    document.querySelectorAll('[data-filtro-vinculos]').forEach(function(btn) {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', function() {
          document.querySelectorAll('[data-filtro-vinculos]').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          filtroVinculos = this.getAttribute('data-filtro-vinculos') || 'todos';
          atualizarConsultaCompleta();
        });
      }
    });

    // Botões de Exportação e Impressão
    var btnCsv = document.getElementById('btnExportarServidoresCsv');
    if (btnCsv && !btnCsv._bound) {
      btnCsv._bound = true;
      btnCsv.addEventListener('click', exportarCsv);
    }
    var btnJson = document.getElementById('btnExportarServidoresJson');
    if (btnJson && !btnJson._bound) {
      btnJson._bound = true;
      btnJson.addEventListener('click', exportarJson);
    }
    var btnPrint = document.getElementById('btnImprimirServidores');
    if (btnPrint && !btnPrint._bound) {
      btnPrint._bound = true;
      btnPrint.addEventListener('click', function() { window.print(); });
    }

    // Modal Events
    var btnCloseModal = document.getElementById('closeModalDossieServidorBtn');
    if (btnCloseModal && !btnCloseModal._bound) {
      btnCloseModal._bound = true;
      btnCloseModal.addEventListener('click', fecharDossieModal);
    }
    var btnFecharModal = document.getElementById('btnFecharModalDossie');
    if (btnFecharModal && !btnFecharModal._bound) {
      btnFecharModal._bound = true;
      btnFecharModal.addEventListener('click', fecharDossieModal);
    }
    var btnCopiar = document.getElementById('btnCopiarFichaDossie');
    if (btnCopiar && !btnCopiar._bound) {
      btnCopiar._bound = true;
      btnCopiar.addEventListener('click', copiarFichaDossie);
    }
    var btnImprimirDossie = document.getElementById('btnImprimirFichaDossie');
    if (btnImprimirDossie && !btnImprimirDossie._bound) {
      btnImprimirDossie._bound = true;
      btnImprimirDossie.addEventListener('click', function() { window.print(); });
    }

    // Modal Backdrop Click
    var modalBackdrop = document.getElementById('modalDossieServidor');
    if (modalBackdrop && !modalBackdrop._bound) {
      modalBackdrop._bound = true;
      modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) {
          fecharDossieModal();
        }
      });
    }

    // Inicia KPIs com traços (--) e exibe estado de carregamento sem valores estáticos intermediários
    zerarKpis();
    exibirCarregando();

    // Carrega a base consolidada completa dos entes (47k+ servidores) e popula os valores reais
    if (window.OlymposServidores && typeof window.OlymposServidores.carregarBaseConsolidadaAsync === 'function') {
      window.OlymposServidores.carregarBaseConsolidadaAsync().then(function() {
        atualizarConsultaCompleta();
      }).catch(function() {
        atualizarConsultaCompleta();
      });
    } else {
      atualizarConsultaCompleta();
    }
  }

  return {
    init: init,
    zerarKpis: zerarKpis,
    exibirCarregando: exibirCarregando,
    carregarTodosDossies: carregarTodosDossies,
    filtrarDossies: filtrarDossies,
    abrirDossieModal: abrirDossieModal,
    fecharDossieModal: fecharDossieModal,
    exportarCsv: exportarCsv,
    exportarJson: exportarJson,
    limparTodosFiltros: limparTodosFiltros
  };
})();
