"""
Extrator para a plataforma TopSolutions RN.
Atende: Ceará-Mirim, Parnamirim, Macaíba, Extremoz, Nísia Floresta, Monte Alegre,
Ielmo Marinho, São Paulo do Potengi, João Câmara, Poço Branco, Taipú, Touros e Rio do Fogo.
"""
from pathlib import Path
from typing import Optional, Dict, Any
import httpx
from bs4 import BeautifulSoup
from .base import BaseExtractor


class TopSolutionsExtractor(BaseExtractor):
    def _tentar_extrair_mes(self, comp_br: str, comp_iso: str) -> Optional[Path]:
        ente_id = self.config["id"]
        base_url = self.config["url"].rstrip("/")
        target_url = f"{base_url}/servidores?data={comp_br}"
        output_file = self.output_dir / f"{ente_id}_{comp_iso}.csv"

        # 1. Tentativa via HTTPX direto buscando botão/link de exportação CSV
        try:
            with httpx.Client(timeout=30.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}) as client:
                resp = client.get(target_url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    # Busca por links com csv ou export
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
                                self.logger.info(f"CSV salvo com sucesso via HTTP direto: {output_file.name} ({len(download_resp.content)} bytes)")
                                return output_file
                            output_file.unlink(missing_ok=True)
        except Exception as e:
            self.logger.debug(f"Tentativa HTTP rápida em {ente_id} ({comp_br}) falhou: {e}")

        # 2. Fallback via Playwright para captura de download acionado por JS
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()

                self.logger.debug(f"Navegando via Playwright para {target_url}...")
                page.goto(target_url, wait_until="networkidle", timeout=30000)

                # Procura seletores usuais de botões de exportação CSV
                selectors = [
                    "a:has-text('CSV')",
                    "button:has-text('CSV')",
                    "a:has-text('Exportar')",
                    "button:has-text('Exportar')",
                    "a[href*='csv']",
                    "button[onclick*='csv']"
                ]

                download_sucesso = False
                for sel in selectors:
                    locator = page.locator(sel).first
                    if locator.count() > 0 and locator.is_visible():
                        try:
                            with page.expect_download(timeout=20000) as download_info:
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

        # Tentativa final com competencia_fixa_fallback se configurada
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
