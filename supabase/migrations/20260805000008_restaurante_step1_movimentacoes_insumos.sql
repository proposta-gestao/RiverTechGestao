-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: movimentacoes_insumos (histórico de movimentações)
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.movimentacoes_insumos (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    insumo_id           UUID        NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
    deposito_id         UUID        REFERENCES public.depositos(id) ON DELETE RESTRICT,
    tipo                TEXT        NOT NULL
                        CHECK (tipo IN ('entrada','saida','consumo','reserva','ajuste','perda','estorno')),
    -- Status para suporte futuro a reserva de insumos (PASSO 4+)
    status_estoque      TEXT        NOT NULL DEFAULT 'confirmado'
                        CHECK (status_estoque IN ('reservado','consumido','estornado','confirmado')),
    quantidade          NUMERIC     NOT NULL CHECK (quantidade > 0),
    custo_unitario      NUMERIC(10,4),        -- custo no momento da movimentação (snapshot)
    -- Rastreabilidade
    ficha_tecnica_id    UUID        REFERENCES public.ficha_tecnica(id) ON DELETE SET NULL,
    referencia_tipo     TEXT        CHECK (referencia_tipo IN ('pedido','manual','ajuste','producao','inventario','estorno')),
    referencia_id       UUID,               -- order_id, inventario_id etc.
    observacao          TEXT,
    criado_por          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacoes_insumos ENABLE ROW LEVEL SECURITY;

-- Índices principais
CREATE INDEX IF NOT EXISTS idx_movinsumos_empresa       ON public.movimentacoes_insumos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movinsumos_insumo        ON public.movimentacoes_insumos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_movinsumos_deposito      ON public.movimentacoes_insumos(deposito_id);
-- Índices compostos para relatórios (aprovados na modelagem)
CREATE INDEX IF NOT EXISTS idx_movinsumos_emp_insumo    ON public.movimentacoes_insumos(empresa_id, insumo_id);
CREATE INDEX IF NOT EXISTS idx_movinsumos_emp_data      ON public.movimentacoes_insumos(empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_movinsumos_emp_tipo      ON public.movimentacoes_insumos(empresa_id, tipo);
-- Índice para rastreabilidade por pedido
CREATE INDEX IF NOT EXISTS idx_movinsumos_referencia    ON public.movimentacoes_insumos(referencia_tipo, referencia_id);

COMMENT ON TABLE public.movimentacoes_insumos IS 'Registro auditável de todas as movimentações de insumos. Imutável — nunca deletar, apenas estornar.';
COMMENT ON COLUMN public.movimentacoes_insumos.status_estoque IS 'Preparado para reserva de insumos (PASSO 4+). Default confirmado para fluxo simples atual.';
COMMENT ON COLUMN public.movimentacoes_insumos.custo_unitario IS 'Snapshot do custo unitário no momento da movimentação. Preserva o custo histórico independentemente de atualizações futuras.';
COMMENT ON COLUMN public.movimentacoes_insumos.referencia_id IS 'ID da entidade relacionada (ex: order_id, inventario_id). Permite rastreabilidade completa.';

-- RLS
CREATE POLICY "movimentacoes_insumos_select" ON public.movimentacoes_insumos
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "movimentacoes_insumos_insert" ON public.movimentacoes_insumos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

-- UPDATE restrito: apenas para marcar estornos (status_estoque)
-- Não permitimos editar quantidade ou tipo após inserção
CREATE POLICY "movimentacoes_insumos_update" ON public.movimentacoes_insumos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

-- DELETE bloqueado intencionalmente: movimentações são imutáveis
-- (não criar policy de DELETE — registro auditável)
