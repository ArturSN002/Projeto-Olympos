"""
Bateria de Testes Automatizados - Uploaders Supabase e Google Drive (Milestone M3)
Valida a sanitização contra PGRST125 no Supabase, suporte a Shared Drive e tratamento de quota no Google Drive.
"""
import os
import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ajusta caminhos para permitir importar tanto de Olympos quanto de papiro-de-cadmo
TESTS_DIR = Path(__file__).resolve().parent
OLYMPOS_ROOT = TESTS_DIR.parent
CADMO_ROOT = OLYMPOS_ROOT.parent / "papiro-de-cadmo"

sys.path.insert(0, str(CADMO_ROOT))
sys.path.insert(0, str(OLYMPOS_ROOT / "2_github_pages_actions" / "engines" / "papiro_de_cadmo"))

from pipeline.upload_supabase import (
    normalizar_postgrest_endpoint,
    sincronizar_folha_supabase,
    ResultadoSincronizacao
)
from pipeline.upload_drive import (
    upload_via_service_account,
    salvar_status_drive,
    upload_via_gas_webhook,
    PASTA_DESTINO_PADRAO
)


class MockHttpError(Exception):
    def __init__(self, resp, content, uri=None):
        self.resp = resp
        self.content = content
        self.uri = uri
        msg = content.decode("utf-8", errors="ignore") if isinstance(content, bytes) else str(content)
        super().__init__(f"HttpError {getattr(resp, 'status', '403')}: {msg}")


class TestUploadersM3(unittest.TestCase):
    """Testes de integridade técnica para o Milestone M3."""

    def test_01_normalizar_postgrest_endpoint_standard(self):
        """Valida montagem de endpoint canônico padrão."""
        url = "https://rbwizevjvbvjwtbwwyif.supabase.co"
        endpoint = normalizar_postgrest_endpoint(url, "folha_intermunicipal")
        self.assertEqual(endpoint, "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/folha_intermunicipal")

    def test_02_normalizar_postgrest_endpoint_trailing_slash(self):
        """Valida que trailing slash na base_url é removida sem gerar barras duplicadas."""
        url = "https://rbwizevjvbvjwtbwwyif.supabase.co/"
        endpoint = normalizar_postgrest_endpoint(url, "folha_intermunicipal")
        self.assertEqual(endpoint, "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/folha_intermunicipal")

    def test_03_normalizar_postgrest_endpoint_residual_rest_v1(self):
        """Valida a eliminação do sufixo '/rest/v1' duplicado (causa-raiz do erro PGRST125)."""
        url = "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1"
        endpoint = normalizar_postgrest_endpoint(url, "folha_intermunicipal")
        self.assertEqual(endpoint, "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/folha_intermunicipal")

    def test_04_normalizar_postgrest_endpoint_residual_rest_v1_slash(self):
        """Valida a eliminação do sufixo '/rest/v1/' com barra final."""
        url = "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/"
        endpoint = normalizar_postgrest_endpoint(url, "folha_intermunicipal")
        self.assertEqual(endpoint, "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/folha_intermunicipal")

    def test_05_normalizar_postgrest_endpoint_public_schema_prefix(self):
        """Valida que prefixo 'public.' na tabela é sanitizado para PostgREST."""
        url = "https://rbwizevjvbvjwtbwwyif.supabase.co"
        endpoint = normalizar_postgrest_endpoint(url, "public.folha_intermunicipal")
        self.assertEqual(endpoint, "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/folha_intermunicipal")

    def test_06_normalizar_postgrest_endpoint_table_trailing_slash(self):
        """Valida que barra final no nome da tabela é sanitizada."""
        url = "https://rbwizevjvbvjwtbwwyif.supabase.co"
        endpoint = normalizar_postgrest_endpoint(url, "folha_intermunicipal/")
        self.assertEqual(endpoint, "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/folha_intermunicipal")

    def test_07_sincronizar_folha_supabase_headers_and_status_file(self):
        """Valida headers de schema PostgREST e criação do status_supabase.json."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "servidores_teste.csv"
            csv_path.write_text(
                "ente_origem,competencia,matricula,nome_completo,cargo_funcao,carga_horaria,lotacao_orgao,situacao_vinculo\n"
                "Ceara-Mirim,2026-10,001,MARIA SILVA,PROFESSORA,30h,SMEB,ATIVO\n"
                "Natal,2026-10,002,JOAO SOUZA,AGENTE,40h,SEDEC,ATIVO\n",
                encoding="utf-8"
            )

            env = {
                "SUPABASE_URL": "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/",
                "SUPABASE_SERVICE_ROLE_KEY": "test-secret-key-12345"
            }

            with patch.dict(os.environ, env):
                with patch("requests.post") as mock_post:
                    mock_resp = MagicMock()
                    mock_resp.status_code = 201
                    mock_resp.text = ""
                    mock_post.return_value = mock_resp

                    resultado = sincronizar_folha_supabase(csv_path, tamanho_lote=10)
                    self.assertTrue(resultado)
                    self.assertEqual(resultado["enviados"], 2)
                    self.assertEqual(resultado["total"], 2)

                    # Verifica headers passados ao requests.post
                    mock_call = mock_post.call_args
                    endpoint_used = mock_call[0][0]
                    headers_used = mock_call[1].get("headers", {})

                    self.assertEqual(endpoint_used, "https://rbwizevjvbvjwtbwwyif.supabase.co/rest/v1/folha_intermunicipal")
                    self.assertEqual(headers_used.get("apikey"), "test-secret-key-12345")
                    self.assertEqual(headers_used.get("Authorization"), "Bearer test-secret-key-12345")
                    self.assertEqual(headers_used.get("Content-Profile"), "public")
                    self.assertEqual(headers_used.get("Accept-Profile"), "public")
                    self.assertEqual(headers_used.get("Prefer"), "return=minimal")

                    # Verifica que status_supabase.json foi salvo no mesmo diretório
                    status_file = Path(tmp_dir) / "status_supabase.json"
                    self.assertTrue(status_file.exists())
                    with open(status_file, "r", encoding="utf-8") as f:
                        status_data = json.load(f)
                    self.assertTrue(status_data["sucesso"])
                    self.assertEqual(status_data["enviados"], 2)
                    self.assertEqual(status_data["endpoint"], endpoint_used)

    def test_08_sincronizar_folha_supabase_handles_pgrst125_404(self):
        """Valida que resposta HTTP 404 PGRST125 é tratada sem crash e registrada em status_supabase.json."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "servidores_teste.csv"
            csv_path.write_text(
                "ente_origem,competencia,matricula,nome_completo,cargo_funcao,carga_horaria,lotacao_orgao,situacao_vinculo\n"
                "Ceara-Mirim,2026-10,001,MARIA SILVA,PROFESSORA,30h,SMEB,ATIVO\n",
                encoding="utf-8"
            )

            env = {
                "SUPABASE_URL": "https://rbwizevjvbvjwtbwwyif.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "test-key"
            }

            with patch.dict(os.environ, env):
                with patch("requests.post") as mock_post:
                    mock_resp = MagicMock()
                    mock_resp.status_code = 404
                    mock_resp.text = '{"code":"PGRST125","message":"Invalid path specified in request URL"}'
                    mock_post.return_value = mock_resp

                    resultado = sincronizar_folha_supabase(csv_path, tamanho_lote=10)
                    self.assertFalse(resultado)
                    self.assertEqual(resultado["enviados"], 0)
                    self.assertTrue(len(resultado.get("erros", [])) > 0)

                    status_file = Path(tmp_dir) / "status_supabase.json"
                    self.assertTrue(status_file.exists())
                    with open(status_file, "r", encoding="utf-8") as f:
                        status_data = json.load(f)
                    self.assertFalse(status_data["sucesso"])
                    self.assertIn("PGRST125", status_data["erros"][0])

    def _setup_mock_google(self):
        """Cria mock dos módulos do Google API Client para ambientes sem SDK instalado."""
        mock_google = MagicMock()
        mock_oauth2 = MagicMock()
        mock_sa = MagicMock()
        mock_googleapiclient = MagicMock()
        mock_discovery = MagicMock()
        mock_http = MagicMock()
        mock_errors = MagicMock()
        mock_errors.HttpError = MockHttpError

        mock_google.oauth2 = mock_oauth2
        mock_oauth2.service_account = mock_sa
        mock_googleapiclient.discovery = mock_discovery
        mock_googleapiclient.http = mock_http
        mock_googleapiclient.errors = mock_errors

        modules = {
            "google": mock_google,
            "google.oauth2": mock_oauth2,
            "google.oauth2.service_account": mock_sa,
            "googleapiclient": mock_googleapiclient,
            "googleapiclient.discovery": mock_discovery,
            "googleapiclient.http": mock_http,
            "googleapiclient.errors": mock_errors,
        }
        return modules, mock_discovery, mock_http, mock_sa

    def test_09_upload_drive_shared_drive_parameters_on_create(self):
        """Valida que create no Drive API utiliza supportsAllDrives=True e list usa allDrives."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "servidores_drive_teste.csv"
            csv_path.write_text("dummy,content\n1,2\n", encoding="utf-8")

            fake_sa = json.dumps({
                "type": "service_account",
                "client_email": "test-sa@test-proj.iam.gserviceaccount.com"
            })

            modules, mock_discovery, mock_http, mock_sa = self._setup_mock_google()

            with patch.dict(sys.modules, modules):
                with patch.dict(os.environ, {"GCP_SA_KEY": fake_sa}):
                    mock_service = MagicMock()
                    mock_discovery.build.return_value = mock_service

                    # Mock list: nenhum arquivo existente
                    mock_files = mock_service.files.return_value
                    mock_list_req = MagicMock()
                    mock_list_req.execute.return_value = {"files": []}
                    mock_files.list.return_value = mock_list_req

                    # Mock create: cria novo
                    mock_create_req = MagicMock()
                    mock_create_req.execute.return_value = {"id": "file_id_shared_drive_123"}
                    mock_files.create.return_value = mock_create_req

                    file_id = upload_via_service_account(csv_path, PASTA_DESTINO_PADRAO)
                    self.assertEqual(file_id, "file_id_shared_drive_123")

                    # Valida parâmetros em files().list()
                    list_kwargs = mock_files.list.call_args[1]
                    self.assertTrue(list_kwargs.get("supportsAllDrives"))
                    self.assertTrue(list_kwargs.get("includeItemsFromAllDrives"))
                    self.assertEqual(list_kwargs.get("corpora"), "allDrives")

                    # Valida parâmetros em files().create()
                    create_kwargs = mock_files.create.call_args[1]
                    self.assertTrue(create_kwargs.get("supportsAllDrives"))

                    # Valida que status_drive.json foi gerado com sucesso
                    status_file = Path(tmp_dir) / "status_drive.json"
                    self.assertTrue(status_file.exists())
                    with open(status_file, "r", encoding="utf-8") as f:
                        status_data = json.load(f)
                    self.assertTrue(status_data["sucesso"])
                    self.assertEqual(status_data["file_id"], "file_id_shared_drive_123")
                    self.assertEqual(status_data["metodo"], "service_account")

    def test_10_upload_drive_shared_drive_parameters_on_update(self):
        """Valida que update no Drive API utiliza supportsAllDrives=True."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "servidores_drive_teste.csv"
            csv_path.write_text("dummy,content\n1,2\n", encoding="utf-8")

            fake_sa = json.dumps({
                "type": "service_account",
                "client_email": "test-sa@test-proj.iam.gserviceaccount.com"
            })

            modules, mock_discovery, mock_http, mock_sa = self._setup_mock_google()

            with patch.dict(sys.modules, modules):
                with patch.dict(os.environ, {"GCP_SA_KEY": fake_sa}):
                    mock_service = MagicMock()
                    mock_discovery.build.return_value = mock_service

                    # Mock list: arquivo já existente encontrado
                    mock_files = mock_service.files.return_value
                    mock_list_req = MagicMock()
                    mock_list_req.execute.return_value = {"files": [{"id": "existing_id_999", "name": csv_path.name}]}
                    mock_files.list.return_value = mock_list_req

                    # Mock update: atualiza
                    mock_update_req = MagicMock()
                    mock_update_req.execute.return_value = {"id": "existing_id_999"}
                    mock_files.update.return_value = mock_update_req

                    file_id = upload_via_service_account(csv_path, PASTA_DESTINO_PADRAO)
                    self.assertEqual(file_id, "existing_id_999")

                    # Valida parâmetros em files().update()
                    update_kwargs = mock_files.update.call_args[1]
                    self.assertTrue(update_kwargs.get("supportsAllDrives"))
                    self.assertEqual(update_kwargs.get("fileId"), "existing_id_999")

    def test_11_upload_drive_storage_quota_exceeded_handled_gracefully(self):
        """Valida tratamento gracioso de HTTP 403 storageQuotaExceeded sem crash."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "servidores_drive_teste.csv"
            csv_path.write_text("dummy,content\n1,2\n", encoding="utf-8")

            fake_sa = json.dumps({
                "type": "service_account",
                "client_email": "test-sa@test-proj.iam.gserviceaccount.com"
            })

            modules, mock_discovery, mock_http, mock_sa = self._setup_mock_google()

            with patch.dict(sys.modules, modules):
                with patch.dict(os.environ, {"GCP_SA_KEY": fake_sa}, clear=True):
                    mock_service = MagicMock()
                    mock_discovery.build.return_value = mock_service

                    mock_files = mock_service.files.return_value
                    mock_list_req = MagicMock()
                    mock_list_req.execute.return_value = {"files": []}
                    mock_files.list.return_value = mock_list_req

                    # Simula exceção de quota do Google Drive
                    resp_mock = MagicMock()
                    resp_mock.status = 403
                    mock_files.create.side_effect = MockHttpError(resp=resp_mock, content=b'{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}')

                    file_id = upload_via_service_account(csv_path, PASTA_DESTINO_PADRAO)
                    self.assertIsNone(file_id)

                    # Verifica status_drive.json gerado com motivo claro
                    status_file = Path(tmp_dir) / "status_drive.json"
                    self.assertTrue(status_file.exists())
                    with open(status_file, "r", encoding="utf-8") as f:
                        status_data = json.load(f)
                    self.assertFalse(status_data["sucesso"])
                    self.assertIn("storageQuotaExceeded", status_data["motivo"])

    def test_12_upload_drive_quota_exceeded_gas_fallback(self):
        """Valida fallback para WebApp GAS quando storageQuotaExceeded ocorre e GAS_WEBHOOK_URL está configurada."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "servidores_drive_teste.csv"
            csv_path.write_text("dummy,content\n1,2\n", encoding="utf-8")

            fake_sa = json.dumps({
                "type": "service_account",
                "client_email": "test-sa@test-proj.iam.gserviceaccount.com"
            })

            env = {
                "GCP_SA_KEY": fake_sa,
                "GAS_WEBHOOK_URL": "https://script.google.com/macros/s/xyz/exec",
                "OLYMPOS_SECRET_TOKEN": "token-123"
            }

            modules, mock_discovery, mock_http, mock_sa = self._setup_mock_google()

            with patch.dict(sys.modules, modules):
                with patch.dict(os.environ, env):
                    mock_service = MagicMock()
                    mock_discovery.build.return_value = mock_service

                    mock_files = mock_service.files.return_value
                    mock_list_req = MagicMock()
                    mock_list_req.execute.return_value = {"files": []}
                    mock_files.list.return_value = mock_list_req

                    # Simula 403 storageQuotaExceeded
                    resp_mock = MagicMock()
                    resp_mock.status = 403
                    mock_files.create.side_effect = MockHttpError(resp=resp_mock, content=b'storageQuotaExceeded')

                    # Mock do fallback GAS via requests.post
                    with patch("requests.post") as mock_post:
                        mock_gas_resp = MagicMock()
                        mock_gas_resp.status_code = 200
                        mock_gas_resp.headers = {"content-type": "application/json"}
                        mock_gas_resp.json.return_value = {"file_id": "gas_file_id_fallback_456"}
                        mock_post.return_value = mock_gas_resp

                        file_id = upload_via_service_account(csv_path, PASTA_DESTINO_PADRAO)
                        self.assertEqual(file_id, "gas_file_id_fallback_456")

                        status_file = Path(tmp_dir) / "status_drive.json"
                        self.assertTrue(status_file.exists())
                        with open(status_file, "r", encoding="utf-8") as f:
                            status_data = json.load(f)
                        self.assertTrue(status_data["sucesso"])
                        self.assertEqual(status_data["file_id"], "gas_file_id_fallback_456")
                        self.assertEqual(status_data["metodo"], "gas_webhook_fallback")


if __name__ == "__main__":
    unittest.main()
