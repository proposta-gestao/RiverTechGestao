/**
 * loja-store.js — Núcleo da Loja Pública
 * =========================================
 * Responsabilidades:
 *  1. Detectar segmento da empresa (loja_roupas, restaurante, etc.)
 *  2. Gerenciar carrinho persistente (localStorage) com múltiplos itens
 *  3. Utilitários compartilhados (formatPreco, showToast, etc.)
 *  4. Hooks de extensão para funcionalidades futuras:
 *     - Favoritos, Lista de Desejos, Avaliações, Cupons,
 *       Produtos Recentes, Compartilhamento, Coleções, Marcas
 *
 * NÃO altera o Cardápio nem a lógica de restaurante.
 * Apenas adiciona o conceito de "Segmento / Tema de Loja".
 */

(function () {
    'use strict';

    /* ═══════════════════════════════════════════════
       CONSTANTES DE SEGMENTO
       ═══════════════════════════════════════════════ */

    const SEGMENTOS = {
        RESTAURANTE:  'restaurante',
        LOJA_ROUPAS:  'loja_roupas',
        COSMETICOS:   'cosmeticos',
        PET_SHOP:     'pet_shop',
        LOJA_GERAL:   'loja_geral',
        // Adicionar novos segmentos aqui sem refatoração
    };

    /**
     * Retorna o segmento da empresa logada (via window.TENANT).
     * Fallback: 'loja_geral' se não definido.
     */
    function getSegmento() {
        return (window.TENANT && window.TENANT.segmento) || SEGMENTOS.LOJA_GERAL;
    }

    /**
     * Verifica se o segmento atual é uma loja (não restaurante).
     * Útil para esconder elementos específicos de restaurante.
     */
    function isLoja() {
        const seg = getSegmento();
        return seg !== SEGMENTOS.RESTAURANTE;
    }

    /* ═══════════════════════════════════════════════
       CARRINHO PERSISTENTE
       ═══════════════════════════════════════════════ */

    const CART_KEY_PREFIX = 'rt_cart_';

    function _getCartKey() {
        const id = window.TENANT && window.TENANT.empresa_id ? window.TENANT.empresa_id : 'default';
        return CART_KEY_PREFIX + id;
    }

    /**
     * Estrutura de um item do carrinho:
     * {
     *   id: string (variacaoId),
     *   produtoId: string,
     *   nome: string,
     *   categoria: string,
     *   imagem: string,
     *   tamanho: string,
     *   cor: string,
     *   preco: number,
     *   quantidade: number,
     *   // Preparado para:
     *   // marca: string,
     *   // colecao: string,
     * }
     */

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(_getCartKey()) || '[]');
        } catch {
            return [];
        }
    }

    function saveCart(items) {
        try {
            localStorage.setItem(_getCartKey(), JSON.stringify(items));
        } catch (e) {
            console.warn('[LojaStore] Erro ao salvar carrinho:', e);
        }
        _dispatchCartEvent();
    }

    function addToCart(item) {
        const cart = getCart();
        // Mesma variação já existe? Incrementa quantidade
        const existing = cart.find(i => i.id === item.id);
        if (existing) {
            existing.quantidade = (existing.quantidade || 1) + (item.quantidade || 1);
        } else {
            cart.push({ ...item, quantidade: item.quantidade || 1 });
        }
        saveCart(cart);
        return cart;
    }

    function removeFromCart(variacaoId) {
        const cart = getCart().filter(i => i.id !== variacaoId);
        saveCart(cart);
        return cart;
    }

    function updateQuantity(variacaoId, quantidade) {
        const cart = getCart();
        const item = cart.find(i => i.id === variacaoId);
        if (item) {
            if (quantidade <= 0) return removeFromCart(variacaoId);
            item.quantidade = quantidade;
        }
        saveCart(cart);
        return cart;
    }

    function clearCart() {
        saveCart([]);
    }

    function getCartCount() {
        return getCart().reduce((s, i) => s + (i.quantidade || 1), 0);
    }

    function getCartSubtotal() {
        return getCart().reduce((s, i) => s + (parseFloat(i.preco) * (i.quantidade || 1)), 0);
    }

    function _dispatchCartEvent() {
        window.dispatchEvent(new CustomEvent('loja:cart:updated', {
            detail: { count: getCartCount(), subtotal: getCartSubtotal() }
        }));
    }

    /* ═══════════════════════════════════════════════
       UTILITÁRIOS
       ═══════════════════════════════════════════════ */

    function formatPreco(valor) {
        return 'R$ ' + parseFloat(valor || 0).toFixed(2).replace('.', ',');
    }

    function showToast(msg, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `mp-toast mp-toast-${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ═══════════════════════════════════════════════
       HOOKS PARA EXTENSÃO FUTURA
       ═══════════════════════════════════════════════ */

    /**
     * Registry de extensões da loja.
     * Futuras funcionalidades (favoritos, avaliações, cupons, etc.)
     * se registram aqui sem alterar o núcleo.
     *
     * Uso:
     *   LojaStore.registerPlugin('favoritos', FavoritosModule);
     */
    const _plugins = {};

    function registerPlugin(name, module) {
        _plugins[name] = module;
        console.info('[LojaStore] Plugin registrado:', name);
    }

    function getPlugin(name) {
        return _plugins[name] || null;
    }

    /* ═══════════════════════════════════════════════
       PRODUTOS RECENTEMENTE VISTOS (estrutura)
       ═══════════════════════════════════════════════ */

    const RECENTES_KEY = 'rt_recentes_';
    const MAX_RECENTES = 10;

    function addRecentlyViewed(produto) {
        try {
            const key = RECENTES_KEY + (window.TENANT?.empresa_id || 'default');
            let recentes = JSON.parse(localStorage.getItem(key) || '[]');
            recentes = recentes.filter(p => p.id !== produto.id);
            recentes.unshift({ id: produto.id, nome: produto.nome, imagem: produto.imagem_url, preco: produto.preco });
            if (recentes.length > MAX_RECENTES) recentes = recentes.slice(0, MAX_RECENTES);
            localStorage.setItem(key, JSON.stringify(recentes));
        } catch { /* silencioso */ }
    }

    function getRecentlyViewed() {
        try {
            const key = RECENTES_KEY + (window.TENANT?.empresa_id || 'default');
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch { return []; }
    }

    /* ═══════════════════════════════════════════════
       API PÚBLICA
       ═══════════════════════════════════════════════ */

    window.LojaStore = {
        // Segmento
        SEGMENTOS,
        getSegmento,
        isLoja,

        // Carrinho
        getCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartCount,
        getCartSubtotal,

        // Utilitários
        formatPreco,
        showToast,

        // Plugins / Extensões futuras
        registerPlugin,
        getPlugin,

        // Histórico de visualizações
        addRecentlyViewed,
        getRecentlyViewed,
    };

    console.info('[LojaStore] ✅ Núcleo da Loja inicializado.');

})();
