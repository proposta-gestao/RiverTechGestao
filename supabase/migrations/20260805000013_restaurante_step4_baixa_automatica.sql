-- ============================================================
-- Módulo Restaurante — PASSO 4
-- Baixa Automática de Estoque (Postgres Trigger)
-- Data: 2026-08-05
-- ============================================================

-- 1. Função que realiza a baixa (consumo) baseada na ficha técnica de um pedido
CREATE OR REPLACE FUNCTION public.realizar_baixa_estoque_pedido(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id UUID;
    v_item RECORD;
    v_insumo RECORD;
    v_deposito_id UUID;
    v_qtd_consumir NUMERIC;
    v_ja_baixado BOOLEAN;
BEGIN
    -- Verifica se já houve baixa para este pedido (evitar duplicidade)
    SELECT EXISTS (
        SELECT 1 FROM public.movimentacoes_insumos
        WHERE referencia_tipo = 'pedido' AND referencia_id = p_order_id
    ) INTO v_ja_baixado;

    IF v_ja_baixado THEN
        RETURN; -- Já processado
    END IF;

    -- Pega o empresa_id do pedido
    SELECT empresa_id INTO v_empresa_id
    FROM public.orders
    WHERE id = p_order_id;

    -- Loop nos itens do pedido
    FOR v_item IN 
        SELECT product_id, quantity 
        FROM public.order_items 
        WHERE order_id = p_order_id
    LOOP
        -- Loop nos insumos da ficha técnica ativa deste produto
        FOR v_insumo IN
            SELECT 
                fti.insumo_id, 
                fti.quantidade AS qtd_por_unidade,
                i.custo_medio
            FROM public.ficha_tecnica ft
            JOIN public.ficha_tecnica_itens fti ON fti.ficha_tecnica_id = ft.id
            JOIN public.insumos i ON i.id = fti.insumo_id
            WHERE ft.product_id = v_item.product_id
              AND ft.ativo = true
        LOOP
            v_qtd_consumir := v_insumo.qtd_por_unidade * v_item.quantity;

            -- Descobre o melhor depósito para tirar (o que tem mais estoque)
            SELECT deposito_id INTO v_deposito_id
            FROM public.estoque_insumos
            WHERE insumo_id = v_insumo.insumo_id
            ORDER BY estoque_atual DESC
            LIMIT 1;

            -- Se não achou nenhum depósito com estoque, pega o primeiro da empresa
            IF v_deposito_id IS NULL THEN
                SELECT id INTO v_deposito_id
                FROM public.depositos
                WHERE empresa_id = v_empresa_id AND ativo = true
                ORDER BY tipo = 'cozinha' DESC, id
                LIMIT 1;
            END IF;

            -- Insere a movimentação de consumo
            -- A trigger trg_processar_movimentacao_insumo (criada no passo 3) 
            -- fará o débito automático no estoque_insumos
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
                v_empresa_id,
                v_insumo.insumo_id,
                v_deposito_id,
                'consumo',
                v_qtd_consumir,
                v_insumo.custo_medio,
                'pedido',
                p_order_id,
                'Baixa automática do pedido'
            );
        END LOOP;
    END LOOP;
END;
$$;

-- 2. Trigger Function: Observa mudanças de status no pedido
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

    -- Tenta pegar a configuração de gatilho do restaurante
    SELECT baixa_estoque_gatilho INTO v_gatilho
    FROM public.restaurant_config
    WHERE empresa_id = NEW.empresa_id;

    -- Se não tiver configurado ou não for módulo restaurante, v_gatilho será NULL.
    -- O padrão caso seja restaurante e esteja NULL é 'concluido'.
    -- Mas precisamos garantir que a empresa TEM o módulo ativo.
    -- Verificamos no jsonb de modulos se ficha_tecnica = true.
    IF EXISTS (
        SELECT 1 FROM public.empresas
        WHERE id = NEW.empresa_id 
          AND (modulos->>'ficha_tecnica')::boolean = true
    ) THEN
        v_gatilho := COALESCE(v_gatilho, 'concluido');
        
        -- Mapeamento de status do pedido para o gatilho:
        -- gatilho 'recebido' -> status pode ser 'recebido' ou 'preparando' (dependendo do fluxo da loja)
        -- Vamos simplificar: se o status novo for IGUAL ao gatilho, ou se o gatilho for 'recebido' e o status 'novo'.
        
        -- Tradução básica de status (os status reais de orders dependem do sistema, 
        -- ex: pending, accepted, preparing, ready, dispatched, delivered, completed)
        -- Aqui adaptamos para os status mais comuns do order.status:
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

-- 3. Aplica a trigger na tabela orders
DROP TRIGGER IF EXISTS trg_baixa_estoque_pedido ON public.orders;
CREATE TRIGGER trg_baixa_estoque_pedido
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_verificar_baixa_estoque_pedido();
