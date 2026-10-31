# Projeto Olympos 🏛️

**Plataforma Web e Motores Automatizados de Dados Públicos**  
*Secretaria Municipal de Educação Básica (SMEB) — Ceará-Mirim / RN*

---

## Visão Geral

Este repositório hospeda exclusivamente a camada essencial pública do **Projeto Olympos**:

1. **Frontend SPA (GitHub Pages):** Interface modular responsiva (`2_github_pages_actions/frontend_spa/`) com suporte a temas Claro/Escuro e autenticação segura via **Supabase Auth**.
2. **Fogo de Prometheus (GitHub Actions):** Coletor diário automatizado de publicações públicas do Diário Oficial dos Municípios (FEMURN).
3. **O Papiro de Cadmo (GitHub Actions):** Motor mensal de coleta e normalização de dados públicos dos portais da transparência para gestão de permutas intermunicipais.

---

## Estrutura Pública Essencial

```text
Olympos/
├── .github/
│   └── workflows/
│       ├── deploy_pages.yml              # Publicação automática do Frontend SPA no GitHub Pages
│       ├── fogo_prometheus_cron.yml      # Coleta diária de atos públicos (FEMURN)
│       └── papiro_cadmo_cron.yml         # Coleta mensal de portais públicos da transparência (RN)
├── 2_github_pages_actions/
│   ├── frontend_spa/                     # Interface Web estática servida via GitHub Pages
│   └── engines/                          # Motores Python executados pelos runners do GitHub Actions
│       ├── fogo_de_prometheus/
│       └── papiro_de_cadmo/
├── .gitignore
└── README.md
```

---

## Segurança e Privacidade

- **Zero Credenciais no Código:** Todas as chaves de integração, endpoints e tokens são injetados exclusivamente em tempo de execução via **GitHub Actions Secrets** ou configurados localmente pelo operador autenticado.
- **Isolamento de Camadas Internas:** Módulos internos de backend, migrações de banco de dados, personas operacionais, relatórios e manuais administrativos permanecem estritamente fora do versionamento público.
