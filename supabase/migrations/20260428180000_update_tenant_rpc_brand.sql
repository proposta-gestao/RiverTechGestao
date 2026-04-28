-- Migration: Add Brand Name to Tenant Creation
-- Data: 2026-04-28

-- 1. Atualizar a função RPC para aceitar p_brand_name
CREATE OR REPLACE FUNCTION public.create_tenant_with_admin(
    p_nome text,
    p_slug text,
    p_plano text,
    p_cor_primaria text,
    p_logo_url text,
    p_admin_email text,
    p_admin_password text,
    p_brand_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_empresa_id uuid;
    v_new_user_id uuid;
    v_encrypted_pw text;
BEGIN
    -- Verificar se quem chama é super admin
    IF NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas Super Admins podem criar novas empresas.';
    END IF;

    -- Inserir a Empresa
    INSERT INTO public.empresas (
        nome, slug, plano, cor_primaria, logo_url, status,
        tema_cor_primaria, tema_cor_secundaria, tema_cor_botao,
        tema_cor_bg, tema_cor_surface, tema_cor_borda
    )
    VALUES (
        p_nome, p_slug, p_plano, p_cor_primaria, p_logo_url, 'ativo',
        COALESCE(p_cor_primaria, '#E5B25D'),
        '#1E90FF',
        COALESCE(p_cor_primaria, '#E5B25D'),
        '#0d0d0d', '#1a1a1a', 'rgba(229,178,93,0.2)'
    )
    RETURNING id INTO v_empresa_id;

    -- Inserir store_settings inicial com Brand Name e Subtítulo padrão
    INSERT INTO public.store_settings (id, empresa_id, store_name, brand_name, brand_subtitle)
    VALUES (
        COALESCE((SELECT MAX(id) FROM public.store_settings), 0) + 1, 
        v_empresa_id, 
        p_nome, 
        COALESCE(p_brand_name, p_nome), 
        'Gestão sem Complicação'
    );

    -- Criar o Usuário no Auth do Supabase
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_admin_password, gen_salt('bf'));

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
        v_new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        p_admin_email, v_encrypted_pw,
        now(), now(), now(),
        '', '', '', ''
    );

    -- Vincular o usuário à empresa na tabela public.usuarios
    INSERT INTO public.usuarios (id, email, empresa_id, role)
    VALUES (v_new_user_id, p_admin_email, v_empresa_id, 'admin');

    -- Vincular o usuário à tabela legada admin_users para compatibilidade
    INSERT INTO public.admin_users (user_id, empresa_id)
    VALUES (v_new_user_id, v_empresa_id);

    RETURN v_empresa_id;
END;
$$;
