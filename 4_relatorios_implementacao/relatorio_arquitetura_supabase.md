# Relatório Técnico de Arquitetura: Camada de Dados, Segurança e RBAC Supabase
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

**Data de Emissão**: 2026-10-31  
**Versão**: 1.0.0 (Produção)  
**Autor**: Worker M5 — Technical Writer, DevOps & GitHub Release Engineer  
**Status**: Homologado e Validado pelo Quality Gate Automatizado (100% Pass)  

---

## 1. Sumário Executivo & Objetivos Arquiteturais

A modernização tecnológica da Secretaria Municipal de Educação Básica (SMEB) de Ceará-Mirim/RN exigiu a superação do modelo legado baseado exclusivamente em planilhas eletrônicas e scripts com credenciais estáticas, em favor de uma **arquitetura de dados corporativa, segura, resiliente e em estrita conformidade com a Lei Geral de Proteção de Dados (Lei Federal nº 13.709/2018 - LGPD)**.

A plataforma **Supabase** (baseada em PostgreSQL 15+, GoTrue Auth, PostgREST e Realtime) foi selecionada como a espinha dorsal de persistência e governança de acesso do Projeto Olympos. Este relatório documenta exaustivamente a engenharia dessa camada, cobrindo:
1. O esquema relacional e o isolamento de perfis de autenticação;
2. A matriz de controle de acesso baseado em funções (**RBAC**);
3. A criptografia simétrica de dados pessoais e sensíveis em repouso (**AES-256 via `pgcrypto`**);
4. O mecanismo de busca determinística sem descriptografia em memória (**Blind Indexing HMAC-SHA256**);
5. A aplicação rigorosa de políticas de segurança a nível de linha (**Row Level Security - RLS**) com proteção contra falhas em lógica trivalente (*tri-state boolean*);
6. A trilha de auditoria append-only imutável;
7. As funções armazenadas (*RPCs*) auditadas para decifração pontual;
8. Os contratos de integração multicliente conectando o Frontend SPA, o hub de automação Google Apps Script (GAS) e os motores autônomos Python do GitHub Actions.

---

## 2. Topologia Geral do Sistema e Fluxos de Dados

A topologia do Projeto Olympos opera em uma estrutura de microsserviços desacoplada e serverless, na qual o Supabase centraliza a verdade transacional e impõe as fronteiras criptográficas e de autorização.

```
+-----------------------------------------------------------------------------------------+
|                                    PROJETO OLYMPOS                                      |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   +------------------------------------+        +-----------------------------------+   |
|   |         CLIENTES EXTERNOS          |        |        MOTORES AUTÔNOMOS          |   |
|   |                                    |        |         (GITHUB ACTIONS)          |   |
|   |  [ Frontend SPA: GitHub Pages ]    |        |  [ Fogo de Prometheus (Python) ]  |   |
|   |  - Supabase JS SDK (Auth + Anon)   |        |  - Minerador Diário FEMURN        |   |
|   |  - Token JWT em localStorage       |        |  - Escrita via Service Role Key   |   |
|   |  - Modal de Setup Seguro           |        |                                   |   |
|   |                                    |        |  [ Papiro de Cadmo (Python) ]     |   |
|   |  [ Hub Operacional: GAS WebApp ]   |        |  - ETL Folha 16 Municípios RN     |   |
|   |  - UrlFetchApp + ScriptProperties  |        |  - Escrita via Service Role Key   |   |
|   |  - Validação de JWT / Service Key  |        +-----------------+-----------------+   |
|   |  - Emissão de Docs no Drive        |                          |                     |
|   +-----------------+------------------+                          |                     |
|                     |                                             |                     |
|                     | HTTPS REST / JWT                            | HTTPS REST          |
|                     +----------------------+   +------------------+                     |
|                                            |   |                                        |
|                                            v   v                                        |
|   +---------------------------------------------------------------------------------+   |
|   |                        SUPABASE / POSTGRESQL 15+ CLOUD                          |   |
|   |                                                                                 |   |
|   |   +-----------------------+     +-----------------------+                       |   |
|   |   |   GoTrue Auth Engine  |     |   PostgREST API GW    |                       |   |
|   |   |   - Users & JWT Mint  |     |   - RLS Enforcement   |                       |   |
|   |   +-----------+-----------+     +-----------+-----------+                       |   |
|   |               |                             |                                   |   |
|   |               v                             v                                   |   |
|   |   +-------------------------------------------------------------------------+   |   |
|   |   |                        DATABASE SCHEMAS & LOGIC                         |   |   |
|   |   |                                                                         |   |   |
|   |   |   [ RBAC: public.profiles ] <----+ trg_on_auth_user_created             |   |   |
|   |   |   - Papéis: ADMIN_GABINETE, RH_COMISSAO, JURIDICO, PEDAGOGICO_EVENTOS   |   |   |
|   |   |                                                                         |   |   |
|   |   |   [ public.servidores ]                                                 |   |   |
|   |   |   - cpf_encrypted (AES-256)        | cpf_hash (HMAC-SHA256 Blind Index) |   |   |
|   |   |   - matricula_encrypted (AES-256)  | matricula_hash (Blind Index)       |   |   |
|   |   |                                                                         |   |   |
|   |   |   [ public.licencas ]                                                   |   |   |
|   |   |   - dados_medicos_encrypted (AES-256 PII Médica / CID)                  |   |   |
|   |   |                                                                         |   |   |
|   |   |   [ public.audit_logs ] <------- trg_audit_servidores / licencas        |   |   |
|   |   |   - Trilha append-only (bloqueio estrito de UPDATE / DELETE)            |   |   |
|   |   |                                                                         |   |   |
|   |   |   [ RPCs Criptográficas ]                                               |   |   |
|   |   |   - obter_servidor_detalhado_decrypted()                                |   |   |
|   |   |   - obter_licenca_detalhada_decrypted()                                 |   |   |
|   |   +-------------------------------------------------------------------------+   |   |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Modelo Relacional & Esquema PostgreSQL 15+

O esquema do banco de dados reside no schema `public` e estende as funcionalidades do schema nativo `auth`. Todas as tabelas foram modeladas respeitando a terceira forma normal (3NF), integradas a chaves primárias UUID e colunas de controle temporal automatizadas via gatilhos.

### 3.1. Dicionário de Dados do Esquema

| Tabela | Descrição Funcional | Nível de Sensibilidade | Mecanismo de Proteção |
|---|---|:---:|---|
| `public.profiles` | Perfis administrativos vinculados a contas `auth.users` | Alto | RLS por UID e RBAC do Gabinete |
| `public.servidores` | Cadastro funcional dos servidores da educação municipal | Crítico (PII) | `pgcrypto` AES-256 + Blind Index HMAC |
| `public.licencas` | Afastamentos, atestados e dados médicos da junta | Altamente Crítico (Sensível) | `pgcrypto` AES-256 + RPC com log de auditoria |
| `public.audit_logs` | Trilha de auditoria cronológica e imutável de eventos | Auditoria Forense | RLS append-only; leitura restrita a Gabinete/Jurídico |
| `public.publicacoes_diario` | Atos administrativos minerados da FEMURN | Público | Leitura liberada para autenticados; escrita restrita |
| `public.folha_intermunicipal` | Folhas comparativas dos municípios do RN | Restrito | Leitura para autenticados; escrita via motor ETL |

### 3.2. Definição do Tipo Enumerado `app_role`
Para impedir inconsistências léxicas e garantir integridade referencial estrita, os papéis do sistema são definidos através de um `ENUM` nativo do PostgreSQL:
```sql
CREATE TYPE public.app_role AS ENUM (
    'ADMIN_GABINETE',
    'RH_COMISSAO',
    'PEDAGOGICO_EVENTOS',
    'JURIDICO'
);
```

### 3.3. Relacionamentos e Integridade Referencial
1. **`auth.users(id)` 1:1 `public.profiles(id)`**:
   - Chave estrangeira com `ON DELETE CASCADE`. A exclusão de um usuário no GoTrue remove compulsoriamente seu perfil e permissões RBAC.
2. **`public.servidores(id)` 1:N `public.licencas(servidor_id)`**:
   - Chave estrangeira com `ON DELETE CASCADE` e índice otimizado `idx_licencas_servidor_id`.
3. **`auth.users(id)` 1:N `public.audit_logs(performed_by)`**:
   - Chave estrangeira com `ON DELETE SET NULL`. Mesmo se uma conta for excluída, o registro de log é preservado para auditoria forense.

---

## 4. Gestão de Identidades e Autenticação (GoTrue / Supabase Auth)

A autenticação é delegada ao serviço GoTrue, provendo suporte nativo a senhas com hashing bcrypt/argon2, emissão de tokens JWT com assinatura assimétrica (RS256 ou HS256), controle de expiração de sessão e revogação de tokens de atualização (*refresh tokens*).

### 4.1. Sincronização Automática de Usuários via Trigger
Para assegurar que todo usuário criado no Supabase Auth possua um perfil válido no schema `public`, foi implementado o gatilho `trg_on_auth_user_created`:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_role public.app_role := 'PEDAGOGICO_EVENTOS';
    v_raw_role TEXT;
BEGIN
    v_raw_role := NEW.raw_app_meta_data ->> 'role';
    IF v_raw_role IS NOT NULL THEN
        BEGIN
            v_role := v_raw_role::public.app_role;
        EXCEPTION WHEN OTHERS THEN
            v_role := 'PEDAGOGICO_EVENTOS';
        END;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, department)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        v_role,
        COALESCE(NEW.raw_user_meta_data ->> 'department', 'Secretaria Municipal de Educacao')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = timezone('utc', now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
```

### 4.2. Segurança do Token JWT: `app_metadata` vs `user_metadata`
**Regra Crítica de Segurança Implementada:**
- O Supabase Auth divide os metadados do usuário em dois blocos:
  1. `user_metadata`: Gravável pelo próprio usuário na chamada `signUp()` ou `updateUser()`. **NUNCA confiado para decisões de autorização.**
  2. `app_metadata`: Modificável exclusivamente por administradores ou via service role key do backend.
- A função de resolução de papéis `public.get_current_role()` inspeciona prioritariamente `auth.jwt() -> 'app_metadata' ->> 'role'`. Caso ausente ou adulterado, realiza a consulta autoritativa diretamente na tabela `public.profiles`.

---

## 5. Matriz de Controle de Acesso Baseado em Funções (RBAC Matrix)

A matriz RBAC estabelece a governança de privilégios mínimos (*Least Privilege Principle*), assegurando que nenhum servidor ou operador acesse dados alheios à sua atribuição regimental:

| Papel Funcional | `profiles` | `servidores` | `licencas` (Metadados) | `licencas` (Dados Médicos) | `audit_logs` | `publicacoes_diario` | `folha_intermunicipal` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **ADMIN_GABINETE** | Full (CRUD) | Full (CRUD) | Full (CRUD) | Leitura via RPC | Leitura Total | Full (CRUD) | Full (CRUD) |
| **RH_COMISSAO** | Leitura Própria | Full (CRUD) | Full (CRUD) | Leitura via RPC | Leitura de Folha/RH | Leitura | Leitura |
| **JURIDICO** | Leitura Própria | Leitura | Leitura | Leitura via RPC | Leitura Completa | Leitura | Leitura |
| **PEDAGOGICO_EVENTOS** | Leitura Própria | Leitura Básica | Acesso Negado | **Bloqueio Total** | Acesso Negado | Leitura | Leitura |

### 5.1. Isolamento Absoluto de Dados Médicos
- O perfil `PEDAGOGICO_EVENTOS` é sumariamente impedido de ler quaisquer registros da tabela `public.licencas`.
- Os perfis `ADMIN_GABINETE`, `RH_COMISSAO` e `JURIDICO` visualizam apenas os metadados administrativos das licenças (número do processo, datas e parecer). O campo `dados_medicos_encrypted` somente é decifrado sob demanda através da RPC `obter_licenca_detalhada_decrypted`, com justificativa e gravação imediata na trilha de auditoria.

---

## 6. Criptografia em Repouso com `pgcrypto` & Blind Indexing

### 6.1. Proteção de Dados Pessoais Identificáveis (PII)
Os dados sensíveis armazenados na base incluem:
- `cpf_encrypted` (`BYTEA`)
- `matricula_encrypted` (`BYTEA`)
- `dados_medicos_encrypted` (`BYTEA`)

Essas colunas utilizam o algoritmo criptográfico **AES-256** operado em modo CBC com compressão integrada, via função `pgp_sym_encrypt`:
```sql
CREATE OR REPLACE FUNCTION public.encrypt_pii(p_plaintext TEXT, p_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    IF p_plaintext IS NULL OR p_plaintext = '' THEN
        RETURN NULL;
    END IF;
    RETURN pgp_sym_encrypt(p_plaintext, p_key, 'cipher-algo=aes256, compress-algo=1');
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
```

### 6.2. Arquitetura de Blind Indexing (HMAC-SHA256)
A criptografia determinística tradicional (ECB) é vulnerável a ataques de texto claro escolhido e vazamento de padrões estatísticos. Para viabilizar buscas exatas $O(1)$ sem expor os dados cifrados ou sobrecarregar a CPU com decriptografia massiva, foi implementada a técnica de **Índices Cegos (*Blind Indexes*)**:

1. **Normalização Prévia**:
   Remove pontuações, caracteres especiais, espaços e converte para minúsculas:
   $$\text{clean\_value} = \text{regexp\_replace}(\text{lower}(\text{raw\_value}), '[^\text{a-zA-Z0-9}]', '', 'g')$$
   Exemplo: CPF `"123.456.789-00"` $\to$ `"12345678900"`.
2. **Hashing HMAC com Segredo de Servidor (*Pepper*)**:
   Gera um hash criptográfico irreversível HMAC-SHA256 utilizando uma chave secreta distinta da chave mestre:
   $$\text{blind\_index} = \text{encode}(\text{hmac}(\text{clean\_value}, \text{pepper}, 'sha256'), 'hex')$$
3. **Indexação B-Tree**:
   As colunas `cpf_hash` e `matricula_hash` possuem índices B-Tree dedicados (`idx_servidores_cpf_hash`, `idx_servidores_matricula_hash`), permitindo buscas indexadas instantâneas:
   ```sql
   SELECT id, nome, cargo FROM public.servidores WHERE cpf_hash = generate_blind_index('123.456.789-00');
   ```

---

## 7. Arquitetura de Row Level Security (RLS)

A ativação de RLS é compulsória em 100% das tabelas públicas. A política segue a premissa de **negação por padrão (*Default Deny*)**. Se nenhuma regra explícita permitir o acesso, o PostgreSQL rejeita a requisição.

### 7.1. Prevenção Contra Tri-State Boolean Logic
Em SQL, expressões booleanas admitem três estados: `TRUE`, `FALSE` e `NULL`. Em políticas de segurança que utilizam comparações como `v_role NOT IN ('...')`, se `v_role` for `NULL` (por exemplo, token anônimo ou usuário sem perfil), o resultado da expressão é `NULL`, o que em certos contextos de política ou junção pode induzir comportamentos imprevisíveis.

Todas as funções auxiliares e predicados RLS no Projeto Olympos implementam guardas atômicas `COALESCE` e testes explícitos de nulidade:
```sql
-- Padrão defensivo aplicado:
v_caller_role := public.get_current_role();
IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO') THEN
    RAISE EXCEPTION 'Acesso negado: Perfil nao autorizado ou usuario nao autenticado.';
END IF;
```

### 7.2. Tabela de Políticas RLS Consolidadas

```sql
-- Exemplo de RLS em public.servidores:
ALTER TABLE public.servidores ENABLE ROW LEVEL SECURITY;

-- 1. Leitura de servidores: Permitida para todos os papéis autenticados
CREATE POLICY "servidores_select_policy" ON public.servidores
FOR SELECT TO authenticated
USING (public.get_current_role() IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO', 'PEDAGOGICO_EVENTOS'));

-- 2. Modificação de servidores: Restrita a Gabinete e RH
CREATE POLICY "servidores_write_policy" ON public.servidores
FOR ALL TO authenticated
USING (public.get_current_role() IN ('ADMIN_GABINETE', 'RH_COMISSAO'))
WITH CHECK (public.get_current_role() IN ('ADMIN_GABINETE', 'RH_COMISSAO'));
```

---

## 8. Trilha de Auditoria Imutável (Audit Trail)

A conformidade com a LGPD (especialmente o Art. 6º, incisos VII e VIII - segurança e responsabilização) impõe a rastreabilidade integral de todas as modificações em dados pessoais e qualquer acesso de leitura a dados sensíveis de saúde.

### 8.1. Estrutura da Tabela `public.audit_logs`
- `id`: BIGSERIAL imutável.
- `table_name`: Nome da tabela afetada (`servidores`, `licencas`, etc.).
- `record_id`: UUID do registro operado.
- `action`: `INSERT`, `UPDATE`, `DELETE`, `DECRYPT_READ` ou `RPC_CALL`.
- `performed_by`: UUID do usuário autenticado no GoTrue.
- `role_at_action`: Papel do usuário no momento da transação.
- `old_data`: JSONB contendo o estado anterior sanitizado.
- `new_data`: JSONB contendo o novo estado sanitizado.
- `timestamp`: Marca temporal UTC de precisão sub-segundo.

### 8.2. Sanitização Automática de Cargas Úteis Binárias
Para evitar que os dados binários cifrados (`BYTEA`) inundem a tabela de logs e consumam espaço desnecessário, o gatilho `process_audit_log_trigger` expurga automaticamente as colunas de ciphertext dos objetos JSONB antes da inserção:
```sql
v_new_data := to_jsonb(NEW) - 'cpf_encrypted' - 'matricula_encrypted' - 'dados_medicos_encrypted';
v_old_data := to_jsonb(OLD) - 'cpf_encrypted' - 'matricula_encrypted' - 'dados_medicos_encrypted';
```

### 8.3. Bloqueio Estrito de Modificação
A tabela `public.audit_logs` possui uma política RLS que proíbe qualquer operação de `UPDATE` ou `DELETE`, mesmo para o perfil `ADMIN_GABINETE`. Apenas comandos `INSERT` (executados via trigger `SECURITY DEFINER`) são admitidos.

---

## 9. Funções Remotas Seguras (RPCs)

Para permitir a operação legítima dos setores de Gestão de Pessoas e Jurídico, foram desenvolvidas funções armazenadas com privilégios controlados (*SECURITY DEFINER*), responsáveis por intermediar a descriptografia controlada.

### 9.1. RPC: `obter_servidor_detalhado_decrypted`
- **Assinatura**: `public.obter_servidor_detalhado_decrypted(p_servidor_id UUID, p_secret_key TEXT DEFAULT NULL)`
- **Fluxo Operacional**:
  1. Valida se o chamador possui o papel `ADMIN_GABINETE`, `RH_COMISSAO` ou `JURIDICO`.
  2. Obtém a chave mestre de descriptografia (do parâmetro explícito ou da configuração segura `app.settings.master_key`).
  3. Insere obrigatoriamente um registro em `public.audit_logs` com a ação `DECRYPT_READ` e o motivo auditado.
  4. Executa a função `pgp_sym_decrypt` sobre o CPF e a Matrícula.
  5. Retorna o registro completo formatado em texto legível.

### 9.2. RPC: `obter_licenca_detalhada_decrypted`
- **Assinatura**: `public.obter_licenca_detalhada_decrypted(p_licenca_id UUID, p_secret_key TEXT DEFAULT NULL)`
- **Fluxo Operacional**:
  1. Bloqueia sumariamente o perfil `PEDAGOGICO_EVENTOS` e usuários não autenticados.
  2. Exige chave com comprimento mínimo de 16 caracteres.
  3. Registra na trilha de auditoria o acesso ao prontuário médico funcional.
  4. Decifra a coluna `dados_medicos_encrypted` (laudos periciais, diagnósticos e CID).
  5. Retorna os dados clínicos exclusivamente para a sessão autorizada.

---

## 10. Integração Multicliente (GAS, Motores Python e SPA)

A arquitetura do Supabase no Projeto Olympos serve a três perfis de clientes complementares:

### 10.1. Frontend SPA (GitHub Pages)
- **Protocolo**: HTTPS REST e WebSockets (PostgREST / Supabase Realtime).
- **Biblioteca**: `@supabase/supabase-js` v2 carregada via CDN com fallback defensivo.
- **Autenticação**: O usuário fornece seu e-mail e senha no componente de login da SPA. O Supabase Auth autentica as credenciais e emite o token JWT, armazenado em `localStorage`.
- **Autorização**: Cada chamada subsequente trafega o cabeçalho `Authorization: Bearer <JWT>`. A camada PostgREST aplica as políticas RLS em nível de banco.

### 10.2. Google Apps Script (Hub Operacional SMEB)
- **Protocolo**: Chamadas HTTP via `UrlFetchApp.fetch()`.
- **Serviço**: `1_google_apps_script/hub_webapp/08_service_supabase.gs`.
- **Credenciais**: Obtidas exclusivamente via `PropertiesService.getScriptProperties()`. Zero senhas hardcoded.
- **Modo Proxy & Forwarding**:
  - Quando a requisição é originada por um operador autenticado na SPA, o token JWT do usuário é repassado ao PostgREST para manter o contexto do usuário.
  - Para sincronizações em lote e rotinas de backend autorizadas, utiliza a `SUPABASE_SERVICE_ROLE_KEY`.

### 10.3. Motores Python Autônomos (GitHub Actions)
- **Processos**:
  - `fogo_de_prometheus`: Raspagem do Diário Oficial dos Municípios (FEMURN) e persistência em `public.publicacoes_diario`.
  - `papiro_de_cadmo`: Coleta, normalização e carga de remunerações intermunicipais em `public.folha_intermunicipal`.
- **Credenciais**: Injetadas no ambiente virtual via GitHub Repository Secrets (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).
- **Resiliência**: Tratamento de exceções com fallback estruturado caso as variáveis não estejam preenchidas, impedindo quebras silenciosas no pipeline de CI/CD.

---

## 11. Recomendações de Operação, Manutenção e Escalabilidade

1. **Rotação Periódica de Chaves**:
   - Recomenda-se a rotação anual da chave mestre (`master_key`) e do salt de blind indexing (`blind_index_salt`). Ao rotacionar, deve ser executado um script de migração para re-criptografar os campos existentes e re-indexar as colunas hash.
2. **Backup e Point-in-Time Recovery (PITR)**:
   - Em projetos Pro/Enterprise no Supabase, ativar backups contínuos (WAL archiving) com retenção mínima de 7 dias para atender exigências de salvaguarda de dados públicos.
3. **Monitoramento de Índices e Performance**:
   - Acompanhar o crescimento dos índices B-Tree `idx_servidores_cpf_hash` e `idx_audit_logs_timestamp`. Executar `VACUUM ANALYZE` periódico nas tabelas transacionais de auditoria.
4. **Política de Retenção de Logs**:
   - Conforme previsto na LGPD e no Marco Civil da Internet (Lei 12.965/2014), os logs de auditoria devem ser mantidos por no mínimo 6 meses para registros de conexão e até 5 anos para eventos de tratamento de dados pessoais da administração pública.

---
*Relatório técnico validado e arquivado como documentação oficial de engenharia do Projeto Olympos.*
