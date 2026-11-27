"""
Hub Olympos — Onda 8 (Sprint 8.2): Motor Catalogador Híbrido FEMURN
Primário de alto volume: Gemma 4 31B (`gemma-4-31b-it`, soft-cap 8.500 / 10.000 RPD)
Escalonamento pontual: Gemini 3.5 Flash Lite (`gemini-3.5-flash-lite`, soft-cap 340 / 400 RPD)
Fallback determinístico em cascata quando chave ausente, cota esgotada ou HTTP 429.
"""

import json
import os
import re
import time
from typing import Any, Callable, Optional

import urllib.error
import urllib.request

MODEL_GEMMA_BATCH = "gemma-4-31b-it"
MODEL_GEMINI_ESPECIALISTA = "gemini-3.5-flash-lite"
PROMPT_VERSAO = "v8.1-gemma4"

SOFT_CAPS_DEFAULT = {
    MODEL_GEMMA_BATCH: 8500,
    MODEL_GEMINI_ESPECIALISTA: 340,
}

TIPOS_ATOS_CANONICOS = {
    "PORTARIA",
    "DECRETO",
    "LEI",
    "EXTRATO_CONTRATO",
    "EDITAL_LICITACAO",
    "EDITAL_PSS",
    "AVISO_PREGAO",
    "TERMO_JUSTIFICATIVA",
    "PERMUTA_CESSAO",
    "NOMEACAO_DIRETOR",
    "REPUBLICACAO",
    "RESOLUCAO",
    "PARECER",
    "OUTRO_ATO",
}

_LOCAL_QUOTA_MEM: dict[str, int] = {
    MODEL_GEMMA_BATCH: 0,
    MODEL_GEMINI_ESPECIALISTA: 0,
}


def _default_http_post(url: str, json_payload: dict[str, Any], headers: dict[str, str], timeout: int = 35) -> tuple[int, Any]:
    data = json.dumps(json_payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace") if err.fp else str(err)
        try:
            return err.code, json.loads(raw) if raw else {"error": raw}
        except json.JSONDecodeError:
            return err.code, raw


def _normalizar_supabase_url(raw_url: str | None) -> str:
    clean = str(raw_url or "").strip().rstrip("/")
    if not clean:
        return ""
    clean = re.sub(r"/(?:rest|auth|functions|storage)/v1(?:/.*)?$", "", clean, flags=re.IGNORECASE)
    return clean.rstrip("/")


def extrair_json_defensivo(raw_text: str) -> Optional[dict[str, Any]]:
    """Extrai e valida JSON mesmo quando o modelo Gemma retorna cercas Markdown ou texto auxiliar."""
    if not raw_text or not isinstance(raw_text, str):
        return None

    clean = raw_text.strip()
    clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean)

    parsed = None
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        match_obj = re.search(r"\{[\s\S]*\}", clean)
        if not match_obj:
            return None
        try:
            parsed = json.loads(match_obj.group(0))
        except json.JSONDecodeError:
            return None

    if not isinstance(parsed, dict):
        return None

    tipo = str(parsed.get("tipo_ato_canonico") or "OUTRO_ATO").strip().upper()
    if tipo not in TIPOS_ATOS_CANONICOS:
        tipo = "OUTRO_ATO"

    titulo_canonico = str(parsed.get("titulo_canonico") or "").strip()[:180]
    secretaria_origem = str(parsed.get("secretaria_origem") or "").strip()[:160]
    resumo_executivo = str(parsed.get("resumo_executivo") or "").strip()[:700]
    if not titulo_canonico and not resumo_executivo:
        return None

    rel_raw = parsed.get("relevancia_smeb")
    if isinstance(rel_raw, bool):
        relevancia_smeb = rel_raw
    else:
        relevancia_smeb = str(rel_raw or "").strip().lower() in ("true", "1", "sim", "yes")

    motivo_rel = str(parsed.get("motivo_relevancia_smeb") or "").strip()[:240]

    servidores_raw = parsed.get("servidores")
    servidores = [str(s).strip().upper() for s in servidores_raw if str(s).strip()] if isinstance(servidores_raw, list) else []

    matriculas_raw = parsed.get("matriculas")
    matriculas = [str(m).strip() for m in matriculas_raw if str(m).strip()] if isinstance(matriculas_raw, list) else []

    prazos_raw = parsed.get("prazos_detectados")
    prazos = [p for p in prazos_raw if isinstance(p, (str, dict))][:10] if isinstance(prazos_raw, list) else []

    tags_raw = parsed.get("tags_tematicas")
    tags = [str(t).strip().lower() for t in tags_raw if str(t).strip()][:10] if isinstance(tags_raw, list) else []

    try:
        conf = float(parsed.get("confianca_ia", 0.8))
    except (TypeError, ValueError):
        conf = 0.7
    conf = max(0.0, min(1.0, round(conf, 3)))

    numero_ato = str(parsed.get("numero_ato") or "").strip()[:40]
    # Proteção contra falso positivo de citação da Lei 14.133/2021 quando tipo != LEI
    if tipo != "LEI" and re.fullmatch(r"14\.?133(?:/\d{2,4})?", numero_ato):
        numero_ato = ""

    return {
        "tipo_ato_canonico": tipo,
        "titulo_canonico": titulo_canonico,
        "secretaria_origem": secretaria_origem,
        "relevancia_smeb": relevancia_smeb,
        "motivo_relevancia_smeb": motivo_rel,
        "resumo_executivo": resumo_executivo,
        "servidores": servidores[:15],
        "matriculas": matriculas[:15],
        "numero_ato": numero_ato,
        "cnpj_fornecedor": str(parsed.get("cnpj_fornecedor") or "").strip()[:32],
        "valor_global": str(parsed.get("valor_global") or "").strip()[:48],
        "prazos_detectados": prazos,
        "tags_tematicas": tags,
        "confianca_ia": conf,
    }


def consumir_cota_supabase(
    modelo: str,
    supabase_url: str | None = None,
    service_key: str | None = None,
    delta: int = 1,
    tokens_in: int = 0,
    tokens_out: int = 0,
    http_post_fn: Optional[Callable[..., tuple[int, Any]]] = None,
) -> dict[str, Any]:
    """Verifica/consome cota atômica no Supabase (`rpc_consumir_cota_ia`) com fallback em memória."""
    post = http_post_fn or _default_http_post
    url_base = _normalizar_supabase_url(supabase_url or os.getenv("SUPABASE_URL"))
    key = (service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    cap_padrao = SOFT_CAPS_DEFAULT.get(modelo, 8500)

    if url_base and key:
        endpoint = f"{url_base}/rest/v1/rpc/rpc_consumir_cota_ia"
        hdrs = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            st, body = post(
                endpoint,
                {
                    "p_modelo": modelo,
                    "p_delta": int(delta),
                    "p_tokens_in": int(tokens_in),
                    "p_tokens_out": int(tokens_out),
                },
                hdrs,
                15,
            )
            if 200 <= st < 300 and isinstance(body, dict) and "permitido" in body:
                return body
        except Exception:
            pass

    # Fallback em memória caso Supabase não esteja configurado ou migration 043 não aplicada ainda
    usadas = _LOCAL_QUOTA_MEM.get(modelo, 0)
    if usadas + delta > cap_padrao:
        return {"permitido": False, "modelo": modelo, "usadas": usadas, "soft_cap": cap_padrao, "restantes": 0}
    _LOCAL_QUOTA_MEM[modelo] = usadas + delta
    return {
        "permitido": True,
        "modelo": modelo,
        "usadas": usadas + delta,
        "soft_cap": cap_padrao,
        "restantes": max(0, cap_padrao - (usadas + delta)),
    }


def chamar_modelo_google_ai(
    modelo: str,
    prompt_texto: str,
    api_key: str,
    http_post_fn: Optional[Callable[..., tuple[int, Any]]] = None,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> tuple[int, str, dict[str, int]]:
    """
    Invoca generativelanguage.googleapis.com/v1beta em formato compatível com Gemma 4 31B e Gemini 3.5 Flash Lite.
    Diretrizes e JSON Schema são enviados no papel `user` (sem systemInstruction/responseMimeType).
    """
    post = http_post_fn or _default_http_post
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt_texto}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 900,
        },
    }
    headers = {"Content-Type": "application/json"}

    last_status = 0
    for tentativa in range(2):
        st, data = post(endpoint, payload, headers, 35)
        last_status = st
        if 200 <= st < 300 and isinstance(data, dict):
            cands = data.get("candidates") or []
            parts = (((cands[0] or {}).get("content") or {}).get("parts") or []) if cands else []
            txt = "".join(str(p.get("text") or "") for p in parts if isinstance(p, dict))
            usage = data.get("usageMetadata") or {}
            tokens = {
                "in": int(usage.get("promptTokenCount") or 0),
                "out": int(usage.get("candidatesTokenCount") or 0),
            }
            return st, txt, tokens
        if st == 429:
            print(f"[IA-CATALOGER] Modelo {modelo} retornou HTTP 429 (rate limit).")
            return 429, "", {"in": 0, "out": 0}
        err_snippet = ""
        try:
            err_snippet = json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else str(data or "")
        except Exception:
            err_snippet = str(data or "")
        err_snippet = err_snippet.replace(api_key, "***") if api_key else err_snippet
        print(f"[IA-CATALOGER] Modelo {modelo} retornou HTTP {st}: {err_snippet[:220]}")
        if st >= 500 and tentativa == 0:
            sleep_fn(1.0)
            continue
        break
    return last_status, "", {"in": 0, "out": 0}


def montar_prompt_catalogacao(entidade: str, orgao: str, data_circ: str, codigo: str, texto: str) -> str:
    trecho = str(texto or "").strip()[:5500]
    return (
        "Você é um catalogador administrativo oficial da Prefeitura Municipal de Ceará-Mirim/RN.\n"
        "Analise o ato oficial publicado no Diário Oficial da FEMURN abaixo e responda SOMENTE com um objeto JSON válido (sem comentários nem texto fora do JSON).\n\n"
        f"Entidade: {entidade}\n"
        f"Órgão informado pelo portal: {orgao}\n"
        f"Data de circulação: {data_circ}\n"
        f"Código FEMURN: {codigo}\n\n"
        "Regras estritas:\n"
        "1. NÃO confunda citações de leis no texto (ex.: 'Lei nº 14.133/2021', 'art. 141') com o número do ato administrativo.\n"
        "2. Defina relevancia_smeb=true para atos da Secretaria Municipal de Educação Básica (SMEB), escolas, CMEIs, creches, professores, merenda, transporte escolar, FUNDEB, PSS escolar ou licitações/obras vinculadas à Educação.\n"
        "3. `tipo_ato_canonico` deve ser exatamente um de: PORTARIA, DECRETO, LEI, EXTRATO_CONTRATO, EDITAL_LICITACAO, EDITAL_PSS, AVISO_PREGAO, TERMO_JUSTIFICATIVA, PERMUTA_CESSAO, NOMEACAO_DIRETOR, REPUBLICACAO, RESOLUCAO, PARECER, OUTRO_ATO.\n"
        "4. Esquema JSON obrigatório:\n"
        "{\n"
        '  "tipo_ato_canonico": "STRING",\n'
        '  "titulo_canonico": "Título claro e fiel ao ato real",\n'
        '  "secretaria_origem": "Nome oficial da secretaria/órgão de origem",\n'
        '  "relevancia_smeb": true,\n'
        '  "motivo_relevancia_smeb": "Justificativa em até 15 palavras",\n'
        '  "resumo_executivo": "Resumo objetivo em 2 frases institucionais",\n'
        '  "servidores": ["NOME COMPLETO EM MAIÚSCULAS"],\n'
        '  "matriculas": ["12345"],\n'
        '  "numero_ato": "Número real do ato ou string vazia",\n'
        '  "cnpj_fornecedor": "",\n'
        '  "valor_global": "",\n'
        '  "prazos_detectados": ["Descrição e data se houver"],\n'
        '  "tags_tematicas": ["tag1", "tag2"],\n'
        '  "confianca_ia": 0.92\n'
        "}\n\n"
        "Texto integral da matéria:\n"
        f"{trecho}"
    )


def catalogar_publicacao_hibrida(
    entidade: str,
    orgao: str,
    data_circ: str,
    codigo: str,
    texto_integral: str,
    api_key: str | None = None,
    supabase_url: str | None = None,
    service_key: str | None = None,
    http_post_fn: Optional[Callable[..., tuple[int, Any]]] = None,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> Optional[dict[str, Any]]:
    """
    Cataloga ato FEMURN usando Gemma 4 31B (10k RPD) com 1 retry corretivo para JSON
    e escalonamento pontual para Gemini 3.5 Flash Lite (400 RPD) se confianca_ia < 0.75.
    """
    key = (api_key if api_key is not None else os.getenv("GEMINI_API_KEY", "")).strip()
    if not key:
        return None

    prompt = montar_prompt_catalogacao(entidade, orgao, data_circ, codigo, texto_integral)
    resultado_final: Optional[dict[str, Any]] = None
    modelo_usado = ""

    # 1. Tenta primário: Gemma 4 31B
    cota_gemma = consumir_cota_supabase(
        MODEL_GEMMA_BATCH,
        supabase_url=supabase_url,
        service_key=service_key,
        delta=1,
        http_post_fn=http_post_fn,
    )
    if cota_gemma.get("permitido"):
        st, raw_txt, _tok = chamar_modelo_google_ai(
            MODEL_GEMMA_BATCH, prompt, key, http_post_fn=http_post_fn, sleep_fn=sleep_fn
        )
        parsed = extrair_json_defensivo(raw_txt) if 200 <= st < 300 else None
        # Retry corretivo único se Gemma retornou texto fora do formato JSON (sem gastar além se 429)
        if parsed is None and 200 <= st < 300 and raw_txt:
            cota_retry = consumir_cota_supabase(
                MODEL_GEMMA_BATCH,
                supabase_url=supabase_url,
                service_key=service_key,
                delta=1,
                http_post_fn=http_post_fn,
            )
            if cota_retry.get("permitido"):
                retry_prompt = (
                    "Sua resposta anterior não era um JSON válido. "
                    "Responda EXCLUSIVAMENTE com o JSON do esquema pedido, sem cercas markdown.\n\n"
                    f"Texto anterior truncado/inválido:\n{raw_txt[:800]}\n\n{prompt[:2800]}"
                )
                st2, raw_txt2, _tok2 = chamar_modelo_google_ai(
                    MODEL_GEMMA_BATCH, retry_prompt, key, http_post_fn=http_post_fn, sleep_fn=sleep_fn
                )
                if 200 <= st2 < 300:
                    parsed = extrair_json_defensivo(raw_txt2)
        if parsed is not None:
            resultado_final = parsed
            modelo_usado = MODEL_GEMMA_BATCH

    # 2. Escalonamento pontual para Gemini 3.5 Flash Lite se Gemma falhou OU baixa confiança (< 0.75)
    precisa_especialista = (
        resultado_final is None
        or resultado_final["confianca_ia"] < 0.75
        or resultado_final["tipo_ato_canonico"] == "OUTRO_ATO"
    )
    if precisa_especialista:
        cota_flash = consumir_cota_supabase(
            MODEL_GEMINI_ESPECIALISTA,
            supabase_url=supabase_url,
            service_key=service_key,
            delta=1,
            http_post_fn=http_post_fn,
        )
        if cota_flash.get("permitido"):
            st_f, raw_f, _tok_f = chamar_modelo_google_ai(
                MODEL_GEMINI_ESPECIALISTA, prompt, key, http_post_fn=http_post_fn, sleep_fn=sleep_fn
            )
            if 200 <= st_f < 300:
                parsed_f = extrair_json_defensivo(raw_f)
                if parsed_f is not None:
                    resultado_final = parsed_f
                    modelo_usado = MODEL_GEMINI_ESPECIALISTA

    if resultado_final is None:
        return None

    resultado_final["modelo_ia"] = modelo_usado
    resultado_final["prompt_versao"] = PROMPT_VERSAO
    resultado_final["catalogado_por_ia"] = True
    return resultado_final
