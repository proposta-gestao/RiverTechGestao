-- ============================================================
-- Migration: Criação da tabela loja_cores
-- Data: 2026-08-27
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loja_cores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  hex TEXT NOT NULL DEFAULT '#808080',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.loja_cores ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (padrão do projeto)
CREATE POLICY ""loja_cores_public_read""
  ON public.loja_cores FOR SELECT
  USING (true);

CREATE POLICY ""loja_cores_admin_insert""
  ON public.loja_cores FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY ""loja_cores_admin_update""
  ON public.loja_cores FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY ""loja_cores_admin_delete""
  ON public.loja_cores FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_loja_cores_empresa_id ON public.loja_cores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_loja_cores_empresa_ordem ON public.loja_cores(empresa_id, ordem);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_cores_empresa_nome_unique ON public.loja_cores(empresa_id, lower(trim(nome)));
