-- ==============================================================================
-- Seed: seed_roles_mock.sql
-- Project: Projeto Olympos - Secretaria Municipal de Educacao (SMEB)
-- Module: Supabase Database Seed / Demonstration Fixtures
-- Description: Inserts demonstration structure without hardcoded real secrets.
--              Provides clean UUID placeholders and demonstration datasets for
--              all 4 RBAC roles, encrypted servidores, licencas, publicacoes,
--              and intermunicipal payroll data.
-- ==============================================================================

DO $$
DECLARE
    -- Mock demonstration keys for local/staging testing ONLY
    -- In production, keys must be set in environment variables or Supabase Vault!
    v_demo_pepper TEXT := 'MOCK_PEPPER_FOR_DEMO_ENVIRONMENT_ONLY_2026';
    v_demo_secret TEXT := 'MOCK_SECRET_KEY_DEMO_ENVIRONMENT_ONLY_2026';

    -- Mock UUIDs for demonstration accounts
    v_uid_admin UUID := '00000000-0000-0000-0000-000000000001';
    v_uid_rh UUID := '00000000-0000-0000-0000-000000000002';
    v_uid_pedag UUID := '00000000-0000-0000-0000-000000000003';
    v_uid_jurid UUID := '00000000-0000-0000-0000-000000000004';

    -- Mock Servidor UUIDs
    v_srv_1 UUID := '10000000-0000-0000-0000-000000000001';
    v_srv_2 UUID := '10000000-0000-0000-0000-000000000002';
    v_srv_3 UUID := '10000000-0000-0000-0000-000000000003';

    -- Mock Licenca UUIDs
    v_lic_1 UUID := '20000000-0000-0000-0000-000000000001';
    v_lic_2 UUID := '20000000-0000-0000-0000-000000000002';
BEGIN
    RAISE NOTICE 'Iniciando provisionamento de dados demonstrativos do Projeto Olympos...';

    -- Set mock runtime settings for session execution
    PERFORM set_config('app.settings.blind_index_salt', v_demo_pepper, false);
    PERFORM set_config('app.settings.blind_index_pepper', v_demo_pepper, false);
    PERFORM set_config('app.settings.master_key', v_demo_secret, false);

    -- 1. SEED AUTH USERS (Mock accounts for RBAC demonstrations)
    INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES
        (
            v_uid_admin,
            'admin.gabinete@smeb.exemplo.gov.br',
            jsonb_build_object('provider', 'email', 'role', 'ADMIN_GABINETE'),
            jsonb_build_object('full_name', 'Diretora do Gabinete Executivo SMEB', 'department', 'Gabinete do Secretario'),
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_uid_rh,
            'rh.comissao@smeb.exemplo.gov.br',
            jsonb_build_object('provider', 'email', 'role', 'RH_COMISSAO'),
            jsonb_build_object('full_name', 'Coordenador da Comissao de Recursos Humanos', 'department', 'Recursos Humanos e Folha'),
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_uid_pedag,
            'pedagogico.eventos@smeb.exemplo.gov.br',
            jsonb_build_object('provider', 'email', 'role', 'PEDAGOGICO_EVENTOS'),
            jsonb_build_object('full_name', 'Gestor de Projetos Pedagogicos e Eventos', 'department', 'Nucleo de Ensino e Cultura'),
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_uid_jurid,
            'juridico.consultoria@smeb.exemplo.gov.br',
            jsonb_build_object('provider', 'email', 'role', 'JURIDICO'),
            jsonb_build_object('full_name', 'Consultor Juridico Educacional', 'department', 'Assessoria Juridica'),
            timezone('utc', now()),
            timezone('utc', now())
        )
    ON CONFLICT (id) DO NOTHING;

    -- 2. SEED PROFILES (Mirrors auth.users with app_role)
    INSERT INTO public.profiles (id, email, full_name, role, department, created_at, updated_at)
    VALUES
        (
            v_uid_admin,
            'admin.gabinete@smeb.exemplo.gov.br',
            'Diretora do Gabinete Executivo SMEB',
            'ADMIN_GABINETE',
            'Gabinete do Secretario',
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_uid_rh,
            'rh.comissao@smeb.exemplo.gov.br',
            'Coordenador da Comissao de Recursos Humanos',
            'RH_COMISSAO',
            'Recursos Humanos e Folha',
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_uid_pedag,
            'pedagogico.eventos@smeb.exemplo.gov.br',
            'Gestor de Projetos Pedagogicos e Eventos',
            'PEDAGOGICO_EVENTOS',
            'Nucleo de Ensino e Cultura',
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_uid_jurid,
            'juridico.consultoria@smeb.exemplo.gov.br',
            'Consultor Juridico Educacional',
            'JURIDICO',
            'Assessoria Juridica',
            timezone('utc', now()),
            timezone('utc', now())
        )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        updated_at = timezone('utc', now());

    -- 3. SEED SERVIDORES (Demonstration data with encrypted PII and blind indexing)
    INSERT INTO public.servidores (
        id,
        nome,
        cpf_hash,
        matricula_hash,
        cargo,
        funcao,
        lotacao,
        status,
        cpf_encrypted,
        matricula_encrypted,
        created_at,
        updated_at
    )
    VALUES
        (
            v_srv_1,
            'Maria Helena dos Santos (DEMO)',
            public.generate_blind_index('111.111.111-11', v_demo_pepper),
            public.generate_blind_index('MAT-1001-A', v_demo_pepper),
            'Professor de Ensino Fundamental',
            'Regente de Classe - Lingua Portuguesa',
            'Escola Municipal Alice Garcia Freire',
            'ATIVO',
            public.encrypt_pii('111.111.111-11', v_demo_secret),
            public.encrypt_pii('MAT-1001-A', v_demo_secret),
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_srv_2,
            'Jose Carlos de Almeida (DEMO)',
            public.generate_blind_index('222.222.222-22', v_demo_pepper),
            public.generate_blind_index('MAT-1002-B', v_demo_pepper),
            'Supervisor Escolar',
            'Coordenacao Pedagogica',
            'Escola Municipal Presidente Tancredo Neves',
            'ATIVO',
            public.encrypt_pii('222.222.222-22', v_demo_secret),
            public.encrypt_pii('MAT-1002-B', v_demo_secret),
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_srv_3,
            'Ana Paula Silveira Rocha (DEMO)',
            public.generate_blind_index('333.333.333-33', v_demo_pepper),
            public.generate_blind_index('MAT-1003-C', v_demo_pepper),
            'Assistente de Servicos Gerais',
            'Apoio Operacional',
            'Sede da SMEB - Secretaria Municipal de Educacao',
            'AFASTADO',
            public.encrypt_pii('333.333.333-33', v_demo_secret),
            public.encrypt_pii('MAT-1003-C', v_demo_secret),
            timezone('utc', now()),
            timezone('utc', now())
        )
    ON CONFLICT (id) DO NOTHING;

    -- 4. SEED LICENCAS (Demonstration leaves and encrypted medical assessments)
    INSERT INTO public.licencas (
        id,
        servidor_id,
        tipo_licenca,
        data_inicio,
        data_termino,
        periodo_aquisitivo,
        parecer_numero,
        dados_medicos_encrypted,
        status,
        created_at,
        updated_at
    )
    VALUES
        (
            v_lic_1,
            v_srv_1,
            'LICENCA_PREMIO',
            CURRENT_DATE - INTERVAL '30 days',
            CURRENT_DATE + INTERVAL '60 days',
            '2018-2023',
            'PAR-SMEB-2026/042',
            NULL, -- Licenca premio nao contem dados medicos
            'DEFERIDO',
            timezone('utc', now()),
            timezone('utc', now())
        ),
        (
            v_lic_2,
            v_srv_3,
            'TRATAMENTO_SAUDE',
            CURRENT_DATE - INTERVAL '15 days',
            CURRENT_DATE + INTERVAL '45 days',
            '2021-2026',
            'LAUDO-JUNTA-2026/088',
            public.encrypt_pii('{"cid10": "M54.5", "diagnostico": "Lombociatalgia cronica incapacitante para esforco fisico", "junta_medica": "Perito CRM-RN 9821"}', v_demo_secret),
            'HOMOLOGADO',
            timezone('utc', now()),
            timezone('utc', now())
        )
    ON CONFLICT (id) DO NOTHING;

    -- 5. SEED PUBLICACOES DIARIO OFICIAL (Mock FEMURN scraping results)
    INSERT INTO public.publicacoes_diario (
        id,
        data_publicacao,
        edicao,
        titulo,
        conteudo_ner,
        ato_tipo,
        servidores_envolvidos,
        created_at
    )
    VALUES
        (
            '30000000-0000-0000-0000-000000000001',
            CURRENT_DATE - INTERVAL '2 days',
            'Edicao Ordinaria nº 3.450',
            'Portaria nº 142/2026-SMEB - Concessao de Licenca-Premio',
            jsonb_build_object(
                'orgao', 'Secretaria Municipal de Educacao de Ceara-Mirim',
                'ato_normativo', 'Portaria nº 142/2026',
                'tipo_ato', 'CONCESSAO_LICENCA_PREMIO',
                'servidores', jsonb_build_array('Maria Helena dos Santos'),
                'matriculas', jsonb_build_array('MAT-1001-A'),
                'vigencia_dias', 90
            ),
            'PORTARIA',
            ARRAY['Maria Helena dos Santos'],
            timezone('utc', now())
        ),
        (
            '30000000-0000-0000-0000-000000000002',
            CURRENT_DATE - INTERVAL '5 days',
            'Edicao Ordinaria nº 3.447',
            'Portaria nº 138/2026-SMEB - Designacao de Comissao Especial de Readaptacao',
            jsonb_build_object(
                'orgao', 'Secretaria Municipal de Educacao de Ceara-Mirim',
                'ato_normativo', 'Portaria nº 138/2026',
                'tipo_ato', 'DESIGNACAO_COMISSAO',
                'membros', jsonb_build_array('Jose Carlos de Almeida', 'Membro 2'),
                'finalidade', 'Instrucao de processos de readaptacao funcional'
            ),
            'PORTARIA',
            ARRAY['Jose Carlos de Almeida'],
            timezone('utc', now())
        )
    ON CONFLICT (id) DO NOTHING;

    -- 6. SEED FOLHA INTERMUNICIPAL (Mock Papiro de Cadmo payroll cross-analysis)
    INSERT INTO public.folha_intermunicipal (
        id,
        mes_ano,
        municipio,
        cargo,
        dados_remuneracao,
        created_at
    )
    VALUES
        (
            '40000000-0000-0000-0000-000000000001',
            '2026-03',
            'Ceara-Mirim',
            'Professor Ensino Fundamental II',
            jsonb_build_object(
                'total_servidores', 420,
                'media_salarial_base', 4850.00,
                'piso_magisterio_atendido', true,
                'jornada_padrao_horas', 30
            ),
            timezone('utc', now())
        ),
        (
            '40000000-0000-0000-0000-000000000002',
            '2026-03',
            'Sao Goncalo do Amarante',
            'Professor Ensino Fundamental II',
            jsonb_build_object(
                'total_servidores', 380,
                'media_salarial_base', 4720.00,
                'piso_magisterio_atendido', true,
                'jornada_padrao_horas', 30
            ),
            timezone('utc', now())
        ),
        (
            '40000000-0000-0000-0000-000000000003',
            '2026-03',
            'Macaisa',
            'Professor Ensino Fundamental II',
            jsonb_build_object(
                'total_servidores', 310,
                'media_salarial_base', 4680.00,
                'piso_magisterio_atendido', true,
                'jornada_padrao_horas', 30
            ),
            timezone('utc', now())
        )
    ON CONFLICT (id) DO NOTHING;

    -- 7. INITIAL AUDIT LOG FOR SEED INITIALIZATION
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
    VALUES (
        'system_initialization',
        v_uid_admin,
        'SYSTEM_SEED_PROVISIONING',
        v_uid_admin,
        'ADMIN_GABINETE',
        NULL,
        jsonb_build_object(
            'status', 'SEED_COMPLETED',
            'environment', 'demonstration_sandbox',
            'note', 'Demonstration fixtures provisioned without hardcoded production credentials'
        ),
        timezone('utc', now())
    );

    RAISE NOTICE 'Provisionamento de dados demonstrativos concluido com sucesso!';
END $$;
