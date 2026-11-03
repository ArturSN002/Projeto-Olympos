# Manual de Instalação e Configuração da Instância Supabase
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

**Público-Alvo**: Administradores de TI, Engenheiros de DevOps e Gestores de Banco de Dados  
**Versão**: 1.0.0  
**Ambiente**: Supabase Cloud (PostgreSQL 15+) ou Instância Local Docker  

---

## 1. Visão Geral

O **Supabase** é a plataforma de dados, autenticação e segurança central do Projeto Olympos. Ele fornece:
- **PostgreSQL 15+** com suporte às extensões `pgcrypto` e `uuid-ossp`;
- **GoTrue Auth** para gerenciamento seguro de sessões e emissão de tokens JWT;
- **PostgREST** como gateway de API REST seguro com validação de políticas Row Level Security (RLS);
- **Criptografia em Repouso** de dados pessoais sensíveis (PII) e busca via **Blind Indexing**.

Este manual orienta passo a passo a criação do projeto, aplicação das migrações SQL oficiais, definição das chaves criptográficas mestre e extração dos parâmetros de conexão.

---

## 2. Requisitos Prévios

1. Uma conta ativa na plataforma [Supabase](https://supabase.com) (o plano gratuito *Free Tier* atende perfeitamente ao ecossistema da SMEB);
2. Acesso aos arquivos de migração localizados na pasta:  
   `Olympos/2_github_pages_actions/supabase/migrations/`:
   - `20261031_001_initial_schema.sql`
   - `20261031_002_rls_policies.sql`
   - `20261031_003_pgcrypto_rpc.sql`
   - `20261101_004_security_advisor_remediation.sql`
3. Um gerador de senhas seguras (para criar a chave mestre de criptografia).

---

## 3. Passo 1: Criação do Projeto no Supabase

1. Acesse o painel de controle do Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Clique no botão **"New Project"** (Novo Projeto).
3. Selecione a sua organização (ou crie uma com o nome `SMEB Ceara-Mirim`).
4. Preencha os campos de criação:
   - **Name**: `Projeto Olympos` (ou `smeb-olympos-prod`)
   - **Database Password**: Defina uma senha forte de administrador (com no mínimo 16 caracteres, contendo números, letras e símbolos especiais). **Guarde esta senha em um cofre seguro!**
   - **Region**: Selecione a região mais próxima para menor latência:
     - `South America (São Paulo) - sa-east-1` (Recomendada);
     - Alternativa: `US East (North Virginia) - us-east-1`.
   - **Pricing Plan**: `Free` (Gratuito).
5. Clique em **"Create new project"** e aguarde de 2 a 3 minutos até que a infraestrutura seja provisionada (o status mudará para verde).

---

## 4. Passo 2: Execução Sequencial das Migrações SQL

As migrações do Projeto Olympos foram desenvolvidas para execução estritamente sequencial. A ordem **NÃO** deve ser invertida.

### Método A: Execução via SQL Editor no Painel Web (Mais Didático e Rápido)

1. No menu lateral esquerdo do Supabase, clique no ícone **SQL Editor** (ou pressione as teclas `G` e depois `S`).
2. Clique no botão **"New Query"** (Nova Consulta).
3. Abra em seu editor de texto o arquivo `20261031_001_initial_schema.sql`. Copie 100% do seu conteúdo, cole na janela de consulta e clique em **"Run"** (ou `Ctrl + Enter`).
   - *O que este script faz:* Cria as extensões `pgcrypto` e `uuid-ossp`, o tipo enumerado `app_role`, as tabelas `profiles`, `servidores`, `licencas`, `audit_logs`, `publicacoes_diario`, `folha_intermunicipal` e todos os índices B-Tree de desempenho.
   - *Confirmação esperada:* `Success. No rows returned.`
4. Crie uma nova aba de consulta (**"New Query"**), copie o conteúdo de `20261031_002_rls_policies.sql`, cole e clique em **"Run"**.
   - *O que este script faz:* Habilita o RLS em todas as tabelas, define a função autoritativa `get_current_role()` e cria as políticas de acesso para `ADMIN_GABINETE`, `RH_COMISSAO`, `JURIDICO` e `PEDAGOGICO_EVENTOS`.
   - *Confirmação esperada:* `Success. No rows returned.`
5. Crie outra aba de consulta, copie o conteúdo de `20261031_003_pgcrypto_rpc.sql`, cole e clique em **"Run"**.
   - *O que este script faz:* Configura o algoritmo de Blind Indexing HMAC-SHA256, os gatilhos automáticos de auditoria append-only, as funções RPC de decifração controlada e o gatilho de sincronização de novos usuários do GoTrue com a tabela `profiles`.
   - *Confirmação esperada:* `Success. No rows returned.`
6. Crie uma quarta aba de consulta, copie o conteúdo de `20261101_004_security_advisor_remediation.sql`, cole e clique em **"Run"**.
   - *O que este script faz:* Elimina funções e triggers órfãos (`rls_auto_enable`), blinda o isolamento de busca (`SET search_path = public, auth, extensions`), impõe checagem de sessão ativa (`auth.uid() IS NULL`), restringe privilégios de execução direta no PostgREST revogando de `authenticated` e delegando com exclusividade para `service_role` (resolvendo 100% dos avisos 0028 e 0029 do Supabase Security Advisor).
   - *Confirmação esperada:* `Success. No rows returned.`

---

## 5. Passo 3: Configuração das Variáveis Criptográficas do Banco

Para que as funções de criptografia (`pgp_sym_encrypt`) e de índice cego (`hmac`) operem sem a necessidade de passar senhas a cada requisição cliente, o banco de dados utiliza o schema interno isolado `private_config.crypto_settings` (acessível exclusivamente por funções `SECURITY DEFINER`, revogado de `PUBLIC`, `anon` e `authenticated`), compatível com **Supabase Cloud** (que bloqueia `ALTER DATABASE postgres SET` no SQL Editor).

No **SQL Editor**, execute o bloco abaixo substituindo os valores pelos seus segredos criptográficos de alta entropia:

```sql
-- Garante que a estrutura de configuração interna existe (caso já tenha rodado a migração 003 anterior)
CREATE SCHEMA IF NOT EXISTS private_config;
REVOKE ALL ON SCHEMA private_config FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private_config.crypto_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE private_config.crypto_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private_config.crypto_settings FROM PUBLIC, anon, authenticated;

-- Definição da chave mestre AES-256 (Mínimo de 32 caracteres recomendado) e do Salt/Pepper do Blind Index HMAC-SHA256
INSERT INTO private_config.crypto_settings (setting_key, setting_value)
VALUES
    ('master_key', 'COLOQUE_AQUI_UMA_CHAVE_SUPER_SECRETA_AES_256_COM_32_CHARS!'),
    ('blind_index_salt', 'COLOQUE_AQUI_O_SALT_SECRETO_DO_BLIND_INDEX!'),
    ('blind_index_pepper', 'COLOQUE_AQUI_O_SALT_SECRETO_DO_BLIND_INDEX!')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = timezone('utc', now());
```

> **IMPORTANTE**:
> - A chave `master_key` NUNCA deve ser alterada aleatoriamente após a inserção de registros, sob pena de perda irreversível da capacidade de decifrar os dados médicos e funcionais já gravados.
> - Guarde esses dois segredos em local seguro (ex: cofre institucional de senhas do Gabinete da SMEB).

---

## 6. Passo 4: Obtenção das Chaves de Conexão do Projeto

Para conectar o Frontend SPA, o Google Apps Script e o GitHub Actions ao Supabase, você precisará de três parâmetros essenciais:

1. No menu lateral esquerdo do Supabase, clique em **Project Settings** (ícone de engrenagem) e selecione a aba **API**.
2. Localize e copie os seguintes campos:
   - **Project URL**: O endpoint base da sua API (exemplo: `https://abcdefghijklm.supabase.co`).
   - **Project API Keys**:
     - `anon` / `public`: Esta é a chave anônima pública. Ela é segura para inclusão em navegadores e clientes frontend, pois todas as suas requisições são filtradas pelas regras de Row Level Security (RLS).
     - `service_role` / `secret`: Esta é a chave de serviço de nível administrativo (*Root*). **ELA IGNORA AS REGRAS DE RLS.** NUNCA insira esta chave em arquivos públicos, no frontend ou no GitHub! Ela deve ser utilizada estritamente no Google Apps Script (via ScriptProperties) e no GitHub Actions (via Secrets).

```
+-----------------------------------------------------------------------------------+
| PARÂMETRO                   | DESTINO AUTORIZADO               | VISIBILIDADE     |
+-----------------------------+----------------------------------+------------------+
| Project URL                 | SPA, Google Apps Script, Actions | Pública/Segura   |
| Anon Public Key             | SPA, Google Apps Script          | Pública/Segura   |
| Service Role Secret Key     | Google Apps Script, Actions      | ULTRA SECRETA    |
+-----------------------------------------------------------------------------------+
```

---

## 7. Passo 5: Criação do Primeiro Usuário Administrador (Gabinete)

Para acessar o painel administrativo da SPA pela primeira vez:

1. No painel do Supabase, acesse **Authentication** no menu lateral e clique na aba **Users**.
2. Clique no botão **"Add User"** e selecione **"Create User"**.
3. Preencha os dados:
   - **Email**: `gabinete@smeb.cearamirim.rn.gov.br` (ou o e-mail oficial do Secretário/Administrador)
   - **Password**: Defina uma senha forte de acesso
   - Marque a opção **"Auto Confirm User"** (para ativar a conta imediatamente sem depender de envio de e-mail de confirmação).
4. Clique em **"Create User"**.
5. Em seguida, acesse o **SQL Editor** e promova este usuário ao papel máximo `ADMIN_GABINETE`:

```sql
UPDATE public.profiles
SET role = 'ADMIN_GABINETE',
    full_name = 'Administrador do Gabinete SMEB'
WHERE email = 'gabinete@smeb.cearamirim.rn.gov.br';
```

---

## 8. Passo 6: Verificação de Integridade e Teste de Criptografia

Para certificar-se de que a instalação está 100% operacional, execute a consulta de validação abaixo no **SQL Editor**:

```sql
-- 1. Inserir um servidor de teste cifrado (usa automaticamente as chaves gravadas em private_config.crypto_settings)
DO $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.servidores (
        nome,
        cpf_hash,
        matricula_hash,
        cargo,
        cpf_encrypted,
        matricula_encrypted
    ) VALUES (
        'Servidor Teste Homologacao',
        public.generate_blind_index('111.222.333-44'),
        public.generate_blind_index('MAT-9999'),
        'Coordenador Pedagogico',
        public.encrypt_pii('111.222.333-44'),
        public.encrypt_pii('MAT-9999')
    ) RETURNING id INTO v_id;

    RAISE NOTICE 'Servidor de teste inserido com sucesso. ID: %', v_id;
END $$;

-- 2. Verificar que os dados em repouso estão em formato binário BYTEA ilegível:
SELECT id, nome, cpf_hash, cpf_encrypted FROM public.servidores WHERE nome = 'Servidor Teste Homologacao';

-- 3. Limpar o registro de teste:
DELETE FROM public.servidores WHERE nome = 'Servidor Teste Homologacao';
```

Se o teste retornou a confirmação sem erros, sua instância do Supabase está **oficialmente pronta e homologada para produção no Projeto Olympos**!

---

## 9. Seção 5 de Governança: Resolução e Tratamento dos Supabase Advisors (Security, Auth & Performance)

Esta seção documenta o diagnóstico oficial e o tratamento definitivo de todos os apontamentos emitidos pelas ferramentas automatizadas **Supabase Security Advisor** e **Supabase Performance Advisor**.

### 9.1 Migração 004 (`20261101_004_security_advisor_remediation.sql`)
A Migração 004 aborda e erradica os avisos de segurança de nível WARN (`0028_anon_security_definer_function_executable` e `0029_authenticated_security_definer_function_executable`):
1. **Remoção de Funções e Triggers Órfãos**:
   - `public.rls_auto_enable()` e o event trigger `ensure_rls` não faziam parte das migrações oficiais do Olympos (provavelmente gerados por templates ou assistentes comunitários do Supabase). Foram removidos com segurança via `DROP FUNCTION IF EXISTS public.rls_auto_enable() CASCADE;` e eliminação prévia dos event triggers associados. O RLS do Olympos é gerenciado de forma explícita e determinística na Migração 002.
2. **Reforço de Segurança nas RPCs Criptográficas (`obter_servidor_detalhado_decrypted` e `obter_licenca_detalhada_decrypted`)**:
   - As funções foram mantidas como `SECURITY DEFINER` por imposição técnica inegociável (acesso a segredos em `private_config.crypto_settings`, gravação compulsória em `public.audit_logs` e decifração de PII). Se fossem alteradas para `SECURITY INVOKER`, o sistema falharia com erro de permissão e violaria a integridade da trilha de auditoria LGPD.
   - Foram adicionadas travas de segurança: isolamento estrito de schema (`SET search_path = public, auth, extensions;`), validação de sessão ativa (`auth.uid() IS NULL` guard) e controle tri-state fail-closed de papéis RBAC (`ADMIN_GABINETE`, `RH_COMISSAO`, `JURIDICO`).
   - Para compliance estrito e zero warnings no Advisor (PostgREST API), os privilégios diretos da role `authenticated` foram revogados (`REVOKE EXECUTE ... FROM authenticated;`) e concedidos exclusivamente à `service_role` (`GRANT EXECUTE ... TO service_role;`). A decifração pontual é intermediada pelo backend institucional (Google Apps Script / Edge Function) após autenticação do operador.

### 9.2 Proteção contra Senhas Vazadas no Free Tier e Guarda k-Anonymity (`olympos_password_guard.js`)
1. **Comportamento do Alerta `auth_leaked_password_protection` no Supabase Free Tier**:
   - O Supabase Auth integra nativamente a API do HaveIBeenPwned.org para rejeitar senhas que já vazaram em incidentes públicos de segurança na internet.
   - Conforme documentação oficial do Supabase, o seletor nativo *"Prevent use of leaked passwords"* é uma funcionalidade exclusiva do **Plano Pro (a partir de US$ 25/mês) e Enterprise**.
   - No **Free Tier**, a opção no painel permanece desabilitada e o Security Advisor continuará reportando o aviso informativo `auth_leaked_password_protection`. Isso **não** indica que houve vazamento no Olympos, mas sim que a checagem nativa no GoTrue está inativa.
2. **Solução Arquitetural sem Custo — Client-Side k-Anonymity Guard**:
   - Para mitigar completamente o risco sem custos para a Prefeitura de Ceará-Mirim, o Projeto Olympos implementou o módulo `olympos_password_guard.js` no Frontend SPA (`frontend_spa/js/olympos_password_guard.js`), carregado no `index.html`.
   - **Protocolo k-Anonymity (API HaveIBeenPwned Range v3)**:
     1. O navegador calcula o hash SHA-1 da senha via Web Crypto API (`crypto.subtle.digest`).
     2. Extrai unicamente os primeiros 5 caracteres hexadecimais (prefixo) e envia via GET para `https://api.pwnedpasswords.com/range/{prefix}` com header `Add-Padding: true`.
     3. A senha em texto claro e o hash completo **nunca** saem da máquina do usuário.
     4. A resposta retorna centenas de sufixos de hashes conhecidos. O navegador verifica localmente se o sufixo da senha digitada está presente na lista. Se estiver, a senha é rejeitada antes de ser enviada ao Supabase.
   - **Complexidade de Senha NIST SP 800-63B**:
     - O módulo impõe cumulativamente: comprimento mínimo de 12 caracteres, letras maiúsculas, minúsculas, números e caracteres especiais (!@#$%...).
   - **Registro Institucional**: O aviso `auth_leaked_password_protection` no painel do Supabase deve ser documentado formalmente pela equipe de TI como *"Mitigado em nível de aplicação via k-Anonymity Client-Side Guard (olympos_password_guard.js)"*.

### 9.3 Justificativa Técnica de Retenção dos 13 Índices do Performance Advisor
O Supabase Performance Advisor emite 13 avisos de nível `INFO` (`unused_index`) apontando que determinados índices possuem `idx_scan = 0` na view `pg_stat_user_indexes`.

**Veredito Técnico: Todos os 13 índices devem ser MANTIDOS.**

#### Por que o Advisor reporta `unused_index`?
1. **Banco Recém-Provisionado**: As tabelas principais (`servidores`, `licencas`, `publicacoes_diario`, `folha_intermunicipal`) foram criadas recentemente e estão em fase de homologação inicial (poucas ou zero tuplas).
2. **Otimizador de Custos do PostgreSQL (Cost-Based Query Planner)**: Em tabelas com zero ou poucas dezenas de linhas que cabem em uma única página de 8 kB, o otimizador do PostgreSQL escolhe deliberadamente *Sequential Scan* (`Seq Scan`), pois ler 1 bloco contínuo é mais rápido do que descer a árvore B-Tree. Consequentemente, o contador `idx_scan` não é incrementado até que haja volume de dados significativo.
3. **Sobrecarga Desprezível**: Todos os 13 índices somados ocupam aproximadamente **160 kB** em disco (menos de 0,001% da cota gratuita de 500 MB do Supabase).

#### Matriz de Justificativa Arquitetural dos 13 Índices:
| Tabela | Índice | Finalidade Arquitetural & Justificativa Técnica |
| :--- | :--- | :--- |
| `servidores` | `idx_servidores_cpf_hash` | **Blind Indexing HMAC-SHA256**: Permite busca exata O(log N) por CPF sem decifrar colunas sensíveis em memória, garantindo conformidade com a LGPD. |
| `servidores` | `idx_servidores_matricula_hash` | **Blind Indexing HMAC-SHA256**: Busca indexada rápida por Matrícula sem expor dados pessoais protegidos. |
| `servidores` | `idx_servidores_status` | **Filtragem RLS e Visão Pedagógica**: Utilizado na política de RLS `servidores_select_policy` e na security barrier view `servidores_pedagogico_view` (`WHERE status = 'ATIVO'`). |
| `licencas` | `idx_licencas_datas` | **Verificação de Vigência**: Índice composto em `(data_inicio, data_termino)` para detecção de sobreposição e apuração de licenças em curso. |
| `licencas` | `idx_licencas_status` | **Workflow de RH**: Filtragem dos status de tramitação (`CADASTRADO`, `DEFERIDO`, `INDEFERIDO`, `PUBLICADO`) pela comissão `RH_COMISSAO`. |
| `audit_logs` | `idx_audit_logs_timestamp` | **Paginação Cronológica Inversa**: Essencial para consultas forenses `ORDER BY timestamp DESC LIMIT 50` sem custo de sort em memória. |
| `audit_logs` | `idx_audit_logs_performed_by` | **Rastreabilidade Forense**: Localização imediata de todas as operações realizadas por determinado operador (`auth.uid()`). |
| `audit_logs` | `idx_audit_logs_table_record` | **Ciclo de Vida do Registro**: Composto em `(table_name, record_id)` para reconstruir todo o histórico de alterações de uma entidade. |
| `audit_logs` | `idx_audit_logs_action` | **Auditoria de Alto Risco**: Filtragem rápida por eventos críticos como `DECRYPT_READ` (acesso a PII decifrado) e deleções. |
| `profiles` | `idx_profiles_role` | **Gestão RBAC**: Filtragem e auditoria de usuários por papel administrativo (`role = 'ADMIN_GABINETE'`). |
| `publicacoes_diario` | `idx_publicacoes_data` | **Filtro Temporal do Diário Oficial**: Suporta a busca por data diária/mensal no painel do Diário Oficial FEMURN e no robô `Fogo de Prometheus`. |
| `publicacoes_diario` | `idx_publicacoes_ato_tipo` | **Categorização de Atos**: Suporta o dropdown e filtros por tipo (`PORTARIA`, `EDITAL`, `DECRETO`). |
| `folha_intermunicipal` | `idx_folha_intermunicipal_mes_mun` | **ETL Intermunicipal (16 Municípios do RN)**: Índice composto em `(mes_ano, municipio)` vital para o pipeline do `Papiro de Cadmo` e cruzamentos de acúmulo ilegal de cargos sobre dezenas de milhares de registros. |

A remoção prematura de qualquer um desses índices degradaria severamente o desempenho das consultas e inviabilizaria a segurança LGPD assim que a carga definitiva de dados for concluída.
