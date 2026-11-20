/**
 * Hub Olympos — Sistema Vetorial Exclusivo (17 Emblemas Mitológicos + Ícones Editoriais UI)
 * Estética inspirada em Google DeepMind & The Keyword (traço geométrico preciso de 1.75px).
 */
window.OlymposIcons = (function() {
  const PERSONA_SVGS = {
    // 1. Hélio — Disco Solar Radiante (Diário Oficial FEMURN)
    helio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2 3"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/></svg>',

    // 2. Apolo — Olho da Ordem & Arco Solar (Numeração Sequencial 2026)
    apolo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.8-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.8 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M12 3v1.5M12 19.5V21"/></svg>',

    // 3. Hera — Diadema Real Soberano (Gestão de Pessoas e Permutas)
    hera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18M4 15l2-8 6 4 6-4 2 8H4z"/><circle cx="12" cy="5" r="1.3"/><circle cx="5.5" cy="5.8" r="1"/><circle cx="18.5" cy="5.8" r="1"/></svg>',

    // 4. Nike — Asa da Vitória em Voo (Processos Seletivos PSS)
    nike: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c4.5-1 8.5-4.5 11-11 1.5 3.2 4 5.2 7 6-2.5 3.5-6.5 6.5-12.5 7.5L3 17z"/><path d="M7.5 14.5c2.8-.8 5.2-2.6 7-5.5"/></svg>',

    // 5. Têmis — Balança da Equidade (Assessoria Jurídica)
    temis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M4 7h16"/><path d="M6 7l-2.5 6a3 3 0 0 0 5 0L6 7zM18 7l-2.5 6a3 3 0 0 0 5 0L18 7z"/></svg>',

    // 6. Orfeu — Lira Clássica de Sete Cordas (Certificados e Eventos)
    orfeu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4c-2.5 2.5-2.5 7.5 0 11h10c2.5-3.5 2.5-8.5 0-11"/><path d="M5 15h14M8 15v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4M10 6v9M14 6v9M6.5 6h11"/></svg>',

    // 7. Homero — Pena & Pergaminho Oficial (Portarias e Redação PR/2018)
    homero: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h4M9 9h2"/></svg>',

    // 8. Héstia — Chama Sagrada da Lareira Central (Governança e Gabinete)
    hestia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2.5 3.2 5 5.8 5 9.5a5 5 0 0 1-10 0c0-2.4 1.3-4.6 2.6-6.2.4 1.5 1.4 2.4 2.4 2.4-.3-1.8.3-4 0-5.7z"/><path d="M5 21h14"/></svg>',

    // 9. Dédalo — Cubo Arquitetônico & Labirinto (Engenharia e Backups)
    dedalo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9.5h11v5h-5v-2.5M14.5 3.5v3M9.5 14.5v6"/></svg>',

    // 10. Atena — Coruja da Sabedoria Geométrica (Coordenação Pedagógica)
    atena: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l2.5 2h7L18 6v7a6 6 0 0 1-12 0V6z"/><circle cx="9.5" cy="11.5" r="1.4"/><circle cx="14.5" cy="11.5" r="1.4"/><path d="M12 13v2.2M9.5 19.5L8 21M14.5 19.5L16 21"/></svg>',

    // 11. Hermes — Caduceu & Asa Veloz (Transporte Escolar e Mobilidade)
    hermes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M7 6c2-1.5 3.5-1.5 5 0 1.5-1.5 3-1.5 5 0"/><path d="M8 10c0 2 8 2 8 4s-8 2-8 4"/><circle cx="12" cy="3" r="1"/></svg>',

    // 12. Zeus — Raio Soberano do Oráculo (Triagem Executiva Macro)
    zeus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 4 14 11.5 14 10.5 22 20 10 12.5 10 13 2"/></svg>',

    // 13. Cadmo — Papiro & Matriz Cadastral (O Papiro de Cadmo / 16 Entes RN)
    cadmo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h11A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 5 18.5v-13z"/><path d="M5 7H3.5A1.5 1.5 0 0 0 2 8.5v9A1.5 1.5 0 0 0 3.5 19H5"/><circle cx="11" cy="10" r="2"/><path d="M8.5 15.5c.8-1.3 1.8-2 2.5-2s1.7.7 2.5 2M15.5 9.5h2.5M15.5 13h2.5"/></svg>',

    // 14. Arquimedes — Compasso Áureo & Espiral de Dados (Ciência de Dados)
    arquimedes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M10.8 6.8L5.5 20M13.2 6.8L18.5 20M7.5 14.5h9M12 2.5v.5"/></svg>',

    // 15. Hefesto — Bigorna & Forja de Automação (DevOps, Actions e GAS)
    hefesto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13l3-2v4l-3 2H9l-1 4h9v3H5v-3h2l-1-4-2-1V9z"/><path d="M10 4l2 2M14 3l-1 2.5"/></svg>',

    // 16. Íris — Arco Prismático Mensageiro (Comunicação Rápida e Chat)
    iris: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17a9 9 0 0 1 18 0"/><path d="M6.5 17a5.5 5.5 0 0 1 11 0"/><path d="M10 17a2 2 0 0 1 4 0"/><path d="M2 17h20"/></svg>',

    // 17. Sólon — Coluna Jônica Constitucional (Técnica Legislativa)
    solon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16M5.5 5a2 2 0 1 0 0 3.5h13a2 2 0 1 0 0-3.5"/><path d="M8 8.5v9.5M12 8.5v9.5M16 8.5v9.5M4 21h16M5.5 18h13"/></svg>',

    // 18. Afrodite — Rosa Radiante & Harmonia (Clima Escolar e Saúde Mental)
    afrodite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 18h6"/><path d="M12 4v2M7.5 9h-2M18.5 9h-2"/></svg>',

    // 19. Ares — Escudo Octogonal & Lança (Mediação e Disciplina Funcional)
    ares: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6l7-3z"/><path d="M12 7v9M8.5 11.5h7"/></svg>',

    // 20. Ártemis — Arco Lunar & Flecha (Auditoria FUNDEB e Conformidade)
    artemis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4a9 9 0 0 1 0 16"/><path d="M5 12h15M16 9l4 3-4 3"/></svg>',

    // 21. Cronos — Ampulheta do Tempo Letivo (203 Dias & Prazos Históricos)
    cronos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 21h12M7.5 3v4.5a4.5 4.5 0 0 0 9 0V3M7.5 21v-4.5a4.5 4.5 0 0 1 9 0V21"/></svg>',

    // 22. Deméter — Espiga Dourada PNAE (Alimentação Escolar e Nutrição)
    demeter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M12 7c-2.2 0-4-1.3-4-3.2C10.2 3.8 12 5 12 7zM12 7c2.2 0 4-1.3 4-3.2C13.8 3.8 12 5 12 7zM12 12c-2.4 0-4.2-1.4-4.2-3.4 2.4 0 4.2 1.2 4.2 3.4zM12 12c2.4 0 4.2-1.4 4.2-3.4-2.4 0-4.2 1.2-4.2 3.4zM12 17c-2.2 0-3.8-1.2-3.8-3 2.2 0 3.8 1.1 3.8 3zM12 17c2.2 0 3.8-1.2 3.8-3-2.2 0-3.8 1.1-3.8 3z"/></svg>',

    // 23. Dionísio — Cálice Cultural & Louros (Cultura, Esporte e JEMs)
    dionisio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7c0 4 2.5 7 5.5 7s5.5-3 5.5-7H4z"/><path d="M9.5 14v5M6.5 19h6M16 7.5c2 0 3.5 1.5 3.5 3.8 0 2.5-1.8 4.2-3.5 4.2"/></svg>',

    // 24. Hades — Chave do Acervo Histórico (Contencioso e Arquivo Morto)
    hades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v4"/></svg>',

    // 25. Poseidon — Tridente Hídrico (Abastecimento e Saneamento Escolar)
    poseidon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 5v5a5 5 0 0 0 10 0V5"/><path d="M9 21h6M10 5l2-2 2 2"/></svg>',

    // 26. Prometeu / Prometheus — Tocha do Fogo Sagrado (Raspagem FEMURN & NER)
    prometeu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2 2.4 3.8 4.5 3.8 7a3.8 3.8 0 1 1-7.6 0c0-1.6.9-3.1 1.9-4.2.3 1 .9 1.6 1.7 1.6-.2-1.4.2-3 .2-4.4z"/><path d="M9 14h6l-1.5 7h-3L9 14z"/></svg>'
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
    pillar: 'solon',
    prometheus: 'prometeu',
    mnemosine: 'cadmo',
    argos: 'apolo',
    quiron: 'atena',
    clio: 'homero',
    dice: 'temis'
  };

  const UI_SVGS = {
    olymposMark: '<svg viewBox="0 0 28 28" fill="none"><rect x="2" y="2" width="24" height="24" rx="8" stroke="currentColor" stroke-width="1.8"/><path d="M7 20h14M8.5 17V11.5M14 17V10M19.5 17V11.5M6.5 10L14 6l7.5 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    olymposLogo: '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10L14 3l11 7"/><path d="M5 10h18"/><path d="M4 24h20"/><path d="M6 21h16"/><path d="M7 10v11"/><path d="M11.5 10v11"/><path d="M16.5 10v11"/><path d="M21 10v11"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>',
    searchLens: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    sunMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    sunLight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moonMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    moonDark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>',
    externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    copyClip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-15.4-6.4L3 8M3 3v5h5M3 12a9 9 0 0 0 15.4 6.4L21 16M21 21v-5h-5"/></svg>',
    refreshSync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/></svg>',
    settingsGear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    laurelCrown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4.5-1.5-7.5-5.5-7.5-10.5C4.5 6.5 7 3.5 9.5 2"/><path d="M12 21c4.5-1.5 7.5-5.5 7.5-10.5 0-4-2.5-7-5-8.5"/><path d="M10 22l2-2 2 2"/><path d="M4.8 11c2-.5 3.5.5 4.2 2"/><path d="M5.5 7c2 0 3.5 1 4 2.5"/><path d="M6.5 15c2-.5 3.8 0 4.5 1.5"/><path d="M19.2 11c-2-.5-3.5.5-4.2 2"/><path d="M18.5 7c-2 0-3.5 1-4 2.5"/><path d="M17.5 15c-2-.5-3.8 0-4.5 1.5"/></svg>',
    eyeOfApollo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>',
    lyreOfOrpheus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3c-1.5 3-1.5 7 1 10.5C8.5 15.5 10 17 12 17s3.5-1.5 5-3.5C19.5 10 19.5 6 18 3"/><path d="M5 6h14"/><path d="M8 17v4"/><path d="M16 17v4"/><path d="M6 21h12"/><path d="M10 6v11"/><path d="M12 6v11"/><path d="M14 6v11"/></svg>',
    fireOfPrometheus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/><path d="M7 21h10"/></svg>',
    papyrusOfCadmus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M15 8h-5"/><path d="M15 12h-5"/></svg>',
    owlOfAthena: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l2 2h8l2-2"/><path d="M5 6c-1 2.5-1 6 0 9 1.2 3.5 4 6 7 6s5.8-2.5 7-6c1-3 1-6.5 0-9"/><circle cx="9.5" cy="10.5" r="2"/><circle cx="14.5" cy="10.5" r="2"/><path d="M12 12.5l-1 2h2l-1-2Z"/><path d="M9 17c1.5 1 4.5 1 6 0"/></svg>',
    wingsOfHermes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M12 8C9 5 4 5 2 8c2 1 4 1 6 0"/><path d="M12 8c3-3 8-3 10 0-2 1-4 1-6 0"/><path d="M8 13c2-2 6-2 8 0s2 5 0 7"/><path d="M16 13c-2-2-6-2-8 0s-2 5 0 7"/><circle cx="12" cy="3" r="1.5"/></svg>',
    shieldOfThemis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 11h8"/><path d="M8 11l-1.5 3h3L8 11z"/><path d="M16 11l-1.5 3h3L16 11z"/></svg>',
    anvilOfHephaestus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10H3l4-4h13v4c0 2.5-2.5 4-5 4h-3v4h4l2 3H6l2-3h3v-4H9c-1.5 0-2-1.5-2-4z"/></svg>',
    boltZeus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    folderDrive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    holiday: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    school: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    sunBeach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>',
    mapPin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    siren: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M4.93 4.93l2.12 2.12M2 12h3M19.07 4.93l-2.12 2.12M22 12h-3"/><path d="M7 12a5 5 0 0 1 10 0v5H7v-5z"/><path d="M5 17h14v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-3z"/></svg>',
    hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
    party: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m4 21 6.5-6.5M9.5 9 6 12.5M14.5 14 11.5 17M14 3l-1.5 4.5L8 9l4.5 1.5L14 15l1.5-4.5L20 9l-4.5-1.5zM19 19l2 2M19 21l2-2"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 5.5v1.5h8V14.5c1.5-1 3-3 3-5.5a7 7 0 0 0-7-7z"/></svg>',
    disk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    newspaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    arrowUpDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    arrowDownLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7 7 17M17 17H7V7"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 2 21 6 17 10"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><polyline points="7 22 3 18 7 14"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    graduationCap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    schoolCei: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="8" height="9" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/><path d="M8 11V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v7"/><circle cx="12" cy="7.5" r="1"/></svg>',
    schoolEspecial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9-9.5C1.5 7.5 4.5 4 8 4c1.9 0 3.2 1 4 2.2C12.8 5 14.1 4 16 4c3.5 0 6.5 3.5 5 7.5-2 5-9 9.5-9 9.5z"/><path d="M12 9v4M10 11h4"/></svg>',
    schoolTecnico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    schoolMulti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>'
  };

  const emojiToIconKey = {
    '📅': 'calendar',
    '🗓️': 'calendar',
    '📆': 'calendar',
    '📌': 'mapPin',
    '📍': 'mapPin',
    '🗺️': 'compass',
    '🧭': 'compass',
    '🏫': 'school',
    '🏛️': 'olymposLogo',
    '🎓': 'laurelCrown',
    '📚': 'book',
    '📖': 'book',
    '📜': 'papyrusOfCadmus',
    '📄': 'fileText',
    '📝': 'edit',
    '✏️': 'edit',
    '🗑️': 'trash',
    '📂': 'folderDrive',
    '📁': 'folderDrive',
    '📥': 'download',
    '📤': 'upload',
    '🖨️': 'printer',
    '📋': 'clipboard',
    '📊': 'chart',
    '📈': 'chart',
    '🔍': 'searchLens',
    '🔎': 'searchLens',
    '⚙️': 'settingsGear',
    '⚡': 'boltZeus',
    '🔥': 'fireOfPrometheus',
    '✨': 'sparkles',
    '⭐': 'star',
    '🌟': 'star',
    '⚖️': 'shieldOfThemis',
    '⚠️': 'alertTriangle',
    '✅': 'checkCircle',
    '🏖️': 'sunBeach',
    '🕯️': 'holiday',
    '🕊️': 'holiday',
    '✝️': 'holiday',
    '🇧🇷': 'holiday',
    '🎭': 'holiday',
    '🌽': 'holiday',
    '🎄': 'holiday',
    '🎆': 'holiday',
    '🛠️': 'anvilOfHephaestus',
    '🤝': 'users',
    '👥': 'users',
    '👨‍🏫': 'users',
    '👩‍🏫': 'users',
    '🚌': 'compass',
    '🍲': 'fireOfPrometheus',
    'ℹ️': 'info',
    'ℹ': 'info',
    '🔄': 'refreshSync',
    '🔒': 'lock',
    '✉️': 'mail',
    '📧': 'mail',
    '🌐': 'globe',
    '🚨': 'siren',
    '⏳': 'hourglass',
    '🎉': 'party',
    '💡': 'lightbulb',
    '💾': 'disk',
    '📰': 'newspaper',
    '🎯': 'target',
    '📎': 'paperclip',
    '👁️': 'eye',
    '👁': 'eye',
    '▼': 'chevronDown',
    '▾': 'chevronDown',
    '🔽': 'chevronDown',
    '🔼': 'chevronUp',
    '↕': 'arrowUpDown',
    '◀': 'arrowLeft',
    '▶': 'arrowRight',
    '↙': 'arrowDownLeft'
  };

  const categoryToIconKey = {
    letivo: 'book',
    feriado: 'holiday',
    recesso: 'sunBeach',
    matricula: 'clipboard',
    jornada: 'laurelCrown',
    sabado_letivo: 'star',
    exame: 'chart',
    comemorativa: 'sparkles',
    agenda_intersetorial: 'calendar',
    reuniao: 'users',
    capacitacao: 'laurelCrown',
    visita_tecnica: 'mapPin',
    audiencia: 'shieldOfThemis'
  };

  function normalizeSize(size) {
    if (size === undefined || size === null || size === '') return null;
    if (typeof size === 'number') {
      if (!Number.isFinite(size) || size <= 0) return null;
      return String(size) + 'px';
    }
    if (typeof size === 'string') {
      const trimmed = size.trim();
      if (!trimmed) return null;
      if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed) > 0 ? (trimmed + 'px') : null;
      }
      if (/^\d+(?:\.\d+)?(px|em|rem|%|vh|vw|ch|ex|vmin|vmax)$/i.test(trimmed)) {
        return parseFloat(trimmed) > 0 ? trimmed.toLowerCase() : null;
      }
    }
    return null;
  }

  function applySvgAttrs(rawSvg, size) {
    if (!rawSvg) return '';
    const dim = normalizeSize(size) || '1em';
    return rawSvg.replace(/^<svg\b([^>]*)>/i, function(_match, attrs) {
      const cleaned = attrs
        .replace(/\s+(?:width|height|aria-hidden)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .trim();
      return '<svg width="' + dim + '" height="' + dim + '" aria-hidden="true"' + (cleaned ? ' ' + cleaned : '') + '>';
    });
  }

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

  function get(iconOrName, size) {
    if (iconOrName && UI_SVGS[iconOrName]) {
      return applySvgAttrs(UI_SVGS[iconOrName], size);
    }
    const k = normalizarChave(iconOrName);
    return applySvgAttrs(PERSONA_SVGS[k] || PERSONA_SVGS.hestia, size);
  }

  function ui(name, size) {
    const raw = UI_SVGS[name] || PERSONA_SVGS[name] || '';
    return raw ? applySvgAttrs(raw, size) : '';
  }

  function inline(name, size) {
    const raw = UI_SVGS[name] || PERSONA_SVGS[name] || '';
    if (!raw) return '';
    const dim = normalizeSize(size);
    const styleAttr = dim ? ' style="width:' + dim + ';height:' + dim + ';"' : '';
    return '<span class="svg-icon-inline" aria-hidden="true"' + styleAttr + '>' + applySvgAttrs(raw, dim) + '</span>';
  }

  function fromEmojiOrKey(rawIconOrEmoji, categoryFallback, size) {
    let resolvedSvg = '';
    if (rawIconOrEmoji && UI_SVGS[rawIconOrEmoji]) {
      resolvedSvg = applySvgAttrs(UI_SVGS[rawIconOrEmoji], size);
    } else if (rawIconOrEmoji && PERSONA_SVGS[rawIconOrEmoji]) {
      resolvedSvg = applySvgAttrs(PERSONA_SVGS[rawIconOrEmoji], size);
    } else {
      const trimmed = String(rawIconOrEmoji || '').trim();
      if (trimmed && emojiToIconKey[trimmed]) {
        const k = emojiToIconKey[trimmed];
        resolvedSvg = UI_SVGS[k] ? applySvgAttrs(UI_SVGS[k], size) : get(k, size);
      } else if (categoryFallback && categoryToIconKey[categoryFallback]) {
        const ck = categoryToIconKey[categoryFallback];
        resolvedSvg = UI_SVGS[ck] ? applySvgAttrs(UI_SVGS[ck], size) : get(ck, size);
      } else {
        resolvedSvg = applySvgAttrs(UI_SVGS.calendar, size);
      }
    }
    const dim = normalizeSize(size);
    const styleAttr = dim ? ' style="width:' + dim + ';height:' + dim + ';"' : '';
    return '<span class="svg-icon-inline" aria-hidden="true"' + styleAttr + '>' + resolvedSvg + '</span>';
  }

  function hydrateAll() {
    if (typeof document === 'undefined') return;
    const nodes = document.querySelectorAll('[data-icon]');
    nodes.forEach(function(el) {
      const name = el.getAttribute('data-icon');
      const raw = UI_SVGS[name] || PERSONA_SVGS[name];
      if (raw) {
        const size = el.getAttribute ? el.getAttribute('data-icon-size') : null;
        el.innerHTML = applySvgAttrs(raw, size);
      }
    });
  }

  function getCatalogo17Personas() {
    return [
      { id: 'hestia', nome: 'Héstia', camada: 'Camada 1', tipo: 'memoria', docId: '1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q', arquivo: '_memoria_hestia.md', dominio: 'Governança Central & Gabinete' },
      { id: 'zeus', nome: 'Zeus', camada: 'Camada 1', tipo: 'memoria', docId: '1qi_H4oKokFDEmXiNuGRYsh6kM4YxgJAQuFirDzOVkdM', arquivo: '_memoria_zeus.md', dominio: 'Oráculo Executivo & Triagem Macro' },
      { id: 'hera', nome: 'Hera', camada: 'Camada 2', tipo: 'memoria', docId: '1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4', arquivo: '_memoria_hera.md', dominio: 'Gestão de Pessoas & Permutas' },
      { id: 'atena', nome: 'Atena', camada: 'Camada 2', tipo: 'memoria', docId: '1L_VJ4xwZIT3KaSOsLnImeORgjmiDjSuBhPavRzh0tHg', arquivo: '_memoria_atena.md', dominio: 'Coordenação Pedagógica' },
      { id: 'nike', nome: 'Niké', camada: 'Camada 2', tipo: 'memoria', docId: '18wyqKRmpVpcNgIHPB2Vg-akLWyGBTLvrkEUwz5bWOW4', arquivo: '_memoria_nike.md', dominio: 'Processos Seletivos (PSS)' },
      { id: 'temis', nome: 'Têmis', camada: 'Camada 2', tipo: 'memoria', docId: '11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A', arquivo: '_memoria_temis.md', dominio: 'Assessoria Jurídica' },
      { id: 'hermes', nome: 'Hermes', camada: 'Camada 2', tipo: 'memoria', docId: '1_7WJSZ0D2tbP1sHWH32pjkDZfmcVUBGJXLUtRWMrlEo', arquivo: '_memoria_hermes.md', dominio: 'Transporte Escolar & Logística' },
      { id: 'apolo', nome: 'Apolo', camada: 'Camada 3A', tipo: 'memoria', docId: '1ZXTlg2Wk5IKZ2Sg84HOnlePCOihccPFcYTd67wHUgkM', arquivo: '_memoria_apolo.md', dominio: 'Numeração Oficial 2026' },
      { id: 'homero', nome: 'Homero', camada: 'Camada 3A', tipo: 'memoria', docId: '1JgCEpBhJC07zjt1TkZvmgzfG00US4FgwwDn-DvgCx8c', arquivo: '_memoria_homero.md', dominio: 'Portarias, Licenças & Ofícios' },
      { id: 'orfeu', nome: 'Orfeu', camada: 'Camada 3A', tipo: 'memoria', docId: '18a_OUyL4tgIN_NkHzStSWOVZS_krGz_B8Z7uVGQfRK8', arquivo: '_memoria_orfeu.md', dominio: 'Certificados & Declarações' },
      { id: 'helio', nome: 'Hélio', camada: 'Camada 3A', tipo: 'memoria', docId: '1JUrOsacYDgF5X1H5DUdYXhOalGoUBUPatli8xp39SU8', arquivo: '_memoria_helio.md', dominio: 'Diário Oficial FEMURN' },
      { id: 'cadmo', nome: 'Cadmo', camada: 'Camada 3B', tipo: 'anfitriao', anfitriao: 'Hera', dominio: 'Papiro de Cadmo (16 Entes RN)' },
      { id: 'iris', nome: 'Íris', camada: 'Camada 3B', tipo: 'anfitriao', anfitriao: 'Héstia', dominio: 'Comunicação Ágil & Chat' },
      { id: 'solon', nome: 'Sólon', camada: 'Camada 3B', tipo: 'anfitriao', anfitriao: 'Têmis', dominio: 'Técnica Legislativa' },
      { id: 'dedalo', nome: 'Dédalo', camada: 'Camada 4', tipo: 'memoria', docId: '1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg', arquivo: '_memoria_dedalo.md', dominio: 'Infraestrutura & Snapshots' },
      { id: 'arquimedes', nome: 'Arquimedes', camada: 'Camada 4', tipo: 'anfitriao', anfitriao: 'Dédalo', dominio: 'Ciência de Dados & Censo' },
      { id: 'hefesto', nome: 'Hefesto', camada: 'Camada 4', tipo: 'memoria', docId: '1Zzjp9NNhRSKka773EoVj6s9NcrTu2m3XnPL63GLBQcg', arquivo: '_memoria_hefesto.md', dominio: 'Infraestrutura Escolar & Patrimônio' }
    ];
  }

  function getCatalogoCompletoPersonas() {
    if (typeof window !== 'undefined' && window.OLYMPOS_MEMORIAS_CATALOGO) {
      var memorias = window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas().map(function(m) {
        return {
          id: m.slug,
          nome: m.nome || m.deus,
          camada: m.camada,
          tipo: 'memoria',
          docId: m.id,
          url: m.url,
          arquivo: m.arquivo,
          dominio: m.dominio,
          perfilRbac: m.perfilRbac
        };
      });
      var extras = window.OLYMPOS_MEMORIAS_CATALOGO.listarExtras().map(function(ex) {
        return {
          id: ex.slug,
          nome: ex.nome,
          camada: ex.camada,
          tipo: 'anfitriao',
          anfitriao: ex.anfitriao,
          docId: ex.idAnfitriao,
          url: ex.urlAnfitriao,
          arquivo: ex.arquivoAnfitriao,
          dominio: ex.dominio
        };
      });
      return memorias.concat(extras);
    }
    return getCatalogo17Personas();
  }

  return {
    get: get,
    getPersonaSvg: get,
    getForPersona: get,
    ui: ui,
    inline: inline,
    normalizarChave: normalizarChave,
    getCatalogo17Personas: getCatalogo17Personas,
    getCatalogoCompletoPersonas: getCatalogoCompletoPersonas,
    fromEmojiOrKey: fromEmojiOrKey,
    hydrateAll: hydrateAll
  };
})();
