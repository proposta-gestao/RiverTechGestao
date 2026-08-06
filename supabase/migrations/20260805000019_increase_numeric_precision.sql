-- ============================================================
-- Correção de Precisão Numérica para Custos (Evita numeric field overflow)
-- ============================================================

-- Alterar custo_medio em public.insumos para maior precisão (15,4)
-- Permite custos maiores sem estourar o limite de dígitos
ALTER TABLE public.insumos 
    ALTER COLUMN custo_medio TYPE NUMERIC(15,4);

-- Alterar custo_calculado em public.ficha_tecnica
ALTER TABLE public.ficha_tecnica 
    ALTER COLUMN custo_calculado TYPE NUMERIC(15,4);

-- Alterar custo_producao em public.products
ALTER TABLE public.products 
    ALTER COLUMN custo_producao TYPE NUMERIC(15,4);

-- Re-criar a função de recalculo para garantir consistência de variáveis (caso necessário, embora o PG faça cast automático)
CREATE OR REPLACE FUNCTION public.recalcular_custo_ficha_tecnica(p_ficha_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_custo_total NUMERIC(15,4);
    v_produto_id UUID;
    v_ativo BOOLEAN;
    v_preco_produto NUMERIC(10,2);
END;
$$;

-- Nota: Como o corpo da função recalcular_custo_ficha_tecnica já foi criado e as assinaturas batem,
-- vamos apenas atualizar a declaração interna de v_custo_total para NUMERIC(15,4).
-- Para garantir o recadastro correto da função inteira:
CREATE OR REPLACE FUNCTION public.recalcular_custo_ficha_tecnica(p_ficha_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_custo_total NUMERIC(15,4);
    v_produto_id UUID;
    v_ativo BOOLEAN;
    v_preco_produto NUMERIC(10,2);
BEGIN
    -- Calcula o custo total somando (quantidade * custo_medio) dos itens
    SELECT COALESCE(SUM(fti.quantidade * i.custo_medio), 0)
    INTO v_custo_total
    FROM public.ficha_tecnica_itens fti
    JOIN public.insumos i ON i.id = fti.insumo_id
    WHERE fti.ficha_tecnica_id = p_ficha_id;

    -- Atualiza a ficha técnica
    UPDATE public.ficha_tecnica
    SET custo_calculado = v_custo_total
    WHERE id = p_ficha_id
    RETURNING product_id, ativo INTO v_produto_id, v_ativo;

    -- Se a ficha estiver ativa, propaga o custo para o produto
    IF v_ativo AND v_produto_id IS NOT NULL THEN
        SELECT price INTO v_preco_produto
        FROM public.products
        WHERE id = v_produto_id;

        IF v_preco_produto > 0 THEN
            UPDATE public.products
            SET custo_producao = v_custo_total,
                margem_percentual = ((v_preco_produto - v_custo_total) / v_preco_produto) * 100
            WHERE id = v_produto_id;
        ELSE
            UPDATE public.products
            SET custo_producao = v_custo_total,
                margem_percentual = 0
            WHERE id = v_produto_id;
        END IF;
    END IF;
END;
$$;
