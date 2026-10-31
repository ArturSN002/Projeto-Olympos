"""
Classe base abstrata para extratores do Papiro de Cadmo.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from dateutil.relativedelta import relativedelta
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class BaseExtractor(ABC):
    def __init__(self, config: Dict[str, Any], output_dir: Path):
        self.config = config
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(f"extractor.{self.config.get('id', 'desconhecido')}")

    def calcular_competencia(self, competencia_override: Optional[str] = None) -> tuple[str, str]:
        """
        Retorna tupla (competencia_br, competencia_iso), ex: ('09/2026', '2026-09')
        """
        if competencia_override:
            partes = competencia_override.strip().split('/')
            if len(partes) == 2:
                mm, aaaa = partes[0].zfill(2), partes[1]
                return f"{mm}/{aaaa}", f"{aaaa}-{mm}"
            partes_iso = competencia_override.strip().split('-')
            if len(partes_iso) == 2:
                aaaa, mm = partes_iso[0], partes_iso[1].zfill(2)
                return f"{mm}/{aaaa}", f"{aaaa}-{mm}"

        # Se houver competência fixa/fallback configurada
        if "competencia_fixa_fallback" in self.config and self.config["competencia_fixa_fallback"]:
            fb = self.config["competencia_fixa_fallback"].strip()
            mm, aaaa = fb.split('/')
            return f"{mm.zfill(2)}/{aaaa}", f"{aaaa}-{mm.zfill(2)}"

        offset = int(self.config.get("competencia_offset_meses", 1))
        dt_ref = datetime.now() - relativedelta(months=offset)
        comp_br = dt_ref.strftime("%m/%Y")
        comp_iso = dt_ref.strftime("%Y-%m")
        return comp_br, comp_iso

    @abstractmethod
    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        """
        Executa a extração do CSV e retorna o Path do arquivo salvo ou None em caso de falha.
        """
        pass
