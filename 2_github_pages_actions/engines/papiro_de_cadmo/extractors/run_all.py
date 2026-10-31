"""
Orquestrador central de todos os extratores do Papiro de Cadmo.
Lê config/portais.json e executa a coleta dos 15 municípios + Estado do RN.
"""
import json
import logging
from pathlib import Path
import sys
from typing import Dict, Any

from .topsolutions import TopSolutionsExtractor
from .estado_rn import EstadoRNExtractor
from .natal import NatalExtractor
from .sga import SgaExtractor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.orchestrator")


def carregar_config() -> Dict[str, Any]:
    raiz = Path(__file__).resolve().parent.parent
    caminho_cfg = raiz / "config" / "portais.json"
    with open(caminho_cfg, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    cfg = carregar_config()
    raiz = Path(__file__).resolve().parent.parent
    raw_dir = raiz / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    portais = cfg.get("portais", [])
    logger.info(f"Iniciando ciclo de extração do Papiro de Cadmo para {len(portais)} entes federativos...")

    relatorio = {"sucesso": [], "falha": [], "ignorado": []}

    for p in portais:
        ente_id = p.get("id")
        ente_nome = p.get("ente")
        tipo = p.get("tipo")
        ativo = p.get("ativo", True)

        if not ativo:
            logger.info(f"Ente {ente_nome} desativado. Pulando...")
            relatorio["ignorado"].append(ente_nome)
            continue

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
                relatorio["falha"].append(ente_nome)
                continue

            arquivo_salvo = extractor.extrair()
            if arquivo_salvo and arquivo_salvo.exists():
                relatorio["sucesso"].append({"ente": ente_nome, "arquivo": str(arquivo_salvo)})
            else:
                relatorio["falha"].append(ente_nome)

        except Exception as e:
            logger.error(f"Exceção não tratada ao coletar {ente_nome}: {e}")
            relatorio["falha"].append(ente_nome)

    logger.info("=" * 60)
    logger.info(f"RESUMO DO PAPIRO DE CADMO: {len(relatorio['sucesso'])} sucessos, {len(relatorio['falha'])} falhas, {len(relatorio['ignorado'])} ignorados.")
    logger.info("=" * 60)

    # Salva manifesto do ciclo
    manifesto_path = raiz / "data" / "manifesto_extracao.json"
    manifesto_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifesto_path, "w", encoding="utf-8") as f:
        json.dump(relatorio, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
