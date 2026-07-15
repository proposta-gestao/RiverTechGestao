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
let lojaCurrentProdImages = []; // [{url, id, ordem, produto_id}]
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
    const hasEstoqueMod = typeof isModuloAtivo === 'function' ? isModuloAtivo('loja_estoque') : true;
    
    // Toggle UI elements for stock
    const thCombEstoque = document.getElementById('thCombEstoque');
    const thVarEstoque = document.getElementById('thVarEstoque');
    const groupNvEstoque = document.getElementById('groupNvEstoque');
    const btnTabLojaEstoque = document.querySelector('button[data-subtab="loja-estoque"]');
    
    if (thCombEstoque) thCombEstoque.style.display = hasEstoqueMod ? '' : 'none';
    if (thVarEstoque) thVarEstoque.style.display = hasEstoqueMod ? '' : 'none';
    if (groupNvEstoque) groupNvEstoque.style.display = hasEstoqueMod ? '' : 'none';
    if (btnTabLojaEstoque) btnTabLojaEstoque.style.display = hasEstoqueMod ? '' : 'none';

    const { data, error } = await sb.from('loja_produtos')
        .select('*, loja_categorias(nome), loja_variacoes(*), galeria_imagens(*)')
        .eq('empresa_id', getTenantId())
        .order('ordem', { ascending: true })
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
        const hasEstoque = typeof isModuloAtivo === 'function' ? isModuloAtivo('loja_estoque') : true;
        // Imagem principal: primeiro da galeria ou imagem_url
        const galeria = (p.galeria_imagens || []).sort((a,b) => (a.ordem||0)-(b.ordem||0));
        const imgSrc = galeria[0]?.url || p.imagem_url || 'Logo.png';
        const numFotos = galeria.length || (p.imagem_url ? 1 : 0);

        return `
            <tr data-id="${p.id}">
                <td class="drag-handle" style="cursor:grab; color:var(--text-muted); font-size:1.2rem;">≡</td>
                <td style="position:relative;">
                    <img src="${imgSrc}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
                    ${numFotos > 1 ? `<span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#fff;font-size:0.6rem;padding:1px 4px;border-radius:4px;">${numFotos}</span>` : ''}
                </td>
                <td><strong>${p.nome}</strong></td>
                <td>${catNome}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05);">${numVariacoes} un.</span></td>
                <td style="${hasEstoque ? `color:${corEstoque}; font-weight:bold;` : 'color:var(--text-muted);'}">${hasEstoque ? estoqueTotal : 'N/A'}</td>
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

    initSortableLojaProdutos();
}

function initSortableLojaProdutos() {
    const el = document.getElementById('lojaProdutosBody');
    if (!el) return;

    if (el.sortable) el.sortable.destroy();
    
    el.sortable = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            if (evt.oldIndex === evt.newIndex) return;
            const newOrderIds = Array.from(el.querySelectorAll('tr')).map(tr => tr.dataset.id);
            
            // Atualizar array local
            const reordered = newOrderIds.map(id => lojaProdutos.find(p => p.id === id));
            lojaProdutos = reordered;

            // Salvar no banco
            const updates = lojaProdutos.map((p, i) => 
                sb.from('loja_produtos').update({ ordem: i }).eq('id', p.id)
            );
            await Promise.all(updates);
            showToast('Ordem dos produtos atualizada!', 'success');
        }
    });
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
    
    // Galeria
    lojaCurrentProdImages = [];
    document.getElementById('lojaProdImageUrl').value = '';
    _renderGaleriaGrid();

    // Seção de criação
    document.getElementById('lojaNovosCheckboxes').style.display = 'block';
    document.getElementById('lojaVariacoesExistentes').style.display = 'none';
    
    renderizarCheckboxesTamCor();
    atualizarPreviewCombinacoes();
    
    document.getElementById('lojaModalTitle').innerText = 'Novo Produto';
    abrirModal('modalLojaProduto');
};

window.__LOJA.editarProduto = async function(id) {
    const prod = lojaProdutos.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('lojaProdId').value = prod.id;
    document.getElementById('lojaProdNome').value = prod.nome;
    document.getElementById('lojaProdDescricao').value = prod.descricao || '';
    document.getElementById('lojaProdCategoria').value = prod.loja_categoria_id || '';
    document.getElementById('lojaProdAtivo').value = prod.ativo ? 'true' : 'false';

    // Carregar galeria de imagens do banco
    const { data: galeriaData } = await sb.from('galeria_imagens')
        .select('*')
        .eq('produto_id', id)
        .order('ordem', { ascending: true });
    
    if (galeriaData && galeriaData.length > 0) {
        lojaCurrentProdImages = galeriaData.map(g => ({ id: g.id, url: g.url, ordem: g.ordem || 0, produto_id: g.produto_id }));
    } else {
        // Compatibilidade: imagem_url antiga
        lojaCurrentProdImages = prod.imagem_url ? [{ id: null, url: prod.imagem_url, ordem: 0, produto_id: id }] : [];
    }
    document.getElementById('lojaProdImageUrl').value = lojaCurrentProdImages[0]?.url || '';
    _renderGaleriaGrid();

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
    // Imagem principal é a 1ª da galeria
    const imagem_url = lojaCurrentProdImages[0]?.url || null;

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
        let savedProdId = id;
        if (id) {
            // Edição
            const { error } = await sb.from('loja_produtos').update(prodData).eq('id', id);
            if (error) throw error;
        } else {
            // Criação
            const { data: newProd, error } = await sb.from('loja_produtos').insert([prodData]).select().single();
            if (error) throw error;
            savedProdId = newProd.id;

            // Criar variações se houver
            const trs = document.querySelectorAll('#lojaCombBody tr');
            const varsToInsert = [];
            trs.forEach(tr => {
                const cor = tr.dataset.cor;
                const tam = tr.dataset.tam;
                const precoInput = tr.querySelector('.in-preco');
                const estqInput = tr.querySelector('.in-estoque');
                const fotoInput = tr.querySelector('.in-foto');
                varsToInsert.push({
                    empresa_id: getTenantId(),
                    produto_id: savedProdId,
                    tamanho: tam,
                    cor: cor,
                    sku: gerarSKULocal(nome, cor, tam),
                    preco: parseFloat(precoInput.value) || 0,
                    estoque: parseInt(estqInput.value) || 0,
                    imagem_url: fotoInput ? (fotoInput.value || null) : null
                });
            });

            if (varsToInsert.length > 0) {
                const { error: errVar } = await sb.from('loja_variacoes').insert(varsToInsert);
                if (errVar) console.error('Erro ao inserir variacoes', errVar);
            }
        }

        // Sincronizar galeria_imagens com o produto
        await _sincronizarGaleriaImagens(savedProdId);

        showToast(id ? 'Produto atualizado!' : 'Produto criado!', 'success');
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
// ------------------------------------------------------------------
// GALERIA DE IMAGENS (múltiplas fotos por produto)
// ------------------------------------------------------------------

// Renderiza as miniaturas na grade do modal
function _renderGaleriaGrid() {
    const grid = document.getElementById('lojaGaleriaGrid');
    if (!grid) return;

    const btn = document.getElementById('btnLojaAdicionarImagem');
    if (btn) btn.disabled = lojaCurrentProdImages.length >= 5;

    if (lojaCurrentProdImages.length === 0) {
        grid.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem; padding:10px 0;">Nenhuma foto adicionada ainda.</span>';
        return;
    }

    grid.innerHTML = lojaCurrentProdImages.map((img, idx) => `
        <div style="position:relative; flex-shrink:0;" data-idx="${idx}">
            <img src="${img.url}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid ${idx === 0 ? 'var(--primary)' : 'var(--border-color)'}; display:block;" title="${idx === 0 ? 'Imagem principal' : 'Foto ' + (idx+1)}">
            <!-- Botão Favoritar (torna principal) -->
            ${idx > 0 ? `<button onclick="window.__LOJA.favoritarImagem(${idx})" title="Definir como principal" style="position:absolute; top:-6px; left:-6px; background:rgba(229,178,93,0.9); color:#000; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center; line-height:1;">⭐</button>` : '<span title="Imagem principal" style="position:absolute; top:-6px; left:-6px; background:var(--primary); color:#000; border-radius:50%; width:20px; height:20px; font-size:0.65rem; display:flex; align-items:center; justify-content:center;">★</span>'}
            <!-- Botão Remover -->
            <button onclick="window.__LOJA.removerImagemGaleria(${idx})" title="Remover" style="position:absolute; top:-6px; right:-6px; background:#ef4444; color:#fff; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:0.7rem; display:flex; align-items:center; justify-content:center;">×</button>
        </div>
    `).join('');

    // Atualizar hidden field com a URL principal
    document.getElementById('lojaProdImageUrl').value = lojaCurrentProdImages[0]?.url || '';
}

// Sincroniza lojaCurrentProdImages com a tabela galeria_imagens
async function _sincronizarGaleriaImagens(produtoId) {
    // Apagar registros antigos deste produto
    await sb.from('galeria_imagens').delete().eq('produto_id', produtoId);
    
    if (lojaCurrentProdImages.length === 0) return;

    const registros = lojaCurrentProdImages.map((img, idx) => ({
        empresa_id: getTenantId(),
        produto_id: produtoId,
        url: img.url,
        tipo: 'produto',
        ordem: idx
    }));

    const { error } = await sb.from('galeria_imagens').insert(registros);
    if (error) console.error('[Galeria] Erro ao sincronizar:', error);
}

window.__LOJA.uploadImagem = async function(file) {
    if (!file) return;
    if (lojaCurrentProdImages.length >= 5) {
        showToast('Limite de 5 imagens atingido.', 'warning');
        return;
    }
    const btn = document.getElementById('btnLojaAdicionarImagem');
    btn.disabled = true;
    btn.innerText = 'Enviando...';

    try {
        const url = await window.handleCloudinaryUpload(file, 'loja');
        if (url) {
            lojaCurrentProdImages.push({ id: null, url, ordem: lojaCurrentProdImages.length, produto_id: null });
            _renderGaleriaGrid();
            showToast('Imagem adicionada!', 'success');
        }
    } catch(err) {
        showToast('Erro ao carregar imagem', 'error');
    } finally {
        btn.disabled = lojaCurrentProdImages.length >= 5;
        btn.innerText = '+ Adicionar Foto';
        // Limpar input para permitir re-seleção do mesmo arquivo
        document.getElementById('lojaUploadImagem').value = '';
    }
};

window.__LOJA.removerImagemGaleria = function(idx) {
    lojaCurrentProdImages.splice(idx, 1);
    // Reordenar
    lojaCurrentProdImages.forEach((img, i) => img.ordem = i);
    _renderGaleriaGrid();
};

window.__LOJA.favoritarImagem = function(idx) {
    // Move a foto escolhida para a posição 0 (principal)
    const [img] = lojaCurrentProdImages.splice(idx, 1);
    lojaCurrentProdImages.unshift(img);
    lojaCurrentProdImages.forEach((img, i) => img.ordem = i);
    _renderGaleriaGrid();
    showToast('Imagem principal atualizada!', 'success');
};

// Legado: mantém compatibilidade
window.__LOJA.removerImagem = function() {
    if (lojaCurrentProdImages.length > 0) {
        lojaCurrentProdImages.shift();
        lojaCurrentProdImages.forEach((img, i) => img.ordem = i);
        _renderGaleriaGrid();
    }
};

function atualizarPreviewImagemLoja(url) {
    // Mantido para compatibilidade (não usado mais, mas evita erros)
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
                    <td><input type="number" step="0.01" min="0" class="in-preco" placeholder="" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border-color); background:transparent; color:var(--text-color);"></td>
                    ${hasEstoque ? `<td><input type="number" min="0" class="in-estoque" placeholder="" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border-color); background:transparent; color:var(--text-color);"></td>` : '<input type="hidden" class="in-estoque" value="0">'}
                    <td style="text-align:center;">
                        <input type="hidden" class="in-foto">
                        <button type="button" class="btn-sm" onclick="window.__LOJA.uploadFotoComb(this)" style="width:32px; height:32px; border-radius:6px; border:1px dashed var(--border-color); background:transparent; color:var(--text-color); cursor:pointer; font-size:14px; padding:0; display:flex; align-items:center; justify-content:center;" title="Adicionar foto específica">📷</button>
                    </td>
                </tr>
            `;
        });
    });
    tbody.innerHTML = html;
};

window.__LOJA.uploadFotoComb = function(btn) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const oldContent = btn.innerHTML;
        btn.innerHTML = '⏳';
        btn.disabled = true;
        try {
            const url = await window.handleCloudinaryUpload(file, 'loja');
            if (url) {
                const tr = btn.closest('tr');
                tr.querySelector('.in-foto').value = url;
                btn.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
                btn.style.border = '1px solid var(--primary)';
                showToast('Foto da variação adicionada!', 'success');
            }
        } catch (err) {
            showToast('Erro ao enviar foto', 'error');
            btn.innerHTML = oldContent;
        } finally {
            btn.disabled = false;
        }
    };
    input.click();
};

window.__LOJA.aplicarEstoqueGlobal = function() {
    const trs = document.querySelectorAll('#lojaCombBody tr');
    if (trs.length === 0) return;
    
    const globalPreco = document.getElementById('globalPreco').value;
    const globalEstoque = document.getElementById('globalEstoque').value;

    trs.forEach(tr => {
        if(globalPreco !== '') tr.querySelector('.in-preco').value = globalPreco;
        if(globalEstoque !== '') {
            const inEstoque = tr.querySelector('.in-estoque');
            if(inEstoque) inEstoque.value = globalEstoque;
        }
    });
};

// ------------------------------------------------------------
// VARIAÇÕES - EDIÇÃO
// ------------------------------------------------------------
function renderVariacoesExistentes() {
    const tbody = document.getElementById('lojaVariacoesEditBody');
    const hasEstoque = typeof isModuloAtivo === 'function' ? isModuloAtivo('loja_estoque') : true;

    if (lojaCurrentVariacoes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${hasEstoque ? 7 : 6}" style="text-align:center;">Nenhuma variação.</td></tr>`;
        return;
    }

    tbody.innerHTML = lojaCurrentVariacoes.map(v => {
        const imgHtml = v.imagem_url
            ? `<img src="${v.imagem_url}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;" title="Clique para trocar foto" onclick="window.__LOJA.trocarFotoVariacao('${v.id}')">`
            : `<div style="width:36px;height:36px;border-radius:6px;border:1px dashed var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.9rem;cursor:pointer;" title="Clique para adicionar foto" onclick="window.__LOJA.trocarFotoVariacao('${v.id}')">📷</div>`;
        
        const estoqueHtml = hasEstoque
            ? `<td style="cursor:pointer;" onclick="window.__LOJA.abrirModalEstoqueVariacao('${v.id}')" title="Ajustar Estoque"><strong>${v.estoque}</strong> ✎</td>`
            : '';

        return `
        <tr>
            <td>${imgHtml}</td>
            <td style="font-size:0.8rem; color:var(--text-muted);">${v.sku}</td>
            <td>${v.cor}</td>
            <td>${v.tamanho}</td>
            <td>R$ ${parseFloat(v.preco||0).toFixed(2)}</td>
            ${estoqueHtml}
            <td>
                <div style="display:flex;gap:4px;">
                    <button class="btn-sm btn-edit" onclick="window.__LOJA.abrirEditarVariacao('${v.id}')" title="Editar preço e foto">Editar</button>
                    <button class="btn-sm btn-delete" onclick="window.__LOJA.excluirVariacao('${v.id}')">Excluir</button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

window.__LOJA.abrirEditarVariacao = function(id) {
    const v = lojaCurrentVariacoes.find(x => x.id === id);
    if (!v) return;

    document.getElementById('editVarId').value = v.id;
    document.getElementById('editVarInfo').textContent = `SKU: ${v.sku} | Cor: ${v.cor} | Tam: ${v.tamanho}`;
    document.getElementById('editVarPreco').value = v.preco || '';
    document.getElementById('editVarImageUrl').value = v.imagem_url || '';

    const preview = document.getElementById('editVarImagePreview');
    if (v.imagem_url) {
        preview.innerHTML = `<img src="${v.imagem_url}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        preview.innerHTML = `<span id="editVarImageIcon" style="font-size:1.5rem;">🖼️</span>`;
    }

    abrirModal('modalEditarVariacao');
};

window.__LOJA.trocarFotoVariacao = function(id) {
    // If clicked on the photo directly from the table, open the edit modal
    window.__LOJA.abrirEditarVariacao(id);
};

window.__LOJA.uploadFotoEdicaoVariacao = async function(file) {
    if (!file) return;
    showToast('Enviando foto...', 'info');
    
    const ext = file.name.split('.').pop();
    const fileName = `loja-var-${Date.now()}.${ext}`;
    const filePath = `variacoes/${getTenantId()}/${fileName}`;

    const { error: errUp } = await sb.storage.from('produtos').upload(filePath, file);
    if (errUp) {
        showToast('Erro ao subir foto: ' + errUp.message, 'error');
        return;
    }

    const { data: { publicUrl } } = sb.storage.from('produtos').getPublicUrl(filePath);
    
    document.getElementById('editVarImageUrl').value = publicUrl;
    document.getElementById('editVarImagePreview').innerHTML = `<img src="${publicUrl}" style="width:100%;height:100%;object-fit:cover;">`;
    showToast('Foto adicionada! Lembre de salvar.', 'success');
};

window.__LOJA.removerFotoEdicaoVariacao = function() {
    document.getElementById('editVarImageUrl').value = '';
    document.getElementById('editVarImagePreview').innerHTML = `<span id="editVarImageIcon" style="font-size:1.5rem;">🖼️</span>`;
};

window.__LOJA.salvarEdicaoVariacao = async function() {
    const id = document.getElementById('editVarId').value;
    const preco = parseFloat(document.getElementById('editVarPreco').value) || 0;
    const imagem_url = document.getElementById('editVarImageUrl').value || null;

    if (!id) return;

    showToast('Salvando...', 'info');
    const { error } = await sb.from('loja_variacoes')
        .update({ preco, imagem_url })
        .eq('id', id);

    if (error) {
        showToast('Erro ao salvar', 'error');
    } else {
        showToast('Variação atualizada!', 'success');
        fecharModal('modalEditarVariacao');
        await carregarLojaProdutos();
        const pId = document.getElementById('lojaProdId').value;
        const updated = lojaProdutos.find(p => p.id === pId);
        if(updated) {
            lojaCurrentVariacoes = updated.loja_variacoes || [];
            renderVariacoesExistentes();
        }
    }
};

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

window.__LOJA.abrirModalNovaVariacao = function() {
    const pId = document.getElementById('lojaProdId').value;
    document.getElementById('novaVarProdutoId').value = pId;
    
    const selTam = document.getElementById('novaVarTamanho');
    selTam.innerHTML = TAMANHOS_PADRAO.map(t => `<option value="${t}">${t}</option>`).join('');
    
    const selCor = document.getElementById('novaVarCor');
    selCor.innerHTML = CORES_PADRAO.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');

    document.getElementById('novaVarPreco').value = '0';
    document.getElementById('novaVarEstoque').value = '0';
    // Limpar foto da variação
    document.getElementById('novaVarImageUrl').value = '';
    document.getElementById('novaVarImagePreview').innerHTML = '<span style="font-size:1.5rem;">\uD83D\uDDBC\uFE0F</span>';
    document.getElementById('lojaUploadVarImagem').value = '';

    abrirModal('modalLojaNovaVariacao');
};

window.__LOJA.uploadImagemVariacao = async function(file) {
    if (!file) return;
    showToast('Enviando foto...', 'success');
    try {
        const url = await window.handleCloudinaryUpload(file, 'loja');
        if (url) {
            document.getElementById('novaVarImageUrl').value = url;
            const prev = document.getElementById('novaVarImagePreview');
            prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
            showToast('Foto da variação carregada!', 'success');
        }
    } catch(e) {
        showToast('Erro ao enviar foto', 'error');
    } finally {
        document.getElementById('lojaUploadVarImagem').value = '';
    }
};

window.__LOJA.removerImagemVariacao = function() {
    document.getElementById('novaVarImageUrl').value = '';
    document.getElementById('novaVarImagePreview').innerHTML = '<span style="font-size:1.5rem;">\uD83D\uDDBC\uFE0F</span>';
};

window.__LOJA.salvarNovaVariacao = async function() {
    const pId = document.getElementById('novaVarProdutoId').value;
    const tam = document.getElementById('novaVarTamanho').value;
    const cor = document.getElementById('novaVarCor').value;
    const preco = parseFloat(document.getElementById('novaVarPreco').value) || 0;
    const estoque = parseInt(document.getElementById('novaVarEstoque').value) || 0;
    const imagem_url = document.getElementById('novaVarImageUrl').value || null;

    const { data: prod } = await sb.from('loja_produtos').select('nome').eq('id', pId).single();

    const vData = {
        empresa_id: getTenantId(),
        produto_id: pId,
        tamanho: tam,
        cor: cor,
        sku: gerarSKULocal(prod?.nome || 'PROD', cor, tam),
        preco,
        estoque,
        imagem_url
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
        <tr data-id="${c.id}">
            <td class="drag-handle" style="cursor:grab; color:var(--text-muted); font-size:1.2rem;">≡</td>
            <td><strong>${c.nome}</strong></td>
            <td style="text-align:center;">${c.ordem}</td>
            <td style="text-align:center;"><span class="badge ${c.ativo ? 'badge-active' : 'badge-inactive'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <button class="btn-sm btn-edit" onclick="window.__LOJA.editarCategoria('${c.id}')">Editar</button>
                <button class="btn-sm btn-delete" onclick="window.__LOJA.excluirCategoria('${c.id}')">Excluir</button>
            </td>
        </tr>
    `).join('');

    initSortableLojaCategorias();
}

function initSortableLojaCategorias() {
    const el = document.getElementById('lojaCategoriasBody');
    if (!el) return;

    if (el.sortable) el.sortable.destroy();
    
    el.sortable = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            if (evt.oldIndex === evt.newIndex) return;
            const newOrderIds = Array.from(el.querySelectorAll('tr')).map(tr => tr.dataset.id);
            
            const reordered = newOrderIds.map(id => lojaCategorias.find(c => c.id === id));
            lojaCategorias = reordered;

            const updates = lojaCategorias.map((c, i) => 
                sb.from('loja_categorias').update({ ordem: i }).eq('id', c.id)
            );
            await Promise.all(updates);
            showToast('Ordem das categorias atualizada!', 'success');
            renderLojaCategorias(); // Para atualizar o número da ordem na tela
        }
    });
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
                    <div style="display:inline-flex; align-items:center; gap:6px;">
                        <input type="number" id="inEstoqueGeral_${v.id}" value="${v.estoque}" min="0" style="width:70px; text-align:center; padding:4px; border-radius:6px; border:1px solid var(--border-color); background:transparent; color:var(--text-color); font-weight:bold;">
                        <button onclick="window.__LOJA.salvarEstoqueGeralExato('${v.id}', ${v.estoque})" class="btn-sm btn-primary" title="Salvar quantidade">💾</button>
                        <button onclick="window.__LOJA.abrirModalEstoqueVariacao('${v.id}')" class="btn-sm" style="background:transparent; border:1px solid var(--border-color); color:var(--text-color);" title="Histórico e Ajuste Completo">📋</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.__LOJA.ajustarEstoque = async function(id, delta) {
    if (delta === 0) return;
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

window.__LOJA.salvarEstoqueGeralExato = async function(id, estoqueAtual) {
    const input = document.getElementById(`inEstoqueGeral_${id}`);
    if (!input) return;
    
    const novoEstoque = parseInt(input.value);
    if (isNaN(novoEstoque) || novoEstoque < 0) {
        showToast('Quantidade inválida.', 'warning');
        return;
    }
    
    const delta = novoEstoque - estoqueAtual;
    if (delta === 0) {
        showToast('Estoque não foi alterado.', 'info');
        return;
    }
    
    // Use the existing delta update function
    await window.__LOJA.ajustarEstoque(id, delta);
};

// ==========================================
// MÓDULO DE ESTOQUE DA LOJA (VARIAÇÕES)
// ==========================================

window.__LOJA.abrirModalEstoqueVariacao = async function(varId) {
    if (typeof validarAcessoModulo === 'function' && !validarAcessoModulo('loja_estoque')) return;
    
    const variacao = lojaCurrentVariacoes.find(v => v.id === varId);
    if (!variacao) return;

    document.getElementById('lojaVarId').value = variacao.id;
    document.getElementById('lojaVarEstoque').value = variacao.estoque;
    document.getElementById('lojaVarEstoqueDisplay').textContent = variacao.estoque;
    document.getElementById('lojaVarMovimentacaoEstoque').value = '';
    document.getElementById('lojaVarObsMovimentacao').value = '';
    document.getElementById('lojaVarTipoMovimentacao').value = 'entrada';
    
    // Atualizar label ao mudar tipo
    const selectTipo = document.getElementById('lojaVarTipoMovimentacao');
    const qtdLabel = document.getElementById('lojaVarQtdLabel');
    selectTipo.onchange = function() {
        if (qtdLabel) {
            if (this.value === 'exato') {
                qtdLabel.textContent = 'Quantidade Exata (novo total)';
            } else {
                qtdLabel.textContent = 'Quantidade';
            }
        }
    };
    if (qtdLabel) qtdLabel.textContent = 'Quantidade';

    // Atualiza motivos
    const selectMotivo = document.getElementById('lojaVarMotivoSelect');
    selectMotivo.innerHTML = '<option value="">Selecione...</option>' + 
        (window.motivosEstoque || []).filter(m => m.active).map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    abrirModal('modalLojaEstoque');
    await window.__LOJA.carregarHistoricoEstoqueVariacao(variacao.id);
};

window.__LOJA.carregarHistoricoEstoqueVariacao = async function(varId) {
    const tbody = document.getElementById('lojaVarEstoqueHistoryBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>';
    
    const { data, error } = await sb.from('stock_movements')
        .select('*, stock_reasons(name)')
        .eq('loja_variacao_id', varId)
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (error) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--danger);">Erro ao carregar histórico.</td></tr>';
        return;
    }
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhuma movimentação registrada.</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(m => {
        const dateObj = new Date(m.created_at);
        const dataStr = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        const isEntrada = m.type === 'entrada';
        const isExato = m.type === 'exato';
        const color = isExato ? 'var(--text-muted)' : (isEntrada ? 'var(--success)' : 'var(--danger)');
        const signal = isExato ? '↔' : (isEntrada ? '+' : '-');
        const tipoLabel = isExato ? 'Ajuste Exato' : (isEntrada ? 'Entrada' : 'Saída');
        const motivo = m.stock_reasons ? m.stock_reasons.name : (m.reason || '-');
        
        return `
            <tr>
                <td style="font-size:0.8rem; color:var(--text-muted);">${dataStr}</td>
                <td style="color:${color}; font-weight:bold;">${tipoLabel}</td>
                <td style="color:${color}; font-weight:bold;">${signal}${m.quantity}</td>
                <td style="font-size:0.85rem;" title="${m.notes || ''}">${motivo}</td>
            </tr>
        `;
    }).join('');
};

window.__LOJA.salvarMovimentacaoEstoqueLoja = async function() {
    const varId = document.getElementById('lojaVarId').value;
    const tipo = document.getElementById('lojaVarTipoMovimentacao').value;
    const qtdInput = document.getElementById('lojaVarMovimentacaoEstoque').value;
    const qtd = parseInt(qtdInput);
    const motivoId = document.getElementById('lojaVarMotivoSelect').value;
    const obs = document.getElementById('lojaVarObsMovimentacao').value;
    
    if (!qtdInput || qtd < 0) {
        showToast('Informe uma quantidade válida.', 'error');
        return;
    }
    if (!motivoId) {
        showToast('Selecione um motivo para a movimentação.', 'error');
        return;
    }

    const variacao = lojaCurrentVariacoes.find(v => v.id === varId);
    if (!variacao) return;

    let novoEstoque;
    const estoqueAtual = parseInt(variacao.estoque || 0);

    if (tipo === 'exato') {
        novoEstoque = qtd;
    } else if (tipo === 'entrada') {
        if (qtd <= 0) { showToast('Quantidade deve ser maior que zero.', 'error'); return; }
        novoEstoque = estoqueAtual + qtd;
    } else { // saida
        if (qtd <= 0) { showToast('Quantidade deve ser maior que zero.', 'error'); return; }
        novoEstoque = estoqueAtual - qtd;
        if (novoEstoque < 0) {
            showToast('A saída não pode ser maior que o estoque atual.', 'error');
            return;
        }
    }

    const empresaId = getTenantId();

    try {
        // 1. Atualizar estoque na loja_variacoes
        const { error: errUpdate } = await sb.from('loja_variacoes')
            .update({ estoque: novoEstoque })
            .eq('id', varId);
            
        if (errUpdate) throw errUpdate;

        // 2. Registrar movimento em stock_movements
        const { error: errLog } = await sb.from('stock_movements').insert({
            loja_variacao_id: varId,
            empresa_id: empresaId,
            type: tipo,
            quantity: qtd,
            reason_id: motivoId,
            notes: obs
        });

        if (errLog) console.error('Erro ao registrar log de estoque (loja)', errLog);

        showToast('Estoque atualizado com sucesso!', 'success');
        
        // Atualizar estado local e tela
        variacao.estoque = novoEstoque;
        document.getElementById('lojaVarEstoque').value = novoEstoque;
        document.getElementById('lojaVarEstoqueDisplay').textContent = novoEstoque;
        document.getElementById('lojaVarMovimentacaoEstoque').value = '';
        document.getElementById('lojaVarObsMovimentacao').value = '';
        
        // Recarregar histórico e tabelas
        await window.__LOJA.carregarHistoricoEstoqueVariacao(varId);
        renderVariacoesExistentes();
        carregarLojaProdutos();
        
    } catch (error) {
        console.error('Erro atualizar estoque:', error);
        showToast('Erro ao atualizar estoque.', 'error');
    }
};

window.__LOJA.novoMotivoEstoqueLoja = async function() {
    const name = await customPrompt('Novo Motivo de Estoque', 'Digite o nome do motivo:');
    if (name && name.trim()) {
        const nextOrder = (window.motivosEstoque && window.motivosEstoque.length > 0) 
            ? Math.max(...window.motivosEstoque.map(m => m.order_position || 0)) + 1 
            : 1;

        const { error } = await sb.from('stock_reasons').insert({ 
            name: name.trim(), 
            empresa_id: getTenantId(),
            order_position: nextOrder
        });
        if (error) {
            showToast('Erro ao criar: ' + error.message, 'error');
        } else {
            showToast('Motivo criado!', 'success');
            if (typeof carregarMotivosEstoque === 'function') {
                await carregarMotivosEstoque();
            }
            // Atualiza select no modal da loja
            const selectMotivo = document.getElementById('lojaVarMotivoSelect');
            selectMotivo.innerHTML = '<option value="">Selecione...</option>' + 
                (window.motivosEstoque || []).filter(m => m.active).map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        }
    }
};

// Auto-init imediato (visto que é carregado via lazy load ou após DOMContentLoaded)
if (document.getElementById('tab-loja')) {
    window.__LOJA.init();
}

})();
