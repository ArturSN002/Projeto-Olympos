#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_canonical_ids_and_cors.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

Validação automatizada de integridade referencial dos 34 IDs Canônicos e Arquitetura de Rede:
1. Mapeamento dos 34 IDs Oficiais em 02_config_ids.gs (Google Apps Script).
2. Validação estrita do ID de Readaptação: '1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce5' (sem '4' espúrio).
3. Mapeamento das 11 Memórias Canônicas e Pasta Raiz no catálogo síncrono do Frontend (memorias_catalogo.js).
4. Padrão CORS Simple Request em js/api.js (POST, text/plain;charset=utf-8, sem Authorization header HTTP, token no payload, redirect: 'follow').
5. Integridade do Catálogo Offline de Memórias (todas as 17 personas do Panteão com Markdown real, estrutura quadripartite e Drive IDs).
6. Inicialização síncrona Turno Zero de js/views/personas.js a partir do catálogo sem mensagens bloqueantes.
7. Atualização estrita in-place e suporte polimórfico Google Docs / Markdown em 03_service_memorias_md.gs.
8. Blindagem do Gateway GAS (01_router_main.gs) com tratamento universal de erros e rota pública de healthcheck.
9. Alinhamento de IDs em motores ETL Python (upload_drive.py) e manuais de instalação.
"""

import json
import re
import unittest
from pathlib import Path

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
GAS_HUB_DIR = OLYMPOS_ROOT / "1_google_apps_script" / "hub_webapp"
SPA_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa"
MANUALS_DIR = OLYMPOS_ROOT / "5_manuais_instalacao"

CONFIG_IDS_GS = GAS_HUB_DIR / "02_config_ids.gs"
ROUTER_MAIN_GS = GAS_HUB_DIR / "01_router_main.gs"
SERVICE_MEMORIAS_GS = GAS_HUB_DIR / "03_service_memorias_md.gs"

API_JS = SPA_DIR / "js" / "api.js"
MEMORIAS_CATALOGO_JS = SPA_DIR / "js" / "memorias_catalogo.js"
PERSONAS_VIEW_JS = SPA_DIR / "js" / "views" / "personas.js"
APP_JS = SPA_DIR / "js" / "app.js"
INDEX_HTML = SPA_DIR / "index.html"

UPLOAD_DRIVE_PY = OLYMPOS_ROOT / "2_github_pages_actions" / "engines" / "papiro_de_cadmo" / "pipeline" / "upload_drive.py"
MANUAL_SKILLS_MD = MANUALS_DIR / "manual_operacao_skills_personas.md"


class TestCanonicalIdsAndCorsArchitecture(unittest.TestCase):
    """Suíte de testes para auditoria de 34 IDs canônicos, protocolo CORS e catálogo offline."""

    # Dicionário canônico dos 34 IDs oficiais informados pelo gestor
    OFFICIAL_IDS = {
        # 11 Memórias Físicas Canônicas
        "memoria_apolo": "1DOt17v7gf3WD_380rYNnFX0j3IdWZaH_",
        "memoria_atena": "1bngNddimtP8nMmfhUJEa1YvkSEcmZ69Q",
        "memoria_dedalo": "16U0x5463ldiyxjgbN5IyiYNoCQQ4BdF-",
        "memoria_helio": "1JGVVV1umqhKa06nKDK5h_6TD34_Z2v90",
        "memoria_hera": "1nV-BkugwDaDiqgvodP6VV-gNFi5tRMXh",
        "memoria_hermes": "1yKxawxSXKGzT-qCWfNPN3cqVgIzcoLWH",
        "memoria_hestia": "1uUuHvJ-fsjlqK_CWrin-YBBp_0VmiJKnSBiujFUP8VM",
        "memoria_homero": "1JTB1SMgjq9Ws4E4RDBVAkH2GmCK1Fv6Q",
        "memoria_nike": "13ziWkZGuh3HSTvSjE8fXlqoPTEc-kHze",
        "memoria_orfeu": "1OUIM7SUDvEtnn08kIMyedRnp1UHKiWhF",
        "memoria_temis": "1cGAfAIynCD6xbwg7HpAx3_GLy6q0yOwt",

        # Pastas e Planilhas Globais
        "pasta_memorias_md": "1ObCWTjpzrT06n5gIW2Px8QM9nQ0SoQdu",
        "pasta_transparencia_portais": "1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD",
        "planilha_femurn": "1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY",

        # Modelos de Documentos Google Docs
        "modelo_declaracao": "17Bj5L6kMdgwYO8wZHTvdOebnzQ1jLkT_u9DBAkfC-RE",
        "modelo_licenca": "1AwMpqn0RUP9uDw7YPcPP0TsZ5MZ71Nr2gSlbRRXZ7iw",
        "modelo_oficio": "1HgPOD0BzOO3t33eN2DuRjrH64vnuoJnxyp5VX6ec8Xw",
        "modelo_readaptacao": "1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce5",

        # Pastas de 2025
        "pasta_2025_geral": "1CAt0hJR3fiuJxPVEojTxG2NORzOTM735",
        "pasta_2025_gabinete": "1vN6P_o0g98z4JyCfrRwBtfJBecDu1Kkx",
        "pasta_2025_pedagogico": "1oLKjvbiws9vW6Z-rFPu9zBph_QvxcKZw",

        # Pastas e Controles de 2026
        "pasta_2026_geral": "1ZuZBYDg08_KgYNAPcpxy-f5fP6HY4USY",
        "pasta_2026_gabinete": "16YaFjfO6DRPVzJtRzLsynrOI0llNXQ8L",
        "pasta_2026_juridico": "1N6UgdyGTVdIP4PW02dDBstsi4LIhgmRJ",
        "pasta_2026_oficios": "1UMHKKCWgJTq4YtcWni1ixL6tHKwyLpcK",
        "pasta_2026_portarias": "1QEewN0R3bCksLxLhmOSFq20EQYI3g64Q",
        "pasta_2026_femurn_publicadas": "17Dq3ST3Vv5soKFpvol9jL_gtixdxXqLp",
        "pasta_2026_permutas": "1SDBCXU3LjI0Qnf6E6O6SLqRjctHz70k0",
        "pasta_2026_administrativo": "17e4cQONqIreUTftuJ1mYTUEIVk87g-ko",
        "pasta_2026_pedagogico": "1Zsfr3zH_OPXnOloE788lNXIEPbRBP7md",
        "pasta_2026_licencas": "1So_-b_tFmr_nL2VwsbMaRCz_lUzvBUnj",
        "pasta_2026_licencas_publicadas": "1ABKy7nu7DWdI5ayGZ19mfV3So4htrMda",
        "planilha_2026_licencas": "1agqeKFfubxvmdq2oND3ndykU2037NIuOXBOHVSLS9oc",
        "pasta_2026_readaptacoes": "174FW9KKkpfRY8NDOydG1rDGlZnnXUkxQ",
        "planilha_2026_readaptacoes": "1Mz95vIv024qO62nO1USBtY2iQIrVThaeqcWYOcTQ2X0"
    }

    def test_01_all_34_official_canonical_ids_mapped_in_gas_config(self):
        """Assegura que 100% dos 34 IDs canônicos oficiais estão mapeados e sem divergências em 02_config_ids.gs."""
        self.assertTrue(CONFIG_IDS_GS.exists(), f"02_config_ids.gs não encontrado em {CONFIG_IDS_GS}")
        gs_code = CONFIG_IDS_GS.read_text(encoding="utf-8")

        # 1. Validação estrita do ID de Readaptação: NÃO pode ter o '4' excedente
        stale_typo_id = "1jgr9XX2vdePD_S2C0kd3rWwJLYBm63rs8kgOt8kce54"
        correct_readapt_id = self.OFFICIAL_IDS["modelo_readaptacao"]
        self.assertNotIn(stale_typo_id, gs_code, "ID corrompido de readaptação (...kce54) ainda presente em 02_config_ids.gs!")
        self.assertIn(correct_readapt_id, gs_code, "ID canônico de readaptação ausente em 02_config_ids.gs")

        # 2. Varredura de todos os 34 IDs canônicos no arquivo de configuração do GAS
        for key, expected_id in self.OFFICIAL_IDS.items():
            self.assertIn(expected_id, gs_code, f"ID oficial '{expected_id}' ({key}) não localizado em 02_config_ids.gs")

    def test_02_canonical_ids_in_frontend_memorias_catalogo(self):
        """Valida que o catálogo síncrono do Frontend (memorias_catalogo.js) mapeia todos os 11 IDs canônicos e pasta raiz."""
        self.assertTrue(MEMORIAS_CATALOGO_JS.exists(), f"memorias_catalogo.js não encontrado em {MEMORIAS_CATALOGO_JS}")
        cat_code = MEMORIAS_CATALOGO_JS.read_text(encoding="utf-8")

        # Pasta oficial raiz das memórias
        self.assertIn(self.OFFICIAL_IDS["pasta_memorias_md"], cat_code, "ID da pasta raiz de memórias ausente em memorias_catalogo.js")

        # 11 IDs das memórias físicas
        persona_slugs = ["apolo", "atena", "dedalo", "helio", "hera", "hermes", "hestia", "homero", "nike", "orfeu", "temis"]
        for slug in persona_slugs:
            expected_id = self.OFFICIAL_IDS[f"memoria_{slug}"]
            self.assertIn(expected_id, cat_code, f"ID canônico da persona '{slug}' ({expected_id}) ausente no catálogo frontend!")

    def test_03_cors_simple_requests_in_api_js(self):
        """Assegura a conformidade estrita de CORS Simple Requests em js/api.js contra preflight OPTIONS no GAS."""
        self.assertTrue(API_JS.exists(), f"api.js não encontrado em {API_JS}")
        api_code = API_JS.read_text(encoding="utf-8")

        # 1. Utilização de método POST
        self.assertIn("method: 'POST'", api_code, "Chamadas HTTP no api.js devem usar método POST")

        # 2. Content-Type como text/plain;charset=utf-8 (CORS Simple Request)
        self.assertIn("'Content-Type': 'text/plain;charset=utf-8'", api_code,
                      "api.js deve especificar 'Content-Type': 'text/plain;charset=utf-8' para evitar preflight OPTIONS")

        # 3. Ausência de Authorization HTTP header em chamadas para script.google.com
        self.assertNotIn("Authorization:", api_code, "api.js não deve enviar cabeçalho HTTP Authorization para o GAS")
        self.assertNotIn("'Authorization'", api_code, "api.js não deve enviar chave HTTP 'Authorization'")

        # 4. Transporte de token no corpo JSON serializado
        self.assertIn("token: token", api_code, "api.js deve injetar o token no payload do corpo")
        self.assertIn("_token: token", api_code, "api.js deve injetar _token no payload do corpo como fallback")

        # 5. Tratamento de redirecionamento explícito
        self.assertIn("redirect: 'follow'", api_code, "api.js deve declarar redirect: 'follow' explicitamente")

        # 6. Testar conexão (ping) também configurado como Simple Request
        pos_ping = api_code.find("testarConexao")
        self.assertNotEqual(pos_ping, -1, "Função testarConexao ausente em api.js")
        ping_block = api_code[pos_ping:pos_ping + 1400]
        self.assertIn("action: 'ping'", ping_block, "testarConexao deve enviar action: 'ping'")
        self.assertIn("'Content-Type': 'text/plain;charset=utf-8'", ping_block,
                      "testarConexao deve usar text/plain para não falhar com CORS")

    def test_04_offline_catalog_content_integrity_all_17_personas(self):
        """Assegura que o catálogo síncrono offline contempla todas as 17 personas com conteúdo Markdown e metadados reais."""
        cat_code = MEMORIAS_CATALOGO_JS.read_text(encoding="utf-8")

        # As 17 personas fundamentais do Panteão Olympos
        all_17_personas = [
            "Apolo", "Atena", "Dédalo", "Hélio", "Hera", "Hermes", "Héstia",
            "Homero", "Niké", "Orfeu", "Têmis", "Zeus", "Cadmo", "Arquimedes",
            "Hefesto", "Íris", "Sólon"
        ]

        for persona in all_17_personas:
            self.assertIn(f'"{persona}"', cat_code, f"Persona '{persona}' ausente do catálogo em memorias_catalogo.js")

        # Valida a presença da estrutura quadripartite padronizada nas memórias físicas
        quadripartite_sections = [
            "0. Caixa de Entrada",
            "1. Estado Atual",
            "2. Pendências Críticas",
            "3. Histórico Recente"
        ]
        for sec in quadripartite_sections:
            self.assertIn(sec, cat_code, f"Seção quadripartite obrigatória '{sec}' ausente no conteúdo do catálogo!")

        # Confirma que não há textos vazios ou placeholders genéricos como 'TODO' ou 'Lorem ipsum'
        self.assertNotIn("Lorem ipsum", cat_code)
        self.assertNotIn("Conteúdo temporário", cat_code)

    def test_05_synchronous_initialization_in_personas_js(self):
        """Valida que js/views/personas.js inicializa imediatamente a partir do catálogo e elimina mensagens bloqueantes."""
        self.assertTrue(PERSONAS_VIEW_JS.exists(), f"personas.js não encontrado em {PERSONAS_VIEW_JS}")
        personas_code = PERSONAS_VIEW_JS.read_text(encoding="utf-8")

        # Inicialização síncrona Turno Zero com disponibilidade O(0)
        self.assertIn("window.OLYMPOS_MEMORIAS_CATALOGO", personas_code,
                      "personas.js deve consumir window.OLYMPOS_MEMORIAS_CATALOGO")
        self.assertIn("listarTodas()", personas_code, "personas.js deve invocar listarTodas() na inicialização")

        # Ausência da mensagem bloqueante anterior
        blocking_msg = "Conecte-se ao Gateway GAS para carregar o conteúdo ao vivo"
        self.assertNotIn(blocking_msg, personas_code,
                         "Mensagem de bloqueio offline ainda presente em js/views/personas.js!")

        # Presença de suporte a edições locais e fallback
        self.assertIn("conteudoCompleto", personas_code, "personas.js deve renderizar conteudoCompleto imediatamente")

    def test_06_in_place_updates_and_polymorphic_mime_types_in_gas(self):
        """Assegura atualização estrita in-place e suporte a Google Docs e Markdown em 03_service_memorias_md.gs."""
        self.assertTrue(SERVICE_MEMORIAS_GS.exists(), f"03_service_memorias_md.gs não encontrado em {SERVICE_MEMORIAS_GS}")
        service_code = SERVICE_MEMORIAS_GS.read_text(encoding="utf-8")

        # 1. Prioridade para OLYMPOS_IDS.MAPA_MEMORIAS_ID para evitar IDs antigos em ScriptProperties
        self.assertIn("OLYMPOS_IDS.MAPA_MEMORIAS_ID", service_code,
                      "obterArquivoMemoriaCanonico_ deve consultar OLYMPOS_IDS.MAPA_MEMORIAS_ID prioritariamente")

        # 2. Suporte polimórfico: detecção de MIME Type
        self.assertIn("MimeType.GOOGLE_DOCS", service_code, "Serviço deve suportar detecção de MimeType.GOOGLE_DOCS")
        self.assertIn("DocumentApp.openById", service_code, "Serviço deve usar DocumentApp.openById para arquivos Google Docs")
        self.assertIn("DriveApp.getFileById", service_code, "Serviço deve usar DriveApp.getFileById para arquivos Markdown nativos")

        # 3. Vedação à criação de duplicatas soltas na edição
        self.assertIn("salvarEdicaoMemoriaOlympos", service_code)
        self.assertIn("gravarConteudoMemoria_", service_code)

    def test_07_gas_router_cors_shielding_and_public_ping(self):
        """Valida que 01_router_main.gs está blindado com try/catch, JSON garantido e rota pública de ping."""
        self.assertTrue(ROUTER_MAIN_GS.exists(), f"01_router_main.gs não encontrado em {ROUTER_MAIN_GS}")
        router_code = ROUTER_MAIN_GS.read_text(encoding="utf-8")

        # 1. Tratamento universal de exceções em doGet e doPost
        self.assertIn("try {", router_code)
        self.assertIn("catch (err)", router_code)

        # 2. Saída em JSON garantida (sem gerar páginas HTML de erro sem header CORS)
        self.assertIn("ContentService.createTextOutput(JSON.stringify(", router_code,
                      "Router GAS deve sempre retornar ContentService.createTextOutput com JSON")
        self.assertIn("setMimeType(ContentService.MimeType.JSON)", router_code,
                      "Router GAS deve sempre configurar o MimeType como JSON")

        # 3. Endpoint público de ping / healthcheck (sem tela de login)
        self.assertIn("action === 'ping'", router_code, "Router GAS deve possuir rota pública 'ping'")
        self.assertIn("action === 'status'", router_code, "Router GAS deve possuir rota pública 'status'")

        # 4. Extração de tokens de corpo de texto simples (CORS Simple Request)
        self.assertIn("e.postData.contents", router_code, "Router GAS deve ler e.postData.contents")
        self.assertIn("payload._token", router_code, "Router GAS deve extrair payload._token")

    def test_08_python_engines_and_manuals_id_alignment(self):
        """Valida o alinhamento de IDs de transparência e memórias nos motores Python e manuais técnicos."""
        self.assertTrue(UPLOAD_DRIVE_PY.exists(), f"upload_drive.py não encontrado em {UPLOAD_DRIVE_PY}")
        self.assertTrue(MANUAL_SKILLS_MD.exists(), f"manual_operacao_skills_personas.md não encontrado em {MANUAL_SKILLS_MD}")

        py_code = UPLOAD_DRIVE_PY.read_text(encoding="utf-8")
        manual_code = MANUAL_SKILLS_MD.read_text(encoding="utf-8")

        # upload_drive.py deve apontar para a pasta oficial de transparência
        transparencia_id = self.OFFICIAL_IDS["pasta_transparencia_portais"]
        self.assertIn(f'PASTA_DESTINO_PADRAO = "{transparencia_id}"', py_code,
                      f"upload_drive.py deve ter PASTA_DESTINO_PADRAO = '{transparencia_id}'")

        # manual_operacao_skills_personas.md deve apontar para a pasta oficial de memórias
        memorias_pasta_id = self.OFFICIAL_IDS["pasta_memorias_md"]
        self.assertIn(memorias_pasta_id, manual_code,
                      f"manual_operacao_skills_personas.md deve referenciar a pasta de memórias '{memorias_pasta_id}'")


if __name__ == "__main__":
    unittest.main()
