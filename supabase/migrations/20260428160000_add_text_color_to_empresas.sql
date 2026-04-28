-- Migration: Adicionar cores de texto e fundo na tabela empresas
-- Data: 2026-04-28

ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS tema_cor_texto TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS tema_cor_bg TEXT DEFAULT '#0d0d0d',
ADD COLUMN IF NOT EXISTS tema_cor_surface TEXT DEFAULT '#1a1a1a';
