-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: categorias_insumos
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categorias_insumos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome        TEXT        NOT NULL,
    ativo       BOOLEAN     NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_insumos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_categorias_insumos_empresa_id ON public.categorias_insumos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_insumos_empresa_ativo ON public.categorias_insumos(empresa_id, ativo);

COMMENT ON TABLE public.categorias_insumos IS 'Categorias de insumos por empresa. Permite organização por tipo (carnes, laticínios, bebidas, embalagens etc.)';

-- RLS
CREATE POLICY "categorias_insumos_select" ON public.categorias_insumos
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "categorias_insumos_insert" ON public.categorias_insumos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "categorias_insumos_update" ON public.categorias_insumos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "categorias_insumos_delete" ON public.categorias_insumos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());
