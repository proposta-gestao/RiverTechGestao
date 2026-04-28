// admin-saas.js - Lógica do Painel Global Super Admin

// ==========================================
// 1. Configuração do Supabase
// ==========================================
const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. Variáveis de Estado Global
// ==========================================
let EMPRESAS = [];

// ==========================================
// 3. Sistema de Notificações (Toast)
// ==========================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==========================================
// 4. Autenticação e Sessão
// ==========================================
async function verificarSessao() {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session) return false;

    // Verificar se é super admin usando RPC
    const { data: isSuper, error: errSuper } = await sb.rpc('is_super_admin', { _user_id: session.user.id });
    
    if (errSuper || !isSuper) {
        console.error('Usuário não é super admin.', errSuper);
        await sb.auth.signOut();
        return false;
    }
    
    return true;
}

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginSenha').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('btnLogin');

    if (!email || !password) {
        errorEl.textContent = 'Preencha todos os campos.';
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Entrando...';
        
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const isSuper = await verificarSessao();
        if (!isSuper) {
            throw new Error('Acesso negado. Apenas super admins.');
        }

        iniciarPainel();

    } catch (err) {
        errorEl.textContent = err.message || 'Erro ao fazer login.';
        btn.disabled = false;
        btn.textContent = 'Entrar no Sistema';
    }
});

// Suporte à tecla Enter no Login
document.getElementById('loginSenha').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnLogin').click();
});
document.getElementById('loginEmail').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnLogin').click();
});

document.getElementById('btnSair').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.reload();
});

// ==========================================
// 5. Inicialização do Painel
// ==========================================
async function iniciarPainel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').style.display = 'grid';
    
    carregarEmpresas();
}

// ==========================================
// 6. Navegação Sidebar
// ==========================================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const target = item.getAttribute('data-target');
        document.getElementById(`view-${target}`).classList.add('active');
    });
});

// ==========================================
// 7. Gerenciamento de Empresas (Tenants)
// ==========================================
async function carregarEmpresas() {
    try {
        const { data, error } = await sb.from('empresas').select('*').order('criado_em', { ascending: false });
        if (error) throw error;
        
        EMPRESAS = data || [];
        renderizarEmpresas();
        atualizarMetricas();
    } catch (err) {
        showToast('Erro ao carregar empresas: ' + err.message, 'error');
    }
}

function atualizarMetricas() {
    const total = EMPRESAS.length;
    const ativas = EMPRESAS.filter(e => e.status === 'ativo').length;
    const inativas = EMPRESAS.filter(e => e.status === 'inativo').length;
    const premium = EMPRESAS.filter(e => e.plano === 'premium').length;

    document.getElementById('metricTotal').textContent = total;
    document.getElementById('metricAtivas').textContent = ativas;
    document.getElementById('metricInativas').textContent = inativas;
    document.getElementById('metricPremium').textContent = premium;
}

function renderizarEmpresas() {
    const tbody = document.getElementById('listaEmpresas');
    tbody.innerHTML = '';

    if (EMPRESAS.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhuma empresa encontrada.</td></tr>';
        return;
    }

    EMPRESAS.forEach(emp => {
        const tr = document.createElement('tr');
        
        const badgeStatus = emp.status === 'ativo' ? 'badge-ativo' : 'badge-inativo';
        const badgePlano = `badge-${emp.plano}`;
        
        tr.innerHTML = `
            <td>
                <strong>${emp.nome}</strong><br>
                <small style="color:var(--text-secondary)">ID: ${emp.id.split('-')[0]}...</small>
            </td>
            <td><code style="background:#27272a;padding:2px 6px;border-radius:4px">https://river-tech-gestao.vercel.app/${emp.slug}</code></td>
            <td><span class="badge badge-plano ${badgePlano}">${emp.plano}</span></td>
            <td><span class="badge ${badgeStatus}">${emp.status}</span></td>
            <td class="action-links">
                <button onclick="abrirModalEdicao('${emp.id}')">Editar</button>
                <a href="/${emp.slug}/cardapio" target="_blank" style="color:var(--text-secondary);text-decoration:none;font-size:0.9rem">Ver Loja ↗</a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 8. Modais (Abrir / Fechar)
// ==========================================
function fecharModal(id) {
    document.getElementById(id).classList.remove('show');
}

// ==========================================
// 9. Criar Nova Empresa
// ==========================================
document.getElementById('btnNovaEmpresa').addEventListener('click', () => {
    document.getElementById('empNome').value = '';
    document.getElementById('empSlug').value = 'https://river-tech-gestao.vercel.app/';
    document.getElementById('empPlano').value = 'basico';
    document.getElementById('empCor').value = '#FF5733';
    document.getElementById('empAdminEmail').value = '';
    document.getElementById('empAdminSenha').value = 'Mudar123!';
    document.getElementById('modalNovaEmpresa').classList.add('show');
});

document.getElementById('btnSalvarNovaEmpresa').addEventListener('click', async () => {
    const btn = document.getElementById('btnSalvarNovaEmpresa');
    
    const p_nome = document.getElementById('empNome').value;
    let p_slug = document.getElementById('empSlug').value;
    
    // Extrai apenas o final se o usuário manteve a URL base
    if (p_slug.includes('river-tech-gestao.vercel.app/')) {
        p_slug = p_slug.split('/').filter(p => p).pop();
    }
    
    const p_plano = document.getElementById('empPlano').value;
    const p_cor_primaria = document.getElementById('empCor').value;
    const p_admin_email = document.getElementById('empAdminEmail').value;
    const p_admin_password = document.getElementById('empAdminSenha').value;

    if (!p_nome || !p_slug || !p_admin_email || !p_admin_password) {
        return showToast('Preencha os campos obrigatórios', 'error');
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Criando...';

        // Chama a RPC que cria tudo (Evita deslogar o Super Admin pelo signUp)
        const { data, error } = await sb.rpc('create_tenant_with_admin', {
            p_nome,
            p_slug,
            p_plano,
            p_cor_primaria,
            p_logo_url: "",
            p_admin_email,
            p_admin_password
        });

        if (error) {
            // Se erro for de slug único
            if (error.message.includes('unique constraint')) {
                throw new Error('Já existe uma empresa com esse slug.');
            }
            throw error;
        }

        showToast('Empresa e administrador criados com sucesso!');
        fecharModal('modalNovaEmpresa');
        carregarEmpresas();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Criar e Provisionar';
    }
});

// ==========================================
// 10. Editar Empresa
// ==========================================
window.abrirModalEdicao = (id) => {
    const emp = EMPRESAS.find(e => e.id === id);
    if (!emp) return;

    document.getElementById('editEmpId').value = emp.id;
    document.getElementById('editEmpNome').value = emp.nome;
    document.getElementById('editEmpPlano').value = emp.plano;
    document.getElementById('editEmpStatus').value = emp.status;
    document.getElementById('editEmpCor').value = emp.cor_primaria || '#FF5733';

    document.getElementById('modalEditarEmpresa').classList.add('show');
};

document.getElementById('btnSalvarEdicaoEmpresa').addEventListener('click', async () => {
    const btn = document.getElementById('btnSalvarEdicaoEmpresa');
    const id = document.getElementById('editEmpId').value;
    const nome = document.getElementById('editEmpNome').value;
    const plano = document.getElementById('editEmpPlano').value;
    const status = document.getElementById('editEmpStatus').value;
    const cor_primaria = document.getElementById('editEmpCor').value;

    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const { error } = await sb
            .from('empresas')
            .update({ nome, plano, status, cor_primaria })
            .eq('id', id);

        if (error) throw error;

        showToast('Empresa atualizada!');
        fecharModal('modalEditarEmpresa');
        carregarEmpresas();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Alterações';
    }
});

// ==========================================
// Boot
// ==========================================
window.onload = async () => {
    const temSessao = await verificarSessao();
    if (temSessao) {
        iniciarPainel();
    }
};
