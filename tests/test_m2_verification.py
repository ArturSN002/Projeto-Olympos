#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_m2_verification.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Validação de integridade e conformidade das entregas do Marco 2 (M2):
1. Migração Supabase 20261106_007_escolas_secretarias_agenda.sql (DDL, triggers e RLS)
2. Métodos de sincronização e resiliência offline do SupabaseClient em supabase_client.js
3. Motor de busca em tempo real com NFD e listagem de servidores em papiroCadmo.js
4. Agenda Intersetorial, CRUD, filtros de 10 setores e Rigor LDB (203 dias) em calendario.js
5. Elementos DOM acessíveis e navegação integrada em index.html
"""

import unittest
from pathlib import Path
import subprocess

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATION_FILE = REPO_ROOT / "2_github_pages_actions" / "supabase" / "migrations" / "20261106_007_escolas_secretarias_agenda.sql"
SUPABASE_CLIENT = REPO_ROOT / "2_github_pages_actions" / "frontend_spa" / "js" / "supabase_client.js"
PAPIRO_CADMO = REPO_ROOT / "2_github_pages_actions" / "frontend_spa" / "js" / "views" / "papiroCadmo.js"
CALENDARIO = REPO_ROOT / "2_github_pages_actions" / "frontend_spa" / "js" / "views" / "calendario.js"
INDEX_HTML = REPO_ROOT / "2_github_pages_actions" / "frontend_spa" / "index.html"


class TestMarco2Integrity(unittest.TestCase):
    """Bateria de testes para as funcionalidades do Marco 2 (Busca, Agenda e Supabase)."""

    def test_01_sql_migration_schema_and_rls(self):
        """Verifica a estrutura da migração 007, tabelas, triggers e políticas RLS."""
        self.assertTrue(MIGRATION_FILE.exists(), "Arquivo da migração 007 não encontrado")
        sql = MIGRATION_FILE.read_text(encoding="utf-8")

        # Tabelas criadas
        self.assertIn("CREATE TABLE IF NOT EXISTS public.escolas", sql)
        self.assertIn("CREATE TABLE IF NOT EXISTS public.secretarias_parceiras", sql)
        self.assertIn("CREATE TABLE IF NOT EXISTS public.calendario_agenda", sql)

        # Campos obrigatórios da tabela calendario_agenda
        self.assertIn("ano INTEGER NOT NULL", sql)
        self.assertIn("titulo TEXT NOT NULL", sql)
        self.assertIn("data_inicio DATE NOT NULL", sql)
        self.assertIn("data_fim DATE NOT NULL", sql)
        self.assertIn("setor TEXT NOT NULL", sql)
        self.assertIn("letivo BOOLEAN NOT NULL DEFAULT false", sql)

        # Triggers de updated_at
        self.assertIn("trg_escolas_updated_at", sql)
        self.assertIn("trg_secretarias_parceiras_updated_at", sql)
        self.assertIn("trg_calendario_agenda_updated_at", sql)

        # RLS Policies
        self.assertIn("ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY", sql)
        self.assertIn("ALTER TABLE public.secretarias_parceiras ENABLE ROW LEVEL SECURITY", sql)
        self.assertIn("ALTER TABLE public.calendario_agenda ENABLE ROW LEVEL SECURITY", sql)
        self.assertIn("escolas_select_public", sql)
        self.assertIn("secretarias_select_public", sql)
        self.assertIn("agenda_select_public", sql)

    def test_02_supabase_client_methods(self):
        """Verifica métodos de persistência e fallback offline em supabase_client.js."""
        self.assertTrue(SUPABASE_CLIENT.exists(), "supabase_client.js não encontrado")
        code = SUPABASE_CLIENT.read_text(encoding="utf-8")

        metodos = [
            "carregarEscolas",
            "sincronizarEscola",
            "excluirEscola",
            "carregarSecretariasParceiras",
            "sincronizarSecretariaParceira",
            "carregarAgendaEventos",
            "salvarAgendaEvento",
            "excluirAgendaEvento"
        ]
        for m in metodos:
            self.assertIn(m, code, f"Método {m} ausente em supabase_client.js")

        # Verifica interação com tabelas Supabase
        self.assertIn("'escolas'", code)
        self.assertIn("'secretarias_parceiras'", code)
        self.assertIn("'calendario_agenda'", code)

    def test_03_papiro_cadmo_search_engine(self):
        """Verifica funções do motor de busca e abas em papiroCadmo.js."""
        self.assertTrue(PAPIRO_CADMO.exists(), "papiroCadmo.js não encontrado")
        code = PAPIRO_CADMO.read_text(encoding="utf-8")

        self.assertIn("normalizarBusca", code)
        self.assertIn("filtrarMatchesPorTermo", code)
        self.assertIn("filtrarVinculosPorTermo", code)
        self.assertIn("filtrarDocentesPorTermo", code)
        self.assertIn("limparBuscaServidor", code)
        self.assertIn("executarListagemDocentesGeral", code)
        self.assertIn("preencherFormComDocente", code)

        # Normalização com NFD
        self.assertIn("normalize('NFD')", code)

        # Verificação do Node V8
        cmd = ["node", "-e", f"const fs = require('fs'); const vm = require('vm'); const code = fs.readFileSync('{PAPIRO_CADMO.as_posix()}', 'utf8'); new vm.Script(code);"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Erro V8 em papiroCadmo.js: {res.stderr}")

    def test_04_calendario_agenda_intersetorial(self):
        """Verifica modelo de dados, CRUD, filtros e proteção da meta LDB em calendario.js."""
        self.assertTrue(CALENDARIO.exists(), "calendario.js não encontrado")
        code = CALENDARIO.read_text(encoding="utf-8")

        self.assertIn("STORAGE_AGENDA_KEY", code)
        self.assertIn("activeSector", code)
        self.assertIn("obterEventosAgendaCustom", code)
        self.assertIn("salvarEventoAgenda", code)
        self.assertIn("excluirEventoAgenda", code)
        self.assertIn("abrirModalFormAgenda", code)
        self.assertIn("fecharModalFormAgenda", code)
        self.assertIn("setSetor", code)
        self.assertIn("exportarIcal", code)

        # RIGOR LDB: eventos da agenda intersetorial NUNCA alteram os 203 dias letivos
        self.assertIn("letivo: false", code)
        self.assertIn("203", code)
        self.assertIn("totalDiasLetivos: 203", code)

        # Verificação do Node V8
        cmd = ["node", "-e", f"const fs = require('fs'); const vm = require('vm'); const code = fs.readFileSync('{CALENDARIO.as_posix()}', 'utf8'); new vm.Script(code);"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Erro V8 em calendario.js: {res.stderr}")

    def test_05_index_html_elements(self):
        """Verifica presença de todos os IDs de interface requeridos no index.html."""
        self.assertTrue(INDEX_HTML.exists(), "index.html não encontrado")
        html = INDEX_HTML.read_text(encoding="utf-8")

        # Elementos da busca de permutas
        self.assertIn('id="cadmoBuscaServidorInput"', html)
        self.assertIn('id="btnLimparBuscaServidor"', html)
        self.assertIn('id="tabAbaDocentesGeral"', html)
        self.assertIn('id="cadmoResumoBuscaRow"', html)
        self.assertIn('id="btnRemoverFiltroPesquisa"', html)

        # Elementos da agenda no calendário
        self.assertIn('id="btnNovoEventoAgenda"', html)
        self.assertIn('id="selectFiltroSetorCalendario"', html)
        self.assertIn('id="countFiltroAgenda"', html)
        self.assertIn('id="modalFormAgendaEvento"', html)
        self.assertIn('id="formAgendaEventoCalendario"', html)
        self.assertIn('id="agendaTitulo"', html)
        self.assertIn('id="agendaDataInicio"', html)
        self.assertIn('id="agendaDataFim"', html)
        self.assertIn('id="agendaSetor"', html)
        self.assertIn('id="btnSalvarEventoAgenda"', html)
        self.assertIn('id="btnExcluirEventoAgenda"', html)


if __name__ == "__main__":
    unittest.main()
