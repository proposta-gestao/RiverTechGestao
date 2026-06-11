# Fase 9: Gestão VIP e Fechamento de Caixa

Com base na análise do sistema, este plano detalha os passos para implementar e corrigir as funcionalidades relacionadas à Gestão Total, Cardápio Inteligente, Transparência na Mão, Caixa Ágil e Fechamento de Caixa.

## User Review Required
> [!IMPORTANT]
> **Aprovação do Plano de Ação**
> Este plano foi estruturado em sprints (fases) para entregarmos as funcionalidades de forma contínua e segura. A primeira fase foca em corrigir uma falha crítica (bloqueio do limite que estava apenas visual), e as próximas fases focam em criar as telas e lógicas de Caixa. Por favor, revise o escopo do **Sprint 1** e **Sprint 2** e me dê o OK para iniciar.

## Open Questions
> [!WARNING]
> **Dúvidas sobre o Fechamento de Caixa (Sprint 3)**
> 1. O saldo inicial (troco) do caixa precisa ser informado pelo atendente ao iniciar o dia, ou será fixo?
> 2. O caixa deve ser vinculado a um único atendente por vez, ou todos os atendentes lançam no mesmo caixa global da empresa?

## Proposed Changes

Propomos dividir a implementação nas seguintes fases:

### Sprint 1: Correções Críticas (Segurança e Integridade)
Foco em impedir que pedidos sejam feitos se ultrapassarem o limite financeiro, e garantir a persistência dos dados no banco.

#### [NEW] supabase/migrations/20260602000000_perfil_cardapio_produtos.sql
- Criar a tabela `perfil_cardapio_produtos` que está faltando no banco de dados, com RLS, para permitir a vinculação de perfis a produtos individuais.

#### [MODIFY] index.js
- Adicionar validação estrita no checkout (`btnEnviar.onclick`): calcular se `gasto_atual + total_pedido` ultrapassa o `teto_mensal`. Se sim, bloquear a compra com um alerta visual.
- Atualizar o saldo (aumentar o `gasto`) localmente e sincronizar a UI imediatamente após o pedido ser finalizado com sucesso.

### Sprint 2: Transparência na Mão & Caixa Ágil (Melhorias de UX)
Foco em exibir saldos de forma clara para o cliente e para o atendente.

#### [MODIFY] index.js
- Adicionar exibição do "Saldo Restante" ou "Limite Excedido" diretamente no carrinho de compras e na tela de confirmação do pedido, para maior clareza antes do clique final.

#### [MODIFY] atendente.html e atendente.js
- Exibir o saldo disponível do cliente VIP no cartão do pedido e no modal de detalhes.
- Melhorar o destaque visual (Selo VIP 👑) e criar alertas coloridos se o cliente estiver perto de estourar o limite.
- Adicionar campo de busca (CPF/Nome) para o atendente consultar saldos rapidamente.

### Sprint 3: Fechamento de Caixa (Módulo Novo)
Construção do zero do fluxo de caixa e relatórios financeiras da operação.

#### [NEW] supabase/migrations/20260603000000_caixa_sessoes.sql
- Criar tabelas `caixa_sessoes` e `caixa_movimentos` para registrar aberturas, fechamentos e formas de pagamento.

#### [MODIFY] atendente.html e atendente.js
- Criar UI para "Abertura de Caixa" (informar troco) e "Fechamento de Caixa".
- Vincular a forma de pagamento selecionada no checkout diretamente à sessão do caixa aberto.

#### [MODIFY] admin-dashboard.js e admin.html
- Popular o arquivo vazio `admin-dashboard.js` com os KPIs gerenciais consolidados.
- Criar relatórios de "Histórico de Caixas" e "Ocupação do Limite Premium" com gráficos visuais.

## Verification Plan

### Manual Verification
1. **Sprint 1**: Fazer um pedido na tela pública com um usuário VIP que vá ultrapassar o teto e garantir que ele seja bloqueado com sucesso (a compra não pode ir para o Supabase).
2. **Sprint 2**: Abrir a tela do Atendente, receber o pedido e verificar se o "Saldo Disponível" do cliente aparece no Kanban e no Modal de Detalhes.
3. **Sprint 3**: Realizar a abertura de caixa via tela de atendente, receber 2 pedidos VIP, e clicar em Fechar Caixa, verificando se os valores informados de diferença batem.
