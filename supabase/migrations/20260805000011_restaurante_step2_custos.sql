-- ============================================================
-- Módulo Restaurante — PASSO 2
-- Stored Procedures e Triggers para Cálculo de Custo
-- Data: 2026-08-05
-- ============================================================

-- 1. Função para recalcular o custo de uma ficha técnica específica
CREATE OR REPLACE FUNCTION public.recalcular_custo_ficha_tecnica(p_ficha_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_custo_total NUMERIC(10,4);
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

-- 2. Trigger Function: Quando o custo_medio de um insumo muda
CREATE OR REPLACE FUNCTION public.trigger_atualizar_custo_insumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Se o custo médio mudou
    IF NEW.custo_medio IS DISTINCT FROM OLD.custo_medio THEN
        -- Encontra todas as fichas técnicas ativas que utilizam este insumo
        FOR r IN 
            SELECT DISTINCT fti.ficha_tecnica_id 
            FROM public.ficha_tecnica_itens fti
            JOIN public.ficha_tecnica ft ON ft.id = fti.ficha_tecnica_id
            WHERE fti.insumo_id = NEW.id AND ft.ativo = true
        LOOP
            -- Recalcula cada ficha técnica
            PERFORM public.recalcular_custo_ficha_tecnica(r.ficha_tecnica_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Trigger: Cria o gatilho na tabela insumos
DROP TRIGGER IF EXISTS trg_atualizar_custo_insumo ON public.insumos;
CREATE TRIGGER trg_atualizar_custo_insumo
    AFTER UPDATE OF custo_medio ON public.insumos
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_atualizar_custo_insumo();


-- 4. Trigger Function: Quando o preço de um produto muda (para atualizar a margem_percentual)
CREATE OR REPLACE FUNCTION public.trigger_atualizar_margem_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.price IS DISTINCT FROM OLD.price AND NEW.custo_producao IS NOT NULL THEN
        IF NEW.price > 0 THEN
            NEW.margem_percentual := ((NEW.price - NEW.custo_producao) / NEW.price) * 100;
        ELSE
            NEW.margem_percentual := 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 5. Trigger: Cria o gatilho na tabela products
DROP TRIGGER IF EXISTS trg_atualizar_margem_produto ON public.products;
CREATE TRIGGER trg_atualizar_margem_produto
    BEFORE UPDATE OF price ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_atualizar_margem_produto();
