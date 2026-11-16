"""
Módulo de Cruzamento de Vínculos da Transparência & Auditoria Constitucional (CF/88 Art. 37)
O Papiro de Cadmo — Projeto Olympos / SMEB Ceará-Mirim

Cruza a base de referência de servidores de Ceará-Mirim contra dados de portais da transparência
intermunicipais e estaduais (SEEC/RN, Natal, Parnamirim, SGA, Extremoz, Macaíba, etc.).
Regras de junção:
- Nome completo normalizado (sem acentos NFKD, maiúsculo, espaços unificados)
- Miolo do CPF desmascarado (6 dígitos centrais: ###.123.456-## -> 123456)
- Auditoria de acumulação de cargos conforme Art. 37, XVI da CF/88 (limite prudencial de 60h semanais)
"""
import io
import json
import logging
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Union, Any

import pandas as pd

try:
    from pipeline.normalizador import (
        ler_csv_transparencia,
        normalizar_dataframe,
        extrair_miolo_cpf,
        limpar_texto
    )
except ImportError:
    from normalizador import (
        ler_csv_transparencia,
        normalizar_dataframe,
        extrair_miolo_cpf,
        limpar_texto
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.cruzador_vinculos")


def normalizar_nome(nome: Any) -> str:
    """Normaliza o nome completo para junção unívoca: remove acentos NFKD, converte em maiúsculas e remove espaços extras."""
    if not nome or pd.isna(nome):
        return ""
    txt = unicodedata.normalize("NFKD", str(nome).strip())
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", txt).upper()


def parse_carga_horaria(ch: Any) -> int:
    """Extrai o valor numérico inteiro da carga horária semanal (ex: '30h' -> 30, '40 horas' -> 40)."""
    if ch is None or pd.isna(ch):
        return 30
    match = re.search(r"\d+", str(ch))
    if match:
        val = int(match.group())
        return val if val > 0 else 30
    return 30


def is_cargo_docente(cargo: str) -> bool:
    """Verifica se a nomenclatura do cargo refere-se à função docente/magistério."""
    c = normalizar_nome(cargo)
    palavras_docentes = [
        "PROFESSOR", "DOCENTE", "PEDAGOGO", "EDUCADOR",
        "ESPECIALISTA EM EDUCACAO", "COORDENADOR PEDAGOGICO", "MAGISTERIO"
    ]
    return any(p in c for p in palavras_docentes)


def is_cargo_tecnico_cientifico(cargo: str) -> bool:
    """Verifica se o cargo é técnico ou de nível superior/científico."""
    c = normalizar_nome(cargo)
    palavras = [
        "TECNICO", "ANALISTA", "ESPECIALISTA", "ENGENHEIRO", "ARQUITETO",
        "CONTADOR", "AUDITOR", "PROCURADOR", "ADVOGADO", "PSICOLOGO", "ASSISTENTE SOCIAL"
    ]
    return any(p in c for p in palavras) and not is_cargo_docente(cargo)


def is_cargo_saude(cargo: str) -> bool:
    """Verifica se o cargo é privativo da área de saúde com profissão regulamentada."""
    c = normalizar_nome(cargo)
    palavras = ["MEDICO", "ENFERMEIRO", "DENTISTA", "ODONTOLOGO", "FARMACEUTICO", "FISIOTERAPEUTA", "NUTRICIONISTA"]
    return any(p in c for p in palavras)


def auditar_acumulacao_cf37(
    cargo_a: str,
    ch_a: Any,
    cargo_b: str,
    ch_b: Any,
    ente_a: str = "Ceará-Mirim",
    ente_b: str = "Outro Ente"
) -> Dict[str, Any]:
    """
    Realiza a auditoria constitucional da acumulação de cargos segundo o Art. 37, XVI da CF/88.
    Teto prudencial de compatibilidade horária: 60 horas semanais (jurisprudência STF / STJ / TCU).
    """
    ch_num_a = parse_carga_horaria(ch_a)
    ch_num_b = parse_carga_horaria(ch_b)
    ch_total = ch_num_a + ch_num_b

    docente_a = is_cargo_docente(cargo_a)
    docente_b = is_cargo_docente(cargo_b)
    tecnico_a = is_cargo_tecnico_cientifico(cargo_a)
    tecnico_b = is_cargo_tecnico_cientifico(cargo_b)
    saude_a = is_cargo_saude(cargo_a)
    saude_b = is_cargo_saude(cargo_b)

    acumulacao_tipo_permitido = False
    enquadramento = "Não enquadrado nas exceções constitucionais de acumulação remunerada"

    if docente_a and docente_b:
        acumulacao_tipo_permitido = True
        enquadramento = "Art. 37, XVI, 'a' da CF/88 (dois cargos de professor)"
    elif (docente_a and tecnico_b) or (tecnico_a and docente_b):
        acumulacao_tipo_permitido = True
        enquadramento = "Art. 37, XVI, 'b' da CF/88 (um cargo de professor com outro técnico ou científico)"
    elif saude_a and saude_b:
        acumulacao_tipo_permitido = True
        enquadramento = "Art. 37, XVI, 'c' da CF/88 (dois cargos privativos de profissionais de saúde)"

    # Critério de compatibilidade horária: limite prudencial de 60 horas semanais
    if not acumulacao_tipo_permitido:
        acumulacao_legal = False
        parecer_hera = (
            f"Vínculos incompatíveis com as exceções do caput do Art. 37, XVI da CF/88. "
            f"Acumulação entre '{cargo_a}' ({ente_a}) e '{cargo_b}' ({ente_b}) não atende aos requisitos constitucionais."
        )
    elif ch_total > 60:
        acumulacao_legal = False
        parecer_hera = (
            f"Alerta de incompatibilidade horária: a soma das cargas horárias ({ch_num_a}h + {ch_num_b}h = {ch_total}h semanais) "
            f"ultrapassa o teto prudencial de 60 horas semanais fixado pela jurisprudência do TCU/STJ. Necessária adequação de jornada."
        )
    else:
        acumulacao_legal = True
        parecer_hera = (
            f"Acumulação plenamente regular conforme {enquadramento}. "
            f"Carga horária total acumulada de {ch_total}h semanais ({ch_num_a}h em {ente_a} + {ch_num_b}h em {ente_b}) "
            f"dentro do limite constitucional com viabilidade de compatibilização de turnos."
        )

    return {
        "carga_horaria_total": ch_total,
        "acumulacao_legal": acumulacao_legal,
        "enquadramento": enquadramento,
        "parecer_hera": parecer_hera
    }


def sugerir_potencial_permuta(ente_externo: str, lotacao_externa: str, cargo_ceara: str) -> Dict[str, str]:
    """Identifica o polo parceiro metropolitano e estima a otimização logística de permuta."""
    ente_norm = normalizar_nome(ente_externo)
    lot_norm = normalizar_nome(lotacao_externa)

    polo_parceiro = "Polo Natal (Zona Norte - SME)"
    otimizacao = "Redução estimada de 28 km de deslocamento diário com maior proximidade ao segundo vínculo funcional."

    if "EXTREMOZ" in ente_norm or "EXTREMOZ" in lot_norm:
        polo_parceiro = "Polo Extremoz (SME Centro)"
        otimizacao = "Redução estimada de 34 km de trajeto diário intermunicipal (BR-101 / RN-160)."
    elif "SAO GONCALO" in ente_norm or "SGA" in ente_norm or "SAO GONCALO" in lot_norm:
        polo_parceiro = "Polo São Gonçalo do Amarante (SME Centro)"
        otimizacao = "Otimização de 40 km semanais facilitando deslocamento pelo anel viário metropolitano."
    elif "MACAIBA" in ente_norm or "MACAIBA" in lot_norm:
        polo_parceiro = "Polo Macaíba (SME Centro)"
        otimizacao = "Redução estimada de 52 km de tráfego pesado na BR-304/BR-226."
    elif "PARNAMIRIM" in ente_norm or "PARNAMIRIM" in lot_norm:
        polo_parceiro = "Polo Parnamirim (SME Centro)"
        otimizacao = "Redução estimada de 60 km diários conectando polos pelo eixo da BR-101 Sul."
    elif "NATAL" in ente_norm or "SEEC" in ente_norm or "ESTADO DO RIO GRANDE DO NORTE" in ente_norm:
        if "ZONA SUL" in lot_norm or "CENTRO" in lot_norm:
            polo_parceiro = "Polo Natal (Zona Sul / Centro - SME)"
            otimizacao = "Redução de até 35 km por dia útil integrando rota pela Via Costeira / Salgado Filho."
        else:
            polo_parceiro = "Polo Natal (Zona Norte - SME)"
            otimizacao = "Redução estimada de 28 km de deslocamento diário pela Ponte Newton Navarro / Tomaz Landim."

    return {
        "polo_parceiro": polo_parceiro,
        "otimizacao_logistica": otimizacao
    }


def cruzar_vinculos(
    base_ceara: Union[pd.DataFrame, List[Dict[str, Any]]],
    base_externa: Union[pd.DataFrame, List[Dict[str, Any]]],
    apenas_docentes: bool = False
) -> List[Dict[str, Any]]:
    """
    Cruza a base de Ceará-Mirim (âncora cadastral) contra uma base externa ou consolidada:
    1. Junta por nome completo normalizado (sem acentos, maiúsculo).
    2. Se houver miolo de CPF em ambos os lados, valida a correspondência dos 6 dígitos.
    3. Audita a acumulação sob a égide do Art. 37, XVI da CF/88.
    4. Gera parecer analítico da Persona Hera e sugestão logística de permuta.
    """
    # Converte para DataFrame se necessário
    df_ceara = pd.DataFrame(base_ceara) if not isinstance(base_ceara, pd.DataFrame) else base_ceara.copy()
    df_ext = pd.DataFrame(base_externa) if not isinstance(base_externa, pd.DataFrame) else base_externa.copy()

    if df_ceara.empty or df_ext.empty:
        return []

    # Padroniza nomes de colunas esperadas
    def renomear_colunas(df: pd.DataFrame) -> pd.DataFrame:
        m = {}
        for c in df.columns:
            cl = str(c).lower().strip()
            if cl in ["nome", "nome_completo", "servidor", "nome_servidor"]:
                m[c] = "nome_completo"
            elif cl in ["matricula", "matrícula"]:
                m[c] = "matricula"
            elif cl in ["cargo", "cargofuncao", "cargo_funcao"]:
                m[c] = "cargo_funcao"
            elif cl in ["carga_horaria", "cargahoraria", "ch"]:
                m[c] = "carga_horaria"
            elif cl in ["cpf", "cpf mascarado"]:
                m[c] = "cpf"
            elif cl in ["lotacao", "lotacao_orgao", "orgaolotacao"]:
                m[c] = "lotacao_orgao"
            elif cl in ["ente_origem", "ente", "municipio"]:
                m[c] = "ente_origem"
            elif cl in ["situacao_vinculo", "vinculo", "status", "data de inativacaoexoneracao"]:
                m[c] = "situacao_vinculo"
        return df.rename(columns=m)

    df_ceara = renomear_colunas(df_ceara)
    df_ext = renomear_colunas(df_ext)

    # Cria colunas de junção
    df_ceara["_nome_norm"] = df_ceara["nome_completo"].apply(normalizar_nome)
    df_ext["_nome_norm"] = df_ext["nome_completo"].apply(normalizar_nome)

    if "cpf" in df_ceara.columns:
        df_ceara["_cpf_miolo"] = df_ceara["cpf"].apply(extrair_miolo_cpf)
    else:
        df_ceara["_cpf_miolo"] = ""

    if "cpf" in df_ext.columns:
        df_ext["_cpf_miolo"] = df_ext["cpf"].apply(extrair_miolo_cpf)
    else:
        df_ext["_cpf_miolo"] = ""

    # Dicionário da base externa agrupado por nome normalizado
    ext_por_nome: Dict[str, List[Dict[str, Any]]] = {}
    for _, row in df_ext.iterrows():
        nm = row["_nome_norm"]
        if nm:
            ext_por_nome.setdefault(nm, []).append(row.to_dict())

    cruzamentos = []

    for _, row_ceara in df_ceara.iterrows():
        nm = row_ceara["_nome_norm"]
        if not nm or nm not in ext_por_nome:
            continue

        cargo_c = str(row_ceara.get("cargo_funcao", "")).strip()
        if apenas_docentes and not is_cargo_docente(cargo_c):
            continue

        miolo_c = row_ceara.get("_cpf_miolo", "")

        for ext_row in ext_por_nome[nm]:
            # Valida miolo de CPF se ambos possuírem
            miolo_e = ext_row.get("_cpf_miolo", "")
            if miolo_c and miolo_e and miolo_c != miolo_e:
                continue

            cargo_e = str(ext_row.get("cargo_funcao", "")).strip()
            ch_c = row_ceara.get("carga_horaria", "30h")
            ch_e = ext_row.get("carga_horaria", "30h")
            ente_ext = str(ext_row.get("ente_origem", "Outro Ente Público")).strip()
            lot_ext = str(ext_row.get("lotacao_orgao", "")).strip()

            auditoria = auditar_acumulacao_cf37(
                cargo_a=cargo_c,
                ch_a=ch_c,
                cargo_b=cargo_e,
                ch_b=ch_e,
                ente_a="Ceará-Mirim",
                ente_b=ente_ext
            )

            potencial = sugerir_potencial_permuta(ente_ext, lot_ext, cargo_c)

            cruzamentos.append({
                "servidor_referencia": {
                    "municipio": "Ceará-Mirim",
                    "matricula": str(row_ceara.get("matricula", "")).strip(),
                    "nome_completo": str(row_ceara.get("nome_completo", "")).strip(),
                    "cpf_mascarado": str(row_ceara.get("cpf", "")).strip(),
                    "cpf_miolo": miolo_c,
                    "cargo": cargo_c,
                    "escola_origem": str(row_ceara.get("lotacao_orgao", "SMEB Ceará-Mirim")).strip(),
                    "carga_horaria": parse_carga_horaria(ch_c),
                    "status": str(row_ceara.get("situacao_vinculo", "ATIVO")).strip()
                },
                "vinculo_externo_detectado": {
                    "ente_origem": ente_ext,
                    "matricula": str(ext_row.get("matricula", "")).strip(),
                    "cargo": cargo_e,
                    "lotacao_orgao": lot_ext,
                    "carga_horaria": parse_carga_horaria(ch_e),
                    "situacao_vinculo": str(ext_row.get("situacao_vinculo", "ATIVO")).strip()
                },
                "auditoria_constitucional": auditoria,
                "potencial_permuta": potencial
            })

    return cruzamentos


def auditar_acumulacao_interna_ceara(base_ceara: Union[pd.DataFrame, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Audita casos de duplo vínculo funcional ATIVO no próprio município de Ceará-Mirim.
    Identifica servidores com múltiplas matrículas e confere se a acumulação é lícita (CF/88 Art. 37).
    """
    df = pd.DataFrame(base_ceara) if not isinstance(base_ceara, pd.DataFrame) else base_ceara.copy()
    if df.empty:
        return []

    def renomear(df_in):
        m = {}
        for c in df_in.columns:
            cl = str(c).lower().strip()
            if cl in ["nome", "nome_completo", "servidor"]:
                m[c] = "nome_completo"
            elif cl in ["matricula", "matrícula"]:
                m[c] = "matricula"
            elif cl in ["cargo", "cargofuncao", "cargo_funcao"]:
                m[c] = "cargo_funcao"
            elif cl in ["carga_horaria", "cargahoraria", "ch"]:
                m[c] = "carga_horaria"
            elif cl in ["situacao_vinculo", "vinculo", "status", "data de inativacaoexoneracao"]:
                m[c] = "situacao_vinculo"
            elif cl in ["cpf"]:
                m[c] = "cpf"
            elif cl in ["lotacao_orgao", "orgaolotacao"]:
                m[c] = "lotacao_orgao"
        return df_in.rename(columns=m)

    df = renomear(df)
    df["_nome_norm"] = df["nome_completo"].apply(normalizar_nome)

    grupos = {}
    for _, row in df.iterrows():
        # Considera registros ativos
        st = str(row.get("situacao_vinculo", "")).upper()
        if "INATIVO" in st or "EXONERADO" in st:
            continue
        nm = row["_nome_norm"]
        if nm:
            grupos.setdefault(nm, []).append(row.to_dict())

    duplos = []
    for nm, registros in grupos.items():
        if len(registros) >= 2:
            r1 = registros[0]
            r2 = registros[1]
            cargo1 = str(r1.get("cargo_funcao", ""))
            cargo2 = str(r2.get("cargo_funcao", ""))
            ch1 = r1.get("carga_horaria", "30h")
            ch2 = r2.get("carga_horaria", "30h")

            audit = auditar_acumulacao_cf37(
                cargo_a=cargo1,
                ch_a=ch1,
                cargo_b=cargo2,
                ch_b=ch2,
                ente_a="Ceará-Mirim (Vínculo 1)",
                ente_b="Ceará-Mirim (Vínculo 2)"
            )

            duplos.append({
                "nome_completo": r1.get("nome_completo", nm),
                "cpf_mascarado": r1.get("cpf", ""),
                "matricula_1": r1.get("matricula", ""),
                "cargo_1": cargo1,
                "lotacao_1": r1.get("lotacao_orgao", ""),
                "ch_1": parse_carga_horaria(ch1),
                "matricula_2": r2.get("matricula", ""),
                "cargo_2": cargo2,
                "lotacao_2": r2.get("lotacao_orgao", ""),
                "ch_2": parse_carga_horaria(ch2),
                "auditoria_constitucional": audit
            })

    return duplos


def cruzar_arquivos_csv(
    caminho_ceara: Union[str, Path],
    caminho_externo: Union[str, Path],
    caminho_saida_relatorio: Optional[Union[str, Path]] = None,
    apenas_docentes: bool = True
) -> List[Dict[str, Any]]:
    """
    Função utilitária de ponta a ponta:
    Lê o CSV de Ceará-Mirim e o CSV externo, cruza os vínculos e opcionalmente salva o relatório JSON/CSV.
    """
    logger.info(f"Carregando base de Ceará-Mirim: {caminho_ceara}")
    df_ceara_raw = ler_csv_transparencia(caminho_ceara)
    df_ceara = normalizar_dataframe(df_ceara_raw, "Ceará-Mirim", "2026-09", manter_cpf=True)

    logger.info(f"Carregando base externa: {caminho_externo}")
    df_ext_raw = ler_csv_transparencia(caminho_externo)
    df_ext = normalizar_dataframe(df_ext_raw, "Ente Externo", "2026-09", manter_cpf=True)

    logger.info("Executando cruzamento de vínculos e auditoria CF Art. 37...")
    cruzamentos = cruzar_vinculos(df_ceara, df_ext, apenas_docentes=apenas_docentes)
    logger.info(f"Cruzamento concluído: {len(cruzamentos)} vínculos correspondentes localizados.")

    if caminho_saida_relatorio:
        out_p = Path(caminho_saida_relatorio)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        if out_p.suffix.lower() == ".json":
            out_p.write_text(json.dumps(cruzamentos, indent=2, ensure_ascii=False), encoding="utf-8")
        else:
            linhas = []
            for c in cruzamentos:
                sr = c["servidor_referencia"]
                ve = c["vinculo_externo_detectado"]
                ac = c["auditoria_constitucional"]
                linhas.append({
                    "Nome": sr["nome_completo"],
                    "CPF_Miolo": sr["cpf_miolo"],
                    "Matricula_Ceara": sr["matricula"],
                    "Cargo_Ceara": sr["cargo"],
                    "CH_Ceara": sr["carga_horaria"],
                    "Ente_Externo": ve["ente_origem"],
                    "Matricula_Ext": ve["matricula"],
                    "Cargo_Ext": ve["cargo"],
                    "CH_Ext": ve["carga_horaria"],
                    "CH_Total": ac["carga_horaria_total"],
                    "Acumulacao_Legal": "SIM" if ac["acumulacao_legal"] else "NAO",
                    "Enquadramento_CF37": ac["enquadramento"],
                    "Parecer_Hera": ac["parecer_hera"],
                    "Polo_Parceiro_Permuta": c["potencial_permuta"]["polo_parceiro"]
                })
            pd.DataFrame(linhas).to_csv(out_p, index=False, encoding="utf-8-sig")
        logger.info(f"Relatório exportado com sucesso: {out_p}")

    return cruzamentos


if __name__ == "__main__":
    import sys
    if len(sys.argv) >= 3:
        ceara_csv = sys.argv[1]
        ext_csv = sys.argv[2]
        out = sys.argv[3] if len(sys.argv) > 3 else "relatorio_cruzamento_vinculos.csv"
        cruzar_arquivos_csv(ceara_csv, ext_csv, out)
    else:
        print("Uso: python cruzador_vinculos.py <ceara_csv> <externo_csv> [saida_relatorio.csv]")
