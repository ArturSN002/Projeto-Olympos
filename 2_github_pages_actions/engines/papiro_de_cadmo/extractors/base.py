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

    def obter_data_referencia_inicial(self, competencia_override: Optional[str] = None) -> datetime:
        """Determina a data de referência inicial para o ciclo de extração."""
        if competencia_override:
            partes = competencia_override.strip().split('/')
            if len(partes) == 2:
                return datetime(int(partes[1]), int(partes[0]), 1)
            partes_iso = competencia_override.strip().split('-')
            if len(partes_iso) == 2:
                return datetime(int(partes_iso[0]), int(partes_iso[1]), 1)

        offset = int(self.config.get("competencia_offset_meses", 1))
        return datetime.now() - relativedelta(months=offset)

    def calcular_competencia(self, competencia_override: Optional[str] = None, offset_meses_adicional: int = 0) -> tuple[str, str]:
        """
        Retorna tupla (competencia_br, competencia_iso), ex: ('09/2026', '2026-09'),
        permitindo retroceder N meses adicionais a partir da referência inicial.
        """
        dt_ref = self.obter_data_referencia_inicial(competencia_override) - relativedelta(months=offset_meses_adicional)
        comp_br = dt_ref.strftime("%m/%Y")
        comp_iso = dt_ref.strftime("%Y-%m")
        return comp_br, comp_iso

    def validar_csv_valido(self, caminho_csv: Optional[Path]) -> bool:
        """Verifica se o arquivo CSV retornado existe, não está vazio e tem pelo menos 1 linha de dados."""
        if not caminho_csv:
            return False
        p = Path(caminho_csv)
        if not p.exists() or p.stat().st_size < 10:
            return False
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                linhas = [l for l in f if l.strip()]
                return len(linhas) >= 2  # Pelo menos cabeçalho + 1 linha
        except Exception:
            return False

    def extrair_com_fallback(self, competencia_override: Optional[str] = None, max_retrocesso: int = 24) -> Optional[Path]:
        """
        Executa a extração do CSV com fallback regressivo mensal até encontrar
        a última listagem disponível. Subclasses implementam a lógica de tentativas.
        """
        return self.extrair(competencia_override=competencia_override)

    @abstractmethod
    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        """
        Executa a extração do CSV e retorna o Path do arquivo salvo ou None em caso de falha.
        """
        pass
