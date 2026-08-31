-- ============================================================
-- Migration: RPC para Limpar Vendas da Empresa
-- Data: 2026-08-30
-- Descrição: Permite que um Super Admin exclua em cascata todas
-- as vendas e agendamentos de uma empresa específica ignorando RLS
-- que bloqueia deletes de terceiros.
-- ============================================================

CREATE OR REPLACE FUNCTION public.limpar_vendas_empresa(p_empresa_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar se quem chama é um super admin
    IF NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas Super Admins podem limpar as vendas de uma empresa.';
    END IF;

    -- 1. Deletar order_items (usando order_id já que alguns itens podem não ter empresa_id preenchido corretamente no legado)
    DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE empresa_id = p_empresa_id);
    
    -- 2. Deletar orders da empresa
    DELETE FROM public.orders WHERE empresa_id = p_empresa_id;

    -- 3. Deletar agendamentos da empresa
    DELETE FROM public.agendamentos WHERE empresa_id = p_empresa_id;
END;
$$;

-- Notificar o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
