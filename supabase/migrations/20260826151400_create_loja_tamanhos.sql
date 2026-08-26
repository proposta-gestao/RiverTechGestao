-- ============================================================
-- Migration: Criação da tabela loja_tamanhos
-- Data: 2026-08-26
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loja_tamanhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.loja_tamanhos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Leitura publica de tamanhos" 
  ON public.loja_tamanhos FOR SELECT 
  USING (true);

CREATE POLICY "Admin gerencia tamanhos da sua empresa" 
  ON public.loja_tamanhos FOR ALL TO authenticated 
  USING (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.is_admin(auth.uid()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_loja_tamanhos_empresa_id ON public.loja_tamanhos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_loja_tamanhos_empresa_ordem ON public.loja_tamanhos(empresa_id, ordem);
