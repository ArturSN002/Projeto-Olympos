"""
Pipeline de Normalização e Sanitização de Esquemas - O Papiro de Cadmo.
Consolida os dados brutos de múltiplos entes no esquema padronizado:
ente_origem | competencia | matricula | nome_completo | cargo_funcao | carga_horaria | lotacao_orgao | situacao_vinculo
"""
import glob
import io
import logging
import os
import re
import unicodedata
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
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
    "cargofuncao": "cargo_funcao",
    "cargo_funcao": "cargo_funcao",
    "cargo funcao": "cargo_funcao",
    "cargo_efetivo": "cargo_funcao",
    "cargo/função": "cargo_funcao",
    "lotacao": "lotacao_orgao",
    "lotação": "lotacao_orgao",
    "secretaria": "lotacao_orgao",
    "orgao": "lotacao_orgao",
    "orgaolotacao": "lotacao_orgao",
    "orgao_lotacao": "lotacao_orgao",
    "orgao/lotacao": "lotacao_orgao",
    "órgão/lotação": "lotacao_orgao",
    "unidade": "lotacao_orgao",
    "carga_horaria": "carga_horaria",
    "carga horaria": "carga_horaria",
    "cargahoraria": "carga_horaria",
    "ch": "carga_horaria",
    "jornada": "carga_horaria",
    "situacao": "situacao_vinculo",
    "situação": "situacao_vinculo",
    "vinculo": "situacao_vinculo",
    "vínculo": "situacao_vinculo",
    "data de inativacaoexoneracao": "situacao_vinculo",
    "status": "situacao_vinculo",
    "cpf": "cpf",
    "cpf mascarado": "cpf"
}

MAPA_NOMES_ENTES = {
    "ceara_mirim": "Ceará-Mirim",
    "cearamirim": "Ceará-Mirim",
    "parnamirim": "Parnamirim",
    "sga": "São Gonçalo do Amarante",
    "macaiba": "Macaíba",
    "extremoz": "Extremoz",
    "nisia_floresta": "Nísia Floresta",
    "monte_alegre": "Monte Alegre",
    "ielmo_marinho": "Ielmo Marinho",
    "sao_paulo_potengi": "São Paulo do Potengi",
    "joao_camara": "João Câmara",
    "poco_branco": "Poço Branco",
    "taipu": "Taipú",
    "touros": "Touros",
    "rio_do_fogo": "Rio do Fogo",
    "natal": "Natal",
    "estado_rn": "Governo do Estado do Rio Grande do Norte",
}


def extrair_ente_e_competencia(nome_stem: str, competencia_padrao: str = "") -> Tuple[str, str]:
    r"""
    Extrai o ente_id e a competência (formato YYYY-MM) do stem do arquivo de forma resiliente.
    Suporta nomes de entes com múltiplos underscores (ex: 'ceara_mirim_2026-10', 'sao_paulo_potengi_2026-10').
    Usa regex r"\d{4}-\d{2}" para garantir que a competência seja estritamente ano-mês e nunca 'mirim'.
    """
    match = re.search(r"\d{4}-\d{2}", nome_stem)
    if match:
        comp = match.group(0)
        prefixo = nome_stem[:match.start()].rstrip("_-")
        ente_id = prefixo if prefixo else nome_stem
    else:
        comp = competencia_padrao or datetime.now().strftime("%Y-%m")
        ente_id = nome_stem

    # Garante que a competência seja estritamente no formato YYYY-MM e nunca 'mirim'
    if not re.match(r"^\d{4}-\d{2}$", str(comp).strip()):
        if competencia_padrao and re.match(r"^\d{4}-\d{2}$", str(competencia_padrao).strip()):
            comp = competencia_padrao
        else:
            comp = datetime.now().strftime("%Y-%m")

    return ente_id, comp


def limpar_texto(val):
    if pd.isna(val):
        return ""
    return str(val).strip().replace("\n", " ").replace("\r", "")


def extrair_miolo_cpf(cpf: str) -> str:
    """Extrai os 6 dígitos centrais de um CPF (mascarado ou completo) para auditoria e cruzamento."""
    if not cpf or pd.isna(cpf):
        return ""
    digits = re.sub(r"\D", "", str(cpf))
    if len(digits) == 6:
        return digits
    if len(digits) == 11:
        return digits[3:9]
    return digits[:6] if len(digits) >= 6 else digits


def ler_csv_transparencia(caminho_ou_buffer, seps=(";", ",", "\t"), encs=("utf-8-sig", "utf-8", "latin1", "cp1252")) -> pd.DataFrame:
    """
    Lê arquivos CSV de portais de transparência de forma resiliente:
    - Identifica e salta linhas de título e metadados no início do arquivo (como no TopSolutions Ceará-Mirim).
    - Detecta automaticamente o delimitador e a codificação de caracteres.
    - Remove espaços à esquerda e à direita dos nomes de colunas.
    """
    raw_bytes = None
    if isinstance(caminho_ou_buffer, (str, Path)):
        p = Path(caminho_ou_buffer)
        if not p.exists():
            raise FileNotFoundError(f"Arquivo CSV não encontrado: {p}")
        raw_bytes = p.read_bytes()
    elif hasattr(caminho_ou_buffer, "read"):
        content = caminho_ou_buffer.read()
        raw_bytes = content if isinstance(content, bytes) else content.encode("utf-8")
    else:
        raise ValueError("caminho_ou_buffer deve ser caminho (str/Path) ou objeto arquivo.")

    melhor_df = None

    for enc in encs:
        try:
            texto = raw_bytes.decode(enc)
            linhas = texto.splitlines()
            if not linhas:
                continue

            # Detecta a linha do cabeçalho procurando palavras-chave
            header_idx = 0
            separador_escolhido = ";"
            encontrou = False

            for idx, linha in enumerate(linhas[:15]):
                linha_norm = unicodedata.normalize("NFKD", linha).lower()
                if any(k in linha_norm for k in ["matricula", "nome", "cpf", "cargo", "servidor"]):
                    for s in seps:
                        if s in linha and len(linha.split(s)) >= 3:
                            header_idx = idx
                            separador_escolhido = s
                            encontrou = True
                            break
                    if encontrou:
                        break

            # Carrega o DataFrame a partir da linha de cabeçalho detectada
            df = pd.read_csv(
                io.StringIO(texto),
                skiprows=header_idx,
                sep=separador_escolhido,
                dtype=str
            )
            # Remove espaços nos cabeçalhos de coluna
            df.columns = [str(c).strip() for c in df.columns]

            if len(df.columns) >= 2:
                melhor_df = df
                break
        except Exception:
            continue

    if melhor_df is None:
        raise ValueError("Não foi possível decodificar ou estruturar o arquivo CSV de transparência.")

    return melhor_df


def normalizar_dataframe(df: pd.DataFrame, ente_default: str, comp_default: str, manter_cpf: bool = False) -> pd.DataFrame:
    """
    Normaliza os dados de servidores para o esquema canônico de 8 colunas.
    Se manter_cpf=True, inclui também as colunas 'cpf' e 'cpf_miolo' se disponíveis.
    """
    # 1. Normalizar nomes de colunas sem colisões duplicadas
    col_map = {}
    dest_seen = set()
    for c in df.columns:
        c_clean = str(c).lower().strip()
        if c_clean in MAPA_SINONIMOS:
            target = MAPA_SINONIMOS[c_clean]
            if target not in dest_seen:
                col_map[c] = target
                dest_seen.add(target)

    df_ren = df.rename(columns=col_map)
    df_ren = df_ren.loc[:, ~df_ren.columns.duplicated()]

    # 2. Assegurar colunas essenciais
    comp_default_limpo = str(comp_default).strip() if comp_default else ""
    m_comp = re.search(r"\d{4}-\d{2}", comp_default_limpo)
    comp_padrao_valida = m_comp.group(0) if m_comp else datetime.now().strftime("%Y-%m")

    for col in COLUNAS_PADRAO:
        if col not in df_ren.columns:
            if col == "ente_origem":
                df_ren[col] = ente_default
            elif col == "competencia":
                df_ren[col] = comp_padrao_valida
            elif col == "carga_horaria":
                df_ren[col] = "30h"
            elif col == "situacao_vinculo":
                df_ren[col] = "ATIVO"
            else:
                df_ren[col] = ""

    # Sanitização defensiva da coluna competencia: nunca pode ser 'mirim' ou formato inválido
    def _sanitizar_competencia(val):
        s = str(val).strip() if pd.notna(val) else ""
        m = re.search(r"\d{4}-\d{2}", s)
        return m.group(0) if m else comp_padrao_valida

    df_ren["competencia"] = df_ren["competencia"].apply(_sanitizar_competencia)

    # 3. Formatação
    df_ren["nome_completo"] = df_ren["nome_completo"].apply(limpar_texto).str.upper()
    df_ren["matricula"] = df_ren["matricula"].apply(limpar_texto)
    df_ren["cargo_funcao"] = df_ren["cargo_funcao"].apply(limpar_texto).str.upper()
    df_ren["lotacao_orgao"] = df_ren["lotacao_orgao"].apply(limpar_texto).str.upper()
    df_ren["carga_horaria"] = df_ren["carga_horaria"].apply(limpar_texto)
    df_ren["situacao_vinculo"] = df_ren["situacao_vinculo"].apply(limpar_texto).str.upper()

    # Filtra linhas com nome vazio
    df_ren = df_ren[df_ren["nome_completo"] != ""]

    if manter_cpf and "cpf" in df_ren.columns:
        df_ren["cpf"] = df_ren["cpf"].apply(limpar_texto)
        df_ren["cpf_miolo"] = df_ren["cpf"].apply(extrair_miolo_cpf)
        colunas_retorno = COLUNAS_PADRAO + ["cpf", "cpf_miolo"]
        return df_ren[colunas_retorno]

    return df_ren[COLUNAS_PADRAO]


def processar_todos(competencia_override: Optional[str] = None):
    raiz = Path(__file__).resolve().parent.parent
    raw_dir = raiz / "data" / "raw"
    processed_dir = raiz / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    arquivos = sorted(raw_dir.glob("*.csv"))
    if not arquivos:
        logger.warning("Nenhum arquivo CSV encontrado em data/raw para normalização.")
        return None

    competencia_padrao = competencia_override or datetime.now().strftime("%Y-%m")
    dfs_consolidados = []

    for arq in arquivos:
        nome_stem = arq.stem
        ente_id, comp = extrair_ente_e_competencia(nome_stem, competencia_padrao)

        # Mapeia para o nome canônico do ente
        ente_canonico = MAPA_NOMES_ENTES.get(ente_id.lower(), ente_id.replace("_", " ").title())

        logger.info(f"Normalizando dados de {arq.name} ({ente_canonico} - {comp})...")
        try:
            df = ler_csv_transparencia(arq)
            if df is not None and len(df) > 0:
                df_norm = normalizar_dataframe(df, ente_canonico, comp)
                dfs_consolidados.append(df_norm)
                logger.info(f"Arquivo {arq.name} normalizado: {len(df_norm)} servidores adicionados.")
        except Exception as e:
            logger.error(f"Erro ao processar {arq.name}: {e}")

    if dfs_consolidados:
        df_final = pd.concat(dfs_consolidados, ignore_index=True)
        # Deduplica registros idênticos por ente + matrícula + nome
        df_final = df_final.drop_duplicates(subset=["ente_origem", "matricula", "nome_completo"])
        df_final = df_final.sort_values(by=["ente_origem", "nome_completo"])

        nome_saida = f"servidores-intermunicipais-{competencia_padrao}.csv"
        caminho_saida = processed_dir / nome_saida
        df_final.to_csv(caminho_saida, index=False, encoding="utf-8-sig")

        logger.info("=" * 60)
        logger.info(f"CONSOLIDAÇÃO FINALIZADA COM SUCESSO: {len(df_final)} servidores salvos em {caminho_saida}")
        logger.info("=" * 60)

        try:
            try:
                from .gerar_json_frontend import gerar_catalogos_frontend
            except (ImportError, ValueError):
                from gerar_json_frontend import gerar_catalogos_frontend
            gerar_catalogos_frontend(caminho_saida)
        except Exception as e_json:
            logger.warning(f"Falha não-bloqueante ao gerar catálogos JSON do frontend: {e_json}")

        return caminho_saida

    return None


if __name__ == "__main__":
    processar_todos()
