-- ============================================================
-- Migration: Módulos de Agendamento para Barbearia
-- Data: 2026-04-29
-- Inclui: profissionais, serviços, agendamentos,
--         horários de funcionamento e lista de espera
-- Arquitetura: Multi-barbeiro desde o início
-- ============================================================


-- ============================================================
-- TABELA: profissionais
-- Cada barbeiro/profissional do tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profissionais (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome        TEXT        NOT NULL,
    foto_url    TEXT,
    especialidade TEXT,
    bio         TEXT,
    ativo       BOOLEAN     NOT NULL DEFAULT true,
    cor_agenda  TEXT        DEFAULT '#E5B25D', -- Cor para identificar no calendário
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_profissionais_empresa_id ON public.profissionais(empresa_id);

-- RLS: Leitura pública (para página de agendamento do cliente)
CREATE POLICY "profissionais_public_read" ON public.profissionais
    FOR SELECT USING (ativo = true);

-- RLS: Admin da empresa gerencia seus profissionais
CREATE POLICY "profissionais_admin_all" ON public.profissionais
    FOR ALL USING (empresa_id = public.get_empresa_id())
    WITH CHECK (empresa_id = public.get_empresa_id());


-- ============================================================
-- TABELA: servicos
-- Serviços oferecidos (corte, barba, progressiva, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.servicos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome            TEXT        NOT NULL,
    descricao       TEXT,
    duracao_min     INTEGER     NOT NULL DEFAULT 30, -- Duração em minutos
    preco           NUMERIC(10,2) NOT NULL DEFAULT 0,
    foto_url        TEXT,
    ativo           BOOLEAN     NOT NULL DEFAULT true,
    ordem           INTEGER     DEFAULT 0,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_servicos_empresa_id ON public.servicos(empresa_id);

-- RLS: Leitura pública
CREATE POLICY "servicos_public_read" ON public.servicos
    FOR SELECT USING (ativo = true);

-- RLS: Admin gerencia
CREATE POLICY "servicos_admin_all" ON public.servicos
    FOR ALL USING (empresa_id = public.get_empresa_id())
    WITH CHECK (empresa_id = public.get_empresa_id());


-- ============================================================
-- TABELA: profissional_servicos
-- Quais serviços cada profissional realiza
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profissional_servicos (
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
    servico_id      UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
    PRIMARY KEY (profissional_id, servico_id)
);

ALTER TABLE public.profissional_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profissional_servicos_public_read" ON public.profissional_servicos
    FOR SELECT USING (true);

CREATE POLICY "profissional_servicos_admin_all" ON public.profissional_servicos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profissionais p
            WHERE p.id = profissional_id AND p.empresa_id = public.get_empresa_id()
        )
    );


-- ============================================================
-- TABELA: horarios_funcionamento
-- Horário de funcionamento por dia da semana
-- dia_semana: 0=Domingo, 1=Segunda ... 6=Sábado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.horarios_funcionamento (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    profissional_id UUID        REFERENCES public.profissionais(id) ON DELETE CASCADE, -- NULL = toda a loja
    dia_semana      INTEGER     NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_abertura   TIME        NOT NULL DEFAULT '09:00',
    hora_fechamento TIME        NOT NULL DEFAULT '19:00',
    intervalo_min   INTEGER     NOT NULL DEFAULT 0, -- Intervalo de descanso entre atendimentos
    ativo           BOOLEAN     NOT NULL DEFAULT true,
    UNIQUE (empresa_id, profissional_id, dia_semana)
);

ALTER TABLE public.horarios_funcionamento ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_horarios_empresa_id ON public.horarios_funcionamento(empresa_id);

CREATE POLICY "horarios_public_read" ON public.horarios_funcionamento
    FOR SELECT USING (ativo = true);

CREATE POLICY "horarios_admin_all" ON public.horarios_funcionamento
    FOR ALL USING (empresa_id = public.get_empresa_id())
    WITH CHECK (empresa_id = public.get_empresa_id());


-- ============================================================
-- TABELA: agendamentos
-- Agendamentos dos clientes
-- status: pendente | confirmado | em_andamento | concluido | cancelado | no_show
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    profissional_id     UUID        NOT NULL REFERENCES public.profissionais(id),
    servico_id          UUID        NOT NULL REFERENCES public.servicos(id),
    -- Dados do cliente (sem necessidade de conta)
    cliente_nome        TEXT        NOT NULL,
    cliente_telefone    TEXT        NOT NULL,
    cliente_email       TEXT,
    -- Dados do agendamento
    data_hora_inicio    TIMESTAMPTZ NOT NULL,
    data_hora_fim       TIMESTAMPTZ NOT NULL, -- Calculado: início + duração do serviço
    status              TEXT        NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','confirmado','em_andamento','concluido','cancelado','no_show')),
    observacao          TEXT,
    -- Rastreamento
    cancelado_por       TEXT,       -- 'cliente' | 'admin'
    motivo_cancelamento TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa_id ON public.agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON public.agendamentos(data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional ON public.agendamentos(profissional_id, data_hora_inicio);

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.update_agendamento_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agendamentos_updated
    BEFORE UPDATE ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.update_agendamento_timestamp();

-- RLS: Cliente anônimo pode criar e ver seus próprios agendamentos (via telefone)
CREATE POLICY "agendamentos_public_insert" ON public.agendamentos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "agendamentos_public_read" ON public.agendamentos
    FOR SELECT USING (true); -- Slots ocupados precisam ser visíveis publicamente para calcular disponibilidade

-- RLS: Admin gerencia todos os agendamentos da sua empresa
CREATE POLICY "agendamentos_admin_all" ON public.agendamentos
    FOR ALL USING (empresa_id = public.get_empresa_id())
    WITH CHECK (empresa_id = public.get_empresa_id());


-- ============================================================
-- TABELA: lista_espera
-- Clientes aguardando um horário vago
-- status: aguardando | notificado | confirmado | expirado | cancelado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lista_espera (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id              UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    servico_id              UUID        NOT NULL REFERENCES public.servicos(id),
    profissional_id_pref    UUID        REFERENCES public.profissionais(id), -- NULL = qualquer profissional
    cliente_nome            TEXT        NOT NULL,
    cliente_telefone        TEXT        NOT NULL,
    cliente_email           TEXT,
    data_desejada           DATE,       -- NULL = qualquer data disponível
    status                  TEXT        NOT NULL DEFAULT 'aguardando'
                                CHECK (status IN ('aguardando','notificado','confirmado','expirado','cancelado')),
    notificado_em           TIMESTAMPTZ,
    expira_em               TIMESTAMPTZ,-- Após este horário, passa para o próximo da fila
    agendamento_id          UUID        REFERENCES public.agendamentos(id), -- Preenchido ao confirmar
    posicao                 INTEGER,    -- Posição na fila
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lista_espera_empresa_id ON public.lista_espera(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_status ON public.lista_espera(empresa_id, status);

CREATE POLICY "lista_espera_public_insert" ON public.lista_espera
    FOR INSERT WITH CHECK (true);

CREATE POLICY "lista_espera_admin_all" ON public.lista_espera
    FOR ALL USING (empresa_id = public.get_empresa_id())
    WITH CHECK (empresa_id = public.get_empresa_id());


-- ============================================================
-- TABELA: mensagens_templates
-- Templates de mensagens configuráveis
-- tipos: confirmacao | lembrete | vaga_liberada | cancelamento | pos_atendimento
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mensagens_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo        TEXT        NOT NULL,
    titulo      TEXT        NOT NULL,
    conteudo    TEXT        NOT NULL,
    ativo       BOOLEAN     NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, tipo)
);

ALTER TABLE public.mensagens_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens_templates_admin_all" ON public.mensagens_templates
    FOR ALL USING (empresa_id = public.get_empresa_id())
    WITH CHECK (empresa_id = public.get_empresa_id());

-- Templates padrão serão inseridos via função RPC ao criar a empresa
-- (para não poluir esta migração com dados específicos de tenant)


-- ============================================================
-- FUNÇÃO RPC: Calcular slots disponíveis
-- Retorna horários livres para um profissional em uma data
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
    -- Duração do serviço
    SELECT duracao_min INTO v_duracao_min FROM public.servicos WHERE id = p_servico_id;
    IF v_duracao_min IS NULL THEN RETURN; END IF;

    -- Dia da semana (0=domingo)
    v_dia_semana := EXTRACT(DOW FROM p_data);

    -- Horário de funcionamento (profissional específico ou da loja)
    SELECT hora_abertura, hora_fechamento, intervalo_min
    INTO v_abertura, v_fechamento, v_intervalo
    FROM public.horarios_funcionamento
    WHERE empresa_id = p_empresa_id
      AND ativo = true
      AND dia_semana = v_dia_semana
      AND (profissional_id = p_profissional_id OR profissional_id IS NULL)
    ORDER BY profissional_id NULLS LAST -- Preferir configuração específica do profissional
    LIMIT 1;

    IF v_abertura IS NULL THEN RETURN; END IF; -- Não funciona neste dia

    -- Iterar pelos slots
    v_hora_atual := v_abertura;
    WHILE (v_hora_atual + (v_duracao_min || ' minutes')::INTERVAL <= v_fechamento) LOOP
        v_slot_inicio := (p_data::TEXT || ' ' || v_hora_atual::TEXT)::TIMESTAMPTZ;
        v_slot_fim    := v_slot_inicio + (v_duracao_min || ' minutes')::INTERVAL;

        -- Verificar se o slot está livre (não conflita com agendamentos existentes)
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

        -- Avançar: duração do serviço + intervalo de descanso
        v_hora_atual := v_hora_atual + ((v_duracao_min + COALESCE(v_intervalo, 0)) || ' minutes')::INTERVAL;
    END LOOP;
END;
$$;
