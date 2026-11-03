# Hub Olympos V2 — Frontend Desacoplado (GitHub Pages)

Interface web moderna, responsiva e modular do **Hub Olympos** da Secretaria Municipal de Educação Básica (SMEB) de Ceará-Mirim/RN, projetada para hospedagem estática no **GitHub Pages** e integração direta com o backend em **Google Apps Script (GAS)** e **GitHub Actions (GHA)**.

---

## 🏛️ Arquitetura do Sistema

```
                   ┌────────────────────────────────────────┐
                   │    Frontend Estático (GitHub Pages)    │
                   │   HTML5 + CSS Modular + Vanilla JS     │
                   └──────────────────┬─────────────────────┘
                                      │
                   Requisições JSON   │ (POST via text/plain
                     Sem Preflight    │  sem bloqueio CORS)
                                      ▼
                   ┌────────────────────────────────────────┐
                   │       Backend Serverless (GAS)         │
                   │    doPost() Gateway + SHA-256 Auth     │
                   └──────┬──────────────────────────┬──────┘
                          │                          │
              Operações   │              Automação   │ Gatilho
              em Lote     │              Contínua    │ de Scraping
                          ▼                          ▼
               ┌─────────────────────┐    ┌─────────────────────┐
               │    Google Drive /   │    │   GitHub Actions    │
               │ Google Sheets (SMEB)│    │ Fogo de Prometheus  │
               │  Documentos & Lotes │    │   Papiro de Cadmo   │
               └─────────────────────┘    └─────────────────────┘
```

---

## ✨ Recursos da Versão 2.0

1. **Paleta Harmônica 60-30-10:**
   - **60% Dominante:** Telas limpas, fundos neutros (`#f8fafc` / `#ffffff`) ou escuros profundos (`#0f172a` / `#1e293b`).
   - **30% Estrutural:** Azul-marinho institucional (`#1e293b` / `#334155`) para topbars, cartões e botões primários.
   - **10% Destaque:** Ouro solar potiguar (`#d97706` / `#f59e0b`) para botões de ação e contadores vitais.
2. **Modo Escuro Completo:** Alternância suave com persistência via `localStorage` e suporte ao padrão do sistema operacional.
3. **Identidade Visual por Persona:** Ícones SVG personalizados para cada uma das 17 personas do ecossistema SMEB.
4. **Sem IDs Técnicos Expostos:** Nomes claros de documentos, planilhas e pastas com botões diretos de "Abrir no Drive ↗".
5. **Autenticação Integrada (Login):** Autenticação por usuário e senha com hash SHA-256 + salt e permissões baseadas em função (Gabinete, RH, Pedagógico, Jurídico).
6. **Cadastro Direto de Licenças no Hub:** Inserção de servidores diretamente na planilha de Licenças com cálculo automático da data de término e geração imediata opcional.
7. **Detecção e Exibição de Links em Lotes:** Quando um lote de portarias ou certificados conclui, os links diretos para cada arquivo gerado são exibidos com botão de cópia com 1 clique.
8. **Busca Global Multi-Ano Recursiva:** Busca fonética/tokenizada varrendo pastas ativas de 2026 e acervos de 2025.

---

## 🚀 Como Publicar nas 2 Frentes Unificadas (GitHub Monorepo + GAS)

### Opção 1 (Recomendada): Monorepo Unificado do Hub Olympos
Na raiz do projeto (`Projetos Bases/`), a pasta `.github/workflows/` já integra as três automações sem expor códigos Python/GAS no site público:
- `deploy-hub-pages.yml` — Publica **exclusivamente** a pasta `hub-olympos-frontend/` no GitHub Pages.
- `fogo_prometheus_cron.yml` — Executa o coletor diário FEMURN (`07:00 BRT`, seg–sex) e envia para o receptor único no GAS (`hub-olympos-webapp`).
- `papiro_cadmo_mensal.yml` — Executa o ETL mensal dos 16 portais potiguares (todo dia 12 às `03:00 UTC`).

### Opção 2: Repositório Dedicado Apenas ao Frontend
1. Caso versionado isoladamente a partir de `hub-olympos-frontend/`, acesse **Settings > Pages > Source: GitHub Actions**.
2. A action `hub-olympos-frontend/.github/workflows/deploy-pages.yml` publicará a interface automaticamente no push da branch `main`.

---

## 🔌 Conexão com o Backend Google Apps Script

O frontend se comunica via requisições POST para a URL do Web App do Google Apps Script.

1. No editor do projeto GAS (`hub-olympos-webapp`), clique em **Implantar > Nova Implantação**.
2. Selecione o tipo **Aplicativo da Web**:
   - **Executar como:** *Eu (seu e-mail de administrador)*
   - **Quem pode acessar:** *Qualquer pessoa*
3. Copie a **URL do Aplicativo da Web** gerada (terminada em `/exec`).
4. Abra a interface do frontend no navegador, clique no ícone de engrenagem **⚙️** no canto superior direito e cole a URL.
5. Clique em **Testar Conexão** e depois em **Salvar URL**.

---

## 🔒 Autenticação e Perfis RBAC (Supabase Auth)

A autenticação é gerenciada nativamente pelo **Supabase Auth** com controle de acesso baseado em funções (RBAC):

| Perfil RBAC | Setor / Domínio | Acesso Permitido |
| :--- | :--- | :--- |
| `ADMIN_GABINETE` | Gabinete do Secretário | Acesso total a todas as abas, memórias e auditoria |
| `RH_COMISSAO` | Setor Pessoal / RH | Visão Geral, Portarias, Licenças e Servidores |
| `PEDAGOGICO_EVENTOS` | Coordenação Pedagógica | Visão Geral, Certificados, Declarações e Eventos |
| `JURIDICO` | Assessoria Jurídica | Visão Geral, Pareceres, Licenças e Auditoria Legal |

*Nota de Segurança: O sistema não armazena nem utiliza senhas fixas em texto claro. Novos usuários e credenciais são provisionados via Supabase Auth.*

---

## 📁 Estrutura de Arquivos Modular

```
hub-olympos-frontend/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml  # Deploy automático para GitHub Pages
├── index.html                # Aplicação SPA modular com navegação por páginas
├── styles.css                # Folha de estilo (Paleta 60-30-10 + Dark Mode)
├── js/
│   ├── api.js                # Comunicação JSON (doPost) com o Google Apps Script
│   ├── icons.js              # Dicionário de ícones SVG únicos por persona
│   ├── router.js             # Roteador SPA baseado em Hash (#oficios, #licencas, etc.)
│   ├── app.js                # Controlador principal, autenticação e sessão
│   └── views/                # Módulos e páginas individuais isoladas
│       ├── visaoGeral.js     # Página: Visão Geral e KPIs do Gabinete
│       ├── oficios.js        # Página: Emissão Rápida de Ofícios PR/2018
│       ├── portarias.js      # Página: Pincel de Homero (Lotes e links gerados)
│       ├── licencas.js       # Página: Cadastro Direto de Licenças no Hub
│       ├── certificados.js   # Página: A Lira de Orfeu (Certificados/Declarações)
│       ├── diarioOficial.js  # Página: Fogo de Prometheus (Diário Oficial FEMURN)
│       ├── papiroCadmo.js    # Página: O Papiro de Cadmo (Permutas RN)
│       ├── personas.js       # Página: Personas & Memórias Operacionais (.md)
│       ├── busca.js          # Página: Busca Global Multi-Ano no Acervo
│       └── configuracoes.js  # Página: Conexão com API GAS e ajustes do tema
└── README.md                 # Documentação e instruções de implantação
```
