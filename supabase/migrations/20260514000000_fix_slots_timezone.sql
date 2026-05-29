-- ============================================================
-- Migration: Corrigir timezone na funÃ§Ã£o get_slots_disponiveis
-- Data: 2026-05-14
-- Problema: A funÃ§Ã£o gerava slots em UTC, mas os horÃ¡rios de
-- funcionamento sÃ£o cadastrados pensando em horÃ¡rio de BrasÃ­lia.
-- Isso causava divergÃªncia de 3 horas nos horÃ¡rios exibidos.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_slots_disponiveis(
    p_empresa_id        UUID,
    p_profissional_id   UUID,
    p_servico_id        UUID,
    p_data              DATE
)
RETURNS TABLE (
    slot_inicio TIMESTAMPTZ,
    slot_fim    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_duracao_min   INTEGER;
    v_dia_semana    INTEGER;
    v_abertura      TIME;
    v_fechamento    TIME;
    v_intervalo     INTEGER;
    v_slot_inicio   TIMESTAMPTZ;
    v_slot_fim      TIMESTAMPTZ;
    v_hora_atual    TIME;
BEGIN
    -- DuraÃ§Ã£o do serviÃ§o
    SELECT duracao_min INTO v_duracao_min FROM public.servicos WHERE id = p_servico_id;
    IF v_duracao_min IS NULL THEN RETURN; END IF;

    -- Dia da semana (0=domingo)
    v_dia_semana := EXTRACT(DOW FROM p_data);

    -- HorÃ¡rio de funcionamento (profissional especÃ­fico ou da loja)
    SELECT hora_abertura, hora_fechamento, intervalo_min
    INTO v_abertura, v_fechamento, v_intervalo
    FROM public.horarios_funcionamento
    WHERE empresa_id = p_empresa_id
      AND ativo = true
      AND dia_semana = v_dia_semana
      AND (profissional_id = p_profissional_id OR profissional_id IS NULL)
    ORDER BY profissional_id NULLS LAST -- Preferir configuraÃ§Ã£o especÃ­fica do profissional
    LIMIT 1;

    IF v_abertura IS NULL THEN RETURN; END IF; -- NÃ£o funciona neste dia

    -- Iterar pelos slots
    v_hora_atual := v_abertura;
    WHILE (v_hora_atual + (v_duracao_min || ' minutes')::INTERVAL <= v_fechamento) LOOP
        -- CORREÃ‡ÃƒO: Interpretar horÃ¡rio como America/Sao_Paulo (BrasÃ­lia)
        -- Antes: (p_data::TEXT || ' ' || v_hora_atual::TEXT)::TIMESTAMPTZ â†’ interpretava como UTC
        -- Agora: usando AT TIME ZONE para converter corretamente de horÃ¡rio local para UTC
        v_slot_inicio := ((p_data::TEXT || ' ' || v_hora_atual::TEXT)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');
        v_slot_fim    := v_slot_inicio + (v_duracao_min || ' minutes')::INTERVAL;

        -- Verificar se o slot estÃ¡ livre (nÃ£o conflita com agendamentos existentes)
        IF NOT EXISTS (
            SELECT 1 FROM public.agendamentos
            WHERE profissional_id = p_profissional_id
              AND status NOT IN ('cancelado', 'no_show')
              AND data_hora_inicio < v_slot_fim
              AND data_hora_fim > v_slot_inicio
        ) THEN
            slot_inicio := v_slot_inicio;
            slot_fim    := v_slot_fim;
            RETURN NEXT;
        END IF;

        -- AvanÃ§ar: duraÃ§Ã£o do serviÃ§o + intervalo de descanso
        v_hora_atual := v_hora_atual + ((v_duracao_min + COALESCE(v_intervalo, 0)) || ' minutes')::INTERVAL;
    END LOOP;
END;
$$;
