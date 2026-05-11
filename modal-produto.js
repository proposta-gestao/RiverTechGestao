/**
 * modal-produto.js — Modal Premium de Produto
 * ==============================================
 * Controla abertura/fechamento do modal, seleção de variações,
 * exibição de estoque e fluxo de compra.
 * Integra com carousel.js para galeria de imagens.
 *
 * Dependências: carousel.js (ProductCarousel)
 * Expostos: window.ModalProduto
 */

(function () {
    'use strict';

    // ── Cores conhecidas (mapeamento nome → hex) ──
    const CORES_HEX = {
        'preto': '#222222', 'branco': '#f5f5f5', 'cinza': '#9e9e9e',
        'azul': '#1e88e5', 'azul marinho': '#1a237e', 'vermelho': '#e53935',
        'verde': '#43a047', 'amarelo': '#fdd835', 'rosa': '#ec407a',
        'roxo': '#8e24aa', 'laranja': '#ff9800', 'marrom': '#6d4c41',
        'bege': '#d7ccc8', 'vinho': '#880e4f', 'nude': '#d4a89a',
        'off white': '#faf0e6', 'caramelo': '#c68e17', 'bordô': '#800020',
        'mostarda': '#c7a317', 'terracota': '#cc4e2e', 'creme': '#fffdd0',
        'prata': '#c0c0c0', 'dourado': '#daa520', 'coral': '#ff7f50',
        'turquesa': '#40e0d0', 'lilás': '#c8a2c8', 'cáqui': '#bdb76b',
        'petróleo': '#005f6b', 'grafite': '#474747', 'areia': '#c2b280',
    };

    // Ordem padrão dos tamanhos
    const TAMANHOS_ORDEM = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'X1', 'X2', 'UN',
        '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

    // ── Estado ──
    let produto = null;
    let variacoes = [];
    let carousel = null;
    let selectedSize = null;
    let selectedColor = null;

    // ── Refs DOM ──
    let backdrop, modal;

    function getCorHex(nome) {
        return CORES_HEX[(nome || '').toLowerCase()] || '#888888';
    }

    function formatarPreco(valor) {
        return 'R$ ' + parseFloat(valor || 0).toFixed(2).replace('.', ',');
    }

    /* ══════════════════════════════════════════════
       ABRIR MODAL
       ══════════════════════════════════════════════ */

    function abrir(prod) {
        produto = prod;
        variacoes = prod.loja_variacoes || [];
        selectedSize = null;
        selectedColor = null;

        backdrop = document.getElementById('modalProdutoBackdrop');
        if (!backdrop) return;

        // Preencher dados do produto
        _setText('mp-nome', prod.nome);
        _setText('mp-categoria', prod.loja_categorias?.nome || '');
        _setText('mp-descricao', prod.descricao || '');

        // Preço (range ou valor único)
        const precos = variacoes.map(v => parseFloat(v.preco)).filter(p => p > 0);
        const precoEl = document.getElementById('mp-preco');
        if (precoEl) {
            if (precos.length === 0) {
                precoEl.textContent = 'Sob consulta';
            } else {
                const min = Math.min(...precos);
                const max = Math.max(...precos);
                precoEl.textContent = min === max
                    ? formatarPreco(min)
                    : `${formatarPreco(min)} – ${formatarPreco(max)}`;
            }
        }

        // Carrossel de imagens
        const carouselEl = document.getElementById('mp-carousel');
        if (carouselEl) {
            if (carousel) carousel.destroy();
            carousel = new ProductCarousel(carouselEl);
            const imgs = [prod.imagem_url].filter(Boolean);
            carousel.setImages(imgs);
        }

        // Renderizar variações
        _renderTamanhos();
        _renderCores();
        _updateEstoque();
        _updateBotaoCompra();

        // Abrir com animação
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', _onKeyDown);
    }

    /* ══════════════════════════════════════════════
       FECHAR MODAL
       ══════════════════════════════════════════════ */

    function fechar() {
        if (!backdrop) return;
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
        document.removeEventListener('keydown', _onKeyDown);

        if (carousel) { carousel.destroy(); carousel = null; }
        produto = null;
        selectedSize = null;
        selectedColor = null;
    }

    function _onKeyDown(e) {
        if (e.key === 'Escape') fechar();
    }

    /* ══════════════════════════════════════════════
       RENDERIZAR TAMANHOS
       ══════════════════════════════════════════════ */

    function _renderTamanhos() {
        const container = document.getElementById('mp-tamanhos');
        if (!container) return;

        const tamanhos = [...new Set(variacoes.map(v => v.tamanho))];
        // Ordenar conforme tabela padrão
        const sorted = TAMANHOS_ORDEM.filter(t => tamanhos.includes(t));
        tamanhos.forEach(t => { if (!sorted.includes(t)) sorted.push(t); });

        container.innerHTML = sorted.map(tam => {
            const temEstoque = variacoes.some(v => v.tamanho === tam && v.estoque > 0);
            return `<button class="var-chip var-size ${!temEstoque ? 'out-of-stock' : ''}"
                        data-value="${tam}" type="button"
                        ${!temEstoque ? 'title="Esgotado neste tamanho"' : ''}>
                        ${tam}
                    </button>`;
        }).join('');

        // Eventos de clique
        container.querySelectorAll('.var-size').forEach(btn => {
            btn.addEventListener('click', () => _selectSize(btn, container));
        });
    }

    function _selectSize(btn, container) {
        // Permitir selecionar mesmo esgotado (para ver combinações)
        container.querySelectorAll('.var-size').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSize = btn.dataset.value;

        _updateCoresDisponibilidade();
        _updateEstoque();
        _updateBotaoCompra();
        _updatePrecoSelecionado();
    }

    /* ══════════════════════════════════════════════
       RENDERIZAR CORES
       ══════════════════════════════════════════════ */

    function _renderCores() {
        const container = document.getElementById('mp-cores');
        if (!container) return;

        const cores = [...new Set(variacoes.map(v => v.cor))];

        container.innerHTML = cores.map(cor => {
            const hex = getCorHex(cor);
            const temEstoque = variacoes.some(v => v.cor === cor && v.estoque > 0);
            const isLight = _isLightColor(hex);
            return `<button class="var-color ${!temEstoque ? 'out-of-stock' : ''} ${isLight ? 'light' : ''}"
                        data-value="${cor}" type="button"
                        title="${cor}${!temEstoque ? ' (Esgotado)' : ''}">
                        <span class="var-color-dot" style="background: ${hex};"></span>
                        <span class="var-color-check">✓</span>
                    </button>`;
        }).join('');

        // Eventos
        container.querySelectorAll('.var-color').forEach(btn => {
            btn.addEventListener('click', () => _selectColor(btn, container));
        });
    }

    function _selectColor(btn, container) {
        container.querySelectorAll('.var-color').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedColor = btn.dataset.value;

        _updateTamanhosDisponibilidade();
        _updateEstoque();
        _updateBotaoCompra();
        _updatePrecoSelecionado();
    }

    /* ══════════════════════════════════════════════
       ATUALIZAR DISPONIBILIDADE CRUZADA
       ══════════════════════════════════════════════ */

    function _updateCoresDisponibilidade() {
        if (!selectedSize) return;
        const container = document.getElementById('mp-cores');
        if (!container) return;

        container.querySelectorAll('.var-color').forEach(btn => {
            const cor = btn.dataset.value;
            const variacao = variacoes.find(v => v.tamanho === selectedSize && v.cor === cor);
            const disponivel = variacao && variacao.estoque > 0;
            btn.classList.toggle('out-of-stock', !disponivel);
        });
    }

    function _updateTamanhosDisponibilidade() {
        if (!selectedColor) return;
        const container = document.getElementById('mp-tamanhos');
        if (!container) return;

        container.querySelectorAll('.var-size').forEach(btn => {
            const tam = btn.dataset.value;
            const variacao = variacoes.find(v => v.cor === selectedColor && v.tamanho === tam);
            const disponivel = variacao && variacao.estoque > 0;
            btn.classList.toggle('out-of-stock', !disponivel);
        });
    }

    /* ══════════════════════════════════════════════
       ATUALIZAR ESTOQUE / PREÇO / BOTÃO
       ══════════════════════════════════════════════ */

    function _updateEstoque() {
        const el = document.getElementById('mp-estoque');
        if (!el) return;

        if (!selectedSize && !selectedColor) {
            const total = variacoes.reduce((s, v) => s + (v.estoque || 0), 0);
            el.innerHTML = total > 0
                ? `<span class="estoque-badge ok">${total} unidades disponíveis</span>`
                : `<span class="estoque-badge zero">Produto esgotado</span>`;
            return;
        }

        const variacao = _getVariacaoSelecionada();
        if (variacao) {
            const qtd = variacao.estoque || 0;
            if (qtd <= 0) {
                el.innerHTML = `<span class="estoque-badge zero">Esgotado</span>`;
            } else if (qtd <= 5) {
                el.innerHTML = `<span class="estoque-badge baixo">Últimas ${qtd} unidades!</span>`;
            } else {
                el.innerHTML = `<span class="estoque-badge ok">${qtd} disponíveis</span>`;
            }
        } else if (selectedSize && selectedColor) {
            el.innerHTML = `<span class="estoque-badge zero">Combinação indisponível</span>`;
        } else {
            el.innerHTML = `<span class="estoque-badge info">Selecione tamanho e cor</span>`;
        }
    }

    function _updatePrecoSelecionado() {
        const el = document.getElementById('mp-preco');
        if (!el) return;

        const variacao = _getVariacaoSelecionada();
        if (variacao && variacao.preco > 0) {
            el.textContent = formatarPreco(variacao.preco);
            el.classList.add('price-updated');
            setTimeout(() => el.classList.remove('price-updated'), 400);
        }
    }

    function _updateBotaoCompra() {
        const btn = document.getElementById('mp-btn-comprar');
        const texto = document.getElementById('mp-btn-texto');
        if (!btn || !texto) return;

        const variacao = _getVariacaoSelecionada();

        if (!selectedSize || !selectedColor) {
            btn.disabled = true;
            texto.textContent = 'Selecione tamanho e cor';
            btn.classList.remove('ready');
            return;
        }

        if (!variacao || variacao.estoque <= 0) {
            btn.disabled = true;
            texto.textContent = 'Indisponível';
            btn.classList.remove('ready');
            return;
        }

        btn.disabled = false;
        texto.textContent = 'Comprar agora';
        btn.classList.add('ready');
    }

    function _getVariacaoSelecionada() {
        if (!selectedSize || !selectedColor) return null;
        return variacoes.find(v => v.tamanho === selectedSize && v.cor === selectedColor) || null;
    }

    /* ══════════════════════════════════════════════
       COMPRA
       ══════════════════════════════════════════════ */

    async function comprar(supabaseClient, onSuccess) {
        const variacao = _getVariacaoSelecionada();
        if (!variacao || variacao.estoque <= 0) return;

        // Ocultar modal de produto temporariamente e abrir o de checkout
        fechar();
        
        const chkBackdrop = document.getElementById('modalCheckoutBackdrop');
        if (chkBackdrop) {
            chkBackdrop.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Grava a variação selecionada no botão para uso posterior
            const btnConfirm = document.getElementById('btnConfirmarCheckout');
            if (btnConfirm) {
                btnConfirm.dataset.variacaoId = variacao.id;
                // Limpar event listeners antigos recriando o elemento
                const novoBtn = btnConfirm.cloneNode(true);
                btnConfirm.parentNode.replaceChild(novoBtn, btnConfirm);
                
                novoBtn.addEventListener('click', async () => {
                    if (typeof window.processarCheckoutLoja === 'function') {
                        await window.processarCheckoutLoja(variacao, onSuccess);
                    }
                });
            }
        }
    }

    /** Re-abrir modal com dados atualizados */
    function recarregar(novoProduto) {
        if (novoProduto) abrir(novoProduto);
    }

    /* ══════════════════════════════════════════════
       UTILITÁRIOS
       ══════════════════════════════════════════════ */

    function _setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function _isLightColor(hex) {
        if (!hex || !hex.startsWith('#')) return false;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 180;
    }

    function _showToast(msg, type) {
        // Usa o showToast global se existir (do admin.js), senão cria um simples
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `mp-toast mp-toast-${type || 'info'}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ══════════════════════════════════════════════
       EXPORTAR
       ══════════════════════════════════════════════ */

    window.ModalProduto = {
        abrir,
        fechar,
        comprar,
        recarregar,
        getVariacaoSelecionada: _getVariacaoSelecionada,
        getProdutoAtual: () => produto,
    };

})();
