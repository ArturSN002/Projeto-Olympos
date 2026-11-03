#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Testes: test_sql_migrations.py
Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB)

Validação automatizada de integridade das migrações SQL do Supabase:
- Sintaxe DDL e parsing relacional
- Criação de extensões ('pgcrypto', 'uuid-ossp')
- Estrutura de tabelas, campos encriptados e foreign keys
- Políticas de Row Level Security (RLS) para as 4 roles (ADMIN_GABINETE, RH_COMISSAO, PEDAGOGICO_EVENTOS, JURIDICO)
- Ausência de 'FORCE ROW LEVEL SECURITY'
- Checagem tri-state de autorização em RPCs ('IF v_caller_role IS NULL OR v_caller_role NOT IN')
- Princípio do menor privilégio ('REVOKE EXECUTE ... FROM PUBLIC, anon')
- Funções criptográficas ('encrypt_pii' VOLATILE, blind index sem salt fixo)
- Sanitização de seeds demonstrativos
"""

import re
import unittest
from pathlib import Path

import sqlglot

OLYMPOS_ROOT = Path(__file__).resolve().parent.parent
SUPABASE_DIR = OLYMPOS_ROOT / "2_github_pages_actions" / "supabase"
MIGRATIONS_DIR = SUPABASE_DIR / "migrations"
SEEDS_DIR = SUPABASE_DIR / "seeds"

TABLES_EXPECTED = [
    "profiles",
    "servidores",
    "licencas",
    "audit_logs",
    "publicacoes_diario",
    "folha_intermunicipal"
]

ROLES_EXPECTED = [
    "ADMIN_GABINETE",
    "RH_COMISSAO",
    "PEDAGOGICO_EVENTOS",
    "JURIDICO"
]


class TestSqlMigrationsAndSecuritySchema(unittest.TestCase):
    """Bateria de testes para migrações SQL, DDL, RLS e funções RPC com pgcrypto."""

    def setUp(self):
        self.migration_001 = MIGRATIONS_DIR / "20261031_001_initial_schema.sql"
        self.migration_002 = MIGRATIONS_DIR / "20261031_002_rls_policies.sql"
        self.migration_003 = MIGRATIONS_DIR / "20261031_003_pgcrypto_rpc.sql"
        self.migration_004 = MIGRATIONS_DIR / "20261101_004_security_advisor_remediation.sql"
        self.seed_file = SEEDS_DIR / "seed_roles_mock.sql"

    def test_01_migrations_and_seed_files_exist(self):
        """Assegura a presença dos 4 arquivos de migração ordenados e do arquivo de seed."""
        self.assertTrue(self.migration_001.exists(), f"Migração 001 não encontrada: {self.migration_001}")
        self.assertTrue(self.migration_002.exists(), f"Migração 002 não encontrada: {self.migration_002}")
        self.assertTrue(self.migration_003.exists(), f"Migração 003 não encontrada: {self.migration_003}")
        self.assertTrue(self.migration_004.exists(), f"Migração 004 não encontrada: {self.migration_004}")
        self.assertTrue(self.seed_file.exists(), f"Seed não encontrado: {self.seed_file}")

    def test_02_sqlglot_syntax_validation(self):
        """Valida que todos os arquivos de migração possuem sintaxe SQL PostgreSQL válida via sqlglot."""
        for m_file in [self.migration_001, self.migration_002, self.migration_003, self.migration_004]:
            content = m_file.read_text(encoding="utf-8")
            try:
                expressions = sqlglot.parse(content, read="postgres")
                self.assertGreater(len(expressions), 5, f"Poucas expressões SQL extraídas de {m_file.name}")
            except Exception as e:
                self.fail(f"Falha de sintaxe no arquivo {m_file.name}: {e}")

    def test_03_required_extensions_installed(self):
        """Valida a presença de 'pgcrypto' e 'uuid-ossp' criadas em schema apropriado."""
        sql_001 = self.migration_001.read_text(encoding="utf-8")
        self.assertRegex(
            sql_001,
            r'CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+["\']pgcrypto["\']',
            "Extensão 'pgcrypto' não declarada com IF NOT EXISTS na migração 001"
        )
        self.assertRegex(
            sql_001,
            r'CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+["\']uuid-ossp["\']',
            "Extensão 'uuid-ossp' não declarada com IF NOT EXISTS na migração 001"
        )

    def test_04_core_tables_and_foreign_keys_and_encrypted_columns(self):
        """Valida declaração de todas as tabelas requeridas, chaves estrangeiras e colunas criptografadas."""
        sql_001 = self.migration_001.read_text(encoding="utf-8")

        # Tabelas
        for tbl in TABLES_EXPECTED:
            pattern = rf'CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?{tbl}\b'
            self.assertRegex(sql_001, pattern, f"Tabela '{tbl}' não declarada na migração 001")

        # Chaves estrangeiras
        self.assertRegex(sql_001, r'REFERENCES\s+auth\.users\s*\(\s*id\s*\)', "profiles deve referenciar auth.users(id)")
        self.assertRegex(sql_001, r'REFERENCES\s+(?:public\.)?servidores\s*\(\s*id\s*\)', "licencas deve referenciar servidores(id)")

        # Colunas encriptadas BYTEA e blind indexing TEXT
        self.assertRegex(sql_001, r'cpf_encrypted\s+BYTEA\b', "servidores deve possuir cpf_encrypted BYTEA")
        self.assertRegex(sql_001, r'matricula_encrypted\s+BYTEA\b', "servidores deve possuir matricula_encrypted BYTEA")
        self.assertRegex(sql_001, r'dados_medicos_encrypted\s+BYTEA\b', "licencas deve possuir dados_medicos_encrypted BYTEA")
        self.assertRegex(sql_001, r'cpf_hash\s+TEXT\b', "servidores deve possuir cpf_hash TEXT para blind index")
        self.assertRegex(sql_001, r'matricula_hash\s+TEXT\b', "servidores deve possuir matricula_hash TEXT para blind index")

    def test_05_rls_enabled_and_no_force_rls(self):
        """Assegura que todas as tabelas possuem RLS habilitado e NENHUMA utiliza FORCE ROW LEVEL SECURITY."""
        sql_002 = self.migration_002.read_text(encoding="utf-8")

        # Verifica ENABLE ROW LEVEL SECURITY em todas as 6 tabelas
        for tbl in TABLES_EXPECTED:
            pattern = rf'ALTER\s+TABLE\s+(?:public\.)?{tbl}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;'
            self.assertRegex(sql_002, pattern, f"Tabela '{tbl}' não possui ENABLE ROW LEVEL SECURITY na migração 002")

        # Verifica que nenhuma tabela utiliza FORCE ROW LEVEL SECURITY (evita travar Security Definer triggers e admins)
        self.assertNotIn("FORCE ROW LEVEL SECURITY", sql_002.upper(), "Uso proibido de 'FORCE ROW LEVEL SECURITY' detectado na migração 002")

    def test_06_explicit_policies_for_all_4_roles(self):
        """Assegura enum de papéis e políticas RLS para todos os 4 papéis do sistema."""
        sql_001 = self.migration_001.read_text(encoding="utf-8")
        sql_002 = self.migration_002.read_text(encoding="utf-8")

        # Enum app_role na migração 001
        for role in ROLES_EXPECTED:
            self.assertIn(f"'{role}'", sql_001, f"Papel '{role}' ausente no enum app_role da migração 001")

        # Políticas RLS na migração 002
        for role in ROLES_EXPECTED:
            self.assertIn(role, sql_002, f"Políticas RLS não fazem menção ao papel '{role}' na migração 002")

        # Visão protegida para Pedagogico (sem PII)
        self.assertIn("servidores_pedagogico_view", sql_002, "Visão segura servidores_pedagogico_view ausente")
        self.assertIn("security_barrier = true", sql_002, "Visão deve conter security_barrier = true")

        # Trilha de auditoria imutável (bloqueio de insert/update/delete direto e revoke de TRUNCATE)
        self.assertIn("audit_logs_no_direct_insert", sql_002)
        self.assertIn("audit_logs_no_update", sql_002)
        self.assertIn("audit_logs_no_delete", sql_002)
        self.assertRegex(sql_002, r"REVOKE\s+TRUNCATE\s+ON\s+(?:public\.)?audit_logs\s+FROM", "Revoke TRUNCATE em audit_logs ausente")

    def test_07_rpc_security_and_tristate_auth_check(self):
        """Valida que RPCs decriptoras implementam checagem tri-state fail-closed para evitar bypass SQL."""
        sql_003 = self.migration_003.read_text(encoding="utf-8")

        # Verifica presença das RPCs de decifração pontual
        self.assertIn("obter_servidor_detalhado_decrypted", sql_003)
        self.assertIn("obter_licenca_detalhada_decrypted", sql_003)

        # Regra de Segurança Crítica: Checagem Tri-State (IF v_caller_role IS NULL OR v_caller_role NOT IN)
        tristate_pattern = re.compile(
            r"IF\s+v_caller_role\s+IS\s+NULL\s+OR\s+v_caller_role\s+NOT\s+IN",
            re.IGNORECASE
        )
        matches = tristate_pattern.findall(sql_003)
        self.assertGreaterEqual(
            len(matches), 2,
            "Checagem tri-state 'IF v_caller_role IS NULL OR v_caller_role NOT IN' ausente em uma das RPCs de decifração."
        )

        # Verifica registro compulsório em audit_logs dentro da RPC
        self.assertIn("INSERT INTO public.audit_logs", sql_003)
        self.assertIn("'DECRYPT_READ'", sql_003)

    def test_08_crypto_functions_least_privilege_and_volatile(self):
        """Assegura que 'encrypt_pii' é VOLATILE e revoga privilégios de execução de PUBLIC e anon."""
        sql_003 = self.migration_003.read_text(encoding="utf-8")

        # encrypt_pii deve ser VOLATILE
        self.assertTrue(
            bool(re.search(
                r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.encrypt_pii.*?LANGUAGE\s+plpgsql\s+VOLATILE",
                sql_003,
                re.DOTALL
            )),
            "A função 'encrypt_pii' deve ser VOLATILE"
        )

        # REVOKE EXECUTE ... FROM PUBLIC, anon para funções sensíveis
        sensitive_functions = [
            "obter_servidor_detalhado_decrypted",
            "obter_licenca_detalhada_decrypted",
            "encrypt_pii",
            "decrypt_pii",
            "generate_blind_index"
        ]

        for fn_name in sensitive_functions:
            revoke_pattern = rf"REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.{fn_name}\s*\(.*?\)\s*FROM\s+PUBLIC\s*,\s*anon\s*;"
            self.assertRegex(
                sql_003,
                revoke_pattern,
                f"Ausência de 'REVOKE EXECUTE ON FUNCTION public.{fn_name} FROM PUBLIC, anon;'"
            )

    def test_09_blind_index_no_hardcoded_salt(self):
        """Assegura que a função generate_blind_index na migração não possui salt ou pepper fixo embutido."""
        sql_003 = self.migration_003.read_text(encoding="utf-8")
        self.assertIn("current_setting('app.settings.blind_index_salt', true)", sql_003)
        self.assertIn("current_setting('app.settings.blind_index_pepper', true)", sql_003)

        # Verifica que na migração não há chaves hardcoded
        self.assertNotIn("smeb2026", sql_003.lower())
        self.assertNotIn("rh2026", sql_003.lower())

    def test_10_seed_roles_mock_sanitization(self):
        """Valida que o arquivo de seed usa dados mock e nenhuma credencial real exposta."""
        seed_content = self.seed_file.read_text(encoding="utf-8")

        # Verifica flags de ambiente demonstrativo
        self.assertIn("MOCK_PEPPER_FOR_DEMO", seed_content)
        self.assertIn("MOCK_SECRET_KEY_DEMO", seed_content)
        self.assertIn("@smeb.exemplo.gov.br", seed_content)

        # Verifica ausência de CPFs matematicamente válidos reais (apenas dígitos repetidos 111..., 222..., 333...)
        cpfs_found = re.findall(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", seed_content)
        for cpf in cpfs_found:
            digits_only = re.sub(r"\D", "", cpf)
            # Dígitos repetidos são inválidos pela Receita Federal (ex: 111.111.111-11)
            is_mock_repeat = len(set(digits_only)) == 1
            self.assertTrue(is_mock_repeat, f"CPF não seguro detectado no seed: {cpf}")

    def test_11_migration_004_security_advisor_remediation(self):
        """Valida que a migração 004 elimina rls_auto_enable, reforça search_path e restringe privilégios de execução."""
        self.assertTrue(self.migration_004.exists(), f"Migração 004 não encontrada: {self.migration_004}")
        sql_004 = self.migration_004.read_text(encoding="utf-8")

        # 1. Remoção segura de rls_auto_enable() e event triggers órfãos
        self.assertRegex(
            sql_004,
            r"DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.rls_auto_enable\s*\(\s*\)\s+CASCADE\s*;",
            "Migração 004 deve conter 'DROP FUNCTION IF EXISTS public.rls_auto_enable() CASCADE;'"
        )
        self.assertIn("DROP EVENT TRIGGER IF EXISTS ensure_rls;", sql_004)
        self.assertIn("pg_event_trigger", sql_004)

        # 2. Defesa em profundidade nas RPCs de decifração: isolamento de schema e guard de sessão ativa
        self.assertIn("SET search_path = public, auth, extensions", sql_004)
        self.assertIn("auth.uid() IS NULL", sql_004)

        # 3. Princípio do Menor Privilégio (Least Privilege):
        # Revoga execução de PUBLIC e anon
        self.assertRegex(
            sql_004,
            r"REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.obter_servidor_detalhado_decrypted\(UUID,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon;",
            "Ausência de revogação de PUBLIC/anon para obter_servidor_detalhado_decrypted"
        )
        self.assertRegex(
            sql_004,
            r"REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.obter_licenca_detalhada_decrypted\(UUID,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon;",
            "Ausência de revogação de PUBLIC/anon para obter_licenca_detalhada_decrypted"
        )

        # Concede execução exclusiva para service_role (Mediação Backend Proxy)
        self.assertRegex(
            sql_004,
            r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.obter_servidor_detalhado_decrypted\(UUID,\s*TEXT\)\s+TO\s+service_role;",
            "Ausência de GRANT EXECUTE para service_role em obter_servidor_detalhado_decrypted"
        )
        self.assertRegex(
            sql_004,
            r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.obter_licenca_detalhada_decrypted\(UUID,\s*TEXT\)\s+TO\s+service_role;",
            "Ausência de GRANT EXECUTE para service_role em obter_licenca_detalhada_decrypted"
        )

        # Revoga execução direta de authenticated para erradicar o Linter 0029 do Supabase Advisor
        self.assertRegex(
            sql_004,
            r"REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.obter_servidor_detalhado_decrypted\(UUID,\s*TEXT\)\s+FROM\s+authenticated;",
            "Ausência de REVOKE EXECUTE para authenticated em obter_servidor_detalhado_decrypted"
        )
        self.assertRegex(
            sql_004,
            r"REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.obter_licenca_detalhada_decrypted\(UUID,\s*TEXT\)\s+FROM\s+authenticated;",
            "Ausência de REVOKE EXECUTE para authenticated em obter_licenca_detalhada_decrypted"
        )


if __name__ == "__main__":
    unittest.main()
