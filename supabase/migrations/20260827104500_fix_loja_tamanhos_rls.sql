-- ============================================================
-- Migration: Corrigir RLS da tabela loja_tamanhos
-- Data: 2026-08-27
-- ============================================================

-- Remover policies antigas
DROP POLICY IF EXISTS "Leitura publica de tamanhos" ON public.loja_tamanhos;
DROP POLICY IF EXISTS "Admin gerencia tamanhos da sua empresa" ON public.loja_tamanhos;
DROP POLICY IF EXISTS "loja_tamanhos_public_read" ON public.loja_tamanhos;
DROP POLICY IF EXISTS "loja_tamanhos_admin_insert" ON public.loja_tamanhos;
DROP POLICY IF EXISTS "loja_tamanhos_admin_update" ON public.loja_tamanhos;
DROP POLICY IF EXISTS "loja_tamanhos_admin_delete" ON public.loja_tamanhos;

-- 1. Leitura pública (para storefront e admin)
CREATE POLICY "loja_tamanhos_public_read" ON public.loja_tamanhos
    FOR SELECT USING (true);

-- 2. Admin / Super Admin insere tamanhos
CREATE POLICY "loja_tamanhos_admin_insert" ON public.loja_tamanhos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- 3. Admin / Super Admin atualiza tamanhos
CREATE POLICY "loja_tamanhos_admin_update" ON public.loja_tamanhos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- 4. Admin / Super Admin deleta tamanhos
CREATE POLICY "loja_tamanhos_admin_delete" ON public.loja_tamanhos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
