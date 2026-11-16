"""
Módulo de Upload do Arquivo Consolidado no Google Drive.
Destino: Pasta Oficial das Planilhas dos Portais de Transparência (1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD).
Suporta autenticação via GCP Service Account (GCP_SA_KEY) e fallback para API do Hub Olympos.
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.uploader")

PASTA_DESTINO_PADRAO = "1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD"


def salvar_status_drive(
    caminho_csv: Optional[Path],
    sucesso: bool,
    folder_id: str,
    file_id: Optional[str] = None,
    metodo: str = "service_account",
    motivo: Optional[str] = None
) -> Dict[str, Any]:
    """
    Grava o arquivo status_drive.json no diretório de dados processados,
    fornecendo rastreabilidade estruturada para a matriz analítica e resumo executivo.
    """
    resultado = {
        "sucesso": sucesso,
        "folder_id": folder_id,
        "file_id": file_id,
        "arquivo": caminho_csv.name if caminho_csv else None,
        "metodo": metodo,
        "motivo": motivo,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    if caminho_csv:
        try:
            status_path = caminho_csv.parent / "status_drive.json"
            with open(status_path, "w", encoding="utf-8") as f:
                json.dump(resultado, f, indent=2, ensure_ascii=False)
            logger.info(f"[DRIVE STATUS] Status registrado em {status_path}")
        except Exception as es:
            logger.warning(f"[DRIVE STATUS] Falha ao registrar status_drive.json: {es}")
    return resultado


def upload_via_gas_webhook(caminho_csv: Path, folder_id: str) -> Optional[str]:
    """
    Fallback gracioso de upload via WebApp Google Apps Script (GAS_WEBHOOK_URL).
    O WebApp é executado com a identidade do proprietário do Drive, que possui cota plena,
    contornando a restrição de quota zero de Service Accounts em drives individuais.
    """
    webhook_url = os.environ.get("GAS_WEBHOOK_URL", "").strip()
    token = os.environ.get("OLYMPOS_SECRET_TOKEN", "").strip()
    if not webhook_url:
        logger.info("[DRIVE FALLBACK] GAS_WEBHOOK_URL não configurada. Fallback via Apps Script indisponível.")
        return None

    try:
        import base64
        import requests

        nome_arquivo = caminho_csv.name
        conteudo_bytes = caminho_csv.read_bytes()
        conteudo_b64 = base64.b64encode(conteudo_bytes).decode("utf-8")

        payload = {
            "token": token,
            "action": "upload_drive_file",
            "folder_id": folder_id,
            "filename": nome_arquivo,
            "content_base64": conteudo_b64,
            "mimetype": "text/csv"
        }

        resp = requests.post(webhook_url, json=payload, timeout=60)
        if 200 <= resp.status_code < 300:
            try:
                data = resp.json()
            except Exception:
                data = {}
            file_id = data.get("file_id") or data.get("id") or "gas_uploaded"
            logger.info(f"[DRIVE FALLBACK GAS] Upload via WebApp concluído com sucesso! ID: {file_id}")
            return file_id
        else:
            logger.warning(f"[DRIVE FALLBACK GAS] WebApp respondeu HTTP {resp.status_code}: {resp.text}")
            return None
    except Exception as e_gas:
        logger.warning(f"[DRIVE FALLBACK GAS] Exceção durante fallback para GAS WebApp: {e_gas}")
        return None


def upload_via_service_account(caminho_csv: Path, folder_id: str) -> Optional[str]:
    """
    Realiza o upload do arquivo consolidado para o Google Drive utilizando Google Service Account.
    Configurado com suporte mandatório a Shared Drives (Google Workspace):
    - supportsAllDrives=True
    - includeItemsFromAllDrives=True
    - corpora='allDrives'
    Em caso de cota excedida (storageQuotaExceeded em Drives pessoais), implementa fallback gracioso.
    """
    caminho_csv = Path(caminho_csv)
    sa_json = os.environ.get("GCP_SA_KEY")

    if not sa_json:
        logger.warning("Variável GCP_SA_KEY não encontrada. Verificando fallback via GAS WebApp...")
        gas_id = upload_via_gas_webhook(caminho_csv, folder_id)
        if gas_id:
            salvar_status_drive(caminho_csv, True, folder_id, file_id=gas_id, metodo="gas_webhook")
            return gas_id
        salvar_status_drive(caminho_csv, False, folder_id, metodo="nenhum", motivo="GCP_SA_KEY não configurada")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]
        )

        service = build("drive", "v3", credentials=credentials)

        nome_arquivo = caminho_csv.name
        logger.info(f"[DRIVE] Fazendo upload de {nome_arquivo} para a pasta {folder_id} (Shared Drive habilitado)...")

        # Verifica se já existe arquivo com o mesmo nome na pasta (compatível com Shared Drives)
        query = f"'{folder_id}' in parents and name = '{nome_arquivo}' and trashed = false"
        res = service.files().list(
            q=query,
            fields="files(id, name)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora="allDrives"
        ).execute()
        arquivos_existentes = res.get("files", [])

        media = MediaFileUpload(str(caminho_csv), mimetype="text/csv", resumable=True)

        if arquivos_existentes:
            file_id = arquivos_existentes[0]["id"]
            updated_file = service.files().update(
                fileId=file_id,
                media_body=media,
                supportsAllDrives=True
            ).execute()
            logger.info(f"[DRIVE] Arquivo existente atualizado com sucesso no Shared Drive! ID: {file_id}")
            salvar_status_drive(caminho_csv, True, folder_id, file_id=file_id, metodo="service_account")
            return file_id
        else:
            file_metadata = {
                "name": nome_arquivo,
                "parents": [folder_id]
            }
            created_file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id",
                supportsAllDrives=True
            ).execute()
            file_id = created_file.get("id")
            logger.info(f"[DRIVE] Novo arquivo criado com sucesso no Google Drive! ID: {file_id}")
            salvar_status_drive(caminho_csv, True, folder_id, file_id=file_id, metodo="service_account")
            return file_id

    except Exception as e:
        erro_str = str(e)
        status_code = getattr(getattr(e, "resp", None), "status", None)
        is_quota_error = "storageQuotaExceeded" in erro_str or (status_code == 403 and "quota" in erro_str.lower())

        if is_quota_error:
            msg_quota = (
                f"[GOOGLE DRIVE ERRO 403 storageQuotaExceeded] "
                f"Contas de Serviço (GCP Service Accounts) possuem cota zero de armazenamento próprio em drives pessoais. "
                f"A pasta de destino '{folder_id}' deve residir em um Google Workspace Shared Drive (Drive Compartilhado) "
                f"com a conta de serviço adicionada como Administrador de Conteúdo (Content Manager), ou deve ser configurada "
                f"Delegação em Todo o Domínio (DWD) / GAS_WEBHOOK_URL."
            )
            logger.error(msg_quota)
            motivo = "storageQuotaExceeded (necessário Shared Drive ou GAS WebApp)"
        else:
            logger.error(f"[DRIVE ERRO] Erro ao fazer upload no Drive via Service Account: {e}")
            motivo = f"Erro API Drive: {e}"

        # Tentativa de fallback para WebApp Google Apps Script
        logger.info("[DRIVE] Tentando fallback gracioso para WebApp Google Apps Script...")
        gas_id = upload_via_gas_webhook(caminho_csv, folder_id)
        if gas_id:
            salvar_status_drive(caminho_csv, True, folder_id, file_id=gas_id, metodo="gas_webhook_fallback")
            return gas_id

        salvar_status_drive(caminho_csv, False, folder_id, metodo="service_account", motivo=motivo)
        return None


def main():
    raiz = Path(__file__).resolve().parent.parent
    processed_dir = raiz / "data" / "processed"
    folder_id = os.environ.get("DRIVE_FOLDER_ID", PASTA_DESTINO_PADRAO)

    arquivos = sorted(processed_dir.glob("servidores-intermunicipais-*.csv"), reverse=True)
    if not arquivos:
        logger.error("Nenhum arquivo consolidado encontrado em data/processed.")
        return

    csv_alvo = arquivos[0]

    # Ingestão e sincronização direta no Supabase (se configurado)
    try:
        try:
            from .upload_supabase import sincronizar_folha_supabase
        except (ImportError, ValueError):
            from upload_supabase import sincronizar_folha_supabase
        sincronizar_folha_supabase(csv_alvo)
    except Exception as eSup:
        logger.warning(f"[SUPABASE] Falha ao acionar sincronização: {eSup}")

    # Espelho documental no Google Drive
    upload_via_service_account(csv_alvo, folder_id)


if __name__ == "__main__":
    main()
