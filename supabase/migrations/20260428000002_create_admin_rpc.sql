-- Migration: Função para Criar Novo Admin pela Gestão Master
-- Data: 2026-04-28

CREATE OR REPLACE FUNCTION public.create_new_admin_user(
    p_email text,
    p_password text,
    p_empresa_id uuid
) RETURNS uuid AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Criar o usuário na tabela de autenticação do Supabase (auth.users)
    -- Nota: Usamos a extensão pgcrypto que o Supabase já possui
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    )
    RETURNING id INTO v_user_id;

    -- 2. Criar o registro na nossa tabela pública de usuários
    INSERT INTO public.usuarios (id, email, empresa_id, role)
    VALUES (v_user_id, p_email, p_empresa_id, 'admin');

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissão apenas para usuários autenticados (ou super admins, se preferir restringir mais)
REVOKE EXECUTE ON FUNCTION public.create_new_admin_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_new_admin_user TO authenticated;
