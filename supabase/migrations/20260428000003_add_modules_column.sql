-- Migration: Sistema de Módulos (Feature Flags)
-- Data: 2026-04-28

ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS modulos JSONB DEFAULT '{
  "cardapio": true,
  "frete": true,
  "dashboard": true,
  "pagamento": true,
  "estoque": true,
  "relatorios": true
}'::jsonb;

COMMENT ON COLUMN public.empresas.modulos IS 'Controle de funcionalidades ativas por empresa';
