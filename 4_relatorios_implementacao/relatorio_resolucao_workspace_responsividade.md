# Relatório de Conclusão: Resolução de Integração com Workspace e Aprimoramento da Responsividade

**Projeto Olympos — SMEB Ceará-Mirim/RN**  
**Data:** 03 de Novembro de 2026  
**Status do Portão de Qualidade:** Aprovado com 100% de Sucesso (70/70 Testes Automatizados)

---

## 1. Visão Geral das Metas Concluídas

Atendendo às diretrizes estabelecidas pelas metas operacionais:
1. **/goal resolver problemas de integração com o Workspace:**
   - Erradicação definitiva do erro de Google Apps Script `Argumento grande demais: key` (`Argument too large: key`) ao atualizar números sequenciais de portarias e ofícios.
   - Restauração completa do carregamento e exibição dos valores reais das planilhas oficiais de **Licenças** e **Readaptações Funcionais** no Pincel de Homero.
   - Saneamento universal de referências residuais do arquivo de Apolo (`1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_`), eliminando qualquer menção ao ID legado (`1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn`).
   - Correção do identificador de modelo de Readaptação (`1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce5`).
2. **/goal Ajustar a responsividade:**
   - Reestruturação da barra superior (masthead/topbar) com recolhimento seguro e gaveta lateral deslizante (*navigation drawer*) em telas de smartphones (320px, 375px, 480px) e tablets (768px, 860px).
   - Eliminação de qualquer corte de avatar, botões ou sobreposição da badge "Visão Geral" no mobile.
   - Alinhamento ergonômico e restrição de largura máxima de leitura para telas ultra-wides (1600px, 1920px, 2560px, 3440px / 21:9 / 32:9).

---

## 2. Diagnóstico de Causa-Raiz e Resoluções Implementadas

### 2.1. Erro "Argumento grande demais: key" no Google Apps Script
* **Causa-Raiz Técnica:** O serviço nativo do Google Apps Script `CacheService` impõe um limite estrito de **250 caracteres** para chaves de busca (`key`). Quando o frontend do Hub autenticado via Supabase emitia chamadas (`chamar('atualizar_contador_md', ...)`), o token JWT enviado no corpo da requisição (com cerca de 800 a 1.200 caracteres) era repassado diretamente para `cache.get(cleanToken)` e `cache.put(sessionToken, ...)`. Isso disparava imediatamente a exceção `Argument too large: key` antes que a ação de gravação do número pudesse ser executada.
* **Resolução Implementada:**
  - Criação da função auxiliar `gerarCacheKeyToken_(token)` em `1_google_apps_script/hub_webapp/01_router_main.gs`.
  - Se a chave for superior a 150 caracteres, calcula um resumo criptográfico SHA-256 via `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str)`, gerando uma chave imutável de 68 caracteres (`jwt_` + 64 hexadecimais), 100% compatível com os limites do GAS.
  - Inclusão de blocos `try/catch` defensivos e cacheamento do perfil decodificado por 1 hora, eliminando roundtrips redundantes à API do Supabase.

### 2.2. Não Retorno dos Valores das Planilhas de Licenças e Readaptações
* **Causa-Raiz Técnica:**
  - No arquivo `05_module_pincel_homero.gs`, a função `listarPlanilhasEAbaPincel(operacao)` apenas injetava a planilha oficial quando `operacao === 'LICENCAS'`. Para `READAPTACOES`, a planilha oficial (`1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0`) não era carregada, e a varredura buscava na pasta de destino de portarias geradas (`174FW9KKkpfRY8NDOydG1rDGlZnnXUkxQ`), retornando zero planilhas.
  - Além disso, a função de diagnóstico `executarDiagnosticoPincelHomero` não retornava as linhas tabulares de amostra lidas da planilha, apenas contagens numéricas.
* **Resolução Implementada:**
  - Normalização insensível a maiúsculas/minúsculas para `operacao` (`LICENCAS` e `READAPTACOES`).
  - Injeção mandatória de `PINCEL_READAPT_PLANILHA` (`1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0`) quando a modalidade for Readaptações.
  - Injeção mandatória de `PINCEL_LICENCAS_PLANILHA` (`1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc`) quando a modalidade for Licenças.
  - Implementação de `obterDadosLinhasPlanilhaPincel` e enriquecimento de `executarDiagnosticoPincelHomero` com o array `amostraLinhas`, contendo `{ linha, servidor, matricula, cargo, portaria, status, valida, motivo }`.
  - Renderização direta na UI de uma tabela estilizada com os registros reais lidos da planilha (`portarias.js` e `ui_scripts.html`).

### 2.3. Saneamento dos IDs de Apolo e Portaria de Readaptação
* **Resolução Implementada:**
  - Correção do ID do modelo de portaria de readaptação para `1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce5` (eliminado o '4' residual).
  - Substituição de todas as ocorrências de `1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn` pelo ID oficial canônico `1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_` em `07_module_olho_apolo.gs`, `05_module_pincel_homero.gs`, `visaoGeral.js` e `ui_scripts.html`.

### 2.4. Aprimoramento da Responsividade (Mobile e Ultra-Wides)
* **Mobile (320px, 375px, 480px, 768px):**
  - Barra superior (`.top-masthead`) com altura compacta de 50px, sem quebra de linhas nem corte de avatares.
  - Botão de alternância de menu mobile (`#mobileMenuToggleBtn`) fixado na esquerda ao lado da marca `Olympos`.
  - Trilho de navegação transformado em gaveta lateral deslizante (*side drawer*) com cabeçalho explicativo, botão de fechamento `✕` e backdrop escuro com clique para fechar.
  - Cards de indicadores (`#page-visao-geral`) com empilhamento vertical responsivo e botões de ação fluidos.
  - Tabelas encapsuladas com `-webkit-overflow-scrolling: touch; overflow-x: auto;`.
* **Ultra-Wides (1600px, 1920px, 2560px, 3440px / 21:9 / 32:9):**
  - Alinhamento centralizado com contenção de leitura (`max-width: 1600px` para formulários e textos descritivos).
  - Escalonamento progressivo da variável `--container-max` (1540px, 1840px, 2240px, 2800px).
  - Grade de KPIs e cards de personas em 3 ou 4 colunas proporcionais, evitando estiramento excessivo.

---

## 3. Matriz de Arquivos Modificados e Sincronizados

| Arquivo | Componente / Frente | Modificação Principal |
| :--- | :--- | :--- |
| `1_google_apps_script/hub_webapp/01_router_main.gs` | Backend GAS | `gerarCacheKeyToken_` (digest SHA-256), rotas `portarias_ler_planilha` e `portarias_obter_dados` |
| `1_google_apps_script/hub_webapp/05_module_pincel_homero.gs` | Backend GAS | Integração de `1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0`, `obterDadosLinhasPlanilhaPincel`, retorno de `amostraLinhas` |
| `1_google_apps_script/hub_webapp/07_module_olho_apolo.gs` | Backend GAS | Erradicação de `1wGlcqqTuWAyy` -> `1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_` |
| `1_google_apps_script/hub_webapp/ui_index.html` | Interface GAS | Cabeçalho e botão de fechar da gaveta mobile (`.drawer-header`) |
| `1_google_apps_script/hub_webapp/ui_scripts.html` | Scripts GAS | Renderização da tabela de dados das planilhas e alinhamento de IDs |
| `1_google_apps_script/hub_webapp/ui_styles.html` | Estilos GAS | Sincronização completa de CSS mobile e ultra-wide |
| `2_github_pages_actions/frontend_spa/styles.css` | Frontend SPA | Media queries mobile (320px–768px), drawer lateral e ultra-wide (1600px–3440px) |
| `2_github_pages_actions/frontend_spa/css/style.css` | Frontend SPA | Espelho estrito de `styles.css` |
| `2_github_pages_actions/frontend_spa/index.html` | Frontend SPA | Estrutura da gaveta lateral (`.drawer-header`) |
| `2_github_pages_actions/frontend_spa/js/views/portarias.js` | Frontend SPA | Exibição da tabela de valores da planilha oficial em lote |
| `2_github_pages_actions/frontend_spa/js/views/visaoGeral.js` | Frontend SPA | ID canônico de Apolo `1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_` |
| `tests/test_canonical_ids_and_cors.py` | Testes | Novos testes `test_09` e `test_10` para chaves GAS e planilhas Pincel |

---

## 4. Resultados da Bateria de Testes Automatizados

Execução via `python tests/run_all_tests.py`:
- **Total de Módulos:** 7
- **Total de Testes:** 70
- **Testes Aprovados:** 70
- **Falhas / Erros:** 0
- **Taxa de Sucesso:** 100.0%
- **Portão de Qualidade:** Aprovado
