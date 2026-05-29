-- Adicionar coluna de cidade Ã  tabela de zonas de entrega para validaÃ§Ã£o exata no checkout
ALTER TABLE public.shipping_zones 
ADD COLUMN IF NOT EXISTS cidade TEXT;
