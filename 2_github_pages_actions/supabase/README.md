# Arquitetura de Banco de Dados, Segurança e Criptografia Supabase — Projeto Olympos

Este diretório contém a infraestrutura de dados, segurança em nível de linha (RLS), criptografia de dados sensíveis (LGPD) e trilha de auditoria do **Projeto Olympos** para a Secretaria Municipal de Educação de Bom Jesus (SMEB).

---

## 1. Visão Geral da Arquitetura

O Projeto Olympos adota o **PostgreSQL 15+ gerenciado via Supabase** como camada primária de dados estruturados, controle de acesso e segurança, garantindo:
1. **Erradicação Total de Credenciais Hardcoded**: Acesso via Supabase Auth (GoTrue), com hash criptográfico de senhas (Argon2/bcrypt) e tokens JWT assinados.
2. **Controle de Acesso Baseado em Funções (RBAC)**: Quatro perfis de acesso estritos definidos no enum `app_role` (`ADMIN_GABINETE`, `RH_COMISSAO`, `PEDAGOGICO_EVENTOS`, `JURIDICO`).
3. **Criptografia em Repouso com `pgcrypto` (LGPD)**: Proteção de dados pessoais identificáveis (PII) e dados sensíveis de saúde (CPF, Matrícula e laudos/CID de licenças médicas) cifrados em colunas `BYTEA` via algoritmo simétrico AES-256.
4. **Blind Indexing (Índice Cego HMAC-SHA256)**: Possibilita consultas performáticas de tempo constante $O(1)$ por CPF ou Matrícula sem necessidade de descriptografar a base em memória.
5. **Trilha de Auditoria Imutável (`audit_logs`)**: Registro automatizado via triggers de todas as operações de mutação (`INSERT`, `UPDATE`, `DELETE`) e RPC auditado de decriptografia (`DECRYPT_READ`).

---

## 2. Dicionário de Dados e Estrutura de Tabelas

### 2.1 Enum `public.app_role`
Define os quatro níveis de privilégio operacional do sistema:
- `ADMIN_GABINETE`: Acesso irrestrito a configurações, perfis de usuários, cadastros, licenças, publicações e trilha de auditoria.
- `RH_COMISSAO`: Gestão completa de servidores municipais, comissões e licenças/afastamentos.
- `PEDAGOGICO_EVENTOS`: Acesso de leitura a servidores ativos na rede de ensino (sem acesso a dados pessoais ou licenças).
- `JURIDICO`: Acesso de consulta a processos, atos, licenças e logs forenses para emissão de pareceres e conformidade legal.

### 2.2 Tabelas Principais

| Tabela | Chave Primária | Finalidade | Proteção RLS / Criptografia |
| :--- | :--- | :--- | :--- |
| `public.profiles` | `id UUID` (FK `auth.users`) | Dados cadastrais e perfil funcional dos usuários | RLS: Leitura do próprio perfil; Gabinete gerencia todos. |
| `public.servidores` | `id UUID` | Cadastro de servidores públicos municipais | RLS por perfil; `cpf_encrypted` e `matricula_encrypted` (AES-256); `cpf_hash` e `matricula_hash` (HMAC). |
| `public.licencas` | `id UUID` | Afastamentos, licenças-prêmio e perícias médicas | RLS por perfil; `dados_medicos_encrypted` (AES-256); Bloqueio total a `PEDAGOGICO_EVENTOS`. |
| `public.audit_logs` | `id BIGSERIAL` | Registro cronológico imutável de mutações e decifrações | RLS: Imutável (sem UPDATE/DELETE); Leitura apenas Gabinete e Jurídico; Escrita restrita a triggers/RPCs. |
| `public.publicacoes_diario` | `id UUID` | Publicações mineradas do Diário Oficial (FEMURN) | RLS: Leitura pública autenticada; Escrita reservada a Admin e Service Role. |
| `public.folha_intermunicipal`| `id UUID` | Análise comparativa salarial entre municípios potiguares | RLS: Leitura pública autenticada; Ingestão via Service Role. |

---

## 3. Matriz de Permissões RLS (Row Level Security)

Todas as tabelas possuem `ROW LEVEL SECURITY` estritamente ativado (`ENABLE ROW LEVEL SECURITY`). O modo `FORCE` foi deliberadamente removido para permitir que funções `SECURITY DEFINER` e gatilhos do sistema (como `handle_new_user` e `process_audit_log_trigger`) executem com privilégios do proprietário do banco sem serem bloqueados por políticas de RLS, ao mesmo tempo em que conexões de usuários (`authenticated` e `anon`) permanecem sob isolamento rígido.

A matriz a seguir detalha o comportamento das políticas:

```
+------------------------+----------------+-------------+--------------------+----------+
| Entidade / Operação    | ADMIN_GABINETE | RH_COMISSAO | PEDAGOGICO_EVENTOS | JURIDICO |
+------------------------+----------------+-------------+--------------------+----------+
| profiles (SELECT)      | Todos          | Próprio     | Próprio            | Próprio  |
| profiles (UPDATE)      | Todos          | Próprio*    | Próprio*           | Próprio* |
| servidores (ALL)       | Total          | Total       | Bloqueado          | Bloqueado|
| servidores (SELECT)    | Total          | Total       | Bloqueado na base**| Total    |
| licencas (ALL)         | Total          | Total       | Bloqueado          | Bloqueado|
| licencas (SELECT)      | Total          | Total       | Bloqueado          | Total    |
| audit_logs (SELECT)    | Total          | Bloqueado   | Bloqueado          | Total    |
| audit_logs (MODIFICAÇÃO)| BLOQUEADO PARA TODOS OS USUÁRIOS (IMUTÁVEL / SEM TRUNCATE)  |
| publicacoes (SELECT)   | Total          | Total       | Total              | Total    |
| folha_interm. (SELECT) | Total          | Total       | Total              | Total    |
+------------------------+----------------+-------------+--------------------+----------+
* Usuários autenticados podem atualizar dados cadastrais de perfil próprio, mas a alteração da coluna role é bloqueada compulsoriamente por trigger (restrita a ADMIN_GABINETE).
** O perfil PEDAGOGICO_EVENTOS acessa servidores exclusivamente via servidores_pedagogico_view (que expõe apenas id, nome, cargo, funcao, lotacao, status, omitindo colunas PII e blind indexes).
```

---

## 4. Engenharia Criptográfica & Blind Indexing

### 4.1 Criptografia Não-Determinística (AES-256)
- **Função de Cifragem**: `public.encrypt_pii(p_plaintext TEXT, p_key TEXT) RETURNS BYTEA`
- **Algoritmo**: `pgp_sym_encrypt(plaintext, key, 'cipher-algo=aes256, compress-algo=1')`
- **Volatilidade**: Marcada como `VOLATILE` no PostgreSQL. Cada execução gera um vetor de inicialização (IV) e salt aleatórios. Desta forma, dois CPFs idênticos produzem sequências de bytes distintas, mitigando ataques de análise de frequência em repouso e evitando *constant folding* indevido pelo otimizador de consultas.

### 4.2 Blind Indexing Determinístico (HMAC-SHA256)
- **Função**: `public.generate_blind_index(raw_value TEXT, pepper TEXT) RETURNS TEXT`
- **Mecanismo**: Remove pontuações, caracteres especiais e espaços (`regexp_replace(..., '[^a-zA-Z0-9]', '', 'g')`), converte para minúsculas e aplica HMAC-SHA256 com o pepper/salt do sistema.
- **Fail-Closed Sem Segredos Hardcoded**: Se o pepper/salt não for fornecido e as configurações de banco (`app.settings.blind_index_salt` ou `app.settings.blind_index_pepper`) estiverem vazias, a função dispara imediatamente uma exceção (`RAISE EXCEPTION`), impedindo o uso de valores de contingência públicos ou vulneráveis a ataques de dicionário.
- **Vantagem Operacional**: Permite que consultas de busca exata ocorram diretamente pelo índice B-tree (`WHERE cpf_hash = public.generate_blind_index('123.456.789-00')`), sem decifrar registros em memória ou sobrecarregar a CPU.

### 4.3 Configuração de Chaves em Repositórios Públicos
Como o Projeto Olympos é publicado em repositório público no GitHub, **nenhuma chave mestra ou pepper/salt deve ser incluída nos scripts commitados**.

A configuração em produção é efetuada no banco de dados através de:
```sql
-- Configurar segredos de runtime diretamente no SQL Editor do Supabase (fora do Git):
ALTER DATABASE postgres SET "app.settings.master_key" = 'CHAVE_MESTRA_AES256_COM_MAIS_DE_32_CARACTERES';
ALTER DATABASE postgres SET "app.settings.blind_index_salt" = 'PEPPER_SECRETO_HMAC_COM_MAIS_DE_32_CARACTERES';
ALTER DATABASE postgres SET "app.settings.blind_index_pepper" = 'PEPPER_SECRETO_HMAC_COM_MAIS_DE_32_CARACTERES';
```

---

## 5. RPCs com Auditoria Compulsória (LGPD Compliance)

Para cumprir os Artigos 6º e 11 da LGPD, a descriptografia de dados confidenciais de servidores e laudos médicos não é exposta por `SELECT *`. Em vez disso, utiliza-se RPC com registro compulsório em `audit_logs`:

### 5.1 Proteções de Segurança das RPCs
1. **Lógica Tri-State Segura**: Verificação explícita `IF v_caller_role IS NULL OR v_caller_role NOT IN (...) THEN RAISE EXCEPTION ...`. Isso impede que usuários sem sessão ou papéis nulos contornem o controle de acesso devido ao comportamento tri-valorado (`UNKNOWN`) do SQL.
2. **Resolução de Chave no Servidor**: O parâmetro `p_secret_key` possui default `NULL`. Quando omitido ou vazio, a RPC busca `current_setting('app.settings.master_key', true)`, evitando o trânsito da chave mestra pelo frontend ou pela rede.
3. **Privilégios Mínimos de Execução**: Permissão `EXECUTE` revogada para `PUBLIC` e `anon`, sendo concedida estritamente a `authenticated`.

### 5.2 RPC `public.obter_servidor_detalhado_decrypted`
```sql
-- Invocação autenticada com chave recuperada do servidor:
SELECT * FROM public.obter_servidor_detalhado_decrypted(
    p_servidor_id := '10000000-0000-0000-0000-000000000001'
);
```
**Fluxo de Execução:**
1. Valida se o usuário autenticado (`public.get_current_role()`) pertence a `ADMIN_GABINETE`, `RH_COMISSAO` ou `JURIDICO` (falha fechada caso `NULL`).
2. Resolve a chave de decriptografia a partir da configuração de servidor (`app.settings.master_key`).
3. Insere imediatamente uma linha em `public.audit_logs` com ação `DECRYPT_READ`, registrando o ID do requisitante, o ID do servidor consultado e o timestamp UTC.
4. Descriptografa `cpf_encrypted` e `matricula_encrypted` com tratamento defensivo de exceções.
5. Retorna a linha decifrada apenas ao solicitante autorizado.

### 5.3 RPC `public.obter_licenca_detalhada_decrypted`
```sql
SELECT * FROM public.obter_licenca_detalhada_decrypted(
    p_licenca_id := '20000000-0000-0000-0000-000000000002'
);
```
Garante o mesmo rigor para prontuários, laudos e códigos CID de perícias médicas.

---

## 6. Triggers e Automações de Banco de Dados

1. **`trg_audit_servidores` & `trg_audit_licencas`**:
   - Acionados após `INSERT`, `UPDATE` ou `DELETE`.
   - Sanitizam automaticamente os bytes cifrados antes de gravar o JSONB de auditoria (`to_jsonb(ROW) - 'cpf_encrypted' - ...`).
2. **`on_auth_user_created`**:
   - Disparado após `INSERT` na tabela `auth.users`.
   - Sincroniza metadados (`full_name`, `role`, `department`) com a tabela `public.profiles`.
3. **`handle_updated_at_timestamp`**:
   - Atualiza o campo `updated_at` com o timestamp UTC corrente antes de qualquer atualização.

---

## 7. Instruções de Execução das Migrações e Seeds

### Opção A: Via Supabase CLI (Recomendado para Desenvolvimento)
```bash
# Na raiz do projeto Olympos:
supabase db reset
# Ou aplicar as migrações em ordem sequencial:
supabase migration up
```

### Opção B: Via Supabase Dashboard (SQL Editor)
Execute os arquivos na ordem cronológica rigorosa:
1. `migrations/20261031_001_initial_schema.sql`
2. `migrations/20261031_002_rls_policies.sql`
3. `migrations/20261031_003_pgcrypto_rpc.sql`
4. *(Opcional / Ambiente de Testes)* `seeds/seed_roles_mock.sql`

### Opção C: Via `psql` (PostgreSQL Direto)
```bash
psql -h <SUPABASE_DB_HOST> -p 5432 -U postgres -d postgres -f migrations/20261031_001_initial_schema.sql
psql -h <SUPABASE_DB_HOST> -p 5432 -U postgres -d postgres -f migrations/20261031_002_rls_policies.sql
psql -h <SUPABASE_DB_HOST> -p 5432 -U postgres -d postgres -f migrations/20261031_003_pgcrypto_rpc.sql
psql -h <SUPABASE_DB_HOST> -p 5432 -U postgres -d postgres -f seeds/seed_roles_mock.sql
```

---

## 8. Verificação e Conformidade de Segurança

- [x] **Zero senhas no código**: Nenhuma senha ou hash vulnerável embutido em código-fonte.
- [x] **RLS Ativo**: Todas as 6 tabelas com RLS habilitado e políticas estritas por perfil.
- [x] **Criptografia AES-256**: Campos de alta sensibilidade (CPF, matrícula, dados de saúde) protegidos via pgcrypto.
- [x] **Blind Index HMAC-SHA256**: Busca exata preservada com performance e sigilo.
- [x] **Auditoria Imutável**: Logs protegidos contra modificação e exclusão, com registro compulsório de leituras decifradas.
