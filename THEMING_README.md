# 🎨 RiverTech Theming System

Arquitetura de tema White Label escalável com design tokens em 2 camadas, suportando múltiplos nichos de negócio (vestuário, restaurante, barbearia, bebidas).

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Uso Rápido](#uso-rápido)
- [Struturas de Arquivos](#estrutura-de-arquivos)
- [Design Tokens](#design-tokens)
- [Temas por Nicho](#temas-por-nicho)
- [Customização Dinâmica](#customização-dinâmica)
- [API JavaScript](#api-javascript)
- [Exemplos](#exemplos)
- [Boas Práticas](#boas-práticas)

---

## 📖 Visão Geral

O RiverTech Theming System é uma arquitetura de design tokens profissional que permite:

✅ **Temas predefinidos** para 4 nichos de negócio  
✅ **Customização dinâmica** em tempo real (sem refresh)  
✅ **Persistência** de preferências (localStorage)  
✅ **White Label** com suporte a sobrescrita parcial  
✅ **Semanticamente significativo** (tokens com nomes intuitivos)  
✅ **Performance otimizada** (CSS variables + JS puro)  

---

## 🏗️ Arquitetura

### 2 Camadas de Tokens

```
┌─────────────────────────────────────┐
│   CSS Components (index.css, etc)  │
│   Usam APENAS semantic tokens       │
└─────────────────────┬───────────────┘
                      │
┌─────────────────────▼───────────────┐
│    SEMANTIC TOKENS (design-tokens)  │
│  --bg-page, --text-primary, etc    │
│  Significado + Implementação        │
└─────────────────────┬───────────────┘
                      │
┌─────────────────────▼───────────────┐
│      BASE TOKENS (design-tokens)    │
│  --color-neutral-900, etc           │
│  Cores brutas (não usadas direto)   │
└─────────────────────────────────────┘
```

**Por quê 2 camadas?**
- **Base**: Paleta consistente
- **Semantic**: Fácil manutenção e mudança de tema

---

## 🚀 Uso Rápido

### 1. Importar CSS

```html
<!-- CSS em ORDEM específica -->
<link rel="stylesheet" href="design-tokens.css">
<link rel="stylesheet" href="themes.css">
<link rel="stylesheet" href="index.css">
```

### 2. Importar JavaScript

```html
<script src="theme-manager.js"></script>
```

### 3. Usar

```javascript
// Aplicar tema
updateTheme('restaurant');

// Customizar
updateTheme('barbershop', {
  '--btn-primary-bg': '#d4af37',
  '--accent-primary': '#c4952e'
});

// Ouvir mudanças
document.addEventListener('themechange', (e) => {
  console.log('Novo tema:', e.detail.theme);
});
```

---

## 📁 Estrutura de Arquivos

```
/workspaces/RiverTechGestao/
├── design-tokens.css          ⭐ Base + Semantic tokens
├── themes.css                 ⭐ 4 temas por nicho
├── theme-manager.js           ⭐ API JavaScript
├── theme-demo.html            ⭐ Demo interativa
├── index.css                  ✓ Refatorado (usa tokens)
├── admin.css                  ✓ Refatorado (parcialmente)
├── admin-saas.css             (a refatorar)
├── agendamento.css            (a refatorar)
├── atendente.css              (a refatorar)
└── admin-agenda.css           (a refatorar)
```

---

## 🎨 Design Tokens

### Base Tokens (design-tokens.css)

Paleta neutral (escala de grays):
```css
--color-neutral-000: #ffffff;      /* Branco puro */
--color-neutral-100: #f5f5f5;      /* Quase branco */
--color-neutral-500: #a0a0a0;      /* Cinza médio */
--color-neutral-900: #0d0d0d;      /* Quase preto */
--color-neutral-950: #000000;      /* Preto puro */
```

Paleta brand (dourado):
```css
--color-brand-500: #E5B25D;        /* Principal */
--color-brand-600: #d4a14c;        /* Hover */
--color-brand-700: #b88a40;        /* Active */
```

Cores semânticas:
```css
--color-success-500: #00B894;      /* Verde */
--color-warning-500: #FDCB6E;      /* Amarelo */
--color-danger-500: #FF4757;       /* Vermelho */
--color-info-500: #1E90FF;         /* Azul */
```

### Semantic Tokens (design-tokens.css)

Backgrounds:
```css
--bg-page:           var(--color-neutral-900);
--bg-card:           var(--color-neutral-850);
--bg-input:          var(--color-neutral-850);
--bg-overlay-light:  rgba(13, 13, 13, 0.95);
```

Text:
```css
--text-primary:      var(--color-neutral-000);
--text-secondary:    var(--color-neutral-500);
--text-muted:        var(--color-neutral-500);
```

Buttons:
```css
--btn-primary-bg:    var(--color-brand-500);
--btn-primary-text:  var(--color-neutral-950);
--btn-primary-hover: var(--color-brand-600);
```

Borders:
```css
--border-default:    var(--opacity-brand-20);
--border-subtle:     var(--opacity-neutral-10);
```

States:
```css
--state-success-bg:  var(--color-success-500);
--state-danger-bg:   var(--color-danger-500);
```

Effects:
```css
--shadow-lg:    0 8px 32px rgba(0,0,0,0.4);
--radius-lg:    16px;
--transition:   all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 🌈 Temas por Nicho

### Clothing (Limpo, Elegante, Mínimo Contraste)

```css
:root.theme-clothing {
  --color-brand-500: #4a4a4a;      /* Cinza elegante */
  --bg-page:         #fafafa;       /* Quase branco */
  --bg-card:         #ffffff;       /* Branco puro */
  --text-primary:    #1a1a1a;       /* Preto quase puro */
  --accent-primary:  #8b7355;       /* Marrom topo */
}
```

**Características:**
- Paleta clara e minimalista
- Alto contraste entre background e foreground
- Elegância e sofisticação

### Restaurant (Vibrante, Alto Contraste, Cores Quentes)

```css
:root.theme-restaurant {
  --color-brand-500: #FF6B35;      /* Laranja vibrante */
  --bg-page:         #0f0f0f;      /* Quase preto */
  --bg-card:         #1a1a1a;      /* Escuro */
  --text-primary:    #ffffff;      /* Branco */
  --accent-primary:  #FF6B35;      /* Laranja */
}
```

**Características:**
- Cores quentes e vibrantes
- Alto contraste
- Apetitivo visual

### Barbershop (Escuro, Premium, Forte Contraste)

```css
:root.theme-barbershop {
  --color-brand-500: #d4af37;      /* Dourado premium */
  --bg-page:         #0a0a0a;      /* Muito escuro */
  --bg-card:         #161616;      /* Escuro */
  --text-primary:    #ffffff;      /* Branco */
  --accent-primary:  #d4af37;      /* Dourado */
}
```

**Características:**
- Luxo e premium
- Contraste forte
- Dourado clássico

### Beverage (Ousado, Industrial, Saturado)

```css
:root.theme-beverage {
  --color-brand-500: #00d4ff;      /* Ciano vibrante */
  --bg-page:         #090909;      /* Quase preto */
  --bg-card:         #131318;      /* Escuro ```industrial */
  --text-primary:    #ffffff;      /* Branco */
  --accent-primary:  #00d4ff;      /* Ciano */
}
```

**Características:**
- Cores saturadas
- Design industrial
- Moderno e ousado

---

## ⚙️ Customização Dinâmica

### Aplicar Tema + Overrides

```javascript
// Tema + customizações
updateTheme('barbershop', {
  '--btn-primary-bg': '#custom-color',
  '--text-primary': '#another-color'
});
```

### Sobrescrita Parcial

Sobrescreva apenas o que precisa mudar:

```javascript
// Mantém todo o tema, mas muda apenas botão
updateTheme('restaurant', {
  '--btn-primary-bg': '#FFD700'
});
```

### Resetar para Defaults

```javascript
themeManager.resetToThemeDefaults();
```

---

## 📡 API JavaScript

### ThemeManager Class

#### `updateTheme(themeName, overrides?)`

Aplicar tema + customizações opcionais

```javascript
// Parâmetros
updateTheme('clothing');  // Tema simples
updateTheme('restaurant', { '--accent-primary': '#color' });  // Com overrides

// Retorno
true   // Sucesso
false  // Erro (tema inválido)
```

#### `getCurrentTheme()`

Obter tema ativo

```javascript
const current = themeManager.getCurrentTheme();
// Retorna: 'default', 'clothing', 'restaurant', 'barbershop', 'beverage'
```

#### `getOverrides()`

Obter customizações aplicadas

```javascript
const overrides = themeManager.getOverrides();
// Retorna: { '--btn-primary-bg': '#color', ... }
```

#### `resetToThemeDefaults()`

Remover todas as customizações

```javascript
themeManager.resetToThemeDefaults();
```

#### `exportThemeConfig()`

Exportar para salvar no banco de dados

```javascript
const config = themeManager.exportThemeConfig();
// Retorna:
// {
//   theme: 'restaurant',
//   overrides: { '--accent-primary': '#color' },
//   variables: { '--bg-page': '#0f0f0f', ... },
//   exportedAt: '2026-05-01T...'
// }
```

#### `importThemeConfig(config)`

Importar de banco de dados

```javascript
const config = {
  theme: 'barbershop',
  overrides: { '--btn-primary-bg': '#d4af37' }
};
themeManager.importThemeConfig(config);
```

#### `getThemeVariables()`

Obter todas as CSS variables calculadas

```javascript
const vars = themeManager.getThemeVariables();
// Retorna: { '--bg-page': '#0a0a0a', '--text-primary': '#fff', ... }
```

### Event Listener

Escutar mudanças de tema:

```javascript
document.addEventListener('themechange', (e) => {
  console.log(e.detail.theme);       // Nome do tema
  console.log(e.detail.overrides);   // Customizações aplicadas
  console.log(e.detail.timestamp);   // Quando foi aplicado
});
```

### Global Functions

```javascript
// Função global (wrapper)
updateTheme('restaurant');

// Instância global
window.themeManager.getCurrentTheme();
```

---

## 💡 Exemplos

### Exemplo 1: Carregar Tema Salvo

```javascript
// No carregamento da página
document.addEventListener('DOMContentLoaded', () => {
  // Carregar do banco/localStorage
  const savedConfig = JSON.parse(localStorage.getItem('rivertech-theme'));
  
  if (savedConfig) {
    themeManager.importThemeConfig(savedConfig);
  }
});
```

### Exemplo 2: Seletor de Temas

```html
<select onchange="updateTheme(this.value)">
  <option value="default">Default</option>
  <option value="clothing">Clothing</option>
  <option value="restaurant">Restaurant</option>
  <option value="barbershop">Barbershop</option>
  <option value="beverage">Beverage</option>
</select>
```

### Exemplo 3: Customização em Painel Admin

```javascript
function saveBrandColor(hexColor) {
  updateTheme(themeManager.getCurrentTheme(), {
    '--accent-primary': hexColor,
    '--btn-primary-bg': hexColor
  });
  
  // Salvar no banco
  const config = themeManager.exportThemeConfig();
  fetch('/api/tenant/theme', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}
```

### Exemplo 4: Theme Sync Entre Abas

```javascript
// Sincronizar quando outra aba muda o tema
window.addEventListener('storage', (e) => {
  if (e.key === 'rivertech-theme') {
    const savedTheme = localStorage.getItem('rivertech-theme');
    updateTheme(JSON.parse(savedTheme));
  }
});
```

---

## ✅ Boas Práticas

### DO ✓

- Use **semantic tokens** em CSS (nunca cores hardcoded)
- Registre customizações no banco para recuperação
- Teste temas em diferentes resoluções
- Use `exportThemeConfig()` para multi-tenant
- Ouvça eventos `themechange` para sincronizar UI

### DON'T ✗

- Não use cores hardcoded no CSS
- Não misture base tokens com semantic tokens
- Não sobrescreva themes.css em components
- Não faça fetch de cores dentro do CSS
- Não crie variáveis dinâmicas sem padrão

### Ordem de Importação

```html
<!-- ❌ ERRADO -->
<link rel="stylesheet" href="index.css">
<link rel="stylesheet" href="design-tokens.css">
<link rel="stylesheet" href="themes.css">

<!-- ✅ CORRETO -->
<link rel="stylesheet" href="design-tokens.css">
<link rel="stylesheet" href="themes.css">
<link rel="stylesheet" href="index.css">
```

### Nomenclatura de Tokens

```css
/* ❌ Ruim */
--blue-123
--dark-color
--large-shadow

/* ✅ Bom */
--accent-primary
--bg-page
--shadow-lg
```

---

## 📊 Refatração de Status

| Arquivo | Status | Progresso |
|---------|--------|-----------|
| design-tokens.css | ✅ Completo | 100% |
| themes.css | ✅ Completo | 100% |
| theme-manager.js | ✅ Completo | 100% |
| index.css | ✅ Refatorado | 95% |
| admin.css | 🔄 Parcial | 40% |
| admin-saas.css | ⏳ Pendente | 0% |
| agendamento.css | ⏳ Pendente | 0% |
| atendente.css | ⏳ Pendente | 0% |
| admin-agenda.css | ⏳ Pendente | 0% |

---

## 🔗 Referências

- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [Design Tokens](https://designtokens.org/)
- [System Design Tokens](https://www.figma.com/blog/inside-figmas-plugin-ecosystem/)

---

## 📞 Suporte

Para dúvidas sobre a arquitetura, acesse `theme-demo.html` para ver exemplos interativos.

---

**Última atualização:** 01/05/2026  
**Versão:** 1.0.0  
**Mantém:** RiverTech Team
