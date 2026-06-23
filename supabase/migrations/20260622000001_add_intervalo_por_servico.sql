-- ============================================================
-- Migration: Intervalo por Serviço
-- Data: 2026-06-22
-- Adiciona coluna intervalo_min na tabela servicos.
-- NULL = usa o intervalo do horário de funcionamento (retrocompatível).
-- Valor preenchido = sobrescreve o intervalo da agenda para este serviço.
-- ============================================================

ALTER TABLE public.servicos
ADD COLUMN IF NOT EXISTS intervalo_min INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.servicos.intervalo_min IS
'Intervalo após o atendimento (em minutos). NULL = usar o intervalo configurado no horário de funcionamento do profissional/empresa. Valor preenchido = sobrescreve.';
