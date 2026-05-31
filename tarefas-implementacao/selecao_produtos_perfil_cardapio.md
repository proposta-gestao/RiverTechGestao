# Seleção de Produtos no Perfil de Cardápio

Esta atualização permitirá que administradores adicionem não apenas categorias inteiras, mas também **produtos específicos** individuais aos Perfis de Cardápio.

## User Review Required

> [!WARNING]
> Precisamos criar uma nova tabela no Supabase para mapear essa relação. Veja a seção de Banco de Dados abaixo. Peço que confirme a criação da tabela antes de prosseguirmos com a edição do código do painel!

## Open Questions

1. Se uma categoria estiver permitida, todos os produtos dela estarão disponíveis. Se eu permitir um produto avulso, ele vai aparecer no cardápio de forma independente ou precisa respeitar alguma estrutura visual? (Presumiremos que o código do cardápio depois vai juntar os "produtos de categorias permitidas" + "produtos avulsos").

## Proposed Changes

### 1. Banco de Dados (Supabase)

Você precisará rodar o seguinte script SQL no seu painel do Supabase (SQL Editor) para criar a nova tabela de mapeamento:

```sql
create table public.perfil_cardapio_produtos (
  perfil_id uuid not null references public.perfis_cardapio(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (perfil_id, product_id)
);

-- Ativar RLS
alter table public.perfil_cardapio_produtos enable row level security;

-- Criar política de acesso (mesma regra das categorias)
create policy "Enable all actions for authenticated users" 
on public.perfil_cardapio_produtos for all 
to authenticated 
using (true);
```

### 2. Frontend: Modal de Edição (`admin.html`)

- Adicionaremos **Abas (Tabs)** dentro do modal: "📂 Categorias" e "🍔 Produtos".
- O painel de duas colunas (Disponíveis vs Permitidas) será reaproveitado.
- Quando o usuário clicar na aba "Categorias", renderizamos as categorias. Quando clicar em "Produtos", renderizamos a lista de todos os produtos do estoque.

#### [MODIFY] admin.html
Adição dos botões de abas acima do painel `.pc-two-col`:
```html
<div class="pc-tabs">
    <button type="button" class="pc-tab active" data-tab="categorias">Categorias</button>
    <button type="button" class="pc-tab" data-tab="produtos">Produtos Individuais</button>
</div>
```

### 3. Lógica JavaScript (`admin.js`)

- Atualizar o `select()` do Supabase em `carregarPerfisCardapio` para buscar também `perfil_cardapio_produtos(product_id)`.
- Fazer a função `abrirModalPerfilCardapio` gerenciar dois conjuntos de seleção (`selectedCats` e `selectedProds`).
- Carregar do banco `window.__produtosList = await sb.from('products').select('id, name, ...')`.
- O layout de duas colunas vai ser limpo e re-renderizado sempre que o usuário alternar de aba (Categorias <-> Produtos).
- Atualizar a função `btnSalvarPerfilCardapio` para deletar e re-inserir registros tanto em `perfil_cardapio_categorias` quanto em `perfil_cardapio_produtos`.

#### [MODIFY] admin.js
- Atualização do CRUD de `perfis_cardapio` para considerar a nova tabela de produtos.

## Verification Plan

### Manual Verification
1. Criar um novo perfil.
2. Ir na aba "Categorias" e selecionar "Bebidas".
3. Ir na aba "Produtos" e selecionar apenas um produto específico de outra categoria ("Pizza de Calabresa").
4. Salvar.
5. Recarregar e editar o perfil para confirmar se ambos (categoria e produto) continuam salvos e marcados nas duas abas.
