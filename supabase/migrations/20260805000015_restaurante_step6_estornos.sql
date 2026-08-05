-- ============================================================
-- Módulo Restaurante — PASSO 6
-- Estornos de Estoque (Devolução de Insumos ao Cancelar)
-- Data: 2026-08-05
-- ============================================================

-- 1. Função que realiza o estorno de um pedido cancelado
CREATE OR REPLACE FUNCTION public.realizar_estorno_estoque_pedido(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_movimentacao RECORD;
    v_ja_estornado BOOLEAN;
BEGIN
    -- Verifica se já existe um estorno para este pedido (evitar duplicidade)
    SELECT EXISTS (
        SELECT 1 FROM public.movimentacoes_insumos
        WHERE referencia_tipo = 'estorno' AND referencia_id = p_order_id
    ) INTO v_ja_estornado;

    IF v_ja_estornado THEN
        RETURN;
    END IF;

    -- Busca todas as movimentações de "consumo" atreladas a este pedido
    FOR v_movimentacao IN 
        SELECT *
        FROM public.movimentacoes_insumos
        WHERE referencia_tipo = 'pedido' 
          AND referencia_id = p_order_id
          AND tipo = 'consumo'
          AND status_estoque = 'confirmado'
    LOOP
        -- Insere uma movimentação de estorno que irá somar no estoque (via trg do Passo 3)
        INSERT INTO public.movimentacoes_insumos (
            empresa_id,
            insumo_id,
            deposito_id,
            tipo,
            quantidade,
            custo_unitario,
            referencia_tipo,
            referencia_id,
            observacao
        ) VALUES (
            v_movimentacao.empresa_id,
            v_movimentacao.insumo_id,
            v_movimentacao.deposito_id,
            'estorno',
            v_movimentacao.quantidade,
            v_movimentacao.custo_unitario,
            'estorno',
            p_order_id,
            'Estorno por cancelamento do pedido'
        );

        -- Opcional: Atualiza a movimentação original para indicar que foi estornada
        UPDATE public.movimentacoes_insumos
        SET status_estoque = 'estornado'
        WHERE id = v_movimentacao.id;
    END LOOP;
END;
$$;

-- 2. Atualiza a Trigger existente do Passo 4 para escutar cancelamentos também
CREATE OR REPLACE FUNCTION public.trg_verificar_baixa_estoque_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gatilho TEXT;
BEGIN
    -- Se o status não mudou, não faz nada
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    -- Se for restaurante, executa a lógica
    IF EXISTS (
        SELECT 1 FROM public.empresas
        WHERE id = NEW.empresa_id 
          AND (modulos->>'ficha_tecnica')::boolean = true
    ) THEN
        
        -- LÓGICA DE CANCELAMENTO / ESTORNO (PASSO 6)
        IF NEW.status IN ('cancelled', 'cancelado', 'refunded', 'estornado') THEN
            PERFORM public.realizar_estorno_estoque_pedido(NEW.id);
            RETURN NEW;
        END IF;

        -- LÓGICA DE BAIXA (PASSO 4)
        SELECT baixa_estoque_gatilho INTO v_gatilho
        FROM public.restaurant_config
        WHERE empresa_id = NEW.empresa_id;

        v_gatilho := COALESCE(v_gatilho, 'concluido');
        
        IF (v_gatilho = 'recebido' AND NEW.status IN ('accepted', 'preparing', 'recebido')) OR
           (v_gatilho = 'preparo' AND NEW.status IN ('preparing', 'preparo')) OR
           (v_gatilho = 'entregue' AND NEW.status IN ('delivered', 'entregue')) OR
           (v_gatilho = 'concluido' AND NEW.status IN ('completed', 'concluido')) 
        THEN
            PERFORM public.realizar_baixa_estoque_pedido(NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
-- A trigger em si já está criada no arquivo do passo 4 (trg_baixa_estoque_pedido na tabela orders).
-- Como usamos CREATE OR REPLACE FUNCTION, a alteração entra em vigor instantaneamente.
