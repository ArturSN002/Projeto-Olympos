-- ==============================================================================
-- Migration: 004_semantic_search_pgvector.sql / 20261104_006_semantic_search_pgvector.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: Busca Semantica Vetorial no Acervo Oficial (pgvector)
-- Description:
--   1. Habilita a extensao pgvector para computacao vetorial
--   2. Adiciona coluna 'embedding' (vector(768)) na tabela publicacoes_diario
--   3. Cria indice HNSW (Hierarchical Navigable Small World) para busca por similaridade cosseno
--   4. Cria a funcao RPC match_publicacoes_semanticas com least privilege e search_path seguro
--   5. Concede permissoes estritas para authenticated e service_role, revogando de public e anon
-- ==============================================================================

-- 1. EXTENSAO PGVECTOR
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. COLUNA DE EMBEDDING VETORIAL (768 dimensoes - Google Gemini text-embedding-004)
ALTER TABLE public.publicacoes_diario 
ADD COLUMN IF NOT EXISTS embedding vector(768);

COMMENT ON COLUMN public.publicacoes_diario.embedding IS 
'Vetores de embedding semantico (768 dimensoes - Google Gemini text-embedding-004) para busca por similaridade de cosseno';

-- 3. INDICE HNSW PARA SIMILARIDADE COSSENO EM SUB-MILISSEGUNDOS
CREATE INDEX IF NOT EXISTS idx_publicacoes_diario_embedding 
ON public.publicacoes_diario 
USING hnsw (embedding vector_cosine_ops);

-- 4. FUNCAO RPC: match_publicacoes_semanticas
CREATE OR REPLACE FUNCTION public.match_publicacoes_semanticas(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.60,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    data_publicacao DATE,
    edicao TEXT,
    titulo TEXT,
    ato_tipo TEXT,
    servidores_envolvidos TEXT[],
    conteudo_ner JSONB,
    similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
        (1 - (p.embedding <=> query_embedding))::float AS similarity
    FROM public.publicacoes_diario p
    WHERE p.embedding IS NOT NULL
      AND (1 - (p.embedding <=> query_embedding)) >= match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_publicacoes_semanticas IS 
'Localiza publicacoes oficiais similares por distancia de cosseno vetorial com corte de threshold';

-- 5. REGRAS DE AUTORIZACAO E MENOR PRIVILEGIO (LEAST PRIVILEGE)
REVOKE ALL ON FUNCTION public.match_publicacoes_semanticas(vector, float, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_publicacoes_semanticas(vector, float, int) TO authenticated, service_role;
