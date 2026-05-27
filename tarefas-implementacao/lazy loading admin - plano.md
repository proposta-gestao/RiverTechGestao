# Lazy Loading `admin.js`

A estratégia será dividir o gigantesco arquivo `admin.js` (175 KB) em módulos menores que serão carregados apenas quando a respectiva aba for clicada no painel de administração. Isso reduzirá drasticamente o tempo de carregamento inicial do painel.

## User Review Required
> [!IMPORTANT]
> Dividir o `admin.js` pode causar problemas temporários caso alguma variável global ou função não seja exposta corretamente entre os arquivos. Os testes serão essenciais. 

## Open Questions
- Os novos scripts deverão ser adicionados ao PWA Cache (`service-worker.js`)? Como essa é a versão web/admin, acredito que não afete muito o PWA que é focado no Atendente, mas gostaria de confirmar se o Admin também é usado offline.

## Proposed Changes

Vamos extrair as funcionalidades específicas das abas de `admin.js` para arquivos dedicados, seguindo o padrão de carregamento assíncrono já usado pelo `admin-agenda.js`.

### Admin Dashboard (Vendas e Métricas)
#### [MODIFY] admin.js
Removeremos as funções relacionadas ao Dashboard e Pedidos:
- Atualização do gráfico (`atualizarGraficoMetricas`)
- Lógica de filtros e listagem de pedidos
- Cálculo de insights e performance de vendas
- Ações de finalizar e cancelar pedidos
Estas funções serão substituídas por uma chamada de carregamento `loadModule('admin-dashboard')` acionada ao abrir a aba.

#### [NEW] admin-dashboard.js
Conterá todas as lógicas, variáveis e listeners locais da aba de "Vendas e Performance".

---

### Admin Produtos
#### [MODIFY] admin.js
Removeremos as funções relacionadas a produtos e estoque:
- `abrirModalNovoProduto()`, lógica de variação, salvar produto
- Renderização de categorias (`carregarCategoriasLista`)
- Tratamento de estoque baixo e CRUD de produtos
Estas funções serão movidas.

#### [NEW] admin-produtos.js
Conterá as funcionalidades da aba "Produtos".

---

### Admin Cupons
#### [MODIFY] admin.js
Removeremos funções CRUD de cupons.

#### [NEW] admin-cupons.js
Conterá a renderização, criação e deleção de cupons de desconto.

---

### Admin Configurações
#### [MODIFY] admin.js
Removeremos uma grande parte do arquivo, incluindo:
- Upload de imagens e Cloudinary
- Identidade Visual (Tema)
- Endereço, Frete (Zonas de Entrega, Geolocation)
- Equipe de Atendentes
- WhatsApp (Mensagens automáticas)
- Área Premium

#### [NEW] admin-config.js
Conterá todas as lógicas da aba "Configurações" e "Área Premium".

---

### Lógica Base (Admin Core)
#### [MODIFY] admin.js
O `admin.js` passará a atuar apenas como o **Core** da aplicação administrativa, mantendo:
- Autenticação e Verificação de Sessão (`checkSession`, Login/Logout)
- Utilitários globais (`showToast`, `customConfirm`, formatadores)
- Estado global compartilhado (`produtos`, `pedidos`, `categorias`, etc.)
- Roteamento de Abas (`switchTab`)
- Função central de carregamento dinâmico (`loadModule(name)`)

## Verification Plan
### Automated Tests
- N/A.

### Manual Verification
1. Abrir a tela de Admin no ambiente de homologação.
2. Verificar se o login funciona normalmente.
3. Navegar entre as abas (Dashboard, Produtos, Cupons, Configurações).
4. Usar a aba "Network" do DevTools para confirmar que os novos scripts (`admin-dashboard.js`, etc.) são baixados apenas no momento em que a aba correspondente é acessada.
5. Em cada aba, executar uma ação de teste (ex: filtrar pedidos, adicionar cupom, editar produto, salvar configuração) para garantir que não existem erros de referência a variáveis ou funções.
