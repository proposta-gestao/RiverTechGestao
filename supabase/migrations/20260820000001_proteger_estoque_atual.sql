-- Migration: Proteger estoque_atual e custo_medio contra escrita direta pelo frontend
-- As triggers SECURITY DEFINER (trg_processar_movimentacao_insumo) continuam funcionando normalmente.
-- O frontend só pode alterar estoque_minimo via UPDATE.

-- 1. Trigger de proteção: impede que UPDATE altere estoque_atual diretamente
-- Reverte silenciosamente qualquer tentativa de escrita direta em estoque_atual
CREATE OR REPLACE FUNCTION public.proteger_estoque_atual()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se estoque_atual está sendo alterado por usuário autenticado (não por trigger SECURITY DEFINER)
    IF NEW.estoque_atual IS DISTINCT FROM OLD.estoque_atual THEN
        IF current_setting('role', true) = 'authenticated' THEN
            NEW.estoque_atual := OLD.estoque_atual;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_estoque_atual ON public.estoque_insumos;
CREATE TRIGGER trg_proteger_estoque_atual
    BEFORE UPDATE ON public.estoque_insumos
    FOR EACH ROW
    EXECUTE FUNCTION public.proteger_estoque_atual();

-- 2. Proteção similar para insumos.custo_medio
-- Impede que o frontend sobrescreva custo_medio diretamente via UPDATE
CREATE OR REPLACE FUNCTION public.proteger_custo_medio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.custo_medio IS DISTINCT FROM OLD.custo_medio THEN
        IF current_setting('role', true) = 'authenticated' THEN
            NEW.custo_medio := OLD.custo_medio;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_custo_medio ON public.insumos;
CREATE TRIGGER trg_proteger_custo_medio
    BEFORE UPDATE ON public.insumos
    FOR EACH ROW
    EXECUTE FUNCTION public.proteger_custo_medio();
