"""
Extrator para o Portal/API de Transparência da Prefeitura Municipal de Natal.
Referência: https://www2.natal.rn.gov.br/transparenciaapi/folha_pagamentos
Foco: Lotações com variações de 'SME' (~17 opções da Secretaria Municipal de Educação).
Suporta tanto endpoint JSON direto (com resiliência UTF-8 / ISO-8859-1) quanto o
fluxo XHR/jqGrid CakePHP oficial do portal (`getMeses` -> `getLotacoes` -> `POST /pesquisar`).
"""
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.parse
import httpx
import pandas as pd
from .base import BaseExtractor


LOTACOES_SME_PADRAO = [
    "SME - ADMINISTRAÇÃO GERAL",
    "SME - ED. INFANTIL FNDE",
    "SME - EDUCACAO FUNDEF",
    "SME - EDUC INFANTIL CRECHE",
    "SME - EDUC INFANTIL PRE ESCOLA",
    "SME - EJA",
    "SME - EJA ENSINO FUNDAMENTAL",
    "SME - ENSINO FUNDAMENTAL",
    "SME - ESTAGIARIOS TRIBUTO",
    "SME - FUNCIONARIOS",
    "SME FUNDEB - 40%",
    "SME - PROJOVEM",
    "SME-SECRETARIA DE EDUCACAO",
    "SME - TEMPO INTEGRAL",
    "SME - TEMPORARIOS EDUC INFANTIL",
    "SME - TEMPORARIOS EJA",
    "SME - TEMPORARIOS ENS FUNDAMENTAL",
]


class NatalExtractor(BaseExtractor):
    @staticmethod
    def _decodificar_json_resiliente(resp: Optional[httpx.Response]) -> Optional[Any]:
        """Decodifica JSON com tolerância a Latin-1 e UTF-8 BOM. Retorna None com segurança para HTML/erros/vazio."""
        if resp is None:
            return None
        raw = resp.content or b""
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        raw_strip = raw.strip()
        if not raw_strip:
            return None

        # Detecção de HTML/XML pré-parsing
        if raw_strip.startswith(b"<") or b"<html" in raw_strip[:300].lower() or b"<!doctype" in raw_strip[:300].lower():
            return None

        content_type = (resp.headers.get("content-type") or "").lower() if hasattr(resp, "headers") else ""
        if "text/html" in content_type or "text/xml" in content_type:
            return None

        # 1. Tentativa padrão httpx
        try:
            return resp.json()
        except Exception:
            pass

        # 2. Tentativa UTF-8 explícita
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            pass

        # 3. Tentativa ISO-8859-1 (Latin-1) para servidores legados CakePHP
        try:
            return json.loads(raw.decode("latin-1", errors="replace"))
        except Exception:
            pass

        return None

    @staticmethod
    def _eh_lotacao_educacao(lotacao: str) -> bool:
        lot_up = (lotacao or "").upper()
        return "SME" in lot_up or "EDUCACAO" in lot_up or "EDUCAÇÃO" in lot_up or "EDUCA" in lot_up

    def _coletar_via_cakephp_jqgrid(
        self,
        client: httpx.Client,
        api_url: str,
        ano: str,
        mes: str,
        comp_iso: str,
    ) -> List[Dict[str, Any]]:
        """
        Extrai servidores da SME de Natal usando os endpoints XHR/jqGrid do portal CakePHP:
        1. GET /getMeses/{ano}/9 -> valida se o mês (inteiro sem zero à esquerda) já foi publicado
        2. GET /getLotacoes/{ano}/{mes_int}/9 -> obtém as lotações da SME disponíveis na competência
        3. POST /pesquisar -> pagina o jqGrid (`rows=2000`) consolidando matrícula, nome, cargo e lotação
        """
        base = api_url.rstrip("/")
        mes_int = str(int(mes))
        xhr_headers = {
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        }

        # 1. Verifica meses publicados no ano para evitar iterações desnecessárias
        try:
            r_meses = client.get(f"{base}/getMeses/{ano}/9", headers=xhr_headers)
            if r_meses.status_code == 200:
                dados_meses = self._decodificar_json_resiliente(r_meses)
                if isinstance(dados_meses, dict) and dados_meses:
                    chaves_meses = {str(int(k)) for k in dados_meses.keys() if str(k).strip().isdigit()}
                    if chaves_meses and mes_int not in chaves_meses:
                        self.logger.info(
                            f"[Natal] Competência {comp_iso} ainda não consta nos meses publicados de {ano} ({sorted(chaves_meses, key=int)})."
                        )
                        return []
                elif isinstance(dados_meses, list) and len(dados_meses) == 0:
                    return []
        except Exception as e_mes:
            self.logger.debug(f"[Natal] Aviso ao consultar getMeses/{ano}/9: {e_mes}")

        # 2. Obtém lotações da SME na competência
        lotacoes_sme: List[str] = []
        try:
            r_lot = client.get(f"{base}/getLotacoes/{ano}/{mes_int}/9", headers=xhr_headers)
            if r_lot.status_code == 200:
                dados_lot = self._decodificar_json_resiliente(r_lot)
                if isinstance(dados_lot, dict):
                    for chave, rotulo in dados_lot.items():
                        texto_ref = f"{chave} {rotulo}"
                        if self._eh_lotacao_educacao(texto_ref):
                            lotacoes_sme.append(str(chave))
        except Exception as e_lot:
            self.logger.debug(f"[Natal] Aviso ao consultar getLotacoes/{ano}/{mes_int}/9: {e_lot}")

        if not lotacoes_sme:
            lotacoes_sme = list(LOTACOES_SME_PADRAO)

        registros: List[Dict[str, Any]] = []
        vistos = set()

        # 3. Consulta POST /pesquisar para cada lotação SME
        for lot_chave in lotacoes_sme:
            pagina = 1
            while pagina <= 25:
                form_fields = {
                    "instituicao": "9",
                    "ano": str(ano),
                    "mes": mes_int,
                    "demitidos": "0",
                    "cargo": "",
                    "lotacao": lot_chave,
                    "vinculo": "",
                    "matricula": "",
                    "nome": "",
                    "page": str(pagina),
                    "rows": "1000",
                    "sidx": "Servidor.nome",
                    "sord": "asc",
                }
                try:
                    r_grid = client.post(f"{base}/pesquisar", headers=xhr_headers, data=form_fields)
                except (httpx.HTTPError, httpx.TimeoutException, Exception) as e_post:
                    self.logger.warning(f"[Natal] Erro na requisição POST jqGrid (página {pagina}): {e_post}")
                    break

                if r_grid.status_code != 200:
                    break

                grid_json = self._decodificar_json_resiliente(r_grid)
                # Caso a lotação possua acentos em tabela Latin-1 no CakePHP e retorne 0 em UTF-8, tenta encoding Latin-1
                if (
                    pagina == 1
                    and isinstance(grid_json, dict)
                    and str(grid_json.get("records", "0")) == "0"
                    and any(ord(ch) > 127 for ch in lot_chave)
                ):
                    try:
                        corpo_latin1 = urllib.parse.urlencode(form_fields, encoding="latin-1", errors="replace").encode("ascii")
                        headers_latin1 = {
                            **xhr_headers,
                            "Content-Type": "application/x-www-form-urlencoded; charset=ISO-8859-1",
                        }
                        r_grid_l1 = client.post(f"{base}/pesquisar", headers=headers_latin1, content=corpo_latin1)
                        if r_grid_l1.status_code == 200:
                            grid_json_l1 = self._decodificar_json_resiliente(r_grid_l1)
                            if isinstance(grid_json_l1, dict) and int(str(grid_json_l1.get("records", "0") or 0)) > 0:
                                grid_json = grid_json_l1
                    except Exception as e_latin1:
                        self.logger.debug(f"[Natal] Falha ao tentar requisição Latin-1 no jqGrid: {e_latin1}")

                if not isinstance(grid_json, dict):
                    break

                rows = grid_json.get("rows") or []
                if not isinstance(rows, list) or not rows:
                    break

                for row in rows:
                    cell = row.get("cell") if isinstance(row, dict) else None
                    if not isinstance(cell, list) or len(cell) < 4:
                        continue

                    # Layout jqGrid Natal: [matricula, nome, cargo, lotacao, ...] ou [agrupador, matricula, nome, cargo, lotacao, ...]
                    if len(cell) >= 5 and str(cell[0]).strip() == "" and str(cell[1]).strip():
                        matricula = str(cell[1]).strip()
                        nome = str(cell[2]).strip().upper()
                        cargo = str(cell[3]).strip().upper()
                        lotacao_item = str(cell[4]).strip().upper()
                    else:
                        matricula = str(cell[0]).strip()
                        nome = str(cell[1]).strip().upper()
                        cargo = str(cell[2]).strip().upper()
                        lotacao_item = str(cell[3]).strip().upper()

                    if not nome:
                        continue

                    chave_unica = (matricula, nome, cargo, lotacao_item)
                    if chave_unica in vistos:
                        continue
                    vistos.add(chave_unica)

                    registros.append({
                        "ente_origem": "Natal",
                        "competencia": comp_iso,
                        "matricula": matricula,
                        "nome_completo": nome,
                        "cargo_funcao": cargo,
                        "carga_horaria": "30h",
                        "lotacao_orgao": lotacao_item or lot_chave.upper(),
                        "situacao_vinculo": "ATIVO",
                    })

                try:
                    total_paginas = int(str(grid_json.get("total", "1") or 1))
                except ValueError:
                    total_paginas = 1

                if pagina >= total_paginas:
                    break
                pagina += 1

        return registros

    def _tentar_extrair_mes(self, comp_iso: str) -> Optional[Path]:
        output_file = self.output_dir / f"natal_{comp_iso}.csv"
        api_url = self.config.get("url", "https://www2.natal.rn.gov.br/transparenciaapi/folha_pagamentos")

        self.logger.info(f"Tentando coleta via API de Natal para competência {comp_iso} (filtro SME)...")

        registros_sme: List[Dict[str, Any]] = []
        partes = comp_iso.split("-")
        if len(partes) != 2:
            return None
        ano, mes = partes[0], partes[1]

        try:
            with httpx.Client(
                timeout=45.0,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            ) as client:
                params = {
                    "ano": ano,
                    "mes": mes,
                    "offset": 0,
                    "limit": 500,
                }

                usar_fluxo_jqgrid = False
                while True:
                    try:
                        resp = client.get(api_url, params=params)
                    except (httpx.HTTPError, httpx.TimeoutException, Exception) as e_req:
                        self.logger.warning(f"[Natal] Falha HTTP/rede na API primária ({e_req}). Acionando fluxo jqGrid...")
                        usar_fluxo_jqgrid = True
                        break

                    if resp.status_code != 200:
                        self.logger.warning(f"Resposta status {resp.status_code} da API de Natal para offset {params['offset']}. Acionando fluxo jqGrid...")
                        usar_fluxo_jqgrid = True
                        break

                    # Se o portal responder com HTML CakePHP ou resposta vazia em vez de JSON puro, comuta para o fluxo jqGrid XHR
                    raw_content = resp.content or b""
                    if raw_content.startswith(b"\xef\xbb\xbf"):
                        raw_content = raw_content[3:]
                    raw_strip = raw_content.strip()
                    if raw_strip.startswith(b"<") or not raw_strip:
                        usar_fluxo_jqgrid = True
                        break

                    # Correção resiliente para decodificar caracteres Latin-1 (ex: byte 0xe3 = 'ã') e suprimir JSONDecodeError
                    data = self._decodificar_json_resiliente(resp)
                    if data is None:
                        self.logger.info(f"[Natal] Resposta da API não é JSON válido (HTML/texto/vazio). Acionando transparentemente fluxo jqGrid...")
                        usar_fluxo_jqgrid = True
                        break

                    itens = (
                        (data.get("itens", []) or data.get("dados", []))
                        if isinstance(data, dict)
                        else (data if isinstance(data, list) else [])
                    )
                    if not itens:
                        break

                    for item in itens:
                        lotacao = str(item.get("lotacao", "") or item.get("orgao", "") or "").upper()
                        if self._eh_lotacao_educacao(lotacao):
                            registros_sme.append({
                                "ente_origem": "Natal",
                                "competencia": comp_iso,
                                "matricula": item.get("matricula", ""),
                                "nome_completo": str(item.get("nome", "")).upper().strip(),
                                "cargo_funcao": item.get("cargo", "") or item.get("funcao", ""),
                                "carga_horaria": item.get("carga_horaria", "30h"),
                                "lotacao_orgao": lotacao,
                                "situacao_vinculo": item.get("situacao", "ATIVO"),
                            })

                    if len(itens) < params["limit"]:
                        break

                    params["offset"] += params["limit"]
                    if params["offset"] > 25000:
                        break

                if usar_fluxo_jqgrid:
                    self.logger.info(f"[Natal] Portal retornou interface HTML; acionando extração XHR/jqGrid para {comp_iso}...")
                    registros_sme = self._coletar_via_cakephp_jqgrid(client, api_url, ano, mes, comp_iso)

            if registros_sme:
                df = pd.DataFrame(registros_sme)
                df.to_csv(output_file, index=False, encoding="utf-8-sig")
                if self.validar_csv_valido(output_file):
                    self.logger.info(f"API de Natal: {len(df)} servidores da SME extraídos e salvos em {output_file.name}")
                    return output_file
                output_file.unlink(missing_ok=True)
            else:
                self.logger.info(f"[Natal] Nenhum registro SME disponível para {comp_iso}.")

        except Exception as e:
            self.logger.error(f"Erro na extração de Natal ({comp_iso}): {e}")

        return None

    def extrair_com_fallback(self, competencia_override: Optional[str] = None, max_retrocesso: Optional[int] = None) -> Optional[Path]:
        limite_retrocesso = int(max_retrocesso if max_retrocesso is not None else self.config.get("max_retrocesso_meses", 24))
        self.logger.info(f"[Natal] Iniciando busca via API com fallback mensal (até {limite_retrocesso} meses)...")

        for offset in range(limite_retrocesso + 1):
            comp_br, comp_iso = self.calcular_competencia(competencia_override, offset_meses_adicional=offset)
            self.logger.info(f"[Natal] Tentando competência {comp_iso} ({comp_br}) (recuo: {offset} mês(es))...")

            arquivo = self._tentar_extrair_mes(comp_iso)
            if arquivo and self.validar_csv_valido(arquivo):
                self.logger.info(f"[Natal] SUCESSO! Folha recuperada na competência {comp_iso} -> {arquivo.name}")
                return arquivo

        self.logger.error(f"[Natal] Nenhuma listagem disponível encontrada após retroceder {limite_retrocesso} meses.")
        return None

    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        return self.extrair_com_fallback(competencia_override=competencia_override)
