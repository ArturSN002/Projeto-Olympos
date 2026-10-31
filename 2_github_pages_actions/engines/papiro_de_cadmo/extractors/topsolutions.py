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
    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        comp_br, comp_iso = self.calcular_competencia(competencia_override)
        ente_id = self.config["id"]
        base_url = self.config["url"].rstrip("/")
        target_url = f"{base_url}/servidores?data={comp_br}"
        output_file = self.output_dir / f"{ente_id}_{comp_iso}.csv"

        self.logger.info(f"Iniciando coleta de {self.config['ente']} para competência {comp_br}...")

        # 1. Tentativa via HTTPX direto buscando botão/link de exportação CSV
        try:
            with httpx.Client(timeout=45.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}) as client:
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
                            self.logger.info(f"CSV salvo com sucesso via HTTP direto: {output_file.name} ({len(download_resp.content)} bytes)")
                            return output_file
        except Exception as e:
            self.logger.warning(f"Tentativa HTTP direta em {ente_id} falhou ({e}). Tentando Playwright headless...")

        # 2. Fallback via Playwright para captura de download acionado por JS
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()

                self.logger.info(f"Navegando via Playwright para {target_url}...")
                page.goto(target_url, wait_until="networkidle", timeout=60000)

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
                        self.logger.info(f"Acionando botão de exportação ({sel})...")
                        try:
                            with page.expect_download(timeout=30000) as download_info:
                                locator.click()
                            download = download_info.value
                            download.save_as(str(output_file))
                            self.logger.info(f"Download concluído via Playwright: {output_file.name}")
                            download_sucesso = True
                            break
                        except Exception as dl_err:
                            self.logger.warning(f"Falha ao capturar download no seletor {sel}: {dl_err}")

                browser.close()
                if download_sucesso and output_file.exists():
                    return output_file

        except Exception as pw_err:
            self.logger.error(f"Falha no Playwright para {ente_id}: {pw_err}")

        self.logger.error(f"Não foi possível extrair o CSV de {self.config['ente']} ({comp_br}).")
        return None
