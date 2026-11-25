#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pipeline de Ingestão Vetorial Incremental ($0) — Projeto Olympos / SMEB Ceará-Mirim (Onda 4 - Sprint 4.1).

Fontes indexadas:
1. publicacoes_diario (FEMURN público -> rbac_min_role='VISITANTE')
2. documentos_emitidos (Portarias e Ofícios -> 'PEDAGOGICO_EVENTOS')
3. modelos_snippets (Biblioteca de Minutas -> 'PEDAGOGICO_EVENTOS')
4. Memórias Google Docs higienizadas via GAS Gateway (when GAS_WEBAPP_URL + OLYMPOS_SECRET_TOKEN configured)
5. Normas municipais locais em JSON/MD/TXT (se presentes em normas_municipais/)

Política estrita de Custo Zero ($0) & LGPD:
- Usa EXCLUSIVAMENTE `gemini-embedding-2-preview` (`outputDimensionality: 768`), nunca `generateContent`/Flash.
- Executa `zero_pii_sanitize(strict_reject=True)` antes de enviar qualquer texto ao Gemini.
- Compara `conteudo_hash` SHA-256 contra `public.olympos_knowledge_chunks` e faz 0 chamadas
  à API Gemini para chunks inalterados (re-indexação 100% incremental).
- Rate limit preventivo (<= 25 req/min no Free Tier) com backoff exponencial.
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
from pathlib import Path
from typing import Any, Callable

SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from chunker import chunk_text, compute_content_hash  # noqa: E402
from zero_pii_gate import assert_source_allowed_for_embedding, zero_pii_sanitize  # noqa: E402

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2-preview"
FALLBACK_EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
MAX_RPM_FREE_TIER = 25
PROTOTYPES_JSON_PATH = SRC_DIR.parent / "fogo_de_prometheus" / "src" / "persona_prototypes.json"
DEFAULT_NORMAS_DIR = SRC_DIR / "normas_municipais"


def default_http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: Any = None,
    timeout: int = 25,
) -> tuple[int, Any]:
    """Executa requisição HTTP REST via stdlib urllib (zero dependências externas)."""
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


def generate_embedding_768(
    text: str,
    *,
    gemini_api_key: str,
    task_type: str = "RETRIEVAL_DOCUMENT",
    http_fn: Callable[..., tuple[int, Any]] = default_http_json,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> tuple[list[float] | None, str | None]:
    """
    Gera embedding de 768 dimensões usando `gemini-embedding-2-preview` (MRL)
    com fallback para `gemini-embedding-001` e backoff exponencial em HTTP 429.
    NUNCA chama endpoints generativos (`generateContent`).
    """
    if not gemini_api_key or not text.strip():
        return None, None

    gate = zero_pii_sanitize(text, strict_reject=True)
    if not gate["allowed"]:
        return None, None

    models = [DEFAULT_EMBEDDING_MODEL, FALLBACK_EMBEDDING_MODEL]
    for model in models:
        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{urllib.parse.quote(model)}:embedContent?key={urllib.parse.quote(gemini_api_key)}"
        )
        payload = {
            "model": f"models/{model}",
            "content": {"parts": [{"text": text[:16000]}]},
            "taskType": task_type,
            "outputDimensionality": EMBEDDING_DIM,
        }
        for attempt in range(3):
            status, resp = http_fn("POST", endpoint, body=payload, timeout=20)
            if status == 200 and isinstance(resp, dict):
                values = (resp.get("embedding") or {}).get("values")
                if isinstance(values, list) and len(values) == EMBEDDING_DIM:
                    return [float(v) for v in values], model
                break
            if status == 429 or (500 <= status < 600):
                sleep_fn(1.5 * (2**attempt))
                continue
            break

    return None, None


def _supabase_headers(service_key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def _normalize_supabase_url(raw_url: str | None) -> str:
    clean = str(raw_url or "").strip().rstrip("/")
    if not clean:
        return ""
    clean = re.sub(r"/(?:rest|auth|functions|storage)/v1(?:/.*)?$", "", clean, flags=re.IGNORECASE)
    return clean.rstrip("/")


def fetch_existing_chunk_hashes(
    supabase_url: str,
    service_key: str,
    *,
    http_fn: Callable[..., tuple[int, Any]] = default_http_json,
) -> dict[tuple[str, str, int], str]:
    """Busca o mapa (fonte_tipo, fonte_id, chunk_index) -> conteudo_hash já persistido."""
    supabase_url = _normalize_supabase_url(supabase_url)
    existing: dict[tuple[str, str, int], str] = {}
    url = (
        f"{supabase_url}/rest/v1/olympos_knowledge_chunks"
        "?select=fonte_tipo,fonte_id,chunk_index,conteudo_hash,embedding"
        "&limit=5000"
    )
    status, data = http_fn("GET", url, headers=_supabase_headers(service_key), timeout=25)
    if status == 200 and isinstance(data, list):
        for row in data:
            ft = str(row.get("fonte_tipo") or "")
            fid = str(row.get("fonte_id") or "")
            cidx = int(row.get("chunk_index") or 0)
            chash = str(row.get("conteudo_hash") or "")
            if ft and fid and chash:
                # Se ainda não há embedding mas há chave Gemini disponível hoje, mantém hash como marcador
                existing[(ft, fid, cidx)] = chash
    return existing


def collect_documents_from_supabase(
    supabase_url: str,
    service_key: str,
    *,
    http_fn: Callable[..., tuple[int, Any]] = default_http_json,
) -> list[dict[str, Any]]:
    """Coleta atos FEMURN, documentos emitidos e modelos/snippets do Supabase."""
    supabase_url = _normalize_supabase_url(supabase_url)
    docs: list[dict[str, Any]] = []
    hdrs = _supabase_headers(service_key)

    # 1. Publicações FEMURN públicas -> VISITANTE (com enriquecimento IA Onda 8 quando disponível)
    st_diario, diario_rows = http_fn(
        "GET",
        f"{supabase_url}/rest/v1/publicacoes_diario"
        "?select=id,codigo_femurn,data_publicacao,titulo,ato_tipo,orgao,secretaria_origem,resumo_ia,tags_ia,relevancia_smeb,conteudo_ner"
        "&order=data_publicacao.desc&limit=250",
        headers=hdrs,
        timeout=25,
    )
    if st_diario != 200:
        st_diario, diario_rows = http_fn(
            "GET",
            f"{supabase_url}/rest/v1/publicacoes_diario"
            "?select=id,codigo_femurn,data_publicacao,titulo,ato_tipo,conteudo_ner"
            "&order=data_publicacao.desc&limit=250",
            headers=hdrs,
            timeout=25,
        )
    if st_diario != 200:
        print(f"[ORACULO INGEST WARN] publicacoes_diario HTTP {st_diario}: {diario_rows}")
    if st_diario == 200 and isinstance(diario_rows, list):
        for r in diario_rows:
            fid = str(r.get("codigo_femurn") or r.get("id") or "").strip()
            ner = r.get("conteudo_ner") if isinstance(r.get("conteudo_ner"), dict) else {}
            body = str(
                r.get("resumo_ia")
                or ner.get("texto_completo")
                or ner.get("resumo_texto")
                or ner.get("resumo")
                or r.get("titulo")
                or ""
            ).strip()
            if not fid or not body:
                continue
            titulo = str(r.get("titulo") or f"Ato FEMURN {fid}").strip()
            sec_orig = str(r.get("secretaria_origem") or r.get("orgao") or ner.get("secretaria_origem") or "SMEB").strip()
            resumo_ia = str(r.get("resumo_ia") or ner.get("resumo_ia") or "").strip()
            tags_ia = r.get("tags_ia") if isinstance(r.get("tags_ia"), list) else (ner.get("tags_ia") if isinstance(ner.get("tags_ia"), list) else [])
            extra_ia = []
            if resumo_ia and resumo_ia != body:
                extra_ia.append(f"Resumo IA: {resumo_ia}")
            if tags_ia:
                extra_ia.append(f"Tags IA: {', '.join(str(t) for t in tags_ia[:8])}")
            bloco_extra = ("\n" + "\n".join(extra_ia)) if extra_ia else ""
            docs.append(
                {
                    "fonte_tipo": "FEMURN",
                    "fonte_id": fid,
                    "titulo": titulo[:220],
                    "url_fonte": "#diario-oficial",
                    "persona_tag": "nike",
                    "rbac_min_role": "VISITANTE",
                    "texto": f"{titulo}\nData: {r.get('data_publicacao') or ''}\nTipo: {r.get('ato_tipo') or ''}\nSecretaria: {sec_orig}{bloco_extra}\n\n{body}",
                }
            )

    # 2. Documentos Emitidos (Ofícios / Portarias) -> PEDAGOGICO_EVENTOS
    st_docs, emitted_rows = http_fn(
        "GET",
        f"{supabase_url}/rest/v1/documentos_emitidos"
        "?select=id,tipo,numero,ano,nome_arquivo,assunto_ou_titulo,destinatario_ou_servidor,drive_url,setor_codigo,sigla_setor,criado_em"
        "&order=criado_em.desc&limit=300",
        headers=hdrs,
        timeout=25,
    )
    if st_docs != 200:
        st_docs, emitted_rows = http_fn(
            "GET",
            f"{supabase_url}/rest/v1/documentos_emitidos"
            "?select=id,tipo,numero,ano,nome_arquivo,assunto_ou_titulo,destinatario_ou_servidor,drive_url,criado_em"
            "&order=criado_em.desc&limit=300",
            headers=hdrs,
            timeout=25,
        )
    if st_docs != 200:
        print(f"[ORACULO INGEST WARN] documentos_emitidos HTTP {st_docs}: {emitted_rows}")
    if st_docs == 200 and isinstance(emitted_rows, list):
        for r in emitted_rows:
            num = r.get("numero")
            ano = r.get("ano")
            raw_id = str(r.get("id") or "").strip()
            setor = str(r.get("setor_codigo") or r.get("sigla_setor") or "GABINETE").strip()
            num_label = f"{num}/{ano}" if (num is not None and ano is not None) else raw_id
            fid = f"{setor}:{num_label}:{raw_id}" if (raw_id and num_label != raw_id) else (num_label or raw_id)
            tipo_raw = str(r.get("tipo") or "OFICIO").upper()
            fonte_tipo = "PORTARIA" if "PORTARIA" in tipo_raw else "OFICIO"
            titulo = str(r.get("assunto_ou_titulo") or r.get("nome_arquivo") or f"{fonte_tipo} {num_label}").strip()
            destinatario = str(r.get("destinatario_ou_servidor") or "").strip()
            texto = f"{fonte_tipo} {num_label} — {titulo}\nSetor: {setor}\nDestinatário/Servidor: {destinatario or 'N/A'}\nArquivo: {r.get('nome_arquivo') or ''}"
            if fid and texto.strip():
                docs.append(
                    {
                        "fonte_tipo": fonte_tipo,
                        "fonte_id": fid,
                        "titulo": titulo[:220],
                        "url_fonte": str(r.get("drive_url") or ("#portarias" if fonte_tipo == "PORTARIA" else "#oficios")),
                        "persona_tag": "apolo",
                        "rbac_min_role": "PEDAGOGICO_EVENTOS",
                        "texto": texto,
                    }
                )

    # 3. Biblioteca de Modelos e Snippets -> PEDAGOGICO_EVENTOS
    st_snip, snip_rows = http_fn(
        "GET",
        f"{supabase_url}/rest/v1/modelos_snippets"
        "?select=id,titulo,categoria,persona_tag,conteudo_texto,variaveis_suportadas,atualizado_em&limit=200",
        headers=hdrs,
        timeout=25,
    )
    if st_snip != 200:
        print(f"[ORACULO INGEST WARN] modelos_snippets HTTP {st_snip}: {snip_rows}")
    if st_snip == 200 and isinstance(snip_rows, list):
        for r in snip_rows:
            fid = str(r.get("id") or "").strip()
            titulo = str(r.get("titulo") or "Modelo Institucional").strip()
            corpo = str(r.get("conteudo_texto") or "").strip()
            if fid and corpo:
                vars_sup = r.get("variaveis_suportadas")
                vars_txt = ", ".join(vars_sup) if isinstance(vars_sup, list) else str(vars_sup or "")
                docs.append(
                    {
                        "fonte_tipo": "MODELO_SNIPPET",
                        "fonte_id": fid,
                        "titulo": titulo[:220],
                        "url_fonte": "#oficios",
                        "persona_tag": str(r.get("persona_tag") or "temis").lower(),
                        "rbac_min_role": "PEDAGOGICO_EVENTOS",
                        "texto": f"Modelo Institucional ({r.get('categoria') or 'GERAL'}): {titulo}\nVariáveis: {vars_txt}\n\n{corpo}",
                    }
                )

    # 4. Publicacoes Oficiais Homologadas de PSS (Onda 5 — somente texto publico sanitizado)
    st_pss, pss_rows = http_fn(
        "GET",
        f"{supabase_url}/rest/v1/pss_publicacoes"
        "?select=id,titulo,tipo_publicacao,codigo_femurn,texto_publico_sanitizado,publicado_em"
        "&texto_publico_sanitizado=not.is.null&order=publicado_em.desc&limit=100",
        headers=hdrs,
        timeout=25,
    )
    if st_pss == 200 and isinstance(pss_rows, list):
        for r in pss_rows:
            fid = str(r.get("id") or "").strip()
            titulo = str(r.get("titulo") or f"Publicacao PSS {fid}").strip()
            texto_pub = str(r.get("texto_publico_sanitizado") or "").strip()
            if not fid or not texto_pub:
                continue
            cod_fem = str(r.get("codigo_femurn") or "").strip()
            docs.append(
                {
                    "fonte_tipo": "PSS_PUBLICO",
                    "fonte_id": fid,
                    "titulo": titulo[:220],
                    "url_fonte": "#processos-seletivos",
                    "persona_tag": "nike",
                    "rbac_min_role": "VISITANTE",
                    "texto": (
                        f"{titulo} ({r.get('tipo_publicacao') or 'PSS'})\n"
                        + (f"Codigo FEMURN: {cod_fem}\n" if cod_fem else "")
                        + f"\n{texto_pub}"
                    ),
                }
            )

    return docs


def collect_memorias_from_gas(
    gas_url: str,
    secret_token: str,
    *,
    http_fn: Callable[..., tuple[int, Any]] = default_http_json,
) -> list[dict[str, Any]]:
    """Coleta memórias canônicas Google Docs via GAS assinado (opcional)."""
    if not gas_url or not secret_token:
        return []

    ts = str(int(time.time() * 1000))
    nonce = str(uuid.uuid4())
    action = "memorias_listar"
    canonical = f"{action}:{ts}:{nonce}:{{}}"
    sig = hmac.new(secret_token.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()

    status, resp = http_fn(
        "POST",
        gas_url,
        body={
            "action": action,
            "gateway_proxy": True,
            "gateway_timestamp": int(ts),
            "gateway_nonce": nonce,
            "gateway_signature": sig,
            "gateway_user_id": "cron-oraculo-ingest",
            "gateway_user_role": "MODERADOR",
            "gateway_user_email": "cron-oraculo@smeb.cearamirim.rn.gov.br",
            "token": secret_token,
        },
        timeout=25,
    )
    if status != 200 or not isinstance(resp, dict) or resp.get("ok") is False:
        print(f"[ORACULO INGEST WARN] memorias_listar GAS status={status}, resp={resp}")
        return []

    items = resp.get("memorias") or (resp.get("data") or {}).get("memorias") or []
    docs: list[dict[str, Any]] = []
    if isinstance(items, list):
        for m in items:
            arq = str(m.get("arquivo") or m.get("id") or "").strip()
            texto = str(m.get("conteudoCompleto") or m.get("resumo") or "").strip()
            if not arq or not texto:
                continue
            slug = str(m.get("slug") or arq.replace("_memoria_", "").replace(".md", "")).lower()
            rbac = "ADMIN_GABINETE" if slug in ("zeus", "mod", "apolo") else "PEDAGOGICO_EVENTOS"
            docs.append(
                {
                    "fonte_tipo": "MEMORIA_DOC",
                    "fonte_id": arq,
                    "titulo": str(m.get("nome") or arq)[:220],
                    "url_fonte": str(m.get("url") or "#configuracoes"),
                    "persona_tag": slug,
                    "rbac_min_role": rbac,
                    "texto": texto,
                }
            )
    return docs


def collect_local_normas(normas_dir: Path = DEFAULT_NORMAS_DIR) -> list[dict[str, Any]]:
    """Lê arquivos estáticos de normas municipais (*.md, *.txt) se existentes."""
    if not normas_dir.is_dir():
        return []
    docs: list[dict[str, Any]] = []
    for p in sorted(normas_dir.glob("*")):
        if not p.is_file() or p.suffix.lower() not in (".md", ".txt"):
            continue
        txt = p.read_text(encoding="utf-8", errors="replace").strip()
        if not txt:
            continue
        docs.append(
            {
                "fonte_tipo": "NORMA_MUNICIPAL",
                "fonte_id": p.stem,
                "titulo": p.stem.replace("_", " ").title()[:220],
                "url_fonte": "#oraculo",
                "persona_tag": "temis",
                "rbac_min_role": "VISITANTE",
                "texto": txt,
            }
        )
    return docs


def run_incremental_ingestion(
    *,
    supabase_url: str,
    service_key: str,
    gemini_api_key: str = "",
    gas_url: str = "",
    secret_token: str = "",
    documents: list[dict[str, Any]] | None = None,
    http_fn: Callable[..., tuple[int, Any]] = default_http_json,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    """
    Executa pipeline de ingestão incremental por SHA-256 + Zero-PII Gate.
    Retorna estatísticas exatas de chunks processados, ignorados por hash,
    bloqueados por PII e chamadas realizadas à API Gemini.
    """
    supabase_url = _normalize_supabase_url(supabase_url)
    existing_hashes = fetch_existing_chunk_hashes(supabase_url, service_key, http_fn=http_fn)

    all_docs = list(documents) if documents is not None else []
    if documents is None:
        all_docs.extend(collect_documents_from_supabase(supabase_url, service_key, http_fn=http_fn))
        all_docs.extend(collect_memorias_from_gas(gas_url, secret_token, http_fn=http_fn))
        all_docs.extend(collect_local_normas())

    stats: dict[str, Any] = {
        "documentos_lidos": len(all_docs),
        "chunks_totais": 0,
        "chunks_ignorados_hash": 0,
        "chunks_bloqueados_pii": 0,
        "fontes_bloqueadas_lgpd": 0,
        "chunks_upserted": 0,
        "chamadas_gemini_embedding": 0,
        "erros_upsert": 0,
    }

    batch_rows: list[dict[str, Any]] = []
    min_interval = 60.0 / float(MAX_RPM_FREE_TIER)

    for doc in all_docs:
        fonte_origem = str(doc.get("tabela_origem") or doc.get("source_table") or doc.get("fonte_tipo") or "")
        try:
            assert_source_allowed_for_embedding(fonte_origem)
        except ValueError:
            stats["fontes_bloqueadas_lgpd"] += 1
            continue

        fonte_tipo = str(doc.get("fonte_tipo") or "NORMA_MUNICIPAL")
        fonte_id = str(doc.get("fonte_id") or "").strip()
        titulo = str(doc.get("titulo") or fonte_id).strip()
        url_fonte = doc.get("url_fonte")
        persona_tag = doc.get("persona_tag")
        rbac_min_role = str(doc.get("rbac_min_role") or "VISITANTE").upper()
        texto = str(doc.get("texto") or "").strip()
        if not fonte_id or not texto:
            continue

        # Gate pré-chunking contra PII / sigilo médico
        doc_gate = zero_pii_sanitize(texto, strict_reject=True)
        if not doc_gate["allowed"]:
            stats["chunks_bloqueados_pii"] += 1
            continue

        chunks = chunk_text(texto)
        for ch in chunks:
            stats["chunks_totais"] += 1
            c_idx = int(ch["chunk_index"])
            c_txt = str(ch["chunk_texto"])
            c_hash = str(ch["conteudo_hash"])

            chunk_gate = zero_pii_sanitize(c_txt, strict_reject=True)
            if not chunk_gate["allowed"]:
                stats["chunks_bloqueados_pii"] += 1
                continue

            if existing_hashes.get((fonte_tipo, fonte_id, c_idx)) == c_hash:
                stats["chunks_ignorados_hash"] += 1
                continue

            emb_vec: list[float] | None = None
            if gemini_api_key:
                if stats["chamadas_gemini_embedding"] > 0:
                    sleep_fn(min_interval)
                stats["chamadas_gemini_embedding"] += 1
                emb_vec, _ = generate_embedding_768(
                    c_txt,
                    gemini_api_key=gemini_api_key,
                    task_type="RETRIEVAL_DOCUMENT",
                    http_fn=http_fn,
                    sleep_fn=sleep_fn,
                )

            batch_rows.append(
                {
                    "fonte_tipo": fonte_tipo,
                    "fonte_id": fonte_id,
                    "chunk_index": c_idx,
                    "titulo": titulo[:220],
                    "url_fonte": url_fonte,
                    "persona_tag": persona_tag,
                    "chunk_texto": c_txt,
                    "conteudo_hash": c_hash,
                    "embedding": emb_vec,
                    "rbac_min_role": rbac_min_role,
                }
            )
            existing_hashes[(fonte_tipo, fonte_id, c_idx)] = c_hash

    # Deduplica conflitos potenciais na mesma execução antes do upsert em lotes de 50 linhas
    dedup_rows: dict[tuple[str, str, int], dict[str, Any]] = {}
    for row in batch_rows:
        dedup_key = (str(row.get("fonte_tipo") or ""), str(row.get("fonte_id") or ""), int(row.get("chunk_index") or 0))
        dedup_rows[dedup_key] = row
    batch_rows = list(dedup_rows.values())

    # Upsert em lotes de 50 linhas
    hdrs = _supabase_headers(
        service_key,
        {"Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    upsert_url = (
        f"{supabase_url}/rest/v1/olympos_knowledge_chunks"
        "?on_conflict=fonte_tipo,fonte_id,chunk_index"
    )
    for idx in range(0, len(batch_rows), 50):
        chunk_batch = batch_rows[idx : idx + 50]
        st, resp_up = http_fn("POST", upsert_url, headers=hdrs, body=chunk_batch, timeout=30)
        if 200 <= st < 300:
            stats["chunks_upserted"] += len(chunk_batch)
        else:
            stats["erros_upsert"] += len(chunk_batch)
            print(f"[ORACULO INGEST WARN] upsert batch HTTP {st}: {resp_up}")

    # Atualiza protótipos das personas de forma incremental quando há chave Gemini
    if gemini_api_key and PROTOTYPES_JSON_PATH.is_file():
        sync_persona_prototypes(
            supabase_url=supabase_url,
            service_key=service_key,
            gemini_api_key=gemini_api_key,
            http_fn=http_fn,
            sleep_fn=sleep_fn,
            stats=stats,
        )

    return stats


def sync_persona_prototypes(
    *,
    supabase_url: str,
    service_key: str,
    gemini_api_key: str,
    http_fn: Callable[..., tuple[int, Any]] = default_http_json,
    sleep_fn: Callable[[float], None] = time.sleep,
    stats: dict[str, Any] | None = None,
) -> None:
    """Atualiza embeddings dos protótipos de personas apenas quando o hash muda."""
    supabase_url = _normalize_supabase_url(supabase_url)
    if not PROTOTYPES_JSON_PATH.is_file():
        return
    try:
        raw = json.loads(PROTOTYPES_JSON_PATH.read_text(encoding="utf-8"))
        personas = raw.get("personas") or {}
    except Exception:
        return

    hdrs = _supabase_headers(service_key)
    st_cur, cur_rows = http_fn(
        "GET",
        f"{supabase_url}/rest/v1/olympos_persona_prototypes?select=slug,conteudo_hash,embedding",
        headers=hdrs,
        timeout=20,
    )
    cur_map: dict[str, dict[str, Any]] = {}
    if st_cur == 200 and isinstance(cur_rows, list):
        for r in cur_rows:
            cur_map[str(r.get("slug") or "")] = r

    updates: list[dict[str, Any]] = []
    for slug, info in personas.items():
        desc = str(info.get("descricao") or "")
        protos = " ".join(info.get("prototipos_textuais") or [])
        text_proto = f"{info.get('nome') or slug}: {desc}\n{protos}".strip()
        chash = compute_content_hash(text_proto)
        cur = cur_map.get(slug) or {}
        if cur.get("conteudo_hash") == chash and cur.get("embedding"):
            continue

        if stats is not None:
            stats["chamadas_gemini_embedding"] += 1
        vec, _ = generate_embedding_768(
            text_proto,
            gemini_api_key=gemini_api_key,
            task_type="RETRIEVAL_DOCUMENT",
            http_fn=http_fn,
            sleep_fn=sleep_fn,
        )
        if vec:
            updates.append(
                {
                    "slug": slug,
                    "nome": str(info.get("nome") or slug),
                    "arquivo_memoria": str(info.get("arquivo_memoria") or f"_memoria_{slug}.md"),
                    "descricao": desc,
                    "keywords": info.get("keywords") or [],
                    "conteudo_hash": chash,
                    "embedding": vec,
                }
            )

    if updates:
        http_fn(
            "POST",
            f"{supabase_url}/rest/v1/olympos_persona_prototypes?on_conflict=slug",
            headers=_supabase_headers(service_key, {"Prefer": "resolution=merge-duplicates,return=minimal"}),
            body=updates,
            timeout=25,
        )


def main() -> int:
    supabase_url = _normalize_supabase_url(os.getenv("SUPABASE_URL", ""))
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    gas_url = (os.getenv("GAS_WEBHOOK_URL") or os.getenv("GAS_WEBAPP_URL") or "").strip()
    secret_tok = os.getenv("OLYMPOS_SECRET_TOKEN", "").strip()

    if not supabase_url or not service_key:
        print("[ORACULO INGEST] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes. Encerrando.")
        return 0

    res = run_incremental_ingestion(
        supabase_url=supabase_url,
        service_key=service_key,
        gemini_api_key=gemini_key,
        gas_url=gas_url,
        secret_token=secret_tok,
    )
    print(f"[ORACULO INGEST] Concluído: {json.dumps(res, ensure_ascii=False)}")
    return 0 if res.get("erros_upsert", 0) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
