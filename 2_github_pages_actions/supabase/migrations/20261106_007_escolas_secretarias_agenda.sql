-- ==============================================================================
-- Migration: 20261106_007_escolas_secretarias_agenda.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB Ceara-Mirim/RN)
-- Module: Persistencia de Escolas Municipais, Secretarias Parceiras e Agenda Intersetorial
-- Description: Tabelas georreferenciadas de unidades escolares e secretarias parceiras
--              do RN, tabela de eventos/reunioes intersetoriais da agenda municipal,
--              triggers automaticos de updated_at e politicas de RLS (public SELECT e
--              modificacao autenticada para papeis autorizados).
-- ==============================================================================

-- 1. TABELA DE ESCOLAS MUNICIPAIS DE CEARÁ-MIRIM
CREATE TABLE IF NOT EXISTS public.escolas (
    id TEXT PRIMARY KEY,
    inep VARCHAR(12),
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'Ensino Fundamental',
    zona TEXT NOT NULL DEFAULT 'Urbana',
    bairro_distrito TEXT,
    endereco TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    turnos TEXT[] DEFAULT ARRAY['Matutino', 'Vespertino']::TEXT[],
    telefone TEXT,
    diretor TEXT,
    cor VARCHAR(16) DEFAULT '#38BDF8',
    icone VARCHAR(8) DEFAULT '🏫',
    status TEXT NOT NULL DEFAULT 'ATIVA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.escolas IS 'Catalogo georreferenciado oficial das unidades escolares e CEIs de Ceara-Mirim';
CREATE INDEX IF NOT EXISTS idx_escolas_zona ON public.escolas(zona);
CREATE INDEX IF NOT EXISTS idx_escolas_categoria ON public.escolas(categoria);
CREATE INDEX IF NOT EXISTS idx_escolas_inep ON public.escolas(inep);

-- 2. TABELA DE SECRETARIAS MUNICIPAIS PARCEIRAS (PERMUTAS RN)
CREATE TABLE IF NOT EXISTS public.secretarias_parceiras (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    municipio TEXT NOT NULL,
    regiao TEXT NOT NULL DEFAULT 'Grande Natal',
    tipo TEXT NOT NULL DEFAULT 'Secretaria Municipal Parceira',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    cor VARCHAR(16) DEFAULT '#10B981',
    icone VARCHAR(8) DEFAULT '🏛️',
    endereco TEXT,
    contato TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.secretarias_parceiras IS 'Pontos georreferenciados dos polos parceiros para permutas intermunicipais de servidores';
CREATE INDEX IF NOT EXISTS idx_secretarias_municipio ON public.secretarias_parceiras(municipio);
CREATE INDEX IF NOT EXISTS idx_secretarias_regiao ON public.secretarias_parceiras(regiao);

-- 3. TABELA DE EVENTOS DA AGENDA INTERSETORIAL DO CALENDÁRIO
CREATE TABLE IF NOT EXISTS public.calendario_agenda (
    id TEXT PRIMARY KEY,
    ano INTEGER NOT NULL DEFAULT 2026,
    titulo TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    horario TEXT,
    setor TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'agenda_intersetorial',
    descricao TEXT,
    local TEXT,
    publico_alvo TEXT,
    letivo BOOLEAN NOT NULL DEFAULT false,
    cor VARCHAR(16) DEFAULT '#8B5CF6',
    icone VARCHAR(8) DEFAULT '🗓️',
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.calendario_agenda IS 'Eventos, reunioes e datas intersetoriais fora do calendario escolar letivo oficial';
CREATE INDEX IF NOT EXISTS idx_calendario_agenda_ano ON public.calendario_agenda(ano);
CREATE INDEX IF NOT EXISTS idx_calendario_agenda_datas ON public.calendario_agenda(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_calendario_agenda_setor ON public.calendario_agenda(setor);

-- 4. ATTACH AUTOMATIC UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS trg_escolas_updated_at ON public.escolas;
CREATE TRIGGER trg_escolas_updated_at
BEFORE UPDATE ON public.escolas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_secretarias_parceiras_updated_at ON public.secretarias_parceiras;
CREATE TRIGGER trg_secretarias_parceiras_updated_at
BEFORE UPDATE ON public.secretarias_parceiras
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_calendario_agenda_updated_at ON public.calendario_agenda;
CREATE TRIGGER trg_calendario_agenda_updated_at
BEFORE UPDATE ON public.calendario_agenda
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_timestamp();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretarias_parceiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_agenda ENABLE ROW LEVEL SECURITY;

-- 5.1 Políticas para public.escolas:
-- Leitura pública para apoiar visualização do mapa por cidadãos e servidores
DROP POLICY IF EXISTS "escolas_select_public" ON public.escolas;
CREATE POLICY "escolas_select_public"
ON public.escolas FOR SELECT
TO anon, authenticated
USING (true);

-- Modificações restritas a ADMIN_GABINETE e PEDAGOGICO_EVENTOS
DROP POLICY IF EXISTS "escolas_insert_auth" ON public.escolas;
CREATE POLICY "escolas_insert_auth"
ON public.escolas FOR INSERT
TO authenticated
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'));

DROP POLICY IF EXISTS "escolas_update_auth" ON public.escolas;
CREATE POLICY "escolas_update_auth"
ON public.escolas FOR UPDATE
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'))
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'));

DROP POLICY IF EXISTS "escolas_delete_auth" ON public.escolas;
CREATE POLICY "escolas_delete_auth"
ON public.escolas FOR DELETE
TO authenticated
USING ((select public.get_current_role()) = 'ADMIN_GABINETE');

-- 5.2 Políticas para public.secretarias_parceiras:
-- Leitura pública para o mapa de permutas
DROP POLICY IF EXISTS "secretarias_select_public" ON public.secretarias_parceiras;
CREATE POLICY "secretarias_select_public"
ON public.secretarias_parceiras FOR SELECT
TO anon, authenticated
USING (true);

-- Modificações restritas a ADMIN_GABINETE e RH_COMISSAO
DROP POLICY IF EXISTS "secretarias_modify_auth" ON public.secretarias_parceiras;
CREATE POLICY "secretarias_modify_auth"
ON public.secretarias_parceiras FOR ALL
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO'))
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO'));

-- 5.3 Políticas para public.calendario_agenda:
-- Leitura pública para transparência da agenda da SMEB
DROP POLICY IF EXISTS "agenda_select_public" ON public.calendario_agenda;
CREATE POLICY "agenda_select_public"
ON public.calendario_agenda FOR SELECT
TO anon, authenticated
USING (true);

-- Criação e edição para todos os perfis autorizados (Gabinete, Pedagógico, RH, Jurídico)
DROP POLICY IF EXISTS "agenda_modify_auth" ON public.calendario_agenda;
CREATE POLICY "agenda_modify_auth"
ON public.calendario_agenda FOR ALL
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS', 'RH_COMISSAO', 'JURIDICO'))
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS', 'RH_COMISSAO', 'JURIDICO'));
