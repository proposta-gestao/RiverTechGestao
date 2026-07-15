/**
 * vitrine.js — Vitrine Pública da Loja de Roupas (v2)
 * ======================================================
 * Responsabilidades:
 *  - Carregar categorias e produtos do Supabase
 *  - Gerenciar filtros (categoria, tamanho, cor, busca, ordenação)
 *  - Renderizar grid de cards
 *  - Renderizar seções de destaque (Hero, Destaques, Novidades)
 *  - Integrar com modal-produto.js (detalhes + seleção de variação)
 *  - Integrar com loja-store.js (adicionar ao carrinho)
 *  - Integrar com loja-checkout.js (configurar supabase)
 *  - Rastrear produtos recentemente vistos
 *
 * Dependências: modal-produto.js, loja-store.js, loja-carrinho.js, loja-checkout.js, tenant.js
 * NÃO depende de: index.js, cardapio.html ou qualquer módulo de restaurante.
 */

(function () {
    'use strict';

    // ── Supabase ──
    const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

    // ── Estado ──
    let _produtos = [];
    let _categorias = [];
    let _filtroCategoria = '';
    let _filtroTamanho = '';
    let _filtroCor = '';
    let _filtroBusca = '';
    let _ordenacao = 'recentes';

    // Ordem padrão de tamanhos
    const TAMANHOS_ORDEM = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'X1', 'X2', 'UN',
        '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

    /* ═══════════════════════════════════════════════
       INICIALIZAÇÃO
       ═══════════════════════════════════════════════ */

    async function init() {
        try {
            const empresaId = await initTenantPublico(sb);
            if (!empresaId) return;

            // Configurar checkout com supabase e empresaId
            if (window.LojaCheckout) window.LojaCheckout.setup(sb, empresaId);

            // Logo (via tenant.js)
            const logoEl = document.getElementById('logoEmpresa');
            if (window.TENANT.logo_url && logoEl) {
                logoEl.src = window.TENANT.logo_url;
                logoEl.style.display = 'block';
            }

            // Carregar dados em paralelo
            await Promise.all([
                _carregarCategorias(empresaId),
                _carregarProdutos(empresaId),
            ]);

            // Configurar opções de pagamento conforme empresa
            const { data: empData } = await sb
                .from('empresas_publico')
                .select('pix_habilitado, cartao_habilitado, store_banner_url, store_slogan, store_colecao, store_config')
                .eq('id', empresaId)
                .single();

            if (empData) {
                _configurarPagamentos(empData);
                _renderHero(empData);
                _renderSecaoDestaque(empData);
            }

            _popularFiltros();
            _renderProdutos();
            _setupEventos();
            _setupModalProduto();

        } catch (err) {
            console.error('[Vitrine] Erro na inicialização:', err);
        }
    }

    /* ═══════════════════════════════════════════════
       DADOS — SUPABASE
       ═══════════════════════════════════════════════ */

    async function _carregarCategorias(empresaId) {
        const { data, error } = await sb
            .from('loja_categorias')
            .select('id, nome')
            .eq('empresa_id', empresaId)
            .order('ordem');
        if (error) { console.error('[Vitrine] Categorias:', error); return; }
        _categorias = data || [];
    }

    async function _carregarProdutos(empresaId) {
        const { data, error } = await sb
            .from('loja_produtos')
            .select('*, loja_categorias(nome), loja_variacoes(*), galeria_imagens(*)')
            .eq('empresa_id', empresaId)
            .eq('ativo', true)
            .order('created_at', { ascending: false });

        if (error) { console.error('[Vitrine] Produtos:', error); return; }
        _produtos = data || [];
    }

    /* ═══════════════════════════════════════════════
       HERO BANNER (PASSO 2)
       ═══════════════════════════════════════════════ */

    function _renderHero(empData) {
        const hero = document.getElementById('loja-hero');
        if (!hero) return;

        const bannerUrl = empData.store_banner_url;
        const slogan = empData.store_slogan || window.TENANT.brand_subtitle || 'Descubra as melhores peças.';
        const colecao = empData.store_colecao || 'Nova Coleção';
        const nome = window.TENANT.nome || 'Nossa Loja';

        // Preencher conteúdo
        const eyebrow = document.getElementById('loja-hero-eyebrow');
        const title = document.getElementById('loja-hero-title');
        const subtitle = document.getElementById('loja-hero-subtitle');

        if (eyebrow) eyebrow.textContent = colecao;
        if (title) title.textContent = nome;
        if (subtitle) subtitle.textContent = slogan;

        // Imagem de fundo
        if (bannerUrl) {
            hero.style.backgroundImage = `url(${bannerUrl})`;
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = 'center';
        }

        // Botão CTA rola para o grid
        const ctaBtn = document.getElementById('loja-hero-cta');
        if (ctaBtn) {
            ctaBtn.addEventListener('click', () => {
                document.getElementById('loja-main')?.scrollIntoView({ behavior: 'smooth' });
            });
        }

        hero.style.display = 'flex';
    }

    /* ═══════════════════════════════════════════════
       SEÇÕES DE DESTAQUE (PASSO 2)
       Preparado para: Destaques, Novidades, Promoções, Mais Vendidos
       (injetados via store_config no futuro)
       ═══════════════════════════════════════════════ */

    function _renderSecaoDestaque(empData) {
        const secoes = document.getElementById('loja-secoes-destaque');
        if (!secoes) return;

        // Destaques: produtos com flag "destaque" = true
        const destaques = _produtos.filter(p => p.destaque === true).slice(0, 8);
        if (destaques.length > 0) {
            secoes.style.display = 'block';
            secoes.innerHTML += `
                <section class="loja-secao-destaque" aria-label="Produtos em destaque">
                    <div class="loja-secao-header">
                        <h2 class="loja-secao-titulo">⭐ Destaques</h2>
                    </div>
                    <div class="loja-secao-grid" id="grid-destaques">
                        ${destaques.map(p => _buildCard(p, true)).join('')}
                    </div>
                </section>`;
            _bindCardEvents(document.getElementById('grid-destaques'));
        }

        // Novidades: 8 mais recentes (já vem ordenado por created_at DESC)
        const novidades = _produtos.slice(0, 8);
        if (novidades.length > 0 && destaques.length === 0) {
            secoes.style.display = 'block';
            secoes.innerHTML += `
                <section class="loja-secao-destaque" aria-label="Novidades">
                    <div class="loja-secao-header">
                        <h2 class="loja-secao-titulo">🆕 Novidades</h2>
                    </div>
                    <div class="loja-secao-grid" id="grid-novidades">
                        ${novidades.map(p => _buildCard(p, true)).join('')}
                    </div>
                </section>`;
            _bindCardEvents(document.getElementById('grid-novidades'));
        }

        // Preparado para: Promoções (p.preco_promocional), Mais Vendidos (p.vendas_count), Coleções, Marcas
    }

    /* ═══════════════════════════════════════════════
       FILTROS (PASSO 3)
       ═══════════════════════════════════════════════ */

    function _popularFiltros() {
        // Categorias (botões)
        const catsScroll = document.getElementById('loja-cats-scroll');
        if (catsScroll && _categorias.length > 0) {
            const btnTodos = catsScroll.querySelector('[data-cat=""]');
            _categorias.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'loja-cat-btn';
                btn.dataset.cat = cat.id;
                btn.type = 'button';
                btn.textContent = cat.nome;
                catsScroll.appendChild(btn);
            });
        }

        // Tamanhos (dropdown)
        const tamanhos = new Set();
        _produtos.forEach(p => (p.loja_variacoes || []).forEach(v => tamanhos.add(v.tamanho)));
        const tamOrdenados = TAMANHOS_ORDEM.filter(t => tamanhos.has(t));
        tamanhos.forEach(t => { if (!tamOrdenados.includes(t)) tamOrdenados.push(t); });

        const selTam = document.getElementById('filtroTamanho');
        if (selTam) {
            selTam.innerHTML = '<option value="">Tamanho</option>' +
                tamOrdenados.map(t => `<option value="${t}">${t}</option>`).join('');
        }

        // Cores (dropdown)
        const cores = new Set();
        _produtos.forEach(p => (p.loja_variacoes || []).forEach(v => { if (v.cor) cores.add(v.cor); }));
        const selCor = document.getElementById('filtroCor');
        if (selCor) {
            selCor.innerHTML = '<option value="">Cor</option>' +
                Array.from(cores).sort().map(c => `<option value="${c}">${c}</option>`).join('');
        }
    }

    function _getFiltroProdutos() {
        let lista = [..._produtos];

        // Filtro por categoria (botões)
        if (_filtroCategoria) lista = lista.filter(p => p.categoria_id === _filtroCategoria);

        // Filtro por busca
        if (_filtroBusca) {
            const q = _filtroBusca.toLowerCase();
            lista = lista.filter(p =>
                p.nome?.toLowerCase().includes(q) ||
                p.descricao?.toLowerCase().includes(q) ||
                p.loja_categorias?.nome?.toLowerCase().includes(q)
            );
        }

        // Filtro por tamanho
        if (_filtroTamanho) lista = lista.filter(p =>
            (p.loja_variacoes || []).some(v => v.tamanho === _filtroTamanho)
        );

        // Filtro por cor
        if (_filtroCor) lista = lista.filter(p =>
            (p.loja_variacoes || []).some(v => v.cor?.toLowerCase() === _filtroCor.toLowerCase())
        );

        // Ordenação
        switch (_ordenacao) {
            case 'menor_preco':
                lista.sort((a, b) => _getPrecoMin(a) - _getPrecoMin(b)); break;
            case 'maior_preco':
                lista.sort((a, b) => _getPrecoMin(b) - _getPrecoMin(a)); break;
            case 'a_z':
                lista.sort((a, b) => a.nome.localeCompare(b.nome)); break;
            case 'z_a':
                lista.sort((a, b) => b.nome.localeCompare(a.nome)); break;
            case 'recentes':
            default:
                // já vem ordenado por created_at DESC do Supabase
                break;
        }

        return lista;
    }

    function _getPrecoMin(p) {
        const precos = (p.loja_variacoes || []).map(v => parseFloat(v.preco)).filter(pr => pr > 0);
        return precos.length > 0 ? Math.min(...precos) : 0;
    }

    /* ═══════════════════════════════════════════════
       RENDERIZAÇÃO — GRID DE CARDS
       ═══════════════════════════════════════════════ */

    function _renderProdutos() {
        const filtrados = _getFiltroProdutos();
        const container = document.getElementById('produtosGrid');
        if (!container) return;

        // Contador de resultados
        const countEl = document.getElementById('loja-resultado-count');
        if (countEl) {
            countEl.textContent = filtrados.length > 0
                ? `${filtrados.length} produto${filtrados.length !== 1 ? 's' : ''}`
                : '';
        }

        if (filtrados.length === 0) {
            container.innerHTML = `
                <div class="vitrine-empty">
                    <div class="vitrine-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                            <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </div>
                    <p>Nenhum produto encontrado</p>
                    <span>Tente alterar os filtros de busca</span>
                </div>`;
            return;
        }

        container.innerHTML = filtrados.map((p, i) => _buildCard(p, false, i)).join('');
        _bindCardEvents(container);
    }

    function _buildCard(p, compact = false, index = 0) {
        const vars = p.loja_variacoes || [];
        const catNome = p.loja_categorias?.nome || '';
        const precos = vars.map(v => parseFloat(v.preco)).filter(pr => pr > 0);
        const estoqueTotal = vars.reduce((s, v) => s + (v.estoque || 0), 0);

        // Preço
        let precoHTML = '';
        if (precos.length > 0) {
            const min = Math.min(...precos);
            const max = Math.max(...precos);
            precoHTML = min === max
                ? `<span class="card-preco">${_formatPreco(min)}</span>`
                : `<span class="card-preco"><small>a partir de</small> ${_formatPreco(min)}</span>`;
        }

        // Tamanhos
        const tams = [...new Set(vars.map(v => v.tamanho))];
        const tamsOrdenados = TAMANHOS_ORDEM.filter(t => tams.includes(t));
        tams.forEach(t => { if (!tamsOrdenados.includes(t)) tamsOrdenados.push(t); });

        // Imagem (principal ou galeria)
        const galeria = (p.galeria_imagens || []).slice().sort((a,b) => (a.ordem||0)-(b.ordem||0));
        const imgPrincipal = galeria.length > 0 ? galeria[0].url : p.imagem_url;
        const hasImage = !!imgPrincipal;
        const imageHTML = hasImage
            ? `<img src="${imgPrincipal}" alt="${p.nome}" loading="lazy" draggable="false">`
            : `<div class="card-img-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
               </div>`;

        // Badge de estoque
        let estoqueBadge = '';
        if (estoqueTotal <= 0) {
            estoqueBadge = '<span class="card-estoque-badge esgotado">Esgotado</span>';
        } else if (estoqueTotal <= 5) {
            estoqueBadge = `<span class="card-estoque-badge ultimas">Últimas unidades</span>`;
        }

        // Badge de novidade / destaque
        let badgeDestaque = '';
        if (p.destaque) badgeDestaque = '<span class="card-novidade-badge">⭐ Destaque</span>';

        return `
            <div class="vitrine-card" data-produto-id="${p.id}" style="animation-delay: ${index * 0.05}s" role="button" tabindex="0" aria-label="Ver ${p.nome}">
                <div class="card-img-wrapper">
                    ${imageHTML}
                    ${estoqueBadge}
                    ${badgeDestaque}
                    ${catNome ? `<span class="card-categoria-badge">${catNome}</span>` : ''}
                    ${galeria.length > 1 ? `<span class="card-galeria-count">📷 ${galeria.length}</span>` : ''}
                </div>
                <div class="card-info">
                    <h3 class="card-nome">${p.nome}</h3>
                    ${precoHTML}
                    <div class="card-tamanhos">
                        ${tamsOrdenados.slice(0, 6).map(t => `<span class="card-tam">${t}</span>`).join('')}
                        ${tamsOrdenados.length > 6 ? `<span class="card-tam more">+${tamsOrdenados.length - 6}</span>` : ''}
                    </div>
                </div>
                <button class="card-btn-ver" type="button" tabindex="-1">
                    <span>Ver produto</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>`;
    }

    function _bindCardEvents(container) {
        if (!container) return;
        container.querySelectorAll('.vitrine-card').forEach(card => {
            const open = () => {
                const id = card.dataset.produtoId;
                const prod = _produtos.find(p => p.id === id);
                if (prod) {
                    LojaStore.addRecentlyViewed(prod);
                    _abrirModalProduto(prod);
                }
            };
            card.addEventListener('click', open);
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
        });
    }

    /* ═══════════════════════════════════════════════
       MODAL DE PRODUTO (reutiliza modal-produto.js)
       + Integração com o Carrinho (loja-store.js)
       ═══════════════════════════════════════════════ */

    function _abrirModalProduto(prod) {
        // Passar galeria ao modal (múltiplas imagens — PASSO 4)
        const galeria = prod.galeria_imagens || [];
        const imgs = galeria.length > 0
            ? galeria.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(g => g.imagem_url)
            : [prod.imagem_url].filter(Boolean);

        // Injetar imagens antes de abrir (monkey-patch temporário)
        const _origAbrir = window.ModalProduto.abrir;
        window.ModalProduto.abrir(prod);

        // Atualizar carrossel com galeria completa se diferente de imagem única
        if (imgs.length > 1 && window._lojaCarousel) {
            window._lojaCarousel.setImages(imgs);
        }

        // Produtos relacionados (mesma categoria — PASSO 4)
        _renderRelacionados(prod);
    }

    function _renderRelacionados(prod) {
        const wrapper = document.getElementById('mp-relacionados-wrapper');
        const container = document.getElementById('mp-relacionados');
        if (!wrapper || !container) return;

        const relacionados = _produtos
            .filter(p => p.id !== prod.id && p.categoria_id === prod.categoria_id)
            .slice(0, 4);

        if (relacionados.length === 0) { wrapper.style.display = 'none'; return; }

        wrapper.style.display = 'block';
        container.innerHTML = relacionados.map(p => {
            const imgUrl = p.imagem_url || (p.galeria_imagens?.[0]?.imagem_url);
            const precos = (p.loja_variacoes || []).map(v => parseFloat(v.preco)).filter(pr => pr > 0);
            const min = precos.length > 0 ? Math.min(...precos) : 0;
            return `
                <button class="mp-relacionado-card" data-rel-id="${p.id}" type="button" aria-label="Ver ${p.nome}">
                    <div class="mp-rel-img">
                        ${imgUrl
                            ? `<img src="${imgUrl}" alt="${p.nome}" loading="lazy" draggable="false">`
                            : `<div class="mp-rel-img-placeholder">👗</div>`}
                    </div>
                    <div class="mp-rel-nome">${p.nome}</div>
                    ${min > 0 ? `<div class="mp-rel-preco">${_formatPreco(min)}</div>` : ''}
                </button>`;
        }).join('');

        container.querySelectorAll('.mp-relacionado-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const rel = _produtos.find(p => p.id === btn.dataset.relId);
                if (rel) {
                    // Update content seamlessly without closing the modal
                    _abrirModalProduto(rel);
                    // Scroll the modal body back to the top smoothly
                    const modalBody = document.querySelector('.mp-body');
                    if (modalBody) modalBody.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    function _setupModalProduto() {
        // Fechar ao clicar no backdrop
        document.getElementById('modalProdutoBackdrop')?.addEventListener('click', e => {
            if (e.target.id === 'modalProdutoBackdrop') window.ModalProduto.fechar();
        });

        // Botão fechar
        document.getElementById('mp-close')?.addEventListener('click', () => window.ModalProduto.fechar());

        // ESC
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') window.ModalProduto.fechar();
        });

        // Botão "Adicionar ao Carrinho" — INTEGRADO COM loja-store.js
        document.getElementById('mp-btn-comprar')?.addEventListener('click', () => {
            const variacao = window.ModalProduto.getVariacaoSelecionada();
            const prod = window.ModalProduto.getProdutoAtual();
            if (!variacao || !prod) return;
            if (variacao.estoque <= 0) {
                LojaStore.showToast('Produto esgotado.', 'error');
                return;
            }

            LojaStore.addToCart({
                id: variacao.id,
                produtoId: prod.id,
                nome: prod.nome,
                categoria: prod.loja_categorias?.nome || '',
                imagem: prod.imagem_url,
                tamanho: variacao.tamanho,
                cor: variacao.cor,
                preco: parseFloat(variacao.preco),
                quantidade: 1,
            });

            LojaStore.showToast(`${prod.nome} adicionado ao carrinho! 🛍️`, 'success');
            window.ModalProduto.fechar();

            // Abrir o carrinho automaticamente
            if (window.LojaCarrinho) window.LojaCarrinho.abrir();
        });

        // Guia de medidas
        document.getElementById('mp-guia-btn')?.addEventListener('click', () => {
            const guiaModal = document.getElementById('mp-guia-modal');
            if (guiaModal) guiaModal.style.display = 'flex';
        });
        document.getElementById('mp-guia-fechar')?.addEventListener('click', () => {
            const guiaModal = document.getElementById('mp-guia-modal');
            if (guiaModal) guiaModal.style.display = 'none';
        });
    }

    /* ═══════════════════════════════════════════════
       SETUP DE EVENTOS (Filtros, Busca, Ordenação)
       ═══════════════════════════════════════════════ */

    function _setupEventos() {
        // Busca em tempo real
        const buscaInput = document.getElementById('loja-busca');
        if (buscaInput) {
            let debounceTimer;
            buscaInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    _filtroBusca = buscaInput.value.trim();
                    _renderProdutos();
                }, 300);
            });
        }

        // Categorias (botões)
        document.getElementById('loja-cats-scroll')?.addEventListener('click', e => {
            const btn = e.target.closest('.loja-cat-btn');
            if (!btn) return;
            document.querySelectorAll('.loja-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _filtroCategoria = btn.dataset.cat;
            _renderProdutos();
        });

        // Tamanho
        document.getElementById('filtroTamanho')?.addEventListener('change', e => {
            _filtroTamanho = e.target.value;
            _renderProdutos();
        });

        // Cor
        document.getElementById('filtroCor')?.addEventListener('change', e => {
            _filtroCor = e.target.value;
            _renderProdutos();
        });

        // Ordenação
        document.getElementById('filtroOrdenacao')?.addEventListener('change', e => {
            _ordenacao = e.target.value;
            _renderProdutos();
        });

        // Limpar filtros
        document.getElementById('loja-btn-limpar')?.addEventListener('click', () => {
            _filtroCategoria = '';
            _filtroTamanho = '';
            _filtroCor = '';
            _filtroBusca = '';
            _ordenacao = 'recentes';

            document.querySelectorAll('.loja-cat-btn').forEach(b => b.classList.remove('active'));
            const btnTodos = document.querySelector('.loja-cat-btn[data-cat=""]');
            if (btnTodos) btnTodos.classList.add('active');

            const buscaInput = document.getElementById('loja-busca');
            if (buscaInput) buscaInput.value = '';

            ['filtroTamanho', 'filtroCor'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            const ordEl = document.getElementById('filtroOrdenacao');
            if (ordEl) ordEl.value = 'recentes';

            _renderProdutos();
        });

        // Botão CTA do Hero (rolar para o grid)
        document.getElementById('loja-hero-cta')?.addEventListener('click', () => {
            document.getElementById('loja-toolbar')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    /* ═══════════════════════════════════════════════
       CONFIGURAR PAGAMENTOS (conforme empresa)
       ═══════════════════════════════════════════════ */

    function _configurarPagamentos(empData) {
        if (!empData.pix_habilitado) {
            const lbl = document.getElementById('chk-pgto-pix')?.closest('label');
            if (lbl) lbl.style.display = 'none';
        }
        if (!empData.cartao_habilitado) {
            const lbl = document.getElementById('lbl-chk-cartao');
            if (lbl) lbl.style.display = 'none';
        }
    }

    /* ═══════════════════════════════════════════════
       UTILITÁRIOS
       ═══════════════════════════════════════════════ */

    function _formatPreco(valor) {
        return 'R$ ' + parseFloat(valor || 0).toFixed(2).replace('.', ',');
    }

    // ── Iniciar ──
    init();

})();
