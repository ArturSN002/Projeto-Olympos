-- ==============================================================================
-- Migration: 20261031_003_pgcrypto_rpc.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: pgcrypto Cryptographic Operations, Blind Indexing & Audited RPCs
-- Description: Blind indexing (HMAC-SHA256), immutable audit log triggers,
--              decryption RPC with mandatory audit logging, and user sync trigger.
-- ==============================================================================

-- 0. INTERNAL KEY CONFIGURATION HELPER (Supabase Cloud & Vault / GUC Compatible)
-- In Supabase Cloud, ALTER DATABASE postgres SET "app.settings.*" is restricted by Supavisor/PostgreSQL 15+.
-- We provide a strictly isolated internal schema (private_config) accessible ONLY to postgres/SECURITY DEFINER,
-- combined with automatic fallback to Supabase Vault (vault.decrypted_secrets) and GUC (current_setting).
CREATE SCHEMA IF NOT EXISTS private_config;
REVOKE ALL ON SCHEMA private_config FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private_config.crypto_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE private_config.crypto_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private_config.crypto_settings FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "crypto_settings_deny_all" ON private_config.crypto_settings;
CREATE POLICY "crypto_settings_deny_all"
ON private_config.crypto_settings FOR ALL
TO PUBLIC
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.get_crypto_setting(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_val TEXT;
BEGIN
    -- 1. Try reading from session/database GUC (e.g. set_config('app.settings.' || p_key, ...))
    v_val := NULLIF(trim(COALESCE(current_setting('app.settings.' || p_key, true), '')), '');
    IF v_val IS NOT NULL THEN
        RETURN v_val;
    END IF;

    -- 2. Try reading from private_config.crypto_settings table
    BEGIN
        SELECT setting_value INTO v_val
        FROM private_config.crypto_settings
        WHERE setting_key = p_key;
        IF v_val IS NOT NULL AND trim(v_val) <> '' THEN
            RETURN v_val;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;

    -- 3. Try reading from Supabase Vault (if vault extension is active)
    BEGIN
        EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
        INTO v_val
        USING p_key;
        IF v_val IS NOT NULL AND trim(v_val) <> '' THEN
            RETURN v_val;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private_config, extensions;

REVOKE ALL ON FUNCTION public.get_crypto_setting(TEXT) FROM PUBLIC, anon, authenticated;

-- 1. BLIND INDEX FUNCTIONS (HMAC-SHA256)

-- 1.1 Blind index with explicit pepper
CREATE OR REPLACE FUNCTION public.generate_blind_index(raw_value TEXT, pepper TEXT)
RETURNS TEXT AS $$
DECLARE
    v_clean TEXT;
BEGIN
    IF raw_value IS NULL OR trim(raw_value) = '' THEN
        RETURN NULL;
    END IF;

    IF pepper IS NULL OR length(trim(pepper)) < 8 THEN
        RAISE EXCEPTION 'Pepper de blind index invalido ou com comprimento insuficiente (minimo 8 caracteres).';
    END IF;

    -- Normalization: remove punctuation, symbols, whitespace, and convert to lowercase
    v_clean := lower(trim(regexp_replace(raw_value, '[^a-zA-Z0-9]', '', 'g')));

    IF v_clean = '' THEN
        RETURN NULL;
    END IF;

    -- Return HMAC-SHA256 hex digest
    RETURN encode(hmac(v_clean::bytea, pepper::bytea, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public, extensions;

COMMENT ON FUNCTION public.generate_blind_index(TEXT, TEXT) IS 'Gera blind index HMAC-SHA256 deterministico normalizado para consultas O(1) sem decifrar PII';

-- 1.2 Overload for blind index reading pepper from database settings, private_config or Vault if available
CREATE OR REPLACE FUNCTION public.generate_blind_index(raw_value TEXT)
RETURNS TEXT AS $$
DECLARE
    v_pepper TEXT;
BEGIN
    v_pepper := COALESCE(
        NULLIF(trim(current_setting('app.settings.blind_index_salt', true)), ''),
        NULLIF(trim(current_setting('app.settings.blind_index_pepper', true)), ''),
        public.get_crypto_setting('blind_index_salt'),
        public.get_crypto_setting('blind_index_pepper')
    );

    IF v_pepper IS NULL OR length(trim(v_pepper)) < 8 THEN
        RAISE EXCEPTION 'Pepper/salt de blind index nao configurado no servidor (defina em private_config.crypto_settings ou app.settings.blind_index_salt).';
    END IF;

    RETURN public.generate_blind_index(raw_value, v_pepper);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private_config, extensions;

-- 1.3 Cryptographic helper functions for PII encryption/decryption
CREATE OR REPLACE FUNCTION public.encrypt_pii(p_plaintext TEXT, p_key TEXT DEFAULT NULL)
RETURNS BYTEA AS $$
DECLARE
    v_key TEXT := p_key;
BEGIN
    IF p_plaintext IS NULL OR p_plaintext = '' THEN
        RETURN NULL;
    END IF;

    IF v_key IS NULL OR trim(v_key) = '' THEN
        v_key := COALESCE(
            NULLIF(trim(current_setting('app.settings.master_key', true)), ''),
            public.get_crypto_setting('master_key')
        );
    END IF;

    IF v_key IS NULL OR length(trim(v_key)) < 16 THEN
        RAISE EXCEPTION 'Chave de criptografia invalida ou insuficiente (minimo 16 caracteres).';
    END IF;

    RETURN pgp_sym_encrypt(
        p_plaintext,
        v_key,
        'cipher-algo=aes256, compress-algo=1'
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, private_config, extensions;

CREATE OR REPLACE FUNCTION public.decrypt_pii(p_ciphertext BYTEA, p_key TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_key TEXT := p_key;
BEGIN
    IF p_ciphertext IS NULL THEN
        RETURN NULL;
    END IF;

    IF v_key IS NULL OR trim(v_key) = '' THEN
        v_key := COALESCE(
            NULLIF(trim(current_setting('app.settings.master_key', true)), ''),
            public.get_crypto_setting('master_key')
        );
    END IF;

    IF v_key IS NULL OR length(trim(v_key)) < 16 THEN
        RAISE EXCEPTION 'Chave de criptografia invalida ou insuficiente (minimo 16 caracteres).';
    END IF;

    BEGIN
        RETURN pgp_sym_decrypt(p_ciphertext, v_key);
    EXCEPTION
        WHEN OTHERS THEN
            RETURN '[ERRO DE DECRIPTOGRAFIA: Chave Incorreta]';
    END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private_config, extensions;

-- 2. AUDIT LOG TRIGGER FUNCTION
-- Captures INSERT, UPDATE, DELETE operations on sensitive tables with payload sanitization
CREATE OR REPLACE FUNCTION public.process_audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_performed_by UUID;
    v_role_at_action public.app_role;
    v_record_id UUID;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    v_performed_by := auth.uid();
    v_role_at_action := public.get_current_role();

    IF (TG_OP = 'INSERT') THEN
        v_record_id := NEW.id;
        -- Sanitize binary bytea encrypted columns from jsonb audit payload
        v_new_data := to_jsonb(NEW) - 'cpf_encrypted' - 'matricula_encrypted' - 'dados_medicos_encrypted';
    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := NEW.id;
        v_old_data := to_jsonb(OLD) - 'cpf_encrypted' - 'matricula_encrypted' - 'dados_medicos_encrypted';
        v_new_data := to_jsonb(NEW) - 'cpf_encrypted' - 'matricula_encrypted' - 'dados_medicos_encrypted';
    ELSIF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id;
        v_old_data := to_jsonb(OLD) - 'cpf_encrypted' - 'matricula_encrypted' - 'dados_medicos_encrypted';
    END IF;

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        performed_by,
        role_at_action,
        old_data,
        new_data,
        timestamp
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_performed_by,
        v_role_at_action,
        v_old_data,
        v_new_data,
        timezone('utc', now())
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

COMMENT ON FUNCTION public.process_audit_log_trigger() IS 'Gatilho de auditoria automatica para persistencia imutavel em audit_logs com sanitizacao de PII binario';

-- Attach Audit Triggers to Servidores and Licencas
DROP TRIGGER IF EXISTS trg_audit_servidores ON public.servidores;
CREATE TRIGGER trg_audit_servidores
AFTER INSERT OR UPDATE OR DELETE ON public.servidores
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_licencas ON public.licencas;
CREATE TRIGGER trg_audit_licencas
AFTER INSERT OR UPDATE OR DELETE ON public.licencas
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_trigger();

-- 3. DECRYPTION RPC WITH MANDATORY AUDIT LOGGING

-- 3.1 Servidor Decryption RPC
CREATE OR REPLACE FUNCTION public.obter_servidor_detalhado_decrypted(
    p_servidor_id UUID,
    p_secret_key TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    cpf_decrypted TEXT,
    matricula_decrypted TEXT,
    cargo TEXT,
    funcao TEXT,
    lotacao TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_caller_role public.app_role;
    v_servidor public.servidores%ROWTYPE;
    v_cpf TEXT;
    v_matricula TEXT;
    v_key TEXT := p_secret_key;
BEGIN
    -- 1. Authorization check: fail-closed on NULL or unauthorized role (Fix Tri-State SQL)
    v_caller_role := public.get_current_role();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil nao autorizado ou usuario nao autenticado.';
    END IF;

    -- 2. Secret key resolution (fallback to server-side setting app.settings.master_key or private_config)
    IF v_key IS NULL OR trim(v_key) = '' THEN
        v_key := COALESCE(
            NULLIF(trim(current_setting('app.settings.master_key', true)), ''),
            public.get_crypto_setting('master_key')
        );
    END IF;

    IF v_key IS NULL OR length(trim(v_key)) < 16 THEN
        RAISE EXCEPTION 'Chave de descriptografia master_key nao configurada';
    END IF;

    -- 3. Query servidor record
    SELECT * INTO v_servidor
    FROM public.servidores
    WHERE servidores.id = p_servidor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Servidor nao localizado para o identificador: %', p_servidor_id;
    END IF;

    -- 4. Mandatory LGPD Audit Log registration
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        performed_by,
        role_at_action,
        old_data,
        new_data,
        timestamp
    ) VALUES (
        'servidores',
        p_servidor_id,
        'DECRYPT_READ',
        auth.uid(),
        v_caller_role,
        NULL,
        jsonb_build_object(
            'servidor_id', p_servidor_id,
            'motivo', 'Decriptografia autorizada de CPF e Matricula via RPC',
            'perfil_solicitante', v_caller_role,
            'data_solicitacao', timezone('utc', now())
        ),
        timezone('utc', now())
    );

    -- 5. Safe decryption of fields
    BEGIN
        v_cpf := pgp_sym_decrypt(v_servidor.cpf_encrypted, v_key);
    EXCEPTION
        WHEN OTHERS THEN
            v_cpf := '[ERRO DE DECRIPTOGRAFIA: Chave Incorreta]';
    END;

    BEGIN
        v_matricula := pgp_sym_decrypt(v_servidor.matricula_encrypted, v_key);
    EXCEPTION
        WHEN OTHERS THEN
            v_matricula := '[ERRO DE DECRIPTOGRAFIA: Chave Incorreta]';
    END;

    RETURN QUERY
    SELECT
        v_servidor.id,
        v_servidor.nome,
        v_cpf,
        v_matricula,
        v_servidor.cargo,
        v_servidor.funcao,
        v_servidor.lotacao,
        v_servidor.status,
        v_servidor.created_at,
        v_servidor.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

COMMENT ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) IS 'RPC seguro com decifracao pontual de PII e registro compulsorio em audit_logs (LGPD)';

-- 3.2 Licenca Decryption RPC (Medical and Psychological Sensitive Data)
CREATE OR REPLACE FUNCTION public.obter_licenca_detalhada_decrypted(
    p_licenca_id UUID,
    p_secret_key TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    servidor_id UUID,
    tipo_licenca TEXT,
    data_inicio DATE,
    data_termino DATE,
    periodo_aquisitivo TEXT,
    parecer_numero TEXT,
    dados_medicos_decrypted TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_caller_role public.app_role;
    v_licenca public.licencas%ROWTYPE;
    v_medicos TEXT;
    v_key TEXT := p_secret_key;
BEGIN
    -- 1. Authorization check: PEDAGOGICO_EVENTOS is strictly prohibited; fail-closed on NULL or unauthorized role
    v_caller_role := public.get_current_role();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil nao autorizado ou usuario nao autenticado.';
    END IF;

    -- 2. Secret key resolution (fallback to server-side setting app.settings.master_key or private_config)
    IF v_key IS NULL OR trim(v_key) = '' THEN
        v_key := COALESCE(
            NULLIF(trim(current_setting('app.settings.master_key', true)), ''),
            public.get_crypto_setting('master_key')
        );
    END IF;

    IF v_key IS NULL OR length(trim(v_key)) < 16 THEN
        RAISE EXCEPTION 'Chave de descriptografia master_key nao configurada';
    END IF;

    -- 3. Query licenca record
    SELECT * INTO v_licenca
    FROM public.licencas
    WHERE licencas.id = p_licenca_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registro de licenca nao localizado para o identificador: %', p_licenca_id;
    END IF;

    -- 4. Mandatory LGPD Audit Log registration
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        performed_by,
        role_at_action,
        old_data,
        new_data,
        timestamp
    ) VALUES (
        'licencas',
        p_licenca_id,
        'DECRYPT_READ',
        auth.uid(),
        v_caller_role,
        NULL,
        jsonb_build_object(
            'licenca_id', p_licenca_id,
            'motivo', 'Decriptografia autorizada de dados medicos/periciais via RPC',
            'perfil_solicitante', v_caller_role,
            'data_solicitacao', timezone('utc', now())
        ),
        timezone('utc', now())
    );

    -- 5. Safe decryption of medical data
    BEGIN
        v_medicos := pgp_sym_decrypt(v_licenca.dados_medicos_encrypted, v_key);
    EXCEPTION
        WHEN OTHERS THEN
            v_medicos := '[ERRO DE DECRIPTOGRAFIA: Chave Incorreta]';
    END;

    RETURN QUERY
    SELECT
        v_licenca.id,
        v_licenca.servidor_id,
        v_licenca.tipo_licenca,
        v_licenca.data_inicio,
        v_licenca.data_termino,
        v_licenca.periodo_aquisitivo,
        v_licenca.parecer_numero,
        v_medicos,
        v_licenca.status,
        v_licenca.created_at,
        v_licenca.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

COMMENT ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) IS 'RPC seguro para decifracao de dados clinicos e laudos de licencas com registro compulsorio de auditoria';

-- 4. USER SYNCHRONIZATION TRIGGER (auth.users -> public.profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_role public.app_role;
    v_department TEXT;
BEGIN
    -- Extract full name from raw_user_meta_data or fallback to email prefix
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'nome',
        split_part(NEW.email, '@', 1),
        'Usuario SMEB'
    );

    -- Extract role safely with type validation from admin-controlled raw_app_meta_data.
    -- SECURITY RULE: NEVER trust client-writable raw_user_meta_data for authorization roles!
    -- Default to lowest privilege role: PEDAGOGICO_EVENTOS.
    BEGIN
        v_role := COALESCE(
            (NEW.raw_app_meta_data->>'role')::public.app_role,
            'PEDAGOGICO_EVENTOS'::public.app_role
        );
    EXCEPTION
        WHEN OTHERS THEN
            v_role := 'PEDAGOGICO_EVENTOS'::public.app_role;
    END;

    -- Extract department
    v_department := COALESCE(
        NEW.raw_user_meta_data->>'department',
        NEW.raw_user_meta_data->>'setor',
        NEW.raw_user_meta_data->>'lotacao',
        'Secretaria Municipal de Educacao'
    );

    -- Insert or update public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        department,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        v_role,
        v_department,
        timezone('utc', now()),
        timezone('utc', now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        department = COALESCE(EXCLUDED.department, profiles.department),
        updated_at = timezone('utc', now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

COMMENT ON FUNCTION public.handle_new_user() IS 'Sincroniza automaticamente novos usuarios criados no Supabase Auth para a tabela public.profiles';

-- Attach Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. FUNCTION EXECUTION PRIVILEGES (Least Privilege Enforcement)
-- Revoke execution from public/anon on all functions; restrict internal functions from API/RPC access.

-- Trigger functions must NOT be callable via API/RPC by anon or authenticated,
-- but MUST be executable by supabase_auth_admin, service_role, and postgres for internal auth hooks.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.process_audit_log_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_audit_log_trigger() TO supabase_auth_admin, service_role, postgres;

-- Sensitive audited RPCs: authenticated only, revoked from anon/public
REVOKE EXECUTE ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) TO authenticated;

-- Raw encryption/decryption helpers: internal only (never exposed directly via API/RPC)
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(TEXT, TEXT) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.decrypt_pii(BYTEA, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(BYTEA, TEXT) FROM authenticated;

-- Blind index helpers: pure HMAC is invoker; single-arg reading secret settings is internal
REVOKE EXECUTE ON FUNCTION public.generate_blind_index(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_blind_index(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_blind_index(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_blind_index(TEXT) FROM authenticated;
