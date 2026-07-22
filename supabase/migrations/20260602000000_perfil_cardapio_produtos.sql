-- ============================================================
-- MÓDULO CLIENTES PREMIUM — Associação de Produtos a Perfis
-- ============================================================

-- 1. Cria a tabela de relacionamento (N:N)
CREATE TABLE IF NOT EXISTS public.perfil_cardapio_produtos (
  perfil_id UUID NOT NULL REFERENCES public.perfis_cardapio(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (perfil_id, product_id)
);

-- 2. Habilita RLS (Row Level Security)
ALTER TABLE public.perfil_cardapio_produtos ENABLE ROW LEVEL SECURITY;

-- 3. Cria a política de acesso irrestrito para usuários logados
-- (pois as chaves de relacionamento já filtram os perfis por empresa na origem)
DROP POLICY IF EXISTS "Enable all actions for authenticated users" ON public.perfil_cardapio_produtos;
CREATE POLICY "Enable all actions for authenticated users" 
ON public.perfil_cardapio_produtos FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 4. Cria política para clientes visualizarem publicamente (se necessário no cardápio)
DROP POLICY IF EXISTS "Enable read access for all" ON public.perfil_cardapio_produtos;
CREATE POLICY "Enable read access for all" 
ON public.perfil_cardapio_produtos FOR SELECT
USING (true);
