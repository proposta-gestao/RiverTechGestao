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
                <a href="/admin.html?tenant=${emp.slug}" target="_blank" style="color:var(--text-secondary);text-decoration:none;font-size:0.9rem">Painel Admin ↗</a>
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
window.switchTab = (modalId, tabId) => {
    const modal = document.getElementById(modalId);
    modal.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    modal.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
};

document.getElementById('btnNovaEmpresa').addEventListener('click', () => {
    // Reset Campos
    document.getElementById('empNome').value = '';
    document.getElementById('empBrandName').value = '';
    document.getElementById('empSlug').value = '';
    document.getElementById('empPlano').value = 'premium';
    document.getElementById('empAdminEmail').value = '';
    document.getElementById('empAdminSenha').value = 'Mudar123!';
    
    // Reset Módulos (Todos ativos por padrão para facilitar)
    document.querySelectorAll('[id^="n_mod_"]').forEach(cb => cb.checked = true);
    document.querySelectorAll('[id^="n_master_"]').forEach(cb => cb.checked = true);
    document.querySelectorAll('.grupo-content').forEach(g => g.classList.remove('disabled'));

    // Reset Tema
    _setColorField('n_editTemaCorPrimaria',   'n_editTemaCorPrimariaHex',   '#E5B25D');
    _setColorField('n_editTemaCorBotao',      'n_editTemaCorBotaoHex',      '#E5B25D');
    _setColorField('n_editTemaCorBg',         'n_editTemaCorBgHex',         '#0d0d0d');
    _setColorField('n_editTemaCorSurface',    'n_editTemaCorSurfaceHex',    '#1a1a1a');
    previewTemaNovo();

    // Reset Tabs
    switchTab('modalNovaEmpresa', 'tab-geral');
    
    atualizarPreviewsURL(); 
    document.getElementById('modalNovaEmpresa').classList.add('show');
});

// Atualiza as 3 URLs em tempo real para visualização do lojista
function atualizarPreviewsURL() {
    const input = document.getElementById('empSlug').value;
    const container = document.getElementById('urlPreviews');
    
    let slug = input;
    // Tenta pegar o slug seja colando o link inteiro ou apenas o nome
    if (slug.includes('river-tech-gestao.vercel.app/')) {
        slug = slug.split('/').filter(p => p).pop() || '';
    }

    if (slug && slug !== 'river-tech-gestao.vercel.app') {
        container.style.display = 'block';
        const baseUrl = `https://river-tech-gestao.vercel.app/${slug}`;
        
        document.getElementById('previewMenu').textContent = baseUrl;
        document.getElementById('previewAgendamento').textContent = `${baseUrl}/agendar`;
        document.getElementById('previewAdmin').textContent = `${baseUrl}/painel-gestao`;
        if (document.getElementById('previewAtendente')) {
            document.getElementById('previewAtendente').textContent = `${baseUrl}/atendente`;
        }
    } else {
        container.style.display = 'none';
    }
}

document.getElementById('empSlug').addEventListener('input', atualizarPreviewsURL);

document.getElementById('btnSalvarNovaEmpresa').addEventListener('click', async () => {
    const btn = document.getElementById('btnSalvarNovaEmpresa');
    
    const p_nome = document.getElementById('empNome').value.trim();
    let p_slug = document.getElementById('empSlug').value.trim();
    const p_brand_name = document.getElementById('empBrandName').value.trim();
    const p_plano = document.getElementById('empPlano').value;
    const p_admin_email = document.getElementById('empAdminEmail').value.trim();
    const p_admin_password = document.getElementById('empAdminSenha').value.trim();

    if (!p_nome || !p_slug || !p_admin_email || !p_admin_password) {
        switchTab('modalNovaEmpresa', 'tab-geral');
        return showToast('Preencha os campos obrigatórios na aba Geral', 'error');
    }

    // Extrai apenas o final se o usuário colou a URL inteira
    if (p_slug.includes('/')) {
        p_slug = p_slug.split('/').filter(p => p).pop();
    }

    // Coletar Módulos
    const modulos = {};
    const LISTA_MOD_IDS = [
        'produtos_gerenciar', 'produtos_categorias', 'produtos_estoque',
        'vendas_visao_geral', 'metricas_dashboard', 'metricas_performance_vendas',
        'config_frete', 'pagamento', 'cupons', 'cardapio',
        'agendamento_ativo', 'agendamento_multi_profissional', 'agendamento_lista_espera',
        'agendamento_mensagens', 'agendamento_fidelidade', 'config_personalizacao'
    ];
    LISTA_MOD_IDS.forEach(key => {
        const el = document.getElementById(`n_mod_${key}`);
        if (el) modulos[key] = el.checked;
    });

    // Coletar Cores
    const tema = {
        primaria: document.getElementById('n_editTemaCorPrimaria').value,
        botao: document.getElementById('n_editTemaCorBotao').value,
        bg: document.getElementById('n_editTemaCorBg').value,
        surface: document.getElementById('n_editTemaCorSurface').value
    };

    try {
        btn.disabled = true;
        btn.textContent = 'Criando e Configurando...';

        // 1. Criar via RPC (Auth + Empresa + Settings)
        const { data: newId, error: rpcError } = await sb.rpc('create_tenant_with_admin', {
            p_nome,
            p_slug,
            p_plano,
            p_cor_primaria: tema.primaria,
            p_logo_url: "",
            p_admin_email,
            p_admin_password,
            p_brand_name: p_brand_name || p_nome
        });

        if (rpcError) throw rpcError;

        // 2. Aplicar Módulos e Tema detalhado
        const { error: updateError } = await sb
            .from('empresas')
            .update({
                modulos: modulos,
                tema_cor_primaria: tema.primaria,
                tema_cor_secundaria: '#1E90FF',
                tema_cor_botao: tema.botao,
                tema_cor_bg: tema.bg,
                tema_cor_surface: tema.surface,
                cor_primaria: tema.primaria // Legado
            })
            .eq('id', newId);

        if (updateError) throw updateError;

        showToast('Loja provisionada com sucesso! 🚀');
        fecharModal('modalNovaEmpresa');
        carregarEmpresas();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Finalizar e Criar Loja';
    }
});

// ==========================================
// 10. Editar Empresa
// ==========================================
window.abrirModalEdicao = (id) => {
    // Agora redirecionamos para a página dedicada
    window.location.href = `admin-saas-empresa.html?id=${id}`;
};

document.getElementById('btnSalvarEdicaoEmpresa').addEventListener('click', async () => {
    const btn = document.getElementById('btnSalvarEdicaoEmpresa');
    const id = document.getElementById('editEmpId').value;
    const nome = document.getElementById('editEmpNome').value;
    const plano = document.getElementById('editEmpPlano').value;
    const status = document.getElementById('editEmpStatus').value;

    const tema_cor_primaria   = document.getElementById('editTemaCorPrimaria').value;
    const tema_cor_secundaria = document.getElementById('editTemaCorSecundaria').value;
    const tema_cor_botao      = document.getElementById('editTemaCorBotao').value;
    const tema_cor_bg         = document.getElementById('editTemaCorBg').value;
    const tema_cor_surface    = document.getElementById('editTemaCorSurface').value;
    const cor_primaria        = tema_cor_primaria; // sincronizar legado

    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const { error } = await sb
            .from('empresas')
            .update({
                nome, plano, status, cor_primaria,
                tema_cor_primaria, tema_cor_secundaria,
                tema_cor_botao, tema_cor_bg, tema_cor_surface
            })
            .eq('id', id);

        if (error) throw error;

        showToast('Empresa e tema atualizados! ✅');
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
// TEMA: Helpers de preview e sync
// ==========================================
function _setColorField(pickerId, hexId, value) {
    const picker = document.getElementById(pickerId);
    const hex    = document.getElementById(hexId);
    if (picker) picker.value = value;
    if (hex)    hex.value    = value;
}

// Sincroniza o texto hex com o color picker e atualiza preview
window.syncColorPicker = (pickerId, hexId) => {
    const hexVal = document.getElementById(hexId)?.value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(hexVal)) {
        const picker = document.getElementById(pickerId);
        if (picker) picker.value = hexVal;
        previewTema();
    }
};

// Atualiza o preview ao vivo no modal
window.previewTema = () => {
    const primaria = document.getElementById('editTemaCorPrimaria')?.value || '#E5B25D';
    const bg       = document.getElementById('editTemaCorBg')?.value       || '#0d0d0d';
    const surface  = document.getElementById('editTemaCorSurface')?.value  || '#1a1a1a';
    const botao    = document.getElementById('editTemaCorBotao')?.value     || primaria;

    // Sync hex fields
    ['editTemaCorPrimaria','editTemaCorSecundaria','editTemaCorBotao','editTemaCorBg','editTemaCorSurface'].forEach(id => {
        const picker = document.getElementById(id);
        const hexEl  = document.getElementById(id + 'Hex');
        if (picker && hexEl) hexEl.value = picker.value;
    });

    const preview = document.getElementById('themePreview');
    const card    = document.getElementById('themePreviewCard');
    const price   = document.getElementById('themePreviewPrice');
    const btn     = document.getElementById('themePreviewBtn');
    const badge   = document.getElementById('themePreviewBadge');

    if (preview) preview.style.background = bg;
    if (card)    card.style.background    = surface;
    if (price)   price.style.color        = primaria;
    if (btn)   { btn.style.background     = botao;  btn.style.color = '#000'; }
    if (badge) { badge.style.background   = primaria; badge.style.color = '#000'; }
};

// Função para ativar/desativar um grupo inteiro de módulos (Nova Empresa)
window.toggleGrupoModuloNovo = (containerId, isChecked) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (isChecked) container.classList.remove('disabled');
    else container.classList.add('disabled');

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
};

// Função para expandir/colapsar os cards de módulos
window.toggleAccordionNovo = (id) => {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon_' + id);
    if (!el) return;
    
    el.classList.toggle('collapsed');
    if (icon) {
        icon.textContent = el.classList.contains('collapsed') ? '▼' : '▲';
    }
};

// Preview para o modal de NOVA empresa
window.previewTemaNovo = () => {
    const primaria = document.getElementById('n_editTemaCorPrimaria')?.value || '#E5B25D';
    const bg       = document.getElementById('n_editTemaCorBg')?.value       || '#0d0d0d';
    const surface  = document.getElementById('n_editTemaCorSurface')?.value  || '#1a1a1a';
    const botao    = document.getElementById('n_editTemaCorBotao')?.value     || primaria;

    // Sync hex fields
    ['n_editTemaCorPrimaria','n_editTemaCorBotao','n_editTemaCorBg','n_editTemaCorSurface'].forEach(id => {
        const picker = document.getElementById(id);
        const hexEl  = document.getElementById(id + 'Hex');
        if (picker && hexEl) hexEl.value = picker.value;
    });

    const preview = document.getElementById('n_themePreview');
    const card    = document.getElementById('n_themePreviewCard');
    const price   = document.getElementById('n_themePreviewPrice');
    const btn     = document.getElementById('n_themePreviewBtn');

    if (preview) preview.style.background = bg;
    if (card)    card.style.background    = surface;
    if (price)   price.style.color        = primaria;
    if (btn)   { btn.style.background     = botao;  btn.style.color = '#000'; }
};

// Restaura as cores para o padrão Premium
window.restaurarTemapadrao = () => {
    _setColorField('editTemaCorPrimaria',   'editTemaCorPrimariaHex',   '#E5B25D');
    _setColorField('editTemaCorSecundaria', 'editTemaCorSecundariaHex', '#1E90FF');
    _setColorField('editTemaCorBotao',      'editTemaCorBotaoHex',      '#E5B25D');
    _setColorField('editTemaCorBg',         'editTemaCorBgHex',         '#0d0d0d');
    _setColorField('editTemaCorSurface',    'editTemaCorSurfaceHex',    '#1a1a1a');
    previewTema();
    showToast('Tema padrão restaurado!');
};

// ==========================================
// Boot
// ==========================================
window.onload = async () => {
    const temSessao = await verificarSessao();
    if (temSessao) {
        iniciarPainel();
    }
};
