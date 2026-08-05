-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: restaurant_config (configurações por empresa)
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.restaurant_config (
    empresa_id              UUID        PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
    baixa_estoque_gatilho   TEXT        NOT NULL DEFAULT 'concluido'
                                        CHECK (baixa_estoque_gatilho IN ('recebido','preparo','concluido','entregue')),
    bloquear_sem_estoque    BOOLEAN     NOT NULL DEFAULT false,
    reserva_ativa           BOOLEAN     NOT NULL DEFAULT false,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_config ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.restaurant_config IS 'Configurações do módulo Restaurante por empresa. Exclusivo segmento restaurante.';
COMMENT ON COLUMN public.restaurant_config.baixa_estoque_gatilho IS 'Define o momento em que a baixa automática de insumos é disparada.';
COMMENT ON COLUMN public.restaurant_config.bloquear_sem_estoque IS 'Se true, impede a confirmação de pedidos quando insumos estão insuficientes.';
COMMENT ON COLUMN public.restaurant_config.reserva_ativa IS 'Flag para ativar reserva de insumos (funcionalidade futura — PASSO 4+).';

-- RLS: somente admins da própria empresa
CREATE POLICY "restaurant_config_select" ON public.restaurant_config
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "restaurant_config_insert" ON public.restaurant_config
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "restaurant_config_update" ON public.restaurant_config
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "restaurant_config_delete" ON public.restaurant_config
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.update_restaurant_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restaurant_config_updated_at
    BEFORE UPDATE ON public.restaurant_config
    FOR EACH ROW EXECUTE FUNCTION public.update_restaurant_config_updated_at();
