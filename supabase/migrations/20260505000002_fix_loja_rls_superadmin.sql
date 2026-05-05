-- ============================================================
-- Migration: Corrigir RLS da Loja para Super Admins
-- Data: 2026-05-05
-- ============================================================

-- Remover as policies antigas de loja_produtos
DROP POLICY IF EXISTS "loja_produtos_admin_insert" ON public.loja_produtos;
DROP POLICY IF EXISTS "loja_produtos_admin_update" ON public.loja_produtos;
DROP POLICY IF EXISTS "loja_produtos_admin_delete" ON public.loja_produtos;

-- Recriar as policies de loja_produtos permitindo Super Admins
CREATE POLICY "loja_produtos_admin_insert" ON public.loja_produtos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "loja_produtos_admin_update" ON public.loja_produtos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "loja_produtos_admin_delete" ON public.loja_produtos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));


-- Remover as policies antigas de loja_variacoes
DROP POLICY IF EXISTS "loja_variacoes_admin_insert" ON public.loja_variacoes;
DROP POLICY IF EXISTS "loja_variacoes_admin_update" ON public.loja_variacoes;
DROP POLICY IF EXISTS "loja_variacoes_admin_delete" ON public.loja_variacoes;

-- Recriar as policies de loja_variacoes permitindo Super Admins
CREATE POLICY "loja_variacoes_admin_insert" ON public.loja_variacoes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.loja_produtos p
            WHERE p.id = produto_id
              AND (p.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
        )
    );

CREATE POLICY "loja_variacoes_admin_update" ON public.loja_variacoes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.loja_produtos p
            WHERE p.id = produto_id
              AND (p.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
        )
    );

CREATE POLICY "loja_variacoes_admin_delete" ON public.loja_variacoes
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.loja_produtos p
            WHERE p.id = produto_id
              AND (p.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
        )
    );
