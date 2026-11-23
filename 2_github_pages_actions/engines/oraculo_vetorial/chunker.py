#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Segmentador semântico de textos institucionais (Chunker Onda 4 — Sprint 4.1).

Divide documentos em chunks de 400–600 tokens (~1.3x palavras em português)
com overlap configurável (padrão 80 tokens) e calcula `conteudo_hash` SHA-256
determinístico para ingestão 100% incremental no `gemini-embedding-2`.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

_RE_PARAGRAPHS = re.compile(r"\n{2,}")
_RE_SENTENCES = re.compile(r"(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ0-9])")


def estimate_tokens(text: str) -> int:
    """Estima contagem de tokens para português administrativo (~1.3x palavras)."""
    words = re.findall(r"\S+", text or "")
    if not words:
        return 0
    return max(1, int(round(len(words) * 1.3)))


def compute_content_hash(text: str) -> str:
    """Computa SHA-256 estável após normalização leve de quebras e espaços."""
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _split_oversized_unit(unit: str, max_tokens: int) -> list[str]:
    """Quebra parágrafos muito longos em sentenças ou fatias por palavras."""
    if estimate_tokens(unit) <= max_tokens:
        return [unit]

    sentences = [s.strip() for s in _RE_SENTENCES.split(unit) if s.strip()]
    if len(sentences) <= 1:
        words = unit.split()
        max_words = max(40, int(max_tokens / 1.3))
        slices: list[str] = []
        for idx in range(0, len(words), max_words):
            slices.append(" ".join(words[idx : idx + max_words]))
        return slices

    pieces: list[str] = []
    cur: list[str] = []
    for sent in sentences:
        candidate = (" ".join(cur + [sent])).strip()
        if cur and estimate_tokens(candidate) > max_tokens:
            pieces.append(" ".join(cur).strip())
            cur = [sent]
        else:
            cur.append(sent)
    if cur:
        pieces.append(" ".join(cur).strip())
    return pieces


def _tail_overlap(text: str, overlap_tokens: int) -> str:
    """Retorna os últimos ~overlap_tokens do texto preservando palavras inteiras."""
    if overlap_tokens <= 0 or not text:
        return ""
    words = text.split()
    target_words = max(1, int(overlap_tokens / 1.3))
    if len(words) <= target_words:
        return text
    return " ".join(words[-target_words:])


def chunk_text(
    text: str,
    *,
    target_tokens: int = 480,
    min_tokens: int = 400,
    max_tokens: int = 600,
    overlap_tokens: int = 80,
) -> list[dict[str, Any]]:
    """
    Fragmenta um texto longo em chunks entre `min_tokens` e `max_tokens` (quando possível)
    preservando overlap semântico entre chunks consecutivos.
    """
    cleaned = re.sub(r"\r\n?", "\n", str(text or "")).strip()
    if not cleaned:
        return []

    if estimate_tokens(cleaned) <= max_tokens:
        return [
            {
                "chunk_index": 0,
                "chunk_texto": cleaned,
                "token_estimate": estimate_tokens(cleaned),
                "conteudo_hash": compute_content_hash(cleaned),
            }
        ]

    raw_paragraphs = [p.strip() for p in _RE_PARAGRAPHS.split(cleaned) if p.strip()]
    units: list[str] = []
    for p in raw_paragraphs:
        units.extend(_split_oversized_unit(p, max_tokens=max_tokens))

    chunks_raw: list[str] = []
    buffer_parts: list[str] = []

    for unit in units:
        candidate = ("\n\n".join(buffer_parts + [unit])).strip()
        cand_tokens = estimate_tokens(candidate)

        if buffer_parts and cand_tokens > max_tokens:
            chunk_str = "\n\n".join(buffer_parts).strip()
            chunks_raw.append(chunk_str)
            overlap_str = _tail_overlap(chunk_str, overlap_tokens)
            buffer_parts = [overlap_str, unit] if overlap_str else [unit]
        else:
            buffer_parts.append(unit)
            if cand_tokens >= target_tokens and cand_tokens >= min_tokens:
                chunk_str = "\n\n".join(buffer_parts).strip()
                chunks_raw.append(chunk_str)
                overlap_str = _tail_overlap(chunk_str, overlap_tokens)
                buffer_parts = [overlap_str] if overlap_str else []

    if buffer_parts:
        leftover = "\n\n".join(buffer_parts).strip()
        if chunks_raw and estimate_tokens(leftover) < int(min_tokens * 0.45):
            prev = chunks_raw[-1]
            # Evita perder conteúdo inédito sem duplicar demais o overlap
            if leftover not in prev and estimate_tokens(prev + "\n\n" + leftover) <= int(max_tokens * 1.15):
                chunks_raw[-1] = (prev + "\n\n" + leftover).strip()
            elif leftover not in prev:
                chunks_raw.append(leftover)
        elif leftover:
            chunks_raw.append(leftover)

    results: list[dict[str, Any]] = []
    for idx, ch in enumerate(chunks_raw):
        results.append(
            {
                "chunk_index": idx,
                "chunk_texto": ch,
                "token_estimate": estimate_tokens(ch),
                "conteudo_hash": compute_content_hash(ch),
            }
        )
    return results
