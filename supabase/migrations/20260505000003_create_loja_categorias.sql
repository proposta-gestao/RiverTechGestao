-- ============================================================
-- Migration: Tabela de Categorias da Loja de Roupas
-- Data: 2026-05-05
-- Categorias independentes da tabela categories (cardÃ¡pio)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loja_categorias (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id   UUID         NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome         TEXT         NOT NULL,
    ordem        INTEGER      NOT NULL DEFAULT 0,
    ativo        BOOLEAN      NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_categorias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_loja_categorias_empresa ON public.loja_categorias(empresa_id);

-- Leitura pÃºblica (para storefront)
CREATE POLICY "loja_categorias_public_read" ON public.loja_categorias
    FOR SELECT USING (true);

-- Admin da empresa gerencia suas categorias
CREATE POLICY "loja_categorias_admin_insert" ON public.loja_categorias
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "loja_categorias_admin_update" ON public.loja_categorias
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "loja_categorias_admin_delete" ON public.loja_categorias
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- Adicionar FK loja_categoria_id em loja_produtos
ALTER TABLE public.loja_produtos
    ADD COLUMN IF NOT EXISTS loja_categoria_id UUID REFERENCES public.loja_categorias(id) ON DELETE SET NULL;
