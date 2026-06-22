-- ============================================================
-- Migration: Proteção contra agendamento simultâneo (race condition)
-- Data: 2026-06-19
-- Estratégia: EXCLUSION CONSTRAINT com btree_gist
-- Garante atomicamente que nenhum profissional tenha dois
-- agendamentos ativos com intervalo de tempo sobreposto.
-- ============================================================

-- 1. Habilitar extensão necessária para o operador de igualdade em UUID
--    dentro de exclusion constraints (btree_gist).
--    Supabase já tem gist disponível; btree_gist adiciona suporte
--    a tipos escalares (UUID, TEXT, etc.) combinados com ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Adicionar EXCLUSION CONSTRAINT na tabela agendamentos.
--    Lógica:
--      - Para o MESMO profissional_id (operador =)
--      - Se os intervalos tstzrange SE SOBREPÕEM (operador &&)
--      - APENAS para agendamentos ativos (WHERE exclui cancelado e no_show)
--    → O banco rejeita o INSERT/UPDATE com erro de constraint violation.
--
--    tstzrange(inicio, fim, '[)') = intervalo fechado no início, aberto no fim.
--    Isso garante que slots adjacentes (08:30-09:00 e 09:00-09:30)
--    NÃO são considerados conflitantes (o operador && com '[)' é correto).
ALTER TABLE public.agendamentos
ADD CONSTRAINT agendamentos_no_overlap
EXCLUDE USING gist (
    profissional_id WITH =,
    tstzrange(data_hora_inicio, data_hora_fim, '[)') WITH &&
)
WHERE (status NOT IN ('cancelado', 'no_show'));

-- 3. Comentário explicativo para futura referência
COMMENT ON CONSTRAINT agendamentos_no_overlap ON public.agendamentos IS
'Impede que o mesmo profissional tenha dois agendamentos ativos com horários sobrepostos. Agendamentos cancelados e no_show são ignorados pela constraint (partial exclusion).';
