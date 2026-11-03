# Manual de Configuração e Implantação do Google Apps Script (GAS)
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

**Público-Alvo**: Engenheiros de Automação, Gestores de TI e Administradores do Google Workspace  
**Versão**: 1.0.0  
**Localização do Código**: `Olympos/1_google_apps_script/hub_webapp/`  

---

## 1. Visão Geral

O **Hub Operacional do Google Apps Script (GAS)** é a central integradora que conecta a camada de nuvem do Supabase ao ecossistema institucional do Google Workspace (Google Drive e Google Sheets) da SMEB de Ceará-Mirim/RN.

Suas principais responsabilidades incluem:
1. **Atuar como Gateway REST Seguro**: Receber requisições da interface SPA e dos motores Python validando tokens JWT e o segredo interno `OLYMPOS_SECRET_TOKEN`;
2. **Gerenciar os Modelos e Atos Oficiais no Drive**: Emissão de portarias de licença (`05_module_pincel_homero.gs`), certidões e declarações (`06_module_lira_orfeu.gs`), e numeração sequencial de ofícios (`07_module_olho_apolo.gs`);
3. **Persistência de Memória Multiagente**: Gerenciar a leitura, escrita e o expurgo automático em rolling buffer (60 linhas) dos arquivos `_memoria_<deus>.md` no Drive (`03_service_memorias_md.gs`);
4. **Comunicação Segura com o Supabase**: Executar chamadas HTTP via `UrlFetchApp` consumindo as credenciais isoladas em `PropertiesService` sem jamais expor senhas no código (`08_service_supabase.gs`).

---

## 2. Requisitos Prévios

1. Uma conta institucional do Google com permissão de criação de scripts e acesso à pasta raiz do Projeto Olympos no Google Drive;
2. As credenciais do projeto Supabase obtidas no manual anterior:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Uma string alfanumérica forte para servir como `OLYMPOS_SECRET_TOKEN` (token de autenticação direta entre o robô raspador Python e o Webhook do GAS).

---

## 3. Passo 1: Criação do Projeto no Google Apps Script

1. Acesse o Google Apps Script em: [https://script.google.com/home](https://script.google.com/home).
2. Clique no botão **"Novo projeto"** (ou crie um script vinculado à planilha principal da SMEB via *Extensões > Apps Script*).
3. Renomeie o projeto no canto superior esquerdo para:  
   `Olympos - Hub Operacional WebApp (SMEB)`.

---

## 4. Passo 2: Upload e Sincronização dos Arquivos de Código

No editor do Apps Script, você deverá replicar a estrutura de arquivos da pasta `1_google_apps_script/hub_webapp/`:

### 4.1. Arquivos de Script (.gs)
Para cada arquivo listado abaixo, clique no ícone **"+"** ao lado de "Arquivos", escolha **"Script"**, defina o nome (sem a extensão `.gs`) e cole o código correspondente:
1. `01_router_main` $\to$ Conteúdo de `01_router_main.gs`
2. `02_config_ids` $\to$ Conteúdo de `02_config_ids.gs`
3. `03_service_memorias_md` $\to$ Conteúdo de `03_service_memorias_md.gs`
4. `04_module_prometheus` $\to$ Conteúdo de `04_module_prometheus.gs`
5. `05_module_pincel_homero` $\to$ Conteúdo de `05_module_pincel_homero.gs`
6. `06_module_lira_orfeu` $\to$ Conteúdo de `06_module_lira_orfeu.gs`
7. `07_module_olho_apolo` $\to$ Conteúdo de `07_module_olho_apolo.gs`
8. `08_service_supabase` $\to$ Conteúdo de `08_service_supabase.gs`

### 4.2. Arquivos de Interface HTML (.html)
Clique no ícone **"+"**, escolha **"HTML"**, crie os arquivos e cole seus respectivos códigos:
1. `ui_index` $\to$ Conteúdo de `ui_index.html`
2. `ui_scripts` $\to$ Conteúdo de `ui_scripts.html`
3. `ui_styles` $\to$ Conteúdo de `ui_styles.html`

### 4.3. Configuração do Manifesto de Escopos (`appsscript.json`)
1. No menu lateral esquerdo do Apps Script, clique no ícone de engrenagem **"Configurações do projeto"**.
2. Marque a caixa de seleção: **"Mostrar arquivo de manifesto 'appsscript.json' no editor"**.
3. Retorne ao editor de código, clique sobre o arquivo `appsscript.json` e substitua seu conteúdo pelo arquivo oficial do repositório:
```json
{
  "timeZone": "America/Fortaleza",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.send_mail"
  ]
}
```

---

## 5. Passo 3: Configuração das Propriedades do Script (Script Properties)

**REGRA DE SEGURANÇA MÁXIMA**: Nenhuma chave ou senha deve ser escrita dentro do código `.gs`. Todas as credenciais são injetadas nas propriedades secretas do ambiente.

1. No menu lateral esquerdo, clique no ícone de engrenagem **"Configurações do projeto"**.
2. Role a página até a seção **"Propriedades do script"** (*Script Properties*).
3. Clique no botão **"Editar propriedades do script"** e em seguida em **"Adicionar propriedade do script"** para cadastrar os seguintes pares de Chave / Valor:

| Propriedade (Key) | Valor (Value) | Descrição |
|---|---|---|
| `SUPABASE_URL` | `https://xyzabcdefg.supabase.co` | URL base da sua API Supabase |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Chave pública anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Chave de serviço restrita do Supabase |
| `OLYMPOS_SECRET_TOKEN` | `olympos_token_seguro_2026_xYz9` | Token estático para validar o Webhook do robô Python |
| `GOOGLE_CHAT_WEBHOOK_URL` | *(Opcional)* URL do Google Chat | Webhook para notificações de alertas institucionais |

4. Clique no botão **"Salvar propriedades do script"**.

---

## 6. Passo 4: Implantação do WebApp (Deploy)

Para transformar o script em um endpoint web público acessível pelo Frontend SPA e pelos crons do GitHub Actions:

1. No canto superior direito do editor do Apps Script, clique no botão azul **"Implantar"** (*Deploy*) e selecione **"Nova implantação"** (*New deployment*).
2. Na janela modal, clique no ícone de engrenagem ao lado de "Selecionar tipo" e escolha **"App da Web"** (*Web app*).
3. Preencha as configurações de implantação exatamente como especificado:
   - **Descrição**: `Produção v1.0 - Projeto Olympos`
   - **Executar como** (*Execute as*): **"Eu (seu.email@smeb.cearamirim.rn.gov.br)"** *(Importante: Isto garante que o script acesse o Google Drive institucional com a conta do administrador)*.
   - **Quem pode acessar** (*Who has access*): **"Qualquer pessoa"** (*Anyone*) *(Necessário para que a SPA no GitHub Pages e o GitHub Actions consigam enviar requisições POST para a API)*.
4. Clique no botão **"Implantar"**.

---

## 7. Passo 5: Concessão de Autorização OAuth

No primeiro deploy, o Google solicitará permissões explícitas de acesso:

1. Uma janela modal intitulada **"Autorização necessária"** será exibida. Clique no botão **"Revisar permissões"**.
2. Selecione a sua conta Google institucional.
3. Se o aviso *"O Google não verificou este app"* for exibido (comum para scripts internos municipais):
   - Clique no link **"Avançado"** (*Advanced*) no canto inferior esquerdo.
   - Clique em **"Acessar Olympos - Hub Operacional WebApp (não seguro)"**.
4. Revise os escopos solicitados (Google Drive, Planilhas, Envio de E-mails e Conexões Externas à Internet) e clique em **"Permitir"**.
5. O painel exibirá a **"URL do app da Web"** (terminada em `/exec`).
   - Exemplo: `https://script.google.com/macros/s/AKfycbx.../exec`
   - **Copie e guarde esta URL! Ela será utilizada na configuração da SPA e no GitHub Actions como `GAS_WEBHOOK_URL`.**

---

## 8. Passo 6: Verificação Operacional e Teste de Conexão

Para validar se o backend GAS está funcionando e se comunicando corretamente com o Supabase:

### Teste via Terminal (cURL / PowerShell)
Abra o terminal e execute a chamada de verificação de status:

```bash
curl -X POST "https://script.google.com/macros/s/SUA_URL_DO_GAS_AQUI/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action": "ping", "token": "olympos_token_seguro_2026_xYz9"}'
```

**Resposta esperada (JSON)**:
```json
{
  "status": "success",
  "mensagem": "Hub Operacional Olympos ativo e respondendo.",
  "timestamp": "2026-10-31T22:00:00.000Z",
  "versao": "1.0.0"
}
```

Caso a resposta retorne `"status": "success"`, seu Hub Operacional Google Apps Script está **perfeitamente implantado e pronto para operar em produção!**
