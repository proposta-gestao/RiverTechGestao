-- Migration: Controle de Vencimento de Plano
-- Data: 2026-04-28

ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS plano_vencimento DATE;

COMMENT ON COLUMN public.empresas.plano_vencimento IS 'Data em que o plano da empresa expira';
