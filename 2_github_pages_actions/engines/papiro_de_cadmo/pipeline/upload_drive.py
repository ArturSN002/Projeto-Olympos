"""
Módulo de Upload do Arquivo Consolidado no Google Drive.
Destino: Pasta do Setor Pessoal (1VxVVONEJya4XqI2GfxHK7AFqk8dpwX9I).
Suporta autenticação via GCP Service Account (GCP_SA_KEY) e fallback para API do Hub Olympos.
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.uploader")

PASTA_DESTINO_PADRAO = "1VxVVONEJya4XqI2GfxHK7AFqk8dpwX9I"


def upload_via_service_account(caminho_csv: Path, folder_id: str) -> Optional[str]:
    sa_json = os.environ.get("GCP_SA_KEY")
    if not sa_json:
        logger.warning("Variável GCP_SA_KEY não encontrada. Pulando upload direto via Service Account.")
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
        logger.info(f"Fazendo upload de {nome_arquivo} para a pasta {folder_id}...")

        # Verifica se já existe arquivo com o mesmo nome na pasta para atualizar ou substituir
        query = f"'{folder_id}' in parents and name = '{nome_arquivo}' and trashed = false"
        res = service.files().list(q=query, fields="files(id, name)").execute()
        arquivos_existentes = res.get("files", [])

        media = MediaFileUpload(str(caminho_csv), mimetype="text/csv", resumable=True)

        if arquivos_existentes:
            file_id = arquivos_existentes[0]["id"]
            updated_file = service.files().update(fileId=file_id, media_body=media).execute()
            logger.info(f"Arquivo existente atualizado com sucesso! ID: {file_id}")
            return file_id
        else:
            file_metadata = {
                "name": nome_arquivo,
                "parents": [folder_id]
            }
            created_file = service.files().create(body=file_metadata, media_body=media, fields="id").execute()
            file_id = created_file.get("id")
            logger.info(f"Novo arquivo criado com sucesso no Google Drive! ID: {file_id}")
            return file_id

    except Exception as e:
        logger.error(f"Erro ao fazer upload no Drive via Service Account: {e}")
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
