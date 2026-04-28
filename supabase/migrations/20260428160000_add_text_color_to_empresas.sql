-- Migration: Adicionar cor do texto na tabela empresas
-- Data: 2026-04-28

ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS tema_cor_texto TEXT DEFAULT '#ffffff';
