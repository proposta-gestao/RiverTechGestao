-- Migration: Ajustar unicidade de atendentes por empresa e seguranÃ§a
-- Data: 2026-05-12

-- 1. Remover a restriÃ§Ã£o de unicidade global do CPF
ALTER TABLE public.atendentes DROP CONSTRAINT IF EXISTS atendentes_cpf_key;

-- 2. Adicionar restriÃ§Ã£o de unicidade composta (empresa_id, cpf)
-- Isso permite que o mesmo atendente (CPF) possa estar em mÃºltiplas empresas (multi-tenant)
ALTER TABLE public.atendentes ADD CONSTRAINT atendentes_empresa_cpf_key UNIQUE (empresa_id, cpf);

-- 3. Adicionar coluna para indicar se a senha jÃ¡ estÃ¡ em hash (opcional, para transiÃ§Ã£o)
ALTER TABLE public.atendentes ADD COLUMN IF NOT EXISTS senha_hash BOOLEAN DEFAULT false;

-- 4. Notificar recarregamento do schema
NOTIFY pgrst, 'reload schema';
