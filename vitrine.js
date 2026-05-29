/**
 * vitrine.js — Listagem de Produtos (Vitrine Pública)
 * =====================================================
 * Módulo principal da loja pública. Carrega produtos do Supabase,
 * renderiza cards com imagem/preço, gerencia filtros, e integra
 * com modal-produto.js para detalhes e compra.
 *
 * Dependências: modal-produto.js (ModalProduto), tenant.js
 */

(function () {
    'use strict';

    // ── Supabase ──
    const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

    // ── Estado ──
    let produtos = [];
    let categorias = [];

    // Ordem dos tamanhos para exibição
    const TAMANHOS_ORDEM = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'X1', 'X2', 'UN'];

    /* ══════════════════════════════════════════════
       INICIALIZAÇÃO
       ══════════════════════════════════════════════ */

    async function init() {
        try {
            const empresaId = await initTenantPublico(sb);
            if (!empresaId) return;

            // Logo
            const logoEl = document.getElementById('logoEmpresa');
            if (window.TENANT.logo_url && logoEl) {
                logoEl.src = window.TENANT.logo_url;
                logoEl.style.display = 'block';
            }

            await Promise.all([
                carregarCategorias(empresaId),
                carregarProdutos(empresaId)
            ]);

            // Configurar opções de pagamento baseadas na empresa
            const { data: empData } = await sb.from('empresas_publico').select('pix_habilitado, cartao_habilitado').eq('id', empresaId).single();
            if (empData) {
                if (!empData.pix_habilitado) {
                    const rPix = document.querySelector('input[value="pix"]')?.closest('label');
                    if (rPix) rPix.style.display = 'none';
                }
                if (!empData.cartao_habilitado) {
                    const rCartao = document.querySelector('input[value="cartao"]')?.closest('label');
                    if (rCartao) rCartao.style.display = 'none';
                }
                if (!empData.pix_habilitado && !empData.cartao_habilitado) {
                    const rDin = document.querySelector('input[value="dinheiro"]');
                    if (rDin) rDin.checked = true;
                }
            }

            // Módulo Mesa/Posição
            if (!isModuloAtivo('pedido_mesa')) {
                const optMesa = document.getElementById('lblChkMesa');
                if (optMesa) optMesa.style.display = 'none';
            }

            popularFiltros();
            renderProdutos();
            _setupModalEvents();

        } catch (err) {
            console.error('[Vitrine] Erro na inicialização:', err);
        }
    }

    /* ══════════════════════════════════════════════
       CARREGAMENTO DE DADOS
       ══════════════════════════════════════════════ */

    async function carregarCategorias(empresaId) {
        const { data, error } = await sb
            .from('loja_categorias')
            .select('id, nome')
            .eq('empresa_id', empresaId)
            .order('ordem');
        if (error) {
            console.error('[Vitrine] Erro categorias:', error);
            return;
        }
        categorias = data || [];
    }

    async function carregarProdutos(empresaId) {
        const { data, error } = await sb
            .from('loja_produtos')
            .select('*, loja_categorias(nome), loja_variacoes(*)')
            .eq('empresa_id', empresaId)
            .eq('ativo', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Vitrine] Erro produtos:', error);
            return;
        }
        produtos = data || [];
    }

    /* ══════════════════════════════════════════════
       FILTROS
       ══════════════════════════════════════════════ */

    function popularFiltros() {
        // Categorias
        const selCat = document.getElementById('filtroCategoria');
        if (selCat) {
            selCat.innerHTML = '<option value="">Todas categorias</option>' +
                categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
            selCat.onchange = renderProdutos;
        }

        // Tamanhos
        const tamanhos = new Set();
        produtos.forEach(p => (p.loja_variacoes || []).forEach(v => tamanhos.add(v.tamanho)));
        const tamOrdenados = TAMANHOS_ORDEM.filter(t => tamanhos.has(t));
        // Adicionar tamanhos que não estão na ordem padrão
        tamanhos.forEach(t => { if (!tamOrdenados.includes(t)) tamOrdenados.push(t); });

        const selTam = document.getElementById('filtroTamanho');
        if (selTam) {
            selTam.innerHTML = '<option value="">Todos tamanhos</option>' +
                tamOrdenados.map(t => `<option value="${t}">${t}</option>`).join('');
            selTam.onchange = renderProdutos;
        }

        // Cores
        const cores = new Set();
        produtos.forEach(p => (p.loja_variacoes || []).forEach(v => cores.add(v.cor)));

        const selCor = document.getElementById('filtroCor');
        if (selCor) {
            selCor.innerHTML = '<option value="">Todas cores</option>' +
                Array.from(cores).sort().map(c => `<option value="${c}">${c}</option>`).join('');
            selCor.onchange = renderProdutos;
        }
    }

    function limparFiltros() {
        const ids = ['filtroCategoria', 'filtroTamanho', 'filtroCor'];
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        renderProdutos();
    }

    /* ══════════════════════════════════════════════
       RENDERIZAÇÃO — GRID DE CARDS
       ══════════════════════════════════════════════ */

    function renderProdutos() {
        const catId = document.getElementById('filtroCategoria')?.value || '';
        const tam = document.getElementById('filtroTamanho')?.value || '';
        const cor = document.getElementById('filtroCor')?.value || '';

        let filtrados = [...produtos];

        if (catId) filtrados = filtrados.filter(p => p.categoria_id === catId);
        if (tam) filtrados = filtrados.filter(p => (p.loja_variacoes || []).some(v => v.tamanho === tam));
        if (cor) filtrados = filtrados.filter(p => (p.loja_variacoes || []).some(v => v.cor.toLowerCase() === cor.toLowerCase()));

        const container = document.getElementById('produtosGrid');
        if (!container) return;

        if (filtrados.length === 0) {
            container.innerHTML = `
                <div class="vitrine-empty">
                    <div class="vitrine-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </div>
                    <p>Nenhum produto encontrado</p>
                    <span>Tente alterar os filtros de busca</span>
                </div>`;
            return;
        }

        container.innerHTML = filtrados.map((p, index) => {
            const vars = p.loja_variacoes || [];
            const catNome = p.loja_categorias?.nome || '';
            const precos = vars.map(v => parseFloat(v.preco)).filter(pr => pr > 0);
            const estoqueTotal = vars.reduce((s, v) => s + (v.estoque || 0), 0);

            // Preço para exibir no card
            let precoHTML = '';
            if (precos.length > 0) {
                const min = Math.min(...precos);
                const max = Math.max(...precos);
                if (min === max) {
                    precoHTML = `<span class="card-preco">${_formatPreco(min)}</span>`;
                } else {
                    precoHTML = `<span class="card-preco"><small>a partir de</small> ${_formatPreco(min)}</span>`;
                }
            }

            // Tamanhos disponíveis
            const tams = [...new Set(vars.map(v => v.tamanho))];
            const tamsOrdenados = TAMANHOS_ORDEM.filter(t => tams.includes(t));
            tams.forEach(t => { if (!tamsOrdenados.includes(t)) tamsOrdenados.push(t); });

            // Imagem com lazy loading
            const hasImage = !!p.imagem_url;
            const imageHTML = hasImage
                ? `<img src="${p.imagem_url}" alt="${p.nome}" loading="lazy" draggable="false">`
                : `<div class="card-img-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                   </div>`;

            // Estoque badge
            let estoqueBadge = '';
            if (estoqueTotal <= 0) {
                estoqueBadge = '<span class="card-estoque-badge esgotado">Esgotado</span>';
            } else if (estoqueTotal <= 5) {
                estoqueBadge = `<span class="card-estoque-badge ultimas">Últimas unidades</span>`;
            }

            return `
                <div class="vitrine-card" data-produto-id="${p.id}" style="animation-delay: ${index * 0.05}s">
                    <div class="card-img-wrapper">
                        ${imageHTML}
                        ${estoqueBadge}
                        ${catNome ? `<span class="card-categoria-badge">${catNome}</span>` : ''}
                    </div>
                    <div class="card-info">
                        <h3 class="card-nome">${p.nome}</h3>
                        ${precoHTML}
                        <div class="card-tamanhos">
                            ${tamsOrdenados.slice(0, 6).map(t => `<span class="card-tam">${t}</span>`).join('')}
                            ${tamsOrdenados.length > 6 ? `<span class="card-tam more">+${tamsOrdenados.length - 6}</span>` : ''}
                        </div>
                    </div>
                    <button class="card-btn-ver" type="button">
                        <span>Ver produto</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>`;
        }).join('');

        // Eventos de clique nos cards
        container.querySelectorAll('.vitrine-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.produtoId;
                const prod = produtos.find(p => p.id === id);
                if (prod) ModalProduto.abrir(prod);
            });
        });
    }

    /* ══════════════════════════════════════════════
       SETUP DO MODAL (Eventos)
       ══════════════════════════════════════════════ */

    function _setupModalEvents() {
        // Fechar ao clicar no backdrop
        const backdrop = document.getElementById('modalProdutoBackdrop');
        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) ModalProduto.fechar();
            });
        }

        // Botão de fechar
        const closeBtn = document.getElementById('mp-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => ModalProduto.fechar());
        }

        // Botão de compra
        const buyBtn = document.getElementById('mp-btn-comprar');
        if (buyBtn) {
            buyBtn.addEventListener('click', async () => {
                await ModalProduto.comprar(sb, async (variacaoId) => {
                    // Callback de sucesso: recarregar dados
                    const empresaId = getTenantId();
                    await carregarProdutos(empresaId);
                    renderProdutos();

                    // Reabrir modal com dados atualizados
                    const prod = produtos.find(p =>
                        (p.loja_variacoes || []).some(v => v.id === variacaoId)
                    );
                    if (prod) {
                        ModalProduto.recarregar(prod);
                    } else {
                        ModalProduto.fechar();
                    }
                });
            });
        }
    }

    /* ══════════════════════════════════════════════
       UTILITÁRIOS
    /* ══════════════════════════════════════════════
       CHECKOUT E PAGAMENTOS
       ══════════════════════════════════════════════ */

    window.processarCheckoutLoja = async function(variacao, onSuccess) {
        const nome = document.getElementById('chkNome').value.trim();
        const telefone = document.getElementById('chkTelefone').value.trim();
        const tipoEntrega = document.querySelector('input[name="chkEntrega"]:checked')?.value || 'retirada';
        const endereco = document.getElementById('chkEndereco').value.trim();
        const mesa = document.getElementById('chkMesa')?.value.trim();
        const posicao = document.getElementById('chkPosicao')?.value.trim();
        const formaPgto = document.querySelector('input[name="chkPagamento"]:checked')?.value || 'pix';

        if (!nome || !telefone) {
            alert('Por favor, preencha nome e telefone.');
            return;
        }

        if (tipoEntrega === 'entrega' && !endereco) {
            alert('Por favor, preencha o endereço de entrega.');
            return;
        }

        if (tipoEntrega === 'mesa' && !mesa) {
            alert('Por favor, preencha o número da mesa.');
            return;
        }

        const btn = document.getElementById('btnConfirmarCheckout');
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processando...';

        try {
            // 1. Abater Estoque Primeiro (Garante a reserva)
            const { error: estqErr } = await sb.rpc('loja_remover_estoque', {
                p_variacao_id: variacao.id,
                p_quantidade: 1
            });

            if (estqErr) {
                alert('Estoque insuficiente ou indisponível.');
                btn.disabled = false;
                btn.textContent = oldText;
                return;
            }

            // 2. Criar Pedido
            const prod = produtos.find(p => p.id === variacao.produto_id) || { nome: 'Produto Loja' };
            const subtotal = parseFloat(variacao.preco);
            const empresaId = getTenantId();

            const { data: orderData, error: orderErr } = await sb.from('orders').insert({
                empresa_id: empresaId,
                customer_name: nome,
                customer_phone: telefone,
                customer_address: tipoEntrega === 'entrega' 
                    ? { endereco_completo: endereco } 
                    : (tipoEntrega === 'mesa' ? { mesa, posicao } : null),
                subtotal: subtotal,
                discount: 0,
                total: subtotal,
                delivery_type: tipoEntrega,
                payment_method: formaPgto,
                status: 'pendente'
            }).select().single();

            if (orderErr) {
                alert('Erro ao criar pedido: ' + orderErr.message);
                btn.disabled = false;
                btn.textContent = oldText;
                return;
            }

            // 3. Inserir Item
            await sb.from('order_items').insert({
                order_id: orderData.id,
                product_id: prod.id,
                product_name: `${prod.nome} (${variacao.tamanho} - ${variacao.cor})`,
                quantity: 1,
                unit_price: subtotal,
                total_price: subtotal,
                empresa_id: empresaId
            });

            // Fechar modal de checkout
            document.getElementById('modalCheckoutBackdrop').classList.remove('active');
            document.body.style.overflow = '';

            // 4. Fluxo de Pagamento
            if (formaPgto === 'pix') {
                await gerarPixCheckout(orderData.id, subtotal, empresaId);
            } else if (formaPgto === 'cartao') {
                await gerarCartaoCheckout(orderData.id);
            } else {
                alert('Pedido realizado com sucesso!');
                if (typeof onSuccess === 'function') await onSuccess(variacao.id);
            }

        } catch (err) {
            console.error(err);
            alert('Erro: ' + err.message);
            btn.disabled = false;
            btn.textContent = oldText;
        }
    };

    async function gerarPixCheckout(orderId, total, empresaId) {
        document.getElementById('modalPix').style.display = 'flex';
        document.getElementById('pixQrImage').style.display = 'none';
        document.getElementById('btnCopiarPix').style.display = 'none';
        document.getElementById('pixStatusMessage').textContent = 'Gerando PIX...';

        try {
            const { data, error } = await sb.functions.invoke('mercadopago-pix', {
                body: { orderId: orderId, total: total, empresaId: empresaId }
            });

            if (error || !data || data.error) {
                document.getElementById('pixStatusMessage').textContent = 'Erro ao gerar PIX.';
                return;
            }

            document.getElementById('pixQrImage').src = `data:image/png;base64,${data.qr_code_base64}`;
            document.getElementById('pixQrImage').style.display = 'block';
            document.getElementById('pixLoading').style.display = 'none';
            document.getElementById('btnCopiarPix').style.display = 'block';
            document.getElementById('pixStatusMessage').textContent = 'Aguardando pagamento...';

            window.codigoPixCopiaCola = data.qr_code;
            const btnCopiar = document.getElementById('btnCopiarPix');
            btnCopiar.onclick = () => {
                navigator.clipboard.writeText(window.codigoPixCopiaCola);
                document.getElementById('copyPixFeedback').style.display = 'block';
                setTimeout(() => document.getElementById('copyPixFeedback').style.display = 'none', 2000);
            };
        } catch (err) {
            console.error(err);
            document.getElementById('pixStatusMessage').textContent = 'Erro de rede.';
        }
    }

    async function gerarCartaoCheckout(orderId) {
        const overlay = document.getElementById('mpRedirectOverlay');
        overlay.style.display = 'flex';
        try {
            const { data, error } = await sb.functions.invoke('mercadopago-checkout', {
                body: { orderId: orderId }
            });
            if (error || !data || data.error) {
                overlay.style.display = 'none';
                alert('Erro ao processar checkout seguro.');
                return;
            }
            if (data.url) window.location.href = data.url;
        } catch (err) {
            overlay.style.display = 'none';
            console.error(err);
            alert('Erro de rede.');
        }
    }

    // Modal Events
    document.getElementById('mc-close')?.addEventListener('click', () => {
        document.getElementById('modalCheckoutBackdrop').classList.remove('active');
        document.body.style.overflow = '';
    });
    document.getElementById('closeModalPix')?.addEventListener('click', () => {
        document.getElementById('modalPix').style.display = 'none';
        window.location.reload(); // Recarregar após fechar PIX
    });

    // Expor funções necessárias globalmente
    window.limparFiltros = limparFiltros;

    // ── Iniciar ──
    init();

})();
