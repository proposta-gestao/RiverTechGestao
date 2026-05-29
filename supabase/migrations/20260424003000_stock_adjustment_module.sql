-- Tabela de motivos de estoque
CREATE TABLE IF NOT EXISTS public.stock_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.stock_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem tudo em stock_reasons" ON public.stock_reasons
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inserir motivos padrÃ£o
INSERT INTO public.stock_reasons (name) VALUES 
('Produto Vencido'),
('Avaria'),
('Uso Interno'),
('Erro de Contagem'),
('DevoluÃ§Ã£o de Fornecedor')
ON CONFLICT DO NOTHING;

-- Atualizar stock_movements para incluir motivo e observaÃ§Ã£o se necessÃ¡rio
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS reason_id UUID REFERENCES public.stock_reasons(id);
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS notes TEXT;
