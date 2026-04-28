// admin-saas-empresa.js - Lógica de Gestão 360º da Empresa

const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let EMPRESA_ID = null;
let EMPRESA_DATA = null;

// ==========================================
// 1. Inicialização e Segurança
// ==========================================
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    EMPRESA_ID = urlParams.get('id');

    if (!EMPRESA_ID) {
        alert('ID da empresa não fornecido.');
        window.location.href = 'admin-saas.html';
        return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'admin-saas.html';
        return;
    }

    // Verificar Super Admin
    const { data: isSuper } = await sb.rpc('is_super_admin', { _user_id: session.user.id });
    if (!isSuper) {
        alert('Acesso negado.');
        window.location.href = 'admin-saas.html';
        return;
    }

    await carregarDadosEmpresa();
}

// ==========================================
// 2. Carregamento de Dados
// ==========================================
async function carregarDadosEmpresa() {
    // 1. Dados Básicos
    const { data: empresa, error } = await sb.from('empresas').select('*').eq('id', EMPRESA_ID).single();
    if (error || !empresa) {
        showToast('Empresa não encontrada.', 'error');
        return;
    }
    EMPRESA_DATA = empresa;
    renderDadosBasicos(empresa);

    // 2. Métricas Financeiras
    await carregarMetricas();

    // 3. Administradores
    await carregarAdmins();
}

function renderDadosBasicos(emp) {
    document.getElementById('empresaNome').textContent = emp.nome;
    document.getElementById('editEmpPlano').value = emp.plano;
    document.getElementById('editEmpStatus').value = emp.status;
    document.getElementById('editPlanoVencimento').value = emp.plano_vencimento || '';
    document.getElementById('infoId').textContent = emp.id;
    
    // Formatação de data brasileira segura
    const dCriacao = new Date(emp.created_at);
    const dataFormatada = isNaN(dCriacao) ? '—' : dCriacao.toLocaleDateString('pt-BR');
    document.getElementById('infoCriacao').textContent = dataFormatada;

    // Módulos (Feature Flags)
    const mods = emp.modulos || {};
    document.getElementById('mod_cardapio').checked = mods.cardapio !== false;
    document.getElementById('mod_frete').checked = mods.frete !== false;
    document.getElementById('mod_dashboard').checked = mods.dashboard !== false;
    document.getElementById('mod_pagamento').checked = mods.pagamento !== false;
    document.getElementById('mod_estoque').checked = mods.estoque !== false;
    document.getElementById('mod_relatorios').checked = mods.relatorios !== false;

    // Tema
    document.getElementById('editTemaCorPrimaria').value = emp.tema_cor_primaria || '#E5B25D';
    document.getElementById('editTemaCorSecundaria').value = emp.tema_cor_secundaria || '#1E90FF';
    document.getElementById('editTemaCorBotao').value = emp.tema_cor_botao || emp.tema_cor_primaria || '#E5B25D';
    document.getElementById('editTemaCorBg').value = emp.tema_cor_bg || '#0d0d0d';
    previewTema();

    // URLs
    const baseUrl = window.location.origin;
    const urlMenu = `${baseUrl}/${emp.slug}`;
    const urlAdmin = `${baseUrl}/admin.html?tenant=${emp.slug}`;
    const urlAten = `${baseUrl}/atendente.html?tenant=${emp.slug}`;

    document.getElementById('urlMenu').textContent = urlMenu;
    document.getElementById('urlAdmin').textContent = urlAdmin;
    document.getElementById('urlAtendente').textContent = urlAten;

    // Badge Status
    const badge = document.getElementById('empresaStatusBadge');
    badge.innerHTML = `<span class="status-badge status-${emp.status}">${emp.status}</span>`;
}

async function carregarMetricas() {
    // Buscar todos os pedidos da empresa
    const { data: orders, error } = await sb
        .from('orders')
        .select('total, created_at')
        .eq('empresa_id', EMPRESA_ID);

    if (error) return;

    const totalFaturamento = orders.reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0);
    const totalPedidos = orders.length;
    const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;

    // Faturamento do mês atual
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    const fatMes = orders.filter(o => {
        const d = new Date(o.created_at);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }).reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0);

    // Último pedido
    let ultimoPedidoStr = 'Nenhum pedido';
    if (orders.length > 0) {
        const sorted = [...orders].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        ultimoPedidoStr = new Date(sorted[0].created_at).toLocaleDateString('pt-BR') + ' ' + new Date(sorted[0].created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    }

    // Renderizar
    document.getElementById('faturamentoTotal').textContent = formatCurrency(totalFaturamento);
    document.getElementById('faturamentoMes').textContent = formatCurrency(fatMes);
    document.getElementById('totalPedidos').textContent = totalPedidos;
    document.getElementById('ticketMedio').textContent = formatCurrency(ticketMedio);
    document.getElementById('infoUltimoPedido').textContent = ultimoPedidoStr;
    document.getElementById('infoTicketGeral').textContent = formatCurrency(ticketMedio);
}

async function carregarAdmins() {
    const { data: admins, error } = await sb
        .from('usuarios')
        .select('*')
        .eq('empresa_id', EMPRESA_ID)
        .eq('role', 'admin');

    if (error) return;

    const list = document.getElementById('adminList');
    document.getElementById('countAdmins').textContent = admins.length;
    
    list.innerHTML = admins.map(adm => `
        <li class="admin-item">
            <div class="admin-info">
                <strong>${adm.email.split('@')[0]}</strong>
                <span class="admin-email">${adm.email}</span>
            </div>
            <button class="btn-sm btn-delete" onclick="removerAdmin('${adm.id}', '${adm.email}')">Remover</button>
        </li>
    `).join('') || '<p style="font-size:0.8rem; color:var(--text-secondary); padding:1rem 0;">Nenhum administrador vinculado.</p>';
}

// ==========================================
// 3. Ações e Funcionalidades
// ==========================================

// Salvar Configurações (Plano e Status)
document.getElementById('btnSalvarConfig').addEventListener('click', async () => {
    const btn = document.getElementById('btnSalvarConfig');
    const plano = document.getElementById('editEmpPlano').value;
    const status = document.getElementById('editEmpStatus').value;
    const plano_vencimento = document.getElementById('editPlanoVencimento').value || null;

    // Módulos
    const modulos = {
        cardapio: document.getElementById('mod_cardapio').checked,
        frete: document.getElementById('mod_frete').checked,
        dashboard: document.getElementById('mod_dashboard').checked,
        pagamento: document.getElementById('mod_pagamento').checked,
        estoque: document.getElementById('mod_estoque').checked,
        relatorios: document.getElementById('mod_relatorios').checked
    };

    const tema_cor_primaria = document.getElementById('editTemaCorPrimaria').value;
    const tema_cor_secundaria = document.getElementById('editTemaCorSecundaria').value;
    const tema_cor_botao = document.getElementById('editTemaCorBotao').value;
    const tema_cor_bg = document.getElementById('editTemaCorBg').value;

    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const { error } = await sb
            .from('empresas')
            .update({ 
                plano, 
                status,
                plano_vencimento,
                modulos,
                tema_cor_primaria,
                tema_cor_secundaria,
                tema_cor_botao,
                tema_cor_bg,
                cor_primaria: tema_cor_primaria // Legado
            })
            .eq('id', EMPRESA_ID);

        if (error) throw error;

        showToast('Configurações atualizadas!');
        carregarDadosEmpresa();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Atualizar Configurações';
    }
});

// --- MODAIS ---
window.abrirModal = (id) => {
    document.getElementById(id).style.display = 'flex';
};

window.fecharModal = (id) => {
    document.getElementById(id).style.display = 'none';
};

// Adicionar Admin
document.getElementById('btnConfirmarNovoAdmin').addEventListener('click', async () => {
    const email = document.getElementById('newAdminEmail').value.trim();
    const password = document.getElementById('newAdminPassword').value.trim();
    const btn = document.getElementById('btnConfirmarNovoAdmin');

    if (!email || !password) {
        showToast('Preencha e-mail e senha.', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Criando...';

        // Chama a RPC para criar o usuário no auth e no public
        const { data, error } = await sb.rpc('create_new_admin_user', {
            p_email: email,
            p_password: password,
            p_empresa_id: EMPRESA_ID
        });

        if (error) throw error;

        showToast('Conta criada e vinculada com sucesso!');
        fecharModal('modalNovoAdmin');
        
        // Limpa campos
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPassword').value = '';

        carregarAdmins();
    } catch (err) {
        showToast('Erro ao criar conta: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Criar Conta';
    }
});

// Remover Admin
window.removerAdmin = async (userId, email) => {
    if (!confirm(`Deseja remover o acesso administrativo de ${email}?`)) return;

    try {
        // Desvincular usuário
        const { error } = await sb
            .from('usuarios')
            .update({ empresa_id: null, role: 'atendente' }) // volta a ser atendente sem empresa ou cargo menor
            .eq('id', userId);

        if (error) throw error;

        showToast('Administrador removido.');
        carregarAdmins();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// Cópia de URLs
window.copyToClipboard = (elementId) => {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text);
    showToast('Link copiado!');
};

window.copyAllUrls = () => {
    const menu = document.getElementById('urlMenu').textContent;
    const admin = document.getElementById('urlAdmin').textContent;
    const aten = document.getElementById('urlAtendente').textContent;

    const fullText = `🚀 *Acessos da sua Loja - RiverTech Gestão*

📍 *Link do Cardápio (Para Clientes):*
${menu}
_Divulgue este link no seu Instagram e WhatsApp._

⚙️ *Painel Administrativo (Gestão):*
${admin}
_Aqui você gerencia produtos, preços e configurações._

🎧 *Painel do Atendente (Pedidos):*
${aten}
_Use este painel para receber e gerenciar os pedidos em tempo real._`;

    navigator.clipboard.writeText(fullText);
    showToast('Todos os links copiados com instruções! ✅');
};

// --- TEMA ---
window.previewTema = () => {
    const primaria = document.getElementById('editTemaCorPrimaria').value;
    const botao = document.getElementById('editTemaCorBotao').value;
    const bg = document.getElementById('editTemaCorBg').value;

    const preview = document.getElementById('themePreview');
    const card = document.getElementById('previewCard');
    const btn = document.getElementById('previewBtn');

    if (preview) preview.style.background = bg;
    if (card) {
        card.style.background = 'rgba(255,255,255,0.05)';
        card.style.color = primaria;
    }
    if (btn) {
        btn.style.background = botao;
        btn.style.color = '#000';
    }
};

window.restaurarTemaPadrao = () => {
    document.getElementById('editTemaCorPrimaria').value = '#E5B25D';
    document.getElementById('editTemaCorSecundaria').value = '#1E90FF';
    document.getElementById('editTemaCorBotao').value = '#E5B25D';
    document.getElementById('editTemaCorBg').value = '#0d0d0d';
    previewTema();
    showToast('Padrão restaurado (não esqueça de salvar)');
};

// Utils
function formatCurrency(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#ef4444' : '#eab308';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Iniciar
init();
