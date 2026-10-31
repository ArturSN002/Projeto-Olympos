/**
 * Hub Olympos V2 — Sistema Vetorial Exclusivo (17 Emblemas Mitológicos + Ícones Editoriais UI)
 * Estética inspirada em Google DeepMind & The Keyword (traço geométrico preciso de 1.75px).
 */
window.OlymposIcons = (function() {
  const PERSONA_SVGS = {
    // 1. Hélio — Disco Solar Radiante (Diário Oficial FEMURN)
    helio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2 3"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/></svg>`,

    // 2. Apolo — Olho da Ordem & Arco Solar (Numeração Sequencial 2026)
    apolo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.8-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.8 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M12 3v1.5M12 19.5V21"/></svg>`,

    // 3. Hera — Diadema Real Soberano (Gestão de Pessoas e Permutas)
    hera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18M4 15l2-8 6 4 6-4 2 8H4z"/><circle cx="12" cy="5" r="1.3"/><circle cx="5.5" cy="5.8" r="1"/><circle cx="18.5" cy="5.8" r="1"/></svg>`,

    // 4. Nike — Asa da Vitória em Voo (Processos Seletivos PSS)
    nike: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c4.5-1 8.5-4.5 11-11 1.5 3.2 4 5.2 7 6-2.5 3.5-6.5 6.5-12.5 7.5L3 17z"/><path d="M7.5 14.5c2.8-.8 5.2-2.6 7-5.5"/></svg>`,

    // 5. Têmis — Balança da Equidade (Assessoria Jurídica)
    temis: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M4 7h16"/><path d="M6 7l-2.5 6a3 3 0 0 0 5 0L6 7zM18 7l-2.5 6a3 3 0 0 0 5 0L18 7z"/></svg>`,

    // 6. Orfeu — Lira Clássica de Sete Cordas (Certificados e Eventos)
    orfeu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4c-2.5 2.5-2.5 7.5 0 11h10c2.5-3.5 2.5-8.5 0-11"/><path d="M5 15h14M8 15v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4M10 6v9M14 6v9M6.5 6h11"/></svg>`,

    // 7. Homero — Pena & Pergaminho Oficial (Portarias e Redação PR/2018)
    homero: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h4M9 9h2"/></svg>`,

    // 8. Héstia — Chama Sagrada da Lareira Central (Governança e Gabinete)
    hestia: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2.5 3.2 5 5.8 5 9.5a5 5 0 0 1-10 0c0-2.4 1.3-4.6 2.6-6.2.4 1.5 1.4 2.4 2.4 2.4-.3-1.8.3-4 0-5.7z"/><path d="M5 21h14"/></svg>`,

    // 9. Dédalo — Cubo Arquitetônico & Labirinto (Engenharia e Backups)
    dedalo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9.5h11v5h-5v-2.5M14.5 3.5v3M9.5 14.5v6"/></svg>`,

    // 10. Atena — Coruja da Sabedoria Geométrica (Coordenação Pedagógica)
    atena: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l2.5 2h7L18 6v7a6 6 0 0 1-12 0V6z"/><circle cx="9.5" cy="11.5" r="1.4"/><circle cx="14.5" cy="11.5" r="1.4"/><path d="M12 13v2.2M9.5 19.5L8 21M14.5 19.5L16 21"/></svg>`,

    // 11. Hermes — Caduceu & Asa Veloz (Transporte Escolar e Mobilidade)
    hermes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M7 6c2-1.5 3.5-1.5 5 0 1.5-1.5 3-1.5 5 0"/><path d="M8 10c0 2 8 2 8 4s-8 2-8 4"/><circle cx="12" cy="3" r="1"/></svg>`,

    // 12. Zeus — Raio Soberano do Oráculo (Triagem Executiva Macro)
    zeus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 4 14 11.5 14 10.5 22 20 10 12.5 10 13 2"/></svg>`,

    // 13. Cadmo — Papiro & Matriz Cadastral (O Papiro de Cadmo / 16 Entes RN)
    cadmo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h11A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 5 18.5v-13z"/><path d="M5 7H3.5A1.5 1.5 0 0 0 2 8.5v9A1.5 1.5 0 0 0 3.5 19H5"/><circle cx="11" cy="10" r="2"/><path d="M8.5 15.5c.8-1.3 1.8-2 2.5-2s1.7.7 2.5 2M15.5 9.5h2.5M15.5 13h2.5"/></svg>`,

    // 14. Arquimedes — Compasso Áureo & Espiral de Dados (Ciência de Dados)
    arquimedes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M10.8 6.8L5.5 20M13.2 6.8L18.5 20M7.5 14.5h9M12 2.5v.5"/></svg>`,

    // 15. Hefesto — Bigorna & Forja de Automação (DevOps, Actions e GAS)
    hefesto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13l3-2v4l-3 2H9l-1 4h9v3H5v-3h2l-1-4-2-1V9z"/><path d="M10 4l2 2M14 3l-1 2.5"/></svg>`,

    // 16. Íris — Arco Prismático Mensageiro (Comunicação Rápida e Chat)
    iris: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17a9 9 0 0 1 18 0"/><path d="M6.5 17a5.5 5.5 0 0 1 11 0"/><path d="M10 17a2 2 0 0 1 4 0"/><path d="M2 17h20"/></svg>`,

    // 17. Sólon — Coluna Jônica Constitucional (Técnica Legislativa)
    solon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16M5.5 5a2 2 0 1 0 0 3.5h13a2 2 0 1 0 0-3.5"/><path d="M8 8.5v9.5M12 8.5v9.5M16 8.5v9.5M4 21h16M5.5 18h13"/></svg>`
  };

  // Aliases de compatibilidade retroativa com nomes de ícones do backend
  const ALIASES = {
    sun: 'helio',
    eye: 'apolo',
    crown: 'hera',
    wings: 'nike',
    scale: 'temis',
    lyre: 'orfeu',
    scroll: 'homero',
    flame: 'hestia',
    maze: 'dedalo',
    owl: 'atena',
    'winged-boot': 'hermes',
    lightning: 'zeus',
    'id-card': 'cadmo',
    compass: 'arquimedes',
    hammer: 'hefesto',
    rainbow: 'iris',
    pillar: 'solon'
  };

  const UI_SVGS = {
    olymposMark: `<svg viewBox="0 0 28 28" fill="none"><rect x="2" y="2" width="24" height="24" rx="8" stroke="currentColor" stroke-width="1.8"/><path d="M7 20h14M8.5 17V11.5M14 17V10M19.5 17V11.5M6.5 10L14 6l7.5 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>`,
    sunMode: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
    moonMode: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`,
    external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-15.4-6.4L3 8M3 3v5h5M3 12a9 9 0 0 0 15.4 6.4L21 16M21 21v-5h-5"/></svg>`,
    sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>`
  };

  function normalizarChave(key) {
    if (!key) return 'hestia';
    const limpa = String(key)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (PERSONA_SVGS[limpa]) return limpa;
    if (ALIASES[limpa]) return ALIASES[limpa];
    return 'hestia';
  }

  function get(iconOrName) {
    const k = normalizarChave(iconOrName);
    return PERSONA_SVGS[k] || PERSONA_SVGS.hestia;
  }

  function ui(name) {
    return UI_SVGS[name] || '';
  }

  function getCatalogo17Personas() {
    return [
      { id: 'hestia', nome: 'Héstia', camada: 'Camada 1', tipo: 'memoria', arquivo: '_memoria_hestia.md', dominio: 'Governança Central & Gabinete' },
      { id: 'zeus', nome: 'Zeus', camada: 'Camada 1', tipo: 'anfitriao', anfitriao: 'Héstia', dominio: 'Oráculo Executivo & Triagem Macro' },
      { id: 'hera', nome: 'Hera', camada: 'Camada 2', tipo: 'memoria', arquivo: '_memoria_hera.md', dominio: 'Gestão de Pessoas & Permutas' },
      { id: 'atena', nome: 'Atena', camada: 'Camada 2', tipo: 'memoria', arquivo: '_memoria_atena.md', dominio: 'Coordenação Pedagógica' },
      { id: 'nike', nome: 'Nike', camada: 'Camada 2', tipo: 'memoria', arquivo: '_memoria_nike.md', dominio: 'Processos Seletivos (PSS)' },
      { id: 'temis', nome: 'Têmis', camada: 'Camada 2', tipo: 'memoria', arquivo: '_memoria_temis.md', dominio: 'Assessoria Jurídica' },
      { id: 'hermes', nome: 'Hermes', camada: 'Camada 2', tipo: 'memoria', arquivo: '_memoria_hermes.md', dominio: 'Transporte Escolar & Logística' },
      { id: 'apolo', nome: 'Apolo', camada: 'Camada 3A', tipo: 'memoria', arquivo: '_memoria_apolo.md', dominio: 'Numeração Oficial 2026' },
      { id: 'homero', nome: 'Homero', camada: 'Camada 3A', tipo: 'memoria', arquivo: '_memoria_homero.md', dominio: 'Portarias, Licenças & Ofícios' },
      { id: 'orfeu', nome: 'Orfeu', camada: 'Camada 3A', tipo: 'memoria', arquivo: '_memoria_orfeu.md', dominio: 'Certificados & Declarações' },
      { id: 'helio', nome: 'Hélio', camada: 'Camada 3A', tipo: 'memoria', arquivo: '_memoria_helio.md', dominio: 'Diário Oficial FEMURN' },
      { id: 'cadmo', nome: 'Cadmo', camada: 'Camada 3B', tipo: 'anfitriao', anfitriao: 'Hera', dominio: 'Papiro de Cadmo (16 Entes RN)' },
      { id: 'iris', nome: 'Íris', camada: 'Camada 3B', tipo: 'anfitriao', anfitriao: 'Héstia', dominio: 'Comunicação Ágil & Chat' },
      { id: 'solon', nome: 'Sólon', camada: 'Camada 3B', tipo: 'anfitriao', anfitriao: 'Têmis', dominio: 'Técnica Legislativa' },
      { id: 'dedalo', nome: 'Dédalo', camada: 'Camada 4', tipo: 'memoria', arquivo: '_memoria_dedalo.md', dominio: 'Infraestrutura & Snapshots' },
      { id: 'arquimedes', nome: 'Arquimedes', camada: 'Camada 4', tipo: 'anfitriao', anfitriao: 'Dédalo', dominio: 'Ciência de Dados & Censo' },
      { id: 'hefesto', nome: 'Hefesto', camada: 'Camada 4', tipo: 'anfitriao', anfitriao: 'Dédalo', dominio: 'GitHub Actions & Integração GAS' }
    ];
  }

  return {
    get: get,
    getPersonaSvg: get,
    ui: ui,
    normalizarChave: normalizarChave,
    getCatalogo17Personas: getCatalogo17Personas
  };
})();
