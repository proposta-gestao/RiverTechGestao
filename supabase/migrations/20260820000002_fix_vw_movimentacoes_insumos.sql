-- Migration: Corrigir vw_movimentacoes_insumos
-- Problema: a view usava security_invoker=true e fazia JOIN com auth.users,
-- mas o role 'authenticated' não tem permissão para ler auth.users.
-- Solução: remover o JOIN com auth.users e expor apenas m.criado_por (UUID).
-- Isso mantém a segurança e elimina o erro "permission denied for table users".

CREATE OR REPLACE VIEW public.vw_movimentacoes_insumos
WITH (security_invoker = true)
AS
SELECT
    m.id,
    m.empresa_id,
    m.insumo_id,
    i.nome AS insumo_nome,
    i.codigo_interno,
    m.deposito_id,
    d.nome AS deposito_nome,
    m.tipo,
    m.status_estoque,
    m.quantidade,
    m.custo_unitario,
    (m.quantidade * COALESCE(m.custo_unitario, 0)) AS custo_total,
    m.referencia_tipo,
    m.referencia_id,
    m.observacao,
    m.ficha_tecnica_id,
    m.criado_por,
    -- Removido: LEFT JOIN auth.users — role 'authenticated' não tem permissão
    -- Use m.criado_por (UUID) para identificar o usuário se necessário
    m.criado_em,
    u.simbolo AS unidade_simbolo,
    u.nome AS unidade_nome
FROM public.movimentacoes_insumos m
JOIN public.insumos i ON i.id = m.insumo_id
LEFT JOIN public.unidades_medida u ON u.id = i.unidade_medida_id
LEFT JOIN public.depositos d ON d.id = m.deposito_id
ORDER BY m.criado_em DESC;
