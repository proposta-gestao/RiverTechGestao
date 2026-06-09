-- ================================================================
-- CORREÇÃO DE SEGURANÇA CRÍTICA: RLS Multi-tenant na Tabela Empresas
-- Data: 2026-06-09
-- ================================================================
-- Esta migration corrige a falha onde 'USING (true)' na tabela de
-- empresas expunha os tokens do Mercado Pago (mp_access_token)
-- para qualquer usuário autenticado.
-- ================================================================

-- 1. Remover policy permissiva que gerava a falha
DROP POLICY IF EXISTS "Empresas - Leitura" ON public.empresas;
DROP POLICY IF EXISTS "Usuario ve apenas sua empresa" ON public.empresas;

-- 2. Recriar policy restritiva garantindo isolamento de tenant
-- Nota: O Super Admin já possui sua própria policy ("Super admin acesso total em empresas").
CREATE POLICY "Usuario ve apenas sua empresa"
  ON public.empresas FOR SELECT TO authenticated
  USING (id = public.get_empresa_id());

-- 3. Adicionar policy ausente para Super Admin na tabela admin_users legada
-- Permite que o painel master SaaS veja e gerencie os administradores das empresas.
DROP POLICY IF EXISTS "Super admin acesso total em admin_users" ON public.admin_users;

CREATE POLICY "Super admin acesso total em admin_users"
  ON public.admin_users FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
