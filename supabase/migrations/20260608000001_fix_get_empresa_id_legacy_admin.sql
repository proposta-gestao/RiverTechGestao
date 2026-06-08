-- ================================================================
-- FIX: get_empresa_id() — Suporte a usuários legados (admin_users)
-- ================================================================
-- Problema: a função só buscava em `usuarios`, mas admins cadastrados
-- pela tabela legada `admin_users` não tinham entrada em `usuarios`.
-- Isso fazia get_empresa_id() retornar NULL, quebrando as RLS policies
-- de INSERT/UPDATE/DELETE em products, categories, coupons, etc.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. Tenta buscar na tabela SaaS (usuarios)
  SELECT empresa_id
  FROM public.usuarios
  WHERE id = auth.uid()
  LIMIT 1

  UNION ALL

  -- 2. Fallback: busca na tabela legada (admin_users)
  SELECT empresa_id
  FROM public.admin_users
  WHERE user_id = auth.uid()
    AND empresa_id IS NOT NULL
  LIMIT 1
$$;
