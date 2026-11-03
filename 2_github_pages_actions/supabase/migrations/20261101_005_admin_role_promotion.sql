-- ==============================================================================
-- Migration: 20261101_005_admin_role_promotion.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: User Moderation & Admin Role Promotion
-- Description: 
--   1. Promotes primary administrator asn0373@gmail.com to ADMIN_GABINETE in public.profiles and auth.users.
--   2. Updates raw_app_meta_data and raw_user_meta_data for proper JWT claims propagation.
--   3. Records compulsory audit trail in public.audit_logs for traceability and LGPD compliance.
--   4. Hardens public.handle_new_user() trigger function to ensure asn0373@gmail.com is unconditionally
--      assigned ADMIN_GABINETE on insert or conflict.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATUALIZACAO DO PERFIL NA TABELA public.profiles
-- ------------------------------------------------------------------------------
UPDATE public.profiles
SET 
    role = 'ADMIN_GABINETE'::public.app_role,
    full_name = 'Artur Silva',
    department = 'Gabinete do Secretario',
    updated_at = timezone('utc', now())
WHERE lower(trim(email)) = 'asn0373@gmail.com';

-- ------------------------------------------------------------------------------
-- 2. SINCRONIZACAO MANDATORIA EM auth.users (JWT CLAIMS)
-- ------------------------------------------------------------------------------
UPDATE auth.users
SET 
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', 'ADMIN_GABINETE'
    ),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'full_name', 'Artur Silva',
        'department', 'Gabinete do Secretario',
        'role', 'ADMIN_GABINETE'
    ),
    updated_at = timezone('utc', now())
WHERE lower(trim(email)) = 'asn0373@gmail.com';

-- ------------------------------------------------------------------------------
-- 3. REGISTRO COMPULSORIO NA TRILHA DE AUDITORIA (LGPD & TRACEABILITY)
-- ------------------------------------------------------------------------------
INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    performed_by,
    role_at_action,
    old_data,
    new_data,
    timestamp
)
SELECT 
    'profiles',
    p.id,
    'USER_ROLE_PROMOTION',
    p.id,
    'ADMIN_GABINETE'::public.app_role,
    jsonb_build_object('anterior_role', 'PEDAGOGICO_EVENTOS'),
    jsonb_build_object('nova_role', 'ADMIN_GABINETE', 'promovido_por', 'MIGRACAO_20261101_005'),
    timezone('utc', now())
FROM public.profiles p
WHERE lower(trim(p.email)) = 'asn0373@gmail.com';

-- ------------------------------------------------------------------------------
-- 4. BLINDAGEM PERMANENTE DA FUNCAO public.handle_new_user()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_full_name TEXT;
    v_role public.app_role;
    v_department TEXT;
BEGIN
    -- 1. Extracao segura do nome completo
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'nome',
        split_part(NEW.email, '@', 1),
        'Usuario SMEB'
    );

    -- 2. Tratamento do Moderador Mestre (asn0373@gmail.com) vs Demais Usuarios
    IF lower(trim(NEW.email)) = 'asn0373@gmail.com' THEN
        v_role := 'ADMIN_GABINETE'::public.app_role;
        v_department := 'Gabinete do Secretario';
    ELSE
        BEGIN
            v_role := COALESCE(
                (NEW.raw_app_meta_data->>'role')::public.app_role,
                'PEDAGOGICO_EVENTOS'::public.app_role
            );
        EXCEPTION
            WHEN OTHERS THEN
                v_role := 'PEDAGOGICO_EVENTOS'::public.app_role;
        END;

        v_department := COALESCE(
            NEW.raw_user_meta_data->>'department',
            NEW.raw_user_meta_data->>'setor',
            NEW.raw_user_meta_data->>'lotacao',
            'Secretaria Municipal de Educacao'
        );
    END IF;

    -- 3. Insercao ou Atualizacao idempotente
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
        role = CASE 
            WHEN lower(trim(EXCLUDED.email)) = 'asn0373@gmail.com' THEN 'ADMIN_GABINETE'::public.app_role
            ELSE profiles.role 
        END,
        department = COALESCE(EXCLUDED.department, profiles.department),
        updated_at = timezone('utc', now());

    RETURN NEW;
END;
$$;
