# Manual de Configuração de Segredos no GitHub Actions (Repository Secrets)
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

**Público-Alvo**: Engenheiros de DevOps, Administradores de Infraestrutura e Líderes Técnicos  
**Versão**: 1.0.0  
**Ambiente**: GitHub Actions Secrets  
**Repositório Alvo**: `https://github.com/ArturSN002/Projeto-Olympos`  

---

## 1. Visão Geral

O Projeto Olympos utiliza o **GitHub Actions** para orquestrar rotinas autônomas em nuvem (Serverless Cron Jobs):
1. **O Fogo de Prometheus (`fogo_prometheus_cron.yml`)**: Executa de segunda a sexta-feira às 07:00 BRT, minerando o Diário Oficial dos Municípios do Rio Grande do Norte (FEMURN), realizando extração de entidades nomeadas (NER) e persistindo publicações no Supabase e no Webhook do Google Apps Script.
2. **O Papiro de Cadmo (`papiro_cadmo_cron.yml`)**: Executa mensalmente no dia 12, coletando, normalizando e consolidando as folhas de pagamento de 16 entes municipais e estaduais do RN, salvando no Supabase e espelhando no Google Drive.

Como o repositório é **público**, nenhuma credencial de banco, token de webhook ou chave de serviço pode estar presente nos arquivos de código. As credenciais são gerenciadas exclusivamente através do cofre criptografado de **Repository Secrets** do GitHub.

---

## 2. Catálogo Oficial de Segredos do Projeto

Abaixo estão listados todos os segredos que devem ser cadastrados no repositório GitHub:

| Nome do Segredo (Secret Name) | Descrição e Finalidade | Origem da Informação | Consumido por |
|---|---|---|---|
| `SUPABASE_URL` | Endpoint base da API REST do projeto Supabase | Painel Supabase > Project Settings > API | Prometheus & Cadmo |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço administrativa (*Root / Bypass RLS*) do Supabase | Painel Supabase > Project Settings > API | Prometheus & Cadmo |
| `GAS_WEBHOOK_URL` | URL do endpoint `/exec` do Google Apps Script implantado como WebApp | Painel Apps Script > Implantar > URL do WebApp | Prometheus |
| `OLYMPOS_SECRET_TOKEN` | Token secreto estático compartilhado entre o Python e o GAS | Propriedades do Script GAS (`OLYMPOS_SECRET_TOKEN`) | Prometheus |
| `GOOGLE_CHAT_WEBHOOK_URL` | *(Opcional)* URL de Webhook para alertas no Google Chat da SMEB | Espaço do Google Chat > Configurar Webhook | Prometheus |
| `GCP_SA_KEY` | *(Opcional)* Chave de Conta de Serviço Google Cloud (JSON em Base64) | Console Google Cloud > Contas de Serviço > Chaves | Cadmo (Upload Drive) |

---

## 3. Passo a Passo: Cadastrando os Segredos no GitHub

1. Acesse o repositório oficial no GitHub:  
   `https://github.com/ArturSN002/Projeto-Olympos`
2. No menu superior de abas, clique em **Settings** (Configurações).
3. Na barra lateral esquerda, localize a seção **Security** e clique em **Secrets and variables > Actions**.
4. Certifique-se de que a aba **Secrets** esteja selecionada.
5. Para cada segredo do catálogo:
   - Clique no botão verde **"New repository secret"** (Novo segredo do repositório).
   - No campo **Name**, digite o nome exato do segredo (em letras MAIÚSCULAS, exatamente como na tabela acima).
   - No campo **Secret**, cole o valor correspondente (sem espaços ou quebras de linha acidentais no início ou no fim).
   - Clique no botão verde **"Add secret"**.

```
+-------------------------------------------------------------------------+
| Actions secrets / New secret                                            |
| Name:   SUPABASE_URL                                                    |
| Secret: https://abcdefghijklm.supabase.co                               |
|                                                                         |
| [ Add secret ]                                                          |
+-------------------------------------------------------------------------+
```

---

## 4. Detalhamento e Formatação dos Valores

### 4.1. `SUPABASE_URL`
- **Formato**: `https://<project-ref>.supabase.co`
- **Exemplo**: `https://kndjhskdjfhskjdfh.supabase.co`

### 4.2. `SUPABASE_SERVICE_ROLE_KEY`
- **Formato**: Token JWT longo iniciando em `eyJhbGciOi...`
- **Atenção**: Utilize obrigatoriamente a chave identificada como `service_role` (secret), pois os robôs Python gravam dados diretamente em tabelas com restrições RLS.

### 4.3. `GAS_WEBHOOK_URL`
- **Formato**: `https://script.google.com/macros/s/<ID_DA_IMPLANTACAO>/exec`
- **Atenção**: Certifique-se de que a URL termine rigorosamente em `/exec` (e não em `/dev`).

### 4.4. `OLYMPOS_SECRET_TOKEN`
- **Formato**: String alfanumérica de no mínimo 16 caracteres.
- **Importante**: Deve ser rigorosamente idêntico ao valor configurado na propriedade `OLYMPOS_SECRET_TOKEN` no Google Apps Script.

### 4.5. `GCP_SA_KEY` (Para o motor Papiro de Cadmo)
Caso deseje que o robô faça upload direto para as pastas legadas do Google Drive via Python:
1. Gere a chave privada JSON da sua Conta de Serviço no Google Cloud Console.
2. No terminal (PowerShell), codifique o arquivo em Base64 para evitar quebras de formatação:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service_account.json"))
   ```
3. Cole a string Base64 resultante no valor do segredo `GCP_SA_KEY`.

---

## 5. Salvaguardas de Segurança e Boas Práticas

1. **Mascaramento Automático em Logs**:
   - O GitHub Actions detecta os valores cadastrados como Secrets e substitui compulsoriamente qualquer tentativa de impressão em console por `***`.
2. **Proteção contra Pull Requests Maliciosos**:
   - Por padrão do GitHub, repositórios públicos **NÃO** compartilham Repository Secrets com execuções disparadas por Pull Requests originados de *forks* externos. Isso impede que terceiros enviem código para extrair seus segredos.
3. **Imutabilidade de Leitura**:
   - Após cadastrar um segredo, nem mesmo os administradores do repositório conseguem ler o seu valor novamente pela interface web — apenas atualizá-lo com um novo valor ou excluí-lo.
4. **Política de Rotação Semestral**:
   - Recomenda-se rotacionar o `OLYMPOS_SECRET_TOKEN` e a `SUPABASE_SERVICE_ROLE_KEY` a cada 6 meses, atualizando simultaneamente o GitHub Actions e o Google Apps Script.

---

## 6. Validação e Teste dos Segredos

Para certificar-se de que os segredos foram cadastrados corretamente sem aguardar o horário do cron:

1. No repositório, acesse a aba **Actions**.
2. Clique no fluxo **"Olympos — Fogo de Prometheus (Monitor Diário FEMURN)"**.
3. Clique no botão suspenso **"Run workflow"** e confirme em **"Run workflow"**.
4. Acompanhe a execução do job `monitorar-femurn`.
5. Se a etapa *"4. Coletar FEMURN e Persistir no Supabase e Webhook GAS"* for concluída com sucesso (ícone verde), seus segredos estão **perfeitamente integrados e operacionais!**
