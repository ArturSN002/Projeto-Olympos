import io
import os
import re
import json
import time
import base64
import unicodedata
from datetime import datetime, timezone, timedelta

try:
    import pytz
    TZ_FORTALEZA = pytz.timezone("America/Fortaleza")
except ImportError:
    TZ_FORTALEZA = timezone(timedelta(hours=-3))

import urllib.request
try:
    import requests
except ImportError:
    class _RequestsFallback:
        RequestException = Exception

        @staticmethod
        def post(url, json=None, timeout=90):
            data = json_module.dumps(json).encode("utf-8")
            req = urllib.request.Request(
                url, data=data, headers={"Content-Type": "application/json"}, method="POST"
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8")
                return type("Resp", (), {"status_code": r.status, "text": body})()

    json_module = json
    requests = _RequestsFallback()

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    sync_playwright = None
    PlaywrightTimeout = TimeoutError

FEMURN_SEARCH_URL = "https://www.diariomunicipal.com.br/femurn/pesquisar"
MAX_PDFS_POR_LOTE_WEBHOOK = 10

FOLDER_PORTARIAS_2026 = "1QEewN0R3bCksLxLhmOSFq20EQYI3g64Q"
FOLDER_GABINETE_2026 = "16YaFjfO6DRPVzJtRzLsynrOI0llNXQ8L"
FOLDER_JURIDICO_2026 = "1N6UgdyGTVdIP4PW02dDBstsi4LIhgmRJ"


def obter_pasta_drive_destino(categoria: str, entidade: str) -> str:
    """Determina a pasta oficial de 2026 no Google Drive conforme a categoria do ato."""
    entidade_upper = str(entidade or "").upper()
    cat_upper = str(categoria or "").upper()
    if "CÂMARA" in entidade_upper or "CAMARA" in entidade_upper:
        return FOLDER_JURIDICO_2026
    if cat_upper == "PORTARIA":
        return FOLDER_PORTARIAS_2026
    return FOLDER_GABINETE_2026


def upload_pdf_direto_drive(pdf_bytes: bytes, nome_arquivo: str, folder_id: str):
    """
    Realiza upload direto do PDF no Google Drive via Google Cloud Service Account (GCP_SA_KEY).
    Elimina a necessidade de tráfego pesado de pdf_base64 no webhook do GAS.
    """
    sa_json = os.environ.get("GCP_SA_KEY", "").strip()
    if not sa_json or not pdf_bytes:
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaInMemoryUpload

        try:
            sa_info = json.loads(sa_json)
        except json.JSONDecodeError:
            sa_info = json.loads(base64.b64decode(sa_json).decode("utf-8"))

        credentials = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]
        )
        service = build("drive", "v3", credentials=credentials)

        # Checa existência prévia para idempotência
        query = f"'{folder_id}' in parents and name = '{nome_arquivo}' and trashed = false"
        res = service.files().list(q=query, fields="files(id, name, webViewLink)").execute()
        existentes = res.get("files", [])

        media = MediaInMemoryUpload(pdf_bytes, mimetype="application/pdf", resumable=True)

        if existentes:
            file_id = existentes[0]["id"]
            updated = service.files().update(fileId=file_id, media_body=media, fields="id, webViewLink").execute()
            link = updated.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view"
            print(f"[DRIVE SA OK] Arquivo existente atualizado: {nome_arquivo} (ID: {file_id})")
            return {"file_id": file_id, "url": link}
        else:
            meta = {"name": nome_arquivo, "parents": [folder_id]}
            created = service.files().create(body=meta, media_body=media, fields="id, webViewLink").execute()
            file_id = created.get("id")
            link = created.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view"
            print(f"[DRIVE SA OK] Novo PDF criado no Drive: {nome_arquivo} (ID: {file_id})")
            return {"file_id": file_id, "url": link}
    except Exception as err:
        print(f"[AVISO] Upload direto via Service Account falhou (fallback para Base64/GAS): {err}")
        return None

KEYWORDS_EDUCACAO = [
    "educação", "smeb", "professor", "magistério", "pedagog", "escola",
    "creche", "cme", "fundeb", "permuta", "cessão", "processo seletivo",
    "readaptação", "licença", "merenda", "transporte escolar", "diretor",
    "coordenador", "cuidador", "mediador", "ensino"
]

KEYWORDS_LEGISLATIVO = [
    "educação", "smeb", "escola", "magistério", "professor", "ensino"
]


def normalizar_texto_sem_acentos(texto):
    """Remove acentos e converte para minúsculas para busca semântica insensível a grafia."""
    if not texto:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(texto))
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return sem_acento.lower()


def obter_intervalo_datas():
    hoje = datetime.now(TZ_FORTALEZA).strftime("%d/%m/%Y")
    dt_ini = os.getenv("DATA_INICIO_CUSTOM", "").strip() or hoje
    dt_fim = os.getenv("DATA_FIM_CUSTOM", "").strip() or dt_ini
    return dt_ini, dt_fim


def contem_palavra_chave(texto, lista_termos):
    texto_norm = normalizar_texto_sem_acentos(texto)
    for termo in lista_termos:
        if normalizar_texto_sem_acentos(termo) in texto_norm:
            return True
    return False


def classificar_tipo_ato(titulo_e_texto):
    t = normalizar_texto_sem_acentos(titulo_e_texto).upper()
    if "PORTARIA" in t:
        return "PORTARIA"
    if "EDITAL" in t or "PROCESSO SELETIVO" in t or "CONVOCACAO" in t:
        return "EDITAL_PSS"
    if "DECRETO" in t or "LEI " in t:
        return "NORMATIVO_JURIDICO"
    if "PERMUTA" in t or "CESSAO" in t:
        return "PERMUTA_RH"
    return "ATO_GABINETE"


def extrair_entidades_estruturadas(texto_integral, titulo_ato=""):
    """
    Sugestão 3.4.1 (NER Leve): Extrai automaticamente do texto das publicações da FEMURN
    o número do ato, matrículas e nomes de servidores citados.
    """
    texto_combinado = f"{titulo_ato}\n{texto_integral or ''}"

    # 1. Número do Ato (ex: 045/2026)
    match_num = re.search(
        r"(?:PORTARIA|EDITAL|DECRETO|LEI)\s*(?:N[º°.]?\s*)?(\d{1,4}(?:[./-]\d{2,4})?)",
        texto_combinado,
        re.IGNORECASE
    )
    numero_ato = match_num.group(1).strip() if match_num else ""

    # 2. Matrículas (ex: Matrícula nº 12345-6, mat. 9988)
    matriculas = []
    for m_mat in re.finditer(
        r"matr[íi]cula(?:\s*n[º°.]?)?\s*[:\-]?\s*([\d.\-/]{2,14})",
        texto_combinado,
        re.IGNORECASE
    ):
        val = m_mat.group(1).strip(" .,-")
        if val and val not in matriculas:
            matriculas.append(val)

    # 3. Nomes de Servidores (padrões comuns em portarias da SMEB/Prefeitura)
    servidores = []
    padroes_servidor = [
        r"servidor(?:\(a\)|a)?\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s']{5,70}?)(?=\s*[-–,]\s*matr[íi]cula|\s*,\s*matr[íi]cula|\s*,\s*portador|\s*,\s*ocupante|\s*,\s*lotad)",
        r"(?:conceder|designar|nomear|exonerar|readaptar)\s+(?:a(?:\(o\))?\s+servidor(?:\(a\))?\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s']{5,70}?)(?=\s*[-–,]\s*matr[íi]cula|\s*,\s*matr[íi]cula|\s*,\s*CPF)"
    ]
    for pat in padroes_servidor:
        for m_srv in re.finditer(pat, texto_combinado, re.IGNORECASE):
            nome = re.sub(r"\s+", " ", m_srv.group(1)).strip(" -–,.")
            # Evita capturar termos genéricos
            if len(nome.split()) >= 2 and nome.upper() not in [s.upper() for s in servidores]:
                servidores.append(nome.upper())

    return {
        "numero_ato": numero_ato,
        "matriculas": matriculas[:15],
        "servidores": servidores[:15]
    }


MESES_PT_EXTENSO = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
    5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
    9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}


def formatar_data_por_extenso(data_str):
    """Converte datas em formato DD/MM/AAAA ou AAAA-MM-DD para 'DD de Mês de AAAA'."""
    if not data_str:
        return ""
    partes = re.split(r"[-/]", str(data_str).strip())
    if len(partes) == 3:
        try:
            if len(partes[0]) == 4:  # AAAA-MM-DD
                ano, mes, dia = partes[0], int(partes[1]), int(partes[2])
            else:  # DD/MM/AAAA
                dia, mes, ano = int(partes[0]), int(partes[1]), partes[2]
            nome_mes = MESES_PT_EXTENSO.get(mes, f"{mes:02d}")
            return f"{dia} de {nome_mes} de {ano}"
        except (ValueError, KeyError):
            pass
    return str(data_str)


def formatar_nome_arquivo_oficial(categoria, numero_ato, data_circulacao, orgao="SMEB", cod_id=""):
    """
    Padroniza o nome do arquivo oficial capturado no Diário Oficial.
    Exemplo: 'Portaria - SMEB nº 163 de 29 de Outubro de 2026.pdf'
    """
    cat_upper = str(categoria or "").upper()
    tipo = "Portaria"
    if "EDITAL" in cat_upper:
        tipo = "Edital"
    elif "DECRETO" in cat_upper:
        tipo = "Decreto"
    elif "LEI" in cat_upper:
        tipo = "Lei"
    elif "EXTRATO" in cat_upper:
        tipo = "Extrato"
    elif "RESOLU" in cat_upper:
        tipo = "Resolução"
    elif "AVISO" in cat_upper:
        tipo = "Aviso"
    elif "PERMUTA" in cat_upper:
        tipo = "Portaria"

    orgao_tag = "SMEB"
    if orgao and ("Gabinete" in str(orgao) or "Prefeitura" in str(orgao)):
        orgao_tag = "Gabinete"
    elif orgao and "Câmara" in str(orgao):
        orgao_tag = "Câmara"

    data_extenso = formatar_data_por_extenso(data_circulacao)

    num_limpo = ""
    if numero_ato:
        # Se contiver sufixo de ano (ex: 163/2026), remove para não duplicar o ano no nome
        num_limpo = re.sub(r"/\d{4}$", "", str(numero_ato)).strip()
        num_limpo = re.sub(r"[\\/:*?\"<>|]", "-", num_limpo).strip()

    if num_limpo:
        titulo_base = f"{tipo} - {orgao_tag} nº {num_limpo}"
    elif cod_id:
        titulo_base = f"{tipo} - {orgao_tag} ({cod_id})"
    else:
        titulo_base = f"{tipo} - {orgao_tag}"

    if data_extenso:
        titulo_base = f"{titulo_base} de {data_extenso}"

    # Sanitiza caracteres proibidos em sistemas de arquivos (Windows, Linux, Drive)
    nome_seguro = re.sub(r'[\\/:*?"<>|]', '_', titulo_base)
    nome_seguro = re.sub(r'\s+', ' ', nome_seguro).strip()
    return f"{nome_seguro}.pdf", titulo_base


def extrair_texto_com_fallback_ocr(texto_html, pdf_bytes=None, page_opt=None):
    """
    Sugestão 3.4.2: Caso a matéria na FEMURN contenha tabelas escaneadas ou texto HTML esparso (< 120 chars),
    aplica extração via pypdf sobre os bytes do PDF e, se necessário, OCR via Tesseract (lang='por').
    """
    texto_base = (texto_html or "").strip()
    if len(texto_base) >= 120:
        return texto_base, "HTML_NATIVO"

    partes_recuperadas = [texto_base] if texto_base else []
    metodo_usado = "HTML_NATIVO"

    # Camada 1: Extração via pypdf dos bytes do PDF
    if pdf_bytes and PdfReader is not None:
        try:
            leitor = PdfReader(io.BytesIO(pdf_bytes))
            texto_pdf = "\n".join((p.extract_text() or "") for p in leitor.pages).strip()
            if texto_pdf and len(texto_pdf) > len(texto_base):
                partes_recuperadas.append(texto_pdf)
                metodo_usado = "PYPDF_FALLBACK"
        except Exception as err:
            print(f"[AVISO] Falha no fallback pypdf: {err}")

    texto_atual = "\n".join(partes_recuperadas).strip()
    if len(texto_atual) >= 120:
        return texto_atual, metodo_usado

    # Camada 2: OCR via Tesseract sobre screenshot da página (se disponível)
    if page_opt is not None and pytesseract is not None and Image is not None:
        try:
            png_bytes = page_opt.screenshot(full_page=True)
            img = Image.open(io.BytesIO(png_bytes))
            texto_ocr = pytesseract.image_to_string(img, lang="por").strip()
            if texto_ocr:
                partes_recuperadas.append(texto_ocr)
                metodo_usado = "TESSERACT_OCR"
        except Exception as err:
            print(f"[AVISO] Falha no fallback OCR Tesseract: {err}")

    return "\n".join(partes_recuperadas).strip(), metodo_usado


def montar_resumo_espaco_google_chat(dt_ini, lista_final):
    """
    Sugestão 3.4.3: Monta o payload de Resumo Executivo para o Espaço do Google Chat da SMEB,
    contendo tanto o texto estruturado quanto o Card interativo (cardsV2) com links clicáveis e entidades NER.
    """
    total = len(lista_final or [])
    if total == 0:
        texto_simples = (
            f"🔥 *Fogo de Prometheus — Monitor FEMURN ({dt_ini})*\n"
            f"ℹ️ Nenhuma publicação referente à SMEB / Educação de Ceará-Mirim foi localizada na edição de hoje."
        )
        return {"text": texto_simples}

    contagem_categorias = {}
    linhas_resumo = [
        f"🔥 *Fogo de Prometheus — Resumo Diário FEMURN ({dt_ini})*",
        f"📌 *{total} publicação(ões)* da Educação / SMEB Ceará-Mirim identificada(s):\n"
    ]

    widgets_itens = []
    for idx, pub in enumerate(lista_final[:15], start=1):
        cat = pub.get("categoria", "ATO_GABINETE")
        contagem_categorias[cat] = contagem_categorias.get(cat, 0) + 1
        titulo = pub.get("titulo_ato", "Ato Oficial")
        orgao = pub.get("orgao", "SMEB")
        cod = pub.get("codigo_identificador", "--")
        url = pub.get("url_origem", "")
        ner = pub.get("entidades_ner") or {}
        servidores = ner.get("servidores") or []
        matriculas = ner.get("matriculas") or []

        detalhe_ner = ""
        if servidores:
            detalhe_ner += f" | 👤 Servidor(es): {', '.join(servidores[:2])}"
        if matriculas:
            detalhe_ner += f" (Mat.: {', '.join(matriculas[:2])})"

        link_fmt = f"<{url}|Abrir Matéria>" if url else f"Cód: {cod}"
        linhas_resumo.append(f"{idx}. *[{cat}]* {titulo} — _{orgao}_{detalhe_ner} • {link_fmt}")

        widgets_itens.append({
            "decoratedText": {
                "topLabel": f"{cat} • {orgao} (ID: {cod})",
                "text": f"<b>{titulo}</b>{detalhe_ner}",
                "wrapText": True,
                "button": {
                    "text": "Ver Ato",
                    "onClick": {"openLink": {"url": url or FEMURN_SEARCH_URL}}
                }
            }
        })

    resumo_categorias = " • ".join(f"{k}: {v}" for k, v in contagem_categorias.items())
    linhas_resumo.append(f"\n📊 *Distribuição por Tipo:* {resumo_categorias}")

    return {
        "text": "\n".join(linhas_resumo),
        "cardsV2": [
            {
                "cardId": f"prometheus-smeb-{dt_ini.replace('/', '-')}",
                "card": {
                    "header": {
                        "title": "🔥 Fogo de Prometheus — Resumo Diário FEMURN",
                        "subtitle": f"SMEB Ceará-Mirim/RN • Edição {dt_ini} ({total} atos)"
                    },
                    "sections": [
                        {
                            "header": f"Resumo por Categoria ({resumo_categorias})",
                            "widgets": widgets_itens
                        }
                    ]
                }
            }
        ]
    }


def enviar_resumo_espaco_google_chat(chat_webhook_url, dt_ini, lista_final):
    """
    Sugestão 3.4.3: Envia o resumo executivo diretamente para o Espaço do Google Chat via Webhook.
    """
    if not chat_webhook_url:
        return None
    payload_chat = montar_resumo_espaco_google_chat(dt_ini, lista_final)
    for tentativa in range(1, 3):
        try:
            resp = requests.post(chat_webhook_url, json=payload_chat, timeout=30)
            print(f"[GOOGLE CHAT SPACE] Status {resp.status_code}: Resumo enviado com sucesso.")
            return {"status_code": resp.status_code, "payload": payload_chat}
        except Exception as err:
            print(f"[AVISO] Falha ao enviar resumo ao Google Chat (tentativa {tentativa}/2): {err}")
            if tentativa < 2:
                time.sleep(2)
    return None


def selecionar_opcao_por_texto_parcial(page, selector_select, texto_alvo, textos_fallback=None):
    """
    Localiza um <select> na página que contenha uma <option> cujo texto case com texto_alvo
    (ou textos_fallback) de forma insensível a acentos/maiúsculas e seleciona a opção.
    """
    alvos = [texto_alvo] + (textos_fallback or [])
    alvos_norm = [normalizar_texto_sem_acentos(a) for a in alvos if a]

    # Coleta os <select> candidatos (primeiro pelo seletor específico, depois todos os <select> da página)
    candidatos = []
    try:
        if selector_select:
            candidatos.extend(page.locator(selector_select).all())
    except Exception:
        pass

    try:
        todos_selects = page.locator("select").all()
        if not candidatos:
            candidatos = todos_selects
        else:
            # Adiciona demais selects da página como fallback caso o id/name do portal seja diferente
            candidatos.extend(todos_selects)
    except Exception:
        pass

    for sel in candidatos:
        try:
            # Executa busca rápida diretamente no DOM do Chromium + dispara eventos nativos/jQuery
            res = sel.evaluate(
                """(selectEl, alvosNorm) => {
                    const norm = (s) => (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
                    const opts = Array.from(selectEl.options || []);
                    for (const alvo of alvosNorm) {
                        for (const opt of opts) {
                            const txt = norm(opt.text || opt.textContent || '');
                            if (txt && txt.includes(alvo)) {
                                selectEl.value = opt.value;
                                opt.selected = true;
                                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                                selectEl.dispatchEvent(new Event('input', { bubbles: true }));
                                if (window.jQuery) {
                                    try { window.jQuery(selectEl).trigger('change'); } catch (e) {}
                                }
                                return {
                                    matched: true,
                                    value: opt.value,
                                    label: (opt.text || opt.textContent || '').trim()
                                };
                            }
                        }
                    }
                    return { matched: false, totalOptions: opts.length };
                }""",
                alvos_norm
            )
            if res and res.get("matched"):
                val = res.get("value")
                label = res.get("label")
                try:
                    if val is not None and str(val) != "":
                        sel.select_option(value=str(val))
                    elif label:
                        sel.select_option(label=label)
                except Exception:
                    pass
                print(f"[SELECT OK] '{label}' selecionado (valor={val}).")
                return label
        except Exception:
            # Fallback caso sel.evaluate não esteja disponível em objetos mock de teste
            try:
                opcoes = sel.locator("option").all()
                for alvo_n in alvos_norm:
                    for opt in opcoes:
                        label = (opt.inner_text() or "").strip()
                        if alvo_n in normalizar_texto_sem_acentos(label):
                            val = opt.get_attribute("value")
                            if val:
                                sel.select_option(value=val)
                                return label
            except Exception:
                pass

    return None


def preencher_datas_pesquisa(page, dt_ini_br, dt_fim_br):
    """
    Preenche os campos 'Circulação de' e 'até' suportando tanto <input type='date'> (YYYY-MM-DD)
    quanto <input type='text'> com máscara brasileira (DD/MM/YYYY).
    """
    def para_iso(dt_br):
        partes = str(dt_br).strip().split("/")
        if len(partes) == 3:
            return f"{partes[2]}-{partes[1]}-{partes[0]}"
        return dt_br

    dt_ini_iso = para_iso(dt_ini_br)
    dt_fim_iso = para_iso(dt_fim_br)

    seletores_data = (
        "input[type='date'], input[name*='data'], input[id*='data'], "
        "input[name*='inicio'], input[name*='fim'], input[name*='de'], input[name*='ate'], "
        "input.datepicker, input[placeholder*='/']"
    )
    inputs_data = page.locator(seletores_data).all()

    if len(inputs_data) >= 2:
        for inp, val_br, val_iso in [(inputs_data[0], dt_ini_br, dt_ini_iso), (inputs_data[1], dt_fim_br, dt_fim_iso)]:
            try:
                tipo = (inp.get_attribute("type") or "text").lower()
                if tipo == "date":
                    inp.fill(val_iso)
                else:
                    try:
                        inp.fill(val_br)
                    except Exception:
                        inp.fill(val_iso)
            except Exception as err:
                print(f"[AVISO] Erro ao preencher campo de data: {err}")
        print(f"[DATAS] Período configurado: {dt_ini_br} até {dt_fim_br}")
    else:
        print(f"[AVISO] Campos de data não localizados pelo seletor ({len(inputs_data)} encontrados).")


def executar_ciclo_pesquisa(
    page,
    entidade_alvo,
    orgao_alvo,
    aplicar_filtro_keywords,
    lista_keywords=None,
    urls_ja_processadas=None
):
    publicacoes_coletadas = []
    dt_ini, dt_fim = obter_intervalo_datas()
    termos_filtro = lista_keywords if lista_keywords is not None else KEYWORDS_EDUCACAO
    if urls_ja_processadas is None:
        urls_ja_processadas = set()

    page.goto(FEMURN_SEARCH_URL, wait_until="networkidle", timeout=60000)

    # 1. Selecionar Município (Entidade)
    seletor_entidade = "select[name*='entidade'], select[id*='entidade'], select[id*='municipio'], select[name*='municipio']"
    entidade_selecionada = selecionar_opcao_por_texto_parcial(page, seletor_entidade, entidade_alvo)
    if not entidade_selecionada:
        print(f"[AVISO] Entidade não localizada no select: {entidade_alvo}")
        return []

    # 2. Aguardar carregamento AJAX do dropdown de Órgão (se aplicável)
    page.wait_for_timeout(2500)
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass

    if orgao_alvo:
        seletor_orgao = "select[name*='orgao'], select[id*='orgao'], select[id*='unidade'], select[name*='unidade']"
        fallbacks_orgao = []
        if "Educação" in orgao_alvo:
            fallbacks_orgao = ["Secretaria Municipal de Educação", "Educação Básica", "Educação"]
        elif "Gabinete" in orgao_alvo:
            fallbacks_orgao = ["Gabinete"]

        orgao_selecionado = selecionar_opcao_por_texto_parcial(
            page, seletor_orgao, orgao_alvo, textos_fallback=fallbacks_orgao
        )
        if not orgao_selecionado:
            print(f"[INFO] Órgão '{orgao_alvo}' sem matérias ou não listado no AJAX; pulando ciclo.")
            return []

    # 3. Preencher intervalo "Circulação de" e "até"
    preencher_datas_pesquisa(page, dt_ini, dt_fim)

    # 4. Submeter pesquisa
    botao_pesquisar = page.locator("button[type='submit'], input[type='submit'], button:has-text('Pesquisar')").first
    botao_pesquisar.click()
    page.wait_for_load_state("networkidle", timeout=45000)

    # 5. Extrair links das matérias encontradas na tabela de resultados
    links_materias = page.locator("a[href*='/materia/'], a:has-text('Visualizar'), a:has-text('Ver matéria')").all()
    itens_materias = []
    codigos_vistos_ciclo = set()

    for lk in links_materias:
        href = lk.get_attribute("href")
        if not href:
            continue
        url_completa = href if href.startswith("http") else f"https://www.diariomunicipal.com.br{href}"
        m_cod_url = re.search(r"/materia/([A-Za-z0-9]+)", url_completa)
        chave_dedup = m_cod_url.group(1).upper() if m_cod_url else url_completa

        if chave_dedup in urls_ja_processadas or chave_dedup in codigos_vistos_ciclo:
            continue

        # Captura também o texto do container/card na página de busca como contexto adicional
        texto_contexto = ""
        try:
            texto_contexto = lk.evaluate(
                """(el) => {
                    const container = el.closest('tr, li, article, .materia, .resultado, .item, div.row, div.card') || el.parentElement;
                    return container ? (container.innerText || '').trim() : '';
                }"""
            )
        except Exception:
            pass

        codigos_vistos_ciclo.add(chave_dedup)
        itens_materias.append((chave_dedup, url_completa, texto_contexto))

    print(f"[CICLO] {entidade_alvo} | {orgao_alvo or 'Todos'}: {len(itens_materias)} matérias novas listadas.")

    # 6. Baixar/extrair cada matéria via page.request.get (imune a net::ERR_ABORTED em links /download/materia/)
    for chave_dedup, url_mat, texto_contexto in itens_materias:
        try:
            urls_ja_processadas.add(chave_dedup)
            urls_ja_processadas.add(url_mat)

            texto_html = ""
            pdf_bytes = b""

            # 6.1 Tenta buscar a versão HTML de visualização (/femurn/materia/CODIGO) se disponível
            url_vis = url_mat.replace("/download/materia/", "/materia/")
            url_dl = url_mat if "/download/materia/" in url_mat else url_mat.replace("/materia/", "/download/materia/")

            # Busca via cliente HTTP do contexto Playwright (não dispara erro net::ERR_ABORTED de navegação)
            for candidate_url in ([url_dl, url_vis] if url_dl != url_vis else [url_mat]):
                try:
                    resp = page.request.get(candidate_url, timeout=30000)
                    if not resp.ok:
                        continue
                    raw_bytes = resp.body()
                    ct = (resp.headers.get("content-type") or "").lower()

                    if raw_bytes.startswith(b"%PDF") or "application/pdf" in ct:
                        pdf_bytes = raw_bytes
                    elif b"<html" in raw_bytes[:800].lower() or b"<!doctype" in raw_bytes[:800].lower() or "html" in ct:
                        html_str = raw_bytes.decode("utf-8", errors="replace")
                        if BeautifulSoup is not None:
                            soup = BeautifulSoup(html_str, "html.parser")
                            texto_extraido = soup.get_text(separator="\n", strip=True)
                            if len(texto_extraido) > len(texto_html):
                                texto_html = texto_extraido
                        if not pdf_bytes:
                            temp_page = page.context.new_page()
                            try:
                                temp_page.set_content(html_str, wait_until="domcontentloaded", timeout=15000)
                                pdf_bytes = temp_page.pdf(format="A4", print_background=True)
                            finally:
                                temp_page.close()
                    elif raw_bytes:
                        # Caso retorne RTF, DOC ou texto plano em /download/materia/
                        texto_bruto = raw_bytes.decode("utf-8", errors="ignore")
                        if len(texto_bruto) < 50:
                            texto_bruto = raw_bytes.decode("latin-1", errors="ignore")
                        if texto_bruto.startswith("{\\rtf"):
                            # Remove tags de controle RTF básicas preservando o texto
                            texto_bruto = re.sub(r"\\[a-z]+\d*\s?|[{}]", " ", texto_bruto)
                        if len(texto_bruto.strip()) > len(texto_html):
                            texto_html = texto_bruto.strip()
                except Exception as req_err:
                    print(f"[AVISO] Falha ao requisitar {candidate_url}: {req_err}")

            # 6.2 Combina com o texto do card da listagem se necessário
            if texto_contexto and texto_contexto not in texto_html:
                texto_html = f"{texto_contexto}\n{texto_html}".strip()

            # 6.3 Caso o servidor não tenha retornado PDF nativo, gera um PDF A4 limpo a partir do texto extraído
            if not pdf_bytes and texto_html:
                temp_page = page.context.new_page()
                try:
                    html_fallback = (
                        "<html><head><meta charset='utf-8'></head>"
                        "<body style='font-family:serif;padding:24px;line-height:1.5;white-space:pre-wrap;'>"
                        f"<h3>Diário Oficial dos Municípios do RN (FEMURN) — Cód: {chave_dedup}</h3><hr>"
                        f"{texto_html}</body></html>"
                    )
                    temp_page.set_content(html_fallback, wait_until="domcontentloaded", timeout=15000)
                    pdf_bytes = temp_page.pdf(format="A4", print_background=True)
                finally:
                    temp_page.close()

            # Sugestão 3.4.2: Fallback de pypdf/OCR se o texto HTML for esparso ou o download for PDF direto
            texto_integral, metodo_extracao = extrair_texto_com_fallback_ocr(texto_html, pdf_bytes, None)

            if aplicar_filtro_keywords and not contem_palavra_chave(texto_integral, termos_filtro):
                continue

            # Extrair Código Identificador FEMURN (pelo texto ou diretamente pela URL /materia/DD6CE488)
            match_cod = re.search(r"Código Identificador:\s*([A-F0-9]{6,10})", texto_integral, re.IGNORECASE)
            if match_cod:
                cod_id = match_cod.group(1).upper()
            elif re.match(r"^[A-F0-9]{6,12}$", chave_dedup, re.IGNORECASE):
                cod_id = chave_dedup.upper()
            else:
                cod_id = datetime.now().strftime("%H%M%S")

            # Extrair primeira linha relevante como título do ato
            match_titulo = re.search(
                r"((?:PORTARIA|EDITAL|DECRETO|LEI|EXTRATO|AVISO|TERMO|RESOLU[ÇC][ÃA]O)\s+N?[º°]?\s*[\d./-]+[^\n]*)",
                texto_integral,
                re.IGNORECASE
            )
            titulo_ato = match_titulo.group(1).strip()[:100] if match_titulo else f"Ato_FEMURN_{cod_id}"

            pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8") if pdf_bytes else ""
            categoria = classificar_tipo_ato(f"{titulo_ato} {texto_integral[:600]}")

            # Sugestão 3.4.1: Extração estruturada NER (Servidores, Matrículas, Nº do Ato)
            entidades_ner = extrair_entidades_estruturadas(texto_integral, titulo_ato)

            # Padronização Oficial de Título e Nome de Arquivo (ex: 'Portaria - SMEB nº 163 de 29 de Outubro de 2026.pdf')
            nome_arq, tit_oficial = formatar_nome_arquivo_oficial(
                categoria=categoria,
                numero_ato=entidades_ner.get("numero_ato"),
                data_circulacao=dt_ini,
                orgao=orgao_alvo or "SMEB",
                cod_id=cod_id
            )

            # Upload direto no Drive se GCP_SA_KEY estiver ativa
            url_drive_sa = ""
            if pdf_bytes:
                pasta_id = obter_pasta_drive_destino(categoria, entidade_alvo)
                sa_drive_res = upload_pdf_direto_drive(pdf_bytes, nome_arq, pasta_id)
                if sa_drive_res:
                    url_drive_sa = sa_drive_res.get("url", "")
                    pdf_b64 = ""  # Limpa pdf_base64 para reduzir tamanho do payload HTTP no webhook GAS

            print(f"[MATERIA OK] Cód: {cod_id} | Cat: {categoria} | Método: {metodo_extracao} | Título: {tit_oficial or titulo_ato}")

            publicacoes_coletadas.append({
                "codigo_identificador": cod_id,
                "data_circulacao": dt_ini,
                "entidade": entidade_alvo,
                "orgao": orgao_alvo or "Câmara Municipal",
                "titulo_ato": tit_oficial if tit_oficial else titulo_ato,
                "titulo_original": titulo_ato,
                "nome_arquivo": nome_arq,
                "categoria": categoria,
                "metodo_extracao": metodo_extracao,
                "entidades_ner": entidades_ner,
                "url_origem": url_mat,
                "url_drive": url_drive_sa,
                "resumo_texto": texto_integral[:1200],
                "pdf_base64": pdf_b64
            })
        except Exception as err:
            print(f"[ERRO] Falha ao processar matéria {url_mat}: {err}")

    return publicacoes_coletadas


def enviar_lotes_webhook(webhook_url, token, dt_ini, lista_final):
    """Envia as publicações em lotes (chunks) com retry para evitar estouro de payload/timeout no GAS."""
    if not lista_final:
        payload_vazio = {
            "token": token,
            "modulo": "fogo_prometheus",
            "data_referencia": dt_ini,
            "total_publicacoes": 0,
            "publicacoes": []
        }
        resp = requests.post(webhook_url, json=payload_vazio, timeout=90)
        print(f"[WEBHOOK GAS - Lote Vazio] Status {resp.status_code}: {resp.text}")
        return

    for idx in range(0, len(lista_final), MAX_PDFS_POR_LOTE_WEBHOOK):
        fatia = lista_final[idx:idx + MAX_PDFS_POR_LOTE_WEBHOOK]
        payload = {
            "token": token,
            "modulo": "fogo_prometheus",
            "data_referencia": dt_ini,
            "total_publicacoes": len(fatia),
            "publicacoes": fatia
        }
        for tentativa in range(1, 4):
            try:
                resp = requests.post(webhook_url, json=payload, timeout=90)
                print(f"[WEBHOOK GAS - Lote {idx // MAX_PDFS_POR_LOTE_WEBHOOK + 1}] Status {resp.status_code}: {resp.text}")
                break
            except requests.RequestException as err:
                print(f"[AVISO] Falha na tentativa {tentativa}/3 de envio ao Webhook: {err}")
                if tentativa < 3:
                    time.sleep(3 * tentativa)


def sincronizar_supabase_publicacoes(publicacoes: list, dt_referencia: str) -> bool:
    """Realiza batch upsert atômico das matérias mineradas na tabela publicacoes_diario do Supabase."""
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("[SUPABASE] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados. Pulando persistência direta no Supabase.")
        return False

    if not publicacoes:
        print("[SUPABASE] Nenhuma publicação para sincronizar nesta execução.")
        return True

    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/publicacoes_diario"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    # Converter para o schema de publicacoes_diario
    lote = []
    for pub in publicacoes:
        data_pub = pub.get("data_publicacao") or dt_referencia
        if "/" in str(data_pub):
            partes = str(data_pub).split("/")
            if len(partes) == 3:
                data_pub = f"{partes[2]}-{partes[1]}-{partes[0]}"

        entidades = pub.get("entidades_ner") or {}
        servidores = entidades.get("servidores") or []
        if isinstance(servidores, str):
            servidores = [servidores]

        lote.append({
            "data_publicacao": data_pub,
            "edicao": str(pub.get("codigo_identificador", "")),
            "titulo": str(pub.get("titulo_ato") or pub.get("codigo_identificador", "Publicação SMEB")),
            "ato_tipo": str(pub.get("categoria", "Ato Oficial")),
            "servidores_envolvidos": servidores,
            "conteudo_ner": {
                "codigo_identificador": pub.get("codigo_identificador"),
                "entidade": pub.get("entidade"),
                "orgao": pub.get("orgao"),
                "url_materia": pub.get("url_materia"),
                "link_pdf": pub.get("link_pdf"),
                "numero_ato": entidades.get("numero_ato"),
                "resumo_texto": pub.get("resumo_texto", "")[:1000] if pub.get("resumo_texto") else ""
            }
        })

    chunk_size = 50
    sucesso_total = True
    for i in range(0, len(lote), chunk_size):
        chunk = lote[i:i + chunk_size]
        try:
            resp = requests.post(endpoint, json=chunk, headers=headers, timeout=60)
            if 200 <= resp.status_code < 300:
                print(f"[SUPABASE - Lote {i // chunk_size + 1}] {len(chunk)} publicações gravadas com sucesso (HTTP {resp.status_code}).")
            else:
                print(f"[SUPABASE ERRO - Lote {i // chunk_size + 1}] HTTP {resp.status_code}: {resp.text}")
                sucesso_total = False
        except Exception as err:
            print(f"[SUPABASE EXCEPTION] Erro de comunicação: {err}")
            sucesso_total = False

    return sucesso_total


def main():
    todas_publicacoes = []
    urls_ja_processadas = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(locale="pt-BR")
        page = context.new_page()

        # Ciclo 1: Prefeitura -> Secretaria Municipal de Educação Básica (100% dos atos)
        todas_publicacoes.extend(executar_ciclo_pesquisa(
            page,
            entidade_alvo="Prefeitura Municipal de Ceará-Mirim",
            orgao_alvo="Secretaria Municipal de Educação Básica",
            aplicar_filtro_keywords=False,
            urls_ja_processadas=urls_ja_processadas
        ))

        # Ciclo 2: Prefeitura -> Gabinete do Prefeito (Filtrado para Educação/SMEB)
        todas_publicacoes.extend(executar_ciclo_pesquisa(
            page,
            entidade_alvo="Prefeitura Municipal de Ceará-Mirim",
            orgao_alvo="Gabinete do Prefeito",
            aplicar_filtro_keywords=True,
            lista_keywords=KEYWORDS_EDUCACAO,
            urls_ja_processadas=urls_ja_processadas
        ))

        # Ciclo 3: Câmara Municipal de Ceará-Mirim (Filtrado Legislativo Educacional)
        todas_publicacoes.extend(executar_ciclo_pesquisa(
            page,
            entidade_alvo="Câmara Municipal de Ceará-Mirim",
            orgao_alvo=None,
            aplicar_filtro_keywords=True,
            lista_keywords=KEYWORDS_LEGISLATIVO,
            urls_ja_processadas=urls_ja_processadas
        ))

        browser.close()

    # Deduplicar por código identificador
    unicos = {pub["codigo_identificador"]: pub for pub in todas_publicacoes}
    lista_final = list(unicos.values())

    dt_ini, _ = obter_intervalo_datas()

    # Persistência Atômica no Supabase (se configurado)
    sincronizar_supabase_publicacoes(lista_final, dt_ini)

    webhook_url = os.getenv("GAS_WEBHOOK_URL")
    token = os.getenv("OLYMPOS_SECRET_TOKEN")
    chat_webhook_url = os.getenv("GOOGLE_CHAT_WEBHOOK_URL", "").strip()

    if webhook_url:
        enviar_lotes_webhook(webhook_url, token, dt_ini, lista_final)
    else:
        payload = {
            "token": token,
            "modulo": "fogo_prometheus",
            "data_referencia": dt_ini,
            "total_publicacoes": len(lista_final),
            "publicacoes": lista_final
        }
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    # Sugestão 3.4.3: Enviar resumo executivo para o Espaço do Google Chat (se configurado via Secret)
    if chat_webhook_url:
        enviar_resumo_espaco_google_chat(chat_webhook_url, dt_ini, lista_final)


if __name__ == "__main__":
    main()
