"""
Extrator para o Portal de Remuneração do Governo do Estado do RN (SEAD/COPES).
Referência: https://remuneracao.rn.gov.br/table-people
Foco prioritário: SEEC (Secretaria de Estado da Educação, do Esporte e do Lazer).
"""
from pathlib import Path
from typing import Optional
from .base import BaseExtractor


class EstadoRNExtractor(BaseExtractor):
    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        comp_br, comp_iso = self.calcular_competencia(competencia_override)
        output_file = self.output_dir / f"estado_rn_{comp_iso}.csv"
        url = self.config.get("url", "https://remuneracao.rn.gov.br/").rstrip("/")
        target_url = f"{url}/table-people" if "table-people" not in url else url

        self.logger.info(f"Iniciando coleta do Governo do Estado do RN (SEEC) para competência {comp_br}...")

        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(accept_downloads=True)
                page = context.new_page()

                self.logger.info(f"Navegando para {target_url}...")
                page.goto(target_url, wait_until="networkidle", timeout=60000)

                # 1. Espera os campos de filtro carregarem
                page.wait_for_timeout(3000)

                # 2. Seleção de Poder Executivo / Secretaria SEEC se seletores existirem
                try:
                    # Busca por campos dropdown ou inputs de órgão
                    orgao_input = page.locator("input[placeholder*='Órgão'], select[name*='orgao'], .p-dropdown:has-text('Órgão')").first
                    if orgao_input.count() > 0:
                        orgao_input.click()
                        page.wait_for_timeout(1000)
                        # Tenta selecionar SEEC
                        seec_opt = page.locator("li:has-text('EDUCAÇÃO'), span:has-text('SEEC'), option:has-text('EDUCAÇÃO')").first
                        if seec_opt.count() > 0:
                            seec_opt.click()
                            self.logger.info("Órgão SEEC selecionado com sucesso.")
                except Exception as e:
                    self.logger.warning(f"Aviso ao filtrar órgão no portal estadual: {e}")

                # 3. Disparo do download do CSV
                btn_exportar = page.locator("button:has-text('CSV'), a:has-text('CSV'), button:has-text('Exportar')").first
                if btn_exportar.count() > 0 and btn_exportar.is_visible():
                    with page.expect_download(timeout=60000) as download_info:
                        btn_exportar.click()
                    download = download_info.value
                    download.save_as(str(output_file))
                    self.logger.info(f"Download do CSV estadual finalizado: {output_file.name}")
                    browser.close()
                    return output_file

                browser.close()
        except Exception as e:
            self.logger.error(f"Erro ao extrair dados do Estado do RN via Playwright: {e}")

        return None
