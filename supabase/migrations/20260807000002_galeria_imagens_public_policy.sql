-- ============================================================
-- Migração: Adicionar política pública para galeria_imagens
-- Data: 2026-08-07
-- ============================================================

-- Permite que usuários anônimos (ou qualquer um) visualizem as imagens da galeria
-- O filtro por empresa é feito nas queries (ex: eq('empresa_id', ...))
CREATE POLICY "Public can view galeria_imagens" 
ON public.galeria_imagens FOR SELECT 
USING (true);

-- Notificar o PostgREST para recarregar as permissões
NOTIFY pgrst, 'reload schema';
