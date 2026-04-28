-- Migration: Garantir unicidade de empresa_id na store_settings para UPSERT
-- Data: 2026-04-28

-- 1. Remover possíveis duplicatas (mantendo apenas a mais recente por empresa)
DELETE FROM public.store_settings a
USING public.store_settings b
WHERE a.id < b.id 
  AND a.empresa_id = b.empresa_id;

-- 2. Adicionar restrição de unicidade
ALTER TABLE public.store_settings 
ADD CONSTRAINT store_settings_empresa_id_key UNIQUE (empresa_id);
