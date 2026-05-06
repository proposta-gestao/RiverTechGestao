-- Migration: Create Galeria Imagens Table
-- Data: 2026-05-05

CREATE TABLE IF NOT EXISTS public.galeria_imagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    tipo TEXT DEFAULT 'produto',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.galeria_imagens ENABLE ROW LEVEL SECURITY;

-- Policy: Select (Users can view their own tenant's images)
CREATE POLICY "Users can view own tenant images" 
ON public.galeria_imagens FOR SELECT 
USING (
    empresa_id = public.get_empresa_id()
);

-- Policy: Insert
CREATE POLICY "Users can insert own tenant images" 
ON public.galeria_imagens FOR INSERT 
WITH CHECK (
    empresa_id = public.get_empresa_id()
);

-- Policy: Delete
CREATE POLICY "Users can delete own tenant images" 
ON public.galeria_imagens FOR DELETE 
USING (
    empresa_id = public.get_empresa_id()
);

-- Force schema reload
NOTIFY pgrst, 'reload schema';
