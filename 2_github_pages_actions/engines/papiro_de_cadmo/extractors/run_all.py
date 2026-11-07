"""
Orquestrador central concorrente de todos os extratores do Papiro de Cadmo.
Lê config/portais.json e executa a coleta dos 15 municípios + Estado do RN em paralelo via ThreadPoolExecutor.
Garante isolamento por secretaria: a falha em qualquer portal (inclusive quando há filtro_ente)
não interrompe a captura das listas das demais secretarias parceiras.
"""
import concurrent.futures
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional

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
            logger.warning(f"Tipo de extrator '{tipo}' desconhecido para {ente_nome}.")
            return {"status": "falha", "ente": ente_nome, "motivo": f"Tipo desconhecido: {tipo}"}

        arquivo_salvo = extractor.extrair(competencia_override=competencia)
        elapsed = round(time.time() - t0, 2)
        if arquivo_salvo and Path(arquivo_salvo).exists():
            logger.info(f"Coleta de {ente_nome} concluída em {elapsed}s -> {Path(arquivo_salvo).name}")
            return {"status": "sucesso", "ente": ente_nome, "arquivo": str(arquivo_salvo), "duracao_s": elapsed}
        else:
            logger.warning(
                f"[Continuidade] Falha em {ente_nome} ({elapsed}s): Arquivo não gerado. Prosseguindo com as demais secretarias..."
            )
            return {"status": "falha", "ente": ente_nome, "motivo": "Arquivo não gerado", "duracao_s": elapsed}
    except Exception as e:
        elapsed = round(time.time() - t0, 2)
        logger.error(
            f"[Continuidade] Exceção ao coletar {ente_nome} ({elapsed}s): {e}. Prosseguindo com as demais secretarias..."
        )
        return {"status": "falha", "ente": ente_nome, "motivo": str(e), "duracao_s": elapsed}


def _executar_lote_portais(
    lote: List[Dict[str, Any]],
    raw_dir: Path,
    competencia: Optional[str],
    max_workers: int,
    relatorio: Dict[str, Any],
) -> None:
    if not lote:
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="PapiroWorker") as executor:
        future_map = {executor.submit(extrair_portal, p, raw_dir, competencia): p for p in lote}
        for future in concurrent.futures.as_completed(future_map):
            portal_cfg = future_map[future]
            try:
                res = future.result()
            except Exception as unexpected_err:
                ente_err = portal_cfg.get("ente", portal_cfg.get("id", "desconhecido"))
                logger.error(f"Erro inesperado na thread de {ente_err}: {unexpected_err}")
                res = {"status": "falha", "ente": ente_err, "motivo": str(unexpected_err)}

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
                })


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
    portais = todos_portais
    if filtro_ente:
        alvo = filtro_ente.strip().lower()
        portais = [p for p in todos_portais if alvo in (p.get("ente", "") + " " + p.get("id", "")).lower()]
        if not portais and prosseguir_demais_em_falha:
            logger.warning(
                f"[Resiliência Intermunicipal] Filtro '{filtro_ente}' não correspondeu a nenhum portal. Executando todas as secretarias ativas..."
            )
            portais = todos_portais

    if max_workers is None:
        try:
            max_workers = int(os.getenv("PAPIRO_MAX_WORKERS", "4"))
        except ValueError:
            max_workers = 4
    max_workers = max(1, min(max_workers, 8))

    logger.info(f"Iniciando ciclo paralelo do Papiro de Cadmo ({len(portais)} entes, {max_workers} workers)...")

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

    # Se havia filtro específico (ex: Natal) e falhou, não para: prossegue automaticamente para as demais secretarias!
    ids_ja_executados = {p.get("id") for p in portais}
    demais_portais = [p for p in todos_portais if p.get("id") not in ids_ja_executados and p.get("ativo", True)]

    if filtro_ente and prosseguir_demais_em_falha and len(relatorio["falha"]) > 0 and demais_portais:
        logger.warning(
            f"[Resiliência Intermunicipal] Houve falha na coleta filtrada ('{filtro_ente}'). "
            f"Em vez de interromper o ciclo, prosseguindo automaticamente para buscar as listas das demais {len(demais_portais)} secretarias parceiras..."
        )
        relatorio["fallback_demais_secretarias"] = True
        relatorio["total_alvo"] += len(demais_portais)
        _executar_lote_portais(demais_portais, raw_dir, competencia, max_workers, relatorio)

    relatorio["timestamp_fim"] = datetime.now(timezone.utc).isoformat()
    logger.info("=" * 60)
    logger.info(
        f"RESUMO PARALELO DO PAPIRO DE CADMO: {len(relatorio['sucesso'])} sucessos, "
        f"{len(relatorio['falha'])} falhas, {len(relatorio['ignorado'])} ignorados."
    )
    logger.info("=" * 60)

    # Salva manifesto em data/raw/manifesto_extracao.json e espelho em data/manifesto_extracao.json (quando em modo padrão)
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
