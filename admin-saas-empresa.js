// admin-saas-empresa.js - Lógica de Gestão 360º da Empresa

const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

let EMPRESA_ID = null;
let EMPRESA_DATA = null;
let STORE_SETTINGS_DATA = null; // Armazena o ID e dados atuais do branding

// ==========================================
// 1. Inicialização e Segurança
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

    // 4. Configurações Específicas
    await carregarConfiguracoesLoja();

    // 5. Status do PIX
    carregarStatusPix();

    // 6. Propostas Comerciais
    carregarPropostas(empresa.slug);
}

async function carregarConfiguracoesLoja() {
    const { data: settings, error } = await sb.from('store_settings').select('*').eq('empresa_id', EMPRESA_ID).single();
    if (error && error.code !== 'PGRST116') return;

    if (settings) {
        STORE_SETTINGS_DATA = settings;
        document.getElementById('editBrandName').value = settings.brand_name || '';
        document.getElementById('editBrandSubtitle').value = settings.brand_subtitle || '';
    }
}

// Lista completa de chaves de módulos para sincronização
const LISTA_MODULOS = [
    'produtos_gerenciar', 'produtos_categorias', 'produtos_estoque', 'produtos_equipe',
    'vendas_hoje_op', 'vendas_ontem_op', 'vendas_visao_geral',
    'metricas_dashboard', 'metricas_analise_tempo', 'metricas_performance_vendas', 'metricas_destaques',
    'config_endereco', 'config_personalizacao', 'config_frete', 'config_cancelamentos',
    'cupons', 'cardapio', 'pagamento', 'pedido_mesa',
    // Módulos de Agendamento
    'agendamento_ativo', 'agendamento_multi_profissional', 'agendamento_lista_espera',
    'agendamento_mensagens', 'agendamento_fidelidade',
    // Módulo de Loja de Roupas
    'loja_roupas', 'loja_estoque',
    // Módulo de Clientes Premium
    'clientes_premium'
];

function renderDadosBasicos(emp) {
    document.getElementById('empresaNome').textContent = emp.nome;
    document.getElementById('editEmpNome').value = emp.nome;
    // Se a função applyCnpjMask já estiver carregada (estará no hoisting ou definimos global)
    document.getElementById('editEmpCNPJ').value = emp.cnpj ? applyCnpjMask(emp.cnpj) : '';
    document.getElementById('editEmpPlano').value = emp.plano;
    document.getElementById('editEmpSegmento').value = emp.segmento || '';
    document.getElementById('editEmpStatus').value = emp.status;
    document.getElementById('editPlanoVencimento').value = emp.plano_vencimento || '';
    document.getElementById('infoId').textContent = emp.id;
    
    // Formatação de data brasileira segura
    const dCriacao = new Date(emp.criado_em);
    const dataFormatada = isNaN(dCriacao) ? 'â€”' : dCriacao.toLocaleDateString('pt-BR');
    document.getElementById('infoCriacao').textContent = dataFormatada;
 
    // Módulos (Feature Flags) - Popula todos os checkboxes dinamicamente
    const mods = emp.modulos || {};
    LISTA_MODULOS.forEach(key => {
        const el = document.getElementById(`mod_${key}`);
        if (el) el.checked = mods[key] !== false;
    });

    // Sincronizar Master Toggles e Estado dos Containers
    ['produtos', 'vendas', 'ops', 'agendamento', 'loja', 'premium'].forEach(g => {
        const container = document.getElementById(`grupo_${g}`);
        const master = document.getElementById(`master_${g}`);
        if (container && master) {
            const checkboxes = container.querySelectorAll('input[id^="mod_"]');
            const atLeastOneOn = Array.from(checkboxes).some(cb => cb.checked);
            master.checked = atLeastOneOn;
            if (!atLeastOneOn) container.classList.add('disabled');
            else container.classList.remove('disabled');
        }
    });
 
    // Tema
    if(document.getElementById('editTemaCorPrimaria'))   document.getElementById('editTemaCorPrimaria').value = emp.tema_cor_primaria || '#E5B25D';
    if(document.getElementById('editTemaCorSecundaria')) document.getElementById('editTemaCorSecundaria').value = emp.tema_cor_secundaria || '#1E90FF';
    if(document.getElementById('editTemaCorBotao'))      document.getElementById('editTemaCorBotao').value = emp.tema_cor_botao || emp.tema_cor_primaria || '#E5B25D';
    if(document.getElementById('editTemaCorHover'))      document.getElementById('editTemaCorHover').value = emp.tema_cor_hover || _darkenHex(emp.tema_cor_botao || emp.tema_cor_primaria || '#E5B25D', 8);
    if(document.getElementById('editTemaCorBg'))         document.getElementById('editTemaCorBg').value = emp.tema_cor_bg || '#0d0d0d';
    if(document.getElementById('editTemaCorSurface'))    document.getElementById('editTemaCorSurface').value = emp.tema_cor_surface || '#1a1a1a';
    if(document.getElementById('editTemaCorBorda'))      document.getElementById('editTemaCorBorda').value = emp.tema_cor_borda || 'rgba(229,178,93,0.2)';
    if(document.getElementById('editTemaCorTexto'))      document.getElementById('editTemaCorTexto').value = emp.tema_cor_texto || '#ffffff';
    previewTema();
 
    // URLs
    const baseUrl = window.location.origin;
    const urlMenu = `${baseUrl}/${emp.slug}`;
    const urlLoja = `${baseUrl}/loja.html?tenant=${emp.slug}`;
    const urlAdmin = `${baseUrl}/admin.html?tenant=${emp.slug}`;
    const urlAten = `${baseUrl}/atendente.html?tenant=${emp.slug}`;
    const urlAgendamento = `${baseUrl}/agendamento.html?tenant=${emp.slug}`;
 
    document.getElementById('urlMenu').textContent = `/${emp.slug}`;
    document.getElementById('urlMenu').href = urlMenu;
    
    const elLoja = document.getElementById('urlLoja');
    if (elLoja) {
        elLoja.textContent = `/loja.html?tenant=${emp.slug}`;
        elLoja.href = urlLoja;
    }
    
    document.getElementById('urlAdmin').textContent = `/admin.html?tenant=${emp.slug}`;
    document.getElementById('urlAdmin').href = urlAdmin;
    
    document.getElementById('urlAtendente').textContent = `/atendente.html?tenant=${emp.slug}`;
    document.getElementById('urlAtendente').href = urlAten;

    const elAgendamento = document.getElementById('urlAgendamento');
    if (elAgendamento) {
        elAgendamento.textContent = `/agendamento.html?tenant=${emp.slug}`;
        elAgendamento.href = urlAgendamento;
    }
 
    // --- NOVOS CAMPOS DASHBOARD ---
    const planBadge = document.getElementById('infoPlanoBadge');
    if (planBadge) {
        planBadge.textContent = emp.plano || 'basico';
        planBadge.className = `plan-badge plan-${emp.plano || 'basico'}`;
    }

    const setSwatch = (id, color) => {
        const el = document.getElementById(id);
        if (el) el.style.background = color || '#333';
    };
    setSwatch('swatch-primaria',  emp.tema_cor_primaria);
    setSwatch('swatch-secundaria',emp.tema_cor_secundaria || '#1E90FF');
    setSwatch('swatch-botao',     emp.tema_cor_botao || emp.tema_cor_primaria);
    setSwatch('swatch-bg',        emp.tema_cor_bg);
    setSwatch('swatch-surface',   emp.tema_cor_surface || '#1a1a1a');
    setSwatch('swatch-borda',     emp.tema_cor_borda);
    setSwatch('swatch-texto',     emp.tema_cor_texto);

    const adminLink = document.getElementById('infoUrlAdmin');
    if (adminLink) adminLink.href = urlAdmin;

    // Badge Status
    const badge = document.getElementById('empresaStatusBadge');
    badge.innerHTML = `<span class="status-badge status-${emp.status}">${emp.status}</span>`;
}

async function carregarMetricas() {
    try {
        // 1. Buscar Pedidos (Produtos) concluídos/finalizados
        const { data: orders, error: errOrders } = await sb
            .from('orders')
            .select('total, created_at, status')
            .eq('empresa_id', EMPRESA_ID)
            .in('status', ['concluido', 'finalizado']);

        if (errOrders) throw errOrders;

        // 2. Buscar Agendamentos (Serviços) concluídos
        const { data: appts, error: errAppts } = await sb
            .from('agendamentos')
            .select('empresa_id, status, data_hora_inicio, servico:servicos(preco)')
            .eq('empresa_id', EMPRESA_ID)
            .eq('status', 'concluido');

        if (errAppts) throw errAppts;

        // 3. Processar Totais
        const totalFaturamentoProdutos = (orders || []).reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0);
        const totalFaturamentoServicos = (appts || []).reduce((acc, a) => acc + (parseFloat(a.servico?.preco) || 0), 0);
        
        const totalFaturamento = totalFaturamentoProdutos + totalFaturamentoServicos;
        const totalTransacoes = (orders?.length || 0) + (appts?.length || 0);
        const ticketMedio = totalTransacoes > 0 ? totalFaturamento / totalTransacoes : 0;

        // 4. Faturamento do mês atual
        const agora = new Date();
        const mesAtual = agora.getMonth();
        const anoAtual = agora.getFullYear();

        const fatMesProd = (orders || []).filter(o => {
            const d = new Date(o.created_at);
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        }).reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0);

        const fatMesServ = (appts || []).filter(a => {
            const d = new Date(a.data_hora_inicio);
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        }).reduce((acc, a) => acc + (parseFloat(a.servico?.preco) || 0), 0);

        const fatMes = fatMesProd + fatMesServ;

        // 5. Última Transação
        let ultimoPedidoStr = 'Nenhuma transação';
        const allTrans = [
            ...(orders || []).map(o => ({ date: new Date(o.created_at) })),
            ...(appts || []).map(a => ({ date: new Date(a.data_hora_inicio) }))
        ];
        
        if (allTrans.length > 0) {
            const sorted = allTrans.sort((a,b) => b.date - a.date);
            ultimoPedidoStr = sorted[0].date.toLocaleDateString('pt-BR') + ' ' + sorted[0].date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        // Renderizar
        const formatClean = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        document.getElementById('faturamentoTotal').textContent = formatClean(totalFaturamento);
        document.getElementById('faturamentoMes').textContent = formatClean(fatMes);
        document.getElementById('totalPedidos').textContent = totalTransacoes;
        document.getElementById('ticketMedio').textContent = formatClean(ticketMedio);
        document.getElementById('infoUltimoPedido').textContent = ultimoPedidoStr;
        document.getElementById('infoTicketGeral').textContent = formatClean(ticketMedio);

    } catch (err) {
        console.error('[Metrics] Erro:', err);
        showToast('Erro ao carregar métricas financeiras', 'error');
    }
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

// --- VALIDAÇÃƒO E MÃSCARA DE CNPJ ---
function cleanCnpj(value) {
    if (!value) return '';
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function applyCnpjMask(value) {
    let v = cleanCnpj(value);
    if (v.length > 14) v = v.substring(0, 14);

    if (v.length <= 2) return v;
    if (v.length <= 5) return `${v.substring(0, 2)}.${v.substring(2)}`;
    if (v.length <= 8) return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5)}`;
    if (v.length <= 12) return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8)}`;
    return `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8, 12)}-${v.substring(12, 14)}`;
}

let timeoutCnpj = null;
const inputCnpj = document.getElementById('editEmpCNPJ');
if (inputCnpj) {
    inputCnpj.addEventListener('input', (e) => {
        const input = e.target;
        let cursor = input.selectionStart;
        const oldLength = input.value.length;
        
        input.value = applyCnpjMask(input.value);
        
        // Ajusta cursor para não pular pro final se apagar no meio
        cursor += (input.value.length - oldLength);
        if(cursor >= 0) input.setSelectionRange(cursor, cursor);

        const clean = cleanCnpj(input.value);
        const statusEl = document.getElementById('cnpjStatus');
        const btnSalvar = document.getElementById('btnSalvarConfig');

        if (clean.length === 14) {
            statusEl.textContent = 'â³ Buscando...';
            statusEl.style.color = 'var(--text-secondary)';

            clearTimeout(timeoutCnpj);
            timeoutCnpj = setTimeout(async () => {
                try {
                    // API Gratuita e sem limite rigoroso
                    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
                    if (!res.ok) throw new Error('CNPJ Inválido');
                    
                    const data = await res.json();
                    statusEl.textContent = `âœ… Válido (${data.razao_social.substring(0, 15)}...)`;
                    statusEl.style.color = 'var(--accent-green)';
                    
                    // Se os campos de nome estiverem vazios, auto-preenche
                    const brandInput = document.getElementById('editBrandName');
                    const nameInput = document.getElementById('editEmpNome');
                    const sugestaoNome = data.nome_fantasia || data.razao_social;

                    if (!brandInput.value && sugestaoNome) brandInput.value = sugestaoNome;
                    if (!nameInput.value && sugestaoNome) nameInput.value = sugestaoNome;

                } catch (err) {
                    statusEl.textContent = 'âŒ Não encontrado na Receita';
                    statusEl.style.color = 'var(--accent-red)';
                }
            }, 600);
        } else {
            statusEl.textContent = clean.length > 0 ? `${clean.length}/14` : '';
            statusEl.style.color = 'var(--text-secondary)';
        }
    });
}
 
// Salvar Configurações (Plano e Status)
document.getElementById('btnSalvarConfig').addEventListener('click', async () => {
    const btn = document.getElementById('btnSalvarConfig');
    const nomeEmpresa = document.getElementById('editEmpNome').value.trim();
    const cnpj = cleanCnpj(document.getElementById('editEmpCNPJ').value); // Salvando apenas a raiz limpa
    const plano = document.getElementById('editEmpPlano').value;
    const segmento = document.getElementById('editEmpSegmento').value || null;
    const status = document.getElementById('editEmpStatus').value;
    const plano_vencimento = document.getElementById('editPlanoVencimento').value || null;
 
    // Módulos - Coleta todos os estados atuais mesclando com os existentes para não perder módulos ocultos
    const modulos = { ...(EMPRESA_DATA.modulos || {}) };
    LISTA_MODULOS.forEach(key => {
        const el = document.getElementById(`mod_${key}`);
        if (el) modulos[key] = el.checked;
    });
 
    const tema_cor_primaria   = document.getElementById('editTemaCorPrimaria')?.value || '#E5B25D';
    const tema_cor_secundaria = document.getElementById('editTemaCorSecundaria')?.value || '#1E90FF';
    const tema_cor_botao      = document.getElementById('editTemaCorBotao')?.value || '#E5B25D';
    const tema_cor_bg         = document.getElementById('editTemaCorBg')?.value || '#0d0d0d';
    const tema_cor_surface    = document.getElementById('editTemaCorSurface')?.value || '#1a1a1a';
    const tema_cor_borda      = document.getElementById('editTemaCorBorda')?.value || 'rgba(229,178,93,0.2)';
    const tema_cor_texto      = document.getElementById('editTemaCorTexto')?.value || '#ffffff';
    const tema_cor_hover      = document.getElementById('editTemaCorHover')?.value || _darkenHex(tema_cor_botao, 8);
 
    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const brand_name = document.getElementById('editBrandName').value.trim();
        const brand_subtitle = document.getElementById('editBrandSubtitle').value.trim();

        // 1. Atualizar Empresas
        const { error: errEmp } = await sb
            .from('empresas')
            .update({ 
                nome: nomeEmpresa,
                cnpj,
                plano, 
                segmento,
                status,
                plano_vencimento,
                modulos,
                tema_cor_primaria,
                tema_cor_secundaria,
                tema_cor_botao,
                tema_cor_bg,
                tema_cor_surface,
                tema_cor_borda,
                tema_cor_texto,
                tema_cor_hover,
                cor_primaria: tema_cor_primaria // Legado
            })
            .eq('id', EMPRESA_ID);

        if (errEmp) throw errEmp;

        // 2. Atualizar Store Settings (Branding)
        const upsertData = {
            empresa_id: EMPRESA_ID,
            store_name: nomeEmpresa,
            brand_name,
            brand_subtitle,
            updated_at: new Date().toISOString()
        };

        // RESOLUÇÃƒO DO ERRO 23502 (ID NULO):
        // Se já temos um registro carregado, usamos o ID dele.
        if (STORE_SETTINGS_DATA && STORE_SETTINGS_DATA.id) {
            upsertData.id = STORE_SETTINGS_DATA.id;
        } else {
            // Caso contrário (empresa sem config), buscamos o próximo ID disponível (Manual incremental)
            const { data: maxRows } = await sb
                .from('store_settings')
                .select('id')
                .order('id', { ascending: false })
                .limit(1);
            
            const lastId = (maxRows && maxRows.length > 0) ? parseInt(maxRows[0].id) : 0;
            upsertData.id = lastId + 1;
        }

        const { error: errSet } = await sb
            .from('store_settings')
            .upsert(upsertData, { onConflict: 'empresa_id' });

        if (errSet) throw errSet;
 
        showToast('Configurações e Branding atualizados! âœ…');
        await carregarDadosEmpresa(); // Recarrega tudo para atualizar STORE_SETTINGS_DATA
    } catch (err) {
        console.error('Erro ao salvar:', err);
        showToast(err.message || 'Erro ao salvar configurações', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Atualizar Configurações';
    }
});
 
// Salvamento automático de módulos
// Salvamento automático de módulos individuais
window.atualizarModulo = async (modulo, checked) => {
    if (!EMPRESA_ID || !EMPRESA_DATA) return;
 
    // Atualiza o objeto local para manter sincronia
    if (!EMPRESA_DATA.modulos) EMPRESA_DATA.modulos = {};
    EMPRESA_DATA.modulos[modulo] = checked;
 
    try {
        const { error, data } = await sb
            .from('empresas')
            .update({ modulos: EMPRESA_DATA.modulos })
            .eq('id', EMPRESA_ID)
            .select();
 
        if (error) {
            console.error('[Modules] Erro ao atualizar:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('Permissão negada ou empresa não encontrada.');
        }
        
        // Feedback visual premium
        showToast(`Funcionalidade ${checked ? 'ativada' : 'desativada'}!`);
        console.log(`[Modules] ${modulo} atualizado com sucesso para ${checked}`);
    } catch (err) {
        console.error('Erro crítico ao atualizar módulo:', err);
        showToast('Erro ao salvar alteração: ' + err.message, 'error');
        
        // Reverte o switch visualmente em caso de falha
        const el = document.getElementById(`mod_${modulo}`);
        if (el) el.checked = !checked;
        EMPRESA_DATA.modulos[modulo] = !checked;
    }
};



// Função para ativar/desativar um grupo inteiro de módulos
window.toggleGrupoModulo = async (containerId, isChecked) => {
    if (!EMPRESA_ID || !EMPRESA_DATA) return;
    const container = document.getElementById(containerId);
    if (!container) return;

    // Adiciona/Remove classe visual de desabilitado
    if (isChecked) container.classList.remove('disabled');
    else container.classList.add('disabled');

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    if (!EMPRESA_DATA.modulos) EMPRESA_DATA.modulos = {};
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const key = cb.id.replace('mod_', '');
        EMPRESA_DATA.modulos[key] = isChecked;
    });
    try {
        const { error } = await sb.from('empresas').update({ modulos: EMPRESA_DATA.modulos }).eq('id', EMPRESA_ID);
        if (error) throw error;
        showToast(`Grupo ${isChecked ? 'ativado' : 'desativado'}!`);
    } catch (err) {
        showToast('Erro ao atualizar grupo', 'error');
    }
};

// Função para expandir/colapsar os cards de módulos
window.toggleAccordionNovo = (id) => {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon_' + id);
    if (!el) return;
    
    el.classList.toggle('collapsed');
    if (icon) {
        icon.textContent = el.classList.contains('collapsed') ? 'â–¼' : 'â–²';
    }
};

// --- MODAIS E NAVEGAÇÃƒO ---
window.switchPageTab = (tabId) => {
    // Esconder todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    // Desativar todos os botões
    document.querySelectorAll('.page-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Ativar a aba selecionada
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Feedback visual (scroll para o topo da aba se necessário)
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

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
    const menu = document.getElementById('urlMenu').href;
    const loja = document.getElementById('urlLoja') ? document.getElementById('urlLoja').href : '';
    const admin = document.getElementById('urlAdmin').href;
    const aten = document.getElementById('urlAtendente').href;
    const agendamento = document.getElementById('urlAgendamento') ? document.getElementById('urlAgendamento').href : '';

    const fullText = `ðŸš€ *Acessos da sua Loja - RiverTech Gestão*

ðŸ“  *Link do Cardápio (Para Clientes):*
${menu}
_Divulgue este link no seu Instagram e WhatsApp._

🛍️ *Link da Loja Online (Para Varejo/Roupas):*
${loja}
_Acesse sua vitrine virtual completa._

ðŸ“… *Link de Agendamento Online:*
${agendamento}
_Envie para os clientes marcarem horários._

âš™ï¸ *Painel Administrativo (Gestão):*
${admin}
_Aqui você gerencia produtos, preços e configurações._

ðŸŽ§ *Painel do Atendente (Pedidos):*
${aten}
_Use este painel para receber e gerenciar os pedidos em tempo real._`;

    navigator.clipboard.writeText(fullText);
    showToast('Todos os links copiados com instruções! âœ…');
};

// --- TEMA ---
window.previewTema = () => {
    const primaria = document.getElementById('editTemaCorPrimaria').value;
    const botao = document.getElementById('editTemaCorBotao').value;
    const hover = document.getElementById('editTemaCorHover').value;
    const bg = document.getElementById('editTemaCorBg').value;
    const surface = document.getElementById('editTemaCorSurface').value;
    const texto = document.getElementById('editTemaCorTexto')?.value || '#ffffff';

    const preview = document.getElementById('themePreview');
    const card = document.getElementById('previewCard');
    const btn = document.getElementById('previewBtn');

    if (preview) preview.style.background = bg;
    if (card) {
        card.style.background = surface;
        card.style.color = texto;
    }
    if (btn) {
        btn.style.background = botao;
        btn.style.color = '#000';
        btn.onmouseenter = () => btn.style.background = hover;
        btn.onmouseleave = () => btn.style.background = botao;
    }
};

window.restaurarTemaPadrao = () => {
    document.getElementById('editTemaCorPrimaria').value = '#E5B25D';
    document.getElementById('editTemaCorSecundaria').value = '#1E90FF';
    document.getElementById('editTemaCorBotao').value = '#E5B25D';
    document.getElementById('editTemaCorBg').value = '#0d0d0d';
    document.getElementById('editTemaCorSurface').value = '#1a1a1a';
    document.getElementById('editTemaCorBorda').value = 'rgba(229,178,93,0.2)';
    document.getElementById('editTemaCorTexto').value = '#ffffff';
    document.getElementById('editTemaCorHover').value = '#d4a14c';
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

// ==========================================
// PIX / Mercado Pago â€” Gestão por Empresa
// ==========================================

/**
 * Carrega o status do PIX e Cartão da empresa.
 * Chamado automaticamente ao carregar os dados da empresa.
 */
function carregarStatusPix() {
    if (!EMPRESA_DATA) return;
    
    const togglePix = document.getElementById('pixHabilitadoToggle');
    const toggleCartao = document.getElementById('cartaoHabilitadoToggle');
    const toggleParcelamento = document.getElementById('cartaoParcelamentoToggle');
    
    const tokenInput = document.getElementById('pixAccessToken');
    const statusIcon = document.getElementById('pixStatusIcon');
    const statusTitle = document.getElementById('pixStatusTitle');
    const statusDesc = document.getElementById('pixStatusDesc');
    
    if (!togglePix) return; // Aba Pagamentos não existe na página
    
    togglePix.checked = EMPRESA_DATA.pix_habilitado === true;
    toggleCartao.checked = EMPRESA_DATA.cartao_habilitado === true;
    toggleParcelamento.checked = EMPRESA_DATA.cartao_parcelamento === true;
    
    // O token vem mascarado do banco (ou vazio)
    // Mostramos apenas se foi configurado ou não
    const temToken = !!EMPRESA_DATA.mp_access_token;
    
    if (temToken && (EMPRESA_DATA.pix_habilitado || EMPRESA_DATA.cartao_habilitado)) {
        statusIcon.innerHTML = 'âœ…';
        statusIcon.style.background = 'rgba(16, 185, 129, 0.1)';
        statusTitle.textContent = 'Pagamentos Online Ativos';
        statusTitle.style.color = 'var(--accent-green)';
        statusDesc.textContent = 'A empresa está pronta para receber pagamentos pelo site.';
    } else if (temToken) {
        statusIcon.innerHTML = 'â¸ï¸';
        statusIcon.style.background = 'rgba(234, 179, 8, 0.1)';
        statusTitle.textContent = 'Pagamentos Configurados (Desativados)';
        statusTitle.style.color = 'var(--accent-gold)';
        statusDesc.textContent = 'Token cadastrado, mas PIX/Cartão estão desligados.';
    } else {
        statusIcon.innerHTML = 'âš ï¸';
        statusIcon.style.background = 'rgba(239, 68, 68, 0.1)';
        statusTitle.textContent = 'Pagamentos não configurados';
        statusTitle.style.color = 'var(--accent-red)';
        statusDesc.textContent = 'Configure o token de Produção do Mercado Pago abaixo.';
    }
    
    // Preenche o campo com asteriscos se o token existe
    if (temToken) {
        tokenInput.value = '';
        tokenInput.placeholder = 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢ (token salvo â€” insira um novo para substituir)';
    } else {
        tokenInput.value = '';
        tokenInput.placeholder = 'APP_USR-xxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxx';
    }
}

/**
 * Toggle individual para as opções de pagamento.
 */
window.togglePagamento = async (tipo, checked) => {
    if (!EMPRESA_ID) return;
    
    let field = '';
    let toggleId = '';
    if (tipo === 'pix') { field = 'pix_habilitado'; toggleId = 'pixHabilitadoToggle'; }
    else if (tipo === 'cartao') { field = 'cartao_habilitado'; toggleId = 'cartaoHabilitadoToggle'; }
    else if (tipo === 'parcelamento') { field = 'cartao_parcelamento'; toggleId = 'cartaoParcelamentoToggle'; }
    
    try {
        const { error } = await sb
            .from('empresas')
            .update({ [field]: checked })
            .eq('id', EMPRESA_ID);

        if (error) throw error;

        EMPRESA_DATA[field] = checked;
        carregarStatusPix();
        showToast(checked ? `${tipo.toUpperCase()} habilitado! âœ…` : `${tipo.toUpperCase()} desabilitado.`);
    } catch (err) {
        showToast(`Erro ao alterar ${tipo}: ` + err.message, 'error');
        // Reverter toggle
        document.getElementById(toggleId).checked = !checked;
    }
};

/**
 * Salva o Access Token do Mercado Pago para a empresa.
 */
window.salvarConfigPix = async () => {
    if (!EMPRESA_ID) return;
    
    const btn = document.getElementById('btnSalvarPix');
    const tokenInput = document.getElementById('pixAccessToken');
    const token = tokenInput.value.trim();
    
    // Toggles states to save along with the token
    const pixAtivo = document.getElementById('pixHabilitadoToggle').checked;
    const cartaoAtivo = document.getElementById('cartaoHabilitadoToggle').checked;
    const parcelamentoAtivo = document.getElementById('cartaoParcelamentoToggle').checked;
    
    if (!token && !EMPRESA_DATA.mp_access_token) {
        showToast('Insira o Access Token do Mercado Pago.', 'error');
        return;
    }
    
    // Validação básica do formato do token (se estiver enviando um novo)
    if (token && !token.startsWith('APP_USR-') && !token.startsWith('TEST-')) {
        const confirmar = confirm(
            'O token não parece ter o formato padrão do Mercado Pago (APP_USR-... ou TEST-...).\n\n' +
            'Deseja salvar mesmo assim?'
        );
        if (!confirmar) return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        
        const updateData = {
            pix_habilitado: pixAtivo,
            cartao_habilitado: cartaoAtivo,
            cartao_parcelamento: parcelamentoAtivo
        };
        
        if (token) {
            updateData.mp_access_token = token;
        }
        
        const { error } = await sb
            .from('empresas')
            .update(updateData)
            .eq('id', EMPRESA_ID);

        if (error) throw error;

        if (token) EMPRESA_DATA.mp_access_token = token;
        EMPRESA_DATA.pix_habilitado = pixAtivo;
        EMPRESA_DATA.cartao_habilitado = cartaoAtivo;
        EMPRESA_DATA.cartao_parcelamento = parcelamentoAtivo;
        
        carregarStatusPix();
        showToast('Configurações de pagamento salvas! ðŸŽ‰');
        
    } catch (err) {
        showToast('Erro ao salvar configurações: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Configuração de Pagamentos';
    }
};

/**
 * Testa a conexão com a API do Mercado Pago usando o token.
 * Não cria nenhum pagamento â€” apenas verifica se o token é válido.
 */
window.testarConexaoPix = async () => {
    const btn = document.getElementById('btnTestarPix');
    const resultEl = document.getElementById('pixTestResult');
    const tokenInput = document.getElementById('pixAccessToken');
    
    // Usar o token do input OU o que já está salvo
    let tokenParaTestar = tokenInput.value.trim();
    
    if (!tokenParaTestar && EMPRESA_DATA?.mp_access_token) {
        tokenParaTestar = EMPRESA_DATA.mp_access_token;
    }
    
    if (!tokenParaTestar) {
        resultEl.style.display = 'block';
        resultEl.style.background = 'rgba(239, 68, 68, 0.1)';
        resultEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        resultEl.innerHTML = 'âŒ <strong>Nenhum token para testar.</strong> Insira o Access Token primeiro.';
        return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = 'ðŸ”„ Testando...';
        resultEl.style.display = 'block';
        resultEl.style.background = 'rgba(234, 179, 8, 0.1)';
        resultEl.style.border = '1px solid rgba(234, 179, 8, 0.3)';
        resultEl.innerHTML = 'â³ Conectando Ã  API do Mercado Pago...';
        
        // Chama a API do MP via Edge Function (evita CORS)
        const { data: edgeData, error: edgeErr } = await sb.functions.invoke('mercadopago-test', {
            body: { token: tokenParaTestar }
        });
        
        if (edgeErr) throw edgeErr;
        
        if (edgeData && edgeData.success) {
            resultEl.style.background = 'rgba(16, 185, 129, 0.1)';
            resultEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            resultEl.innerHTML = `
                âœ… <strong>Conexão bem-sucedida!</strong><br>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">
                    Conta: <strong>${edgeData.first_name || ''} ${edgeData.last_name || ''}</strong> 
                    (${edgeData.email || 'e-mail não disponível'})<br>
                    ID: ${edgeData.id} | País: ${edgeData.country_id || 'BR'}
                </span>
            `;
        } else {
            const msg = edgeData?.error || 'Token inválido ou expirado.';
            resultEl.style.background = 'rgba(239, 68, 68, 0.1)';
            resultEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            
            // Detectar erro específico de Public Key usada no lugar do Access Token
            const isUnauthorizedPolicyError = msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('policy');
            
            if (isUnauthorizedPolicyError) {
                resultEl.innerHTML = `
                    âŒ <strong>Falha na conexão:</strong> ${msg}<br><br>
                    <span style="font-size: 0.8rem; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); padding: 8px 10px; border-radius: 6px; display: block; line-height: 1.6;">
                        âš ï¸ <strong style="color: var(--accent-gold);">Causa provável:</strong> Você pode ter inserido a <strong>Public Key</strong> em vez do <strong>Access Token</strong>.<br>
                        Ambas começam com <code style="background:#111; padding:1px 4px; border-radius:3px;">APP_USR-</code>, mas o <strong>Access Token</strong> tem ~70 caracteres (muito mais longo).<br>
                        Acesse <strong>Mercado Pago Developers â†’ Seu App â†’ Credenciais de Produção</strong> e copie o campo <strong>Access Token</strong>.
                    </span>
                `;
            } else {
                resultEl.innerHTML = `âŒ <strong>Falha na conexão:</strong> ${msg}`;
            }
        }
        
    } catch (err) {
        resultEl.style.background = 'rgba(239, 68, 68, 0.1)';
        resultEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        resultEl.innerHTML = `âŒ <strong>Erro de rede:</strong> ${err.message}`;
        resultEl.innerHTML = `â Œ <strong>Erro de rede:</strong> ${err.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'ðŸ§ª Testar Conexão';
    }
};

/**
 * Alterna a visibilidade do campo de token (password/text).
 */
window.toggleTokenVisibility = () => {
    const input = document.getElementById('pixAccessToken');
    const btn = document.getElementById('btnToggleToken');
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
};

// Iniciar
init();

// ==========================================
// PROPOSTAS COMERCIAIS
// ==========================================
function carregarPropostas(slug) {
    const container = document.getElementById('propostasContainer');
    if (!container) return;

    const cleanSlug = slug.toLowerCase();

    const html = `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div>
                    <span class="status-badge" style="background: rgba(255,255,255,0.1); color: var(--text-secondary); margin-bottom: 8px; display: inline-block;">Completa</span>
                    <h4 style="margin:0; font-size: 1.1rem;">Sistema Gestão V1</h4>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 8px;">🚀</div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.4;">
                Apresentação completa do sistema de gestão com cardápio digital, QR Code e painel administrativo master.
            </p>
            <a href="/apresentacao/${cleanSlug}" target="_blank" class="btn-outline" style="display: block; text-align: center; text-decoration: none; padding: 10px;">
                Ver Apresentação
            </a>
        </div>

        <div style="background: rgba(229,178,93,0.05); border: 1px solid rgba(229,178,93,0.3); border-radius: 12px; padding: 20px; transition: all 0.3s;" class="proposta-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div>
                    <span class="status-badge" style="background: rgba(229,178,93,0.15); color: var(--accent-gold); margin-bottom: 8px; display: inline-block;">Novo Módulo VIP</span>
                    <h4 style="margin:0; font-size: 1.1rem;">Gestão de Clientes Premium</h4>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 8px;">👑</div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px; line-height: 1.4;">
                Módulo exclusivo para acabar com o controle manual e prejuízos. Segurança absoluta sobre tudo que é consumido internamente ou por convidados.
            </p>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px; line-height: 1.5;">
                <strong>✨ Resumo de como vai funcionar:</strong>
                <ul style="padding-left: 20px; margin-top: 5px; margin-bottom: 15px;">
                    <li><b>Gestão Total:</b> Definição de limite financeiro mensal de cada pessoa e <i>Dashboard Gerencial</i>.</li>
                    <li><b>Cardápio Inteligente:</b> Você escolhe o que cada perfil pode ver a nível de produtos (ex.: Mesa de cash omaha vê tudo, Funcionário só prato do dia e coca cola).</li>
                    <li><b>Transparência na Mão:</b> Usuário acessa o app, vê os itens liberados e acompanha seu saldo. Se passar do limite, o sistema bloqueia o pedido automaticamente!</li>
                    <li><b>Caixa Ágil:</b> Equipe identifica na hora o cliente (Selo VIP), vê o saldo e faz o fechamento com segurança. <i>(Obs: Controle 100% interno, sem integração fiscal)</i>.</li>
                    <li><b>Fluxo de fechamento:</b> Fechamento de caixa por atendente e tipo de pagamento.</li>
                </ul>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <strong style="color: var(--text-primary); margin-bottom: 5px; display: inline-block;">💰 Opções de Investimento (Prazo: ~4 semanas):</strong><br>
                ✅ <b>Opção 1:</b> Implantação + Desenvolvimento R$ 6.000 (Pagamento único, em até 3x) + Licença de R$ 349/mês.<br>
                ✅ <b>Opção 2:</b> R$ 1.000 (Entrada Única) + Licença de R$ 850/mês.
            </div>
            <a href="/apresentacao/${cleanSlug}-vip" target="_blank" class="btn-primary" style="display: block; text-align: center; text-decoration: none; padding: 10px;">
                Ver Apresentação
            </a>
        </div>
    `;

    container.innerHTML = html;
}