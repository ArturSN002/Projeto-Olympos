"""
Extrator para a API de Transparência da Prefeitura Municipal de Natal.
Referência: https://www2.natal.rn.gov.br/transparenciaapi/folha_pagamentos
Foco: Lotações com variações de 'SME' (~17 opções da Secretaria Municipal de Educação).
"""
from pathlib import Path
from typing import Optional
import httpx
import pandas as pd
from .base import BaseExtractor


class NatalExtractor(BaseExtractor):
    def extrair(self, competencia_override: Optional[str] = None) -> Optional[Path]:
        comp_br, comp_iso = self.calcular_competencia(competencia_override)
        output_file = self.output_dir / f"natal_{comp_iso}.csv"
        api_url = self.config.get("url", "https://www2.natal.rn.gov.br/transparenciaapi/folha_pagamentos")

        self.logger.info(f"Iniciando coleta via API de Natal para competência {comp_iso} (filtro SME)...")

        registros_sme = []
        ano, mes = comp_iso.split("-")

        try:
            with httpx.Client(timeout=60.0, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}) as client:
                # 1. Consulta inicial com parâmetros de competência
                params = {
                    "ano": ano,
                    "mes": mes,
                    "offset": 0,
                    "limit": 500
                }

                while True:
                    resp = client.get(api_url, params=params)
                    if resp.status_code != 200:
                        self.logger.warning(f"Resposta status {resp.status_code} da API de Natal para offset {params['offset']}")
                        break

                    data = resp.json()
                    itens = data.get("itens", []) or data.get("dados", []) or (data if isinstance(data, list) else [])
                    if not itens:
                        break

                    for item in itens:
                        lotacao = str(item.get("lotacao", "") or item.get("orgao", "") or "").upper()
                        # Filtrar variações com 'SME' ou 'EDUCACAO'
                        if "SME" in lotacao or "EDUCACAO" in lotacao or "EDUCAÇÃO" in lotacao:
                            registros_sme.append({
                                "ente_origem": "Natal",
                                "competencia": comp_iso,
                                "matricula": item.get("matricula", ""),
                                "nome_completo": str(item.get("nome", "")).upper().strip(),
                                "cargo_funcao": item.get("cargo", "") or item.get("funcao", ""),
                                "carga_horaria": item.get("carga_horaria", "30h"),
                                "lotacao_orgao": lotacao,
                                "situacao_vinculo": item.get("situacao", "ATIVO")
                            })

                    if len(itens) < params["limit"]:
                        break

                    params["offset"] += params["limit"]
                    if params["offset"] > 25000:  # Teto de segurança
                        break

            if registros_sme:
                df = pd.DataFrame(registros_sme)
                df.to_csv(output_file, index=False, encoding="utf-8-sig")
                self.logger.info(f"API de Natal: {len(df)} servidores da SME extraídos e salvos em {output_file.name}")
                return output_file
            else:
                self.logger.warning("Nenhum registro com filtro SME retornado na API de Natal para a competência informada.")

        except Exception as e:
            self.logger.error(f"Erro na extração de Natal: {e}")

        return None
