-- ============================================================
-- MÓDULO CLIENTES PREMIUM — Script de Criação de Tabelas
-- RiverTech Gestão SaaS
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Perfis de Cardápio
-- Define grupos de acesso ao cardápio (ex: "VIP Diretoria", "Funcionários")
CREATE TABLE IF NOT EXISTS perfis_cardapio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Categorias por Perfil (N:N)
-- Define quais categorias de produtos cada perfil pode ver
CREATE TABLE IF NOT EXISTS perfil_cardapio_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id UUID NOT NULL REFERENCES perfis_cardapio(id) ON DELETE CASCADE,
    category_id UUID NOT NULL, -- Suporta IDs de categories (cardápio) ou loja_categorias (loja)
    UNIQUE(perfil_id, category_id)
);

-- Garantir que a FK foi removida se a tabela já existir no banco do cliente
ALTER TABLE public.perfil_cardapio_categorias DROP CONSTRAINT IF EXISTS perfil_cardapio_categorias_category_id_fkey;


-- 3. Clientes Premium
-- Cadastro de clientes com acesso especial (VIP, funcionários, diretoria)
CREATE TABLE IF NOT EXISTS clientes_premium (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL,
    telefone TEXT,
    pin TEXT NOT NULL,
    pin_hash BOOLEAN DEFAULT true,
    tipo TEXT DEFAULT 'premium',
    perfil_cardapio_id UUID REFERENCES perfis_cardapio(id) ON DELETE SET NULL,
    teto_mensal NUMERIC(10,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    primeiro_acesso BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(empresa_id, cpf)
);

-- 4. Comandas
-- Sessões de consumo abertas para clientes premium
CREATE TABLE IF NOT EXISTS comandas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_premium_id UUID NOT NULL REFERENCES clientes_premium(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'aberta',
    total_acumulado NUMERIC(10,2) DEFAULT 0,
    aberta_em TIMESTAMPTZ DEFAULT now(),
    fechada_em TIMESTAMPTZ,
    fechada_por TEXT,
    observacoes TEXT
);

-- 5. Adicionar colunas em orders (vinculação opcional com comanda/cliente premium)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comanda_id UUID REFERENCES comandas(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_premium_id UUID REFERENCES clientes_premium(id) ON DELETE SET NULL;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- perfis_cardapio
ALTER TABLE perfis_cardapio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_perfis_cardapio" ON perfis_cardapio FOR ALL USING (true) WITH CHECK (true);

-- perfil_cardapio_categorias
ALTER TABLE perfil_cardapio_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_perfil_cardapio_categorias" ON perfil_cardapio_categorias FOR ALL USING (true) WITH CHECK (true);

-- clientes_premium
ALTER TABLE clientes_premium ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_clientes_premium" ON clientes_premium FOR ALL USING (true) WITH CHECK (true);

-- comandas
ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_comandas" ON comandas FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_premium_empresa ON clientes_premium(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_premium_cpf ON clientes_premium(empresa_id, cpf);
CREATE INDEX IF NOT EXISTS idx_comandas_empresa ON comandas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_cliente ON comandas(cliente_premium_id);
CREATE INDEX IF NOT EXISTS idx_comandas_status ON comandas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_comanda ON orders(comanda_id);
CREATE INDEX IF NOT EXISTS idx_orders_cliente_premium ON orders(cliente_premium_id);
