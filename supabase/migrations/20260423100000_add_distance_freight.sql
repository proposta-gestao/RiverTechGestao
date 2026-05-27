-- ============================================================
-- Migration: Frete por DistÃ¢ncia (KM) + GeolocalizaÃ§Ã£o
-- ============================================================

-- 1. Adicionar campos de latitude e longitude na store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS address_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS address_lng NUMERIC;

-- 2. Atualizar shipping_zones para usar faixas de KM
-- Criamos novas colunas e mantemos as antigas apenas por precauÃ§Ã£o durante a transiÃ§Ã£o
ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS min_km NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_km NUMERIC NOT NULL DEFAULT 0;

-- 3. Garantir que a tabela store_settings tem a polÃ­tica RLS correta para leitura
-- (Geralmente jÃ¡ tem, mas garantimos aqui)
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_settings' AND policyname = 'Public read settings'
  ) THEN
    CREATE POLICY "Public read settings" ON public.store_settings
    FOR SELECT USING (true);
  END IF;
END $$;
