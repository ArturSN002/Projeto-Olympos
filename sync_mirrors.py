#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Sincronização dos Espelhos do Monorepo Olympos.
Milestone M4: Sincroniza:
1. Olympos/2_github_pages_actions/frontend_spa -> hub-olympos-frontend/
2. Olympos/1_google_apps_script/hub_webapp/ (ui_styles, ui_index, ui_scripts) -> hub-olympos-webapp/
3. Olympos/2_github_pages_actions/engines/papiro_de_cadmo/pipeline/ -> papiro-de-cadmo/pipeline/
"""
import os
import re
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OLYMPOS_DIR = BASE_DIR / "Olympos"
SPA_DIR = OLYMPOS_DIR / "2_github_pages_actions" / "frontend_spa"
GAS_DIR = OLYMPOS_DIR / "1_google_apps_script" / "hub_webapp"

WEBAPP_MIRROR = BASE_DIR / "hub-olympos-webapp"
FRONTEND_MIRROR = BASE_DIR / "hub-olympos-frontend"
PAPIRO_SRC = OLYMPOS_DIR / "2_github_pages_actions" / "engines" / "papiro_de_cadmo" / "pipeline"
PAPIRO_MIRROR = BASE_DIR / "papiro-de-cadmo" / "pipeline"
PAPIRO_EXT_SRC = OLYMPOS_DIR / "2_github_pages_actions" / "engines" / "papiro_de_cadmo" / "extractors"
PAPIRO_EXT_MIRROR = BASE_DIR / "papiro-de-cadmo" / "extractors"
WF_SRC = OLYMPOS_DIR / ".github" / "workflows"
WF_MIRROR = OLYMPOS_DIR / "2_github_pages_actions" / "workflows_mirror"


def sync_gas_templates():
    print("[1/4] Gerando templates GAS em Olympos/1_google_apps_script/hub_webapp/...")
    
    # 0. Garante paridade estrita entre styles.css e css/style.css em frontend_spa
    spa_css_dir = SPA_DIR / "css"
    spa_css_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SPA_DIR / "styles.css", spa_css_dir / "style.css")
    print("  -> frontend_spa/css/style.css sincronizado com styles.css")

    # 1. ui_styles.html
    css_content = (SPA_DIR / "styles.css").read_text(encoding="utf-8")
    ui_styles_path = GAS_DIR / "ui_styles.html"
    ui_styles_path.write_text(f"<style>\n{css_content}\n</style>\n", encoding="utf-8")
    print(f"  -> ui_styles.html atualizado ({len(css_content)} bytes de CSS)")

    # 2. ui_index.html
    index_html = (SPA_DIR / "index.html").read_text(encoding="utf-8")
    # Substitui <link rel="stylesheet" href="styles.css" /> por <?!= include('ui_styles'); ?>
    gas_index = re.sub(
        r'<link\s+rel=["\']stylesheet["\']\s+href=["\']styles\.css["\']\s*/>',
        "<?!= include('ui_styles'); ?>",
        index_html
    )
    # Substitui o bloco de scripts modulares por <?!= include('ui_scripts'); ?>
    script_bundle_pattern = re.compile(
        r'<!-- SCRIPTS MODULARES -->.*?<script src=["\']js/app\.js["\']></script>',
        re.DOTALL
    )
    gas_index = script_bundle_pattern.sub(
        "<?!= include('ui_scripts'); ?>",
        gas_index
    )
    ui_index_path = GAS_DIR / "ui_index.html"
    ui_index_path.write_text(gas_index, encoding="utf-8")
    print(f"  -> ui_index.html atualizado ({len(gas_index)} bytes)")

    # 3. ui_scripts.html
    modules_order = [
        "js/icons.js",
        "js/setup_modal.js",
        "js/olympos_password_guard.js",
        "js/supabase_client.js",
        "js/api.js",
        "js/router.js",
        "js/views/visaoGeral.js",
        "js/views/oficios.js",
        "js/views/portarias.js",
        "js/views/licencas.js",
        "js/certificados_crypto.js",
        "js/views/certificados.js",
        "js/views/liraOrfeu.js",
        "js/views/diarioOficial.js",
        "js/data/servidoresData.js",
        "js/views/papiroCadmo.js",
        "js/views/servidores.js",
        "js/views/calendario.js",
        "js/data/escolasCearaMirim.js",
        "js/views/escolas.js",
        "js/memorias_catalogo.js",
        "js/views/personas.js",
        "js/views/busca.js",
        "js/views/configuracoes.js",
        "js/app.js"
    ]

    script_parts = ["<script>\n"]
    for mod in modules_order:
        mod_path = SPA_DIR / mod
        if not mod_path.exists():
            print(f"  [AVISO] Módulo {mod} não encontrado em {mod_path}")
            continue
        code = mod_path.read_text(encoding="utf-8")
        script_parts.append(f"// --- MODULE: {mod} ---\n{code}\n\n")
    script_parts.append("</script>\n")

    ui_scripts_content = "".join(script_parts)
    ui_scripts_path = GAS_DIR / "ui_scripts.html"
    ui_scripts_path.write_text(ui_scripts_content, encoding="utf-8")
    print(f"  -> ui_scripts.html atualizado ({len(ui_scripts_content)} bytes)")


def sync_hub_olympos_webapp():
    print("[2/4] Sincronizando hub-olympos-webapp/...")
    if not WEBAPP_MIRROR.exists():
        print(f"  [AVISO] {WEBAPP_MIRROR} não encontrado!")
        return
    for item in GAS_DIR.iterdir():
        if item.is_file():
            dst = WEBAPP_MIRROR / item.name
            shutil.copy2(item, dst)
            print(f"  -> Copiado {item.name} para hub-olympos-webapp/")


def sync_papiro_pipeline():
    print("[3/4] Sincronizando papiro-de-cadmo/ (pipeline e extractors) e workflows_mirror/...")
    if PAPIRO_MIRROR.exists():
        for py_file in PAPIRO_SRC.glob("*.py"):
            dst = PAPIRO_MIRROR / py_file.name
            shutil.copy2(py_file, dst)
            print(f"  -> Copiado {py_file.name} para papiro-de-cadmo/pipeline/")
    if PAPIRO_EXT_MIRROR.exists():
        for py_file in PAPIRO_EXT_SRC.glob("*.py"):
            dst = PAPIRO_EXT_MIRROR / py_file.name
            shutil.copy2(py_file, dst)
            print(f"  -> Copiado {py_file.name} para papiro-de-cadmo/extractors/")
    if WF_MIRROR.exists():
        for yml_file in WF_SRC.glob("*.yml"):
            dst = WF_MIRROR / yml_file.name
            shutil.copy2(yml_file, dst)
            print(f"  -> Copiado {yml_file.name} para 2_github_pages_actions/workflows_mirror/")


def sync_hub_olympos_frontend():
    print("[4/4] Sincronizando hub-olympos-frontend/...")
    if not FRONTEND_MIRROR.exists():
        print(f"  [AVISO] {FRONTEND_MIRROR} não encontrado!")
        return

    # Sincroniza raiz do frontend
    for root_file in ["index.html", "styles.css", "favicon.ico", "manifest.json", "sw.js"]:
        src_f = SPA_DIR / root_file
        if src_f.exists():
            shutil.copy2(src_f, FRONTEND_MIRROR / root_file)
            print(f"  -> Copiado {root_file} para hub-olympos-frontend/")

    # Garante css/style.css no espelho
    dst_css_dir = FRONTEND_MIRROR / "css"
    dst_css_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SPA_DIR / "styles.css", dst_css_dir / "style.css")
    print("  -> css/style.css sincronizado em hub-olympos-frontend/")

    # Sincroniza assets
    src_assets = SPA_DIR / "assets"
    if src_assets.exists():
        dst_assets = FRONTEND_MIRROR / "assets"
        dst_assets.mkdir(parents=True, exist_ok=True)
        for item in src_assets.iterdir():
            if item.is_file():
                shutil.copy2(item, dst_assets / item.name)
        print("  -> assets/ sincronizado em hub-olympos-frontend/")

    # Sincroniza pasta js/ recursivamente
    src_js = SPA_DIR / "js"
    dst_js = FRONTEND_MIRROR / "js"
    for src_path in src_js.rglob("*"):
        if src_path.is_file():
            rel_path = src_path.relative_to(src_js)
            dest_file = dst_js / rel_path
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_path, dest_file)
    print("  -> js/ (incluindo js/data/ e js/views/) sincronizado em hub-olympos-frontend/")


if __name__ == "__main__":
    sync_gas_templates()
    sync_hub_olympos_webapp()
    sync_papiro_pipeline()
    sync_hub_olympos_frontend()
    print("\n[SUCESSO] Todos os espelhos do monorepo foram sincronizados!")
