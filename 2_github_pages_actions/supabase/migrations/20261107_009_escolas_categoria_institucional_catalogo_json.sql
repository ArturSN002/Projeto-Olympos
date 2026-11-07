-- ==============================================================================
-- Migration: 20261107_009_escolas_categoria_institucional_catalogo_json.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB Ceara-Mirim/RN)
-- Module: Padronizacao de Categoria Institucional e Catalogo JSON Georreferenciado
-- Description:
--   1. Padroniza a coluna public.escolas.categoria nos 3 tipos institucionais
--      oficiais: 'Escola', 'Centro de Educação Infantil' e 'Instituição'
--   2. Corrige o trigger handle_escolas_sync_segmentos_categoria() para NUNCA
--      sobrescrever categoria com segmentos (evitando que escolas com Ed. Infantil
--      e Ens. Fundamental I recebam indevidamente categoria/simbolo de CEI)
--   3. Cria a tabela public.catalogos_json com RLS habilitado para persistir
--      o arquivo JSON completo das unidades e coordenadas georreferenciadas
-- ==============================================================================

-- 1. BACKFILL E PADRONIZACAO DE CATEGORIA INSTITUCIONAL EM public.escolas
ALTER TABLE public.escolas
    DROP CONSTRAINT IF EXISTS chk_escolas_categoria_institucional;

UPDATE public.escolas
SET categoria = CASE
    WHEN id = 'esc_001' OR nome ILIKE '%secretaria%' OR nome ILIKE '%ifrn%' OR categoria ILIKE '%sede%' OR categoria ILIKE '%institu%'
        THEN 'Instituição'
    WHEN nome ILIKE 'cei %' OR nome ILIKE '%cmei%' OR nome ILIKE '%centro de educa%infantil%' OR categoria IN ('Centro de Educação Infantil', 'Educação Infantil (CEI)', 'CEI', 'CMEI')
        THEN 'Centro de Educação Infantil'
    ELSE
        'Escola'
END;

ALTER TABLE public.escolas
    ALTER COLUMN categoria SET DEFAULT 'Escola';

ALTER TABLE public.escolas
    ADD CONSTRAINT chk_escolas_categoria_institucional
    CHECK (categoria IN ('Escola', 'Centro de Educação Infantil', 'Instituição'));

COMMENT ON COLUMN public.escolas.categoria IS 'Categoria institucional oficial da unidade: Escola, Centro de Educação Infantil ou Instituição';

-- 2. ATUALIZAR FUNCAO DE TRIGGER SEM SOBRESCREVER CATEGORIA COM SEGMENTOS
CREATE OR REPLACE FUNCTION public.handle_escolas_sync_segmentos_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Normaliza categoria institucional estritamente nos 3 tipos oficiais
    IF NEW.categoria IS NULL OR btrim(NEW.categoria) = '' THEN
        IF NEW.nome ILIKE 'CEI %' OR NEW.nome ILIKE '%CMEI%' OR NEW.nome ILIKE '%Centro de Educa%Infantil%' THEN
            NEW.categoria := 'Centro de Educação Infantil';
        ELSIF NEW.nome ILIKE '%Secretaria%' OR NEW.nome ILIKE '%IFRN%' THEN
            NEW.categoria := 'Instituição';
        ELSE
            NEW.categoria := 'Escola';
        END IF;
    ELSIF NEW.categoria IN ('Educação Infantil (CEI)', 'CEI', 'CMEI', 'Creche') THEN
        NEW.categoria := 'Centro de Educação Infantil';
    ELSIF NEW.categoria ILIKE '%sede%' OR NEW.categoria ILIKE '%institu%' THEN
        NEW.categoria := 'Instituição';
    ELSIF NEW.categoria NOT IN ('Escola', 'Centro de Educação Infantil', 'Instituição') THEN
        NEW.categoria := 'Escola';
    END IF;

    -- Garante segmentos válidos sem jamais alterar NEW.categoria
    IF NEW.segmentos IS NULL OR cardinality(NEW.segmentos) = 0 THEN
        IF NEW.categoria = 'Centro de Educação Infantil' THEN
            NEW.segmentos := ARRAY['Ed. Infantil']::TEXT[];
        ELSIF NEW.categoria = 'Instituição' THEN
            NEW.segmentos := ARRAY['Sede Administrativa']::TEXT[];
        ELSE
            NEW.segmentos := ARRAY['Ens. Fundamental I', 'Ens. Fundamental II']::TEXT[];
        END IF;
    END IF;

    -- Garante rede mantenedora válida
    IF NEW.rede IS NULL OR NEW.rede NOT IN ('Municipal', 'Estadual', 'Federal', 'Privada') THEN
        NEW.rede := 'Municipal';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escolas_sync_segmentos_categoria ON public.escolas;
CREATE TRIGGER trg_escolas_sync_segmentos_categoria
BEFORE INSERT OR UPDATE ON public.escolas
FOR EACH ROW
EXECUTE FUNCTION public.handle_escolas_sync_segmentos_categoria();

REVOKE EXECUTE ON FUNCTION public.handle_escolas_sync_segmentos_categoria() FROM PUBLIC, anon;

-- 3. TABELA DE CATALOGOS JSON GEORREFERENCIADOS NO SUPABASE
CREATE TABLE IF NOT EXISTS public.catalogos_json (
    chave TEXT PRIMARY KEY,
    descricao TEXT,
    versao INTEGER NOT NULL DEFAULT 1,
    conteudo JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.catalogos_json IS 'Armazenamento JSONB estruturado dos catalogos georreferenciados (ex: escolas_ceara_mirim) para carga imediata na interface';

DROP TRIGGER IF EXISTS trg_catalogos_json_updated_at ON public.catalogos_json;
CREATE TRIGGER trg_catalogos_json_updated_at
BEFORE UPDATE ON public.catalogos_json
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_timestamp();

-- 4. POLITICAS RLS PARA public.catalogos_json
ALTER TABLE public.catalogos_json ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogos_json_select_public" ON public.catalogos_json;
CREATE POLICY "catalogos_json_select_public"
ON public.catalogos_json FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "catalogos_json_modify_auth" ON public.catalogos_json;
CREATE POLICY "catalogos_json_modify_auth"
ON public.catalogos_json FOR ALL
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'))
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'));
