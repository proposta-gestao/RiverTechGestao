-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabelas: inventarios_insumos e inventarios_insumos_itens
-- Data: 2026-08-05
-- ============================================================

-- ============================================================
-- TABELA: inventarios_insumos
-- Cabeçalho do inventário físico
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventarios_insumos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    deposito_id     UUID        REFERENCES public.depositos(id) ON DELETE RESTRICT,
    data_inventario DATE        NOT NULL DEFAULT CURRENT_DATE,
    status          TEXT        NOT NULL DEFAULT 'aberto'
                    CHECK (status IN ('aberto','concluido','cancelado')),
    observacao      TEXT,
    criado_por      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluido_em    TIMESTAMPTZ             -- preenchido ao fechar o inventário
);

ALTER TABLE public.inventarios_insumos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inventarios_empresa    ON public.inventarios_insumos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inventarios_deposito   ON public.inventarios_insumos(deposito_id);
CREATE INDEX IF NOT EXISTS idx_inventarios_status     ON public.inventarios_insumos(empresa_id, status);

COMMENT ON TABLE public.inventarios_insumos IS 'Cabeçalho do inventário físico de insumos. Permite inventário por depósito. Status: aberto → concluido/cancelado.';
COMMENT ON COLUMN public.inventarios_insumos.deposito_id IS 'NULL = inventário geral (todos os depósitos). Preenchido = inventário por depósito específico.';

-- RLS
CREATE POLICY "inventarios_insumos_select" ON public.inventarios_insumos
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "inventarios_insumos_insert" ON public.inventarios_insumos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "inventarios_insumos_update" ON public.inventarios_insumos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "inventarios_insumos_delete" ON public.inventarios_insumos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id()
           AND status = 'aberto');  -- só permite deletar inventários ainda abertos


-- ============================================================
-- TABELA: inventarios_insumos_itens
-- Contagem por item dentro de um inventário
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventarios_insumos_itens (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    inventario_id       UUID        NOT NULL REFERENCES public.inventarios_insumos(id) ON DELETE CASCADE,
    insumo_id           UUID        NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
    -- Snapshot do saldo no momento da abertura do inventário
    estoque_sistema     NUMERIC     NOT NULL DEFAULT 0,
    -- Quantidade fisicamente contada
    estoque_contado     NUMERIC     NOT NULL DEFAULT 0,
    -- Diferença calculada automaticamente (estoque_contado - estoque_sistema)
    diferenca           NUMERIC     GENERATED ALWAYS AS (estoque_contado - estoque_sistema) STORED,
    -- Flag: indica se a diferença já foi convertida em movimentação de ajuste
    ajuste_aplicado     BOOLEAN     NOT NULL DEFAULT false,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Garante um item por insumo por inventário
    CONSTRAINT uq_inventario_item UNIQUE (inventario_id, insumo_id)
);

ALTER TABLE public.inventarios_insumos_itens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inventario_itens_inventario ON public.inventarios_insumos_itens(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_itens_insumo     ON public.inventarios_insumos_itens(insumo_id);
CREATE INDEX IF NOT EXISTS idx_inventario_itens_empresa    ON public.inventarios_insumos_itens(empresa_id);

COMMENT ON TABLE public.inventarios_insumos_itens IS 'Itens de contagem do inventário físico. diferenca é calculada automaticamente (GENERATED STORED). ajuste_aplicado rastreia se o ajuste foi propagado para movimentacoes_insumos.';
COMMENT ON COLUMN public.inventarios_insumos_itens.estoque_sistema IS 'Snapshot de estoque_insumos.estoque_atual no momento da abertura do inventário.';
COMMENT ON COLUMN public.inventarios_insumos_itens.ajuste_aplicado IS 'true = diferença já gerou movimentação de ajuste. Previne dupla aplicação.';

-- RLS
CREATE POLICY "inventario_itens_select" ON public.inventarios_insumos_itens
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "inventario_itens_insert" ON public.inventarios_insumos_itens
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "inventario_itens_update" ON public.inventarios_insumos_itens
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

-- DELETE apenas se o inventário está aberto
CREATE POLICY "inventario_itens_delete" ON public.inventarios_insumos_itens
    FOR DELETE TO authenticated
    USING (
        empresa_id = public.get_empresa_id()
        AND EXISTS (
            SELECT 1 FROM public.inventarios_insumos i
            WHERE i.id = inventario_id
              AND i.status = 'aberto'
        )
    );
