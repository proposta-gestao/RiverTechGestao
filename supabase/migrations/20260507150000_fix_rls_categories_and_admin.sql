-- ============================================================
-- Migration: Fix RLS and Admin Permissions (v3 - Completo)
-- Data: 2026-05-07
-- Objetivo: Corrigir erros de RLS em vÃ¡rias tabelas (categories, 
--           stock_reasons, etc) para Super Admins e Novos Admins.
-- ============================================================

-- 1. Atualizar a funÃ§Ã£o is_admin para reconhecer usuÃ¡rios de ambas as tabelas
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = _user_id
    UNION
    SELECT 1 FROM public.usuarios WHERE id = _user_id AND role = 'admin'
  );
$$;

-- 2. Categorias (categories)
DROP POLICY IF EXISTS "Admin insere categoria na sua empresa" ON public.categories;
CREATE POLICY "Admin insere categoria na sua empresa" ON public.categories FOR INSERT TO authenticated 
WITH CHECK ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin atualiza categoria da sua empresa" ON public.categories;
CREATE POLICY "Admin atualiza categoria da sua empresa" ON public.categories FOR UPDATE TO authenticated 
USING ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin deleta categoria da sua empresa" ON public.categories;
CREATE POLICY "Admin deleta categoria da sua empresa" ON public.categories FOR DELETE TO authenticated 
USING ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));


-- 3. Produtos (products)
DROP POLICY IF EXISTS "Admin insere produto na sua empresa" ON public.products;
CREATE POLICY "Admin insere produto na sua empresa" ON public.products FOR INSERT TO authenticated 
WITH CHECK ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin atualiza produto da sua empresa" ON public.products;
CREATE POLICY "Admin atualiza produto da sua empresa" ON public.products FOR UPDATE TO authenticated 
USING ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));


-- 4. Motivos de Estoque (stock_reasons)
DROP POLICY IF EXISTS "Admin gerencia motivos de estoque da sua empresa" ON public.stock_reasons;
CREATE POLICY "Admin gerencia motivos de estoque da sua empresa"
  ON public.stock_reasons FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));


-- 5. MovimentaÃ§Ãµes de Estoque (stock_movements)
DROP POLICY IF EXISTS "Admin ve movimentos da sua empresa" ON public.stock_movements;
CREATE POLICY "Admin ve movimentos da sua empresa" ON public.stock_movements FOR SELECT TO authenticated
USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin insere movimentos da sua empresa" ON public.stock_movements;
CREATE POLICY "Admin insere movimentos da sua empresa" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));


-- 6. ConfiguraÃ§Ãµes da Loja (store_settings)
DROP POLICY IF EXISTS "Admin gerencia config da sua empresa" ON public.store_settings;
CREATE POLICY "Admin gerencia config da sua empresa"
  ON public.store_settings FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));


-- 7. Zonas de Frete (shipping_zones)
DROP POLICY IF EXISTS "Admin gerencia zonas de frete da sua empresa" ON public.shipping_zones;
CREATE POLICY "Admin gerencia zonas de frete da sua empresa"
  ON public.shipping_zones FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));


-- 8. Cupons e Atendentes
DROP POLICY IF EXISTS "Admin gerencia cupons da sua empresa" ON public.coupons;
CREATE POLICY "Admin gerencia cupons da sua empresa" ON public.coupons FOR ALL TO authenticated
USING ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia atendentes da sua empresa" ON public.atendentes;
CREATE POLICY "Admin gerencia atendentes da sua empresa" ON public.atendentes FOR ALL TO authenticated
USING ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()))
WITH CHECK ((empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid())) OR public.is_super_admin(auth.uid()));
