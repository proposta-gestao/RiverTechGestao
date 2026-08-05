-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: depositos (múltiplos estoques por empresa)
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.depositos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome        TEXT        NOT NULL,
    tipo        TEXT        NOT NULL DEFAULT 'geral'
                            CHECK (tipo IN ('geral','cozinha','bar','central','filial','outro')),
    ativo       BOOLEAN     NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_depositos_empresa_id ON public.depositos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_depositos_empresa_ativo ON public.depositos(empresa_id, ativo);

COMMENT ON TABLE public.depositos IS 'Depósitos/estoques físicos por empresa. Permite múltiplos estoques (cozinha, bar, central, filiais).';

-- RLS
CREATE POLICY "depositos_select" ON public.depositos
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "depositos_insert" ON public.depositos
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "depositos_update" ON public.depositos
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "depositos_delete" ON public.depositos
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());
