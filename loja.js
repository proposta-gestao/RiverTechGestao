/**
 * loja.js — Lógica da Página Pública da Loja de Roupas
 * ======================================================
 * Exibe catálogo de produtos com variações, filtros e PDV (venda).
 * Integrado com tenant.js para multi-tenant e white-label.
 */

// --- Supabase ---
const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State ---
let produtos = [];
let categorias = [];

// --- Cores conhecidas (para dot preview) ---
const CORES_MAP = {
    'preto': '#222222',
    'branco': '#f5f5f5',
    'cinza': '#9e9e9e',
    'azul': '#1e88e5',
    'azul marinho': '#1a237e',
    'vermelho': '#e53935',
    'verde': '#43a047',
    'amarelo': '#fdd835',
    'rosa': '#ec407a',
    'roxo': '#8e24aa',
    'laranja': '#ff9800',
    'marrom': '#6d4c41',
    'bege': '#d7ccc8',
    'vinho': '#880e4f',
    'nude': '#d4a89a'
};

const TAMANHOS_ORDEM = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'UN'];

function getCorHex(nome) {
    return CORES_MAP[nome.toLowerCase()] || '#888888';
}

function getEstoqueClasse(qtd) {
    if (qtd <= 0) return 'loja-pub-estoque-zero';
    if (qtd <= 5) return 'loja-pub-estoque-baixo';
    return 'loja-pub-estoque-ok';
}

function getEstoqueTexto(qtd) {
    if (qtd <= 0) return 'Esgotado';
    if (qtd <= 5) return `Últimas ${qtd} un.`;
    return `${qtd} disponíveis`;
}

// ================================================================
// INICIALIZAÇÃO
// ================================================================

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

        popularFiltros();
        renderProdutos();

    } catch (err) {
        console.error('[Loja] Erro na inicialização:', err);
    }
}

// ================================================================
// DATA LOADING
// ================================================================

async function carregarCategorias(empresaId) {
    const { data, error } = await sb
        .from('categories')
        .select('id, name')
        .eq('empresa_id', empresaId)
        .order('order_position');
    if (error) {
        console.error('[Loja] Erro ao carregar categorias:', error);
        return;
    }
    categorias = data || [];
}

async function carregarProdutos(empresaId) {
    const { data, error } = await sb
        .from('loja_produtos')
        .select('*, categories(name), loja_variacoes(*)')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Loja] Erro ao carregar produtos:', error);
        return;
    }
    produtos = data || [];
}

// ================================================================
// FILTROS
// ================================================================

function popularFiltros() {
    // Categorias
    const selCat = document.getElementById('filtroCategoria');
    if (selCat) {
        selCat.innerHTML = '<option value="">Todas categorias</option>' +
            categorias.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        selCat.onchange = renderProdutos;
    }

    // Tamanhos (extrair dos produtos carregados)
    const tamanhos = new Set();
    produtos.forEach(p => (p.loja_variacoes || []).forEach(v => tamanhos.add(v.tamanho)));
    const tamOrdenados = TAMANHOS_ORDEM.filter(t => tamanhos.has(t));

    const selTam = document.getElementById('filtroTamanho');
    if (selTam) {
        selTam.innerHTML = '<option value="">Todos tamanhos</option>' +
            tamOrdenados.map(t => `<option value="${t}">${t}</option>`).join('');
        selTam.onchange = renderProdutos;
    }

    // Cores (extrair dos produtos carregados)
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
    document.getElementById('filtroCategoria').value = '';
    document.getElementById('filtroTamanho').value = '';
    document.getElementById('filtroCor').value = '';
    renderProdutos();
}

// ================================================================
// RENDERING
// ================================================================

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
            <div class="loja-pub-empty">
                <div class="empty-icon">🔍</div>
                <p>Nenhum produto encontrado.<br><span style="font-size:0.85rem;">Tente alterar os filtros.</span></p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtrados.map(p => {
        const variacoes = p.loja_variacoes || [];
        const catNome = p.categories?.name || '';
        const estoqueTotal = variacoes.reduce((s, v) => s + (v.estoque || 0), 0);

        // Tamanhos únicos
        const tams = [...new Set(variacoes.map(v => v.tamanho))];
        const tamsOrdenados = TAMANHOS_ORDEM.filter(t => tams.includes(t));

        return `
            <div class="loja-pub-card" onclick="abrirDetalhes('${p.id}')">
                <div class="loja-pub-card-img">👗</div>
                <div class="loja-pub-card-body">
                    ${catNome ? `<div class="card-categoria">${catNome}</div>` : ''}
                    <h3>${p.nome}</h3>
                    ${p.descricao ? `<p style="color:var(--loja-text-muted); font-size:0.82rem; margin-top:4px;">${p.descricao}</p>` : ''}
                </div>
                <div class="loja-pub-card-footer">
                    <div class="tamanhos-preview">
                        ${tamsOrdenados.map(t => `<span class="loja-pub-tam-chip">${t}</span>`).join('')}
                    </div>
                    <span class="loja-pub-estoque-info ${getEstoqueClasse(estoqueTotal)}">
                        ${getEstoqueTexto(estoqueTotal)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// ================================================================
// MODAL DE DETALHES / PDV
// ================================================================

function abrirDetalhes(produtoId) {
    const p = produtos.find(x => x.id === produtoId);
    if (!p) return;

    document.getElementById('modalProdNome').textContent = p.nome;
    document.getElementById('modalProdDesc').textContent = p.descricao || '';

    const variacoes = p.loja_variacoes || [];

    // Aplicar filtros ativos às variações exibidas
    const tam = document.getElementById('filtroTamanho')?.value || '';
    const cor = document.getElementById('filtroCor')?.value || '';
    let varFiltradas = variacoes;
    if (tam) varFiltradas = varFiltradas.filter(v => v.tamanho === tam);
    if (cor) varFiltradas = varFiltradas.filter(v => v.cor.toLowerCase() === cor.toLowerCase());

    const tbody = document.getElementById('modalVariacoes');
    tbody.innerHTML = varFiltradas.map(v => `
        <tr>
            <td><span class="loja-pub-sku">${v.sku}</span></td>
            <td>
                <span class="loja-pub-cor-dot" style="background:${getCorHex(v.cor)}"></span>
                ${v.cor}
            </td>
            <td><strong>${v.tamanho}</strong></td>
            <td>
                <span class="${getEstoqueClasse(v.estoque)}" style="font-weight:700;">
                    ${v.estoque}
                </span>
            </td>
            <td>
                <button 
                    class="loja-pub-btn-vender" 
                    onclick="realizarVenda('${v.id}', event)"
                    ${v.estoque <= 0 ? 'disabled' : ''}
                >
                    ${v.estoque > 0 ? '🛒 Vender' : 'Esgotado'}
                </button>
            </td>
        </tr>
    `).join('');

    if (varFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--loja-text-muted);">Nenhuma variação disponível</td></tr>';
    }

    document.getElementById('modalDetalhes').classList.add('active');
}

function fecharDetalhes() {
    document.getElementById('modalDetalhes').classList.remove('active');
}

// Fechar ao clicar no backdrop
document.getElementById('modalDetalhes')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalDetalhes')) {
        fecharDetalhes();
    }
});

// ================================================================
// PDV — VENDA
// ================================================================

async function realizarVenda(variacaoId, event) {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Vendendo...';

    try {
        const { error } = await sb.rpc('loja_remover_estoque', {
            p_variacao_id: variacaoId,
            p_quantidade: 1
        });

        if (error) {
            if (error.message.includes('Estoque insuficiente')) {
                alert('Estoque insuficiente para esta variação.');
            } else {
                alert('Erro ao registrar venda: ' + error.message);
            }
            btn.disabled = false;
            btn.textContent = '🛒 Vender';
            return;
        }

        // Sucesso — recarregar dados
        const empresaId = getTenantId();
        await carregarProdutos(empresaId);
        renderProdutos();

        // Reabrir o modal com dados atualizados
        // Encontrar o produto da variação vendida
        const prod = produtos.find(p => (p.loja_variacoes || []).some(v => v.id === variacaoId));
        if (prod) {
            abrirDetalhes(prod.id);
        } else {
            fecharDetalhes();
        }

    } catch (err) {
        console.error('[Loja] Erro na venda:', err);
        alert('Erro inesperado: ' + (err.message || err));
        btn.disabled = false;
        btn.textContent = '🛒 Vender';
    }
}

// ================================================================
// INICIAR
// ================================================================
init();
