# Arquitetura — Conta Corrente Premium (VIP)

## Visão Geral do Fluxo

```
Cliente VIP chega → Abre Comanda → Consumo (pedidos)
    → Fechamento da Comanda
        → Baixa Estoque
        → Caixa: "Lançar em Conta" OU "Cortesia Casa"
        → Lança Débito no Ledger (ou Abono direto)
    → Saldo Devedor Atualizado
        → Cliente Paga (parcial/total)
        → OU Gerente Abona (parcial/total)
    → Saldo Atualizado
```

---

## 1. Modelo de Dados

### Tabelas Existentes (Alterações)

#### `clientes_premium` — Adicionar coluna
```sql
ALTER TABLE clientes_premium
  ADD COLUMN saldo_devedor DECIMAL(12,2) DEFAULT 0.00;
```
> Campo desnormalizado para leitura rápida do saldo. O valor "verdade" vive no ledger, mas esse campo evita SUM() em toda consulta de listagem.

#### `comandas` — Adicionar coluna
```sql
ALTER TABLE comandas
  ADD COLUMN lancado_em_conta BOOLEAN DEFAULT FALSE;
```
> Flag de controle para garantir que a comanda foi contabilizada no ledger uma única vez. Previne lançamento duplicado.

---

### Novas Tabelas

#### `conta_corrente_movimentos` (Ledger / Livro-Razão)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador único |
| `empresa_id` | uuid (FK) | Tenant |
| `cliente_premium_id` | uuid (FK) | Cliente vinculado |
| `tipo` | enum | `debito` / `credito` |
| `valor` | decimal(12,2) | Valor do movimento (sempre positivo) |
| `saldo_anterior` | decimal(12,2) | Saldo antes do movimento |
| `saldo_posterior` | decimal(12,2) | Saldo após o movimento |
| `referencia_tipo` | enum | `comanda` / `pagamento` / `abono` / `ajuste` / `estorno` |
| `referencia_id` | uuid (nullable) | ID da comanda, pagamento ou abono |
| `descricao` | text | Ex: "Comanda #A3F2 — 15/06/2026" |
| `created_at` | timestamptz | Data/hora do lançamento |
| `created_by` | text | Usuário/admin que registrou |

```sql
CREATE TABLE conta_corrente_movimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    cliente_premium_id UUID NOT NULL REFERENCES clientes_premium(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('debito', 'credito')),
    valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),
    saldo_anterior DECIMAL(12,2) NOT NULL DEFAULT 0,
    saldo_posterior DECIMAL(12,2) NOT NULL DEFAULT 0,
    referencia_tipo VARCHAR(20) NOT NULL CHECK (referencia_tipo IN ('comanda', 'pagamento', 'abono', 'ajuste', 'estorno')),
    referencia_id UUID,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX idx_cc_mov_cliente ON conta_corrente_movimentos(cliente_premium_id, created_at DESC);
CREATE INDEX idx_cc_mov_empresa ON conta_corrente_movimentos(empresa_id);
```

#### `pagamentos_premium` (Registro de Pagamentos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador único |
| `empresa_id` | uuid (FK) | Tenant |
| `cliente_premium_id` | uuid (FK) | Cliente vinculado |
| `valor` | decimal(12,2) | Valor pago |
| `forma_pagamento` | enum | `dinheiro` / `pix` / `cartao_credito` / `cartao_debito` / `transferencia` |
| `observacao` | text | Nota livre do operador |
| `created_at` | timestamptz | Data/hora do pagamento |
| `created_by` | text | Quem registrou |

```sql
CREATE TABLE pagamentos_premium (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    cliente_premium_id UUID NOT NULL REFERENCES clientes_premium(id) ON DELETE CASCADE,
    valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),
    forma_pagamento VARCHAR(20) NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia')),
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX idx_pgto_cliente ON pagamentos_premium(cliente_premium_id, created_at DESC);
```

#### `abonos_premium` (Registro de Abonos / Cortesias)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador único |
| `empresa_id` | uuid (FK) | Tenant |
| `cliente_premium_id` | uuid (FK) | Cliente vinculado |
| `comanda_id` | uuid (FK, nullable) | Comanda abonada (se abono no ato) |
| `valor` | decimal(12,2) | Valor abonado |
| `motivo` | enum | `cortesia_vip` / `parceria_permuta` / `erro_cozinha` / `marketing` / `outros` |
| `observacao` | text | Justificativa livre obrigatória |
| `autorizado_por` | text | Gerente/Admin que autorizou (obrigatório) |
| `pin_autorizacao` | text | Hash do PIN de autorização (comprovação) |
| `created_at` | timestamptz | Data/hora do abono |

```sql
CREATE TABLE abonos_premium (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    cliente_premium_id UUID NOT NULL REFERENCES clientes_premium(id) ON DELETE CASCADE,
    comanda_id UUID REFERENCES comandas(id),
    valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),
    motivo VARCHAR(30) NOT NULL CHECK (motivo IN ('cortesia_vip', 'parceria_permuta', 'erro_cozinha', 'marketing', 'outros')),
    observacao TEXT NOT NULL,
    autorizado_por TEXT NOT NULL,
    pin_autorizacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_abono_cliente ON abonos_premium(cliente_premium_id, created_at DESC);
CREATE INDEX idx_abono_empresa ON abonos_premium(empresa_id);
```

#### `motivos_abono` (Tabela de Motivos — Alimentável pelo Admin)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador único |
| `empresa_id` | uuid (FK) | Tenant |
| `codigo` | varchar(30) | Código interno (slug) |
| `nome` | varchar(100) | Nome de exibição |
| `ativo` | boolean | Se o motivo está disponível |
| `ordem` | int | Ordenação na lista |

```sql
CREATE TABLE motivos_abono (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    codigo VARCHAR(30) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    ordem INT DEFAULT 0,
    UNIQUE(empresa_id, codigo)
);

-- Seed inicial
INSERT INTO motivos_abono (empresa_id, codigo, nome, ordem) VALUES
    ('<empresa_id>', 'cortesia_vip', '🎁 Cortesia VIP', 1),
    ('<empresa_id>', 'parceria_permuta', '🤝 Parceria / Permuta', 2),
    ('<empresa_id>', 'erro_cozinha', '⚠️ Erro de Cozinha', 3),
    ('<empresa_id>', 'marketing', '📢 Marketing / Relacionamento', 4),
    ('<empresa_id>', 'outros', '📝 Outros', 99);
```

---

### Diagrama de Relacionamento

```
clientes_premium
    ├── comandas (1:N)
    │       └── orders (1:N)
    ├── conta_corrente_movimentos (1:N) ← LEDGER CENTRAL
    ├── pagamentos_premium (1:N) → gera crédito no ledger
    └── abonos_premium (1:N) → gera crédito no ledger
            └── motivos_abono (N:1)
```

---

## 2. Regras de Negócio

### 2.1 Fechamento da Comanda → Lançamento em Conta

```
QUANDO comanda.status muda para 'fechada':
  SE comanda.lancado_em_conta == FALSE:
    1. Calcular total_comanda = comanda.total_acumulado
    2. Buscar saldo_atual = clientes_premium.saldo_devedor
    3. Criar movimento no ledger:
       - tipo: 'debito'
       - valor: total_comanda
       - saldo_anterior: saldo_atual
       - saldo_posterior: saldo_atual + total_comanda
       - referencia_tipo: 'comanda'
       - referencia_id: comanda.id
    4. Atualizar clientes_premium.saldo_devedor += total_comanda
    5. Marcar comanda.lancado_em_conta = TRUE
    6. Registrar entrada no caixa: forma = 'conta_corrente'
```

> ⚠️ OPERAÇÃO ATÔMICA: Os passos 3-5 devem ocorrer dentro de uma transação (RPC Supabase).

### 2.2 Registro de Pagamento

```
QUANDO operador registra pagamento:
  1. Validar valor > 0
  2. Buscar saldo_atual = clientes_premium.saldo_devedor
  3. SE valor > saldo_atual → ALERTAR (permitir com confirmação)
  4. Criar registro em pagamentos_premium
  5. Criar movimento no ledger:
     - tipo: 'credito'
     - valor: valor_pago
     - saldo_anterior: saldo_atual
     - saldo_posterior: saldo_atual - valor_pago
     - referencia_tipo: 'pagamento'
     - referencia_id: pagamento.id
  6. Atualizar clientes_premium.saldo_devedor -= valor_pago
```

### 2.3 Abono — "Cortesia da Casa" (NOVO)

O abono pode ocorrer em **dois momentos distintos**:

#### Momento A: Abono no Ato (Fechamento da Comanda)

```
QUANDO gerente fecha comanda com forma "Cortesia Casa":
  1. EXIGIR autenticação de Gerente/Admin (PIN ou senha)
  2. EXIGIR seleção do motivo (da tabela motivos_abono)
  3. EXIGIR observação/justificativa (texto livre, obrigatório)
  4. Baixar estoque normalmente (o produto saiu)
  5. NÃO gerar débito na conta do cliente (saldo permanece igual)
  6. Criar registro em abonos_premium:
     - comanda_id: comanda.id
     - motivo: selecionado
     - observacao: preenchida
     - autorizado_por: nome do gerente
  7. Criar movimento no ledger (para rastreabilidade):
     - tipo: 'debito' → valor da comanda
     - referencia_tipo: 'comanda'
     IMEDIATAMENTE SEGUIDO DE:
     - tipo: 'credito' → mesmo valor (abono)
     - referencia_tipo: 'abono'
     - descricao: "Cortesia Casa — [motivo]"
     → Resultado: saldo_posterior == saldo_anterior (se anulam)
  8. Registrar no caixa: forma = 'cortesia_casa'
  9. Registrar no DRE como despesa: categoria = marketing/relacionamento
```

> IMPORTANTE: Mesmo no abono, os dois movimentos (débito + crédito) ficam
> registrados no ledger. Isso garante que o consumo existiu e foi rastreado,
> e o abono está documentado com autor e motivo.

#### Momento B: Abono no Perfil (Final do Mês / Retroativo)

```
QUANDO gerente abona saldo acumulado do cliente:
  1. EXIGIR autenticação de Gerente/Admin (PIN ou senha)
  2. Permitir abono PARCIAL ou TOTAL do saldo_devedor
  3. EXIGIR seleção do motivo (da tabela motivos_abono)
  4. EXIGIR observação/justificativa (texto livre, obrigatório)
  5. Buscar saldo_atual = clientes_premium.saldo_devedor
  6. Criar registro em abonos_premium:
     - comanda_id: NULL (abono retroativo)
     - valor: valor_abonado
     - motivo: selecionado
     - autorizado_por: nome do gerente
  7. Criar movimento no ledger:
     - tipo: 'credito'
     - valor: valor_abonado
     - saldo_anterior: saldo_atual
     - saldo_posterior: saldo_atual - valor_abonado
     - referencia_tipo: 'abono'
     - referencia_id: abono.id
     - descricao: "Abono [motivo] — Autorizado por [gerente]"
  8. Atualizar clientes_premium.saldo_devedor -= valor_abonado
  9. Registrar no DRE como despesa: categoria conforme motivo
```

### 2.4 Validações Críticas

| Regra | Descrição |
|-------|-----------|
| **Teto Mensal** | Se `saldo_devedor + total_comanda_atual > teto_mensal`, bloquear novos pedidos ou exigir aprovação do gerente |
| **Comanda Única** | Apenas 1 comanda aberta por cliente por vez |
| **Idempotência** | Flag `lancado_em_conta` impede lançamento duplicado |
| **Auditoria** | `saldo_anterior` e `saldo_posterior` no ledger permitem reconstruir o histórico completo |
| **Estorno** | Cancelamento de comanda após lançamento gera movimento tipo `estorno` (crédito) |
| **Alçada Abono** | Somente perfis Gerente/Admin podem executar abonos (validação por PIN) |
| **Justificativa** | Campo `observacao` é NOT NULL na tabela `abonos_premium` — não existe abono sem rastro |

### 2.5 Impacto Financeiro (DRE)

| Evento | Estoque | Faturamento Bruto | Conta Corrente | DRE |
|--------|---------|-------------------|----------------|-----|
| Comanda fechada (Lançar em Conta) | ✅ Baixa normal | ✅ Entra como venda | ✅ Débito no saldo | — |
| Comanda fechada (Cortesia Casa) | ✅ Baixa normal | ✅ Entra como venda | ⛔ Saldo não afetado | 📉 Despesa (motivo do abono) |
| Pagamento recebido | — | — | ✅ Crédito (baixa saldo) | 📈 Receita recebida |
| Abono retroativo (no perfil) | — | — | ✅ Crédito (baixa saldo) | 📉 Despesa (motivo do abono) |

> O produto SEMPRE sai do estoque (ele foi consumido).
> A diferença é se o valor é cobrado do cliente ou absorvido pela casa.

---

## 3. Implementação no Banco (Supabase RPCs)

### RPC — Fechar Comanda e Lançar em Conta

```sql
CREATE OR REPLACE FUNCTION fechar_comanda_e_lancar(
    p_comanda_id UUID,
    p_usuario TEXT
) RETURNS VOID AS $$
DECLARE
    v_cliente_id UUID;
    v_total DECIMAL(12,2);
    v_saldo_atual DECIMAL(12,2);
    v_lancado BOOLEAN;
BEGIN
    SELECT cliente_premium_id, total_acumulado, lancado_em_conta
    INTO v_cliente_id, v_total, v_lancado
    FROM comandas WHERE id = p_comanda_id;

    IF v_lancado THEN
        RAISE EXCEPTION 'Comanda já foi lançada em conta';
    END IF;

    SELECT saldo_devedor INTO v_saldo_atual
    FROM clientes_premium WHERE id = v_cliente_id
    FOR UPDATE;

    UPDATE comandas SET
        status = 'fechada',
        fechada_em = NOW(),
        fechada_por = p_usuario,
        lancado_em_conta = TRUE
    WHERE id = p_comanda_id;

    INSERT INTO conta_corrente_movimentos (
        empresa_id, cliente_premium_id, tipo, valor,
        saldo_anterior, saldo_posterior,
        referencia_tipo, referencia_id,
        descricao, created_by
    )
    SELECT empresa_id, v_cliente_id, 'debito', v_total,
        v_saldo_atual, v_saldo_atual + v_total,
        'comanda', p_comanda_id,
        'Comanda fechada em ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI'),
        p_usuario
    FROM comandas WHERE id = p_comanda_id;

    UPDATE clientes_premium
    SET saldo_devedor = v_saldo_atual + v_total
    WHERE id = v_cliente_id;
END;
$$ LANGUAGE plpgsql;
```

### RPC — Registrar Pagamento

```sql
CREATE OR REPLACE FUNCTION registrar_pagamento_premium(
    p_empresa_id UUID,
    p_cliente_id UUID,
    p_valor DECIMAL(12,2),
    p_forma TEXT,
    p_observacao TEXT,
    p_usuario TEXT
) RETURNS UUID AS $$
DECLARE
    v_saldo_atual DECIMAL(12,2);
    v_pgto_id UUID;
BEGIN
    SELECT saldo_devedor INTO v_saldo_atual
    FROM clientes_premium WHERE id = p_cliente_id
    FOR UPDATE;

    INSERT INTO pagamentos_premium (
        empresa_id, cliente_premium_id, valor,
        forma_pagamento, observacao, created_by
    ) VALUES (
        p_empresa_id, p_cliente_id, p_valor,
        p_forma, p_observacao, p_usuario
    ) RETURNING id INTO v_pgto_id;

    INSERT INTO conta_corrente_movimentos (
        empresa_id, cliente_premium_id, tipo, valor,
        saldo_anterior, saldo_posterior,
        referencia_tipo, referencia_id,
        descricao, created_by
    ) VALUES (
        p_empresa_id, p_cliente_id, 'credito', p_valor,
        v_saldo_atual, v_saldo_atual - p_valor,
        'pagamento', v_pgto_id,
        'Pagamento via ' || p_forma, p_usuario
    );

    UPDATE clientes_premium
    SET saldo_devedor = v_saldo_atual - p_valor
    WHERE id = p_cliente_id;

    RETURN v_pgto_id;
END;
$$ LANGUAGE plpgsql;
```

### RPC — Fechar Comanda como Cortesia (Abono no Ato)

```sql
CREATE OR REPLACE FUNCTION fechar_comanda_cortesia(
    p_comanda_id UUID,
    p_motivo TEXT,
    p_observacao TEXT,
    p_autorizado_por TEXT,
    p_empresa_id UUID
) RETURNS UUID AS $$
DECLARE
    v_cliente_id UUID;
    v_total DECIMAL(12,2);
    v_saldo_atual DECIMAL(12,2);
    v_abono_id UUID;
BEGIN
    SELECT cliente_premium_id, total_acumulado
    INTO v_cliente_id, v_total
    FROM comandas WHERE id = p_comanda_id;

    SELECT saldo_devedor INTO v_saldo_atual
    FROM clientes_premium WHERE id = v_cliente_id
    FOR UPDATE;

    -- 1. Fechar comanda
    UPDATE comandas SET
        status = 'fechada',
        fechada_em = NOW(),
        fechada_por = p_autorizado_por,
        lancado_em_conta = TRUE
    WHERE id = p_comanda_id;

    -- 2. Registrar abono
    INSERT INTO abonos_premium (
        empresa_id, cliente_premium_id, comanda_id,
        valor, motivo, observacao, autorizado_por
    ) VALUES (
        p_empresa_id, v_cliente_id, p_comanda_id,
        v_total, p_motivo, p_observacao, p_autorizado_por
    ) RETURNING id INTO v_abono_id;

    -- 3. Ledger: Débito (consumo aconteceu)
    INSERT INTO conta_corrente_movimentos (
        empresa_id, cliente_premium_id, tipo, valor,
        saldo_anterior, saldo_posterior,
        referencia_tipo, referencia_id,
        descricao, created_by
    ) VALUES (
        p_empresa_id, v_cliente_id, 'debito', v_total,
        v_saldo_atual, v_saldo_atual + v_total,
        'comanda', p_comanda_id,
        'Consumo Comanda (Cortesia Casa)', p_autorizado_por
    );

    -- 4. Ledger: Crédito imediato (abono anula o débito)
    INSERT INTO conta_corrente_movimentos (
        empresa_id, cliente_premium_id, tipo, valor,
        saldo_anterior, saldo_posterior,
        referencia_tipo, referencia_id,
        descricao, created_by
    ) VALUES (
        p_empresa_id, v_cliente_id, 'credito', v_total,
        v_saldo_atual + v_total, v_saldo_atual,
        'abono', v_abono_id,
        'Cortesia Casa — ' || p_motivo || ' — Aut: ' || p_autorizado_por,
        p_autorizado_por
    );

    -- 5. Saldo NÃO muda (débito + crédito se anulam)
    -- clientes_premium.saldo_devedor permanece igual

    RETURN v_abono_id;
END;
$$ LANGUAGE plpgsql;
```

### RPC — Abono Retroativo (No Perfil do Cliente)

```sql
CREATE OR REPLACE FUNCTION registrar_abono_premium(
    p_empresa_id UUID,
    p_cliente_id UUID,
    p_valor DECIMAL(12,2),
    p_motivo TEXT,
    p_observacao TEXT,
    p_autorizado_por TEXT
) RETURNS UUID AS $$
DECLARE
    v_saldo_atual DECIMAL(12,2);
    v_abono_id UUID;
BEGIN
    SELECT saldo_devedor INTO v_saldo_atual
    FROM clientes_premium WHERE id = p_cliente_id
    FOR UPDATE;

    IF p_valor > v_saldo_atual THEN
        RAISE EXCEPTION 'Valor do abono (%) excede o saldo devedor (%)', p_valor, v_saldo_atual;
    END IF;

    INSERT INTO abonos_premium (
        empresa_id, cliente_premium_id, comanda_id,
        valor, motivo, observacao, autorizado_por
    ) VALUES (
        p_empresa_id, p_cliente_id, NULL,
        p_valor, p_motivo, p_observacao, p_autorizado_por
    ) RETURNING id INTO v_abono_id;

    INSERT INTO conta_corrente_movimentos (
        empresa_id, cliente_premium_id, tipo, valor,
        saldo_anterior, saldo_posterior,
        referencia_tipo, referencia_id,
        descricao, created_by
    ) VALUES (
        p_empresa_id, p_cliente_id, 'credito', p_valor,
        v_saldo_atual, v_saldo_atual - p_valor,
        'abono', v_abono_id,
        'Abono ' || p_motivo || ' — Aut: ' || p_autorizado_por,
        p_autorizado_por
    );

    UPDATE clientes_premium
    SET saldo_devedor = v_saldo_atual - p_valor
    WHERE id = p_cliente_id;

    RETURN v_abono_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Arquitetura de Telas

### 4.1 Perfil do Cliente (Aprimorado)

```
┌─────────────────────────────────────────────────────┐
│  👑 João Silva                           ⭐ Premium  │
│  CPF: 123.456.789-00  |  Tel: (11) 99999-0000      │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Saldo Devedor│  │  Teto Mensal │  │ Consumido  │ │
│  │  R$ 1.450,00 │  │  R$ 5.000,00│  │   29%      │ │
│  │  🔴           │  │             │  │  ████░░░░  │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                      │
│  [💵 Registrar Pagamento] [📋 Extrato] [🎁 Abonar] │
│                                                      │
│  ── Últimos Movimentos ──────────────────────────── │
│  📅 31/05  🔴 Comanda #A3F2       - R$ 320,00       │
│  📅 30/05  🟢 Pagamento PIX       + R$ 500,00       │
│  📅 29/05  🟣 Abono Cortesia VIP  + R$ 180,00       │
│  📅 28/05  🔴 Comanda #D7E9       - R$ 450,00       │
└─────────────────────────────────────────────────────┘
```

### 4.2 Tela de Extrato Completo

```
┌─────────────────────────────────────────────────────────────┐
│  📒 Extrato — João Silva                                    │
├─────────────────────────────────────────────────────────────┤
│  Filtros: [📅 Período] [Tipo: Todos ▼]                      │
│           [🔍 Filtrar] [📥 Exportar Excel]                   │
├──────┬──────────────────────────┬─────────┬─────────────────┤
│ Data │ Descrição                │  Valor  │ Saldo Acumulado │
├──────┼──────────────────────────┼─────────┼─────────────────┤
│31/05 │ 🔴 Comanda #A3F2        │ -320,00 │   R$ 1.450,00   │
│30/05 │ 🟢 Pgto PIX             │ +500,00 │   R$ 1.130,00   │
│29/05 │ 🟣 Abono Cortesia VIP   │ +180,00 │   R$ 1.630,00   │
│  ""  │   ↳ Aut: Gerente Carlos │         │                  │
│  ""  │   ↳ Motivo: Cortesia    │         │                  │
│28/05 │ 🔴 Comanda #D7E9        │ -450,00 │   R$ 1.810,00   │
│25/05 │ 🟢 Pgto Dinheiro        │+1000,00 │   R$ 2.260,00   │
├──────┴──────────────────────────┴─────────┴─────────────────┤
│                            Saldo Atual: R$ 1.450,00         │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Modal de Registrar Pagamento

```
┌─────────────────────────────────────┐
│  💵 Registrar Pagamento             │
│  Cliente: João Silva                │
│  Saldo Devedor: R$ 1.450,00        │
├─────────────────────────────────────┤
│                                     │
│  Valor *                            │
│  ┌─────────────────────────────┐    │
│  │ R$ 0,00                     │    │
│  └─────────────────────────────┘    │
│  [ Pagar Tudo: R$ 1.450,00 ]       │
│                                     │
│  Forma de Pagamento *               │
│  ┌─────────────────────────────┐    │
│  │ 💳 PIX                  ▼  │    │
│  └─────────────────────────────┘    │
│                                     │
│  Observação                         │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Cancelar]          [✅ Confirmar] │
└─────────────────────────────────────┘
```

### 4.4 Modal de Abono (NOVO)

```
┌──────────────────────────────────────────┐
│  🎁 Abonar Conta — João Silva            │
│  Saldo Devedor: R$ 1.450,00             │
├──────────────────────────────────────────┤
│                                          │
│  🔐 Autorização do Gerente *             │
│  ┌──────────────────────────────────┐    │
│  │ PIN do Gerente: ****             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Valor do Abono *                        │
│  ┌──────────────────────────────────┐    │
│  │ R$ 0,00                          │    │
│  └──────────────────────────────────┘    │
│  [ Abonar Tudo: R$ 1.450,00 ]           │
│                                          │
│  Motivo do Abono *                       │
│  ┌──────────────────────────────────┐    │
│  │ 🎁 Cortesia VIP              ▼  │    │
│  │ 🤝 Parceria / Permuta           │    │
│  │ ⚠️ Erro de Cozinha              │    │
│  │ 📢 Marketing / Relacionamento   │    │
│  │ 📝 Outros                       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Justificativa / Observação *            │
│  ┌──────────────────────────────────┐    │
│  │ (campo obrigatório)              │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ⚠️ Esta ação será registrada como      │
│  despesa no DRE e não poderá ser         │
│  revertida sem estorno formal.           │
│                                          │
│  [Cancelar]    [🎁 Confirmar Abono]      │
└──────────────────────────────────────────┘
```

### 4.5 Fechamento de Comanda (Escolha de Forma)

```
┌───────────────────────────────────────────────┐
│  🔒 Fechar Comanda — João Silva               │
├───────────────────────────────────────────────┤
│                                               │
│  Total da Comanda:      R$ 320,00             │
│  Saldo Atual:           R$ 1.130,00           │
│                                               │
│  ┌── Resumo dos Itens ─────────────────┐     │
│  │ 2x Filé Mignon           R$ 180,00 │     │
│  │ 1x Vinho Tinto            R$ 90,00 │     │
│  │ 2x Sobremesa              R$ 50,00 │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  Como deseja fechar esta comanda?             │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │ 💳 Lançar em Conta                  │     │
│  │   Saldo passará para R$ 1.450,00    │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │ 🎁 Cortesia da Casa                 │     │
│  │   Requer autorização do gerente     │     │
│  │   Saldo permanecerá R$ 1.130,00     │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  [Cancelar]                                   │
└───────────────────────────────────────────────┘
```

### 4.6 Dashboard Gerencial — Visão Contas

```
┌────────────────────────────────────────────────────────┐
│  📊 Painel de Contas Correntes                         │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐│
│ │Total Devedor │ │ Clientes com │ │ Total Abonado    ││
│ │R$ 12.340,00  │ │ Saldo Aberto │ │ R$ 3.200,00      ││
│ │              │ │     8        │ │ (mês atual)      ││
│ └──────────────┘ └──────────────┘ └──────────────────┘│
│                                                        │
│ ── Clientes com Saldo Devedor ─────────────────────── │
│ │ Cliente        │ Saldo      │ Teto    │ % Usado │   │
│ │ João Silva     │ R$ 1.450   │ R$ 5k   │  29%    │   │
│ │ Maria Santos   │ R$ 2.100   │ R$ 3k   │  70% ⚠️│   │
│ │ Carlos Mendes  │ R$ 4.800   │ R$ 5k   │  96% 🔴│   │
│                                                        │
│ ── Últimos Abonos ─────────────────────────────────── │
│ │ Data  │ Cliente     │ Valor    │ Motivo    │ Aut.  ││
│ │ 29/05 │ João Silva  │ R$ 180   │ Cortesia  │ Carlos││
│ │ 25/05 │ Maria S.    │ R$ 500   │ Parceria  │ Admin ││
│                                                        │
│ ── Aging Report (Envelhecimento) ──────────────────── │
│ │ Faixa          │ Valor Total │ Qtd Clientes │       │
│ │ 0-30 dias      │ R$ 8.200    │ 5            │       │
│ │ 31-60 dias     │ R$ 3.140    │ 2            │       │
│ │ 61-90 dias     │ R$ 1.000    │ 1            │  ⚠️  │
└────────────────────────────────────────────────────────┘
```

---

## 5. Segurança & Auditoria

| Aspecto | Solução |
|---------|---------|
| **Imutabilidade do Ledger** | Tabela `conta_corrente_movimentos` NÃO permite UPDATE/DELETE via RLS. Correções geram novo movimento tipo `ajuste` ou `estorno` |
| **Concorrência** | `FOR UPDATE` no saldo do cliente previne race conditions |
| **Reconciliação** | `SUM(CASE tipo WHEN 'debito' THEN valor ELSE -valor END)` do ledger deve bater com `saldo_devedor` |
| **Rastreabilidade** | Cada movimento registra `created_by` e `created_at` |
| **Alçada de Abono** | Somente Gerente/Admin via PIN. Garçom NÃO tem acesso ao botão |
| **Justificativa** | `observacao` NOT NULL em `abonos_premium`. Sem abono sem rastro |
| **RLS** | Filtro por `empresa_id` em todas as tabelas novas |
| **DRE** | Abonos alimentam linha de despesa separada por motivo |

---

## 6. Ordem de Implementação Sugerida

| Fase | Escopo | Prioridade |
|------|--------|------------|
| **Fase 1** | Criar tabelas + RPCs no Supabase (incluindo abonos) | 🔴 Alta |
| **Fase 2** | Aprimorar fechamento de comanda (Lançar em Conta OU Cortesia Casa) | 🔴 Alta |
| **Fase 3** | Modal de Registrar Pagamento | 🔴 Alta |
| **Fase 4** | Modal de Abono (no perfil do cliente) | 🔴 Alta |
| **Fase 5** | Tela de Extrato do Cliente (com marcação visual de abonos) | 🟡 Média |
| **Fase 6** | Dashboard Gerencial (Painel de Contas + Relatório de Abonos) | 🟡 Média |
| **Fase 7** | Aging Report + Alertas de teto + Motivos configuráveis | 🟢 Complementar |
| **Fase 8** | Integração DRE (despesas por categoria de abono) | 🟢 Complementar |
