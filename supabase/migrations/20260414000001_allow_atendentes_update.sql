-- Permite que usuÃ¡rios anÃ´nimos (o site rodando sem Supabase Auth) consigam
-- atualizar a tabela de atendentes. Sem essa permissÃ£o, o salvamento do 
-- token do OneSignal estava sendo bloqueado silenciosamente.

CREATE POLICY "Anyone can update atendentes" ON public.atendentes
    FOR UPDATE USING (true) 
    WITH CHECK (true);
