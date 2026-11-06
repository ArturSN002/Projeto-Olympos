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
    def _tentar_extrair_mes(self, comp_iso: str) -> Optional[Path]:
        output_file = self.output_dir / f"natal_{comp_iso}.csv"
        api_url = self.config.get("url", "https://www2.natal.rn.gov.br/transparenciaapi/folha_pagamentos")

        self.logger.info(f"Tentando coleta via API de Natal para competência {comp_iso} (filtro SME)...")

        registros_sme = []
        partes = comp_iso.split("-")
        if len(partes) != 2:
            return None
        ano, mes = partes[0], partes[1]

        try:
            with httpx.Client(timeout=45.0, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}) as client:
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

                    # Correção resiliente para decodificar caracteres Latin-1 (ex: byte 0xe3 = 'ã')
                    try:
                        data = resp.json()
                    except Exception:
                        import json
                        texto_latin = resp.content.decode("latin-1", errors="replace")
                        data = json.loads(texto_latin)

                    itens = (data.get("itens", []) or data.get("dados", [])) if isinstance(data, dict) else (data if isinstance(data, list) else [])
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
                if self.validar_csv_valido(output_file):
                    self.logger.info(f"API de Natal: {len(df)} servidores da SME extraídos e salvos em {output_file.name}")
                    return output_file
                output_file.unlink(missing_ok=True)
            else:
                self.logger.warning(f"Nenhum registro com filtro SME retornado na API de Natal para {comp_iso}.")

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
