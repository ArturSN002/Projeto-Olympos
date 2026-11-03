# Manual de Implantação — Fogo de Prometheus (GitHub Actions + Google Apps Script + Google Chat)

> [!IMPORTANT]
> O **Fogo de Prometheus** opera em arquitetura híbrida: um coletor automatizado em **Python + Playwright + Tesseract OCR** executando gratuitamente no **GitHub Actions** (de segunda a sexta às `07:00 BRT`) e um receptor **Google Apps Script (GAS)** que arquiva os PDFs no Google Drive, indexa servidores/matrículas na planilha `Diario_Oficial_SMEB_2026`, atualiza as memórias `_memoria_<deus>.md` e envia o resumo executivo ao **Espaço do Google Chat da SMEB**.

---

## 1. Arquitetura e Fluxo de Execução

1. **GitHub Actions Cron (`0 10 * * 1-5` = `07:00 BRT`):** Inicia uma máquina virtual Ubuntu com Python 3.11, Chromium Headless e Tesseract OCR (`por`).
2. **Coletor `src/scraper_femurn.py`:**
   - **Ciclo 1:** Prefeitura Municipal de Ceará-Mirim -> Secretaria Municipal de Educação Básica (coleta 100% dos atos).
   - **Ciclo 2:** Prefeitura Municipal de Ceará-Mirim -> Gabinete do Prefeito (filtra atos com palavras-chave da Educação/SMEB).
   - **Ciclo 3:** Câmara Municipal de Ceará-Mirim (filtra atos legislativos ligados à Educação/SMEB).
   - Aplica fallback de extração de texto via `pypdf` e `pytesseract` (OCR) para tabelas escaneadas e extrai entidades estruturadas (NER: Nº do Ato, Nomes de Servidores e Matrículas).
3. **Disparo Seguro em Lotes (`MAX_PDFS_POR_LOTE_WEBHOOK = 10`):** Envia os PDFs em Base64 e metadados para o endpoint `doPost` do Google Apps Script autenticando com `OLYMPOS_SECRET_TOKEN`.
4. **Receptor GAS (`04_module_prometheus.gs` ou `gas_receiver/prometheus_webhook.gs`):**
   - Salva os PDFs nas pastas oficiais de 2026 (`Portarias 2026`, `Gabinete 2026` ou `Assessoria Jurídica 2026`).
   - Registra os dados extraídos via NER na planilha-índice `Diario_Oficial_SMEB_2026`.
   - Atualiza `_memoria_helio.md` e despacha alertas setoriais para `_memoria_hera.md`, `_memoria_nike.md` e `_memoria_temis.md`.
   - Envia o **Resumo Executivo (`cardsV2`)** para o **Espaço do Google Chat da SMEB**.

---

## 2. Passo 1 — Configurar o Espaço do Google Chat (Institucional ou Conta Pessoal `@gmail.com`)

> [!WARNING]
> **Importante sobre Contas Pessoais (`@gmail.com`):**
> O Google oculta a opção **"Apps e integrações -> Webhooks"** em Espaços criados por contas gratuitas `@gmail.com`. Para usar seu **e-mail particular neste primeiro momento**, escolha um dos dois caminhos abaixo:

- **Caminho A (Espaço criado por conta Workspace convidando seu `@gmail.com`):** Crie o Espaço em qualquer conta Google Workspace marcando *"Permitir a participação de pessoas de fora da organização"*, gere a URL do Webhook por ela e adicione seu `@gmail.com` particular como membro do Espaço. Você receberá todos os cartões no app do Google Chat da sua conta pessoal.
- **Caminho B (100% Conta `@gmail.com` Particular — Modo Híbrido já integrado):** Nas Propriedades do Script do GAS (`Script Properties`), basta preencher o seu endereço `seu.email@gmail.com` em `EMAIL_RESUMO_PARTICULAR` (ou diretamente no próprio campo `GOOGLE_CHAT_WEBHOOK_URL`). O código detecta automaticamente que é um e-mail particular e envia o **Card Executivo em HTML** (com badges, servidores/matrículas NER e botões **📄 Abrir PDF no Google Drive ➔**) direto para o seu Gmail!

### Passo a Passo para Gerar a URL do Webhook (Contas Workspace)
1. Abra o [Google Chat](https://chat.google.com/).
2. Acesse o **Espaço** onde os resumos do Diário Oficial devem ser publicados.
3. Clique na seta ao lado do **nome do Espaço** no topo da tela e selecione **Apps e integrações** (*Apps & integrations*).
4. Na seção **Webhooks**, clique em **+ Adicionar webhooks** (*Add webhooks*).
5. Preencha:
   - **Nome:** `Fogo de Prometheus (FEMURN)`
6. Clique em **Salvar**, abra o menu de três pontos (`⋮`) do webhook criado e clique em **Copiar link**.
7. Guarde essa URL (`GOOGLE_CHAT_WEBHOOK_URL`).

---

## 3. Passo 2 — Implantar nas 2 Frentes Unificadas do Hub Olympos (Recomendado)

> [!TIP]
> **Arquitetura Unificada em 2 Frentes (Sem Duplicidade):**
> - **Frente 1 — GitHub (Monorepo Olympos):** Hospeda simultaneamente o **Frontend Estático (GitHub Pages)** e os motores pesados em Python/Playwright via **GitHub Actions** (`.github/workflows/fogo_prometheus_cron.yml` e `.github/workflows/papiro_cadmo_mensal.yml`), compartilhando um único cofre de `Secrets` (`GAS_WEBHOOK_URL`, `OLYMPOS_SECRET_TOKEN`, `GCP_SA_KEY`).
> - **Frente 2 — Google Apps Script (`hub-olympos-webapp/`):** Um **único projeto GAS** atua como Gateway de API do Hub e Receptor Oficial do Fogo de Prometheus (`01_router_main.gs` + `04_module_prometheus.gs`), garantindo `LockService` compartilhado sobre `_memoria_helio.md` e gravação exclusiva na planilha fixa `1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY`. O antigo receptor isolado `gas_receiver/prometheus_webhook.gs` foi descontinuado para eliminar concorrência e manutenção dupla.

### Implantação do Gateway Único no Google Apps Script
1. Acesse a pasta **Automações** no Google Drive (`ID: 1gd5oe_lZELzk5gNredslf8MeR-rOxEI1`).
2. Abra (ou crie) o projeto único `Hub Olympos SMEB 2026`.
3. Copie todos os arquivos da pasta `hub-olympos-webapp/` (`appsscript.json`, `01_router_main.gs` a `07_module_olho_apolo.gs`, e os 3 arquivos `.html`).

### Configurar Propriedades do Script (`Script Properties`)
1. No editor do GAS, abra **Configurações do Projeto** (⚙️) -> **Propriedades do script** -> **Adicionar propriedade do script**:
   - `OLYMPOS_SECRET_TOKEN`: defina um token forte aleatório (gerado via OpenSSL ou gerador de senhas seguras).
   - `GOOGLE_CHAT_WEBHOOK_URL`: cole a URL do Webhook do Espaço do Google Chat obtida no Passo 1 (ou e-mail em `EMAIL_RESUMO_PARTICULAR`).
   - *(Opcional — Disparo 1-Clique pelo Hub)* `GITHUB_REPO` (`usuario/repositorio-olympos`) e `GITHUB_PAT` (Personal Access Token com permissão `actions:write`) para acionar coletas sob demanda diretamente pela interface web do Hub.
2. Clique em **Salvar propriedades do script**.

### Publicar como App da Web (`Web App`)
1. No canto superior direito do GAS, clique em **Implantar** -> **Nova implantação**.
2. Escolha o tipo **App da Web**:
   - **Executar como:** `Eu`
   - **Quem pode acessar:** `Qualquer pessoa` (*Anyone*)
3. Autorize os escopos solicitados e copie a **URL do app da Web** (terminada em `/exec`). Esta será a variável `GAS_WEBHOOK_URL`.

---

## 4. Passo 3 — Configurar o Repositório no GitHub e Secrets

1. Suba o conteúdo desta pasta (`fogo-de-prometheus/`) para um repositório no GitHub:
   ```powershell
   git init
   git branch -M main
   git add .
   git commit -m "feat: implantacao Fogo de Prometheus SMEB 2026"
   git remote add origin https://github.com/SEU_USUARIO/fogo-de-prometheus.git
   git push -u origin main
   ```
2. No GitHub, acesse **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret** e crie:
   - `GAS_WEBHOOK_URL`: URL `/exec` gerada no Google Apps Script.
   - `OLYMPOS_SECRET_TOKEN`: O mesmo token definido nas Propriedades do Script do GAS.
   - `GOOGLE_CHAT_WEBHOOK_URL` *(Opcional no GitHub se já configurado no GAS)*: Deixe configurado apenas no GAS caso deseje receber apenas 1 card consolidado já com os links do Google Drive; ou configure também no GitHub caso deseje notificação direta da VM.

---

## 5. Passo 4 — Como Testar

1. No repositório do GitHub, abra a aba **Actions** -> **Olympos - Fogo de Prometheus (Monitor FEMURN)**.
2. Clique em **Run workflow**:
   - Deixe os campos de data vazios para buscar a edição do dia atual, ou preencha `Data Inicial` e `Data Final` (`DD/MM/AAAA`) para testar uma data anterior.
3. Verifique:
   - Os PDFs salvos nas pastas de 2026 no Google Drive;
   - As linhas adicionadas na planilha `Diario_Oficial_SMEB_2026` (na pasta `Portarias 2026`);
   - O registro em `_memoria_helio.md`;
   - O card de resumo publicado no **Espaço do Google Chat**.
