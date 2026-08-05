-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: estoque_insumos (saldo por insumo × depósito)
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.estoque_insumos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    insumo_id       UUID        NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    deposito_id     UUID        NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
    estoque_atual   NUMERIC     NOT NULL DEFAULT 0,
    estoque_minimo  NUMERIC     NOT NULL DEFAULT 0,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Garante que cada insumo aparece apenas uma vez por depósito por empresa
    CONSTRAINT uq_estoque_insumos UNIQUE (empresa_id, insumo_id, deposito_id)
);

ALTER TABLE public.estoque_insumos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_estoque_insumos_empresa    ON public.estoque_insumos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_estoque_insumos_insumo     ON public.estoque_insumos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_estoque_insumos_deposito   ON public.estoque_insumos(deposito_id);
CREATE INDEX IF NOT EXISTS idx_estoque_insumos_emp_ins    ON public.estoque_insumos(empresa_id, insumo_id);

COMMENT ON TABLE public.estoque_insumos IS 'Saldo de estoque por insumo e depósito. Permite o mesmo insumo em múltiplos depósitos. Separado do cadastro do insumo para escalabilidade.';
COMMENT ON COLUMN public.estoque_insumos.estoque_atual IS 'Saldo atual deste insumo neste depósito. Atualizado via trigger em movimentacoes_insumos (PASSO 3).';
COMMENT ON COLUMN public.estoque_insumos.estoque_minimo IS 'Estoque mínimo específico para este depósito. Usado para alertas e relatório de necessidade de compras.';

-- RLS
CREATE POLICY "estoque_insumos_select" ON public.estoque_insumos
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "estoque_insumos_insert" ON public.estoque_insumos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "estoque_insumos_update" ON public.estoque_insumos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "estoque_insumos_delete" ON public.estoque_insumos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());
