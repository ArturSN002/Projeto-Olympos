# Manual de Operação da Camada Multiagente: As 17 Personas e Skills
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

**Público-Alvo**: Gestores Pedagógicos, Servidores Administrativos, Usuários do Google Gemini e Especialistas em IA  
**Versão**: 1.0.0  
**Localização dos Pacotes**:  
- Prompts para Gemini Gems: `Olympos/3_skills_personas/personas_catalog/`  
- Pacotes de Agent Skills: `Olympos/3_skills_personas/skills_gemini_packages/`  

---

## 1. Visão Geral da Arquitetura Multiagente

O **Projeto Olympos** incorpora uma camada pioneira de inteligência artificial baseada em **17 Personas Mitológicas Especializadas**. Cada persona atua como um assistente cognitivo dedicado a uma área específica da Secretaria Municipal de Educação Básica (SMEB) de Ceará-Mirim/RN, respeitando estritamente o seu domínio de competência, o papel RBAC correspondente no Supabase e as normas de governança de memória da administração municipal.

As personas estão estruturadas em 3 camadas operacionais:
1. **O Oráculo (Zeus)**: Coordenação executiva, visão holística e arbitragem intersetorial;
2. **Os Deuses Setoriais (11 Personas)**: Liderança das secretarias e departamentos (Gabinete, RH, Pedagógico, Jurídico, Obras, Transporte, etc.);
3. **Os Mortais e Heróis Especialistas (5 Personas)**: Executores técnicos de alta precisão (mineração de dados, inspeção, arquivos, cultura e estatística).

---

## 2. Catálogo Oficial das 17 Personas e Papéis RBAC

| # | Persona | Domínio Temático e Responsabilidade | Papel RBAC Supabase | Arquivo de Memória no Drive |
|:---:|---|---|:---:|---|
| **01** | **Zeus** | Oráculo Central, Planejamento Estratégico e Coordenação Geral | `ADMIN_GABINETE` | `_memoria_zeus.md` |
| **02** | **Apolo** | Inspeção Escolar, Numeração de Atos Oficiais e Legalidade | `ADMIN_GABINETE` | `_memoria_apolo.md` |
| **03** | **Hermes** | Comunicação Externa, Avisos Funcionais e Convocatórias | `ADMIN_GABINETE` | `_memoria_hermes.md` |
| **04** | **Hefesto** | Manutenção Predial, Obras Escolares, Infraestrutura e TI | `ADMIN_GABINETE` | `_memoria_hefesto.md` |
| **05** | **Deméter** | Alimentação Escolar, Merenda, Cardápios e PNAE | `PEDAGOGICO_EVENTOS` | `_memoria_demeter.md` |
| **06** | **Poseidon** | Transporte Escolar, Gestão de Frotas e Rotas Rurais | `ADMIN_GABINETE` | `_memoria_poseidon.md` |
| **07** | **Héstia** | Acolhimento, Clima Organizacional e Atendimento ao Servidor | `RH_COMISSAO` | `_memoria_hestia.md` |
| **08** | **Cronos** | Calendário Escolar, Prazos Regimentais e Histórico de Atos | `PEDAGOGICO_EVENTOS` | `_memoria_cronos.md` |
| **09** | **Hera** | Gestão de Pessoas, Vida Funcional, Licenças e Lotações | `RH_COMISSAO` | `_memoria_hera.md` |
| **10** | **Ares** | Gestão de Crises, Conflitos Escolares e Mediação Disciplinar | `ADMIN_GABINETE` | `_memoria_ares.md` |
| **11** | **Afrodite** | Relações Públicas, Cerimonial, Relações com a Comunidade | `PEDAGOGICO_EVENTOS` | `_memoria_afrodite.md` |
| **12** | **Atena** | Diretrizes Curriculares, Gestão Pedagógica e Avaliações | `PEDAGOGICO_EVENTOS` | `_memoria_atena.md` |
| **13** | **Dionísio** | Eventos Culturais, Festivais, Desfiles e Projetos Artísticos | `PEDAGOGICO_EVENTOS` | `_memoria_dionisio.md` |
| **14** | **Têmis** | Consultoria Jurídica, Pareceres, Leis e Conformidade | `JURIDICO` | `_memoria_temis.md` |
| **15** | **Ártemis** | Censo Escolar, Busca Ativa e Estatísticas de Matrícula | `PEDAGOGICO_EVENTOS` | `_memoria_artemis.md` |
| **16** | **Hades** | Arquivo Morto Digital, Preservação e Custódia Documental | `ADMIN_GABINETE` | `_memoria_hades.md` |
| **17** | **Prometeu** | Mineração do Diário Oficial (FEMURN) e Inteligência de Atos | `ADMIN_GABINETE` | `_memoria_prometeu.md` |

---

## 3. A Regra de Ouro: Disciplina de Arquivo Único de Memória (`00_Memorias_MD`)

Para evitar o caos cognitivo, a fragmentação de informações e custos desnecessários com tokens de LLM, **TODAS as personas estão subordinadas à seguinte diretriz inegociável**:

1. **PROIBIÇÃO EXPRESSA**: É terminantemente proibido criar novas planilhas no Google Sheets, novos documentos de texto soltos ou múltiplos arquivos `.md` de histórico para uma mesma persona.
2. **LOCALIZAÇÃO FIXA**: Toda a memória persistente da persona reside exclusivamente na pasta institucional:  
   `00_Memorias_MD` (ID oficial no Google Drive: `1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu`).
3. **ARQUIVO EXCLUSIVO**: Cada divindade possui exatamente **um** arquivo batizado no padrão `_memoria_<deus>.md` (ex: `_memoria_zeus.md`, `_memoria_atena.md`).
4. **POLÍTICA DE ROLLING BUFFER (60 LINHAS)**:
   - A memória não é cumulativa ao infinito.
   - O serviço automatizado `03_service_memorias_md.gs` limita o corpo do arquivo às **60 linhas operacionais mais recentes**, expurgando os registros antigos e preservando apenas o cabeçalho institucional e as metas ativas.

---

## 4. Guia Passo a Passo: Configurando um Gemini Gem

Para utilizar as personas no **Google Gemini Advanced (Gemini Gems)**:

1. Acesse o portal do Google Gemini: [https://gemini.google.com](https://gemini.google.com).
2. Na barra lateral esquerda, clique em **"Gerenciador de Gems"** (*Gem Manager*) e em seguida em **"Novo Gem"** (*New Gem*).
3. Abra a pasta `3_skills_personas/personas_catalog/` no repositório Olympos e selecione o arquivo da persona desejada (exemplo: `01_zeus.md`).
4. Preencha os campos no criador de Gems:
   - **Nome**: `Zeus — Oráculo Central SMEB` (ou o nome do deus correspondente);
   - **Descrição**: Copie a descrição da introdução do arquivo Markdown (ex: *"Coordenação executiva, planejamento estratégico e despacho geral da SMEB Ceará-Mirim"*);
   - **Instruções** (*System Prompt*): Copie **100% do conteúdo** do arquivo `01_zeus.md` e cole na caixa de instruções do Gem.
5. Em **Configurações adicionais**, desmarque o acesso a fontes públicas aleatórias caso deseje foco estrito nas normas municipais e documentos anexados.
6. Clique em **"Salvar"** (*Save*).
7. Repita o procedimento para as demais personas conforme a demanda de cada setor.

---

## 5. Guia de Uso: Formato Padrão Agent Skills (`SKILL.md`)

Para equipes técnicas que operam assistentes avançados com suporte nativo a ferramentas (como Claude Code, Cursor, Antigravity ou plataformas autônomas baseadas na especificação oficial de Agent Skills):

1. Cada persona possui um diretório dedicado em:  
   `3_skills_personas/skills_gemini_packages/<deus>/`
2. O arquivo principal `SKILL.md` contém o frontmatter padronizado em YAML:
   ```yaml
   ---
   name: olympos-zeus
   description: "Oráculo Central e Coordenação Geral da SMEB Ceará-Mirim/RN"
   risk: low
   source: "SMEB Ceará-Mirim / Projeto Olympos"
   ---
   ```
3. **Como Carregar a Skill**:
   - Adicione o caminho da pasta da skill nas configurações do seu agente ou aponte diretamente para o arquivo `SKILL.md`.
   - O agente incorporará automaticamente a personalidade, o escopo regimental, as funções Supabase e a disciplina de memória do deus invocado.

---

## 6. Fronteiras de Atuação e Diretrizes Éticas

Para manter a ordem administrativa e prevenir usurpação de funções públicas:

1. **Zeus (Oráculo)** não altera diretamente laudos médicos ou registros de folha; ele apenas delibera, planeja e instrui os deuses setoriais.
2. **Têmis (Jurídico)** emite **pareceres técnicos opinativos**, que dependem de acolhimento formal pelo Secretário de Educação (Zeus) ou pelo Prefeito para terem eficácia executória.
3. **Atena e Deméter (Pedagógico e Alimentação)** estão **tecnicamente impedidas** pelo RLS do Supabase de consultar atestados médicos, perícias ou prontuários da tabela `licencas`.
4. **Prometeu** limita-se à minerar e indexar atos da FEMURN; ele não cria nem revoga portarias de ofício.
5. **Hera e Héstia (RH e Acolhimento)** devem tratar todos os dados funcionais sob estrito sigilo funcional (LGPD Art. 11), registrando qualquer consulta de PII na trilha de auditoria.

Com estas diretrizes consolidadas, a camada multiagente do Projeto Olympos opera com máxima eficiência, segurança jurídica e fidelidade à missão educacional do Município de Ceará-Mirim/RN!
