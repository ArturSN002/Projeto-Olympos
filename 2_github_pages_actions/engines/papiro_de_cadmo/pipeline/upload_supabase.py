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
from datetime import datetime, timezone
import time
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


def normalizar_postgrest_endpoint(base_url: str, tabela: str = "folha_intermunicipal") -> str:
    """
    Normaliza a URL do endpoint PostgREST suportando:
    - URLs base com ou sem barra final (ex: 'https://xxx.supabase.co/')
    - URLs base contendo ou não o sufixo residual '/rest/v1' ou '/rest/v1/'
    - Nomes de tabela qualificados com schema (ex: 'public.folha_intermunicipal')
    - Supressão de barras finais que quebram o roteamento PostgREST (causa-raiz do erro PGRST125)
    Retorna rigorosamente: https://{host}/rest/v1/{tabela_limpa}
    """
    url = (base_url or "").strip().rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[:-len("/rest/v1")].rstrip("/")

    # Remove prefixo de schema caso venha como "public.folha_intermunicipal" e barras
    tabela_limpa = (tabela or "").strip().strip("/")
    if tabela_limpa.startswith("public."):
        tabela_limpa = tabela_limpa[len("public."):].strip().strip("/")
    elif "." in tabela_limpa:
        tabela_limpa = tabela_limpa.split(".")[-1].strip().strip("/")

    if not tabela_limpa:
        tabela_limpa = "folha_intermunicipal"

    return f"{url}/rest/v1/{tabela_limpa}"


def sincronizar_folha_supabase(
    caminho_csv: Path,
    tamanho_lote: int = 200,
    tabela: str = "folha_intermunicipal"
) -> ResultadoSincronizacao:
    """
    Realiza a leitura do CSV consolidado e envia os registros em lotes para a tabela
    folha_intermunicipal do Supabase. Retorna um dicionário estruturado com o resultado da operação.
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        logger.warning("[SUPABASE] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas. Pulando sincronização.")
        resultado = ResultadoSincronizacao(
            sucesso=False,
            total=0,
            enviados=0,
            motivo="SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas"
        )
        try:
            if caminho_csv and Path(caminho_csv).parent.exists():
                status_path = Path(caminho_csv).parent / "status_supabase.json"
                with open(status_path, "w", encoding="utf-8") as f:
                    json.dump(dict(resultado), f, indent=2, ensure_ascii=False)
        except Exception:
            pass
        return resultado

    caminho = Path(caminho_csv)
    if not caminho.exists():
        logger.error(f"[SUPABASE] Arquivo CSV não encontrado: {caminho}")
        resultado = ResultadoSincronizacao(
            sucesso=False,
            total=0,
            enviados=0,
            motivo=f"Arquivo CSV não encontrado: {caminho}"
        )
        try:
            if caminho.parent.exists():
                status_path = caminho.parent / "status_supabase.json"
                with open(status_path, "w", encoding="utf-8") as f:
                    json.dump(dict(resultado), f, indent=2, ensure_ascii=False)
        except Exception:
            pass
        return resultado

    try:
        df = pd.read_csv(caminho, dtype=str)
        df.fillna("", inplace=True)
    except Exception as e:
        logger.error(f"[SUPABASE] Falha ao ler CSV {caminho}: {e}")
        resultado = ResultadoSincronizacao(
            sucesso=False,
            total=0,
            enviados=0,
            motivo=f"Falha ao ler CSV {caminho}: {e}"
        )
        try:
            status_path = caminho.parent / "status_supabase.json"
            with open(status_path, "w", encoding="utf-8") as f:
                json.dump(dict(resultado), f, indent=2, ensure_ascii=False)
        except Exception:
            pass
        return resultado

    endpoint = normalizar_postgrest_endpoint(supabase_url, tabela)
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
        "Content-Profile": "public",
        "Accept-Profile": "public"
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
    logger.info(f"[SUPABASE] Iniciando envio de {total_registros} registros em lotes de {tamanho_lote} para {endpoint}...")

    sucessos = 0
    erros: List[str] = []
    max_retries = 3

    for idx in range(0, total_registros, tamanho_lote):
        fatia = registros[idx:idx + tamanho_lote]
        lote_num = idx // tamanho_lote + 1

        for tentativa in range(1, max_retries + 1):
            try:
                resp = requests.post(endpoint, json=fatia, headers=headers, timeout=60)
                if 200 <= resp.status_code < 300:
                    sucessos += len(fatia)
                    logger.info(f"[SUPABASE - Lote {lote_num}] {len(fatia)} registros enviados com sucesso (HTTP {resp.status_code}).")
                    break
                elif resp.status_code == 404:
                    msg_erro = (
                        f"HTTP 404 PGRST125 no endpoint '{endpoint}': {resp.text}. "
                        "Verifique se o path da tabela está correto e se o schema 'public' está exposto no PostgREST."
                    )
                    logger.error(f"[SUPABASE ERRO 404 - Lote {lote_num}] {msg_erro}")
                    erros.append(msg_erro)
                    break
                elif resp.status_code in (429, 500, 502, 503, 504):
                    msg_erro = f"HTTP {resp.status_code} transitório no lote {lote_num}: {resp.text}"
                    logger.warning(f"[SUPABASE RETRY {tentativa}/{max_retries}] {msg_erro}")
                    if tentativa < max_retries:
                        time.sleep(tentativa * 1.5)
                    else:
                        erros.append(msg_erro)
                else:
                    msg_erro = f"HTTP {resp.status_code} no lote {lote_num}: {resp.text}"
                    logger.error(f"[SUPABASE ERRO - Lote {lote_num}] {msg_erro}")
                    erros.append(msg_erro)
                    break
            except Exception as err:
                msg_erro = f"Exceção de rede no lote {lote_num} (tentativa {tentativa}/{max_retries}): {err}"
                logger.error(f"[SUPABASE EXCEPTION] {msg_erro}")
                if tentativa < max_retries:
                    time.sleep(tentativa * 1.5)
                else:
                    erros.append(msg_erro)

    logger.info(f"[SUPABASE] Sincronização concluída: {sucessos}/{total_registros} registros persistidos.")
    sucesso = (total_registros == 0) or (sucessos > 0 and len(erros) == 0)
    resultado = ResultadoSincronizacao(
        sucesso=sucesso,
        total=total_registros,
        enviados=sucessos,
        tamanho_lote=tamanho_lote,
        endpoint=endpoint,
        erros=erros,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

    try:
        status_path = caminho.parent / "status_supabase.json"
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(dict(resultado), f, indent=2, ensure_ascii=False)
    except Exception as e_json:
        logger.warning(f"[SUPABASE] Falha ao salvar status_supabase.json: {e_json}")

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

