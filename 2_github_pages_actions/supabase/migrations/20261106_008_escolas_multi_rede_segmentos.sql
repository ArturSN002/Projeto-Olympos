-- ==============================================================================
-- Migration: 20261106_008_escolas_multi_rede_segmentos.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB Ceara-Mirim/RN)
-- Module: Escolas Multi-Segmentos e Multi-Redes de Ensino (Municipal, Estadual, Federal, Privada)
-- Description: Adiciona suporte a multiplos segmentos educacionais simultaneos por escola
--              (Ed. Infantil, Ens. Fundamental I, Ens. Fundamental II, Ensino Medio, etc.),
--              adiciona coluna de rede administrativa com CHECK constraint, cria indices
--              otimizados (GIN para array de segmentos e B-Tree para rede), backfill de dados
--              e trigger de retrocompatibilidade com o campo legado categoria.
-- ==============================================================================

-- 1. ADICIONAR COLUNA REDE COM CHECK CONSTRAINT E ÍNDICE
ALTER TABLE public.escolas
    ADD COLUMN IF NOT EXISTS rede TEXT NOT NULL DEFAULT 'Municipal';

ALTER TABLE public.escolas
    DROP CONSTRAINT IF EXISTS chk_escolas_rede;

ALTER TABLE public.escolas
    ADD CONSTRAINT chk_escolas_rede
    CHECK (rede IN ('Municipal', 'Estadual', 'Federal', 'Privada'));

CREATE INDEX IF NOT EXISTS idx_escolas_rede ON public.escolas(rede);
COMMENT ON COLUMN public.escolas.rede IS 'Rede mantenedora da unidade escolar: Municipal, Estadual, Federal ou Privada';

-- 2. ADICIONAR COLUNA SEGMENTOS COM ÍNDICE GIN E RESTRIÇÃO DE CARDINALIDADE
ALTER TABLE public.escolas
    ADD COLUMN IF NOT EXISTS segmentos TEXT[] NOT NULL DEFAULT ARRAY['Ensino Fundamental']::TEXT[];

ALTER TABLE public.escolas
    DROP CONSTRAINT IF EXISTS chk_escolas_segmentos_not_empty;

ALTER TABLE public.escolas
    ADD CONSTRAINT chk_escolas_segmentos_not_empty
    CHECK (cardinality(segmentos) > 0);

CREATE INDEX IF NOT EXISTS idx_escolas_segmentos_gin ON public.escolas USING GIN (segmentos);
COMMENT ON COLUMN public.escolas.segmentos IS 'Segmentos educacionais atendidos simultaneamente pela unidade (Ed. Infantil, Ens. Fundamental I, Ens. Fundamental II, Ensino Médio, EJA, Educação Especial)';

-- 3. BACKFILL DE DADOS EXISTENTES (MIGRAÇÃO DE CATEGORIA -> SEGMENTOS E DEFAULT DE REDE)
UPDATE public.escolas
SET rede = 'Municipal'
WHERE rede IS NULL;

UPDATE public.escolas
SET segmentos = CASE
    WHEN categoria ILIKE '%infantil%' OR categoria ILIKE '%cei%' OR categoria ILIKE '%cmei%' OR categoria ILIKE '%creche%'
        THEN ARRAY['Ed. Infantil']::TEXT[]
    WHEN categoria ILIKE '%sede%'
        THEN ARRAY['Sede Administrativa']::TEXT[]
    WHEN categoria ILIKE '%especial%'
        THEN ARRAY['Educação Especial']::TEXT[]
    WHEN categoria ILIKE '%medio%' OR categoria ILIKE '%médio%'
        THEN ARRAY['Ensino Médio']::TEXT[]
    WHEN categoria ILIKE '%fundamental%' OR categoria ILIKE '%rural%'
        THEN ARRAY['Ens. Fundamental I', 'Ens. Fundamental II']::TEXT[]
    ELSE
        ARRAY[categoria]::TEXT[]
END
WHERE segmentos IS NULL OR segmentos = ARRAY['Ensino Fundamental']::TEXT[];

-- 4. FUNÇÃO E TRIGGER DE SINCRONIZAÇÃO E RETROCOMPATIBILIDADE (categoria <-> segmentos)
CREATE OR REPLACE FUNCTION public.handle_escolas_sync_segmentos_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Se segmentos foi informado e não está vazio, computa valor legível para categoria legada
    IF NEW.segmentos IS NOT NULL AND cardinality(NEW.segmentos) > 0 THEN
        IF NEW.categoria IS NULL OR NEW.categoria = 'Ensino Fundamental' OR NEW.categoria = '' THEN
            NEW.categoria := array_to_string(NEW.segmentos, ', ');
        END IF;
    -- Se categoria legada foi informada e segmentos não foi fornecido
    ELSIF NEW.categoria IS NOT NULL AND (NEW.segmentos IS NULL OR cardinality(NEW.segmentos) = 0) THEN
        IF NEW.categoria ILIKE '%infantil%' OR NEW.categoria ILIKE '%cei%' OR NEW.categoria ILIKE '%cmei%' THEN
            NEW.segmentos := ARRAY['Ed. Infantil']::TEXT[];
        ELSIF NEW.categoria ILIKE '%sede%' THEN
            NEW.segmentos := ARRAY['Sede Administrativa']::TEXT[];
        ELSIF NEW.categoria ILIKE '%especial%' THEN
            NEW.segmentos := ARRAY['Educação Especial']::TEXT[];
        ELSIF NEW.categoria ILIKE '%medio%' OR NEW.categoria ILIKE '%médio%' THEN
            NEW.segmentos := ARRAY['Ensino Médio']::TEXT[];
        ELSE
            NEW.segmentos := ARRAY['Ens. Fundamental I', 'Ens. Fundamental II']::TEXT[];
        END IF;
    END IF;

    -- Garante rede default válida
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

-- 5. VALIDAÇÃO DE CONFORMIDADE RLS
-- As políticas existentes (escolas_select_public, escolas_insert_auth, escolas_update_auth, escolas_delete_auth)
-- permanecem ativas sobre a tabela public.escolas e cobrem integralmente as novas colunas adicionadas.
ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;
