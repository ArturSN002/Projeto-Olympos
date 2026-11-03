#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_python_engines.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Bateria completa de testes unitários e de integração para os motores Python:
1. Fogo de Prometheus (raspador FEMURN, parsing NER e push Supabase)
2. O Papiro de Cadmo (ETL intermunicipal, normalização de esquemas e push Supabase)
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

import pandas as pd

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
PROMETHEUS_SRC = OLYMPOS_ROOT / "2_github_pages_actions" / "engines" / "fogo_de_prometheus" / "src"
CADMO_ROOT = OLYMPOS_ROOT / "2_github_pages_actions" / "engines" / "papiro_de_cadmo"

# Inclui os módulos Python no sys.path para importação direta
if str(PROMETHEUS_SRC) not in sys.path:
    sys.path.insert(0, str(PROMETHEUS_SRC))
if str(CADMO_ROOT) not in sys.path:
    sys.path.insert(0, str(CADMO_ROOT))

# Importa as funções dos motores
try:
    import scraper_femurn
except ImportError as e:
    scraper_femurn = None

try:
    from pipeline.normalizador import normalizar_dataframe, COLUNAS_PADRAO
    from pipeline.upload_supabase import sincronizar_folha_supabase
except ImportError as e:
    normalizar_dataframe = None
    sincronizar_folha_supabase = None
    COLUNAS_PADRAO = []


class TestFogoDePrometheusEngine(unittest.TestCase):
    """Testes unitários para o motor Fogo de Prometheus (Raspador Diário FEMURN)."""

    def setUp(self):
        self.assertIsNotNone(scraper_femurn, "Não foi possível importar scraper_femurn")

    def test_01_normalizar_texto_sem_acentos(self):
        """Valida que textos com acentuação e caracteres especiais são normalizados para ASCII minúsculo."""
        fn = scraper_femurn.normalizar_texto_sem_acentos
        self.assertEqual(fn("Educação Básica"), "educacao basica")
        self.assertEqual(fn("PORTARIA Nº 045/2026 - CONVOCAÇÃO"), "portaria no 045/2026 - convocacao")
        self.assertEqual(fn("Secretária & Diretor"), "secretaria & diretor")
        self.assertEqual(fn(None), "")
        self.assertEqual(fn(""), "")
        self.assertEqual(fn(12345), "12345")

    def test_02_contem_palavra_chave(self):
        """Valida a detecção semântica insensível a caixa e acentuação de termos-chave educacionais."""
        fn = scraper_femurn.contem_palavra_chave
        termos = ["educação", "smeb", "professor", "readaptação"]

        self.assertTrue(fn("Secretaria Municipal de Educacao Basica", termos))
        self.assertTrue(fn("Aviso aos professores e coordenadores escolares", termos))
        self.assertTrue(fn("Publicacao de portaria referente a READAPTAÇÃO funcional", termos))
        self.assertFalse(fn("Obras de pavimentacao asfaltica na zona rural", termos))
        self.assertFalse(fn("", termos))

    def test_03_classificar_tipo_ato(self):
        """Valida a classificação hierárquica correta de matérias oficiais publicadas no Diário."""
        fn = scraper_femurn.classificar_tipo_ato

        self.assertEqual(fn("PORTARIA Nº 101/2026 - NOMEAR SERVIDOR"), "PORTARIA")
        self.assertEqual(fn("EDITAL DE PROCESSO SELETIVO SIMPLIFICADO Nº 01/2026"), "EDITAL_PSS")
        self.assertEqual(fn("CONVOCAÇÃO DE CANDIDATOS CLASSIFICADOS"), "EDITAL_PSS")
        self.assertEqual(fn("DECRETO MUNICIPAL Nº 1.250 REGULAMENTA FUNDEB"), "NORMATIVO_JURIDICO")
        self.assertEqual(fn("LEI MUNICIPAL Nº 2.890/2026"), "NORMATIVO_JURIDICO")
        self.assertEqual(fn("TERMO DE PERMUTA DE SERVIDORES ENTRE MUNICÍPIOS"), "PERMUTA_RH")
        self.assertEqual(fn("CESSÃO DE SERVIDOR PÚBLICO"), "PERMUTA_RH")
        self.assertEqual(fn("DESPACHO INFORMATIVO DO GABINETE"), "ATO_GABINETE")

    def test_04_extrair_entidades_estruturadas_ner(self):
        """Testa o extrator de entidades nomeadas (NER Leve) para identificar número do ato, matrícula e servidor."""
        fn = scraper_femurn.extrair_entidades_estruturadas

        texto_exemplo = (
            "PORTARIA Nº 045/2026 - GP/SMEB\n"
            "O Prefeito Municipal resolve conceder licença especial a servidora "
            "MARIA HELENA DOS SANTOS, matrícula nº 12345-6, ocupante do cargo de Professor.\n"
            "Também designar a servidora ANA PAULA ROCHA, matrícula 9988-0, para responder pela coordenação."
        )

        res = fn(texto_exemplo, "Portaria de Concessão de Licença")
        self.assertEqual(res["numero_ato"], "045/2026")
        self.assertIn("12345-6", res["matriculas"])
        self.assertIn("9988-0", res["matriculas"])
        self.assertIn("MARIA HELENA DOS SANTOS", res["servidores"])
        self.assertIn("ANA PAULA ROCHA", res["servidores"])

    def test_05_obter_intervalo_datas(self):
        """Testa o comportamento do seletor de datas com e sem variáveis customizadas."""
        fn = scraper_femurn.obter_intervalo_datas

        # Sem variáveis customizadas: deve retornar data atual no formato DD/MM/AAAA
        with patch.dict(os.environ, {}, clear=True):
            d_ini, d_fim = fn()
            self.assertRegex(d_ini, r"^\d{2}/\d{2}/\d{4}$")
            self.assertEqual(d_ini, d_fim)

        # Com variáveis customizadas
        with patch.dict(os.environ, {"DATA_INICIO_CUSTOM": "01/03/2026", "DATA_FIM_CUSTOM": "15/03/2026"}):
            d_ini, d_fim = fn()
            self.assertEqual(d_ini, "01/03/2026")
            self.assertEqual(d_fim, "15/03/2026")

    def test_06_sincronizar_supabase_publicacoes_payload_and_mock(self):
        """Testa o batch upsert de matérias mineradas no Supabase simulando chamadas HTTP mockadas."""
        fn = scraper_femurn.sincronizar_supabase_publicacoes

        mock_pubs = [
            {
                "codigo_identificador": "COD-001-SMEB",
                "data_publicacao": "2026-03-10",
                "titulo_ato": "Portaria 045/2026 Concessão de Licença",
                "categoria": "PORTARIA",
                "entidade": "Prefeitura Municipal de Ceará-Mirim",
                "orgao": "Secretaria Municipal de Educação Básica",
                "url_materia": "https://femurn.gov.br/materia/001",
                "entidades_ner": {
                    "numero_ato": "045/2026",
                    "matriculas": ["12345-6"],
                    "servidores": ["MARIA HELENA DOS SANTOS"]
                }
            }
        ]

        fake_env = {
            "SUPABASE_URL": "https://test-olympos.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "fake-service-role-key-test-environment-2026"
        }

        with patch.dict(os.environ, fake_env):
            with patch("requests.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 201
                mock_resp.text = '[{"id": "11111111-2222-3333-4444-555555555555"}]'
                mock_post.return_value = mock_resp

                sucesso = fn(mock_pubs, "2026-03-10")
                self.assertTrue(sucesso)
                self.assertTrue(mock_post.called)

                # Valida headers e endpoint
                args, kwargs = mock_post.call_args
                self.assertEqual(args[0], "https://test-olympos.supabase.co/rest/v1/publicacoes_diario")
                headers = kwargs.get("headers", {})
                self.assertEqual(headers["apikey"], "fake-service-role-key-test-environment-2026")
                self.assertEqual(headers["Authorization"], "Bearer fake-service-role-key-test-environment-2026")

                # Valida estrutura do payload
                lote = kwargs.get("json", [])
                self.assertEqual(len(lote), 1)
                item = lote[0]
                self.assertEqual(item["edicao"], "COD-001-SMEB")
                self.assertEqual(item["data_publicacao"], "2026-03-10")
                self.assertEqual(item["ato_tipo"], "PORTARIA")
                self.assertIn("MARIA HELENA DOS SANTOS", item["servidores_envolvidos"])

    def test_07_sincronizar_supabase_missing_env_vars_handled_gracefully(self):
        """Verifica que a ausência de chaves de ambiente não lança exceção não tratada."""
        fn = scraper_femurn.sincronizar_supabase_publicacoes
        with patch.dict(os.environ, {}, clear=True):
            resultado = fn([{"codigo_identificador": "COD-TEST"}], "2026-03-10")
            self.assertFalse(resultado, "Deveria retornar False quando variáveis de ambiente estão ausentes")


class TestPapiroDeCadmoEngine(unittest.TestCase):
    """Testes unitários para o pipeline O Papiro de Cadmo (Normalizador e Ingestão Supabase)."""

    def setUp(self):
        self.assertIsNotNone(normalizar_dataframe, "Não foi possível importar normalizar_dataframe")
        self.assertIsNotNone(sincronizar_folha_supabase, "Não foi possível importar sincronizar_folha_supabase")

    def test_08_normalizar_dataframe_schema_and_synonyms(self):
        """Valida que o normalizador mapeia sinônimos de colunas para o esquema canônico de 8 colunas."""
        raw_data = {
            "Nome do Servidor": ["  Maria Silva  ", "Joao Pereira\n"],
            "Matrícula": ["102030", "405060"],
            "Cargo/Função": ["professor", "diretor escolar"],
            "Lotação": ["escola municipal a", "sede da smeb"],
            "Vínculo": ["efetivo", "comissionado"]
        }
        df_raw = pd.DataFrame(raw_data)

        df_norm = normalizar_dataframe(df_raw, "Ceara-Mirim", "2026-02")

        # Verifica se todas as 8 colunas canônicas estão presentes na ordem correta
        self.assertEqual(list(df_norm.columns), COLUNAS_PADRAO)
        self.assertEqual(len(df_norm), 2)

        # Verifica transformações de maiúsculas e limpeza de texto
        self.assertEqual(df_norm.iloc[0]["nome_completo"], "MARIA SILVA")
        self.assertEqual(df_norm.iloc[1]["nome_completo"], "JOAO PEREIRA")
        self.assertEqual(df_norm.iloc[0]["cargo_funcao"], "PROFESSOR")
        self.assertEqual(df_norm.iloc[1]["cargo_funcao"], "DIRETOR ESCOLAR")
        self.assertEqual(df_norm.iloc[0]["ente_origem"], "Ceara-Mirim")
        self.assertEqual(df_norm.iloc[0]["competencia"], "2026-02")
        self.assertEqual(df_norm.iloc[0]["carga_horaria"], "30h")
        self.assertEqual(df_norm.iloc[0]["situacao_vinculo"], "EFETIVO")

    def test_09_normalizar_dataframe_filters_empty_records(self):
        """Valida que registros com nome de servidor vazio são descartados."""
        raw_data = {
            "nome": ["Carlos Alberto", "", "   ", None, "Fernanda Lima"],
            "matricula": ["111", "222", "333", "444", "555"],
            "cargo": ["Auxiliar", "Auxiliar", "Auxiliar", "Auxiliar", "Professor"]
        }
        df_raw = pd.DataFrame(raw_data)
        df_norm = normalizar_dataframe(df_raw, "Natal", "2026-01")

        self.assertEqual(len(df_norm), 2)
        nomes = list(df_norm["nome_completo"])
        self.assertIn("CARLOS ALBERTO", nomes)
        self.assertIn("FERNANDA LIMA", nomes)

    def test_10_cadmo_supabase_ingestion_payload_and_mock(self):
        """Testa a ingestão em lote para a tabela folha_intermunicipal mockando a chamada HTTP."""
        with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False, encoding="utf-8-sig") as tmp:
            tmp.write(
                "ente_origem,competencia,matricula,nome_completo,cargo_funcao,carga_horaria,lotacao_orgao,situacao_vinculo\n"
                "Ceara-Mirim,2026-02,12345,ANA PAULA ROCHA,PROFESSOR,30h,ESCOLA ALICE GARCIA,ATIVO\n"
                "Natal,2026-02,67890,BRUNO COSTA,DIRETOR,40h,SEDEC,EFETIVO\n"
            )
            tmp_path = Path(tmp.name)

        try:
            fake_env = {
                "SUPABASE_URL": "https://test-olympos.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "fake-service-key-for-cadmo-tests-2026"
            }

            with patch.dict(os.environ, fake_env):
                with patch("requests.post") as mock_post:
                    mock_resp = MagicMock()
                    mock_resp.status_code = 201
                    mock_resp.text = ""
                    mock_post.return_value = mock_resp

                    sucesso = sincronizar_folha_supabase(tmp_path, tamanho_lote=50)
                    self.assertTrue(sucesso)
                    self.assertTrue(mock_post.called)

                    args, kwargs = mock_post.call_args
                    self.assertEqual(args[0], "https://test-olympos.supabase.co/rest/v1/folha_intermunicipal")

                    payload = kwargs.get("json", [])
                    self.assertEqual(len(payload), 2)
                    p1 = payload[0]
                    self.assertEqual(p1["mes_ano"], "2026-02")
                    self.assertEqual(p1["municipio"], "Ceara-Mirim")
                    self.assertEqual(p1["cargo"], "PROFESSOR")
                    self.assertEqual(p1["dados_remuneracao"]["nome_completo"], "ANA PAULA ROCHA")
                    self.assertEqual(p1["dados_remuneracao"]["matricula"], "12345")
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def test_11_cadmo_supabase_missing_env_vars_and_missing_file_handled(self):
        """Valida que ausência de credenciais ou arquivo inexistente retorna False sem interrupção fatal."""
        # 1. Sem variáveis de ambiente
        with patch.dict(os.environ, {}, clear=True):
            res1 = sincronizar_folha_supabase(Path("arquivo_inexistente.csv"))
            self.assertFalse(res1)

        # 2. Com variáveis de ambiente mas arquivo inexistente
        fake_env = {"SUPABASE_URL": "https://test.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "key"}
        with patch.dict(os.environ, fake_env):
            res2 = sincronizar_folha_supabase(Path("caminho_inexistente_12345.csv"))
            self.assertFalse(res2)


if __name__ == "__main__":
    unittest.main()
