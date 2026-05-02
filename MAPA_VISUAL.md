# 🗺️ RiverTech Theming - Mapa Visual dos Arquivos

```
╔════════════════════════════════════════════════════════════════════════════╗
║                   RIVERTECH THEMING SYSTEM - ESTRUTURA                     ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 1: ORIGEM (Variáveis CSS)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  📄 design-tokens.css                                                    │
│  ├─ Base Tokens (60+)      ← Paletas brutas de cores                    │
│  │  ├─ --color-neutral-000 até 950                                     │
│  │  ├─ --color-brand-100 até 900                                       │
│  │  ├─ --color-success, warning, danger, info                          │
│  │  └─ --opacity-*                                                      │
│  │                                                                       │
│  └─ Semantic Tokens (70+)  ← Significado no UI                          │
│     ├─ --bg-page, --bg-card, --bg-input, --bg-overlay                  │
│     ├─ --text-primary, --text-secondary, --text-muted                  │
│     ├─ --btn-primary-bg, --btn-primary-hover, --btn-primary-text       │
│     ├─ --border-default, --border-subtle, --border-strong              │
│     ├─ --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl              │
│     ├─ --radius-sm, --radius-md, --radius-lg, --radius-full            │
│     ├─ --transition-fast, --transition-normal, --transition-slow       │
│     └─ --accent-primary, --accent-secondary                            │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  ⬇️
                    (importa design-tokens.css)
                                  ⬇️
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 2: TEMAS (Variações por Nicho)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  📄 themes.css                                                           │
│  ├─ Default              ─── Dourado (#E5B25D) + Escuro (#0d0d0d)      │
│  │   :root { --color-brand: ... }  [Override padrão]                   │
│  │                                                                       │
│  ├─ Clothing Theme       ─── Cinza (#4a4a4a) + Claro (#fafafa)         │
│  │   :root.theme-clothing { --color-brand: ... }                       │
│  │   [data-theme="clothing"] { ... }  [Fallback alternativo]           │
│  │                                                                       │
│  ├─ Restaurant Theme     ─── Laranja (#FF6B35) + Escuro (#0f0f0f)      │
│  │   :root.theme-restaurant { --color-brand: ... }                     │
│  │   [data-theme="restaurant"] { ... }                                  │
│  │                                                                       │
│  ├─ Barbershop Theme     ─── Ouro (#d4af37) + Muito Escuro (#0a0a0a)  │
│  │   :root.theme-barbershop { --color-brand: ... }                     │
│  │   [data-theme="barbershop"] { ... }                                  │
│  │                                                                       │
│  └─ Beverage Theme       ─── Ciano (#00d4ff) + Ultra Escuro (#090909)  │
│      :root.theme-beverage { --color-brand: ... }                       │
│      [data-theme="beverage"] { ... }                                    │
│                                                                           │
│  ✨ Cada tema redefine todas as semantic tokens!                       │
│  🎨 Resultado: Cores completamente diferentes mas mesma estrutura      │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  ⬇️
                    (importa themes.css)
                                  ⬇️
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 3: COMPONENTES (CSS Real)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  📄 index.css    (95% refatorado) ✅                                    │
│  ├─ .sticky-store-topbar  → background: var(--bg-overlay-light)        │
│  ├─ .logo-main             → background: var(--bg-card)                │
│  ├─ .btn-add               → background: var(--btn-primary-bg)         │
│  ├─ .product-card          → border: 1px solid var(--border-default)  │
│  ├─ .price-old             → color: var(--color-danger-500)            │
│  ├─ .modal                 → box-shadow: var(--shadow-xl)              │
│  └─ ... 96+ classes usando apenas variáveis!                           │
│                                                                           │
│  📄 admin.css    (40% refatorado) 🔄                                    │
│  ├─ .theme-editor          → Renovado ✅                               │
│  ├─ .time-picker           → Renovado ✅                               │
│  ├─ .preview-card          → Renovado ✅                               │
│  ├─ .login-form            → ⏳ Pendente                                │
│  ├─ .dashboard-table       → ⏳ Pendente                                │
│  └─ ... mais a refatorar                                                │
│                                                                           │
│  📄 admin-saas.css, agendamento.css, atendente.css ⏳                 │
│  └─ Mesmo padrão: var(--semantic-token) em lugar de hardcode           │
│                                                                           │
│  ✨ Todos os componentes dependem apenas de semantic tokens             │
│  🔄 Trocar tema = todas cores mudam automaticamente!                   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  ⬇️
                   (importa CSS dos componentes)
                                  ⬇️
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 4: CONTROLE (JavaScript)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  🔧 theme-manager.js                                                    │
│  │                                                                       │
│  └─ window.themeManager (Singleton)                                    │
│     ├─ .updateTheme(name, overrides)                                   │
│     │  └─┐ Valida → Remove classes antigas → Aplica classe nova        │
│     │    └─ Valida customizações → Aplica inline → Salva localStorage  │
│     │    └─ Dispara evento 'themechange'                               │
│     │                                                                   │
│     ├─ .getCurrentTheme()                                              │
│     │  └─ Retorna nome do tema ativo                                   │
│     │                                                                   │
│     ├─ .getOverrides()                                                 │
│     │  └─ Retorna customizações aplicadas                              │
│     │                                                                   │
│     ├─ .exportThemeConfig()                                            │
│     │  └─ Retorna objeto para banco de dados                           │
│     │                                                                   │
│     ├─ .importThemeConfig(config)                                      │
│     │  └─ Restaura a partir do banco                                   │
│     │                                                                   │
│     ├─ .resetToThemeDefaults()                                         │
│     │  └─ Remove customizações, volta a tema base                      │
│     │                                                                   │
│     └─ .loadThemePreference()                                          │
│        └─ Carrega do localStorage na inicialização                     │
│                                                                           │
│  📦 window.updateTheme() ← Atalho global!                              │
│  document.addEventListener('themechange', (e) => { ... })              │
│                                                                           │
│  ✨ Controle completo de temas sem reload de página                   │
│  🚀 Dinâmico, reativo, persistente                                     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════════════╗
║                        FLUXO DE ATUAÇÃO DO TEMA                             ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─ USUÁRIO CLICA "Escurecer" ─────────────────────────────────────────────────┐
│                                                                              │
│    updateTheme('barbershop', { '--accent-primary': '#custom' })            │
│                       ⬇️                                                     │
│    ┌───────────────────────────────────────────────────────────────┐        │
│    │ 1. VALIDAÇÃO                                                 │        │
│    │    ├─ Tema existe? ('barbershop' ✓)                          │        │
│    │    ├─ Customizações são strings? ✓                           │        │
│    │    └─ Variáveis começam com --? ✓                            │        │
│    └───────────────────────────────────────────────────────────────┘        │
│                       ⬇️                                                     │
│    ┌───────────────────────────────────────────────────────────────┐        │
│    │ 2. LIMPEZA                                                   │        │
│    │    └─ document.documentElement.classList.remove('theme-*')   │        │
│    │       Remove .theme-clothing, .theme-restaurant, etc         │        │
│    └───────────────────────────────────────────────────────────────┘        │
│                       ⬇️                                                     │
│    ┌───────────────────────────────────────────────────────────────┐        │
│    │ 3. APLICAÇÃO DE TEMA                                         │        │
│    │    └─ document.documentElement.classList.add('theme-*')      │        │
│    │       Aplica .theme-barbershop                               │        │
│    │       ↓                                                       │        │
│    │       Cascata CSS: var(--accent-primary) vira #d4af37        │        │
│    └───────────────────────────────────────────────────────────────┘        │
│                       ⬇️                                                     │
│    ┌───────────────────────────────────────────────────────────────┐        │
│    │ 4. CUSTOMIZAÇÕES                                             │        │
│    │    └─ :root.style.setProperty('--accent-primary', '#custom') │        │
│    │       Sobrescreve com valor customizado                      │        │
│    └───────────────────────────────────────────────────────────────┘        │
│                       ⬇️                                                     │
│    ┌───────────────────────────────────────────────────────────────┐        │
│    │ 5. PERSISTÊNCIA                                              │        │
│    │    ├─ localStorage['rivertech-theme'] = 'barbershop'         │        │
│    │    └─ localStorage['rivertech-theme-overrides'] = {...}     │        │
│    └───────────────────────────────────────────────────────────────┘        │
│                       ⬇️                                                     │
│    ┌───────────────────────────────────────────────────────────────┐        │
│    │ 6. NOTIFICAÇÃO                                               │        │
│    │    └─ document.dispatchEvent(new CustomEvent('themechange')) │        │
│    │       event.detail = { theme: 'barbershop', overrides: {...} }       │        │
│    │       Listeners recebem atualização                          │        │
│    └───────────────────────────────────────────────────────────────┘        │
│                       ⬇️                                                     │
│    ✨ PRONTO! Página completa mudou cor em <50ms                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════════════╗
║                         RELACIONAMENTO DOS ARQUIVOS                         ║
╚════════════════════════════════════════════════════════════════════════════╝

HTML INDEX
├─ <link rel="stylesheet" href="design-tokens.css"> ─────────┐
├─ <link rel="stylesheet" href="themes.css">  ────────────────┤
├─ <link rel="stylesheet" href="index.css">   ────────────────┤
│                                                               │
└─ <script src="theme-manager.js"></script> ──────────────────┤
   └─ <script>                                                 │
       document.addEventListener('DOMContentLoaded', () => {   │
         themeManager.loadThemePreference();  ◄─ Lê localStorage
       });                                                      │
                                                                │
       document.addEventListener('themechange', (e) => {       │
         // Qualquer componente pode ouvir mudanças        │
         console.log('Novo tema:', e.detail.theme);        │
         // Atualizar UI se necessário                     │
       });                                                      │
                                                                │
       // Usuário alterna tema                                │
       document.getElementById('darkBtn').onclick = () => {   │
         updateTheme('barbershop');  ◄─ Aplica tudo acima ─────
       };                                                       │
     </script>                                                   │
                                                                │
                      │ Importa e renderiza                     │
                      ▼                                          │
                   HTML renderizado                            │
              (com cores do tema ativo)                        │

═══════════════════════════════════════════════════════════════════════════════

📚 DOCUMENTAÇÃO RELACIONADA
├─ QUICK_START.md ────────────── (Como usar em 5 min)
├─ THEMING_README.md ─────────── (Referência completa)
├─ ENTREGAVEIS.md ────────────── (O que foi feito)
├─ IMPLEMENTATION_SUMMARY.md ─── (Arquitetura detalhada)
├─ theme-demo.html ──────────── (Demo interativa)
└─ INDICE_COMPLETO.md ────────── (Você está aqui!)

═══════════════════════════════════════════════════════════════════════════════
```

---

## 🎨 Exemplo de Cascata CSS

```
PASSO 1: Browser carrega tokens
:root {
  --color-brand: #E5B25D;
  --accent-primary: var(--color-brand);
  --btn-primary-bg: var(--accent-primary);
}
Resultado: --btn-primary-bg = #E5B25D

───────────────────────────────────────────────────────

PASSO 2: Theme é aplicado
:root.theme-restaurant {
  --color-brand: #FF6B35;
  /* --accent-primary já está inheritado */
  /* --btn-primary-bg cascata automaticamente */
}
Resultado: --btn-primary-bg = #FF6B35 (automático!)

───────────────────────────────────────────────────────

PASSO 3: Customização é aplicada
:root {
  --color-brand: #FF6B35;     /* De theme-restaurant */
  --btn-primary-bg: #ff4444;  /* Customizado via JS inline */
}
Resultado: --btn-primary-bg = #ff4444 (final)

───────────────────────────────────────────────────────

PASSO 4: CSS renderiza
.button {
  background: var(--btn-primary-bg);  /* #ff4444 */
}

✨ Resultado visual = botão vermelho!
```

---

## 📊 Estrutura de Dados do Theme Config

```json
{
  "theme": "restaurant",
  "overrides": {
    "--color-brand": "#ff6b35",
    "--accent-primary": "#ff4444"
  },
  "variables": {
    "--bg-page": "rgb(15, 15, 15)",
    "--text-primary": "rgb(255, 255, 255)",
    "--btn-primary-bg": "rgb(255, 68, 68)",
    "...": "... todos os 130+ tokens"
  },
  "exportedAt": "2024-05-01T10:30:00.000Z"
}
```

Este objeto é salvo no Supabase para restaurar depois!

---

## 🔄 Ciclo de Vida

```
┌─ PRIMEIRA VISITA ────────────────────────────────────┐
│                                                       │
│  HTML carrega ▶ Scripts executam                    │
│  ▼                                                    │
│  loadThemePreference()  ← localStorage vazio
│  ▼                                                    │
│  Usa defaults (design-tokens default)               │
│  ▼                                                    │
│  Usuário vê: Tema Default (Dourado + Escuro)        │
│  ▼                                                    │
│  Usuário clica "Mudar para Restaurant"              │
│  ▼                                                    │
│  updateTheme('restaurant')                          │
│  ▼                                                    │
│  Salva em localStorage                              │
│                                                       │
├─ SEGUNDA VISITA ────────────────────────────────────┤
│                                                       │
│  HTML carrega ▶ Scripts executam                    │
│  ▼                                                    │
│  loadThemePreference()  ← localStorage tem 'restaurant'
│  ▼                                                    │
│  Aplica theme-restaurant automaticamente            │
│  ▼                                                    │
│  Usuário vê: Tema Restaurant (Laranja + Escuro)     │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 🎯 Para Resumir

1. **design-tokens.css** = Variáveis fonte (130+)
2. **themes.css** = Presets por nicho (5 temas)
3. **CSS Components** = Usam só var(--token)
4. **theme-manager.js** = Aplica tudo dinamicamente
5. **localStorage** = Persiste escolha do usuário
6. **CustomEvents** = Notifica qualquer listener

**Resultado:** Sistema profissional, manutível, escalável! ✨

---

*Mapa Visual - v1.0 - 2024*
