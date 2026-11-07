-- ==============================================================================
-- Migration: 20261107_010_security_advisor_hardening.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: Supabase Security Advisor Hardening (Lints 0014 & 0029)
-- Description:
--   1. Move a extensao 'vector' do schema 'public' para 'extensions' (Lint 0014).
--   2. Converte match_publicacoes_semanticas para SECURITY INVOKER com search_path seguro (Lint 0029).
--   3. Revoga EXECUTE direto de 'authenticated' nas RPCs SECURITY DEFINER de decriptografia LGPD,
--      mantendo acesso exclusivo via backend com service_role (Lint 0029).
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO PUBLIC, anon, authenticated, service_role;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'vector'
          AND n.nspname = 'public'
    ) THEN
        ALTER EXTENSION vector SET SCHEMA extensions;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.match_publicacoes_semanticas(
    query_embedding extensions.vector(768),
    match_threshold double precision DEFAULT 0.60,
    match_count integer DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    data_publicacao DATE,
    edicao TEXT,
    titulo TEXT,
    ato_tipo TEXT,
    servidores_envolvidos TEXT[],
    conteudo_ner JSONB,
    similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.data_publicacao,
        p.edicao,
        p.titulo,
        p.ato_tipo,
        p.servidores_envolvidos,
        p.conteudo_ner,
        (1 - (p.embedding <=> query_embedding))::double precision AS similarity
    FROM public.publicacoes_diario p
    WHERE p.embedding IS NOT NULL
      AND (1 - (p.embedding <=> query_embedding)) >= match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT LEAST(GREATEST(COALESCE(match_count, 10), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.match_publicacoes_semanticas(extensions.vector, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_publicacoes_semanticas(extensions.vector, double precision, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_servidor_detalhado_decrypted(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_licenca_detalhada_decrypted(UUID, TEXT) TO service_role;
