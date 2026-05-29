# Execução: Modularizar `admin.js` e Implementar Lazy Loading

## Checklist de Tarefas Realizadas

- [x] Confirmar sobre offline/service-worker (O Admin não é cacheado no SW)
- [x] Criar diretório `admin-modules`
- [x] Extrair e criar `admin-modules/admin-dashboard.js`
- [x] Extrair e criar `admin-modules/admin-produtos.js`
- [x] Extrair e criar `admin-modules/admin-cupons.js`
- [x] Extrair e criar `admin-modules/admin-config.js`
- [x] Atualizar `admin.js` para usar lazy loading
- [x] Mover/Ajustar `admin-agenda.js` e `admin-loja.js` para o mesmo diretório
- [x] Commitar mudanças na branch `homologacao` e enviar para o GitHub

---

## Detalhes da Execução

### 1. Separação de Módulos (Extração de ~2.000 linhas)
Para melhorar a organização do projeto e reduzir o tamanho do core administrativo, extraímos as lógicas específicas de abas que somavam mais de 2.000 linhas de código no antigo `admin.js` e as dividimos em quatro arquivos na pasta `admin-modules`:
- `admin-modules/admin-dashboard.js` (Dashboard e métricas de vendas)
- `admin-modules/admin-produtos.js` (Gerenciamento de produtos, categorias e uploads)
- `admin-modules/admin-cupons.js` (Gestão de cupons de desconto)
- `admin-modules/admin-config.js` (Configurações gerais do SASS, temas, WhatsApp, etc.)

Também padronizamos o local das demais telas administrativas movendo `admin-agenda.js` e `admin-loja.js` para a mesma pasta.

### 2. Otimização do Core (Lazy Loading)
O arquivo principal `admin.js` agora funciona apenas como o **Core** (controlando sessões de login, estados compartilhados e a navegação entre abas). Ele carrega cada um dos módulos acima de forma assíncrona/tardia (Lazy Loading) por meio da nova função `loadModule` apenas quando o usuário de fato abre a aba correspondente.

### 3. Service Worker e PWA (Offline)
Confirmou-se que o PWA focado em funcionamento Offline é voltado exclusivamente para o Atendente (`acp-atendente-v2`). Por ser online e administrativo, o painel do Admin não é cacheado no shell do `service-worker.js`. Isso evita que atualizações no Admin quebrem o aplicativo de atendimento local.

### 4. Como Validar e Testar na Vercel
Após a finalização do deploy automático da branch `homologacao` no painel da Vercel:
1. Acesse a URL do ambiente de homologação.
2. Abra o Inspetor do navegador (F12) e selecione a aba **Network (Rede)**.
3. Ao navegar entre as abas do painel (Dashboard, Produtos, Cupons, etc.), observe que os arquivos Javascript correspondentes são baixados dinamicamente apenas no momento do clique, demonstrando a otimização em tempo de execução.

### 5. Próximos Passos
Com o sucesso dos testes no Admin, a próxima sugestão é realizar otimizações semelhantes no `index.js` (responsável pelo cardápio público do cliente final), reduzindo o tempo de carregamento da página de pedidos.
