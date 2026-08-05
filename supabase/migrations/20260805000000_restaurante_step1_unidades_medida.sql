-- ============================================================
-- Módulo Restaurante — PASSO 1
-- Tabela: unidades_medida (seed global, sem empresa_id)
-- Data: 2026-08-05
-- ============================================================

CREATE TABLE IF NOT EXISTS public.unidades_medida (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT        NOT NULL,
    simbolo       TEXT        NOT NULL UNIQUE,
    unidade_base  TEXT        NOT NULL,         -- símbolo da unidade base para conversão
    fator_conversao NUMERIC   NOT NULL DEFAULT 1, -- fator para converter para a unidade base
    tipo          TEXT        NOT NULL CHECK (tipo IN ('massa','volume','unidade','comprimento')),
    ativo         BOOLEAN     NOT NULL DEFAULT true,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sem RLS: tabela global de referência (leitura pública, escrita apenas via migration/super admin)
-- Não habilitar RLS aqui para que todos os tenants possam ler sem restrição

COMMENT ON TABLE public.unidades_medida IS 'Tabela global de unidades de medida. Sem empresa_id — compartilhada por todos os tenants.';
COMMENT ON COLUMN public.unidades_medida.fator_conversao IS 'Fator para converter esta unidade para a unidade_base. Ex: kg → base g: fator=1000';

-- ============================================================
-- SEED: Unidades padrão
-- ============================================================

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
  ('Caixa',        'cx',  'un', 1,       'unidade'),  -- fator_conversao definido via quantidade_por_embalagem no insumo
  ('Pacote',       'pct', 'un', 1,       'unidade'),
  ('Fatia',        'ft',  'un', 1,       'unidade'),
  ('Dúzia',        'dz',  'un', 12,      'unidade'),
  ('Bandeja',      'bdj', 'un', 1,       'unidade')
ON CONFLICT (simbolo) DO NOTHING;
