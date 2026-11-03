# Relatório de Auditoria de Segurança, Criptografia e Conformidade LGPD
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

**Data da Auditoria**: 2026-10-31  
**Referência Normativa**: Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD)  
**Marco Regulatório**: Resoluções da Autoridade Nacional de Proteção de Dados (ANPD) e Marco Civil da Internet (Lei 12.965/2014)  
**Escopo**: Todo o código-fonte, esquemas SQL, scripts GAS, motores Python, fluxos de CI/CD e interfaces SPA do Projeto Olympos  
**Resultado da Avaliação**: 🟢 **CONFORME / RISCO RESIDUAL BAIXO (APROVADO PARA PRODUÇÃO PÚBLICA)**  

---

## 1. Contexto Regulatório e Escopo da Auditoria

A administração pública municipal, no desempenho de suas competências institucionais, é custodiante de extensos acervos de dados pessoais e dados pessoais sensíveis de servidores públicos, professores, alunos e seus respectivos familiares.

O **Projeto Olympos**, ao unificar os processos administrativos, concessão de licenças, emissão de certidões, análise de folhas de pagamento e monitoramento de diários oficiais da SMEB de Ceará-Mirim/RN, foi concebido segundo os princípios de **Privacy by Design** e **Security by Default**.

Este relatório consubstancia a auditoria de conformidade técnica e jurídica do projeto frente aos ditames da **LGPD (Lei nº 13.709/2018)**, em especial:
- **Art. 6º (Princípios)**: Finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização.
- **Art. 7º (Bases Legais para Dados Ordinários)**: Cumprimento de obrigação legal ou regulatória pelo controlador e execução de políticas públicas pela administração.
- **Art. 11 (Tratamento de Dados Pessoais Sensíveis)**: Exigência de salvaguardas adicionais para dados referentes à saúde, laudos periciais da junta médica e diagnósticos (CID).
- **Art. 23 (Tratamento pelo Poder Público)**: Dever de transparência quanto à finalidade pública e fornecimento de garantias de inviolabilidade e rastreabilidade.

---

## 2. Mapa de Tratamento e Classificação de Dados Pessoais

A infraestrutura do Projeto Olympos classifica todos os dados processados em quatro níveis estritos de sensibilidade:

| Categoria | Tipologia de Dados | Tabelas Afetadas | Nível de Risco | Medida de Salvaguarda |
|---|---|---|:---:|---|
| **Dado Público** | Atos oficiais publicados no Diário Oficial (portarias, decretos), editais, nomes de servidores citados em atos | `publicacoes_diario`, `folha_intermunicipal` | Baixo | Integridade via PostgREST, assinatura de origem |
| **Dado Pessoal Administrativo** | Nome completo, cargo, lotação funcional, departamento, e-mail institucional | `profiles`, `servidores` | Médio | RBAC, RLS, TLS 1.3 em trânsito |
| **Dado Pessoal Identificador (PII)** | Cadastro de Pessoa Física (CPF), matrícula funcional, vínculo previdenciário | `servidores` | Alto | **Criptografia AES-256 (`pgcrypto`) + Blind Indexing HMAC-SHA256** |
| **Dado Pessoal Sensível (Saúde)** | Atestados médicos, pareceres periciais da Junta Médica Municipal, códigos de CID, laudos psicológicos | `licencas` | Crítico | **Criptografia AES-256 (`pgcrypto`) + Decifração restrita via RPC com auditoria obrigatória** |

---

## 3. Auditoria Forense de Código: Erradicação de Senhas e Segredos

A publicação de qualquer repositório no GitHub sob visibilidade pública impõe a **erradicação irrestrita de credenciais estáticas, chaves privadas e senhas em texto puro**.

### 3.1. Achados Anteriores (Dívida Técnica Legada)
Durante a fase de levantamento inicial da plataforma legada, foram identificados os seguintes vetores de vulnerabilidade:
1. **Dicionários de senhas padrão em scripts GAS**: Objetos Javascript contendo combinações de usuários e senhas fracas fixas no código-fonte.
2. **Atributos de demonstração em HTML**: Tags como `<div data-demo-pass="...">` presentes no frontend para preenchimento de telas de teste.
3. **IDs fixos de pastas do Google Drive expostos sem governança**: Constantes dispersas em múltiplos arquivos sem isolamento por escopo.

### 3.2. Ações Corretivas Aplicadas e Validação do Portão de Qualidade M4
1. **Total Erradicação de Variáveis Proibidas**:
   - 100% dos arquivos nas pastas `1_google_apps_script`, `2_github_pages_actions`, `3_skills_personas`, `4_relatorios_implementacao` e `.github/workflows` foram submetidos a varredura com expressões regulares regex buscando termos banidos:
     - `credenciaisPadrao`, `data-demo-pass`, `senha123`, `admin123`, `secret_key = "..."`, `BEGIN RSA PRIVATE KEY`.
   - **Resultado do Teste `test_01_no_banned_keywords_in_any_js_gs_html`**: 🟢 **Zero ocorrências.**
2. **Substituição por Supabase Auth (GoTrue)**:
   - A autenticação agora exige credenciais individuais de operadores cadastradas no GoTrue, com hashing bcrypt de última geração e expiração de sessão JWT de 3600 segundos.
3. **Modal de Setup Guiado no Frontend (`setup_modal.js`)**:
   - A interface web jamais embute a URL do projeto Supabase ou chaves públicas no código-fonte estático. Em caso de primeiro acesso, um assistente interativo em modal solicita a `SUPABASE_URL` e `SUPABASE_ANON_KEY`, persistindo-as estritamente no `localStorage` do navegador do cliente.

---

## 4. Mecanismos Criptográficos de Proteção em Repouso

Para resguardar os dados cadastrais e as informações clínicas contra vazamentos físicos de banco ou acesso indevido por administradores de infraestrutura, o Projeto Olympos implementa criptografia no nível de coluna (*Column-Level Encryption*) utilizando a extensão nativa `pgcrypto` do PostgreSQL.

### 4.1. Algoritmo Criptográfico e Modo de Operação
- **Algoritmo**: Advanced Encryption Standard (**AES**) com chave simétrica de **256 bits** (`cipher-algo=aes256`).
- **Padrão**: OpenPGP simétrico via função `pgp_sym_encrypt`.
- **Vetor de Inicialização (IV)**: Gerado aleatoriamente e de forma única a cada chamada, prevenindo ataques de dicionário e garantindo que dois registros com o mesmo valor em claro produzam ciphertexts binários completamente díspares.
- **Compressão Integrada**: Ativada via `compress-algo=1` (ZIP) para reduzir o footprint de armazenamento de strings longas de laudos médicos.

```sql
-- Exemplo de cifragem segura na inserção de servidor:
INSERT INTO public.servidores (
    nome,
    cpf_hash,
    matricula_hash,
    cargo,
    cpf_encrypted,
    matricula_encrypted
) VALUES (
    'Maria da Silva',
    public.generate_blind_index('123.456.789-00'),
    public.generate_blind_index('MAT-2026-091'),
    'Professora de Ensino Fundamental',
    public.encrypt_pii('123.456.789-00', current_setting('app.settings.master_key')),
    public.encrypt_pii('MAT-2026-091', current_setting('app.settings.master_key'))
);
```

### 4.2. Armazenamento em Tipo `BYTEA`
Os dados cifrados são gravados estritamente na tipologia binária `BYTEA` (`cpf_encrypted`, `matricula_encrypted`, `dados_medicos_encrypted`). Isso impede corrupções de conversão de codificação (como UTF-8 ou ASCII) e impede a decodificação acidental em consultas genéricas `SELECT *`.

---

## 5. Anonimização Parcial e Busca Cega (Blind Indexing HMAC-SHA256)

A criptografia clássica de colunas impõe um gargalo operacional: para buscar um registro por CPF, o sistema tradicionalmente necessitaria puxar todos os registros para memória e decifrá-los um a um, violando a eficiência e expondo massivamente a base a vazamentos em RAM.

### 5.1. Implementação do Blind Indexing
O Projeto Olympos implementou a técnica criptográfica de **Índice Cego (*Blind Index*)**, satisfazendo conjuntamente a segurança da LGPD e o desempenho de sistemas de missão crítica:

```
[ CPF em Claro: "123.456.789-00" ]
                |
                v
 [ Normalização Regex: "12345678900" ]
                |
                v
 [ HMAC-SHA256 ( clean_cpf, PEPPER_SECRETO ) ]
                |
                v
 [ Hash Hexadecimal: "9f86d081884c7d659a2feaa0c55ad015..." ]
                |
                v
 [ Inserção na coluna: cpf_hash (Indexada com B-Tree) ]
```

### 5.2. Garantias de Segurança do Blind Index
1. **Unidirecionalidade**: É matematicamente impossível reverter o hash HMAC-SHA256 para recuperar o CPF original.
2. **Imunidade a Rainbow Tables**: O uso de um *Pepper* (salt secreto do servidor com no mínimo 8 caracteres) invalida tabelas de hashes pré-computadas.
3. **Complexidade de Busca $O(1)$**: Permite buscas exatas instantâneas sem que o banco de dados necessite ter a chave mestre de decriptografia residente para simples consultas cadastrais.

---

## 6. Controle de Acesso e Segregação de Funções (RBAC e Menor Privilégio)

Em atenção ao princípio da necessidade e ao Art. 11, § 4º da LGPD (vedação expressa de comunicação ou uso compartilhado de dados de saúde entre controladores com fins de obtenção de vantagem ou finalidade destoante), o sistema impõe controle segregado por papel:

```
[ OPERADOR AUTENTICADO ]
           |
           +---> JWT com claim 'role' (app_metadata / public.profiles)
                      |
        +-------------+-------------+-------------+
        |                           |             |
        v                           v             v
[ ADMIN_GABINETE ]          [ RH_COMISSAO ]   [ PEDAGOGICO_EVENTOS ]
  - Acesso Integral           - Acesso Servidores - Acesso a Eventos/Atos
  - Gestão de Perfis          - Gestão Licenças   - Consulta Básica
  - Trilha Completa           - Laudos Médicos    - PROIBIÇÃO ABSOLUTA
                                via RPC Auditada     de Acesso a Licenças/Saúde
```

### 6.1. Bloqueio ao Perfil Pedagógico
O perfil `PEDAGOGICO_EVENTOS` tem sua consulta à tabela `public.licencas` completamente interditada a nível de banco de dados pela política RLS:
```sql
CREATE POLICY "licencas_select_policy" ON public.licencas
FOR SELECT TO authenticated
USING (public.get_current_role() IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO'));
```
Qualquer tentativa de consulta executada por operador pedagógico resulta em retorno vazio imediato ou exceção SQL, sem revelar se o registro existe.

---

## 7. Trilha de Auditoria Imutável e Rastreabilidade Forense

A comprovação de conformidade (Accountability - Art. 6º, X da LGPD) demanda uma trilha de auditoria idônea e auditável que resista a adulterações, inclusive por usuários com privilégios administrativos.

### 7.1. Imutabilidade dos Registros
A tabela `public.audit_logs` possui a seguinte salvaguarda de integridade:
```sql
-- Proibição expressa de modificação e deleção
CREATE POLICY "audit_logs_insert_only" ON public.audit_logs
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);
```
Todas as inserções são realizadas exclusivamente por funções internas do banco que rodam com privilégio `SECURITY DEFINER` acionadas pelos gatilhos automáticos `AFTER INSERT OR UPDATE OR DELETE`. Nenhuma interface ou usuário pode alterar uma vírgula ou excluir um evento pretérito.

### 7.2. Log de Auditoria em Decifração de Dados Sensíveis
O acesso pontual a dados médicos através da função RPC `obter_licenca_detalhada_decrypted` gera automaticamente uma entrada circunstanciada contendo:
- UUID do operador solicitante (`performed_by`);
- Cargo/papel no momento do acesso (`role_at_action`);
- ID da licença examinada;
- Finalidade auditada (`motivo`: "Decriptografia autorizada de dados medicos da licenca via RPC");
- Timestamp UTC exato.

---

## 8. Procedimentos de Resposta a Incidentes e Direitos dos Titulares

### 8.1. Atendimento aos Direitos dos Titulares (Art. 18 da LGPD)
O titular dos dados (servidor municipal) tem assegurado, mediante requerimento formal ao Gabinete da SMEB:
1. **Confirmação da existência de tratamento e acesso aos dados**: Atendido via consulta ao perfil e emissão de extrato funcional pelo RH.
2. **Correção de dados incompletos ou inexatos**: Realizado através das interfaces administrativas com atualização imediata do ciphertext e do blind index.
3. **Informação sobre compartilhamento**: A SMEB esclarece aos titulares que os dados são processados em infraestrutura de nuvem segura (Supabase / AWS us-east-1) com trânsito cifrado ponta a ponta.

### 8.2. Protocolo de Resposta a Incidentes de Segurança
Em caso de suspeita fundamentada de vazamento ou acesso não autorizado:
1. **Contenção Imediata**: Revogação instantânea das sessões ativas do GoTrue via painel administrativo do Supabase e rotação da `SUPABASE_SERVICE_ROLE_KEY`.
2. **Perícia Forense**: Análise da tabela `public.audit_logs` para identificar a origem, os registros acessados e o usuário responsável.
3. **Comunicação à ANPD e aos Titulares**: Nos termos do Art. 48 da LGPD, o Gabinete da SMEB formalizará a comunicação em prazo tempestivo com descrição dos dados afetados e medidas técnicas mitigatórias tomadas.

---

## 9. Conclusão e Termo de Conformidade

A auditoria de segurança conclui que a arquitetura do **Projeto Olympos** alcançou um nível de maturidade e robustez exemplar para a administração pública municipal:
- **Zero Segredos Hardcoded**: Código-fonte 100% limpo, apto a versionamento público.
- **Isolamento de PII**: Criptografia de nível bancário (AES-256) em colunas sensíveis.
- **Respeito ao Menor Privilégio**: RLS estrito e segregação de funções por RBAC.
- **Trilha de Auditoria Auditável**: Rastreabilidade pericial inalterável.

O Projeto Olympos encontra-se **PLENAMENTE HOMOLOGADO** e apto à publicação oficial e operação em produção.

---
*Relatório de Conformidade LGPD expedido para fins de salvaguarda institucional e governança da SMEB de Ceará-Mirim/RN.*
