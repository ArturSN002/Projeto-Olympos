#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_cruzador_vinculos.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Valida o motor de cruzamento de vínculos de transparência e auditoria constitucional
conforme Art. 37, XVI da CF/88 (teto de 60 horas semanais e compatibilidade de cargos).
"""

import unittest
from pathlib import Path
import sys

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
CADMO_ROOT = OLYMPOS_ROOT / "2_github_pages_actions" / "engines" / "papiro_de_cadmo"

if str(CADMO_ROOT) not in sys.path:
    sys.path.insert(0, str(CADMO_ROOT))

from pipeline.cruzador_vinculos import (
    normalizar_nome,
    parse_carga_horaria,
    auditar_acumulacao_cf37,
    sugerir_potencial_permuta,
    cruzar_vinculos,
    auditar_acumulacao_interna_ceara
)


class TestCruzadorVinculos(unittest.TestCase):
    """Bateria de testes para junção de vínculos e auditoria da CF/88 Art. 37."""

    def test_01_normalizar_nome(self):
        """Valida que acentos são decompostos e nomes são padronizados em maiúsculas sem espaços duplos."""
        self.assertEqual(normalizar_nome("  José Farias da Silva "), "JOSE FARIAS DA SILVA")
        self.assertEqual(normalizar_nome("Odjaime Câmara de Araújo"), "ODJAIME CAMARA DE ARAUJO")
        self.assertEqual(normalizar_nome("MARIA   JAQUELINE\nBARBOSA"), "MARIA JAQUELINE BARBOSA")
        self.assertEqual(normalizar_nome(""), "")

    def test_02_parse_carga_horaria(self):
        """Valida extração numérica da carga horária semanal."""
        self.assertEqual(parse_carga_horaria("30h"), 30)
        self.assertEqual(parse_carga_horaria("40 HORAS"), 40)
        self.assertEqual(parse_carga_horaria("25"), 25)
        self.assertEqual(parse_carga_horaria(None), 30)
        self.assertEqual(parse_carga_horaria("0h"), 30)

    def test_03_auditoria_dois_professores_ate_60h_legal(self):
        """Dois cargos de professor totalizando <= 60h é acumulação regular (Art. 37, XVI, 'a')."""
        res = auditar_acumulacao_cf37(
            cargo_a="PROFESSOR NIVEL SUPERIOR",
            ch_a="30h",
            cargo_b="PROFESSOR EFETIVO",
            ch_b="30h",
            ente_a="Ceará-Mirim",
            ente_b="Governo do Estado do RN (SEEC)"
        )
        self.assertTrue(res["acumulacao_legal"])
        self.assertEqual(res["carga_horaria_total"], 60)
        self.assertIn("Art. 37, XVI, 'a'", res["enquadramento"])
        self.assertIn("Acumulação plenamente regular", res["parecer_hera"])

    def test_04_auditoria_dois_professores_excedendo_60h_ilegal(self):
        """Dois cargos de professor totalizando > 60h viola limite de compatibilidade horária."""
        res = auditar_acumulacao_cf37(
            cargo_a="PROFESSOR FUNDAMENTAL",
            ch_a="40h",
            cargo_b="PROFESSOR ANOS FINAIS",
            ch_b="30h",
            ente_a="Ceará-Mirim",
            ente_b="Natal"
        )
        self.assertFalse(res["acumulacao_legal"])
        self.assertEqual(res["carga_horaria_total"], 70)
        self.assertIn("ultrapassa o teto prudencial de 60 horas", res["parecer_hera"])

    def test_05_auditoria_professor_mais_tecnico_legal(self):
        """Um cargo de professor com outro técnico/científico é legal (Art. 37, XVI, 'b')."""
        res = auditar_acumulacao_cf37(
            cargo_a="PROFESSOR DE MATEMÁTICA",
            ch_a="30h",
            cargo_b="ANALISTA DE SISTEMAS",
            ch_b="30h",
            ente_a="Ceará-Mirim",
            ente_b="SGA"
        )
        self.assertTrue(res["acumulacao_legal"])
        self.assertIn("Art. 37, XVI, 'b'", res["enquadramento"])

    def test_06_auditoria_cargos_administrativos_ilegal(self):
        """Cargos administrativos puros não possuem amparo no Art. 37, XVI."""
        res = auditar_acumulacao_cf37(
            cargo_a="AGENTE ADMINISTRATIVO",
            ch_a="40h",
            cargo_b="ASSISTENTE ADMINISTRATIVO",
            ch_b="40h",
            ente_a="Ceará-Mirim",
            ente_b="Parnamirim"
        )
        self.assertFalse(res["acumulacao_legal"])
        self.assertIn("Não enquadrado", res["enquadramento"])

    def test_07_cruzar_vinculos_com_correspondencia_cpf(self):
        """Cruza dados com correspondência exata de nome e miolo de CPF."""
        base_ceara = [
            {
                "nome_completo": "ODJAIME CAMARA DE ARAUJO",
                "matricula": "0010016",
                "cargo_funcao": "PROFESSOR NIVEL SUPERIOR",
                "carga_horaria": "30h",
                "lotacao_orgao": "SMEB SEDE",
                "cpf": "###.487.734-##",
                "situacao_vinculo": "ATIVO"
            }
        ]
        base_externa = [
            {
                "nome_completo": "ODJAIME CAMARA DE ARAUJO",
                "matricula": "29841-0",
                "cargo_funcao": "PROFESSOR DE HISTORIA",
                "carga_horaria": "30h",
                "lotacao_orgao": "E. E. Augusto Severo",
                "ente_origem": "Governo do Estado do RN (SEEC)",
                "cpf": "###.487.734-##",
                "situacao_vinculo": "ATIVO"
            },
            {
                "nome_completo": "OUTRO SERVIDOR",
                "matricula": "99999",
                "cargo_funcao": "PROFESSOR",
                "carga_horaria": "30h",
                "lotacao_orgao": "Natal",
                "ente_origem": "Natal",
                "cpf": "###.111.222-##",
                "situacao_vinculo": "ATIVO"
            }
        ]

        matches = cruzar_vinculos(base_ceara, base_externa)
        self.assertEqual(len(matches), 1)
        m = matches[0]
        self.assertEqual(m["servidor_referencia"]["matricula"], "0010016")
        self.assertEqual(m["vinculo_externo_detectado"]["ente_origem"], "Governo do Estado do RN (SEEC)")
        self.assertTrue(m["auditoria_constitucional"]["acumulacao_legal"])
        self.assertEqual(m["auditoria_constitucional"]["carga_horaria_total"], 60)

    def test_08_cruzar_vinculos_divergencia_cpf_rejeitado(self):
        """Se o nome for igual mas os miolos de CPF forem diferentes (homônimos), descarta o cruzamento."""
        base_ceara = [
            {
                "nome_completo": "JOSE DA SILVA",
                "matricula": "0000001",
                "cargo_funcao": "PROFESSOR",
                "carga_horaria": "30h",
                "cpf": "###.123.456-##"
            }
        ]
        base_externa = [
            {
                "nome_completo": "JOSE DA SILVA",
                "matricula": "9999999",
                "cargo_funcao": "PROFESSOR",
                "carga_horaria": "30h",
                "ente_origem": "Natal",
                "cpf": "###.999.888-##"
            }
        ]
        matches = cruzar_vinculos(base_ceara, base_externa)
        self.assertEqual(len(matches), 0)


if __name__ == "__main__":
    unittest.main()
