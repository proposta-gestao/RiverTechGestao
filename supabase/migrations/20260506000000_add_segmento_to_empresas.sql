-- Migration: Add Segmento to Empresas
-- Data: 2026-05-05

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS segmento TEXT;

-- Força a atualização do cache do Supabase API
NOTIFY pgrst, 'reload schema';
