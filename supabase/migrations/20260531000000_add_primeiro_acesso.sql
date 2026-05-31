-- Adiciona a coluna primeiro_acesso para controle de troca de senha no primeiro login
ALTER TABLE public.clientes_premium ADD COLUMN IF NOT EXISTS primeiro_acesso BOOLEAN DEFAULT true;
