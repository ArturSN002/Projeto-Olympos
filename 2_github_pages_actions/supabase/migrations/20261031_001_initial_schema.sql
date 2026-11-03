-- ==============================================================================
-- Migration: 20261031_001_initial_schema.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: Supabase Database Architecture & Security
-- Description: Core schema definition with RBAC enums, encrypted PII tables,
--              blind indexing columns, audit logs, and optimized relational indexes.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE SCHEMA IF NOT EXISTS extensions;
-- uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
-- pgcrypto for AES-256 sym encryption and HMAC-SHA256 blind indexing
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Ensure auth schema exists (in Supabase it already exists and is owned by supabase_auth_admin;
-- only create stub table in standalone PostgreSQL test environments where auth.users does not exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        CREATE SCHEMA auth;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'auth' AND c.relname = 'users'
    ) THEN
        CREATE TABLE auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT,
            raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
            raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
            updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
        );
    END IF;
END $$;

-- 2. ENUMS
-- Role-Based Access Control (RBAC) enumeration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'ADMIN_GABINETE',
            'RH_COMISSAO',
            'PEDAGOGICO_EVENTOS',
            'JURIDICO'
        );
    END IF;
END $$;

-- 3. TABLES

-- 3.1 Profiles Table (Extension of Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT NOT NULL,
    role public.app_role NOT NULL DEFAULT 'PEDAGOGICO_EVENTOS',
    department TEXT DEFAULT 'Secretaria Municipal de Educacao',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.profiles IS 'Perfis de usuarios autenticados integrados com Supabase Auth e RBAC';
COMMENT ON COLUMN public.profiles.role IS 'Perfil de permissao no sistema (ADMIN_GABINETE, RH_COMISSAO, PEDAGOGICO_EVENTOS, JURIDICO)';

-- 3.2 Servidores Table (Servants Registry with PII encryption and Blind Indexing)
CREATE TABLE IF NOT EXISTS public.servidores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    -- Blind indexes for O(1) searches without in-memory decryption
    cpf_hash TEXT,
    matricula_hash TEXT,
    cargo TEXT NOT NULL,
    funcao TEXT,
    lotacao TEXT,
    status TEXT NOT NULL DEFAULT 'ATIVO',
    -- Encrypted PII stored as raw ciphertext bytes (AES-256 via pgcrypto)
    cpf_encrypted BYTEA,
    matricula_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.servidores IS 'Cadastro de servidores municipais com CPF e Matricula criptografados em repouso';
COMMENT ON COLUMN public.servidores.cpf_hash IS 'Blind index HMAC-SHA256 do CPF para busca indexada sem decifrar';
COMMENT ON COLUMN public.servidores.matricula_hash IS 'Blind index HMAC-SHA256 da matricula para busca indexada sem decifrar';
COMMENT ON COLUMN public.servidores.cpf_encrypted IS 'CPF cifrado com algoritmo simetrico AES-256 via pgcrypto';
COMMENT ON COLUMN public.servidores.matricula_encrypted IS 'Matricula funcional cifrada com algoritmo simetrico AES-256 via pgcrypto';

-- 3.3 Licencas Table (Leaves, Medical Pericia & Functional Readaptations)
CREATE TABLE IF NOT EXISTS public.licencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servidor_id UUID NOT NULL REFERENCES public.servidores(id) ON DELETE CASCADE,
    tipo_licenca TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    data_termino DATE,
    periodo_aquisitivo TEXT,
    parecer_numero TEXT,
    -- Sensitive medical, psychological and junta medica evaluation data
    dados_medicos_encrypted BYTEA,
    status TEXT NOT NULL DEFAULT 'CADASTRADO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.licencas IS 'Afastamentos, licencas e readaptacoes funcionais com protecao de dados medicos LGPD';
COMMENT ON COLUMN public.licencas.dados_medicos_encrypted IS 'Laudos periciais, CID e dados clinicos criptografados em repouso';

-- 3.4 Audit Logs Table (Append-only immutable audit trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role_at_action public.app_role,
    old_data JSONB,
    new_data JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.audit_logs IS 'Trilha de auditoria imutavel para rastreabilidade de acessos e mutacoes (LGPD)';
COMMENT ON COLUMN public.audit_logs.action IS 'Acao realizada: INSERT, UPDATE, DELETE, DECRYPT_READ, RPC_CALL';

-- 3.5 Publicacoes Diario Table (FEMURN scraping & NER extraction)
CREATE TABLE IF NOT EXISTS public.publicacoes_diario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_publicacao DATE NOT NULL,
    edicao TEXT,
    titulo TEXT NOT NULL,
    conteudo_ner JSONB,
    ato_tipo TEXT,
    servidores_envolvidos TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.publicacoes_diario IS 'Publicacoes mineradas do Diario Oficial (FEMURN) via Fogo de Prometheus';

-- 3.6 Folha Intermunicipal Table (Intermunicipal payroll & cross-municipality salary analysis)
CREATE TABLE IF NOT EXISTS public.folha_intermunicipal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mes_ano TEXT NOT NULL,
    municipio TEXT NOT NULL,
    cargo TEXT NOT NULL,
    dados_remuneracao JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.folha_intermunicipal IS 'Dados consolidados de folhas de pagamento intermunicipais via Papiro de Cadmo';

-- 4. INDEXES
-- Fast blind-index lookups for servidores
CREATE INDEX IF NOT EXISTS idx_servidores_cpf_hash ON public.servidores(cpf_hash);
CREATE INDEX IF NOT EXISTS idx_servidores_matricula_hash ON public.servidores(matricula_hash);
CREATE INDEX IF NOT EXISTS idx_servidores_status ON public.servidores(status);
CREATE INDEX IF NOT EXISTS idx_servidores_nome ON public.servidores(nome);

-- Foreign key & date indexes for licencas
CREATE INDEX IF NOT EXISTS idx_licencas_servidor_id ON public.licencas(servidor_id);
CREATE INDEX IF NOT EXISTS idx_licencas_datas ON public.licencas(data_inicio, data_termino);
CREATE INDEX IF NOT EXISTS idx_licencas_status ON public.licencas(status);

-- Audit logs indexes for rapid forensic queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Profiles indexing
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Publicacoes & Folha indexing
CREATE INDEX IF NOT EXISTS idx_publicacoes_data ON public.publicacoes_diario(data_publicacao);
CREATE INDEX IF NOT EXISTS idx_publicacoes_ato_tipo ON public.publicacoes_diario(ato_tipo);
CREATE INDEX IF NOT EXISTS idx_folha_intermunicipal_mes_mun ON public.folha_intermunicipal(mes_ano, municipio);

-- 5. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Revoke public execution on internal trigger function
REVOKE EXECUTE ON FUNCTION public.handle_updated_at_timestamp() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_updated_at_timestamp() TO supabase_auth_admin, service_role, postgres;

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_servidores_updated_at ON public.servidores;
CREATE TRIGGER trg_servidores_updated_at
BEFORE UPDATE ON public.servidores
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_licencas_updated_at ON public.licencas;
CREATE TRIGGER trg_licencas_updated_at
BEFORE UPDATE ON public.licencas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_timestamp();

-- 6. ENABLE ROW LEVEL SECURITY (Baseline default-deny; granular policies defined in 002)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacoes_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folha_intermunicipal ENABLE ROW LEVEL SECURITY;
