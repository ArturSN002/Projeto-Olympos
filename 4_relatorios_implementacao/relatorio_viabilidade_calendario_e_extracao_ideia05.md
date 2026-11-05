# Relatório Técnico de Engenharia de Dados e Estudo de Viabilidade Intersetorial
## Extração de Dados da Ideia 05 (Dashboard de Inteligência Escolar & Evasão) e Arquitetura do Calendário Escolar Oficial (200 Dias Letivos — LDB 9.394/96)

**Secretaria Municipal de Educação Básica de Ceará-Mirim/RN (SMEB)**  
**Projeto Olympos — Sistema Integrado de Gestão, Inteligência e Governança Educacional**  
**Data:** 05 de Novembro de 2026  
**Autoria:** Equipe de Engenharia e Arquitetura Olympos (teamwork_worker_impl_1)  
**Status:** Documento Homologado — Pronto para Execução Técnica  

---

## 1. Sumário Executivo & Contextualização Territorial

O município de **Ceará-Mirim/RN**, situado na microrregião do Litoral Nordeste potiguar, abrange uma extensão territorial de **724,838 km²** caracterizada por marcante dualidade geográfica entre áreas urbanas consolidadas (Centro, Passa e Fica, Santa Águeda, Nova Descoberta) e extensos polos rurais e litorâneos (Gravatá, Massangana, Primeirinho, Pium, Coqueiros, Capela, Muriú). A rede pública municipal é administrada pela **Secretaria Municipal de Educação Básica (SMEB)**, composta por **20 unidades educacionais polo representativas**, 3 Centros de Educação Infantil (CEIs) e um corpo docente permanente de **890 profissionais**.

O presente relatório atende às diretrizes de modernização institucional do Projeto Olympos, detalhando:
1. **A engenharia de extração e harmonização de dados da Ideia 05** (Dashboard de Inteligência Educacional & Predição de Risco de Evasão), integrando os quatro pilares fundamentais da educação pública: Censo Escolar/INEP, IDEB/SAEB, Sistema Presença do MEC (Bolsa Família) e Diário Eletrônico Local da SMEB.
2. **O estudo aprofundado de viabilidade técnica, jurídica e intersetorial do Módulo de Calendário Escolar Oficial**, assegurando a contagem estrita dos **200 dias de efetivo trabalho escolar** exigidos pelo Art. 24, I da Lei de Diretrizes e Bases da Educação Nacional (Lei nº 9.394/1996), estruturando a orquestração logística de seis setores da SMEB e fornecendo modelos relacionais Supabase (SQL/RLS), esquemas JSON para PWA offline e integração com o Google Calendar.

---

## 2. PARTE I: Engenharia de Extração de Dados — Ideia 05

A **Ideia 05** tem como premissa a unificação de bases de dados heterogêneas em um repositório analítico central no Supabase, permitindo à equipe gestora e pedagógica (Módulo Atena) monitorar indicadores educacionais em tempo real e antecipar o abandono escolar por meio de um **Score Preditivo de Risco de Evasão (SRE)**.

```
+----------------------------------------------------------------------------------------------------+
|                      ARQUITETURA DE INGESTÃO E ANÁLISE — IDEIA 05                                  |
+----------------------------------------------------------------------------------------------------+
|  [Pilar 1: INEP Censo]       [Pilar 2: IDEB / SAEB]      [Pilar 3: MEC Presença]  [Pilar 4: SMEB]  |
|  Microdados Educacenso       Planilhas DEED/INEP         Portal Bolsa Família     Diário Eletrônico|
|  (Matrícula/Infra/Docentes)  (Proficiência/Aprovação)    (Frequência Bimestral)   (Faltas/Notas/SRE|
+------------------------------+---------------------------+------------------------+----------------+
                               |                           |                        |
                               v                           v                        v
            +-----------------------------------------------------------------------+
            |               MOTOR ETL PYTHON (pipeline/inteligencia_escolar/)       |
            | - Normalização textual e validação de chaves canônicas (INEP 8 dígitos)|
            | - Pseudonimização LGPD: Hashing HMAC-SHA256 para NIS e CPF            |
            | - Cálculo do Score Preditivo de Risco de Evasão (SRE)                  |
            +-----------------------------------------------------------------------+
                                                   |
                                                   v
            +-----------------------------------------------------------------------+
            |               SUPABASE DATA LAYER (PostgreSQL + RLS + Views)          |
            | - Tabelas: escolas_censo, escolas_ideb, presenca_pbf, evasao_alertas  |
            | - RLS por Perfil: Gabinete, RH, Pedagógico (Atena), Conselho Tutelar   |
            +-----------------------------------------------------------------------+
                                                   |
                                                   v
            +-----------------------------------------------------------------------+
            |               FRONTEND SPA OLYMPOS (Aba #analytics)                   |
            | - Camada Cartográfica Leaflet: Marcadores temáticos por risco evasão  |
            | - Gráficos Chart.js / Bento Grid: Distorção idade-série, IDEB vs Metas|
            | - Painel de Disparo da Busca Ativa Escolar (Gabinete + CRAS)          |
            +-----------------------------------------------------------------------+
```

---

### 2.1. Pilar 1: Censo Escolar da Educação Básica (INEP / MEC)

#### Natureza e Periodicidade
O Censo Escolar é o principal instrumento estatístico da educação básica brasileira, realizado anualmente em duas etapas:
1. **Matrícula Inicial (Data de Referência: última quarta-feira de maio):** Dados cadastrais de escolas, turmas, docentes e alunos.
2. **Situação do Aluno (Fevereiro/Março subsequente):** Rendimento escolar (aprovado, reprovado) e movimento discente (transferido, deixou de frequentar, falecido).

#### Fontes e Mecanismos de Coleta
- **Microdados Públicos do INEP:** Arquivos CSV/Parquet disponibilizados anualmente pelo portal de dados abertos do INEP. A ingestão é filtrada pelo código de município do IBGE correspondente a Ceará-Mirim/RN (`CO_MUNICIPIO = 2402100`) e dependência administrativa municipal (`TP_DEPENDENCIA = 3`).
- **Arquivos de Migração do Educacenso (Acesso Restrito SMEB):** Exportações pontuais no formato TXT/CSV delimitadas por pipes (`|`) extraídas diretamente pelos técnicos credenciados da SMEB no módulo oficial do Educacenso.

#### Dicionário de Variáveis Críticas Extraídas
| Atributo INEP | Tipo | Descrição e Finalidade no Olympos |
| :--- | :--- | :--- |
| `CO_ENTIDADE` | INTEGER(8) | Código INEP da unidade escolar (chave primária de amarração com `escolasCearaMirim.js`). |
| `ID_ALUNO` | BIGINT | Código identificador único do estudante no banco nacional do INEP. |
| `CO_TURMA` | BIGINT | Identificador da turma para agregação de turmas superlotadas ou multisseriadas rurais. |
| `TP_ETAPA_ENSINO` | SMALLINT | Etapa: 1/2 (Creche/Pré-escola - CEI), 14-18 (Fund. Anos Iniciais), 19-21 (Fund. Anos Finais), 65-74 (EJA). |
| `TP_ZONA_RESIDENCIAL` | SMALLINT | 1: Urbana, 2: Rural (crucial para o dimensionamento do transporte escolar). |
| `TP_TRANSPORTE_PUBLICO` | SMALLINT | 0: Não utiliza, 1: Rodoviário Municipal (ônibus/vans contratados pela SMEB). |
| `IN_NECESSIDADE_ESPECIAL` | SMALLINT | 1: Estudante com deficiência, TDAH ou TEA (sinalização para monitoria AEE). |
| `DT_NASCIMENTO` | DATE | Data de nascimento utilizada no cômputo da Taxa de Distorção Idade-Série (TDI). |

#### Pipeline de Processamento (ETL Streaming)
O processamento é conduzido por um script Python modularizado (`censo_importer.py`) empregando leitura em pedaços (*chunk size = 5.000 linhas*) para permitir execução local ou em runners de baixo consumo de memória (GitHub Actions), persistindo os dados agregados na tabela `escolas_censo_estatisticas` do Supabase.

---

### 2.2. Pilar 2: IDEB e SAEB (Proficiência e Rendimento)

#### Natureza e Periodicidade
O Índice de Desenvolvimento da Educação Básica (IDEB) é calculado a cada dois anos pelo INEP a partir do Sistema de Avaliação da Educação Básica (SAEB), aferindo o aprendizado em Língua Portuguesa e Matemática e a taxa de aprovação escolar.

#### Fontes e Mecanismos de Coleta
- **Planilhas Consolidadas por Escola (Portal DEED/INEP):** Planilhas eletrônicas oficiais `divulgacao_anos_iniciais_escolas_2023.xlsx` e `divulgacao_anos_finais_escolas_2023.xlsx`.
- **API e Scrapers QEdu / Dados Educacionais Abertos:** Consulta automatizada para resgate da série histórica das escolas de Ceará-Mirim desde 2015.

#### Formulação Matemática e Normalização
O IDEB de cada unidade escolar é obtido pelo produto da Nota Média Padronizada de Proficiência ($N$) e a Taxa Média de Aprovação ($P$):
$$IDEB = N \times P$$

Onde:
- **$P$ (Indicador de Rendimento):**
  $$P = \frac{1}{\sum_{i=1}^{k} \frac{1}{p_i}}$$
  Sendo $p_i$ a taxa de aprovação do $i$-ésimo ano da etapa de ensino avaliada.
- **$N$ (Nota Média Padronizada):**
  $$N = \frac{N_{LP} + N_{MT}}{2}$$
  Calculada a partir das proficiências médias da escola no SAEB transformadas linearmente para a escala de 0,0 a 10,0.

#### Tratamento de Exceções Estatísticas
- **Dados Censurados / Ocultados ($ND$):** Escolas ou turmas com menos de 10 alunos participantes no dia da prova são marcadas como `ND` (Não Divulgado) pelo INEP por razões de preservação estatística. O Olympos sinaliza essas escolas com marcador visual neutro (âmbar pontilhado) e utiliza a média histórica do polo regional como baseline de planejamento.

---

### 2.3. Pilar 3: Sistema Presença do MEC (Condicionalidade Bolsa Família - PBF)

#### Natureza e Periodicidade
O Sistema Presença é gerido pelo Ministério da Educação (MEC/SECADI) em articulação com o Ministério do Desenvolvimento e Assistência Social, Família e Combate à Fome (MDS). Acompanha a frequência escolar dos beneficiários do Programa Bolsa Família ao longo de **5 períodos anuais** (fevereiro/março, abril/maio, junho/julho, agosto/setembro e outubro/novembro).

#### Requisitos Normativos de Frequência
- **Educação Infantil (CEIs - 4 a 5 anos):** Frequência escolar mínima de **60%** da carga horária mensal.
- **Ensino Fundamental (6 a 17 anos):** Frequência escolar mínima de **75%** da carga horária mensal.

#### Fontes e Mecanismos de Coleta
- **Exportação Operacional do Operador Master Municipal:** Como o MEC não disponibiliza API pública com autenticação federada para terceiros, a ingestão ocorre via upload bimestral dos arquivos oficiais `relatorio_frequencia_periodo_X.csv` pelo operador credenciado da SMEB.
- **Layout de Importação e Sanitização:** O motor Olympos valida a assinatura criptográfica e layout do cabeçalho oficial do MEC.

#### Tabela de Motivos Oficiais de Baixa Frequência do MEC
| Código | Descrição Oficial | Protocolo de Ação Integrada Olympos |
| :---: | :--- | :--- |
| `01` | Doença do estudante | Notificação à UBS/Secretaria de Saúde municipal. |
| `03` | Trabalho infantil / Exploração de mão de obra | Acionamento imediato do CREAS e Conselho Tutelar. |
| `05` | Falta ou falha do transporte escolar rural | Alerta ao Setor de Frotas/Transporte da SMEB para inspeção da rota. |
| `07` | Evasão escolar / Desistência declarada | Disparo do protocolo de Busca Ativa Escolar pela SMEB. |
| `08` | Mudança de domicílio sem transferência formal | Localização da nova residência via base CADÚNICO/CRAS. |

#### Conformidade Estrita com a LGPD (Lei nº 13.709/2018)
Para resguardar os direitos fundamentais de crianças e adolescentes beneficiários de programas sociais, o Olympos **não armazena números de NIS (Número de Identificação Social) ou CPFs em texto plano**. Durante a ingestão, cada NIS é submetido a uma função criptográfica unidirecional com chave mestra secreta do servidor:
$$\text{NIS\_HASH} = \text{HMAC-SHA256}(\text{NIS}, \text{APP\_SECRET\_SALT})$$
As interfaces analíticas e relatórios exibem apenas agregados estatísticos e identificadores anonimizados, permitindo apenas à assistente social designada a decodificação controlada mediante auditoria em log (`audit_pbf_access_logs`).

---

### 2.4. Pilar 4: Base Operacional Local da SMEB (Diário Eletrônico)

#### Natureza e Periodicidade
Dados gerados diariamente nas salas de aula através dos lançamentos de frequência, faltas e avaliações curriculares pelos 890 docentes municipais.

#### Modelo Preditivo: Score de Risco de Evasão (SRE)
Para antecipar a evasão antes do encerramento bimestral do Sistema Presença, o Olympos implementa uma função determinística de regressão ponderada computada semanalmente para cada discente:

$$SRE = \Big[ 0.35 \times F_{cons} \Big] + \Big[ 0.25 \times I_{mes} \Big] + \Big[ 0.20 \times D_{idade} \Big] + \Big[ 0.20 \times B_{desc} \Big]$$

Onde cada termo é normalizado no intervalo $[0, 100]$:
1. **$F_{cons}$ (Fator Faltas Consecutivas):**
   - $F_{cons} = 100$ se faltas consecutivas sem justificativa $\ge 5$ dias;
   - $F_{cons} = 60$ se faltas consecutivas entre 3 e 4 dias;
   - $F_{cons} = 0$ se faltas consecutivas $< 3$ dias.
2. **$I_{mes}$ (Fator Infrequência Acumulada no Mês):**
   - $I_{mes} = 100$ se $\%$ de faltas no mês $> 25\%$;
   - $I_{mes} = (\% \text{ faltas} / 25) \times 100$ nos demais casos.
3. **$D_{idade}$ (Fator Distorção Idade-Série):**
   - $D_{idade} = 100$ se idade $\ge \text{idade recomendada} + 2$ anos;
   - $D_{idade} = 50$ se idade $= \text{idade recomendada} + 1$ ano;
   - $D_{idade} = 0$ se estudante com idade regular.
4. **$B_{desc}$ (Fator Descumprimento Bolsa Família):**
   - $B_{desc} = 100$ se beneficiário com frequência $< 75\%$ no período anterior;
   - $B_{desc} = 0$ caso contrário.

#### Níveis de Risco e Fluxo de Governança
- 🟢 **Risco Baixo ($0 \le SRE < 30$):** Situação regular; monitoramento de rotina pela equipe escolar.
- 🟡 **Risco Moderado ($30 \le SRE < 70$):** Alerta expedido para a Coordenação Pedagógica da unidade; contato telefônico com a família pelo articulador da escola.
- 🔴 **Risco Crítico ($SRE \ge 70$):** Inclusão automática na fila da **Busca Ativa Escolar Municipal**; notificação compartilhada com o Gabinete da SMEB, CRAS territorial e Conselho Tutelar de Ceará-Mirim para visita domiciliar presencial.

---

## 3. PARTE II: Estudo de Viabilidade — Módulo de Calendário Escolar Intersetorial

### 3.1. Fundamentação Legal e Regulatória (LDB 9.394/1996)

O planejamento do calendário letivo é submetido a preceitos rígidos da legislação educacional federal e resoluções do Conselho Municipal de Educação (CME) de Ceará-Mirim:
1. **Regra Pétrea dos 200 Dias Letivos (Art. 24, Inciso I da LDB):**
   > *"A carga horária mínima anual será de oitocentas horas para o ensino fundamental e para o ensino médio, distribuídas por um mínimo de duzentos dias de efetivo trabalho escolar, excluído o tempo reservado aos exames finais, quando houver."*
2. **Conceito de Efetivo Trabalho Escolar:** Consideram-se exclusivamente os dias com presença obrigatória de docentes e discentes em atividades curriculares e pedagógicas programadas. Feriados, recessos, jornadas de formação docente exclusivas de professores e pontos facultativos **não integram a contagem dos 200 dias**.
3. **Sábados Letivos Temáticos:** Quando previstos na Resolução anual homologada pelo CME para recomposição de carga horária, devem ter conteúdo programático estruturado e frequência discente computada.
4. **Garantia de Férias e Recessos Docentes:** Preservação de no mínimo 30 dias de férias anuais aos docentes e 15 dias de recesso escolar discente em julho.

---

### 3.2. Matriz de Integração dos 6 Setores da SMEB de Ceará-Mirim

O Calendário Olympos atua como o sistema nervoso central da prefeitura, sincronizando as demandas orçamentárias e logísticas dos seis setores administrativos:

| Setor Municipal | Papel no Calendário Escolar | Dependências Críticas e Impacto | Regras de Validação Automatizadas |
| :--- | :--- | :--- | :--- |
| **1. Gabinete do Secretário** | Publicação da Portaria oficial, homologação junto ao CME, envio de dados ao SIOPE/FNDE. | Respaldo institucional do ano letivo e cumprimento de prazos do censo. | Bloqueio de publicação se total de dias letivos calculados for $< 200$. |
| **2. Recursos Humanos (RH)** | Escala de férias dos 890 professores, abertura do período de permutas (Hera), posse de concursados. | Garantia de docentes em todas as turmas no dia inaugural das aulas. | Impedir marcação de férias docentes coincidentes com dias letivos efetivos. |
| **3. Transporte Escolar** | Operação de ônibus e vans nos 724 km², manutenções periódicas da frota, rotas rurais. | Transporte garantido em 100% dos 200 dias letivos e sábados temáticos. | Alerta automático de revisão mecânica durante o recesso de julho; notificação prévia de 72h para sábados letivos. |
| **4. Alimentação Escolar (PNAE)** | Aquisição de gêneros, chamada pública da Agricultura Familiar ($\ge 30\%$), entrega de perecíveis. | Cardápio adequado fornecido em todos os dias letivos; prevenção de perdas por validade. | Alerta de estoque excedente se houver suspensão imprevista de aula; suspensão das entregas nos recessos. |
| **5. Pedagógico / Supervisão (Atena)** | Semanas pedagógicas, simulados municipais, aplicação de avaliações diagnósticas e conselhos de classe. | Alinhamento do currículo de Ceará-Mirim à BNCC e cumprimento das metas do IDEB. | Janelas obrigatórias de encerramento bimestral antes da submissão ao MEC Presença. |
| **6. Assessoria Jurídica** | Monitoramento de TACs firmados com o MPRN, legalidade de reposições e compliance com o Art. 37 da CF. | Segurança jurídica dos atos administrativos e prevenção de improbidade. | Auditoria estrita em reposições em dias não úteis ou remotos. |

---

### 3.3. Arquitetura de Dados Relacional (PostgreSQL / Supabase DDL)

Para sustentar a integridade e governança de dados do módulo, foi desenhada a modelagem relacional formal com políticas de segurança em nível de linha (RLS) para o Supabase:

```sql
-- ============================================================================
-- PROJETO OLYMPOS — SCHEMA DE CALENDÁRIO ESCOLAR INTERSETORIAL
-- SMEB Ceará-Mirim/RN — Compatibilidade LDB nº 9.394/96 (200 Dias Letivos)
-- ============================================================================

-- 1. Tipos Enumerados Canônicos
DO $$ BEGIN
    CREATE TYPE public.calendario_tipo_evento AS ENUM (
        'DIA_LETIVO_REGULAR',
        'SABADO_LETIVO_TEMATICO',
        'FERIADO_NACIONAL',
        'FERIADO_ESTADUAL',
        'FERIADO_MUNICIPAL',
        'PONTO_FACULTATIVO',
        'RECESSO_ESCOLAR',
        'PLANEJAMENTO_PEDAGOGICO',
        'CONSELHO_CLASSE',
        'EXAMES_FINAIS',
        'JORNADA_PEDAGOGICA'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.setor_smeb_responsavel AS ENUM (
        'GABINETE',
        'RH',
        'TRANSPORTE',
        'MERENDA',
        'PEDAGOGICO_ATENA',
        'JURIDICO',
        'INTERSETORIAL_GERAL'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabela de Cabeçalho do Calendário Anual
CREATE TABLE IF NOT EXISTS public.calendarios_letivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ano_letivo INTEGER NOT NULL UNIQUE,
    dias_letivos_meta INTEGER NOT NULL DEFAULT 200 CHECK (dias_letivos_meta >= 200),
    carga_horaria_minima_horas INTEGER NOT NULL DEFAULT 800 CHECK (carga_horaria_minima_horas >= 800),
    data_inicio_ano DATE NOT NULL,
    data_termino_ano DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'HOMOLOGADO_CME', 'EM_VIGOR', 'ENCERRADO')),
    numero_resolucao_cme TEXT,
    data_homologacao_cme DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_periodo_letivo_valido CHECK (data_termino_ano > data_inicio_ano)
);

-- 3. Tabela de Eventos Detalhados do Calendário
CREATE TABLE IF NOT EXISTS public.calendario_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendario_id UUID NOT NULL REFERENCES public.calendarios_letivos(id) ON DELETE CASCADE,
    titulo VARCHAR(160) NOT NULL,
    descricao TEXT,
    tipo_evento public.calendario_tipo_evento NOT NULL,
    setor_responsavel public.setor_smeb_responsavel NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    bimestre SMALLINT CHECK (bimestre BETWEEN 1 AND 4),
    conta_como_dia_letivo BOOLEAN NOT NULL DEFAULT false,
    impacta_transporte_escolar BOOLEAN NOT NULL DEFAULT false,
    impacta_merenda_escolar BOOLEAN NOT NULL DEFAULT false,
    escolas_afetadas TEXT[] DEFAULT ARRAY['TODAS'], -- 'TODAS' ou lista de códigos INEP
    cor_identificacao VARCHAR(7) DEFAULT '#38BDF8',
    metadados JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_datas_evento CHECK (data_fim >= data_inicio)
);

-- 4. Índices para Otimização de Consultas de Alto Rendimento
CREATE INDEX IF NOT EXISTS idx_cal_eventos_periodo ON public.calendario_eventos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_cal_eventos_setor ON public.calendario_eventos(setor_responsavel);
CREATE INDEX IF NOT EXISTS idx_cal_eventos_letivo ON public.calendario_eventos(conta_como_dia_letivo);
CREATE INDEX IF NOT EXISTS idx_cal_eventos_bimestre ON public.calendario_eventos(bimestre);

-- 5. Função e Trigger para Auditoria e Cômputo Automático dos 200 Dias
CREATE OR REPLACE FUNCTION public.fn_validar_dias_letivos_calendario(p_calendario_id UUID)
RETURNS TABLE (
    total_dias_letivos_programados BIGINT,
    meta_cumprida BOOLEAN,
    dias_restantes_para_meta BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH computo AS (
        SELECT COALESCE(SUM((data_fim - data_inicio) + 1), 0) AS total
        FROM public.calendario_eventos
        WHERE calendario_id = p_calendario_id
          AND conta_como_dia_letivo = true
    )
    SELECT 
        c.total,
        (c.total >= 200),
        GREATEST(0, 200 - c.total)
    FROM computo c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Políticas de Segurança em Nível de Linha (Row Level Security - RLS)
ALTER TABLE public.calendarios_letivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;

-- Leitura universal: professores, gestores escolares e comunidade podem consultar a agenda
CREATE POLICY "Leitura pública e autenticada de calendários"
ON public.calendarios_letivos FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Leitura pública e autenticada de eventos do calendário"
ON public.calendario_eventos FOR SELECT
TO anon, authenticated
USING (true);

-- Modificação estrita: restrita aos perfis GABINETE e SUPERVISAO_ATENA
CREATE POLICY "Mutação restrita de calendários letivos"
ON public.calendarios_letivos FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.perfis_usuarios p
        WHERE p.id = auth.uid() 
          AND p.papel IN ('ADMIN_GABINETE', 'SUPERVISAO_ATENA')
    )
);

CREATE POLICY "Mutação restrita de eventos de calendário"
ON public.calendario_eventos FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.perfis_usuarios p
        WHERE p.id = auth.uid() 
          AND p.papel IN ('ADMIN_GABINETE', 'SUPERVISAO_ATENA')
    )
);
```

---

### 3.4. Esquema JSON Canônico para Consumo SPA e Cache Offline

O modelo JSON abaixo é o contrato de dados transmitido para a SPA e armazenado no navegador sob a chave `localStorage['olympos_calendario_2026']`, possibilitando operação sem internet:

```json
{
  "$schema": "https://olympos.smeb.cearamirim.rn.gov.br/schemas/calendario_v1.json",
  "versao_calendario": "2026.2",
  "ano_letivo": 2026,
  "municipio": "Ceará-Mirim/RN",
  "orgao_gestor": "Secretaria Municipal de Educação Básica (SMEB)",
  "resolucao_homologacao_cme": "Resolução CME nº 004/2025",
  "metas_legais": {
    "dias_letivos_obrigatorios": 200,
    "horas_letivas_obrigatorias": 800,
    "dias_letivos_planejados": 201,
    "dias_letivos_concluidos": 52
  },
  "bimestres": [
    { "bimestre": 1, "data_inicio": "2026-02-09", "data_fim": "2026-04-24", "dias_letivos": 51 },
    { "bimestre": 2, "data_inicio": "2026-04-27", "data_fim": "2026-07-03", "dias_letivos": 49 },
    { "bimestre": 3, "data_inicio": "2026-07-27", "data_fim": "2026-10-02", "dias_letivos": 50 },
    { "bimestre": 4, "data_inicio": "2026-10-05", "data_fim": "2026-12-18", "dias_letivos": 51 }
  ],
  "eventos": [
    {
      "id": "evt-2026-001",
      "titulo": "Jornada Pedagógica da Rede Municipal — Acolhimento Docente",
      "tipo_evento": "JORNADA_PEDAGOGICA",
      "setor_responsavel": "PEDAGOGICO_ATENA",
      "data_inicio": "2026-02-02",
      "data_fim": "2026-02-06",
      "conta_como_dia_letivo": false,
      "impacto_logistico": {
        "transporte_escolar_alunos": false,
        "transporte_escolar_professores": true,
        "merenda_escolar": false
      },
      "unidades_afetadas": ["TODAS"],
      "cor_etiqueta": "#8B5CF6"
    },
    {
      "id": "evt-2026-002",
      "titulo": "Início das Aulas — 1º Bimestre Letivo",
      "tipo_evento": "DIA_LETIVO_REGULAR",
      "setor_responsavel": "GABINETE",
      "data_inicio": "2026-02-09",
      "data_fim": "2026-02-09",
      "conta_como_dia_letivo": true,
      "impacto_logistico": {
        "transporte_escolar_alunos": true,
        "transporte_escolar_professores": false,
        "merenda_escolar": true
      },
      "unidades_afetadas": ["TODAS"],
      "cor_etiqueta": "#10B981"
    },
    {
      "id": "evt-2026-015",
      "titulo": "Sábado Letivo Temático — Mostra Cultural e Científica",
      "tipo_evento": "SABADO_LETIVO_TEMATICO",
      "setor_responsavel": "PEDAGOGICO_ATENA",
      "data_inicio": "2026-03-21",
      "data_fim": "2026-03-21",
      "conta_como_dia_letivo": true,
      "impacto_logistico": {
        "transporte_escolar_alunos": true,
        "transporte_escolar_professores": false,
        "merenda_escolar": true
      },
      "unidades_afetadas": ["TODAS"],
      "cor_etiqueta": "#F59E0B"
    },
    {
      "id": "evt-2026-028",
      "titulo": "Recesso Escolar Discente do Meio de Ano & Manutenção de Frotas",
      "tipo_evento": "RECESSO_ESCOLAR",
      "setor_responsavel": "TRANSPORTE",
      "data_inicio": "2026-07-06",
      "data_fim": "2026-07-24",
      "conta_como_dia_letivo": false,
      "impacto_logistico": {
        "transporte_escolar_alunos": false,
        "transporte_escolar_professores": false,
        "merenda_escolar": false
      },
      "unidades_afetadas": ["TODAS"],
      "cor_etiqueta": "#64748B"
    }
  ]
}
```

---

### 3.5. Estratégias de Integração: Google Calendar e PWA Offline-First

#### Integração Google Calendar API & Feed iCal (RFC 5545)
1. **Sincronização Bidirecional via Google Apps Script:**
   - O repositório Olympos dispõe do módulo GAS (`1_google_apps_script/hub_webapp/01_router_main.gs`) com permissões nativas para utilizar a classe `CalendarApp`.
   - Implementa-se uma rotina de acionamento periódico (`syncCalendarioOlymposToGoogle()`) disparada por gatilho temporal a cada 6 horas. A rotina consulta o endpoint REST do Supabase e sincroniza a agenda oficial institucional da SMEB (`educacao@cearamirim.rn.gov.br`).
2. **Subscrição iCal Pública (`.ics`):**
   - Disponibilização de um endpoint no Google Apps Script servindo a especificação RFC 5545 com cabeçalho `Content-Type: text/calendar; charset=utf-8`.
   - O professor ou gestor pode clicar no botão **"📅 Assinar Calendário"** na SPA e conectar a agenda institucional diretamente ao Apple Calendar, Outlook ou Google Agenda de seu smartphone pessoal.

#### Suporte PWA Offline-First e Service Worker
- **Interceptação no Service Worker (`sw.js`):** A requisição do calendário é classificada na estratégia de *Stale-While-Revalidate*. Caso o usuário esteja em uma localidade rural sem sinal de telefonia (ex: Assentamento Rosário ou Polo Primeirinho), o Service Worker serve imediatamente a última versão validada em cache do `localStorage`.
- **Fila de Sincronização em Segundo Plano (*Background Sync API*):** Propostas de alteração de datas ou reposições registradas offline pela direção escolar são guardadas no IndexedDB local e despachadas para o Supabase assim que a conexão de dados for restabelecida.

---

## 4. PARTE III: Matriz de Riscos, Governança e Cronograma de Implantação

### 4.1. Matriz de Análise e Mitigação de Riscos

| Risco Identificado | Severidade | Probabilidade | Mitigação Estruturada |
| :--- | :---: | :---: | :--- |
| **Atraso na disponibilização dos Microdados do Censo pelo INEP** | Média | Alta | Utilização temporária da base de migração do Educacenso local da SMEB como contingência. |
| **Suspensão imprevista de dias letivos por chuvas torrenciais na zona rural** | Alta | Média | O sistema calcula automaticamente o déficit letivo e apresenta sugestões de sábados letivos de recomposição homologáveis pelo CME. |
| **Vazamento acidental de dados de beneficiários do Bolsa Família** | Crítica | Baixa | Hashing obrigatório HMAC-SHA256, exclusão de NIS/CPF das interfaces abertas e auditoria com trilha de logs imutável. |
| **Desperdício de merenda em sábados letivos com baixa adesão** | Média | Média | Notificação prévia obrigatória da direção escolar com confirmação de quórum discente estimada com 5 dias úteis de antecedência. |

---

### 4.2. Cronograma Físico de Implantação (4 Fases)

```
2026
Semana:    S1  S2  S3  S4  S5  S6  S7  S8  S9  S10 S11 S12
Fase 1:   [====] (Migrações SQL Supabase & DDL de Calendário)
Fase 2:       [======] (Pipeline ETL Censo/IDEB & Hashing LGPD)
Fase 3:             [======] (Módulo Calendário Intersetorial & PWA)
Fase 4:                   [====] (Capacitação dos 6 Setores & Homologação CME)
```

1. **Fase 1 (Semanas 1 a 2):** Execução das migrações SQL no Supabase, criação dos tipos enumerados, índices, triggers e políticas RLS.
2. **Fase 2 (Semanas 3 a 5):** Implementação dos conectores Python em `pipeline/inteligencia_escolar/` para ingestão dos dados do Censo Escolar, IDEB e Sistema Presença com algoritmo SRE.
3. **Fase 3 (Semanas 6 a 8):** Construção da interface na SPA Olympos (`#calendario` e `#analytics`), integração com Leaflet e sincronizador Google Calendar/iCal.
4. **Fase 4 (Semanas 9 a 12):** Testes de carga em polos rurais, capacitação de articuladores e homologação da Portaria Anual pelo Conselho Municipal de Educação.

---

## 5. Conclusão e Próximos Passos

O presente projeto de engenharia estabelece a base conceitual, matemática e arquitetural necessária para transformar a SMEB de Ceará-Mirim em referência estadual de gestão orientada a dados. A integração simultânea do **Módulo de Calendário Escolar Intersetorial** e do **Dashboard da Ideia 05** assegura que o município mantenha plena conformidade com a LDB 9.394/96, zele pela correta aplicação dos recursos do PNAE e Fundeb e atue de forma preditiva contra a evasão escolar, protegendo as trajetórias educacionais de milhares de estudantes cearamirinenses.
