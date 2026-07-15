// admin-saas.js - Lógica do Painel Global Super Admin

// ==========================================
// 1. Configuração do Supabase
// ==========================================
const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

// ==========================================
// 2. Variáveis de Estado Global
// ==========================================
let EMPRESAS = [];
let SALES_DATA = { total: 0, byStore: {} };

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

function _darkenHex(hex, percent) {
    if (!hex) return '#000000';
    let r = parseInt(hex.substring(1,3), 16);
    let g = parseInt(hex.substring(3,5), 16);
    let b = parseInt(hex.substring(5,7), 16);
    r = Math.floor(r * (100 - percent) / 100);
    g = Math.floor(g * (100 - percent) / 100);
    b = Math.floor(b * (100 - percent) / 100);
    const toHex = (n) => {
        const h = n.toString(16);
        return h.length === 1 ? '0' + h : h;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function iniciarPainel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').style.display = 'flex';
    
    carregarEmpresas();

    // Listener para o novo botão de limpeza
    const btnLimpar = document.getElementById('btnLimparVendas');
    if (btnLimpar) {
        btnLimpar.addEventListener('click', limparVendasGlobais);
    }
}

async function limparVendasGlobais() {
    const confirmacao = confirm("⚠️ ATENÇÃO: Isso irá apagar TODAS as vendas e agendamentos de TODAS as empresas. Esta ação não pode ser desfeita. Deseja continuar?");
    
    if (!confirmacao) return;

    try {
        showToast('Iniciando limpeza...', 'warning');

        // 1. Limpar Itens de Pedidos
        const { error: errItems } = await sb.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (errItems) throw errItems;

        // 2. Limpar Pedidos
        const { error: errOrders } = await sb.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (errOrders) throw errOrders;

        // 3. Limpar Agendamentos
        const { error: errAgendamentos } = await sb.from('agendamentos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (errAgendamentos) throw errAgendamentos;

        showToast('Base de vendas limpa com sucesso! ✨');
        
        // Recarregar métricas
        carregarFaturamentoGlobal();
        
    } catch (err) {
        console.error('[Limpeza] Erro:', err);
        showToast('Erro na limpeza: ' + err.message, 'error');
    }
}

// ==========================================
// 6. Navegação (Topbar e Mobile)
// ==========================================

function alternarSecao(target) {
    // Esconder todas as seções
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    // Mostrar a seção alvo
    const secao = document.getElementById(`view-${target}`);
    if (secao) secao.classList.add('active');

    // Atualizar estado ativo nos botões (Desktop)
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-target') === target);
    });

    // Atualizar estado ativo nos itens (Mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-target') === target);
    });
}

// Listeners para Abas Desktop
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-target');
        alternarSecao(target);
    });
});

// Listeners para Menu Mobile
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('data-target');
        alternarSecao(target);
        
        // Fecha o menu mobile após clicar
        fecharMenuMobile();
    });
});

// Controle do Menu Mobile
function toggleMenuMobile() {
    const sidebar = document.getElementById('sidebar');
    const isVisible = sidebar.classList.toggle('active');
    
    // Opcional: Garante que o overlay acompanhe (se o CSS não usar ~ ou +)
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.style.display = isVisible ? 'block' : 'none';
}

function fecharMenuMobile() {
    document.getElementById('sidebar').classList.remove('active');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.style.display = 'none';
}

if (document.getElementById('btnMobileMenu')) {
    document.getElementById('btnMobileMenu').addEventListener('click', toggleMenuMobile);
}

if (document.getElementById('btnCloseMobile')) {
    document.getElementById('btnCloseMobile').addEventListener('click', fecharMenuMobile);
}

if (document.getElementById('sidebarOverlay')) {
    document.getElementById('sidebarOverlay').addEventListener('click', fecharMenuMobile);
}

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
        carregarFaturamentoGlobal(); // Nova métrica global
    } catch (err) {
        showToast('Erro ao carregar empresas: ' + err.message, 'error');
    }
}

async function carregarFaturamentoGlobal() {
    try {
        // Reiniciar dados
        SALES_DATA = { total: 0, byStore: {} };
        
        // 1. Buscar Pedidos (Produtos) concluídos/finalizados de todas as lojas
        // Aumentamos o range para garantir que pegamos um volume maior de vendas globais
        const { data: orders, error: errOrders } = await sb
            .from('orders')
            .select('total, empresa_id')
            .in('status', ['concluido', 'finalizado'])
            .range(0, 5000); // Suporte inicial para até 5k vendas globais

        if (errOrders) throw errOrders;

        // 2. Buscar Agendamentos (Serviços) concluídos de todas as lojas
        const { data: appts, error: errAppts } = await sb
            .from('agendamentos')
            .select('empresa_id, status, servico:servicos(preco)')
            .eq('status', 'concluido')
            .range(0, 5000);

        if (errAppts) throw errAppts;

        // 3. Processar Produtos
        (orders || []).forEach(o => {
            const tid = o.empresa_id;
            if (!SALES_DATA.byStore[tid]) SALES_DATA.byStore[tid] = { products: 0, services: 0 };
            SALES_DATA.byStore[tid].products += parseFloat(o.total || 0);
        });

        // 4. Processar Serviços
        (appts || []).forEach(a => {
            const tid = a.empresa_id;
            if (!SALES_DATA.byStore[tid]) SALES_DATA.byStore[tid] = { products: 0, services: 0 };
            SALES_DATA.byStore[tid].services += parseFloat(a.servico?.preco || 0);
        });

        // 5. Calcular Total Geral
        SALES_DATA.total = Object.values(SALES_DATA.byStore).reduce((acc, curr) => acc + curr.products + curr.services, 0);

        // 6. Atualizar UI
        const el = document.getElementById('metricFaturamento');
        if (el) el.textContent = formatCurrency(SALES_DATA.total);

    } catch (err) {
        console.error('[Finance] Erro ao carregar métricas globais:', err);
    }
}

function abrirBreakdownFaturamento() {
    const tbody = document.getElementById('listaFaturamentoLojas');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    // 1. Garantir que todas as lojas de EMPRESAS apareçam, mesmo com R$ 0,00
    // Ordenar pelo faturamento total descrescente
    const lojasOrdenadas = [...EMPRESAS].sort((a, b) => {
        const dataA = SALES_DATA.byStore[a.id] || { products: 0, services: 0 };
        const dataB = SALES_DATA.byStore[b.id] || { products: 0, services: 0 };
        const totalA = dataA.products + dataA.services;
        const totalB = dataB.products + dataB.services;
        return totalB - totalA;
    });

    if (lojasOrdenadas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-secondary);">Nenhuma empresa cadastrada.</td></tr>';
    } else {
        lojasOrdenadas.forEach(emp => {
            const data = SALES_DATA.byStore[emp.id] || { products: 0, services: 0 };
            const total = data.products + data.services;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 700;">${emp.nome}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); opacity: 0.7;">${emp.slug}</div>
                </td>
                <td style="text-align: right; color: var(--text-secondary);">${formatCurrency(data.products)}</td>
                <td style="text-align: right; color: var(--text-secondary);">${formatCurrency(data.services)}</td>
                <td style="text-align: right;"><strong style="color: var(--accent-gold);">${formatCurrency(total)}</strong></td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('modalFaturamentoLojas').classList.add('show');
}

function formatCurrency(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
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
                <strong class="clickable-name" onclick="abrirModalEdicao('${emp.id}')">${emp.nome}</strong><br>
                <small style="color:var(--text-secondary)">ID: ${emp.id.split('-')[0]}...</small>
            </td>
            <td><span class="badge badge-plano ${badgePlano}">${emp.plano}</span></td>
            <td><span class="badge ${badgeStatus}">${emp.status}</span></td>
            <td class="action-links">
                <button onclick="abrirModalEdicao('${emp.id}')">Editar</button>
                <a href="/admin.html?tenant=${emp.slug}" target="_blank" style="color:var(--text-secondary);text-decoration:none;font-size:0.9rem">Painel Admin ↗</a>
                <a href="/apresentacao/${emp.slug}" target="_blank" style="color:var(--accent-gold);text-decoration:none;font-size:0.85rem;opacity:0.8" title="Apresentação comercial">🎴 Proposta ↗</a>
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
    document.getElementById('empSegmento').value = '';
    document.getElementById('empAdminEmail').value = '';
    document.getElementById('empAdminSenha').value = 'Mudar123!';
    
    // Reset Módulos (Todos desativados para forçar seleção via segmento)
    document.querySelectorAll('[id^="n_mod_"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('[id^="n_master_"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('.grupo-content').forEach(g => g.classList.add('disabled'));

    _setColorField('n_editTemaCorPrimaria',   'n_editTemaCorPrimariaHex',   '#E5B25D');
    _setColorField('n_editTemaCorSecundaria', 'n_editTemaCorSecundariaHex', '#1E90FF');
    _setColorField('n_editTemaCorBotao',      'n_editTemaCorBotaoHex',      '#E5B25D');
    _setColorField('n_editTemaCorHover',      'n_editTemaCorHoverHex',      '#d4a14c');
    _setColorField('n_editTemaCorBg',         'n_editTemaCorBgHex',         '#0d0d0d');
    _setColorField('n_editTemaCorSurface',    'n_editTemaCorSurfaceHex',    '#1a1a1a');
    _setColorField('n_editTemaCorBorda',      'n_editTemaCorBordaHex',      '#333333');
    _setColorField('n_editTemaCorTexto',      'n_editTemaCorTextoHex',      '#ffffff');
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
        if (document.getElementById('previewApresentacao')) {
            document.getElementById('previewApresentacao').textContent = `https://river-tech-gestao.vercel.app/apresentacao/${slug}`;
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
    const p_segmento = document.getElementById('empSegmento').value;
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
        'produtos_gerenciar', 'produtos_categorias', 'produtos_estoque', 'produtos_equipe',
        'vendas_visao_geral', 'metricas_dashboard', 'metricas_performance_vendas',
        'config_frete', 'pagamento', 'cupons', 'cardapio',
        'agendamento_ativo', 'agendamento_multi_profissional', 'agendamento_lista_espera',
        'agendamento_mensagens', 'agendamento_fidelidade', 'config_personalizacao',
        'loja_roupas', 'loja_estoque'
    ];
    LISTA_MOD_IDS.forEach(key => {
        const el = document.getElementById(`n_mod_${key}`);
        if (el) modulos[key] = el.checked;
    });

    // Coletar Cores
    const tema = {
        primaria:   document.getElementById('n_editTemaCorPrimaria').value,
        secundaria: document.getElementById('n_editTemaCorSecundaria').value,
        botao:      document.getElementById('n_editTemaCorBotao').value,
        hover:      document.getElementById('n_editTemaCorHover').value,
        bg:         document.getElementById('n_editTemaCorBg').value,
        surface:    document.getElementById('n_editTemaCorSurface').value,
        borda:      document.getElementById('n_editTemaCorBorda').value,
        texto:      document.getElementById('n_editTemaCorTexto').value
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

        // 2. Aplicar Módulos, Tema e Segmento
        const PRESETS = _getSegmentPreset(p_segmento);
        
        // Mesclar os módulos do preset (que contêm módulos ocultos essenciais como config_endereco) 
        // com os módulos coletados dos checkboxes na UI
        const modulosFinais = { ...PRESETS.modulos, ...modulos };

        const { error: updateError } = await sb
            .from('empresas')
            .update({
                modulos: modulosFinais,
                segmento: p_segmento || null,
                tema_cor_primaria: tema.primaria,
                tema_cor_secundaria: tema.secundaria,
                tema_cor_botao: tema.botao,
                tema_cor_hover: tema.hover,
                tema_cor_bg: tema.bg,
                tema_cor_surface: tema.surface,
                tema_cor_borda: tema.borda,
                tema_cor_texto: tema.texto,
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
    const tema_cor_hover      = document.getElementById('editTemaCorHover').value;
    const tema_cor_bg         = document.getElementById('editTemaCorBg').value;
    const tema_cor_surface    = document.getElementById('editTemaCorSurface').value;
    const tema_cor_borda      = document.getElementById('editTemaCorBorda').value;
    const tema_cor_texto      = document.getElementById('editTemaCorTexto').value;
    const cor_primaria        = tema_cor_primaria; // sincronizar legado

    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const { error } = await sb
            .from('empresas')
            .update({
                nome, plano, status, cor_primaria,
                tema_cor_primaria, tema_cor_secundaria,
                tema_cor_botao, tema_cor_hover, tema_cor_bg, tema_cor_surface,
                tema_cor_borda, tema_cor_texto
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
    const hover    = document.getElementById('editTemaCorHover')?.value     || '#d4a14c';

    // Sync hex fields
    ['editTemaCorPrimaria','editTemaCorSecundaria','editTemaCorBotao','editTemaCorHover','editTemaCorBg','editTemaCorSurface','editTemaCorBorda','editTemaCorTexto'].forEach(id => {
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
    if (btn)   { 
        btn.style.background     = botao;  
        btn.style.color = '#000'; 
        btn.onmouseenter = () => btn.style.background = hover;
        btn.onmouseleave = () => btn.style.background = botao;
    }
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

window.previewTemaNovo = () => {
    const primaria = document.getElementById('n_editTemaCorPrimaria')?.value || '#E5B25D';
    const bg       = document.getElementById('n_editTemaCorBg')?.value       || '#0d0d0d';
    const surface  = document.getElementById('n_editTemaCorSurface')?.value  || '#1a1a1a';
    const botao    = document.getElementById('n_editTemaCorBotao')?.value     || primaria;
    const hover    = document.getElementById('n_editTemaCorHover')?.value     || '#d4a14c';

    // Sync hex fields
    ['n_editTemaCorPrimaria','n_editTemaCorSecundaria','n_editTemaCorBotao','n_editTemaCorHover','n_editTemaCorBg','n_editTemaCorSurface','n_editTemaCorBorda','n_editTemaCorTexto'].forEach(id => {
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
    if (btn)   { 
        btn.style.background     = botao;  
        btn.style.color = '#000'; 
        btn.onmouseenter = () => btn.style.background = hover;
        btn.onmouseleave = () => btn.style.background = botao;
    }
};

// ==========================================
// PRESETS POR SEGMENTO (Theme Manager)
// ==========================================

/**
 * Retorna o preset de módulos e tema para um dado segmento.
 * Baseado nas definições do ThemeManager (themes.css).
 */
function _getSegmentPreset(segmento) {
    const PRESETS = {
        restaurante: {
            modulos: {
                // Produtos
                produtos_gerenciar: true, produtos_categorias: true, produtos_estoque: true, produtos_equipe: true,
                // Vendas
                vendas_hoje_op: true, vendas_ontem_op: true, vendas_visao_geral: true,
                metricas_dashboard: true, metricas_analise_tempo: true,
                metricas_performance_vendas: true, metricas_destaques: true,
                // Operações
                config_frete: true, pagamento: true, cupons: true, cardapio: true,
                config_personalizacao: true, config_endereco: true, config_cancelamentos: true,
                // Inativo
                agendamento_ativo: false, agendamento_multi_profissional: false,
                agendamento_lista_espera: false, agendamento_mensagens: false, agendamento_fidelidade: false,
                loja_roupas: false
            },
            tema: { primaria: '#FF6B35', secundaria: '#F54719', botao: '#FF6B35', bg: '#0f0f0f', surface: '#1a1a1a',
                    borda: 'rgba(255,107,53,0.25)', texto: '#ffffff', themeClass: 'restaurant' }
        },
        barbearia: {
            modulos: {
                // Vendas
                vendas_hoje_op: true, vendas_ontem_op: true, vendas_visao_geral: true,
                metricas_dashboard: true, metricas_analise_tempo: true,
                metricas_performance_vendas: true, metricas_destaques: true,
                // Agendamento
                agendamento_ativo: true, agendamento_multi_profissional: true,
                agendamento_lista_espera: true, agendamento_mensagens: true, agendamento_fidelidade: true,
                // Inativo
                produtos_gerenciar: false, produtos_categorias: false, produtos_estoque: false, produtos_equipe: false,
                config_frete: false, pagamento: true, cupons: false, cardapio: false,
                config_personalizacao: true, config_endereco: true, config_cancelamentos: true,
                loja_roupas: false
            },
            tema: { primaria: '#d4af37', secundaria: '#c4952e', botao: '#d4af37', bg: '#0a0a0a', surface: '#161616',
                    borda: 'rgba(212,175,55,0.2)', texto: '#ffffff', themeClass: 'barbershop' }
        },
        loja_roupas: {
            modulos: {
                // Loja
                loja_roupas: true, loja_estoque: true,
                // Vendas
                vendas_hoje_op: true, vendas_ontem_op: true, vendas_visao_geral: true,
                metricas_dashboard: true, metricas_analise_tempo: true,
                metricas_performance_vendas: true, metricas_destaques: true,
                // Operações
                config_frete: true, pagamento: true, cupons: true, cardapio: false,
                config_personalizacao: true, config_endereco: true, config_cancelamentos: true,
                // Inativo
                produtos_gerenciar: false, produtos_categorias: false, produtos_estoque: false, produtos_equipe: false,
                agendamento_ativo: false, agendamento_multi_profissional: false,
                agendamento_lista_espera: false, agendamento_mensagens: false, agendamento_fidelidade: false
            },
            tema: { primaria: '#d4af37', secundaria: '#1e3a8a', botao: '#d4af37', bg: '#0f172a', surface: '#1e293b',
                    borda: 'rgba(212,175,55,0.2)', texto: '#ffffff', themeClass: 'clothing' }
        }
    };
    return PRESETS[segmento] || { modulos: {}, tema: { primaria: '#E5B25D', secundaria: '#1E90FF', botao: '#E5B25D', bg: '#0d0d0d', surface: '#1a1a1a', borda: 'rgba(229,178,93,0.2)', texto: '#ffffff', themeClass: null } };
}

/**
 * Aplicado ao selecionar o segmento no formulário de Nova Empresa.
 * Auto-configura módulos, cores e atualiza o preview.
 */
window.aplicarPresetSegmento = (segmento) => {
    if (!segmento) return;
    const preset = _getSegmentPreset(segmento);

    // 1. Aplicar Módulos
    const mods = preset.modulos;
    Object.entries(mods).forEach(([key, val]) => {
        const el = document.getElementById(`n_mod_${key}`);
        if (el) el.checked = val;
    });

    // Atualizar masters e estados visuais dos grupos
    const grupos = [
        { master: 'n_master_produtos',     content: 'n_grupo_produtos',     keys: ['produtos_gerenciar','produtos_categorias','produtos_estoque','produtos_equipe'] },
        { master: 'n_master_vendas',       content: 'n_grupo_vendas',       keys: ['vendas_visao_geral','metricas_dashboard','metricas_performance_vendas'] },
        { master: 'n_master_ops',          content: 'n_grupo_ops',          keys: ['config_frete','pagamento','cupons','cardapio'] },
        { master: 'n_master_agendamento',  content: 'n_grupo_agendamento',  keys: ['agendamento_ativo','agendamento_multi_profissional','agendamento_lista_espera'] },
        { master: 'n_master_loja',         content: 'n_grupo_loja',         keys: ['loja_roupas'] },
    ];
    grupos.forEach(({ master, content, keys }) => {
        const grupoAtivo = keys.some(k => mods[k]);
        const masterEl = document.getElementById(master);
        const contentEl = document.getElementById(content);
        if (masterEl) masterEl.checked = grupoAtivo;
        if (contentEl) {
            if (grupoAtivo) contentEl.classList.remove('disabled');
            else contentEl.classList.add('disabled');
        }
    });

    // 2. Aplicar Cores
    const t = preset.tema;
    _setColorField('n_editTemaCorPrimaria',  'n_editTemaCorPrimariaHex',  t.primaria);
    _setColorField('n_editTemaCorSecundaria','n_editTemaCorSecundariaHex',t.secundaria);
    _setColorField('n_editTemaCorBotao',     'n_editTemaCorBotaoHex',     t.botao);
    _setColorField('n_editTemaCorHover',     'n_editTemaCorHoverHex',     _darkenHex(t.botao, 8));
    _setColorField('n_editTemaCorBg',        'n_editTemaCorBgHex',        t.bg);
    _setColorField('n_editTemaCorSurface',   'n_editTemaCorSurfaceHex',   t.surface);
    _setColorField('n_editTemaCorBorda',     'n_editTemaCorBordaHex',     t.borda);
    _setColorField('n_editTemaCorTexto',     'n_editTemaCorTextoHex',     t.texto);
    previewTemaNovo();

    // 3. Mostrar toast de confirmação
    const nomes = { restaurante: 'Bares/Restaurantes 🍽️', barbearia: 'Barbearia 💈', loja_roupas: 'Loja de Roupas 👗' };
    showToast(`Preset "${nomes[segmento] || segmento}" aplicado! Revise módulos e tema.`);

    // 4. Navegar automaticamente para a aba de módulos para revisão
    switchTab('modalNovaEmpresa', 'tab-modulos');
};

// Restaura as cores para o padrão Premium
window.restaurarTemapadrao = () => {
    _setColorField('editTemaCorPrimaria',   'editTemaCorPrimariaHex',   '#E5B25D');
    _setColorField('editTemaCorSecundaria', 'editTemaCorSecundariaHex', '#1E90FF');
    _setColorField('editTemaCorBotao',      'editTemaCorBotaoHex',      '#E5B25D');
    _setColorField('editTemaCorHover',      'editTemaCorHoverHex',      '#d4a14c');
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
