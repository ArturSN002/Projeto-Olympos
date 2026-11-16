#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Helper script: apply_diario_publications.py
Carrega as 48 publicações reais do Diário Oficial (FEMURN 2026) da migração 015
e prepara lotes SQL com a sintaxe corrigida para índice parcial.
"""

import re
from pathlib import Path

OLYMPOS_DIR = Path(__file__).resolve().parent.parent
MIGRATION_015 = OLYMPOS_DIR / "2_github_pages_actions" / "supabase" / "migrations" / "20261115_015_remediate_all_supabase_advisors.sql"


def get_publications_sql_batches(batch_size=6):
    text = MIGRATION_015.read_text(encoding="utf-8")
    part7 = text.split("PARTE 7: INGESTÃO SSOT DAS 48 PUBLICAÇÕES REAIS DA PLANILHA (FEMURN 2026)")[1]
    inserts = re.findall(r"(INSERT INTO public\.publicacoes_diario[\s\S]*?url_drive\s*=\s*EXCLUDED\.url_drive;)", part7)
    assert len(inserts) == 48, f"Esperadas 48 publicações, encontradas {len(inserts)}"
    
    batches = []
    for i in range(0, len(inserts), batch_size):
        batch = inserts[i:i+batch_size]
        batches.append("\n\n".join(batch))
    return batches


if __name__ == "__main__":
    batches = get_publications_sql_batches(6)
    print(f"Total batches gerados: {len(batches)}")
    for idx, b in enumerate(batches):
        print(f"Lote {idx+1}/{len(batches)}: tamanho {len(b)} caracteres")
