-- ============================================================
-- Correção e Garantia de Seed das Unidades de Medida
-- ============================================================

-- 1. Garantir que o RLS está desabilitado na tabela global de unidades de medida
-- (Evita que o Supabase bloqueie a leitura caso tenha RLS ativado por padrão nas configurações do projeto)
ALTER TABLE public.unidades_medida DISABLE ROW LEVEL SECURITY;

-- Caso o RLS não possa ser desabilitado por alguma regra, criamos também uma política de leitura para todos
DROP POLICY IF EXISTS "Permitir leitura publica de unidades_medida" ON public.unidades_medida;
CREATE POLICY "Permitir leitura publica de unidades_medida" ON public.unidades_medida FOR SELECT TO authenticated USING (true);

-- 2. Garantir que o Seed das unidades padrão esteja inserido
INSERT INTO public.unidades_medida (nome, simbolo, unidade_base, fator_conversao, tipo) VALUES
  -- Massa
  ('Grama',        'g',   'g',  1,       'massa'),
  ('Quilograma',   'kg',  'g',  1000,    'massa'),
  ('Miligrama',    'mg',  'g',  0.001,   'massa'),
  -- Volume
  ('Mililitro',    'ml',  'ml', 1,       'volume'),
  ('Litro',        'l',   'ml', 1000,    'volume'),
  -- Unidade
  ('Unidade',      'un',  'un', 1,       'unidade'),
  ('Caixa',        'cx',  'un', 1,       'unidade'),
  ('Pacote',       'pct', 'un', 1,       'unidade'),
  ('Fatia',        'ft',  'un', 1,       'unidade'),
  ('Dúzia',        'dz',  'un', 12,      'unidade'),
  ('Bandeja',      'bdj', 'un', 1,       'unidade')
ON CONFLICT (simbolo) DO NOTHING;
