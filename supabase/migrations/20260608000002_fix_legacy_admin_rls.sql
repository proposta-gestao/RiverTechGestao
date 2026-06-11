-- ================================================================
-- FIX 1: get_empresa_id() — Suporte a usuários legados (admin_users)
-- ================================================================
-- Problema: a função só buscava em `usuarios`, mas admins cadastrados
-- pela tabela legada `admin_users` não tinham entrada em `usuarios`.
-- Isso fazia get_empresa_id() retornar NULL, quebrando TODAS as RLS
-- policies de SELECT/INSERT/UPDATE/DELETE em todas as tabelas.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1),
    (SELECT empresa_id FROM public.admin_users WHERE user_id = auth.uid() AND empresa_id IS NOT NULL LIMIT 1)
  );
$$;


-- ================================================================
-- FIX 2: Permitir leitura de empresas para TODOS os authenticated
-- ================================================================
-- Problema: a policy de SELECT em empresas exigia que
-- get_empresa_id() retornasse um ID válido, criando dependência
-- circular para admins legados. Dados de empresas são não-sensíveis
-- (nome, slug, logo, tema) e já são públicos para `anon`.
-- ================================================================

-- Remover policy restritiva existente
DROP POLICY IF EXISTS "Empresas - Leitura" ON public.empresas;

-- Criar policy permissiva para authenticated (mesma liberdade que anon já tem)
CREATE POLICY "Empresas - Leitura"
  ON public.empresas FOR SELECT TO authenticated
  USING (true);


-- ================================================================
-- FIX 3: RPC para buscar dados da empresa por slug (SECURITY DEFINER)
-- ================================================================
-- Útil como fallback no frontend quando todas as RLS estão bloqueando.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(_slug TEXT)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  slug TEXT,
  cor_primaria TEXT,
  logo_url TEXT,
  status TEXT,
  modulos JSONB,
  tema_cor_primaria TEXT,
  tema_cor_secundaria TEXT,
  tema_cor_botao TEXT,
  tema_cor_bg TEXT,
  tema_cor_surface TEXT,
  tema_cor_borda TEXT,
  tema_cor_texto TEXT,
  tema_cor_hover TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id, e.nome, e.slug, e.cor_primaria, e.logo_url, e.status,
    e.modulos,
    e.tema_cor_primaria, e.tema_cor_secundaria, e.tema_cor_botao,
    e.tema_cor_bg, e.tema_cor_surface, e.tema_cor_borda,
    e.tema_cor_texto, e.tema_cor_hover
  FROM public.empresas e
  WHERE LOWER(e.slug) = LOWER(_slug)
  LIMIT 1;
$$;
