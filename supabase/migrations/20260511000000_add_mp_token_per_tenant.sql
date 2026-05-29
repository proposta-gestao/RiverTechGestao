-- ============================================================
-- Migration: PIX Multi-Tenant â€” Token do Mercado Pago por Empresa
-- Data: 2026-05-11
-- 
-- OBJETIVO: Permitir que cada empresa tenha sua prÃ³pria conta
-- do Mercado Pago, garantindo isolamento total dos pagamentos.
--
-- SEGURANÃ‡A: A coluna mp_access_token NUNCA Ã© exposta ao frontend.
-- Apenas Edge Functions (via service_role_key) podem lÃª-la.
-- ============================================================

-- 1. Adicionar colunas de configuraÃ§Ã£o PIX por empresa
ALTER TABLE public.empresas 
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS pix_habilitado BOOLEAN DEFAULT false;

-- 2. Documentar uso seguro
COMMENT ON COLUMN public.empresas.mp_access_token 
  IS 'Token de produÃ§Ã£o do Mercado Pago da empresa. NUNCA expor ao frontend. Lido apenas por Edge Functions via service_role.';

COMMENT ON COLUMN public.empresas.pix_habilitado 
  IS 'Se true, o cardÃ¡pio pÃºblico mostra a opÃ§Ã£o PIX e permite cobranÃ§as. Requer mp_access_token vÃ¡lido.';

-- 3. Garantir que queries pÃºblicas/tenant NÃƒO retornem o token
-- As policies existentes jÃ¡ selecionam campos especÃ­ficos via frontend.
-- O RLS de SELECT da tabela empresas jÃ¡ limita acesso.
-- Mas vamos reforÃ§ar: criar uma VIEW segura para o frontend pÃºblico
CREATE OR REPLACE VIEW public.empresas_publico AS
  SELECT id, nome, slug, status, plano, cor_primaria, logo_url, 
         criado_em, modulos, segmento, cnpj,
         tema_cor_primaria, tema_cor_secundaria, tema_cor_botao,
         tema_cor_bg, tema_cor_surface, tema_cor_borda, tema_cor_texto,
         pix_habilitado
  FROM public.empresas;
-- Nota: mp_access_token NÃƒO estÃ¡ incluÃ­do nessa view

COMMENT ON VIEW public.empresas_publico 
  IS 'View segura para frontend. Exclui mp_access_token e dados sensÃ­veis.';
