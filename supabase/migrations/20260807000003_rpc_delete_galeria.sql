-- ============================================================
-- Migração: Adicionar RPC para deletar imagens da galeria de forma segura
-- Data: 2026-08-07
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_galeria_by_produto(p_produto_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Deleta as imagens apenas se a empresa logada for a dona da imagem
    DELETE FROM public.galeria_imagens 
    WHERE produto_id = p_produto_id 
    AND empresa_id = public.get_empresa_id();
END;
$$;

-- Notificar o PostgREST para recarregar as permissões
NOTIFY pgrst, 'reload schema';
