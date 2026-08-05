-- ============================================================
-- Módulo Restaurante — PASSO 3
-- Movimentações de Estoque (Trigger e Histórico)
-- Data: 2026-08-05
-- ============================================================

-- 1. Cria a trigger function para atualizar estoque_insumos ao inserir movimentacao
CREATE OR REPLACE FUNCTION public.trg_processar_movimentacao_insumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fator INTEGER := 1;
    v_estoque_anterior NUMERIC := 0;
    v_custo_anterior NUMERIC(10,4) := 0;
    v_novo_estoque NUMERIC := 0;
    v_novo_custo NUMERIC(10,4) := 0;
BEGIN
    -- 1. Define o fator de soma ou subtração
    -- 'entrada', 'estorno' somam.
    -- 'saida', 'consumo', 'perda', 'reserva' subtraem.
    IF NEW.tipo IN ('saida', 'consumo', 'perda', 'reserva') THEN
        v_fator := -1;
    ELSIF NEW.tipo IN ('entrada', 'estorno') THEN
        v_fator := 1;
    ELSIF NEW.tipo = 'ajuste' THEN
        -- Se por acaso tipo='ajuste', vamos assumir que é entrada, mas é recomendado
        -- usar tipo='entrada' ou 'saida' com referencia_tipo='ajuste'.
        v_fator := 1;
    END IF;

    -- 2. Atualiza ou insere saldo no depósito correspondente
    -- Primeiro, tenta pegar o estoque anterior para cálculo de custo médio (estoque global do insumo)
    SELECT COALESCE(SUM(estoque_atual), 0)
    INTO v_estoque_anterior
    FROM public.estoque_insumos
    WHERE insumo_id = NEW.insumo_id;

    SELECT custo_medio INTO v_custo_anterior
    FROM public.insumos
    WHERE id = NEW.insumo_id;

    -- Atualiza estoque no depósito específico
    INSERT INTO public.estoque_insumos (empresa_id, insumo_id, deposito_id, estoque_atual, estoque_minimo, atualizado_em)
    VALUES (NEW.empresa_id, NEW.insumo_id, NEW.deposito_id, NEW.quantidade * v_fator, 0, now())
    ON CONFLICT (empresa_id, insumo_id, deposito_id)
    DO UPDATE SET 
        estoque_atual = estoque_insumos.estoque_atual + (NEW.quantidade * v_fator),
        atualizado_em = now();

    -- 3. Atualiza o custo médio do insumo caso seja uma entrada com custo informado
    IF NEW.tipo = 'entrada' AND NEW.custo_unitario IS NOT NULL AND NEW.custo_unitario > 0 THEN
        v_novo_estoque := v_estoque_anterior + NEW.quantidade;
        
        IF v_novo_estoque > 0 THEN
            -- Média Ponderada
            v_novo_custo := ((v_estoque_anterior * v_custo_anterior) + (NEW.quantidade * NEW.custo_unitario)) / v_novo_estoque;
        ELSE
            v_novo_custo := NEW.custo_unitario;
        END IF;

        UPDATE public.insumos
        SET custo_medio = v_novo_custo
        WHERE id = NEW.insumo_id;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Aplica a trigger na tabela movimentacoes_insumos
DROP TRIGGER IF EXISTS trg_nova_movimentacao_insumo ON public.movimentacoes_insumos;
CREATE TRIGGER trg_nova_movimentacao_insumo
    AFTER INSERT ON public.movimentacoes_insumos
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_processar_movimentacao_insumo();

-- 3. Cria view para facilitar histórico no admin
CREATE OR REPLACE VIEW public.vw_movimentacoes_insumos AS
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
