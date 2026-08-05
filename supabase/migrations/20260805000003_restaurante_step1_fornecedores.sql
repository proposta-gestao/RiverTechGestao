-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: fornecedores
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fornecedores (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome        TEXT        NOT NULL,
    telefone    TEXT,
    email       TEXT,
    contato     TEXT,       -- nome do responsável/contato
    observacoes TEXT,
    ativo       BOOLEAN     NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_id ON public.fornecedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_ativo ON public.fornecedores(empresa_id, ativo);

COMMENT ON TABLE public.fornecedores IS 'Cadastro de fornecedores de insumos por empresa. Preparado para módulo de compras futuro.';

-- RLS
CREATE POLICY "fornecedores_select" ON public.fornecedores
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "fornecedores_insert" ON public.fornecedores
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "fornecedores_update" ON public.fornecedores
    FOR UPDATE TO authenticated
    USING (empresa_id = public.get_empresa_id());

CREATE POLICY "fornecedores_delete" ON public.fornecedores
    FOR DELETE TO authenticated
    USING (empresa_id = public.get_empresa_id());

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.update_fornecedores_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fornecedores_updated_at
    BEFORE UPDATE ON public.fornecedores
    FOR EACH ROW EXECUTE FUNCTION public.update_fornecedores_updated_at();
