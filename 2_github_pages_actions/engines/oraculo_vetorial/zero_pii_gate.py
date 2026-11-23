#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gate determinístico Zero-PII (LGPD) para o pipeline Onda 4 ($0).

Impede que qualquer dado pessoal identificável (CPF, RG, telefone pessoal,
e-mail pessoal ou diagnóstico/sigilo clínico) seja enviado ao Free Tier da
API `gemini-embedding-2` no Google AI Studio.
"""

from __future__ import annotations

import re
from typing import Any

# Regex sem falsos positivos por CPFs de exemplo no arquivo-fonte:
_RE_CPF_FORMATTED = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")
_RE_CPF_LABELED_DIGITS = re.compile(r"\b(?:cpf|c\.p\.f\.?)\s*[:=\-#º°]?\s*(\d{11})\b", re.IGNORECASE)
_RE_CPF_RAW_11 = re.compile(r"(?<!\d)(\d{11})(?!\d)")
_RE_RG_LABELED = re.compile(r"\b(?:rg|r\.g\.?|registro\s+geral)\s*[:=\-#º°]?\s*([0-9][0-9.\-xX]{4,14})\b", re.IGNORECASE)
_RE_EMAIL = re.compile(r"\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b")
_RE_PHONE_BR = re.compile(
    r"(?<!\d)(?:\+?55\s*)?(?:\(\d{2}\)\s*|\b\d{2}\s+)9?\d{4}[-.\s]?\d{4}(?!\d)"
)
_RE_CLINICAL_TERMS = re.compile(
    r"\b(?:"
    r"cid[\s\-:]*10|cid[\s\-:]*11|cid\s*:\s*[A-Z]\d{2}(?:\.\d)?|"
    r"laudo\s+m[eé]dic[oa]|atestado\s+m[eé]dic[oa]|diagn[oó]stico\s+m[eé]dic[oa]|"
    r"prontu[aá]rio\s+m[eé]dic[oa]|receitu[aá]rio\s+m[eé]dic[oa]|junta\s+m[eé]dica\s+sigilos[ao]|"
    r"patologia\s+cl[ií]nica|exame\s+cl[ií]nico|tratamento\s+psiqui[aá]trico|sa[uú]de\s+sigilos[ao]"
    r")\b",
    re.IGNORECASE,
)

# Domínios institucionais públicos que não representam e-mail pessoal do cidadão
_INSTITUTIONAL_EMAIL_DOMAINS = (
    "cearamirim.rn.gov.br",
    "cearamirim.rn.leg.br",
    "smeb.cearamirim.rn.gov.br",
    "mec.gov.br",
)


def is_valid_cpf_digits(digits: str) -> bool:
    """Valida algoritmo Módulo 11 da Receita Federal para 11 dígitos."""
    nums = [int(c) for c in digits if c.isdigit()]
    if len(nums) != 11 or len(set(nums)) == 1:
        return False
    s1 = sum(nums[i] * (10 - i) for i in range(9))
    d1 = 0 if ((s1 * 10) % 11) == 10 else ((s1 * 10) % 11)
    if d1 != nums[9]:
        return False
    s2 = sum(nums[i] * (11 - i) for i in range(10))
    d2 = 0 if ((s2 * 10) % 11) == 10 else ((s2 * 10) % 11)
    return d2 == nums[10]


def detect_pii(text: str) -> list[dict[str, str]]:
    """
    Detecta ocorrências de PII proibido para envio ao Gemini Free Tier.
    Retorna lista de achados: [{"tipo": ..., "trecho": ...}].
    """
    if not text:
        return []

    findings: list[dict[str, str]] = []
    seen_spans: set[tuple[str, int]] = set()

    def _add(tipo: str, pos: int, sample: str) -> None:
        key = (tipo, pos)
        if key not in seen_spans:
            seen_spans.add(key)
            findings.append({"tipo": tipo, "trecho": sample[:32]})

    for m in _RE_CPF_FORMATTED.finditer(text):
        _add("CPF_FORMATADO", m.start(), m.group(0))

    for m in _RE_CPF_LABELED_DIGITS.finditer(text):
        _add("CPF_ROTULADO", m.start(), m.group(0))

    for m in _RE_CPF_RAW_11.finditer(text):
        digits = m.group(1)
        if is_valid_cpf_digits(digits):
            _add("CPF_DIGITOS_VALIDOS", m.start(), digits)

    for m in _RE_RG_LABELED.finditer(text):
        _add("RG_ROTULADO", m.start(), m.group(0))

    for m in _RE_PHONE_BR.finditer(text):
        _add("TELEFONE_PESSOAL", m.start(), m.group(0))

    for m in _RE_EMAIL.finditer(text):
        email_val = m.group(1).lower()
        domain = email_val.split("@", 1)[-1]
        if not any(domain == d or domain.endswith("." + d) for d in _INSTITUTIONAL_EMAIL_DOMAINS):
            _add("EMAIL_PESSOAL", m.start(), email_val)

    for m in _RE_CLINICAL_TERMS.finditer(text):
        _add("SIGILO_CLINICO", m.start(), m.group(0))

    return findings


def zero_pii_sanitize(
    text: str,
    *,
    strict_reject: bool = True,
) -> dict[str, Any]:
    """
    Executa o Zero-PII Gate determinístico antes de qualquer chamada externa.

    Quando `strict_reject=True` (padrão da ingestão de conhecimento), a presença
    de qualquer PII ou termo clínico resulta em `allowed=False` e `blocked=True`,
    impedindo o envio do chunk para o Free Tier do `gemini-embedding-2`.
    """
    raw = str(text or "")
    findings = detect_pii(raw)
    sanitized = raw

    if findings:
        sanitized = _RE_CPF_FORMATTED.sub("[CPF_OCULTO]", sanitized)
        sanitized = _RE_CPF_LABELED_DIGITS.sub("CPF [CPF_OCULTO]", sanitized)
        sanitized = _RE_CPF_RAW_11.sub(
            lambda m: "[CPF_OCULTO]" if is_valid_cpf_digits(m.group(1)) else m.group(0),
            sanitized,
        )
        sanitized = _RE_RG_LABELED.sub("[RG_OCULTO]", sanitized)
        sanitized = _RE_PHONE_BR.sub("[TELEFONE_OCULTO]", sanitized)

        def _redact_email(match: re.Match[str]) -> str:
            addr = match.group(1)
            dom = addr.lower().split("@", 1)[-1]
            if any(dom == d or dom.endswith("." + d) for d in _INSTITUTIONAL_EMAIL_DOMAINS):
                return addr
            return "[EMAIL_OCULTO]"

        sanitized = _RE_EMAIL.sub(_redact_email, sanitized)
        sanitized = _RE_CLINICAL_TERMS.sub("[SIGILO_CLINICO]", sanitized)

    blocked = bool(findings) and strict_reject
    reasons = sorted({f["tipo"] for f in findings})
    return {
        "allowed": not blocked,
        "blocked": blocked,
        "has_pii": bool(findings),
        "reasons": reasons,
        "findings_count": len(findings),
        "sanitized_text": sanitized,
    }
