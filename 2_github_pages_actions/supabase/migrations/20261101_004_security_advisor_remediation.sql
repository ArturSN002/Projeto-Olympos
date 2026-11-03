-- ==============================================================================
-- Migration: 20261101_004_security_advisor_remediation.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: Supabase Security Advisor Remediation (Linter 0028 & 0029)
-- Description: 
--   1. Safely removes orphaned rls_auto_enable() function and associated event triggers (clears lint 0028 & 0029).
--   2. Hardens SECURITY DEFINER cryptographic RPCs with explicit auth checks, search_path isolation,
--      and controlled role execution privileges (grants to service_role, revokes from authenticated).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PARTE 1: REMOÇÃO SEGURA DE rls_auto_enable() (Limpeza dos Avisos 1 e 2)
-- ------------------------------------------------------------------------------

-- 1.1 Remover event triggers que possam estar associados à função rls_auto_enable
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT evtname 
        FROM pg_event_trigger 
        WHERE evtfname = 'public.rls_auto_enable'::regproc
    ) LOOP
        EXECUTE 'DROP EVENT TRIGGER IF EXISTS ' || quote_ident(r.evtname);
        RAISE NOTICE 'Event trigger removido: %', r.evtname;
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 1.2 Remover event triggers conhecidos criados por templates do Supabase
DROP EVENT TRIGGER IF EXISTS ensure_rls;
DROP EVENT TRIGGER IF EXISTS trg_rls_auto_enable;
DROP EVENT TRIGGER IF EXISTS rls_auto_enable_trigger;

-- 1.3 Remover a função com CASCADE para assegurar a eliminação de qualquer dependência residual
DROP FUNCTION IF EXISTS public.rls_auto_enable() CASCADE;


-- ------------------------------------------------------------------------------
-- PARTE 2: REFORÇO DE SEGURANÇA NAS RPCs DE DECRIPTOGRAFIA LGPD (Avisos 3 e 4)
-- ------------------------------------------------------------------------------

-- 2.1 RPC: obter_servidor_detalhado_decrypted
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
    -- 1. Autenticação e Autorização Mandatória (Fail-Closed Tri-State)
    -- Impede execução anônima ou com JWT desprovido de identificação de usuário
    IF auth.uid() IS NULL AND current_user NOT IN ('postgres', 'service_role') THEN
        RAISE EXCEPTION 'Acesso negado: Requer autenticacao valida no Supabase.';
    END IF;

    v_caller_role := public.get_current_role();
    IF (v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO'))
       AND current_user NOT IN ('postgres', 'service_role') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil nao autorizado para decifracao de dados sensiveis.';
    END IF;

    -- 2. Resolução segura da chave de descriptografia (servidor / private_config)
    IF v_key IS NULL OR trim(v_key) = '' THEN
        v_key := COALESCE(
            NULLIF(trim(current_setting('app.settings.master_key', true)), ''),
            public.get_crypto_setting('master_key')
        );
    END IF;

    IF v_key IS NULL OR length(trim(v_key)) < 16 THEN
        RAISE EXCEPTION 'Chave de descriptografia master_key nao configurada no servidor.';
    END IF;

    -- 3. Localização do registro do servidor
    SELECT * INTO v_servidor
    FROM public.servidores
    WHERE servidores.id = p_servidor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Servidor nao localizado para o identificador: %', p_servidor_id;
    END IF;

    -- 4. Registro compulsório na Trilha de Auditoria Imutável (LGPD Compliance)
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
        COALESCE(v_caller_role, 'ADMIN_GABINETE'::public.app_role),
        NULL,
        jsonb_build_object(
            'servidor_id', p_servidor_id,
            'motivo', 'Decriptografia autorizada de CPF e Matricula via RPC',
            'perfil_solicitante', v_caller_role,
            'data_solicitacao', timezone('utc', now())
        ),
        timezone('utc', now())
    );

    -- 5. Decifração defensiva de CPF e Matrícula
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

COMMENT ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) 
IS 'RPC protegida por RBAC com decifracao controlada de PII e registro compulsorio em audit_logs (LGPD)';


-- 2.2 RPC: obter_licenca_detalhada_decrypted
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
    -- 1. Autenticação e Autorização Mandatória (Bloqueio estrito de PEDAGOGICO_EVENTOS)
    IF auth.uid() IS NULL AND current_user NOT IN ('postgres', 'service_role') THEN
        RAISE EXCEPTION 'Acesso negado: Requer autenticacao valida no Supabase.';
    END IF;

    v_caller_role := public.get_current_role();
    IF (v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN_GABINETE', 'RH_COMISSAO', 'JURIDICO'))
       AND current_user NOT IN ('postgres', 'service_role') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil nao autorizado para leitura de laudos medicos/periciais.';
    END IF;

    -- 2. Resolução segura da chave de descriptografia
    IF v_key IS NULL OR trim(v_key) = '' THEN
        v_key := COALESCE(
            NULLIF(trim(current_setting('app.settings.master_key', true)), ''),
            public.get_crypto_setting('master_key')
        );
    END IF;

    IF v_key IS NULL OR length(trim(v_key)) < 16 THEN
        RAISE EXCEPTION 'Chave de descriptografia master_key nao configurada no servidor.';
    END IF;

    -- 3. Localização do registro de licença
    SELECT * INTO v_licenca
    FROM public.licencas
    WHERE licencas.id = p_licenca_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registro de licenca nao localizado para o identificador: %', p_licenca_id;
    END IF;

    -- 4. Registro compulsório na Trilha de Auditoria (Prontuário Médico Sensível)
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
        COALESCE(v_caller_role, 'ADMIN_GABINETE'::public.app_role),
        NULL,
        jsonb_build_object(
            'licenca_id', p_licenca_id,
            'motivo', 'Decriptografia autorizada de laudos medicos/periciais via RPC',
            'perfil_solicitante', v_caller_role,
            'data_solicitacao', timezone('utc', now())
        ),
        timezone('utc', now())
    );

    -- 5. Decifração de dados médicos/periciais
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

COMMENT ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) 
IS 'RPC protegida para decifracao de laudos medicos e periciais com auditoria compulsoria (LGPD)';


-- ------------------------------------------------------------------------------
-- PARTE 3: CONCESSÃO DE PRIVILÉGIOS (Least Privilege Architecture)
-- ------------------------------------------------------------------------------

-- 3.1 Revogação incondicional para PUBLIC e anon (Impede qualquer chamada anônima)
REVOKE ALL ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) FROM PUBLIC, anon;

-- 3.2 Concessão para a role administrativa de serviço (service_role)
GRANT EXECUTE ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) TO service_role;

-- 3.3 Tratamento do Linter 0029 (Zero Avisos no Security Advisor / Backend Proxy):
-- Revoga privilégio de execução direta para 'authenticated'. Acesso via PostgREST direto é bloqueado (403),
-- garantindo conformidade estrita e erradicando o aviso 0029. O acesso seguro é mediado pelo backend via service_role.
REVOKE EXECUTE ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) FROM authenticated;
