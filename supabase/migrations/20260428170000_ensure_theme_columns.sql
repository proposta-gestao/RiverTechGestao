-- Migration: Garantir colunas de tema na tabela empresas
-- Data: 2026-04-28

ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS tema_cor_primaria TEXT DEFAULT '#E5B25D',
ADD COLUMN IF NOT EXISTS tema_cor_botao TEXT DEFAULT '#E5B25D',
ADD COLUMN IF NOT EXISTS tema_cor_texto TEXT DEFAULT '#ffffff';

-- Sincronizar dados existentes se necessário
UPDATE public.empresas 
SET tema_cor_primaria = cor_primaria 
WHERE tema_cor_primaria IS NULL AND cor_primaria IS NOT NULL;
