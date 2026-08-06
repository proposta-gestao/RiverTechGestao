-- ============================================================
-- RPC para Deletar Usuário da Empresa (Tanto do public quanto do auth)
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_entirely(p_user_id uuid)
RETURNS void AS $$
DECLARE
    v_caller_empresa_id uuid;
    v_target_empresa_id uuid;
    v_caller_is_super boolean;
BEGIN
    -- Obter empresa_id do alvo (se existir)
    SELECT empresa_id INTO v_target_empresa_id FROM public.usuarios WHERE id = p_user_id;
    
    -- Obter se o chamador é super_admin
    SELECT public.is_super_admin(auth.uid()) INTO v_caller_is_super;
    
    -- Obter empresa_id do chamador
    SELECT public.get_empresa_id() INTO v_caller_empresa_id;
    
    -- Verificar permissão: o chamador deve ser super_admin OU pertencer à mesma empresa do alvo
    IF v_caller_is_super OR (v_caller_empresa_id IS NOT NULL AND v_caller_empresa_id = v_target_empresa_id) THEN
        -- Deleta das tabelas públicas relacionadas que possam não ter CASCADE
        DELETE FROM public.admin_users WHERE user_id = p_user_id;
        DELETE FROM public.usuarios WHERE id = p_user_id;
        
        -- Deleta da tabela de autenticação
        DELETE FROM auth.users WHERE id = p_user_id;
    ELSE
        RAISE EXCEPTION 'Acesso negado: você não tem permissão para excluir este usuário.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.delete_user_entirely FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_entirely TO authenticated;
