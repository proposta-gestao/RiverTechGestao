/**
 * loja-carrinho.js — Carrinho Lateral da Loja
 * =============================================
 * Carrinho persistente tipo e-commerce:
 *  - Múltiplos produtos
 *  - Alterar quantidade
 *  - Remover item
 *  - Subtotal / Total
 *  - Badge de contador no ícone do header
 *  - Ícone fixo no header da loja
 *  - Preparado para: frete, cupons, promoções
 *
 * Dependências: loja-store.js (LojaStore)
 */

(function () {
    'use strict';

    /* ═══════════════════════════════════════════════
       RENDERIZAR SIDEBAR DO CARRINHO
       ═══════════════════════════════════════════════ */

    function render() {
        const cart = LojaStore.getCart();
        const body = document.getElementById('loja-cart-body');
        const footer = document.getElementById('loja-cart-footer');
        const emptyMsg = document.getElementById('loja-cart-empty');
        const badgeEls = document.querySelectorAll('.loja-cart-badge');
        const count = LojaStore.getCartCount();

        // Badge do header
        badgeEls.forEach(b => {
            b.textContent = count;
            b.style.display = count > 0 ? 'flex' : 'none';
        });

        if (!body) return;

        if (cart.length === 0) {
            body.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'flex';
            if (footer) footer.style.display = 'none';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        if (footer) footer.style.display = 'block';

        body.innerHTML = cart.map(item => `
            <div class="loja-cart-item" data-id="${item.id}">
                <div class="lci-img">
                    ${item.imagem
                        ? `<img src="${item.imagem}" alt="${item.nome}" loading="lazy">`
                        : `<div class="lci-img-placeholder">👗</div>`}
                </div>
                <div class="lci-info">
                    <div class="lci-nome">${item.nome}</div>
                    <div class="lci-variacao">${item.tamanho || ''}${item.tamanho && item.cor ? ' · ' : ''}${item.cor || ''}</div>
                    <div class="lci-preco">${LojaStore.formatPreco(item.preco)}</div>
                </div>
                <div class="lci-controles">
                    <button class="lci-qty-btn" data-action="dec" data-id="${item.id}" aria-label="Diminuir">−</button>
                    <span class="lci-qty-val">${item.quantidade || 1}</span>
                    <button class="lci-qty-btn" data-action="inc" data-id="${item.id}" aria-label="Aumentar">+</button>
                    <button class="lci-remove" data-id="${item.id}" aria-label="Remover item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Bind eventos de quantidade/remoção
        body.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const item = cart.find(i => i.id === id);
                if (!item) return;
                const qtd = (item.quantidade || 1) + (btn.dataset.action === 'inc' ? 1 : -1);
                LojaStore.updateQuantity(id, qtd);
                render();
            });
        });

        body.querySelectorAll('.lci-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                LojaStore.removeFromCart(btn.dataset.id);
                render();
                LojaStore.showToast('Item removido do carrinho.', 'info');
            });
        });

        // Totais no rodapé
        _renderFooter();
    }

    function _renderFooter() {
        const subtotalEl = document.getElementById('loja-cart-subtotal');
        const totalEl = document.getElementById('loja-cart-total');
        const sub = LojaStore.getCartSubtotal();

        if (subtotalEl) subtotalEl.textContent = LojaStore.formatPreco(sub);
        if (totalEl) totalEl.textContent = LojaStore.formatPreco(sub);
        // TODO frete: buscar zona de entrega e somar ao total
    }

    /* ═══════════════════════════════════════════════
       ABRIR / FECHAR SIDEBAR
       ═══════════════════════════════════════════════ */

    function abrir() {
        render();
        const sidebar = document.getElementById('loja-cart-sidebar');
        const backdrop = document.getElementById('loja-cart-backdrop');
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function fechar() {
        const sidebar = document.getElementById('loja-cart-sidebar');
        const backdrop = document.getElementById('loja-cart-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ═══════════════════════════════════════════════
       INICIALIZAÇÃO
       ═══════════════════════════════════════════════ */

    function init() {
        // Botões de abrir carrinho
        document.querySelectorAll('[data-loja-cart-open]').forEach(btn => {
            btn.addEventListener('click', abrir);
        });

        // Botão fechar
        const closeBtn = document.getElementById('loja-cart-close');
        if (closeBtn) closeBtn.addEventListener('click', fechar);

        // Backdrop clica fecha
        const backdrop = document.getElementById('loja-cart-backdrop');
        if (backdrop) backdrop.addEventListener('click', fechar);

        // Botão Finalizar Compra (dentro do sidebar)
        const checkoutBtn = document.getElementById('loja-cart-checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                if (LojaStore.getCartCount() === 0) {
                    LojaStore.showToast('Adicione produtos ao carrinho primeiro.', 'error');
                    return;
                }
                fechar();
                // Abre o checkout
                if (window.LojaCheckout) window.LojaCheckout.abrir();
            });
        }

        // Escutar eventos de atualização do carrinho (de qualquer lugar)
        window.addEventListener('loja:cart:updated', () => render());

        // Render inicial para atualizar badge
        render();
    }

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ═══════════════════════════════════════════════
       API PÚBLICA
       ═══════════════════════════════════════════════ */

    window.LojaCarrinho = { abrir, fechar, render };

})();
