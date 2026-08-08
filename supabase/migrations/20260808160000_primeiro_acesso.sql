-- Add senha_alterada column to usuarios and admin_users tables
-- DEFAULT false means all existing users will be prompted to change their password on next login

ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS senha_alterada BOOLEAN DEFAULT false;

ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS senha_alterada BOOLEAN DEFAULT false;
