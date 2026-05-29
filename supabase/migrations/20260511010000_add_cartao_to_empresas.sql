-- ============================================================
-- Migration: Pagamento CartÃ£o e Parcelamento
-- Data: 2026-05-11
-- 
-- OBJETIVO: Permitir que o lojista habilite pagamento via cartÃ£o
-- (Checkout Pro) e controle se permite ou nÃ£o parcelamento.
-- ============================================================

-- 1. Adicionar colunas de configuraÃ§Ã£o de cartÃ£o
ALTER TABLE public.empresas 
  ADD COLUMN IF NOT EXISTS cartao_habilitado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cartao_parcelamento BOOLEAN DEFAULT false;

-- 2. Documentar uso
COMMENT ON COLUMN public.empresas.cartao_habilitado 
  IS 'Se true, exibe a opÃ§Ã£o de CartÃ£o de CrÃ©dito/DÃ©bito via Mercado Pago no checkout.';

COMMENT ON COLUMN public.empresas.cartao_parcelamento 
  IS 'Se true, o cliente pode parcelar a compra no cartÃ£o. Se false, a compra Ã© limitada a 1x (Ã  vista).';

-- 3. Atualizar a View segura para o frontend
CREATE OR REPLACE VIEW public.empresas_publico AS
  SELECT id, nome, slug, status, plano, cor_primaria, logo_url, 
         criado_em, modulos, segmento, cnpj,
         tema_cor_primaria, tema_cor_secundaria, tema_cor_botao,
         tema_cor_bg, tema_cor_surface, tema_cor_borda, tema_cor_texto,
         pix_habilitado, cartao_habilitado
  FROM public.empresas;
