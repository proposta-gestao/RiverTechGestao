/**
         * RiverTech - Admin Panel
         */
const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;

// --- Configurações Cloudinary ---
const CLOUDINARY_CLOUD_NAME = 'dzt571tv8';
const CLOUDINARY_UPLOAD_PRESET = 'rivertechimagens';

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
checkSession();

sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        document.getElementById('adminLayout').classList.remove('visible');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginSenha').value = '';
        
        // Limpar cache do Tenant e estado local para evitar vazamento entre logins na mesma aba
        if (window.TENANT) {
            window.TENANT.pronto = false;
            window.TENANT.empresa_id = null;
            window.TENANT.slug = null;
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
}

// --- Tabs ---
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');

    // Lazy Load do módulo de Agenda
    if (tabId === 'agenda' && !window.__AGENDA_INICIADO) {
        // Habilitar CSS
        const cssEl = document.getElementById('agenda-css');
        if (cssEl) cssEl.disabled = false;
        // Carregar JS
        const script = document.createElement('script');
        script.src = '/admin-agenda.js?v=' + Date.now();
        script.onerror = () => showToast('Erro ao carregar módulo de agenda.', 'error');
        document.body.appendChild(script);
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
        }
    };
});

function atualizarGraficoMetricas(filtrados = null) {
    if (!filtrados) filtrados = [...pedidos];
    
    const agrupamento = document.getElementById('selectAgrupamentoMetricas')?.value || 'dia';
    const canvas = document.getElementById('chartMetricas');
    if (!canvas) return;

    let dadosAgrupados = {};
    let labels = [];
    let valores = [];

    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    if (agrupamento === 'dia') {
        filtrados.forEach(p => {
            const data = new Date(p.created_at).toLocaleDateString('pt-BR');
            dadosAgrupados[data] = (dadosAgrupados[data] || 0) + parseFloat(p.total);
        });
        labels = Object.keys(dadosAgrupados).sort((a, b) => {
            const dateA = new Date(a.split('/').reverse().join('-'));
            const dateB = new Date(b.split('/').reverse().join('-'));
            return dateA - dateB;
        });
    } else if (agrupamento === 'semana') {
        diasSemana.forEach(d => dadosAgrupados[d] = 0);
        filtrados.forEach(p => {
            const dia = diasSemana[new Date(p.created_at).getDay()];
            dadosAgrupados[dia] += parseFloat(p.total);
        });
        labels = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    } else if (agrupamento === 'mes') {
        filtrados.forEach(p => {
            const data = new Date(p.created_at);
            const mes = data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            dadosAgrupados[mes] = (dadosAgrupados[mes] || 0) + parseFloat(p.total);
        });
        labels = Object.keys(dadosAgrupados).sort((a, b) => {
            const [mesA, anoA] = a.split(' de ');
            const [mesB, anoB] = b.split(' de ');
            return new Date(anoA, 0) - new Date(anoB, 0); // Ordenação simplificada
        });
    } else if (agrupamento === 'hora') {
        for (let i = 0; i < 24; i++) dadosAgrupados[i] = 0;
        filtrados.forEach(p => {
            const hora = new Date(p.created_at).getHours();
            dadosAgrupados[hora] += parseFloat(p.total);
        });
        labels = Object.keys(dadosAgrupados).map(h => h + 'h');
    }

    labels.forEach(l => {
        const key = agrupamento === 'hora' ? l.replace('h', '') : l;
        valores.push(dadosAgrupados[key] || 0);
    });

    calcularInsights(filtrados);

    if (chartMetricas) chartMetricas.destroy();

    const ctx = canvas.getContext('2d');
    chartMetricas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento (R$)',
                data: valores,
                borderColor: '#e5b25d',
                backgroundColor: 'rgba(229, 178, 93, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#e5b25d'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Faturamento: R$ ${formatNumber(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') }
                }
            }
        }
    });
}

function calcularInsights(filtrados) {
    if (!filtrados) filtrados = getPedidosFiltrados();

    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    let faturamentoPorDiaSemana = {};
    let faturamentoPorHora = {};
    let faturamentoPorData = {};
    let faturamentoPorCategoria = {};
    let qtdPorProduto = {};
    
    let totalCancelados = 0;
    let totalFaturado = 0;
    
    diasSemana.forEach(d => faturamentoPorDiaSemana[d] = 0);
    for (let i = 0; i < 24; i++) faturamentoPorHora[i] = 0;

    filtrados.forEach(p => {
        const dObj = new Date(p.created_at);
        if (isNaN(dObj.getTime())) return;

        const diaSem = diasSemana[dObj.getDay()];
        const hora = dObj.getHours();
        const dataStr = dObj.toLocaleDateString('pt-BR');
        const valor = parseFloat(p.total || 0);

        if (p.status === 'cancelado') totalCancelados++;
        totalFaturado += valor;

        faturamentoPorDiaSemana[diaSem] += valor;
        faturamentoPorHora[hora] += valor;
        faturamentoPorData[dataStr] = (faturamentoPorData[dataStr] || 0) + valor;

        if (p.order_items) {
            p.order_items.forEach(item => {
                const prodNome = item.product_name || 'Produto sem nome';
                const qtd = parseInt(item.quantity) || 0;
                const preco = parseFloat(item.unit_price || item.price || 0);

                qtdPorProduto[prodNome] = (qtdPorProduto[prodNome] || 0) + qtd;
                
                let catNome = 'Geral';
                const prod = produtos.find(pr => pr.id === item.product_id);
                if (prod) {
                    const cat = categorias.find(c => c.id === prod.category_id);
                    if (cat) catNome = cat.name;
                }
                
                faturamentoPorCategoria[catNome] = (faturamentoPorCategoria[catNome] || 0) + (preco * qtd);
            });
        }
    });

    // Cálculos de Tempo
    let melhorDiaSem = { nome: '--', valor: -1 };
    let piorDiaSem = { nome: '--', valor: Infinity };
    let melhorHora = { hora: '--', valor: -1 };

    Object.entries(faturamentoPorDiaSemana).forEach(([dia, valor]) => {
        if (valor > melhorDiaSem.valor) melhorDiaSem = { nome: dia, valor: valor };
        if (valor < piorDiaSem.valor && valor > 0) piorDiaSem = { nome: dia, valor: valor };
    });

    Object.entries(faturamentoPorHora).forEach(([hora, valor]) => {
        if (valor > melhorHora.valor) melhorHora = { hora: hora, valor: valor };
    });

    // Top 3 Dias do Mês
    const top3Dias = Object.entries(faturamentoPorData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    // Performance de Vendas
    const totalPedidos = filtrados.length;
    const ticketMedio = totalPedidos > 0 ? (totalFaturado / totalPedidos) : 0;
    const uniqueDaysCount = Object.keys(faturamentoPorData).length || 1;
    const mediaPedidosDia = (totalPedidos / uniqueDaysCount);
    const taxaCancelamento = totalPedidos > 0 ? ((totalCancelados / totalPedidos) * 100) : 0;

    // Top Produto e Categoria
    const topProduto = Object.entries(qtdPorProduto).sort((a, b) => b[1] - a[1])[0] || ['--', 0];
    const topCategoria = Object.entries(faturamentoPorCategoria).sort((a, b) => b[1] - a[1])[0] || ['--', 0];

    // Atualização do DOM
    // Tempo
    document.getElementById('insightMelhorHora').innerText = melhorHora.hora !== '--' ? melhorHora.hora + 'h' : '--';
    document.getElementById('txtInsightHora').innerText = melhorHora.hora !== '--' 
        ? `Pico de faturamento às ${melhorHora.hora}h (R$ ${formatNumber(melhorHora.valor)})`
        : 'Aguardando dados...';

    document.getElementById('insightMelhorDia').innerText = melhorDiaSem.nome;
    document.getElementById('txtInsightMelhor').innerText = melhorDiaSem.valor > 0 
        ? `Melhor dia: ${melhorDiaSem.nome.toLowerCase()} (R$ ${formatNumber(melhorDiaSem.valor)})`
        : 'Aguardando dados...';

    document.getElementById('insightPiorDia').innerText = piorDiaSem.nome !== '--' ? piorDiaSem.nome : '--';
    document.getElementById('txtInsightPior').innerText = (piorDiaSem.valor > 0 && piorDiaSem.valor !== Infinity)
        ? `Menor performance: ${piorDiaSem.nome.toLowerCase()} (R$ ${formatNumber(piorDiaSem.valor)})`
        : 'Aguardando dados...';

    // Vendas
    document.getElementById('insightTicketMedio').innerText = formatCurrency(ticketMedio);
    document.getElementById('insightMediaPedidos').innerText = formatNumber(mediaPedidosDia);
    document.getElementById('insightTaxaCancelamento').innerText = formatNumber(taxaCancelamento) + '%';

    // Destaques
    document.getElementById('insightProdutoTop').innerText = topProduto[0];
    document.getElementById('txtProdutoTop').innerText = topProduto[1] > 0 ? `Vendido ${topProduto[1]} vezes` : 'Nenhum vendido';
    document.getElementById('insightCategoriaTop').innerText = topCategoria[0];
    document.getElementById('txtCategoriaTop').innerText = topCategoria[1] > 0 ? `Faturou R$ ${formatNumber(topCategoria[1])}` : 'Sem faturamento';

    const topDiasList = top3Dias.length > 0 
        ? top3Dias.map((d, i) => `${i + 1}. ${d[0]} - R$ ${formatNumber(d[1])}`).join('<br>') 
        : 'Nenhum dado disponível';
    document.getElementById('insightTopDias').innerHTML = topDiasList;

    // Geração de Insight Inteligente
    gerarInsightInteligente(melhorHora, melhorDiaSem, piorDiaSem, ticketMedio);
}

function gerarInsightInteligente(melhorHora, melhorDiaSem, piorDiaSem, ticketMedio) {
    const el = document.getElementById('txtInsightInteligente');
    if (!el) return;

    let insight = "";
    if (melhorHora.hora >= 19 && melhorHora.hora <= 22) {
        insight = "🔥 Seu pico de vendas acontece no horário nobre (19h - 22h). Reforce o atendimento!";
    } else if (melhorHora.hora !== '--') {
        insight = `📈 Identificamos que às ${melhorHora.hora}h é seu momento de maior venda.`;
    }

    if (melhorDiaSem.nome === 'Sexta-feira' || melhorDiaSem.nome === 'Sábado' || melhorDiaSem.nome === 'Domingo') {
        insight += " | Finais de semana representam seu maior faturamento.";
    }

    if (piorDiaSem.nome === 'Segunda-feira') {
        insight += " | Você tem baixa performance às segundas-feiras. Que tal uma promoção?";
    }

    if (ticketMedio > 0) {
        insight += ` | Seu ticket médio atual está em R$ ${formatNumber(ticketMedio)}.`;
    }

    el.innerText = insight || "Análise concluída: Seu negócio apresenta padrões saudáveis de venda.";
}

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
    toggleElement(document.getElementById('nav-produtos'), mQualquerProduto, 'flex');

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
    toggleElement(document.getElementById('nav-dashboard'), mQualquerDashboard, 'flex');

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
    toggleElement(document.getElementById('nav-configuracoes'), mQualquerConfig, 'flex');

    // 5. CUPONS
    const mCupons = isModuloAtivo('cupons');
    toggleElement(document.getElementById('nav-cupons'), mCupons, 'flex');

    // 6. AGENDAMENTO
    const mAgendamento = isModuloAtivo('agendamento_ativo');
    toggleElement(document.getElementById('nav-agenda'), mAgendamento, 'flex');
    if (mAgendamento) {
        const cssEl = document.getElementById('agenda-css');
        if (cssEl) cssEl.disabled = false;
    }

    // 7. EXTRAS
    const mCardapio = isModuloAtivo('cardapio');
    const btnCardapio = document.querySelector('.btn-link-cardapio');
    if (btnCardapio) toggleElement(btnCardapio, mCardapio);

    // --- Redirecionamento Automático (Segurança e UX) ---
    
    // 1. Redirecionamento de Abas Principais
    const abaAtiva = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (abaAtiva === 'dashboard' && !mQualquerDashboard) document.getElementById('nav-produtos')?.click();
    else if (abaAtiva === 'produtos' && !mQualquerProduto) document.getElementById('nav-dashboard')?.click();
    else if (abaAtiva === 'cupons' && !mCupons) document.getElementById('nav-produtos')?.click();
    else if (abaAtiva === 'configuracoes' && !mQualquerConfig) document.getElementById('nav-produtos')?.click();

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
    const { data, error } = await sb
        .from('orders')
        .select('*, order_items(*)')
        .eq('empresa_id', getTenantId()) // ← Multi-Tenant
        .order('created_at', { ascending: false });
    if (error) { showToast('Erro ao carregar pedidos', 'error'); return; }
    pedidos = data || [];

    // Inicializa o modo correto (Hoje Op por padrão)
    setModoDashboard(currentModoDashboard);
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

function getOperationalPeriod(date, opening, closing) {
    const start = new Date(date);
    const [hOpen, mOpen] = opening.split(':').map(Number);
    start.setHours(hOpen, mOpen, 0, 0);

    const end = new Date(start);
    const [hClose, mClose] = closing.split(':').map(Number);
    
    if (hClose < hOpen) {
        // Atravessa a madrugada
        end.setDate(end.getDate() + 1);
    }
    end.setHours(hClose, mClose, 0, 0);

    // Se a hora atual for ANTES da abertura, talvez estejamos no "final" do dia operacional anterior
    // Ex: Abertura 18:00, agora são 01:00. O dia operacional começou ontem às 18:00.
    if (date < start && hClose < hOpen) {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
    }

    return { start, end };
}

function getPedidosFiltrados() {
    return pedidos.filter(p => {
        const criado = new Date(p.created_at);

        // Se estiver em modo operacional, a tabela também segue o período operacional
        if (currentModoDashboard === 'hoje-op' || currentModoDashboard === 'ontem-op') {
            const referenceDate = new Date();
            if (currentModoDashboard === 'ontem-op') referenceDate.setDate(referenceDate.getDate() - 1);
            const period = getOperationalPeriod(referenceDate, openingTime, closingTime);
            if (criado < period.start || criado > period.end) return false;
        } else {
            // Modo Geral: Usa os filtros de data manuais
            if (filtrosPedidos.dataInicio) {
                const inicio = new Date(filtrosPedidos.dataInicio + 'T00:00:00');
                if (criado < inicio) return false;
            }
            if (filtrosPedidos.dataFim) {
                const fim = new Date(filtrosPedidos.dataFim + 'T23:59:59');
                if (criado > fim) return false;
            }
        }
        if (filtrosPedidos.cliente) {
            const query = filtrosPedidos.cliente.toLowerCase();
            const nome = (p.customer_name || '').toLowerCase();
            const celular = (p.customer_phone || '').replace(/\D/g, '');
            const queryLimpa = query.replace(/\D/g, '');

            const matchNome = nome.includes(query);
            const matchCelular = queryLimpa && celular.includes(queryLimpa);

            if (!matchNome && !matchCelular) return false;
        }
        if (filtrosPedidos.atendente) {
            if (p.atendente_nome !== filtrosPedidos.atendente) return false;
        }
        if (filtrosPedidos.valorMin !== '' && filtrosPedidos.valorMin !== null) {
            if (parseFloat(p.total) < parseFloat(filtrosPedidos.valorMin)) return false;
        }
        if (filtrosPedidos.valorMax !== '' && filtrosPedidos.valorMax !== null) {
            if (parseFloat(p.total) > parseFloat(filtrosPedidos.valorMax)) return false;
        }
        if (filtrosPedidos.status) {
            if (p.status !== filtrosPedidos.status) return false;
        }
        return true;
    });
}

function atualizarMétricasDashboard() {
    const filtradosParaStats = getPedidosFiltrados();

    let totalFaturado = 0;
    let totalItens = 0;

    filtradosParaStats.forEach(p => {
        totalFaturado += parseFloat(p.total || 0);
        if (p.order_items) {
            p.order_items.forEach(item => {
                totalItens += parseInt(item.quantity || 0);
            });
        }
    });

    const avgTicket = filtradosParaStats.length > 0 ? (totalFaturado / filtradosParaStats.length) : 0;

    document.getElementById('dashTotalValue').innerText = "R$ " + formatNumber(totalFaturado);
    document.getElementById('dashTotalOrders').innerText = filtradosParaStats.length;
    document.getElementById('dashTotalItems').innerText = totalItens;
    document.getElementById('dashAvgTicket').innerText = "R$ " + formatNumber(avgTicket);

    renderPedidosFiltrados(filtradosParaStats);
    atualizarGraficoMetricas();
}

function renderPedidosFiltrados(filtrados = null) {
    const tbody = document.getElementById('pedidosBody');
    const contador = document.getElementById('filtroContador');
    if (!tbody) return;

    if (!filtrados) filtrados = getPedidosFiltrados();

    const total = filtrados.length;
    if (contador) {
        contador.textContent = total === pedidos.length
            ? `(${total} pedidos)`
            : `(${total} de ${pedidos.length} pedidos)`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum pedido encontrado com os filtros selecionados.</td></tr>';
        return;
    }


    tbody.innerHTML = filtrados.map(p => {
        const d = new Date(p.created_at);
        const dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const qtdItens = p.order_items ? p.order_items.reduce((acc, curr) => acc + curr.quantity, 0) : 0;
        const isPendente = p.status === 'pendente';
        const isPago = p.payment_status === 'pago';
        let badgeClass = 'badge-inactive';
        if (p.status === 'concluido') badgeClass = 'badge-active';
        if (p.status === 'cancelado') badgeClass = 'badge-danger';
        const statusLabel = p.status === 'concluido' ? 'Concluído' : p.status?.charAt(0).toUpperCase() + p.status?.slice(1);
        return `
                    <tr id="pedido-row-${p.id}">
                        <td>
                            <div style="font-weight: 700; font-size: 0.85rem;">${dataStr}</div>
                            <div style="color: var(--text-muted); font-size: 0.75rem;">${horaStr}</div>
                        </td>
                        <td><strong>${p.customer_name || 'Desconhecido'}</strong></td>
                        <td><span class="badge" style="background:rgba(255,255,255,0.05);color:#aaa;font-size:0.75rem;">${p.atendente_nome || '—'}</span></td>
                        <td><span class="badge ${badgeClass}" style="text-transform:capitalize;">${statusLabel}</span></td>
                        <td>${qtdItens} un.</td>
                        <td><strong>${formatCurrency(p.total)}</strong></td>
                        <td>
                            <div style="display:flex; gap: 5px; justify-content: flex-end;">
                                ${isPendente
                                    ? `<button class="btn-sm btn-finalizar" onclick="finalizarPedido('${p.id}')">✅ Finalizar</button>`
                                    : '<span style="font-size:0.8rem;color:var(--text-muted);">—</span>'
                                }
                                ${isPendente && !isPago
                                    ? `<button class="btn-sm" style="background:transparent; color:#ff4757; border: 1px solid #ff4757;" onclick="cancelarPedido('${p.id}')">❌ Cancelar</button>`
                                    : ''
                                }
                            </div>
                        </td>
                    </tr>
                `;
    }).join('');
}

let adminRealtimeChannel = null;

function setupAdminRealtime() {
    if (adminRealtimeChannel) return;

    adminRealtimeChannel = sb.channel('admin-orders-realtime')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'orders' 
        }, payload => {
            if (payload.eventType === 'INSERT') {
                pedidos.unshift(payload.new);
                atualizarMétricasDashboard();
            } else if (payload.eventType === 'UPDATE') {
                const idx = pedidos.findIndex(p => p.id === payload.new.id);
                if (idx !== -1) {
                    pedidos[idx] = { ...pedidos[idx], ...payload.new };
                    atualizarMétricasDashboard();
                }
            } else if (payload.eventType === 'DELETE') {
                pedidos = pedidos.filter(p => p.id !== payload.old.id);
                atualizarMétricasDashboard();
            }
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
function renderProdutos() {
    const tbody = document.getElementById('produtosBody');
    if (!tbody) return;
    if (produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum produto encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = produtos.map((p, i) => {
        const isEsgotado = p.stock <= 0;
        const canDrag = !p.archived && p.active;
        const handleContent = canDrag ? '<span class="drag-handle" style="cursor:grab;">☰</span>' : '';
        const rowStyle = canDrag ? '' : 'cursor: default;';
        let stockColor = isEsgotado ? '#FF4757' : (p.stock <= (p.min_stock_alert || 0) ? '#FAAD14' : 'inherit');

        let rowClass = '';
        if (p.archived) {
            rowClass = 'row-archived';
        } else if (!p.active) {
            rowClass = 'row-inactive';
        }

        const toggleHTML = p.archived
            ? `<span class="badge" style="background:rgba(255,255,255,0.1); color:#aaa;">Arquivado</span>`
            : `
                        <label class="switch">
                            <input type="checkbox" ${p.active ? 'checked' : ''} onchange="toggleProdutoAtivo('${p.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    `;

        const actionButton = p.archived
            ? `<button class="btn-sm btn-unarchive" onclick="desarquivarProduto('${p.id}')">Desarquivar</button>`
            : `<button class="btn-sm btn-archive" onclick="arquivarProduto('${p.id}')">Arquivar</button>`;

        return `
                <tr class="${rowClass}" data-id="${p.id}" style="${rowStyle}">
                    <td style="color: var(--text-muted); text-align: center; font-size: 1.2rem;">${handleContent}</td>
                    <td><img src="${p.image_url || 'Logo.png'}" alt="Img" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                    <td onclick="editarProduto('${p.id}')" style="cursor:pointer;" title="Clique para editar">
                        <div class="product-name-container">
                            <strong class="clickable-row-name">${p.name}</strong>
                            ${p.promo_price > 0 ? '<div class="badge-promo-container"><span class="badge badge-promo">PROMO</span></div>' : ''}
                        </div>
                    </td>
                    <td>${p.categories?.name || '-'}</td>
                    <td onclick="editarProduto('${p.id}')" style="cursor:pointer;" title="Clique para editar">${formatCurrency(p.price)}</td>
                    <td class="col-estoque" onclick="editarProduto('${p.id}')" style="cursor:pointer; color:${stockColor}; font-weight: ${stockColor !== 'inherit' ? '700' : 'normal'}; ${isModuloAtivo('produtos_estoque') ? '' : 'display:none;'}" title="Clique para ajustar estoque">${p.stock}</td>
                    <td>${toggleHTML}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-sm btn-edit" onclick="editarProduto('${p.id}')">Editar</button>
                            ${actionButton}
                        </div>
                    </td>
                </tr>
            `}).join('');
}

window.toggleProdutoAtivo = async (id, isActive) => {
    const { error } = await sb.from('products').update({ active: isActive }).eq('id', id);
    if (error) {
        showToast('Erro ao atualizar status', 'error');
        // Revert visual change
        carregarProdutos();
    } else {
        showToast(isActive ? 'Produto ativado!' : 'Produto inativado!', 'success');
        carregarProdutos(); // Relocates product to correct group instantly
    }
};

function initSortableProdutos() {
    const el = document.getElementById('produtosBody');
    if (!el || el.sortable) return;
    
    el.sortable = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'dragging',
        chosenClass: 'dragging',
        onStart: () => el.classList.add('is-dragging'),
        onEnd: async (evt) => {
            el.classList.remove('is-dragging');
            if (evt.oldIndex === evt.newIndex) return;

            // Reordenar o array local 'produtos' baseado na nova ordem do DOM
            const newOrderIds = Array.from(el.querySelectorAll('tr')).map(tr => tr.dataset.id);
            const reordered = newOrderIds.map(id => produtos.find(p => p.id === id));
            produtos = reordered;

            await salvarOrdemProdutosBanco();
        }
    });
}

async function salvarOrdemProdutosBanco() {
    // Apenas produtos ativos e não arquivados devem ser reordenados (conforme regra de negócio)
    // Mas aqui salvamos a ordem atual de todos para simplificar a persistência
    const updates = produtos.map((p, i) => 
        sb.from('products').update({ sort_order: i }).eq('id', p.id)
    );

    const results = await Promise.all(updates);
    if (results.some(r => r.error)) {
        showToast('Erro ao salvar nova ordem dos produtos.', 'error');
    } else {
        showToast('Ordem atualizada!', 'success');
    }
}

// --- Render Categories ---
function renderCategorias() {
    const tbody = document.getElementById('categoriasBody');
    if (categorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhuma categoria cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = categorias.map(c => `
                <tr>
                    <td onclick="editarCategoria('${c.id}')" style="cursor:pointer;" title="Clique para editar"><strong>${c.name}</strong></td>
                    <td><code>${c.slug}</code></td>
                    <td>${c.order_position}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-sm btn-edit" onclick="editarCategoria('${c.id}')">Editar</button>
                            <button class="btn-sm btn-delete" onclick="excluirCategoria('${c.id}', '${c.name.replace(/'/g, "\\'")}')">Excluir</button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

// --- Render Coupons ---
function renderCupons() {
    const tbody = document.getElementById('cuponsBody');
    if (cupons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum cupom cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = cupons.map(c => `
                <tr>
                    <td><strong>${c.code}</strong></td>
                    <td>${c.discount_percent}%</td>
                    <td><span class="badge ${c.active ? 'badge-active' : 'badge-inactive'}">${c.active ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-sm btn-edit" onclick="editarCupom('${c.id}')">Editar</button>
                            <button class="btn-sm btn-delete" onclick="excluirCupom('${c.id}', '${c.code}')">Excluir</button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

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
    const termoBusca = document.getElementById(filtroId).value.toLowerCase();

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
        html += `
                    <div class="gallery-item" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(229, 178, 93, 0.1);color:var(--primary);font-size:0.8rem;text-align:center;font-weight:800;border:1px dashed var(--primary); cursor:pointer;" onclick="abrirGaleriaCompleta()">
                        <span style="font-size:1.2rem;">+${files.length - 7}</span>
                        Ver todas
                    </div>
                `;
    }
    grid.innerHTML = html;
}

async function carregarGaleria(preSelecionada = '') {
    const inputSel = document.getElementById('prodImagemSelecionada');
    inputSel.value = preSelecionada;

    const grid = document.getElementById('imageGalleryGrid');
    if (!grid) return;

    // --- NOVO: Buscar da tabela galeria_imagens ---
    const { data, error } = await sb
        .from('galeria_imagens')
        .select('*')
        .eq('tipo', 'produto')
        .order('criado_em', { ascending: false });

    if (error || !data || data.length === 0) {
        grid.innerHTML = `
            <div style="padding:2.5rem 1.5rem; color:var(--text-muted); text-align:center; border: 2px dashed rgba(229,178,93,0.2); border-radius: 16px; background: rgba(229,178,93,0.02); grid-column: 1 / -1;">
                <div style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;">📸</div>
                <h4 style="color:var(--text-main); margin-bottom: 0.5rem;">Sua galeria está vazia</h4>
                <p style="font-size:0.85rem; line-height:1.5;">Clique no botão <strong>"Subir Foto"</strong> acima para inserir sua primeira imagem.</p>
            </div>
        `;
        return;
    }

    // Mapear para o formato esperado pela renderização da grade
    imagensGaleria = data.map(item => ({
        url: item.url,
        name: 'Imagem ' + new Date(item.criado_em).toLocaleDateString()
    }));
    
    renderizarGradeGaleria('imageGalleryGrid', false);
    if (document.getElementById('modalGaleriaCompleta').classList.contains('active')) {
        renderizarGradeGaleria('imageGalleryGridCompleta', true);
    }
}

document.getElementById('filtroGaleria').oninput = () => renderizarGradeGaleria('imageGalleryGrid', false);
document.getElementById('filtroGaleriaCompleta').oninput = () => renderizarGradeGaleria('imageGalleryGridCompleta', true);

window.abrirModalGaleriaCompleta = abrirModalGaleriaCompleta;
function abrirModalGaleriaCompleta() {
    document.getElementById('filtroGaleriaCompleta').value = '';
    renderizarGradeGaleria('imageGalleryGridCompleta', true);
    abrirModal('modalGaleriaCompleta');
}

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

    if (isCompleto) {
        fecharModal('modalGaleriaCompleta');
    } else {
        element.classList.add('selected');
    }
};

document.getElementById('btnUploadNovaImagem').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleImageUpload(file);
    e.target.value = '';
};

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

function renderizarMiniaturasProduto() {
    const container = document.getElementById('containerImagensProduto');
    if (!container) return;
    
    container.innerHTML = currentProductImages.map((url, index) => `
        <div class="product-image-thumb">
            <img src="${url}" alt="Imagem ${index + 1}" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade">
            <button class="btn-remove-img" onclick="removerImagemProduto(${index})">×</button>
        </div>
    `).join('');
    
    // Atualiza o input legado (pega a primeira imagem para compatibilidade se necessário)
    document.getElementById('prodImagemSelecionada').value = currentProductImages[0] || '';
    
    // Desativar botão se chegar a 5
    const btn = document.getElementById('btnAdicionarImagem');
    if (btn) btn.disabled = (currentProductImages.length >= 5);
}

window.removerImagemProduto = removerImagemProduto;
function removerImagemProduto(index) {
    currentProductImages.splice(index, 1);
    renderizarMiniaturasProduto();
}

window.abrirModalNovoProduto = abrirModalNovoProduto;
function abrirModalNovoProduto() {
    if (!validarAcessoModulo('produtos_gerenciar')) return;
    document.getElementById('modalProdutoTitle').textContent = 'Novo Produto';
    document.getElementById('produtoId').value = '';
    document.getElementById('prodNome').value = '';
    document.getElementById('prodDesc').value = '';
    document.getElementById('prodPreco').value = '';
    document.getElementById('prodPrecoPromo').value = '';
    setPromoType('val');
    atualizarPromoPreview();
    document.getElementById('prodEstoque').value = '0';
    document.getElementById('groupEstoqueAtual').style.display = 'none';
    document.getElementById('rowTipoMovimentacao').style.display = 'none';
    document.getElementById('containerMotivoSaida').style.display = 'none';
    document.getElementById('labelMovimentacaoEstoque').innerText = 'Estoque Inicial';
    document.getElementById('prodTipoMovimentacao').value = 'entrada';
    document.getElementById('prodMotivoSaidaId').value = '';
    document.getElementById('prodObsSaida').value = '';

    currentProductImages = [];
    renderizarMiniaturasProduto();
    carregarGaleria('');
    abrirModal('modalProduto');
}

// Listener para mudança de tipo de movimentação
document.getElementById('prodTipoMovimentacao').onchange = (e) => {
    const container = document.getElementById('containerMotivoSaida');
    const label = document.getElementById('labelMovimentacaoEstoque');
    
    if (e.target.value === 'saida') {
        container.style.display = 'block';
        label.innerText = 'Quantidade de Saída';
        popularSelectMotivosEstoque();
    } else {
        container.style.display = 'none';
        label.innerText = 'Quantidade de Entrada';
    }
};

function popularSelectMotivosEstoque() {
    const select = document.getElementById('prodMotivoSaidaId');
    const ativos = motivosEstoque.filter(m => m.active);
    
    select.innerHTML = '<option value="">Selecione um motivo...</option>' + 
        ativos.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

window.editarProduto = editarProduto;
function editarProduto(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalProdutoTitle').textContent = 'Editar Produto';
    document.getElementById('produtoId').value = p.id;
    document.getElementById('prodNome').value = p.name;
    document.getElementById('prodDesc').value = p.description || '';
    document.getElementById('prodPreco').value = p.price;
    document.getElementById('prodEstoque').value = p.stock;
    document.getElementById('prodEstoqueDisplay').innerText = p.stock;
    document.getElementById('prodMovimentacaoEstoque').value = '';
    document.getElementById('prodEstoqueMin').value = p.min_stock_alert;
    document.getElementById('prodCategoria').value = p.category_id;
    document.getElementById('prodAtivo').value = String(p.active);
    document.getElementById('prodImagemSelecionada').value = p.image_url || '';
    document.getElementById('prodPrecoPromo').value = p.promo_price || '';
    setPromoType('val'); // Reset para valor ao editar
    atualizarPromoPreview();

    document.getElementById('groupEstoqueAtual').style.display = 'block';
    document.getElementById('rowTipoMovimentacao').style.display = 'block';
    document.getElementById('containerMotivoSaida').style.display = 'none';
    document.getElementById('labelMovimentacaoEstoque').innerText = 'Adicionar ao Estoque';
    document.getElementById('prodTipoMovimentacao').value = 'entrada';
    document.getElementById('prodMotivoSaidaId').value = '';
    document.getElementById('prodObsSaida').value = '';

    // --- Múltiplas Imagens ---
    if (Array.isArray(p.image_url)) {
        currentProductImages = [...p.image_url];
    } else {
        currentProductImages = p.image_url ? [p.image_url] : [];
    }
    renderizarMiniaturasProduto();

    carregarGaleria(currentProductImages[0] || '');
    abrirModal('modalProduto');
};

window.executarSalvarProduto = executarSalvarProduto;
async function executarSalvarProduto() {
    if (!validarAcessoModulo('produtos_gerenciar')) {
        console.warn('[SAVE] Acesso negado ao módulo de produtos.');
        return;
    }
    const btn = document.getElementById('btnSalvarProduto');
    const id = document.getElementById('produtoId').value;
    const currentStock = parseInt(document.getElementById('prodEstoque').value) || 0;
    const stockInput = parseInt(document.getElementById('prodMovimentacaoEstoque').value) || 0;
    const tipoMov = document.getElementById('prodTipoMovimentacao').value;
    const motivoId = document.getElementById('prodMotivoSaidaId').value;
    const obs = document.getElementById('prodObsSaida').value.trim();

    const basePrice = parseFloat(document.getElementById('prodPreco').value) || 0;
    const promoVal = parseFloat(document.getElementById('prodPrecoPromo').value) || 0;
    
    console.log('[SAVE] Iniciando salvamento...', { id, basePrice, promoVal, imgs: currentProductImages.length });

    if (promoVal > 0) {
        if (window.currentPromoType === 'pct' && promoVal > 100) {
            showToast('O desconto não pode ser maior que 100%.', 'error');
            return;
        }
        if (window.currentPromoType === 'val' && promoVal >= basePrice) {
            showToast('O preço promocional deve ser menor que o original.', 'error');
            return;
        }
    }

    const payload = {
        name:            document.getElementById('prodNome').value.trim(),
        description:     document.getElementById('prodDesc').value.trim(),
        price:           parseFloat(document.getElementById('prodPreco').value),
        min_stock_alert: parseInt(document.getElementById('prodEstoqueMin').value) || 0,
        category_id:     document.getElementById('prodCategoria').value || null,
        active:          document.getElementById('prodAtivo').value === 'true',
        image_url:       currentProductImages,
        promo_price:     (() => {
            const val = parseFloat(document.getElementById('prodPrecoPromo').value);
            if (!val || val <= 0) return null;
            if (window.currentPromoType === 'pct') {
                const base = parseFloat(document.getElementById('prodPreco').value) || 0;
                return base * (1 - val / 100);
            }
            return val;
        })(),
        updated_at:      new Date().toISOString()
    };

    if (!payload.name || isNaN(payload.price)) {
        showToast('Nome e preço são obrigatórios.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    let finalStock = currentStock;
    if (!id) {
        finalStock = stockInput;
    } else {
        finalStock = (tipoMov === 'entrada') ? currentStock + stockInput : currentStock - stockInput;
    }
    payload.stock = finalStock;

    let dbError;
    let savedProductId = id;

    try {
        if (id) {
            ({ error: dbError } = await sb.from('products').update(payload).eq('id', id));
        } else {
            const tenantId = getTenantId();
            if (!tenantId) throw new Error('ID da empresa não encontrado.');
            payload.empresa_id = tenantId;
            const { data, error } = await sb.from('products').insert(payload).select().single();
            dbError = error;
            if (data) savedProductId = data.id;
        }

        if (dbError) throw dbError;

        // Registrar movimentação
        if (stockInput > 0 || !id) {
            await sb.from('stock_movements').insert({
                product_id: savedProductId,
                empresa_id: getTenantId(),
                type: (!id) ? 'entrada' : tipoMov,
                quantity: stockInput,
                reason: (!id) ? 'Estoque inicial' : null,
                reason_id: (id && tipoMov === 'saida') ? motivoId : null,
                notes: obs || null
            });
        }

        showToast(id ? 'Produto atualizado!' : 'Produto criado!', 'success');
        fecharModal('modalProduto');
        carregarProdutos();
        if (typeof renderStats === 'function') renderStats();

    } catch (err) {
        console.error('[SAVE ERROR]', err);
        showToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = id ? 'Salvar Alterações' : 'Salvar Produto';
    }
}

window.arquivarProduto = async (id) => {
    if (!await customConfirm('Arquivar Produto', 'Deseja arquivar este produto? Ele não aparecerá mais no cardápio nem no sistema.')) return;
    const { error } = await sb.from('products').update({ archived: true }).eq('id', id);
    if (error) {
        showToast('Erro ao arquivar: ' + error.message, 'error');
    } else {
        showToast('Produto arquivado!', 'success');
        carregarProdutos();
        renderStats();
    }
};

window.desarquivarProduto = async (id) => {
    if (!await customConfirm('Desarquivar Produto', 'Deseja desarquivar este produto? Ele retornará como inativo para que você possa revisá-lo antes de ativar.')) return;
    // Desarquiva e assegura que continue inativo inicialmente
    const { error } = await sb.from('products').update({ archived: false, active: false }).eq('id', id);
    if (error) {
        showToast('Erro ao desarquivar: ' + error.message, 'error');
    } else {
        showToast('Produto desarquivado com sucesso!', 'success');
        carregarProdutos();
        renderStats();
    }
};

// =================== CATEGORIES CRUD ===================

document.getElementById('btnNovaCategoria').onclick = () => {
    document.getElementById('modalCategoriaTitle').textContent = 'Nova Categoria';
    document.getElementById('catId').value = '';
    document.getElementById('catNome').value = '';
    document.getElementById('catSlug').value = '';
    document.getElementById('catOrdem').value = '';
    abrirModal('modalCategoria');
};

// Auto-generate slug from name
document.getElementById('catNome').oninput = () => {
    if (!document.getElementById('catId').value) {
        const nome = document.getElementById('catNome').value;
        document.getElementById('catSlug').value = nome.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
};

window.editarCategoria = (id) => {
    const c = categorias.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modalCategoriaTitle').textContent = 'Editar Categoria';
    document.getElementById('catId').value = c.id;
    document.getElementById('catNome').value = c.name;
    document.getElementById('catSlug').value = c.slug;
    document.getElementById('catOrdem').value = c.order_position;
    abrirModal('modalCategoria');
};

document.getElementById('btnSalvarCategoria').onclick = async () => {
    if (!validarAcessoModulo('produtos_categorias')) return;
    const id = document.getElementById('catId').value;
    const nome = document.getElementById('catNome').value.trim();
    const slug = document.getElementById('catSlug').value.trim();
    const ordem = parseInt(document.getElementById('catOrdem').value) || 0;

    if (!nome || !slug) {
        showToast('Preencha nome e slug.', 'error');
        return;
    }

    const payload = { name: nome, slug: slug, order_position: ordem };

    let error;
    if (id) {
        ({ error } = await sb.from('categories').update(payload).eq('id', id));
    } else {
        // ← Multi-Tenant: injeta empresa_id no INSERT
        ({ error } = await sb.from('categories').insert({ ...payload, empresa_id: getTenantId() }));
    }

    if (error) {
        showToast('Erro ao salvar categoria: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
    fecharModal('modalCategoria');
    await carregarCategorias();
    await carregarProdutos();
    renderStats();
};

window.excluirCategoria = async (id, nome) => {
    if (!await customConfirm('Excluir Categoria', `Excluir categoria "${nome}"? Os produtos desta categoria ficarão sem categoria.`)) return;
    const { error } = await sb.from('categories').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
    showToast('Categoria excluída!', 'success');
    await carregarCategorias();
    renderStats();
};

// =================== COUPONS CRUD ===================

document.getElementById('btnNovoCupom').onclick = () => {
    if (!validarAcessoModulo('cupons')) return;
    document.getElementById('modalCupomTitle').textContent = 'Novo Cupom';
    document.getElementById('cupomId').value = '';
    document.getElementById('cupomCodigo').value = '';
    document.getElementById('cupomDesconto').value = '';
    document.getElementById('cupomAtivo').value = 'true';
    abrirModal('modalCupom');
};

window.editarCupom = (id) => {
    const c = cupons.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modalCupomTitle').textContent = 'Editar Cupom';
    document.getElementById('cupomId').value = c.id;
    document.getElementById('cupomCodigo').value = c.code;
    document.getElementById('cupomDesconto').value = c.discount_percent;
    document.getElementById('cupomAtivo').value = String(c.active);
    abrirModal('modalCupom');
};

document.getElementById('btnSalvarCupom').onclick = async () => {
    if (!validarAcessoModulo('cupons')) return;
    const id = document.getElementById('cupomId').value;
    const codigo = document.getElementById('cupomCodigo').value.trim().toUpperCase();
    const desconto = parseFloat(document.getElementById('cupomDesconto').value);
    const ativo = document.getElementById('cupomAtivo').value === 'true';

    if (!codigo || isNaN(desconto) || desconto <= 0 || desconto > 100) {
        showToast('Preencha código e desconto corretamente (1-100%).', 'error');
        return;
    }

    const payload = { code: codigo, discount_percent: desconto, active: ativo };

    let error;
    if (id) {
        ({ error } = await sb.from('coupons').update(payload).eq('id', id));
    } else {
        // ← Multi-Tenant: injeta empresa_id no INSERT
        ({ error } = await sb.from('coupons').insert({ ...payload, empresa_id: getTenantId() }));
    }

    if (error) {
        showToast('Erro ao salvar cupom: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'Cupom atualizado!' : 'Cupom criado!', 'success');
    fecharModal('modalCupom');
    await carregarCupons();
};

window.excluirCupom = async (id, code) => {
    if (!await customConfirm('Excluir Cupom', `Excluir cupom "${code}"?`)) return;
    const { error } = await sb.from('coupons').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
        showToast('Cupom excluído!', 'success');
    await carregarCupons();
};

// Enter to login
document.getElementById('loginSenha').onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('btnLogin').click();
};

// --- Filtros de Pedidos (Live) ---
let filterTimeout;
function aplicarFiltrosPedidosLive() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(aplicarFiltrosPedidos, 350);
}

// Listeners para filtros ao vivo
document.getElementById('filtroCliente').oninput = aplicarFiltrosPedidosLive;
document.getElementById('filtroAtendente').onchange = aplicarFiltrosPedidos;
document.getElementById('filtroDataInicio').onchange = aplicarFiltrosPedidos;
document.getElementById('filtroDataFim').onchange = aplicarFiltrosPedidos;
document.getElementById('filtroValorMin').oninput = aplicarFiltrosPedidosLive;
document.getElementById('filtroValorMax').oninput = aplicarFiltrosPedidosLive;
document.getElementById('filtroStatus').onchange = aplicarFiltrosPedidos;

function aplicarFiltrosPedidos() {
    filtrosPedidos = {
        dataInicio: document.getElementById('filtroDataInicio').value,
        dataFim: document.getElementById('filtroDataFim').value,
        cliente: document.getElementById('filtroCliente').value.trim(),
        atendente: document.getElementById('filtroAtendente').value,
        valorMin: document.getElementById('filtroValorMin').value,
        valorMax: document.getElementById('filtroValorMax').value,
        status: document.getElementById('filtroStatus').value
    };
    atualizarMétricasDashboard();
}

document.getElementById('btnLimparFiltros').onclick = () => {
    filtrosPedidos = { dataInicio: '', dataFim: '', cliente: '', atendente: '', valorMin: '', valorMax: '', status: '' };
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    document.getElementById('filtroCliente').value = '';
    document.getElementById('filtroAtendente').value = '';
    document.getElementById('filtroValorMin').value = '';
    document.getElementById('filtroValorMax').value = '';
    document.getElementById('filtroStatus').value = '';
    atualizarMétricasDashboard();
};

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

// --- Funções de Configuração ---
window.toggleUrlInput = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

async function carregarConfiguracoes() {
    const empresaId = getTenantId();
    const [settingsRes, zonasRes, empresaRes] = await Promise.all([
        sb.from('store_settings').select('*').eq('empresa_id', empresaId).single(),
        sb.from('shipping_zones').select('*').eq('empresa_id', empresaId).order('created_at'),
        sb.from('empresas').select('tema_cor_primaria, tema_cor_botao, tema_cor_texto').eq('id', empresaId).single()
    ]);

    if (settingsRes.error && settingsRes.error.code !== 'PGRST116') {
        showToast('Erro ao carregar configurações', 'error');
    }
    if (empresaRes.error) {
        console.error('Erro ao carregar tema:', empresaRes.error);
    }

    if (empresaRes.data) {
        const e = empresaRes.data;
        _setThemeField('confTemaPrimaria',   'confTemaPrimariaHex',   e.tema_cor_primaria   || '#E5B25D');
        _setThemeField('confTemaBotao',      'confTemaBotaoHex',      e.tema_cor_botao      || '#E5B25D');
        _setThemeField('confTemaTexto',      'confTemaTextoHex',      e.tema_cor_texto      || '#ffffff');
        previewTemaEmpresa();

        // Atualizar títulos dinâmicos
        const nomeEmpresa = e.nome || 'RiverTech';
        document.title = `Admin | ${nomeEmpresa}`;
        const headerTitle = document.querySelector('.admin-header h1');
        if (headerTitle) {
            headerTitle.innerHTML = `${nomeEmpresa} <span class="admin-header-label">Admin</span>`;
        }
        const loginTitle = document.querySelector('.login-card h1');
        if (loginTitle) {
            loginTitle.textContent = nomeEmpresa;
        }
    }

    if (settingsRes.data) {
        const d = settingsRes.data;
        currentSettingsId = d.id;
        // Dados da Empresa
        document.getElementById('confNomeLoja').value        = d.store_name || '';
        document.getElementById('confCep').value             = d.address_zip || '';
        document.getElementById('confLogradouro').value      = d.address_street || '';
        document.getElementById('confNumero').value          = d.address_number || '';
        document.getElementById('confComplemento').value     = d.address_complement || '';
        document.getElementById('confBairro').value          = d.address_neighborhood || '';
        document.getElementById('confCidade').value          = d.address_city || '';
        document.getElementById('confEstado').value          = d.address_state || '';
        document.getElementById('confReferencia').value      = d.address_reference || '';

        // Personalização Visual
        // Preenche com o nome da empresa se o nome da marca estiver vazio
        document.getElementById('confBrandName').value = d.brand_name || window.TENANT.nome || '';
        document.getElementById('confBrandSubtitle').value = d.brand_subtitle || 'Seu subtítulo aqui';
        
        // Horários operacionais
        const openTime = (d.opening_time || '18:00').slice(0, 5);
        const closeTime = (d.closing_time || '02:00').slice(0, 5);
        
        document.getElementById('confOpeningTime').value = openTime;
        document.getElementById('confClosingTime').value = closeTime;
        openingTime = openTime;
        closingTime = closeTime;
        document.getElementById('confBannerUrl').value       = d.banner_url || '';
        document.getElementById('confLogoUrl').value         = d.logo_url || '';
        atualizarPreviewBanner(d.banner_url || '');
        atualizarPreviewLogo(d.logo_url || '');

        // Frete
        const freteAtivo = !!d.frete_ativo;
        document.getElementById('confFreteAtivo').checked    = freteAtivo;
        document.getElementById('freteZonasContainer').style.display = freteAtivo ? 'block' : 'none';

        // Justificativas
        let cr = d.cancellation_reasons;
        if (typeof cr === 'string') {
            try { cr = JSON.parse(cr); } catch(e) { cr = []; }
        }
        cancellationReasons = Array.isArray(cr) ? cr : [];
        renderJustificativas();
    }

    if (!zonasRes.error) {
        zonasEntrega = zonasRes.data || [];
        renderZonasFrete();
    }
}

// --- Funções de Tema (Empresa) ---

function _setThemeField(pickerId, hexId, value) {
    const picker = document.getElementById(pickerId);
    const hex = document.getElementById(hexId);
    if (picker) picker.value = value;
    if (hex) hex.value = value;

    // Adiciona listener para o campo HEX atualizar o picker
    if (hex && !hex.dataset.hasListener) {
        hex.dataset.hasListener = "true";
        hex.addEventListener('input', (e) => {
            const val = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                if (picker) picker.value = val;
                previewTemaEmpresa();
            }
        });
    }
}

// Atualiza o preview de tema no painel da empresa
function previewTemaEmpresa() {
    const primaria = document.getElementById('confTemaPrimaria').value;
    const botao    = document.getElementById('confTemaBotao').value;
    const texto    = document.getElementById('confTemaTexto').value;

    // Sincroniza campos hex
    document.getElementById('confTemaPrimariaHex').value = primaria;
    document.getElementById('confTemaBotaoHex').value    = botao;
    document.getElementById('confTemaTextoHex').value    = texto;

    // Aplica no preview local (Mockup Premium)
    const previewArea  = document.getElementById('empLivePreview');
    const previewBtn   = document.getElementById('empLiveBtn');
    const previewPrice = document.getElementById('empLivePrice');
    const previewBadge = document.getElementById('empLiveBadge');
    const previewTitle = document.getElementById('empLiveTitle');
    const previewDesc  = document.getElementById('empLiveDesc');

    if (previewArea) {
        previewArea.style.backgroundColor = '#0d0d0d'; // Fundo fixo para o mockup
    }
    
    if (previewTitle) previewTitle.style.color = texto;
    if (previewDesc) previewDesc.style.color = texto + '99'; // Transparência suave

    if (previewBtn) {
        previewBtn.style.backgroundColor = botao;
        // Calcula contraste básico para o texto do botão
        const isLight = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
        };
        previewBtn.style.color = isLight(botao) ? '#000' : '#fff';
    }

    if (previewPrice) {
        previewPrice.style.color = primaria;
    }

    if (previewBadge) {
        previewBadge.style.backgroundColor = primaria;
        previewBadge.style.color = '#000'; // Geralmente preto em badges de destaque
    }
}
window.previewTemaEmpresa = previewTemaEmpresa;

// Salvar Tema (Empresa)
document.getElementById('btnSalvarTemaEmpresa').addEventListener('click', async () => {
    if (!validarAcessoModulo('config_personalizacao')) return;
    const btn = document.getElementById('btnSalvarTemaEmpresa');
    const empresaId = getTenantId();
    
    const tema_cor_primaria = document.getElementById('confTemaPrimaria').value;
    const tema_cor_botao    = document.getElementById('confTemaBotao').value;
    const tema_cor_texto    = document.getElementById('confTemaTexto').value;

    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const { error } = await sb.from('empresas').update({
            tema_cor_primaria,
            tema_cor_botao,
            tema_cor_texto,
            // Resetamos os fundos caso o usuário tenha clicado em restaurar (que preencheu os campos internos mas eles não aparecem no DOM)
            // Se o valor no DOM for o padrão, salvamos o padrão. 
            // Como removemos os campos do DOM, vamos enviar os valores padrão caso o usuário salve após restaurar.
            // Mas melhor: se o usuário restaurar, vamos garantir que esses campos sejam incluídos no update.
            tema_cor_bg:      tema_cor_primaria === '#E5B25D' ? '#0d0d0d' : undefined,
            tema_cor_surface: tema_cor_primaria === '#E5B25D' ? '#1a1a1a' : undefined,
            cor_primaria: tema_cor_primaria // Sincroniza legado
        }).eq('id', empresaId);

        if (error) throw error;

        showToast('Cores atualizadas com sucesso! ✅', 'success');
        
        // Aplica as cores no painel admin atual sem precisar recarregar
        if (typeof _aplicarWhiteLabel === 'function') {
            _aplicarWhiteLabel({
                tema_cor_primaria,
                tema_cor_botao,
                tema_cor_texto,
                nome: window.TENANT.nome,
                logo_url: window.TENANT.logo_url
            });
        }

    } catch (err) {
        showToast('Erro ao salvar tema: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Cores';
    }
});

// Restaurar Tema Padrão (Empresa)
document.getElementById('btnRestaurarTemaEmpresa').addEventListener('click', () => {
    if (!validarAcessoModulo('config_personalizacao')) return;
    
    // Valores padrão do sistema
    const defaults = {
        primaria: '#E5B25D',
        botao:    '#E5B25D',
        texto:    '#ffffff',
        bg:       '#0d0d0d',
        surface:  '#1a1a1a'
    };

    _setThemeField('confTemaPrimaria',   'confTemaPrimariaHex',   defaults.primaria);
    _setThemeField('confTemaBotao',      'confTemaBotaoHex',      defaults.botao);
    _setThemeField('confTemaTexto',      'confTemaTextoHex',      defaults.texto);
    
    // Atualiza preview local
    previewTemaEmpresa();
    
    showToast('Visual restaurado (Clique em Salvar para confirmar)', 'info');
});

// --- Preview de imagem ---
function atualizarPreviewBanner(url) {
    const el = document.getElementById('previewBanner');
    const placeholder = el.querySelector('.visual-preview-placeholder');
    if (url) {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        el.style.backgroundImage = '';
        if (placeholder) placeholder.style.display = '';
    }
}

function atualizarPreviewLogo(url) {
    const el = document.getElementById('previewLogo');
    const placeholder = el.querySelector('.visual-preview-placeholder');
    if (url) {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        el.style.backgroundImage = '';
        if (placeholder) placeholder.style.display = '';
    }
}

// --- Upload de imagem de visual (banner/logo) ---
async function handleVisualImageUpload(file, tipo) {
    showToast(`Enviando ${tipo}...`, 'success');
    // Usamos a subpasta 'config' para banners e logos
    const url = await window.handleCloudinaryUpload(file, 'config');
    return url;
}

document.getElementById('uploadBanner').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await handleVisualImageUpload(file, 'banner');
    if (url) {
        document.getElementById('confBannerUrl').value = url;
        atualizarPreviewBanner(url);
    }
    e.target.value = '';
};

document.getElementById('uploadLogo').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await handleVisualImageUpload(file, 'logo');
    if (url) {
        document.getElementById('confLogoUrl').value = url;
        atualizarPreviewLogo(url);
    }
    e.target.value = '';
};

document.getElementById('btnAplicarUrlBanner').onclick = () => {
    const url = document.getElementById('confBannerUrl').value.trim();
    atualizarPreviewBanner(url);
    if(url) toggleUrlInput('containerBannerUrl');
};

document.getElementById('btnAplicarUrlLogo').onclick = () => {
    const url = document.getElementById('confLogoUrl').value.trim();
    atualizarPreviewLogo(url);
    if(url) toggleUrlInput('containerLogoUrl');
};

// --- Salvar Personalização Visual ---
document.getElementById('btnSalvarPersonalizacao').onclick = async () => {
    if (!validarAcessoModulo('config_personalizacao')) return;
    const btn = document.getElementById('btnSalvarPersonalizacao');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const payload = {
        empresa_id:     getTenantId(), // ← Multi-Tenant (upsert por empresa_id)
        brand_name:     document.getElementById('confBrandName').value.trim(),
        brand_subtitle: document.getElementById('confBrandSubtitle').value.trim(),
        banner_url:     document.getElementById('confBannerUrl').value.trim(),
        logo_url:       document.getElementById('confLogoUrl').value.trim(),
        updated_at:     new Date().toISOString()
    };

    if (currentSettingsId) {
        payload.id = currentSettingsId;
    }

    const { error } = await sb.from('store_settings').upsert(payload, { onConflict: 'empresa_id' });
    if (error) {
        showToast('Erro ao salvar visual: ' + error.message, 'error');
    } else {
        showToast('Personalização visual salva!', 'success');
    }
    btn.disabled = false;
    btn.textContent = 'Salvar Visual';
};

// --- Toggle Frete ---
document.getElementById('confFreteAtivo').onchange = async function () {
    const ativo = this.checked;
    document.getElementById('freteZonasContainer').style.display = ativo ? 'block' : 'none';

    const payload = {
        empresa_id: getTenantId(), // ← Multi-Tenant
        frete_ativo: ativo,
        updated_at: new Date().toISOString()
    };
    if (currentSettingsId) payload.id = currentSettingsId;

    const { error } = await sb.from('store_settings').upsert(payload, { onConflict: 'empresa_id' });
    if (error) {
        showToast('Erro ao salvar configuração de frete: ' + error.message, 'error');
    } else {
        showToast(ativo ? '🚚 Frete habilitado!' : 'Frete desabilitado.', 'success');
    }
};

// --- Render Zonas de Frete ---
function renderZonasFrete() {
    const tbody = document.getElementById('zonasBody');
    if (!tbody) return;
    if (zonasEntrega.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhuma zona cadastrada.</td></tr>';
        return;
    }
    tbody.innerHTML = zonasEntrega.map(z => `
        <tr>
            <td><strong>${z.name}</strong></td>
            <td><span style="font-size:0.85rem; color:var(--text-muted);">${truncateNeighborhoods(z.neighborhoods)}</span></td>
            <td>
                <div class="fee-editable" onclick="window.tornarFeeEditavel(this, '${z.id}')" title="Clique para editar taxa">
                    <strong>${formatCurrency(z.fee)}</strong>
                </div>
            </td>
            <td><span class="badge ${z.active ? 'badge-active' : 'badge-inactive'}">${z.active ? 'Ativa' : 'Inativa'}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-sm btn-edit" onclick="editarZona('${z.id}')">Editar</button>
                    <button class="btn-sm btn-delete" onclick="excluirZona('${z.id}', '${z.name.replace(/'/g, "\\'")}')">Excluir</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// --- Edição de Taxa Inline ---
window.tornarFeeEditavel = (el, id) => {
    if (el.querySelector('input')) return;
    const valorAtual = parseFloat(el.textContent.replace('R$', '').replace('.', '').replace(',', '.').trim());
    el.innerHTML = `<input type="number" step="0.01" class="inline-fee-input" value="${valorAtual}" onblur="window.salvarTaxaInline(this, '${id}')" onkeydown="if(event.key==='Enter') this.blur()">`;
    const input = el.querySelector('input');
    input.focus();
    input.select();
};

window.salvarTaxaInline = async (input, id) => {
    const novoValor = parseFloat(input.value);
    if (isNaN(novoValor)) {
        renderZonasFrete(); // Reverte se inválido
        return;
    }
    
    // Feedback visual imediato
    const container = input.parentElement;
    container.innerHTML = '<span style="font-size:0.8rem;opacity:0.6;">⏳...</span>';

    const { error } = await sb.from('shipping_zones').update({ fee: novoValor }).eq('id', id);
    if (error) {
        showToast('Erro ao salvar taxa: ' + error.message, 'error');
        renderZonasFrete();
    } else {
        const zona = zonasEntrega.find(z => z.id === id);
        if (zona) zona.fee = novoValor;
        renderZonasFrete();
        showToast('Taxa atualizada!', 'success');
    }
};

// --- CRUD Zonas de Frete ---
document.getElementById('btnNovaZona').onclick = () => {
    document.getElementById('modalZonaTitulo').textContent = 'Nova Zona de Entrega';
    document.getElementById('zonaId').value = '';
    document.getElementById('zonaNome').value = '';
    document.getElementById('zonaNeighborhoods').value = '';
    document.getElementById('zonaFee').value = '';
    document.getElementById('zonaAtivo').value = 'true';
    abrirModal('modalZona');
};

window.editarZona = (id) => {
    const z = zonasEntrega.find(x => x.id === id);
    if (!z) return;
    document.getElementById('modalZonaTitulo').textContent = 'Editar Zona';
    document.getElementById('zonaId').value = z.id;
    document.getElementById('zonaNome').value = z.name;
    document.getElementById('zonaNeighborhoods').value = z.neighborhoods || '';
    document.getElementById('zonaFee').value = z.fee;
    document.getElementById('zonaAtivo').value = String(z.active);
    abrirModal('modalZona');
};

document.getElementById('btnSalvarZona').onclick = async () => {
    if (!validarAcessoModulo('config_frete')) return;
    const btn = document.getElementById('btnSalvarZona');
    const id = document.getElementById('zonaId').value;
    const nome = document.getElementById('zonaNome').value.trim();
    const neighborhoods = document.getElementById('zonaNeighborhoods').value.trim();
    const fee = parseFloat(document.getElementById('zonaFee').value);
    const ativo = document.getElementById('zonaAtivo').value === 'true';

    if (!nome || !neighborhoods || isNaN(fee) || fee < 0) {
        showToast('Preencha o nome da zona, os bairros e a taxa.', 'error');
        return;
    }

    const payload = {
        name: nome,
        neighborhoods: neighborhoods,
        fee,
        active: ativo
    };

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    let error;
    if (id) {
        ({ error } = await sb.from('shipping_zones').update(payload).eq('id', id));
    } else {
        // ← Multi-Tenant: injeta empresa_id no INSERT
        ({ error } = await sb.from('shipping_zones').insert({ ...payload, empresa_id: getTenantId() }));
    }

    if (error) {
        showToast('Erro ao salvar: ' + error.message, 'error');
    } else {
        showToast(id ? 'Bairro atualizado!' : 'Bairro criado!', 'success');
        fecharModal('modalZona');
        const { data } = await sb.from('shipping_zones').select('*')
            .eq('empresa_id', getTenantId())
            .order('name');
        zonasEntrega = data || [];
        renderZonasFrete();
    }
    btn.disabled = false;
    btn.textContent = 'Salvar';
};

window.excluirZona = async (id, nome) => {
    if (!await customConfirm('Excluir Zona', `Excluir a zona "${nome}"?`)) return;
    const { error } = await sb.from('shipping_zones').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
    showToast('Zona excluída!', 'success');
    zonasEntrega = zonasEntrega.filter(z => z.id !== id);
    renderZonasFrete();
};

// --- Geolocalização Helper ---
async function getCoordinates(address) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (e) { console.error("Erro geocoding: ", e); }
    return null;
}

document.getElementById('btnSalvarConfig').onclick = async () => {
    if (!validarAcessoModulo('config_endereco')) return;
    const btn = document.getElementById('btnSalvarConfig');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const payload = {
        empresa_id:           getTenantId(), // ← Multi-Tenant (upsert por empresa_id)
        store_name:           document.getElementById('confNomeLoja').value.trim(),
        address_zip:          document.getElementById('confCep').value.trim(),
        address_street:       document.getElementById('confLogradouro').value.trim(),
        address_number:       document.getElementById('confNumero').value.trim(),
        address_complement:   document.getElementById('confComplemento').value.trim(),
        address_neighborhood: document.getElementById('confBairro').value.trim(),
        address_city:         document.getElementById('confCidade').value.trim(),
        address_state:        document.getElementById('confEstado').value.trim(),
        address_reference:    document.getElementById('confReferencia').value.trim(),
        opening_time:         document.getElementById('confOpeningTime').value,
        closing_time:         document.getElementById('confClosingTime').value,
        updated_at:           new Date().toISOString()
    };
    
    if (currentSettingsId) {
        payload.id = currentSettingsId;
    }

    const { error } = await sb.from('store_settings').upsert(payload, { onConflict: 'empresa_id' });
    if (error) {
        showToast('Erro ao salvar: ' + error.message, 'error');
    } else {
        showToast('Configurações salvas!', 'success');
        
        // Atualiza variáveis globais de horário para refletir no Dashboard imediatamente
        openingTime = payload.opening_time;
        closingTime = payload.closing_time;

        // Se o Dashboard estiver em modo operacional, atualiza a mensagem do período
        if (currentModoDashboard === 'hoje-op' || currentModoDashboard === 'ontem-op') {
            setModoDashboard(currentModoDashboard);
        }
    }
    btn.disabled = false;
    btn.textContent = 'Salvar Configurações';
};

async function buscarCepAdmin() {
    const cep = document.getElementById('confCep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
            document.getElementById('confLogradouro').value = data.logradouro || '';
            document.getElementById('confBairro').value = data.bairro || '';
            document.getElementById('confCidade').value = data.localidade || '';
            document.getElementById('confEstado').value = data.uf || '';
            document.getElementById('confNumero').focus();
        } else {
            showToast('CEP não encontrado.', 'error');
        }
    } catch (err) {
        console.error('Erro ao buscar CEP:', err);
    }
}

// Formatação e Auto-fetch CEP
document.getElementById('confCep').oninput = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    
    // Auto-fetch ao atingir 8 dígitos
    if (v.length === 8) {
        buscarCepAdmin();
    }

    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
    e.target.value = v;
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
});

// --- Justificativas de Cancelamento ---
function renderJustificativas() {
    const tbody = document.getElementById('justificativasBody');
    if (!tbody) return;
    if (cancellationReasons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1rem;">Nenhuma justificativa cadastrada.</td></tr>';
        return;
    }
    
    tbody.innerHTML = cancellationReasons.map((r, i) => `
        <tr class="justificativa-row" data-index="${i}">
            <td style="color: var(--text-muted); text-align: center; font-size: 1.2rem;"><span class="drag-handle-just" style="cursor:grab;">☰</span></td>
            <td>${r}</td>
            <td>
                <button class="btn-sm btn-delete" onclick="removerJustificativa(${i})">Excluir</button>
            </td>
        </tr>
    `).join('');

    initSortableJustificativas();
}

function initSortableJustificativas() {
    const el = document.getElementById('justificativasBody');
    if (!el || el.sortable) return;

    el.sortable = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle-just',
        ghostClass: 'sortable-ghost',
        dragClass: 'dragging',
        chosenClass: 'dragging',
        onStart: () => el.classList.add('is-dragging'),
        onEnd: async (evt) => {
            el.classList.remove('is-dragging');
            if (evt.oldIndex === evt.newIndex) return;

            // Reordenar baseado no novo estado do DOM
            const newOrder = Array.from(el.querySelectorAll('.justificativa-row')).map(tr => {
                const idx = parseInt(tr.dataset.index);
                return cancellationReasons[idx];
            });
            cancellationReasons = newOrder;

            renderJustificativas(); // Re-render para atualizar os data-index
            await salvarJustificativasNoBanco();
            showToast('Ordem atualizada!', 'success');
        }
    });
}

// =================== GESTÃO DE MOTIVOS DE ESTOQUE ===================

async function carregarMotivosEstoque() {
    const { data, error } = await sb.from('stock_reasons').select('*')
        .eq('empresa_id', getTenantId()) // ← Multi-Tenant
        .order('name');
    if (!error) {
        motivosEstoque = data;
        renderizarMotivosEstoque();
    }
}

function renderizarMotivosEstoque() {
    const tbody = document.getElementById('motivosEstoqueBody');
    if (!tbody) return;

    if (motivosEstoque.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1rem;">Nenhum motivo cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = motivosEstoque.map(m => `
        <tr>
            <td style="font-weight:600; cursor:pointer;" onclick="editarMotivoEstoque('${m.id}')" title="Clique para editar">${m.name}</td>
            <td style="text-align: center;">
                <label class="switch" style="display: inline-block;">
                    <input type="checkbox" ${m.active ? 'checked' : ''} onchange="toggleStatusMotivoEstoque('${m.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <div style="display:flex;gap:8px;justify-content:center;">
                    <button class="btn-sm btn-edit" onclick="editarMotivoEstoque('${m.id}')">Editar</button>
                    <button class="btn-sm btn-delete" onclick="excluirMotivoEstoque('${m.id}')">Excluir</button>
                </div>
            </td>
        </tr>
    `).join('');
}

document.getElementById('btnNovoMotivoEstoque').onclick = async () => {
    if (!validarAcessoModulo('produtos_estoque')) return;
    const name = await customPrompt('Novo Motivo de Estoque', 'Digite o nome do motivo:');
    if (name && name.trim()) {
        // ← Multi-Tenant: injeta empresa_id no INSERT
        const { error } = await sb.from('stock_reasons').insert({ name: name.trim(), empresa_id: getTenantId() });
        if (error) showToast('Erro ao criar: ' + error.message, 'error');
        else {
            showToast('Motivo criado!', 'success');
            carregarMotivosEstoque();
        }
    }
};

window.editarMotivoEstoque = async (id) => {
    const motivo = motivosEstoque.find(m => m.id === id);
    const newName = await customPrompt('Editar Motivo', 'Nome do motivo:', motivo.name);
    if (newName && newName.trim() && newName !== motivo.name) {
        const { error } = await sb.from('stock_reasons').update({ name: newName.trim() }).eq('id', id);
        if (error) showToast('Erro ao atualizar: ' + error.message, 'error');
        else {
            showToast('Motivo atualizado!', 'success');
            carregarMotivosEstoque();
        }
    }
};

window.toggleStatusMotivoEstoque = async (id, newStatus) => {
    const { error } = await sb.from('stock_reasons').update({ active: newStatus }).eq('id', id);
    if (error) showToast('Erro ao alterar status.', 'error');
    else carregarMotivosEstoque();
};

window.excluirMotivoEstoque = async (id) => {
    if (!await customConfirm('Excluir Motivo', 'Tem certeza? Isso pode afetar o histórico se houver movimentações vinculadas.')) return;
    const { error } = await sb.from('stock_reasons').delete().eq('id', id);
    if (error) showToast('Erro ao excluir: ' + error.message, 'error');
    else {
        showToast('Motivo excluído!', 'success');
        carregarMotivosEstoque();
    }
};

async function salvarJustificativasNoBanco() {
    const { error } = await sb.from('store_settings').update({
        cancellation_reasons: cancellationReasons,
        updated_at: new Date().toISOString()
    }).eq('empresa_id', getTenantId()); // ← Multi-Tenant

    if (error) {
        showToast('Erro ao salvar justificativas: ' + error.message, 'error');
    }
}

document.getElementById('btnAdicionarJustificativa').onclick = async () => {
    if (!validarAcessoModulo('config_cancelamentos')) return;
    const input = document.getElementById('inputNovaJustificativa');
    const val = input.value.trim();
    if (!val) return;
    if (cancellationReasons.includes(val)) {
        showToast('Esta justificativa já existe.', 'error');
        return;
    }
    
    document.getElementById('btnAdicionarJustificativa').disabled = true;
    cancellationReasons.push(val);
    input.value = '';
    renderJustificativas();
    
    await salvarJustificativasNoBanco();
    showToast('Justificativa adicionada!', 'success');
    document.getElementById('btnAdicionarJustificativa').disabled = false;
};

window.removerJustificativa = async (index) => {
    cancellationReasons.splice(index, 1);
    renderJustificativas();
    await salvarJustificativasNoBanco();
    showToast('Justificativa removida!', 'success');
};