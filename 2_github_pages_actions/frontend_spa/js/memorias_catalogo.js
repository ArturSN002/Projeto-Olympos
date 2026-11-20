/**
 * Hub Olympos V3.1 — Catálogo Canônico Síncrono das 22 Memórias Operacionais (Google Docs)
 * Fornece disponibilidade instantânea offline e online para a SPA.
 * Todas as 22 memórias físicas estão no formato padrão Google Docs (MimeType.GOOGLE_DOCS).
 * Pasta Oficial no Google Drive: 1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu
 */
window.OLYMPOS_MEMORIAS_CATALOGO = (function() {
  'use strict';

  var PASTA_DRIVE_ID = '1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu';
  var PASTA_DRIVE_URL = 'https://drive.google.com/drive/folders/1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu';
  var TOTAL_MEMORIAS_DOCS = 22;

  function docsUrl(id) {
    return 'https://docs.google.com/document/d/' + id + '/edit';
  }

  // 22 Memórias Canônicas Físicas em Formato Padrão Google Docs (MimeType.GOOGLE_DOCS)
  var CANONICAL_MEMORIAS = [
    {
      "slug": "zeus",
      "nome": "Zeus",
      "deus": "Zeus",
      "arquivo": "_memoria_zeus.md",
      "id": "1qi_H4oKokFDEmXiNuGRYsh6kM4YxgJAQuFirDzOVkdM",
      "driveId": "1qi_H4oKokFDEmXiNuGRYsh6kM4YxgJAQuFirDzOVkdM",
      "url": docsUrl("1qi_H4oKokFDEmXiNuGRYsh6kM4YxgJAQuFirDzOVkdM"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 1 — Governança e Roteamento Macro",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Gabinete Executivo, Triagem Macro, Roteamento Zero-Latency e Governança Global",
      "icone": "zeus",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[ZEUS]: Matriz das 22 memórias operacionais conectada em formato Google Docs.",
        "[ ] Supervisionar fluxos intersetoriais (Gabinete, RH, Pedagógico e Jurídico)."
      ],
      "conteudoCompleto": "# Memória Operacional — ZEUS\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [ZEUS]: Matriz das 22 memórias operacionais conectada em formato padrão Google Docs.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs (application/vnd.google-apps.document)\n- Exercicio_Referencia: 2026\n- Roteamento_Personas: 22 Memórias Docs + 4 Anfitriãs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Supervisionar fluxos intersetoriais (Gabinete, RH, Pedagógico e Jurídico).\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória canônica em Google Docs vinculada ao Hub Olympos."
    },
    {
      "slug": "apolo",
      "nome": "Apolo",
      "deus": "Apolo",
      "arquivo": "_memoria_apolo.md",
      "id": "1ZXTlg2Wk5IKZ2Sg84HOnlePCOihccPFcYTd67wHUgkM",
      "driveId": "1ZXTlg2Wk5IKZ2Sg84HOnlePCOihccPFcYTd67wHUgkM",
      "url": docsUrl("1ZXTlg2Wk5IKZ2Sg84HOnlePCOihccPFcYTd67wHUgkM"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Gestão e Expedição de Atos",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Numeração Sequencial de Ofícios e Portarias 2026 (Olho de Apolo)",
      "icone": "apolo",
      "totalLinhas": 28,
      "alertasRecentes": [
        "[OLHO DE APOLO]: Numeração 2026 sincronizada no Google Docs oficial.",
        "[ ] Manter sequência cronológica ininterrupta de Ofícios e Portarias 2026."
      ],
      "conteudoCompleto": "# Memória Operacional — APOLO\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [OLHO DE APOLO]: Numeração oficial 2026 conectada ao Google Docs canônico.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Proximo_Oficio_2026: 155\n- Ultimo_Oficio_2026: 154\n- Proxima_Portaria_2026: 163\n- Ultima_Portaria_2026: 162\n- Proximo_Memorando_2026: 1\n- Proximo_Parecer_Juridico_2026: 1\n- Proximo_Edital_PSS_2026: 1\n- Signatario_Titular_SMEB: Secretário(a) Municipal de Educação Básica\n- Cargo_Signatario_SMEB: Secretário(a) Municipal de Educação Básica\n- Ano_Exercicio_Ativo: 2026\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Manter sequência cronológica ininterrupta de Ofícios e Portarias 2026.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado como fonte de verdade do Olho de Apolo."
    },
    {
      "slug": "hermes",
      "nome": "Hermes",
      "deus": "Hermes",
      "arquivo": "_memoria_hermes.md",
      "id": "1_7WJSZ0D2tbP1sHWH32pjkDZfmcVUBGJXLUtRWMrlEo",
      "driveId": "1_7WJSZ0D2tbP1sHWH32pjkDZfmcVUBGJXLUtRWMrlEo",
      "url": docsUrl("1_7WJSZ0D2tbP1sHWH32pjkDZfmcVUBGJXLUtRWMrlEo"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Logística e Operações de Campo",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Transporte Escolar, Rotas Urbanas/Rurais e Frotas SMEB",
      "icone": "hermes",
      "totalLinhas": 15,
      "alertasRecentes": [
        "Sem novos alertas na caixa de entrada.",
        "[ ] Acompanhar rotas escolares urbanas/rurais e vistorias de frota 2026."
      ],
      "conteudoCompleto": "# Memória Operacional — HERMES\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- Sem novos alertas na caixa de entrada.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Acompanhar rotas escolares urbanas/rurais e vistorias de frota 2026.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "hefesto",
      "nome": "Hefesto",
      "deus": "Hefesto",
      "arquivo": "_memoria_hefesto.md",
      "id": "1Zzjp9NNhRSKka773EoVj6s9NcrTu2m3XnPL63GLBQcg",
      "driveId": "1Zzjp9NNhRSKka773EoVj6s9NcrTu2m3XnPL63GLBQcg",
      "url": docsUrl("1Zzjp9NNhRSKka773EoVj6s9NcrTu2m3XnPL63GLBQcg"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Infraestrutura, Obras e Patrimônio",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Infraestrutura Escolar, Manutenção Predial, Ordens de Serviço e Patrimônio",
      "icone": "hefesto",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[HEFESTO]: Registro de Ordens de Serviço e patrimônio vinculado ao Google Docs.",
        "[ ] Acompanhar demandas de manutenção elétrica/hidráulica Nível 1 e Nível 2."
      ],
      "conteudoCompleto": "# Memória Operacional — HEFESTO\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [HEFESTO]: Registro de Ordens de Serviço e patrimônio conectado ao Google Docs.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n- Normas_Tecnicas: ABNT NBR 5410 e NBR 9050\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Acompanhar demandas de manutenção elétrica/hidráulica Nível 1 e Nível 2.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "demeter",
      "nome": "Deméter",
      "deus": "Deméter",
      "arquivo": "_memoria_demeter.md",
      "id": "1J_xIwY2d027oIXWmHvr1Hm2_W5QVMgu0KhY4OXpgImw",
      "driveId": "1J_xIwY2d027oIXWmHvr1Hm2_W5QVMgu0KhY4OXpgImw",
      "url": docsUrl("1J_xIwY2d027oIXWmHvr1Hm2_W5QVMgu0KhY4OXpgImw"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Suprimentos Nutricionais e PNAE",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Alimentação Escolar, Cardápios PNAE, Estoque e Agricultura Familiar",
      "icone": "demeter",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[DEMÉTER]: Monitoramento nutricional PNAE e estoque escolar ativo em 2026.",
        "[ ] Acompanhar meta mínima de 30% da Agricultura Familiar no PNAE."
      ],
      "conteudoCompleto": "# Memória Operacional — DEMETER\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [DEMÉTER]: Monitoramento nutricional PNAE e estoque escolar ativo em 2026.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n- Programa_Ref: PNAE / FNDE 2026\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Acompanhar meta mínima de 30% da Agricultura Familiar no PNAE.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "poseidon",
      "nome": "Poseidon",
      "deus": "Poseidon",
      "arquivo": "_memoria_poseidon.md",
      "id": "1P6H0MChQZyoHAXxFEhO6W60jYuEac-_VYdD95PTOicw",
      "driveId": "1P6H0MChQZyoHAXxFEhO6W60jYuEac-_VYdD95PTOicw",
      "url": docsUrl("1P6H0MChQZyoHAXxFEhO6W60jYuEac-_VYdD95PTOicw"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Segurança Hídrica e Infraestrutura Sanitária",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Segurança Hídrica, Abastecimento, Cisternas e Saneamento Escolar",
      "icone": "poseidon",
      "totalLinhas": 15,
      "alertasRecentes": [
        "[POSEIDON]: Monitoramento de cisternas e abastecimento de água das escolas.",
        "[ ] Priorizar atendimento hídrico às escolas rurais sem abastecimento regular."
      ],
      "conteudoCompleto": "# Memória Operacional — POSEIDON\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [POSEIDON]: Monitoramento de cisternas e abastecimento de água das escolas.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Priorizar atendimento hídrico às escolas rurais sem abastecimento regular.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "hestia",
      "nome": "Héstia",
      "deus": "Héstia",
      "arquivo": "_memoria_hestia.md",
      "id": "1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q",
      "driveId": "1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q",
      "url": docsUrl("1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 1 — Governança Central e Gabinete",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Governança Central, Recepção, Triagem, LGPD e Selo CNCA 2026",
      "icone": "hestia",
      "totalLinhas": 27,
      "alertasRecentes": [
        "[HÉSTIA]: Pendência crítica ativa – Selo CNCA 2026 (Pasta: CNCA - Selo - Edição 2026): Acompanhar cumprimento dos 16 critérios pendentes.",
        "[ ] CNCA - Rayssa: Critérios 01, 02, 03, 05 e 06"
      ],
      "conteudoCompleto": "# Memória Operacional — HESTIA\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [HÉSTIA]: Pendência crítica ativa – Selo CNCA 2026 (Pasta: CNCA - Selo - Edição 2026): Acompanhar cumprimento dos 16 critérios pendentes.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Atividade_Temporaria: Selo CNCA 2026 (Pasta: CNCA - Selo - Edição 2026) | 9 OK / 16 Pendentes\n- Seguranca_Documental: Conforme LGPD (Lei 13.709/2018) e Proteção de PII\n- Correio_Olimpo: Conectado às 22 Memórias Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] CNCA - Rayssa: Critérios 01, 02, 03, 05 e 06\n- [ ] CNCA - Francisco: Critérios 13, 14 e 19\n- [ ] CNCA - Rosana: Critérios 17, 18 e 19\n- [ ] CNCA - Carlos: Critérios 01 e 07\n- [ ] CNCA - Sara: Critério 04\n- [ ] CNCA - Cristina: Critério 08\n- [ ] CNCA - Elba: Critério 15\n- [ ] CNCA - Veridiana: Critério 21\n- [ ] CNCA - Kivia e Glicelia: Critério 35\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "cronos",
      "nome": "Cronos",
      "deus": "Cronos",
      "arquivo": "_memoria_cronos.md",
      "id": "1g3mqrS_Op1h7ZjO30mzc6pVCioV985Zr4oH1wOd6Wbo",
      "driveId": "1g3mqrS_Op1h7ZjO30mzc6pVCioV985Zr4oH1wOd6Wbo",
      "url": docsUrl("1g3mqrS_Op1h7ZjO30mzc6pVCioV985Zr4oH1wOd6Wbo"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Auditoria Temporal e Continuidade Histórica",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Calendário Escolar (203 dias LDB), Auditoria Temporal e Snapshots",
      "icone": "cronos",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[CRONOS]: Monitoramento contínuo de prazos e 203 dias letivos da rede SMEB.",
        "[ ] Auditar separação documental entre os exercícios 2025 e 2026."
      ],
      "conteudoCompleto": "# Memória Operacional — CRONOS\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [CRONOS]: Monitoramento contínuo de prazos e 203 dias letivos da rede SMEB.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Dias_Letivos_Meta_LDB: 203 dias / 4 bimestres\n- Formato_Memoria: Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Auditar separação documental entre os exercícios 2025 e 2026.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "hera",
      "nome": "Hera",
      "deus": "Hera",
      "arquivo": "_memoria_hera.md",
      "id": "1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4",
      "driveId": "1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4",
      "url": docsUrl("1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Gestão do Quadro de Servidores",
      "perfilRbac": "RH_COMISSAO",
      "dominio": "Recursos Humanos, Lotação, Movimentação Funcional e Permutas",
      "icone": "hera",
      "totalLinhas": 16,
      "alertasRecentes": [
        "Sem novos alertas na caixa de entrada.",
        "[ ] Acompanhar vigência de permutas intermunicipais e frequências mensais."
      ],
      "conteudoCompleto": "# Memória Operacional — HERA\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- Sem novos alertas na caixa de entrada.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Planilha_Permutas: 1fOZHe871yxu6UdF0vsRzjSzQBc7AVFRZZtx3JSCdwCY\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Acompanhar vigência de permutas intermunicipais e frequências mensais.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "ares",
      "nome": "Ares",
      "deus": "Ares",
      "arquivo": "_memoria_ares.md",
      "id": "1gH3XxSOZ_KmAJIxvgfTM04b45YefcK4Y23hWVdOdgOE",
      "driveId": "1gH3XxSOZ_KmAJIxvgfTM04b45YefcK4Y23hWVdOdgOE",
      "url": docsUrl("1gH3XxSOZ_KmAJIxvgfTM04b45YefcK4Y23hWVdOdgOE"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Disciplina Funcional e Resolução de Conflitos",
      "perfilRbac": "RH_COMISSAO",
      "dominio": "Mediação de Conflitos, Relações de Trabalho e Disciplina Funcional",
      "icone": "ares",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[ARES]: Fluxos de sindicância e mediação com rito Lei nº 1.290/1997 ativos.",
        "[ ] Garantir ampla defesa e contraditório nas instruções de RH."
      ],
      "conteudoCompleto": "# Memória Operacional — ARES\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [ARES]: Fluxos de sindicância e mediação com rito Lei nº 1.290/1997 ativos.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Base_Estatutaria: Lei Municipal nº 1.290/1997\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Garantir ampla defesa e contraditório nas instruções de RH.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "afrodite",
      "nome": "Afrodite",
      "deus": "Afrodite",
      "arquivo": "_memoria_afrodite.md",
      "id": "1c-CTMKdpQQ0k1vhSpGL-3ZH9WptM59pUDYt0HYI5SyI",
      "driveId": "1c-CTMKdpQQ0k1vhSpGL-3ZH9WptM59pUDYt0HYI5SyI",
      "url": docsUrl("1c-CTMKdpQQ0k1vhSpGL-3ZH9WptM59pUDYt0HYI5SyI"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Saúde Mental, Clima Escolar e Valorização Humana",
      "perfilRbac": "RH_COMISSAO",
      "dominio": "Saúde Mental, Clima Organizacional e Valorização dos Servidores",
      "icone": "afrodite",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[AFRODITE]: Diretrizes de bem-estar ocupacional e acolhimento SMEB ativas.",
        "[ ] Apoiar ações de clima escolar e valorização do magistério."
      ],
      "conteudoCompleto": "# Memória Operacional — AFRODITE\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [AFRODITE]: Diretrizes de bem-estar ocupacional e acolhimento SMEB ativas.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Conformidade_LGPD: Sigilo ocupacional (LGPD Art. 11)\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Apoiar ações de clima escolar e valorização do magistério.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "atena",
      "nome": "Atena",
      "deus": "Atena",
      "arquivo": "_memoria_atena.md",
      "id": "1L_VJ4xwZIT3KaSOsLnImeORgjmiDjSuBhPavRzh0tHg",
      "driveId": "1L_VJ4xwZIT3KaSOsLnImeORgjmiDjSuBhPavRzh0tHg",
      "url": docsUrl("1L_VJ4xwZIT3KaSOsLnImeORgjmiDjSuBhPavRzh0tHg"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Planejamento Educacional",
      "perfilRbac": "PEDAGOGICO_EVENTOS",
      "dominio": "Coordenação Pedagógica, Formação e Diretrizes BNCC",
      "icone": "atena",
      "totalLinhas": 15,
      "alertasRecentes": [
        "Sem novos alertas na caixa de entrada.",
        "[ ] Acompanhar formações continuadas e metas pedagógicas BNCC 2026."
      ],
      "conteudoCompleto": "# Memória Operacional — ATENA\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- Sem novos alertas na caixa de entrada.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Referencial: BNCC & Currículo Ceará-Mirim/RN\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Acompanhar formações continuadas e metas pedagógicas BNCC 2026.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "dionisio",
      "nome": "Dionísio",
      "deus": "Dionísio",
      "arquivo": "_memoria_dionisio.md",
      "id": "1VJgWX03Z4qpS6jW8Zf-NsektuaEeT2QL2uwjTUajK6E",
      "driveId": "1VJgWX03Z4qpS6jW8Zf-NsektuaEeT2QL2uwjTUajK6E",
      "url": docsUrl("1VJgWX03Z4qpS6jW8Zf-NsektuaEeT2QL2uwjTUajK6E"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Eventos, Cultura e Esporte Escolar",
      "perfilRbac": "PEDAGOGICO_EVENTOS",
      "dominio": "Eventos Culturais, Festividades Escolares, Artes e JEMs",
      "icone": "dionisio",
      "totalLinhas": 15,
      "alertasRecentes": [
        "[DIONÍSIO]: Programação cultural e calendário esportivo escolar ativos.",
        "[ ] Integrar emissão de certificados dos eventos junto à Lira de Orfeu."
      ],
      "conteudoCompleto": "# Memória Operacional — DIONISIO\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [DIONÍSIO]: Programação cultural e calendário esportivo escolar ativos.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Integrar emissão de certificados dos eventos junto à Lira de Orfeu.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "temis",
      "nome": "Têmis",
      "deus": "Têmis",
      "arquivo": "_memoria_temis.md",
      "id": "11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A",
      "driveId": "11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A",
      "url": docsUrl("11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Consultoria Jurídica e Controle de Legalidade",
      "perfilRbac": "JURIDICO",
      "dominio": "Assessoria Jurídica, Pareceres, Legalidade e Prazos MP/TCE",
      "icone": "temis",
      "totalLinhas": 22,
      "alertasRecentes": [
        "[HÉLIO/FEMURN]: Publicado Lei nº 9.394/1996, Lei Federal nº 15.247/2025 (CNCA).",
        "[ ] Avaliar adequação dos procedimentos SMEB à Lei nº 14.133/2021 e Decreto Municipal nº 5143/2026."
      ],
      "conteudoCompleto": "# Memória Operacional — TEMIS\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [2026-10-28] [HÉLIO/FEMURN]: Publicado Lei Federal nº 15.247/2025 (Compromisso Nacional Criança Alfabetizada).\n- [2026-10-23] [HÉLIO/FEMURN]: Publicado DECRETO Nº 5143, DE 21 DE OUTUBRO DE 2026.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Dominio_Atuacao: Assessoria Jurídica, Controle de Legalidade e Prazos MP/TCE\n- Marco_Estatutario: LDB (Lei 9.394/1996), Lei 14.133/2021 (Licitações), Lei 15.247/2025 (CNCA)\n- Template_Parecer: Estrutura Quadripartite (Ementa, Relatório, Fundamentação e Parecer Conclusivo)\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Avaliar adequação dos procedimentos SMEB à Lei Federal nº 15.247/2025 e Decreto Municipal nº 5143/2026.\n- [ ] Revisão de conformidade de termos aditivos e contratos educacionais conforme Lei nº 14.133/2021.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "artemis",
      "nome": "Ártemis",
      "deus": "Ártemis",
      "arquivo": "_memoria_artemis.md",
      "id": "1q3TCb_0CxEGsKINR9oQiFbPA-ugynDqihQaAiyZxNc4",
      "driveId": "1q3TCb_0CxEGsKINR9oQiFbPA-ugynDqihQaAiyZxNc4",
      "url": docsUrl("1q3TCb_0CxEGsKINR9oQiFbPA-ugynDqihQaAiyZxNc4"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Conformidade Regulatória e Auditoria Jurídica",
      "perfilRbac": "JURIDICO",
      "dominio": "Conformidade Regulatória, Auditoria FUNDEB e Prestação de Contas",
      "icone": "artemis",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[ÁRTEMIS]: Trilha de conformidade FUNDEB (Lei 14.113/2020) e TCE/RN ativa.",
        "[ ] Verificar regularidade documental de processos de despesa vinculados."
      ],
      "conteudoCompleto": "# Memória Operacional — ARTEMIS\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [ÁRTEMIS]: Trilha de conformidade FUNDEB (Lei 14.113/2020) e TCE/RN ativa.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Marco_Fiscal: Lei nº 14.113/2020 (Novo FUNDEB)\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Verificar regularidade documental de processos de despesa vinculados.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "hades",
      "nome": "Hades",
      "deus": "Hades",
      "arquivo": "_memoria_hades.md",
      "id": "1hA5GXqIN0M_PTTxTZlZanICSjk7Xjc1_J_WIfP46JA0",
      "driveId": "1hA5GXqIN0M_PTTxTZlZanICSjk7Xjc1_J_WIfP46JA0",
      "url": docsUrl("1hA5GXqIN0M_PTTxTZlZanICSjk7Xjc1_J_WIfP46JA0"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Contencioso Estratégico e Gestão de Riscos Graves",
      "perfilRbac": "JURIDICO",
      "dominio": "Arquivo Histórico Morto, Contencioso Estratégico e Prazos Prescricionais",
      "icone": "hades",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[HADES]: Monitoramento prioritário de intimações e cumprimento de liminares.",
        "[ ] Garantir custódia histórica digital e prazos prescricionais sem decurso."
      ],
      "conteudoCompleto": "# Memória Operacional — HADES\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [HADES]: Monitoramento prioritário de intimações e cumprimento de liminares.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Garantir custódia histórica digital e prazos prescricionais sem decurso.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "prometeu",
      "nome": "Prometeu (Prometheus)",
      "deus": "Prometeu",
      "arquivo": "_memoria_prometeu.md",
      "id": "1Rp10RyJTyt5qxzTNacFv2lQysJAhzS6Cz5PU3Y-Hg4w",
      "driveId": "1Rp10RyJTyt5qxzTNacFv2lQysJAhzS6Cz5PU3Y-Hg4w",
      "url": docsUrl("1Rp10RyJTyt5qxzTNacFv2lQysJAhzS6Cz5PU3Y-Hg4w"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Coleta de Inteligência e Monitoramento Oficial",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Inteligência FEMURN (Fogo de Prometheus), NER e Ingestão Supabase",
      "icone": "prometeu",
      "totalLinhas": 17,
      "alertasRecentes": [
        "[PROMETHEUS]: Coleta automatizada FEMURN ➔ publicacoes_diario e alertas setoriais.",
        "[ ] Sincronizar extrações NER e notificações diárias com Hélio."
      ],
      "conteudoCompleto": "# Memória Operacional — PROMETEU (PROMETHEUS)\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [PROMETHEUS]: Coleta automatizada FEMURN ➔ publicacoes_diario e alertas setoriais.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Motor_Coleta: Fogo de Prometheus (GitHub Actions + GAS Webhook)\n- Tabela_SSOT: publicacoes_diario (Supabase)\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Sincronizar extrações NER e notificações diárias com Hélio.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Memória em Google Docs conectada ao Hub Olympos."
    },
    {
      "slug": "homero",
      "nome": "Homero",
      "deus": "Homero",
      "arquivo": "_memoria_homero.md",
      "id": "1JgCEpBhJC07zjt1TkZvmgzfG00US4FgwwDn-DvgCx8c",
      "driveId": "1JgCEpBhJC07zjt1TkZvmgzfG00US4FgwwDn-DvgCx8c",
      "url": docsUrl("1JgCEpBhJC07zjt1TkZvmgzfG00US4FgwwDn-DvgCx8c"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 3A — Atos Oficiais e Redação Administrativa",
      "perfilRbac": "RH_COMISSAO",
      "dominio": "Redação Oficial, Portarias de Licença, Readaptação e Ofícios (Pincel)",
      "icone": "homero",
      "totalLinhas": 15,
      "alertasRecentes": [
        "Lote concluído (LICENCAS - Premio): portarias processadas no Pincel de Homero.",
        "[ ] Manter conformidade estrita com Manual PR/2018 nos Ofícios e Portarias."
      ],
      "conteudoCompleto": "# Memória Operacional — HOMERO\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [PINCEL DE HOMERO]: Lote recente concluído com modelos oficiais Google Docs.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Manter conformidade estrita com Manual PR/2018 nos Ofícios e Portarias.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "dedalo",
      "nome": "Dédalo",
      "deus": "Dédalo",
      "arquivo": "_memoria_dedalo.md",
      "id": "1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg",
      "driveId": "1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg",
      "url": docsUrl("1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 4 — Arquitetura e Engenharia de Software",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Infraestrutura Técnica, Snapshots Semanais e Integridade do Monorepo",
      "icone": "dedalo",
      "totalLinhas": 16,
      "alertasRecentes": [
        "[DÉDALO]: Catálogo das 22 memórias migrado para Google Docs (DocumentApp).",
        "[ ] Gerar Snapshot semanal consolidado das 22 memórias em 99_Snapshots_Historicos."
      ],
      "conteudoCompleto": "# Memória Operacional — DEDALO\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [DÉDALO]: Catálogo das 22 memórias operacionais migrado para Google Docs.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Total_Memorias_Mapeadas: 22 Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Gerar Snapshot semanal consolidado das 22 memórias no Backup Local.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "orfeu",
      "nome": "Orfeu",
      "deus": "Orfeu",
      "arquivo": "_memoria_orfeu.md",
      "id": "18a_OUyL4tgIN_NkHzStSWOVZS_krGz_B8Z7uVGQfRK8",
      "driveId": "18a_OUyL4tgIN_NkHzStSWOVZS_krGz_B8Z7uVGQfRK8",
      "url": docsUrl("18a_OUyL4tgIN_NkHzStSWOVZS_krGz_B8Z7uVGQfRK8"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 3A — Certificação e Reconhecimento Institucional",
      "perfilRbac": "PEDAGOGICO_EVENTOS",
      "dominio": "Emissão de Certificados, Eventos Culturais e Declarações (A Lira)",
      "icone": "orfeu",
      "totalLinhas": 15,
      "alertasRecentes": [
        "Sem novos alertas na caixa de entrada.",
        "[ ] Monitorar cota diária MailApp e fila de emissão da Lira de Orfeu."
      ],
      "conteudoCompleto": "# Memória Operacional — ORFEU\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- Sem novos alertas na caixa de entrada.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Formato_Memoria: Google Docs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Monitorar cota diária MailApp e fila de emissão da Lira de Orfeu.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "nike",
      "nome": "Niké",
      "deus": "Niké",
      "arquivo": "_memoria_nike.md",
      "id": "18wyqKRmpVpcNgIHPB2Vg-akLWyGBTLvrkEUwz5bWOW4",
      "driveId": "18wyqKRmpVpcNgIHPB2Vg-akLWyGBTLvrkEUwz5bWOW4",
      "url": docsUrl("18wyqKRmpVpcNgIHPB2Vg-akLWyGBTLvrkEUwz5bWOW4"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 2 — Seleção e Provimento de Pessoal",
      "perfilRbac": "RH_COMISSAO",
      "dominio": "Processos Seletivos Simplificados (PSS) e Concursos Públicos",
      "icone": "nike",
      "totalLinhas": 22,
      "alertasRecentes": [
        "[HÉLIO/FEMURN]: Monitoramento de atos e convocações PSS 2026 ativo.",
        "[ ] Acompanhar homologação, prazos recursais e matriz de pontuação PSS 2026."
      ],
      "conteudoCompleto": "# Memória Operacional — NIKE\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [HÉLIO/FEMURN]: Atos e editais PSS 2026 catalogados no Google Docs oficial.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Dominio_Atuacao: Processos Seletivos Simplificados (PSS) e Concursos Públicos\n- Benchmarks_Juridicos: Conformidade com Art. 37, IX da CF/88 e Lei Municipal de Contratação Temporária\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Acompanhar homologação, prazos recursais e convocações PSS 2026.\n- [ ] Aplicar matriz de pontuação e rubricas objetivas de avaliação para o próximo edital PSS 2026.\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    },
    {
      "slug": "helio",
      "nome": "Hélio",
      "deus": "Hélio",
      "arquivo": "_memoria_helio.md",
      "id": "1JUrOsacYDgF5X1H5DUdYXhOalGoUBUPatli8xp39SU8",
      "driveId": "1JUrOsacYDgF5X1H5DUdYXhOalGoUBUPatli8xp39SU8",
      "url": docsUrl("1JUrOsacYDgF5X1H5DUdYXhOalGoUBUPatli8xp39SU8"),
      "formato": "GOOGLE_DOCS",
      "mimeType": "application/vnd.google-apps.document",
      "camada": "Camada 3A — Publicidade Institucional e Vigilância",
      "perfilRbac": "ADMIN_GABINETE",
      "dominio": "Vigilância Diária do Diário Oficial FEMURN e Atos de Ceará-Mirim",
      "icone": "helio",
      "totalLinhas": 24,
      "alertasRecentes": [
        "[HÉLIO/FEMURN]: Varredura diária do Diário Oficial conectada ao Google Docs.",
        "[ ] Monitorar publicações da próxima edição matutina (08:00 BRT) na FEMURN."
      ],
      "conteudoCompleto": "# Memória Operacional — HELIO\nAtualizado em: 2026-11-20 00:30\n\n## 0. Caixa de Entrada (Correio do Olimpo - Recados de Héstia e Hélio)\n- [HÉLIO/FEMURN]: Vigilância diária da FEMURN conectada ao documento Google Docs canônico.\n\n## 1. Estado Atual e Contadores Ativos (2026)\n- Status_Setor: Ativo\n- Cronograma_Varredura: Diário às 08:00 e 16:00 BRT\n- Workflow_Operacional: Coleta diária -> Extração de IDs -> Catalogação Drive -> Notificação de Setores\n- Planilha_Controle_FEMURN: 1tU6rvgB2jNGaGqHK1oecNMQX7-5QcB8Q-1fNgzWcZqs\n\n## 2. Pendências Críticas em Aberto (Máximo 10 itens)\n- [ ] Validar espelho na Planilha de Publicações da FEMURN (1tU6rvgB2jNGaGqHK1oecNMQX7-5QcB8Q-1fNgzWcZqs).\n- [ ] Monitorar publicações da próxima edição matutina (08:00 BRT).\n\n## 3. Histórico Recente — Rolling Log (Últimos 5 registros)\n- [2026-11-20 00:30] Documento Google Docs conectado ao Hub Olympos."
    }
  ];

  // Personas com Roteamento Anfitrião (4 especialistas stateless hospedados em Google Docs anfitriões)
  var HOST_PERSONAS = [
    {
      "nome": "Cadmo",
      "slug": "cadmo",
      "camada": "Camada 3B",
      "dominio": "Localizador Cadastral & O Papiro de Cadmo (16 Entes RN)",
      "anfitriao": "Hera",
      "arquivoAnfitriao": "_memoria_hera.md",
      "idAnfitriao": "1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4",
      "urlAnfitriao": docsUrl("1x3TO_H3TXbnjFqsTq3rEyOXL0cbeQmD5n_nu0GD44G4"),
      "icone": "cadmo"
    },
    {
      "nome": "Arquimedes",
      "slug": "arquimedes",
      "camada": "Camada 4",
      "dominio": "Ciência de Dados Educacionais, Censo e Indicadores",
      "anfitriao": "Dédalo",
      "arquivoAnfitriao": "_memoria_dedalo.md",
      "idAnfitriao": "1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg",
      "urlAnfitriao": docsUrl("1odtXhXWeio4g7UY3Sis-sMGZoDLr1BwJwffJ2SNAGdg"),
      "icone": "arquimedes"
    },
    {
      "nome": "Íris",
      "slug": "iris",
      "camada": "Camada 3B",
      "dominio": "Comunicação Ágil, Avisos Setoriais e Notificações",
      "anfitriao": "Héstia",
      "arquivoAnfitriao": "_memoria_hestia.md",
      "idAnfitriao": "1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q",
      "urlAnfitriao": docsUrl("1gj0U051uTCjl3oh_X_kqnxtVQQHae0nvlFa62c2N91Q"),
      "icone": "iris"
    },
    {
      "nome": "Sólon",
      "slug": "solon",
      "camada": "Camada 3B",
      "dominio": "Técnica Legislativa e Constitucionalidade Municipal",
      "anfitriao": "Têmis",
      "arquivoAnfitriao": "_memoria_temis.md",
      "idAnfitriao": "11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A",
      "urlAnfitriao": docsUrl("11Veph2HxedUA6O0NoMMzB87C1X1lGAexyt8pmZRdx2A"),
      "icone": "solon"
    }
  ];

  function normalizar(texto) {
    if (!texto) return '';
    return String(texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizarChaveAlias(texto) {
    var n = normalizar(texto);
    if (n === 'prometheus' || n === '_memoria_prometheus' || n === '_memoria_prometheus.md' || n === 'prometeu (prometheus)') {
      return n.replace('prometheus', 'prometeu');
    }
    return n;
  }

  function obterChaveStorage(arquivo) {
    return 'olympos_memoria_' + normalizar(arquivo).replace(/[^a-z0-9_]/g, '_');
  }

  function obterConteudoLocal(arquivo) {
    try {
      if (typeof localStorage === 'undefined') return null;
      var chave = obterChaveStorage(arquivo);
      return localStorage.getItem(chave);
    } catch (e) {
      return null;
    }
  }

  function salvarLocal(arquivo, conteudo) {
    try {
      if (typeof localStorage === 'undefined') return false;
      var chave = obterChaveStorage(arquivo);
      localStorage.setItem(chave, conteudo);
      localStorage.setItem(chave + '_updated_at', new Date().toISOString());
      localStorage.setItem(chave + '_pending_sync', 'true');
      return true;
    } catch (e) {
      console.warn('Erro ao salvar localmente no localStorage:', e);
      return false;
    }
  }

  function removerEdicaoLocal(arquivo) {
    try {
      if (typeof localStorage === 'undefined') return false;
      var chave = obterChaveStorage(arquivo);
      localStorage.removeItem(chave + '_pending_sync');
      return true;
    } catch (e) {
      return false;
    }
  }

  function temEdicaoLocalPendente(arquivo) {
    try {
      if (typeof localStorage === 'undefined') return false;
      var chave = obterChaveStorage(arquivo);
      return localStorage.getItem(chave + '_pending_sync') === 'true';
    } catch (e) {
      return false;
    }
  }

  function listarTodas() {
    return CANONICAL_MEMORIAS.map(function(m) {
      var local = obterConteudoLocal(m.arquivo);
      var conteudo = (local !== null && local !== undefined) ? local : m.conteudoCompleto;
      var linhas = conteudo ? conteudo.split('\n').length : 0;
      var pendente = temEdicaoLocalPendente(m.arquivo);

      return Object.assign({}, m, {
        conteudoCompleto: conteudo,
        totalLinhas: linhas,
        edicaoPendente: pendente
      });
    });
  }

  function listarExtras() {
    return HOST_PERSONAS.slice();
  }

  function obterPorId(docId) {
    if (!docId) return null;
    var alvo = String(docId).trim();
    var todas = listarTodas();
    for (var i = 0; i < todas.length; i++) {
      if (todas[i].id === alvo || todas[i].driveId === alvo) {
        return todas[i];
      }
    }
    return null;
  }

  function obterPorArquivo(arquivo) {
    if (!arquivo) return null;
    var porId = obterPorId(arquivo);
    if (porId) return porId;

    var norm = normalizarChaveAlias(arquivo);
    var normSemMd = norm.replace(/^_+memoria_+/, '').replace(/\.md$/i, '');
    var todas = listarTodas();

    // 1. Busca direta nas 22 memórias canônicas
    for (var i = 0; i < todas.length; i++) {
      var m = todas[i];
      if (
        normalizar(m.arquivo) === norm ||
        normalizar(m.slug) === norm ||
        normalizar(m.slug) === normSemMd ||
        normalizar(m.nome) === norm ||
        normalizar(m.deus) === norm
      ) {
        return m;
      }
    }

    // 2. Busca entre as 4 personas anfitriãs
    for (var j = 0; j < HOST_PERSONAS.length; j++) {
      var h = HOST_PERSONAS[j];
      if (normalizar(h.slug) === norm || normalizar(h.slug) === normSemMd || normalizar(h.nome) === norm) {
        return obterPorArquivo(h.arquivoAnfitriao);
      }
    }

    return null;
  }

  function obterPorSlug(slug) {
    return obterPorArquivo(slug);
  }

  function obterPorNome(nome) {
    return obterPorArquivo(nome);
  }

  function getUrlGoogleDocs(slugOuArquivoOuId) {
    var m = obterPorArquivo(slugOuArquivoOuId);
    if (m && m.id) return docsUrl(m.id);
    return PASTA_DRIVE_URL;
  }

  function getMapaIdsDrive() {
    var mapa = {};
    for (var i = 0; i < CANONICAL_MEMORIAS.length; i++) {
      mapa[CANONICAL_MEMORIAS[i].slug] = CANONICAL_MEMORIAS[i].id;
    }
    mapa.prometheus = DOCS_IDS_MAP_PROMETHEUS();
    return mapa;
  }

  function DOCS_IDS_MAP_PROMETHEUS() {
    return '1Rp10RyJTyt5qxzTNacFv2lQysJAhzS6Cz5PU3Y-Hg4w';
  }

  return {
    PASTA_DRIVE_ID: PASTA_DRIVE_ID,
    PASTA_DRIVE_URL: PASTA_DRIVE_URL,
    TOTAL_MEMORIAS_DOCS: TOTAL_MEMORIAS_DOCS,
    MEMORIAS: CANONICAL_MEMORIAS,
    EXTRAS: HOST_PERSONAS,
    listarTodas: listarTodas,
    listarExtras: listarExtras,
    obterPorId: obterPorId,
    obterPorArquivo: obterPorArquivo,
    obterPorSlug: obterPorSlug,
    obterPorNome: obterPorNome,
    getUrlGoogleDocs: getUrlGoogleDocs,
    salvarLocal: salvarLocal,
    obterConteudoLocal: obterConteudoLocal,
    removerEdicaoLocal: removerEdicaoLocal,
    temEdicaoLocalPendente: temEdicaoLocalPendente,
    getMapaIdsDrive: getMapaIdsDrive
  };
})();

// Alias para facilitar interoperabilidade em diferentes camadas
window.OlymposMemoriasCatalogo = window.OLYMPOS_MEMORIAS_CATALOGO;
