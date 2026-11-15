# Hub Olympos V3.0 🏛️

**Plataforma Integrada de Gestão Educacional, Automação Serverless e Inteligência de Dados Públicos**  
*Secretaria Municipal de Educação Básica (SMEB) — Ceará-Mirim / RN*

---

## 1. Visão Geral da Evolução V3.0

O **Hub Olympos V3.0** representa o salto arquitetural definitivo para a infraestrutura de tecnologia e dados da Secretaria Municipal de Educação Básica de Ceará-Mirim/RN. A versão 3.0 consolida a unificação de processos administrativos, modernização da experiência do usuário, aceleração de consultas e governança estrita de dados públicos:

- **Fonte Única da Verdade (SSOT) no Supabase:** Eliminação da dependência de leituras síncronas lentas de planilhas em disco/Drive, promovendo o Supabase PostgreSQL como repositório primário de alta performance (~45ms de latência para matérias do Diário Oficial).
- **Gestão Operacional de Chamados & Pendências:** Sistema inteligente de chamados integrado ao Google Forms/Sheets (`1okAey-W8s1fFJ23t-FlmSaRSvWqNUJWze8tCYS17UNE`) com motor matemático de SLA útil (08h00–15h00, seg–sex, 420 min/dia, 90 min/tarefa) e auto-promoção de urgência por SLA de 24 horas.
- **Evolução dos Certificados Lira de Orfeu:** Criação dinâmica de abas de eventos, novos campos opcionais de Carga Horária Cumprida e Nota Obtida (com assinatura criptográfica ECDSA P-256 e QR code de verificação) e desmembramento estrito dos 3 gatilhos operacionais (Higienizar, Gerar PDFs e Enviar E-mails).
- **Frontend SPA de Alta Performance:** Reestruturação modular com TypeScript + Vite + Preact Signals (~1,6 kB) e Design System 60-30-10 inspirado no Google DeepMind (*Obsidian Void* `#0B0D12` e *Scientific Daylight* `#F8F9FA`).
- **Governança Estrita & Eliminação de Código Legado:** Exclusão física definitiva dos módulos standalone obsoletos (`modulos_standalone/`) e proteção permanente via `.gitignore`.

---

## 2. Camadas da Arquitetura V3.0

A topologia do Hub Olympos V3.0 está estruturada em cinco camadas complementares de alta disponibilidade:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Camada de Apresentação (Frontend SPA)                 │
│      TypeScript + Vite + Preact Signals (~1,6 kB) | Design 60-30-10     │
│   Obsidian Dark / Scientific Light | Hero Editorial | #inspectorWidget │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
                    │ HTTPS REST (~45ms)             │ Simple Requests (CORS)
                    ▼                                ▼
┌───────────────────────────────────┐    ┌───────────────────────────────┐
│     Camada de Dados & SSOT        │    │ Camada de Negócios & Automação│
│       (Supabase PostgreSQL)       │    │     (Google Apps Script)      │
│  - public.publicacoes_diario      │    │  - 00_main.gs / 01_router     │
│  - public.pendencias_chamados     │    │  - 04_module_prometheus.gs    │
│  - vw_pendencias_chamados_ativas  │    │  - 06_module_lira_orfeu.gs    │
│  - RLS Pública e Índices B-Tree   │    │  - 07_module_pendencias.gs    │
└───────────────────▲───────────────┘    └───────────────▲───────────────┘
                    │                                    │
                    │ Batch UPSERT (PostgREST)           │ onFormSubmit / Triggers
                    │                                    │
┌───────────────────┴───────────────┐    ┌───────────────┴───────────────┐
│     Camada de Coleta & ETL        │    │    Planilha Oficial Forms     │
│     (Python Scraper FEMURN)       │    │ (Chamados SMEB 1okAey-W8s...) │
│  - scraper_femurn.py              │    │  - Fila de 90 min/tarefa      │
│  - Pipeline GitHub Actions Cron   │    │  - E-mail com SLA de recepção │
└───────────────────────────────────┘    └───────────────────────────────┘
```

### 2.1. Camada de Apresentação (Frontend SPA)
Localizada em `2_github_pages_actions/frontend_spa/`:
- **Stack Tecnológico:** TypeScript compilado via Vite + Preact Signals para reatividade atômica e determinística nos filtros de busca e fila de chamados.
- **Design System 60-30-10:**
  * **60% Base Dominante:** *Obsidian Void* (`#0B0D12`) no modo escuro e *Scientific Daylight* (`#F8F9FA`) no modo claro.
  * **30% Superfícies & Tipografia:** Cartões de superfície (`#131720` / `#FFFFFF`), bordas hairline (`#1F2533` / `#DADCE0`) e tipografia legível (Inter, JetBrains Mono e Plus Jakarta Sans).
  * **10% Foco & Destaque:** Acentos vibrantes em Azul Elétrico (`#4E8DF5` / `#1A73E8`) e gradientes suaves Aurora (`#8AB4F8` a `#A78BFA`).
- **Componentes de Assinatura Visual:**
  * `.glass-nav`: Barra de navegação flutuante estilo pílula com vidro translúcido (`backdrop-filter: blur(16px)`).
  * **Hero Editorial Assimétrica:** Eyebrow Pill com ping pulsante, Headline com gradiente dinâmico `.aurora-text`, ações em pílula dupla e Faixa de Telemetria Científica em 3 colunas.
  * `.spotlight-card`: Cartões interativos com iluminação radial sensível ao cursor (`--mouse-x`, `--mouse-y`).
  * `#inspectorWidget`: Widget flutuante de inspeção e alternância de temas 60-30-10 no canto inferior direito.
  * Curvas de aceleração DeepMind: `--ease-deepmind: cubic-bezier(0.16, 1, 0.3, 1)`.

### 2.2. Camada de Dados & SSOT (Supabase PostgreSQL)
Localizada em `2_github_pages_actions/supabase/migrations/`:
- **`public.publicacoes_diario` (`20261115_013_publicacoes_diario_ssot_v3.sql`):**
  * Tabela consolidada com colunas dedicadas para `codigo_femurn`, `orgao`, `numero_ato`, `matriculas`, `url_drive` e `url_planilha_backup`.
  * Índice exclusivo `uq_publicacoes_diario_codigo_femurn` garantindo idempotência estrita via PostgREST.
  * Leitura pública via Row Level Security (RLS) concedida para as roles `anon` e `authenticated`, permitindo carregamento sub-50ms no frontend SPA sem intermediações desnecessárias.
- **`public.pendencias_chamados` (`20261115_014_create_pendencias_chamados_table.sql`):**
  * Central estruturada para gestão de chamados do Google Forms com colunas de protocolo, solicitante, setor, prioridade de urgência, dia sugerido, SLA estimado e timestamps operacionais.
  * View dinâmica `vw_pendencias_chamados_ativas`: aplica em tempo real a regra de auto-promoção de urgência para chamados pendentes não lidos há mais de 24 horas.

### 2.3. Camada de Negócios & Automação Serverless (Google Apps Script)
Localizada em `1_google_apps_script/hub_webapp/`:
- **`00_main.gs` e `01_router_main.gs`:** Núcleo de orquestração do WebApp unificado atendendo requisições HTTP POST e GET via CORS Simple Requests sem pre-flight OPTIONS.
- **`04_module_prometheus.gs`:** Leitura desacoplada de dados do Diário Oficial; o método `carregarPainelPrometheus` elimina a leitura em loop síncrono de planilhas via Drive, delegando consultas diretamente à SSOT do Supabase e mantendo a planilha Google oficial (`1tU6rvgB...`) como espelho assíncrono.
- **`06_module_lira_orfeu.gs`:**
  * Criação dinâmica de abas de eventos preenchendo metadados padronizados no intervalo `A2:H2`.
  * Suporte aos novos campos opcionais de "Carga Horária Cumprida" e "Nota Obtida" no payload de emissão e QR Code criptográfico.
  * **Três gatilhos desmembrados:**
    1. `certificados_higienizar`: padroniza nomes, formata e-mails e remove duplicatas.
    2. `certificados_gerar_pdfs`: compila os certificados em PDF na pasta do Google Drive (estritamente sem disparar e-mails).
    3. `certificados_enviar_emails`: despacha as mensagens personalizadas com PDFs anexos controlando cotas diárias (estritamente sem regenerar arquivos).
- **`07_module_pendencias_chamados.gs`:**
  * Motor matemático de SLA: calcula de forma exata a data/hora projetada de atendimento com base no expediente útil (08h00 às 15h00, seg–sex, 420 min/dia) e na cadência de 90 minutos por tarefa pendente na fila.
  * Gatilho `onFormSubmitChamado`: registra a pendência no Supabase e despacha e-mail imediato ao solicitante informando o prazo previsto de resposta. Conforme requisito de privacidade e redução de ruído, **não há envio de e-mail ao finalizar a pendência**.

### 2.4. Camada de Coleta & Inteligência (Python Scraper)
Localizada em `2_github_pages_actions/engines/fogo_de_prometheus/src/scraper_femurn.py`:
- Coleta diária automatizada de atos da SMEB no Diário Oficial dos Municípios do RN (FEMURN) via GitHub Actions.
- Rotina atômica de persistência com batch UPSERT no PostgREST (`?on_conflict=codigo_femurn` com cabeçalho `Prefer: resolution=merge-duplicates,return=representation`).

### 2.5. Pipeline de Espelhos & Sincronização
- Script canônico `sync_mirrors.py` na raiz do monorepo: sincroniza as alterações entre a árvore interna e os repositórios-espelho `hub-olympos-frontend` (GitHub Pages) e `hub-olympos-webapp` (Google Apps Script).

---

## 3. Estrutura Canônica do Monorepo

```text
Olympos/
├── .github/
│   └── workflows/
│       ├── deploy_pages.yml              # Build e deploy do Frontend SPA no GitHub Pages
│       ├── fogo_prometheus_cron.yml      # Coleta automatizada do Diário Oficial FEMURN
│       └── papiro_cadmo_cron.yml         # Coleta mensal de portais da transparência
├── 1_google_apps_script/
│   └── hub_webapp/                       # Backend unificado do Google Apps Script
│       ├── 00_main.gs                    # Entrypoint e utilitários globais
│       ├── 01_router_main.gs             # Roteador de ações e serviços
│       ├── 02_config_ids.gs              # Identificadores canônicos de pastas e planilhas
│       ├── 04_module_prometheus.gs       # Módulo Diário Oficial desacoplado
│       ├── 05_module_pincel_homero.gs    # Módulo Licenças e Readaptações
│       ├── 06_module_lira_orfeu.gs       # Módulo Certificados e Declarações (3 gatilhos)
│       └── 07_module_pendencias_chamados.gs # Motor de SLA e Fila de Chamados
├── 2_github_pages_actions/
│   ├── frontend_spa/                     # Interface Web responsiva (TS + Vite + Signals)
│   │   ├── index.html                    # Layout 60-30-10 com Hero e Inspetor
│   │   ├── styles.css                    # Variáveis de tema e utilitários de animação
│   │   ├── package.json                  # Dependências e scripts de build
│   │   ├── vite.config.ts                # Configuração do bundler Vite
│   │   ├── css/                          # Folhas de estilo modulares
│   │   └── js/                           # Controladores, rotas e views SPA
│   │       ├── api.js                    # Cliente de comunicação com Apps Script
│   │       ├── supabase_client.js        # Cliente REST leve do Supabase
│   │       └── views/
│   │           ├── visaoGeral.js         # Visão geral e telemetria editorial
│   │           ├── diarioOficial.js      # Consulta com latência ~45ms via Supabase
│   │           ├── certificados.js       # Gestão Lira com 3 gatilhos e abas
│   │           └── chamados.js           # Fila de pendências e SLA em tempo real
│   ├── supabase/
│   │   └── migrations/                   # Scripts DDL canônicos do Supabase
│   │       ├── 20261115_013_publicacoes_diario_ssot_v3.sql
│   │       └── 20261115_014_create_pendencias_chamados_table.sql
│   └── engines/                          # Motores de coleta Python
│       ├── fogo_de_prometheus/           # Coletor FEMURN com batch UPSERT
│       └── papiro_de_cadmo/              # Coletor de portais da transparência
├── tests/                                # Suíte central de testes automatizados
│   ├── run_all_tests.py                  # Orquestrador com 13 módulos e 160+ testes
│   ├── test_js_syntax.py                 # Validação V8 e ausência de credenciais
│   ├── test_security_scanner.py          # Auditoria de segredos e PII
│   ├── test_canonical_ids_and_cors.py    # IDs oficiais e ausência de OPTIONS
│   └── ...
├── sync_mirrors.py                       # Propagação atômica para espelhos
├── .gitignore                            # Bloqueio permanente de módulos obsoletos
└── README.md                             # Documentação oficial de arquitetura e governança
```

---

## 4. Governança e Depreciação de Módulos Standalone

Como parte da simplificação da V3.0, os módulos standalone legados que existiam isoladamente foram **definitivamente descontinuados e excluídos fisicamente do repositório**:

- **Diretório Removido:** `Olympos/1_google_apps_script/modulos_standalone/`
  * Subpastas expurgadas: `declaracoes_lira/`, `licencas_pincel/`, `readaptacoes_pincel/` (27 arquivos, ~3.643 linhas de código duplicado).
- **Diretórios Espelho Soltos Removidos:** Pastas `Declarações/`, `Licenças/` e `Readaptações/` no nível raiz de trabalho.
- **Bloqueio Permanente no `.gitignore`:**
  ```gitignore
  # Modulos Standalone Obsoletos (Substituidos pelo hub_webapp e SPA V3)
  **/modulos_standalone/
  1_google_apps_script/modulos_standalone/
  Declarações/
  Licenças/
  Readaptações/
  ```

Toda a lógica desses módulos legados está 100% incorporada e otimizada no WebApp unificado (`hub_webapp/`) e na interface SPA.

---

## 5. Bateria de Testes Automatizados & Quality Gate

A integridade do Hub Olympos é garantida por uma bateria de testes automatizados de ponta a ponta:

```bash
# Execução da suíte completa de testes
python Olympos/tests/run_all_tests.py
```

### Critérios de Aceite do Quality Gate:
- **100% de Aprovação:** Zero falhas e zero erros tolerados nos 13 módulos de verificação.
- **Auditoria Estática de Segurança:** Varredura em 100% dos arquivos do repositório contra exposição acidental de chaves privadas, tokens de API, senhas em texto puro e CPFs válidos desmascarados.
- **Validação de Sintaxe V8:** Checagem de conformidade de todos os scripts JavaScript e Google Apps Script via `node vm.Script`.
- **Conformidade de CORS & Simple Requests:** Assertiva de comunicação direta sem disparo do método HTTP `OPTIONS`.

---

## 6. Segurança, Privacidade e Conformidade com a LGPD

- **Zero Credenciais no Código-Fonte:** Nenhuma chave de API privada, token de service role, senha de banco de dados ou credencial de serviço é armazenada no versionamento. Variáveis confidenciais são injetadas estritamente em tempo de execução via **GitHub Secrets** ou no ambiente de execução do **Google Apps Script ScriptProperties**.
- **Princípio do Menor Privilégio (PoLP):** O acesso público da SPA às publicações e chamados utiliza a chave pública anônima do Supabase, com operações restritas pelas políticas de Row Level Security (RLS).
- **Privacidade Operacional de E-mails:** Em total observância aos requisitos do projeto, e-mails automáticos são restritos exclusivamente ao envio de SLA na criação do chamado, prevenindo spam e ruído operacional no encerramento de tarefas.
