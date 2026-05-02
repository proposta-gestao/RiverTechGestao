# ⚡ Quick Start - RiverTech Theming System

## 🎯 Em 2 Minutos

### 1. Adicionar ao HTML

```html
<!-- HEAD -->
<link rel="stylesheet" href="design-tokens.css">
<link rel="stylesheet" href="themes.css">
<link rel="stylesheet" href="index.css">

<!-- ANTES DO </body> -->
<script src="theme-manager.js"></script>
```

### 2. Trocar de Tema (em JavaScript)

```javascript
// Mudar para restaurante
updateTheme('restaurant');

// Mudar para barbearia
updateTheme('barbershop');

// Customizar cor do botão
updateTheme('clothing', {
  '--btn-primary-bg': '#your-color'
});
```

### 3. Usar em CSS

```css
/* Fundo da página */
background: var(--bg-page);

/* Texto principal */
color: var(--text-primary);

/* Botão primário */
background: var(--btn-primary-bg);

/* Border padrão */
border: 1px solid var(--border-default);
```

---

## 🎨 5 Temas Disponíveis

| Tema | ID | Cor | Para Quem |
|------|----|----|-----------|
| **Default** | `'default'` | Dourado (#E5B25D) | Base profissional |
| **Clothing** | `'clothing'` | Cinza (#4a4a4a) | Moda, vestuário |
| **Restaurant** | `'restaurant'` | Laranja (#FF6B35) | Comida, bebidas |
| **Barbershop** | `'barbershop'` | Dourado (#d4af37) | Beleza, serviços |
| **Beverage** | `'beverage'` | Ciano (#00d4ff) | Tech, inovação |

---

## 📋 Variáveis Principais

### Backgrounds
```css
--bg-page          /* Fundo da página */
--bg-card          /* Cards e containers */
--bg-input         /* Inputs e campos */
--bg-overlay-light /* Overlay claro */
--bg-overlay-dark  /* Overlay escuro */
```

### Texto
```css
--text-primary     /* Texto padrão */
--text-secondary   /* Texto secundário */
--text-tertiary    /* Hint, ajuda */
--text-muted       /* Desabilitado */
--text-inverse     /* Contraste inverso */
```

### Botões
```css
--btn-primary-bg       /* Background primário */
--btn-primary-hover    /* Hover primário */
--btn-primary-text     /* Texto primário */
--btn-secondary-bg     /* Background secundário */
--btn-secondary-hover  /* Hover secundário */
```

### Estados
```css
--color-success-500    /* Sucesso */
--color-warning-500    /* Atenção */
--color-danger-500     /* Erro */
--color-info-500       /* Informação */
```

### Effects
```css
--shadow-sm    /* Sombra pequena */
--shadow-md    /* Sombra média */
--shadow-lg    /* Sombra grande */
--shadow-xl    /* Sombra extra */
--radius-md    /* Border radius padrão */
--radius-lg    /* Border radius grande */
```

---

## 💡 3 Exemplos Práticos

### Exemplo 1: Botão Customizado

```css
.my-button {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  transition: background 0.3s;
}

.my-button:hover {
  background: var(--btn-primary-hover);
}
```

### Exemplo 2: Card de Produto

```css
.product-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 16px;
}

.product-name {
  color: var(--text-primary);
  font-weight: 600;
}

.product-price {
  color: var(--accent-primary);
  font-weight: 700;
}
```

### Exemplo 3: Customizar para Cliente

```javascript
// Cliente "Pizzaria La Bella"
updateTheme('restaurant', {
  '--accent-primary': '#ff4444',      // Vermelho da marca
  '--btn-primary-bg': '#ff4444',
  '--color-neutral-000': '#fffef7',   // Tom quente
  '--color-neutral-950': '#2a1810'    // Marrom escuro
});

// Salvar no banco
const config = themeManager.exportThemeConfig();
await fetch('/api/tenant/theme', {
  method: 'POST',
  body: JSON.stringify(config)
});
```

---

## 🔧 API Completa

```javascript
// Mudar tema com opcionais customizações
updateTheme('barbershop', { '--accent-primary': '#gold' });

// Obter tema ativo
const current = themeManager.getCurrentTheme();
console.log(current); // 'barbershop'

// Obter customizações aplicadas
const overrides = themeManager.getOverrides();
console.log(overrides); // { '--accent-primary': '#gold' }

// Limpar customizações
themeManager.resetToThemeDefaults();

// Listar todas as cores ativas
const colors = themeManager.getThemeVariables();
console.log(colors['--bg-card']); // rgb(26, 26, 26)

// Exportar para banco
const config = themeManager.exportThemeConfig();
// { theme: 'barbershop', overrides: {...}, variables: {...}, exportedAt: '...' }

// Importar do banco
themeManager.importThemeConfig(config);

// Escutar mudanças
document.addEventListener('themechange', (e) => {
  console.log('Novo tema:', e.detail.theme);
  console.log('Customizações:', e.detail.overrides);
});
```

---

## ✅ Checklist de Integração

- [ ] Adicionar 3 CSS links no `<head>`
- [ ] Adicionar script `theme-manager.js` antes de `</body>`
- [ ] Testar `updateTheme('restaurant')` no console
- [ ] Confirmar que cores mudaram
- [ ] Refatorar CSS customizado para usar variáveis
- [ ] Salvar preferência do usuário
- [ ] Testar em todos os navegadores

---

## 🐛 Troubleshooting

### Tema não muda
```javascript
// Verificar se o nome está correto
console.log(themeManager.getCurrentTheme());

// Temas válidos: 'default', 'clothing', 'restaurant', 'barbershop', 'beverage'
updateTheme('restaurant'); // Correto
updateTheme('pizzaria');   // ❌ Será ignorado
```

### Cores não aparecem
```javascript
// Verificar se CSS está importado em ordem
// ❌ Errado
<link rel="stylesheet" href="index.css">
<link rel="stylesheet" href="design-tokens.css">

// ✅ Correto
<link rel="stylesheet" href="design-tokens.css">
<link rel="stylesheet" href="themes.css">
<link rel="stylesheet" href="index.css">
```

### Variável não encontrada
```css
/* ❌ Não existe */
background: var(--primary-color);

/* ✅ Existe */
background: var(--accent-primary);
background: var(--btn-primary-bg);
background: var(--bg-card);
```

---

## 📚 Referência Completa

Ver `THEMING_README.md` para:
- Todas as 130+ variáveis
- Descrição completa de cada tema
- Arquitetura detalhada
- Boas práticas
- Exemplos avançados

---

## 🎬 Demo Interativa

Abra `theme-demo.html` no navegador para:
- Ver todos os temas em ação
- Testar customizações em tempo real
- Ver código-fonte dos exemplos
- Visualizar paleta de cores

---

## ❓ FAQs

**P: Posso criar novo tema?**  
R: Sim! Copie `:root.theme-restaurant` em `themes.css` e adapte as variáveis.

**P: Como salvar tema por usuário?**  
R: Use `exportThemeConfig()` e guarde no banco. Na próxima login, use `importThemeConfig()`.

**P: Preciso mudar TODOS os arquivos CSS?**  
R: Apenas novos CSS. Antigos podem conviver enquanto migram para variáveis.

**P: Performance é afetada?**  
R: Não! CSS variables são nativas do navegador. Zero overhead.

**P: Funciona em browsers antigos?**  
R: Chrome 49+, Firefox 31+, Safari 9.1+. IE não suporta.

---

**🚀 Pronto para começar? Abra `theme-demo.html` e teste!**
