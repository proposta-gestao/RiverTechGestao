-- =======================================================
-- FIX: Política de UPDATE na tabela admin_users
-- Problema: Sem policy de UPDATE, o Supabase bloqueava
-- silenciosamente a atualização do campo senha_alterada,
-- fazendo o popup de troca de senha aparecer em todo login.
-- =======================================================

-- Policy: admin pode atualizar o próprio registro em admin_users
DROP POLICY IF EXISTS "Admin pode atualizar proprio registro" ON public.admin_users;
CREATE POLICY "Admin pode atualizar proprio registro"
  ON public.admin_users
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Super admin pode atualizar qualquer registro em admin_users
DROP POLICY IF EXISTS "Super admin pode atualizar admin_users" ON public.admin_users;
CREATE POLICY "Super admin pode atualizar admin_users"
  ON public.admin_users
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
