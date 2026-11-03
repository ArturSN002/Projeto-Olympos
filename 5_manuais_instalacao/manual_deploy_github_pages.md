# Manual de Deploy Contínuo no GitHub Pages
## Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

**Público-Alvo**: Engenheiros Frontend, Administradores de Release e Equipe de TI  
**Versão**: 1.0.0  
**Ambiente**: GitHub Pages com GitHub Actions  
**Repositório Alvo**: `https://github.com/ArturSN002/Projeto-Olympos`  

---

## 1. Visão Geral

A interface web de usuário do Projeto Olympos é uma **Single Page Application (SPA)** moderna, rápida e responsiva, desenvolvida em HTML5 semântico, folhas de estilo CSS3 avançadas com suporte nativo a temas Claro/Escuro (*Dark/Light Mode*) e JavaScript puro (ES6+ Vanilla).

A SPA é hospedada estaticamente através do **GitHub Pages** e atualizada automaticamente a cada push na branch `main` por meio do pipeline de CI/CD gerenciado pelo **GitHub Actions** (`.github/workflows/deploy_pages.yml`).

---

## 2. Requisitos Prévios

1. Código-fonte do Projeto Olympos publicado no repositório GitHub público `ArturSN002/Projeto-Olympos`;
2. Privilégios de administração (*Admin* ou *Maintainer*) no repositório GitHub;
3. Instância do Supabase configurada com a `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

---

## 3. Passo 1: Habilitar o GitHub Pages com Fonte em GitHub Actions

Por padrão, novos repositórios do GitHub não possuem o Pages ativado ou apontam para uma branch fixa (`gh-pages`). No Projeto Olympos, a publicação é gerida exclusivamente via **GitHub Actions Artifacts**.

1. Acesse o seu repositório no GitHub:  
   `https://github.com/ArturSN002/Projeto-Olympos`
2. No menu superior de abas do repositório, clique em **Settings** (Configurações).
3. Na barra lateral esquerda, na seção **Code and automation**, clique em **Pages**.
4. Na seção **Build and deployment**:
   - Localize o campo **Source** (Origem).
   - Altere a seleção de *"Deploy from a branch"* para:  
     👉 **"GitHub Actions"**.
5. Uma mensagem de confirmação será exibida e a página será atualizada. Nenhuma configuração adicional de branch é necessária.

```
+-------------------------------------------------------------------------+
| GitHub Pages Configuration                                              |
| Source: [ GitHub Actions                      v ]                       |
| Status: GitHub Actions is now configured to build and deploy your pages.|
+-------------------------------------------------------------------------+
```

---

## 4. Passo 2: Executar ou Disparar o Workflow de Deploy

O workflow `.github/workflows/deploy_pages.yml` já está configurado na raiz do repositório e dispara automaticamente em dois cenários:
1. Sempre que houver um `push` na branch `main` alterando arquivos dentro de `2_github_pages_actions/frontend_spa/**`;
2. Disparo manual através do botão `workflow_dispatch`.

### Como disparar o deploy manualmente pela primeira vez:
1. No repositório, clique na aba **Actions** no menu superior.
2. Na barra lateral esquerda com a lista de fluxos de trabalho, clique em:  
   **"Olympos — Deploy Frontend (GitHub Pages)"**.
3. No canto direito superior da lista de execuções, clique no menu suspenso **"Run workflow"**.
4. Mantenha a branch `main` selecionada e clique no botão verde **"Run workflow"**.
5. Aguarde cerca de 30 a 60 segundos enquanto o runner executa as etapas:
   - *Checkout do Monorepo Olympos*
   - *Configurar GitHub Pages*
   - *Empacotar exclusivamente o Frontend Estático (`2_github_pages_actions/frontend_spa`)*
   - *Publicar no GitHub Pages*
6. O status da execução mudará para um círculo verde com check (🟢 Concluído).

---

## 5. Passo 3: Identificar a URL de Produção

Após a conclusão bem-sucedida do workflow:
1. Retorne à aba **Settings > Pages** do repositório (ou veja o sumário da execução na aba **Actions**).
2. No topo da página, a caixa verde indicará o endereço oficial da aplicação online:
   - **URL Padrão**:  
     `https://ArturSN002.github.io/Projeto-Olympos/`
   - *(Opcional)* Caso a SMEB decida utilizar um domínio próprio institucional (ex: `olympos.smeb.cearamirim.rn.gov.br`), basta preenchê-lo no campo **"Custom domain"** e configurar o registro DNS CNAME correspondente.

---

## 6. Passo 4: Primeiro Acesso e Configuração Guiada da SPA

Ao abrir a URL `https://ArturSN002.github.io/Projeto-Olympos/` no navegador pela primeira vez:

1. **Apresentação do Modal de Setup**:
   - Como o repositório é público e não contém credenciais hardcoded, a aplicação exibirá automaticamente o **Modal de Configuração do Supabase** (`setup_modal.js`).
2. **Preenchimento dos Parâmetros**:
   - **Supabase URL**: Cole a URL do seu projeto (ex: `https://abcdefgh.supabase.co`);
   - **Supabase Anon Key**: Cole a chave pública anônima do Supabase.
3. **Persistência Segura**:
   - Clique em **"Salvar e Conectar"**.
   - Os parâmetros serão gravados com segurança exclusivamente no `localStorage` do navegador do operador. O código-fonte estático permanece 100% livre de segredos.
4. **Tela de Autenticação**:
   - Insira o e-mail e a senha do usuário cadastrado no GoTrue (ex: `gabinete@smeb.cearamirim.rn.gov.br`).
   - Clique em **"Entrar no Sistema"**.

---

## 7. Passo 5: Teste Funcional da Aplicação

Após o login bem-sucedido, verifique o correto carregamento dos componentes da SPA:

1. **Menu Lateral e Navegação Hash**:
   - Navegue entre as seções: *Painel Geral (Dashboard)*, *Cadastro de Servidores*, *Licenças e Afastamentos*, *Publicações do Diário (Prometeu)*, *Folhas Intermunicipais (Cadmo)* e *Personas / Skills*.
2. **Alternância de Tema (Dark / Light Mode)**:
   - Clique no ícone de sol/lua no cabeçalho superior direito.
   - Verifique que as variáveis CSS alternam instantaneamente a paleta de cores, preservando o contraste e o conforto visual.
3. **Responsividade Mobile**:
   - Pressione `F12` no teclado para abrir o DevTools e selecione a visualização de dispositivos móveis (ex: iPhone 14 ou Galaxy S20).
   - Verifique que o menu se recolhe em formato gaveta (*drawer* com botão hambúrguer) e as tabelas ativam rolagem horizontal suave sem quebra de layout.

Se todas as etapas responderam conforme o esperado, o frontend do Projeto Olympos está **oficialmente em produção e acessível publicamente via GitHub Pages!**
