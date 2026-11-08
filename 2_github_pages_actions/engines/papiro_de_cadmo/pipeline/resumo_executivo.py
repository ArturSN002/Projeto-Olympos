"""
Módulo de Geração e Publicação do Resumo Executivo - O Papiro de Cadmo.
Consolida as métricas do ciclo ETL mensal de servidores intermunicipais:
- Estatísticas de extração por ente governamental (15 municípios + Estado do RN)
- Quantitativo de servidores coletados e competência de referência
- Cruzamentos de vínculos com Ceará-Mirim e auditoria constitucional (Art. 37, XVI da CF/88)
- Status de persistência no Google Drive (1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD) e Supabase (public.folha_intermunicipal)
- Gravação direta em $GITHUB_STEP_SUMMARY e data/processed/RESUMO_EXECUTIVO.md

Versão 2.0.0 — Projeto Olympos / SMEB Ceará-Mirim
"""
from datetime import datetime, timezone
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

# Garante que a raiz do papiro_de_cadmo e da pipeline estejam em sys.path
_raiz_cadmo = Path(__file__).resolve().parent.parent
if str(_raiz_cadmo) not in sys.path:
    sys.path.insert(0, str(_raiz_cadmo))
_pipeline_dir = Path(__file__).resolve().parent
if str(_pipeline_dir) not in sys.path:
    sys.path.insert(0, str(_pipeline_dir))

import pandas as pd

try:
    from pipeline.cruzador_vinculos import (
        auditar_acumulacao_cf37,
        cruzar_vinculos,
        normalizar_nome
    )
    from pipeline.normalizador import ler_csv_transparencia, normalizar_dataframe
except ImportError:
    try:
        from .cruzador_vinculos import (
            auditar_acumulacao_cf37,
            cruzar_vinculos,
            normalizar_nome
        )
        from .normalizador import ler_csv_transparencia, normalizar_dataframe
    except ImportError:
        from cruzador_vinculos import (
            auditar_acumulacao_cf37,
            cruzar_vinculos,
            normalizar_nome
        )
        from normalizador import ler_csv_transparencia, normalizar_dataframe

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("papiro.resumo_executivo")

PASTA_DRIVE_OFICIAL_ID = "1dcc_5GcNG0ciVE-i1J6iwtojATk-1utD"
TABELA_SUPABASE_OFICIAL = "public.folha_intermunicipal"


def carregar_config_portais(raiz: Path) -> List[Dict[str, Any]]:
    """Carrega o catálogo de 16 portais a partir de config/portais.json."""
    caminho_cfg = raiz / "config" / "portais.json"
    if caminho_cfg.exists():
        try:
            with open(caminho_cfg, "r", encoding="utf-8") as f:
                dados = json.load(f)
                return dados.get("portais", [])
        except Exception as e:
            logger.warning(f"Falha ao carregar {caminho_cfg}: {e}")
    return []


def carregar_manifesto(raiz: Path) -> Dict[str, Any]:
    """Lê data/raw/manifesto_extracao.json ou data/manifesto_extracao.json."""
    caminhos = [
        raiz / "data" / "raw" / "manifesto_extracao.json",
        raiz / "data" / "manifesto_extracao.json"
    ]
    for c in caminhos:
        if c.exists():
            try:
                with open(c, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Erro ao ler manifesto {c}: {e}")
    return {"sucesso": [], "falha": [], "ignorado": []}


def carregar_base_processada(raiz: Path) -> Tuple[Optional[pd.DataFrame], Optional[Path]]:
    """Localiza e lê o arquivo CSV consolidado mais recente em data/processed/."""
    processed_dir = raiz / "data" / "processed"
    if not processed_dir.exists():
        return None, None

    arquivos = sorted(processed_dir.glob("servidores-intermunicipais-*.csv"), reverse=True)
    if not arquivos:
        return None, None

    csv_alvo = arquivos[0]
    try:
        df = pd.read_csv(csv_alvo, dtype=str)
        df.fillna("", inplace=True)
        return df, csv_alvo
    except Exception as e:
        logger.error(f"Erro ao carregar base consolidada {csv_alvo}: {e}")
        return None, csv_alvo


def obter_status_persistencia(raiz: Path) -> Dict[str, Any]:
    """Avalia o status de persistência do Supabase e do Google Drive."""
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    gcp_sa_key = os.environ.get("GCP_SA_KEY", "").strip()
    drive_folder_id = os.environ.get("DRIVE_FOLDER_ID", PASTA_DRIVE_OFICIAL_ID).strip()

    status_sb_json = raiz / "data" / "processed" / "status_supabase.json"
    sb_detalhes = None
    if status_sb_json.exists():
        try:
            with open(status_sb_json, "r", encoding="utf-8") as f:
                sb_detalhes = json.load(f)
        except Exception:
            pass

    # Status Supabase
    if supabase_url and supabase_key:
        if sb_detalhes and sb_detalhes.get("sucesso"):
            enviados = sb_detalhes.get("enviados", 0)
            status_supabase = f"🟢 Ativo ({enviados:,} tuplas persistidas)"
            status_supabase_badge = "🟢 Sincronizado"
        else:
            status_supabase = f"🟢 Configurado ({TABELA_SUPABASE_OFICIAL})"
            status_supabase_badge = "🟢 Conectado"
    else:
        status_supabase = "🟡 Pendente de credenciais (SUPABASE_URL / KEY)"
        status_supabase_badge = "🟡 Aguardando Secrets"

    # Status Google Drive
    if gcp_sa_key:
        status_drive = f"🟢 Ativo (Pasta: {drive_folder_id})"
        status_drive_badge = "🟢 Sincronizado"
    else:
        status_drive = f"🟡 Pendente de GCP_SA_KEY (Pasta: {drive_folder_id})"
        status_drive_badge = "🟡 Aguardando SA Key"

    return {
        "status_supabase": status_supabase,
        "status_supabase_badge": status_supabase_badge,
        "status_drive": status_drive,
        "status_drive_badge": status_drive_badge,
        "drive_folder_id": drive_folder_id,
        "tabela_supabase": TABELA_SUPABASE_OFICIAL
    }


def executar_auditoria_cruzamento(
    df: Optional[pd.DataFrame],
    raiz: Path
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """
    Executa o cruzamento de vínculos comparando os servidores de Ceará-Mirim contra
    os demais entes parceiros, computando as estatísticas constitucionais (Art. 37, XVI).
    """
    if df is None or df.empty:
        return [], {}

    # Identifica Ceará-Mirim como âncora
    mask_ceara = df["ente_origem"].astype(str).str.contains(
        r"Ceará-Mirim|Ceara-Mirim|ceara_mirim|cearamirim",
        case=False,
        na=False
    )
    df_ceara = df[mask_ceara].copy()
    df_externo = df[~mask_ceara].copy()

    # Se a base processada não continha Ceará-Mirim, tenta buscar nos arquivos raw
    if df_ceara.empty:
        raw_ceara = list((raiz / "data" / "raw").glob("ceara_mirim_*.csv"))
        if raw_ceara:
            try:
                raw_df = ler_csv_transparencia(raw_ceara[0])
                if raw_df is not None and not raw_df.empty:
                    df_ceara = normalizar_dataframe(raw_df, "Ceará-Mirim", "2026-10", manter_cpf=True)
            except Exception as e:
                logger.warning(f"Falha ao ler raw de Ceará-Mirim: {e}")

    if df_ceara.empty or df_externo.empty:
        return [], {}

    cruzamentos = cruzar_vinculos(df_ceara, df_externo, apenas_docentes=False)

    cruzamentos_por_ente: Dict[str, int] = {}
    for c in cruzamentos:
        ente_ext = c.get("vinculo_externo_detectado", {}).get("ente_origem", "Outro Ente")
        cruzamentos_por_ente[ente_ext] = cruzamentos_por_ente.get(ente_ext, 0) + 1

    return cruzamentos, cruzamentos_por_ente


def gerar_markdown_resumo(
    portais_cfg: List[Dict[str, Any]],
    manifesto: Dict[str, Any],
    df_processado: Optional[pd.DataFrame],
    caminho_csv: Optional[Path],
    persistencia: Dict[str, Any],
    cruzamentos: List[Dict[str, Any]],
    cruzamentos_por_ente: Dict[str, int]
) -> str:
    """Monta o documento completo e rico em Markdown formatado para o GitHub Actions Step Summary."""
    agora_utc = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")
    total_consolidados = len(df_processado) if df_processado is not None else 0
    total_cruzamentos = len(cruzamentos)
    total_entes_cfg = len(portais_cfg) if portais_cfg else 16

    # Mapeamentos de manifesto por ente / id
    sucessos_map = {}
    for s in manifesto.get("sucesso", []):
        ente_k = s.get("ente", s.get("id", "")).strip().lower()
        sucessos_map[ente_k] = s

    falhas_map = {}
    for f in manifesto.get("falha", []):
        ente_k = f.get("ente", f.get("id", "")).strip().lower()
        falhas_map[ente_k] = f

    # Agrupamento da base processada por ente_origem
    contagem_por_ente: Dict[str, int] = {}
    competencia_por_ente: Dict[str, str] = {}
    competencia_geral = "--"
    if df_processado is not None and not df_processado.empty:
        for ente_nome, grupo in df_processado.groupby("ente_origem"):
            contagem_por_ente[str(ente_nome)] = len(grupo)
            comps = grupo["competencia"].dropna().unique()
            if len(comps) > 0 and comps[0]:
                competencia_por_ente[str(ente_nome)] = str(comps[0])
                if competencia_geral == "--":
                    competencia_geral = str(comps[0])

    # Se a competência geral ainda for vazia, define padrão
    if competencia_geral == "--":
        competencia_geral = datetime.now(timezone.utc).strftime("%Y-%m")

    # Linhas da Tabela Analítica
    linhas_tabela = []
    lista_entes = portais_cfg if portais_cfg else [
        {"id": "ceara_mirim", "ente": "Ceará-Mirim", "base_controle_local": True},
        {"id": "parnamirim", "ente": "Parnamirim"},
        {"id": "sga", "ente": "São Gonçalo do Amarante"},
        {"id": "macaiba", "ente": "Macaíba"},
        {"id": "extremoz", "ente": "Extremoz"},
        {"id": "nisia_floresta", "ente": "Nísia Floresta"},
        {"id": "monte_alegre", "ente": "Monte Alegre"},
        {"id": "goianinha", "ente": "Goianinha"},
        {"id": "tibau_do_sul", "ente": "Tibau do Sul"},
        {"id": "sao_jose_mipibu", "ente": "São José de Mipibu"},
        {"id": "ielmo_marinho", "ente": "Ielmo Marinho"},
        {"id": "maxaranguape", "ente": "Maxaranguape"},
        {"id": "ceara_mirim_camara", "ente": "Ceará-Mirim (Câmara)"},
        {"id": "touros", "ente": "Touros"},
        {"id": "natal", "ente": "Natal"},
        {"id": "estado_rn", "ente": "Governo do Estado do Rio Grande do Norte"}
    ]

    for p in lista_entes:
        ente_nome = p.get("ente", p.get("id", "Ente"))
        p_id = p.get("id", "").strip().lower()
        k_nome = ente_nome.strip().lower()

        # Determina contagem de servidores coletados
        qtd = 0
        comp_ente = competencia_por_ente.get(ente_nome) or competencia_geral
        for k_ente, v_qtd in contagem_por_ente.items():
            if k_nome in k_ente.lower() or p_id in k_ente.lower():
                qtd = v_qtd
                comp_ente = competencia_por_ente.get(k_ente, comp_ente)
                break

        # Determina cruzamentos com Ceará-Mirim
        is_ceara = p.get("base_controle_local") or "ceará-mirim" in k_nome or "ceara-mirim" in k_nome
        if is_ceara:
            cruzamentos_txt = "— *(Base Âncora)*"
        else:
            qtd_cruz = 0
            for k_ext, v_cruz in cruzamentos_por_ente.items():
                if k_nome in k_ext.lower() or p_id in k_ext.lower():
                    qtd_cruz += v_cruz
            cruzamentos_txt = f"**{qtd_cruz}**" if qtd_cruz > 0 else "0"

        # Determina status da extração
        if k_nome in sucessos_map or p_id in sucessos_map:
            suc = sucessos_map.get(k_nome) or sucessos_map.get(p_id)
            dur = suc.get("duracao_s", 0.0)
            status_extracao = f"🟢 Sucesso ({dur:.1f}s)"
        elif k_nome in falhas_map or p_id in falhas_map:
            flh = falhas_map.get(k_nome) or falhas_map.get(p_id)
            motivo = flh.get("motivo", "Falha de conexão")
            if len(motivo) > 30:
                motivo = motivo[:27] + "..."
            status_extracao = f"🔴 Falha ({motivo})"
        else:
            status_extracao = f"🟢 Sucesso (Local)" if qtd > 0 else "⚪ Não executado"

        # Determina status da persistência
        if qtd > 0:
            if "🟢" in persistencia["status_supabase_badge"] and "🟢" in persistencia["status_drive_badge"]:
                status_persistencia = "🟢 Supabase + Drive"
            elif "🟢" in persistencia["status_supabase_badge"]:
                status_persistencia = "🟢 Supabase (Drive Pend.)"
            elif "🟢" in persistencia["status_drive_badge"]:
                status_persistencia = "🟢 Drive (Supabase Pend.)"
            else:
                status_persistencia = "🟡 Local (Pendente Secrets)"
        else:
            status_persistencia = "⚪ Sem registros"

        linhas_tabela.append(
            f"| **{ente_nome}** | `{comp_ente}` | {qtd:,} | {cruzamentos_txt} | {status_extracao} | {status_persistencia} |"
        )

    tabela_analitica_md = "\n".join(linhas_tabela)

    # Estatísticas Constitucionais
    acum_duplo_prof = 0
    acum_prof_tec = 0
    acum_saude = 0
    alertas_jornada_60h = 0
    acum_irregulares = 0

    linhas_detalhes_audit = []
    for c in cruzamentos:
        sr = c.get("servidor_referencia", {})
        ve = c.get("vinculo_externo_detectado", {})
        ac = c.get("auditoria_constitucional", {})

        ch_tot = ac.get("carga_horaria_total", 0)
        enquadr = ac.get("enquadramento", "")
        legal = ac.get("acumulacao_legal", False)

        if "dois cargos de professor" in enquadr.lower():
            acum_duplo_prof += 1
        elif "técnico ou científico" in enquadr.lower():
            acum_prof_tec += 1
        elif "saúde" in enquadr.lower():
            acum_saude += 1

        if ch_tot > 60:
            alertas_jornada_60h += 1

        if not legal:
            acum_irregulares += 1

        status_ico = "🟢 Regular" if legal else "🔴 Alerta / Incompatível"
        linhas_detalhes_audit.append(
            f"| **{sr.get('nome_completo', '--')}** | {sr.get('cargo', '--')} | "
            f"{ve.get('ente_origem', '--')} | {ve.get('cargo', '--')} | "
            f"**{ch_tot}h** | {status_ico} | {enquadr} |"
        )

    if linhas_detalhes_audit:
        tabela_audit_md = (
            "| Servidor (Ceará-Mirim) | Cargo Ceará-Mirim | Ente Externo | Cargo Externo | Jornada Total | Situação | Enquadramento CF/88 |\n"
            "|:---|:---|:---|:---|:---:|:---:|:---|\n"
            + "\n".join(linhas_detalhes_audit[:25])
        )
        if len(linhas_detalhes_audit) > 25:
            tabela_audit_md += f"\n\n*(Exibindo 25 de {len(linhas_detalhes_audit)} vínculos auditados. Consulte a base completa no Drive/Supabase)*"
    else:
        tabela_audit_md = (
            "> ℹ️ *Nenhum cruzamento intermunicipal de servidor identificado no ciclo atual ou bases ainda não consolidadas.*"
        )

    nome_csv_gerado = caminho_csv.name if caminho_csv else f"servidores-intermunicipais-{competencia_geral}.csv"

    # Montagem do Markdown
    relatorio_md = f"""# 🏛️ Resumo Executivo — O Papiro de Cadmo
> **ETL Mensal Intermunicipal de Servidores e Auditoria de Vínculos Funcionais**  
> **Secretaria Municipal de Educação Básica (SMEB) — Ceará-Mirim / RN**

| 📅 Data/Hora (UTC) | 🏛️ Entes Monitorados | 👥 Servidores Consolidados | 🔄 Cruzamentos Detectados | 🗄️ Supabase (`folha_intermunicipal`) | 📁 Google Drive (`1dcc...`) |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **{agora_utc}** | **{total_entes_cfg}** | **{total_consolidados:,}** | **{total_cruzamentos}** | {persistencia['status_supabase_badge']} | {persistencia['status_drive_badge']} |

---

## 📊 1. Matriz Analítica por Ente Governamental

| Ente / Secretaria | Competência | Servidores Coletados | Cruzamentos (Ceará-Mirim) | Status Extração | Status Persistência |
|:---|:---:|:---:|:---:|:---|:---|
{tabela_analitica_md}

---

## ⚖️ 2. Auditoria Constitucional de Acumulações (CF/88 Art. 37, XVI)

| 📚 2 Professores (Alínea 'a') | 🔬 Prof. + Técnico (Alínea 'b') | 🩺 Saúde (Alínea 'c') | ⚠️ Jornada > 60h | 🚨 Incompatíveis |
|:---:|:---:|:---:|:---:|:---:|
| **{acum_duplo_prof}** | **{acum_prof_tec}** | **{acum_saude}** | **{alertas_jornada_60h}** | **{acum_irregulares}** |

### Vínculos Intermunicipais Identificados
{tabela_audit_md}

---

## 🔒 3. Destinos Oficiais de Persistência e Rastreabilidade
- **Google Drive Oficial (Pasta Transparência)**: [`{persistencia['drive_folder_id']}`](https://drive.google.com/drive/folders/{persistencia['drive_folder_id']}) — *{persistencia['status_drive']}*
- **Supabase Cloud (PostgREST)**: Tabela `{persistencia['tabela_supabase']}` — *{persistencia['status_supabase']}*
- **Arquivo Consolidado**: `{nome_csv_gerado}` ({total_consolidados:,} servidores)
- **Log de Auditoria Local**: `data/processed/RESUMO_EXECUTIVO.md`
"""
    return relatorio_md.strip()


def publicar_resumo_executivo(caminho_base_override: Optional[Path] = None) -> str:
    """
    Função orquestradora:
    1. Carrega catálogo, manifesto, base processada e status de persistência.
    2. Executa a auditoria de cruzamento de vínculos.
    3. Formata o resumo executivo em Markdown.
    4. Grava em $GITHUB_STEP_SUMMARY se definido.
    5. Grava em data/processed/RESUMO_EXECUTIVO.md.
    6. Retorna o conteúdo Markdown gerado.
    """
    raiz = caminho_base_override if caminho_base_override is not None else Path(__file__).resolve().parent.parent

    portais_cfg = carregar_config_portais(raiz)
    manifesto = carregar_manifesto(raiz)
    df_processado, caminho_csv = carregar_base_processada(raiz)
    persistencia = obter_status_persistencia(raiz)

    cruzamentos, cruzamentos_por_ente = executar_auditoria_cruzamento(df_processado, raiz)

    relatorio_md = gerar_markdown_resumo(
        portais_cfg=portais_cfg,
        manifesto=manifesto,
        df_processado=df_processado,
        caminho_csv=caminho_csv,
        persistencia=persistencia,
        cruzamentos=cruzamentos,
        cruzamentos_por_ente=cruzamentos_por_ente
    )

    # 1. Grava no GitHub Actions Step Summary (se disponível)
    step_summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary_path:
        try:
            with open(step_summary_path, "a", encoding="utf-8") as f:
                f.write("\n" + relatorio_md + "\n")
            logger.info(f"Resumo Executivo gravado com sucesso em $GITHUB_STEP_SUMMARY ({step_summary_path})")
        except Exception as e:
            logger.error(f"Falha ao gravar em $GITHUB_STEP_SUMMARY: {e}")
    else:
        logger.info("Variável GITHUB_STEP_SUMMARY não detectada (execução fora do GitHub Actions runner).")

    # 2. Grava em data/processed/RESUMO_EXECUTIVO.md para auditoria e testes
    processed_dir = raiz / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    arquivo_local = processed_dir / "RESUMO_EXECUTIVO.md"
    try:
        arquivo_local.write_text(relatorio_md, encoding="utf-8")
        logger.info(f"Resumo Executivo salvo com sucesso em {arquivo_local}")
    except Exception as e:
        logger.error(f"Falha ao gravar arquivo local {arquivo_local}: {e}")

    return relatorio_md


def main():
    publicar_resumo_executivo()


if __name__ == "__main__":
    main()
