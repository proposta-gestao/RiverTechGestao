-- Migration: Corrigir vw_movimentacoes_insumos
-- Problema: a view usava security_invoker=true e fazia JOIN com auth.users,
-- mas o role 'authenticated' não tem permissão para ler auth.users.
-- Solução: DROP + CREATE (necessário pois OR REPLACE não permite renomear colunas),
-- removendo o JOIN com auth.users e mantendo o alias 'data' para compatibilidade com JS.

DROP VIEW IF EXISTS public.vw_movimentacoes_insumos;

CREATE VIEW public.vw_movimentacoes_insumos
WITH (security_invoker = true)
AS
SELECT
    m.id,
    m.empresa_id,
    m.insumo_id,
    i.nome                                              AS insumo_nome,
    i.codigo_interno,
    m.deposito_id,
    d.nome                                              AS deposito_nome,
    m.tipo,
    m.status_estoque,
    m.quantidade,
    m.custo_unitario,
    (m.quantidade * COALESCE(m.custo_unitario, 0))      AS custo_total,
    m.referencia_tipo,
    m.referencia_id,
    m.observacao,
    m.ficha_tecnica_id,
    m.criado_por,
    -- Mantido alias 'data' para compatibilidade com o frontend (order('data'))
    -- Removido: LEFT JOIN auth.users — role 'authenticated' não tem permissão
    m.criado_em                                         AS data,
    u.simbolo                                           AS unidade_simbolo,
    u.nome                                              AS unidade_nome
FROM public.movimentacoes_insumos m
JOIN public.insumos i ON i.id = m.insumo_id
LEFT JOIN public.unidades_medida u ON u.id = i.unidade_medida_id
LEFT JOIN public.depositos d ON d.id = m.deposito_id
ORDER BY m.criado_em DESC;
