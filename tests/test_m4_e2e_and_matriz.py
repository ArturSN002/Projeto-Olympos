"""
Bateria de Testes Automatizados - Pipeline Integrado E2E e Matriz Analítica (Milestone M4)
Valida a correção do bug da competência 'mirim' no normalizador, a fidelidade de leitura
dos arquivos de status de persistência (status_supabase.json / status_drive.json) e a integridade
da Matriz Analítica por Ente Governamental.
"""
import os
import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import pandas as pd

# Ajusta caminhos para permitir importar tanto de Olympos quanto de papiro-de-cadmo
TESTS_DIR = Path(__file__).resolve().parent
OLYMPOS_ROOT = TESTS_DIR.parent
CADMO_ROOT = OLYMPOS_ROOT.parent / "papiro-de-cadmo"

sys.path.insert(0, str(CADMO_ROOT))
sys.path.insert(0, str(OLYMPOS_ROOT / "2_github_pages_actions" / "engines" / "papiro_de_cadmo"))

from pipeline.normalizador import (
    extrair_ente_e_competencia,
    normalizar_dataframe,
    processar_todos,
    COLUNAS_PADRAO,
    MAPA_NOMES_ENTES
)
from pipeline.resumo_executivo import (
    obter_status_persistencia,
    gerar_markdown_resumo,
    publicar_resumo_executivo
)
from extractors.run_all import extrair_portal


class TestMilestoneM4(unittest.TestCase):
    """Testes de integridade técnica para o Milestone M4."""

    def test_01_extrair_ente_e_competencia_ceara_mirim(self):
        """Valida que stems com underscore como 'ceara_mirim_2026-10' não geram competência 'mirim'."""
        ente_id, comp = extrair_ente_e_competencia("ceara_mirim_2026-10")
        self.assertEqual(ente_id, "ceara_mirim")
        self.assertEqual(comp, "2026-10")
        self.assertNotEqual(comp, "mirim")

    def test_02_extrair_ente_e_competencia_multiplos_underscores(self):
        """Valida suporte a múltiplos underscores no nome do ente."""
        casos = [
            ("sao_paulo_potengi_2026-10", "sao_paulo_potengi", "2026-10"),
            ("estado_rn_2026-10", "estado_rn", "2026-10"),
            ("rio_do_fogo_2026-07", "rio_do_fogo", "2026-07"),
            ("nisia_floresta_2026-10", "nisia_floresta", "2026-10"),
            ("natal_2026-09", "natal", "2026-09")
        ]
        for stem, exp_id, exp_comp in casos:
            ente_id, comp = extrair_ente_e_competencia(stem)
            self.assertEqual(ente_id, exp_id)
            self.assertEqual(comp, exp_comp)

    def test_03_normalizar_dataframe_competencia_nunca_mirim(self):
        """Valida que normalizar_dataframe garante competência no formato YYYY-MM mesmo se comp_default='mirim'."""
        raw_df = pd.DataFrame({
            "Nome": ["Jose Silva"],
            "Matricula": ["12345"],
            "Cargo": ["Professor"],
            "Lotacao": ["Escola A"]
        })
        df_norm = normalizar_dataframe(raw_df, "Ceará-Mirim", "mirim")
        comp = df_norm.iloc[0]["competencia"]
        self.assertNotEqual(comp, "mirim")
        self.assertRegex(comp, r"^\d{4}-\d{2}$")

    def test_04_normalizar_dataframe_sanitiza_coluna_existente_corrompida(self):
        """Valida que valores 'mirim' ou inválidos em coluna 'competencia' pré-existente são sanitizados."""
        raw_df = pd.DataFrame({
            "Nome": ["Maria Silva", "Joao Souza"],
            "Matricula": ["1", "2"],
            "competencia": ["mirim", "invalido"]
        })
        df_norm = normalizar_dataframe(raw_df, "Ceará-Mirim", "2026-10")
        self.assertEqual(df_norm.iloc[0]["competencia"], "2026-10")
        self.assertEqual(df_norm.iloc[1]["competencia"], "2026-10")

    def test_05_obter_status_persistencia_com_arquivos_json(self):
        """Valida leitura fiel de status_supabase.json e status_drive.json."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_root = Path(tmp_dir)
            proc_dir = tmp_root / "data" / "processed"
            proc_dir.mkdir(parents=True, exist_ok=True)

            sb_path = proc_dir / "status_supabase.json"
            sb_path.write_text(json.dumps({
                "sucesso": True,
                "total": 500,
                "enviados": 500,
                "endpoint": "https://test.supabase.co/rest/v1/folha_intermunicipal"
            }), encoding="utf-8")

            dr_path = proc_dir / "status_drive.json"
            dr_path.write_text(json.dumps({
                "sucesso": True,
                "file_id": "fake_drive_file_id_777",
                "folder_id": "fake_folder_id",
                "metodo": "service_account"
            }), encoding="utf-8")

            res = obter_status_persistencia(tmp_root)
            self.assertIn("🟢", res["status_supabase_badge"])
            self.assertIn("500", res["status_supabase"])
            self.assertIn("🟢", res["status_drive_badge"])
            self.assertIn("fake_drive_file_id_777", res["status_drive"])

    def test_06_gerar_markdown_resumo_matriz_sem_mirim(self):
        """Valida que a tabela de Matriz Analítica gerada por gerar_markdown_resumo nunca contém 'mirim'."""
        portais = [
            {"id": "ceara_mirim", "ente": "Ceará-Mirim", "base_controle_local": True},
            {"id": "natal", "ente": "Natal"},
            {"id": "estado_rn", "ente": "Governo do Estado do Rio Grande do Norte"}
        ]
        manifesto = {
            "sucesso": [
                {"ente": "Natal", "duracao_s": 2.5},
                {"ente": "Governo do Estado do Rio Grande do Norte", "duracao_s": 1.2}
            ],
            "falha": []
        }
        df_mock = pd.DataFrame([
            {"ente_origem": "Ceará-Mirim", "competencia": "2026-10", "matricula": "1", "nome_completo": "A"},
            {"ente_origem": "Natal", "competencia": "2026-09", "matricula": "2", "nome_completo": "B"},
            {"ente_origem": "Governo do Estado do Rio Grande do Norte", "competencia": "2026-10", "matricula": "3", "nome_completo": "C"}
        ])
        persistencia = {
            "status_supabase_badge": "🟡 Aguardando Secrets",
            "status_drive_badge": "🟡 Aguardando SA Key",
            "status_supabase": "Pendente",
            "status_drive": "Pendente",
            "drive_folder_id": "123",
            "tabela_supabase": "folha_intermunicipal"
        }

        md = gerar_markdown_resumo(
            portais_cfg=portais,
            manifesto=manifesto,
            df_processado=df_mock,
            caminho_csv=None,
            persistencia=persistencia,
            cruzamentos=[],
            cruzamentos_por_ente={}
        )

        self.assertNotIn("`mirim`", md)
        self.assertIn("| **Ceará-Mirim** | `2026-10` | 1 |", md)
        self.assertIn("| **Natal** | `2026-09` | 1 |", md)
        self.assertIn("| **Governo do Estado do Rio Grande do Norte** | `2026-10` | 1 |", md)

    def test_07_resumo_executivo_reflete_natal_e_estado_rn_sucesso(self):
        """Valida que Natal e Governo do Estado do RN refletem 🟢 Sucesso quando possuem registros."""
        portais = [
            {"id": "natal", "ente": "Natal"},
            {"id": "estado_rn", "ente": "Governo do Estado do Rio Grande do Norte"}
        ]
        manifesto = {"sucesso": [], "falha": []}
        df_mock = pd.DataFrame([
            {"ente_origem": "Natal", "competencia": "2026-09", "matricula": "10", "nome_completo": "PROFESSOR X"},
            {"ente_origem": "Governo do Estado do Rio Grande do Norte", "competencia": "2026-10", "matricula": "20", "nome_completo": "PROFESSOR Y"}
        ])
        persistencia = {
            "status_supabase_badge": "🟡",
            "status_drive_badge": "🟡",
            "status_supabase": "Pendente",
            "status_drive": "Pendente",
            "drive_folder_id": "123",
            "tabela_supabase": "folha_intermunicipal"
        }
        md = gerar_markdown_resumo(
            portais_cfg=portais,
            manifesto=manifesto,
            df_processado=df_mock,
            caminho_csv=None,
            persistencia=persistencia,
            cruzamentos=[],
            cruzamentos_por_ente={}
        )
        self.assertIn("🟢 Sucesso", md)
        self.assertNotIn("🔴 Falha", md)


if __name__ == "__main__":
    unittest.main()
