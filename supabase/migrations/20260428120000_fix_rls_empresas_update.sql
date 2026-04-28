-- Migration: Corrigir RLS para Update em Empresas
-- Data: 2026-04-28

-- 1. Limpar políticas existentes que podem estar incompletas ou conflituosas
DROP POLICY IF EXISTS "Super admin acesso total em empresas" ON public.empresas;
DROP POLICY IF EXISTS "Usuario ve apenas sua empresa" ON public.empresas;

-- 2. Criar Política Global de Leitura (Admins da empresa ou Super Admins)
CREATE POLICY "Empresas - Leitura"
  ON public.empresas FOR SELECT TO authenticated
  USING (
    id = public.get_empresa_id() OR 
    public.is_super_admin(auth.uid())
  );

-- 3. Criar Política Global de Update
-- Permite update se for Super Admin OU se for o Admin da própria empresa
CREATE POLICY "Empresas - Update"
  ON public.empresas FOR UPDATE TO authenticated
  USING (
    id = public.get_empresa_id() OR 
    public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    id = public.get_empresa_id() OR 
    public.is_super_admin(auth.uid())
  );

-- 4. Garantir acesso ALL para Super Admins (incluindo DELETE/INSERT)
CREATE POLICY "Empresas - Super Admin Full"
  ON public.empresas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
