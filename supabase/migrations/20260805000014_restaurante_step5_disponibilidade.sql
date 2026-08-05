-- ============================================================
-- Módulo Restaurante — PASSO 5
-- Validação de Disponibilidade e Produção Possível
-- Data: 2026-08-05
-- ============================================================

-- 1. Função que calcula a quantidade máxima possível a ser produzida de um produto
-- Baseado no estoque global de seus insumos.
CREATE OR REPLACE FUNCTION public.restaurante_calcular_producao_maxima(p_product_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_producao INTEGER := NULL;
    v_qtd_possivel INTEGER;
    v_insumo RECORD;
    v_tem_ficha BOOLEAN := false;
BEGIN
    -- Verifica se tem ficha técnica ativa
    FOR v_insumo IN 
        SELECT 
            fti.insumo_id, 
            fti.quantidade AS qtd_necessaria,
            COALESCE((
                SELECT SUM(estoque_atual) 
                FROM public.estoque_insumos 
                WHERE insumo_id = fti.insumo_id
            ), 0) AS estoque_disponivel
        FROM public.ficha_tecnica ft
        JOIN public.ficha_tecnica_itens fti ON fti.ficha_tecnica_id = ft.id
        WHERE ft.product_id = p_product_id AND ft.ativo = true
    LOOP
        v_tem_ficha := true;
        
        -- Se precisa de 0 (algo errado na modelagem), ignora
        IF v_insumo.qtd_necessaria <= 0 THEN
            CONTINUE;
        END IF;

        -- Calcula quantos itens podemos fazer com o estoque deste insumo
        v_qtd_possivel := TRUNC(v_insumo.estoque_disponivel / v_insumo.qtd_necessaria);

        -- Se for negativo, significa que já não tem estoque
        IF v_qtd_possivel < 0 THEN
            v_qtd_possivel := 0;
        END IF;

        -- Guarda o menor valor encontrado (o gargalo)
        IF v_max_producao IS NULL OR v_qtd_possivel < v_max_producao THEN
            v_max_producao := v_qtd_possivel;
        END IF;
    END LOOP;

    -- Se não tem ficha técnica, consideramos produção infinita (retorna NULL)
    IF NOT v_tem_ficha THEN
        RETURN NULL;
    END IF;

    -- Se tem ficha mas v_max_producao continua NULL, algo falhou, retorna 0
    RETURN COALESCE(v_max_producao, 0);
END;
$$;


-- 2. Função RPC para o frontend validar um carrinho de compras inteiro
-- Parâmetro: JSONB no formato [{'product_id': 'uuid', 'quantity': 2, 'nome': 'Hamburguer'}]
-- Retorna: JSONB com status da validação e lista de itens bloqueados
CREATE OR REPLACE FUNCTION public.restaurante_validar_carrinho(p_empresa_id UUID, p_carrinho JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bloquear BOOLEAN;
    v_item JSONB;
    v_product_id UUID;
    v_qtd_solicitada INTEGER;
    v_nome_produto TEXT;
    
    -- Agrupamento do que precisa ser consumido no total do carrinho
    -- Para não aprovar 2 produtos diferentes que usam o MESMO insumo se não houver insumo para ambos
    v_insumo_necessidade RECORD;
    v_estoque_disponivel NUMERIC;
    
    v_erros JSONB := '[]'::jsonb;
BEGIN
    -- Verifica a configuração da empresa
    SELECT bloquear_sem_estoque INTO v_bloquear
    FROM public.restaurant_config
    WHERE empresa_id = p_empresa_id;

    -- Se não bloqueia sem estoque, a validação sempre passa (mas podemos retornar avisos futuramente se desejado)
    IF COALESCE(v_bloquear, false) = false THEN
        RETURN jsonb_build_object('valido', true, 'erros', v_erros);
    END IF;

    -- Cria uma tabela temporária para consolidar a necessidade de cada insumo
    CREATE TEMP TABLE IF NOT EXISTS tmp_necessidade_insumos (
        insumo_id UUID,
        insumo_nome TEXT,
        qtd_total NUMERIC
    ) ON COMMIT DROP;
    
    TRUNCATE tmp_necessidade_insumos;

    -- Varre o carrinho e soma as necessidades
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_carrinho)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qtd_solicitada := (v_item->>'quantity')::INTEGER;
        v_nome_produto := v_item->>'nome';

        -- Busca os insumos da ficha deste produto e insere/atualiza na temp table
        INSERT INTO tmp_necessidade_insumos (insumo_id, insumo_nome, qtd_total)
        SELECT 
            i.id, 
            i.nome, 
            (fti.quantidade * v_qtd_solicitada)
        FROM public.ficha_tecnica ft
        JOIN public.ficha_tecnica_itens fti ON fti.ficha_tecnica_id = ft.id
        JOIN public.insumos i ON i.id = fti.insumo_id
        WHERE ft.product_id = v_product_id AND ft.ativo = true
        
        -- Em vez de upsert nativo em temp table sem pk (pode ser chato), faremos insert.
        -- O agrupamento é feito no SELECT final.
        ;
    END LOOP;

    -- Verifica as necessidades totais agrupadas contra o estoque atual
    FOR v_insumo_necessidade IN 
        SELECT 
            insumo_id, 
            MAX(insumo_nome) as insumo_nome, 
            SUM(qtd_total) as qtd_total
        FROM tmp_necessidade_insumos
        GROUP BY insumo_id
    LOOP
        -- Pega o estoque total do insumo na empresa
        SELECT COALESCE(SUM(estoque_atual), 0)
        INTO v_estoque_disponivel
        FROM public.estoque_insumos
        WHERE insumo_id = v_insumo_necessidade.insumo_id;

        -- Se faltar, adiciona à lista de erros
        IF v_estoque_disponivel < v_insumo_necessidade.qtd_total THEN
            v_erros := v_erros || jsonb_build_object(
                'insumo_id', v_insumo_necessidade.insumo_id,
                'insumo_nome', v_insumo_necessidade.insumo_nome,
                'qtd_necessaria', v_insumo_necessidade.qtd_total,
                'qtd_disponivel', v_estoque_disponivel,
                'mensagem', 'Estoque insuficiente de ' || v_insumo_necessidade.insumo_nome
            );
        END IF;
    END LOOP;

    -- Limpa
    DROP TABLE IF EXISTS tmp_necessidade_insumos;

    IF jsonb_array_length(v_erros) > 0 THEN
        RETURN jsonb_build_object('valido', false, 'erros', v_erros);
    END IF;

    RETURN jsonb_build_object('valido', true, 'erros', v_erros);
END;
$$;
