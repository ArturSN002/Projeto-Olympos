-- ==============================================================================
-- Migration: 20261031_002_rls_policies.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: Row Level Security (RLS) & Granular Access Control Policies
-- Description: Enables RLS across all tables and enforces strict role-based
--              access for ADMIN_GABINETE, RH_COMISSAO, JURIDICO, and PEDAGOGICO_EVENTOS.
-- ==============================================================================

-- 1. AUTH & JWT COMPATIBILITY HELPER
-- Ensures auth helper stubs exist for standalone SQL environments and test runners
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        CREATE SCHEMA auth;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $stub$
        BEGIN
            RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
        EXCEPTION
            WHEN OTHERS THEN RETURN NULL;
        END;
        $stub$ LANGUAGE plpgsql STABLE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'auth' AND p.proname = 'jwt'
    ) THEN
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB AS $stub$
        BEGIN
            RETURN COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::jsonb);
        EXCEPTION
            WHEN OTHERS THEN RETURN '{}'::jsonb;
        END;
        $stub$ LANGUAGE plpgsql STABLE;
    END IF;
END $$;

-- 2. HELPER FUNCTION: public.get_current_role()
-- Returns the active user's authoritative app_role from secure JWT app_metadata or public.profiles.
-- SECURITY RULE: NEVER trust client-writable user_metadata (which can be manipulated by users via signUp/updateUser).
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS public.app_role AS $$
DECLARE
    v_role_text TEXT;
    v_role public.app_role;
BEGIN
    -- 1. Try reading role from JWT app_metadata (secure claim set exclusively by backend/auth admin)
    BEGIN
        v_role_text := auth.jwt() -> 'app_metadata' ->> 'role';
        IF v_role_text IS NOT NULL THEN
            v_role := v_role_text::public.app_role;
            RETURN v_role;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            NULL; -- Fallback to profiles table query
    END;

    -- 2. Authoritative fallback to public.profiles table query
    IF auth.uid() IS NOT NULL THEN
        SELECT p.role INTO v_role
        FROM public.profiles p
        WHERE p.id = auth.uid();

        IF v_role IS NOT NULL THEN
            RETURN v_role;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, auth;

COMMENT ON FUNCTION public.get_current_role() IS 'Retorna o perfil (app_role) do usuario autenticado a partir do JWT ou tabela profiles';

-- Revoke execute from public/anon on role lookup helper (only authenticated needs it)
REVOKE EXECUTE ON FUNCTION public.get_current_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_role() TO authenticated;

-- 3. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacoes_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folha_intermunicipal ENABLE ROW LEVEL SECURITY;

-- Note: Standard ENABLE ROW LEVEL SECURITY is used without owner forcing.
-- Standard ENABLE strictly enforces RLS on all standard database connections (authenticated, anon),
-- while allowing SECURITY DEFINER functions (such as handle_new_user and process_audit_log_trigger)
-- to execute inserts and audit logging on behalf of the system without being blocked by RLS policies.

-- 4. POLICIES FOR public.profiles
-- Consolidated single policy per action to eliminate multiple_permissive_policies and auth_rls_initplan warnings

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = (select auth.uid())
    OR (select public.get_current_role()) = 'ADMIN_GABINETE'
);

CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
    (select public.get_current_role()) = 'ADMIN_GABINETE'
);

CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE
TO authenticated
USING (
    id = (select auth.uid())
    OR (select public.get_current_role()) = 'ADMIN_GABINETE'
)
WITH CHECK (
    (id = (select auth.uid()) AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (select auth.uid())))
    OR (select public.get_current_role()) = 'ADMIN_GABINETE'
);

CREATE POLICY "profiles_delete_policy"
ON public.profiles FOR DELETE
TO authenticated
USING (
    (select public.get_current_role()) = 'ADMIN_GABINETE'
);

-- Trigger to strictly forbid non-ADMIN_GABINETE users from updating the role column
-- Allows execution by database superuser/admin roles (postgres, supabase_admin, service_role) in SQL Editor / backend.
CREATE OR REPLACE FUNCTION public.protect_profiles_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Allow direct administrative promotion from Supabase SQL Editor (session_user = postgres / supabase_admin) or service_role
        IF session_user IN ('postgres', 'supabase_admin', 'service_role')
           AND COALESCE(NULLIF(current_setting('role', true), ''), 'none') NOT IN ('authenticated', 'anon')
           AND COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'none') NOT IN ('authenticated', 'anon') THEN
            RETURN NEW;
        END IF;

        IF (select public.get_current_role()) IS NULL OR (select public.get_current_role()) <> 'ADMIN_GABINETE' THEN
            RAISE EXCEPTION 'Apenas o perfil ADMIN_GABINETE tem autorizacao para alterar o papel de acesso (role).';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION public.protect_profiles_role_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profiles_role_change() TO supabase_auth_admin, service_role, postgres;

DROP TRIGGER IF EXISTS trg_protect_profiles_role ON public.profiles;
CREATE TRIGGER trg_protect_profiles_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_role_change();

-- 5. POLICIES FOR public.servidores
-- Consolidated single policy per action to eliminate multiple_permissive_policies and auth_rls_initplan warnings

DROP POLICY IF EXISTS "servidores_admin_all" ON public.servidores;
DROP POLICY IF EXISTS "servidores_rh_all" ON public.servidores;
DROP POLICY IF EXISTS "servidores_juridico_select" ON public.servidores;
DROP POLICY IF EXISTS "servidores_pedagogico_select" ON public.servidores;
DROP POLICY IF EXISTS "servidores_select_policy" ON public.servidores;
DROP POLICY IF EXISTS "servidores_insert_policy" ON public.servidores;
DROP POLICY IF EXISTS "servidores_update_policy" ON public.servidores;
DROP POLICY IF EXISTS "servidores_delete_policy" ON public.servidores;

CREATE POLICY "servidores_select_policy"
ON public.servidores FOR SELECT
TO authenticated
USING (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO')
    OR ((select public.get_current_role()) = 'PEDAGOGICO_EVENTOS' AND status = 'ATIVO')
);

CREATE POLICY "servidores_insert_policy"
ON public.servidores FOR INSERT
TO authenticated
WITH CHECK (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
);

CREATE POLICY "servidores_update_policy"
ON public.servidores FOR UPDATE
TO authenticated
USING (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
)
WITH CHECK (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
);

CREATE POLICY "servidores_delete_policy"
ON public.servidores FOR DELETE
TO authenticated
USING (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
);

-- Enforce Column-Level Security on public.servidores so authenticated users via PostgREST
-- cannot directly SELECT raw encrypted bytea or blind-index hash columns (RPC required for PII)
REVOKE SELECT ON public.servidores FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, nome, cargo, funcao, lotacao, status, created_at, updated_at) ON public.servidores TO authenticated;

-- Dedicated Secure View for PEDAGOGICO_EVENTOS without PII columns
-- security_invoker = true ensures PostgreSQL 15+ evaluates RLS as the querying user (not view owner),
-- resolving the Supabase Security Advisor 'security_definer_view' warning.
CREATE OR REPLACE VIEW public.servidores_pedagogico_view
WITH (security_invoker = true, security_barrier = true) AS
SELECT
    id,
    nome,
    cargo,
    funcao,
    lotacao,
    status,
    created_at,
    updated_at
FROM public.servidores
WHERE status = 'ATIVO';

COMMENT ON VIEW public.servidores_pedagogico_view IS 'Visao segura para o setor Pedagogico/Eventos sem campos PII ou chaves criptografadas';

-- Revoke permissions from anon/public and grant to authenticated
REVOKE ALL ON public.servidores_pedagogico_view FROM PUBLIC, anon;
GRANT SELECT ON public.servidores_pedagogico_view TO authenticated;

-- 6. POLICIES FOR public.licencas
-- Consolidated single policy per action to eliminate multiple_permissive_policies and auth_rls_initplan warnings

DROP POLICY IF EXISTS "licencas_admin_all" ON public.licencas;
DROP POLICY IF EXISTS "licencas_rh_all" ON public.licencas;
DROP POLICY IF EXISTS "licencas_juridico_select" ON public.licencas;
DROP POLICY IF EXISTS "licencas_select_policy" ON public.licencas;
DROP POLICY IF EXISTS "licencas_insert_policy" ON public.licencas;
DROP POLICY IF EXISTS "licencas_update_policy" ON public.licencas;
DROP POLICY IF EXISTS "licencas_delete_policy" ON public.licencas;

CREATE POLICY "licencas_select_policy"
ON public.licencas FOR SELECT
TO authenticated
USING (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO')
);

CREATE POLICY "licencas_insert_policy"
ON public.licencas FOR INSERT
TO authenticated
WITH CHECK (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
);

CREATE POLICY "licencas_update_policy"
ON public.licencas FOR UPDATE
TO authenticated
USING (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
)
WITH CHECK (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
);

CREATE POLICY "licencas_delete_policy"
ON public.licencas FOR DELETE
TO authenticated
USING (
    (select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO')
);

-- Note: PEDAGOGICO_EVENTOS has NO ACCESS to licencas (default-deny enforced by RLS)

-- 7. POLICIES FOR public.audit_logs (Immutable Audit Trail)

DROP POLICY IF EXISTS "audit_logs_select_authorized" ON public.audit_logs;
CREATE POLICY "audit_logs_select_authorized"
ON public.audit_logs FOR SELECT
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'JURIDICO'));

DROP POLICY IF EXISTS "audit_logs_no_direct_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_no_direct_insert"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
CREATE POLICY "audit_logs_no_update"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "audit_logs_no_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_no_delete"
ON public.audit_logs FOR DELETE
TO authenticated
USING (false);

-- Immutability defense-in-depth: RLS does not intercept TRUNCATE commands in PostgreSQL.
-- Explicitly revoke TRUNCATE privilege from all roles to protect forensic audit integrity.
REVOKE TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated;

-- 8. POLICIES FOR public.publicacoes_diario & public.folha_intermunicipal

-- Authenticated users can read public records
DROP POLICY IF EXISTS "publicacoes_diario_select_authenticated" ON public.publicacoes_diario;
CREATE POLICY "publicacoes_diario_select_authenticated"
ON public.publicacoes_diario FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "folha_intermunicipal_select_authenticated" ON public.folha_intermunicipal;
CREATE POLICY "folha_intermunicipal_select_authenticated"
ON public.folha_intermunicipal FOR SELECT
TO authenticated
USING (true);

-- Admin and service role management for publicacoes
DROP POLICY IF EXISTS "publicacoes_diario_insert_admin" ON public.publicacoes_diario;
CREATE POLICY "publicacoes_diario_insert_admin"
ON public.publicacoes_diario FOR INSERT
TO authenticated
WITH CHECK ((select public.get_current_role()) = 'ADMIN_GABINETE');

DROP POLICY IF EXISTS "publicacoes_diario_modify_admin" ON public.publicacoes_diario;
CREATE POLICY "publicacoes_diario_modify_admin"
ON public.publicacoes_diario FOR UPDATE
TO authenticated
USING ((select public.get_current_role()) = 'ADMIN_GABINETE')
WITH CHECK ((select public.get_current_role()) = 'ADMIN_GABINETE');

DROP POLICY IF EXISTS "publicacoes_diario_delete_admin" ON public.publicacoes_diario;
CREATE POLICY "publicacoes_diario_delete_admin"
ON public.publicacoes_diario FOR DELETE
TO authenticated
USING ((select public.get_current_role()) = 'ADMIN_GABINETE');

-- Admin and service role management for folha_intermunicipal
DROP POLICY IF EXISTS "folha_intermunicipal_insert_admin" ON public.folha_intermunicipal;
CREATE POLICY "folha_intermunicipal_insert_admin"
ON public.folha_intermunicipal FOR INSERT
TO authenticated
WITH CHECK ((select public.get_current_role()) = 'ADMIN_GABINETE');

DROP POLICY IF EXISTS "folha_intermunicipal_modify_admin" ON public.folha_intermunicipal;
CREATE POLICY "folha_intermunicipal_modify_admin"
ON public.folha_intermunicipal FOR UPDATE
TO authenticated
USING ((select public.get_current_role()) = 'ADMIN_GABINETE')
WITH CHECK ((select public.get_current_role()) = 'ADMIN_GABINETE');

DROP POLICY IF EXISTS "folha_intermunicipal_delete_admin" ON public.folha_intermunicipal;
CREATE POLICY "folha_intermunicipal_delete_admin"
ON public.folha_intermunicipal FOR DELETE
TO authenticated
USING ((select public.get_current_role()) = 'ADMIN_GABINETE');
