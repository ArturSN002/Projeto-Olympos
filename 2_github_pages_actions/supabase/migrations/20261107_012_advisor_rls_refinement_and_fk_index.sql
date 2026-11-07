-- ==============================================================================
-- Migration: 20261107_012_advisor_rls_refinement_and_fk_index.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educação Básica (SMEB)
-- Module: Supabase Database Advisor & Linter Hardening (Lints 0001 & 0006)
-- Description:
--   1. Remediação do Lint 0001 (unindexed_foreign_keys):
--      Cria índice de cobertura para a foreign key public.calendario_agenda(criado_por).
--   2. Remediação do Lint 0006 (multiple_permissive_policies):
--      Substitui políticas 'FOR ALL' por políticas específicas ('FOR INSERT', 'FOR UPDATE',
--      'FOR DELETE') nas tabelas que já possuem 'FOR SELECT' público:
--        - public.calendario_agenda
--        - public.catalogos_json
--        - public.secretarias_parceiras
--      Isso elimina a duplicidade de políticas permissivas para a role 'authenticated'
--      durante comandos SELECT, otimizando o plano de execução e o throughput de leitura.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ÍNDICE DE COBERTURA PARA FOREIGN KEY (Lint 0001)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_calendario_agenda_criado_por
ON public.calendario_agenda (criado_por);

-- ------------------------------------------------------------------------------
-- 2. REFINAMENTO RLS: public.calendario_agenda (Lint 0006)
-- ------------------------------------------------------------------------------
-- Remove a política FOR ALL genérica que colidia com agenda_select_public
DROP POLICY IF EXISTS "agenda_modify_auth" ON public.calendario_agenda;
DROP POLICY IF EXISTS "agenda_insert_auth" ON public.calendario_agenda;
DROP POLICY IF EXISTS "agenda_update_auth" ON public.calendario_agenda;
DROP POLICY IF EXISTS "agenda_delete_auth" ON public.calendario_agenda;

CREATE POLICY "agenda_insert_auth"
ON public.calendario_agenda FOR INSERT
TO authenticated
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS', 'RH_COMISSAO', 'JURIDICO'));

CREATE POLICY "agenda_update_auth"
ON public.calendario_agenda FOR UPDATE
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS', 'RH_COMISSAO', 'JURIDICO'))
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS', 'RH_COMISSAO', 'JURIDICO'));

CREATE POLICY "agenda_delete_auth"
ON public.calendario_agenda FOR DELETE
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS', 'RH_COMISSAO', 'JURIDICO'));

-- ------------------------------------------------------------------------------
-- 3. REFINAMENTO RLS: public.catalogos_json (Lint 0006)
-- ------------------------------------------------------------------------------
-- Remove a política FOR ALL genérica que colidia com catalogos_json_select_public
DROP POLICY IF EXISTS "catalogos_json_modify_auth" ON public.catalogos_json;
DROP POLICY IF EXISTS "catalogos_json_insert_auth" ON public.catalogos_json;
DROP POLICY IF EXISTS "catalogos_json_update_auth" ON public.catalogos_json;
DROP POLICY IF EXISTS "catalogos_json_delete_auth" ON public.catalogos_json;

CREATE POLICY "catalogos_json_insert_auth"
ON public.catalogos_json FOR INSERT
TO authenticated
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'));

CREATE POLICY "catalogos_json_update_auth"
ON public.catalogos_json FOR UPDATE
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'))
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'));

CREATE POLICY "catalogos_json_delete_auth"
ON public.catalogos_json FOR DELETE
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'PEDAGOGICO_EVENTOS'));

-- ------------------------------------------------------------------------------
-- 4. REFINAMENTO RLS: public.secretarias_parceiras (Lint 0006)
-- ------------------------------------------------------------------------------
-- Remove a política FOR ALL genérica que colidia com secretarias_select_public
DROP POLICY IF EXISTS "secretarias_modify_auth" ON public.secretarias_parceiras;
DROP POLICY IF EXISTS "secretarias_insert_auth" ON public.secretarias_parceiras;
DROP POLICY IF EXISTS "secretarias_update_auth" ON public.secretarias_parceiras;
DROP POLICY IF EXISTS "secretarias_delete_auth" ON public.secretarias_parceiras;

CREATE POLICY "secretarias_insert_auth"
ON public.secretarias_parceiras FOR INSERT
TO authenticated
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO'));

CREATE POLICY "secretarias_update_auth"
ON public.secretarias_parceiras FOR UPDATE
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO'))
WITH CHECK ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO'));

CREATE POLICY "secretarias_delete_auth"
ON public.secretarias_parceiras FOR DELETE
TO authenticated
USING ((select public.get_current_role()) IN ('ADMIN_GABINETE', 'RH_COMISSAO'));
