#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_security_scanner.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Scanner abrangente de segurança estática para auditoria do repositório público:
- Detecção de segredos e credenciais expostas (chaves privadas, tokens AWS/GitHub/Slack, GCP SA)
- Erradicação de senhas legadas e tokens de demonstração (smeb2026, rh2026, etc.)
- Detecção de vazamento de PII real (CPFs matematicamente válidos desmascarados)
- Auditoria do .gitignore para proteção contra comit de credenciais (.env, *.key, *.pem, credentials.json)
- Auditoria contra repositórios Git aninhados (.git internos indesejados)
- Auditoria de segurança XSS e sanitização no Frontend SPA (ausência de eval/document.write, uso de escapeHtml)
"""

import os
import re
import unittest
from pathlib import Path

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent

# Padrões de detecção de segredos de alta criticidade
SECRET_PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP|ENCRYPTED|PRIVATE) KEY-----"),
    "gcp_service_account": re.compile(r'"type"\s*:\s*"service_account"'),
    "aws_access_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "github_pat": re.compile(r"\b(?:ghp_[0-9a-zA-Z]{36}|gho_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82})\b"),
    "slack_token": re.compile(r"\bxox[baprs]-[0-9a-zA-Z-]{10,}\b"),
    "legacy_prometheus_token": re.compile(r"smeb-prometheus-2026-x9A8b7C6"),
    "legacy_demo_pass_attr": re.compile(r'data-demo-pass\s*=\s*["\']'),
    "legacy_credentials_dict": re.compile(r"\bcredenciaisPadrao\b"),
    "legacy_ignore_auth_flag": re.compile(r"\bignorarAuthDemo\b"),
}

# Senhas legadas que NUNCA devem aparecer como tokens/senhas em arquivos do projeto
BANNED_PASSWORDS = [
    "smeb2026",
    "rh2026",
    "pedagogico2026",
    "juridico2026",
    "homero2026",
    "lira2026"
]


def is_valid_cpf_algorithm(cpf_str: str) -> bool:
    """
    Verifica se uma string de CPF possui dígitos verificadores válidos pelo algoritmo Módulo 11 da Receita Federal.
    Retorna False para dígitos repetidos (ex: 111.111.111-11, que são mocks de teste) ou CPFs com dígitos inválidos.
    """
    nums = [int(c) for c in cpf_str if c.isdigit()]
    if len(nums) != 11:
        return False
    # Sequências com todos os dígitos iguais são inválidas
    if len(set(nums)) == 1:
        return False

    # Primeiro dígito verificador
    soma1 = sum(nums[i] * (10 - i) for i in range(9))
    resto1 = (soma1 * 10) % 11
    d1 = 0 if resto1 == 10 else resto1
    if d1 != nums[9]:
        return False

    # Segundo dígito verificador
    soma2 = sum(nums[i] * (11 - i) for i in range(10))
    resto2 = (soma2 * 10) % 11
    d2 = 0 if resto2 == 10 else resto2
    return d2 == nums[10]


class TestSecurityScanner(unittest.TestCase):
    """Scanner estático de vulnerabilidades, vazamento de credenciais e integridade estrutural."""

    def test_01_no_nested_git_directories(self):
        """Assegura que não há diretórios .git aninhados dentro de subpastas (como o repositório legado do Prometheus)."""
        nested_gits = []
        for root, dirs, _ in os.walk(OLYMPOS_ROOT):
            # Se for a raiz do próprio repositório Olympos (.git na raiz), é permitido
            if Path(root) == OLYMPOS_ROOT and ".git" in dirs:
                continue
            for d in dirs:
                if d == ".git" and Path(root) != OLYMPOS_ROOT:
                    nested_gits.append(os.path.join(root, d))

        self.assertEqual(
            len(nested_gits), 0,
            f"Repositórios Git aninhados encontrados (devem ser higienizados):\n" + "\n".join(nested_gits)
        )

    def test_02_gitignore_covers_sensitive_files(self):
        """Valida que o .gitignore oficial contém regras estritas para .env, *.key, *.pem e credentials.json."""
        gitignore_path = OLYMPOS_ROOT / ".gitignore"
        self.assertTrue(gitignore_path.exists(), ".gitignore não encontrado na raiz do Olympos")

        content = gitignore_path.read_text(encoding="utf-8")
        required_patterns = [
            ".env",
            "*.key",
            "*.pem",
            "credentials.json",
            "secrets.json"
        ]

        for pat in required_patterns:
            self.assertIn(pat, content, f"Padrão obrigatório '{pat}' ausente no .gitignore")

    def test_03_no_physical_secret_files_present(self):
        """Assegura que nenhum arquivo físico sensível (.env, *.key, *.pem, credentials.json) foi comitado."""
        disallowed_files = []
        for root, _, files in os.walk(OLYMPOS_ROOT):
            for f in files:
                f_lower = f.lower()
                if f_lower in (".env", "credentials.json", "secrets.json", "service_account.json"):
                    disallowed_files.append(os.path.join(root, f))
                elif f_lower.endswith((".key", ".pem", ".pfx", ".p12")):
                    disallowed_files.append(os.path.join(root, f))

        self.assertEqual(
            len(disallowed_files), 0,
            f"Arquivos sensíveis proibidos detectados no diretório do projeto:\n" + "\n".join(disallowed_files)
        )

    def test_04_repository_wide_secret_and_token_scanner(self):
        """Varre recursivamente todo o repositório em busca de assinaturas de chaves privadas e tokens de API."""
        violations = []
        ignored_extensions = {".png", ".jpg", ".jpeg", ".ico", ".svg", ".pyc", ".pdf", ".woff", ".woff2", ".ttf"}

        for root, _, files in os.walk(OLYMPOS_ROOT):
            parts = Path(root).parts
            # Ignora a pasta tests e relatórios de implementação para evitar falso positivo na documentação da auditoria
            if "tests" in parts or "4_relatorios_implementacao" in parts:
                continue

            for f in files:
                filepath = Path(root) / f
                if filepath.suffix.lower() in ignored_extensions:
                    continue

                try:
                    text = filepath.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue

                # Checa padrões de segredos conhecidos
                for name, pat in SECRET_PATTERNS.items():
                    if pat.search(text):
                        violations.append(f"Arquivo {filepath.relative_to(OLYMPOS_ROOT)} disparou regra '{name}'")

                # Checa senhas legadas como tokens
                for pwd in BANNED_PASSWORDS:
                    pwd_pattern = re.compile(r"(?<![a-zA-Z0-9_])" + re.escape(pwd) + r"(?![a-zA-Z0-9_])", re.IGNORECASE)
                    if pwd_pattern.search(text):
                        violations.append(f"Arquivo {filepath.relative_to(OLYMPOS_ROOT)} contém a senha legada proibida '{pwd}'")

        self.assertEqual(
            len(violations), 0,
            f"Segredos ou senhas expostas encontradas no repositório:\n" + "\n".join(violations)
        )

    def test_05_repository_wide_pii_cpf_leak_scanner(self):
        """Varre o repositório e valida que ZERO CPFs reais matematicamente válidos estão expostos sem mascaramento."""
        real_cpf_leaks = []
        cpf_pattern = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")
        ignored_extensions = {".png", ".jpg", ".ico", ".svg", ".pyc", ".pdf"}

        for root, _, files in os.walk(OLYMPOS_ROOT):
            parts = Path(root).parts
            if "tests" in parts or "4_relatorios_implementacao" in parts:
                continue

            for f in files:
                filepath = Path(root) / f
                if filepath.suffix.lower() in ignored_extensions:
                    continue

                try:
                    text = filepath.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue

                for match in cpf_pattern.finditer(text):
                    cpf_candidate = match.group(0)
                    if is_valid_cpf_algorithm(cpf_candidate):
                        real_cpf_leaks.append(f"{filepath.relative_to(OLYMPOS_ROOT)}: CPF real válido detectado: {cpf_candidate}")

        self.assertEqual(
            len(real_cpf_leaks), 0,
            f"Vazamento de PII: CPFs reais válidos desmascarados encontrados no repositório:\n" + "\n".join(real_cpf_leaks)
        )

    def test_06_frontend_xss_and_injection_audit(self):
        """Audita arquivos JavaScript do Frontend SPA para garantir ausência de padrões inseguros (eval, document.write)."""
        spa_js_dir = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa" / "js"
        self.assertTrue(spa_js_dir.exists(), "Diretório frontend_spa/js não encontrado")

        xss_violations = []
        dangerous_patterns = {
            "eval_usage": re.compile(r"\beval\s*\("),
            "document_write": re.compile(r"\bdocument\.write\s*\("),
            "inline_javascript_protocol": re.compile(r'href\s*=\s*["\']javascript:', re.IGNORECASE)
        }

        for js_file in spa_js_dir.rglob("*.js"):
            code = js_file.read_text(encoding="utf-8")
            for rule_name, pat in dangerous_patterns.items():
                if pat.search(code):
                    xss_violations.append(f"{js_file.name} acionou vulnerabilidade '{rule_name}'")

        self.assertEqual(len(xss_violations), 0, "Padrões perigosos de injeção XSS detectados:\n" + "\n".join(xss_violations))

        # Assegura que escapeHtml é disponibilizado em window.OlymposApp
        app_js = spa_js_dir / "app.js"
        app_code = app_js.read_text(encoding="utf-8")
        self.assertIn("function escapeHtml", app_code, "Função de sanitização escapeHtml não declarada em app.js")
        self.assertIn("escapeHtml: escapeHtml", app_code, "escapeHtml não exportada publicamente em window.OlymposApp")


if __name__ == "__main__":
    unittest.main()
