#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_ui_responsiveness.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Validação automatizada de integridade da interface Frontend SPA:
- Meta tag viewport para responsividade mobile-first
- Media queries CSS (@media) e breakpoints para telas móveis e tablets
- Containers Flexbox e CSS Grid para layouts responsivos fluidos
- Variáveis CSS (Custom Properties) para temas Light e Dark (proporção 60-30-10)
- Estrutura acessível do Setup Modal (labels, inputs e botões de ação)
- Camada de resiliência e fallback do cliente Supabase no navegador
- Breakpoints defensivos para mobile pequeno (<= 480px, <= 560px) e recolhimento de masthead
- Segurança geométrica de grids CSS (minmax fluido sem transbordamento)
- Adaptabilidade mobile do grid de busca acervo (colapso em 1 coluna)
- Fechamento automático do drawer de navegação mobile ao navegar
- Rolagem vertical em modais (overflow-y e max-height para teclado virtual)
- Acessibilidade de alvos de toque (touch targets) e inércia em tabelas
- Integridade de favicons (SVG Data URI + favicon.ico binário válido)
- Conformidade DOM de atributos autocomplete e padrão Singleton do cliente GoTrue
"""

import re
import unittest
from pathlib import Path

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
SPA_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa"
CSS_FILE = SPA_DIR / "styles.css"
CSS_MIRROR = SPA_DIR / "css" / "style.css"
HTML_INDEX = SPA_DIR / "index.html"
SETUP_MODAL_JS = SPA_DIR / "js" / "setup_modal.js"
SUPABASE_CLIENT_JS = SPA_DIR / "js" / "supabase_client.js"
APP_JS = SPA_DIR / "js" / "app.js"
FAVICON_ICO = SPA_DIR / "favicon.ico"
FAVICON_SVG = SPA_DIR / "assets" / "favicon.svg"


class TestUiResponsivenessAndDesignSystem(unittest.TestCase):
    """Bateria de testes para responsividade, design system editorial e acessibilidade da SPA."""

    def test_01_viewport_meta_tag_present_in_index_html(self):
        """Assegura a presença da meta tag de viewport responsivo para renderização móvel correta."""
        self.assertTrue(HTML_INDEX.exists(), f"index.html não encontrado: {HTML_INDEX}")
        html = HTML_INDEX.read_text(encoding="utf-8")

        viewport_regex = re.compile(
            r'<meta\s+name=["\']viewport["\']\s+content=["\'][^"\']*width=device-width[^"\']*initial-scale=1(?:\.0)?["\']',
            re.IGNORECASE
        )
        self.assertRegex(html, viewport_regex, "Meta tag viewport ausente ou incorreta em index.html")

    def test_02_css_files_exist_in_primary_and_css_paths(self):
        """Valida que o arquivo de folha de estilos existe nos caminhos canônicos (styles.css e css/style.css)."""
        self.assertTrue(CSS_FILE.exists(), f"styles.css ausente: {CSS_FILE}")
        self.assertTrue(CSS_MIRROR.exists(), f"css/style.css ausente: {CSS_MIRROR}")

    def test_03_css_custom_properties_light_and_dark_themes(self):
        """Verifica a paleta de variáveis CSS no padrão editorial 60-30-10 para os modos claro e escuro."""
        css_text = CSS_FILE.read_text(encoding="utf-8")

        # Variáveis essenciais do Design System Olympos
        essential_vars = [
            "--bg-canvas",
            "--bg-surface",
            "--bg-tonal",
            "--text-main",
            "--text-secondary",
            "--text-muted",
            "--accent-gold",
            "--accent-gold-bright",
            "--border-hairline",
            "--border-strong"
        ]

        for var_name in essential_vars:
            self.assertIn(var_name, css_text, f"Variável CSS essencial '{var_name}' não definida no CSS")

        # Modo Escuro: presença de seletor [data-theme="dark"]
        self.assertIn('[data-theme="dark"]', css_text, "Seletor de tema escuro [data-theme=\"dark\"] não encontrado")

        # Verifica sobrescrita de variáveis no modo escuro
        dark_section = re.search(r'\[data-theme="dark"\]\s*\{([^}]+)\}', css_text)
        self.assertIsNotNone(dark_section, "Bloco [data-theme=\"dark\"] não localizado no CSS")
        dark_body = dark_section.group(1)
        self.assertIn("--bg-canvas", dark_body, "--bg-canvas não redefinida no tema escuro")
        self.assertIn("--text-main", dark_body, "--text-main não redefinida no tema escuro")

    def test_04_responsive_media_queries(self):
        """Valida a existência de regras de @media query com breakpoints para mobile e tablet."""
        css_text = CSS_FILE.read_text(encoding="utf-8")

        # Busca declarações de media queries
        media_queries = re.findall(r"@media\s*\([^)]+\)", css_text)
        self.assertGreaterEqual(len(media_queries), 3, "Poucas media queries responsivas encontradas no CSS")

        # Breakpoint clássico para telas menores (860px ou 560px)
        has_mobile_breakpoint = any("860px" in mq or "768px" in mq or "560px" in mq or "480px" in mq for mq in media_queries)
        self.assertTrue(has_mobile_breakpoint, "Nenhuma media query para dispositivos móveis localizada")

    def test_05_flexbox_and_grid_containers_usage(self):
        """Assegura a ampla utilização de CSS Flexbox e Grid para layout fluido e adaptável."""
        css_text = CSS_FILE.read_text(encoding="utf-8")

        flex_count = len(re.findall(r"display\s*:\s*flex\b", css_text, re.IGNORECASE))
        grid_count = len(re.findall(r"display\s*:\s*grid\b", css_text, re.IGNORECASE))

        self.assertGreater(flex_count, 10, f"Poucos containers Flexbox detectados ({flex_count})")
        self.assertGreater(grid_count, 3, f"Poucos containers Grid detectados ({grid_count})")
        self.assertIn("grid-template-columns", css_text, "grid-template-columns deve ser utilizada no CSS")

    def test_06_setup_modal_dom_structure_and_accessibility(self):
        """Valida a acessibilidade e completude estrutural do modal interativo de setup do Supabase."""
        html = HTML_INDEX.read_text(encoding="utf-8")

        # Elementos essenciais do Setup Modal
        self.assertIn('id="supabaseSetupModal"', html, "Modal supabaseSetupModal não encontrado no index.html")
        self.assertIn('id="supabaseSetupForm"', html, "Formulário supabaseSetupForm não encontrado")
        self.assertIn('id="setupSupabaseUrl"', html, "Campo de entrada setupSupabaseUrl não encontrado")
        self.assertIn('id="setupSupabaseAnonKey"', html, "Campo de entrada setupSupabaseAnonKey não encontrado")

        # Labels associados aos inputs para acessibilidade
        self.assertIn('for="setupSupabaseUrl"', html, "Label for='setupSupabaseUrl' ausente")
        self.assertIn('for="setupSupabaseAnonKey"', html, "Label for='setupSupabaseAnonKey' ausente")

        # Botões de ação do modal
        self.assertIn('id="testSupabaseConnectionBtn"', html, "Botão de teste de conexão ausente")
        self.assertIn('id="saveSupabaseConfigBtn"', html, "Botão de salvar configuração ausente")
        self.assertIn('id="closeSetupModalBtn"', html, "Botão de fechar modal ausente")

    def test_07_javascript_client_resilience_and_fallback(self):
        """Assegura que o cliente Supabase e o Setup Modal tratam ausência de credenciais sem quebrar a página."""
        self.assertTrue(SETUP_MODAL_JS.exists(), "setup_modal.js não encontrado")
        self.assertTrue(SUPABASE_CLIENT_JS.exists(), "supabase_client.js não encontrado")

        client_code = SUPABASE_CLIENT_JS.read_text(encoding="utf-8")
        modal_code = SETUP_MODAL_JS.read_text(encoding="utf-8")

        # Resilience Layer: verifica se abre o modal caso não esteja configurado
        self.assertIn("isConfigured", client_code)
        self.assertIn("abrirModal", client_code)
        self.assertIn("localStorage.getItem('olympos_supabase_url')", client_code)
        self.assertIn("localStorage.getItem('olympos_supabase_anon_key')", client_code)

        # Modal JS: salva exclusivamente no localStorage sem expor ao backend
        self.assertIn("localStorage.setItem('olympos_supabase_url'", modal_code)
        self.assertIn("localStorage.setItem('olympos_supabase_anon_key'", modal_code)

    def test_08_mobile_breakpoint_and_header_collapse(self):
        """Valida a presença de media query defensiva para mobile (<= 480px / 560px) e recolhimento do masthead."""
        css_text = CSS_FILE.read_text(encoding="utf-8")

        self.assertIn("max-width: 480px", css_text, "Breakpoint defensivo max-width: 480px não encontrado no CSS")
        self.assertIn("max-width: 560px", css_text, "Breakpoint max-width: 560px não encontrado no CSS")

        # Em telas <= 560px e <= 480px, elementos secundários da barra devem ser ocultados para evitar overflow
        self.assertIn(".brand-edition-pill", css_text, ".brand-edition-pill deve estar presente no CSS")
        self.assertIn(".user-capsule-meta", css_text, ".user-capsule-meta deve estar presente no CSS")

        # Extrai o bloco de @media (max-width: 480px)
        pos = css_text.find("max-width: 480px")
        self.assertNotEqual(pos, -1, "max-width: 480px não localizado")
        mq_480_text = css_text[pos:pos + 1200]
        self.assertIn(".brand-edition-pill", mq_480_text, ".brand-edition-pill deve ser ocultado no mobile <= 480px")
        self.assertIn(".user-capsule-meta", mq_480_text, ".user-capsule-meta deve ser ocultado no mobile <= 480px")

    def test_09_css_grid_minmax_mobile_safety(self):
        """Assegura que grades de memórias e configurações utilizam minmax fluido sem estouro de largura."""
        css_text = CSS_FILE.read_text(encoding="utf-8")
        html_text = HTML_INDEX.read_text(encoding="utf-8")

        # .memorias-grid deve usar minmax(min(100%, 280px), 1fr) ou colapso em 1fr no mobile
        self.assertIn("minmax(min(100%, 280px), 1fr)", css_text, "memorias-grid deve usar minmax fluido com min(100%, 280px)")

        # #page-configuracoes controls-grid deve usar minmax seguro ou classe responsiva
        self.assertIn("minmax(min(100%, 280px), 1fr)", html_text, "configuracoes grid no index.html deve usar minmax fluido")

        # Verifica colapso para 1 coluna em telas menores
        self.assertIn(".memorias-grid", css_text)
        self.assertIn("grid-template-columns: 1fr !important", css_text, "Grids devem colapsar para 1 coluna em mobile")

    def test_10_search_grid_mobile_adaptability(self):
        """Assegura que o grid de controles de busca global colapsa graciosamente em telas móveis."""
        css_text = CSS_FILE.read_text(encoding="utf-8")
        html_text = HTML_INDEX.read_text(encoding="utf-8")

        self.assertIn("search-controls-responsive", html_text, "Classe search-controls-responsive ausente no index.html")
        self.assertIn(".search-controls-responsive", css_text, "Classe .search-controls-responsive ausente no CSS")

        # Verifica regra de colapso de coluna para busca em mobile
        mq_match = re.search(r"\.search-controls-responsive[^{]*\{[^}]*grid-template-columns:\s*1fr\s*!important", css_text)
        self.assertIsNotNone(mq_match, "Regra de colapso para 1 coluna em busca mobile não encontrada")

    def test_11_nav_drawer_auto_close_on_navigation(self):
        """Valida que cliques em links de navegação fecham automaticamente o drawer no mobile."""
        self.assertTrue(APP_JS.exists(), f"app.js ausente: {APP_JS}")
        app_code = APP_JS.read_text(encoding="utf-8")

        self.assertIn("nav-drawer-open", app_code, "Classe nav-drawer-open não encontrada em app.js")
        self.assertIn("document.body.classList.remove('nav-drawer-open')", app_code,
                      "app.js deve remover 'nav-drawer-open' ao navegar para fechar o drawer mobile")

    def test_12_modal_backdrop_scrollability_and_clipping(self):
        """Verifica que o backdrop e os cards de modal possuem rolagem vertical defensiva contra clipping."""
        css_text = CSS_FILE.read_text(encoding="utf-8")

        backdrop_match = re.search(r"\.modal-backdrop\s*\{([^}]+)\}", css_text)
        self.assertIsNotNone(backdrop_match, "Seletor .modal-backdrop não encontrado no CSS")
        backdrop_body = backdrop_match.group(1)
        self.assertIn("overflow-y: auto", backdrop_body, ".modal-backdrop deve ter overflow-y: auto para evitar corte de conteúdo")

        card_match = re.search(r"\.modal-card\s*\{([^}]+)\}", css_text)
        self.assertIsNotNone(card_match, "Seletor .modal-card não encontrado no CSS")
        card_body = card_match.group(1)
        self.assertIn("max-height", card_body, ".modal-card deve ter max-height proporcional à viewport")
        self.assertIn("overflow-y: auto", card_body, ".modal-card deve ter overflow-y: auto")

    def test_13_touch_targets_and_table_touch_scroll(self):
        """Valida que elementos mini respeitam alvo de toque e tabelas usam aceleração de toque."""
        css_text = CSS_FILE.read_text(encoding="utf-8")

        # .btn-mini deve possuir altura mínima e respiro adequado
        mini_match = re.search(r"\.btn-mini\s*\{([^}]+)\}", css_text)
        self.assertIsNotNone(mini_match, ".btn-mini ausente no CSS")
        mini_body = mini_match.group(1)
        self.assertIn("min-height", mini_body, ".btn-mini deve definir min-height para acessibilidade touch")

        # .table-wrapper deve possuir rolagem por toque inercial
        table_match = re.search(r"\.table-wrapper\s*\{([^}]+)\}", css_text)
        self.assertIsNotNone(table_match, ".table-wrapper ausente no CSS")
        table_body = table_match.group(1)
        self.assertIn("-webkit-overflow-scrolling: touch", table_body, "table-wrapper deve ter -webkit-overflow-scrolling: touch")

    def test_14_favicon_and_head_assets_integrity(self):
        """Valida a presença de favicons oficiais (Data URI no HTML e arquivos físicos .ico e .svg)."""
        html_text = HTML_INDEX.read_text(encoding="utf-8")

        # Declarações no <head>
        self.assertIn('rel="icon"', html_text, "Tag link rel='icon' ausente no head do index.html")
        self.assertIn("data:image/svg+xml", html_text, "Favicon SVG Data URI ausente no head do index.html")
        self.assertIn("favicon.ico", html_text, "Referência a favicon.ico ausente no head do index.html")

        # Arquivos físicos
        self.assertTrue(FAVICON_ICO.exists(), f"favicon.ico não encontrado em: {FAVICON_ICO}")
        self.assertTrue(FAVICON_SVG.exists(), f"assets/favicon.svg não encontrado em: {FAVICON_SVG}")

        # Validação do cabeçalho binário do favicon.ico
        ico_bytes = FAVICON_ICO.read_bytes()
        self.assertGreater(len(ico_bytes), 100, "favicon.ico deve ser um arquivo binário válido com conteúdo real")
        self.assertEqual(ico_bytes[:4], b"\x00\x00\x01\x00", "favicon.ico deve possuir cabeçalho canônico ICO (00 00 01 00)")

    def test_15_dom_input_autocomplete_and_supabase_singleton(self):
        """Assegura conformidade DOM de autocomplete e padrão Singleton do cliente GoTrue."""
        html_text = HTML_INDEX.read_text(encoding="utf-8")
        client_code = SUPABASE_CLIENT_JS.read_text(encoding="utf-8")

        # Autocomplete nos inputs de credenciais
        self.assertRegex(html_text, r'id="setupSupabaseAnonKey"[^>]*autocomplete="new-password"',
                         "setupSupabaseAnonKey deve conter autocomplete='new-password'")
        self.assertRegex(html_text, r'id="novoUsuarioSenha"[^>]*autocomplete="new-password"',
                         "novoUsuarioSenha deve conter autocomplete='new-password'")
        self.assertIn('autocomplete="username"', html_text, "Campo de identificador de login deve conter autocomplete='username'")
        self.assertIn('autocomplete="current-password"', html_text, "Campo de senha de login deve conter autocomplete='current-password'")

        # Singleton no cliente Supabase: reutiliza instância se URL e chave já coincidem
        self.assertIn("activeUrl", client_code, "supabase_client.js deve rastrear activeUrl para padrão Singleton")
        self.assertIn("activeKey", client_code, "supabase_client.js deve rastrear activeKey para padrão Singleton")
        self.assertIn("normalizeSupabaseUrl", client_code, "supabase_client.js deve normalizar a URL removendo /rest/v1")

    def test_16_breakpoint_responsiveness_matrix_mobile_and_ultrawide(self):
        """Valida sistematicamente a matriz completa de viewports: 320px, 375px, 480px, 768px, 1600px, 1920px, 2560px e 3440px."""
        css_text = CSS_FILE.read_text(encoding="utf-8")
        css_mirror = CSS_MIRROR.read_text(encoding="utf-8")

        for code, fname in [(css_text, "styles.css"), (css_mirror, "css/style.css")]:
            # Breakpoints Mobile & Compact (320px - 768px)
            self.assertIn("max-width: 375px", code, f"Breakpoint max-width: 375px ausente em {fname}")
            self.assertIn("max-width: 480px", code, f"Breakpoint max-width: 480px ausente em {fname}")
            self.assertIn("max-width: 768px", code, f"Breakpoint max-width: 768px ausente em {fname}")

            # Breakpoints Ultra-Wide & Monitores Largos (1600px - 3440px+)
            self.assertIn("min-width: 1600px", code, f"Breakpoint min-width: 1600px ausente em {fname}")
            self.assertIn("min-width: 1920px", code, f"Breakpoint min-width: 1920px ausente em {fname}")
            self.assertIn("min-width: 2560px", code, f"Breakpoint min-width: 2560px ausente em {fname}")
            self.assertIn("min-width: 3440px", code, f"Breakpoint min-width: 3440px ausente em {fname}")

            # Escalonamento progressivo da variável --container-max
            self.assertIn("--container-max: 1540px", code, f"--container-max: 1540px ausente em {fname}")
            self.assertIn("--container-max: 1840px", code, f"--container-max: 1840px ausente em {fname}")
            self.assertIn("--container-max: 2240px", code, f"--container-max: 2240px ausente em {fname}")
            self.assertIn("--container-max: 2800px", code, f"--container-max: 2800px ausente em {fname}")

            # Limite ergonômico de legibilidade de 1600px para formulários e blocos editoriais
            self.assertIn("max-width: 1600px", code, f"Restrição de legibilidade max-width: 1600px ausente em {fname}")
            self.assertIn(".surface-card form", code, f"Seletor .surface-card form ausente em {fname}")
            self.assertIn(".surface-card .controls-grid", code, f"Seletor .surface-card .controls-grid ausente em {fname}")

    def test_17_mobile_layout_elements_safety_topbar_alert_grid_sidebar(self):
        """Verifica regras CSS de segurança contra overflow em 320px: topbar, quick-alert-bar, controls-grid e sidebar drawer."""
        css_text = CSS_FILE.read_text(encoding="utf-8")

        # Topbar / Top-masthead: contenção de largura em viewports móveis
        self.assertRegex(css_text, r"\.top-masthead[^{]*\{[^}]*overflow-x:\s*clip",
                         "Cabeçalho deve possuir contenção de overflow-x para mobile <= 480px")

        # #topNovoUsuarioBtn: no mobile <= 480px, texto longo do span é ocultado e botão reduz para evitar estouro de 336px em 320px
        self.assertRegex(css_text, r"#topNovoUsuarioBtn\s+span\s*\{[^}]*display:\s*none\s*!important",
                         "#topNovoUsuarioBtn span deve possuir display: none !important no mobile")
        self.assertIn("min-width: 0", css_text, "Regras de min-width: 0 devem ser aplicadas a botões e controles compactos")

        # .quick-alert-bar: deve possuir min-width: 0 e largura 100% para não vazar os 292px do card em 320px
        self.assertRegex(css_text, r"\.quick-alert-bar[^{]*\{[^}]*min-width:\s*0\s*!important",
                         ".quick-alert-bar deve ter min-width: 0 !important no mobile")
        self.assertRegex(css_text, r"\.quick-alert-bar[^{]*\{[^}]*flex-direction:\s*column\s*!important",
                         ".quick-alert-bar deve empilhar verticalmente em telas <= 480px")

        # .controls-grid: colapso universal em coluna única no mobile <= 768px
        self.assertRegex(css_text, r"\.controls-grid\s*\{[^}]*grid-template-columns:\s*1fr\s*!important",
                         ".controls-grid deve colapsar universalmente para 1fr no mobile <= 768px")

        # .sidebar / .masthead-nav-rail: drawer móvel off-screen por padrão
        self.assertRegex(css_text, r"\.sidebar[^{]*\{[^}]*transform:\s*translateX\(-100%\)",
                         ".sidebar deve iniciar retraída fora da tela (translateX(-100%)) no mobile")
        self.assertRegex(css_text, r"body\.nav-drawer-open\s+\.sidebar[^{]*\{[^}]*transform:\s*translateX\(0\)",
                         ".sidebar deve deslizar para translateX(0) quando body possuir nav-drawer-open")

    def test_18_dom_accessibility_modal_novo_usuario_autocomplete(self):
        """Assegura conformidade WHATWG de autocomplete em #modalNovoUsuario para eliminar avisos Chromium de username ausente."""
        html_text = HTML_INDEX.read_text(encoding="utf-8")

        # #modalNovoUsuario / #formNovoUsuario
        self.assertIn('id="modalNovoUsuario"', html_text)
        self.assertIn('id="formNovoUsuario"', html_text)

        # Departamento com autocomplete='organization'
        self.assertRegex(
            html_text,
            r'id="novoUsuarioDepartamento"[^>]*autocomplete="organization"',
            "#novoUsuarioDepartamento deve conter autocomplete='organization' para sanar o alerta [DOM]"
        )

        # Nome completo com autocomplete='name'
        self.assertRegex(
            html_text,
            r'id="novoUsuarioNome"[^>]*autocomplete="name"',
            "#novoUsuarioNome deve conter autocomplete='name'"
        )

        # Email com autocomplete='email username'
        self.assertRegex(
            html_text,
            r'id="novoUsuarioEmail"[^>]*autocomplete="[^"]*username[^"]*"',
            "#novoUsuarioEmail deve incluir 'username' em seu autocomplete para servir como identificador"
        )

        # Senha com autocomplete='new-password'
        self.assertRegex(
            html_text,
            r'id="novoUsuarioSenha"[^>]*autocomplete="new-password"',
            "#novoUsuarioSenha deve conter autocomplete='new-password'"
        )

    def test_19_dom_accessibility_password_forms_have_username_fields(self):
        """Garante que 100% dos formulários com campos de senha no DOM possuem campo de username associado (W3C/WCAG 2.2)."""
        html_text = HTML_INDEX.read_text(encoding="utf-8")
        css_text = CSS_FILE.read_text(encoding="utf-8")
        css_mirror = CSS_MIRROR.read_text(encoding="utf-8")

        # #supabaseSetupForm deve conter campo username oculto acessível
        self.assertRegex(
            html_text,
            r'<form\s+id="supabaseSetupForm"[^>]*>[\s\S]*?<input[^>]+name="username"[^>]+autocomplete="username"[^>]+class="[^"]*sr-only[^"]*"',
            "#supabaseSetupForm deve conter campo de username com classe .sr-only e autocomplete='username'"
        )

        # Varre todos os <form> do index.html para certificar zero formulários de senha sem username
        form_pattern = re.compile(r'<form\b([^>]*)>([\s\S]*?)</form>', re.IGNORECASE)
        forms = form_pattern.findall(html_text)
        self.assertGreaterEqual(len(forms), 3, "Devem existir ao menos 3 formulários estruturados no index.html")

        for attrs, body in forms:
            has_password = 'type="password"' in body
            if has_password:
                has_username = bool(re.search(r'autocomplete=["\'][^"\']*\busername\b[^"\']*["\']', body, re.IGNORECASE)) or bool(re.search(r'name=["\']username["\']', body, re.IGNORECASE))
                form_id_match = re.search(r'id=["\']([^"\']+)["\']', attrs)
                form_id = form_id_match.group(1) if form_id_match else "form-sem-id"
                self.assertTrue(has_username, f"Formulário '{form_id}' contém campo de senha mas não possui campo de username!")

        # Classe .sr-only deve estar definida em ambos os arquivos CSS com clip: rect(...)
        for code, fname in [(css_text, "styles.css"), (css_mirror, "css/style.css")]:
            self.assertIn(".sr-only", code, f"Classe .sr-only ausente em {fname}")
            sr_match = re.search(r"\.sr-only\s*\{([^}]+)\}", code)
            self.assertIsNotNone(sr_match, f"Regra .sr-only não localizada em {fname}")
            sr_body = sr_match.group(1)
            self.assertIn("position: absolute", sr_body, f".sr-only deve ter position: absolute em {fname}")
            self.assertIn("width: 1px", sr_body, f".sr-only deve ter width: 1px em {fname}")
            self.assertIn("clip: rect(0, 0, 0, 0)", sr_body, f".sr-only deve ter clip: rect(0, 0, 0, 0) em {fname}")

    def test_20_m3_mobile_responsiveness_and_placeholders(self):
        """Valida as melhorias M3: Placeholders '--', unificação da navbar (Portarias) e responsividade mobile."""
        html_text = HTML_INDEX.read_text(encoding="utf-8")
        css_text = CSS_FILE.read_text(encoding="utf-8")
        router_text = (SPA_DIR / "js" / "router.js").read_text(encoding="utf-8")

        # 1. Placeholders '--' nos contadores iniciais de memória
        self.assertRegex(html_text, r'<div[^>]+id="kpiProximoOficio"[^>]*>--</div>')
        self.assertRegex(html_text, r'<div[^>]+id="kpiProximaPortaria"[^>]*>--</div>')
        self.assertIn("Último emitido: --", html_text)
        self.assertIn("Última emitida: --", html_text)

        # 2. Modal de ajuste inicializado com placeholder '--' e value=''
        self.assertIn('id="inputProximoOficioMd"', html_text)
        self.assertIn('placeholder="--"', html_text)
        self.assertIn('id="inputProximaPortariaMd"', html_text)

        # 3. Navbar unificada: Portarias presente, Licenças removida do trilho principal, Escolas presente
        self.assertIn('data-page="portarias">Portarias</a>', html_text)
        self.assertNotIn('<a href="#licencas" class="nav-link" data-page="licencas">Licenças</a>', html_text)
        self.assertIn('data-page="escolas">Escolas</a>', html_text)

        # 4. Sub-abas em pílula dentro de #page-portarias
        self.assertIn('subnav-tabs-bar', html_text)
        self.assertIn('subtabBtnPortariasLote', html_text)
        self.assertIn('subtabBtnPortariasLicencas', html_text)
        self.assertIn('subpanePortariasLote', html_text)
        self.assertIn('subpanePortariasLicencas', html_text)
        self.assertIn('formCadastroLicenca', html_text)

        # 5. CSS Grid de 2 colunas para atalhos do Drive em telas <= 600px e 1 coluna em <= 360px
        self.assertIn("max-width: 600px", css_text)
        self.assertIn("max-width: 360px", css_text)
        self.assertIn(".table-responsive-cards", css_text)
        self.assertIn("max-width: 680px", css_text)

        # 6. Roteador SPA preserva alias 'licencas' redirecionando para 'portarias'
        self.assertIn("pageId = 'portarias'", router_text)
        self.assertIn("targetSubtab = 'licencas'", router_text)

    def test_21_calendario_view_and_data_integrity(self):
        """Valida a implementação do Módulo Calendário Escolar (Milestone 4): dados 2026/2027, DOM, router e iCal."""
        cal_js_path = SPA_DIR / "js" / "views" / "calendario.js"
        html_text = HTML_INDEX.read_text(encoding="utf-8")
        css_text = CSS_FILE.read_text(encoding="utf-8")
        router_text = (SPA_DIR / "js" / "router.js").read_text(encoding="utf-8")
        sync_text = (OLYMPOS_ROOT / "sync_mirrors.py").read_text(encoding="utf-8")

        # 1. Arquivo calendario.js existe e exporta a view modular
        self.assertTrue(cal_js_path.exists(), f"calendario.js não encontrado em {cal_js_path}")
        cal_code = cal_js_path.read_text(encoding="utf-8")
        self.assertIn("window.OlymposViews.calendario", cal_code)
        self.assertIn("init: init", cal_code)
        self.assertIn("exportarIcal: exportarIcal", cal_code)

        # 2. Dados Oficiais 2026: 203 dias letivos e distribuição mensal canônica
        self.assertIn("totalDiasLetivos: 203", cal_code)
        self.assertIn("1: 7", cal_code)   # Fev: 7
        self.assertIn("2: 23", cal_code)  # Mar: 23
        self.assertIn("3: 21", cal_code)  # Abr: 21
        self.assertIn("4: 21", cal_code)  # Mai: 21
        self.assertIn("5: 19", cal_code)  # Jun: 19
        self.assertIn("6: 15", cal_code)  # Jul: 15
        self.assertIn("7: 21", cal_code)  # Ago: 21
        self.assertIn("8: 22", cal_code)  # Set: 22
        self.assertIn("9: 19", cal_code)  # Out: 19
        self.assertIn("10: 19", cal_code) # Nov: 19
        self.assertIn("11: 16", cal_code) # Dez: 16

        # 3. 4 Bimestres canônicos (45d, 46d, 56d, 56d = 203d)
        self.assertIn("diasLetivos: 45", cal_code)
        self.assertIn("diasLetivos: 46", cal_code)
        self.assertIn("diasLetivos: 56", cal_code)
        self.assertIn("2026-02-19", cal_code)
        self.assertIn("2026-04-23", cal_code)
        self.assertIn("2026-06-25", cal_code)
        self.assertIn("2026-09-28", cal_code)
        self.assertIn("2026-12-23", cal_code)

        # 4. Recesso escolar e feriados de Ceará-Mirim
        self.assertIn("2026-06-29", cal_code)
        self.assertIn("2026-07-13", cal_code)
        self.assertIn("Emancipação Política de Ceará-Mirim", cal_code)
        self.assertIn("Nossa Senhora da Conceição (Padroeira de Ceará-Mirim)", cal_code)

        # 5. 8 Sábados letivos temáticos
        self.assertIn("1º Sábado Letivo: Acolhimento", cal_code)
        self.assertIn("8º Sábado Letivo: Consciência Negra", cal_code)

        # 6. Dados de 2027 Planejamento (202 dias letivos previstos)
        self.assertIn("totalDiasLetivos: 202", cal_code)
        self.assertIn("DADOS_2027", cal_code)

        # 7. Estrutura DOM em index.html (#page-calendario, KPIs, toolbar, modal)
        self.assertIn('id="page-calendario"', html_text)
        self.assertIn('id="calKpiDiasLetivos"', html_text)
        self.assertIn('id="calKpiBimestres"', html_text)
        self.assertIn('id="calKpiRecesso"', html_text)
        self.assertIn('id="calKpiSabados"', html_text)
        self.assertIn('id="calKpiMatriculas"', html_text)
        self.assertIn('id="btnAno2026"', html_text)
        self.assertIn('id="btnAno2027"', html_text)
        self.assertIn('id="btnCalTabMes"', html_text)
        self.assertIn('id="btnCalTabBimestre"', html_text)
        self.assertIn('id="btnExportarIcal"', html_text)
        self.assertIn('id="calendarioViewMes"', html_text)
        self.assertIn('id="calendarioViewBimestre"', html_text)
        self.assertIn('id="modalDetalhesDiaCalendario"', html_text)
        self.assertIn('<script src="js/views/calendario.js"></script>', html_text)

        # 8. Roteador e sincronizador
        self.assertIn("'calendario': 'calendario'", router_text)
        self.assertIn('"js/views/calendario.js"', sync_text)

        # 9. Estilos dedicados em styles.css
        self.assertIn(".calendario-kpis-grid", css_text)
        self.assertIn(".cal-grid-days", css_text)
        self.assertIn(".cal-bimestres-grid", css_text)
        self.assertIn(".cal-pill", css_text)
        self.assertIn(".cal-day-cell", css_text)

    def test_22_m1_m2_navbar_theme_search_and_dropdown(self):
        """Valida as melhorias de M1 e M2: tema circular, dropdown Documentos sem overflow e busca de servidores."""
        html_text = HTML_INDEX.read_text(encoding="utf-8")
        css_text = CSS_FILE.read_text(encoding="utf-8")
        papiro_text = (SPA_DIR / "js" / "views" / "papiroCadmo.js").read_text(encoding="utf-8")

        # 1. Botão de tema circular (#themeToggleBtn)
        self.assertIn('id="themeToggleBtn"', html_text)
        self.assertIn('#themeToggleBtn', css_text)
        self.assertIn('border-radius: 50% !important;', css_text)
        self.assertIn('aspect-ratio: 1 / 1 !important;', css_text)
        self.assertIn('width: 36px !important;', css_text)
        self.assertIn('height: 36px !important;', css_text)

        # 2. Menu dropdown Documentos sem overflow-clipping
        self.assertIn('id="navDropdownDocumentos"', html_text)
        self.assertIn('id="dropdownDocsBtn"', html_text)
        self.assertIn('id="dropdownDocsMenu"', html_text)
        self.assertIn('data-page="oficios">Ofícios</a>', html_text)
        self.assertIn('data-page="portarias">Portarias</a>', html_text)
        self.assertIn('data-page="certificados">Certificados</a>', html_text)
        self.assertIn('.masthead-nav-rail', css_text)
        self.assertIn('.nav-rail-inner', css_text)
        self.assertIn('.dropdown-menu', css_text)
        self.assertIn('z-index: 1000;', css_text)

        # 3. Nova barra de busca de servidores em Permutas (#cadmoBuscaServidorInput)
        self.assertIn('id="cadmoBuscaServidorInput"', html_text)
        self.assertIn('id="btnLimparBuscaServidor"', html_text)
        self.assertIn('id="tabAbaDocentesGeral"', html_text)
        self.assertIn('id="cadmoResumoBuscaRow"', html_text)
        self.assertIn('id="btnRemoverFiltroPesquisa"', html_text)
        self.assertIn('normalizarBusca', papiro_text)
        self.assertIn('filtrarMatchesPorTermo', papiro_text)
        self.assertIn('filtrarDocentesPorTermo', papiro_text)
        self.assertIn('filtrarVinculosPorTermo', papiro_text)
        self.assertIn('executarListagemDocentesGeral', papiro_text)

        # 4. Atalhos Drive mobile no drawer lateral e ocultação na barra hero
        self.assertIn('mobile-drawer-drive-section', html_text)
        self.assertIn('Atalhos Drive', html_text)
        self.assertIn('.hero-shortcuts-bar', css_text)
        self.assertIn('display: none !important;', css_text)

        # 5. Ocultação de cards técnicos (GitHub Actions/GAS e Esquema Canônico)
        self.assertIn('id="diarioArchBanner"', html_text)
        self.assertIn('id="cadmoEsquemaCanonicoCol"', html_text)
        self.assertIn('#diarioArchBanner', css_text)
        self.assertIn('#cadmoEsquemaCanonicoCol', css_text)

    def test_23_dark_mode_leaflet_popup_contrast_and_escolas_responsive_toolbar(self):
        """Assegura alto contraste dos popups Leaflet no modo escuro e responsividade da toolbar/modal de Escolas."""
        html_text = HTML_INDEX.read_text(encoding="utf-8")
        css_text = CSS_FILE.read_text(encoding="utf-8")

        # 1. Regras explícitas de alto contraste para popups claros no modo escuro
        self.assertIn('[data-theme="dark"] .leaflet-popup-content-wrapper .pill-segmento-mini', css_text)
        self.assertIn('[data-theme="dark"] .leaflet-popup-content-wrapper .btn-map-action', css_text)
        self.assertIn('.escola-map-popup', css_text)
        self.assertIn('.escola-popup-title', css_text)
        self.assertIn('.escola-popup-coords', css_text)

        # 2. Toolbar responsiva do Mapa das Escolas e grids de modal colapsáveis no mobile
        self.assertIn('escolas-filter-toolbar', html_text)
        self.assertIn('.escolas-filter-toolbar', css_text)
        self.assertIn('modal-grid-3col', html_text)
        self.assertIn('modal-grid-2col', html_text)
        self.assertIn('.modal-grid-3col', css_text)
        self.assertIn('.modal-grid-2col', css_text)


if __name__ == "__main__":
    unittest.main()



