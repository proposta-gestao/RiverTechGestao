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

        const hasEstoqueMod = typeof isModuloAtivo === 'function' ? isModuloAtivo('loja_estoque') : true;

        if (!hasEstoqueMod) {
            variacoes.forEach(v => v.estoque = 9999);
        }

        const mpEstoque = document.getElementById('mp-estoque');
        if(mpEstoque) mpEstoque.style.display = hasEstoqueMod ? 'block' : 'none';

        // Inicializar Carrossel de imagens — usa galeria_imagens (múltiplas fotos)
        const carouselEl = document.getElementById('mp-carousel');
        if (carouselEl) {
            if (carousel) carousel.destroy();
            carousel = new ProductCarousel(carouselEl);
            
            // 1. Galeria de imagens ordenada
            const galeria = (prod.galeria_imagens || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(g => g.url).filter(Boolean);
            
            // Deduplicador de URLs para lidar com resíduos de banco de dados
            const uniqueGaleria = [];
            const seenUrls = new Set();
            galeria.forEach(url => {
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    uniqueGaleria.push(url);
                }
            });

            // 2. Capa principal (se não estiver na galeria)
            if (prod.imagem_url && !seenUrls.has(prod.imagem_url)) {
                uniqueGaleria.unshift(prod.imagem_url);
                seenUrls.add(prod.imagem_url);
            }
            
            // 3. Imagens específicas das variações (se não estiverem na galeria)
            const varImgs = (prod.loja_variacoes || []).map(v => v.imagem_url).filter(Boolean);
            varImgs.forEach(url => {
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    uniqueGaleria.push(url);
                }
            });

            carousel.setImages(uniqueGaleria.length > 0 ? uniqueGaleria : []);
            window._lojaCarousel = carousel;
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

        // --- Swipe Down to Close (Mobile) ---
        modal = document.getElementById('modalProdutoContent');
        if (modal) {
            let startY = 0;
            let isDraggingDown = false;
            // Flag: se o usuário rolou para cima (scrollTop > 0) no início do gesto, cancelar drag
            let gestureStartedAtTop = false;
            
            modal._swipeHandler = (e) => {
                // Não intercepta se o toque foi dentro do carrossel para não conflitar com zoom/swipe de foto
                if (e.target.closest('#mp-carousel')) return;
                
                if (e.type === 'touchstart') {
                    startY = e.touches[0].clientY;
                    isDraggingDown = false;
                    // Só habilita o arrasto se o modal estiver no topo no início do gesto
                    gestureStartedAtTop = (modal.scrollTop <= 0);
                    modal.style.transition = 'none';
                } else if (e.type === 'touchmove') {
                    // Só faz drag se o gesto começou com o modal no topo
                    // E verifica novamente que ainda está no topo (não houve scroll durante o gesto)
                    if (gestureStartedAtTop && modal.scrollTop <= 0) {
                        const diffY = e.touches[0].clientY - startY;
                        if (diffY > 0) { // Arrastando para baixo
                            isDraggingDown = true;
                            modal.style.transform = `translateY(${diffY}px)`;
                            if (e.cancelable) e.preventDefault();
                        } else {
                            // Usuário está tentando rolar para cima mas já está no topo:
                            // reseta o drag para não acionar o fechar
                            if (isDraggingDown) {
                                modal.style.transform = '';
                                isDraggingDown = false;
                            }
                        }
                    } else {
                        // Modal foi rolado — cancela qualquer drag em andamento
                        if (isDraggingDown) {
                            modal.style.transition = 'transform 0.2s ease';
                            modal.style.transform = '';
                            isDraggingDown = false;
                        }
                        gestureStartedAtTop = false;
                    }
                } else if (e.type === 'touchend') {
                    if (isDraggingDown) {
                        const diffY = e.changedTouches[0].clientY - startY;
                        if (diffY > 120) {
                            fechar();
                        } else {
                            modal.style.transition = 'transform 0.3s ease';
                            modal.style.transform = '';
                        }
                        isDraggingDown = false;
                    }
                }
            };
            
            modal.addEventListener('touchstart', modal._swipeHandler, { passive: true });
            modal.addEventListener('touchmove', modal._swipeHandler, { passive: false });
            modal.addEventListener('touchend', modal._swipeHandler);
        }
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
        
        if (modal && modal._swipeHandler) {
            modal.removeEventListener('touchstart', modal._swipeHandler);
            modal.removeEventListener('touchmove', modal._swipeHandler);
            modal.removeEventListener('touchend', modal._swipeHandler);
            modal.style.transform = '';
            modal.style.transition = '';
            delete modal._swipeHandler;
        }
        
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
        container.querySelectorAll('.var-size').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSize = btn.dataset.value;

        _updateCoresDisponibilidade();
        _updateEstoque();
        _updateBotaoCompra();
        _updatePrecoSelecionado();
        _atualizarFotoVariacao();
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
        _atualizarFotoVariacao();
    }

    // Troca a foto do carrossel para a imagem específica da variação selecionada
    function _atualizarFotoVariacao() {
        if (!carousel) return;

        // Verifica o que o produto exige
        const temCores = variacoes.some(v => !!v.cor);
        const temTamanhos = variacoes.some(v => !!v.tamanho);

        // Só muda a foto quando todas as dimensões disponíveis no produto estiverem selecionadas
        if (temCores && temTamanhos) {
            if (!selectedColor || !selectedSize) return;
        } else {
            if (!selectedColor && !selectedSize) return;
        }

        // Procura a variação que bate com a seleção atual
        const variacao = variacoes.find(v => {
            let match = true;
            if (temCores && selectedColor && v.cor !== selectedColor) match = false;
            if (temTamanhos && selectedSize && v.tamanho !== selectedSize) match = false;
            return match;
        });

        if (variacao && variacao.imagem_url) {
            const index = carousel.images.indexOf(variacao.imagem_url);
            if (index !== -1) {
                // Navega de forma suave para a imagem da variação
                carousel.goTo(index);
            }
        }
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
        if (!btn) return;

        const variacao = _getVariacaoSelecionada();
        const iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;

        const temCores = variacoes.some(v => !!v.cor);
        const temTamanhos = variacoes.some(v => !!v.tamanho);
        
        let pendente = false;
        if (temCores && temTamanhos) {
            if (!selectedSize || !selectedColor) pendente = true;
        } else if (temCores) {
            if (!selectedColor) pendente = true;
        } else if (temTamanhos) {
            if (!selectedSize) pendente = true;
        }

        if (pendente) {
            btn.disabled = true;
            const falta = (temCores && temTamanhos) ? 'tamanho e cor' : (temCores ? 'a cor' : 'o tamanho');
            btn.innerHTML = `${iconSvg} <span>Selecione ${falta}</span>`;
            btn.classList.remove('ready');
            return;
        }

        if (!variacao || variacao.estoque <= 0) {
            btn.disabled = true;
            btn.innerHTML = `${iconSvg} <span>Indisponível</span>`;
            btn.classList.remove('ready');
            return;
        }

        btn.disabled = false;
        btn.innerHTML = `${iconSvg} <span>Comprar Agora</span>`;
        btn.classList.add('ready');
    }

    function _getVariacaoSelecionada() {
        const temCores = variacoes.some(v => !!v.cor);
        const temTamanhos = variacoes.some(v => !!v.tamanho);

        let pendente = false;
        if (temCores && temTamanhos) {
            if (!selectedSize || !selectedColor) pendente = true;
        } else if (temCores) {
            if (!selectedColor) pendente = true;
        } else if (temTamanhos) {
            if (!selectedSize) pendente = true;
        }
        
        if (pendente) return null;

        return variacoes.find(v => {
            let match = true;
            if (temCores && selectedColor && v.cor !== selectedColor) match = false;
            if (temTamanhos && selectedSize && v.tamanho !== selectedSize) match = false;
            return match;
        }) || null;
    }

    /* ══════════════════════════════════════════════
       COMPRA
       A ação de compra é delegada ao vitrine.js + loja-store.js.
       Este método permanece para compatibilidade com código legado.
       ══════════════════════════════════════════════ */

    async function comprar(supabaseClient, onSuccess) {
        // Delegar ao handler externo se disponível (novo fluxo: loja-store.js + carrinho)
        const variacao = _getVariacaoSelecionada();
        if (!variacao) return;
        if (typeof onSuccess === 'function') {
            await onSuccess(variacao);
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
