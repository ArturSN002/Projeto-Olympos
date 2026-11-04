#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes Expandido: test_fases_1_a_5_expansion.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

Bateria detalhada e abrangente de testes automatizados cobrindo as 5 novas fases do Projeto Olympos:
- Fase 1: Boletim diário por e-mail em 04_module_prometheus.gs, regex e múltiplos destinatários
          (BOLETIM_DESTINATARIOS_EMAIL), retenção de resumo_texto, novas rotas em 01_router_main.gs,
          e upload direto Google Drive via Service Account (GCP_SA_KEY) em scraper_femurn.py.
- Fase 2: Botão ✨ Gemini (#topGeminiBtn, .btn-gemini-companion), regra @media (max-width: 768px)
          { display: none !important; }, e função companion window ergonômica.
- Fase 3: manifest.json (validação de JSON, cores #0B1120/#D4AF37, display: standalone, ícones SVG/ICO),
          sw.js (cache estático seguro e bypass estrito de requisições POST e endpoints Supabase/GAS),
          e meta tags/registro no index.html.
- Fase 4: Skeleton Loaders (.skeleton-shimmer, .skeleton-table-row, .skeleton-cell), microinterações :active,
          alvos móveis >= 44-48px, Empty States ricos, cache RBAC em sessionStorage, e paralelismo com
          ThreadPoolExecutor em papiro_de_cadmo/extractors/run_all.py.
- Fase 5: Painel de permutas com Leaflet.js, escolas e polos georreferenciados, fórmula do motor Hera
          (40/30/30), migração SQL 004_semantic_search_pgvector.sql (validação sqlglot), e RPC
          match_publicacoes_semanticas.
- Paridade de Espelhos: styles.css <-> css/style.css, workflows <-> workflows_mirror, e sincronização GAS.
"""

import json
import os
import py_compile
import re
import subprocess
import unittest
from pathlib import Path

import sqlglot

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
GAS_DIR = OLYMPOS_ROOT / "1_google_apps_script" / "hub_webapp"
SPA_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa"
ENGINES_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "engines"
MIGRATIONS_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "supabase" / "migrations"
WORKFLOWS_DIR = OLYMPOS_ROOT / ".github" / "workflows"
MIRROR_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "workflows_mirror"


def check_node_v8_syntax(code: str, filename: str) -> tuple[bool, str]:
    """Valida a sintaxe JavaScript utilizando o compilador V8 do Node.js via vm.Script."""
    node_eval = """
const vm = require('vm');
const fs = require('fs');
const code = fs.readFileSync(0, 'utf-8');
try {
    new vm.Script(code, { filename: process.argv[1] || 'inline.js' });
    process.exit(0);
} catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
}
"""
    try:
        proc = subprocess.run(
            ["node", "-e", node_eval, filename],
            input=code,
            text=True,
            capture_output=True,
            timeout=15,
            encoding="utf-8"
        )
        if proc.returncode == 0:
            return True, ""
        return False, proc.stderr.strip()
    except Exception as exc:
        return False, str(exc)


class TestFases1A5Expansion(unittest.TestCase):
    """Bateria de testes automatizados e aprofundados para as Fases 1 a 5 e espelhos."""

    # =========================================================================
    # FASE 1: BOLETIM DIÁRIO E-MAIL, ROTAS HUB GAS E UPLOAD DIRETO DRIVE GCP SA
    # =========================================================================

    def test_01_fase1_prometheus_boletim_email_editorial_template(self):
        """Assegura a existência do template editorial responsivo do boletim diário com paleta institucional."""
        gs_file = GAS_DIR / "04_module_prometheus.gs"
        self.assertTrue(gs_file.exists(), f"04_module_prometheus.gs não encontrado: {gs_file}")

        code = gs_file.read_text(encoding="utf-8")
        self.assertIn("montarHtmlBoletimEditorial_", code, "Função de template editorial ausente em 04_module_prometheus.gs")
        self.assertIn("enviarBoletimExecutivoEmail", code, "Dispatcher enviarBoletimExecutivoEmail ausente")
        self.assertIn("dispararBoletimEmailManual", code, "Função dispararBoletimEmailManual ausente")

        # Verifica paleta institucional Olympos (#0B1120 e #D4AF37) no HTML inline
        self.assertIn("#0B1120", code, "Cor institucional escura (#0B1120) ausente no template do boletim")
        self.assertIn("#D4AF37", code, "Cor de acento solar (#D4AF37) ausente no template do boletim")

        # Verifica componentes estruturais do template
        self.assertIn("Boletim Diário Executivo", code, "Título institucional ausente no template")
        self.assertIn("urlDrive", code, "Botão/link de acesso ao Google Drive ausente no template do boletim")
        self.assertIn("servidores", code, "Seção de identificação NER de servidores ausente no boletim")

    def test_02_fase1_prometheus_boletim_multiple_recipients_and_regex(self):
        """Valida resolução em cascata e extração com regex de múltiplos destinatários de e-mail."""
        gs_file = GAS_DIR / "04_module_prometheus.gs"
        code = gs_file.read_text(encoding="utf-8")

        self.assertIn("extrairDestinatariosBoletimPrometheus_", code, "Função extrairDestinatariosBoletimPrometheus_ ausente")
        self.assertIn("BOLETIM_DESTINATARIOS_EMAIL", code, "Propriedade BOLETIM_DESTINATARIOS_EMAIL não referenciada")
        self.assertIn("EMAIL_PARTICULAR", code, "Fallback EMAIL_PARTICULAR não referenciado")
        self.assertIn("EMAIL_RESUMO_PARTICULAR", code, "Fallback EMAIL_RESUMO_PARTICULAR não referenciado")

        # Simula e testa o algoritmo de validação e regex empregado na função GAS
        email_regex = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
        raw_test_inputs = "gabinete@cearamirim.rn.gov.br; rh@cearamirim.rn.gov.br,juridico@cearamirim.rn.gov.br\nsuporte@cearamirim.rn.gov.br\tadmin@cearamirim.rn.gov.br; invalido@, outro@teste.com"
        tokens = re.split(r"[,\s;]+", raw_test_inputs)
        valid_emails = []
        for token in tokens:
            cleaned = token.strip().lower()
            if cleaned and email_regex.match(cleaned) and cleaned not in valid_emails:
                valid_emails.append(cleaned)

        self.assertEqual(len(valid_emails), 6, f"Esperado 6 e-mails válidos extraídos, obtido: {len(valid_emails)}")
        self.assertIn("gabinete@cearamirim.rn.gov.br", valid_emails)
        self.assertIn("outro@teste.com", valid_emails)
        self.assertNotIn("invalido@", valid_emails)

    def test_03_fase1_prometheus_resumo_texto_retention_and_drive_bypass(self):
        """Assegura retenção de resumo_texto e bypass de decodificação Base64 quando url_drive já existir."""
        gs_file = GAS_DIR / "04_module_prometheus.gs"
        code = gs_file.read_text(encoding="utf-8")

        # Verifica retenção de resumo_texto nos itens persistidos
        self.assertRegex(
            code,
            r"resumo:\s*pub\.resumo_texto\s*\|\|\s*pub\.resumo\s*\|\|\s*['\"]['\"]",
            "Retenção de resumo_texto ausente no mapeamento de resultadosSalvos"
        )

        # Verifica verificação prévia de url_drive para evitar upload redundante Base64
        self.assertRegex(
            code,
            r"let\s+fileUrl\s*=\s*pub\.url_drive\s*\|\|\s*pub\.urlDrive",
            "Verificação de url_drive pré-existente ausente antes de upload Drive Base64"
        )

    def test_04_fase1_router_gateway_new_routes(self):
        """Verifica a presença das novas rotas de configuração e disparo do boletim no gateway Hub GAS."""
        router_file = GAS_DIR / "01_router_main.gs"
        self.assertTrue(router_file.exists(), f"01_router_main.gs não encontrado: {router_file}")

        code = router_file.read_text(encoding="utf-8")
        self.assertIn("case 'prometheus_boletim_config_obter':", code, "Rota 'prometheus_boletim_config_obter' ausente no switch")
        self.assertIn("case 'prometheus_boletim_config_salvar':", code, "Rota 'prometheus_boletim_config_salvar' ausente no switch")
        self.assertIn("case 'prometheus_boletim_disparar':", code, "Rota 'prometheus_boletim_disparar' ausente no switch")

    def test_05_fase1_scraper_femurn_drive_sa_upload_and_fallback(self):
        """Valida upload direto no Google Drive via Service Account e pastas de governança 2026."""
        scraper_file = ENGINES_DIR / "fogo_de_prometheus" / "src" / "scraper_femurn.py"
        self.assertTrue(scraper_file.exists(), f"scraper_femurn.py não encontrado: {scraper_file}")

        # Validação de compilação sintática
        try:
            py_compile.compile(str(scraper_file), doraise=True)
        except py_compile.PyCompileError as exc:
            self.fail(f"Erro de compilação em scraper_femurn.py: {exc}")

        code = scraper_file.read_text(encoding="utf-8")
        self.assertIn("FOLDER_PORTARIAS_2026", code, "Constante FOLDER_PORTARIAS_2026 ausente")
        self.assertIn("FOLDER_GABINETE_2026", code, "Constante FOLDER_GABINETE_2026 ausente")
        self.assertIn("FOLDER_JURIDICO_2026", code, "Constante FOLDER_JURIDICO_2026 ausente")
        self.assertIn("upload_pdf_direto_drive", code, "Função upload_pdf_direto_drive ausente")
        self.assertIn("obter_pasta_drive_destino", code, "Função obter_pasta_drive_destino ausente")
        self.assertIn("GCP_SA_KEY", code, "Variável de ambiente GCP_SA_KEY não referenciada")

        # Verifica integração de upload e alívio do payload Base64
        self.assertIn("upload_pdf_direto_drive", code)
        self.assertIn('url_drive_sa = sa_drive_res.get("url", "")', code)
        self.assertIn('"url_drive": url_drive_sa', code)
        self.assertIn('pdf_b64 = ""', code, "Alívio de payload Base64 ausente após upload direto")

    # =========================================================================
    # FASE 2: POP-UP / JANELA COMPANION FLUTUANTE DO GEMINI (DESKTOP ONLY)
    # =========================================================================

    def test_06_fase2_gemini_companion_button_markup(self):
        """Verifica a presença do botão ✨ Gemini (#topGeminiBtn) na barra de topo (.masthead-controls)."""
        index_file = SPA_DIR / "index.html"
        self.assertTrue(index_file.exists(), f"index.html não encontrado: {index_file}")

        html = index_file.read_text(encoding="utf-8")
        self.assertIn('id="topGeminiBtn"', html, "Botão #topGeminiBtn ausente em index.html")
        self.assertIn("btn-gemini-companion", html, "Classe btn-gemini-companion ausente no botão do Gemini")
        self.assertIn("Gemini", html, "Texto 'Gemini' ausente no botão")
        self.assertIn("✨", html, "Ícone '✨' ausente no botão do Gemini")

    def test_07_fase2_gemini_desktop_only_media_query_css(self):
        """Garante a regra estrita @media (max-width: 768px) { display: none !important; } para o botão Gemini."""
        css_file = SPA_DIR / "styles.css"
        css_mirror = SPA_DIR / "css" / "style.css"

        for f in [css_file, css_mirror]:
            self.assertTrue(f.exists(), f"Arquivo CSS não encontrado: {f}")
            css = f.read_text(encoding="utf-8")
            self.assertIn(".btn-gemini-companion", css, f"Classe .btn-gemini-companion ausente em {f.name}")
            
            # Verifica que o botão está configurado para display: none !important na seção mobile
            idx_media = css.find("@media (max-width: 768px)")
            self.assertNotEqual(idx_media, -1, f"Media query @media (max-width: 768px) não encontrada em {f.name}")
            mobile_section = css[idx_media:]
            
            rule_pattern = re.compile(
                r"#topGeminiBtn,\s*\.btn-gemini-companion\s*\{\s*display:\s*none\s*!important;",
                re.IGNORECASE
            )
            self.assertTrue(
                rule_pattern.search(mobile_section),
                f"Regra display: none !important para mobile (<=768px) ausente em {f.name}"
            )

    def test_08_fase2_gemini_companion_window_js_implementation(self):
        """Valida a função de abertura ergonômica da Companion Window (520x780 à direita) em js/app.js."""
        app_file = SPA_DIR / "js" / "app.js"
        self.assertTrue(app_file.exists(), f"app.js não encontrado: {app_file}")

        code = app_file.read_text(encoding="utf-8")
        self.assertIn("abrirJanelaGeminiCompanion", code, "Função abrirJanelaGeminiCompanion ausente em app.js")
        self.assertIn("https://gemini.google.com/", code, "URL oficial do Gemini não referenciada")
        self.assertIn("520", code, "Largura de 520px não configurada na janela companion")
        self.assertIn("780", code, "Altura de 780px não configurada na janela companion")
        self.assertIn("screen.availWidth", code, "Cálculo ergonômico de posicionamento lateral à direita ausente")
        self.assertIn("topGeminiBtn", code, "Botão topGeminiBtn não vinculado a listener em app.js")

    # =========================================================================
    # FASE 3: PWA OFICIAL SMEB INSTALÁVEL (MANIFEST, SERVICE WORKER, META TAGS)
    # =========================================================================

    def test_09_fase3_pwa_manifest_json_validation(self):
        """Valida integridade do manifest.json, tema #0B1120, display standalone e ícones institucionais."""
        manifest_file = SPA_DIR / "manifest.json"
        self.assertTrue(manifest_file.exists(), f"manifest.json não encontrado: {manifest_file}")

        data = json.loads(manifest_file.read_text(encoding="utf-8"))
        self.assertIn("name", data, "Campo 'name' ausente no manifest.json")
        self.assertIn("short_name", data, "Campo 'short_name' ausente no manifest.json")
        self.assertEqual(data.get("display"), "standalone", "O campo 'display' deve ser 'standalone'")
        
        # Cores institucionais
        theme_color = data.get("theme_color", "").upper()
        bg_color = data.get("background_color", "").upper()
        self.assertEqual(theme_color, "#0B1120", f"theme_color incorreto: {theme_color}")
        self.assertEqual(bg_color, "#0B1120", f"background_color incorreto: {bg_color}")

        # Ícones
        icons = data.get("icons", [])
        self.assertGreaterEqual(len(icons), 2, "manifest.json deve conter ao menos 2 ícones (SVG e ICO)")
        svg_icons = [i for i in icons if "svg" in i.get("type", "").lower() or i.get("src", "").endswith(".svg")]
        ico_icons = [i for i in icons if "x-icon" in i.get("type", "").lower() or i.get("src", "").endswith(".ico")]
        self.assertGreaterEqual(len(svg_icons), 1, "Ícone SVG oficial ausente no manifest.json")
        self.assertGreaterEqual(len(ico_icons), 1, "Ícone ICO oficial ausente no manifest.json")

    def test_10_fase3_pwa_service_worker_caching_and_api_bypass(self):
        """Valida que o sw.js faz bypass estrito de POST, Supabase e GAS sem interferir em requisições de API."""
        sw_file = SPA_DIR / "sw.js"
        self.assertTrue(sw_file.exists(), f"sw.js não encontrado: {sw_file}")

        code = sw_file.read_text(encoding="utf-8")
        ok, err = check_node_v8_syntax(code, "sw.js")
        self.assertTrue(ok, f"Erro sintático V8 no Service Worker sw.js: {err}")

        # Cache de shell versionado
        self.assertRegex(code, r"olympos-shell-v\d+\.\d+\.\d+", "Versão canônica do cache shell ausente no sw.js")

        # Bypass irrestrito de requisições POST e não-GET
        self.assertIn("method !== 'GET'", code, "Bypass estrito de requisições não-GET ausente no sw.js")

        # Bypass de APIs dinâmicas
        self.assertIn("supabase.co", code, "Bypass de supabase.co ausente no sw.js")
        self.assertIn("script.google.com", code, "Bypass de script.google.com ausente no sw.js")

        # Estratégia de navegação Network-First com fallback index.html
        self.assertIn("navigate", code, "Tratamento de requisição de navegação ausente no sw.js")

    def test_11_fase3_pwa_meta_tags_and_registration_in_index_html(self):
        """Verifica meta tags de PWA móvel e registro assíncrono seguro do Service Worker no index.html."""
        index_file = SPA_DIR / "index.html"
        html = index_file.read_text(encoding="utf-8")

        self.assertIn('<link rel="manifest" href="manifest.json"', html, "Link para manifest.json ausente no head")
        self.assertIn('<meta name="theme-color" content="#0B1120"', html, "Meta theme-color #0B1120 ausente no head")
        self.assertIn('<meta name="mobile-web-app-capable" content="yes"', html, "Meta mobile-web-app-capable ausente")
        self.assertIn("navigator.serviceWorker.register('./sw.js')", html, "Registro do sw.js ausente no index.html")

    # =========================================================================
    # FASE 4: EFICIÊNCIA E UI/UX (SKELETONS, TÁTIL, ALVOS, CACHE RBAC, THREADPOOL)
    # =========================================================================

    def test_12_fase4_skeleton_loaders_css_and_js_implementation(self):
        """Valida regras de Skeleton Loaders animados e função renderSkeletonTable no frontend."""
        css = (SPA_DIR / "styles.css").read_text(encoding="utf-8")
        self.assertIn(".skeleton-shimmer", css, "Classe .skeleton-shimmer ausente no CSS")
        self.assertIn(".skeleton-table-row", css, "Classe .skeleton-table-row ausente no CSS")
        self.assertIn(".skeleton-cell", css, "Classe .skeleton-cell ausente no CSS")
        self.assertIn("@keyframes skeletonPulse", css, "Keyframes skeletonPulse ausente no CSS")

        app_code = (SPA_DIR / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("renderSkeletonTable", app_code, "Função renderSkeletonTable ausente em app.js")

        diario_code = (SPA_DIR / "js" / "views" / "diarioOficial.js").read_text(encoding="utf-8")
        self.assertIn("renderSkeletonTable", diario_code, "Acionamento de renderSkeletonTable ausente em diarioOficial.js")

    def test_13_fase4_microinteractions_active_scale(self):
        """Garante microinterações táteis (:active transform: scale(0.97)) em botões e cards."""
        css = (SPA_DIR / "styles.css").read_text(encoding="utf-8")
        pattern = re.compile(r":active[^{]*\{[^}]*transform\s*:\s*scale\(\s*0\.97\s*\)", re.IGNORECASE)
        self.assertTrue(pattern.search(css), "Microinteração :active { transform: scale(0.97) } ausente no CSS")

    def test_14_fase4_touch_targets_wcag_mobile(self):
        """Valida que em telas móveis (<= 768px) alvos de toque possuem altura mínima de 44px."""
        css = (SPA_DIR / "styles.css").read_text(encoding="utf-8")
        idx_media = css.find("@media (max-width: 768px)")
        self.assertNotEqual(idx_media, -1, "Media query mobile @media (max-width: 768px) não encontrada")
        mobile_section = css[idx_media:]
        self.assertIn("min-height: 44px !important", mobile_section, "Regra min-height: 44px !important ausente na seção mobile")

    def test_15_fase4_rich_empty_states_markup_and_css(self):
        """Assegura estilos e renderização de Empty States ricos com botões de ação na interface."""
        css = (SPA_DIR / "styles.css").read_text(encoding="utf-8")
        self.assertIn(".empty-state-card", css, "Classe .empty-state-card ausente no CSS")
        self.assertIn(".empty-state-actions", css, "Classe .empty-state-actions ausente no CSS")

        diario_code = (SPA_DIR / "js" / "views" / "diarioOficial.js").read_text(encoding="utf-8")
        self.assertIn("empty-state-card", diario_code, "Renderização de empty-state-card ausente em diarioOficial.js")

    def test_16_fase4_rbac_session_storage_cache(self):
        """Valida cache de sessão e claims RBAC em sessionStorage com método getCachedProfile."""
        client_code = (SPA_DIR / "js" / "supabase_client.js").read_text(encoding="utf-8")
        self.assertIn("sessionStorage.setItem", client_code, "Gravação em sessionStorage ausente no supabase_client.js")
        self.assertIn("getCachedProfile", client_code, "Método getCachedProfile ausente no supabase_client.js")

        app_code = (SPA_DIR / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("sessionStorage.getItem", app_code, "Leitura prioritária de sessionStorage ausente em app.js")

    def test_17_fase4_cadmo_extractors_thread_pool_executor(self):
        """Valida orquestração concorrente com ThreadPoolExecutor na extração dos 16 portais do Papiro de Cadmo."""
        run_all_file = ENGINES_DIR / "papiro_de_cadmo" / "extractors" / "run_all.py"
        self.assertTrue(run_all_file.exists(), f"run_all.py não encontrado: {run_all_file}")

        try:
            py_compile.compile(str(run_all_file), doraise=True)
        except py_compile.PyCompileError as exc:
            self.fail(f"Erro de compilação em run_all.py: {exc}")

        code = run_all_file.read_text(encoding="utf-8")
        self.assertIn("ThreadPoolExecutor", code, "ThreadPoolExecutor ausente em run_all.py")
        self.assertIn("COMPETENCIA_CUSTOM", code, "Variável COMPETENCIA_CUSTOM não referenciada")
        self.assertIn("FILTRO_ENTE_CUSTOM", code, "Variável FILTRO_ENTE_CUSTOM não referenciada")
        self.assertIn("manifesto_extracao.json", code, "Gravação do manifesto JSON de extração ausente")

    # =========================================================================
    # FASE 5: PERMUTAS GEORREFERENCIADAS (LEAFLET + HERA) E PGVECTOR SUPABASE
    # =========================================================================

    def test_18_fase5_permutas_panel_markup_and_leaflet_assets(self):
        """Verifica a presença dos assets do Leaflet 1.9.4 e o painel de permutas (#painelPermutasCadmo)."""
        html = (SPA_DIR / "index.html").read_text(encoding="utf-8")

        self.assertIn("leaflet@1.9.4/dist/leaflet.css", html, "CSS do Leaflet 1.9.4 ausente no head do index.html")
        self.assertIn("leaflet@1.9.4/dist/leaflet.js", html, "Script do Leaflet 1.9.4 ausente no index.html")
        self.assertIn('id="painelPermutasCadmo"', html, "Seção #painelPermutasCadmo ausente em index.html")
        self.assertIn('id="mapaPermutasCadmo"', html, "Div #mapaPermutasCadmo ausente em index.html")
        self.assertIn('id="formPermutaCadmo"', html, "Formulário #formPermutaCadmo ausente em index.html")
        self.assertIn('id="resultadoMatchingHera"', html, "Grade de resultados #resultadoMatchingHera ausente")

    def test_19_fase5_papiro_cadmo_georeferenced_points_and_hera_matching(self):
        """Valida catálogo georreferenciado, Leaflet map e motor de matching da persona Hera (40/30/30)."""
        cadmo_file = SPA_DIR / "js" / "views" / "papiroCadmo.js"
        self.assertTrue(cadmo_file.exists(), f"papiroCadmo.js não encontrado: {cadmo_file}")

        code = cadmo_file.read_text(encoding="utf-8")
        ok, err = check_node_v8_syntax(code, "papiroCadmo.js")
        self.assertTrue(ok, f"Erro sintático V8 em papiroCadmo.js: {err}")

        # Catálogo Georreferenciado
        self.assertIn("PONTOS_GEORREFERENCIADOS", code, "Catálogo PONTOS_GEORREFERENCIADOS ausente")
        self.assertIn("Ceará-Mirim", code, "Município Ceará-Mirim ausente no catálogo")
        self.assertIn("Natal", code, "Polo Natal ausente no catálogo")
        self.assertIn("Extremoz", code, "Polo Extremoz ausente no catálogo")
        self.assertIn("São Gonçalo do Amarante", code, "Polo SGA ausente no catálogo")
        self.assertIn("Macaíba", code, "Polo Macaíba ausente no catálogo")

        # Integração Leaflet e adaptação de tamanho
        self.assertIn("L.map", code, "Inicialização L.map ausente em papiroCadmo.js")
        self.assertIn("invalidateSize", code, "Chamada invalidateSize ausente no papiroCadmo.js")

        # Motor de Matching Hera (40/30/30)
        self.assertIn("executarMatchingHera", code, "Função executarMatchingHera ausente em papiroCadmo.js")
        self.assertIn("olympos_permutas_banco", code, "Chave de armazenamento olympos_permutas_banco ausente")
        self.assertIn("badge-excelente", code, "Badge de classificação 'excelente' ausente no matching Hera")

    def test_20_fase5_semantic_search_pgvector_migration_syntax_sqlglot(self):
        """Valida que a migração 004_semantic_search_pgvector.sql compila perfeitamente no analisador sqlglot."""
        migration_file = MIGRATIONS_DIR / "004_semantic_search_pgvector.sql"
        self.assertTrue(migration_file.exists(), f"004_semantic_search_pgvector.sql não encontrada: {migration_file}")

        sql = migration_file.read_text(encoding="utf-8")
        try:
            expressions = sqlglot.parse(sql, read="postgres")
            self.assertGreaterEqual(len(expressions), 5, "Menos de 5 declarações SQL válidas extraídas da migração pgvector")
        except Exception as exc:
            self.fail(f"Erro sintático na migração pgvector via sqlglot: {exc}")

        # Elementos DDL obrigatórios
        self.assertIn("CREATE EXTENSION IF NOT EXISTS vector", sql, "Extensão vector não criada com IF NOT EXISTS")
        self.assertIn("vector(768)", sql, "Coluna de embedding de 768 dimensões ausente")
        self.assertIn("hnsw", sql.lower(), "Índice HNSW ausente na migração pgvector")
        self.assertIn("vector_cosine_ops", sql, "Métrica vector_cosine_ops ausente no índice")
        self.assertIn("match_publicacoes_semanticas", sql, "Função RPC match_publicacoes_semanticas ausente")
        self.assertIn("SECURITY DEFINER", sql, "Função RPC deve ser SECURITY DEFINER")
        self.assertIn("SET search_path = public, extensions", sql, "search_path seguro ausente na RPC")
        self.assertIn("REVOKE ALL ON FUNCTION public.match_publicacoes_semanticas", sql, "Revogação de privilégios públicos ausente")
        self.assertIn("GRANT EXECUTE ON FUNCTION public.match_publicacoes_semanticas", sql, "Concessão a authenticated/service_role ausente")

    def test_21_fase5_supabase_client_semantic_search_integration(self):
        """Assegura a integração de busca semântica vetorial no cliente Supabase frontend com fallback."""
        client_code = (SPA_DIR / "js" / "supabase_client.js").read_text(encoding="utf-8")
        self.assertIn("buscarPublicacoesSemanticas", client_code, "Função buscarPublicacoesSemanticas ausente no supabase_client.js")
        self.assertIn("match_publicacoes_semanticas", client_code, "Chamada da RPC match_publicacoes_semanticas ausente no cliente")

    # =========================================================================
    # PARIDADE DE ESPELHOS, WORKFLOWS E INTEGRIDADE GLOBAL
    # =========================================================================

    def test_22_fase1_boletim_ui_settings_integration(self):
        """Valida a presença de campos para configuração de e-mails do boletim nas telas do Frontend."""
        html = (SPA_DIR / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="configBoletimEmailInput"', html, "Input #configBoletimEmailInput ausente em Ajustes")
        self.assertIn('id="configSalvarBoletimEmailBtn"', html, "Botão #configSalvarBoletimEmailBtn ausente em Ajustes")
        self.assertIn('id="diarioBoletimEmailInput"', html, "Input #diarioBoletimEmailInput ausente no Diário Oficial")
        self.assertIn('id="diarioSalvarBoletimEmailBtn"', html, "Botão #diarioSalvarBoletimEmailBtn ausente no Diário")

    def test_23_parity_and_mirrors_strict_integrity(self):
        """Assegura paridade estrita de 100% entre arquivos CSS, manifestos de workflows e espelhos GAS."""
        css_src = SPA_DIR / "styles.css"
        css_dst = SPA_DIR / "css" / "style.css"
        self.assertEqual(css_src.read_bytes(), css_dst.read_bytes(), "Paridade estrita falhou entre styles.css e css/style.css")

        # Workflows
        wf_files = sorted(WORKFLOWS_DIR.glob("*.yml"))
        mirror_files = sorted(MIRROR_DIR.glob("*.yml"))
        self.assertEqual(len(wf_files), len(mirror_files), "Quantidade desigual entre workflows e workflows_mirror")
        for wf, mir in zip(wf_files, mirror_files):
            self.assertEqual(wf.read_bytes(), mir.read_bytes(), f"Discrepância entre {wf.name} e seu espelho")

        # GAS UI Styles sincronizado
        gas_styles = GAS_DIR / "ui_styles.html"
        self.assertTrue(gas_styles.exists(), "ui_styles.html ausente")
        self.assertIn(".btn-gemini-companion", gas_styles.read_text(encoding="utf-8"), "ui_styles.html desatualizado sem btn-gemini-companion")
        self.assertIn(".skeleton-shimmer", gas_styles.read_text(encoding="utf-8"), "ui_styles.html desatualizado sem skeleton-shimmer")
        self.assertIn("#mapaPermutasCadmo", gas_styles.read_text(encoding="utf-8"), "ui_styles.html desatualizado sem mapaPermutasCadmo")


if __name__ == "__main__":
    unittest.main()
