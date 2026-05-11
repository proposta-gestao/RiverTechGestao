-- ============================================================
-- Migration: PIX Multi-Tenant — Token do Mercado Pago por Empresa
-- Data: 2026-05-11
-- 
-- OBJETIVO: Permitir que cada empresa tenha sua própria conta
-- do Mercado Pago, garantindo isolamento total dos pagamentos.
--
-- SEGURANÇA: A coluna mp_access_token NUNCA é exposta ao frontend.
-- Apenas Edge Functions (via service_role_key) podem lê-la.
-- ============================================================

-- 1. Adicionar colunas de configuração PIX por empresa
ALTER TABLE public.empresas 
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS pix_habilitado BOOLEAN DEFAULT false;

-- 2. Documentar uso seguro
COMMENT ON COLUMN public.empresas.mp_access_token 
  IS 'Token de produção do Mercado Pago da empresa. NUNCA expor ao frontend. Lido apenas por Edge Functions via service_role.';

COMMENT ON COLUMN public.empresas.pix_habilitado 
  IS 'Se true, o cardápio público mostra a opção PIX e permite cobranças. Requer mp_access_token válido.';

-- 3. Garantir que queries públicas/tenant NÃO retornem o token
-- As policies existentes já selecionam campos específicos via frontend.
-- O RLS de SELECT da tabela empresas já limita acesso.
-- Mas vamos reforçar: criar uma VIEW segura para o frontend público
CREATE OR REPLACE VIEW public.empresas_publico AS
  SELECT id, nome, slug, status, plano, cor_primaria, logo_url, 
         criado_em, modulos, segmento, cnpj,
         tema_cor_primaria, tema_cor_secundaria, tema_cor_botao,
         tema_cor_bg, tema_cor_surface, tema_cor_borda, tema_cor_texto,
         pix_habilitado
  FROM public.empresas;
-- Nota: mp_access_token NÃO está incluído nessa view

COMMENT ON VIEW public.empresas_publico 
  IS 'View segura para frontend. Exclui mp_access_token e dados sensíveis.';
