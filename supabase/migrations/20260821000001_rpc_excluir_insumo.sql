-- Migration: RPC para excluir insumo forçado em fase de testes
-- Apaga todas as movimentações, saldos de estoque e itens de ficha técnica vinculados.

CREATE OR REPLACE FUNCTION public.excluir_insumo_teste(p_insumo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Apagar itens de inventário pendentes ou históricos vinculados
    DELETE FROM public.inventarios_insumos_itens
    WHERE insumo_id = p_insumo_id;

    -- 2. Apagar itens de fichas técnicas vinculadas
    DELETE FROM public.ficha_tecnica_itens
    WHERE insumo_id = p_insumo_id;

    -- 3. Apagar movimentações de estoque (historico)
    DELETE FROM public.movimentacoes_insumos
    WHERE insumo_id = p_insumo_id;

    -- 4. Apagar saldos de estoque atuais (embora já seja CASCADE, fazemos explícito por segurança)
    DELETE FROM public.estoque_insumos
    WHERE insumo_id = p_insumo_id;

    -- 5. Apagar o insumo definitivamente
    DELETE FROM public.insumos
    WHERE id = p_insumo_id;

END;
$$;
