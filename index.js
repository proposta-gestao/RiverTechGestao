// --- Supabase ---
const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

// --- Configurações ---
const CONFIG = { telefone: "5531975540280" };

// --- Utils ---
function formatNumber(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- Dados dinâmicos (Supabase) ---
let PRODUTOS = [];
let CATEGORIAS = [];
let CUPONS = [];
let ZONAS_FRETE = [];
let CONFIG_LOJA = null;

// --- Estado da Aplicação ---
let state = {
    carrinho: [],
    produtoSelecionado: null,
    quantidadeAtual: 1,
    descontoAtivo: 0,
    cupomAplicado: null,
    categoriaAtiva: 'todos',
    termoBusca: '',
    tipoEntrega: 'mesa',   // 'mesa' | 'retirada' | 'entrega'
    formaPagamento: 'dinheiro', // 'pix', 'dinheiro', 'cartao'
    freteAtivo: 0,         // valor em R$ do frete calculado
    freteHabilitado: false, // controlado pelo Admin via store_settings
    whatsappNumero: null,   // número do WhatsApp da empresa
    whatsappTemplate: null, // template customizado de mensagem
    whatsappAtivo: { mesa: false, retirada: false, entrega: true }, // toggles por tipo
    premiumUser: null // Usuário premium logado (VIP, funcionário)
};

// --- Seletores DOM ---
const dom = {
    menu: document.getElementById("menu"),
    cart: document.getElementById("cart"),
    cartItems: document.getElementById("cartItems"),
    contador: document.getElementById("contador"),
    total: document.getElementById("total"),
    popup: document.getElementById("popup"),
    backdrop: document.getElementById("backdrop"),
    busca: document.getElementById("busca"),
    categoriesList: document.getElementById("categoriesList"),
    qntText: document.getElementById("qnt"),
    pImg: document.getElementById("pimg"),
    pNome: document.getElementById("pnome"),
    pDesc: document.getElementById("pdesc"),
    pPreco: document.getElementById("ppreco")
};

// =============================================
// CARREGAMENTO DO SUPABASE
// =============================================

// --- Inicialização de Dados Salvos ---
function carregarDadosSalvos() {
    const nome = localStorage.getItem('acp_nome');
    const telefone = localStorage.getItem('acp_telefone');
    
    if (nome) {
        const inputNome = document.getElementById('clienteNome');
        if (inputNome) inputNome.value = nome;
    }
    if (telefone) {
        const inputTelefone = document.getElementById('clienteTelefone');
        if (inputTelefone) inputTelefone.value = telefone;
    }
}

async function inicializar() {
    dom.menu.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Carregando cardápio...</p>';
    try {
        carregarDadosSalvos();

        // --- Multi-Tenant: resolver empresa_id pelo slug da URL ---
        const empresaId = await initTenantPublico(sb);
        if (!empresaId) {
            dom.menu.innerHTML = '<p style="text-align:center;color:#FF4757;padding:3rem;">Loja não encontrada. Verifique o link e tente novamente.</p>';
            return;
        }

        await Promise.all([
            carregarCategorias(),
            carregarProdutos(),
            carregarCupons(),
            carregarConfiguracoesPublicas()
        ]);
        aplicarFiltrosDeModulosPublico(); // Novo: Filtra funcionalidades no cardápio
        inicializarLoginPremium(); // Inicializa o modal VIP e o estado (se salvo)
        vincularRadiosEntrega();
        vincularCupom();
    } catch (e) {
        console.error(e);
        dom.menu.innerHTML = '<p style="text-align:center;color:#FF4757;padding:3rem;">Erro ao carregar o cardápio. Tente recarregar a página.</p>';
    }
}

async function carregarCategorias() {
    const { data, error } = await sb
        .from('categories')
        .select('*')
        .eq('empresa_id', getTenantId())
        .order('order_position');
    if (error) throw error;
    CATEGORIAS = data || [];
    renderCategorias();
}

async function carregarProdutos() {
    const { data, error } = await sb
        .from('products')
        .select('*, categories(name, slug)')
        .eq('empresa_id', getTenantId())
        .eq('active', true)
        .or('archived.is.null,archived.eq.false')
        .order('sort_order', { ascending: true });
    if (error) throw error;
    PRODUTOS = (data || []).map(p => {
        // Garantir que temos um array de imagens
        const imgs = Array.isArray(p.image_url) ? p.image_url : (p.image_url ? [p.image_url] : []);
        return {
            id: p.id,
            nome: p.name,
            desc: p.description || '',
            preco: parseFloat(p.price),
            promo_price: parseFloat(p.promo_price) || 0,
            img: imgs[0] || '', // Capa
            imgs: imgs,         // Todas as fotos
            stock: p.stock,
            cat: p.categories?.name || '',
            catSlug: p.categories?.slug || '',
            category_id: p.category_id
        };
    });
    renderMenu();
}

async function carregarCupons() {
    const { data, error } = await sb
        .from('coupons')
        .select('*')
        .eq('empresa_id', getTenantId())
        .eq('active', true);
    if (error) throw error;
    CUPONS = data || [];
}

async function carregarConfiguracoesPublicas() {
    const empresaId = getTenantId();
    const [settingsRes, zonesRes, empresaRes] = await Promise.all([
        sb.from('store_settings').select('*').eq('empresa_id', empresaId).single(),
        sb.from('shipping_zones').select('*').eq('empresa_id', empresaId).eq('active', true),
        sb.from('empresas_publico').select('pix_habilitado, cartao_habilitado').eq('id', empresaId).single()
    ]);

    if (empresaRes.error) {
        console.error('[Config] Erro ao buscar empresa:', empresaRes.error);
    }

    if (!settingsRes.error && settingsRes.data) {
        CONFIG_LOJA = settingsRes.data;
        aplicarPersonalizacaoVisual(CONFIG_LOJA);

        // Atualizar estado de frete
        state.freteHabilitado = !!CONFIG_LOJA.frete_ativo;
        if (state.freteHabilitado) {
            state.tipoEntrega = 'retirada'; // padrão quando frete habilitado
        }

        // WhatsApp dinâmico
        state.whatsappNumero = CONFIG_LOJA.whatsapp_numero || null;
        state.whatsappTemplate = CONFIG_LOJA.whatsapp_msg_template || null;
        state.whatsappAtivo = {
            mesa: !!CONFIG_LOJA.whatsapp_ativo_mesa,
            retirada: !!CONFIG_LOJA.whatsapp_ativo_retirada,
            entrega: CONFIG_LOJA.whatsapp_ativo_entrega !== false // default true
        };
    }

    if (!zonesRes.error) {
        // Ordenar por nome para facilitar visualização
        ZONAS_FRETE = (zonesRes.data || []).sort((a, b) => a.name.localeCompare(b.name));
    }

    // PIX Multi-Tenant: Verificar se a empresa tem PIX habilitado
    state.pixHabilitado = !!(empresaRes.data && empresaRes.data.pix_habilitado);
    state.cartaoHabilitado = !!(empresaRes.data && empresaRes.data.cartao_habilitado);
}

/**
 * Filtra as opções do cardápio para o cliente final conforme módulos ativos.
 */
function aplicarFiltrosDeModulosPublico() {
    console.log('[Modules] Filtrando funcionalidades públicas...');

    // Bloqueia a loja se nenhum módulo público de produtos/cardápio estiver ativo
    if (!isModuloAtivo('cardapio') && !isModuloAtivo('loja_roupas')) {
        document.body.innerHTML = `
            <div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#080808; color:#fff; font-family:Outfit, sans-serif; padding:2rem; text-align:center;">
                <h1 style="font-size:2rem; color:#FF4757; margin-bottom:1rem;">Página Inativa</h1>
                <p style="color:#aaa;">O módulo de catálogo ou cardápio desta loja encontra-se desativado.</p>
            </div>
        `;
        return;
    }

    // 1. Módulo de Frete e Entrega (Permissão SaaS)
    if (!isModuloAtivo('config_frete')) {
        state.freteHabilitado = false;
        const optE = document.getElementById('optEntrega')?.closest('.delivery-option');
        if (optE) optE.style.display = 'none';
        
        const optR = document.getElementById('optRetirada')?.closest('.delivery-option');
        if (optR) optR.style.display = 'none';
        
        const secEnd = document.getElementById('secaoEndereco');
        if (secEnd) secEnd.style.display = 'none';

        // Garante que a opção ativa seja 'mesa' (se módulo ativo) ou 'retirada' (fallback)
        if (isModuloAtivo('pedido_mesa')) {
            toggleTipoEntrega('mesa');
        } else {
            toggleTipoEntrega('retirada');
        }
    } else {
        // Se o módulo MASTER está ativo, verificamos a configuração específica da LOJA (frete_ativo)
        if (!state.freteHabilitado) {
            // Se a loja desativou o frete, escondemos apenas a opção de "Entrega"
            const optE = document.getElementById('optEntrega')?.closest('.delivery-option');
            if (optE) optE.style.display = 'none';
            
            // Se por acaso 'entrega' estiver selecionado, muda para 'retirada'
            if (state.tipoEntrega === 'entrega') {
                const optR = document.getElementById('optRetirada');
                if (optR) optR.checked = true;
                toggleTipoEntrega('retirada');
            }
        }
    }

    // 2. Pagamento Online
    // PIX só aparece se: módulo 'pagamento' ativo E empresa tem pix_habilitado no banco
    if (!isModuloAtivo('pagamento') || !state.pixHabilitado) {
        const optPix = document.getElementById('payPix')?.closest('.delivery-option');
        if (optPix) optPix.style.display = 'none';
    }
    
    // Cartão só aparece se: módulo 'pagamento' ativo E empresa tem cartao_habilitado no banco
    if (!isModuloAtivo('pagamento') || !state.cartaoHabilitado) {
        const optCartao = document.getElementById('payCartao')?.closest('.delivery-option');
        if (optCartao) optCartao.style.display = 'none';
    }

    // Se nenhum pagamento online estiver ativo, garante que selecione 'dinheiro'
    if (!state.pixHabilitado && !state.cartaoHabilitado) {
        const optDin = document.getElementById('payDinheiro');
        if (optDin) optDin.checked = true;
    }

    // 2.1. Mesa e Posição
    if (!isModuloAtivo('pedido_mesa')) {
        const optMesa = document.getElementById('optMesa')?.closest('.delivery-option');
        if (optMesa) optMesa.style.display = 'none';
        
        // Se a opção Mesa estiver selecionada, muda para Retirada
        if (state.tipoEntrega === 'mesa') {
            const optR = document.getElementById('optRetirada');
            if (optR) optR.checked = true;
            toggleTipoEntrega('retirada');
        }
    }

    // 3. Clientes Premium
    const btnLoginPremium = document.getElementById('btnLoginPremium');
    if (btnLoginPremium) {
        if (isModuloAtivo('clientes_premium')) {
            btnLoginPremium.style.display = 'flex';
        } else {
            btnLoginPremium.style.display = 'none';
        }
    }
}

function aplicarPersonalizacaoVisual(config) {
    if (!config) return;

    // Textos
    if (config.brand_name) {
        const el = document.querySelector('.brand-name');
        if (el) el.textContent = config.brand_name;
        document.title = config.brand_name + ' | Cardápio Digital';
    }
    if (config.brand_subtitle) {
        const el = document.querySelector('.brand-subtitle');
        if (el) el.textContent = config.brand_subtitle;
    }

    // Banner
    if (config.banner_url) {
        const el = document.querySelector('.banner-desktop');
        if (el) el.style.backgroundImage = `url(${config.banner_url})`;
    }

    // Logo
    if (config.logo_url) {
        const el = document.querySelector('.logo-main');
        if (el) el.style.backgroundImage = `url(${config.logo_url})`;
    }
}

// =============================================
// RENDERIZAÇÃO
// =============================================

function renderCategorias() {
    let cats = CATEGORIAS;
    if (state.premiumUser && state.premiumUser.categoriasPermitidas) {
        cats = cats.filter(c => state.premiumUser.categoriasPermitidas.includes(c.id));
    }

    dom.categoriesList.innerHTML = '<button class="cat-btn active" data-cat="todos">Todos</button>';
    cats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.dataset.cat = c.slug;
        btn.innerText = c.name;
        dom.categoriesList.appendChild(btn);
    });

    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.categoriaAtiva = e.target.dataset.cat;
            renderMenu();
        });
    });
}

function renderMenu() {
    let filtrados = PRODUTOS;

    // Filtro Premium (somente produtos e categorias permitidas)
    if (state.premiumUser && state.premiumUser.produtosPermitidos) {
        filtrados = filtrados.filter(p => state.premiumUser.produtosPermitidos.includes(p.id));
    } else if (state.premiumUser && state.premiumUser.categoriasPermitidas) {
        // Fallback para caso antigo onde só tinha categoria
        filtrados = filtrados.filter(p => state.premiumUser.categoriasPermitidas.includes(p.category_id));
    }

    filtrados = filtrados.filter(p => {
        const matchBusca = p.nome.toLowerCase().includes(state.termoBusca.toLowerCase());
        const matchCat = state.categoriaAtiva === 'todos' || p.catSlug === state.categoriaAtiva || p.cat === state.categoriaAtiva;
        return matchBusca && matchCat;
    });

    // Ordena: disponíveis primeiro, esgotados no final
    filtrados.sort((a, b) => {
        const aEsg = a.stock <= 0 ? 1 : 0;
        const bEsg = b.stock <= 0 ? 1 : 0;
        return aEsg - bEsg;
    });

    if (filtrados.length === 0) {
        dom.menu.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Nenhum produto encontrado.</p>';
        return;
    }

    dom.menu.innerHTML = filtrados.map(p => {
        const esgotado = p.stock <= 0;
        return `
        <article class="product-card${esgotado ? ' esgotado' : ''}" ${esgotado ? '' : `onclick="abrirModal('${p.id}')"`}>
            <div class="product-img-wrap">
                <img src="${p.img}" alt="${p.nome}" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade" onerror="this.src='https://res.cloudinary.com/dzt571tv8/image/upload/v1777512400/placeholder_broken.png'; this.onerror=null;">
                ${esgotado ? '<span class="badge-esgotado">Esgotado</span>' : ''}
                ${!esgotado && p.promo_price > 0 ? `<span class="badge-promo">${Math.round((1 - (p.promo_price / p.preco)) * 100)}% OFF</span>` : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name">${p.nome}</h3>
                <p class="product-card-desc">${p.desc}</p>
                <div class="product-footer">
                    <div class="product-price-wrap">
                        ${p.promo_price > 0 
                            ? `<span class="price-old">${formatCurrency(p.preco)}</span>
                               <span class="product-price promo">${formatCurrency(p.promo_price)}</span>`
                            : `<span class="product-price">${formatCurrency(p.preco)}</span>`
                        }
                    </div>
                    <button class="btn-add" ${esgotado ? 'disabled' : ''}>
                        ${esgotado ? 'Esgotado' : '+ Adicionar'}
                    </button>
                </div>
            </div>
        </article>
        `;
    }).join('');
}

function renderCarrinho() {
    const btnProx = document.getElementById('btnProximaEtapa');

    if (state.carrinho.length === 0) {
        dom.cartItems.innerHTML = '<div class="empty-cart-msg">Seu carrinho está vazio.</div>';
        dom.contador.innerText = "0";
        if (dom.total) dom.total.innerText = "0,00";
        if (btnProx) btnProx.disabled = true;
        renderTotalBreakdown();
        return;
    }

    let subtotal = 0;
    dom.cartItems.innerHTML = state.carrinho.map((item, index) => {
        const itemTotal = item.preco * item.qnt;
        subtotal += itemTotal;
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.qnt}x ${item.nome}</h4>
                    <p>${item.obs ? `Obs: ${item.obs}` : ''}</p>
                    <strong>${formatCurrency(itemTotal)}</strong>
                </div>
                <div class="cart-item-actions">
                    <button class="btn-remove" onclick="removerDoCarrinho(${index})" aria-label="Remover item">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    const totalFinal = subtotal * (1 - state.descontoAtivo);
    if (dom.total) dom.total.innerText = formatNumber(totalFinal);
    dom.contador.innerText = state.carrinho.reduce((acc, curr) => acc + curr.qnt, 0);
    if (btnProx) btnProx.disabled = false;
    renderTotalBreakdown();
}

// =============================================
// WIZARD ETAPAS DO CHECKOUT
// =============================================

function navegarStep(n) {
    const step1 = document.getElementById('wizardStep1');
    const step2 = document.getElementById('wizardStep2');
    const dot1 = document.getElementById('stepDot1');
    const dot2 = document.getElementById('stepDot2');
    const line = document.getElementById('stepLine');

    if (n === 1) {
        step1.classList.add('active');
        step2.classList.remove('active');
        dot1.className = 'step-dot active';
        dot1.textContent = '1';
        dot2.className = 'step-dot';
        dot2.textContent = '2';
        if (line) line.style.background = 'var(--border-color)';
    } else {
        step1.classList.remove('active');
        step2.classList.add('active');
        dot1.className = 'step-dot done';
        dot1.textContent = '✓';
        dot2.className = 'step-dot active';
        dot2.textContent = '2';
        if (line) line.style.background = 'var(--primary)';
        renderTotalBreakdown();

        // Premium: esconde seção de pagamento e ajusta botão
        const secaoPagamento = document.getElementById('secaoPagamento');
        const btnEnviar = document.getElementById('btnEnviar');
        if (state.premiumUser && state.premiumUser.comandaId) {
            if (secaoPagamento) secaoPagamento.style.display = 'none';
            if (btnEnviar) btnEnviar.innerHTML = `<span>Enviar pedido para o atendente</span><span class="atendente-icon">🛎️</span>`;
        } else {
            if (secaoPagamento) secaoPagamento.style.display = 'block';
            if (btnEnviar) btnEnviar.innerHTML = `<span>Finalizar Pedido</span><span class="atendente-icon">💳</span>`;
        }

        toggleTipoEntrega(state.tipoEntrega);

        if (state.freteHabilitado || true) { // Garante que os eventos onchange sejam sempre vinculados
            const optR = document.getElementById('optRetirada');
            const optE = document.getElementById('optEntrega');
            const optM = document.getElementById('optMesa');
            if (optR) optR.onchange = () => toggleTipoEntrega('retirada');
            if (optE) optE.onchange = () => toggleTipoEntrega('entrega');
            if (optM) optM.onchange = () => toggleTipoEntrega('mesa');
            
            if (state.tipoEntrega === 'entrega') {
                if (optE) optE.checked = true;
            } else if (state.tipoEntrega === 'mesa') {
                if (optM) optM.checked = true;
            } else {
                if (optR) optR.checked = true;
            }
        }

        const btnBuscarCep = document.getElementById('btnBuscarCep');
        if (btnBuscarCep) btnBuscarCep.onclick = buscarCepAuto;
        const cepEl = document.getElementById('cep');
        if (cepEl) cepEl.oninput = onCepInput;
    }
}

// =============================================
// FRETE
// =============================================

function normalizar(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function calcularFrete(bairro, cidadeCliente) {
    if (!state.freteHabilitado) return 0;
    if (!bairro) return -1;

    const normalizarInterno = (s) => (s || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const bairroClienteNorm = normalizarInterno(bairro);
    const cidadeClienteNorm = normalizarInterno(cidadeCliente);

    const zona = ZONAS_FRETE.find(z => {
        if (!z.neighborhoods) return false;
        
        // Validação de segurança: se a zona exigir uma cidade específica, verifica se bate com a do CEP
        if (z.cidade && normalizarInterno(z.cidade) !== cidadeClienteNorm) {
            return false;
        }

        const listaBairros = z.neighborhoods.split(',').map(b => normalizarInterno(b));
        return listaBairros.includes(bairroClienteNorm);
    });
    
    if (zona) {
        return parseFloat(zona.fee) || 0;
    }
    return -1;
}

// =============================================
// TOTAL BREAKDOWN
// =============================================

function renderTotalBreakdown() {
    const subtotal = state.carrinho.reduce((acc, p) => acc + (p.preco * p.qnt), 0);
    const desconto = subtotal * state.descontoAtivo;
    const subtotalFinal = subtotal - desconto;

    const fmt = (v) => formatCurrency(v);
    const fmtNum = (v) => formatNumber(v);

    const couponBreakdown = document.getElementById('couponBreakdown');
    const cbTotal = document.getElementById('cbTotal');
    const cbDesconto = document.getElementById('cbDesconto');
    const cbSubfinal = document.getElementById('cbSubfinal');

    if (couponBreakdown) {
        if (desconto > 0) {
            couponBreakdown.style.display = 'block';
            if (cbTotal)    cbTotal.textContent    = fmt(subtotal);
            if (cbDesconto) cbDesconto.textContent = `- ${fmt(desconto)}`;
            if (cbSubfinal) cbSubfinal.textContent = fmt(subtotalFinal);
        } else {
            couponBreakdown.style.display = 'none';
        }
    }

    if (dom.total) {
        dom.total.innerText = fmtNum(subtotalFinal);
    }

    const els = {
        sub:       document.getElementById('breakdownSubtotal'),
        descRow:   document.getElementById('rowDesconto'),
        desc:      document.getElementById('breakdownDesconto'),
        freteRow:  document.getElementById('rowFrete'),
        frete:     document.getElementById('breakdownFrete'),
        tot:       document.getElementById('breakdownTotal'),
    };
    if (!els.sub) return;

    els.sub.textContent = fmt(subtotal);

    if (desconto > 0) {
        els.desc.textContent = `- ${fmt(desconto)}`;
        els.desc.style.color = '#00B894';
        els.descRow.style.display = 'flex';
    } else {
        els.descRow.style.display = 'none';
    }

    const frete = state.freteHabilitado && state.tipoEntrega === 'entrega' ? state.freteAtivo : 0;
    if (els.freteRow) {
        if (frete > 0) {
            els.frete.textContent = fmt(frete);
            els.frete.style.color = 'inherit';
            els.freteRow.style.display = 'flex';
        } else if (state.freteHabilitado && state.tipoEntrega === 'entrega' && frete === -1) {
            els.frete.textContent = '⚠️ Bairro não atendido';
            els.frete.style.color = 'var(--danger)';
            els.freteRow.style.display = 'flex';
        } else if (state.freteHabilitado && state.tipoEntrega === 'entrega') {
            els.frete.textContent = 'Informe o CEP';
            els.frete.style.color = 'var(--text-muted)';
            els.freteRow.style.display = 'flex';
        } else {
            els.freteRow.style.display = 'none';
        }
    }

    const totalFinal = subtotal - desconto + (frete > 0 ? frete : 0);
    els.tot.textContent = fmt(totalFinal);
}

// =============================================
// CEP AUTOCOMPLETE
// =============================================

let _cepTimer = null;

function onCepInput(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
    e.target.value = v;

    clearTimeout(_cepTimer);
    const digitosLimpos = v.replace(/\D/g, '');
    if (digitosLimpos.length === 8) {
        _cepTimer = setTimeout(buscarCepAuto, 600);
    } else {
        const status = document.getElementById('cepStatus');
        if (status) { status.textContent = ''; status.style.color = ''; }
        state.freteAtivo = 0;
        renderTotalBreakdown();
    }
}

async function buscarCepAuto() {
    const cepInput = document.getElementById('cep');
    if (!cepInput) return;
    const cepLimpo = cepInput.value.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    const status = document.getElementById('cepStatus');
    const loading = document.getElementById('cepLoading');
    const camposExtras = document.getElementById('camposEnderecoAuto');

    if (status) status.textContent = '';
    if (loading) loading.style.display = 'block';

    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();

        if (data.erro) {
            if (status) { status.textContent = '❌ CEP não encontrado.'; status.style.color = 'var(--danger)'; }
            if (camposExtras) camposExtras.style.display = 'none';
            state.freteAtivo = 0;
            renderTotalBreakdown();
            return;
        }

        const logEl = document.getElementById('endLogradouro');
        const baiEl = document.getElementById('endBairro');
        if (logEl) logEl.value = data.logradouro || '';
        if (baiEl) baiEl.value = data.bairro || '';
        if (camposExtras) camposExtras.style.display = 'block';

        const frete = calcularFrete(data.bairro, data.localidade);
        state.freteAtivo = frete;

        if (frete === -1) {
            if (status) { status.textContent = '⚠️ Bairro não atendido para entrega.'; status.style.color = 'var(--danger)'; }
        } else {
            if (status) { 
                status.textContent = `✅ Frete para ${data.bairro}: ${frete === 0 ? 'Grátis' : formatCurrency(frete)}`; 
                status.style.color = 'var(--success)'; 
            }
        }

        renderTotalBreakdown();
    } catch {
        if (status) { status.textContent = '❌ Erro ao buscar CEP.'; status.style.color = 'var(--danger)'; }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// =============================================
// AÇÕES DO CARRINHO
// =============================================

window.abrirModal = (id) => {
    const produto = PRODUTOS.find(p => p.id === id);
    if (!produto || produto.stock <= 0) return;
    state.produtoSelecionado = produto;
    state.quantidadeAtual = 1;

    // Renderizar Imagem ou Carrossel
    const carouselContainer = document.getElementById('productCarouselContainer');
    if (produto.imgs && produto.imgs.length > 1) {
        carouselContainer.innerHTML = `
            <div class="product-carousel-wrapper">
                <button class="carousel-nav prev" id="prevBtn" aria-label="Anterior">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div class="product-carousel" id="mainCarousel">
                    ${produto.imgs.map(url => `
                        <div class="carousel-item">
                            <img src="${url}" alt="${produto.nome}" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade" onerror="this.src='https://res.cloudinary.com/dzt571tv8/image/upload/v1777512400/placeholder_broken.png'; this.onerror=null;">
                        </div>
                    `).join('')}
                </div>
                <button class="carousel-nav next" id="nextBtn" aria-label="Próximo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
                <div class="carousel-dots">
                    ${produto.imgs.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
                </div>
            </div>
        `;
        
        // Seletores
        const carousel = document.getElementById('mainCarousel');
        const dots = carouselContainer.querySelectorAll('.dot');
        const btnPrev = document.getElementById('prevBtn');
        const btnNext = document.getElementById('nextBtn');

        // Forçar posição inicial para evitar sincronia errada de pontos
        carousel.scrollLeft = 0;

        const totalSlides = dots.length;

        // Lógica das Setas (carrossel infinito)
        btnPrev.onclick = () => {
            const currentIndex = Math.round(carousel.scrollLeft / carousel.offsetWidth);
            const prevIndex = currentIndex === 0 ? totalSlides - 1 : currentIndex - 1;
            carousel.scrollTo({ left: prevIndex * carousel.offsetWidth, behavior: 'smooth' });
        };
        btnNext.onclick = () => {
            const currentIndex = Math.round(carousel.scrollLeft / carousel.offsetWidth);
            const nextIndex = currentIndex === totalSlides - 1 ? 0 : currentIndex + 1;
            carousel.scrollTo({ left: nextIndex * carousel.offsetWidth, behavior: 'smooth' });
        };

        // Click nos indicadores para navegar direto à imagem
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                carousel.scrollTo({ left: index * carousel.offsetWidth, behavior: 'smooth' });
            });
        });

        // Listener para atualizar os pontinhos no scroll
        carousel.onscroll = () => {
            const index = Math.round(carousel.scrollLeft / carousel.offsetWidth);
            dots.forEach((dot, i) => dot.classList.toggle('active', i === index));

            // Setas sempre ativas no carrossel infinito
            btnPrev.style.opacity = '1';
            btnNext.style.opacity = '1';
        };

        // Inicializa opacidade das setas
        btnPrev.style.opacity = '1';
        btnNext.style.opacity = '1';
    } else {
        const singleImg = produto.imgs[0] || '';
        carouselContainer.innerHTML = `
            <div class="carousel-item">
                <img src="${singleImg}" id="pimg" alt="${produto.nome}" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade" onerror="this.src='https://res.cloudinary.com/dzt571tv8/image/upload/v1777512400/placeholder_broken.png'; this.onerror=null;">
            </div>
        `;
    }

    dom.pNome.innerText = produto.nome;
    dom.pDesc.innerText = produto.desc;
    
    // Lógica de preço no modal
    if (produto.promo_price > 0) {
        if (dom.pPreco) dom.pPreco.innerHTML = `<span class="price-old-modal">${formatCurrency(produto.preco)}</span> ${formatCurrency(produto.promo_price)}`;
        state.produtoSelecionado = { ...produto, preco: produto.promo_price };
    } else {
        if (dom.pPreco) dom.pPreco.innerText = formatCurrency(produto.preco);
        state.produtoSelecionado = produto;
    }
    
    dom.qntText.innerText = state.quantidadeAtual;
    atualizarSubtotalModal();
    
    document.getElementById("obs").value = "";
    document.getElementById("confirmar").style.display = "flex";
    document.getElementById("modalQtySelector").style.display = "flex";
    document.getElementById("postAddActions").style.display = "none";

    toggleModal(true);
};

function atualizarSubtotalModal() {
    if (!state.produtoSelecionado) return;
    const sub = state.produtoSelecionado.preco * state.quantidadeAtual;
    
    // Atualiza o texto do botão de confirmação
    const btn = document.getElementById('confirmar');
    if (btn) {
        btn.innerHTML = `
            <span>Adicionar</span>
            <span>${formatCurrency(sub)}</span>
        `;
    }
}

function toggleModal(show) {
    dom.popup.classList.toggle('active', show);
    dom.backdrop.classList.toggle('active', show);
    document.body.classList.toggle('no-scroll', show);
}

window.removerDoCarrinho = (index) => {
    state.carrinho.splice(index, 1);
    renderCarrinho();
};

// =============================================
// EVENT LISTENERS
// =============================================

document.getElementById("mais").onclick = () => {
    const maxQty = state.produtoSelecionado?.stock || 0;
    if (state.quantidadeAtual < maxQty) {
        state.quantidadeAtual++;
        dom.qntText.innerText = state.quantidadeAtual;
        atualizarSubtotalModal();
    } else {
        mostrarToast("Quantidade máxima em estoque atingida!", "error");
    }
};

document.getElementById("menos").onclick = () => {
    if (state.quantidadeAtual > 1) {
        state.quantidadeAtual--;
        dom.qntText.innerText = state.quantidadeAtual;
        atualizarSubtotalModal();
    }
};

document.getElementById("confirmar").onclick = () => {
    const obs = document.getElementById("obs").value;
    state.carrinho.push({ ...state.produtoSelecionado, qnt: state.quantidadeAtual, obs });
    renderCarrinho();
    document.getElementById("confirmar").style.display = "none";
    document.getElementById("modalQtySelector").style.display = "none";
    document.getElementById("postAddActions").style.display = "flex";
};

document.getElementById("btnContinuar").onclick = () => toggleModal(false);
document.getElementById("btnIrCarrinho").onclick = () => { toggleModal(false); toggleCart(true); };

function vincularFiltros() {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.categoriaAtiva = btn.dataset.cat;
            renderMenu();
        };
    });
}

dom.busca.onkeyup = (e) => {
    state.termoBusca = e.target.value;
    renderMenu();
};

function toggleTipoEntrega(tipo) {
    state.tipoEntrega = tipo;
    const secaoEndereco = document.getElementById('secaoEndereco');
    const secaoMesa = document.getElementById('secaoMesa');
    const secaoTipo = document.getElementById('secaoTipoRecebimento');

    // Se a opção selecionada for entrega e o frete não estiver habilitado, volta para retirada (fallback seguro)
    if (tipo === 'entrega' && !state.freteHabilitado) {
        tipo = 'retirada';
        state.tipoEntrega = 'retirada';
        const optR = document.getElementById('optRetirada');
        if (optR) optR.checked = true;
    }

    // Se a opção selecionada for mesa e a mesa não estiver habilitada, volta para retirada
    if (tipo === 'mesa' && typeof isModuloAtivo === 'function' && !isModuloAtivo('pedido_mesa')) {
        tipo = 'retirada';
        state.tipoEntrega = 'retirada';
        const optR = document.getElementById('optRetirada');
        if (optR) optR.checked = true;
    }

    if (secaoTipo) {
        secaoTipo.style.display = '';
        // Verifica quantas opções estão visíveis. Se só tiver 1, oculta a seção de escolha.
        const options = secaoTipo.querySelectorAll('.delivery-option');
        let visiveis = 0;
        options.forEach(opt => {
            if (window.getComputedStyle(opt).display !== 'none' && opt.style.display !== 'none') {
                visiveis++;
            }
        });
        if (visiveis <= 1) {
            secaoTipo.style.display = 'none';
        }
    }

    if (tipo === 'entrega') {
        if (secaoEndereco) secaoEndereco.style.display = '';
        if (secaoMesa) secaoMesa.style.display = 'none';
    } else if (tipo === 'mesa') {
        if (secaoEndereco) secaoEndereco.style.display = 'none';
        if (secaoMesa) secaoMesa.style.display = '';
        state.freteAtivo = 0;
    } else { // retirada
        if (secaoEndereco) secaoEndereco.style.display = 'none';
        if (secaoMesa) secaoMesa.style.display = 'none';
        state.freteAtivo = 0;
    }
    
    renderTotalBreakdown();
}

function vincularRadiosEntrega() {
    document.querySelectorAll('input[name="tipoEntrega"]').forEach(radio => {
        radio.addEventListener('change', (e) => toggleTipoEntrega(e.target.value));
    });
}

function vincularCupom() {
    const btn = document.getElementById('btnCupom');
    const input = document.getElementById('cupom');
    if (!btn || !input) return;

    btn.onclick = () => {
        const codigo = input.value.trim().toUpperCase();
        if (!codigo) return;

        const cupom = CUPONS.find(c => c.code === codigo);

        if (!cupom) {
            mostrarToast("Cupom inválido ou expirado.", "error");
            return;
        }

        // Verificar limite de uso
        if (cupom.usage_limit !== null && (cupom.usage_count || 0) >= cupom.usage_limit) {
            mostrarToast("Este cupom atingiu o limite de usos.", "error");
            return;
        }

        state.descontoAtivo = cupom.discount_percent / 100;
        state.cupomAplicado = cupom.code;
        mostrarToast(`Cupom ${cupom.code} aplicado!`, "success");
        renderCarrinho();
    };
}

document.getElementById("btnProximaEtapa").onclick = () => {
    if (state.carrinho.length === 0) return;
    navegarStep(2);
};

document.getElementById("btnVoltarEtapa").onclick = () => navegarStep(1);

const telInput = document.getElementById('clienteTelefone');
if (telInput) {
    telInput.addEventListener('input', () => {
        let digits = telInput.value.replace(/\D/g, '').slice(0, 11);
        let formatted = digits;
        if (digits.length > 2)  formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
        if (digits.length > 7)  formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
        telInput.value = formatted;
    });
}

// Enviar Pedido
document.getElementById("btnEnviar").onclick = async () => {
    const btn = document.getElementById("btnEnviar");
    if (state.carrinho.length === 0) return mostrarToast("Seu carrinho está vazio!", "error");

    const formaPagamentoEl = document.querySelector('input[name="formaPagamento"]:checked');
    const formaPagamento = formaPagamentoEl ? formaPagamentoEl.value : 'dinheiro';
    state.formaPagamento = formaPagamento;

    const nomeCliente    = document.getElementById("clienteNome")?.value.trim() || '';
    const telefoneCliente = document.getElementById("clienteTelefone")?.value.trim() || '';

    if (!nomeCliente)    return mostrarToast("Por favor, informe seu nome completo.", "error");
    if (!telefoneCliente || telefoneCliente.replace(/\D/g, '').length !== 11) {
        return mostrarToast("Por favor, informe seu telefone/WhatsApp válido com 11 dígitos.", "error");
    }

    let camposEndereco = {};
    let freteValor = 0;

    if (state.tipoEntrega === 'mesa') {
        const mesa    = document.getElementById("clienteMesa")?.value.trim() || '';
        const posicao = document.getElementById("clientePosicao")?.value.trim() || '';
        if (!mesa)    return mostrarToast("Por favor, informe o número da MESA.", "error");
        if (!posicao) return mostrarToast("Por favor, informe a POSIÇÃO.", "error");
        camposEndereco = { mesa, posicao };
        freteValor = 0;
    } else if (state.tipoEntrega === 'entrega') {
        const cep         = document.getElementById("cep")?.value.trim() || '';
        const numero      = document.getElementById("endNumero")?.value.trim() || '';
        const logradouro  = document.getElementById("endLogradouro")?.value.trim() || '';
        const bairro      = document.getElementById("endBairro")?.value.trim() || '';
        const complemento = document.getElementById("endComplemento")?.value.trim() || '';

        if (!cep) return mostrarToast("Por favor, informe o CEP para entrega.", "error");
        if (!numero) return mostrarToast("Por favor, informe o número do endereço.", "error");
        if (state.freteAtivo === -1) return mostrarToast("⚠️ Este endereço não é atendido para entrega.", "error");

        camposEndereco = { cep, logradouro, numero, bairro, complemento };
        freteValor = state.freteAtivo > 0 ? state.freteAtivo : 0;
    } else if (state.tipoEntrega === 'retirada') {
        camposEndereco = { retirada: true };
        freteValor = 0;
    }

    btn.disabled = true;
    btn.innerHTML = `<span>Processando pedido...</span>`;

    try {
        const productIds = state.carrinho.map(p => p.id);
        const { data: freshStock, error: stockErr } = await sb
            .from('products')
            .select('id, name, stock')
            .in('id', productIds);
            
        if (stockErr) throw stockErr;

        let outOfStockItem = null;
        for (const itemCart of state.carrinho) {
            const dbItem = freshStock.find(p => p.id === itemCart.id);
            if (!dbItem || dbItem.stock < itemCart.qnt) {
                outOfStockItem = dbItem ? dbItem.name : itemCart.nome;
                break;
            }
        }

        if (outOfStockItem) {
            btn.disabled = false;
            btn.innerHTML = `<span>Enviar pedido para o atendente</span><span class="atendente-icon">🛎️</span>`;
            mostrarToast(`Produto esgotado ou quantidade indisponível!`, 'error');
            toggleCart(false);
            carregarProdutos();
            return;
        }

        const subtotal = state.carrinho.reduce((acc, p) => acc + (p.preco * p.qnt), 0);
        const desconto = subtotal * state.descontoAtivo;
        const totalFinal = subtotal - desconto + freteValor;

        const celularLimpo = telefoneCliente.replace(/\D/g, '');
        const enderecoStr = state.freteHabilitado
            ? (state.tipoEntrega === 'entrega'
                ? `${camposEndereco.logradouro || ''}, ${camposEndereco.numero || ''} - ${camposEndereco.bairro || ''} (CEP: ${camposEndereco.cep || ''})`
                : state.tipoEntrega === 'retirada' ? 'Retirada no local' : `Mesa ${camposEndereco.mesa || ''}, Posição ${camposEndereco.posicao || ''}`)
            : `Mesa ${camposEndereco.mesa || ''}, Posição ${camposEndereco.posicao || ''}`;

        // Salvar dados do cliente em segundo plano (não trava o processo principal)
        sb.from('clientes').upsert({
            celular: celularLimpo,
            nome: nomeCliente,
            endereco: enderecoStr
        }, { onConflict: 'celular' });


        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        const orderId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : generateUUID();

        const orderPayload = {
            id: orderId,
            empresa_id: getTenantId(), // ← Multi-Tenant: isola o pedido à empresa
            customer_name: nomeCliente,
            customer_phone: telefoneCliente,
            customer_address: camposEndereco,
            subtotal,
            discount: state.descontoAtivo * 100,
            total: totalFinal,
            status: 'pendente',
            payment_method: state.formaPagamento,
            payment_status: 'pendente',
            delivery_type: state.tipoEntrega,
            shipping_fee: freteValor,
            cliente_premium_id: state.premiumUser ? state.premiumUser.id : null,
            comanda_id: state.premiumUser && state.premiumUser.comandaId ? state.premiumUser.comandaId : null
        };

        const { error: orderError } = await sb.from('orders').insert(orderPayload);
        if (orderError) throw orderError;

        const itemsPayload = state.carrinho.map(p => ({
            order_id: orderId,
            empresa_id: getTenantId(), // ← Multi-Tenant
            product_id: p.id,
            product_name: p.nome,
            quantity: p.qnt,
            unit_price: p.preco,
            total_price: p.preco * p.qnt,
            observations: p.obs || null
        }));
        const { error: itemsError } = await sb.from('order_items').insert(itemsPayload);
        if (itemsError) throw itemsError;

        const fmtW = (v) => formatCurrency(v);
        let msg = `*📦 NOVO PEDIDO — RiverTech*%0A%0A`;
        msg += `*👤 Cliente:* ${nomeCliente}%0A`;
        msg += `*📱 Telefone:* ${telefoneCliente}%0A%0A`;

        msg += `*📍 Localização:*`;
        if (!state.freteHabilitado || state.tipoEntrega === 'mesa') {
            msg += ` Mesa ${camposEndereco.mesa || '—'}, Posição ${camposEndereco.posicao || '—'}%0A%0A`;
        } else if (state.tipoEntrega === 'entrega') {
            msg += ` Entrega%0A`;
            msg += `${camposEndereco.logradouro || ''}, ${camposEndereco.numero || ''}`;
            if (camposEndereco.complemento) msg += ` - ${camposEndereco.complemento}`;
            msg += `%0A${camposEndereco.bairro || ''} - CEP: ${camposEndereco.cep || ''}%0A%0A`;
        } else {
            msg += ` Retirada no local%0A%0A`;
        }

        msg += `*🛒 Itens:*%0A`;
        state.carrinho.forEach(p => {
            msg += `✅ *${p.qnt}x ${p.nome}* — ${fmtW(p.preco * p.qnt)}%0A`;
            if (p.obs) msg += `_Obs: ${p.obs}_%0A`;
        });
        msg += `%0A`;
        msg += `*💵 Subtotal:* ${fmtW(subtotal)}%0A`;
        if (state.descontoAtivo > 0) {
            msg += `*🎟️ Desconto (${state.cupomAplicado}):* -${fmtW(desconto)}%0A`;
        }
        if (freteValor > 0) {
            msg += `*📦 Frete:* ${fmtW(freteValor)}%0A`;
        }
        msg += `*💰 TOTAL: ${fmtW(totalFinal)}*`;

        localStorage.setItem('acp_nome', nomeCliente);
        localStorage.setItem('acp_telefone', telefoneCliente);

        const mesaInput = document.getElementById("clienteMesa");
        const posicaoInput = document.getElementById("clientePosicao");
        if (mesaInput) mesaInput.value = '';
        if (posicaoInput) posicaoInput.value = '';

        // Incrementar uso do cupom se houver
        if (state.cupomAplicado) {
            const cupomObj = CUPONS.find(c => c.code === state.cupomAplicado);
            if (cupomObj) {
                await sb.rpc('increment_coupon_usage', { _coupon_id: cupomObj.id });
            }
        }

        // Se premium com comanda: incrementar total da comanda e atualizar UI
        if (state.premiumUser && state.premiumUser.comandaId) {
            let incremented = false;
            try {
                const { error: rpcErr } = await sb.rpc('incrementar_total_comanda', {
                    _comanda_id: state.premiumUser.comandaId,
                    _valor: totalFinal
                });
                if (!rpcErr) {
                    incremented = true;
                } else {
                    console.warn('[Comanda] RPC retornar erro, usando update direto:', rpcErr);
                }
            } catch(rpcErr) {
                console.warn('[Comanda] RPC falhou catastroficamente, usando update direto:', rpcErr);
            }

            if (!incremented) {
                try {
                    // Buscar total acumulado atual da comanda no banco para somar de forma segura
                    const { data: comandaAtual } = await sb.from('comandas')
                        .select('total_acumulado')
                        .eq('id', state.premiumUser.comandaId)
                        .maybeSingle();
                    const totalAcumuladoNovo = parseFloat(comandaAtual?.total_acumulado || 0) + totalFinal;
                    await sb.from('comandas')
                        .update({ total_acumulado: totalAcumuladoNovo })
                        .eq('id', state.premiumUser.comandaId);
                } catch (updErr) {
                    console.error('[Comanda] Erro ao atualizar total_acumulado via fallback:', updErr);
                }
            }

            state.premiumUser.gasto = (state.premiumUser.gasto || 0) + totalFinal;
            localStorage.setItem('premiumUser', JSON.stringify(state.premiumUser));
            atualizarBarraPremium();
        }

        state.carrinho = [];
        state.descontoAtivo = 0;
        state.cupomAplicado = null;
        renderCarrinho();
        toggleCart(false);
        carregarProdutos();
        
        // Se é cliente premium: bypass completo de WhatsApp/Pix/Cartão
        if (state.premiumUser && state.premiumUser.comandaId) {
            mostrarConfirmacaoComanda(totalFinal);
            carregarComandaUI();
        } else if (state.formaPagamento === 'pix') {
            await iniciarFluxoPix(orderId, totalFinal, msg);
        } else if (state.formaPagamento === 'cartao') {
            await iniciarFluxoCartaoCheckoutPro(orderId, msg);
        } else {
            // Função auxiliar para gerar mensagem do WhatsApp
            const buildWhatsappMsg = (dados) => {
                let template = state.whatsappTemplate;
                if (!template) {
                    template = `*📦 NOVO PEDIDO*\n\n*👤 Cliente:* {{cliente_nome}}\n*📱 Telefone:* {{cliente_telefone}}\n\n*📍 Tipo:* {{tipo_entrega}}\n{{endereco}}\n\n*🛒 Itens:*\n{{itens}}\n\n*💵 Subtotal:* {{subtotal}}\n{{desconto}}{{frete}}*💰 TOTAL:* {{total}}\n\n*💳 Pagamento:* {{pagamento}}`;
                }

                let itensStr = '';
                if (dados.carrinho && dados.carrinho.length > 0) {
                    itensStr = dados.carrinho.map(item => {
                        const obs = item.obs ? `\n   _Obs: ${item.obs}_` : '';
                        return `• ${item.qnt}x ${item.nome} - ${formatCurrency(item.preco * item.qnt)}${obs}`;
                    }).join('\n');
                }

                let enderecoStr = '';
                if (dados.tipoEntrega === 'entrega' && dados.camposEndereco) {
                    const d = dados.camposEndereco;
                    enderecoStr = `*Endereço de Entrega:*\n${d.rua}, ${d.numero}${d.complemento ? ' - ' + d.complemento : ''}\nBairro: ${d.bairro}`;
                } else if (dados.tipoEntrega === 'mesa') {
                    const m = dados.camposEndereco;
                    enderecoStr = `*Mesa:* ${m.rua}\n*Posição:* ${m.numero}`;
                }

                const descontoStr = dados.desconto > 0 ? `*🎟️ Desconto:* -${formatCurrency(dados.desconto)}\n` : '';
                const freteStr = dados.tipoEntrega === 'entrega' ? `*📦 Frete:* ${formatCurrency(dados.freteValor)}\n` : '';
                const pgtMap = { 'dinheiro': '💵 Dinheiro', 'pix': '💠 PIX', 'cartao': '💳 Cartão' };

                const mapVars = {
                    '{{cliente_nome}}': dados.nomeCliente || '',
                    '{{cliente_telefone}}': dados.telefoneCliente || '',
                    '{{tipo_entrega}}': dados.tipoEntrega === 'entrega' ? '🛵 Entrega' : (dados.tipoEntrega === 'mesa' ? '🍽️ Na Mesa' : '🛍️ Retirada'),
                    '{{endereco}}': enderecoStr,
                    '{{itens}}': itensStr,
                    '{{subtotal}}': formatCurrency(dados.subtotal),
                    '{{desconto}}': descontoStr,
                    '{{frete}}': freteStr,
                    '{{total}}': formatCurrency(dados.totalFinal),
                    '{{pagamento}}': pgtMap[dados.formaPagamento] || dados.formaPagamento
                };

                let result = template;
                Object.keys(mapVars).forEach(key => {
                    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    result = result.replace(new RegExp(safeKey, 'g'), mapVars[key]);
                });

                return encodeURIComponent(result);
            };

            // WhatsApp dinâmico — verifica toggle por tipo de retirada
            const waAtivo = state.whatsappAtivo && state.whatsappAtivo[state.tipoEntrega] && state.whatsappNumero;

            const concluir = () => {
                if (waAtivo) {
                    const waMsg = buildWhatsappMsg({
                        nomeCliente,
                        telefoneCliente,
                        tipoEntrega: state.tipoEntrega,
                        camposEndereco,
                        carrinho: state.carrinho.length > 0 ? state.carrinho : itemsPayload.map(i => ({ nome: i.product_name, qnt: i.quantity, preco: i.unit_price, obs: i.observations })),
                        subtotal,
                        desconto,
                        freteValor,
                        totalFinal,
                        formaPagamento: state.formaPagamento
                    });
                    window.open(`https://wa.me/${state.whatsappNumero}?text=${waMsg}`);
                }
                mostrarConfirmacaoPedido(nomeCliente, state.formaPagamento, waAtivo);
            };

            if (state.formaPagamento === 'dinheiro') {
                mostrarAlertaPagamentoManual(concluir);
            } else {
                concluir();
            }
        }

    } catch (err) {
        console.error("Erro ao processar pedido:", err);
        mostrarToast('Houve um problema ao registrar o pedido. Tente novamente!', 'error');
    } finally {
        btn.disabled = false;
        if (state.premiumUser && state.premiumUser.comandaId) {
            btn.innerHTML = `<span>Enviar pedido para o atendente</span><span class="atendente-icon">🛎️</span>`;
        } else {
            btn.innerHTML = `<span>Finalizar Pedido</span><span class="atendente-icon">💳</span>`;
        }
    }
};

// =============================================
// TOAST & CONFIRMAÇÃO
// =============================================

function mostrarToast(msg, tipo = 'success') {
    const existing = document.getElementById('toastMsg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = `toast-msg toast-${tipo}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function mostrarAlertaPagamentoManual(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    overlay.innerHTML = `
        <div class="custom-alert-box">
            <div class="custom-alert-icon">🛎️</div>
            <h2 class="custom-alert-title">Atenção ao Pagamento</h2>
            <p class="custom-alert-text">Seu pedido foi enviado para a cozinha! 🎉<br><br>Por favor, lembre-se que o pagamento deve ser realizado <strong>diretamente com o atendente</strong>.</p>
            <button class="custom-alert-btn">Entendido! 👍</button>
        </div>
    `;
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => overlay.classList.add('active'));
    
    overlay.querySelector('.custom-alert-btn').onclick = () => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            callback();
        }, 300);
    };
}

function mostrarConfirmacaoPedido(nome, formaPagamento = '', freteHabilitado = true) {
    const overlay = document.createElement('div');
    overlay.id = 'orderConfirmOverlay';

    let detailText = "";
    
    if (formaPagamento === 'dinheiro' || formaPagamento === 'cartao') {
        detailText = `Seu pedido já está em preparo! 🍳<br><br><strong style="color:var(--primary); font-size: 1.1em;">Agora é só aguardar o atendente para realizar o pagamento.</strong>`;
    } else {
        if (freteHabilitado) {
            detailText = "Em breve você receberá uma confirmação pelo WhatsApp. <br>Prepara o prato porque vem coisa boa aí! 😋";
        } else {
            detailText = "Seu pedido foi encaminhado para nossa cozinha. <br>Prepara o prato porque vem coisa boa aí! 😋";
        }
    }

    overlay.innerHTML = `
        <div class="order-confirm-box">
            <div class="order-confirm-emoji">🍽️</div>
            <h2 class="order-confirm-title">Pedido Enviado!</h2>
            <p class="order-confirm-sub">Ebaaa, ${nome}! Seu pedido foi registrado com sucesso 🎉</p>
            <p class="order-confirm-detail">${detailText}</p>
            <button class="order-confirm-btn" onclick="document.getElementById('orderConfirmOverlay').remove(); window.location.reload();">Maravilha! 🤩</button>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('order-confirm-visible'));
}

function mostrarRedirecionamentoMercadoPago() {
    const overlay = document.createElement('div');
    overlay.className = 'mp-redirect-overlay';
    overlay.innerHTML = `
        <div class="mp-redirect-box">
            <div class="mp-secure-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Ambiente Seguro
            </div>
            <div class="mp-brand">
                💳 Mercado Pago
            </div>
            <p class="mp-redirect-text">Estamos preparando o seu ambiente de pagamento criptografado.<br>Por favor, aguarde...</p>
            <div class="mp-spinner"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Forçar reflow para ativar animação CSS
    requestAnimationFrame(() => overlay.classList.add('active'));
}

// UI Controls
const toggleCart = (show) => {
    dom.cart.classList.toggle('open', show);
    dom.backdrop.classList.toggle('active', show);
    dom.cart.setAttribute('aria-hidden', String(!show));
    if (show) navegarStep(1);
};

document.getElementById("btnCart").onclick = () => toggleCart(true);
document.getElementById("closeCart").onclick = () => toggleCart(false);
document.getElementById("closeModal").onclick = () => toggleModal(false);
dom.backdrop.onclick = () => { toggleCart(false); toggleModal(false); };

// =============================================
// FLUXO PIX MERCADO PAGO
// =============================================

async function iniciarFluxoPix(orderId, total, whatsappMsg) {
    const modal = document.getElementById('modalPix');
    const qrImage = document.getElementById('pixQrImage');
    const loading = document.getElementById('pixLoading');
    const statusMsg = document.getElementById('pixStatusMessage');
    const btnCopiar = document.getElementById('btnCopiarPix');

    modal.classList.add('active');
    loading.style.display = 'block';
    qrImage.style.display = 'none';
    statusMsg.innerText = 'Gerando seu PIX...';
    statusMsg.style.color = 'var(--primary)';
    btnCopiar.disabled = true;

    try {
        // Resetar modal para estado inicial
        pixLoading.style.display = 'block';
        qrImage.style.display = 'none';
        btnCopiar.style.display = 'none';
        statusMsg.innerText = 'Gerando cobrança...';

        const { data, error } = await sb.functions.invoke('mercadopago-pix', {
            body: { orderId }
        });

        if (error || (data && data.error)) {
            const msgErro = error?.details || data?.error || 'Erro desconhecido';
            mostrarToast('Erro do Mercado Pago: ' + msgErro, 'error');
            throw new Error(msgErro);
        }

        loading.style.display = 'none';
        pixLoading.style.display = 'none';
        qrImage.src = `data:image/png;base64,${data.qr_code_base64}`;
        qrImage.style.display = 'block';
        btnCopiar.style.display = 'block'; // Mostrar botão apenas agora
        statusMsg.innerText = 'Aguardando pagamento...';
        btnCopiar.disabled = false;

        btnCopiar.onclick = () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(data.qr_code);
                const feedback = document.getElementById('copyPixFeedback');
                feedback.style.display = 'block';
                setTimeout(() => feedback.style.display = 'none', 3000);
            } else {
                mostrarToast('Seu navegador não suporta cópia automática.', 'warn');
            }
        };

        const channel = sb.channel(`order-pix-${orderId}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders', 
                filter: `id=eq.${orderId}` 
            }, payload => {
                if (payload.new.payment_status === 'pago') {
                    statusMsg.innerHTML = '✅ PAGAMENTO CONFIRMADO!';
                    statusMsg.style.color = '#25D366';
                    
                    setTimeout(() => {
                        modal.classList.remove('active');
                        mostrarToast('Pagamento recebido!', 'success');
                        if (state.freteHabilitado) {
                            window.open(`https://wa.me/${CONFIG.telefone}?text=${whatsappMsg}%0A%0A*✅ PAGAMENTO PIX CONFIRMADO*`);
                        }
                        mostrarConfirmacaoPedido(document.getElementById("clienteNome")?.value.trim(), 'pix', state.freteHabilitado);
                    }, 2000);
                    
                    sb.removeChannel(channel);
                }
            })
            .subscribe();

        document.getElementById('closeModalPix').onclick = () => {
            modal.classList.remove('active');
            sb.removeChannel(channel);
        };

    } catch (err) {
        console.error('Erro no fluxo PIX:', err);
        mostrarToast('Erro ao gerar PIX.', 'error');
        modal.classList.remove('active');
        const btn = document.getElementById('btnEnviar');
        btn.disabled = false;
        btn.innerHTML = `<span>Tentar novamente</span>`;
    }
}
// =============================================
// FLUXO CARTÃO (CHECKOUT PRO) MERCADO PAGO
// =============================================

async function iniciarFluxoCartaoCheckoutPro(orderId, whatsappMsg) {
    const btn = document.getElementById('btnEnviar');
    
    try {
        mostrarToast('Gerando link de pagamento...', 'success');
        btn.disabled = true;
        btn.innerHTML = `<span>Redirecionando...</span><span class="atendente-icon">⏳</span>`;

        const { data, error } = await sb.functions.invoke('mercadopago-checkout', {
            body: { orderId }
        });

        if (error || (data && data.error)) {
            const msgErro = error?.details || data?.error || 'Erro desconhecido ao gerar link';
            mostrarToast('Erro do Mercado Pago: ' + msgErro, 'error');
            throw new Error(msgErro);
        }

        if (data && data.url) {
            // Salvar no localStorage que estamos enviando pro checkout, para quando voltar
            localStorage.setItem('aguardando_retorno_mp', 'true');
            
            // Exibir o Popup Premium
            mostrarRedirecionamentoMercadoPago();
            
            // Um pequeno delay só para o usuário poder ver a animação premium antes de ir
            setTimeout(() => {
                window.location.href = data.url; // Redirecionamento para o Mercado Pago
            }, 1200);
        } else {
            throw new Error('URL de pagamento não retornada');
        }

    } catch (err) {
        console.error('Erro no fluxo Cartão:', err);
        mostrarToast('Erro ao redirecionar para pagamento.', 'error');
        btn.disabled = false;
        btn.innerHTML = `<span>Tentar novamente</span>`;
    }
}

// =============================================
// LOGIN VIP PREMIUM
// =============================================

function inicializarLoginPremium() {
    const btnLogin = document.getElementById('btnLoginPremium');
    const modal = document.getElementById('modalLoginPremium');
    const btnClose = document.getElementById('closeModalLoginPremium');
    const btnEntrar = document.getElementById('btnEntrarPremium');
    const inputCpf = document.getElementById('loginPremiumCpf');
    const inputPin = document.getElementById('loginPremiumPin');
    const btnSair = document.getElementById('btnLogoutPremium');

    if (!btnLogin || !modal) return;

    // Verificar se já tem login salvo no localStorage
    const savedUser = localStorage.getItem('premiumUser');
    let restaurouSessao = false;
    if (savedUser) {
        try {
            const parsed = JSON.parse(savedUser);
            if (parsed.expiry && Date.now() < parsed.expiry) {
                console.log('[Premium] Sessão restaurada do localStorage para:', parsed.nome);
                state.premiumUser = parsed;
                restaurouSessao = true;

                // Sempre buscar os dados mais recentes em background para refletir mudanças do admin instantaneamente (limites e perfil)
                console.log('[Premium] Sincronizando sessão em background com o banco...');
                sb.from('clientes_premium')
                    .select('teto_mensal, perfil_cardapio_id')
                    .eq('id', parsed.id)
                    .single()
                    .then(async ({data: cli}) => {
                        if (cli) {
                            state.premiumUser.teto = parseFloat(cli.teto_mensal) || 0;
                            
                            if (cli.perfil_cardapio_id) {
                                const [catsRes, prodsRes] = await Promise.all([
                                    sb.from('perfil_cardapio_categorias').select('category_id').eq('perfil_id', cli.perfil_cardapio_id),
                                    sb.from('perfil_cardapio_produtos').select('product_id').eq('perfil_id', cli.perfil_cardapio_id)
                                ]);
                                state.premiumUser.categoriasPermitidas = (catsRes.data || []).map(c => c.category_id);
                                state.premiumUser.produtosPermitidos = (prodsRes.data || []).map(p => p.product_id);
                            } else {
                                state.premiumUser.categoriasPermitidas = null;
                                state.premiumUser.produtosPermitidos = null;
                            }
                            
                            // Buscar/criar comanda aberta primeiro
                            await buscarOuCriarComanda(parsed.id);

                            // Atualizar gasto do mês (inclui mês atual e qualquer pedido na comanda aberta)
                            const mesAtual = new Date();
                            const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString();
                            
                            let query = sb.from('orders')
                                .select('total, comanda_id')
                                .eq('cliente_premium_id', parsed.id)
                                .not('status', 'eq', 'cancelado');
                                
                            if (state.premiumUser.comandaId) {
                                query = query.or(`created_at.gte.${inicioMes},comanda_id.eq.${state.premiumUser.comandaId}`);
                            } else {
                                query = query.gte('created_at', inicioMes);
                            }
                            
                            const { data: orders } = await query;
                            state.premiumUser.gasto = (orders || []).reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

                            // Atualiza cache e re-renderiza
                            localStorage.setItem('premiumUser', JSON.stringify(state.premiumUser));
                            atualizarBarraPremium();
                            aplicarFiltroCardapioPremium();
                            carregarComandaUI();
                            console.log('[Premium] Sessão sincronizada com sucesso e UI atualizada!');
                        }
                    })
                    .catch(err => console.error('[Premium] Erro ao sincronizar sessão:', err));

            } else {
                console.log('[Premium] Sessão expirada. Limpando localStorage.');
                localStorage.removeItem('premiumUser');
                state.premiumUser = null;
            }
        } catch(e) {
            console.warn('[Premium] Erro ao ler sessão do localStorage:', e);
            localStorage.removeItem('premiumUser');
            state.premiumUser = null;
        }
    } else {
        state.premiumUser = null;
    }

    // Atualizar UI com o estado correto (logado ou não)
    atualizarBarraPremium();
    aplicarFiltroCardapioPremium();
    console.log('[Premium] Estado final -> premiumUser:', state.premiumUser ? state.premiumUser.nome : 'NULL (cardápio completo)');

    btnLogin.onclick = (e) => {
        if (e) e.preventDefault();
        if (state.premiumUser) {
            // Logoff
            state.premiumUser = null;
            localStorage.removeItem('premiumUser');
            atualizarBarraPremium();
            aplicarFiltroCardapioPremium();
            return;
        }
        inputCpf.value = '';
        inputPin.value = '';
        const errDiv = document.getElementById('loginPremiumError');
        if (errDiv) errDiv.style.display = 'none';
        
        modal.classList.add('active');
        if (dom.backdrop) dom.backdrop.classList.add('active');
        document.body.classList.add('no-scroll');
    };

    const fecharModalLogin = () => {
        modal.classList.remove('active');
        if (dom.backdrop) dom.backdrop.classList.remove('active');
        document.body.classList.remove('no-scroll');
    };

    if (btnClose) btnClose.onclick = fecharModalLogin;
    
    // Máscara simples CPF
    if (inputCpf) {
        inputCpf.addEventListener('input', function() {
            let v = this.value.replace(/\D/g, '');
            if (v.length > 11) v = v.substring(0, 11);
            if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
            else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
            this.value = v;
        });
    }

    if (btnEntrar) {
        btnEntrar.onclick = async () => {
            const cpf = inputCpf.value.replace(/\D/g, '');
            const pin = inputPin.value;
            const errDiv = document.getElementById('loginPremiumError');

            if (cpf.length !== 11 || !pin) {
                if (errDiv) {
                    errDiv.textContent = 'Preencha o CPF e o PIN corretamente.';
                    errDiv.style.display = 'block';
                }
                return;
            }

            btnEntrar.disabled = true;
            btnEntrar.textContent = 'Verificando...';
            if (errDiv) errDiv.style.display = 'none';

            try {
                // Hash simples do PIN (mesmo algoritmo do admin)
                const msgBuffer = new TextEncoder().encode(pin);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                const { data, error } = await sb.from('clientes_premium')
                    .select('id, nome, cpf, tipo, teto_mensal, pin, perfil_cardapio_id, ativo, primeiro_acesso')
                    .eq('empresa_id', getTenantId())
                    .eq('cpf', cpf)
                    .single();

                if (error || !data) {
                    throw new Error('Credenciais inválidas.');
                }

                if (data.ativo === false) {
                    throw new Error('Usuário bloqueado. O desbloqueio deverá ser feito com o administrador.');
                }

                if (data.pin !== pinHash) {
                    // Incrementar tentativa incorreta
                    window.failedAttempts = window.failedAttempts || {};
                    window.failedAttempts[cpf] = (window.failedAttempts[cpf] || 0) + 1;
                    const attempts = window.failedAttempts[cpf];

                    if (attempts === 3) {
                        throw new Error('Credenciais inválidas. Atenção: se houver uma 4ª tentativa incorreta, seu usuário será bloqueado e o desbloqueio deverá ser feito com o administrador.');
                    } else if (attempts >= 4) {
                        // Bloquear no banco de dados
                        await sb.from('clientes_premium')
                            .update({ ativo: false })
                            .eq('id', data.id);
                        throw new Error('Usuário bloqueado por excesso de tentativas incorretas. O desbloqueio deverá ser feito com o administrador.');
                    } else {
                        throw new Error('Credenciais inválidas.');
                    }
                }

                // Buscar categorias permitidas se houver perfil
                let categoriasPermitidas = null;
                let produtosPermitidos = null;
                if (data.perfil_cardapio_id) {
                    const { data: catData } = await sb.from('perfil_cardapio_categorias')
                        .select('category_id')
                        .eq('perfil_id', data.perfil_cardapio_id);
                    categoriasPermitidas = (catData || []).map(c => c.category_id);

                    const { data: prodData } = await sb.from('perfil_cardapio_produtos')
                        .select('product_id')
                        .eq('perfil_id', data.perfil_cardapio_id);
                    produtosPermitidos = (prodData || []).map(p => p.product_id);
                }

                // Buscar comanda aberta do cliente para verificação de renovação
                const { data: activeCom } = await sb.from('comandas')
                    .select('id')
                    .eq('cliente_premium_id', data.id)
                    .eq('status', 'aberta')
                    .maybeSingle();

                // Buscar gasto atual no mês (e da comanda ativa, se aberta)
                const mesAtual = new Date();
                const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString();
                
                let query = sb.from('orders')
                    .select('total, comanda_id')
                    .eq('cliente_premium_id', data.id)
                    .not('status', 'eq', 'cancelado');

                if (activeCom) {
                    query = query.or(`created_at.gte.${inicioMes},comanda_id.eq.${activeCom.id}`);
                } else {
                    query = query.gte('created_at', inicioMes);
                }

                const { data: orders } = await query;
                const gastoMes = (orders || []).reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

                // Limpar tentativas em caso de sucesso
                if (window.failedAttempts && window.failedAttempts[cpf]) {
                    delete window.failedAttempts[cpf];
                }

                // Se for o primeiro acesso, forçar a troca de senha (PIN)
                if (data.primeiro_acesso) {
                    fecharModalLogin();
                    
                    const modalAlterar = document.getElementById('modalAlterarPinPremium');
                    const errPinDiv = document.getElementById('alterarPinError');
                    if (errPinDiv) errPinDiv.style.display = 'none';
                    
                    modalAlterar.classList.add('active');
                    if (dom.backdrop) dom.backdrop.classList.add('active');
                    document.body.classList.add('no-scroll');
                    
                    const btnSalvarNovo = document.getElementById('btnSalvarPinNovo');
                    const inputNovo = document.getElementById('alterarPinNovo');
                    const inputConfirmar = document.getElementById('alterarPinConfirmar');
                    
                    inputNovo.value = '';
                    inputConfirmar.value = '';
                    
                    btnSalvarNovo.onclick = async () => {
                        const novoPin = inputNovo.value.trim();
                        const confirmarPin = inputConfirmar.value.trim();
                        
                        if (novoPin.length < 4 || novoPin.length > 6 || !/^\d+$/.test(novoPin)) {
                            errPinDiv.textContent = 'O PIN deve ter entre 4 e 6 dígitos numéricos.';
                            errPinDiv.style.display = 'block';
                            return;
                        }
                        
                        if (novoPin !== confirmarPin) {
                            errPinDiv.textContent = 'As senhas digitadas não coincidem.';
                            errPinDiv.style.display = 'block';
                            return;
                        }
                        
                        btnSalvarNovo.disabled = true;
                        btnSalvarNovo.textContent = 'Salvando...';
                        
                        try {
                            const newMsgBuffer = new TextEncoder().encode(novoPin);
                            const newHashBuffer = await crypto.subtle.digest('SHA-256', newMsgBuffer);
                            const newHashArray = Array.from(new Uint8Array(newHashBuffer));
                            const newPinHash = newHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                            
                            const { error: updateErr } = await sb.from('clientes_premium')
                                .update({ pin: newPinHash, primeiro_acesso: false })
                                .eq('id', data.id);
                                
                            if (updateErr) throw updateErr;
                            
                            modalAlterar.classList.remove('active');
                            if (dom.backdrop) dom.backdrop.classList.remove('active');
                            document.body.classList.remove('no-scroll');
                            
                            mostrarToast('Senha alterada com sucesso!', 'success');
                            
                            const expiry = Date.now() + 12 * 60 * 60 * 1000;
                            state.premiumUser = {
                                id: data.id,
                                nome: data.nome.split(' ')[0],
                                nomeCompleto: data.nome,
                                telefone: data.telefone,
                                cpf: data.cpf,
                                tipo: data.tipo,
                                teto: parseFloat(data.teto_mensal) || 0,
                                gasto: gastoMes,
                                categoriasPermitidas: categoriasPermitidas,
                                produtosPermitidos: produtosPermitidos,
                                comandaId: null,
                                expiry: expiry
                            };

                            await buscarOuCriarComanda(data.id);
                            localStorage.setItem('premiumUser', JSON.stringify(state.premiumUser));
                            
                            atualizarBarraPremium();
                            aplicarFiltroCardapioPremium();
                            carregarComandaUI();

                            const n = document.getElementById('clienteNome');
                            if (n) n.value = data.nome;
                            
                        } catch (saveErr) {
                            console.error('Erro ao salvar novo PIN:', saveErr);
                            errPinDiv.textContent = 'Erro ao salvar a nova senha: ' + saveErr.message;
                            errPinDiv.style.display = 'block';
                        } finally {
                            btnSalvarNovo.disabled = false;
                            btnSalvarNovo.textContent = 'Salvar Nova Senha';
                        }
                    };
                    return;
                }

                // Sucesso (Acesso normal)
                const expiry = Date.now() + 12 * 60 * 60 * 1000;
                state.premiumUser = {
                    id: data.id,
                    nome: data.nome.split(' ')[0],
                    nomeCompleto: data.nome,
                    telefone: data.telefone,
                    cpf: data.cpf,
                    tipo: data.tipo,
                    teto: parseFloat(data.teto_mensal) || 0,
                    gasto: gastoMes,
                    categoriasPermitidas: categoriasPermitidas,
                    produtosPermitidos: produtosPermitidos,
                    comandaId: null,
                    expiry: expiry
                };

                await buscarOuCriarComanda(data.id);
                localStorage.setItem('premiumUser', JSON.stringify(state.premiumUser));
                
                fecharModalLogin();
                atualizarBarraPremium();
                aplicarFiltroCardapioPremium();
                carregarComandaUI();

                const n = document.getElementById('clienteNome');
                if (n) n.value = data.nome;

            } catch (err) {
                console.error('Login VIP:', err);
                if (errDiv) {
                    errDiv.textContent = err.message || 'CPF ou PIN incorretos.';
                    errDiv.style.display = 'block';
                }
            } finally {
                btnEntrar.disabled = false;
                btnEntrar.textContent = 'Entrar';
            }
        };
    }
}

function atualizarBarraPremium() {
    const bar = document.getElementById('premiumStatusBar');
    const btn = document.getElementById('btnLoginPremium');
    if (!bar) return;

    if (state.premiumUser) {
        document.getElementById('premiumUserFirstName').textContent = state.premiumUser.nome;
        

        const teto = state.premiumUser.teto;
        const gasto = state.premiumUser.gasto || 0;
        const disp = teto > 0 ? (teto - gasto) : -1;
        
        const utilizadoEl = document.getElementById('premiumUserUtilizado');
        const disponivelEl = document.getElementById('premiumUserDisponivel');
        const progressEl = document.getElementById('premiumUserProgress');
        
        if (teto > 0) {
            if (utilizadoEl) utilizadoEl.textContent = formatCurrency(gasto);
            if (disponivelEl) disponivelEl.textContent = formatCurrency(Math.max(0, disp));
            
            if (progressEl) {
                const percent = Math.min(100, Math.max(0, (gasto / teto) * 100));
                progressEl.style.width = percent + '%';
                
                // Muda a cor da barra dependendo do uso
                if (percent >= 90) {
                    progressEl.style.background = '#ef4444'; // red-500
                } else if (percent >= 75) {
                    progressEl.style.background = '#f59e0b'; // amber-500
                } else {
                    progressEl.style.background = '#10b981'; // emerald-500
                }
            }
            document.querySelector('.psb-limits').style.display = 'flex';
        } else {
            // Sem limite definido
            document.querySelector('.psb-limits').style.display = 'none';
        }

        bar.style.display = 'flex';
        
        if (btn) {
            btn.style.display = 'flex';
            btn.classList.add('is-logout'); // Adiciona a classe de estilo "Sair" (danger)
            
            const icon = document.getElementById('iconLoginPremium');
            const label = document.getElementById('labelLoginPremium');
            if (icon) icon.innerText = '🚪';
            if (label) label.innerText = 'Sair';
        }
    } else {
        bar.style.display = 'none';
        if (btn && isModuloAtivo('clientes_premium')) {
            btn.style.display = 'flex';
            btn.classList.remove('is-logout'); // Remove a classe de estilo "Sair" (volta pro gold)
            
            const icon = document.getElementById('iconLoginPremium');
            const label = document.getElementById('labelLoginPremium');
            if (icon) icon.innerText = '👑';
            if (label) label.innerText = 'Login';
        } else if (btn) {
            btn.style.display = 'none';
        }
    }
}

function aplicarFiltroCardapioPremium() {
    // Re-render categories and products
    renderCategorias();
    renderMenu();
}

// =============================================
// COMANDA DIGITAL
// =============================================

async function buscarOuCriarComanda(clienteId) {
    try {
        // Buscar comanda aberta existente
        const { data: comanda, error } = await sb.from('comandas')
            .select('id, total_acumulado')
            .eq('cliente_premium_id', clienteId)
            .eq('status', 'aberta')
            .order('aberta_em', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) { console.error('[Comanda] Erro ao buscar:', error); return; }

        if (comanda) {
            state.premiumUser.comandaId = comanda.id;
            console.log('[Comanda] Comanda aberta encontrada:', comanda.id);
        } else {
            // Criar nova comanda
            const { data: nova, error: insertErr } = await sb.from('comandas').insert({
                empresa_id: getTenantId(),
                cliente_premium_id: clienteId,
                status: 'aberta',
                total_acumulado: 0
            }).select('id').single();

            if (insertErr) { console.error('[Comanda] Erro ao criar:', insertErr); return; }
            state.premiumUser.comandaId = nova.id;
            console.log('[Comanda] Nova comanda criada:', nova.id);
        }
    } catch (err) {
        console.error('[Comanda] Erro geral:', err);
    }
}

async function carregarComandaUI() {
    const tabsContainer = document.getElementById('premiumTabs');
    if (!tabsContainer) return;

    if (!state.premiumUser || !state.premiumUser.comandaId) {
        tabsContainer.style.display = 'none';
        return;
    }

    tabsContainer.style.display = 'flex';

    // Buscar pedidos da comanda
    try {
        const { data: pedidos } = await sb.from('orders')
            .select('id, total, created_at, order_items(product_name, quantity, unit_price)')
            .eq('comanda_id', state.premiumUser.comandaId)
            .order('created_at', { ascending: false });

        const container = document.getElementById('psb-comanda-itens');
        const totalEl = document.getElementById('psb-comanda-total-valor');

        if (!pedidos || pedidos.length === 0) {
            container.innerHTML = '<div class="psb-comanda-vazia">Nenhum pedido na comanda ainda.</div>';
            totalEl.textContent = 'R$ 0,00';
            return;
        }

        let totalComanda = 0;
        container.innerHTML = pedidos.map(p => {
            totalComanda += parseFloat(p.total || 0);
            const hora = new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const itensResumo = (p.order_items || []).map(i => `${i.quantity}x ${i.product_name}`).join(', ');
            return `
                <div class="psb-comanda-item">
                    <div>
                        <div>${itensResumo || 'Pedido'}</div>
                        <div class="psb-comanda-item-hora">${hora}</div>
                    </div>
                    <div class="psb-comanda-item-valor">${formatCurrency(p.total)}</div>
                </div>
            `;
        }).join('');

        totalEl.textContent = formatCurrency(totalComanda);
    } catch (err) {
        console.error('[Comanda] Erro ao carregar UI:', err);
    }
}

function mostrarConfirmacaoComanda(totalPedido) {
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    overlay.innerHTML = `
        <div class="custom-alert-box">
            <div class="custom-alert-icon">📋</div>
            <h2 class="custom-alert-title">Pedido adicionado à comanda!</h2>
            <p class="custom-alert-text">O valor de <strong>${formatCurrency(totalPedido)}</strong> foi adicionado à sua comanda.<br><br>Seu pedido já foi enviado para a cozinha! 🎉</p>
            <button class="custom-alert-btn">Entendido! 👍</button>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    overlay.querySelector('.custom-alert-btn').onclick = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };
}

// =============================================
// LOGIC FOR PREMIUM TABS
// =============================================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('premium-tab')) {
        // Remove active from all tabs
        document.querySelectorAll('.premium-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        const tab = e.target.getAttribute('data-tab');
        const searchBar = document.querySelector('.search-bar-container');
        const catNav = document.querySelector('.categories-nav');
        const mainContent = document.querySelector('.main-content');
        const tabComandaContent = document.getElementById('tabComandaContent');

        if (tab === 'cardapio') {
            if (searchBar) searchBar.style.display = 'block';
            if (catNav) catNav.style.display = 'block';
            if (mainContent) mainContent.style.display = 'block';
            if (tabComandaContent) tabComandaContent.style.display = 'none';
        } else if (tab === 'comanda') {
            if (searchBar) searchBar.style.display = 'none';
            if (catNav) catNav.style.display = 'none';
            if (mainContent) mainContent.style.display = 'none';
            if (tabComandaContent) tabComandaContent.style.display = 'block';
            carregarComandaUI(); // Refresh comanda items when tab is clicked
        }
    }
});

// Inicializar
inicializar();
