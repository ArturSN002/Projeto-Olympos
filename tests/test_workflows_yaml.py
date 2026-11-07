#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_workflows_yaml.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Validação automatizada dos pipelines de CI/CD do GitHub Actions:
- Validação sintática YAML rigorosa via PyYAML
- Verificação de gatilhos (triggers) de evento ('push', 'schedule', 'workflow_dispatch')
- Ambientes de execução padronizados em Linux ('ubuntu-latest' / 'ubuntu-*')
- Existência física de caminhos de working-directory no monorepo
- Vinculação estrita de segredos via '${{ secrets.* }}' sem tokens padrão de fallback
- Paridade estrutural entre .github/workflows/ e workflows_mirror/
"""

import re
import unittest
from pathlib import Path

import yaml

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS_DIR = OLYMPOS_ROOT / ".github" / "workflows"
MIRROR_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "workflows_mirror"


class TestWorkflowsYaml(unittest.TestCase):
    """Bateria de testes para os manifestos de automação do GitHub Actions."""

    def test_01_all_workflow_files_exist(self):
        """Assegura a existência dos workflows essenciais na raiz e no diretório espelho."""
        self.assertTrue(WORKFLOWS_DIR.exists(), f"Diretório .github/workflows não encontrado: {WORKFLOWS_DIR}")
        self.assertTrue(MIRROR_DIR.exists(), f"Diretório workflows_mirror não encontrado: {MIRROR_DIR}")

        wf_files = list(WORKFLOWS_DIR.glob("*.yml"))
        mirror_files = list(MIRROR_DIR.glob("*.yml"))

        self.assertGreaterEqual(len(wf_files), 3, "Menos de 3 arquivos .yml em .github/workflows")
        self.assertGreaterEqual(len(mirror_files), 3, "Menos de 3 arquivos .yml em workflows_mirror")

        expected_names = {"deploy_pages.yml", "fogo_prometheus_cron.yml", "papiro_cadmo_cron.yml"}
        found_names = {f.name for f in wf_files}
        self.assertTrue(expected_names.issubset(found_names), f"Workflows esperados ausentes: {expected_names - found_names}")

    def test_02_yaml_syntax_valid(self):
        """Valida que todos os arquivos .yml são documentos YAML válidos e estruturados."""
        all_yamls = list(WORKFLOWS_DIR.glob("*.yml")) + list(MIRROR_DIR.glob("*.yml"))

        for yml_file in all_yamls:
            raw = yml_file.read_text(encoding="utf-8")
            try:
                data = yaml.safe_load(raw)
                self.assertIsInstance(data, dict, f"{yml_file.name} não gerou um dicionário raiz YAML")
                self.assertIn("name", data, f"{yml_file.name} não possui a chave 'name'")
                self.assertIn("jobs", data, f"{yml_file.name} não possui a chave 'jobs'")
            except yaml.YAMLError as exc:
                self.fail(f"Erro sintático no arquivo YAML {yml_file.name}: {exc}")

    def test_03_event_triggers_and_scheduling(self):
        """Valida que os gatilhos de eventos contêm os eventos esperados ('push', 'schedule', 'workflow_dispatch')."""
        # Deploy Pages: push em main e workflow_dispatch
        deploy_wf = yaml.safe_load((WORKFLOWS_DIR / "deploy_pages.yml").read_text(encoding="utf-8"))
        on_deploy = deploy_wf.get("on") or deploy_wf.get(True)
        self.assertIn("push", on_deploy, "deploy_pages.yml deve disparar em 'push'")
        self.assertIn("workflow_dispatch", on_deploy, "deploy_pages.yml deve permitir 'workflow_dispatch'")

        # Fogo de Prometheus: schedule e workflow_dispatch
        prom_wf = yaml.safe_load((WORKFLOWS_DIR / "fogo_prometheus_cron.yml").read_text(encoding="utf-8"))
        on_prom = prom_wf.get("on") or prom_wf.get(True)
        self.assertIn("schedule", on_prom, "fogo_prometheus_cron.yml deve possuir gatilho de 'schedule'")
        self.assertIn("workflow_dispatch", on_prom, "fogo_prometheus_cron.yml deve possuir 'workflow_dispatch'")

        # Papiro de Cadmo: schedule e workflow_dispatch
        cadmo_wf = yaml.safe_load((WORKFLOWS_DIR / "papiro_cadmo_cron.yml").read_text(encoding="utf-8"))
        on_cadmo = cadmo_wf.get("on") or cadmo_wf.get(True)
        self.assertIn("schedule", on_cadmo, "papiro_cadmo_cron.yml deve possuir gatilho de 'schedule'")
        self.assertIn("workflow_dispatch", on_cadmo, "papiro_cadmo_cron.yml deve possuir 'workflow_dispatch'")

    def test_04_runner_environments_are_ubuntu(self):
        """Garante que todos os jobs executem em ubuntu-24.04 e sem actions deprecadas de Node.js 20."""
        for wf_file in WORKFLOWS_DIR.glob("*.yml"):
            raw = wf_file.read_text(encoding="utf-8")
            self.assertNotIn("actions/checkout@v4", raw, f"Action deprecada checkout@v4 em {wf_file.name}")
            self.assertNotIn("actions/setup-python@v5", raw, f"Action deprecada setup-python@v5 em {wf_file.name}")
            self.assertNotIn("ubuntu-latest", raw, f"Label mutável ubuntu-latest encontrada em {wf_file.name}")
            data = yaml.safe_load(raw)
            jobs = data.get("jobs", {})
            for job_id, job_cfg in jobs.items():
                runs_on = job_cfg.get("runs-on", "")
                self.assertTrue(
                    runs_on.startswith("ubuntu-"),
                    f"Job '{job_id}' em {wf_file.name} executa em ambiente não Ubuntu: '{runs_on}'"
                )

    def test_05_working_directories_and_paths_exist_physically(self):
        """Garante que todos os working-directory apontam para pastas existentes dentro de Olympos/."""
        for wf_file in WORKFLOWS_DIR.glob("*.yml"):
            raw_content = wf_file.read_text(encoding="utf-8")
            data = yaml.safe_load(raw_content)

            jobs = data.get("jobs", {})
            for job_id, job_cfg in jobs.items():
                # working-directory a nível de defaults.run
                defaults_wd = (job_cfg.get("defaults") or {}).get("run", {}).get("working-directory")
                if defaults_wd:
                    target_dir = OLYMPOS_ROOT / defaults_wd
                    self.assertTrue(
                        target_dir.exists(),
                        f"working-directory '{defaults_wd}' em {wf_file.name} (job {job_id}) não existe fisicamente"
                    )

                # upload-pages-artifact path
                steps = job_cfg.get("steps", [])
                for step in steps:
                    with_args = step.get("with", {})
                    artifact_path = with_args.get("path")
                    if artifact_path:
                        target_dir = OLYMPOS_ROOT / artifact_path
                        self.assertTrue(
                            target_dir.exists(),
                            f"path '{artifact_path}' em {wf_file.name} (step '{step.get('name')}') não existe"
                        )

    def test_06_secret_bindings_no_hardcoded_fallback(self):
        """Assegura que nenhum segredo do GitHub Actions (${{ secrets.* }}) possua valores default hardcoded."""
        banned_fallback_regex = re.compile(r"\$\{\{\s*secrets\.[A-Za-z0-9_]+\s*(?:\|\||or)\s*['\"][^'\"]+['\"]\s*\}\}")

        for wf_file in WORKFLOWS_DIR.glob("*.yml"):
            content = wf_file.read_text(encoding="utf-8")

            # Verifica se há fallback em expressões de segredos
            matches = banned_fallback_regex.findall(content)
            self.assertEqual(
                len(matches), 0,
                f"Uso proibido de segredo com fallback hardcoded em {wf_file.name}: {matches}"
            )

            # Verifica ausência de tokens legados hardcoded
            self.assertNotIn("smeb-prometheus-2026-x9A8b7C6", content, f"Token legado encontrado em {wf_file.name}")
            self.assertNotIn("AKfycb", content, f"URL com token GAS embutido encontrada em {wf_file.name}")

    def test_07_workflows_mirror_consistency(self):
        """Garante que os manifestos em workflows_mirror são espelhos idênticos dos da raiz .github/workflows/."""
        for wf_file in WORKFLOWS_DIR.glob("*.yml"):
            mirror_counterpart = MIRROR_DIR / wf_file.name
            self.assertTrue(mirror_counterpart.exists(), f"Espelho ausente em workflows_mirror para {wf_file.name}")

            content_orig = wf_file.read_text(encoding="utf-8").strip()
            content_mirror = mirror_counterpart.read_text(encoding="utf-8").strip()
            self.assertEqual(
                content_orig, content_mirror,
                f"Divergência de conteúdo entre {wf_file.name} e {mirror_counterpart.name}"
            )


if __name__ == "__main__":
    unittest.main()
