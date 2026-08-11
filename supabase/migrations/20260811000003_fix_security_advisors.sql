-- ============================================================
-- FIX: Security Advisors (Supabase)
-- Data: 2026-08-11
--
-- 1. auth_users_exposed: A view vw_movimentacoes_insumos
-- faz JOIN com auth.users no schema public, o que expõe dados.
-- Correção: Recriar a view com security_invoker = true.
--
-- 2. rls_disabled_in_public: A tabela unidades_medida estava
-- sem RLS, o que permite inserts/updates/deletes não autorizados.
-- Correção: Habilitar RLS e criar política de leitura pública.
-- ============================================================

-- 1. Fix auth_users_exposed
-- Re-cria a view garantindo que o PostgreSQL a execute com
-- as permissões do usuário que está chamando (invoker)
-- ao invés de usar o criador da view (definer).
CREATE OR REPLACE VIEW public.vw_movimentacoes_insumos
WITH (security_invoker = true)
AS
SELECT 
    m.id,
    m.empresa_id,
    m.criado_em as data,
    i.nome as insumo_nome,
    u.simbolo as unidade,
    d.nome as deposito_nome,
    m.tipo,
    m.quantidade,
    m.custo_unitario,
    m.referencia_tipo,
    m.observacao,
    au.email as usuario
FROM public.movimentacoes_insumos m
JOIN public.insumos i ON i.id = m.insumo_id
LEFT JOIN public.unidades_medida u ON u.id = i.unidade_medida_id
LEFT JOIN public.depositos d ON d.id = m.deposito_id
LEFT JOIN auth.users au ON au.id = m.criado_por
ORDER BY m.criado_em DESC;

-- 2. Fix rls_disabled_in_public
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer um pode ler unidades_medida" ON public.unidades_medida;
CREATE POLICY "Qualquer um pode ler unidades_medida"
ON public.unidades_medida
FOR SELECT
USING (true);
