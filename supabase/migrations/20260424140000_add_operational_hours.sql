-- Adiciona colunas para horÃ¡rio de abertura e fechamento operacional
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '02:00';

COMMENT ON COLUMN public.store_settings.opening_time IS 'HorÃ¡rio de inÃ­cio do dia operacional';
COMMENT ON COLUMN public.store_settings.closing_time IS 'HorÃ¡rio de tÃ©rmino do dia operacional (pode ser menor que a abertura se atravessar a madrugada)';
