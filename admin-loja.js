// ============================================================
// ADMIN LOJA DE ROUPAS
// Responsável por gerenciar produtos, categorias e estoque.
// ============================================================

(function() {
    'use strict';

// Evitar inicialização dupla
if (window.__LOJA_INICIADO_SCRIPT) return;
window.__LOJA_INICIADO_SCRIPT = true;

window.__LOJA = window.__LOJA || {};

// Referência ao cliente Supabase (já inicializado pelo admin.js)
const sb = window.sb;

// Estado Local
let lojaProdutos = [];
let lojaCategorias = [];
let lojaEstoque = [];
let lojaCurrentProdImages = [];
let lojaCurrentVariacoes = [];

const TAMANHOS_PADRAO = ['PP', 'P', 'M', 'G', 'GG', 'X1', 'X2'];
const CORES_PADRAO = [
    { nome: 'Preto', hex: '#000000' },
    { nome: 'Branco', hex: '#FFFFFF' },
    { nome: 'Cinza', hex: '#808080' },
    { nome: 'Azul', hex: '#0000FF' },
    { nome: 'Vermelho', hex: '#FF0000' },
    { nome: 'Verde', hex: '#008000' },
    { nome: 'Amarelo', hex: '#FFFF00' }
];

// ------------------------------------------------------------
// INICIALIZAÇÃO E NAVEGAÇÃO
// ------------------------------------------------------------
window.__LOJA.init = async function() {
    console.log('[Loja] Iniciando módulo...');
    setupLojaSubtabs();
    await carregarLojaCategorias();
    await carregarLojaProdutos();
};

function setupLojaSubtabs() {
    const btns = document.querySelectorAll('#tab-loja .subtab-btn');
    const contents = document.querySelectorAll('#tab-loja .subtab-content');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = 'subtab-' + btn.dataset.subtab;
            const targetContent = document.getElementById(targetId);
            if(targetContent) {
                targetContent.classList.add('active');
                if (btn.dataset.subtab === 'loja-estoque') {
                    renderLojaEstoque();
                }
            }
        });
    });
}

// ------------------------------------------------------------
// CARREGAMENTO DE DADOS
// ------------------------------------------------------------
async function carregarLojaCategorias() {
    const { data, error } = await sb.from('loja_categorias')
        .select('*')
        .eq('empresa_id', getTenantId())
        .order('ordem', { ascending: true });
    
    if (error) {
        console.error('Erro categorias loja:', error);
        return;
    }
    lojaCategorias = data || [];
    renderLojaCategorias();
    popularSelectLojaCategorias();
}

async function carregarLojaProdutos() {
    const { data, error } = await sb.from('loja_produtos')
        .select('*, loja_categorias(nome), loja_variacoes(*)')
        .eq('empresa_id', getTenantId())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro produtos loja:', error);
        return;
    }
    lojaProdutos = data || [];
    renderLojaProdutos();
    renderLojaEstoque();
    atualizarEstatisticasLoja();
}

function atualizarEstatisticasLoja() {
    const row = document.getElementById('lojaStatsRow');
    if (!row) return;

    const totalProd = lojaProdutos.length;
    const ativos = lojaProdutos.filter(p => p.ativo).length;
    let totalVariacoes = 0;
    let totalEsgotados = 0;

    lojaProdutos.forEach(p => {
        if (p.loja_variacoes) {
            totalVariacoes += p.loja_variacoes.length;
            p.loja_variacoes.forEach(v => {
                if (v.estoque <= 0) totalEsgotados++;
            });
        }
    });

    row.innerHTML = `
        <div class="stat-card"><div class="stat-label">Total de Produtos</div><div class="stat-value">${totalProd}</div></div>
        <div class="stat-card"><div class="stat-label">Ativos</div><div class="stat-value" style="color:var(--success)">${ativos}</div></div>
        <div class="stat-card"><div class="stat-label">Variações</div><div class="stat-value">${totalVariacoes}</div></div>
        <div class="stat-card"><div class="stat-label">Vars. Esgotadas</div><div class="stat-value" style="color:var(--danger)">${totalEsgotados}</div></div>
    `;

    const contador = document.getElementById('lojaProdContador');
    if(contador) contador.innerText = `(${totalProd} produtos)`;
}

// ------------------------------------------------------------
// TABELA PRODUTOS
// ------------------------------------------------------------
function renderLojaProdutos() {
    const tbody = document.getElementById('lojaProdutosBody');
    if (!tbody) return;

    if (lojaProdutos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">Nenhum produto cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lojaProdutos.map(p => {
        const catNome = p.loja_categorias?.nome || '-';
        const variacoes = p.loja_variacoes || [];
        const numVariacoes = variacoes.length;
        const estoqueTotal = variacoes.reduce((acc, curr) => acc + (curr.estoque || 0), 0);
        const corEstoque = estoqueTotal <= 0 ? 'var(--danger)' : 'inherit';

        return `
            <tr>
                <td><img src="${p.imagem_url || 'Logo.png'}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                <td><strong>${p.nome}</strong></td>
                <td>${catNome}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05);">${numVariacoes} un.</span></td>
                <td style="color:${corEstoque}; font-weight:bold;">${estoqueTotal}</td>
                <td><span class="badge ${p.ativo ? 'badge-active' : 'badge-inactive'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-sm btn-edit" onclick="window.__LOJA.editarProduto('${p.id}')">Editar</button>
                        <button class="btn-sm btn-delete" onclick="window.__LOJA.excluirProduto('${p.id}')">Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ------------------------------------------------------------
// MODAL PRODUTO
// ------------------------------------------------------------
window.__LOJA.novoProduto = function() {
    document.getElementById('lojaProdId').value = '';
    document.getElementById('lojaProdNome').value = '';
    document.getElementById('lojaProdDescricao').value = '';
    document.getElementById('lojaProdCategoria').value = '';
    document.getElementById('lojaProdAtivo').value = 'true';
    
    // Imagem
    lojaCurrentProdImages = [];
    document.getElementById('lojaProdImageUrl').value = '';
    atualizarPreviewImagemLoja(null);

    // Seção de criação
    document.getElementById('lojaNovosCheckboxes').style.display = 'block';
    document.getElementById('lojaVariacoesExistentes').style.display = 'none';
    
    renderizarCheckboxesTamCor();
    atualizarPreviewCombinacoes();
    
    document.getElementById('lojaModalTitle').innerText = 'Novo Produto';
    abrirModal('modalLojaProduto');
};

window.__LOJA.editarProduto = function(id) {
    const prod = lojaProdutos.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('lojaProdId').value = prod.id;
    document.getElementById('lojaProdNome').value = prod.nome;
    document.getElementById('lojaProdDescricao').value = prod.descricao || '';
    document.getElementById('lojaProdCategoria').value = prod.loja_categoria_id || '';
    document.getElementById('lojaProdAtivo').value = prod.ativo ? 'true' : 'false';

    lojaCurrentProdImages = prod.imagem_url ? [prod.imagem_url] : [];
    document.getElementById('lojaProdImageUrl').value = prod.imagem_url || '';
    atualizarPreviewImagemLoja(prod.imagem_url);

    // Ocultar criação de checkboxes, mostrar tabela de edição
    document.getElementById('lojaNovosCheckboxes').style.display = 'none';
    document.getElementById('lojaVariacoesExistentes').style.display = 'block';

    lojaCurrentVariacoes = [...(prod.loja_variacoes || [])];
    renderVariacoesExistentes();

    document.getElementById('lojaModalTitle').innerText = 'Editar Produto';
    abrirModal('modalLojaProduto');
};

window.__LOJA.salvarProduto = async function() {
    const btn = document.getElementById('btnSalvarLojaProduto');
    btn.disabled = true;
    btn.innerText = 'Salvando...';

    const id = document.getElementById('lojaProdId').value;
    const nome = document.getElementById('lojaProdNome').value.trim();
    const descricao = document.getElementById('lojaProdDescricao').value.trim();
    const catId = document.getElementById('lojaProdCategoria').value;
    const ativo = document.getElementById('lojaProdAtivo').value === 'true';
    const imagem_url = document.getElementById('lojaProdImageUrl').value;

    if (!nome) { showToast('Nome é obrigatório', 'error'); btn.disabled = false; btn.innerText = 'Salvar'; return; }

    const prodData = {
        empresa_id: getTenantId(),
        nome,
        descricao,
        loja_categoria_id: catId || null,
        ativo,
        imagem_url
    };

    try {
        if (id) {
            // Edição
            const { error } = await sb.from('loja_produtos').update(prodData).eq('id', id);
            if (error) throw error;
            showToast('Produto atualizado!', 'success');
        } else {
            // Criação
            const { data: newProd, error } = await sb.from('loja_produtos').insert([prodData]).select().single();
            if (error) throw error;

            // Criar variações se houver
            const trs = document.querySelectorAll('#lojaCombBody tr');
            const varsToInsert = [];
            trs.forEach(tr => {
                const cor = tr.dataset.cor;
                const tam = tr.dataset.tam;
                const precoInput = tr.querySelector('.in-preco');
                const estqInput = tr.querySelector('.in-estoque');
                
                varsToInsert.push({
                    empresa_id: getTenantId(),
                    produto_id: newProd.id,
                    tamanho: tam,
                    cor: cor,
                    sku: gerarSKULocal(nome, cor, tam),
                    preco: parseFloat(precoInput.value) || 0,
                    estoque: parseInt(estqInput.value) || 0
                });
            });

            if (varsToInsert.length > 0) {
                const { error: errVar } = await sb.from('loja_variacoes').insert(varsToInsert);
                if (errVar) console.error('Erro ao inserir variacoes', errVar);
            }
            showToast('Produto criado com variações!', 'success');
        }

        fecharModal('modalLojaProduto');
        await carregarLojaProdutos();
    } catch (err) {
        showToast('Erro ao salvar produto', 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Salvar';
    }
};

window.__LOJA.excluirProduto = function(id) {
    customConfirm('Excluir Produto', 'Tem certeza? As variações serão apagadas.', async () => {
        const { error } = await sb.from('loja_produtos').delete().eq('id', id);
        if (error) {
            showToast('Erro ao excluir', 'error');
        } else {
            showToast('Produto excluído', 'success');
            await carregarLojaProdutos();
        }
    });
};

function gerarSKULocal(nome, cor, tam) {
    let p = nome.substring(0,3).toUpperCase().padEnd(3,'X');
    let c = cor.substring(0,3).toUpperCase().padEnd(3,'X');
    let t = tam.toUpperCase();
    let r = Math.floor(Math.random()*9000)+1000;
    return `${p}-${c}-${t}-${r}`;
}

// ------------------------------------------------------------
// IMAGENS (Cloudinary)
// ------------------------------------------------------------
window.__LOJA.uploadImagem = async function(file) {
    if (!file) return;
    const btn = document.getElementById('btnLojaAdicionarImagem');
    btn.disabled = true;
    btn.innerText = 'Enviando...';

    try {
        const url = await window.handleCloudinaryUpload(file, 'loja');
        if (url) {
            document.getElementById('lojaProdImageUrl').value = url;
            atualizarPreviewImagemLoja(url);
            showToast('Imagem carregada!', 'success');
        }
    } catch(err) {
        showToast('Erro ao carregar imagem', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = '+ Foto';
    }
};

window.__LOJA.removerImagem = function() {
    document.getElementById('lojaProdImageUrl').value = '';
    atualizarPreviewImagemLoja(null);
};

function atualizarPreviewImagemLoja(url) {
    const prevBox = document.getElementById('lojaProdImagePreview');
    const thumb = document.getElementById('lojaProdImageThumb');
    
    if (url) {
        thumb.src = url;
        prevBox.style.display = 'block';
    } else {
        thumb.src = '';
        prevBox.style.display = 'none';
    }
}

// ------------------------------------------------------------
// VARIAÇÕES - CRIAÇÃO (Checkboxes)
// ------------------------------------------------------------
function renderizarCheckboxesTamCor() {
    const tGrid = document.getElementById('lojaTamanhosGrid');
    const cGrid = document.getElementById('lojaCoresGrid');
    
    tGrid.innerHTML = TAMANHOS_PADRAO.map(t => `
        <label style="display:flex; align-items:center; gap:5px; background:var(--bg-card); padding:8px; border-radius:6px; border:1px solid var(--border-color); cursor:pointer;">
            <input type="checkbox" value="${t}" class="chk-tam" onchange="atualizarPreviewCombinacoes()">
            <span style="font-weight:600;">${t}</span>
        </label>
    `).join('');

    cGrid.innerHTML = CORES_PADRAO.map(c => `
        <label style="display:flex; align-items:center; gap:5px; background:var(--bg-card); padding:8px; border-radius:6px; border:1px solid var(--border-color); cursor:pointer;">
            <input type="checkbox" value="${c.nome}" class="chk-cor" onchange="atualizarPreviewCombinacoes()">
            <div style="width:14px; height:14px; border-radius:50%; background:${c.hex}; border:1px solid #ccc;"></div>
            <span>${c.nome}</span>
        </label>
    `).join('');
}

window.atualizarPreviewCombinacoes = function() {
    const tChecks = document.querySelectorAll('.chk-tam:checked');
    const cChecks = document.querySelectorAll('.chk-cor:checked');
    const div = document.getElementById('lojaCombPreview');
    const tbody = document.getElementById('lojaCombBody');

    const tamanhos = Array.from(tChecks).map(el => el.value);
    const cores = Array.from(cChecks).map(el => el.value);

    if (tamanhos.length === 0 || cores.length === 0) {
        div.style.display = 'none';
        tbody.innerHTML = '';
        return;
    }

    div.style.display = 'block';
    let html = '';
    
    cores.forEach(c => {
        tamanhos.forEach(t => {
            html += `
                <tr data-cor="${c}" data-tam="${t}">
                    <td><strong>${c}</strong></td>
                    <td>${t}</td>
                    <td><input type="number" step="0.01" min="0" value="0" class="in-preco" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border-color); background:transparent; color:var(--text-color);"></td>
                    <td><input type="number" min="0" value="0" class="in-estoque" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border-color); background:transparent; color:var(--text-color);"></td>
                </tr>
            `;
        });
    });
    tbody.innerHTML = html;
};

window.__LOJA.aplicarEstoqueGlobal = function() {
    const trs = document.querySelectorAll('#lojaCombBody tr');
    if (trs.length === 0) return;
    
    const firstPreco = trs[0].querySelector('.in-preco').value;
    const firstEstq = trs[0].querySelector('.in-estoque').value;

    trs.forEach((tr, i) => {
        if(i > 0) {
            tr.querySelector('.in-preco').value = firstPreco;
            tr.querySelector('.in-estoque').value = firstEstq;
        }
    });
};

// ------------------------------------------------------------
// VARIAÇÕES - EDIÇÃO
// ------------------------------------------------------------
function renderVariacoesExistentes() {
    const tbody = document.getElementById('lojaVariacoesEditBody');
    if (lojaCurrentVariacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma variação.</td></tr>';
        return;
    }

    tbody.innerHTML = lojaCurrentVariacoes.map(v => `
        <tr>
            <td style="font-size:0.8rem; color:var(--text-muted);">${v.sku}</td>
            <td>${v.cor}</td>
            <td>${v.tamanho}</td>
            <td>R$ ${parseFloat(v.preco||0).toFixed(2)}</td>
            <td><strong>${v.estoque}</strong></td>
            <td>
                <button class="btn-sm btn-delete" onclick="window.__LOJA.excluirVariacao('${v.id}')">Excluir</button>
            </td>
        </tr>
    `).join('');
}

window.__LOJA.excluirVariacao = async function(id) {
    customConfirm('Excluir Variação', 'Certeza?', async () => {
        const { error } = await sb.from('loja_variacoes').delete().eq('id', id);
        if (error) showToast('Erro', 'error');
        else {
            showToast('Apagado', 'success');
            await carregarLojaProdutos();
            // Atualiza modal atual
            const pId = document.getElementById('lojaProdId').value;
            const updated = lojaProdutos.find(p => p.id === pId);
            if(updated) {
                lojaCurrentVariacoes = updated.loja_variacoes || [];
                renderVariacoesExistentes();
            }
        }
    });
};

// ... NOVA VARIAÇÃO MODAL ...
window.__LOJA.abrirModalNovaVariacao = function() {
    const pId = document.getElementById('lojaProdId').value;
    document.getElementById('novaVarProdutoId').value = pId;
    
    const selTam = document.getElementById('novaVarTamanho');
    selTam.innerHTML = TAMANHOS_PADRAO.map(t => `<option value="${t}">${t}</option>`).join('');
    
    const selCor = document.getElementById('novaVarCor');
    selCor.innerHTML = CORES_PADRAO.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');

    document.getElementById('novaVarPreco').value = '0';
    document.getElementById('novaVarEstoque').value = '0';

    abrirModal('modalLojaNovaVariacao');
};

window.__LOJA.salvarNovaVariacao = async function() {
    const pId = document.getElementById('novaVarProdutoId').value;
    const tam = document.getElementById('novaVarTamanho').value;
    const cor = document.getElementById('novaVarCor').value;
    const preco = parseFloat(document.getElementById('novaVarPreco').value) || 0;
    const estoque = parseInt(document.getElementById('novaVarEstoque').value) || 0;

    const { data: prod } = await sb.from('loja_produtos').select('nome').eq('id', pId).single();

    const vData = {
        empresa_id: getTenantId(),
        produto_id: pId,
        tamanho: tam,
        cor: cor,
        sku: gerarSKULocal(prod?.nome || 'PROD', cor, tam),
        preco,
        estoque
    };

    const { error } = await sb.from('loja_variacoes').insert([vData]);
    if (error) {
        showToast('Erro ao criar variação', 'error');
    } else {
        showToast('Variação criada!', 'success');
        fecharModal('modalLojaNovaVariacao');
        await carregarLojaProdutos();
        const updated = lojaProdutos.find(p => p.id === pId);
        if(updated) {
            lojaCurrentVariacoes = updated.loja_variacoes || [];
            renderVariacoesExistentes();
        }
    }
};

// ------------------------------------------------------------
// CATEGORIAS
// ------------------------------------------------------------
function popularSelectLojaCategorias() {
    const selModal = document.getElementById('lojaProdCategoria');
    const selFiltro = document.getElementById('lojaFiltroCategoria');
    if (!selModal || !selFiltro) return;

    const htmlModal = '<option value="">Sem categoria</option>' + 
        lojaCategorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    selModal.innerHTML = htmlModal;

    const htmlFiltro = '<option value="">Todas categorias</option>' + 
        lojaCategorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    selFiltro.innerHTML = htmlFiltro;
}

function renderLojaCategorias() {
    const tbody = document.getElementById('lojaCategoriasBody');
    if (!tbody) return;

    if (lojaCategorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma categoria.</td></tr>';
        return;
    }

    tbody.innerHTML = lojaCategorias.map(c => `
        <tr>
            <td><strong>${c.nome}</strong></td>
            <td style="text-align:center;">${c.ordem}</td>
            <td style="text-align:center;"><span class="badge ${c.ativo ? 'badge-active' : 'badge-inactive'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <button class="btn-sm btn-edit" onclick="window.__LOJA.editarCategoria('${c.id}')">Editar</button>
                <button class="btn-sm btn-delete" onclick="window.__LOJA.excluirCategoria('${c.id}')">Excluir</button>
            </td>
        </tr>
    `).join('');
}

window.__LOJA.novaCategoria = function() {
    document.getElementById('lojaCatId').value = '';
    document.getElementById('lojaCatNome').value = '';
    document.getElementById('lojaCatOrdem').value = '0';
    document.getElementById('lojaCatAtivo').value = 'true';
    document.getElementById('lojaCatModalTitle').innerText = 'Nova Categoria';
    abrirModal('modalLojaCategoria');
};

window.__LOJA.editarCategoria = function(id) {
    const cat = lojaCategorias.find(c => c.id === id);
    if(!cat) return;
    document.getElementById('lojaCatId').value = cat.id;
    document.getElementById('lojaCatNome').value = cat.nome;
    document.getElementById('lojaCatOrdem').value = cat.ordem;
    document.getElementById('lojaCatAtivo').value = cat.ativo ? 'true' : 'false';
    document.getElementById('lojaCatModalTitle').innerText = 'Editar Categoria';
    abrirModal('modalLojaCategoria');
};

window.__LOJA.salvarCategoria = async function() {
    const id = document.getElementById('lojaCatId').value;
    const nome = document.getElementById('lojaCatNome').value.trim();
    const ordem = parseInt(document.getElementById('lojaCatOrdem').value) || 0;
    const ativo = document.getElementById('lojaCatAtivo').value === 'true';

    if(!nome) { showToast('Nome obrigatório', 'error'); return; }

    const data = { empresa_id: getTenantId(), nome, ordem, ativo };

    try {
        if(id) {
            await sb.from('loja_categorias').update(data).eq('id', id);
            showToast('Categoria atualizada', 'success');
        } else {
            await sb.from('loja_categorias').insert([data]);
            showToast('Categoria criada', 'success');
        }
        fecharModal('modalLojaCategoria');
        await carregarLojaCategorias();
    } catch(err) {
        showToast('Erro ao salvar categoria', 'error');
    }
};

window.__LOJA.excluirCategoria = function(id) {
    customConfirm('Atenção', 'Excluir categoria? Produtos ficarão sem categoria.', async () => {
        await sb.from('loja_categorias').delete().eq('id', id);
        showToast('Excluída', 'success');
        await carregarLojaCategorias();
        await carregarLojaProdutos();
    });
};

// ------------------------------------------------------------
// ESTOQUE CONSOLIDADO
// ------------------------------------------------------------
function renderLojaEstoque() {
    const tbody = document.getElementById('lojaEstoqueBody');
    if (!tbody) return;

    let variacoesFlat = [];
    lojaProdutos.forEach(p => {
        if(p.loja_variacoes) {
            p.loja_variacoes.forEach(v => {
                variacoesFlat.push({ ...v, prodNome: p.nome });
            });
        }
    });

    if (variacoesFlat.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum produto/variação.</td></tr>';
        return;
    }

    tbody.innerHTML = variacoesFlat.map(v => {
        const cor = v.estoque <= 0 ? 'var(--danger)' : (v.estoque <= 5 ? 'var(--warning)' : 'inherit');
        return `
            <tr>
                <td><strong>${v.prodNome}</strong></td>
                <td><span style="font-size:0.8rem; color:var(--text-muted);">${v.sku}</span></td>
                <td>${v.cor}</td>
                <td>${v.tamanho}</td>
                <td style="text-align:center; font-weight:bold; color:${cor}; font-size:1.1rem;">${v.estoque}</td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; border:1px solid var(--border-color); border-radius:6px; overflow:hidden;">
                        <button onclick="window.__LOJA.ajustarEstoque('${v.id}', -1)" style="border:none; background:transparent; padding:4px 10px; cursor:pointer; color:var(--danger); font-weight:bold;">-</button>
                        <button onclick="window.__LOJA.ajustarEstoque('${v.id}', 1)" style="border:none; background:transparent; padding:4px 10px; cursor:pointer; color:var(--success); font-weight:bold; border-left:1px solid var(--border-color);">+</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.__LOJA.ajustarEstoque = async function(id, delta) {
    const funcName = delta > 0 ? 'loja_adicionar_estoque' : 'loja_remover_estoque';
    try {
        const { data, error } = await sb.rpc(funcName, { p_variacao_id: id, p_quantidade: Math.abs(delta) });
        if (error) throw error;
        showToast('Estoque atualizado!', 'success');
        await carregarLojaProdutos();
    } catch (e) {
        showToast(e.message || 'Erro ao atualizar', 'error');
    }
};

// Auto-init imediato (visto que é carregado via lazy load ou após DOMContentLoaded)
if (document.getElementById('tab-loja')) {
    window.__LOJA.init();
}

})();
