-- ============================================================
-- Migration: Unicidade de Tamanhos por Empresa
-- Data: 2026-08-27
-- ============================================================

-- Garante que cada empresa tenha nomes de tamanhos únicos (sem diferenciar maiúsculas/minúsculas e espaços)
CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_tamanhos_empresa_nome_unique 
  ON public.loja_tamanhos (empresa_id, lower(trim(nome)));
