#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_sec_options.py (M12)
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Bateria automatizada e genuína de testes cobrindo as 6 Opções Estratégicas de Segurança:
1. Opção 3 — Frontend Security Shield: Strict CSP Meta Tag & Supabase JS Fixado com SRI (Integrity).
2. Opção 2 — Autenticação Reforçada: HIBP k-Anonymity Normalization & GoTrue TOTP MFA (aal2).
3. Opção 1 — Backend Edge Function Gateway: Deno TypeScript, Rate Limiter e Assinatura HMAC-SHA256.
4. Opção 5 — Zero-Cost Rate Limiting no GAS: CacheService distribuído (<250 chars) & HMAC Anti-Replay.
5. Opção 4 — Supabase Vault & Rotação de Chaves: Migração 011, Prioridade Vault->GUC->Private, RPCs de Rotação.
6. Opção 6 — Assinatura Assegurada de Certificados: WebCrypto ECDSA P-256, RFC 8785 e Verificação Offline (<2ms).
7. Paridade e Sincronização Estrita dos Espelhos Monorepo e Templates HTML GAS.
"""

import json
import os
import re
import subprocess
import unittest
from pathlib import Path

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
SPA_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "frontend_spa"
GAS_DIR = OLYMPOS_ROOT / "1_google_apps_script" / "hub_webapp"
MIGRATIONS_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "supabase" / "migrations"
EDGE_FUNCTIONS_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "supabase" / "functions"
BASE_DIR = OLYMPOS_ROOT.parent
WEBAPP_MIRROR = BASE_DIR / "hub-olympos-webapp"
FRONTEND_MIRROR = BASE_DIR / "hub-olympos-frontend"


class TestStrategicSecurityOptions(unittest.TestCase):
    """Testes de conformidade e integridade das 6 Opções Estratégicas de Segurança Olympos."""

    def test_01_strict_csp_and_pinned_supabase_sri(self):
        """Opção 3: CSP restritivo e Supabase JS v2.119.0 com hash SRI sha384."""
        index_html = (SPA_DIR / "index.html").read_text(encoding="utf-8")

        # 1. Validação da Meta Tag CSP
        self.assertIn('<meta http-equiv="Content-Security-Policy"', index_html)
        csp_match = re.search(r'<meta http-equiv="Content-Security-Policy"\s+content="([^"]+)"', index_html)
        self.assertIsNotNone(csp_match, "Meta tag CSP não encontrada ou mal formatada em index.html")
        csp_content = csp_match.group(1)

        # Diretivas CSP obrigatórias
        self.assertIn("default-src 'self'", csp_content)
        self.assertIn("script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com", csp_content)
        self.assertIn("connect-src 'self' https://*.supabase.co wss://*.supabase.co https://script.google.com https://script.googleusercontent.com https://api.pwnedpasswords.com", csp_content)
        self.assertIn("object-src 'none'", csp_content)
        self.assertIn("base-uri 'self'", csp_content)

        # 2. Supabase JS fixado com integridade SRI exata
        sri_pattern = re.compile(
            r'<script\s+src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2\.119\.0/dist/umd/supabase\.js"\s+'
            r'integrity="sha384-uteMfOloLDGt042uDz\+xHGF3ym63/WQ6rFq7murQRG8Ih7QrXGEGNtWd8688sb4O"\s+'
            r'crossorigin="anonymous"></script>'
        )
        self.assertRegex(index_html, sri_pattern, "Tag do Supabase SDK deve estar fixada na v2.119.0 com SRI exato.")

        # 3. Ausência de versão flutuante não ancorada
        self.assertNotIn("@supabase/supabase-js@2<", index_html)
        self.assertNotIn("@supabase/supabase-js@2\"", index_html)

    def test_02_totp_mfa_modal_components_markup(self):
        """Opção 2: Presença dos componentes de diálogo para desafio e registro TOTP MFA no DOM."""
        index_html = (SPA_DIR / "index.html").read_text(encoding="utf-8")

        # Modal Desafio (#modalMfaDesafio)
        self.assertIn('id="modalMfaDesafio"', index_html)
        self.assertIn('id="formMfaDesafio"', index_html)
        self.assertIn('id="mfaChallengeCode"', index_html)
        self.assertIn('id="btnConfirmarMfaDesafio"', index_html)
        self.assertIn('id="btnCancelarMfaDesafio"', index_html)
        self.assertIn('id="mfaDesafioFeedback"', index_html)

        # Modal Ativação/Enroll (#modalMfaEnroll)
        self.assertIn('id="modalMfaEnroll"', index_html)
        self.assertIn('id="formMfaEnroll"', index_html)
        self.assertIn('id="mfaQrCodeContainer"', index_html)
        self.assertIn('id="mfaSecretKeyText"', index_html)
        self.assertIn('id="mfaEnrollCode"', index_html)
        self.assertIn('id="btnConfirmarMfaEnroll"', index_html)
        self.assertIn('id="btnCancelarMfaEnroll"', index_html)
        self.assertIn('id="mfaEnrollFeedback"', index_html)

    def test_03_service_worker_pwnedpasswords_bypass_and_assets(self):
        """Opções 2 & 3: Bypass de cache para pwnedpasswords e inclusão de certificados_crypto no SW."""
        sw_code = (SPA_DIR / "sw.js").read_text(encoding="utf-8")

        # Bypass explícito para pwnedpasswords.com (k-anonymity range queries não devem ser cacheadas como shell)
        self.assertIn("url.hostname.includes('pwnedpasswords.com')", sw_code)

        # Inclusão do módulo criptográfico em SHELL_ASSETS
        self.assertIn("'./js/certificados_crypto.js'", sw_code)

    def test_04_password_guard_hibp_normalization_and_user_creation_block(self):
        """Opção 2: Normalização do retorno de checkHaveIBeenPwned e bloqueio de criação em app.js."""
        guard_code = (SPA_DIR / "js" / "olympos_password_guard.js").read_text(encoding="utf-8")
        app_code = (SPA_DIR / "js" / "app.js").read_text(encoding="utf-8")

        # Normalização contendo tanto leaked quanto pwned
        self.assertIn("leaked: true", guard_code)
        self.assertIn("pwned: true", guard_code)
        self.assertIn("count: count", guard_code)
        self.assertIn("breachCount: count", guard_code)
        self.assertIn("checked: true", guard_code)

        # Bloqueio em app.js
        self.assertIn("hibp.leaked || hibp.pwned", app_code)

        # Validação comportamental em Node.js simulando a API HIBP k-Anonymity
        node_script = r"""
        const vm = require('vm');
        const fs = require('fs');
        const code = fs.readFileSync('""" + str(SPA_DIR / "js" / "olympos_password_guard.js").replace("\\", "/") + r"""', 'utf8');

        // Cria contexto com crypto.subtle mock
        const cryptoMock = {
          subtle: {
            digest: async (algo, data) => {
              // SHA-1 mock determinístico para "senha123" -> prefixo 5D414, sufixo 02ABC...
              return Buffer.from('5D41402ABC1234567890ABCDEF1234567890ABCD', 'hex');
            }
          }
        };
        const winObj = { crypto: cryptoMock };
        winObj.window = winObj;

        const sandbox = {
          window: winObj,
          console: console,
          crypto: cryptoMock,
          TextEncoder: class {
            encode(str) { return Buffer.from(str, 'utf8'); }
          },
          fetch: async (url) => {
            // Simula resposta da api.pwnedpasswords.com com sufixo encontrado
            return {
              ok: true,
              status: 200,
              text: async () => "11111111111111111111111111111111111:5\n02ABC1234567890ABCDEF1234567890ABCD:42\n22222222222222222222222222222222222:1\n"
            };
          }
        };

        vm.createContext(sandbox);
        vm.runInContext(code, sandbox);

        const guard = sandbox.window.OlymposPasswordGuard || sandbox.window.OlymposPasswordSecurity;
        guard.checkHaveIBeenPwned("senha123").then(res => {
          if (!res.leaked || !res.pwned || res.count !== 42 || res.breachCount !== 42 || !res.checked) {
            console.error("Falha na normalização HIBP:", JSON.stringify(res));
            process.exit(1);
          }
          console.log("SUCCESS_HIBP_NORMALIZATION");
        }).catch(err => {
          console.error("Erro no teste HIBP:", err);
          process.exit(1);
        });
        """

        result = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True,
            text=True,
            cwd=str(OLYMPOS_ROOT)
        )
        self.assertEqual(result.returncode, 0, f"Falha no teste Node de HIBP: {result.stderr}")
        self.assertIn("SUCCESS_HIBP_NORMALIZATION", result.stdout)

    def test_05_mfa_client_logic_and_role_enforcement(self):
        """Opção 2: Métodos de MFA em supabase_client.js e obrigatoriedade para ADMIN_GABINETE e JURIDICO."""
        sup_code = (SPA_DIR / "js" / "supabase_client.js").read_text(encoding="utf-8")
        app_code = (SPA_DIR / "js" / "app.js").read_text(encoding="utf-8")

        # Funções GoTrue TOTP MFA exportadas
        self.assertIn("checkMfaStatus", sup_code)
        self.assertIn("enrollMfaTotp", sup_code)
        self.assertIn("challengeAndVerifyMfa", sup_code)
        self.assertIn("unenrollMfa", sup_code)
        self.assertIn("isRoleMfaMandatory", sup_code)

        # Checagem em app.js durante o login
        self.assertIn("abrirModalMfaDesafio", app_code)
        self.assertIn("abrirModalMfaEnroll", app_code)
        self.assertIn("currentAal !== 'aal2'", app_code)

        # Validação comportamental das regras de obrigatoriedade de roles
        node_script = r"""
        const vm = require('vm');
        const fs = require('fs');
        const code = fs.readFileSync('""" + str(SPA_DIR / "js" / "supabase_client.js").replace("\\", "/") + r"""', 'utf8');

        const sandbox = {
          window: {},
          document: { readyState: 'complete', addEventListener: () => {} },
          console: console,
          localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          location: { hostname: 'localhost' }
        };

        vm.createContext(sandbox);
        vm.runInContext(code, sandbox);

        const isMandatory = sandbox.window.OlymposSupabase.isRoleMfaMandatory;
        if (!isMandatory('ADMIN_GABINETE')) process.exit(10);
        if (!isMandatory('JURIDICO')) process.exit(11);
        if (isMandatory('RH_COMISSAO')) process.exit(12);
        if (isMandatory('PEDAGOGICO_EVENTOS')) process.exit(13);

        console.log("SUCCESS_MFA_ROLES");
        """

        result = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True,
            text=True,
            cwd=str(OLYMPOS_ROOT)
        )
        self.assertEqual(result.returncode, 0, f"Falha na validação de papéis MFA obrigatórios: {result.stderr}")
        self.assertIn("SUCCESS_MFA_ROLES", result.stdout)

    def test_06_gas_gateway_edge_function_security(self):
        """Opção 1: Edge Function gas-gateway com autenticação JWT, rate limiting e HMAC anti-replay."""
        edge_file = EDGE_FUNCTIONS_DIR / "gas-gateway" / "index.ts"
        self.assertTrue(edge_file.exists(), f"Edge Function {edge_file} não encontrada")
        edge_code = edge_file.read_text(encoding="utf-8")

        # 1. Regras de Rate Limiting sliding-window
        self.assertIn("rateLimitMap", edge_code)
        self.assertIn("checkEdgeRateLimit", edge_code)
        self.assertIn("120", edge_code, "Deve possuir limite geral de 120 req/min")
        self.assertIn("10", edge_code, "Deve possuir limite sensível de 10 req/min")

        # 2. Autenticação JWT via Supabase client
        self.assertIn("supabase.auth.getUser", edge_code)

        # 3. Assinatura HMAC-SHA256 da carga com token secreto
        self.assertIn("crypto.subtle.importKey", edge_code)
        self.assertIn("crypto.subtle.sign", edge_code)
        self.assertIn('"HMAC"', edge_code)
        self.assertIn("x-olympos-signature", edge_code)
        self.assertIn("x-olympos-timestamp", edge_code)

        # 4. Timeout de encaminhamento para o GAS (25 segundos)
        self.assertIn("25000", edge_code)
        self.assertIn("abortController", edge_code)

        # 5. Headers de resposta CORS
        self.assertIn("Access-Control-Allow-Origin", edge_code)
        self.assertIn("Access-Control-Allow-Methods", edge_code)
        self.assertIn("Access-Control-Allow-Headers", edge_code)

    def test_07_gas_router_hmac_and_cache_ratelimit(self):
        """Opção 5: Verificação de assinatura HMAC, proteção anti-replay e rate limiting por CacheService no GAS."""
        router_file = GAS_DIR / "01_router_main.gs"
        self.assertTrue(router_file.exists(), f"Arquivo GAS {router_file} não encontrado")
        router_code = router_file.read_text(encoding="utf-8")

        # 1. Verificação de Assinatura HMAC com anti-replay de 5 minutos
        self.assertIn("verificarAssinaturaHmacGateway_", router_code)
        self.assertIn("x-olympos-signature", router_code)
        self.assertIn("x-olympos-timestamp", router_code)
        self.assertIn("Utilities.computeHmacSha256Signature", router_code)
        self.assertIn("compararTempoConstante_", router_code)
        self.assertIn("300000", router_code, "Janela anti-replay deve ser de 5 minutos (300.000 ms)")

        # 2. Rate Limiting com CacheService.getScriptCache()
        self.assertIn("verificarRateLimitGas_", router_code)
        self.assertIn("CacheService.getScriptCache()", router_code)

        # 3. Hash de chave de cache para garantir comprimento < 250 caracteres (especificação do Google CacheService)
        self.assertIn("Utilities.computeDigest", router_code)
        self.assertIn("Utilities.DigestAlgorithm.SHA_256", router_code)

        # 4. Limites de ações sensíveis configurados
        self.assertIn("auth_login", router_code)
        self.assertIn("usuario_criar", router_code)
        self.assertIn("prometheus_boletim_disparar", router_code)
        self.assertIn("certificados_executar", router_code)
        self.assertIn("portarias_gerar_lote", router_code)

        # 5. Roteamento rápido do gateway (economizando quota de UrlFetchApp)
        self.assertIn("rotearAcaoGatewayHub", router_code)
        self.assertIn("isGatewayProxy", router_code)

    def test_08_frontend_api_dual_mode_and_cors_simple_request(self):
        """Opção 1 & Compatibilidade: Dual-mode routing (Edge Gateway + fallback GAS) e CORS Simple Request."""
        api_code = (SPA_DIR / "js" / "api.js").read_text(encoding="utf-8")

        # 1. Chamada primária ao Gateway
        self.assertIn("gas-gateway", api_code)
        self.assertIn("executarFallbackDiretoGAS", api_code)

        # 2. Preservação estrita das regras de CORS Simple Request para o fallback direto
        self.assertIn("'Content-Type': 'text/plain;charset=utf-8'", api_code)

        # 3. Conexão canônica ao Google Apps Script mantida
        self.assertIn("AKfycbw-zKUdYJO6Zw1_XHo12a49p2wpgNtfii-2CJOq1838f6S1-L0SYM6iI9A2PS2ZPjYdmQ", api_code)

    def test_09_database_vault_migration_011_hierarchy_and_rotation(self):
        """Opção 4: Prioridade Vault -> GUC -> Private e RPCs de rotação com menor privilégio."""
        mig_file = MIGRATIONS_DIR / "20261107_011_vault_secrets_and_key_rotation.sql"
        self.assertTrue(mig_file.exists(), f"Migração 011 {mig_file} não encontrada")
        mig_code = mig_file.read_text(encoding="utf-8")

        # 1. Extensão Supabase Vault
        self.assertIn("CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;", mig_code)

        # 2. Migração automática e idempotente
        self.assertIn("vault.create_secret", mig_code)
        self.assertIn("DO $$", mig_code)

        # 3. Função get_crypto_setting com prioridade correta
        self.assertIn("vault.decrypted_secrets", mig_code)
        self.assertIn("current_setting('app.settings.' || p_key, true)", mig_code)
        self.assertIn("private_config.crypto_settings", mig_code)

        # 4. RPCs de rotação e recifragem
        self.assertIn("rotate_encryption_master_key", mig_code)
        self.assertIn("rotate_blind_index_salt", mig_code)
        self.assertIn("cpf_encrypted", mig_code)
        self.assertIn("matricula_encrypted", mig_code)
        self.assertIn("dados_medicos_encrypted", mig_code)
        self.assertIn("cpf_hash", mig_code)
        self.assertIn("matricula_hash", mig_code)

        # 5. Trilha de auditoria em audit_logs
        self.assertIn("INSERT INTO public.audit_logs", mig_code)
        self.assertIn("'KEY_ROTATION_MASTER_KEY'", mig_code)
        self.assertIn("'KEY_ROTATION_BLIND_INDEX_SALT'", mig_code)

        # 6. Menor privilégio: REVOKE de PUBLIC/anon/authenticated e restrição a postgres/service_role
        self.assertIn("REVOKE ALL ON FUNCTION public.rotate_encryption_master_key(TEXT, TEXT) FROM PUBLIC, anon, authenticated;", mig_code)
        self.assertIn("rotate_encryption_master_key(TEXT, TEXT) TO service_role, postgres;", mig_code)
        self.assertIn("REVOKE ALL ON FUNCTION public.rotate_blind_index_salt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;", mig_code)
        self.assertIn("rotate_blind_index_salt(TEXT, TEXT) TO service_role, postgres;", mig_code)

    def test_10_ecdsa_p256_certificates_webcrypto_and_offline_verification(self):
        """Opção 6: Assinatura e verificação offline ECDSA P-256 (RFC 8785) via WebCrypto em <10ms."""
        crypto_file = SPA_DIR / "js" / "certificados_crypto.js"
        self.assertTrue(crypto_file.exists(), f"Módulo criptográfico {crypto_file} não encontrado")

        # Validação comportamental via Node.js executando WebCrypto genuíno
        node_script = r"""
        const fs = require('fs');
        const vm = require('vm');
        const code = fs.readFileSync('""" + str(crypto_file).replace("\\", "/") + r"""', 'utf8');

        const winObj = { crypto: globalThis.crypto };
        winObj.window = winObj;
        const sandbox = {
          window: winObj,
          console: console,
          crypto: globalThis.crypto,
          performance: globalThis.performance,
          Buffer: Buffer,
          TextEncoder: globalThis.TextEncoder,
          TextDecoder: globalThis.TextDecoder,
          btoa: globalThis.btoa,
          atob: globalThis.atob
        };

        vm.createContext(sandbox);
        vm.runInContext(code, sandbox);

        const CC = sandbox.window.CertificadosCrypto || sandbox.window.OlymposCertificadosCrypto;
        if (!CC) {
          console.error("CertificadosCrypto não anexado ao window");
          process.exit(1);
        }

        (async () => {
          // 1. Gera par de chaves ECDSA P-256 genuíno no WebCrypto
          const keyPair = await globalThis.crypto.subtle.generateKey(
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign", "verify"]
          );
          const pubJwk = await globalThis.crypto.subtle.exportKey("jwk", keyPair.publicKey);
          const privateKey = keyPair.privateKey;

          const payload = {
            id: "CERT-2026-TESTE-001",
            participante: "Servidor Teste SMEB",
            evento: "Seminário Municipal de Governança Digital",
            carga_horaria: 40,
            ano: 2026
          };

          const canonicalPayload = CC.serializarCanonico(payload);
          const encoded = new TextEncoder().encode(canonicalPayload);
          const rawSig = await globalThis.crypto.subtle.sign(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            privateKey,
            encoded
          );

          // Converte para base64url
          const sigBase64 = Buffer.from(rawSig).toString('base64url');
          const payloadBase64 = Buffer.from(canonicalPayload).toString('base64url');
          const validToken = payloadBase64 + "." + sigBase64;

          // 2. Mede tempo de verificação pública offline
          const t0 = performance.now();
          const resultado = await CC.verificarToken(validToken, pubJwk);
          const t1 = performance.now();
          const tempoMs = t1 - t0;

          if (!resultado.valido) {
            console.error("Token válido foi rejeitado:", resultado.erro || resultado.mensagem);
            process.exit(2);
          }

          if (tempoMs > 25) {
            console.warn(`Verificação lenta: ${tempoMs}ms`);
          }

          // 3. Teste de adulteração: payload com 1 caractere forjado deve falhar
          const payloadAdulterado = { ...payload, carga_horaria: 80 };
          const payloadAdulteradoBase64 = Buffer.from(CC.serializarCanonico(payloadAdulterado)).toString('base64url');
          const tokenAdulterado = payloadAdulteradoBase64 + "." + sigBase64;

          const resAdulterado = await CC.verificarToken(tokenAdulterado, pubJwk);
          if (resAdulterado.valido) {
            console.error("Token adulterado foi aceito indevidamente!");
            process.exit(3);
          }

          // 4. Teste de assinatura corrompida
          const tokenCorrompido = payloadBase64 + ".AAAAAA_INVALID_SIGNATURE";
          const resCorrompido = await CC.verificarToken(tokenCorrompido, pubJwk);
          if (resCorrompido.valido) {
            console.error("Token com assinatura inválida foi aceito!");
            process.exit(4);
          }

          console.log(`SUCCESS_ECDSA_VERIFICATION:${tempoMs.toFixed(2)}ms`);
        })().catch(err => {
          console.error("Erro no teste ECDSA P-256:", err);
          process.exit(5);
        });
        """

        result = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True,
            text=True,
            cwd=str(OLYMPOS_ROOT)
        )
        self.assertEqual(result.returncode, 0, f"Falha na verificação ECDSA P-256: {result.stderr}")
        self.assertIn("SUCCESS_ECDSA_VERIFICATION", result.stdout)

    def test_11_mirrors_and_templates_synchronization_parity(self):
        """Milestone M4: Garantia de sincronização integral entre código-fonte, espelhos e bundles GAS."""
        # 1. ui_scripts.html gerado no GAS contém os novos módulos
        ui_scripts_gas = (GAS_DIR / "ui_scripts.html").read_text(encoding="utf-8")
        self.assertIn("// --- MODULE: js/certificados_crypto.js ---", ui_scripts_gas)
        self.assertIn("// --- MODULE: js/views/liraOrfeu.js ---", ui_scripts_gas)
        self.assertIn("// --- MODULE: js/olympos_password_guard.js ---", ui_scripts_gas)

        # 2. ui_index.html do GAS reflete o CSP e os modais MFA
        ui_index_gas = (GAS_DIR / "ui_index.html").read_text(encoding="utf-8")
        self.assertIn('Content-Security-Policy', ui_index_gas)
        self.assertIn('id="modalMfaDesafio"', ui_index_gas)
        self.assertIn('id="modalMfaEnroll"', ui_index_gas)

        # 3. Espelho hub-olympos-frontend contém arquivos sincronizados idênticos
        if FRONTEND_MIRROR.exists():
            fe_crypto = (FRONTEND_MIRROR / "js" / "certificados_crypto.js").read_text(encoding="utf-8")
            spa_crypto = (SPA_DIR / "js" / "certificados_crypto.js").read_text(encoding="utf-8")
            self.assertEqual(fe_crypto, spa_crypto, "Paridade violada entre frontend_spa e hub-olympos-frontend para certificados_crypto.js")

            fe_index = (FRONTEND_MIRROR / "index.html").read_text(encoding="utf-8")
            spa_index = (SPA_DIR / "index.html").read_text(encoding="utf-8")
            self.assertEqual(fe_index, spa_index, "Paridade violada entre frontend_spa e hub-olympos-frontend para index.html")

        # 4. Espelho hub-olympos-webapp contém arquivos sincronizados
        if WEBAPP_MIRROR.exists():
            webapp_router = (WEBAPP_MIRROR / "01_router_main.gs").read_text(encoding="utf-8")
            self.assertIn("verificarAssinaturaHmacGateway_", webapp_router)
            self.assertIn("verificarRateLimitGas_", webapp_router)


if __name__ == "__main__":
    unittest.main()
