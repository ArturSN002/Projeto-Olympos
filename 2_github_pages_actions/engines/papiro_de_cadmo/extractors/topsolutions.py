"""
Extrator para a plataforma TopSolutions RN.
Atende: Ceará-Mirim, Parnamirim, Macaíba, Extremoz, Nísia Floresta, Monte Alegre,
Ielmo Marinho, São Paulo do Potengi, João Câmara, Poço Branco, Taipú, Touros e Rio do Fogo.

Estratégia em 3 camadas por competência:
1. API JSON oficial TopSolutions (`https://<tenant>.apitransparencia.topsolutionsrn.com.br/Servidor/ServidorPorMesAnoAsync`)
2. Busca HTTP direta por link de exportação CSV no HTML
3. Fallback opcional via Playwright (apenas quando habilitado ou na primeira tentativa)
"""
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
import pandas as pd
from bs4 import BeautifulSoup
from .base import BaseExtractor


class TopSolutionsExtractor(BaseExtractor):
    @staticmethod
    def _derivar_api_url(base_url: str) -> Optional[str]:
        """Converte `https://<tenant>.transparencia.topsolutionsrn.com.br` na URL da API JSON correspondente."""
        limpa = (base_url or "").strip().rstrip("/")
        marcador = ".transparencia.topsolutionsrn.com.br"
        if marcador in limpa:
            host_api = limpa.replace(marcador, ".apitransparencia.topsolutionsrn.com.br")
            return f"{host_api}/Servidor/ServidorPorMesAnoAsync"
        return None

    def _tentar_api_json(self, base_url: str, comp_iso: str, output_file: Path) -> Optional[Path]:
        """Consulta diretamente a API REST TopSolutions (`ServidorPorMesAnoAsync`) e grava CSV padronizado."""
        api_endpoint = self.config.get("api_url") or self._derivar_api_url(base_url)
        if not api_endpoint:
            return None

        partes = comp_iso.split("-")
        if len(partes) != 2:
            return None

        try:
            num_ano = int(partes[0])
            num_mes = int(partes[1])
        except ValueError:
            return None

        try:
            with httpx.Client(
                timeout=35.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Accept": "application/json, text/plain, */*",
                    "Origin": base_url,
                    "Referer": f"{base_url}/",
                },
            ) as client:
                resp = client.get(api_endpoint, params={"numMes": num_mes, "numAno": num_ano})
                if resp.status_code != 200:
                    return None

                payload = resp.json()
                itens: List[Dict[str, Any]] = []
                if isinstance(payload, dict):
                    dados = payload.get("data")
                    if isinstance(dados, list):
                        itens = dados
                    elif isinstance(dados, dict) and isinstance(dados.get("items"), list):
                        itens = dados["items"]
                elif isinstance(payload, list):
                    itens = payload

                if not itens:
                    return None

                linhas = []
                for item in itens:
                    if not isinstance(item, dict):
                        continue
                    nome = str(item.get("nome") or item.get("nomeServidor") or "").strip()
                    if not nome:
                        continue
                    matricula = str(
                        item.get("numMatricula")
                        or item.get("matricula")
                        or item.get("codigo")
                        or ""
                    ).strip()
                    cpf = str(item.get("cpf") or item.get("cpfMascarado") or "").strip()
                    orgao = str(
                        item.get("orgao")
                        or item.get("secretaria")
                        or item.get("lotacao")
                        or item.get("unidade")
                        or ""
                    ).strip()
                    cargo_funcao = str(
                        item.get("cargoFuncao")
                        or item.get("cargo")
                        or item.get("funcao")
                        or ""
                    ).strip()
                    carga_horaria = str(item.get("cargaHoraria") or item.get("jornada") or "").strip()
                    vinculo = str(item.get("vinculo") or item.get("tipoVinculo") or "Ativo").strip()
                    situacao = str(item.get("dataInativacaoExoneracao") or item.get("situacao") or "Ativo").strip()

                    linhas.append({
                        "Matricula": matricula,
                        "Nome": nome,
                        "CPF": cpf,
                        "OrgaoLotacao": orgao,
                        "CargoFuncao": cargo_funcao,
                        "Carga Horaria": carga_horaria,
                        "Vinculo": vinculo,
                        "Data de InativacaoExoneracao": situacao,
                    })

                if not linhas:
                    return None

                df = pd.DataFrame(linhas)
                df.to_csv(output_file, sep=";", index=False, encoding="utf-8-sig")
                if self.validar_csv_valido(output_file):
                    self.logger.info(
                        f"API TopSolutions: {len(df)} servidores salvos em {output_file.name} ({comp_iso})"
                    )
                    return output_file
                output_file.unlink(missing_ok=True)
        except Exception as e:
            self.logger.debug(f"Tentativa API JSON TopSolutions falhou para {comp_iso}: {e}")

        return None

    def _tentar_extrair_mes(self, comp_br: str, comp_iso: str, permitir_playwright: bool = False) -> Optional[Path]:
        ente_id = self.config["id"]
        base_url = self.config["url"].rstrip("/")
        target_url = f"{base_url}/servidores?data={comp_br}"
        output_file = self.output_dir / f"{ente_id}_{comp_iso}.csv"

        # 1. Tentativa primária via API JSON TopSolutions (`apitransparencia.topsolutionsrn.com.br`)
        arquivo_api = self._tentar_api_json(base_url, comp_iso, output_file)
        if arquivo_api and self.validar_csv_valido(arquivo_api):
            return arquivo_api

        # 2. Tentativa via HTTPX direto buscando botão/link de exportação CSV
        try:
            with httpx.Client(
                timeout=25.0,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            ) as client:
                resp = client.get(target_url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    csv_link = None
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        if "csv" in href.lower() or "export" in href.lower() or "download" in href.lower():
                            csv_link = href if href.startswith("http") else f"{base_url}/{href.lstrip('/')}"
                            break

                    if csv_link:
                        self.logger.info(f"Link direto de CSV localizado: {csv_link}")
                        download_resp = client.get(csv_link)
                        if download_resp.status_code == 200 and len(download_resp.content) > 50:
                            output_file.write_bytes(download_resp.content)
                            if self.validar_csv_valido(output_file):
                                self.logger.info(
                                    f"CSV salvo com sucesso via HTTP direto: {output_file.name} ({len(download_resp.content)} bytes)"
                                )
                                return output_file
                            output_file.unlink(missing_ok=True)
        except Exception as e:
            self.logger.debug(f"Tentativa HTTP rápida em {ente_id} ({comp_br}) falhou: {e}")

        # 3. Fallback via Playwright apenas quando solicitado explicitamente
        usar_pw = permitir_playwright or os.getenv("PAPIRO_PLAYWRIGHT_FALLBACK", "0") == "1"
        if not usar_pw:
            return None

        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()

                self.logger.debug(f"Navegando via Playwright para {target_url}...")
                page.goto(target_url, wait_until="networkidle", timeout=25000)

                selectors = [
                    "a:has-text('CSV')",
                    "button:has-text('CSV')",
                    "a:has-text('Exportar')",
                    "button:has-text('Exportar')",
                    "a[href*='csv']",
                    "button[onclick*='csv']",
                ]

                download_sucesso = False
                for sel in selectors:
                    locator = page.locator(sel).first
                    if locator.count() > 0 and locator.is_visible():
                        try:
                            with page.expect_download(timeout=15000) as download_info:
                                locator.click()
                            download = download_info.value
                            download.save_as(str(output_file))
                            if self.validar_csv_valido(output_file):
                                self.logger.info(f"Download concluído via Playwright: {output_file.name}")
                                download_sucesso = True
                                break
                            output_file.unlink(missing_ok=True)
                        except Exception as dl_err:
                            self.logger.debug(f"Falha ao capturar download no seletor {sel}: {dl_err}")

                browser.close()
                if download_sucesso and output_file.exists():
                    return output_file

        except Exception as pw_err:
            self.logger.debug(f"Falha no Playwright para {ente_id} ({comp_br}): {pw_err}")

        return None

    def extrair_com_fallback(self, competencia_override: Optional[str] = None, max_retrocesso: Optional[int] = None) -> Optional[Path]:
        ente_nome = self.config.get("ente", self.config.get("id", "desconhecido"))
        limite_retrocesso = int(max_retrocesso if max_retrocesso is not None else self.config.get("max_retrocesso_meses", 24))

        self.logger.info(f"[{ente_nome}] Iniciando busca de folha com fallback mensal (até {limite_retrocesso} meses)...")

        for offset in range(limite_retrocesso + 1):
            comp_br, comp_iso = self.calcular_competencia(competencia_override, offset_meses_adicional=offset)
            self.logger.info(f"[{ente_nome}] Tentando competência {comp_br} (recuo: {offset} mês(es))...")

            arquivo = self._tentar_extrair_mes(comp_br, comp_iso)
            if arquivo and self.validar_csv_valido(arquivo):
                self.logger.info(f"[{ente_nome}] SUCESSO! Listagem recuperada na competência {comp_br} -> {arquivo.name}")
                return arquivo

        if "competencia_fixa_fallback" in self.config and self.config["competencia_fixa_fallback"]:
            fb = self.config["competencia_fixa_fallback"].strip()
            fb_br, fb_iso = self.calcular_competencia(fb)
            self.logger.info(f"[{ente_nome}] Tentando competência fixa configurada: {fb_br}...")
            arquivo_fb = self._tentar_extrair_mes(fb_br, fb_iso)
            if arquivo_fb and self.validar_csv_valido(arquivo_fb):
                return arquivo_fb

        self.logger.error(f"[{ente_nome}] Nenhuma listagem disponível encontrada após retroceder {limite_retrocesso} meses.")
        return None

    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        return self.extrair_com_fallback(competencia_override=competencia_override)
