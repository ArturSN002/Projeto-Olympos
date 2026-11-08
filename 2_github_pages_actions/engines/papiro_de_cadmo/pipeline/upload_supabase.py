"""
Módulo de Sincronização e Ingestão em Lote no Supabase - O Papiro de Cadmo.
Consolida os registros de folha intermunicipal e realiza batch upsert na tabela
public.folha_intermunicipal utilizando SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
Versão 2.0.0 — Projeto Olympos
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
import requests
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.supabase_uploader")


class ResultadoSincronizacao(dict):
    """
    Dicionário estruturado com o resultado da sincronização no Supabase.
    Avalia como True em contexto booleano se sucesso for True, e False caso contrário,
    mantendo compatibilidade estrita com asserções booleanas legadas e testes unitários.
    """
    def __bool__(self) -> bool:
        return bool(self.get("sucesso", False))


def sincronizar_folha_supabase(caminho_csv: Path, tamanho_lote: int = 200) -> ResultadoSincronizacao:
    """
    Realiza a leitura do CSV consolidado e envia os registros em lotes para a tabela
    folha_intermunicipal do Supabase. Retorna um dicionário estruturado com o resultado da operação.
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        logger.warning("[SUPABASE] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas. Pulando sincronização.")
        return ResultadoSincronizacao(
            sucesso=False,
            total=0,
            enviados=0,
            motivo="SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas"
        )

    caminho = Path(caminho_csv)
    if not caminho.exists():
        logger.error(f"[SUPABASE] Arquivo CSV não encontrado: {caminho}")
        return ResultadoSincronizacao(
            sucesso=False,
            total=0,
            enviados=0,
            motivo=f"Arquivo CSV não encontrado: {caminho}"
        )

    try:
        df = pd.read_csv(caminho, dtype=str)
        df.fillna("", inplace=True)
    except Exception as e:
        logger.error(f"[SUPABASE] Falha ao ler CSV {caminho}: {e}")
        return ResultadoSincronizacao(
            sucesso=False,
            total=0,
            enviados=0,
            motivo=f"Falha ao ler CSV {caminho}: {e}"
        )

    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/folha_intermunicipal"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    registros: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        mes_ano = str(row.get("competencia", "")).strip() or "2026-01"
        municipio = str(row.get("ente_origem", "")).strip() or "Não informado"
        cargo = str(row.get("cargo_funcao", "")).strip() or "Não informado"

        dados_remuneracao = {
            "matricula": str(row.get("matricula", "")).strip(),
            "nome_completo": str(row.get("nome_completo", "")).strip(),
            "carga_horaria": str(row.get("carga_horaria", "")).strip(),
            "lotacao_orgao": str(row.get("lotacao_orgao", "")).strip(),
            "situacao_vinculo": str(row.get("situacao_vinculo", "")).strip()
        }

        registros.append({
            "mes_ano": mes_ano,
            "municipio": municipio,
            "cargo": cargo,
            "dados_remuneracao": dados_remuneracao
        })

    total_registros = len(registros)
    logger.info(f"[SUPABASE] Iniciando envio de {total_registros} registros em lotes de {tamanho_lote}...")

    sucessos = 0
    for idx in range(0, total_registros, tamanho_lote):
        fatia = registros[idx:idx + tamanho_lote]
        try:
            resp = requests.post(endpoint, json=fatia, headers=headers, timeout=60)
            if 200 <= resp.status_code < 300:
                sucessos += len(fatia)
                logger.info(f"[SUPABASE - Lote {idx // tamanho_lote + 1}] {len(fatia)} registros enviados com sucesso (HTTP {resp.status_code}).")
            else:
                logger.error(f"[SUPABASE ERRO - Lote {idx // tamanho_lote + 1}] HTTP {resp.status_code}: {resp.text}")
        except Exception as err:
            logger.error(f"[SUPABASE EXCEPTION] Erro no lote {idx // tamanho_lote + 1}: {err}")

    logger.info(f"[SUPABASE] Sincronização concluída: {sucessos}/{total_registros} registros persistidos.")
    sucesso = (sucessos > 0 or total_registros == 0)
    resultado = ResultadoSincronizacao(
        sucesso=sucesso,
        total=total_registros,
        enviados=sucessos,
        tamanho_lote=tamanho_lote,
        endpoint=endpoint
    )

    try:
        status_path = caminho.parent / "status_supabase.json"
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(dict(resultado), f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    return resultado


def main():
    raiz = Path(__file__).resolve().parent.parent
    processed_dir = raiz / "data" / "processed"

    arquivos = sorted(processed_dir.glob("servidores-intermunicipais-*.csv"), reverse=True)
    if not arquivos:
        logger.info("Nenhum arquivo consolidado encontrado em data/processed.")
        return

    csv_alvo = arquivos[0]
    sincronizar_folha_supabase(csv_alvo)


if __name__ == "__main__":
    main()
