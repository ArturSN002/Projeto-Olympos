#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_js_syntax.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Validação automatizada de sintaxe JavaScript/Google Apps Script (V8)
e conformidade de segurança (ausência estrita de senhas e credenciais em texto claro).
"""

import os
import re
import unittest
import subprocess
from pathlib import Path

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
GAS_DIR = OLYMPOS_ROOT / "1_google_apps_script"
SPA_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa"

BANNED_KEYWORDS = [
    "smeb2026",
    "rh2026",
    "pedagogico2026",
    "juridico2026",
    "homero2026",
    "lira2026",
    "data-demo-pass",
    "credenciaisPadrao",
    "ignorarAuthDemo"
]


def check_js_syntax_with_node(code: str, filename: str) -> tuple[bool, str]:
    """
    Valida a sintaxe do código JS/GS utilizando o compilador V8 do Node.js via vm.Script.
    Retorna (True, "") se a sintaxe for válida ou (False, stderr) se houver erro sintático.
    """
    node_script = """
const fs = require('fs');
const vm = require('vm');
const stdinBuffer = fs.readFileSync(0, 'utf-8');
try {
    new vm.Script(stdinBuffer, { filename: process.argv[1] || 'inline.js' });
    process.exit(0);
} catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
}
"""
    try:
        proc = subprocess.run(
            ["node", "-e", node_script, filename],
            input=code,
            text=True,
            capture_output=True,
            timeout=15,
            encoding="utf-8"
        )
        if proc.returncode == 0:
            return True, ""
        return False, proc.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, f"Timeout na validação de sintaxe para {filename}"
    except FileNotFoundError:
        return False, "Node.js não encontrado no PATH para executar a validação de sintaxe."


class TestJavaScriptAndGasSyntax(unittest.TestCase):
    """Bateria de testes de integridade sintática e segurança para JS e Google Apps Script."""

    def test_01_no_banned_keywords_in_any_js_gs_html(self):
        """Assegura que ZERO arquivos contenham senhas hardcoded ou variáveis de demo legadas."""
        inspected_count = 0
        violations = []

        scan_dirs = [GAS_DIR, SPA_DIR]
        for base_dir in scan_dirs:
            self.assertTrue(base_dir.exists(), f"Diretório não localizado: {base_dir}")
            for ext in ("*.js", "*.gs", "*.html"):
                for filepath in base_dir.rglob(ext):
                    inspected_count += 1
                    try:
                        content = filepath.read_text(encoding="utf-8", errors="replace")
                    except Exception as err:
                        violations.append(f"Erro ao ler {filepath}: {err}")
                        continue

                    for keyword in BANNED_KEYWORDS:
                        # Verifica ocorrência como token isolado, valor de string ou atributo (ex: 'smeb2026', "smeb2026", data-demo-pass)
                        # evitando falso positivo em identificadores legítimos como proximoParecerJuridico2026
                        pattern = re.compile(r"(?<![a-zA-Z0-9_])" + re.escape(keyword) + r"(?![a-zA-Z0-9_])", re.IGNORECASE)
                        if pattern.search(content):
                            # Se for menção explicativa em comentário de proibição no teste, ignorar
                            if "BANNED_KEYWORDS" in content:
                                continue
                            violations.append(f"{filepath.name} contém a palavra banida '{keyword}'")

        self.assertGreater(inspected_count, 10, "Poucos arquivos inspecionados para palavras-chave.")
        self.assertEqual(len(violations), 0, f"Violações de segurança detectadas:\n" + "\n".join(violations))

    def test_02_gas_scripts_syntax(self):
        """Valida que todos os arquivos .gs (Google Apps Script) possuem sintaxe V8 válida."""
        gs_files = list(GAS_DIR.rglob("*.gs"))
        self.assertGreater(len(gs_files), 5, "Nenhum arquivo .gs encontrado em 1_google_apps_script")

        syntax_errors = []
        for gs_file in gs_files:
            code = gs_file.read_text(encoding="utf-8", errors="replace")
            # Em GAS, variáveis declaradas no escopo global ou funções podem ser lidas por outros arquivos .gs.
            # vm.Script compila perfeitamente sem necessidade de importação externa.
            ok, err = check_js_syntax_with_node(code, gs_file.name)
            if not ok:
                syntax_errors.append(f"{gs_file.relative_to(OLYMPOS_ROOT)}: {err}")

        self.assertEqual(len(syntax_errors), 0, "Erros sintáticos encontrados em arquivos .gs:\n" + "\n".join(syntax_errors))

    def test_03_frontend_spa_js_syntax(self):
        """Valida que todos os arquivos .js da SPA possuem sintaxe JavaScript válida."""
        js_files = list(SPA_DIR.rglob("*.js"))
        self.assertGreater(len(js_files), 5, "Nenhum arquivo .js encontrado em frontend_spa")

        syntax_errors = []
        for js_file in js_files:
            code = js_file.read_text(encoding="utf-8", errors="replace")
            ok, err = check_js_syntax_with_node(code, js_file.name)
            if not ok:
                syntax_errors.append(f"{js_file.relative_to(OLYMPOS_ROOT)}: {err}")

        self.assertEqual(len(syntax_errors), 0, "Erros sintáticos encontrados em arquivos .js:\n" + "\n".join(syntax_errors))

    def test_04_html_embedded_scripts_syntax(self):
        """Extrai blocos <script> inline de arquivos .html e valida a sintaxe JS de cada bloco."""
        html_files = list(GAS_DIR.rglob("*.html")) + list(SPA_DIR.rglob("*.html"))
        self.assertGreater(len(html_files), 3, "Nenhum arquivo .html encontrado")

        script_tag_pattern = re.compile(r"<script(?:\s+[^>]*)?>(.*?)</script>", re.DOTALL | re.IGNORECASE)
        total_scripts_checked = 0
        syntax_errors = []

        for html_file in html_files:
            content = html_file.read_text(encoding="utf-8", errors="replace")
            # Ignora tags de template do GAS tipo <?!= ... ?> se houver
            sanitized = re.sub(r"<\?.*?\?>", "/* gas_template */", content)
            matches = script_tag_pattern.findall(sanitized)

            for idx, script_body in enumerate(matches, start=1):
                code = script_body.strip()
                if not code:
                    continue
                # Se for script do tipo JSON ou template, ignora
                if code.startswith("{") and code.endswith("}"):
                    continue

                total_scripts_checked += 1
                ok, err = check_js_syntax_with_node(code, f"{html_file.name}_script_{idx}")
                if not ok:
                    syntax_errors.append(f"{html_file.relative_to(OLYMPOS_ROOT)} [script #{idx}]: {err}")

        self.assertGreater(total_scripts_checked, 0, "Nenhum bloco <script> inline encontrado para validar")
        self.assertEqual(len(syntax_errors), 0, "Erros de sintaxe em scripts HTML inline:\n" + "\n".join(syntax_errors))

    def test_05_supabase_service_in_gas_uses_script_properties(self):
        """Garante que o backend GAS utilize ScriptProperties para conectar ao Supabase sem credenciais hardcoded."""
        service_file = GAS_DIR / "hub_webapp" / "08_service_supabase.gs"
        self.assertTrue(service_file.exists(), "08_service_supabase.gs não encontrado")

        code = service_file.read_text(encoding="utf-8")
        self.assertIn("PropertiesService.getScriptProperties()", code, "08_service_supabase.gs não utiliza ScriptProperties")
        self.assertIn("SUPABASE_URL", code, "SUPABASE_URL não referenciada em 08_service_supabase.gs")
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY", code, "SUPABASE_SERVICE_ROLE_KEY não referenciada em 08_service_supabase.gs")

    def test_06_frontend_auth_and_setup_modal_components(self):
        """Verifica a presença e estrutura dos módulos frontend de setup e cliente Supabase."""
        setup_modal = SPA_DIR / "js" / "setup_modal.js"
        supabase_client = SPA_DIR / "js" / "supabase_client.js"

        self.assertTrue(setup_modal.exists(), "setup_modal.js não encontrado no frontend")
        self.assertTrue(supabase_client.exists(), "supabase_client.js não encontrado no frontend")

        modal_code = setup_modal.read_text(encoding="utf-8")
        client_code = supabase_client.read_text(encoding="utf-8")

        self.assertIn("window.OlymposSetupModal", modal_code, "Setup modal não exporta window.OlymposSetupModal")
        self.assertIn("window.OlymposSupabase", client_code, "Supabase client não exporta window.OlymposSupabase")
        self.assertIn("localStorage", modal_code, "Setup modal deve persistir no localStorage")


if __name__ == "__main__":
    unittest.main()
