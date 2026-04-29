-- Migration: Add CNPJ to Empresas
-- Data: 2026-04-28

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cnpj TEXT;
