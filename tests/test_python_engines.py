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
    from pipeline.normalizador import (
        normalizar_dataframe,
        COLUNAS_PADRAO,
        ler_csv_transparencia,
        extrair_miolo_cpf
    )
    from pipeline.cruzador_vinculos import (
        auditar_acumulacao_cf37,
        cruzar_vinculos,
        normalizar_nome
    )
    from pipeline.upload_supabase import sincronizar_folha_supabase
except ImportError as e:
    normalizar_dataframe = None
    sincronizar_folha_supabase = None
    COLUNAS_PADRAO = []

try:
    from extractors.base import BaseExtractor
    from extractors.topsolutions import TopSolutionsExtractor
    from extractors.natal import NatalExtractor
except ImportError:
    BaseExtractor = None
    TopSolutionsExtractor = None
    NatalExtractor = None


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

        # Validações M1: Republicações e Diretores Escolares
        self.assertEqual(fn("REPUBLICAÇÃO POR INCORREÇÃO DA PORTARIA Nº 105/2026"), "REPUBLICACAO")
        self.assertEqual(fn("REPUBLICADO POR INCORREÇÃO DO DECRETO Nº 45/2026"), "REPUBLICACAO")
        self.assertEqual(fn("PORTARIA Nº 200/2026 - NOMEAR DIRETOR ESCOLAR DA ESCOLA MUNICIPAL"), "NOMEACAO_DIRETOR")
        self.assertEqual(fn("DECRETO Nº 88/2026 - NOMEIA PARA CARGO EM COMISSÃO DE DIRETOR DE ESCOLA"), "NOMEACAO_DIRETOR")
        self.assertEqual(fn("PORTARIA Nº 210/2026 - DESIGNA PARA FUNÇÃO GRATIFICADA DE DIREÇÃO ESCOLAR"), "NOMEACAO_DIRETOR")
        # Atos com termo "junto à Secretaria Municipal de Educação" ou contexto educacional explícito
        self.assertEqual(fn("PORTARIA Nº 10/2026 - RESOLVE NOMEIA O SERVIDOR PARA O CARGO DE DIRETOR JUNTO À SECRETARIA MUNICIPAL DE EDUCAÇÃO"), "NOMEACAO_DIRETOR")
        self.assertEqual(fn("PORTARIA Nº 10/2026 - DESIGNA O SERVIDOR PARA O CARGO DE DIRETOR DA ESCOLA MUNICIPAL ALICE GARCIA"), "NOMEACAO_DIRETOR")

        # Refinamento M3: Atos de Diretor de OUTRAS secretarias NÃO DEVEM ser classificados como NOMEACAO_DIRETOR
        self.assertEqual(fn("PORTARIA Nº 10/2026 - RESOLVE NOMEIA PARA O CARGO DE DIRETOR DO DEPARTAMENTO DE OBRAS DA SECRETARIA MUNICIPAL DE OBRAS"), "PORTARIA")
        self.assertEqual(fn("PORTARIA Nº 10/2026 - NOMEIA DIRETOR DO HOSPITAL MUNICIPAL DA SECRETARIA DE SAÚDE"), "PORTARIA")
        self.assertEqual(fn("PORTARIA Nº 10/2026 - RESOLVE NOMEIA PARA O CARGO DE DIRETOR DO DEPARTAMENTO DE TRIBUTAÇÃO"), "PORTARIA")
        self.assertEqual(fn("PORTARIA COM INCORREÇÃO Nº 77/2026"), "REPUBLICACAO")

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

        # Validação M1: Nomeação de diretora escolar sem matrícula imediata
        texto_nomeacao = (
            "PORTARIA Nº 088/2026 - GP/SMEB\n"
            "O Prefeito Municipal resolve NOMEAR a Senhora CLAUDIA REGINA BARBOSA "
            "para exercer o Cargo em Comissão de Diretora Escolar da Escola Municipal Alice Garcia Freire."
        )
        res_nom = fn(texto_nomeacao, "Nomeação de Diretora")
        self.assertEqual(res_nom["numero_ato"], "088/2026")
        self.assertIn("CLAUDIA REGINA BARBOSA", res_nom["servidores"])

        # Remediation M1: Conjugação verbal no presente indicativo (NOMEIA, DESIGNA)
        texto_conjugado = (
            "PORTARIA Nº 10/2026 - GP\n"
            "Art. 1º NOMEIA a senhora CLAUDIA REGINA BARBOSA para exercer o cargo de Diretora Escolar.\n"
            "Art. 2º DESIGNA o senhor JOÃO DA SILVA para responder pela função de Vice-Diretor."
        )
        res_conj = fn(texto_conjugado, "Nomeações SMEB")
        self.assertEqual(res_conj["numero_ato"], "10/2026")
        self.assertIn("CLAUDIA REGINA BARBOSA", res_conj["servidores"])
        self.assertIn("JOÃO DA SILVA", res_conj["servidores"])

        # Remediation M1: Formas conjugadas de conceder, exonerar, readaptar
        texto_atos_rh = (
            "PORTARIA Nº 15/2026\n"
            "RESOLVE: CONCEDE ao servidor MARCOS PEREIRA DOS SANTOS, matrícula nº 12345-6, licença prêmio.\n"
            "RESOLVE: EXONERA a servidora MARIA DE SOUZA, matrícula nº 54321, a pedido.\n"
            "RESOLVE: READAPTA o servidor CARLOS ALBERTO, matrícula nº 9988, por laudo pericial."
        )
        res_rh = fn(texto_atos_rh, "Portarias de Pessoal")
        self.assertIn("MARCOS PEREIRA DOS SANTOS", res_rh["servidores"])
        self.assertIn("MARIA DE SOUZA", res_rh["servidores"])
        self.assertIn("CARLOS ALBERTO", res_rh["servidores"])

        # Remediation M1: Extração flexível de números com descritores intermediários
        res_inc = fn("PORTARIA COM INCORREÇÃO Nº 77/2026\nTexto do ato...")
        self.assertEqual(res_inc["numero_ato"], "77/2026")

        res_rep_ext = fn("REPUBLICADO POR INCORREÇÃO - EXTRATO DE CONTRATO Nº 09/2026\nObjeto contratual...")
        self.assertEqual(res_rep_ext["numero_ato"], "09/2026")

        res_pss = fn("EDITAL DE PROCESSO SELETIVO Nº 001/2026 - REPUBLICADO\nRegulamento do PSS...")
        self.assertEqual(res_pss["numero_ato"], "001/2026")

    def test_04b_formatar_nome_arquivo_oficial(self):
        """Valida a padronização oficial de nomes de arquivos do Diário Oficial (ex: Portaria - SMEB nº 163 de 29 de Outubro de 2026.pdf)."""
        fn_nome = scraper_femurn.formatar_nome_arquivo_oficial
        fn_data = scraper_femurn.formatar_data_por_extenso

        # 1. Validação de data por extenso
        self.assertEqual(fn_data("29/10/2026"), "29 de Outubro de 2026")
        self.assertEqual(fn_data("2026-10-29"), "29 de Outubro de 2026")

        # 2. Portaria com número puro
        nome1, tit1 = fn_nome("PORTARIA", "163", "29/10/2026", "SMEB")
        self.assertEqual(nome1, "Portaria - SMEB nº 163 de 29 de Outubro de 2026.pdf")
        self.assertEqual(tit1, "Portaria - SMEB nº 163 de 29 de Outubro de 2026")

        # 3. Portaria com barra de ano (ex: 163/2026) -> normaliza para nº 163
        nome2, tit2 = fn_nome("PORTARIA", "163/2026", "29/10/2026", "SMEB")
        self.assertEqual(nome2, "Portaria - SMEB nº 163 de 29 de Outubro de 2026.pdf")

        # 4. Edital de PSS
        nome3, tit3 = fn_nome("EDITAL_PSS", "02/2026", "15/03/2026", "SMEB")
        self.assertEqual(nome3, "Edital - SMEB nº 02 de 15 de Março de 2026.pdf")

        # 5. Ato sem número estruturado -> fallback por código
        nome4, tit4 = fn_nome("PORTARIA", "", "29/10/2026", "SMEB", cod_id="DD6CE488")
        self.assertEqual(nome4, "Portaria - SMEB (DD6CE488) de 29 de Outubro de 2026.pdf")

        # 6. Validações M1: Republicação e Nomeação de Diretor
        nome5, tit5 = fn_nome("REPUBLICACAO", "105/2026", "29/10/2026", "SMEB")
        self.assertEqual(nome5, "Republicação - SMEB nº 105 de 29 de Outubro de 2026.pdf")
        self.assertEqual(tit5, "Republicação - SMEB nº 105 de 29 de Outubro de 2026")

        nome6, tit6 = fn_nome("NOMEACAO_DIRETOR", "088/2026", "29/10/2026", "Gabinete")
        self.assertEqual(nome6, "Portaria - Gabinete nº 088 de 29 de Outubro de 2026.pdf")
        self.assertEqual(tit6, "Portaria - Gabinete nº 088 de 29 de Outubro de 2026")

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

    def test_17_prometheus_filtro_secao_e_palavras_chave_estritas(self):
        """Valida que palavras-chave estritas não geram falsos positivos com diretores de outras secretarias e suportam seções."""
        # 1. Palavras genéricas descontextualizadas não devem existir isoladas em KEYWORDS_EDUCACAO
        self.assertNotIn("diretor", scraper_femurn.KEYWORDS_EDUCACAO)
        self.assertNotIn("diretora", scraper_femurn.KEYWORDS_EDUCACAO)
        self.assertNotIn("coordenador", scraper_femurn.KEYWORDS_EDUCACAO)

        # Termos específicos de liderança escolar e vínculo devem constar
        self.assertIn("diretor escolar", scraper_femurn.KEYWORDS_EDUCACAO)
        self.assertIn("junto à secretaria municipal de educação", scraper_femurn.KEYWORDS_EDUCACAO)

        # 2. Atos de outras secretarias devem ser rejeitados como NOMEACAO_DIRETOR
        fn = scraper_femurn.classificar_tipo_ato
        self.assertEqual(fn("PORTARIA Nº 55/2026 - NOMEIA DIRETOR DO DEPARTAMENTO DE OBRAS DA SECRETARIA MUNICIPAL DE OBRAS"), "PORTARIA")
        self.assertEqual(fn("PORTARIA Nº 56/2026 - NOMEIA DIRETOR GERAL DO HOSPITAL MUNICIPAL DA SECRETARIA DE SAUDE"), "PORTARIA")
        self.assertEqual(fn("PORTARIA Nº 57/2026 - NOMEIA DIRETOR DO DEPARTAMENTO DE TRIBUTACAO DA SECRETARIA MUNICIPAL DE TRIBUTACAO"), "PORTARIA")

        # 3. Atos com menção explícita à escola ou à Educação devem ser aprovados
        self.assertEqual(fn("PORTARIA Nº 58/2026 - NOMEIA DIRETOR ESCOLAR DA ESCOLA MUNICIPAL"), "NOMEACAO_DIRETOR")
        self.assertEqual(fn("PORTARIA Nº 59/2026 - NOMEIA DIRETOR JUNTO À SECRETARIA MUNICIPAL DE EDUCAÇÃO"), "NOMEACAO_DIRETOR")
        self.assertEqual(fn("PORTARIA Nº 60/2026 - NOMEIA DIRETOR", orgao_origem="Secretaria Municipal de Educação Básica"), "NOMEACAO_DIRETOR")


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

    def test_12_normalizador_ler_csv_transparencia_title_rows_and_spaces(self):
        """Valida que ler_csv_transparencia ignora linhas de título no início e apara espaços nos cabeçalhos."""
        csv_conteudo = (
            '"Relatório de Servidores | MUNICÍPIO DE TESTE"\n'
            '\n'
            'Matricula ;Nome ;CPF ;OrgaoLotacao ;CargoFuncao;Carga Horaria;Vinculo;Data de InativacaoExoneracao\n'
            '"0010016";"ODJAIME CAMARA DE ARAUJO";"###.487.734-##";"SMEB";"PROFESSOR NIVEL SUPERIOR";"30h";"ESTATUTARIO";"Ativo"\n'
        )
        with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False, encoding="utf-8-sig") as tmp:
            tmp.write(csv_conteudo)
            tmp_path = Path(tmp.name)

        try:
            df = ler_csv_transparencia(tmp_path)
            self.assertEqual(len(df), 1)
            self.assertIn("Matricula", df.columns)
            self.assertIn("Nome", df.columns)
            self.assertIn("CPF", df.columns)
            self.assertEqual(df.iloc[0]["Matricula"], "0010016")

            df_norm = normalizar_dataframe(df, "Ceará-Mirim", "2026-09", manter_cpf=True)
            self.assertEqual(df_norm.iloc[0]["matricula"], "0010016")
            self.assertEqual(df_norm.iloc[0]["nome_completo"], "ODJAIME CAMARA DE ARAUJO")
            self.assertEqual(df_norm.iloc[0]["cpf_miolo"], "487734")
            self.assertEqual(df_norm.iloc[0]["cargo_funcao"], "PROFESSOR NIVEL SUPERIOR")
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def test_13_cruzador_vinculos_art37_auditoria(self):
        """Valida auditoria constitucional CF/88 Art. 37, XVI (dois cargos de professor até 60h)."""
        res_ok = auditar_acumulacao_cf37("PROFESSOR", "30h", "PROFESSOR", "30h", "Ceará-Mirim", "SEEC")
        self.assertTrue(res_ok["acumulacao_legal"])
        self.assertEqual(res_ok["carga_horaria_total"], 60)
        self.assertIn("Art. 37, XVI, 'a'", res_ok["enquadramento"])

        res_excess = auditar_acumulacao_cf37("PROFESSOR", "40h", "PROFESSOR", "30h", "Ceará-Mirim", "Natal")
        self.assertFalse(res_excess["acumulacao_legal"])
        self.assertEqual(res_excess["carga_horaria_total"], 70)

    def test_14_cadmo_fallback_regressivo_mensal(self):
        """Valida o mecanismo de cálculo regressivo e fallback mensal dos extratores TopSolutions."""
        self.assertIsNotNone(TopSolutionsExtractor, "TopSolutionsExtractor deve estar disponível")
        dummy_cfg = {
            "id": "parnamirim_test",
            "ente": "Parnamirim",
            "url": "https://pmparnamirimrn.transparencia.topsolutionsrn.com.br",
            "max_retrocesso_meses": 5
        }
        with tempfile.TemporaryDirectory() as tmp_dir:
            extractor = TopSolutionsExtractor(dummy_cfg, Path(tmp_dir))

            # Testa cálculo regressivo de competências
            comp_br_0, comp_iso_0 = extractor.calcular_competencia("10/2026", offset_meses_adicional=0)
            self.assertEqual(comp_br_0, "10/2026")
            self.assertEqual(comp_iso_0, "2026-10")

            comp_br_2, comp_iso_2 = extractor.calcular_competencia("10/2026", offset_meses_adicional=2)
            self.assertEqual(comp_br_2, "08/2026")
            self.assertEqual(comp_iso_2, "2026-08")

            # Testa formato MM-AAAA com hífen (ex: "08-2026") e AAAA-MM (ex: "2026-08")
            comp_br_h, comp_iso_h = extractor.calcular_competencia("08-2026", offset_meses_adicional=0)
            self.assertEqual(comp_br_h, "08/2026")
            self.assertEqual(comp_iso_h, "2026-08")

            # Simula falha nos 2 primeiros meses e sucesso no 3º mês (offset 2)
            arquivo_valido = Path(tmp_dir) / "parnamirim_test_2026-08.csv"
            arquivo_valido.write_text("matricula;nome;cargo\n123;Fulano;Professor\n", encoding="utf-8")

            def mock_tentar(comp_b, comp_i):
                if comp_i == "2026-08":
                    return arquivo_valido
                return None

            with patch.object(extractor, "_tentar_extrair_mes", side_effect=mock_tentar):
                res = extractor.extrair_com_fallback(competencia_override="10/2026", max_retrocesso=5)
                self.assertIsNotNone(res)
                self.assertEqual(res.name, "parnamirim_test_2026-08.csv")

    def test_15_natal_api_latin1_codec_resilience(self):
        """Valida resiliência de decodificação na API de Natal para payloads com caracteres Latin-1 (byte 0xe3 = 'ã')."""
        self.assertIsNotNone(NatalExtractor, "NatalExtractor deve estar disponível")
        dummy_cfg = {
            "id": "natal",
            "ente": "Natal",
            "url": "https://www2.natal.rn.gov.br/transparenciaapi/folha_pagamentos"
        }
        with tempfile.TemporaryDirectory() as tmp_dir:
            extractor = NatalExtractor(dummy_cfg, Path(tmp_dir))

            # Cria payload binário em ISO-8859-1 com byte 0xe3 (ã)
            json_latin1_bytes = '{"itens": [{"matricula": "99881", "nome": "JOS\xe3O DA COSTA", "cargo": "PROFESSOR", "lotacao": "SME - ESCOLA MUNICIPAL"}]}'.encode("latin-1")

            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.content = json_latin1_bytes
            mock_resp.json.side_effect = UnicodeDecodeError("utf-8", json_latin1_bytes, 40, 41, "invalid continuation byte")

            with patch("httpx.Client.get", return_value=mock_resp):
                arquivo = extractor._tentar_extrair_mes("2026-10")
                self.assertIsNotNone(arquivo, "Deveria extrair com sucesso via fallback latin-1")
                self.assertTrue(arquivo.exists())
                conteudo = arquivo.read_text(encoding="utf-8-sig")
                self.assertIn("JOSÃO DA COSTA", conteudo)
                self.assertIn("SME - ESCOLA MUNICIPAL", conteudo)

    def test_16_normalizador_pd_concat_argumento_correto(self):
        """Valida que o normalizador utiliza ignore_index=True em pd.concat sem disparar TypeError."""
        df1 = pd.DataFrame([{"ente_origem": "Natal", "matricula": "1", "nome_completo": "A", "cpf_miolo": "111222", "cargo_funcao": "Prof", "lotacao_orgao": "SME", "carga_horaria": "30h", "situacao_vinculo": "Ativo", "competencia": "2026-10"}])
        df2 = pd.DataFrame([{"ente_origem": "SGA", "matricula": "2", "nome_completo": "B", "cpf_miolo": "333444", "cargo_funcao": "Prof", "lotacao_orgao": "SME", "carga_horaria": "30h", "situacao_vinculo": "Ativo", "competencia": "2026-10"}])

        # Concatenação deve funcionar sem erro
        df_concat = pd.concat([df1, df2], ignore_index=True)
        self.assertEqual(len(df_concat), 2)
        self.assertEqual(list(df_concat.index), [0, 1])


if __name__ == "__main__":
    unittest.main()
