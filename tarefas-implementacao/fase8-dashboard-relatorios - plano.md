# Fase 8: Dashboard e Relatórios Premium

Criar um painel de visualização de alto nível para os gestores acompanharem o consumo dos Clientes Premium, com opção de filtrar dados e exportá-los.

## User Review Required
> [!IMPORTANT]
> **Exportação de PDF:** Atualmente o projeto parece não usar bibliotecas externas (como `jsPDF`) para gerar PDFs. A abordagem sugerida é usar a exportação nativa via `window.print()` estilizando a tabela para impressão, além da exportação em arquivo CSV/Excel que é feita puramente via JavaScript.

## Open Questions
> [!WARNING]
> 1. **Escopo dos Gastos:** O dashboard deve puxar *apenas* os gastos que foram fechados via Comanda Digital, ou deve contabilizar *todos* os pedidos (mesmo os avulsos/Pix) feitos por clientes que possuem a flag de Premium?
> 2. **Biblioteca PDF:** Você prefere adicionar uma biblioteca externa para gerar PDFs ou a impressão formatada do navegador é suficiente?

## Proposed Changes

### [MODIFY] admin.html
Adicionar os elementos visuais na seção de Configurações (próximo à aba de Clientes Premium):

1. **Nova Subtab**: `<button class="subtab-btn" data-subtab="config-premium-dashboard">📊 Dashboard Premium</button>`
2. **Conteúdo da Subtab**:
   - Barra superior com **Filtro de Datas** (Data Início e Data Fim) e botões de **Exportar CSV** e **Imprimir Relatório (PDF)**.
   - **Cards de Resumo**: Total Consumido, Comandas Fechadas, Ticket Médio Premium.
   - **Ranking de Clientes**: Uma tabela listando os clientes que mais consumiram no período.
   - **Relatório de Comandas**: Tabela detalhada de todas as comandas fechadas no período para auditoria.

### [MODIFY] admin.js
Adicionar a lógica do painel gerencial:

1. `carregarDashboardPremium(dataInicio, dataFim)`: 
   - Faz um `select` na tabela `comandas` onde `status = 'fechada'` filtrando pelo período.
   - Faz um join com `clientes_premium(nome, cpf)` para pegar os dados do cliente.
2. `renderDashboardPremium()`: 
   - Atualiza os cards de totais.
   - Monta o ranking ordenando os clientes pelo `total_acumulado`.
3. `exportarRelatorioPremiumCSV()`: 
   - Monta uma string em formato CSV com as colunas e dispara o download (via `Blob`).
4. `imprimirRelatorioPremium()`: 
   - Oculta os menus laterais temporariamente e aciona o `window.print()` focado na tabela de relatório.

## Verification Plan

### Manual Verification
1. Entrar no painel Admin e acessar a nova aba "Dashboard Premium".
2. Selecionar um período de datas onde já existam comandas fechadas.
3. Verificar se os Cards (Total, Ticket Médio) somam corretamente os valores.
4. Clicar em "Exportar CSV" e confirmar que o arquivo gerado abre corretamente no Excel.
5. Clicar em "Imprimir (PDF)" e confirmar que a tela de impressão exibe apenas a tabela formatada, sem os menus do painel lateral.
