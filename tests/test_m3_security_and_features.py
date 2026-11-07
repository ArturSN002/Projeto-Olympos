#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_m3_security_and_features.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Validação comportamental (Node V8 VM) e auditoria ativa de segurança cobrindo:
1. Estado inicial "--" de Portarias e Ofícios sem valores estáticos (155/412) antes do carregamento real.
2. Consulta consolidada de Servidor por Nome ou Matrícula em Permutas (substituindo Intenção de Permuta por padrão).
3. Configuração de Instância solicitando apenas a Chave Pública do Supabase (derivação automática de URL JWT + GAS).
4. Limpeza dos textos auxiliares solicitados no modal de Login (#loginScreen).
5. Testes de Segurança:
   - Erradicação de vazamento de stack trace (CWE-209) no Gateway GAS
   - Comparação em tempo constante (CWE-208) e bloqueio de senha em texto plano (CWE-256)
   - Matriz RBAC server-side por rota no Gateway GAS (CWE-862)
   - Geração de senha via CSPRNG WebCrypto + HIBP k-Anonymity (CWE-338 / NIST SP 800-63B)
   - Sanitização contra PostgREST Filter Injection (CWE-943)
   - Hardening de RPCs SECURITY DEFINER e schema extensions no Supabase (Lints 0014 & 0029)
"""

import json
import re
import subprocess
import unittest
from pathlib import Path

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
SPA_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa"
GAS_DIR = OLYMPOS_ROOT / "1_google_apps_script" / "hub_webapp"
MIGRATIONS_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "supabase" / "migrations"


class TestMarco3SecurityAndFeatures(unittest.TestCase):
    """Testes automatizados de regressão funcional e blindagem de segurança."""

    def test_01_portaria_oficio_initial_dash_and_no_static_fallback(self):
        """Garante que Portaria e Ofício permanecem com '--' antes do carregamento real, sem fallback 155/412."""
        html = (SPA_DIR / "index.html").read_text(encoding="utf-8")
        sup_js = (SPA_DIR / "js" / "supabase_client.js").read_text(encoding="utf-8")
        vg_js = (SPA_DIR / "js" / "views" / "visaoGeral.js").read_text(encoding="utf-8")
        of_js = (SPA_DIR / "js" / "views" / "oficios.js").read_text(encoding="utf-8")

        self.assertIn('id="oficioNumeroInput" class="input-clean" placeholder="--"', html)
        self.assertNotIn("1wGlcqqTuWAyy-2VRO_QqyyMcKHb4AmRn", html)
        self.assertNotIn("proximaPortaria2026: 412", sup_js)
        self.assertIn("definirEstadoInicialNumeracao", vg_js)
        self.assertIn("inputNumero.placeholder = '--'", of_js)

        # Teste comportamental em Node VM: enquanto overview_get pendente, KPIs continuam "--"
        node_script = r"""
        const fs = require('fs');
        const vm = require('vm');
        const elems = {
          kpiProximoOficio: { textContent: '155' },
          kpiProximaPortaria: { textContent: '412' },
          kpiUltimoOficio: { innerHTML: '' },
          kpiUltimaPortaria: { innerHTML: '' },
          inputProximoOficioMd: { value: '155', placeholder: '' },
          inputProximaPortariaMd: { value: '412', placeholder: '' },
          oficioNumeroInput: { value: '155', placeholder: 'Ex: 155' }
        };
        const ctx = {
          console,
          setTimeout,
          clearTimeout,
          localStorage: { getItem: () => null, setItem: () => {} },
          document: {
            readyState: 'complete',
            getElementById: (id) => elems[id] || null,
            addEventListener: () => {}
          }
        };
        ctx.window = ctx;
        ctx.OlymposApp = { escapeHtml: (s) => String(s || '') };
        // Simula overview_get ainda pendente (não invoca callback imediatamente)
        ctx.OlymposApi = { chamar: () => {} };

        vm.createContext(ctx);
        vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);
        vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);
        vm.runInContext(fs.readFileSync(process.argv[3], 'utf8'), ctx);

        ctx.OlymposViews.visaoGeral.init();
        ctx.OlymposViews.oficios.init();

        (async () => {
          const numFallback = await ctx.OlymposSupabase.carregarNumeracaoGabinete();
          console.log(JSON.stringify({
            numFallback,
            kpiOficio: elems.kpiProximoOficio.textContent,
            kpiPortaria: elems.kpiProximaPortaria.textContent,
            oficioVal: elems.oficioNumeroInput.value,
            oficioPlaceholder: elems.oficioNumeroInput.placeholder
          }));
        })();
        """
        proc = subprocess.run(
            [
                "node", "-e", node_script,
                str(SPA_DIR / "js" / "supabase_client.js"),
                str(SPA_DIR / "js" / "views" / "visaoGeral.js"),
                str(SPA_DIR / "js" / "views" / "oficios.js"),
            ],
            capture_output=True, text=True, encoding="utf-8", check=True
        )
        out = json.loads(proc.stdout.strip().splitlines()[-1])
        self.assertIsNone(out["numFallback"])
        self.assertEqual(out["kpiOficio"], "--")
        self.assertEqual(out["kpiPortaria"], "--")
        self.assertEqual(out["oficioVal"], "")
        self.assertEqual(out["oficioPlaceholder"], "--")

    def test_02_permutas_servidor_lookup_by_nome_or_matricula(self):
        """Valida a busca consolidada de servidor por Nome ou Matrícula substituindo Intenção de Permuta por padrão."""
        html = (SPA_DIR / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="painelConsultaServidorCadmo"', html)
        self.assertIn('id="consultaServidorInput"', html)
        self.assertRegex(html, r'<div\s+id="wrapperFormPermuta"\s+class="hidden"')

        node_script = r"""
        const fs = require('fs');
        const vm = require('vm');
        const ctx = {
          console,
          setTimeout,
          clearTimeout,
          localStorage: { getItem: () => null, setItem: () => {} },
          MutationObserver: function() { this.observe = () => {}; },
          document: {
            readyState: 'complete',
            getElementById: () => null,
            createDocumentFragment: () => ({ appendChild: () => {} }),
            createElement: () => ({ dataset: {}, style: {}, appendChild: () => {} }),
            addEventListener: () => {}
          }
        };
        ctx.window = ctx;
        ctx.OlymposApp = { escapeHtml: (s) => String(s || ''), showToast: () => {} };
        ctx.OlymposApi = { chamar: () => {} };

        vm.createContext(ctx);
        const dataDocentes = SPA => fs.readFileSync(SPA, 'utf8');
        const docentesPath = process.argv[1];
        const vinculosPath = process.argv[2];
        const cadmoPath = process.argv[3];
        const servidoresPath = process.argv[4];
        if (servidoresPath && fs.existsSync(servidoresPath)) vm.runInContext(dataDocentes(servidoresPath), ctx);
        if (fs.existsSync(docentesPath)) vm.runInContext(dataDocentes(docentesPath), ctx);
        if (fs.existsSync(vinculosPath)) vm.runInContext(dataDocentes(vinculosPath), ctx);
        vm.runInContext(dataDocentes(cadmoPath), ctx);

        const api = ctx.OlymposViews.papiroCadmo;
        const todosDocentes = api.obterDocentesCearaMirim();
        const amostra = todosDocentes[0];
        const porMatricula = api.buscarInformacoesServidor(amostra.m);
        const porMatriculaSemZero = api.buscarInformacoesServidor(amostra.m.replace(/^0+/, ''));
        const porNome = api.buscarInformacoesServidor(amostra.n.split(' ').slice(0, 2).join(' '));
        const inexistente = api.buscarInformacoesServidor('MATRICULA_INEXISTENTE_9999999');

        // Testes de Servidores da Rede Estadual (Governo do Estado / SEEC-RN) e acúmulo de cargos
        const porMatEstadual = api.buscarInformacoesServidor('192341-2');
        const porNomeEstadual = api.buscarInformacoesServidor('FRANCISCO DE ASSIS MEDEIROS');
        const acumuloOdjaime = api.buscarInformacoesServidor('ODJAIME CAMARA DE ARAUJO');

        // Testes de Sincronização Unificada com o Papiro de Cadmo
        const todosServidores = typeof api.obterTodosServidores === 'function' ? api.obterTodosServidores() : [];
        const temSincronizador = typeof api.sincronizarServidores === 'function';

        console.log(JSON.stringify({
          totalDocentes: todosDocentes.length,
          totalServidoresSincronizados: todosServidores.length,
          temSincronizador: temSincronizador,
          possuiServidoresEstaduais: todosServidores.some(s => (s.ente || '').includes('Estado') || (s.ente || '').includes('SEEC')),
          possuiServidoresNatal: todosServidores.some(s => (s.ente || '').includes('Natal')),
          possuiServidoresParnamirim: todosServidores.some(s => (s.ente || '').includes('Parnamirim')),
          possuiServidoresSGA: todosServidores.some(s => (s.ente || '').includes('São Gonçalo') || (s.ente || '').includes('SGA')),
          amostraMat: amostra.m,
          amostraNome: amostra.n,
          achouPorMat: porMatricula.length > 0 && porMatricula[0].matriculas.includes(amostra.m),
          achouSemZero: porMatriculaSemZero.length > 0,
          achouPorNome: porNome.some(s => s.nome === amostra.n),
          possuiAuditoria: Boolean(porMatricula[0] && porMatricula[0].auditoriaConstitucional),
          inexistenteVazio: inexistente.length === 0,
          achouEstadualMat: porMatEstadual.length > 0 && porMatEstadual[0].matriculas.includes('192341-2'),
          achouEstadualNome: porNomeEstadual.length > 0 && porNomeEstadual[0].nome === 'FRANCISCO DE ASSIS MEDEIROS',
          estadualTemEnte: porMatEstadual.length > 0 && porMatEstadual[0].vinculos.some(v => v.ente.includes('Governo do Estado') || v.ente.includes('SEEC')),
          acumuloDuploDetectado: acumuloOdjaime.length > 0 && acumuloOdjaime[0].vinculos.length >= 2
        }));
        """
        proc = subprocess.run(
            [
                "node", "-e", node_script,
                str(SPA_DIR / "js" / "data" / "docentes_ceara_mirim.js"),
                str(SPA_DIR / "js" / "data" / "vinculos_transparencia.js"),
                str(SPA_DIR / "js" / "views" / "papiroCadmo.js"),
                str(SPA_DIR / "js" / "data" / "servidoresData.js"),
            ],
            capture_output=True, text=True, encoding="utf-8", check=True
        )
        out = json.loads(proc.stdout.strip().splitlines()[-1])
        self.assertGreater(out["totalDocentes"], 100)
        self.assertTrue(out["temSincronizador"])
        self.assertGreater(out["totalServidoresSincronizados"], 100)
        self.assertTrue(out["possuiServidoresEstaduais"])
        self.assertTrue(out["possuiServidoresNatal"])
        self.assertTrue(out["possuiServidoresParnamirim"])
        self.assertTrue(out["possuiServidoresSGA"])
        self.assertTrue(out["achouPorMat"])
        self.assertTrue(out["achouSemZero"])
        self.assertTrue(out["achouPorNome"])
        self.assertTrue(out["possuiAuditoria"])
        self.assertTrue(out["inexistenteVazio"])
        self.assertTrue(out["achouEstadualMat"])
        self.assertTrue(out["achouEstadualNome"])
        self.assertTrue(out["estadualTemEnte"])
        self.assertTrue(out["acumuloDuploDetectado"])

    def test_03_setup_modal_requests_only_public_key_and_derives_url(self):
        """Verifica que a configuração solicita apenas a Chave Pública do Supabase, derivando a URL via JWT."""
        html = (SPA_DIR / "index.html").read_text(encoding="utf-8")
        self.assertNotIn('id="setupGasWebhookUrl"', html)
        self.assertRegex(html, r'<input[^>]+id="setupSupabaseUrl"[^>]+class="sr-only"')
        self.assertIn('id="setupSupabaseAnonKey"', html)

        node_script = r"""
        const fs = require('fs');
        const vm = require('vm');
        const store = {};
        const ctx = {
          console,
          atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
          setTimeout: (fn) => fn(),
          localStorage: {
            getItem: (k) => store[k] || null,
            setItem: (k, v) => { store[k] = String(v); }
          },
          document: {
            readyState: 'complete',
            getElementById: () => null,
            addEventListener: () => {}
          }
        };
        ctx.window = ctx;
        vm.createContext(ctx);
        vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);
        vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);

        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'xyzabcdefghijklmnopq', role: 'anon' })).toString('base64url');
        const fakeAnonJwt = `${header}.${payload}.fakesig1234567890`;

        const derived = ctx.OlymposSupabase.extrairUrlSupabaseDaChave(fakeAnonJwt);
        const modalResolved = ctx.OlymposSetupModal.resolverUrlAutomatica(fakeAnonJwt);
        console.log(JSON.stringify({ derived, modalResolved }));
        """
        proc = subprocess.run(
            [
                "node", "-e", node_script,
                str(SPA_DIR / "js" / "supabase_client.js"),
                str(SPA_DIR / "js" / "setup_modal.js"),
            ],
            capture_output=True, text=True, encoding="utf-8", check=True
        )
        out = json.loads(proc.stdout.strip().splitlines()[-1])
        self.assertEqual(out["derived"], "https://xyzabcdefghijklmnopq.supabase.co")
        self.assertEqual(out["modalResolved"], "https://xyzabcdefghijklmnopq.supabase.co")

    def test_04_login_popup_texts_removed(self):
        """Confirma a remoção exata dos dois textos solicitados no pop-up de login (#loginScreen)."""
        html = (SPA_DIR / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("Identifique seu perfil setorial para carregar os módulos autorizados de governança e automação.", html)
        self.assertNotIn("Autenticação corporativa protegida via", html)
        self.assertNotIn("Utilize seu e-mail institucional e senha cadastrados no sistema.", html)

    def test_05_gas_security_rbac_constant_time_and_no_stack_leak(self):
        """Testa blindagem do Gateway GAS: zero stack trace, tempo constante, sem texto plano e RBAC server-side."""
        router_gs = (GAS_DIR / "01_router_main.gs").read_text(encoding="utf-8")
        sup_gs = (GAS_DIR / "08_service_supabase.gs").read_text(encoding="utf-8")

        self.assertNotIn("stack: err.stack", router_gs, "Vazamento de stack trace detectado em 01_router_main.gs")
        self.assertNotIn("passLimpa === hashArmazenado", router_gs, "Comparação de senha em texto plano detectada")
        self.assertNotRegex(router_gs, r"isAcaoLeituraPublica\s*=\s*\([^)]*olho_apolo_sync", "olho_apolo_sync não deve ser pública sem auth")
        self.assertIn("senha.length < 12", sup_gs, "Política mínima de 12 caracteres deve estar ativa no backend GAS")

        node_script = r"""
        const fs = require('fs');
        const vm = require('vm');
        const ctx = { console };
        vm.createContext(ctx);
        vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);

        const eqOk = ctx.compararTempoConstante_('segredo_token_123456', 'segredo_token_123456');
        const eqDiff = ctx.compararTempoConstante_('segredo_token_123456', 'segredo_token_123457');
        const eqLen = ctx.compararTempoConstante_('curto', 'muito_mais_longo');

        const pedBloqueadoLote = ctx.verificarAutorizacaoRotaRbac_('portarias_gerar_lote', { perfil: { id: 'PEDAGOGICO_EVENTOS' } });
        const rhBloqueadoUser = ctx.verificarAutorizacaoRotaRbac_('usuario_criar', { perfil: { id: 'RH_COMISSAO' } });
        const rhPermitidoLicenca = ctx.verificarAutorizacaoRotaRbac_('licenca_cadastrar', { perfil: { id: 'RH_COMISSAO' } });
        const adminPermitido = ctx.verificarAutorizacaoRotaRbac_('memorias_salvar', { perfil: { id: 'ADMIN_GABINETE' } });

        console.log(JSON.stringify({
          eqOk, eqDiff, eqLen,
          pedBloqueadoLote: pedBloqueadoLote.ok,
          rhBloqueadoUser: rhBloqueadoUser.ok,
          rhPermitidoLicenca: rhPermitidoLicenca.ok,
          adminPermitido: adminPermitido.ok
        }));
        """
        proc = subprocess.run(
            ["node", "-e", node_script, str(GAS_DIR / "01_router_main.gs")],
            capture_output=True, text=True, encoding="utf-8", check=True
        )
        out = json.loads(proc.stdout.strip().splitlines()[-1])
        self.assertTrue(out["eqOk"])
        self.assertFalse(out["eqDiff"])
        self.assertFalse(out["eqLen"])
        self.assertFalse(out["pedBloqueadoLote"])
        self.assertFalse(out["rhBloqueadoUser"])
        self.assertTrue(out["rhPermitidoLicenca"])
        self.assertTrue(out["adminPermitido"])

    def test_06_frontend_csprng_postgrest_sanitization_and_migration_010(self):
        """Valida CSPRNG WebCrypto em app.js, filtro anti-injeção PostgREST e migração 010 de segurança."""
        app_js = (SPA_DIR / "js" / "app.js").read_text(encoding="utf-8")
        sup_js = (SPA_DIR / "js" / "supabase_client.js").read_text(encoding="utf-8")
        mig_010 = (MIGRATIONS_DIR / "20261107_010_security_advisor_hardening.sql").read_text(encoding="utf-8")

        self.assertIn("getRandomValues", app_js)
        self.assertNotIn("0.5 - Math.random()", app_js)
        self.assertIn("checkHaveIBeenPwned", app_js)
        self.assertIn(r"replace(/[,()*%\\]/g, ' ')", sup_js)

        self.assertIn("ALTER EXTENSION vector SET SCHEMA extensions", mig_010)
        self.assertIn("SECURITY INVOKER", mig_010)
        self.assertIn("REVOKE ALL ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) FROM PUBLIC, anon, authenticated;", mig_010)
        self.assertIn("REVOKE ALL ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) FROM PUBLIC, anon, authenticated;", mig_010)


if __name__ == "__main__":
    unittest.main()
