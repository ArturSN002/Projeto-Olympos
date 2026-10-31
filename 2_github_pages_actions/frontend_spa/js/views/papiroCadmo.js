/**
 * Hub Olympos V2.1 — Página Modular 7: O Papiro de Cadmo (ETL Mensal de Permutas RN)
 */
window.OlymposViews = window.OlymposViews || {};

window.OlymposViews.papiroCadmo = (function() {
  let isStatusLoaded = false;

  const PORTAIS = [
    { nome: 'Governo do Estado do RN (SEEC)', regiao: 'Estadual', tecnologia: 'Playwright SPA (SEAD/COPES)', url: 'https://remuneracao.rn.gov.br/table-people' },
    { nome: 'Ceará-Mirim (Base Local SMEB)', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://pmcearamirimrn.transparencia.topsolutionsrn.com.br/servidores' },
    { nome: 'Natal', regiao: 'Grande Natal', tecnologia: 'Portal Transparência SME • CSV', url: 'https://www.natal.rn.gov.br/transparencia' },
    { nome: 'Parnamirim', regiao: 'Grande Natal', tecnologia: 'Portal Transparência • CSV', url: 'https://transparencia.parnamirim.rn.gov.br' },
    { nome: 'São Gonçalo do Amarante', regiao: 'Grande Natal', tecnologia: 'TopSolutions / Exportação CSV', url: 'https://saogoncalo.rn.gov.br' },
    { nome: 'Macaíba', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://macaiba.rn.gov.br' },
    { nome: 'Extremoz', regiao: 'Grande Natal', tecnologia: 'TopSolutions RN • CSV', url: 'https://extremoz.rn.gov.br' },
    { nome: 'Nísia Floresta', regiao: 'Agreste / Litoral', tecnologia: 'TopSolutions RN • CSV', url: 'https://nisiafloresta.rn.gov.br' },
    { nome: 'Monte Alegre', regiao: 'Agreste', tecnologia: 'TopSolutions RN • CSV', url: 'https://montealegre.rn.gov.br' },
    { nome: 'Ielmo Marinho', regiao: 'Potengi', tecnologia: 'TopSolutions RN • CSV', url: 'https://ielmomarinho.rn.gov.br' },
    { nome: 'São Paulo do Potengi', regiao: 'Potengi', tecnologia: 'TopSolutions RN • CSV', url: 'https://saopaulodopotengi.rn.gov.br' },
    { nome: 'João Câmara', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://joaocamara.rn.gov.br' },
    { nome: 'Poço Branco', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://pocobranco.rn.gov.br' },
    { nome: 'Taipú', regiao: 'Mato Grande', tecnologia: 'TopSolutions RN • CSV', url: 'https://taipu.rn.gov.br' },
    { nome: 'Touros', regiao: 'Litoral Norte', tecnologia: 'TopSolutions RN • CSV', url: 'https://touros.rn.gov.br' },
    { nome: 'Rio do Fogo', regiao: 'Litoral Norte', tecnologia: 'TopSolutions RN • CSV', url: 'https://riodofogo.rn.gov.br' }
  ];

  function init() {
    bindEvents();
    renderizarPortais('');
    if (!isStatusLoaded) {
      carregarStatusDrive();
    }
  }

  function bindEvents() {
    const inFilter = document.getElementById('cadmoPortalFilterInput');
    if (inFilter && !inFilter._bound) {
      inFilter._bound = true;
      inFilter.addEventListener('input', function() {
        renderizarPortais(inFilter.value);
      });
    }

    const btnTrigger = document.getElementById('cadmoTriggerEtlBtn');
    if (btnTrigger && !btnTrigger._bound) {
      btnTrigger._bound = true;
      btnTrigger.addEventListener('click', dispararColetaMensal);
    }
  }

  function carregarStatusDrive() {
    window.OlymposApi.chamar('cadmo_status', {}, function(res) {
      const data = (res && res.data) ? res.data : res;
      if (!data) return;
      isStatusLoaded = true;

      const compEl = document.getElementById('cadmoLastCompetencia');
      const metaEl = document.getElementById('cadmoLastUploadMeta');
      const listEl = document.getElementById('cadmoCsvFilesList');

      if (compEl) compEl.textContent = data.ultimaCompetencia || 'Ciclo Mensal Configurado (Todo dia 12)';
      if (metaEl) {
        metaEl.textContent = data.totalArquivosCsv > 0
          ? (data.totalArquivosCsv + ' base(s) CSV consolidada(s) no Drive • Última atualização: ' + (data.ultimoUploadEm || '--'))
          : 'Pipeline pronto no GitHub Actions. Os arquivos servidores-intermunicipais-AAAA-MM.csv aparecerão automaticamente aqui.';
      }

      if (listEl) {
        const arqs = data.arquivosCsv || [];
        if (arqs.length === 0) {
          listEl.innerHTML = 'Nenhuma base <code>servidores-intermunicipais-AAAA-MM.csv</code> localizada ainda na pasta do Setor Pessoal.';
        } else {
          listEl.className = 'job-links-list';
          window.OlymposApp.renderizarItensLinksGerados(
            listEl,
            arqs.map(function(a) {
              return {
                titulo: a.nome,
                detalhe: 'Competência ' + a.competencia + ' • ' + a.dataCriacao + ' • ' + a.tamanhoKb + ' KB',
                url: a.url
              };
            })
          );
        }
      }
    }, function() {
      const listEl = document.getElementById('cadmoCsvFilesList');
      if (listEl) {
        listEl.innerHTML = 'Conecte-se ao Gateway GAS para listar os arquivos CSV consolidados na pasta do Setor Pessoal.';
      }
    });
  }

  function renderizarPortais(termoRaw) {
    const grid = document.getElementById('cadmoPortaisGrid');
    if (!grid) return;

    const termo = String(termoRaw || '').toLowerCase().trim();
    const filtrados = PORTAIS.filter(function(p) {
      if (!termo) return true;
      return p.nome.toLowerCase().includes(termo) ||
        p.regiao.toLowerCase().includes(termo) ||
        p.tecnologia.toLowerCase().includes(termo);
    });

    grid.innerHTML = '';
    filtrados.forEach(function(p) {
      const card = document.createElement('div');
      card.className = 'output-panel';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';
      card.style.gap = '10px';

      card.innerHTML =
        '<div>' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">' +
            '<strong style="font-family:var(--font-display); font-size:13.5px; color:var(--text-main);">' + window.OlymposApp.escapeHtml(p.nome) + '</strong>' +
            '<span class="pill-badge pill-green">Dia 12</span>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--text-muted);">' + window.OlymposApp.escapeHtml(p.regiao) + ' • ' + window.OlymposApp.escapeHtml(p.tecnologia) + '</div>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted);">Fallback SIAI/TCE-RN</span>' +
          '<a href="' + window.OlymposApp.escapeHtml(p.url) + '" target="_blank" rel="noopener" class="folder-chip" style="padding:3px 10px; font-size:11px;">Portal ↗</a>' +
        '</div>';

      grid.appendChild(card);
    });
  }

  function dispararColetaMensal() {
    const comp = prompt('Competência opcional (AAAA-MM, ex: 2026-09). Deixe vazio para coletar o mês anterior completo:', '');
    if (comp === null) return;

    window.OlymposApp.showToast('Acionando pipeline O Papiro de Cadmo no GitHub Actions...');
    window.OlymposApi.chamar('cadmo_disparar_coleta', { competencia: comp.trim() }, function(res) {
      if (res && res.ok) {
        window.OlymposApp.showToast(res.mensagem || 'Pipeline O Papiro de Cadmo acionado!');
      } else {
        window.OlymposApp.showToast((res && res.mensagem) || 'Falha ao acionar coleta.', true);
      }
    }, function(err) {
      window.OlymposApp.showToast('Erro: ' + err.message, true);
    });
  }

  return {
    init: init
  };
})();
