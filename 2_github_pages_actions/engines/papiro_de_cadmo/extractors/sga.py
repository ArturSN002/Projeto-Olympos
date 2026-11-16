"""
Extrator para o portal de São Gonçalo do Amarante.
Referência: https://saogoncalodoamarante.ce.gov.br/servidores_nominal.php (ou portal municipal RN correlato).
"""
from pathlib import Path
from typing import Optional
import httpx
from bs4 import BeautifulSoup
import pandas as pd
from .base import BaseExtractor


class SgaExtractor(BaseExtractor):
    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        comp_br, comp_iso = self.calcular_competencia(competencia_override)
        output_file = self.output_dir / f"sga_{comp_iso}.csv"
        url = self.config.get("url", "https://saogoncalodoamarante.ce.gov.br/servidores_nominal.php")

        self.logger.info(f"Iniciando coleta de São Gonçalo do Amarante ({comp_br})...")

        try:
            with httpx.Client(timeout=45.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    # Procura link de exportação ou tabela nominal
                    csv_link = None
                    for a in soup.find_all("a", href=True):
                        h = a["href"].lower()
                        if "csv" in h or "exportar" in h or "download" in h:
                            csv_link = a["href"]
                            break

                    if csv_link:
                        if not csv_link.startswith("http"):
                            from urllib.parse import urljoin
                            csv_link = urljoin(url, csv_link)
                        dl = client.get(csv_link)
                        if dl.status_code == 200 and len(dl.content) > 50:
                            output_file.write_bytes(dl.content)
                            self.logger.info(f"CSV de SGA salvo: {output_file.name}")
                            return output_file

                    # Se for tabela HTML direta
                    tabelas = soup.find_all("table")
                    if tabelas:
                        dfs = pd.read_html(str(tabelas[0]))
                        if dfs and len(dfs[0]) > 0:
                            df = dfs[0]
                            df.to_csv(output_file, index=False, encoding="utf-8-sig")
                            self.logger.info(f"Tabela de SGA convertida em CSV ({len(df)} registros)")
                            return output_file

        except Exception as e:
            self.logger.error(f"Erro ao extrair dados de SGA: {e}")

        return None
