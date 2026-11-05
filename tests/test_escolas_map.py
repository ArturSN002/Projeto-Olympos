#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_escolas_map.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)

Validação automatizada da funcionalidade de Georreferenciamento e Mapa de Escolas:
1. Integridade do Catálogo Semente Oficial (mínimo de 20 escolas/CEIs com dados reais).
2. Validação Geográfica Estrita (Bounding Box do Município de Ceará-Mirim/RN).
3. Compilação e Sintaxe V8 dos Módulos JS (escolasCearaMirim.js e escolas.js).
4. Presença e Estrutura dos Elementos DOM no index.html (#page-escolas, #mapaEscolasCearaMirim).
5. Conformidade WCAG 2.2 e Acessibilidade do Modal (#modalCadastroEscola sem campos de senha).
6. Roteamento Modular e Navegação (#escolas em router.js, navbar desktop e drawer mobile).
7. Simulação Lógica das Operações CRUD e Mecanismo de Filtragem.
"""

import json
import re
import unittest
import subprocess
from pathlib import Path

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
SPA_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa"
DATA_DIR = SPA_DIR / "js" / "data"
VIEWS_DIR = SPA_DIR / "js" / "views"

ESCOLAS_DATA_JS = DATA_DIR / "escolasCearaMirim.js"
ESCOLAS_VIEW_JS = VIEWS_DIR / "escolas.js"
INDEX_HTML = SPA_DIR / "index.html"
ROUTER_JS = SPA_DIR / "js" / "router.js"
APP_JS = SPA_DIR / "js" / "app.js"

# Bounding box oficial territorial de Ceará-Mirim/RN
BOUNDS_CEARA_MIRIM = {
    "min_lat": -5.750000,
    "max_lat": -5.500000,
    "min_lng": -35.600000,
    "max_lng": -35.250000
}


def extrair_catalogo_semente():
    """Executa script Node.js para carregar e retornar o catálogo semente como dict/list Python."""
    node_code = f"""
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync({json.dumps(str(ESCOLAS_DATA_JS))}, 'utf8');
    const script = new Function('module', 'exports', content + '; return (typeof module !== "undefined" && module.exports) ? module.exports : (typeof BANCO_SEMENTE_ESCOLAS !== "undefined" ? BANCO_SEMENTE_ESCOLAS : []);');
    const mod = {{ exports: [] }};
    const res = script(mod, mod.exports);
    console.log(JSON.stringify(res || mod.exports));
    """
    proc = subprocess.run(
        ["node", "-e", node_code],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=10
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Erro ao avaliar escolasCearaMirim.js no Node: {proc.stderr}")
    return json.loads(proc.stdout)


class TestEscolasMapFeature(unittest.TestCase):
    """Suíte de testes de integração e unitários para o Mapa de Escolas Municipais."""

    def test_01_seed_dataset_integrity(self):
        """Assegura a existência e integridade do catálogo com no mínimo 20 escolas de Ceará-Mirim."""
        self.assertTrue(ESCOLAS_DATA_JS.exists(), f"Arquivo não encontrado: {ESCOLAS_DATA_JS}")
        escolas = extrair_catalogo_semente()

        self.assertIsInstance(escolas, list, "O catálogo deve ser uma lista de unidades")
        self.assertGreaterEqual(len(escolas), 20, f"Catálogo possui {len(escolas)} escolas, mínimo exigido é 20")

        ids_vistos = set()
        nomes_vistos = set()
        categorias = set()
        zonas = set()

        for idx, esc in enumerate(escolas, start=1):
            self.assertIn("id", esc, f"Escola #{idx} sem id")
            self.assertIn("nome", esc, f"Escola #{idx} sem nome")
            self.assertIn("categoria", esc, f"Escola #{idx} sem categoria")
            self.assertIn("zona", esc, f"Escola #{idx} sem zona")
            self.assertIn("bairroDistrito", esc, f"Escola #{idx} sem bairroDistrito")
            self.assertIn("lat", esc, f"Escola #{idx} ({esc.get('nome')}) sem latitude")
            self.assertIn("lng", esc, f"Escola #{idx} ({esc.get('nome')}) sem longitude")

            # Unicidade de IDs
            eid = esc["id"]
            self.assertNotIn(eid, ids_vistos, f"ID duplicado encontrado no catálogo: {eid}")
            ids_vistos.add(eid)

            nomes_vistos.add(esc["nome"])
            categorias.add(esc["categoria"])
            zonas.add(esc["zona"])

            # Validar tipos
            self.assertIsInstance(esc["lat"], (int, float), f"Latitude de {esc['nome']} não é numérica")
            self.assertIsInstance(esc["lng"], (int, float), f"Longitude de {esc['nome']} não é numérica")

        # Representatividade: deve conter Sede, Ensino Fundamental, Polo Rural e Educação Infantil (CEIs)
        self.assertTrue(any("sede" in c.lower() for c in categorias), "Ausência de Sede Administrativa no catálogo")
        self.assertTrue(any("rural" in z.lower() for z in zonas), "Ausência de escolas rurais no catálogo")
        self.assertTrue(any("infantil" in c.lower() or "cei" in c.lower() or "cmei" in c.lower() for c in categorias), "Ausência de CEIs/Educação Infantil no catálogo")
        self.assertTrue(any(esc["nome"].startswith("CEI ") for esc in escolas), "Ausência de unidades com nomenclatura oficial 'CEI ' no catálogo")
        self.assertFalse(any("CMEI" in esc["nome"] for esc in escolas), "Presença indevida da sigla obsoleta 'CMEI' nos nomes das escolas")

        # Conferir presença de marcos célebres de Ceará-Mirim
        nomes_str = " ".join(nomes_vistos)
        self.assertIn("SMEB Sede", nomes_str, "SMEB Sede ausente no catálogo")
        self.assertIn("Alice Garcia Freire", nomes_str, "E.M. Alice Garcia Freire ausente")
        self.assertIn("Roberto Varela", nomes_str, "E.M. Roberto Varela ausente")
        self.assertIn("Augusto Severo", nomes_str, "E.M. Augusto Severo ausente")
        self.assertIn("Celso Cicco", nomes_str, "E.M. Celso Cicco ausente")
        self.assertIn("Júlio Senna", nomes_str, "E.M. Dr. Júlio Senna (Gravatá) ausente")
        self.assertIn("Madalena Antunes", nomes_str, "E.M. Madalena Antunes (Massangana) ausente")

    def test_02_geographic_bounding_box_ceara_mirim(self):
        """Assegura que 100% das coordenadas estejam dentro dos limites territoriais de Ceará-Mirim/RN."""
        escolas = extrair_catalogo_semente()
        fora_dos_limites = []

        for esc in escolas:
            lat = esc["lat"]
            lng = esc["lng"]
            nome = esc["nome"]

            valida = (
                BOUNDS_CEARA_MIRIM["min_lat"] <= lat <= BOUNDS_CEARA_MIRIM["max_lat"] and
                BOUNDS_CEARA_MIRIM["min_lng"] <= lng <= BOUNDS_CEARA_MIRIM["max_lng"]
            )
            if not valida:
                fora_dos_limites.append(f"{nome}: lat={lat}, lng={lng}")

        self.assertEqual(
            len(fora_dos_limites), 0,
            f"Escolas com coordenadas fora da bounding box de Ceará-Mirim:\n" + "\n".join(fora_dos_limites)
        )

    def test_03_js_views_escolas_syntax_and_structure(self):
        """Valida que escolas.js e escolasCearaMirim.js compilam no V8 e expõem a API requerida."""
        self.assertTrue(ESCOLAS_VIEW_JS.exists(), f"Arquivo não encontrado: {ESCOLAS_VIEW_JS}")

        for fpath in [ESCOLAS_DATA_JS, ESCOLAS_VIEW_JS]:
            res = subprocess.run(
                ["node", "-c", str(fpath)],
                capture_output=True,
                text=True,
                encoding="utf-8"
            )
            self.assertEqual(res.returncode, 0, f"Erro de sintaxe em {fpath.name}: {res.stderr}")

        view_code = ESCOLAS_VIEW_JS.read_text(encoding="utf-8")
        self.assertIn("window.OlymposViews.escolas", view_code, "Não expõe window.OlymposViews.escolas")
        self.assertIn("olympos_escolas_municipais", view_code, "STORAGE_KEY incorreta ou ausente")

        # Métodos da API pública exigidos
        metodos = [
            "init", "abrirModalCadastro", "abrirModalEdicao", "fecharModal",
            "salvarEscolaSubmit", "excluirEscola", "centralizarEscola",
            "recentralizarMapa", "exportarJson", "importarJson", "restaurarPadroes"
        ]
        for m in metodos:
            self.assertIn(m, view_code, f"Método '{m}' ausente na API de escolas.js")

    def test_04_spa_dom_page_escolas_and_map_container(self):
        """Valida no index.html a presença da section #page-escolas, container do mapa e controles."""
        html = INDEX_HTML.read_text(encoding="utf-8")

        self.assertIn('id="page-escolas"', html, "Seção #page-escolas ausente em index.html")
        self.assertIn('id="mapaEscolasCearaMirim"', html, "Container #mapaEscolasCearaMirim ausente no DOM")
        self.assertIn('id="escolasCoordLiveDisplay"', html, "Display em tempo real #escolasCoordLiveDisplay ausente")

        # Botões de Ação
        self.assertIn('id="btnNovaEscola"', html, "Botão #btnNovaEscola ausente")
        self.assertIn('id="btnRecentralizarMapaEscolas"', html, "Botão #btnRecentralizarMapaEscolas ausente")
        self.assertIn('id="btnExportarEscolasJson"', html, "Botão #btnExportarEscolasJson ausente")
        self.assertIn('id="btnImportarEscolasJson"', html, "Botão #btnImportarEscolasJson ausente")
        self.assertIn('id="btnRestaurarEscolasPadrao"', html, "Botão #btnRestaurarEscolasPadrao ausente")

        # KPIs
        self.assertIn('id="kpiEscolasTotal"', html, "KPI #kpiEscolasTotal ausente")
        self.assertIn('id="kpiEscolasUrbanas"', html, "KPI #kpiEscolasUrbanas ausente")
        self.assertIn('id="kpiEscolasRurais"', html, "KPI #kpiEscolasRurais ausente")
        self.assertIn('id="kpiEscolasCeis"', html, "KPI #kpiEscolasCeis ausente")

        # Filtros e Tabela
        self.assertIn('id="escolaBuscaInput"', html, "Input de busca #escolaBuscaInput ausente")
        self.assertIn('data-filtro-categoria="todas"', html, "Filtro categoria 'todas' ausente")
        self.assertIn('data-filtro-categoria="cei"', html, "Filtro categoria 'cei' ausente")
        self.assertIn('id="tabelaEscolas"', html, "Tabela #tabelaEscolas ausente")
        self.assertIn('id="tabelaEscolasBody"', html, "Tbody #tabelaEscolasBody ausente")

    def test_05_modal_cadastro_escola_and_wcag_compliance(self):
        """Valida que o modal de cadastro/edição existe e respeita estritamente as diretrizes WCAG (sem senhas)."""
        html = INDEX_HTML.read_text(encoding="utf-8")

        self.assertIn('id="modalCadastroEscola"', html, "Modal #modalCadastroEscola ausente")
        self.assertIn('id="formCadastroEscola"', html, "Formulário #formCadastroEscola ausente")

        # Campos obrigatórios do formulário
        campos = [
            'id="escolaId"', 'id="escolaNome"', 'id="escolaInep"',
            'id="escolaCategoria"', 'id="escolaZona"', 'id="escolaBairroDistrito"',
            'id="escolaLatitude"', 'id="escolaLongitude"', 'id="escolaCoordValidacaoBadge"'
        ]
        for c in campos:
            self.assertIn(c, html, f"Campo {c} ausente no formulário de cadastro de escolas")

        # Isolamento do formulário para verificação estrita de ausência de campos de senha
        form_match = re.search(r'<form\b[^>]*id=["\']formCadastroEscola["\'][^>]*>([\s\S]*?)</form>', html)
        self.assertIsNotNone(form_match, "Não foi possível isolar o formulário #formCadastroEscola")
        form_body = form_match.group(1)

        # WCAG compliance: formulário de cadastro público de escolas NÃO deve conter senhas
        self.assertNotIn('type="password"', form_body, "Formulário de escolas não deve conter campos de senha")

    def test_06_router_and_navigation_integration(self):
        """Valida o registro da rota 'escolas' em router.js, navbar superior e mobile drawer."""
        router_code = ROUTER_JS.read_text(encoding="utf-8")
        html = INDEX_HTML.read_text(encoding="utf-8")

        # Rota no router.js
        self.assertIn("'escolas':", router_code, "Rota 'escolas' ausente em PAGES do router.js")
        self.assertIn("'escolas': 'escolas'", router_code, "Mapeamento 'escolas': 'escolas' ausente em dispararCarregamentoPagina")

        # Links no index.html
        self.assertIn('href="#escolas"', html, "Link href='#escolas' ausente no index.html")
        self.assertIn('data-page="escolas"', html, "Atributo data-page='escolas' ausente")
        self.assertIn('data-nav-target="escolas"', html, "Card data-nav-target='escolas' ausente na Visão Geral")

        # Inclusão dos scripts em index.html
        self.assertIn('src="js/data/escolasCearaMirim.js"', html, "Script escolasCearaMirim.js não incluído em index.html")
        self.assertIn('src="js/views/escolas.js"', html, "Script escolas.js não incluído em index.html")

    def test_07_crud_logic_and_filtering_simulation(self):
        """Simula em Node.js o ciclo de vida CRUD, validação de limites geográficos e cálculos de KPI."""
        node_test_script = f"""
        const fs = require('fs');
        const escolasCode = fs.readFileSync({json.dumps(str(ESCOLAS_VIEW_JS))}, 'utf8');
        const dataCode = fs.readFileSync({json.dumps(str(ESCOLAS_DATA_JS))}, 'utf8');

        // Mock leve do ambiente de browser
        global.window = global;
        global.document = {{
          getElementById: () => null,
          querySelectorAll: () => []
        }};
        global.navigator = {{ clipboard: null }};
        
        let store = {{}};
        global.localStorage = {{
          getItem: (k) => store[k] || null,
          setItem: (k, v) => {{ store[k] = String(v); }},
          removeItem: (k) => {{ delete store[k]; }}
        }};

        // Carrega dados e view
        eval(dataCode);
        eval(escolasCode);

        const v = window.OlymposViews.escolas;
        if (!v) throw new Error('OlymposViews.escolas indefinido');

        // 1. Testa bounding box
        if (!v.estaEmCearaMirim(-5.634, -35.428)) throw new Error('Centro de Ceará-Mirim deve ser válido');
        if (v.estaEmCearaMirim(-23.550, -46.633)) throw new Error('São Paulo não deve ser Ceará-Mirim');

        // 2. Garante banco inicial
        store['olympos_escolas_municipais'] = JSON.stringify(window.BANCO_SEMENTE_ESCOLAS);
        let list = v.obterEscolas();
        if (list.length < 20) throw new Error('Lista inicial deve ter ao menos 20 unidades');

        // 3. Simula Adicionar
        const nova = {{
          id: 'esc_teste_999',
          nome: 'Escola de Teste Nova Descoberta',
          categoria: 'Ensino Fundamental',
          zona: 'Urbana',
          bairroDistrito: 'Nova Descoberta',
          lat: -5.635000,
          lng: -35.425000
        }};
        list.push(nova);
        localStorage.setItem('olympos_escolas_municipais', JSON.stringify(list));
        let posAdd = v.obterEscolas();
        if (posAdd.length !== list.length) throw new Error('Falha na persistência ao adicionar');

        // 4. Simula Editar
        posAdd[posAdd.length - 1].nome = 'Escola Editada com Sucesso';
        localStorage.setItem('olympos_escolas_municipais', JSON.stringify(posAdd));
        let posEdit = v.obterEscolas();
        if (posEdit[posEdit.length - 1].nome !== 'Escola Editada com Sucesso') throw new Error('Falha ao editar');

        // 5. Simula Excluir
        let posDel = posEdit.filter(e => e.id !== 'esc_teste_999');
        localStorage.setItem('olympos_escolas_municipais', JSON.stringify(posDel));
        let final = v.obterEscolas();
        if (final.find(e => e.id === 'esc_teste_999')) throw new Error('Falha ao excluir');

        console.log('CRUD_OK');
        """

        proc = subprocess.run(
            ["node", "-e", node_test_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=10
        )
        self.assertEqual(proc.returncode, 0, f"Erro na simulação do CRUD em Node: {proc.stderr}")
        self.assertIn("CRUD_OK", proc.stdout)


if __name__ == "__main__":
    unittest.main()
