"""
Pipeline de Normalização e Sanitização de Esquemas - O Papiro de Cadmo.
Consolida os dados brutos de múltiplos entes no esquema padronizado:
ente_origem | competencia | matricula | nome_completo | cargo_funcao | carga_horaria | lotacao_orgao | situacao_vinculo
"""
import glob
import logging
from pathlib import Path
from datetime import datetime
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.normalizador")

COLUNAS_PADRAO = [
    "ente_origem",
    "competencia",
    "matricula",
    "nome_completo",
    "cargo_funcao",
    "carga_horaria",
    "lotacao_orgao",
    "situacao_vinculo"
]

MAPA_SINONIMOS = {
    "nome": "nome_completo",
    "servidor": "nome_completo",
    "nome_servidor": "nome_completo",
    "nome do servidor": "nome_completo",
    "nm_servidor": "nome_completo",
    "matricula": "matricula",
    "matrícula": "matricula",
    "num_matricula": "matricula",
    "nu_matricula": "matricula",
    "cargo": "cargo_funcao",
    "funcao": "cargo_funcao",
    "função": "cargo_funcao",
    "cargo_efetivo": "cargo_funcao",
    "cargo/função": "cargo_funcao",
    "lotacao": "lotacao_orgao",
    "lotação": "lotacao_orgao",
    "secretaria": "lotacao_orgao",
    "orgao": "lotacao_orgao",
    "unidade": "lotacao_orgao",
    "carga_horaria": "carga_horaria",
    "carga horaria": "carga_horaria",
    "ch": "carga_horaria",
    "jornada": "carga_horaria",
    "situacao": "situacao_vinculo",
    "situação": "situacao_vinculo",
    "vinculo": "situacao_vinculo",
    "vínculo": "situacao_vinculo"
}


def limpar_texto(val):
    if pd.isna(val):
        return ""
    return str(val).strip().replace("\n", " ").replace("\r", "")


def normalizar_dataframe(df: pd.DataFrame, ente_default: str, comp_default: str) -> pd.DataFrame:
    # 1. Normalizar nomes de colunas
    col_map = {}
    for c in df.columns:
        c_clean = str(c).lower().strip()
        if c_clean in MAPA_SINONIMOS:
            col_map[c] = MAPA_SINONIMOS[c_clean]

    df_ren = df.rename(columns=col_map)

    # 2. Assegurar colunas essenciais
    for col in COLUNAS_PADRAO:
        if col not in df_ren.columns:
            if col == "ente_origem":
                df_ren[col] = ente_default
            elif col == "competencia":
                df_ren[col] = comp_default
            elif col == "carga_horaria":
                df_ren[col] = "30h"
            elif col == "situacao_vinculo":
                df_ren[col] = "ATIVO"
            else:
                df_ren[col] = ""

    # 3. Formatação
    df_ren["nome_completo"] = df_ren["nome_completo"].apply(limpar_texto).str.upper()
    df_ren["matricula"] = df_ren["matricula"].apply(limpar_texto)
    df_ren["cargo_funcao"] = df_ren["cargo_funcao"].apply(limpar_texto).str.upper()
    df_ren["lotacao_orgao"] = df_ren["lotacao_orgao"].apply(limpar_texto).str.upper()
    df_ren["carga_horaria"] = df_ren["carga_horaria"].apply(limpar_texto)
    df_ren["situacao_vinculo"] = df_ren["situacao_vinculo"].apply(limpar_texto).str.upper()

    # Filtra linhas com nome vazio
    df_ren = df_ren[df_ren["nome_completo"] != ""]
    return df_ren[COLUNAS_PADRAO]


def processar_todos():
    raiz = Path(__file__).resolve().parent.parent
    raw_dir = raiz / "data" / "raw"
    processed_dir = raiz / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    arquivos = list(raw_dir.glob("*.csv"))
    if not arquivos:
        logger.warning("Nenhum arquivo CSV encontrado em data/raw para normalização.")
        return None

    competencia_padrao = datetime.now().strftime("%Y-%m")
    dfs_consolidados = []

    for arq in arquivos:
        nome_stem = arq.stem
        partes = nome_stem.split("_")
        ente_id = partes[0]
        comp = partes[1] if len(partes) > 1 else competencia_padrao

        logger.info(f"Normalizando dados de {arq.name} ({ente_id})...")
        try:
            # Tenta ler com diferentes encodings e separadores
            df = None
            for sep in [";", ",", "\t"]:
                for enc in ["utf-8-sig", "latin1", "cp1252"]:
                    try:
                        df_temp = pd.read_csv(arq, sep=sep, encoding=enc, dtype=str)
                        if len(df_temp.columns) > 1:
                            df = df_temp
                            break
                    except Exception:
                        continue
                if df is not None:
                    break

            if df is not None and len(df) > 0:
                df_norm = normalizar_dataframe(df, ente_id.replace("_", " ").title(), comp)
                dfs_consolidados.append(df_norm)
                logger.info(f"Arquivo {arq.name} normalizado: {len(df_norm)} servidores adicionados.")
        except Exception as e:
            logger.error(f"Erro ao processar {arq.name}: {e}")

    if dfs_consolidados:
        df_final = pd.concat(dfs_consolidados, ignore_errors=True)
        # Deduplica registros idênticos por ente + matrícula + nome
        df_final.drop_duplicates(subset=["ente_origem", "matricula", "nome_completo"], inplace=True)
        df_final.sort_values(by=["ente_origem", "nome_completo"], inplace=True)

        nome_saida = f"servidores-intermunicipais-{competencia_padrao}.csv"
        caminho_saida = processed_dir / nome_saida
        df_final.to_csv(caminho_saida, index=False, encoding="utf-8-sig")

        logger.info("=" * 60)
        logger.info(f"CONSOLIDAÇÃO FINALIZADA COM SUCESSO: {len(df_final)} servidores salvos em {caminho_saida}")
        logger.info("=" * 60)
        return caminho_saida

    return None


if __name__ == "__main__":
    processar_todos()
