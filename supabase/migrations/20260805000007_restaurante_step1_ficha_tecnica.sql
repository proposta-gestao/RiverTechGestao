-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabelas: ficha_tecnica e ficha_tecnica_itens
-- Data: 2026-08-05
-- ============================================================

-- ============================================================
-- TABELA: ficha_tecnica
-- Vínculo entre produto do cardápio e seus insumos, com versionamento
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ficha_tecnica (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    product_id          UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    versao              INTEGER     NOT NULL DEFAULT 1,
    ativo               BOOLEAN     NOT NULL DEFAULT true,
    vigencia_inicio     TIMESTAMPTZ NOT NULL DEFAULT now(),
    vigencia_fim        TIMESTAMPTZ,          -- NULL = vigente atualmente
    custo_calculado     NUMERIC(10,4) NOT NULL DEFAULT 0, -- calculado via PASSO 2
    -- Suporte a receitas base com rendimento
    quantidade_produzida NUMERIC,             -- quantas porções/unidades esta ficha produz
    unidade_produzida_id UUID        REFERENCES public.unidades_medida(id),
    observacoes         TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Garante unicidade de versão por produto
    CONSTRAINT uq_ficha_tecnica_versao UNIQUE (product_id, versao)
);

ALTER TABLE public.ficha_tecnica ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_empresa      ON public.ficha_tecnica(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_product      ON public.ficha_tecnica(product_id);
CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_empresa_prod ON public.ficha_tecnica(empresa_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_ativo        ON public.ficha_tecnica(product_id, ativo);
-- Índice para busca da versão vigente (PASSO 4: baixa automática)
CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_vigente
    ON public.ficha_tecnica(product_id, ativo, vigencia_inicio, vigencia_fim);

COMMENT ON TABLE public.ficha_tecnica IS 'Composição (receita) de cada item do cardápio. Versionada para preservar histórico de custo em pedidos antigos.';
COMMENT ON COLUMN public.ficha_tecnica.versao IS 'Versão incremental da ficha técnica por produto. Permite histórico sem perda de dados.';
COMMENT ON COLUMN public.ficha_tecnica.vigencia_fim IS 'Data/hora em que esta versão foi encerrada. NULL = versão atualmente vigente.';
COMMENT ON COLUMN public.ficha_tecnica.custo_calculado IS 'Custo total do prato em R$. Recalculado automaticamente via trigger (PASSO 2).';
COMMENT ON COLUMN public.ficha_tecnica.quantidade_produzida IS 'Quantas porções/unidades esta receita produz. Usado em receitas base (molhos, caldos, massas).';

-- RLS
CREATE POLICY "ficha_tecnica_select" ON public.ficha_tecnica
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "ficha_tecnica_insert" ON public.ficha_tecnica
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "ficha_tecnica_update" ON public.ficha_tecnica
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "ficha_tecnica_delete" ON public.ficha_tecnica
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.update_ficha_tecnica_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ficha_tecnica_updated_at
    BEFORE UPDATE ON public.ficha_tecnica
    FOR EACH ROW EXECUTE FUNCTION public.update_ficha_tecnica_updated_at();


-- ============================================================
-- TABELA: ficha_tecnica_itens
-- Insumos e quantidades que compõem cada versão da ficha técnica
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ficha_tecnica_itens (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    ficha_tecnica_id    UUID        NOT NULL REFERENCES public.ficha_tecnica(id) ON DELETE CASCADE,
    insumo_id           UUID        NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
    quantidade          NUMERIC     NOT NULL CHECK (quantidade > 0),
    unidade_medida_id   UUID        NOT NULL REFERENCES public.unidades_medida(id),
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Garante que o mesmo insumo não aparece duas vezes na mesma ficha
    CONSTRAINT uq_ficha_tecnica_item UNIQUE (ficha_tecnica_id, insumo_id)
);

ALTER TABLE public.ficha_tecnica_itens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fti_empresa_id       ON public.ficha_tecnica_itens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fti_ficha_id         ON public.ficha_tecnica_itens(ficha_tecnica_id);
CREATE INDEX IF NOT EXISTS idx_fti_insumo_id        ON public.ficha_tecnica_itens(insumo_id);

COMMENT ON TABLE public.ficha_tecnica_itens IS 'Itens da ficha técnica: insumo + quantidade + unidade de medida. empresa_id denormalizado para RLS eficiente.';
COMMENT ON COLUMN public.ficha_tecnica_itens.unidade_medida_id IS 'Unidade de medida usada neste item. Pode diferir da unidade de uso do insumo — conversão aplicada no cálculo.';

-- RLS: valida que a ficha_tecnica_id pertence à mesma empresa
CREATE POLICY "ficha_tecnica_itens_select" ON public.ficha_tecnica_itens
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "ficha_tecnica_itens_insert" ON public.ficha_tecnica_itens
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "ficha_tecnica_itens_update" ON public.ficha_tecnica_itens
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "ficha_tecnica_itens_delete" ON public.ficha_tecnica_itens
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());
