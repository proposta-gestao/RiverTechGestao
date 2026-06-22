-- ============================================================
-- Migration: Refatoração do Motor de Slots (Disponibilidade Real)
-- Data: 2026-06-22
-- Descrição: Substitui a grade fixa de slots por uma grade dinâmica (Gap-Based).
-- O cursor agora pula inteligentemente para o final do agendamento conflitante,
-- resolvendo os "buracos invisíveis" e respeitando o intervalo de descanso.
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
    v_fim_conflito  TIMESTAMPTZ;
    v_next_hora     TIME;
BEGIN
    -- Duração do serviço
    SELECT duracao_min INTO v_duracao_min FROM public.servicos WHERE id = p_servico_id;
    IF v_duracao_min IS NULL OR v_duracao_min <= 0 THEN RETURN; END IF;

    -- Dia da semana (0=domingo)
    v_dia_semana := EXTRACT(DOW FROM p_data);

    -- Horário de funcionamento
    SELECT hora_abertura, hora_fechamento, intervalo_min
    INTO v_abertura, v_fechamento, v_intervalo
    FROM public.horarios_funcionamento
    WHERE empresa_id = p_empresa_id
      AND ativo = true
      AND dia_semana = v_dia_semana
      AND (profissional_id = p_profissional_id OR profissional_id IS NULL)
    ORDER BY profissional_id NULLS LAST
    LIMIT 1;

    IF v_abertura IS NULL THEN RETURN; END IF;

    v_hora_atual := v_abertura;
    
    WHILE (v_hora_atual + (v_duracao_min || ' minutes')::INTERVAL <= v_fechamento) LOOP
        v_slot_inicio := ((p_data::TEXT || ' ' || v_hora_atual::TEXT)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');
        v_slot_fim    := v_slot_inicio + (v_duracao_min || ' minutes')::INTERVAL;

        -- Verificar conflito: pegamos o agendamento conflitante que termina mais tarde
        -- (Isso garante que ultrapassamos a maior sobreposição possível)
        SELECT data_hora_fim INTO v_fim_conflito
        FROM public.agendamentos
        WHERE profissional_id = p_profissional_id
          AND status NOT IN ('cancelado', 'no_show')
          AND data_hora_inicio < v_slot_fim
          AND data_hora_fim > v_slot_inicio
        ORDER BY data_hora_fim DESC
        LIMIT 1;

        IF v_fim_conflito IS NOT NULL THEN
            -- HOUVE CONFLITO:
            -- Em vez de chutar o próximo horário da grade fixa, pulamos exatamente para
            -- quando o conflito termina. Adicionamos v_intervalo para respeitar a pausa
            -- do agendamento que acabou de acontecer.
            -- Isso também facilita futura implementação de "intervalo por serviço",
            -- pois basta trocar v_intervalo pelo intervalo configurado no serviço.
            
            v_next_hora := (v_fim_conflito AT TIME ZONE 'America/Sao_Paulo')::TIME 
                            + (COALESCE(v_intervalo, 0) || ' minutes')::INTERVAL;
            
            -- Proteção contra "wrap around" de meia-noite ou loop infinito
            IF v_next_hora <= v_hora_atual THEN
                EXIT;
            END IF;
            
            v_hora_atual := v_next_hora;
        ELSE
            -- LIVRE:
            -- Emite o slot para o cliente.
            slot_inicio := v_slot_inicio;
            slot_fim    := v_slot_fim;
            RETURN NEXT;
            
            -- Avança o cursor para criar uma grade "empacotada" adjacente a este slot livre.
            v_next_hora := v_hora_atual + ((v_duracao_min + COALESCE(v_intervalo, 0)) || ' minutes')::INTERVAL;
            
            -- Proteção contra "wrap around" de meia-noite
            IF v_next_hora <= v_hora_atual THEN
                EXIT;
            END IF;
            
            v_hora_atual := v_next_hora;
        END IF;

    END LOOP;
END;
$$;
