"""
Orquestrador central resiliente e ordenado dos extratores do Papiro de Cadmo.
Lê config/portais.json e executa a coleta dos 15 municípios + Estado do RN.
Garante isolamento e resiliência: a falha ou retorno vazio em qualquer secretaria
não encerra o workflow, registrando log de aviso claro e prosseguindo imediatamente
com os dados da próxima secretaria.

Ordem sequencial estrita de captura de dados:
1º: Ceará-Mirim (SMEB / base local principal)
2º: Municípios com o sistema Top Solutions (Parnamirim, São Gonçalo do Amarante, Macaíba, etc.)
3º: Natal e Governo do Estado (SEEC-RN) ao final da fila, pois utilizam sistemas/APIs diferentes.
"""
import concurrent.futures
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    from .topsolutions import TopSolutionsExtractor
    from .estado_rn import EstadoRNExtractor
    from .natal import NatalExtractor
    from .sga import SgaExtractor
except (ImportError, ValueError):
    from topsolutions import TopSolutionsExtractor
    from estado_rn import EstadoRNExtractor
    from natal import NatalExtractor
    from sga import SgaExtractor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.orchestrator")


def carregar_config() -> Dict[str, Any]:
    raiz = Path(__file__).resolve().parent.parent
    caminho_cfg = raiz / "config" / "portais.json"
    with open(caminho_cfg, "r", encoding="utf-8") as f:
        return json.load(f)


def obter_fase_prioridade(p: Dict[str, Any]) -> int:
    """
    Classifica o portal na fila sequencial de prioridades em 3 fases:
    Fase 1: Ceará-Mirim (SMEB / base local principal)
    Fase 2: Municípios com sistema Top Solutions e SGA
    Fase 3: Natal e Governo do Estado (SEEC-RN) ao final da fila
    """
    pid = str(p.get("id", "")).strip().lower()
    ptipo = str(p.get("tipo", "")).strip().lower()
    ente = str(p.get("ente", "")).strip().lower()

    # 1º: Ceará-Mirim (SMEB / base local principal)
    if pid == "ceara_mirim" or p.get("base_controle_local") or "ceará-mirim" in ente or "ceara-mirim" in ente:
        return 1

    # 3º: Natal e Governo do Estado (SEEC-RN) ao final da fila
    if (
        pid in ("natal", "estado_rn")
        or ptipo in ("natal_api", "estado_rn")
        or "natal" in ente
        or "estado do rio grande" in ente
        or "governo do estado" in ente
        or "seec" in ente
    ):
        return 3

    # 2º: Municípios com o sistema Top Solutions e demais parceiros municipais
    return 2


def chave_prioridade(p: Dict[str, Any]) -> Tuple[int, int, str]:
    fase = obter_fase_prioridade(p)
    pid = str(p.get("id", "")).strip().lower()
    ptipo = str(p.get("tipo", "")).strip().lower()
    ente = str(p.get("ente", "")).strip().lower()
    pos_final = 0
    if fase == 3:
        pos_final = 1 if (pid == "natal" or ptipo == "natal_api" or "natal" in ente) else 2
    return (fase, pos_final, pid)


def ordenar_portais(portais: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ordena os portais garantindo a prioridade sequencial estrita requerida."""
    return sorted(portais, key=chave_prioridade)


def ordenar_portais_por_fase(portais: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Alias para ordenar_portais."""
    return ordenar_portais(portais)


def validar_csv_valido(caminho_csv: Optional[Path]) -> bool:
    """Verifica se o arquivo CSV existe, tem tamanho mínimo e contém ao menos 1 linha de dados."""
    if not caminho_csv:
        return False
    p = Path(caminho_csv)
    if not p.exists() or p.stat().st_size < 10:
        return False
    try:
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            linhas = [l for l in f if l.strip()]
            return len(linhas) >= 2
    except Exception:
        return False


def extrair_portal(p: Dict[str, Any], raw_dir: Path, competencia: Optional[str] = None) -> Dict[str, Any]:
    ente_nome = p.get("ente", p.get("id", "desconhecido"))
    tipo = p.get("tipo")
    ativo = p.get("ativo", True)

    if not ativo:
        logger.info(f"Ente {ente_nome} desativado. Pulando...")
        return {"status": "ignorado", "ente": ente_nome}

    t0 = time.time()
    try:
        extractor = None
        if tipo == "topsolutions":
            extractor = TopSolutionsExtractor(p, raw_dir)
        elif tipo == "estado_rn":
            extractor = EstadoRNExtractor(p, raw_dir)
        elif tipo == "natal_api":
            extractor = NatalExtractor(p, raw_dir)
        elif tipo == "sga_html":
            extractor = SgaExtractor(p, raw_dir)
        else:
            logger.warning(
                f"[Aviso] Coleta de {ente_nome} falhou ou retornou vazia. "
                "Registrando log de aviso e prosseguindo imediatamente com os dados da próxima secretaria..."
            )
            return {"status": "falha", "ente": ente_nome, "motivo": f"Tipo desconhecido: {tipo}"}

        arquivo_salvo = extractor.extrair(competencia_override=competencia)
        elapsed = round(time.time() - t0, 2)

        # Validação via validar_csv_valido
        arquivo_valido = False
        if arquivo_salvo and Path(arquivo_salvo).exists():
            if hasattr(extractor, "validar_csv_valido"):
                arquivo_valido = extractor.validar_csv_valido(Path(arquivo_salvo))
            else:
                arquivo_valido = validar_csv_valido(Path(arquivo_salvo))

        if arquivo_valido:
            logger.info(f"Coleta de {ente_nome} concluída em {elapsed}s -> {Path(arquivo_salvo).name}")
            return {"status": "sucesso", "ente": ente_nome, "arquivo": str(arquivo_salvo), "duracao_s": elapsed}
        else:
            # Exclui arquivo parcial corrompido ou vazio
            if arquivo_salvo and Path(arquivo_salvo).exists():
                try:
                    Path(arquivo_salvo).unlink(missing_ok=True)
                except Exception:
                    pass

            logger.warning(
                f"[Aviso] Coleta de {ente_nome} falhou ou retornou vazia. "
                "Registrando log de aviso e prosseguindo imediatamente com os dados da próxima secretaria..."
            )
            return {"status": "falha", "ente": ente_nome, "motivo": "Retorno vazio ou arquivo sem dados", "duracao_s": elapsed}

    except Exception as e:
        elapsed = round(time.time() - t0, 2)
        logger.warning(
            f"[Aviso] Coleta de {ente_nome} falhou ou retornou vazia. "
            "Registrando log de aviso e prosseguindo imediatamente com os dados da próxima secretaria..."
        )
        return {"status": "falha", "ente": ente_nome, "motivo": str(e), "duracao_s": elapsed}


def _adicionar_resultado_relatorio(res: Dict[str, Any], relatorio: Dict[str, Any]) -> None:
    st = res.get("status")
    if st == "sucesso":
        relatorio["sucesso"].append({
            "ente": res["ente"],
            "arquivo": res["arquivo"],
            "duracao_s": res.get("duracao_s", 0),
        })
    elif st == "ignorado":
        relatorio["ignorado"].append(res["ente"])
    else:
        relatorio["falha"].append({
            "ente": res["ente"],
            "motivo": res.get("motivo", ""),
            "duracao_s": res.get("duracao_s", 0),
        })


def _executar_lote_portais(
    lote: List[Dict[str, Any]],
    raw_dir: Path,
    competencia: Optional[str],
    max_workers: int,
    relatorio: Dict[str, Any],
) -> None:
    if not lote:
        return

    # Separação por tiers de prioridade sequencial estrita:
    # Tier 1: Ceará-Mirim (SMEB / base local principal)
    # Tier 2: Municípios com sistema Top Solutions / congêneres municipais
    # Tier 3: Natal e Governo do Estado (SEEC-RN) ao final da fila
    tier1 = [p for p in lote if obter_fase_prioridade(p) == 1]
    tier2 = [p for p in lote if obter_fase_prioridade(p) == 2]
    tier3 = [p for p in lote if obter_fase_prioridade(p) == 3]

    nomes_tiers = {
        1: "1º Nível: Ceará-Mirim (SMEB / base local principal)",
        2: "2º Nível: Municípios Top Solutions / congêneres municipais",
        3: "3º Nível: Natal e Governo do Estado (SEEC-RN) ao final da fila"
    }

    for tier_num, sub_lote in [(1, tier1), (2, tier2), (3, tier3)]:
        if not sub_lote:
            continue

        logger.info(f"--- Iniciando captura: {nomes_tiers[tier_num]} ({len(sub_lote)} entes) ---")

        if max_workers <= 1 or len(sub_lote) == 1:
            for p in sub_lote:
                ente_nome = p.get("ente", p.get("id", "desconhecido"))
                try:
                    res = extrair_portal(p, raw_dir, competencia)
                except Exception as unexpected_err:
                    logger.warning(
                        f"[Aviso] Coleta de {ente_nome} falhou ou retornou vazia. "
                        "Registrando log de aviso e prosseguindo imediatamente com os dados da próxima secretaria..."
                    )
                    res = {"status": "falha", "ente": ente_nome, "motivo": str(unexpected_err)}
                _adicionar_resultado_relatorio(res, relatorio)
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="PapiroWorker") as executor:
                future_map = {executor.submit(extrair_portal, p, raw_dir, competencia): p for p in sub_lote}
                for future in concurrent.futures.as_completed(future_map):
                    portal_cfg = future_map[future]
                    try:
                        res = future.result()
                    except Exception as unexpected_err:
                        ente_err = portal_cfg.get("ente", portal_cfg.get("id", "desconhecido"))
                        logger.warning(
                            f"[Aviso] Coleta de {ente_err} falhou ou retornou vazia. "
                            "Registrando log de aviso e prosseguindo imediatamente com os dados da próxima secretaria..."
                        )
                        res = {"status": "falha", "ente": ente_err, "motivo": str(unexpected_err)}
                    _adicionar_resultado_relatorio(res, relatorio)


def executar_ciclo(
    max_workers: Optional[int] = None,
    competencia: Optional[str] = None,
    filtro_ente: Optional[str] = None,
    prosseguir_demais_em_falha: bool = True,
    cfg_override: Optional[Dict[str, Any]] = None,
    raw_dir_override: Optional[Path] = None,
) -> Dict[str, Any]:
    cfg = cfg_override if cfg_override is not None else carregar_config()
    raiz = Path(__file__).resolve().parent.parent
    raw_dir = raw_dir_override if raw_dir_override is not None else (raiz / "data" / "raw")
    raw_dir.mkdir(parents=True, exist_ok=True)

    todos_portais: List[Dict[str, Any]] = list(cfg.get("portais", []))
    todos_portais_ordenados = ordenar_portais(todos_portais)

    portais = todos_portais_ordenados
    if filtro_ente:
        alvo = filtro_ente.strip().lower()
        portais = [p for p in todos_portais_ordenados if alvo in (p.get("ente", "") + " " + p.get("id", "")).lower()]
        if not portais and prosseguir_demais_em_falha:
            logger.warning(
                f"[Aviso] Filtro '{filtro_ente}' não correspondeu a nenhum portal ativo. "
                "Executando todas as secretarias parceiras na ordem definida..."
            )
            portais = todos_portais_ordenados

    if max_workers is None:
        try:
            max_workers = int(os.getenv("PAPIRO_MAX_WORKERS", "4"))
        except ValueError:
            max_workers = 4
    max_workers = max(1, min(max_workers, 8))

    logger.info(
        f"Iniciando ciclo sequencial/ordenado do Papiro de Cadmo ({len(portais)} entes, max_workers={max_workers})..."
    )

    relatorio: Dict[str, Any] = {
        "timestamp_inicio": datetime.now(timezone.utc).isoformat(),
        "max_workers": max_workers,
        "filtro_inicial": filtro_ente or "",
        "fallback_demais_secretarias": False,
        "total_alvo": len(portais),
        "sucesso": [],
        "falha": [],
        "ignorado": [],
    }

    _executar_lote_portais(portais, raw_dir, competencia, max_workers, relatorio)

    # Se havia filtro específico (ex: Natal) e falhou, não para: prossegue imediatamente para as demais secretarias!
    ids_ja_executados = {p.get("id") for p in portais}
    demais_portais = [p for p in todos_portais_ordenados if p.get("id") not in ids_ja_executados and p.get("ativo", True)]

    if filtro_ente and prosseguir_demais_em_falha and len(relatorio["falha"]) > 0 and demais_portais:
        logger.warning(
            f"[Aviso] Houve falha na coleta filtrada ('{filtro_ente}'). "
            f"Em vez de encerrar o workflow, registrando log de aviso e prosseguindo imediatamente "
            f"com a captura das demais {len(demais_portais)} secretarias parceiras..."
        )
        relatorio["fallback_demais_secretarias"] = True
        relatorio["total_alvo"] += len(demais_portais)
        _executar_lote_portais(demais_portais, raw_dir, competencia, max_workers, relatorio)

    relatorio["timestamp_fim"] = datetime.now(timezone.utc).isoformat()
    logger.info("=" * 60)
    logger.info(
        f"RESUMO DO PAPIRO DE CADMO: {len(relatorio['sucesso'])} sucessos, "
        f"{len(relatorio['falha'])} falhas, {len(relatorio['ignorado'])} ignorados."
    )
    logger.info("=" * 60)

    # Salva manifesto em data/raw/manifesto_extracao.json e espelho em data/manifesto_extracao.json
    manifesto_raw_path = raw_dir / "manifesto_extracao.json"
    with open(manifesto_raw_path, "w", encoding="utf-8") as f:
        json.dump(relatorio, f, indent=2, ensure_ascii=False)

    if raw_dir_override is None:
        manifesto_legado_path = raiz / "data" / "manifesto_extracao.json"
        manifesto_legado_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifesto_legado_path, "w", encoding="utf-8") as f:
            json.dump(relatorio, f, indent=2, ensure_ascii=False)

    return relatorio


def main():
    comp = os.getenv("COMPETENCIA_CUSTOM", "").strip() or None
    ente_filtro = os.getenv("FILTRO_ENTE_CUSTOM", "").strip() or None
    executar_ciclo(competencia=comp, filtro_ente=ente_filtro)


if __name__ == "__main__":
    main()
