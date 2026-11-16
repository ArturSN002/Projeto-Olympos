"""
Módulo de Geração de Catálogos JSON e Resumos de KPIs para o Frontend SPA.
O Papiro de Cadmo — Projeto Olympos / SMEB Ceará-Mirim
"""
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.gerador_json")


def sanitizar_matricula(val: Any) -> str:
    if pd.isna(val) or val is None:
        return ""
    s = str(val).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s


def gerar_catalogos_frontend(csv_path: Optional[Path] = None) -> Dict[str, Any]:
    raiz = Path(__file__).resolve().parent.parent
    processed_dir = raiz / "data" / "processed"

    if csv_path is None:
        arquivos = sorted(processed_dir.glob("servidores-intermunicipais-*.csv"), reverse=True)
        if not arquivos:
            logger.error("Nenhum arquivo CSV consolidado encontrado em data/processed.")
            return {}
        csv_path = arquivos[0]

    logger.info(f"Gerando JSONs de alta performance a partir de {csv_path.name}...")
    df = pd.read_csv(csv_path, dtype=str)
    df = df.fillna("")

    total_acervo = len(df)
    counts_ente = df["ente_origem"].value_counts().to_dict()

    is_estadual = df["ente_origem"].str.contains("Estado|Governo|SEEC", case=False, na=False)
    total_estaduais = int(is_estadual.sum())
    total_municipais = total_acervo - total_estaduais

    # Cálculo de múltiplos vínculos (auditoria constitucional)
    nomes_counts = df["nome_completo"].str.strip().str.upper().value_counts()
    multiplos_nomes = nomes_counts[nomes_counts > 1]
    total_multiplos = len(multiplos_nomes)

    resumo_kpis = {
        "competencia": csv_path.stem.replace("servidores-intermunicipais-", ""),
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
        "total_acervo": total_acervo,
        "total_municipais": total_municipais,
        "total_estaduais": total_estaduais,
        "total_multiplos": total_multiplos,
        "total_entes": len(counts_ente),
        "por_ente": counts_ente
    }

    # Gera registros compactos
    registros = []
    for _, row in df.iterrows():
        registros.append({
            "n": str(row.get("nome_completo", "")).strip().upper(),
            "m": sanitizar_matricula(row.get("matricula", "")),
            "c": str(row.get("cpf", "")).strip() or "###.***.***-##",
            "e": str(row.get("ente_origem", "")).strip(),
            "g": str(row.get("cargo_funcao", "")).strip().upper(),
            "h": str(row.get("carga_horaria", "30h")).strip(),
            "l": str(row.get("lotacao_orgao", "")).strip().upper(),
            "s": str(row.get("situacao_vinculo", "ATIVO")).strip().upper()
        })

    # Destinos de gravação
    destinos_dir = [processed_dir]

    # Diretório da SPA no monorepo Olympos
    spa_dir = raiz.parent.parent / "frontend_spa" / "data"
    if spa_dir.parent.exists():
        spa_dir.mkdir(parents=True, exist_ok=True)
        destinos_dir.append(spa_dir)

    for d in destinos_dir:
        json_kpis_path = d / "resumo_kpis.json"
        with open(json_kpis_path, "w", encoding="utf-8") as f:
            json.dump(resumo_kpis, f, ensure_ascii=False, indent=2)
        logger.info(f"Resumo KPIs salvo em: {json_kpis_path}")

        json_servidores_path = d / "servidores_consolidados.json"
        with open(json_servidores_path, "w", encoding="utf-8") as f:
            json.dump(registros, f, ensure_ascii=False)
        logger.info(f"Base consolidada ({len(registros)} servidores) salva em: {json_servidores_path}")

    return resumo_kpis


if __name__ == "__main__":
    gerar_catalogos_frontend()
