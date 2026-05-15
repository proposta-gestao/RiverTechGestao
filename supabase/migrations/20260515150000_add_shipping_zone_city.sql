-- Adicionar coluna de cidade à tabela de zonas de entrega para validação exata no checkout
ALTER TABLE public.shipping_zones 
ADD COLUMN IF NOT EXISTS cidade TEXT;
