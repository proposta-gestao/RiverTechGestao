-- ============================================================
-- Correção: Adicionar suporte a super_admin nas policies do módulo Restaurante
-- ============================================================

-- restaurant_config
DROP POLICY IF EXISTS "restaurant_config_select" ON public.restaurant_config;
DROP POLICY IF EXISTS "restaurant_config_insert" ON public.restaurant_config;
DROP POLICY IF EXISTS "restaurant_config_update" ON public.restaurant_config;

CREATE POLICY "restaurant_config_select" ON public.restaurant_config FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "restaurant_config_insert" ON public.restaurant_config FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "restaurant_config_update" ON public.restaurant_config FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- depositos
DROP POLICY IF EXISTS "depositos_select" ON public.depositos;
DROP POLICY IF EXISTS "depositos_insert" ON public.depositos;
DROP POLICY IF EXISTS "depositos_update" ON public.depositos;
DROP POLICY IF EXISTS "depositos_delete" ON public.depositos;

CREATE POLICY "depositos_select" ON public.depositos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "depositos_insert" ON public.depositos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "depositos_update" ON public.depositos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "depositos_delete" ON public.depositos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- fornecedores
DROP POLICY IF EXISTS "fornecedores_select" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_insert" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_update" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_delete" ON public.fornecedores;

CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- categorias_insumos
DROP POLICY IF EXISTS "categorias_insumos_select" ON public.categorias_insumos;
DROP POLICY IF EXISTS "categorias_insumos_insert" ON public.categorias_insumos;
DROP POLICY IF EXISTS "categorias_insumos_update" ON public.categorias_insumos;
DROP POLICY IF EXISTS "categorias_insumos_delete" ON public.categorias_insumos;

CREATE POLICY "categorias_insumos_select" ON public.categorias_insumos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "categorias_insumos_insert" ON public.categorias_insumos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "categorias_insumos_update" ON public.categorias_insumos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "categorias_insumos_delete" ON public.categorias_insumos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- insumos
DROP POLICY IF EXISTS "insumos_select" ON public.insumos;
DROP POLICY IF EXISTS "insumos_insert" ON public.insumos;
DROP POLICY IF EXISTS "insumos_update" ON public.insumos;
DROP POLICY IF EXISTS "insumos_delete" ON public.insumos;

CREATE POLICY "insumos_select" ON public.insumos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "insumos_insert" ON public.insumos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "insumos_update" ON public.insumos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "insumos_delete" ON public.insumos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- estoque_insumos
DROP POLICY IF EXISTS "estoque_insumos_select" ON public.estoque_insumos;
DROP POLICY IF EXISTS "estoque_insumos_insert" ON public.estoque_insumos;
DROP POLICY IF EXISTS "estoque_insumos_update" ON public.estoque_insumos;
DROP POLICY IF EXISTS "estoque_insumos_delete" ON public.estoque_insumos;

CREATE POLICY "estoque_insumos_select" ON public.estoque_insumos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "estoque_insumos_insert" ON public.estoque_insumos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "estoque_insumos_update" ON public.estoque_insumos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "estoque_insumos_delete" ON public.estoque_insumos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- ficha_tecnica
DROP POLICY IF EXISTS "ficha_tecnica_select" ON public.ficha_tecnica;
DROP POLICY IF EXISTS "ficha_tecnica_insert" ON public.ficha_tecnica;
DROP POLICY IF EXISTS "ficha_tecnica_update" ON public.ficha_tecnica;
DROP POLICY IF EXISTS "ficha_tecnica_delete" ON public.ficha_tecnica;

CREATE POLICY "ficha_tecnica_select" ON public.ficha_tecnica FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "ficha_tecnica_insert" ON public.ficha_tecnica FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "ficha_tecnica_update" ON public.ficha_tecnica FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "ficha_tecnica_delete" ON public.ficha_tecnica FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- ficha_tecnica_itens
DROP POLICY IF EXISTS "ficha_tecnica_itens_select" ON public.ficha_tecnica_itens;
DROP POLICY IF EXISTS "ficha_tecnica_itens_insert" ON public.ficha_tecnica_itens;
DROP POLICY IF EXISTS "ficha_tecnica_itens_update" ON public.ficha_tecnica_itens;
DROP POLICY IF EXISTS "ficha_tecnica_itens_delete" ON public.ficha_tecnica_itens;

CREATE POLICY "ficha_tecnica_itens_select" ON public.ficha_tecnica_itens FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ficha_tecnica ft WHERE ft.id = ficha_tecnica_id AND (ft.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))));
CREATE POLICY "ficha_tecnica_itens_insert" ON public.ficha_tecnica_itens FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.ficha_tecnica ft WHERE ft.id = ficha_tecnica_id AND (ft.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))));
CREATE POLICY "ficha_tecnica_itens_update" ON public.ficha_tecnica_itens FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.ficha_tecnica ft WHERE ft.id = ficha_tecnica_id AND (ft.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))));
CREATE POLICY "ficha_tecnica_itens_delete" ON public.ficha_tecnica_itens FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.ficha_tecnica ft WHERE ft.id = ficha_tecnica_id AND (ft.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))));

-- movimentacoes_insumos
DROP POLICY IF EXISTS "movimentacoes_insumos_select" ON public.movimentacoes_insumos;
DROP POLICY IF EXISTS "movimentacoes_insumos_insert" ON public.movimentacoes_insumos;
DROP POLICY IF EXISTS "movimentacoes_insumos_update" ON public.movimentacoes_insumos;

CREATE POLICY "movimentacoes_insumos_select" ON public.movimentacoes_insumos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "movimentacoes_insumos_insert" ON public.movimentacoes_insumos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "movimentacoes_insumos_update" ON public.movimentacoes_insumos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- inventarios_insumos
DROP POLICY IF EXISTS "inventarios_insumos_select" ON public.inventarios_insumos;
DROP POLICY IF EXISTS "inventarios_insumos_insert" ON public.inventarios_insumos;
DROP POLICY IF EXISTS "inventarios_insumos_update" ON public.inventarios_insumos;
DROP POLICY IF EXISTS "inventarios_insumos_delete" ON public.inventarios_insumos;

CREATE POLICY "inventarios_insumos_select" ON public.inventarios_insumos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "inventarios_insumos_insert" ON public.inventarios_insumos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "inventarios_insumos_update" ON public.inventarios_insumos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "inventarios_insumos_delete" ON public.inventarios_insumos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- inventarios_insumos_itens
DROP POLICY IF EXISTS "inventarios_insumos_itens_select" ON public.inventarios_insumos_itens;
DROP POLICY IF EXISTS "inventarios_insumos_itens_insert" ON public.inventarios_insumos_itens;
DROP POLICY IF EXISTS "inventarios_insumos_itens_update" ON public.inventarios_insumos_itens;

CREATE POLICY "inventarios_insumos_itens_select" ON public.inventarios_insumos_itens FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.inventarios_insumos i WHERE i.id = inventario_id AND (i.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))));
CREATE POLICY "inventarios_insumos_itens_insert" ON public.inventarios_insumos_itens FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.inventarios_insumos i WHERE i.id = inventario_id AND (i.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))));
CREATE POLICY "inventarios_insumos_itens_update" ON public.inventarios_insumos_itens FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.inventarios_insumos i WHERE i.id = inventario_id AND (i.empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))));
