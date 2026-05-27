-- ============================================================
-- Migration: MÃ³dulo de Loja de Roupas
-- Data: 2026-05-05
-- Inclui: loja_produtos, loja_variacoes,
--         RPCs de SKU e estoque, RLS multi-tenant
-- ============================================================


-- ============================================================
-- PRÃ‰-REQUISITO: ExtensÃ£o unaccent (para normalizar acentos)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent;


-- ============================================================
-- TABELA: loja_produtos
-- Produto principal (ex: "Camiseta BÃ¡sica")
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loja_produtos (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome          TEXT          NOT NULL,
    categoria_id  UUID          REFERENCES public.categories(id) ON DELETE SET NULL,
    descricao     TEXT,
    imagem_url    TEXT,
    ativo         BOOLEAN       NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_produtos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_loja_produtos_empresa_id ON public.loja_produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_loja_produtos_empresa_ativo ON public.loja_produtos(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_loja_produtos_categoria ON public.loja_produtos(categoria_id);


-- ============================================================
-- TABELA: loja_variacoes
-- Cada variaÃ§Ã£o (tamanho + cor) de um produto
-- SEM empresa_id â€” herda via JOIN com loja_produtos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loja_variacoes (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id    UUID          NOT NULL REFERENCES public.loja_produtos(id) ON DELETE CASCADE,
    tamanho       TEXT          NOT NULL,
    cor           TEXT          NOT NULL,
    sku           TEXT          NOT NULL,
    preco         NUMERIC(10,2),
    estoque       INTEGER       NOT NULL DEFAULT 0 CHECK (estoque >= 0),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_variacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_loja_variacoes_produto ON public.loja_variacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_loja_variacoes_sku ON public.loja_variacoes(sku);

-- Constraint: SKU Ãºnico por produto (garante unicidade combinada)
-- Usamos um unique composto com produto_id para permitir que empresas diferentes
-- possam ter o mesmo padrÃ£o de SKU
ALTER TABLE public.loja_variacoes
    ADD CONSTRAINT uq_loja_variacoes_produto_sku UNIQUE (produto_id, sku);


-- ============================================================
-- RLS: loja_produtos
-- ============================================================

-- Leitura pÃºblica (para a pÃ¡gina da loja)
CREATE POLICY "loja_produtos_public_read" ON public.loja_produtos
    FOR SELECT USING (true);

-- Admin da empresa gerencia seus produtos
CREATE POLICY "loja_produtos_admin_insert" ON public.loja_produtos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "loja_produtos_admin_update" ON public.loja_produtos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "loja_produtos_admin_delete" ON public.loja_produtos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());


-- ============================================================
-- RLS: loja_variacoes
-- Baseada no JOIN com loja_produtos para herdar empresa_id
-- ============================================================

-- Leitura pÃºblica (para a pÃ¡gina da loja)
CREATE POLICY "loja_variacoes_public_read" ON public.loja_variacoes
    FOR SELECT USING (true);

-- Admin pode inserir variaÃ§Ã£o se o produto pertence Ã  empresa
CREATE POLICY "loja_variacoes_admin_insert" ON public.loja_variacoes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.loja_produtos p
            WHERE p.id = produto_id
              AND p.empresa_id = public.get_empresa_id()
        )
    );

-- Admin pode atualizar variaÃ§Ã£o se o produto pertence Ã  empresa
CREATE POLICY "loja_variacoes_admin_update" ON public.loja_variacoes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.loja_produtos p
            WHERE p.id = produto_id
              AND p.empresa_id = public.get_empresa_id()
        )
    );

-- Admin pode deletar variaÃ§Ã£o se o produto pertence Ã  empresa
CREATE POLICY "loja_variacoes_admin_delete" ON public.loja_variacoes
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.loja_produtos p
            WHERE p.id = produto_id
              AND p.empresa_id = public.get_empresa_id()
        )
    );


-- ============================================================
-- RPC: gerar_sku
-- Gera SKU no formato: CAM-PR-M-0001
-- Executado no backend para evitar race conditions
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_sku(
    p_empresa_id UUID,
    p_nome TEXT,
    p_cor TEXT,
    p_tamanho TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    prefixo TEXT;
    cor_abrev TEXT;
    tam_upper TEXT;
    padrao TEXT;
    seq INT;
    novo_sku TEXT;
BEGIN
    -- 3 primeiras letras do nome (sem acento, maiÃºsculo)
    prefixo := UPPER(LEFT(unaccent(TRIM(p_nome)), 3));
    -- 2 primeiras letras da cor (sem acento, maiÃºsculo)
    cor_abrev := UPPER(LEFT(unaccent(TRIM(p_cor)), 2));
    -- Tamanho em maiÃºsculo
    tam_upper := UPPER(TRIM(p_tamanho));

    -- PadrÃ£o de busca: CAM-PR-M-
    padrao := prefixo || '-' || cor_abrev || '-' || tam_upper || '-';

    -- Buscar prÃ³ximo sequencial para esse padrÃ£o na empresa
    SELECT COALESCE(MAX(
        CAST(NULLIF(SUBSTRING(v.sku FROM '[0-9]{4}$'), '') AS INT)
    ), 0) + 1
    INTO seq
    FROM loja_variacoes v
    JOIN loja_produtos p ON p.id = v.produto_id
    WHERE p.empresa_id = p_empresa_id
      AND v.sku LIKE padrao || '%';

    novo_sku := padrao || LPAD(seq::TEXT, 4, '0');

    RETURN novo_sku;
END;
$$;


-- ============================================================
-- RPC: loja_adicionar_estoque
-- Adiciona quantidade ao estoque de uma variaÃ§Ã£o
-- ============================================================
CREATE OR REPLACE FUNCTION public.loja_adicionar_estoque(
    p_variacao_id UUID,
    p_quantidade INT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_quantidade <= 0 THEN
        RAISE EXCEPTION 'Quantidade deve ser maior que zero';
    END IF;

    UPDATE loja_variacoes
    SET estoque = estoque + p_quantidade
    WHERE id = p_variacao_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VariaÃ§Ã£o nÃ£o encontrada';
    END IF;
END;
$$;


-- ============================================================
-- RPC: loja_remover_estoque
-- Remove quantidade do estoque (venda), impede negativo
-- ============================================================
CREATE OR REPLACE FUNCTION public.loja_remover_estoque(
    p_variacao_id UUID,
    p_quantidade INT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    estoque_atual INT;
BEGIN
    IF p_quantidade <= 0 THEN
        RAISE EXCEPTION 'Quantidade deve ser maior que zero';
    END IF;

    SELECT estoque INTO estoque_atual
    FROM loja_variacoes
    WHERE id = p_variacao_id
    FOR UPDATE; -- Lock para evitar race condition

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VariaÃ§Ã£o nÃ£o encontrada';
    END IF;

    IF estoque_atual < p_quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente. DisponÃ­vel: %, Solicitado: %', estoque_atual, p_quantidade;
    END IF;

    UPDATE loja_variacoes
    SET estoque = estoque - p_quantidade
    WHERE id = p_variacao_id;
END;
$$;


-- ============================================================
-- REFERÃŠNCIA DE USO:
--
-- Gerar SKU:
--   SELECT public.gerar_sku('uuid-empresa', 'Camiseta', 'Preto', 'M');
--   â†’ Retorna: 'CAM-PR-M-0001'
--
-- Adicionar estoque:
--   SELECT public.loja_adicionar_estoque('uuid-variacao', 10);
--
-- Remover estoque (venda):
--   SELECT public.loja_remover_estoque('uuid-variacao', 1);
--   â†’ LanÃ§a exceÃ§Ã£o se estoque insuficiente
--
-- Consultar produtos com variaÃ§Ãµes:
--   SELECT p.*, v.*
--   FROM loja_produtos p
--   LEFT JOIN loja_variacoes v ON v.produto_id = p.id
--   WHERE p.empresa_id = 'uuid-empresa'
--     AND p.ativo = true;
-- ============================================================
