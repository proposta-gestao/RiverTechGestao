-- Migration: Painel Super Admin SaaS
-- Data: 2026-04-27

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabela de Super Admins
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Política de RLS: apenas super admins podem ver a tabela
CREATE POLICY "Super admins podem ver super_admins"
  ON public.super_admins FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 2. Função para verificar se o usuário é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE id = _user_id
  );
$$;

-- 3. Função para Super Admin criar a empresa e usuário em um só fluxo (RPC)
-- Isso evita usar a API de SignUp no frontend, o que deslogaria o Super Admin
CREATE OR REPLACE FUNCTION public.create_tenant_with_admin(
    p_nome text,
    p_slug text,
    p_plano text,
    p_cor_primaria text,
    p_logo_url text,
    p_admin_email text,
    p_admin_password text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
    INSERT INTO public.empresas (nome, slug, plano, cor_primaria, logo_url, status)
    VALUES (p_nome, p_slug, p_plano, p_cor_primaria, p_logo_url, 'ativo')
    RETURNING id INTO v_empresa_id;

    -- Inserir store_settings inicial (crucial para o painel admin funcionar)
    INSERT INTO public.store_settings (empresa_id, store_name)
    VALUES (v_empresa_id, p_nome);

    -- Criar o Usuário no Auth do Supabase
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_admin_password, gen_salt('bf'));

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, 
        email_confirmed_at, created_at, updated_at, 
        confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
        v_new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_admin_email, v_encrypted_pw, 
        now(), now(), now(), 
        '', '', '', ''
    );

    -- Vincular o usuário à empresa na tabela public.usuarios
    INSERT INTO public.usuarios (id, email, empresa_id, role)
    VALUES (v_new_user_id, p_admin_email, v_empresa_id, 'admin');

    RETURN v_empresa_id;
END;
$$;


-- 4. Atualizar as Políticas RLS (Adicionar acesso global para super admins)
-- Como o RLS permite a linha se QUALQUER UMA das policies for true,
-- apenas criamos uma nova policy paralela autorizando o super admin.

-- EMPRESAS
CREATE POLICY "Super admin acesso total em empresas"
  ON public.empresas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- USUARIOS
CREATE POLICY "Super admin acesso total em usuarios"
  ON public.usuarios FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- STORE SETTINGS
CREATE POLICY "Super admin acesso total em store settings"
  ON public.store_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
