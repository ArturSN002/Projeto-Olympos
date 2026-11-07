-- ==============================================================================
-- Migration: 20261107_011_vault_secrets_and_key_rotation.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: Supabase Vault Migration, Priority Correction & Safe Key Rotation
-- ==============================================================================

-- 1. Assegurar extensão supabase_vault no schema vault
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 2. Migração automática e idempotente de private_config.crypto_settings para vault.secrets
DO $$
DECLARE
    r RECORD;
    v_sec_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'vault' AND p.proname = 'create_secret'
    ) THEN
        FOR r IN (
            SELECT setting_key, setting_value 
            FROM private_config.crypto_settings
            WHERE setting_value IS NOT NULL AND trim(setting_value) <> ''
        ) LOOP
            SELECT id INTO v_sec_id 
            FROM vault.secrets 
            WHERE name = r.setting_key LIMIT 1;

            IF v_sec_id IS NULL THEN
                PERFORM vault.create_secret(
                    r.setting_value, 
                    r.setting_key, 
                    'Olympos Secret migrated from private_config to Supabase Vault'
                );
            END IF;
        END LOOP;
    END IF;
END $$;

-- 3. Atualizar public.get_crypto_setting(p_key) com prioridade correta para Vault
CREATE OR REPLACE FUNCTION public.get_crypto_setting(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_val TEXT;
BEGIN
    -- Prioridade 1: Supabase Vault (enclave seguro primario)
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'
        ) THEN
            EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
            INTO v_val
            USING p_key;
            IF v_val IS NOT NULL AND trim(v_val) <> '' THEN
                RETURN v_val;
            END IF;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;

    -- Prioridade 2: Variavel de sessao GUC (configuracao temporaria de teste/sessao)
    v_val := NULLIF(trim(COALESCE(current_setting('app.settings.' || p_key, true), '')), '');
    IF v_val IS NOT NULL THEN
        RETURN v_val;
    END IF;

    -- Prioridade 3: Tabela interna private_config.crypto_settings (fallback para ambientes sem Vault)
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

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private_config, vault, extensions;

REVOKE ALL ON FUNCTION public.get_crypto_setting(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_crypto_setting(TEXT) TO postgres, service_role;

-- 4. RPC de Rotacao Segura da Chave Mestra (rotate_encryption_master_key)
CREATE OR REPLACE FUNCTION public.rotate_encryption_master_key(
    p_new_key TEXT,
    p_old_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_old_key TEXT := p_old_key;
    v_servidores_count INT := 0;
    v_licencas_count INT := 0;
    v_sec_id UUID;
    v_caller_role public.app_role;
BEGIN
    -- Controle estrito de acesso: exclusivo postgres / service_role / ADMIN_GABINETE
    IF current_user NOT IN ('postgres', 'service_role') THEN
        v_caller_role := public.get_current_role();
        IF v_caller_role IS NULL OR v_caller_role <> 'ADMIN_GABINETE' THEN
            RAISE EXCEPTION 'Acesso negado: Apenas superadministradores podem rotacionar chaves criptograficas.';
        END IF;
    END IF;

    -- Validacao defensiva da nova chave (minimo 16 caracteres, recomendado AES-256 com 32+)
    IF p_new_key IS NULL OR length(trim(p_new_key)) < 16 THEN
        RAISE EXCEPTION 'Nova chave master_key invalida (comprimento minimo de 16 caracteres requerido).';
    END IF;

    -- Resolucao da chave anterior
    IF v_old_key IS NULL OR trim(v_old_key) = '' THEN
        v_old_key := public.get_crypto_setting('master_key');
    END IF;

    IF v_old_key IS NULL OR length(trim(v_old_key)) < 16 THEN
        RAISE EXCEPTION 'Chave master_key anterior nao configurada e nao localizada para re-encriptacao.';
    END IF;

    IF v_old_key = p_new_key THEN
        RAISE EXCEPTION 'A nova chave de criptografia deve ser estritamente diferente da atual.';
    END IF;

    -- Re-cifragem atomica em public.servidores
    UPDATE public.servidores
    SET 
        cpf_encrypted = CASE 
            WHEN cpf_encrypted IS NOT NULL THEN
                pgp_sym_encrypt(pgp_sym_decrypt(cpf_encrypted, v_old_key), p_new_key, 'cipher-algo=aes256, compress-algo=1')
            ELSE NULL
        END,
        matricula_encrypted = CASE 
            WHEN matricula_encrypted IS NOT NULL THEN
                pgp_sym_encrypt(pgp_sym_decrypt(matricula_encrypted, v_old_key), p_new_key, 'cipher-algo=aes256, compress-algo=1')
            ELSE NULL
        END,
        updated_at = timezone('utc', now())
    WHERE cpf_encrypted IS NOT NULL OR matricula_encrypted IS NOT NULL;

    GET DIAGNOSTICS v_servidores_count = ROW_COUNT;

    -- Re-cifragem atomica em public.licencas
    UPDATE public.licencas
    SET 
        dados_medicos_encrypted = CASE 
            WHEN dados_medicos_encrypted IS NOT NULL THEN
                pgp_sym_encrypt(pgp_sym_decrypt(dados_medicos_encrypted, v_old_key), p_new_key, 'cipher-algo=aes256, compress-algo=1')
            ELSE NULL
        END,
        updated_at = timezone('utc', now())
    WHERE dados_medicos_encrypted IS NOT NULL;

    GET DIAGNOSTICS v_licencas_count = ROW_COUNT;

    -- Atualizacao do segredo no Supabase Vault
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'
    ) THEN
        SELECT id INTO v_sec_id FROM vault.secrets WHERE name = 'master_key' LIMIT 1;
        IF v_sec_id IS NOT NULL THEN
            PERFORM vault.update_secret(v_sec_id, p_new_key, 'master_key', 'Olympos Master PII Encryption Key (Rotated)');
        ELSE
            PERFORM vault.create_secret(p_new_key, 'master_key', 'Olympos Master PII Encryption Key');
        END IF;
    END IF;

    -- Atualizacao na tabela de contingencia private_config
    INSERT INTO private_config.crypto_settings (setting_key, setting_value, updated_at)
    VALUES ('master_key', p_new_key, timezone('utc', now()))
    ON CONFLICT (setting_key) DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = EXCLUDED.updated_at;

    -- Registro formal na trilha de auditoria LGPD
    INSERT INTO public.audit_logs (
        table_name, record_id, action, performed_by, role_at_action, old_data, new_data, timestamp
    ) VALUES (
        'system_crypto',
        NULL,
        'KEY_ROTATION_MASTER_KEY',
        auth.uid(),
        COALESCE(v_caller_role, 'ADMIN_GABINETE'::public.app_role),
        jsonb_build_object('rotation_target', 'master_key'),
        jsonb_build_object(
            'status', 'SUCCESS',
            'servidores_reencrypted', v_servidores_count,
            'licencas_reencrypted', v_licencas_count,
            'vault_updated', (v_sec_id IS NOT NULL),
            'timestamp', timezone('utc', now())
        ),
        timezone('utc', now())
    );

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Rotacao da master_key concluida com sucesso e registros recifrados.',
        'servidores_reencrypted', v_servidores_count,
        'licencas_reencrypted', v_licencas_count
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, private_config, vault, extensions;

REVOKE ALL ON FUNCTION public.rotate_encryption_master_key(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_encryption_master_key(TEXT, TEXT) TO service_role, postgres;

-- 5. RPC de Rotacao Segura do Salt de Blind Index (rotate_blind_index_salt)
CREATE OR REPLACE FUNCTION public.rotate_blind_index_salt(
    p_new_salt TEXT,
    p_current_master_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_master_key TEXT := p_current_master_key;
    v_count INT := 0;
    v_sec_id UUID;
    v_caller_role public.app_role;
BEGIN
    IF current_user NOT IN ('postgres', 'service_role') THEN
        v_caller_role := public.get_current_role();
        IF v_caller_role IS NULL OR v_caller_role <> 'ADMIN_GABINETE' THEN
            RAISE EXCEPTION 'Acesso negado: Apenas superadministradores podem rotacionar salt de blind index.';
        END IF;
    END IF;

    IF p_new_salt IS NULL OR length(trim(p_new_salt)) < 16 THEN
        RAISE EXCEPTION 'Novo salt invalido (comprimento minimo de 16 caracteres requerido).';
    END IF;

    IF v_master_key IS NULL OR trim(v_master_key) = '' THEN
        v_master_key := public.get_crypto_setting('master_key');
    END IF;

    IF v_master_key IS NULL THEN
        RAISE EXCEPTION 'master_key necessaria para decifrar dados e recalcular os blind indexes.';
    END IF;

    -- Recalcula os hashes HMAC-SHA256 determinísticos decifrando os valores em memória protegida
    UPDATE public.servidores
    SET
        cpf_hash = CASE 
            WHEN cpf_encrypted IS NOT NULL THEN
                public.generate_blind_index(pgp_sym_decrypt(cpf_encrypted, v_master_key), p_new_salt)
            ELSE NULL
        END,
        matricula_hash = CASE 
            WHEN matricula_encrypted IS NOT NULL THEN
                public.generate_blind_index(pgp_sym_decrypt(matricula_encrypted, v_master_key), p_new_salt)
            ELSE NULL
        END,
        updated_at = timezone('utc', now())
    WHERE cpf_encrypted IS NOT NULL OR matricula_encrypted IS NOT NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Atualiza no Vault
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'
    ) THEN
        SELECT id INTO v_sec_id FROM vault.secrets WHERE name = 'blind_index_salt' LIMIT 1;
        IF v_sec_id IS NOT NULL THEN
            PERFORM vault.update_secret(v_sec_id, p_new_salt, 'blind_index_salt', 'Olympos Blind Index Salt (Rotated)');
        ELSE
            PERFORM vault.create_secret(p_new_salt, 'blind_index_salt', 'Olympos Blind Index Salt');
        END IF;
    END IF;

    -- Atualiza private_config
    INSERT INTO private_config.crypto_settings (setting_key, setting_value, updated_at)
    VALUES ('blind_index_salt', p_new_salt, timezone('utc', now()))
    ON CONFLICT (setting_key) DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = EXCLUDED.updated_at;

    -- Trilha de auditoria
    INSERT INTO public.audit_logs (
        table_name, record_id, action, performed_by, role_at_action, old_data, new_data, timestamp
    ) VALUES (
        'system_crypto', NULL, 'KEY_ROTATION_BLIND_INDEX_SALT', auth.uid(),
        COALESCE(v_caller_role, 'ADMIN_GABINETE'::public.app_role),
        jsonb_build_object('rotation_target', 'blind_index_salt'),
        jsonb_build_object('status', 'SUCCESS', 'servidores_reindexed', v_count),
        timezone('utc', now())
    );

    RETURN jsonb_build_object('ok', true, 'servidores_reindexed', v_count);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, private_config, vault, extensions;

REVOKE ALL ON FUNCTION public.rotate_blind_index_salt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_blind_index_salt(TEXT, TEXT) TO service_role, postgres;
