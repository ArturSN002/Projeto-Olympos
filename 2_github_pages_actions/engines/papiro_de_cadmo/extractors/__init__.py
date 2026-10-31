"""
O Papiro de Cadmo - Módulo Extrator de Portais de Transparência
"""
from .base import BaseExtractor
from .topsolutions import TopSolutionsExtractor
from .estado_rn import EstadoRNExtractor
from .natal import NatalExtractor
from .sga import SgaExtractor

__all__ = [
    "BaseExtractor",
    "TopSolutionsExtractor",
    "EstadoRNExtractor",
    "NatalExtractor",
    "SgaExtractor"
]
