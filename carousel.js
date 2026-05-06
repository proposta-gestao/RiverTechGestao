/**
 * carousel.js — Carrossel de Imagens Premium
 * ============================================
 * Carrossel infinito com navegação, swipe (mobile) e zoom.
 * 100% JavaScript puro, sem dependências externas.
 *
 * Uso:
 *   const carousel = new ProductCarousel(containerEl);
 *   carousel.setImages(['url1.jpg', 'url2.jpg']);
 *   carousel.destroy();
 */

class ProductCarousel {
    /**
     * @param {HTMLElement} container - Elemento onde o carrossel será renderizado
     */
    constructor(container) {
        this.container = container;
        this.images = [];
        this.currentIndex = 0;
        this.isAnimating = false;

        // Touch / Drag state
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchDeltaX = 0;
        this.isDragging = false;
        this.swipeThreshold = 50;

        // Bound handlers (para remoção limpa)
        this._boundKeyHandler = this._handleKey.bind(this);

        this._buildDOM();
        this._bindEvents();
    }

    /* ── Construir estrutura HTML ── */
    _buildDOM() {
        this.container.classList.add('carousel');
        this.container.innerHTML = `
            <div class="carousel-viewport">
                <div class="carousel-track"></div>
                <button class="carousel-btn carousel-prev" aria-label="Imagem anterior">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button class="carousel-btn carousel-next" aria-label="Próxima imagem">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
                <div class="carousel-counter"></div>
            </div>
            <div class="carousel-thumbs"></div>
        `;

        this.viewport = this.container.querySelector('.carousel-viewport');
        this.track = this.container.querySelector('.carousel-track');
        this.prevBtn = this.container.querySelector('.carousel-prev');
        this.nextBtn = this.container.querySelector('.carousel-next');
        this.counter = this.container.querySelector('.carousel-counter');
        this.thumbsContainer = this.container.querySelector('.carousel-thumbs');
    }

    /* ── Bindear eventos ── */
    _bindEvents() {
        this.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
        this.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });

        // Touch (mobile)
        this.viewport.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
        this.viewport.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        this.viewport.addEventListener('touchend', () => this._onTouchEnd());

        // Mouse drag (desktop)
        this.viewport.addEventListener('mousedown', (e) => this._onMouseDown(e));

        // Click para zoom
        this.viewport.addEventListener('click', () => {
            if (!this.isDragging && Math.abs(this.touchDeltaX) < 5) {
                this._openZoom();
            }
        });
    }

    /* ══════════════════════════════════════════════
       API PÚBLICA
       ══════════════════════════════════════════════ */

    /**
     * Define as imagens do carrossel
     * @param {string[]} urls - Array de URLs de imagens
     */
    setImages(urls) {
        this.images = (urls || []).filter(Boolean);
        this.currentIndex = 0;

        // Sem imagens → placeholder
        if (this.images.length === 0) {
            this.track.innerHTML = `
                <div class="carousel-slide active">
                    <div class="carousel-placeholder">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>Sem imagem</span>
                    </div>
                </div>`;
            this._toggleControls(false);
            return;
        }

        // Criar slides
        this.track.innerHTML = this.images.map((url, i) => `
            <div class="carousel-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
                <img src="${url}" alt="Produto - imagem ${i + 1}" loading="lazy" draggable="false">
            </div>
        `).join('');

        const multi = this.images.length > 1;
        this._toggleControls(multi);

        // Miniaturas
        if (multi) {
            this.thumbsContainer.innerHTML = this.images.map((url, i) => `
                <button class="carousel-thumb ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Imagem ${i + 1}">
                    <img src="${url}" alt="" loading="lazy" draggable="false">
                </button>
            `).join('');

            this.thumbsContainer.querySelectorAll('.carousel-thumb').forEach(thumb => {
                thumb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.goTo(parseInt(thumb.dataset.index));
                });
            });
        }

        this._updateCounter();
    }

    /** Ir para slide específico (com loop infinito) */
    goTo(index) {
        if (this.isAnimating || this.images.length <= 1) return;

        // Loop infinito
        if (index < 0) index = this.images.length - 1;
        if (index >= this.images.length) index = 0;
        if (index === this.currentIndex) return;

        const direction = index > this.currentIndex ? 'next' : 'prev';
        this.isAnimating = true;

        const slides = this.track.querySelectorAll('.carousel-slide');
        const currentSlide = slides[this.currentIndex];
        const nextSlide = slides[index];

        // Posicionar slide de entrada fora da tela
        nextSlide.style.transition = 'none';
        nextSlide.classList.add(`enter-${direction}`);
        nextSlide.classList.add('active');

        // Forçar reflow para que a posição inicial seja aplicada
        nextSlide.offsetHeight;

        // Animar transição
        nextSlide.style.transition = '';
        currentSlide.classList.add(`exit-${direction}`);
        nextSlide.classList.remove(`enter-${direction}`);

        const onEnd = () => {
            currentSlide.classList.remove('active', `exit-${direction}`);
            currentSlide.style.transition = '';
            this.currentIndex = index;
            this.isAnimating = false;
            this._updateThumbs();
            this._updateCounter();
        };

        // Fallback timeout caso transitionend não dispare
        setTimeout(onEnd, 400);
    }

    /** Próximo slide */
    next() { this.goTo(this.currentIndex + 1); }

    /** Slide anterior */
    prev() { this.goTo(this.currentIndex - 1); }

    /** Limpar e destruir carrossel */
    destroy() {
        document.removeEventListener('keydown', this._boundKeyHandler);
        this._closeZoom();
        this.container.innerHTML = '';
        this.container.classList.remove('carousel');
    }

    /* ══════════════════════════════════════════════
       INTERNOS
       ══════════════════════════════════════════════ */

    _toggleControls(show) {
        const display = show ? '' : 'none';
        this.prevBtn.style.display = display;
        this.nextBtn.style.display = display;
        this.counter.style.display = display;
        this.thumbsContainer.style.display = display;
    }

    _updateThumbs() {
        this.thumbsContainer.querySelectorAll('.carousel-thumb').forEach((t, i) => {
            t.classList.toggle('active', i === this.currentIndex);
        });
        // Scroll thumb ativo para o centro
        const active = this.thumbsContainer.querySelector('.carousel-thumb.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    _updateCounter() {
        if (this.images.length > 1) {
            this.counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
        }
    }

    /* ── Touch Events (Mobile Swipe) ── */
    _onTouchStart(e) {
        if (this.isAnimating) return;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchDeltaX = 0;
        this.isDragging = true;
    }

    _onTouchMove(e) {
        if (!this.isDragging) return;
        this.touchDeltaX = e.touches[0].clientX - this.touchStartX;
        const deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);
        // Se movimento horizontal > vertical, prevenir scroll da página
        if (Math.abs(this.touchDeltaX) > deltaY && Math.abs(this.touchDeltaX) > 10) {
            e.preventDefault();
        }
    }

    _onTouchEnd() {
        this.isDragging = false;
        if (Math.abs(this.touchDeltaX) > this.swipeThreshold) {
            this.touchDeltaX > 0 ? this.prev() : this.next();
        }
        this.touchDeltaX = 0;
    }

    /* ── Mouse Drag (Desktop) ── */
    _onMouseDown(e) {
        if (this.isAnimating) return;
        e.preventDefault();
        this.touchStartX = e.clientX;
        this.touchDeltaX = 0;
        this.isDragging = true;

        const onMove = (ev) => { this.touchDeltaX = ev.clientX - this.touchStartX; };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (Math.abs(this.touchDeltaX) > this.swipeThreshold) {
                this.touchDeltaX > 0 ? this.prev() : this.next();
            }
            setTimeout(() => { this.isDragging = false; }, 10);
            this.touchDeltaX = 0;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    /* ── Zoom / Fullscreen ── */
    _openZoom() {
        if (this.images.length === 0) return;

        const overlay = document.createElement('div');
        overlay.className = 'carousel-zoom-overlay';
        overlay.innerHTML = `
            <button class="carousel-zoom-close" aria-label="Fechar zoom">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <img src="${this.images[this.currentIndex]}" alt="Zoom da imagem" draggable="false">
        `;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('.carousel-zoom-close')) {
                this._closeZoom();
            }
        });

        document.body.appendChild(overlay);
        document.addEventListener('keydown', this._boundKeyHandler);
        requestAnimationFrame(() => overlay.classList.add('active'));
    }

    _closeZoom() {
        const overlay = document.querySelector('.carousel-zoom-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            document.removeEventListener('keydown', this._boundKeyHandler);
        }
    }

    _handleKey(e) {
        if (e.key === 'Escape') this._closeZoom();
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === 'ArrowRight') this.next();
    }
}

// Expor globalmente
window.ProductCarousel = ProductCarousel;
