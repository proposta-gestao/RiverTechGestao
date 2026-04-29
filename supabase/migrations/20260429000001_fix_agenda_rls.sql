-- Correção de RLS para o módulo de Agendamento (SaaS multi-tenant)
-- Permite que Super Admins gerenciem todas as tabelas, além dos admins normais

-- 1. profissionais
DROP POLICY IF EXISTS "profissionais_admin_all" ON public.profissionais;
CREATE POLICY "profissionais_admin_all" ON public.profissionais
    FOR ALL USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- 2. servicos
DROP POLICY IF EXISTS "servicos_admin_all" ON public.servicos;
CREATE POLICY "servicos_admin_all" ON public.servicos
    FOR ALL USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- 3. profissional_servicos
DROP POLICY IF EXISTS "profissional_servicos_admin_all" ON public.profissional_servicos;
CREATE POLICY "profissional_servicos_admin_all" ON public.profissional_servicos
    FOR ALL USING (
        public.is_super_admin(auth.uid()) OR 
        EXISTS (
            SELECT 1 FROM public.profissionais p
            WHERE p.id = profissional_id AND p.empresa_id = public.get_empresa_id()
        )
    );

-- 4. horarios_funcionamento
DROP POLICY IF EXISTS "horarios_admin_all" ON public.horarios_funcionamento;
CREATE POLICY "horarios_admin_all" ON public.horarios_funcionamento
    FOR ALL USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- 5. agendamentos
DROP POLICY IF EXISTS "agendamentos_admin_all" ON public.agendamentos;
CREATE POLICY "agendamentos_admin_all" ON public.agendamentos
    FOR ALL USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- 6. lista_espera
DROP POLICY IF EXISTS "lista_espera_admin_all" ON public.lista_espera;
CREATE POLICY "lista_espera_admin_all" ON public.lista_espera
    FOR ALL USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- 7. mensagens_templates
DROP POLICY IF EXISTS "mensagens_templates_admin_all" ON public.mensagens_templates;
CREATE POLICY "mensagens_templates_admin_all" ON public.mensagens_templates
    FOR ALL USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()))
    WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));
