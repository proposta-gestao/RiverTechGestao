-- ============================================================
-- Migração: Adicionar suporte a observações em loja_produtos
-- Data: 2026-08-07
-- ============================================================

ALTER TABLE public.loja_produtos
    ADD COLUMN IF NOT EXISTS permite_observacao BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS observacao_placeholder TEXT;
