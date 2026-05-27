ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Opcional: inicializar com a ordem atual baseada na criaÃ§Ã£o para manter a consistÃªncia inicial
UPDATE public.products SET sort_order = 0 WHERE sort_order IS NULL;
