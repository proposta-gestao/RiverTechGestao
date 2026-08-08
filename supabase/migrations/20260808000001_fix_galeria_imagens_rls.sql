-- ============================================================
-- Fix: Permitir que Super Admins alterem e excluam galeria_imagens
-- ============================================================

-- 1. Atualizar RPC de deleção para aceitar Super Admins
CREATE OR REPLACE FUNCTION public.delete_galeria_by_produto(p_produto_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.galeria_imagens 
    WHERE produto_id = p_produto_id 
    AND (
        empresa_id = public.get_empresa_id() 
        OR public.is_super_admin(auth.uid())
    );
END;
$$;

-- 2. Adicionar política de UPDATE para galeria_imagens (que estava faltando)
DROP POLICY IF EXISTS "Users can update own tenant images" ON public.galeria_imagens;
CREATE POLICY "Users can update own tenant images" 
ON public.galeria_imagens FOR UPDATE 
USING (
    empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid())
);

-- 3. Atualizar política de DELETE para permitir Super Admins
DROP POLICY IF EXISTS "Users can delete own tenant images" ON public.galeria_imagens;
CREATE POLICY "Users can delete own tenant images" 
ON public.galeria_imagens FOR DELETE 
USING (
    empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid())
);

-- 4. Atualizar política de INSERT para permitir Super Admins
DROP POLICY IF EXISTS "Users can insert own tenant images" ON public.galeria_imagens;
CREATE POLICY "Users can insert own tenant images" 
ON public.galeria_imagens FOR INSERT 
WITH CHECK (
    empresa_id = public.get_empresa_id() OR public.is_super_admin(auth.uid())
);

-- Notificar o PostgREST para recarregar as permissões
NOTIFY pgrst, 'reload schema';
