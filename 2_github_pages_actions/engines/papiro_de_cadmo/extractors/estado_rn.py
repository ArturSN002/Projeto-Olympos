"""
Extrator de Alta Performance para o Portal de Remuneração do Governo do Estado do RN.
Portal: https://remuneracao.rn.gov.br/
API Oficial: https://api.remuneracao.rn.gov.br/
Foco: SECRETARIA DA EDUC, DA CULT, DO ESPORTE E DO LAZER (SEEC)
"""
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from dateutil.relativedelta import relativedelta
import urllib3
import requests

from .base import BaseExtractor

# Suprime avisos de certificado SSL expirado do portal oficial do RN
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class EstadoRNExtractor(BaseExtractor):
    """
    Extrator resiliente para o Governo do Estado do RN via API REST direta,
    com consumo do ID oficial da SEEC, tolerância a SSL expirado,
    controle de rate-limiting OpenResty (HTTP 429) com retry de 5s e fallback mensal retroativo.
    """

    ID_SEEC_PADRAO = "28049427"
    API_BASE_URL = "https://api.remuneracao.rn.gov.br"

    def __init__(self, config: Dict[str, Any], output_dir: Path):
        super().__init__(config, output_dir)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/csv, application/json, */*",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        })

    def _baixar_csv_orgao(self, mes: str, ano: str, orgao_id: str = ID_SEEC_PADRAO, max_retries: int = 5) -> Optional[bytes]:
        """Executa a requisição do CSV com tratamento de HTTP 429 (Rate Limit OpenResty) com retry após 5 segundos."""
        url = f"{self.API_BASE_URL}/ExportarPorOrgao?mes={mes}&ano={ano}&id={orgao_id}"

        for tentativa in range(1, max_retries + 1):
            try:
                resp = self.session.get(url, verify=False, timeout=60)
                if resp.status_code == 200:
                    return resp.content
                elif resp.status_code == 429:
                    self.logger.warning(
                        f"HTTP 429 (Rate Limit OpenResty) da API do RN. Aguardando 5s "
                        f"(tentativa {tentativa}/{max_retries})..."
                    )
                    time.sleep(5)
                else:
                    self.logger.warning(f"API retornou status HTTP {resp.status_code} para {mes}/{ano}.")
                    if tentativa < max_retries:
                        time.sleep(2)
            except Exception as e:
                self.logger.warning(f"Erro na tentativa {tentativa} de download do CSV ({mes}/{ano}): {e}")
                if tentativa < max_retries:
                    time.sleep(2)

        return None

    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        """
        Executa a extração da SEEC com fallback retroativo caso a competência
        solicitada ainda não possua folha fechada no portal estadual.
        """
        dt_base = self.obter_data_referencia_inicial(competencia_override)
        max_retrocesso = int(self.config.get("max_retrocesso_meses", 6))

        for offset in range(max_retrocesso):
            dt_atual = dt_base - relativedelta(months=offset)
            mes = dt_atual.strftime("%m")
            ano = dt_atual.strftime("%Y")
            comp_iso = dt_atual.strftime("%Y-%m")
            comp_br = dt_atual.strftime("%m/%Y")

            self.logger.info(f"Tentando extração da SEEC/RN para competência {comp_br} (offset -{offset})...")

            csv_bytes = self._baixar_csv_orgao(mes, ano, self.ID_SEEC_PADRAO)

            if not csv_bytes:
                self.logger.warning(f"Não foi possível obter resposta válida para a competência {comp_br}.")
                return None

            # Validação do conteúdo retornado
            try:
                texto = csv_bytes.decode("utf-8", errors="replace")
                linhas = [l for l in texto.splitlines() if l.strip()]

                # Fallback retroativo: se tiver apenas o cabeçalho (1 linha) ou mensagem informativa, a folha não foi fechada
                if len(linhas) < 2 or "Não há registros a serem exibidos" in texto:
                    self.logger.info(
                        f"Competência {comp_br} sem folha fechada ou sem servidores (linhas={len(linhas)}). "
                        "Recuando para o mês anterior..."
                    )
                    time.sleep(2)
                    continue

                output_file = self.output_dir / f"estado_rn_{comp_iso}.csv"
                output_file.write_bytes(csv_bytes)

                if self.validar_csv_valido(output_file):
                    self.logger.info(
                        f"Coleta do Governo do RN (SEEC) concluída com sucesso: {output_file.name} "
                        f"({len(linhas)} linhas, {len(csv_bytes)} bytes)."
                    )
                    return output_file
                else:
                    self.logger.warning(f"Arquivo gerado para {comp_br} não passou na validação. Removendo...")
                    output_file.unlink(missing_ok=True)
            except Exception as e:
                self.logger.error(f"Erro ao processar dados baixados da competência {comp_br}: {e}")

            time.sleep(2)

        self.logger.error("Falha ao extrair dados da SEEC/RN: nenhuma competência válida encontrada após retrocessos.")
        return None

    # Alias para compatibilidade de interface
    extract = extrair
