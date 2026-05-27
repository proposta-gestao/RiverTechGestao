-- ============================================================
-- Migration: Habilitar Realtime para tabelas de agendamento
-- Data: 2026-05-14
-- Problema: As tabelas agendamentos e lista_espera nÃ£o estavam
-- na publicaÃ§Ã£o supabase_realtime, impedindo atualizaÃ§Ãµes em
-- tempo real no painel admin.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE agendamentos, lista_espera;
