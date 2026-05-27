-- ============================================================
-- Migration: Corrigir Leitura PÃºblica de Empresas e Ativar Loja
-- Data: 2026-05-05
-- ============================================================

-- 1. Permitir leitura de informaÃ§Ãµes pÃºblicas das empresas
-- Essencial para o tenant.js funcionar em pÃ¡ginas pÃºblicas (cardÃ¡pio, loja, agendamento)
CREATE POLICY "Empresas - Leitura Publica Anon"
  ON public.empresas FOR SELECT TO anon
  USING (true);

-- 2. Ativar mÃ³dulo de loja de roupas para a empresa de teste local
UPDATE public.empresas 
SET modulos = COALESCE(modulos, '{}'::jsonb) || '{"loja_roupas": true}'::jsonb 
WHERE slug = 'TesteRiverTech';
