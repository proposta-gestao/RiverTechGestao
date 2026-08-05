-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: insumos (cadastro de ingredientes/matérias-primas)
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.insumos (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id              UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome                    TEXT        NOT NULL,
    categoria_id            UUID        REFERENCES public.categorias_insumos(id) ON DELETE SET NULL,
    fornecedor_id           UUID        REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    -- Unidade de uso (utilizada nas fichas técnicas)
    unidade_medida_id       UUID        NOT NULL REFERENCES public.unidades_medida(id),
    -- Unidade de compra (pode diferir da unidade de uso — ex: compra kg, usa g)
    unidade_compra_id       UUID        REFERENCES public.unidades_medida(id),
    quantidade_por_embalagem NUMERIC,   -- Ex: caixa de refrigerante = 24 unidades
    -- Custo
    custo_medio             NUMERIC(10,4) NOT NULL DEFAULT 0, -- custo médio por unidade de uso
    codigo_interno          TEXT,       -- código interno opcional
    -- Flags de controle futuro (sem impacto operacional agora)
    controla_lote           BOOLEAN     NOT NULL DEFAULT false,
    controla_validade       BOOLEAN     NOT NULL DEFAULT false,
    ativo                   BOOLEAN     NOT NULL DEFAULT true,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_insumos_empresa_id         ON public.insumos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_insumos_empresa_ativo      ON public.insumos(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria          ON public.insumos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_insumos_fornecedor         ON public.insumos(fornecedor_id);

COMMENT ON TABLE public.insumos IS 'Cadastro de insumos (ingredientes, bebidas, embalagens, matérias-primas). Exclusivo do segmento Restaurante.';
COMMENT ON COLUMN public.insumos.custo_medio IS 'Custo médio por unidade de uso (unidade_medida_id). Atualizado via entrada de estoque ou ajuste manual.';
COMMENT ON COLUMN public.insumos.quantidade_por_embalagem IS 'Quantidade de unidades de uso por embalagem de compra. Ex: cx de refrigerante = 24 un.';
COMMENT ON COLUMN public.insumos.controla_lote IS 'Flag para controle futuro de lotes. Não impacta operação atual.';
COMMENT ON COLUMN public.insumos.controla_validade IS 'Flag para controle futuro de validade. Não impacta operação atual.';

-- RLS
CREATE POLICY "insumos_select" ON public.insumos
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "insumos_insert" ON public.insumos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "insumos_update" ON public.insumos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "insumos_delete" ON public.insumos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.update_insumos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_insumos_updated_at
    BEFORE UPDATE ON public.insumos
    FOR EACH ROW EXECUTE FUNCTION public.update_insumos_updated_at();
