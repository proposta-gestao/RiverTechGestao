/**
         * RiverTech - Admin Panel
         */
const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
window.sb = sb;

// --- Configurações Cloudinary ---
const CLOUDINARY_CLOUD_NAME = 'dzt571tv8';
const CLOUDINARY_UPLOAD_PRESET = 'rivertechimagens';

// --- STUBS PARA LAZY LOADING ---
window.renderProdutos = window.renderProdutos || function(){};
window.renderCategorias = window.renderCategorias || function(){};
window.atualizarAlertaEstoque = window.atualizarAlertaEstoque || function(){};
window.atualizarSelectCategorias = window.atualizarSelectCategorias || function(){};
window.renderPedidosFiltrados = window.renderPedidosFiltrados || function(){};
window.atualizarMétricasDashboard = window.atualizarMétricasDashboard || function(){};
window.atualizarGraficoMetricas = window.atualizarGraficoMetricas || function(){};
window.calcularInsights = window.calcularInsights || function(){};
window.renderCupons = window.renderCupons || function(){};
window.renderZonasFrete = window.renderZonasFrete || function(){};
window.renderAtendentesLista = window.renderAtendentesLista || function(){};
window.renderJustificativas = window.renderJustificativas || function(){};
window.renderizarMotivosEstoque = window.renderizarMotivosEstoque || function(){};
window.renderPerfisCardapio = window.renderPerfisCardapio || function(){};
window.aplicarFiltrosPedidos = window.aplicarFiltrosPedidos || function(){};

// --- State ---
let produtos = [];
let categorias = [];
let cupons = [];
let pedidos = [];
let imagensGaleria = [];
let currentProductImages = []; 
let zonasEntrega = [];         // --- MOVIDO PARA O TOPO ---
let cancellationReasons = [];  // --- MOVIDO PARA O TOPO ---
let motivosEstoque = [];       // --- MOVIDO PARA O TOPO ---
let chartMetricas = null;

// --- Filtros de pedidos ---

let filtrosPedidos = {
    dataInicio: '',
    dataFim: '',
    cliente: '',
    atendente: '',
    valorMin: '',
    valorMax: '',
    status: ''
};

let currentModoDashboard = 'hoje-op'; // Inicia com o operacional de hoje
let openingTime = '18:00';
let closingTime = '02:00';
let currentSettingsId = null;

// --- Utils ---
function formatNumber(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function truncateNeighborhoods(text) {
    if (!text) return '—';
    const parts = text.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length <= 3) return text;
    return parts.slice(0, 3).join(', ') + '...';
}

// --- DOM ---
const $toast = document.getElementById('toast');

function showToast(msg, type = '') {
    $toast.textContent = msg;
    $toast.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => { $toast.className = 'toast'; }, 3000);
}

function customConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalConfirmacao');
        const btnOk = document.getElementById('btnConfirmarOk');
        const btnCancel = document.getElementById('btnConfirmarCancelar');

        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;

        modal.classList.add('active');

        const handleOk = () => {
            modal.classList.remove('active');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.remove('active');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            resolve(false);
        };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    });
}

function customPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalPrompt');
        const input = document.getElementById('promptInput');
        const btnOk = document.getElementById('btnPromptOk');
        const btnCancel = document.getElementById('btnPromptCancelar');

        document.getElementById('promptTitle').textContent = title;
        document.getElementById('promptMessage').textContent = message;
        input.value = defaultValue;

        modal.classList.add('active');
        setTimeout(() => input.focus(), 100);

        const handleOk = () => {
            const val = input.value;
            modal.classList.remove('active');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            resolve(val);
        };

        const handleCancel = () => {
            modal.classList.remove('active');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            resolve(null);
        };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);

        // Enter key support
        input.onkeydown = (e) => {
            if (e.key === 'Enter') handleOk();
            if (e.key === 'Escape') handleCancel();
        };
    });
}

window.currentPromoType = 'val';

window.setPromoType = (type) => {
    window.currentPromoType = type;
    document.querySelectorAll('.promo-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    atualizarPromoPreview();
};

function atualizarPromoPreview() {
    const precoBase = parseFloat(document.getElementById('prodPreco').value) || 0;
    const inputVal = parseFloat(document.getElementById('prodPrecoPromo').value) || 0;
    const previewEl = document.getElementById('promoPreview');
    
    if (inputVal <= 0 || precoBase <= 0) {
        previewEl.style.display = 'none';
        return;
    }
    
    let finalPromo = inputVal;
    let pctLabel = "";

    if (window.currentPromoType === 'pct') {
        if (inputVal > 100) {
            previewEl.style.display = 'block';
            previewEl.textContent = `⚠️ Desconto não pode ser maior que 100%`;
            previewEl.style.color = 'var(--danger)';
            return;
        }
        finalPromo = precoBase * (1 - inputVal / 100);
        pctLabel = `(${inputVal}% OFF)`;
    } else {
        if (inputVal >= precoBase) {
            previewEl.style.display = 'block';
            previewEl.textContent = `⚠️ Preço promo deve ser menor que o original`;
            previewEl.style.color = 'var(--danger)';
            return;
        }
        const pctCalculado = Math.round((1 - (inputVal / precoBase)) * 100);
        pctLabel = isFinite(pctCalculado) && pctCalculado > 0 ? `(${pctCalculado}% OFF)` : "";
    }
    
    previewEl.style.display = 'block';
    previewEl.style.color = 'var(--warning)';
    previewEl.textContent = `Preço Final: ${formatCurrency(finalPromo)} ${pctLabel}`;
}

// Listeners para preview de promo
document.addEventListener('DOMContentLoaded', () => {
    const pBase = document.getElementById('prodPreco');
    const pPromo = document.getElementById('prodPrecoPromo');
    if (pBase) pBase.addEventListener('input', atualizarPromoPreview);
    if (pPromo) pPromo.addEventListener('input', atualizarPromoPreview);
});

function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
}

/**
 * Atalho para esconder/mostrar elementos do DOM e aplicar classe de controle.
 */
function toggleElement(el, show, displayType = null) {
    if (!el) return;
    if (show) {
        el.classList.remove('module-hidden');
        if (displayType) {
            el.style.display = displayType;
        } else {
            el.style.removeProperty('display');
        }
    } else {
        el.style.display = 'none';
        el.classList.add('module-hidden');
    }
}

// Fechar modal ao clicar fora (no backdrop)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('admin-modal-backdrop')) {
        const modalId = e.target.id;
        // Se for um modal de confirmação ou prompt, simulamos o clique no cancelar para resolver a Promise
        if (modalId === 'modalConfirmacao') {
            document.getElementById('btnConfirmarCancelar').click();
        } else if (modalId === 'modalPrompt') {
            document.getElementById('btnPromptCancelar').click();
        } else {
            fecharModal(modalId);
        }
    }
});

// --- Auth ---
document.getElementById('btnLogin').onclick = async () => {
    const btn = document.getElementById('btnLogin');
    const errEl = document.getElementById('loginError');

    try {
        const email = document.getElementById('loginEmail').value.trim();
        const senha = document.getElementById('loginSenha').value;

        if (!email || !senha) {
            errEl.textContent = 'Preencha todos os campos.';
            errEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Entrando...';
        errEl.style.display = 'none';

        const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });

        if (error) {
            errEl.textContent = 'E-mail ou senha incorretos.';
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Entrar';
            return;
        }

        // Check if admin (SaaS aware)
        let { data: adminData, error: adminError } = await sb.from('admin_users').select('id').eq('user_id', data.user.id).single();

        // Fallback 1: Verificar se é Super Admin
        const { data: isSuper } = await sb.rpc('is_super_admin', { _user_id: data.user.id });
        
        if (isSuper) {
            console.info('[Admin] Super Admin detectado. Ignorando verificações de permissão local.');
            adminData = { id: 'super-admin', role: 'super' };
            adminError = null;
        } else if (adminError || !adminData) {
            // Fallback 2: Verificar na tabela de usuários do SaaS caso a tabela legada não tenha o registro
            const { data: saasUser, error: saasError } = await sb
                .from('usuarios')
                .select('id, role')
                .eq('id', data.user.id)
                .eq('role', 'admin')
                .single();
            
            if (!saasError && saasUser) {
                adminData = saasUser;
                adminError = null;
            }
        }

        if (adminError || !adminData) {
            errEl.textContent = 'Você não tem permissão de administrador.';
            errEl.style.display = 'block';
            await sb.auth.signOut();
            btn.disabled = false;
            btn.textContent = 'Entrar';
            return;
        }

        // --- Multi-Tenant: carregar empresa_id do usuário logado ---
        const empresaId = await initTenantAdmin(sb, data.user.id);
        if (!empresaId) {
            errEl.textContent = 'Usuário não está vinculado a nenhuma empresa. Contate o suporte.';
            errEl.style.display = 'block';
            await sb.auth.signOut();
            btn.disabled = false;
            btn.textContent = 'Entrar';
            return;
        }

        await showAdmin();

        // Reiniciar o botão visualmente caso deslogue depois
        btn.disabled = false;
        btn.textContent = 'Entrar';

    } catch (err) {
        errEl.textContent = 'Erro inesperado: ' + err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Entrar no Sistema';
    }
};

// Suporte à tecla Enter no Login
document.getElementById('loginSenha').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnLogin').click();
});
document.getElementById('loginEmail').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnLogin').click();
});

document.getElementById('btnLogout').onclick = async () => {
    await sb.auth.signOut();
    document.getElementById('adminLayout').classList.remove('visible');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginSenha').value = '';
};

// Check session on load
async function checkSession() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;

        const userId = session.user.id;
        let isAuthorized = false;

        // 1. Verificar se é Super Admin
        const { data: isSuper } = await sb.rpc('is_super_admin', { _user_id: userId });
        
        if (isSuper) {
            console.info('[Auth] Super Admin detectado na sessão.');
            isAuthorized = true;
        } else {
            // 2. Verificar se é Admin na tabela legada
            const { data: adminData } = await sb.from('admin_users').select('id').eq('user_id', userId).single();
            if (adminData) {
                isAuthorized = true;
            } else {
                // 3. Verificar se é Admin na tabela SaaS
                const { data: saasUser } = await sb.from('usuarios').select('id').eq('id', userId).eq('role', 'admin').single();
                if (saasUser) isAuthorized = true;
            }
        }

        if (isAuthorized) {
            const empresaId = await initTenantAdmin(sb, userId);
            if (empresaId) {
                showAdmin();
            } else {
                console.warn('[Auth] Usuário autorizado mas sem empresa vinculada.');
            }
        }
    } catch (err) {
        console.error("Erro na verificação de sessão:", err);
    }
}

async function initAdminPublicTheme() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('tenant') && !urlParams.get('loja')) return;
    try {
        await initTenantPublico(sb);
    } catch (err) {
        console.warn('[Admin] Falha ao inicializar tema público:', err?.message || err);
    }
}

initAdminPublicTheme();
checkSession();

sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        document.getElementById('adminLayout').classList.remove('visible');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginSenha').value = '';
        
        // Limpar cache do Tenant e estado local para evitar vazamento entre logins na mesma aba
        if (typeof invalidateTenantCache === 'function') {
            invalidateTenantCache();
        } else if (window.TENANT) {
            window.TENANT.pronto = false;
            window.TENANT.empresa_id = null;
            window.TENANT.slug = null;
            window.TENANT.nome = null;
            window.TENANT.cor_primaria = null;
            window.TENANT.logo_url = null;
            window.TENANT.modulos = {};
        }
        produtos = [];
        categorias = [];
        cupons = [];
        pedidos = [];
    }
});

async function showAdmin() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').classList.add('visible');
    
    // Atualizar link do cardápio com o slug do tenant
    const btnCardapio = document.querySelector('.btn-link-cardapio');
    if (btnCardapio && window.TENANT?.slug) {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        btnCardapio.href = isLocal 
            ? `/cardapio.html?loja=${window.TENANT.slug}` 
            : `/${window.TENANT.slug}`;
    }

    await carregarTudo();

    // Restaurar última aba ativa do localStorage
    try {
        const savedTab = localStorage.getItem('admin_active_tab');
        if (savedTab) {
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
            if (tabBtn) {
                const isVisible = tabBtn.style.display !== 'none' && !tabBtn.classList.contains('module-hidden');
                console.log('[Tabs] Restaurando aba salva:', savedTab, '| Visível:', isVisible);
                if (isVisible) {
                    switchTab(savedTab, tabBtn);
                }
            }
        }
    } catch(e) { console.warn('[Tabs] Erro ao restaurar aba:', e); }
}

// --- Tabs ---
function switchTab(tabId, btn, persist = true) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if (btn) btn.classList.add('active');
    
    // Sincroniza sidebar se existir
    const sideItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (sideItem) sideItem.classList.add('active');

    const content = document.getElementById('tab-' + tabId);
    if (content) content.classList.add('active');

    // Atualiza o link de visualização no topo
    const btnLink = document.getElementById('btnVisualizarLink');
    if (btnLink) {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (tabId === 'loja') {
            btnLink.href = isLocal 
                ? `/loja.html?loja=${window.TENANT.slug}` 
                : `/loja.html?loja=${window.TENANT.slug}`;
            btnLink.innerHTML = '<span class="d-none d-md-inline">Ver Loja ↗</span><span class="d-md-none">Loja</span>';
        } else if (tabId === 'agenda') {
            btnLink.href = isLocal 
                ? `/agendamento.html?loja=${window.TENANT.slug}` 
                : `/agendamento.html?loja=${window.TENANT.slug}`;
            btnLink.innerHTML = '<span class="d-none d-md-inline">Ver Agendamento ↗</span><span class="d-md-none">Agendamento</span>';
        } else {
            btnLink.href = isLocal 
                ? `/cardapio.html?loja=${window.TENANT.slug}` 
                : `/${window.TENANT.slug}`;
            btnLink.innerHTML = '<span class="d-none d-md-inline">Ver Cardápio ↗</span><span class="d-md-none">Cardápio</span>';
        }
    }

    // Lazy Load do módulo de Agenda
    if (tabId === 'agenda' && !window.__AGENDA_INICIADO) {
        // Habilitar CSS
        const cssEl = document.getElementById('agenda-css');
        if (cssEl) cssEl.disabled = false;
        // Carregar JS
        const script = document.createElement('script');
        script.src = 'admin-modules/admin-agenda.js?v=' + Date.now();
        script.onerror = () => showToast('Erro ao carregar módulo de agenda.', 'error');
        document.body.appendChild(script);
    }

    // Lazy Load do módulo de Loja de Roupas
    if (tabId === 'loja' && !window.__LOJA_INICIADO) {
        window.__LOJA_INICIADO = true; // Marca como iniciado IMEDIATAMENTE para evitar duplicatas
        const cssLoja = document.getElementById('loja-css');
        if (cssLoja) cssLoja.disabled = false;
        const scriptLoja = document.createElement('script');
        scriptLoja.src = 'admin-modules/admin-loja.js?v=' + Date.now();
        scriptLoja.onerror = () => {
            window.__LOJA_INICIADO = false;
            showToast('Erro ao carregar módulo de loja.', 'error');
        };
        document.body.appendChild(scriptLoja);
    }

    // --- Lazy Load Módulos Administrativos Extraídos ---
    const modulosMap = {
        'dashboard': 'admin-dashboard',
        'produtos': 'admin-produtos',
        'cupons': 'admin-cupons',
        'configuracoes': 'admin-config',
        'area-premium': 'admin-config'
    };

    const moduloFile = modulosMap[tabId];
    if (moduloFile && !window['__' + moduloFile.toUpperCase()]) {
        window['__' + moduloFile.toUpperCase()] = true;
        const script = document.createElement('script');
        script.src = 'admin-modules/' + moduloFile + '.js?v=' + Date.now();
        script.onload = () => {
            if (tabId === 'produtos' && typeof window.renderProdutos === 'function') { 
                window.renderProdutos(); 
                if (typeof window.renderCategorias === 'function') window.renderCategorias(); 
            }
            if (tabId === 'dashboard' && typeof window.atualizarMétricasDashboard === 'function') { window.atualizarMétricasDashboard(); }
            if (tabId === 'cupons' && typeof window.renderCupons === 'function') { window.renderCupons(); }
            if ((tabId === 'configuracoes' || tabId === 'area-premium') && typeof window.renderZonasFrete === 'function') { 
                window.renderZonasFrete(); 
            }
        };
        script.onerror = () => {
            window['__' + moduloFile.toUpperCase()] = false;
            showToast('Erro ao carregar módulo ' + tabId, 'error');
        };
        document.body.appendChild(script);
    }

    // Persistir aba ativa no localStorage para restaurar após reload
    if (persist) {
        try { localStorage.setItem('admin_active_tab', tabId); } catch(e) {}
    }
}


document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab, btn);
});

// Sub-tabs handling
document.querySelectorAll('.subtab-btn').forEach(btn => {
    if (!btn.dataset.subtab) return; // Ignora se não for uma subaba de navegação (ex: botões do dashboard)

    btn.onclick = (e) => {
        const tabContent = e.target.closest('.tab-content');
        if (!tabContent) return;
        tabContent.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        tabContent.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById('subtab-' + btn.dataset.subtab);
        if (target) {
            target.classList.add('active');
            if (btn.dataset.subtab === 'dashboard-metricas') {
                setTimeout(atualizarGraficoMetricas, 100);
            }
            if (btn.dataset.subtab === 'config-equipe') {
                carregarAtendentesLista();
            }
        }
    };
});





























































































































































































































































// --- Data Loading ---
async function carregarTudo() {
    // 1. Primeiro as configurações (pois o dashboard depende dos horários)
    await carregarConfiguracoes();

    // 2. Depois o restante em paralelo
    await Promise.all([
        carregarProdutos(),
        carregarCategorias(),
        carregarCupons(),
        carregarMotivosEstoque(),
        carregarAtendentes(),
        carregarDashboard()
    ]);
    renderStats();
    aplicarFiltrosDeModulos(); // Novo: Filtra funcionalidades por empresa
    setupAdminRealtime();
}

/**
 * Filtra a interface do lojista escondendo o que não está no plano/módulo ativo.
 */
function aplicarFiltrosDeModulos() {
    if (!window.TENANT || !window.TENANT.pronto) {
        console.warn('[Modules] Tenant não pronto. Abortando filtros.');
        return;
    }
    const mods = window.TENANT.modulos || {};
    console.log('[Modules] Aplicando filtros. Módulos ativos:', Object.keys(mods).filter(k => mods[k]));
    
    let dynamicCss = '';
    const toggleSubtab = (subId, ativo) => {
        if (!ativo) {
            dynamicCss += `[data-subtab="${subId}"], #subtab-${subId} { display: none !important; }\n`;
        }
        
        const buttons = document.querySelectorAll(`[data-subtab="${subId}"]`);
        const contents = document.querySelectorAll(`#subtab-${subId}`);
        
        // Botões: Forçamos display se ativo (geralmente inline-block)
        buttons.forEach(b => toggleElement(b, ativo, 'inline-block'));
        
        // Conteúdos: Nunca forçamos display se ativo, deixamos o CSS .active controlar
        contents.forEach(c => toggleElement(c, ativo, null));
    };

    // 1. PRODUTOS
    const mProdGerenciar = isModuloAtivo('produtos_gerenciar');
    const mProdCategorias = isModuloAtivo('produtos_categorias');
    const mProdEstoque = isModuloAtivo('produtos_estoque');
    
    toggleSubtab('lista-produtos', mProdGerenciar);
    toggleSubtab('lista-categorias', mProdCategorias);
    toggleSubtab('lista-estoque', mProdEstoque);
    
    toggleElement(document.getElementById('stockAlertPanel'), mProdEstoque);
    toggleElement(document.getElementById('groupEstoqueCard'), mProdEstoque);
    document.querySelectorAll('.col-estoque').forEach(el => toggleElement(el, mProdEstoque, 'table-cell'));
    toggleElement(document.getElementById('prodEstoqueMin')?.closest('.form-group'), mProdEstoque);

    const mQualquerProduto = mProdGerenciar || mProdCategorias || mProdEstoque;
    const navProdutos = document.getElementById('nav-produtos');
    toggleElement(navProdutos, mQualquerProduto, 'flex');
    if (navProdutos) navProdutos.classList.toggle('module-visible', mQualquerProduto);

    // 2. VENDAS (Operacional)
    const mVendasHoje = isModuloAtivo('vendas_hoje_op');
    const mVendasOntem = isModuloAtivo('vendas_ontem_op');
    const mVendasGeral = isModuloAtivo('vendas_visao_geral');
    
    toggleElement(document.getElementById('btnModoHojeOp'), mVendasHoje);
    toggleElement(document.getElementById('btnModoOntemOp'), mVendasOntem);
    toggleElement(document.getElementById('btnModoGeral'), mVendasGeral);
    
    const mQualquerVendaOp = mVendasHoje || mVendasOntem || mVendasGeral;
    toggleSubtab('dashboard-operacional', mQualquerVendaOp);

    // 3. MÉTRICAS (Analítico)
    const mMetricasDash = isModuloAtivo('metricas_dashboard');
    const mMetricasTempo = isModuloAtivo('metricas_analise_tempo');
    const mMetricasPerf = isModuloAtivo('metricas_performance_vendas');
    const mMetricasDestaques = isModuloAtivo('metricas_destaques');

    toggleElement(document.getElementById('chartMetricas')?.parentElement, mMetricasDash);
    toggleElement(document.getElementById('insightFraseWrapper'), mMetricasDash || mMetricasTempo || mMetricasPerf || mMetricasDestaques);
    toggleElement(document.getElementById('section-metricas-tempo'), mMetricasTempo);
    toggleElement(document.getElementById('section-metricas-performance'), mMetricasPerf);
    toggleElement(document.getElementById('section-metricas-destaques'), mMetricasDestaques);

    const mQualquerMetrica = mMetricasDash || mMetricasTempo || mMetricasPerf || mMetricasDestaques;
    toggleSubtab('dashboard-metricas', mQualquerMetrica);

    const mQualquerDashboard = mQualquerVendaOp || mQualquerMetrica;
    const navDashboard = document.getElementById('nav-dashboard');
    toggleElement(navDashboard, mQualquerDashboard, 'flex');
    if (navDashboard) navDashboard.classList.toggle('module-visible', mQualquerDashboard);

    // 4. CONFIGURAÇÕES
    const mConfigEnd = isModuloAtivo('config_endereco');
    const mConfigVis = isModuloAtivo('config_personalizacao');
    const mConfigFrete = isModuloAtivo('config_frete');
    const mConfigCanc = isModuloAtivo('config_cancelamentos');

    toggleSubtab('config-dados-empresa', mConfigEnd);
    toggleSubtab('config-visual', mConfigVis);
    toggleSubtab('config-frete', mConfigFrete);
    toggleSubtab('config-cancelamento', mConfigCanc);

    const mQualquerConfig = mConfigEnd || mConfigVis || mConfigFrete || mConfigCanc;
    const navConfig = document.getElementById('nav-configuracoes');
    toggleElement(navConfig, mQualquerConfig, 'flex');
    if (navConfig) navConfig.classList.toggle('module-visible', mQualquerConfig);

    // 5. CUPONS
    const mCupons = isModuloAtivo('cupons');
    const navCupons = document.getElementById('nav-cupons');
    toggleElement(navCupons, mCupons, 'flex');
    if (navCupons) navCupons.classList.toggle('module-visible', mCupons);
    toggleElement(document.getElementById('side-nav-cupons'), mCupons, 'flex');

    // 6. AGENDAMENTO
    const mAgendamento = isModuloAtivo('agendamento_ativo');
    const navAgenda = document.getElementById('nav-agenda');
    toggleElement(navAgenda, mAgendamento, 'flex');
    if (navAgenda) navAgenda.classList.toggle('module-visible', mAgendamento);
    toggleElement(document.getElementById('side-nav-agenda'), mAgendamento, 'flex');
    if (mAgendamento) {
        const cssEl = document.getElementById('agenda-css');
        if (cssEl) cssEl.disabled = false;
    }

    // 7. EXTRAS
    const mCardapio = isModuloAtivo('cardapio');
    const btnCardapio = document.querySelector('.btn-link-cardapio');
    if (btnCardapio) toggleElement(btnCardapio, mCardapio);

    // 8. LOJA DE ROUPAS
    const mLoja = isModuloAtivo('loja_roupas');
    const navLoja = document.getElementById('nav-loja');
    toggleElement(navLoja, mLoja, 'flex');
    if (navLoja) navLoja.classList.toggle('module-visible', mLoja);
    toggleElement(document.getElementById('side-nav-loja'), mLoja, 'flex');
    if (mLoja) {
        const cssLoja = document.getElementById('loja-css');
        if (cssLoja) cssLoja.disabled = false;
    }

    // 9. CLIENTES PREMIUM
    const mClientesPremium = isModuloAtivo('clientes_premium');
    toggleSubtab('config-clientes-premium', mClientesPremium);
    toggleSubtab('config-perfis-cardapio', mClientesPremium);

    // Nova aba principal Área Premium
    const navAreaPremium = document.getElementById('nav-area-premium');
    toggleElement(navAreaPremium, mClientesPremium, 'flex');
    if (navAreaPremium) navAreaPremium.classList.toggle('module-visible', mClientesPremium);
    toggleElement(document.getElementById('side-nav-area-premium'), mClientesPremium, 'flex');

    if (typeof initModuloClientesPremium === 'function') {
        initModuloClientesPremium();
    }

    // --- Redirecionamento Automático (Segurança e UX) ---
    // NOTA: persist=false para não sobrescrever a aba salva pelo usuário
    
    // 1. Redirecionamento de Abas Principais
    const abaAtiva = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (abaAtiva === 'dashboard' && !mQualquerDashboard) { const b = document.getElementById('nav-produtos'); if(b) switchTab('produtos', b, false); }
    else if (abaAtiva === 'produtos' && !mQualquerProduto) { const b = document.getElementById('nav-dashboard'); if(b) switchTab('dashboard', b, false); }
    else if (abaAtiva === 'cupons' && !mCupons) { const b = document.getElementById('nav-produtos'); if(b) switchTab('produtos', b, false); }
    else if (abaAtiva === 'configuracoes' && !mQualquerConfig) { const b = document.getElementById('nav-produtos'); if(b) switchTab('produtos', b, false); }
    else if (abaAtiva === 'area-premium' && !mClientesPremium) { const b = document.getElementById('nav-produtos'); if(b) switchTab('produtos', b, false); }

    // 2. Redirecionamento de Sub-Abas (dentro da aba atual)
    const activeTabContent = document.querySelector('.tab-content.active');
    if (activeTabContent) {
        const activeSubContent = activeTabContent.querySelector('.subtab-content.active');
        // Se a sub-aba ativa está oculta
        if (activeSubContent && (activeSubContent.classList.contains('module-hidden') || activeSubContent.style.display === 'none')) {
            console.log('[Modules] Sub-aba ativa está desativada. Redirecionando...');
            const primeiroBotaoVisivel = Array.from(activeTabContent.querySelectorAll('.subtab-btn')).find(b => {
                return !b.classList.contains('module-hidden') && b.style.display !== 'none';
            });
            if (primeiroBotaoVisivel) primeiroBotaoVisivel.click();
        }
    }
    
    // Injeção de CSS Dinâmico (Opção Nuclear)
    let styleEl = document.getElementById('dynamic-module-filters');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-module-filters';
        document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = dynamicCss;
    
    // Recalcula o alerta de estoque após os filtros de módulo
    if (typeof atualizarAlertaEstoque === 'function') {
        atualizarAlertaEstoque();
    }
}

/**
 * Valida se um módulo está ativo antes de permitir uma ação.
 * Bloqueio funcional além do visual.
 */
function validarAcessoModulo(modulo) {
    if (!isModuloAtivo(modulo)) {
        showToast('Módulo desativado. Contrate para liberar acesso.', 'error');
        return false;
    }
    return true;
}

async function carregarAtendentes() {
    const { data, error } = await sb.from('atendentes').select('nome').order('nome');
    if (error) { showToast('Erro ao carregar atendentes', 'error'); return; }
    const select = document.getElementById('filtroAtendente');
    if (select && data) {
        select.innerHTML = '<option value="">Todos os atendentes</option>';
        data.forEach(at => {
            const opt = document.createElement('option');
            opt.value = at.nome;
            opt.textContent = at.nome;
            select.appendChild(opt);
        });
    }
}

async function carregarDashboard() {
    try {
        const tenantId = getTenantId();
        console.log('[Dashboard] Carregando dados para tenant:', tenantId);
        
        // 1. Carrega Pedidos (Produtos)
        const { data: dataOrders, error: errorOrders } = await sb
            .from('orders')
            .select('*, order_items(*)')
            .eq('empresa_id', tenantId)
            .order('created_at', { ascending: false });

        if (errorOrders) console.error('[Dashboard] Erro orders:', errorOrders);

        // 2. Carrega Agendamentos (Serviços)
        const { data: dataAgendamentos, error: errorAgendamentos } = await sb
            .from('agendamentos')
            .select('*, profissional:profissionais(nome), servico:servicos(nome, preco)')
            .eq('empresa_id', tenantId);

        if (errorAgendamentos) console.error('[Dashboard] Erro agendamentos:', errorAgendamentos);

        console.log(`[Dashboard] Pedidos: ${dataOrders?.length || 0}, Agendamentos: ${dataAgendamentos?.length || 0}`);

        // 3. Mapeia Agendamentos para o formato de Pedidos
        const agendamentosMapeados = (dataAgendamentos || []).map(a => {
            // Fallback para data: usa data_hora_inicio se created_at não existir
            const dataVenda = a.created_at || a.data_hora_inicio || new Date().toISOString();
            
            return {
                id: a.id,
                created_at: dataVenda,
                total: a.servico?.preco || 0,
                customer_name: a.cliente_nome,
                customer_phone: a.cliente_telefone,
                status: a.status,
                atendente_nome: a.profissional?.nome || '—',
                is_agendamento: true,
                order_items: [{
                    product_name: a.servico?.nome || 'Serviço',
                    quantity: 1,
                    unit_price: a.servico?.preco || 0,
                    is_service: true
                }]
            };
        });

        // 4. Combina tudo e ordena por data decrescente
        pedidos = [...(dataOrders || []), ...agendamentosMapeados].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        setModoDashboard(currentModoDashboard);
    } catch (err) {
        console.error('[Dashboard] Erro crítico:', err);
    }
}

// Alterna entre Visão Geral, Ontem (Op) e Hoje (Op)
window.setModoDashboard = (modo) => {
    currentModoDashboard = modo;
    
    const btnGeral = document.getElementById('btnModoGeral');
    const btnOntem = document.getElementById('btnModoOntemOp');
    const btnHoje = document.getElementById('btnModoHojeOp');

    if (btnGeral) btnGeral.classList.toggle('active', modo === 'geral');
    if (btnOntem) btnOntem.classList.toggle('active', modo === 'ontem-op');
    if (btnHoje) btnHoje.classList.toggle('active', modo === 'hoje-op');
    
    const infoBanner = document.getElementById('infoPeriodoOperacional');
    if (infoBanner) {
        if (modo === 'hoje-op' || modo === 'ontem-op') {
            infoBanner.style.display = 'block';
            const referenceDate = new Date();
            if (modo === 'ontem-op') referenceDate.setDate(referenceDate.getDate() - 1);
            
            const period = getOperationalPeriod(referenceDate, openingTime, closingTime);
            const txtPeriodo = document.getElementById('txtPeriodoOperacional');
            if (txtPeriodo) {
                txtPeriodo.textContent = 
                    `Período Operacional (${modo === 'hoje-op' ? 'Hoje' : 'Ontem'}): ${period.start.toLocaleString('pt-BR')} até ${period.end.toLocaleString('pt-BR')}`;
            }
        } else {
            infoBanner.style.display = 'none';
            // Se for Visão Geral, limpa as datas manuais para mostrar TUDO por padrão
            const fDataInicio = document.getElementById('filtroDataInicio');
            const fDataFim = document.getElementById('filtroDataFim');
            if (fDataInicio) fDataInicio.value = '';
            if (fDataFim) fDataFim.value = '';
            filtrosPedidos.dataInicio = '';
            filtrosPedidos.dataFim = '';
        }
    }

    atualizarMétricasDashboard();
};












































































































































































let adminRealtimeChannel = null;

function setupAdminRealtime() {
    if (adminRealtimeChannel) return;

    adminRealtimeChannel = sb.channel('admin-orders-realtime')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'orders' 
        }, payload => {
            carregarDashboard(); // Recarrega tudo para garantir sincronia total (métricas + lista)
            if (typeof carregarClientesPremium === 'function' && isModuloAtivo('clientes_premium')) {
                carregarClientesPremium(); // Atualiza valor consumido em tempo real
            }
        })
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'agendamentos' 
        }, payload => {
            carregarDashboard(); // Recarrega quando um agendamento mudar
        })
        .subscribe();

    // Realtime para mudanças na própria empresa (ex: módulos, tema)
    sb.channel('admin-company-realtime')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'empresas',
            filter: `id=eq.${getTenantId()}`
        }, payload => {
            console.log('[Realtime] Dados da empresa atualizados:', payload.new);
            if (payload.new.modulos) {
                console.log('[Realtime] Novos módulos recebidos:', payload.new.modulos);
                window.TENANT.modulos = payload.new.modulos;
                aplicarFiltrosDeModulos();
                renderProdutos(); // Garante que colunas de estoque sejam atualizadas
            }
        })
        .subscribe();
}

async function carregarProdutos() {
    const { data, error } = await sb
        .from('products')
        .select('*, categories(name)')
        .eq('empresa_id', getTenantId()) // ← Multi-Tenant
        .order('archived', { ascending: true })
        .order('active', { ascending: false })
        .order('sort_order', { ascending: true });
    if (error) {
        showToast('Erro ao carregar produtos', 'error');
        return;
    }
    produtos = data || [];

    // Inativar automaticamente itens com estoque 0
    const itensParaInativar = produtos.filter(p => p.active && p.stock <= 0 && !p.archived);
    if (itensParaInativar.length > 0) {
        const ids = itensParaInativar.map(p => p.id);
        const { error: updErr } = await sb.from('products').update({ active: false }).in('id', ids);
        if (!updErr) {
            // Update local state and re-render
            produtos.forEach(p => { if (ids.includes(p.id)) p.active = false; });
            showToast(`${itensParaInativar.length} item(ns) esgotados foram inativados.`, 'success');
        }
    }

    atualizarAlertaEstoque();
    renderProdutos();
    renderStats(); // Update stats summary
}

async function carregarCategorias() {
    const { data, error } = await sb.from('categories').select('*')
        .eq('empresa_id', getTenantId()) // ← Multi-Tenant
        .order('order_position');
    if (error) { showToast('Erro ao carregar categorias', 'error'); return; }
    categorias = data || [];
    renderCategorias();
    atualizarSelectCategorias();
}

async function carregarCupons() {
    const { data, error } = await sb.from('coupons').select('*')
        .eq('empresa_id', getTenantId()) // ← Multi-Tenant
        .order('created_at', { ascending: false });
    if (error) { showToast('Erro ao carregar cupons', 'error'); return; }
    cupons = data || [];
    renderCupons();
}

function renderStats() {
    const ativos = produtos.filter(p => p.active && !p.archived).length;
    const totalProdutos = produtos.filter(p => !p.archived).length;
    const esgotados = produtos.filter(p => p.stock <= 0 && !p.archived).length;
    const totalCats = categorias.length;

    document.getElementById('statsRow').innerHTML = `
                <div class="stat-card"><div class="stat-label">Total de Produtos</div><div class="stat-value">${totalProdutos}</div></div>
                <div class="stat-card"><div class="stat-label">Ativos</div><div class="stat-value" style="color:var(--success)">${ativos}</div></div>
                <div class="stat-card"><div class="stat-label">Esgotados</div><div class="stat-value" style="color:var(--danger)">${esgotados}</div></div>
                <div class="stat-card"><div class="stat-label">Categorias</div><div class="stat-value">${totalCats}</div></div>
            `;
}

function atualizarAlertaEstoque() {
    const panel = document.getElementById('stockAlertPanel');
    const list = document.getElementById('stockAlertList');
    // Filtra: não arquivado AND estoque <= alerta AND estoque > 0 (zerados somem daqui pois já ficam inativos)
    const baixoEstoque = produtos.filter(p => !p.archived && p.stock <= (p.min_stock_alert || 0) && p.stock > 0);

    if (baixoEstoque.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    list.innerHTML = baixoEstoque.map(p => `
                <li>
                    <span>${p.name}</span>
                    <span>${p.stock} uni. (Mín: ${p.min_stock_alert || 0})</span>
                </li>
            `).join('');
}

// --- Render Products ---





























































































































































// --- Render Coupons ---

























function atualizarSelectCategorias() {
    const select = document.getElementById('prodCategoria');
    select.innerHTML = '<option value="">Selecione...</option>';
    categorias.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

// =================== PRODUCTS CRUD ===================

async function renderizarGradeGaleria(gridId, isCompleto = false) {
    const grid = document.getElementById(gridId);
    const inputSel = document.getElementById('prodImagemSelecionada');
    const preSelecionada = inputSel.value;

    const filtroId = isCompleto ? 'filtroGaleriaCompleta' : 'filtroGaleria';
    const filtroEl = document.getElementById(filtroId);
    const termoBusca = filtroEl ? filtroEl.value.toLowerCase() : '';

    let files = imagensGaleria;
    if (termoBusca) {
        files = files.filter(f => f.name.toLowerCase().includes(termoBusca));
    }

    if (files.length === 0) {
        grid.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:0.9rem;">Nenhuma foto encontrada.</div>';
        return;
    }

    let html = '';
    const isMobile = window.innerWidth < 600;
    let limit = isCompleto ? files.length : (isMobile ? 1 : 7);
    let filesToShow = files.slice(0, limit);

    filesToShow.forEach(file => {
        const url = file.url; // Agora usamos a URL direta vinda do banco (ou do mapeamento)
        const isSelected = (preSelecionada === url) ? 'selected' : '';

        html += `
            <div class="gallery-item ${isSelected}" onclick="selecionarImagemGaleria('${url}', this, '${isCompleto}')" title="${file.name}">
                <img src="${url}" alt="${file.name}" loading="lazy">
            </div>
        `;
    });

    if (!isCompleto && files.length > 7) {
        // COMENTADO: Galeria completa requer autenticação privada do Cloudinary
        // html += `
        //             <div class="gallery-item" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(229, 178, 93, 0.1);color:var(--primary);font-size:0.8rem;text-align:center;font-weight:800;border:1px dashed var(--primary); cursor:pointer;" onclick="abrirModalGaleriaCompleta()">
        //                 <span style="font-size:1.2rem;">+${files.length - 7}</span>
        //                 Ver todas
        //             </div>
        //         `;
    }
    grid.innerHTML = html;
}

async function carregarGaleria(preSelecionada = '') {
    const inputSel = document.getElementById('prodImagemSelecionada');
    inputSel.value = preSelecionada;

    const grid = document.getElementById('imageGalleryGrid');
    if (!grid) return;

    // --- NOVO: Buscar da tabela galeria_imagens ---
    const tenantId = getTenantId();
    console.log('Carregando galeria para empresa:', tenantId);
    console.log('getTenantId resultado:', tenantId);
    
    try {
        // 1. Buscar de galeria_imagens (novo sistema)
        const { data: galeriaData, error: galeriaError } = await sb
            .from('galeria_imagens')
            .select('*')
            .eq('empresa_id', tenantId)
            .eq('tipo', 'produto')
            .order('criado_em', { ascending: false });

        if (galeriaError) {
            console.error('Erro ao carregar galeria:', galeriaError);
            console.error('Erro completo:', JSON.stringify(galeriaError));
            return;
        }

        console.log('Imagens retornadas de galeria_imagens:', galeriaData);
        console.log('Total de imagens em galeria_imagens:', galeriaData ? galeriaData.length : 0);

        // 2. FALLBACK: Se não há na galeria_imagens, buscar de loja_produtos (compatibilidade com imagens antigas)
        let todasAsImagens = (galeriaData || []).map(item => ({
            url: item.url,
            name: 'Imagem ' + new Date(item.criado_em).toLocaleDateString(),
            fonte: 'galeria'
        }));

        if (todasAsImagens.length === 0) {
            console.log('Nenhuma imagem em galeria_imagens, buscando em loja_produtos...');
            const { data: produtosData, error: produtosError } = await sb
                .from('loja_produtos')
                .select('id, imagem_url, criado_em')
                .eq('empresa_id', tenantId)
                .not('imagem_url', 'is', null)
                .order('criado_em', { ascending: false });

            if (!produtosError && produtosData) {
                console.log('Imagens encontradas em loja_produtos:', produtosData);
                todasAsImagens = produtosData.map(item => ({
                    url: item.imagem_url,
                    name: 'Imagem ' + new Date(item.criado_em).toLocaleDateString(),
                    fonte: 'produtos'
                }));
            }
        }

        console.log('imagensGaleria após mapeamento:', todasAsImagens);
        imagensGaleria = todasAsImagens;
    } catch (err) {
        console.error('Exceção ao carregar galeria:', err);
        return;
    }

    if (imagensGaleria.length === 0) {
        grid.innerHTML = `
            <div style="padding:2.5rem 1.5rem; color:var(--text-muted); text-align:center; border: 2px dashed rgba(229,178,93,0.2); border-radius: 16px; background: rgba(229,178,93,0.02); grid-column: 1 / -1;">
                <div style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;">📸</div>
                <h4 style="color:var(--text-main); margin-bottom: 0.5rem;">Sua galeria está vazia</h4>
                <p style="font-size:0.85rem; line-height:1.5;">Clique no botão <strong>"Subir Foto"</strong> acima para inserir sua primeira imagem.</p>
            </div>
        `;
    } else {
        renderizarGradeGaleria('imageGalleryGrid', false);
    }
    
    // COMENTADO: Galeria completa desativada
    // Se a galeria completa estiver aberta, atualiza ela também
    // const modalCompleto = document.getElementById('modalGaleriaCompleta');
    // if (modalCompleto && modalCompleto.classList.contains('active')) {
    //     renderizarGradeGaleria('imageGalleryGridCompleta', true);
    // }
}

const elFiltroGaleria = document.getElementById('filtroGaleria');
if (elFiltroGaleria) elFiltroGaleria.oninput = () => renderizarGradeGaleria('imageGalleryGrid', false);

// COMENTADO: Filtro de galeria completa desativado
// const elFiltroGaleriaCompleta = document.getElementById('filtroGaleriaCompleta');
// if (elFiltroGaleriaCompleta) elFiltroGaleriaCompleta.oninput = () => renderizarGradeGaleria('imageGalleryGridCompleta', true);

// COMENTADO: Função de galeria completa desativada
// Para implementar: use API privada do Cloudinary ou armazene imagens no Supabase
// window.abrirModalGaleriaCompleta = abrirModalGaleriaCompleta;
// async function abrirModalGaleriaCompleta() {
//     document.getElementById('filtroGaleriaCompleta').value = '';
//     try {
//         await carregarGaleria('');
//         console.log('Imagens carregadas:', imagensGaleria.length);
//     } catch (err) {
//         console.error('Erro ao carregar galeria:', err);
//     }
//     await renderizarGradeGaleria('imageGalleryGridCompleta', true);
//     abrirModal('modalGaleriaCompleta');
// }

window.selecionarImagemGaleria = (url, element, isCompletoStr) => {
    const isCompleto = isCompletoStr === 'true';
    
    if (currentProductImages.length >= 5) {
        showToast('Limite de 5 imagens atingido.', 'warning');
        return;
    }

    if (currentProductImages.includes(url)) {
        showToast('Esta imagem já foi adicionada.', 'info');
        return;
    }

    currentProductImages.push(url);
    renderizarMiniaturasProduto();
    showToast('Imagem adicionada da galeria!', 'success');

    // COMENTADO: Galeria completa desativada
    // if (isCompleto) {
    //     fecharModal('modalGaleriaCompleta');
    // } else {
    element.classList.add('selected');
    // }
};

const elBtnUploadNovaImagem = document.getElementById('btnUploadNovaImagem');
if (elBtnUploadNovaImagem) {
    elBtnUploadNovaImagem.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await handleImageUpload(file);
        e.target.value = '';
    };
}

// --- CONFIGURAÇÃO CLOUDINARY --- (Movido para o topo)


window.handleCloudinaryUpload = handleCloudinaryUpload;
async function handleCloudinaryUpload(file, subfolder = 'produtos') {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', `loja_${getTenantId()}/${subfolder}`);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Erro no upload');
        }

        const data = await response.json();
        return data.secure_url;

    } catch (error) {
        console.error('Erro Cloudinary:', error);
        window.showToast?.('Erro ao subir imagem: ' + error.message, 'error');
        return null;
    }
}

async function handleImageUpload(file) {
    if (currentProductImages.length >= 5) {
        showToast('Limite de 5 imagens atingido.', 'warning');
        return null;
    }

    showToast('Enviando imagem para nuvem...', 'success');
    const imageUrl = await window.handleCloudinaryUpload(file, 'produtos');
    
    if (imageUrl) {
        // --- Salvar na tabela de galeria para persistência ---
        const tenantId = getTenantId();
        await sb.from('galeria_imagens').insert({
            empresa_id: tenantId,
            url: imageUrl,
            tipo: 'produto'
        });

        // Adicionar ao array local
        currentProductImages.push(imageUrl);
        renderizarMiniaturasProduto();
        
        showToast('Imagem adicionada!', 'success');
        await carregarGaleria(imageUrl);
        
        return imageUrl;
    }
    return null;
}



















































































































































































































































































































































































































let filterTimeout;







































// --- Finalizar Pedido ---
window.finalizarPedido = async (id) => {
    if (!await customConfirm('Concluir Pedido', 'Deseja marcar este pedido como Concluído?')) return;
    const { error } = await sb.from('orders').update({ status: 'concluido' }).eq('id', id);
    if (error) {
        showToast('Erro ao finalizar pedido: ' + error.message, 'error');
        return;
    }
    // Atualiza o pedido na memória
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx !== -1) pedidos[idx].status = 'concluido';
    atualizarMétricasDashboard();
    showToast('Pedido finalizado com sucesso!', 'success');
};

// --- Cancelar Pedido ---
window.cancelarPedido = (id) => {
    document.getElementById('cancelOrderId').value = id;
    
    // popular select
    const select = document.getElementById('selectCancelReason');
    select.innerHTML = '<option value="">Selecione um motivo...</option>' + 
        cancellationReasons.map(r => `<option value="${r}">${r}</option>`).join('');

    abrirModal('modalCancelarPedido');
};

document.getElementById('btnConfirmarCancelamento').onclick = async () => {
    const id = document.getElementById('cancelOrderId').value;
    const reason = document.getElementById('selectCancelReason').value;

    if (!reason) {
        showToast('Por favor, selecione um motivo para o cancelamento.', 'error');
        return;
    }

    const btn = document.getElementById('btnConfirmarCancelamento');
    btn.disabled = true;
    btn.innerText = 'Cancelando...';

    const { error } = await sb.from('orders').update({ status: 'cancelado', cancellation_reason: reason }).eq('id', id);
    if (error) {
        showToast('Erro ao cancelar pedido: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerText = 'Confirmar Cancelamento';
        return;
    }

    // Atualiza o pedido na memória
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx !== -1) {
        pedidos[idx].status = 'cancelado';
        pedidos[idx].cancellation_reason = reason;
    }
    atualizarMétricasDashboard();
    showToast('Pedido cancelado com sucesso!', 'success');
    fecharModal('modalCancelarPedido');
    
    btn.disabled = false;
    btn.innerText = 'Confirmar Cancelamento';
};

// =================== CONFIGURAÇÕES ===================
















































































































































































































































































































































































































































































































































































































































































































































































































































































































































// --- Gestão de Atendentes ---
let listaAtendentesLocal = [];
























function renderAtendentesLista() {
    const tbody = document.getElementById('atendentesListaBody');
    if (!tbody) return;

    if (listaAtendentesLocal.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum atendente cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = listaAtendentesLocal.map(a => `
        <tr>
            <td><strong>${a.nome}</strong></td>
            <td><code>${a.cpf}</code></td>
            <td style="font-size:0.8rem; color:var(--text-muted);">${new Date(a.created_at).toLocaleDateString()}</td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button class="btn-primary btn-sm" onclick="abrirModalAtendente('${a.id}')" title="Editar">✏️</button>
                    <button class="btn-cancel btn-sm" onclick="excluirAtendente('${a.id}', '${a.nome}')" title="Excluir">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.abrirModalAtendente = (id = null) => {
    const modal = document.getElementById('modalAtendente');
    const title = document.getElementById('atendenteModalTitle');
    const inputId = document.getElementById('atendenteId');
    const inputNome = document.getElementById('atendenteNome');
    const inputCpf = document.getElementById('atendenteCpf');
    const inputSenha = document.getElementById('atendenteSenha');
    const dicaSenha = document.getElementById('atendenteSenhaDica');

    inputId.value = id || '';
    inputNome.value = '';
    inputCpf.value = '';
    inputSenha.value = '';
    
    if (id) {
        title.textContent = 'Editar Atendente';
        const a = listaAtendentesLocal.find(x => x.id === id);
        if (a) {
            inputNome.value = a.nome;
            inputCpf.value = a.cpf;
        }
        dicaSenha.textContent = 'Deixe em branco para manter a senha atual.';
    } else {
        title.textContent = 'Novo Atendente';
        dicaSenha.textContent = 'Senha obrigatória para novos cadastros.';
    }

    abrirModal('modalAtendente');
};

document.getElementById('btnSalvarAtendente').onclick = async () => {
    const id = document.getElementById('atendenteId').value;
    const nome = document.getElementById('atendenteNome').value.trim();
    const cpf = document.getElementById('atendenteCpf').value.trim().replace(/\D/g, '');
    const senhaRaw = document.getElementById('atendenteSenha').value;

    if (!nome || !cpf) {
        showToast('Nome e CPF são obrigatórios', 'warning');
        return;
    }
    if (cpf.length !== 11) {
        showToast('CPF deve ter 11 dígitos', 'warning');
        return;
    }
    if (!id && !senhaRaw) {
        showToast('A senha é obrigatória para novos cadastros', 'warning');
        return;
    }

    const btn = document.getElementById('btnSalvarAtendente');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const payload = { 
            nome, 
            cpf, 
            empresa_id: getTenantId(),
            senha_hash: true 
        };
        
        if (senhaRaw) {
            payload.senha = await hashSenha(senhaRaw);
        }

        let res;
        if (id) {
            res = await sb.from('atendentes').update(payload).eq('id', id);
        } else {
            res = await sb.from('atendentes').insert(payload);
        }

        if (res.error) {
            if (res.error.message.includes('unique')) {
                showToast('Este CPF já está cadastrado nesta empresa', 'error');
            } else {
                showToast('Erro ao salvar: ' + res.error.message, 'error');
            }
        } else {
            showToast('Atendente salvo! Próximo...', 'success');
            
            // Limpa tudo para o próximo cadastro
            document.getElementById('atendenteId').value = ''; 
            document.getElementById('atendenteModalTitle').textContent = 'Novo Atendente';
            document.getElementById('atendenteNome').value = '';
            document.getElementById('atendenteCpf').value = '';
            document.getElementById('atendenteSenha').value = '';
            
            document.getElementById('atendenteNome').focus();

            carregarAtendentesLista();
        }
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar';
    }
};

window.excluirAtendente = async (id, nome) => {
    if (!await customConfirm('Excluir Atendente', `Deseja realmente remover ${nome} da equipe?`)) return;
    
    const { error } = await sb.from('atendentes').delete().eq('id', id);
    if (error) {
        showToast('Erro ao excluir: ' + error.message, 'error');
    } else {
        showToast('Atendente removido!', 'success');
        carregarAtendentesLista();
    }
};



































// --- Custom Time Picker Logic ---
let activeTimeTarget = null;
let currentHour = 18;
let currentMin = 0;

window.openTimePicker = (targetId, title) => {
    activeTimeTarget = document.getElementById(targetId);
    document.getElementById('timePickerTitle').textContent = title;
    
    const val = activeTimeTarget.value || '18:00';
    const [h, m] = val.split(':').map(Number);
    currentHour = h;
    currentMin = m;
    
    updateTimeDisplay();
    document.getElementById('modalTimePicker').classList.add('active');
};

window.adjustTime = (type, amount) => {
    if (type === 'hour') {
        currentHour = (currentHour + amount + 24) % 24;
    } else {
        currentMin = (currentMin + amount + 60) % 60;
    }
    updateTimeDisplay();
};

function updateTimeDisplay() {
    document.getElementById('displayHour').value = currentHour.toString().padStart(2, '0');
    document.getElementById('displayMin').value = currentMin.toString().padStart(2, '0');
}

// Lógica para digitação manual no picker
document.getElementById('displayHour').oninput = function() {
    let val = parseInt(this.value);
    if (!isNaN(val)) {
        if (val > 23) val = 23;
        if (val < 0) val = 0;
        currentHour = val;
    }
};
document.getElementById('displayHour').onblur = updateTimeDisplay;

document.getElementById('displayMin').oninput = function() {
    let val = parseInt(this.value);
    if (!isNaN(val)) {
        if (val > 59) val = 59;
        if (val < 0) val = 0;
        currentMin = val;
    }
};
document.getElementById('displayMin').onblur = updateTimeDisplay;

window.closeTimePicker = () => {
    document.getElementById('modalTimePicker').classList.remove('active');
};

window.confirmTimePicker = () => {
    const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
    activeTimeTarget.value = timeStr;
    
    // Dispara evento de mudança se necessário
    activeTimeTarget.dispatchEvent(new Event('change'));
    
    closeTimePicker();
};

// Vincula os inputs ao novo picker
document.addEventListener('DOMContentLoaded', () => {
    const openInp = document.getElementById('confOpeningTime');
    const closeInp = document.getElementById('confClosingTime');
    
    if (openInp) {
        openInp.readOnly = true;
        openInp.onclick = () => openTimePicker('confOpeningTime', '🕒 Horário de Abertura');
    }
    if (closeInp) {
        closeInp.readOnly = true;
        closeInp.onclick = () => openTimePicker('confClosingTime', '🕒 Horário de Fechamento');
    }

    initMobileMenu();
});

function initMobileMenu() {
    const btnMobileMenu = document.getElementById('btnMobileMenu');
    const btnCloseMobile = document.getElementById('btnCloseMobile');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const navItems = document.querySelectorAll('.nav-item');

    if (btnMobileMenu) {
        btnMobileMenu.onclick = () => {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
        };
    }

    if (btnCloseMobile) {
        btnCloseMobile.onclick = () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };
    }

    if (sidebarOverlay) {
        sidebarOverlay.onclick = () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };
    }

    // Navegação via sidebar
    navItems.forEach(item => {
        item.onclick = () => {
            const tabId = item.getAttribute('data-tab');
            const correspondingTabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
            if (correspondingTabBtn) {
                switchTab(tabId, correspondingTabBtn);
            }
            
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };
    });

    // Logout Mobile
    const btnLogoutMobile = document.getElementById('btnLogoutMobile');
    if (btnLogoutMobile) {
        btnLogoutMobile.onclick = () => {
            document.getElementById('btnLogout').click();
        };
    }
}

// --- Justificativas de Cancelamento ---























































































































































































































































// --- Perfis de Cardápio ---

async function obterCategoriasDisponiveis() {
    let cats = [];
    try {
        if (isModuloAtivo('loja_roupas')) {
            const { data, error } = await sb.from('loja_categorias')
                .select('id, nome')
                .eq('empresa_id', getTenantId())
                .order('nome');
            if (error) throw error;
            cats = (data || []).map(c => ({ id: c.id, name: c.nome }));
        } else {
            const { data, error } = await sb.from('categories')
                .select('id, name')
                .eq('empresa_id', getTenantId())
                .order('name');
            if (error) throw error;
            cats = data || [];
        }
    } catch (err) {
        console.error('[Perfil Cardapio] Erro ao carregar categorias:', err);
    }
    return cats;
}

// --- Perfis de Cardápio ---

async function carregarPerfisCardapio() {
    try {
        window.__categoriasList = await obterCategoriasDisponiveis();
        const { data, error } = await sb.from('perfis_cardapio')
            .select('*, perfil_cardapio_categorias(category_id)')
            .eq('empresa_id', getTenantId())
            .order('nome');
        if (error) throw error;
        listaPerfisCardapio = data || [];
        renderPerfisCardapio();
        atualizarSelectPerfis();
    } catch (err) {
        console.error('Erro ao carregar perfis:', err);
    }
}

function renderPerfisCardapio() {
    const container = document.getElementById('perfisCardapioLista');
    if (!container) return;

    if (listaPerfisCardapio.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum perfil cadastrado. Crie um perfil para definir cardápios personalizados.</p>';
        return;
    }

    container.innerHTML = listaPerfisCardapio.map(p => {
        const cats = (p.perfil_cardapio_categorias || []).map(pc => {
            const cat = (window.__categoriasList || []).find(c => c.id === pc.category_id);
            return cat ? cat.name : '?';
        });
        return `
            <div class="config-card" style="margin-bottom: 1rem; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${p.nome}</strong>
                        ${p.descricao ? `<span style="color:var(--text-muted); margin-left:10px; font-size:0.85rem;">${p.descricao}</span>` : ''}
                        <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
                            ${cats.length > 0 ? cats.map(c => `<span style="background:rgba(229,178,93,0.1); color:var(--primary); padding:2px 10px; border-radius:50px; font-size:0.75rem;">${c}</span>`).join('') : '<span style="color:var(--text-muted); font-size:0.8rem;">Nenhuma categoria selecionada</span>'}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-primary btn-sm" onclick="abrirModalPerfilCardapio('${p.id}')" title="Editar">✏️</button>
                        <button class="btn-cancel btn-sm" onclick="excluirPerfilCardapio('${p.id}', '${p.nome}')" title="Excluir">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.abrirModalPerfilCardapio = async (id = null) => {
    const inputId = document.getElementById('perfilCardapioId');
    const inputNome = document.getElementById('pcNome');
    const inputDesc = document.getElementById('pcDescricao');
    const title = document.getElementById('perfilCardapioModalTitle');
    const checkboxContainer = document.getElementById('pcCategoriasCheckboxes');

    inputId.value = id || '';
    inputNome.value = '';
    inputDesc.value = '';

    // Garantir que as categorias estejam carregadas
    const cats = await obterCategoriasDisponiveis();
    window.__categoriasList = cats;

    let selectedCats = [];
    if (id) {
        title.textContent = 'Editar Perfil de Cardápio';
        const perfil = listaPerfisCardapio.find(p => p.id === id);
        if (perfil) {
            inputNome.value = perfil.nome;
            inputDesc.value = perfil.descricao || '';
            selectedCats = (perfil.perfil_cardapio_categorias || []).map(pc => pc.category_id);
        }
    } else {
        title.textContent = 'Novo Perfil de Cardápio';
    }

    checkboxContainer.innerHTML = (cats || []).map(c => `
        <label style="display:flex; align-items:center; gap:8px; padding:8px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; cursor:pointer; font-size:0.9rem;">
            <input type="checkbox" value="${c.id}" ${selectedCats.includes(c.id) ? 'checked' : ''}>
            ${c.name}
        </label>
    `).join('');

    abrirModal('modalPerfilCardapio');
};

document.getElementById('btnSalvarPerfilCardapio').onclick = async () => {
    const id = document.getElementById('perfilCardapioId').value;
    const nome = document.getElementById('pcNome').value.trim();
    const descricao = document.getElementById('pcDescricao').value.trim();

    if (!nome) { showToast('Nome do perfil é obrigatório', 'warning'); return; }

    const btn = document.getElementById('btnSalvarPerfilCardapio');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const payload = { nome, descricao, empresa_id: getTenantId() };
        let perfilId = id;

        if (id) {
            const { error } = await sb.from('perfis_cardapio').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { data, error } = await sb.from('perfis_cardapio').insert(payload).select().single();
            if (error) throw error;
            perfilId = data.id;
        }

        // Sync categorias: delete all then insert selected
        await sb.from('perfil_cardapio_categorias').delete().eq('perfil_id', perfilId);

        const checkboxes = document.querySelectorAll('#pcCategoriasCheckboxes input[type=checkbox]:checked');
        if (checkboxes.length > 0) {
            const catPayload = Array.from(checkboxes).map(cb => ({
                perfil_id: perfilId,
                category_id: cb.value
            }));
            const { error: catError } = await sb.from('perfil_cardapio_categorias').insert(catPayload);
            if (catError) throw catError;
        }

        showToast('Perfil salvo com sucesso!', 'success');
        fecharModal('modalPerfilCardapio');
        carregarPerfisCardapio();
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar';
    }
};

window.excluirPerfilCardapio = async (id, nome) => {
    if (!await customConfirm('Excluir Perfil', `Deseja remover o perfil "${nome}"? Clientes vinculados ficarão sem perfil.`)) return;
    const { error } = await sb.from('perfis_cardapio').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); }
    else { showToast('Perfil removido!', 'success'); carregarPerfisCardapio(); }
};

function atualizarSelectPerfis() {
    const select = document.getElementById('cpPerfil');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Cardápio completo (sem restrição)</option>';
    listaPerfisCardapio.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
    if (currentVal) select.value = currentVal;
}

// --- Clientes Premium ---

async function carregarClientesPremium() {
    try {
        const { data, error } = await sb.from('clientes_premium')
            .select('*, perfis_cardapio(nome)')
            .eq('empresa_id', getTenantId())
            .order('nome');
        if (error) throw error;
        listaClientesPremium = data || [];

        // Calcular gastos do mês para cada cliente
        const mesAtual = new Date();
        const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString();
        
        for (const cliente of listaClientesPremium) {
            const { data: orders } = await sb.from('orders')
                .select('total')
                .eq('cliente_premium_id', cliente.id)
                .gte('created_at', inicioMes)
                .not('status', 'eq', 'cancelado');
            cliente._gastoMes = (orders || []).reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
        }

        renderClientesPremium();
    } catch (err) {
        console.error('Erro ao carregar clientes premium:', err);
    }
}

function renderClientesPremium() {
    const tbody = document.getElementById('clientesPremiumBody');
    if (!tbody) return;

    if (listaClientesPremium.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum cliente premium cadastrado.</td></tr>';
        return;
    }

    const tipoLabels = { premium: '⭐ Premium', funcionario: '👤 Funcionário', vip_diretoria: '👑 VIP Diretoria' };

    tbody.innerHTML = listaClientesPremium.map(c => {
        const teto = parseFloat(c.teto_mensal) || 0;
        const gasto = c._gastoMes || 0;
        const pct = teto > 0 ? Math.min(100, (gasto / teto) * 100) : 0;
        const barColor = pct > 90 ? '#FF4757' : pct > 70 ? '#FFA502' : '#00B894';

        return `
            <tr>
                <td><strong>${c.nome}</strong></td>
                <td><code>${c.cpf}</code></td>
                <td>${tipoLabels[c.tipo] || c.tipo}</td>
                <td>${c.perfis_cardapio?.nome || '<span style="color:var(--text-muted)">Completo</span>'}</td>
                <td>${teto > 0 ? 'R$ ' + teto.toLocaleString('pt-BR', {minimumFractionDigits:2}) : '∞'}</td>
                <td>
                    <div style="font-size:0.85rem; font-weight:700;">R$ ${gasto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                    ${teto > 0 ? `<div style="background:rgba(255,255,255,0.1); border-radius:50px; height:6px; margin-top:4px; overflow:hidden;"><div style="width:${pct}%; height:100%; background:${barColor}; border-radius:50px;"></div></div>` : ''}
                </td>
                <td style="text-align:center;">
                    <div style="display:flex; gap:8px; justify-content:center;">
                        <button class="btn-primary btn-sm" onclick="abrirModalClientePremium('${c.id}')" title="Editar">✏️</button>
                        <button class="btn-cancel btn-sm" onclick="excluirClientePremium('${c.id}', '${c.nome}')" title="Excluir">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.abrirModalClientePremium = async (id = null) => {
    const title = document.getElementById('clientePremiumModalTitle');
    const inputId = document.getElementById('clientePremiumId');
    const inputNome = document.getElementById('cpNome');
    const inputCpf = document.getElementById('cpCpf');
    const inputTelefone = document.getElementById('cpTelefone');
    const inputPin = document.getElementById('cpPin');
    const inputTipo = document.getElementById('cpTipo');
    const inputPerfil = document.getElementById('cpPerfil');
    const inputTeto = document.getElementById('cpTeto');
    const dicaPin = document.getElementById('cpPinDica');

    // Garantir que os perfis estejam carregados
    await carregarPerfisCardapio();

    inputId.value = id || '';
    inputNome.value = '';
    inputCpf.value = '';
    inputTelefone.value = '';
    inputPin.value = '';
    inputTipo.value = 'premium';
    inputPerfil.value = '';
    inputTeto.value = '';

    if (id) {
        title.textContent = 'Editar Cliente Premium';
        const c = listaClientesPremium.find(x => x.id === id);
        if (c) {
            inputNome.value = c.nome;
            inputCpf.value = c.cpf;
            inputTelefone.value = c.telefone || '';
            inputTipo.value = c.tipo || 'premium';
            inputPerfil.value = c.perfil_cardapio_id || '';
            inputTeto.value = c.teto_mensal || '';
        }
        dicaPin.textContent = 'Deixe em branco para manter o PIN atual.';
    } else {
        title.textContent = 'Novo Cliente Premium';
        dicaPin.textContent = 'PIN obrigatório para novos cadastros.';
    }

    abrirModal('modalClientePremium');
};

document.getElementById('btnSalvarClientePremium').onclick = async () => {
    const id = document.getElementById('clientePremiumId').value;
    const nome = document.getElementById('cpNome').value.trim();
    const cpf = document.getElementById('cpCpf').value.trim().replace(/\D/g, '');
    const telefone = document.getElementById('cpTelefone').value.trim();
    const pinRaw = document.getElementById('cpPin').value;
    const tipo = document.getElementById('cpTipo').value;
    const perfilId = document.getElementById('cpPerfil').value || null;
    const teto = parseFloat(document.getElementById('cpTeto').value) || 0;

    if (!nome || !cpf) { showToast('Nome e CPF são obrigatórios', 'warning'); return; }
    if (cpf.length !== 11) { showToast('CPF deve ter 11 dígitos', 'warning'); return; }
    if (!id && !pinRaw) { showToast('O PIN é obrigatório para novos cadastros', 'warning'); return; }
    if (pinRaw && (pinRaw.length < 4 || pinRaw.length > 6)) { showToast('O PIN deve ter entre 4 e 6 dígitos', 'warning'); return; }

    const btn = document.getElementById('btnSalvarClientePremium');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const payload = {
            nome, cpf, telefone, tipo,
            perfil_cardapio_id: perfilId,
            teto_mensal: teto,
            empresa_id: getTenantId(),
            pin_hash: true
        };

        if (pinRaw) {
            payload.pin = await hashSenha(pinRaw);
        }

        let res;
        if (id) {
            res = await sb.from('clientes_premium').update(payload).eq('id', id);
        } else {
            res = await sb.from('clientes_premium').insert(payload);
        }

        if (res.error) {
            if (res.error.message.includes('unique') || res.error.message.includes('duplicate')) {
                showToast('Este CPF já está cadastrado como cliente premium', 'error');
            } else {
                showToast('Erro ao salvar: ' + res.error.message, 'error');
            }
        } else {
            showToast('Cliente premium salvo!', 'success');
            fecharModal('modalClientePremium');
            carregarClientesPremium();
        }
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar';
    }
};

window.excluirClientePremium = async (id, nome) => {
    if (!await customConfirm('Excluir Cliente Premium', `Deseja remover ${nome}? As comandas associadas também serão afetadas.`)) return;
    const { error } = await sb.from('clientes_premium').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); }
    else { showToast('Cliente removido!', 'success'); carregarClientesPremium(); }
};

function initModuloClientesPremium() {
    if (!isModuloAtivo('clientes_premium')) return;
    carregarPerfisCardapio();
    carregarClientesPremium();
}

