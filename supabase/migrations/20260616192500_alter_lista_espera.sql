-- Adiciona o campo de horarios preferenciais (JSON Array)
ALTER TABLE public.lista_espera
ADD COLUMN IF NOT EXISTS horarios_preferenciais JSONB;

-- Atualiza a constraint de status para incluir 'recusado'
ALTER TABLE public.lista_espera 
DROP CONSTRAINT IF EXISTS lista_espera_status_check;

ALTER TABLE public.lista_espera 
ADD CONSTRAINT lista_espera_status_check 
CHECK (status IN ('aguardando', 'notificado', 'confirmado', 'expirado', 'cancelado', 'recusado'));
