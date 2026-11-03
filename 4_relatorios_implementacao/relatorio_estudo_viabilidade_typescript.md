# Estudo de Viabilidade Arquitetural e Roteiro de Transição para TypeScript no Frontend SPA (GitHub Pages)
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

**Data de Emissão:** 01 de Novembro de 2026  
**Versão:** 1.0.0 (Documento Conceitual e de Planejamento Arquitetural)  
**Autor:** Worker G2 M10 — TypeScript Migration Feasibility Study Author Worker  
**Classificação:** Engenharia de Software / Arquitetura Frontend / Governança Técnica  
**Status:** Planejado para Homologação Estratégica (Sem Implementação Imediata no Código-Fonte do SPA)  

---

## 1. Resumo Executivo e Justificativa Técnica

### 1.1. Contexto Operacional e Diagnóstico da Base de Código Atual
A aplicação cliente do **Projeto Olympos** consiste em uma Single Page Application (SPA) modularizada, hospedada estaticamente no **GitHub Pages** sob o subcaminho `/Projeto-Olympos/` (`https://artursn002.github.io/Projeto-Olympos/`), concebida para atender à Secretaria Municipal de Educação Básica (SMEB) de Bom Jesus e Ceará-Mirim/RN.

Atualmente, o frontend compreende **17 arquivos JavaScript** totalizando aproximadamente **2.810 linhas de código (LOC)** distribuídas entre serviços centrais (`js/`) e controladores de visão (`js/views/`):
- `js/icons.js` (~380 LOC): Dicionário de SVGs do sistema;
- `js/setup_modal.js` (~180 LOC): Modal interativo de configuração de chaves Supabase e URL do WebApp;
- `js/olympos_password_guard.js` (~140 LOC): Validador de entropia NIST SP 800-63B e consulta k-anonymity HaveIBeenPwned;
- `js/supabase_client.js` (~210 LOC): Camada de autenticação GoTrue, inicialização do cliente Supabase e recuperação de perfil;
- `js/api.js` (~120 LOC): Cliente HTTP para comunicação CORS-safe com o Google Apps Script (GAS);
- `js/router.js` (~170 LOC): Mecanismo de roteamento hash-based (`#visao-geral`, `#oficios`, etc.);
- `js/app.js` (~520 LOC): Ponto de entrada, despachante de RBAC, tema, ciclo de vida e modais;
- `js/views/*.js` (10 arquivos, ~1.090 LOC): Controladores de tela (`visaoGeral`, `oficios`, `portarias`, `licencas`, `certificados`, `diarioOficial`, `papiroCadmo`, `personas`, `busca`, `configuracoes`).

A despeito da excelente separação conceitual entre roteador, visualizações e serviços, a implementação atual apoia-se em **JavaScript Vanilla em formato de scripts globais**, onde cada módulo expõe suas funções atrelando propriedades diretamente ao objeto global do navegador (`window.Olympos*`). 

No `index.html`, o carregamento ocorre mediante uma cadeia sequencial de 17 tags `<script src="...">`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/icons.js"></script>
<script src="js/setup_modal.js"></script>
<script src="js/olympos_password_guard.js"></script>
<script src="js/supabase_client.js"></script>
<script src="js/api.js"></script>
<script src="js/router.js"></script>
<script src="js/views/visaoGeral.js"></script>
...
<script src="js/app.js"></script>
```

### 1.2. Problemas Críticos Decorrentes da Arquitetura Atual
A análise arquitetural identificou quatro vulnerabilidades de engenharia diretamente atreladas à ausência de compilação estática e tipagem estrita:

1. **Poluição do Namespace Global e Alto Acoplamento (`window.Olympos*`)**:
   - Cada arquivo depende tacitamente de que outros scripts já tenham executado e registrado seus métodos em `window.OlymposApp`, `window.OlymposViews`, `window.OlymposSupabase`, etc.
   - Não há isolamento de escopo via ES Modules (`import`/`export`), inviabilizando testes unitários isolados em Node.js sem instanciar simuladores completos de DOM (`JSDOM`).
2. **Fragilidade a Condições de Corrida (*Race Conditions*) no Bootstrap**:
   - Falhas transitórias no CDN do Supabase (`@supabase/supabase-js@2`) ou carregamento assíncrono atrasado de scripts fazem com que métodos de inicialização (ex: `window.OlymposSetupModal.abrirModal()`) disparem exceções do tipo `TypeError: Cannot read properties of undefined`.
3. **Desalinhamento Estrutural entre o Banco de Dados e o Cliente SPA**:
   - A camada de dados no Supabase PostgreSQL 15+ é governada por schemas rigorosos, enums estritos (`public.app_role`), colunas de chave primária UUID, campos PII criptografados (`cpf_encrypted`) e hashes de busca determinística (`cpf_hash`).
   - No frontend JavaScript, todo retorno de `supabase.from('servidores').select('*')` é interpretado como `any`. Erros tipográficos comuns (como pesquisar por `.eq('status', 'ativo')` em minúsculas quando o enum exige `'ATIVO'`, ou referenciar `podeCadastrarLicenca` em vez de `pode_cadastrar_licenca`) só se manifestam em tempo de execução no navegador do usuário final.
4. **Cache Agressivo dos Navegadores em Hospedagem Estática**:
   - Como os arquivos são servidos com seus nomes literais (`styles.css`, `app.js`), atualizações publicadas no GitHub Pages frequentemente falham em atingir os clientes imediatamente, exigindo limpezas manuais de cache (`Ctrl+F5`) por parte dos servidores públicos.

### 1.3. Justificativa Técnica para Adoção do TypeScript
A migração para **TypeScript** combinado a um empacotador estático moderno (**Vite**) resolve definitivamente os gargalos acima, entregando:
- **Type Safety de Ponta a Ponta**: Sincronização automática entre as migrações SQL do Supabase e as interfaces TypeScript do SPA via utilitário oficial `supabase gen types typescript`.
- **Validação em Tempo de Compilação (*Compile-time Guarantee*)**: Erros de tipagem, contratos quebrados de RPCs e violações de papéis RBAC (`ADMIN_GABINETE`, `RH_COMISSAO`, `PEDAGOGICO_EVENTOS`, `JURIDICO`) são interceptados no editor e no pipeline de CI/CD antes do deploy.
- **Modularidade Limpa com ES Modules (ESM)**: Erradicação integral do namespace `window.Olympos*`, adotando dependências explícitas declaradas em instruções `import` e `export`.
- **Asset Hashing e Invalidação Determinística de Cache**: Geração de bundles com assinaturas criptográficas nos nomes de arquivos (ex: `app-C3f8a1.js`), assegurando que deploys no GitHub Pages sejam instantaneamente consumidos pelos usuários.

---

## 2. Análise Comparativa de Ferramentas de Build para GitHub Pages

### 2.1. Requisitos de Hospedagem no GitHub Pages
O **GitHub Pages** é um serviço de hospedagem estática pura (Content Delivery Network). Ele não executa interpretadores Node.js, Python ou bancos de dados em tempo de requisição. Portanto, toda solução de build para TypeScript precisa satisfazer os seguintes pilares operacionais:
1. **Saída Estática Pura**: O resultado do build deve ser um diretório autocontido (convencionalmente `dist/`) composto unicamente por `index.html`, arquivos `.js` transpilados para ES2020+, folhas de estilo `.css` e ativos estáticos (`favicon.ico`, imagens, fontes).
2. **Execução Automatizada no GitHub Actions**: A compilação precisa rodar dentro de um job padronizado no runner `ubuntu-latest`, gerando o artefato de publicação sem custos adicionais de infraestrutura.
3. **Resolução de Caminho Base (*Base Path Subdirectory*)**: O repositório opera no subdiretório `https://<usuario>.github.io/Projeto-Olympos/`. Qualquer ferramenta selecionada deve suportar nativamente a parametrização de base path sem corromper URLs de scripts ou folhas de estilo.

### 2.2. Avaliação das Quatro Abordagens Tecnológicas

#### Opção A: Vite + TypeScript (Empacotador Moderno Baseado em Rollup e esbuild)
- **Mecanismo:** Utiliza o esbuild para transpilação ultrarrápida durante o desenvolvimento local e o Rollup para empacotamento estático altamente otimizado para produção.
- **Vantagens:**
  - Suporte nativo e transparente a TypeScript sem necessidade de loaders manuais complexos;
  - Empacotamento inteligente de dependências NPM (permitindo instalar `@supabase/supabase-js` diretamente via `package.json`, eliminando dependências de CDNs públicas de terceiros);
  - *Asset Hashing* automático nos arquivos de saída (`index-[hash].js`, `styles-[hash].css`), resolvendo a causa-raiz do problema de cache no navegador;
  - *Tree Shaking* e *Code Splitting* automáticos, reduzindo o tamanho de transferência na rede;
  - Suporte de primeira classe para o parâmetro `base: '/Projeto-Olympos/'`;
  - Ambiente de desenvolvimento local incomparável com *Hot Module Replacement (HMR)* abaixo de 50 milissegundos.
- **Desvantagens:** Requer configuração de um arquivo `vite.config.ts` e um passo de build no pipeline de CI/CD (Node.js 20).

#### Opção B: `tsc` Puro + Vanilla ESM (Compilação Direta 1:1 Sem Bundler)
- **Mecanismo:** Invoca o compilador oficial da Microsoft (`tsc -p tsconfig.json`) para transformar arquivos `.ts` individualmente em arquivos `.js`, mantendo a estrutura original de diretórios.
- **Vantagens:** Curva de aprendizado mínima; não introduz bundlers adicionais; saída previsível arquivo a arquivo.
- **Desvantagens:**
  - Não resolve pacotes do ecossistema NPM (como `@supabase/supabase-js`), obrigando a aplicação a continuar consumindo dependências via tags de CDN (`jsdelivr`/`esm.sh`) ou dependendo de *Import Maps* no HTML;
  - No TypeScript moderno para navegadores, importações relativas precisam declarar extensões explicitamente (ex: `import { api } from './api.js';`), o que causa atrito e confusão entre desenvolvedores;
  - Não provê hashing de assets, mantendo a vulnerabilidade de cache agressivo no GitHub Pages;
  - Não realiza minificação, *treeshaking* nem otimização de bundles.

#### Opção C: esbuild / Bun CLI (Bundler de Alta Performance em Go / Zig)
- **Mecanismo:** Executa empacotamento direto via linha de comando (`esbuild src/main.ts --bundle --outdir=dist` ou `bun build`).
- **Vantagens:** Velocidade extrema de compilação (medida em milissegundos).
- **Desvantagens:**
  - O `esbuild` por design apenas faz *transpilação* sintática e empacotamento — ele **não faz checagem de tipos** (*type checking*). Para validar tipos, ainda seria mandatório rodar `tsc --noEmit` em paralelo;
  - O suporte a Bun em runners GitHub Actions exige action dedicada (`oven-sh/setup-bun`), aumentando dependências externas no CI/CD;
  - O ecossistema de tratamento de HTML, injeção de tags de assets e plugins para Vite é muito mais maduro para aplicações corporativas.

#### Opção D: Transpilação In-Browser (Babel Standalone / SWC no Navegador)
- **Mecanismo:** Carrega os arquivos `.ts` diretamente pelo navegador e realiza a transpilação em tempo de execução via CDN.
- **Veredito:** **REJEITADA SUMARIAMENTE**. Trata-se de um severo *anti-pattern* para ambientes de produção. Gera uma latência inicial de 2 a 5 segundos por carregamento, consome excessiva CPU do cliente, depende do download prévio de scripts de 5MB+ de compiladores e impede qualquer validação estática no CI/CD.

### 2.3. Matriz Comparativa Multidimensional

| Critério Técnico | Opção A: Vite + TS | Opção B: `tsc` Puro | Opção C: esbuild / Bun | Opção D: In-Browser |
| :--- | :---: | :---: | :---: | :---: |
| **Compatibilidade Nativa GitHub Pages** | 🟢 **100% Excelente** | 🟢 100% Excelente | 🟢 100% Excelente | 🔴 Problemático |
| **Integração com Supabase Types** | 🟢 **Perfeita** | 🟡 Regular | 🟡 Regular | 🔴 Inviável |
| **Resolução de Módulos NPM (@supabase/supabase-js)** | 🟢 **Nativa via Bundler** | 🔴 Requer CDN / Import Map | 🟢 Nativa via Bundler | 🔴 Requer CDN |
| **Asset Hashing (Prevenção de Cache)** | 🟢 **Automático e Nativo** | 🔴 Inexistente | 🟡 Parcial (via flags) | 🔴 Inexistente |
| **Velocidade de Build no CI/CD** | 🟢 **Rápida (~4s a 8s)** | 🟢 Rápida (~3s) | 🟢 Ultrarrápida (<1s) | 🟢 Sem build |
| **Checagem Estrita de Tipos (`tsc --noEmit`)** | 🟢 **Integrável (npm run build)**| 🟢 Nativa | 🔴 Requer step duplo | 🔴 Inexistente |
| **Experiência de Desenvolvimento (DX & HMR)** | 🟢 **Superior (<50ms HMR)** | 🔴 Fraca (Reload manual) | 🟡 Boa | 🔴 Péssima |
| **Tamanho Final do Bundle (Tree Shaking)** | 🟢 **Mínimo e Otimizado** | 🔴 Não otimizado | 🟢 Otimizado | 🔴 Excessivo |
| **Complexidade de Manutenção a Longo Prazo** | 🟢 **Padrão da Indústria** | 🟡 Complexa para NPM | 🟡 Intermediária | 🔴 Inaceitável |
| **Veredito Final** | 🏆 **ESCOLHA DEFINITIVA** | ⚠️ Desaconselhada | ⚠️ Alternativa Secundária | ❌ Vetada |

---

## 3. Arquitetura de Empacotamento Estático no GitHub Pages

### 3.1. Resolução do Subcaminho de Projeto (`base: '/Projeto-Olympos/'`)
O GitHub Pages serve a aplicação a partir do repositório público `artursn002/Projeto-Olympos`, mapeado na URL canônica:
`https://artursn002.github.io/Projeto-Olympos/`

Se uma aplicação SPA empacotada gerar caminhos absolutos como `<script src="/assets/index.js">`, o navegador tentará buscar o recurso na raiz do domínio `https://artursn002.github.io/assets/index.js`, resultando em erros fatais HTTP 404.

No Vite, esse comportamento é resolvido no nível de configuração através da propriedade `base`:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Projeto-Olympos/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});
```
Com essa diretiva, o Vite injeta automaticamente o prefixo relativo correto em todas as importações geradas no `dist/index.html`:
```html
<script type="module" crossorigin src="/Projeto-Olympos/assets/index-C8a91b.js"></script>
<link rel="stylesheet" crossorigin href="/Projeto-Olympos/assets/index-B4f20e.css">
```

### 3.2. Estratégia de Roteamento SPA vs Limitações do GitHub Pages
Um dos maiores desafios de SPAs em servidores estáticos como GitHub Pages é que o servidor não possui lógica de reescrita de URL (*URL rewrite* ou `try_files $uri /index.html;`). 
- Se a aplicação adotasse o modo HTML5 History API (`/visao-geral`, `/oficios`), ao atualizar a página (`F5`), o GitHub Pages procuraria um diretório físico `/visao-geral/index.html` e retornaria o erro padrão 404 do GitHub.
- **Vantagem Arquitetural do Projeto Olympos**: O sistema já utiliza **Hash Routing** nativo (`#visao-geral`, `#oficios`, `#portarias`, `#licencas`, etc.). Como a porção após o caractere `#` é interpretada exclusivamente pelo navegador e jamais enviada ao servidor HTTP, a hospedagem no GitHub Pages opera com **100% de estabilidade e resiliência a recarregamentos**, dispensando hacks de redirecionamento em `404.html`.

### 3.3. Asset Hashing e Eliminação do Cache Agressivo
Na arquitetura proposta, o Vite aplica geração de *Content-Based Hashing* em todos os ativos gerados dentro de `dist/assets/`:
- `dist/assets/index-[hash].js`
- `dist/assets/supabase-[hash].js` (chunk separado do SDK)
- `dist/assets/index-[hash].css`

Quando uma nova versão do Projeto Olympos é enviada para produção:
1. O arquivo `index.html` estático recebe referências aos novos hashes gerados;
2. Como o nome do arquivo muda a cada alteração de conteúdo, o navegador é obrigado a baixar o novo arquivo imediatamente;
3. Chunks não modificados (como a biblioteca do Supabase) continuam cacheados no navegador do cliente, otimizando drasticamente o consumo de banda e o tempo de carregamento.

### 3.4. Topologia Física da Árvore de Diretórios do Frontend SPA Refatorado
A estrutura recomendada para a transição preserva a separação de responsabilidades em `2_github_pages_actions/frontend_spa/`:

```
2_github_pages_actions/frontend_spa/
├── package.json                   # Dependências (vite, typescript, @supabase/supabase-js)
├── tsconfig.json                  # Configuração TypeScript rigorosa (strict: true)
├── vite.config.ts                 # Configuração de build, base path e chunks
├── index.html                     # HTML raiz (ponto de entrada apontando para /src/main.ts)
├── public/                        # Ativos estáticos intocados (favicon, logos, manifest)
│   ├── favicon.ico                # Favicon padrão da aplicação
│   └── favicon.svg                # Ícone vetorial SVG
├── dist/                          # Diretório de saída gerado pelo build (ignorado no git)
└── src/
    ├── main.ts                    # Bootstrap: inicializa auth, roteador e listeners de DOM
    ├── styles/
    │   ├── styles.css             # Design tokens, proporção 60-30-10, temas light/dark
    │   └── responsive.css         # Media queries para viewports 375px a 1920px
    ├── types/
    │   ├── database.types.ts      # Tipos gerados diretamente do schema PostgreSQL Supabase
    │   ├── rbac.types.ts          # Definições estritas de perfis, permissões e JWT claims
    │   └── api.types.ts           # Interfaces de DTO do Gateway Google Apps Script
    ├── services/
    │   ├── supabase.service.ts    # Singleton com tipagem Database e normalização de URL
    │   ├── gas-api.service.ts     # Cliente tipado para chamadas de integração com GAS
    │   ├── password-guard.ts      # Validação NIST e k-anonymity HaveIBeenPwned
    │   └── icons.service.ts       # Provedor tipado de SVGs do sistema
    ├── router/
    │   └── router.ts              # Roteador por hash com ciclo de vida tipado
    ├── components/
    │   ├── setup-modal.ts         # Modal de configuração de ambiente e chaves
    │   └── user-create-modal.ts   # Modal de criação e delegação de usuários para ADMIN_GABINETE
    └── views/                     # Controladores de visão tipados implementando BaseView
        ├── visaoGeral.view.ts
        ├── oficios.view.ts
        ├── portarias.view.ts
        ├── licencas.view.ts
        ├── certificados.view.ts
        ├── diarioOficial.view.ts
        ├── papiroCadmo.view.ts
        ├── personas.view.ts
        ├── busca.view.ts
        └── configuracoes.view.ts
```

---

## 4. Pipeline de CI/CD no GitHub Actions

### 4.1. Evolução do Fluxo de Publicação
Atualmente, o arquivo de workflow `.github/workflows/deploy_pages.yml` (espelhado em `2_github_pages_actions/workflows_mirror/deploy_pages.yml`) limita-se a empacotar os arquivos brutos do repositório:
```yaml
# Fluxo Legado Atual (Sem Build Step)
- name: 3. Empacotar exclusivamente o Frontend Estático
  uses: actions/upload-pages-artifact@v3
  with:
    path: "2_github_pages_actions/frontend_spa"
```

Com a migração para TypeScript, o pipeline do GitHub Actions assume o papel de **Portão de Qualidade Compilado (*Automated Quality Gate*)**, interceptando qualquer violação de tipos ou quebra de contrato antes que a aplicação seja disponibilizada no GitHub Pages.

### 4.2. Especificação do Workflow de CI/CD com Vite e Typecheck
Abaixo está o manifesto YAML completo planejado para o novo pipeline de build e deploy:

```yaml
name: "Olympos — Build & Deploy Frontend (GitHub Pages)"

on:
  push:
    branches: ["main"]
    paths:
      - "2_github_pages_actions/frontend_spa/**"
      - ".github/workflows/deploy_pages.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "olympos-pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: 2_github_pages_actions/frontend_spa

    steps:
      - name: 1. Checkout do Monorepo Olympos
        uses: actions/checkout@v4

      - name: 2. Configurar Ambiente Node.js 20 LTS
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
          cache-dependency-path: "2_github_pages_actions/frontend_spa/package-lock.json"

      - name: 3. Instalar Dependências Determinísticas (npm ci)
        run: npm ci

      - name: 4. Portão de Qualidade: Validação Estrita de Tipos (Typecheck)
        run: npm run typecheck

      - name: 5. Compilação e Empacotamento de Produção (Vite Build)
        run: npm run build

      - name: 6. Configurar Metadados do GitHub Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true

      - name: 7. Empacotar Artefato de Saída (dist/)
        uses: actions/upload-pages-artifact@v3
        with:
          path: "2_github_pages_actions/frontend_spa/dist"

      - name: 8. Publicar Artefato Compilado no GitHub Pages CDN
        id: deployment
        uses: actions/deploy-pages@v4
```

### 4.3. Análise de Impacto em Tempo de Build e Cotas do GitHub Actions
1. **Consumo de Minutos e Cotas**:
   - O repositório `artursn002/Projeto-Olympos` é público. De acordo com as diretrizes de faturamento do GitHub, **repositórios públicos possuem cota ilimitada de minutos gratuitos para runners padrão Ubuntu (`ubuntu-latest`)**.
2. **Tempo de Execução por Deploy**:
   - *Workflow Legado:* ~18 a 22 segundos (apenas upload e deploy);
   - *Workflow com TypeScript e Vite:*
     - Checkout: ~3 segundos;
     - Setup Node + Cache Restore: ~2 segundos;
     - `npm ci` (com cache de pacotes): ~6 a 10 segundos;
     - `npm run typecheck` (`tsc --noEmit` incremental): ~3 a 5 segundos;
     - `npm run build` (`vite build` com esbuild/rollup): ~4 a 6 segundos;
     - Upload do artefato `dist/`: ~4 segundos;
     - Publicação no Pages: ~15 segundos.
   - **Tempo Total Estimado:** Cerca de **37 a 48 segundos** por ciclo completo. O acréscimo operacional é de apenas ~20 a 25 segundos, o que é plenamente aceitável e imperceptível no fluxo de trabalho.

---

## 5. Integração de Tipos de Ponta a Ponta com o Supabase

### 5.1. Extração Automatizada do Esquema PostgreSQL via Supabase CLI
O ecossistema Supabase disponibiliza a ferramenta oficial de geração de definições de tipos diretamente a partir da instância em nuvem do PostgreSQL:

```bash
# Comando de extração direta (autenticado via Access Token ou CLI vinculada)
npx supabase gen types typescript --project-id rbwizevjvbvjwtbwwyif > src/types/database.types.ts
```

Esse comando inspeciona as tabelas relacionais, views, enums e funções armazenadas do schema `public` e gera um arquivo TypeScript rigoroso com tipagens estáticas completas.

### 5.2. Mapeamento Rigoroso do Enum `public.app_role`
A governança de segurança do Projeto Olympos repousa sobre a enumeração PostgreSQL `public.app_role`. No arquivo gerado `database.types.ts`, esse enum é materializado como um tipo literal estrito:

```typescript
// src/types/rbac.types.ts
export type AppRole = 'ADMIN_GABINETE' | 'RH_COMISSAO' | 'PEDAGOGICO_EVENTOS' | 'JURIDICO';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string;
  role: AppRole;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface RbacPermissionSet {
  podeEmitirOficio: boolean;
  podeEmitirPortaria: boolean;
  podeCadastrarLicenca: boolean;
  podeAcessarDadosMedicosSensíveis: boolean;
  podeGerenciarUsuarios: boolean;
  podeHomologarAtosOficiais: boolean;
  podeExecutarAuditoriaTemporal: boolean;
}
```

Qualquer tentativa de atribuir strings genéricas (como `'ADMIN'`, `'admin'` ou `'GESTOR'`) em componentes visuais resultará em erro imediato do compilador TypeScript:
```typescript
// ERRO EM TEMPO DE COMPILAÇÃO:
// Type '"ADMIN"' is not assignable to type 'AppRole'.
const perfil: AppRole = 'ADMIN'; 
```

### 5.3. Tipagem das Tabelas Relacionais e Separação Row / Insert / Update
A tipagem do Supabase desacopla formalmente o formato dos dados lidos (`Row`), dos dados enviados para inserção (`Insert`) e dos dados atualizados (`Update`):

```typescript
// Exemplo representativo de database.types.ts
export interface Database {
  public: {
    Tables: {
      servidores: {
        Row: {
          id: string;
          nome: string;
          cargo: string;
          lotacao: string;
          status: 'ATIVO' | 'INATIVO' | 'AFASTADO' | 'EXONERADO';
          cpf_hash: string | null;
          matricula_hash: string | null;
          cpf_encrypted: string | null;
          matricula_encrypted: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          cargo: string;
          lotacao: string;
          status?: 'ATIVO' | 'INATIVO' | 'AFASTADO' | 'EXONERADO';
          cpf_hash?: string | null;
          matricula_hash?: string | null;
          cpf_encrypted?: string | null;
          matricula_encrypted?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          nome?: string;
          cargo?: string;
          lotacao?: string;
          status?: 'ATIVO' | 'INATIVO' | 'AFASTADO' | 'EXONERADO';
          updated_at?: string;
        };
      };
      licencas: {
        Row: {
          id: string;
          servidor_id: string;
          tipo: 'PREMIO' | 'MEDICA' | 'MATERNIDADE' | 'CAPACITACAO' | 'INTERESSE_PARTICULAR';
          status: 'SOLICITADA' | 'EM_ANALISE' | 'DEFERIDA' | 'INDEFERIDA' | 'CONCLUIDA';
          data_inicio: string;
          data_fim: string;
          dias_duracao: number;
          dados_medicos_encrypted: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          servidor_id: string;
          tipo: 'PREMIO' | 'MEDICA' | 'MATERNIDADE' | 'CAPACITACAO' | 'INTERESSE_PARTICULAR';
          status?: 'SOLICITADA' | 'EM_ANALISE' | 'DEFERIDA' | 'INDEFERIDA' | 'CONCLUIDA';
          data_inicio: string;
          data_fim: string;
          dias_duracao: number;
          dados_medicos_encrypted?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          timestamp: string;
          performed_by: string | null;
          table_name: string;
          record_id: string | null;
          action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC_DECRYPT' | 'AUTH_EVENT';
          details: Record<string, unknown> | null;
        };
        Insert: never; // Bloqueado no cliente SPA via RLS!
        Update: never; // Imutabilidade forense estrita
      };
    };
    Functions: {
      obter_servidor_detalhado_decrypted: {
        Args: {
          p_servidor_id: string;
          p_secret_key: string;
        };
        Returns: {
          id: string;
          nome: string;
          cargo: string;
          cpf_decrypted: string;
          matricula_decrypted: string;
        }[];
      };
      obter_licenca_detalhada_decrypted: {
        Args: {
          p_licenca_id: string;
          p_secret_key: string;
        };
        Returns: {
          id: string;
          servidor_id: string;
          tipo: string;
          dados_medicos_decrypted: string;
        }[];
      };
    };
    Enums: {
      app_role: AppRole;
    };
  };
}
```

### 5.4. Tipagem Segura do Cliente Singleton Supabase
Com a tipagem declarada, o cliente Supabase passa a instanciar `createClient<Database>`, garantindo autocompletação e validação estrita em todas as operações:

```typescript
// src/services/supabase.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

let instance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (instance) return instance;

  const url = localStorage.getItem('olympos_supabase_url') || '';
  const key = localStorage.getItem('olympos_supabase_anon_key') || '';

  if (!url || !key) {
    throw new Error('Supabase não configurado. Por favor, acione o setup inicial.');
  }

  instance = createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  });

  return instance;
}
```

### 5.5. Demonstração Prática: Comparativo de Consultas Antes vs Depois

#### Abordagem Legada (JavaScript Fraco e Propenso a Erros Silenciosos):
```javascript
// Nenhum aviso se a coluna 'lotacao_setor' não existir
// Nenhum aviso se 'ATIVO' for digitado como 'ativo'
// Nenhum autocomplete de propriedades no objeto 'servidor'
const { data, error } = await supabase
  .from('servidores')
  .select('id, nome, lotacao_setor') 
  .eq('status', 'ativo');

console.log(data[0].naoExiste); // undefined em runtime sem qualquer alerta!
```

#### Abordagem Proposta (TypeScript Estrito com Schema Supabase):
```typescript
const client = getSupabaseClient();

// O compilador valida:
// 1. Que a tabela 'servidores' existe no schema public;
// 2. Que 'id', 'nome' e 'cargo' são colunas válidas (erro imediato se digitar 'lotacao_setor');
// 3. Que 'ATIVO' é um valor válido para o tipo de status;
// 4. O tipo inferido de 'servidores' é estritamente Array<{ id: string; nome: string; cargo: string }>
const { data: servidores, error } = await client
  .from('servidores')
  .select('id, nome, cargo')
  .eq('status', 'ATIVO');

if (error) {
  console.error('[Servidores] Erro na consulta:', error.message);
  return;
}

// IntelliSense total no VS Code / Cursor:
servidores.forEach(servidor => {
  console.log(`Servidor: ${servidor.nome} - Cargo: ${servidor.cargo}`);
});
```

---

## 6. Matriz de Riscos, Trade-offs e Mitigações

| # | Fator de Risco | Probabilidade | Impacto | Nível de Risco | Medida Mitigatória e Estratégia de Engenharia |
|---|:---|:---:|:---:|:---:|:---|
| **R1** | **Sobrecarga de Tooling (*Toolchain Sprawl*)**<br>Introdução de `package.json`, `node_modules` e dependências locais para uma aplicação anteriormente sem build. | Baixa | Médio | **Moderado** | Manter o `package.json` minimalista com apenas 3 dependências de produção (`@supabase/supabase-js`) e dependências de desenvolvimento estritas (`vite`, `typescript`). O monorepo preserva o lockfile `package-lock.json` versionado. |
| **R2** | **Descompasso entre o Banco Supabase e os Tipos TypeScript**<br>Alterações em tabelas ou colunas no PostgreSQL não refletidas automaticamente em `database.types.ts`. | Média | Alto | **Alto** | Instituir script de automação no monorepo (`npm run types:pull`), documentado nas diretrizes de contribuição, e script de verificação no CI que valida a consistência dos tipos contra migrações SQL. |
| **R3** | **Regressão Funcional nas 10 Views Durante a Conversão**<br>Quebra inadvertida de seletores DOM ou eventos de clique durante a refatoração. | Média | Alto | **Alto** | Adoção rigorosa do padrão **Strangler Fig (Estrangulamento Gradual)**: migrar uma view por vez, preservando rigorosamente todos os IDs e classes do `index.html` e validando a paridade com a suíte de testes existente. |
| **R4** | **Incompatibilidade com a Suíte de Testes Existente (`run_all_tests.py`)**<br>`test_js_syntax.py` espera inspecionar arquivos `.js` via Node `vm.Script`. | Baixa | Médio | **Baixo** | Durante o período de transição, a compilação do Vite gera arquivos `.js` em `dist/`. O script `test_js_syntax.py` pode ser facilmente adaptado para inspecionar `dist/assets/*.js` e validar a ausência de credenciais em texto puro. |
| **R5** | **Bloqueio no CI/CD por Tipagem Excessivamente Rigorosa**<br>Build quebrar no GitHub Actions por pequenas inconsistências em bibliotecas externas. | Média | Médio | **Moderado** | Configurar o `tsconfig.json` com `skipLibCheck: true` e habilitar flags estritas progressivamente (`noImplicitAny`, `strictNullChecks`) por fases, sem impor bloqueios radicais no Dia 1. |
| **R6** | **Impacto em Contribuidores Locais Sem Node.js Instalado**<br>Dificuldade para rodar a aplicação localmente abrindo o arquivo `index.html` com duplo clique no navegador. | Baixa | Baixo | **Baixo** | Manter instruções cristalinas no `README.md` (`npm install && npm run dev`), além de prover a possibilidade de abrir o bundle pré-compilado em `dist/index.html` via servidor HTTP local leve (`python -m http.server 8000`). |

---

## 7. Roteiro Passo a Passo de Migração em 5 Fases (Strangler Fig Pattern)

A metodologia recomendada para a transição do Projeto Olympos para TypeScript é o **Padrão Strangler Fig (Figueira Estranguladora)**. Sob essa estratégia, **não se realiza uma reescrita em "Big Bang"**. A infraestrutura moderna é implantada em paralelo, o código legado em JavaScript continua executando normalmente através da diretiva `allowJs: true` do TypeScript, e os módulos são convertidos progressivamente até que o código antigo seja 100% substituído.

```
+-----------------------------------------------------------------------------------------+
|                  ROTEIRO DE MIGRAÇÃO PROGRESSIVA EM 5 FASES (STRANGLER FIG)             |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [ FASE 1: Fundação ] ---> [ FASE 2: Core & Tipos ] ---> [ FASE 3: Shell & Auth ]       |
|  - package.json            - database.types.ts           - router.ts                    |
|  - tsconfig.json           - supabase.service.ts         - setup-modal.ts               |
|  - vite.config.ts          - gas-api.service.ts          - main.ts                      |
|  - allowJs: true           - password-guard.ts           - RBAC Dispatcher              |
|                                                                    |                    |
|                                                                    v                    |
|  [ FASE 5: Strict Mode ] <-- [ FASE 4: Migração Gradual das 10 Views ]                 |
|  - strict: true              - Tier 1: Config, Visão Geral, Personas                    |
|  - Desativa allowJs          - Tier 2: Ofícios, Portarias, Licenças                     |
|  - deploy_pages.yml (build)  - Tier 3: Certificados, Diário Oficial, Papiro, Busca      |
|  - Quality Gate CI 100%                                                                 |
+-----------------------------------------------------------------------------------------+
```

---

### Fase 1: Fundação de Tooling e Coexistência Híbrida
**Objetivo:** Configurar o ecossistema Vite + TypeScript sem modificar uma única linha de lógica funcional dos scripts legados.

#### Tarefas Técnicas:
1. Criar o arquivo `package.json` em `2_github_pages_actions/frontend_spa/`:
   ```json
   {
     "name": "olympos-frontend-spa",
     "private": true,
     "version": "2.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "tsc && vite build",
       "typecheck": "tsc --noEmit",
       "preview": "vite preview"
     },
     "dependencies": {
       "@supabase/supabase-js": "^2.49.1"
     },
     "devDependencies": {
       "typescript": "^5.7.3",
       "vite": "^6.2.0"
     }
   }
   ```
2. Criar o arquivo `tsconfig.json` tolerante e híbrido:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "useDefineForClassFields": true,
       "module": "ESNext",
       "lib": ["ES2022", "DOM", "DOM.Iterable"],
       "skipLibCheck": true,
       "moduleResolution": "bundler",
       "allowImportingTsExtensions": false,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "noEmit": true,
       "allowJs": true,
       "checkJs": false,
       "strict": true,
       "noUnusedLocals": false,
       "noUnusedParameters": false,
       "noFallthroughCasesInSwitch": true
     },
     "include": ["src", "js"]
   }
   ```
3. Criar o arquivo `vite.config.ts`:
   ```typescript
   import { defineConfig } from 'vite';

   export default defineConfig({
     base: '/Projeto-Olympos/',
     build: {
       outDir: 'dist',
       emptyOutDir: true,
       sourcemap: false
     }
   });
   ```
4. **Critério de Aceite da Fase 1:** O comando `npm run build` executa sem erros, gerando uma pasta `dist/` com o `index.html` e os scripts JS legados funcionando de maneira idêntica à versão atual.

---

### Fase 2: Geração de Tipos e Migração dos Módulos Core / Serviços
**Objetivo:** Estabelecer a camada de tipagem fundamental e converter os serviços utilitários independentes em TypeScript estrito.

#### Tarefas Técnicas:
1. Gerar e fixar o catálogo de tipos `src/types/database.types.ts` a partir do projeto Supabase `rbwizevjvbvjwtbwwyif`.
2. Criar `src/types/rbac.types.ts` modelando os papéis do enum `app_role` (`ADMIN_GABINETE`, `RH_COMISSAO`, `PEDAGOGICO_EVENTOS`, `JURIDICO`) e permissões de tela.
3. Migrar `js/icons.js` para `src/services/icons.service.ts`:
   - Tipar o dicionário de ícones SVG (`Record<string, string>`).
   - Exportar a função tipada `renderIcon(nome: string): string`.
4. Migrar `js/olympos_password_guard.js` para `src/services/password-guard.ts`:
   - Tipar a resposta de validação:
     ```typescript
     export interface PasswordValidationResult {
       valida: boolean;
       score: number;
       erros: string[];
       vazada?: boolean;
     }
     ```
   - Tipar a consulta SHA-1 por k-anonymity à API HaveIBeenPwned.
5. Migrar `js/api.js` para `src/services/gas-api.service.ts`:
   - Definir interfaces de requisição e resposta para ações do Google Apps Script (`emitir_oficio`, `emitir_portaria`, `usuario_criar`, `consultar_memorias`).
6. Migrar `js/supabase_client.js` para `src/services/supabase.service.ts`:
   - Tipar o singleton `createClient<Database>()`.
   - Adicionar validação tipada de sessão e extração de perfil via `public.profiles`.
7. **Critério de Aceite da Fase 2:** Todos os serviços centrais operam em arquivos `.ts` sob `src/services/`, com tipagem estrita validada por `npm run typecheck`, sem mais injetar objetos em `window.Olympos*`.

---

### Fase 3: Roteamento, Bootstrap e Autenticação Reativa
**Objetivo:** Modernizar a casca da aplicação (*App Shell*), substituindo o ponto de entrada procedural e global por um ciclo de vida estruturado.

#### Tarefas Técnicas:
1. Migrar `js/router.js` para `src/router/router.ts`:
   - Definir interface tipada para as views:
     ```typescript
     export interface OlymposView {
       init(): Promise<void> | void;
       destroy?(): void;
     }
     ```
   - Tipar o dicionário de rotas hash (`Record<string, () => Promise<OlymposView>>`) permitindo *Lazy Loading* automático de módulos de visão.
2. Migrar `js/setup_modal.js` para `src/components/setup-modal.ts`:
   - Encapsular a lógica de captura e persistência de credenciais locais no `localStorage`.
3. Criar `src/components/user-create-modal.ts`:
   - Componente tipado para criação de usuários por administradores (`ADMIN_GABINETE`), enviando payload tipado para a ação `usuario_criar` no Google Apps Script.
4. Migrar `js/app.js` para `src/main.ts`:
   - Inicializar o listener reativo `supabase.auth.onAuthStateChange()`;
   - Despachar o perfil RBAC tipado (`ADMIN_GABINETE`, etc.) e controlar a visibilidade de abas na barra lateral e botões administrativos;
   - Gerenciar o tema visual light/dark e os manipuladores de eventos de navegação mobile (drawer toggle e auto-close).
5. **Critério de Aceite da Fase 3:** A aplicação inicializa a partir de `<script type="module" src="/src/main.ts">` no `index.html`. O ciclo de autenticação, roteamento por hash e controle de acesso RBAC funcionam com zero dependência de variáveis globais em `window`.

---

### Fase 4: Migração Modular das 10 Views SPA
**Objetivo:** Converter os 10 controladores de visão para TypeScript, aplicando tipagem estrita aos dados consumidos do Supabase e do Google Apps Script.

#### Ordem de Execução por Complexidade:
1. **Tier 1 (Telas Informativas e de Configuração):**
   - `configuracoes.view.ts`: Gerenciamento de credenciais locais e cache;
   - `visaoGeral.view.ts`: Cards de resumo, status dos serviços e catálogo das 17 personas;
   - `personas.view.ts`: Monitoramento de contadores e arquivos de memória `.md` das personas;
2. **Tier 2 (Telas Transacionais Administrativas):**
   - `oficios.view.ts`: Geração e controle da numeração sequencial de ofícios;
   - `portarias.view.ts`: Emissão e modelos de portarias da SMEB;
   - `licencas.view.ts`: Gestão de afastamentos, atestados e invocação segura da RPC auditada `obter_licenca_detalhada_decrypted`;
3. **Tier 3 (Telas Avançadas e Inteligência):**
   - `certificados.view.ts`: Formatação e emissão de certificados de conclusão;
   - `diarioOficial.view.ts`: Consulta a atos oficiais minerados pelo motor Fogo de Prometheus;
   - `papiroCadmo.view.ts`: Visualização das tabelas de remuneração e comparativos intermunicipais de 16 cidades do RN;
   - `busca.view.ts`: Pesquisa global com busca determinística por CPF/matrícula via blind index HMAC (`cpf_hash`).

#### Critério de Aceite da Fase 4:
Todas as 10 visualizações operam como classes ou módulos TypeScript independentes exportando métodos `init()`, com tipagem de dados 100% vinculada a `Database['public']['Tables']`.

---

### Fase 5: Ativação do Modo Strict, Higienização e Quality Gate no CI
**Objetivo:** Consolidar a transição, erradicar completamente o código legado e ativar o bloqueio de compilação em produção.

#### Tarefas Técnicas:
1. No `tsconfig.json`:
   - Desativar `allowJs: false`;
   - Habilitar `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`;
   - Eliminar referências à pasta legada `js/`.
2. Deletar a pasta legada `2_github_pages_actions/frontend_spa/js/` do repositório.
3. Atualizar o workflow `.github/workflows/deploy_pages.yml` com os passos de `npm ci`, `npm run typecheck` e `npm run build` apontando para o artefato `dist/`.
4. Atualizar o orquestrador de testes `tests/run_all_tests.py` e o módulo `tests/test_js_syntax.py` para validar a integridade dos artefatos em `dist/assets/` e garantir conformidade contínua de segurança.
5. Homologação final em produção através de testes de ponta a ponta na URL ao vivo `https://artursn002.github.io/Projeto-Olympos/#visao-geral`.

#### Critério de Aceite da Fase 5:
- 100% do código do SPA reside em `src/` em TypeScript;
- `npm run typecheck` conclui com **zero erros**;
- Pipeline no GitHub Actions conclui em menos de 50 segundos com deploy bem-sucedido no GitHub Pages;
- Bateria de testes automatizados `python tests/run_all_tests.py` registra **100% de aprovação (Quality Gate Aprovado)**.

---

## 8. Considerações Finais e Parecer Arquitetural

A migração do frontend SPA do **Projeto Olympos** para **TypeScript com Vite** é plenamente viável, altamente recomendada e perfeitamente compatível com a infraestrutura gratuita de hospedagem estática no **GitHub Pages**.

### Principais Benefícios Consolidados pelo Estudo:
1. **Zero Custo Adicional de Infraestrutura**: A aplicação continua operando no GitHub Pages e os builds utilizam os runners gratuitos e ilimitados do GitHub Actions para repositórios públicos;
2. **Erradicação Definitiva de Cache Agressivo**: O *Asset Hashing* nativo do Vite soluciona de forma definitiva o problema de clientes executando versões desatualizadas de scripts e folhas de estilo;
3. **Confiabilidade Institucional com Supabase**: Erros de digitação em colunas do banco, divergência em tipos de enums de papéis RBAC (`app_role`) ou falhas em chamadas de RPCs criptográficas são eliminados na raiz, protegendo a integridade dos dados e a privacidade dos servidores municipais em estrita conformidade com a LGPD;
4. **Segurança no Ciclo de Vida**: A adoção do padrão *Strangler Fig* em 5 fases assegura que a operação da SMEB não sofra interrupções, permitindo uma evolução técnica planejada, segura e transparente.

**Recomendação:** Aprovada a viabilidade técnica e arquitetural. O projeto deve manter a versão JavaScript atual em operação estável no curto prazo e iniciar a execução da **Fase 1** deste roteiro na janela oportuna do próximo ciclo evolutivo.
