# Fase 5 — Painel do Atendente (Integração VIP)

> **Referência**: [modulo area vip - plano.md](./modulo%20area%20vip%20-%20plano.md) → Fase 5 (Linhas 252-267)
> **Pré-requisitos concluídos**: Fase 1 a 4 ✅
> **Estimativa**: < 1 hora

---

## Objetivo

Garantir que os pedidos VIP (com `cliente_premium_id` e/ou `comanda_id`) tenham um destaque visual adequado no painel do atendente (cozinha/bar) para que os funcionários reconheçam o tratamento VIP e saibam que a cobrança será via comanda.

---

## Escopo Detalhado

### 5.1 — Identificação VIP no Card do Pedido (atendente.js)

**Onde**: Na função `createOrderCard(order)`.
**Referência**: [atendente.js L565-595](file:///c:/Users/User/Documents/GitHub/RiverTechGestao/atendente.js#L565-L595)

**Mudanças**:
1. Se `order.cliente_premium_id` existir:
   - Adicionar uma tag ou ícone 👑 ao lado do nome do cliente (`order.customer_name`).
   - Mudar a cor do nome ou adicionar um badge "VIP" para chamar atenção.
2. Se `order.comanda_id` existir:
   - No rodapé (onde fica o status de pagamento), exibir um badge específico: `📋 COMANDA` em vez do método de pagamento padrão. (Opcionalmente, manter o badge atual, mas exibir a informação da comanda).
   - Como os pedidos VIP via comanda não exigem pagamento na hora, o status de pagamento não é relevante para o atendente nesse fluxo, mas a informação "COMANDA" sim.

### 5.2 — Detalhes do Pedido (Modal)

**Onde**: Na função que renderiza o modal de detalhes do pedido (provavelmente `abrirModalDetalhes`).
**Mudanças**:
- Adicionar a mesma sinalização (Coroa VIP e informação de comanda).

---

## Checklist de Execução

- [x] Modificar `createOrderCard` em `atendente.js` para incluir o badge VIP.
- [x] Modificar `createOrderCard` para mostrar o badge de "COMANDA" no lugar do método de pagamento quando aplicável.
- [x] Validar a apresentação do modal de detalhes do pedido.
- [x] Testar a interface.
