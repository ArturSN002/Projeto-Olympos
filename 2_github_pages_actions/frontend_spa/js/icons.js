/**
 * Hub Olympos — Biblioteca de Ícones Vetoriais (SVG Puro)
 * Identidade Visual Grego-Romana & Governança Executiva (Traço Fino 1.75px, 24x24)
 */
window.OlymposIcons = (function() {
  var icons = {
    olymposLogo: '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10L14 3l11 7"/><path d="M5 10h18"/><path d="M4 24h20"/><path d="M6 21h16"/><path d="M7 10v11"/><path d="M11.5 10v11"/><path d="M16.5 10v11"/><path d="M21 10v11"/></svg>',
    laurelCrown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4.5-1.5-7.5-5.5-7.5-10.5C4.5 6.5 7 3.5 9.5 2"/><path d="M12 21c4.5-1.5 7.5-5.5 7.5-10.5 0-4-2.5-7-5-8.5"/><path d="M10 22l2-2 2 2"/><path d="M4.8 11c2-.5 3.5.5 4.2 2"/><path d="M5.5 7c2 0 3.5 1 4 2.5"/><path d="M6.5 15c2-.5 3.8 0 4.5 1.5"/><path d="M19.2 11c-2-.5-3.5.5-4.2 2"/><path d="M18.5 7c-2 0-3.5 1-4 2.5"/><path d="M17.5 15c-2-.5-3.8 0-4.5 1.5"/></svg>',
    eyeOfApollo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>',
    lyreOfOrpheus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3c-1.5 3-1.5 7 1 10.5C8.5 15.5 10 17 12 17s3.5-1.5 5-3.5C19.5 10 19.5 6 18 3"/><path d="M5 6h14"/><path d="M8 17v4"/><path d="M16 17v4"/><path d="M6 21h12"/><path d="M10 6v11"/><path d="M12 6v11"/><path d="M14 6v11"/></svg>',
    fireOfPrometheus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/><path d="M7 21h10"/></svg>',
    papyrusOfCadmus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M15 8h-5"/><path d="M15 12h-5"/></svg>',
    owlOfAthena: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l2 2h8l2-2"/><path d="M5 6c-1 2.5-1 6 0 9 1.2 3.5 4 6 7 6s5.8-2.5 7-6c1-3 1-6.5 0-9"/><circle cx="9.5" cy="10.5" r="2"/><circle cx="14.5" cy="10.5" r="2"/><path d="M12 12.5l-1 2h2l-1-2Z"/><path d="M9 17c1.5 1 4.5 1 6 0"/></svg>',
    wingsOfHermes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M12 8C9 5 4 5 2 8c2 1 4 1 6 0"/><path d="M12 8c3-3 8-3 10 0-2 1-4 1-6 0"/><path d="M8 13c2-2 6-2 8 0s2 5 0 7"/><path d="M16 13c-2-2-6-2-8 0s-2 5 0 7"/><circle cx="12" cy="3" r="1.5"/></svg>',
    shieldOfThemis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 11h8"/><path d="M8 11l-1.5 3h3L8 11z"/><path d="M16 11l-1.5 3h3L16 11z"/></svg>',
    anvilOfHephaestus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10H3l4-4h13v4c0 2.5-2.5 4-5 4h-3v4h4l2 3H6l2-3h3v-4H9c-1.5 0-2-1.5-2-4z"/></svg>',
    searchLens: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    settingsGear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    boltZeus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    sunLight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moonDark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    folderDrive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    copyClip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    refreshSync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
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
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
  };

  var personaToIconKey = {
    apolo: 'eyeOfApollo',
    orfeu: 'lyreOfOrpheus',
    prometheus: 'fireOfPrometheus',
    cadmo: 'papyrusOfCadmus',
    atena: 'owlOfAthena',
    hermes: 'wingsOfHermes',
    temis: 'shieldOfThemis',
    hefesto: 'anvilOfHephaestus',
    zeus: 'boltZeus',
    hera: 'laurelCrown',
    hestia: 'fireOfPrometheus',
    mnemosine: 'papyrusOfCadmus',
    argos: 'eyeOfApollo',
    iris: 'wingsOfHermes',
    quiron: 'owlOfAthena',
    clio: 'papyrusOfCadmus',
    dice: 'shieldOfThemis'
  };

  var emojiToIconKey = {
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
    'ℹ️': 'eyeOfApollo',
    '🔄': 'refreshSync',
    '🔒': 'lock',
    '✉️': 'mail',
    '📧': 'mail'
  };

  var categoryToIconKey = {
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

  function get(name) {
    return icons[name] || icons.olymposLogo;
  }

  function getForPersona(id) {
    var key = personaToIconKey[id] || 'olymposLogo';
    return get(key);
  }

  /**
   * Converte qualquer emoji ou chave de categoria em um SVG inline vetorial
   */
  function fromEmojiOrKey(rawIconOrEmoji, categoryFallback) {
    if (rawIconOrEmoji && icons[rawIconOrEmoji]) {
      return '<span class="svg-icon-inline" aria-hidden="true">' + icons[rawIconOrEmoji] + '</span>';
    }
    var trimmed = String(rawIconOrEmoji || '').trim();
    if (trimmed && emojiToIconKey[trimmed]) {
      return '<span class="svg-icon-inline" aria-hidden="true">' + get(emojiToIconKey[trimmed]) + '</span>';
    }
    if (categoryFallback && categoryToIconKey[categoryFallback]) {
      return '<span class="svg-icon-inline" aria-hidden="true">' + get(categoryToIconKey[categoryFallback]) + '</span>';
    }
    return '<span class="svg-icon-inline" aria-hidden="true">' + get('calendar') + '</span>';
  }

  function hydrateAll() {
    var nodes = document.querySelectorAll('[data-icon]');
    nodes.forEach(function(el) {
      var name = el.getAttribute('data-icon');
      if (icons[name]) {
        el.innerHTML = icons[name];
      }
    });
  }

  return {
    get: get,
    getForPersona: getForPersona,
    fromEmojiOrKey: fromEmojiOrKey,
    hydrateAll: hydrateAll
  };
})();
