-- ============================================================
-- Módulo Restaurante — Controle de Estoque por Ficha Técnica
-- Arquitetura: produto como centro, ficha técnica como cache de estoque
-- Data: 2026-08-06
-- ============================================================

-- ============================================================
-- BLOCO 1: Adicionar colunas em products
-- ============================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS controle_estoque TEXT NOT NULL DEFAULT 'manual'
        CONSTRAINT ck_products_controle_estoque CHECK (controle_estoque IN ('manual', 'ficha_tecnica')),
    ADD COLUMN IF NOT EXISTS estoque_calculado NUMERIC(10, 2);

COMMENT ON COLUMN public.products.controle_estoque IS
    'Define como o estoque é controlado: manual (usa products.stock) ou ficha_tecnica (calculado automaticamente via insumos). DEFAULT manual garante compatibilidade com todos os produtos existentes.';
COMMENT ON COLUMN public.products.estoque_calculado IS
    'Cache do estoque disponível calculado via ficha técnica (min de insumos disponíveis / quantidade necessária). Atualizado por triggers em estoque_insumos e ficha_tecnica_itens. NULL = produto com controle manual. FONTE DA VERDADE: estoque_insumos + ficha_tecnica.';

-- ============================================================
-- BLOCO 2: Migração automática de produtos existentes
-- Produtos com custo_producao preenchido já possuem ficha técnica ativa
-- ============================================================

UPDATE public.products
SET controle_estoque = 'ficha_tecnica'
WHERE custo_producao IS NOT NULL
  AND controle_estoque = 'manual';

-- ============================================================
-- BLOCO 3: Função para recalcular o estoque de UM produto
-- Fonte da verdade: estoque_insumos + ficha_tecnica_itens
-- Fórmula: min(estoque_insumo / qtd_necessaria) para cada insumo da ficha
-- ============================================================

CREATE OR REPLACE FUNCTION public.atualizar_estoque_calculado_produto(p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_producao NUMERIC := NULL;
    v_qtd_possivel NUMERIC;
    v_insumo       RECORD;
    v_tem_ficha    BOOLEAN := false;
    v_controle     TEXT;
BEGIN
    -- Verifica se o produto usa controle por ficha técnica
    SELECT controle_estoque INTO v_controle
    FROM public.products
    WHERE id = p_product_id;

    IF v_controle IS DISTINCT FROM 'ficha_tecnica' THEN
        RETURN; -- Produto manual: não toca no estoque_calculado
    END IF;

    -- Itera sobre cada insumo da ficha técnica ativa
    FOR v_insumo IN
        SELECT
            fti.insumo_id,
            fti.quantidade AS qtd_necessaria,
            COALESCE((
                SELECT SUM(ei.estoque_atual)
                FROM public.estoque_insumos ei
                WHERE ei.insumo_id = fti.insumo_id
            ), 0) AS estoque_disponivel
        FROM public.ficha_tecnica ft
        JOIN public.ficha_tecnica_itens fti ON fti.ficha_tecnica_id = ft.id
        WHERE ft.product_id = p_product_id
          AND ft.ativo = true
    LOOP
        v_tem_ficha := true;
        IF v_insumo.qtd_necessaria <= 0 THEN CONTINUE; END IF;

        -- Quantos deste produto podemos fazer com este insumo
        v_qtd_possivel := FLOOR(v_insumo.estoque_disponivel / v_insumo.qtd_necessaria);
        IF v_qtd_possivel < 0 THEN v_qtd_possivel := 0; END IF;

        -- Guarda o menor valor (gargalo)
        IF v_max_producao IS NULL OR v_qtd_possivel < v_max_producao THEN
            v_max_producao := v_qtd_possivel;
        END IF;
    END LOOP;

    -- Atualiza somente se há ficha técnica vinculada
    IF v_tem_ficha THEN
        UPDATE public.products
        SET estoque_calculado = COALESCE(v_max_producao, 0)
        WHERE id = p_product_id;
    ELSIF NOT v_tem_ficha THEN
        -- Tem controle = ficha_tecnica mas sem ficha cadastrada ainda: zera para segurança
        UPDATE public.products
        SET estoque_calculado = 0
        WHERE id = p_product_id;
    END IF;
END;
$$;

-- ============================================================
-- BLOCO 4: Função de recálculo GLOBAL (safety net híbrido)
-- Recalcula todos os produtos com controle = ficha_tecnica
-- Usar após: migrations, importações, inventários, erros de sync
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalcular_todos_estoques_produtos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_produto RECORD;
    v_count   INTEGER := 0;
BEGIN
    FOR v_produto IN
        SELECT id FROM public.products
        WHERE controle_estoque = 'ficha_tecnica'
    LOOP
        PERFORM public.atualizar_estoque_calculado_produto(v_produto.id);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count; -- Retorna quantos produtos foram recalculados
END;
$$;

COMMENT ON FUNCTION public.recalcular_todos_estoques_produtos() IS
    'Recalcula o estoque_calculado de todos os produtos com controle = ficha_tecnica. Usar como safety net após migrations, importações em lote, inventários ou suspeita de inconsistência. Retorna o número de produtos processados.';

-- ============================================================
-- BLOCO 5: Trigger em estoque_insumos
-- Quando o estoque de um insumo muda → recalcula produtos vinculados
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_recalcular_por_insumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_produto RECORD;
    v_insumo_id UUID;
BEGIN
    v_insumo_id := COALESCE(NEW.insumo_id, OLD.insumo_id);

    FOR v_produto IN
        SELECT DISTINCT ft.product_id
        FROM public.ficha_tecnica ft
        JOIN public.ficha_tecnica_itens fti ON fti.ficha_tecnica_id = ft.id
        WHERE fti.insumo_id = v_insumo_id
          AND ft.ativo = true
    LOOP
        PERFORM public.atualizar_estoque_calculado_produto(v_produto.product_id);
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_estoque_insumo_atualiza_produtos ON public.estoque_insumos;
CREATE TRIGGER trg_estoque_insumo_atualiza_produtos
    AFTER INSERT OR UPDATE OF estoque_atual ON public.estoque_insumos
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_recalcular_por_insumo();

-- ============================================================
-- BLOCO 6: Trigger em ficha_tecnica_itens
-- Quando a composição da ficha muda → recalcula o produto
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_recalcular_por_ficha_itens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product_id UUID;
    v_ficha_id   UUID;
BEGIN
    v_ficha_id := COALESCE(NEW.ficha_tecnica_id, OLD.ficha_tecnica_id);

    SELECT product_id INTO v_product_id
    FROM public.ficha_tecnica
    WHERE id = v_ficha_id;

    IF v_product_id IS NOT NULL THEN
        PERFORM public.atualizar_estoque_calculado_produto(v_product_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ficha_itens_atualiza_estoque ON public.ficha_tecnica_itens;
CREATE TRIGGER trg_ficha_itens_atualiza_estoque
    AFTER INSERT OR UPDATE OR DELETE ON public.ficha_tecnica_itens
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_recalcular_por_ficha_itens();

-- ============================================================
-- BLOCO 7: Trigger em ficha_tecnica
-- Quando ativo/inativo muda → recalcula o produto
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_recalcular_por_ficha_ativo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
        PERFORM public.atualizar_estoque_calculado_produto(NEW.product_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ficha_ativo_atualiza_estoque ON public.ficha_tecnica;
CREATE TRIGGER trg_ficha_ativo_atualiza_estoque
    AFTER UPDATE OF ativo ON public.ficha_tecnica
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_recalcular_por_ficha_ativo();

-- ============================================================
-- BLOCO 8: Atualizar restaurante_validar_carrinho
-- Adiciona verificação de estoque_calculado para produtos com ficha_tecnica
-- ============================================================

CREATE OR REPLACE FUNCTION public.restaurante_validar_carrinho(p_empresa_id UUID, p_carrinho JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bloquear   BOOLEAN;
    v_item       JSONB;
    v_product_id UUID;
    v_qtd_solicitada INTEGER;
    v_nome_produto   TEXT;
    v_insumo_necessidade RECORD;
    v_estoque_disponivel NUMERIC;
    v_produto    RECORD;
    v_erros      JSONB := '[]'::jsonb;
BEGIN
    -- Verifica a configuração da empresa
    SELECT bloquear_sem_estoque INTO v_bloquear
    FROM public.restaurant_config
    WHERE empresa_id = p_empresa_id;

    IF COALESCE(v_bloquear, false) = false THEN
        RETURN jsonb_build_object('valido', true, 'erros', v_erros);
    END IF;

    -- Tabela temp para consolidar necessidade de insumos
    CREATE TEMP TABLE IF NOT EXISTS tmp_necessidade_insumos (
        insumo_id   UUID,
        insumo_nome TEXT,
        qtd_total   NUMERIC
    ) ON COMMIT DROP;
    TRUNCATE tmp_necessidade_insumos;

    -- Varre o carrinho
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_carrinho)
    LOOP
        v_product_id     := (v_item->>'product_id')::UUID;
        v_qtd_solicitada := (v_item->>'quantity')::INTEGER;
        v_nome_produto   := v_item->>'nome';

        -- Verifica o tipo de controle do produto
        SELECT controle_estoque, estoque_calculado, name
        INTO v_produto
        FROM public.products
        WHERE id = v_product_id;

        IF v_produto.controle_estoque = 'ficha_tecnica' THEN
            -- Valida via estoque_calculado (cache atualizado por triggers)
            IF COALESCE(v_produto.estoque_calculado, 0) < v_qtd_solicitada THEN
                v_erros := v_erros || jsonb_build_object(
                    'product_id', v_product_id,
                    'produto_nome', v_produto.name,
                    'qtd_necessaria', v_qtd_solicitada,
                    'qtd_disponivel', COALESCE(v_produto.estoque_calculado, 0),
                    'mensagem', 'Estoque insuficiente de ' || v_produto.name
                );
            ELSE
                -- Consolida necessidade de insumos para verificação detalhada
                INSERT INTO tmp_necessidade_insumos (insumo_id, insumo_nome, qtd_total)
                SELECT i.id, i.nome, (fti.quantidade * v_qtd_solicitada)
                FROM public.ficha_tecnica ft
                JOIN public.ficha_tecnica_itens fti ON fti.ficha_tecnica_id = ft.id
                JOIN public.insumos i ON i.id = fti.insumo_id
                WHERE ft.product_id = v_product_id AND ft.ativo = true;
            END IF;
        END IF;
        -- Produtos manuais: validação de stock feita no front-end
    END LOOP;

    -- Verifica necessidades totais de insumos agrupadas
    FOR v_insumo_necessidade IN
        SELECT insumo_id, MAX(insumo_nome) as insumo_nome, SUM(qtd_total) as qtd_total
        FROM tmp_necessidade_insumos
        GROUP BY insumo_id
    LOOP
        SELECT COALESCE(SUM(estoque_atual), 0)
        INTO v_estoque_disponivel
        FROM public.estoque_insumos
        WHERE insumo_id = v_insumo_necessidade.insumo_id;

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

    IF jsonb_array_length(v_erros) > 0 THEN
        RETURN jsonb_build_object('valido', false, 'erros', v_erros);
    END IF;

    RETURN jsonb_build_object('valido', true, 'erros', v_erros);
END;
$$;

-- ============================================================
-- BLOCO 9: Seed — Recalcular estoques de produtos existentes
-- Garante que products criados antes desta migration ficam sincronizados
-- ============================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT public.recalcular_todos_estoques_produtos() INTO v_count;
    RAISE NOTICE '[Restaurante] recalcular_todos_estoques_produtos(): % produto(s) processado(s).', v_count;
END $$;
