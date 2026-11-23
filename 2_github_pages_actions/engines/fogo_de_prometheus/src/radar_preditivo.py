#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor Radar Preditivo FEMURN (Custo $0 — Duas Camadas) — Projeto Olympos / SMEB Ceará-Mirim.

Camada 1 (Determinística, 100% local, sem rede IA):
- Normalização Unicode NFD (case/accent-insensitive).
- Cruzamento nominal contra servidores_consolidados.json (apenas 6 campos públicos LGPD {n,g,m,l,e,r},
  filtrando Ceará-Mirim / SMEB-Educação) para detectar citações nominais de servidores da Educação.
- Extratores regex para prazos legais, contratos e PSS/Editais.

Camada 2 (Vetorial Opcional — Gemini Embedding 2 Free Tier $0):
- Se GEMINI_API_KEY estiver configurada, gera embedding de 768 dimensões via
  gemini-embedding-2-preview (ou gemini-embedding-001) e calcula similaridade cosseno
  contra os protótipos semânticos de persona_prototypes.json.
- Em ausência de chave, falha de rede ou cota HTTP 429, executa fallback 100% determinístico
  sem lançar exceção (SEM Gemini Flash / generateContent).

Despacho Idempotente:
- Registra alertas na Central do Sino (public.notificacoes?on_conflict=dedup_key).
- Opcionalmente enriquece conteudo_ner / embedding em public.publicacoes_diario.
- Despacha recado idempotente (guard por codigo_femurn) para a memória Google Docs da persona
  via GAS_GATEWAY_URL / GAS_WEBHOOK_URL quando configurado.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import re
import tempfile
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    import requests  # type: ignore
except ImportError:  # pragma: no cover - fallback minimalista sem dependência externa
    requests = None  # type: ignore


SRC_DIR = Path(__file__).resolve().parent
PROTOTYPES_PATH = SRC_DIR / "persona_prototypes.json"
DEFAULT_SERVIDORES_JSON_PATH = (
    SRC_DIR.parents[2] / "frontend_spa" / "data" / "servidores_consolidados.json"
)
DEFAULT_SERVIDORES_GZ_PATH = (
    SRC_DIR.parents[2] / "frontend_spa" / "data" / "servidores_consolidados.json.gz"
)
DEFAULT_DISPATCH_GUARD_PATH = Path(tempfile.gettempdir()) / "olympos_radar_dispatch_guard.json"

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2-preview"
FALLBACK_EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
PUBLIC_LGPD_KEYS = ("n", "g", "m", "l", "e", "r")

_TZ_FORTALEZA = timezone(timedelta(hours=-3))
_SERVIDORES_CACHE: dict[str, Any] = {"key": None, "records": []}
_PROTOTYPES_CACHE: dict[str, Any] = {"key": None, "data": {}}
_EMBEDDING_CACHE: dict[tuple[str, str], list[float]] = {}
_IN_MEMORY_DISPATCH_GUARD: set[str] = set()

# Marcadores para identificar servidores vinculados à SMEB / Rede Municipal de Educação
_SMEB_LOTACAO_MARKERS = (
    "smeb",
    "educacao",
    "e.m.",
    "e.m ",
    "c.e.i",
    "cmei",
    "escola",
    "creche",
    "cemai",
    "biblioteca municipal",
    "ensino",
)
_SMEB_CARGO_MARKERS = (
    "(educacao)",
    "professor",
    "diretor escolar",
    "diretora escolar",
    "vice diretor de escola",
    "vice-diretor",
    "merendeir",
    "interprete de libras",
    "monitor de transporte escolar",
)

# Extratores determinísticos Camada 1 (executados sobre texto normalizado via NFD)
_RE_PRAZO_DIAS = re.compile(
    r"\b(?:no\s+)?prazo\s+(?:(?:de|maximo\s+de|improrrogavel\s+de|legal\s+de)\s+)?"
    r"(\d{1,4})\s*(?:\([^)]+\)\s*)?dias(?:\s+(?:uteis|corridos))?",
    re.IGNORECASE,
)
_RE_VIGENCIA_ATE = re.compile(
    r"\bvigencia\s+(?:ate(?:\s+o\s+dia)?|de\s+\d{2}/\d{2}/\d{4}\s+a)\s*(\d{2}/\d{2}/\d{4})",
    re.IGNORECASE,
)
_RE_PRAZO_ATE_DATA = re.compile(
    r"\b(?:prazo\s+ate(?:\s+o\s+dia)?|ate\s+o\s+dia|termino\s+em|encerra(?:-se)?\s+em)\s*"
    r"(\d{2}/\d{2}/\d{4})",
    re.IGNORECASE,
)
_RE_A_CONTAR_DE = re.compile(
    r"\ba\s+contar\s+d[aeo]\s+([a-z0-9/.\-\s]{3,60}?)(?=[.,;\n]|\s+para\b|$)",
    re.IGNORECASE,
)
_RE_PRORROGACAO = re.compile(
    r"\bprorrog(?:acao|a|ado|ada)(?:\s+(?:de\s+(?:prazo|vigencia|contrato)|por|ate))?"
    r"(?:\s+(?:de\s+)?(\d{1,4}\s*(?:dias|meses|ano|anos)|\d{2}/\d{2}/\d{4}))?",
    re.IGNORECASE,
)
_RE_CONTRATO = re.compile(
    r"\b(?:extrato\s+(?:de|do)\s+|termo\s+aditivo\s+(?:ao|de)\s+|aditivo\s+(?:ao|de)\s+)?"
    r"contrato(?:\s+(?:administrativo|temporario|de\s+fornecimento|emergencial))?"
    r"\s*(?:n[º°o.]?\s*)?(\d{1,5}(?:[./-]\d{2,4})?)",
    re.IGNORECASE,
)
_RE_PSS_EDITAL = re.compile(
    r"\b(?:"
    r"pss\s*(?:n[º°o.]?\s*\d{1,4}(?:[./-]\d{2,4})?)?|"
    r"processo\s+seletivo(?:\s+simplificado)?(?:\s*(?:n[º°o.]?\s*\d{1,4}(?:[./-]\d{2,4})?))?|"
    r"edital\s+(?:de\s+)?(?:processo\s+seletivo(?:\s+simplificado)?|convocacao|chamada\s+publica|selecao|pss)"
    r"(?:\s*(?:n[º°o.]?\s*)?(\d{1,4}(?:[./-]\d{2,4})?))?|"
    r"edital\s*(?:[a-z]{2,15}\s+){0,2}(?:n[º°o.]?\s*)(\d{1,4}(?:[./-]\d{2,4})?)"
    r"(?!\s*[-–]?\s*(?:de\s+)?(?:licitacao|pregao|concorrencia|tomada\s+de\s+precos))"
    r")",
    re.IGNORECASE,
)


class _SimpleHttpResponse:
    """Resposta HTTP mínima compatível quando requests não está instalado."""

    def __init__(self, status_code: int, text: str) -> None:
        self.status_code = status_code
        self.text = text

    def json(self) -> Any:
        return json.loads(self.text)


def _http_request(
    method: str,
    url: str,
    *,
    json_body: Any = None,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> Any:
    """Executa requisição HTTP POST/PATCH usando requests ou fallback stdlib urllib."""
    req_headers = dict(headers or {})
    if requests is not None:
        fn = getattr(requests, method.lower(), None)
        if callable(fn):
            return fn(url, json=json_body, headers=req_headers, timeout=timeout)

    data_bytes = None
    if json_body is not None:
        data_bytes = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url, data=data_bytes, headers=req_headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body_text = resp.read().decode("utf-8", errors="replace")
            return _SimpleHttpResponse(resp.status, body_text)
    except urllib.error.HTTPError as err:
        err_text = err.read().decode("utf-8", errors="replace") if err.fp else str(err)
        return _SimpleHttpResponse(err.code, err_text)


def normalizar_nfd(texto: Any) -> str:
    """Normaliza texto via Unicode NFD removendo diacríticos e padronizando em minúsculas."""
    if texto is None:
        return ""
    decomposed = unicodedata.normalize("NFD", str(texto))
    sem_acentos = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", sem_acentos).strip().lower()


def similaridade_cosseno(v1: list[float], v2: list[float]) -> float:
    """Calcula similaridade cosseno pura em Python (sem numpy)."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(float(a) * float(b) for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(float(a) * float(a) for a in v1))
    norm2 = math.sqrt(sum(float(b) * float(b) for b in v2))
    if norm1 <= 0.0 or norm2 <= 0.0:
        return 0.0
    return dot / (norm1 * norm2)


def carregar_prototipos_personas(prototypes_path: Path | str | None = None) -> dict[str, Any]:
    """Carrega persona_prototypes.json com cache por caminho e mtime."""
    alvo = Path(prototypes_path) if prototypes_path else PROTOTYPES_PATH
    if not alvo.is_file():
        return {"embedding_model_default": DEFAULT_EMBEDDING_MODEL, "embedding_dimensions": EMBEDDING_DIM, "personas": {}}

    mtime = alvo.stat().st_mtime
    cache_key = f"{alvo.resolve()}:{mtime}"
    if _PROTOTYPES_CACHE.get("key") == cache_key:
        return _PROTOTYPES_CACHE["data"]

    data = json.loads(alvo.read_text(encoding="utf-8"))
    _PROTOTYPES_CACHE["key"] = cache_key
    _PROTOTYPES_CACHE["data"] = data
    return data


def _eh_servidor_smeb_ceara_mirim(registro: dict[str, Any]) -> bool:
    """Filtra registros do município de Ceará-Mirim com lotação/cargo da Educação (SMEB)."""
    ente_norm = normalizar_nfd(registro.get("e", ""))
    lot_norm = normalizar_nfd(registro.get("l", ""))
    cargo_norm = normalizar_nfd(registro.get("g", ""))

    if ente_norm and "ceara-mirim" not in ente_norm and "ceara mirim" not in ente_norm:
        return False

    if any(m in lot_norm for m in _SMEB_LOTACAO_MARKERS):
        return True
    if any(c in cargo_norm for c in _SMEB_CARGO_MARKERS):
        return True
    return False


def _indexar_servidores_smeb(registros_brutos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sanitiza registros para os 6 campos públicos LGPD e indexa tokens NFD para busca O(1)."""
    indexados: list[dict[str, Any]] = []
    vistos: set[tuple[str, str]] = set()

    for raw in registros_brutos:
        if not isinstance(raw, dict):
            continue
        limpo = {k: str(raw.get(k, "") or "").strip() for k in PUBLIC_LGPD_KEYS}
        if not limpo["n"]:
            continue
        if not _eh_servidor_smeb_ceara_mirim(limpo):
            continue

        nome_norm = normalizar_nfd(limpo["n"])
        tokens = tuple(tok for tok in re.findall(r"[a-z0-9]+", nome_norm) if tok)
        if len(tokens) < 2 or len(nome_norm) < 6:
            continue

        chave_uniq = (nome_norm, limpo["m"])
        if chave_uniq in vistos:
            continue
        vistos.add(chave_uniq)

        indexados.append({
            "n": limpo["n"],
            "g": limpo["g"],
            "m": limpo["m"],
            "l": limpo["l"],
            "e": limpo["e"],
            "r": limpo["r"],
            "nome_norm": nome_norm,
            "tokens": tokens,
        })

    return indexados


def carregar_servidores_smeb(
    servidores_path: Path | str | None = None,
    servidores_lista: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Carrega e filtra servidores SMEB/Ceará-Mirim de servidores_consolidados.json(.gz)."""
    if servidores_lista is not None:
        return _indexar_servidores_smeb(servidores_lista)

    candidato = Path(servidores_path) if servidores_path else DEFAULT_SERVIDORES_JSON_PATH
    gz_fallback = DEFAULT_SERVIDORES_GZ_PATH if servidores_path is None else Path(f"{candidato}.gz")

    arquivo_alvo: Path | None = None
    is_gz = False
    if candidato.is_file():
        arquivo_alvo = candidato
        is_gz = candidato.suffix.lower() == ".gz"
    elif gz_fallback.is_file():
        arquivo_alvo = gz_fallback
        is_gz = True

    if arquivo_alvo is None:
        return []

    mtime = arquivo_alvo.stat().st_mtime
    cache_key = f"{arquivo_alvo.resolve()}:{mtime}"
    if _SERVIDORES_CACHE.get("key") == cache_key:
        return _SERVIDORES_CACHE["records"]

    try:
        if is_gz:
            raw_text = gzip.decompress(arquivo_alvo.read_bytes()).decode("utf-8")
        else:
            raw_text = arquivo_alvo.read_text(encoding="utf-8")
        dados = json.loads(raw_text)
        indexados = _indexar_servidores_smeb(dados if isinstance(dados, list) else [])
    except Exception:
        indexados = []

    _SERVIDORES_CACHE["key"] = cache_key
    _SERVIDORES_CACHE["records"] = indexados
    return indexados


def detectar_servidores_smeb_no_texto(
    texto: str,
    servidores_smeb: list[dict[str, Any]],
    nomes_ner: list[str] | None = None,
) -> list[dict[str, str]]:
    """Cruza o texto normalizado via NFD com a base SMEB de Ceará-Mirim."""
    texto_norm = normalizar_nfd(texto)
    ner_norms = {normalizar_nfd(n) for n in (nomes_ner or []) if normalizar_nfd(n)}
    if not texto_norm and not ner_norms:
        return []

    tokens_texto = set(re.findall(r"[a-z0-9]+", texto_norm))
    encontrados: list[dict[str, str]] = []
    vistos: set[tuple[str, str]] = set()

    for srv in servidores_smeb:
        match_ok = srv["nome_norm"] in ner_norms
        if not match_ok and all(tok in tokens_texto for tok in srv["tokens"]):
            if re.search(rf"(?<![a-z0-9]){re.escape(srv['nome_norm'])}(?![a-z0-9])", texto_norm):
                match_ok = True

        if match_ok:
            chave = (srv["nome_norm"], srv["m"])
            if chave not in vistos:
                vistos.add(chave)
                encontrados.append({
                    "nome": srv["n"],
                    "cargo": srv["g"],
                    "matricula": srv["m"],
                    "lotacao": srv["l"],
                    "municipio": srv["e"] or "Ceará-Mirim",
                })

    return encontrados


def extrair_prazos_legais(texto: str) -> list[dict[str, Any]]:
    """Extrai prazos legais determinísticos (dias, vigência, termo inicial, prorrogação)."""
    texto_norm = normalizar_nfd(texto)
    if not texto_norm:
        return []

    prazos: list[dict[str, Any]] = []
    vistos: set[tuple[str, str]] = set()

    def _add(tipo: str, trecho: str, valor: str = "") -> None:
        trecho_clean = re.sub(r"\s+", " ", trecho).strip(" .;,:")
        chave = (tipo, trecho_clean)
        if trecho_clean and chave not in vistos:
            vistos.add(chave)
            item: dict[str, Any] = {"tipo": tipo, "texto": trecho_clean}
            if valor:
                item["valor"] = valor
            prazos.append(item)

    for m in _RE_PRAZO_DIAS.finditer(texto_norm):
        _add("PRAZO_DIAS", m.group(0), m.group(1))
    for m in _RE_VIGENCIA_ATE.finditer(texto_norm):
        _add("VIGENCIA_ATE", m.group(0), m.group(1))
    for m in _RE_PRAZO_ATE_DATA.finditer(texto_norm):
        _add("PRAZO_DATA", m.group(0), m.group(1))
    for m in _RE_A_CONTAR_DE.finditer(texto_norm):
        _add("A_CONTAR_DE", m.group(0), m.group(1).strip())
    for m in _RE_PRORROGACAO.finditer(texto_norm):
        _add("PRORROGACAO", m.group(0), (m.group(1) or "").strip())

    return prazos


def extrair_contratos(texto: str) -> list[dict[str, str]]:
    """Extrai referências a contratos e termos aditivos no texto normalizado."""
    texto_norm = normalizar_nfd(texto)
    if not texto_norm:
        return []

    contratos: list[dict[str, str]] = []
    vistos: set[str] = set()
    for m in _RE_CONTRATO.finditer(texto_norm):
        numero = (m.group(1) or "").strip()
        trecho = re.sub(r"\s+", " ", m.group(0)).strip(" .;,:")
        chave = numero or trecho
        if chave and chave not in vistos:
            vistos.add(chave)
            contratos.append({"numero": numero, "texto": trecho})
    return contratos


def extrair_pss_editais(texto: str) -> list[dict[str, str]]:
    """Extrai menções a Processos Seletivos Simplificados (PSS) e Editais."""
    texto_norm = normalizar_nfd(texto)
    if not texto_norm:
        return []

    itens: list[dict[str, str]] = []
    vistos: set[str] = set()
    for m in _RE_PSS_EDITAL.finditer(texto_norm):
        trecho = re.sub(r"\s+", " ", m.group(0)).strip(" .;,:")
        if any(k in trecho for k in ("licitacao", "pregao", "concorrencia", "tomada de precos")):
            continue
        numero = next((g.strip() for g in m.groups() if g and g.strip()), "")
        chave = f"{trecho}:{numero}"
        if trecho and chave not in vistos:
            vistos.add(chave)
            itens.append({"numero": numero, "texto": trecho})
    return itens


def _gerar_embedding_gemini(
    texto: str,
    api_key: str,
    model: str = DEFAULT_EMBEDDING_MODEL,
    dimensions: int = EMBEDDING_DIM,
) -> tuple[list[float] | None, str]:
    """
    Chama Gemini Embedding 2 (Free Tier $0) para gerar vetor de 768 dimensões.
    Retorna (vetor, modelo_usado) ou (None, modelo) sem lançar exceções em erro/cota 429.
    """
    clean_key = (api_key or "").strip()
    clean_text = (texto or "").strip()
    if not clean_key or not clean_text:
        return None, model

    modelos_tentativa = [model]
    if model == DEFAULT_EMBEDDING_MODEL and FALLBACK_EMBEDDING_MODEL not in modelos_tentativa:
        modelos_tentativa.append(FALLBACK_EMBEDDING_MODEL)

    for modelo_atual in modelos_tentativa:
        cache_hash = hashlib.sha256(clean_text[:6000].encode("utf-8")).hexdigest()
        cache_key = (modelo_atual, cache_hash)
        if cache_key in _EMBEDDING_CACHE:
            return _EMBEDDING_CACHE[cache_key], modelo_atual

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_atual}:embedContent"
        payload = {
            "model": f"models/{modelo_atual}",
            "content": {"parts": [{"text": clean_text[:6000]}]},
            "outputDimensionality": dimensions,
        }
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": clean_key,
        }

        try:
            resp = _http_request("POST", endpoint, json_body=payload, headers=headers, timeout=15)
            status = getattr(resp, "status_code", 0)
            if status == 404 and modelo_atual != modelos_tentativa[-1]:
                continue
            if status == 429 or status < 200 or status >= 300:
                return None, modelo_atual

            data = resp.json() if hasattr(resp, "json") else json.loads(getattr(resp, "text", "{}"))
            values = ((data or {}).get("embedding") or {}).get("values")
            if isinstance(values, list) and len(values) > 0:
                vetor = [float(v) for v in values]
                _EMBEDDING_CACHE[cache_key] = vetor
                return vetor, modelo_atual
            return None, modelo_atual
        except Exception:
            return None, modelo_atual

    return None, model


def _calcular_scores_deterministicos(
    texto_completo: str,
    categoria_ato: str,
    prazos: list[dict[str, Any]],
    contratos: list[dict[str, str]],
    pss_editais: list[dict[str, str]],
    prototipos_cfg: dict[str, Any],
) -> dict[str, float]:
    """Calcula pontuação determinística de roteamento para cada persona."""
    texto_norm = normalizar_nfd(texto_completo)
    cat_upper = str(categoria_ato or "").upper()
    personas_map = prototipos_cfg.get("personas") or {}
    scores: dict[str, float] = {}

    for slug, cfg in personas_map.items():
        score = 0.0
        for kw in cfg.get("keywords") or []:
            kw_norm = normalizar_nfd(kw)
            if not kw_norm:
                continue
            if re.search(rf"(?<![a-z0-9]){re.escape(kw_norm)}(?![a-z0-9])", texto_norm):
                score += 2.0 if " " in kw_norm else 1.2

        for pat in cfg.get("regex_patterns") or []:
            try:
                hits = len(re.findall(pat, texto_norm, re.IGNORECASE))
                if hits:
                    score += min(hits, 3) * 2.0
            except re.error:
                continue

        score *= float(cfg.get("peso_base", 1.0))
        scores[slug] = score

    # Sinais estruturados de alta confiança
    if pss_editais or "EDITAL_PSS" in cat_upper or re.search(r"\bpss\b|processo\s+seletivo", texto_norm):
        scores["nike"] = scores.get("nike", 0.0) + 4.5

    if "PERMUTA" in cat_upper:
        scores["hera"] = scores.get("hera", 0.0) + 3.5

    if "NORMATIVO_JURIDICO" in cat_upper:
        scores["temis"] = scores.get("temis", 0.0) + 3.0

    if "NOMEACAO_DIRETOR" in cat_upper or ("PORTARIA" in cat_upper and scores.get("hera", 0.0) < 2.0):
        scores["apolo"] = scores.get("apolo", 0.0) + 2.0

    if contratos and any(k in texto_norm for k in ("fornecimento", "pnae", "pdde", "merenda", "licitacao", "pregao")):
        scores["demeter"] = scores.get("demeter", 0.0) + 3.5

    if prazos and any(k in texto_norm for k in ("tce", "ministerio publico", "notificacao", "parecer", "sindicancia", "decisao")):
        scores["temis"] = scores.get("temis", 0.0) + 2.5

    return scores


def _obter_vetores_prototipos(
    prototipos_cfg: dict[str, Any],
    api_key: str,
    model: str,
    prototype_embeddings: dict[str, list[float]] | None = None,
) -> tuple[dict[str, list[float]], bool, str]:
    """Obtém embeddings dos protótipos de personas (usando override, cache ou Gemini Embedding)."""
    if prototype_embeddings:
        return prototype_embeddings, True, model

    personas_map = prototipos_cfg.get("personas") or {}
    vetores: dict[str, list[float]] = {}
    modelo_efetivo = model

    for slug, cfg in personas_map.items():
        if isinstance(cfg.get("embedding"), list) and len(cfg["embedding"]) > 0:
            vetores[slug] = [float(x) for x in cfg["embedding"]]
            continue

        texto_proto = " ".join(cfg.get("prototipos_textuais") or []).strip()
        if not texto_proto:
            texto_proto = f"{cfg.get('nome', slug)} - {cfg.get('descricao', '')}"
        vec, modelo_efetivo = _gerar_embedding_gemini(
            texto_proto,
            api_key=api_key,
            model=modelo_efetivo,
            dimensions=EMBEDDING_DIM,
        )
        if not vec:
            return {}, False, modelo_efetivo
        vetores[slug] = vec

    return vetores, bool(vetores), modelo_efetivo


def _carregar_guard_despacho(guard_path: Path | None) -> set[str]:
    """Carrega chaves já despachadas para idempotência entre execuções."""
    chaves = set(_IN_MEMORY_DISPATCH_GUARD)
    if guard_path and guard_path.is_file():
        try:
            loaded = json.loads(guard_path.read_text(encoding="utf-8"))
            if isinstance(loaded, list):
                chaves.update(str(x) for x in loaded)
        except Exception:
            pass
    return chaves


def _salvar_guard_despacho(chaves: set[str], guard_path: Path | None) -> None:
    """Persiste conjunto limitado de chaves despachadas no guard local."""
    _IN_MEMORY_DISPATCH_GUARD.update(chaves)
    if not guard_path:
        return
    try:
        guard_path.parent.mkdir(parents=True, exist_ok=True)
        recentes = sorted(chaves)[-2000:]
        guard_path.write_text(json.dumps(recentes, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def _despachar_notificacoes_supabase(
    notificacoes: list[dict[str, Any]],
    supabase_url: str,
    service_role_key: str,
) -> int:
    """Grava alertas em public.notificacoes com idempotência via dedup_key."""
    if not notificacoes or not supabase_url or not service_role_key:
        return 0

    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/notificacoes?on_conflict=dedup_key"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    try:
        resp = _http_request("POST", endpoint, json_body=notificacoes, headers=headers, timeout=20)
        if 200 <= getattr(resp, "status_code", 0) < 300:
            return len(notificacoes)
    except Exception:
        pass
    return 0


def _atualizar_publicacao_diario_supabase(
    codigo_femurn: str,
    conteudo_ner: dict[str, Any],
    embedding: list[float] | None,
    supabase_url: str,
    service_role_key: str,
) -> bool:
    """Atualiza conteudo_ner e embedding (quando disponível) em public.publicacoes_diario."""
    if not codigo_femurn or not supabase_url or not service_role_key:
        return False

    cod_enc = urllib.parse.quote(codigo_femurn, safe="")
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/publicacoes_diario?codigo_femurn=eq.{cod_enc}"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    patch_body: dict[str, Any] = {"conteudo_ner": conteudo_ner}
    if embedding and len(embedding) == EMBEDDING_DIM:
        patch_body["embedding"] = embedding

    try:
        resp = _http_request("PATCH", endpoint, json_body=patch_body, headers=headers, timeout=20)
        return 200 <= getattr(resp, "status_code", 0) < 300
    except Exception:
        return False


def conciliar_publicacao_pss_femurn(
    texto_ato: str,
    codigo_femurn: str,
    data_circulacao: str,
    supabase_url: str,
    service_role_key: str,
    *,
    http_fn: Any = None,
) -> list[str]:
    """
    Cruza atos FEMURN contendo numero de edital PSS (ex: 001/2026) contra
    public.pss_editais / public.pss_publicacoes preenchendo codigo_femurn automaticamente.
    """
    if not texto_ato or not codigo_femurn or not supabase_url or not service_role_key:
        return []

    req_fn = http_fn or _http_request
    base_url = supabase_url.rstrip("/")
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }

    matches = re.findall(r"\b(\d{1,4}/\d{4})\b", normalizar_nfd(texto_ato))
    if not matches:
        return []

    conciliados: list[str] = []
    for num_ed in dict.fromkeys(matches):
        num_enc = urllib.parse.quote(num_ed, safe="")
        try:
            res_ed = req_fn(
                "GET",
                f"{base_url}/rest/v1/pss_editais?numero_edital=eq.{num_enc}&select=id,numero_edital&limit=3",
                headers=headers,
                timeout=15,
            )
            if not (200 <= getattr(res_ed, "status_code", 0) < 300):
                continue
            editais = res_ed.json() if hasattr(res_ed, "json") else json.loads(getattr(res_ed, "text", "[]") or "[]")
            if not isinstance(editais, list):
                continue

            for ed in editais:
                ed_id = str(ed.get("id") or "").strip()
                if not ed_id:
                    continue
                patch_url = (
                    f"{base_url}/rest/v1/pss_publicacoes"
                    f"?edital_id=eq.{urllib.parse.quote(ed_id, safe='')}&codigo_femurn=is.null"
                )
                patch_headers = dict(headers)
                patch_headers["Prefer"] = "return=minimal"
                res_patch = req_fn(
                    "PATCH",
                    patch_url,
                    json_body={
                        "codigo_femurn": codigo_femurn,
                        "data_circulacao_femurn": data_circulacao or None,
                    },
                    headers=patch_headers,
                    timeout=15,
                )
                if 200 <= getattr(res_patch, "status_code", 0) < 300:
                    conciliados.append(num_ed)
        except Exception:
            continue
    return conciliados


def _despachar_recado_persona_gas(
    persona_slug: str,
    codigo_femurn: str,
    mensagem_recado: str,
    dedup_key: str,
    gateway_url: str,
    gateway_secret: str,
) -> bool:
    """Envia recado idempotente para a memória Google Docs da persona via GAS/Gateway."""
    if not gateway_url:
        return False

    payload: dict[str, Any] = {
        "action": "registrar_recado_md",
        "arquivo_md": f"_memoria_{persona_slug}.md",
        "slug": persona_slug,
        "codigo_femurn": codigo_femurn,
        "dedup_key": dedup_key,
        "linha": mensagem_recado,
    }
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if gateway_secret:
        payload["token"] = gateway_secret
        headers["Authorization"] = f"Bearer {gateway_secret}"

    try:
        resp = _http_request("POST", gateway_url, json_body=payload, headers=headers, timeout=20)
        if not (200 <= getattr(resp, "status_code", 0) < 300):
            return False
        try:
            body_json = resp.json() if hasattr(resp, "json") else json.loads(getattr(resp, "text", "") or "{}")
            if isinstance(body_json, dict) and body_json.get("ok") is False:
                return False
        except Exception:
            pass
        return True
    except Exception:
        return False


def _montar_texto_publicacao(pub: dict[str, Any]) -> str:
    """Agrega campos textuais relevantes de uma publicação para análise NFD e vetorial."""
    entidades = pub.get("entidades_ner") or {}
    servidores_ner = entidades.get("servidores") or []
    if isinstance(servidores_ner, str):
        servidores_ner = [servidores_ner]
    partes = [
        pub.get("titulo_ato") or "",
        pub.get("titulo_original") or "",
        pub.get("titulo") or "",
        pub.get("categoria") or pub.get("ato_tipo") or "",
        pub.get("orgao") or "",
        pub.get("entidade") or "",
        pub.get("resumo_texto") or pub.get("resumo") or pub.get("texto_integral") or pub.get("texto") or "",
        " ".join(str(s) for s in servidores_ner),
    ]
    return "\n".join(str(p) for p in partes if p).strip()


def executar_radar_diario(
    publicacoes: list[dict[str, Any]] | None,
    dt_referencia: str = "",
    *,
    gemini_api_key: str | None = None,
    embedding_model: str | None = None,
    servidores_path: Path | str | None = None,
    servidores_lista: list[dict[str, Any]] | None = None,
    prototypes_path: Path | str | None = None,
    prototype_embeddings: dict[str, list[float]] | None = None,
    dispatch_guard_path: Path | str | None = DEFAULT_DISPATCH_GUARD_PATH,
    persistir_supabase: bool = True,
    despachar_gas: bool = True,
) -> dict[str, Any]:
    """
    Executa o Radar Preditivo sobre as publicações mineradas no Diário Oficial (FEMURN).

    Combina Camada 1 Determinística (NFD + SMEB servidores_consolidados.json + regex de prazos/contratos/PSS)
    com Camada 2 Vetorial opcional (Gemini Embedding 2, 768 dims, custo $0 Free Tier) e fallback
    100% determinístico quando GEMINI_API_KEY estiver ausente ou falhar.
    """
    pubs = list(publicacoes or [])
    dt_ref = str(dt_referencia or "").strip() or datetime.now(_TZ_FORTALEZA).strftime("%d/%m/%Y")

    prototipos_cfg = carregar_prototipos_personas(prototypes_path)
    personas_cfg = prototipos_cfg.get("personas") or {}
    servidores_smeb = carregar_servidores_smeb(
        servidores_path=servidores_path,
        servidores_lista=servidores_lista,
    )

    api_key = (
        gemini_api_key
        if gemini_api_key is not None
        else os.getenv("GEMINI_API_KEY", "")
    ).strip()
    modelo_cfg = (
        embedding_model
        or os.getenv("GEMINI_EMBEDDING_MODEL", "").strip()
        or str(prototipos_cfg.get("embedding_model_default") or DEFAULT_EMBEDDING_MODEL)
    )

    vetores_prototipos: dict[str, list[float]] = {}
    ia_habilitada = False
    if api_key and pubs:
        vetores_prototipos, ia_habilitada, modelo_cfg = _obter_vetores_prototipos(
            prototipos_cfg,
            api_key=api_key,
            model=modelo_cfg,
            prototype_embeddings=prototype_embeddings,
        )

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    gateway_url = (
        os.getenv("GAS_GATEWAY_URL", "").strip() or os.getenv("GAS_WEBHOOK_URL", "").strip()
    )
    gateway_secret = (
        os.getenv("GAS_GATEWAY_SECRET", "").strip()
        or os.getenv("OLYMPOS_SECRET_TOKEN", "").strip()
        or service_role_key
    )

    guard_path_obj = Path(dispatch_guard_path) if dispatch_guard_path else None
    guard_chaves = _carregar_guard_despacho(guard_path_obj)

    alertas: list[dict[str, Any]] = []
    todas_pessoas: list[dict[str, str]] = []
    pessoas_vistas: set[tuple[str, str]] = set()
    todos_prazos: list[dict[str, Any]] = []
    todos_contratos: list[dict[str, str]] = []
    todos_pss: list[dict[str, str]] = []
    contagem_personas: dict[str, int] = {}
    notificacoes_lote: list[dict[str, Any]] = []
    recados_despachados = 0
    vetorizado_global = False

    for idx, pub in enumerate(pubs):
        if not isinstance(pub, dict):
            continue

        texto_pub = _montar_texto_publicacao(pub)
        titulo_pub = str(
            pub.get("titulo_ato") or pub.get("titulo") or pub.get("titulo_original") or "Publicação FEMURN"
        ).strip()
        categoria_pub = str(pub.get("categoria") or pub.get("ato_tipo") or "ATO_OFICIAL").strip()
        entidades_ner = pub.get("entidades_ner") if isinstance(pub.get("entidades_ner"), dict) else {}
        cod_femurn = str(
            pub.get("codigo_identificador") or pub.get("codigo_femurn") or pub.get("codigo") or ""
        ).strip()
        cod_dedup = cod_femurn or hashlib.sha1(f"{dt_ref}:{idx}:{titulo_pub}".encode("utf-8")).hexdigest()[:12]

        # Camada 1: Determinística
        pessoas_pub = detectar_servidores_smeb_no_texto(
            texto_pub,
            servidores_smeb,
            nomes_ner=entidades_ner.get("servidores") if isinstance(entidades_ner.get("servidores"), list) else None,
        )
        prazos_pub = extrair_prazos_legais(texto_pub)
        contratos_pub = extrair_contratos(texto_pub)
        pss_pub = extrair_pss_editais(texto_pub)

        scores_det = _calcular_scores_deterministicos(
            texto_pub,
            categoria_pub,
            prazos_pub,
            contratos_pub,
            pss_pub,
            prototipos_cfg,
        )

        # Camada 2: Vetorial opcional (Gemini Embedding 2 — 768 dims)
        pub_embedding: list[float] | None = None
        scores_cos: dict[str, float] = {}
        vetorizado_pub = False

        if ia_habilitada and vetores_prototipos and texto_pub:
            pub_embedding, modelo_usado = _gerar_embedding_gemini(
                texto_pub,
                api_key=api_key,
                model=modelo_cfg,
                dimensions=EMBEDDING_DIM,
            )
            if pub_embedding:
                vetorizado_pub = True
                vetorizado_global = True
                modelo_cfg = modelo_usado
                for slug, proto_vec in vetores_prototipos.items():
                    scores_cos[slug] = similaridade_cosseno(pub_embedding, proto_vec)
            else:
                # Falha ou cota 429: desativa chamadas restantes e segue em fallback 100% determinístico
                ia_habilitada = False

        # Combinação de scores: semântico + determinístico (ou 100% determinístico)
        scores_finais: dict[str, float] = {}
        max_det = max(scores_det.values(), default=0.0) or 1.0
        for slug in personas_cfg:
            det_norm = scores_det.get(slug, 0.0) / max_det if max(scores_det.values(), default=0.0) > 0 else 0.0
            if vetorizado_pub and slug in scores_cos:
                scores_finais[slug] = (0.60 * max(0.0, scores_cos[slug])) + (0.40 * det_norm)
            else:
                scores_finais[slug] = scores_det.get(slug, 0.0)

        if scores_finais:
            persona_destino = max(scores_finais, key=lambda k: (scores_finais[k], scores_det.get(k, 0.0)))
            if scores_finais[persona_destino] <= 0.0:
                persona_destino = "apolo"
        else:
            persona_destino = "apolo"

        contagem_personas[persona_destino] = contagem_personas.get(persona_destino, 0) + 1

        for p in pessoas_pub:
            chave_p = (normalizar_nfd(p["nome"]), p["matricula"])
            if chave_p not in pessoas_vistas:
                pessoas_vistas.add(chave_p)
                todas_pessoas.append(p)
        todos_prazos.extend(prazos_pub)
        todos_contratos.extend(contratos_pub)
        todos_pss.extend(pss_pub)

        eh_critico = bool(prazos_pub or pss_pub or pessoas_pub)
        severidade = "CRITICO" if eh_critico else "AVISO"
        eh_acionavel = eh_critico or bool(contratos_pub) or scores_det.get(persona_destino, 0.0) > 0.0

        persona_info = personas_cfg.get(persona_destino) or {}
        persona_nome = str(persona_info.get("nome") or persona_destino.capitalize())
        roles_dest = list(persona_info.get("roles_notificacao") or ["MODERADOR", "ADMIN_GABINETE"])

        alerta_item = {
            "codigo_femurn": cod_femurn or cod_dedup,
            "titulo": titulo_pub,
            "persona_destino": persona_destino,
            "persona_nome": persona_nome,
            "severidade": severidade,
            "pessoas_citadas": pessoas_pub,
            "prazos_detectados": prazos_pub,
            "contratos_detectados": contratos_pub,
            "pss_editais_detectados": pss_pub,
            "vetorizado_com_ia": vetorizado_pub,
            "score_roteamento": round(float(scores_finais.get(persona_destino, 0.0)), 4),
        }
        alertas.append(alerta_item)

        conteudo_ner_atualizado = {
            **(pub.get("conteudo_ner") if isinstance(pub.get("conteudo_ner"), dict) else {}),
            "codigo_identificador": cod_femurn or cod_dedup,
            "entidade": pub.get("entidade"),
            "orgao": pub.get("orgao"),
            "url_materia": pub.get("url_materia") or pub.get("url_origem"),
            "link_pdf": pub.get("link_pdf"),
            "numero_ato": entidades_ner.get("numero_ato"),
            "resumo_texto": str(pub.get("resumo_texto") or "")[:1000],
            "persona_destino": persona_destino,
            "servidores_citados": pessoas_pub,
            "prazos_detectados": prazos_pub,
            "contratos_detectados": contratos_pub,
            "pss_editais_detectados": pss_pub,
            "vetorizado_com_ia": vetorizado_pub,
            "radar_severidade": severidade,
        }
        pub["conteudo_ner"] = conteudo_ner_atualizado

        if persistir_supabase and supabase_url and service_role_key and cod_femurn:
            _atualizar_publicacao_diario_supabase(
                cod_femurn,
                conteudo_ner_atualizado,
                pub_embedding,
                supabase_url,
                service_role_key,
            )
            if pss_pub:
                conciliados = conciliar_publicacao_pss_femurn(
                    texto_pub,
                    cod_femurn,
                    str(pub.get("data_publicacao") or dt_ref),
                    supabase_url,
                    service_role_key,
                )
                if conciliados:
                    alerta_item["pss_conciliados"] = conciliados

        if eh_acionavel:
            detalhes_msg: list[str] = [f"Persona: {persona_nome}"]
            if pessoas_pub:
                nomes_res = ", ".join(p["nome"] for p in pessoas_pub[:3])
                detalhes_msg.append(f"Servidores SMEB: {nomes_res}")
            if prazos_pub:
                detalhes_msg.append(f"Prazos: {prazos_pub[0]['texto']}")
            if pss_pub:
                detalhes_msg.append(f"PSS/Edital: {pss_pub[0]['texto']}")
            if contratos_pub:
                detalhes_msg.append(f"Contrato: {contratos_pub[0]['texto']}")

            dedup_notif = f"radar_femurn:{cod_dedup}:{persona_destino}"[:180]
            notificacoes_lote.append({
                "destinatario_roles": roles_dest,
                "categoria": "FEMURN",
                "severidade": severidade,
                "titulo": f"Radar FEMURN → {persona_nome}: {titulo_pub[:140]}"[:220],
                "mensagem": " • ".join(detalhes_msg)[:600],
                "link_rota": "#diario-oficial",
                "dedup_key": dedup_notif,
            })

            guard_key = f"{cod_dedup}:{persona_destino}"
            if despachar_gas and gateway_url and guard_key not in guard_chaves:
                url_ref = str(pub.get("url_drive") or pub.get("urlDrive") or pub.get("url_origem") or "").strip()
                msg_recado = (
                    f"[{dt_ref}] [RADAR FEMURN → {persona_nome}] {titulo_pub[:110]} | "
                    f"Cód: {cod_femurn or cod_dedup} | {' ; '.join(detalhes_msg)}"
                    + (f" ({url_ref})" if url_ref else "")
                )
                if _despachar_recado_persona_gas(
                    persona_destino,
                    cod_femurn or cod_dedup,
                    msg_recado,
                    dedup_notif,
                    gateway_url,
                    gateway_secret,
                ):
                    recados_despachados += 1
                    guard_chaves.add(guard_key)

    if recados_despachados > 0:
        _salvar_guard_despacho(guard_chaves, guard_path_obj)

    notificacoes_registradas = 0
    if persistir_supabase and notificacoes_lote:
        notificacoes_registradas = _despachar_notificacoes_supabase(
            notificacoes_lote,
            supabase_url,
            service_role_key,
        )

    persona_principal = (
        max(contagem_personas, key=lambda k: contagem_personas[k])
        if contagem_personas
        else ("apolo" if pubs else "")
    )

    return {
        "ok": True,
        "data_referencia": dt_ref,
        "total_analisadas": len(pubs),
        "alertas": alertas,
        "pessoas_citadas": todas_pessoas,
        "prazos_detectados": todos_prazos,
        "contratos_detectados": todos_contratos,
        "pss_editais_detectados": todos_pss,
        "persona_destino": persona_principal,
        "personas_roteadas": contagem_personas,
        "vetorizado_com_ia": vetorizado_global,
        "modelo_embedding": modelo_cfg,
        "camada_utilizada": "VETORIAL_GEMINI_EMBEDDING_2" if vetorizado_global else "DETERMINISTICO_LOCAL",
        "notificacoes_registradas": notificacoes_registradas,
        "recados_despachados": recados_despachados,
    }
