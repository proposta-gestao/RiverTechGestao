-- ============================================================
-- Migration: Multi-Tenant SaaS - Isolamento por Empresa
-- Data: 2026-04-27
-- ============================================================


-- ============================================================
-- PASSO 1: CRIAR TABELA DE EMPRESAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.empresas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  status        TEXT        NOT NULL DEFAULT 'ativo',
  plano         TEXT        NOT NULL DEFAULT 'basico',
  cor_primaria  TEXT,
  logo_url      TEXT,
  criado_em     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PASSO 2: TABELA DE USUÁRIOS VINCULADOS À EMPRESA
-- id = mesmo UUID do auth.users (sem FK explícita para evitar dependência de schema)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID  PRIMARY KEY,
  email       TEXT  NOT NULL,
  empresa_id  UUID  NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role        TEXT  NOT NULL DEFAULT 'admin',
  criado_em   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON public.usuarios(empresa_id);


-- ============================================================
-- PASSO 3: FUNÇÃO HELPER — RETORNA empresa_id DO USUÁRIO LOGADO
-- SECURITY DEFINER: roda como dono (sem recursão de RLS)
-- Uso nas policies: public.get_empresa_id()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$;

-- Atualiza is_admin para continuar funcionando no contexto multi-tenant
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = _user_id
  );
$$;


-- ============================================================
-- PASSO 4: ADICIONAR empresa_id NAS TABELAS PRINCIPAIS
-- ============================================================

-- admin_users
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_admin_users_empresa_id ON public.admin_users(empresa_id);

-- categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_categories_empresa_id ON public.categories(empresa_id);

-- products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_products_empresa_id ON public.products(empresa_id);

-- coupons
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_coupons_empresa_id ON public.coupons(empresa_id);

-- orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_orders_empresa_id ON public.orders(empresa_id);

-- order_items (desnormalizado para queries diretas por empresa)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_order_items_empresa_id ON public.order_items(empresa_id);

-- atendentes
ALTER TABLE public.atendentes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_atendentes_empresa_id ON public.atendentes(empresa_id);

-- store_settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_store_settings_empresa_id ON public.store_settings(empresa_id);

-- shipping_zones
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_shipping_zones_empresa_id ON public.shipping_zones(empresa_id);

-- stock_movements
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_stock_movements_empresa_id ON public.stock_movements(empresa_id);

-- stock_reasons
ALTER TABLE public.stock_reasons ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_stock_reasons_empresa_id ON public.stock_reasons(empresa_id);


-- ============================================================
-- PASSO 5: RLS — RECRIAR TODAS AS POLICIES COM ISOLAMENTO
-- ============================================================

-- ---------- EMPRESAS ----------
CREATE POLICY "Usuario ve apenas sua empresa"
  ON public.empresas FOR SELECT TO authenticated
  USING (id = public.get_empresa_id());

-- ---------- USUARIOS ----------
CREATE POLICY "Usuario ve membros da sua empresa"
  ON public.usuarios FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE POLICY "Usuario atualiza proprio registro"
  ON public.usuarios FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------- ADMIN_USERS ----------
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;

CREATE POLICY "Admin ve admins da sua empresa"
  ON public.admin_users FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

-- ---------- CATEGORIES ----------
DROP POLICY IF EXISTS "Anyone can view categories"      ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories"   ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories"   ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories"   ON public.categories;

CREATE POLICY "Leitura publica de categorias"
  ON public.categories FOR SELECT USING (true);

CREATE POLICY "Admin insere categoria na sua empresa"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Admin atualiza categoria da sua empresa"
  ON public.categories FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Admin deleta categoria da sua empresa"
  ON public.categories FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- PRODUCTS ----------
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products"      ON public.products;
DROP POLICY IF EXISTS "Admins can update products"      ON public.products;
DROP POLICY IF EXISTS "Admins can delete products"      ON public.products;

CREATE POLICY "Leitura publica de produtos"
  ON public.products FOR SELECT USING (true);

CREATE POLICY "Admin insere produto na sua empresa"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Admin atualiza produto da sua empresa"
  ON public.products FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Admin deleta produto da sua empresa"
  ON public.products FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- COUPONS ----------
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can manage coupons"      ON public.coupons;

CREATE POLICY "Leitura publica de cupons ativos"
  ON public.coupons FOR SELECT USING (active = true);

CREATE POLICY "Admin gerencia cupons da sua empresa"
  ON public.coupons FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- ORDERS ----------
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view orders"   ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- Clientes (anônimos) inserem pedidos — empresa_id deve vir do frontend via slug
CREATE POLICY "Publico pode inserir pedidos"
  ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin ve pedidos da sua empresa"
  ON public.orders FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE POLICY "Admin atualiza pedidos da sua empresa"
  ON public.orders FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Admin deleta pedidos da sua empresa"
  ON public.orders FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- ORDER ITEMS ----------
DROP POLICY IF EXISTS "Anyone can insert order items"    ON public.order_items;
DROP POLICY IF EXISTS "Admins can view order items"      ON public.order_items;
DROP POLICY IF EXISTS "Admins can update order items"    ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items"    ON public.order_items;

CREATE POLICY "Publico pode inserir itens de pedido"
  ON public.order_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin ve itens de pedidos da sua empresa"
  ON public.order_items FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE POLICY "Admin atualiza itens da sua empresa"
  ON public.order_items FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Admin deleta itens da sua empresa"
  ON public.order_items FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- ATENDENTES ----------
DROP POLICY IF EXISTS "Anyone can view waiters for login" ON public.atendentes;

-- Login ainda funciona publicamente (sem auth), filtrado por empresa via query direta
CREATE POLICY "Leitura publica de atendentes para login"
  ON public.atendentes FOR SELECT USING (true);

CREATE POLICY "Admin gerencia atendentes da sua empresa"
  ON public.atendentes FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- STORE SETTINGS ----------
DROP POLICY IF EXISTS "Anyone can view store settings"     ON public.store_settings;
DROP POLICY IF EXISTS "Admins can manage store settings"   ON public.store_settings;

CREATE POLICY "Leitura publica das configuracoes da loja"
  ON public.store_settings FOR SELECT USING (true);

CREATE POLICY "Admin gerencia config da sua empresa"
  ON public.store_settings FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- SHIPPING ZONES ----------
DROP POLICY IF EXISTS "Public read shipping zones"            ON public.shipping_zones;
DROP POLICY IF EXISTS "Admins manage shipping zones"          ON public.shipping_zones;

CREATE POLICY "Leitura publica de zonas de frete"
  ON public.shipping_zones FOR SELECT USING (true);

CREATE POLICY "Admin gerencia zonas de frete da sua empresa"
  ON public.shipping_zones FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- ---------- STOCK MOVEMENTS ----------
DROP POLICY IF EXISTS "Admins podem ver movimentos de estoque"    ON public.stock_movements;
DROP POLICY IF EXISTS "Admins podem inserir movimentos de estoque" ON public.stock_movements;

CREATE POLICY "Admin ve movimentos da sua empresa"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE POLICY "Admin insere movimentos da sua empresa"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ---------- STOCK REASONS ----------
DROP POLICY IF EXISTS "Admins podem tudo em stock_reasons" ON public.stock_reasons;

CREATE POLICY "Admin gerencia motivos de estoque da sua empresa"
  ON public.stock_reasons FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());


-- ============================================================
-- PASSO 6: ÍNDICES COMPOSTOS PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_empresa_active
  ON public.products(empresa_id, active);

CREATE INDEX IF NOT EXISTS idx_orders_empresa_status
  ON public.orders(empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_empresa_created
  ON public.orders(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_categories_empresa_order
  ON public.categories(empresa_id, order_position);

CREATE INDEX IF NOT EXISTS idx_atendentes_empresa_cpf
  ON public.atendentes(empresa_id, cpf);


-- ============================================================
-- REFERÊNCIA: COMO REGISTRAR UM NOVO USUÁRIO NA EMPRESA
-- Execute após criar o usuário via Supabase Auth:
--
-- INSERT INTO public.usuarios (id, email, empresa_id, role)
-- VALUES (auth.uid(), 'email@exemplo.com', '<empresa_uuid>', 'admin');
--
-- REFERÊNCIA: COMO BUSCAR empresa_id NO BACKEND/TRIGGER:
-- SELECT public.get_empresa_id();  -- retorna UUID da empresa do usuário logado
--
-- REFERÊNCIA: POLÍTICA OBRIGATÓRIA NO FRONTEND:
-- Todo INSERT de pedido (anônimo) DEVE enviar empresa_id
-- buscado previamente via slug da empresa (rota da URL).
-- Exemplo: SELECT id FROM empresas WHERE slug = 'nome-da-loja';
-- ============================================================
