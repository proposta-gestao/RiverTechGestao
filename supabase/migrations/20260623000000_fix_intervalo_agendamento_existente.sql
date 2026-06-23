-- ============================================================
-- Migration: Corrige cálculo de disponibilidade com intervalo do agendamento existente
-- Data: 2026-06-23
--
-- PROBLEMA IDENTIFICADO:
--   A RPC anterior aplicava o intervalo do SERVIÇO CONSULTADO ao pular
--   sobre um conflito. Na prática, ignorava o intervalo do agendamento
--   já existente na agenda.
--
--   Exemplo:
--     Agendamento existente: Serviço A (30 min + 20 min intervalo) → 08:00–08:30
--     O profissional só fica livre às 08:50 (08:30 + 20 min do Serviço A).
--     Mas ao consultar Serviço C (sem intervalo), o sistema retornava 08:30.
--
-- SOLUÇÃO:
--   Dois intervalos distintos no loop:
--     1. v_intervalo_conflito: intervalo do SERVIÇO DO AGENDAMENTO EXISTENTE
--        → determina quando o profissional fica livre após um conflito
--        → COALESCE(servico_conflitante.intervalo_min, agenda.intervalo_min, 0)
--     2. v_intervalo_consultado: intervalo do SERVIÇO SENDO CONSULTADO
--        → espaça os slots GERADOS após um slot livre
--        → COALESCE(servico_consultado.intervalo_min, agenda.intervalo_min, 0)
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
    v_duracao_min           INTEGER;
    v_servico_intervalo     INTEGER; -- Intervalo do serviço consultado (NULL se não configurado)
    v_dia_semana            INTEGER;
    v_abertura              TIME;
    v_fechamento            TIME;
    v_agenda_intervalo      INTEGER; -- Intervalo padrão da agenda/profissional
    v_intervalo_consultado  INTEGER; -- Intervalo efetivo do serviço consultado
    v_slot_inicio           TIMESTAMPTZ;
    v_slot_fim              TIMESTAMPTZ;
    v_hora_atual            TIME;
    v_fim_conflito          TIMESTAMPTZ;
    v_intervalo_conflito    INTEGER; -- Intervalo do agendamento existente que gerou o conflito
    v_next_hora             TIME;
BEGIN
    -- Duração e intervalo do serviço consultado
    SELECT duracao_min, intervalo_min
    INTO v_duracao_min, v_servico_intervalo
    FROM public.servicos
    WHERE id = p_servico_id;

    IF v_duracao_min IS NULL OR v_duracao_min <= 0 THEN RETURN; END IF;

    -- Dia da semana (0=domingo)
    v_dia_semana := EXTRACT(DOW FROM p_data);

    -- Horário de funcionamento (abertura, fechamento e intervalo padrão da agenda)
    SELECT hora_abertura, hora_fechamento, intervalo_min
    INTO v_abertura, v_fechamento, v_agenda_intervalo
    FROM public.horarios_funcionamento
    WHERE empresa_id = p_empresa_id
      AND ativo = true
      AND dia_semana = v_dia_semana
      AND (profissional_id = p_profissional_id OR profissional_id IS NULL)
    ORDER BY profissional_id NULLS LAST
    LIMIT 1;

    IF v_abertura IS NULL THEN RETURN; END IF;

    -- Intervalo do serviço CONSULTADO (para espaçar os slots gerados)
    -- Prioridade: intervalo do serviço > intervalo da agenda > 0
    v_intervalo_consultado := COALESCE(v_servico_intervalo, v_agenda_intervalo, 0);

    v_hora_atual := v_abertura;

    WHILE (v_hora_atual + (v_duracao_min || ' minutes')::INTERVAL <= v_fechamento) LOOP
        v_slot_inicio := ((p_data::TEXT || ' ' || v_hora_atual::TEXT)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');
        v_slot_fim    := v_slot_inicio + (v_duracao_min || ' minutes')::INTERVAL;

        -- Verificar conflito.
        -- Busca o agendamento conflitante que termina MAIS TARDE.
        -- Também lê o intervalo do SERVIÇO desse agendamento existente,
        -- pois é ele quem determina até quando o profissional está de fato ocupado.
        SELECT
            a.data_hora_fim,
            COALESCE(s.intervalo_min, v_agenda_intervalo, 0)
        INTO
            v_fim_conflito,
            v_intervalo_conflito
        FROM public.agendamentos a
        LEFT JOIN public.servicos s ON s.id = a.servico_id
        WHERE a.profissional_id = p_profissional_id
          AND a.status NOT IN ('cancelado', 'no_show')
          AND a.data_hora_inicio < v_slot_fim
          AND a.data_hora_fim > v_slot_inicio
        ORDER BY a.data_hora_fim DESC
        LIMIT 1;

        IF v_fim_conflito IS NOT NULL THEN
            -- HOUVE CONFLITO:
            -- O profissional só fica livre quando o agendamento existente termina
            -- + o intervalo do SERVIÇO DAQUELE agendamento (não do serviço consultado).
            v_next_hora := (v_fim_conflito AT TIME ZONE 'America/Sao_Paulo')::TIME
                            + (v_intervalo_conflito || ' minutes')::INTERVAL;

            IF v_next_hora <= v_hora_atual THEN EXIT; END IF;
            v_hora_atual := v_next_hora;
            
            -- Limpa variáveis para o próximo loop
            v_fim_conflito       := NULL;
            v_intervalo_conflito := 0;
        ELSE
            -- LIVRE: emite o slot
            slot_inicio := v_slot_inicio;
            slot_fim    := v_slot_fim;
            RETURN NEXT;

            -- Avança o cursor usando o intervalo do SERVIÇO CONSULTADO
            -- (para espaçar os próximos slots gerados para este serviço)
            v_next_hora := v_hora_atual + ((v_duracao_min + v_intervalo_consultado) || ' minutes')::INTERVAL;

            IF v_next_hora <= v_hora_atual THEN EXIT; END IF;
            v_hora_atual := v_next_hora;
        END IF;

    END LOOP;
END;
$$;
