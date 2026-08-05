-- ============================================================
-- Módulo Restaurante — PASSO 1
-- ALTER TABLE products: campos de custo e margem
-- Data: 2026-08-05
-- ============================================================

-- Adiciona campos de custo de produção e margem percentual à tabela products
-- Ambos nullable: sem impacto em empresas que não usam ficha técnica
-- Atualização automática virá no PASSO 2 (trigger de recálculo)

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS custo_producao    NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS margem_percentual NUMERIC(8,4);

COMMENT ON COLUMN public.products.custo_producao IS '[Restaurante] Custo de produção calculado com base na ficha técnica ativa. Atualizado automaticamente (PASSO 2). NULL = sem ficha técnica ou módulo inativo.';
COMMENT ON COLUMN public.products.margem_percentual IS '[Restaurante] Margem percentual = ((price - custo_producao) / price) * 100. Atualizado automaticamente (PASSO 2). NULL = sem ficha técnica ou módulo inativo.';
