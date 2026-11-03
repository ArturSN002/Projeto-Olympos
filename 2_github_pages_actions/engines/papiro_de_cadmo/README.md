# O Papiro de Cadmo 📜
### Coletor Automatizado de Dados de Servidores para Gestão de Permutas Intermunicipais (RN)
**Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB) de Ceará-Mirim/RN**

---

## 1. Visão Geral
O **Papiro de Cadmo** é o motor ETL autônomo (Python + Playwright + GitHub Actions) encarregado de coletar mensalmente as folhas de pagamento públicas de **15 municípios potiguares** e do **Governo do Estado do Rio Grande do Norte (SEEC)**.

Os arquivos são consolidados em um único arquivo padronizado:
`servidores-intermunicipais-AAAA-MM.csv`

E arquivados diretamente na pasta do Setor Pessoal no Google Drive:
- **Pasta Setor Pessoal (Drive):** `1VxVVONEJya4XqI2GfxHK7AFqk8dpwX9I`
- **Planilha de Permutas:** `1fOZHe871yxu6UdF0vsRzjSzQBc7AVFRZZtx3JSCdwCY`

---

## 2. Entes Federativos Cobertos
1. **Governo do Estado do RN:** https://remuneracao.rn.gov.br/ (SEEC prioritária)
2. **Natal:** https://www2.natal.rn.gov.br/transparenciaapi/folha_pagamentos (filtro SME)
3. **Parnamirim:** TopSolutions RN
4. **São Gonçalo do Amarante:** Portal municipal
5. **Macaíba:** TopSolutions RN
6. **Extremoz:** TopSolutions RN
7. **Ceará-Mirim:** TopSolutions RN (base de controle local)
8. **Nísia Floresta:** TopSolutions RN
9. **Monte Alegre:** TopSolutions RN (competência defasada n-2)
10. **Ielmo Marinho:** TopSolutions RN
11. **São Paulo do Potengi:** TopSolutions RN
12. **João Câmara:** TopSolutions RN (fallback histórico 12/2024)
13. **Poço Branco:** TopSolutions RN (fallback 07/2026)
14. **Taipú:** TopSolutions RN
15. **Touros:** TopSolutions RN
16. **Rio do Fogo:** TopSolutions RN (fallback 07/2026)

---

## 3. Esquema Consolidado do CSV
| Coluna | Descrição | Exemplo |
| :--- | :--- | :--- |
| `ente_origem` | Nome do município ou Estado | Natal |
| `competencia` | AAAA-MM de referência | 2026-09 |
| `matricula` | Matrícula no ente cedente | 123456-7 |
| `nome_completo` | Nome do servidor (UPPERCASE) | MARIA DA SILVA OLIVEIRA |
| `cargo_funcao` | Cargo efetivo ou comissionado | PROFESSOR DE ENSINO FUNDAMENTAL |
| `carga_horaria` | Carga horária semanal | 30h |
| `lotacao_orgao` | Secretaria ou escola de origem | SECRETARIA MUNICIPAL DE EDUCACAO |
| `situacao_vinculo` | Vínculo funcional | ATIVO / CEDIDO |

---

## 4. Integração com as Personas do Projeto Olympos
- **Cadmo (`cadmo` - Camada 3B):** Consulta prioritária na folha local e, caso não localizado, varredura instantânea na base intermunicipal consolidada.
- **Hera (`hera` - Camada 2):** Validação de vínculos funcionais em termos de permuta e atestos mensais de efetividade.
- **Arquimedes (`arquimedes` - Camada 3B):** Auditoria semestral de acúmulo de cargos e compatibilidade de horários intermunicipais.
