#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Arquivador Incremental Semanal de Grupos Setoriais para Google Sheets/Drive (Onda 6 - Sprint 6.3).

Regra estrita LGPD:
- Seleciona EXCLUSIVAMENTE salas `tipo = 'GRUPO_SETORIAL'` com `arquivamento_drive_ativo = true`.
- Conversas individuais (`DIRETA`) jamais entram no arquivamento coletivo.
- Consome lotes incrementais de ate 500 mensagens via `rpc_chat_obter_lote_arquivamento`.
- Despacha via assinatura HMAC-SHA256 + Nonce para o Gateway Google Apps Script (`chat_exportar_planilha_drive`).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Callable


def normalize_supabase_url(raw: str | None) -> str:
    clean = str(raw or "").strip().rstrip("/")
    if not clean:
        return ""
    clean = re.sub(r"/(?:rest|auth|functions|storage)/v1(?:/.*)?$", "", clean, flags=re.IGNORECASE)
    return clean.rstrip("/")


def default_http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: Any = None,
    timeout: int = 30,
) -> tuple[int, Any]:
    hdrs = dict(headers or {})
    data_bytes = None
    if body is not None:
        data_bytes = json.dumps(body, ensure_ascii=False).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json; charset=utf-8")
    req = urllib.request.Request(url, data=data_bytes, headers=hdrs, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as err:
        raw_err = err.read().decode("utf-8", errors="replace") if err.fp else str(err)
        try:
            return err.code, json.loads(raw_err)
        except Exception:
            return err.code, raw_err
    except Exception as exc:
        return 0, str(exc)


def sign_gas_request(action: str, timestamp_ms: int, nonce: str, dados: dict[str, Any], secret: str) -> str:
    canonical = f"{action}:{timestamp_ms}:{nonce}:{json.dumps(dados, separators=(',', ':'), ensure_ascii=False)}"
    return hmac.new(secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()


def run_weekly_group_archival(
    *,
    supabase_url: str,
    service_key: str,
    gas_url: str,
    secret_token: str,
    http_fn: Callable[..., tuple[int, Any]] = default_http_json,
) -> dict[str, Any]:
    base_url = normalize_supabase_url(supabase_url)
    stats = {
        "salas_avaliadas": 0,
        "salas_ignorado_direta": 0,
        "lotes_enviados": 0,
        "mensagens_arquivadas": 0,
        "erros": 0,
    }
    if not base_url or not service_key or not gas_url or not secret_token:
        return stats

    supa_headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    salas_url = (
        f"{base_url}/rest/v1/chat_salas"
        "?select=id,tipo,nome,setor_vinculado,arquivamento_drive_ativo,chat_arquivos_drive(drive_spreadsheet_id,ultima_mensagem_id_arquivada)"
        "&tipo=eq.GRUPO_SETORIAL&arquivamento_drive_ativo=eq.true&arquivada_em=is.null&limit=100"
    )
    st_salas, salas = http_fn("GET", salas_url, headers=supa_headers, timeout=25)
    if st_salas < 200 or st_salas >= 300 or not isinstance(salas, list):
        stats["erros"] += 1
        return stats

    for sala in salas:
        if not isinstance(sala, dict):
            continue
        tipo_sala = str(sala.get("tipo") or "").upper()
        if tipo_sala != "GRUPO_SETORIAL":
            stats["salas_ignorado_direta"] += 1
            continue

        stats["salas_avaliadas"] += 1
        sala_id = str(sala.get("id") or "").strip()
        if not sala_id:
            continue

        arch_info = sala.get("chat_arquivos_drive")
        if isinstance(arch_info, list):
            arch_info = arch_info[0] if arch_info else {}
        elif not isinstance(arch_info, dict):
            arch_info = {}

        st_lote, lote = http_fn(
            "POST",
            f"{base_url}/rest/v1/rpc/rpc_chat_obter_lote_arquivamento",
            headers=supa_headers,
            body={"p_sala_id": sala_id, "p_limite": 500},
            timeout=25,
        )
        if st_lote < 200 or st_lote >= 300 or not isinstance(lote, list):
            stats["erros"] += 1
            continue
        if not lote:
            continue

        dados = {
            "salaId": sala_id,
            "tipoSala": "GRUPO_SETORIAL",
            "nomeSala": str(sala.get("nome") or f"Grupo_{sala_id[:8]}"),
            "modo": "GRUPO_INCREMENTAL",
            "spreadsheetId": str(arch_info.get("drive_spreadsheet_id") or ""),
            "ultimaMensagemIdArquivada": int(arch_info.get("ultima_mensagem_id_arquivada") or 0),
            "mensagens": lote,
        }
        ts_ms = int(time.time() * 1000)
        nonce = str(uuid.uuid4())
        sig = sign_gas_request("chat_exportar_planilha_drive", ts_ms, nonce, dados, secret_token)

        gas_payload = {
            "action": "chat_exportar_planilha_drive",
            "gateway_proxy": True,
            "gateway_timestamp": ts_ms,
            "gateway_nonce": nonce,
            "gateway_signature": sig,
            "gateway_user_id": "cron-chat-archive",
            "gateway_user_role": "MODERADOR",
            "gateway_user_email": "cron-chat@smeb.cearamirim.rn.gov.br",
            "dados": dados,
        }
        st_gas, gas_resp = http_fn(
            "POST",
            gas_url,
            headers={
                "Content-Type": "text/plain;charset=utf-8",
                "x-olympos-signature": sig,
                "x-olympos-timestamp": str(ts_ms),
                "x-olympos-nonce": nonce,
            },
            body=gas_payload,
            timeout=45,
        )
        if 200 <= st_gas < 300 and isinstance(gas_resp, dict) and gas_resp.get("ok"):
            stats["lotes_enviados"] += 1
            stats["mensagens_arquivadas"] += int(gas_resp.get("totalAdicionadas") or len(lote))
        else:
            stats["erros"] += 1

    return stats


def main() -> int:
    supabase_url = normalize_supabase_url(os.getenv("SUPABASE_URL", ""))
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    gas_url = os.getenv("GAS_WEBHOOK_URL", "").strip()
    secret_token = os.getenv("OLYMPOS_SECRET_TOKEN", "").strip()

    if not supabase_url or not service_key or not gas_url or not secret_token:
        print("[CHAT ARCHIVE] Variáveis SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GAS_WEBHOOK_URL ou OLYMPOS_SECRET_TOKEN ausentes. Encerrando.")
        return 0

    res = run_weekly_group_archival(
        supabase_url=supabase_url,
        service_key=service_key,
        gas_url=gas_url,
        secret_token=secret_token,
    )
    print(f"[CHAT ARCHIVE] Resumo semanal: {json.dumps(res, ensure_ascii=False)}")
    return 0 if res.get("erros", 0) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
