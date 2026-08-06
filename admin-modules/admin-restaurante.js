// ============================================================
// MÓDULO RESTAURANTE — FICHA TÉCNICA
// admin-modules/admin-restaurante.js
//
// PASSO 1: Cadastros base
//   - Depósitos
//   - Fornecedores
//   - Categorias de Insumos
//   - Insumos (com estoque por depósito)
//   - Ficha Técnica por produto
//   - Inventário Físico
//   - Configurações do restaurante
//
// Exclusivo do segmento Restaurante.
// Ativado via modulos.ficha_tecnica = true no super admin.
// ============================================================

(function () {
    'use strict';

    if (window.__RESTAURANTE_SCRIPT_INICIADO) return;
    window.__RESTAURANTE_SCRIPT_INICIADO = true;

    window.__RESTAURANTE = window.__RESTAURANTE || {};

    // Referência ao cliente Supabase (já inicializado pelo admin.js)
    const sb = window.sb;

    // ============================================================
    // ESTADO LOCAL
    // ============================================================
    let state = {
        depositos: [],
        fornecedores: [],
        categoriasInsumos: [],
        insumos: [],
        unidades: [],
        fichasTecnicas: [],
        inventarios: [],
        movimentacoes: [],
        restaurantConfig: null,
        produtosCardapio: [],
        // Contexto de edição
        editingInsumoId: null,
        editingFichaId: null,
        editingFichaItens: [],
        editingInventarioId: null,
        editingDepositoId: null,
        editingFornecedorId: null,
        editingCategoriaId: null,
    };

    // ============================================================
    // HELPER: obtém o tenant ID do contexto global
    // ============================================================
    function getTenantId() {
        // Usa o padrão nativo do sistema (tenant.js)
        if (window.TENANT && window.TENANT.empresa_id) return window.TENANT.empresa_id;
        // Fallback para função global se existir
        if (typeof window.getTenantId === 'function') return window.getTenantId();
        console.warn('[Restaurante] empresa_id não disponível ainda.');
        return null;
    }

    // ============================================================
    // HELPER: Toast genérico
    // ============================================================
    function toast(msg, type = 'success') {
        if (window.showToast) { window.showToast(msg, type); return; }
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.className = `toast toast-${type} show`;
        setTimeout(() => el.classList.remove('show'), 3500);
    }

    // ============================================================
    // HELPER: formata valor em BRL
    // ============================================================
    function fmtBRL(val) {
        const n = parseFloat(val) || 0;
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // ============================================================
    // HELPER: abre/fecha modal
    // ============================================================
    function abrirModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }
    function fecharModalRest(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    }

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================
    window.__RESTAURANTE.init = async function () {
        try {
            console.log('[Restaurante] Iniciando módulo...');
            const tenantId = getTenantId();
            console.log('[Restaurante] TenantId:', tenantId);
            if (!tenantId) {
                console.error('[Restaurante] ERRO: empresa_id não disponível. Módulo não pode iniciar.');
                toast('Erro ao carregar módulo: empresa não identificada.', 'error');
                return;
            }
            setupSubtabs();
            console.log('[Restaurante] Carregando dados...');
            await Promise.all([
                carregarUnidades(),
                carregarConfig(),
                carregarDepositos(),
                carregarFornecedores(),
                carregarCategoriasInsumos(),
                carregarProdutosCardapio(),
            ]);
            console.log('[Restaurante] Dados base carregados. Carregando insumos...');
            await carregarInsumos();
            console.log('[Restaurante] Renderizando...');
            renderDepositos();
            renderFornecedores();
            renderCategoriasInsumos();
            renderInsumos();
            renderFichasTecnicas();
            await carregarInventarios();
            renderInventarios();
            await carregarMovimentacoes();
            renderMovimentacoes();
            renderConfig();

            // Máscara de telefone para fornecedor
            const inputTelefone = document.getElementById('restFornTelefone');
            if (inputTelefone && !inputTelefone.dataset.maskInitialized) {
                inputTelefone.dataset.maskInitialized = 'true';
                inputTelefone.addEventListener('input', () => {
                    let digits = inputTelefone.value.replace(/\D/g, '').slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 2) formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                    if (digits.length > 7) formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                    inputTelefone.value = formatted;
                });
            }

            // Eventos para cálculo dinâmico do custo do insumo
            const inpCusto = document.getElementById('restInsumoCusto');
            const inpQtd = document.getElementById('restInsumoQtdEmbalagem');
            const selUnid = document.getElementById('restInsumoUnidade');
            const selUnidCompra = document.getElementById('restInsumoUnidadeCompra');
            if (inpCusto && !inpCusto.dataset.calcInitialized) {
                inpCusto.dataset.calcInitialized = 'true';
                inpCusto.addEventListener('input', atualizarHintCustoInsumo);
                if (inpQtd) inpQtd.addEventListener('input', atualizarHintCustoInsumo);
                if (selUnid) selUnid.addEventListener('change', atualizarHintCustoInsumo);
                if (selUnidCompra) selUnidCompra.addEventListener('change', atualizarHintCustoInsumo);
            }


            window.__RESTAURANTE_DADOS_CARREGADOS = true;
            console.log('[Restaurante] ✅ Módulo pronto!');
        } catch (err) {
            console.error('[Restaurante] ❌ ERRO na inicialização:', err);
            toast('Erro ao inicializar módulo Restaurante: ' + (err.message || err), 'error');
        }
    };

    // ============================================================
    // SUBTABS
    // ============================================================
    function setupSubtabs() {
        const btns = document.querySelectorAll('#tab-restaurante .rest-subtab-btn');
        const contents = document.querySelectorAll('#tab-restaurante .rest-subtab-content');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetId = 'rest-subtab-' + btn.dataset.subtab;
                const target = document.getElementById(targetId);
                if (target) target.classList.add('active');
            });
        });
    }

    // ============================================================
    // UNIDADES DE MEDIDA (tabela global — apenas leitura)
    // ============================================================
    async function carregarUnidades() {
        const { data, error } = await sb.from('unidades_medida')
            .select('*')
            .eq('ativo', true)
            .order('tipo')
            .order('nome');
        if (error) { console.error('[Restaurante] Erro ao carregar unidades:', error); return; }
        state.unidades = data || [];
    }

    // Helper: retorna fator_conversao de uma unidade pelo id
    function getFator(unidadeId) {
        const u = state.unidades.find(x => x.id === unidadeId);
        return u ? (parseFloat(u.fator_conversao) || 1) : 1;
    }

    // Helper: calcula custo médio por unidade de uso
    // valorPago = R$ total pago pela embalagem
    // qtdEmbalagem = quantidade de unidades de compra na embalagem
    // fatorCompra = fator_conversao da unidade de compra
    // fatorUso = fator_conversao da unidade de uso
    // Fórmula: valorPago / (qtdEmbalagem * fatorCompra / fatorUso)
    // Exemplo: R$2.400 / (24 kg * 1000 / 1) = R$0,10 por grama
    function calcularCustoMedio(valorPago, qtdEmbalagem, fatorCompra, fatorUso) {
        const qtd = qtdEmbalagem > 0 ? qtdEmbalagem : 1;
        const fC = fatorCompra > 0 ? fatorCompra : 1;
        const fU = fatorUso > 0 ? fatorUso : 1;
        return valorPago / (qtd * fC / fU);
    }

    function buildUnidadeOptions(selectedId = '') {
        const grupos = {};
        state.unidades.forEach(u => {
            if (!grupos[u.tipo]) grupos[u.tipo] = [];
            grupos[u.tipo].push(u);
        });
        const labels = { massa: 'Massa', volume: 'Volume', unidade: 'Unidade', comprimento: 'Comprimento' };
        let html = '<option value="">Selecione...</option>';
        Object.keys(grupos).forEach(tipo => {
            html += `<optgroup label="${labels[tipo] || tipo}">`;
            grupos[tipo].forEach(u => {
                html += `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${u.nome} (${u.simbolo})</option>`;
            });
            html += '</optgroup>';
        });
        return html;
    }

    // ============================================================
    // CONFIGURAÇÕES DO RESTAURANTE
    // ============================================================
    async function carregarConfig() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data } = await sb.from('restaurant_config')
            .select('*')
            .eq('empresa_id', tenantId)
            .maybeSingle();
        state.restaurantConfig = data;
    }

    function renderConfig() {
        const container = document.getElementById('rest-config-container');
        if (!container) return;
        const cfg = state.restaurantConfig || {};
        container.innerHTML = `
            <div class="rest-card">
                <div class="rest-card-header">
                    <h3>⚙️ Configurações do Módulo</h3>
                </div>
                <div class="rest-card-body">
                    <div class="form-row">
                        <div class="form-group" style="flex:1">
                            <label for="restGatilhoBaixa">Momento da Baixa de Estoque</label>
                            <select id="restGatilhoBaixa">
                                <option value="recebido" ${cfg.baixa_estoque_gatilho === 'recebido' ? 'selected' : ''}>Ao receber o pedido</option>
                                <option value="preparo" ${cfg.baixa_estoque_gatilho === 'preparo' ? 'selected' : ''}>Ao iniciar o preparo</option>
                                <option value="concluido" ${!cfg.baixa_estoque_gatilho || cfg.baixa_estoque_gatilho === 'concluido' ? 'selected' : ''}>Ao concluir o pedido</option>
                                <option value="entregue" ${cfg.baixa_estoque_gatilho === 'entregue' ? 'selected' : ''}>Ao entregar</option>
                            </select>
                            <small style="color:var(--text-muted)">Disponível a partir do PASSO 4 (baixa automática).</small>
                        </div>
                        <div class="form-group" style="flex:1">
                            <label>Opções de Controle</label>
                            <div class="rest-toggles">
                                <label class="rest-toggle">
                                    <input type="checkbox" id="restBloquearSemEstoque" ${cfg.bloquear_sem_estoque ? 'checked' : ''}>
                                    <span>Bloquear venda sem estoque suficiente</span>
                                </label>
                                <label class="rest-toggle">
                                    <input type="checkbox" id="restReservaAtiva" ${cfg.reserva_ativa ? 'checked' : ''} disabled>
                                    <span style="opacity:0.5">Reserva de insumos (PASSO 4+)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; margin-top:1rem;">
                        <button class="btn-primary" onclick="window.__RESTAURANTE.salvarConfig()">💾 Salvar Configurações</button>
                    </div>
                </div>
            </div>`;
    }

    window.__RESTAURANTE.salvarConfig = async function () {
        const tenantId = getTenantId();
        const payload = {
            empresa_id: tenantId,
            baixa_estoque_gatilho: document.getElementById('restGatilhoBaixa').value,
            bloquear_sem_estoque: document.getElementById('restBloquearSemEstoque').checked,
        };
        const { error } = await sb.from('restaurant_config').upsert(payload, { onConflict: 'empresa_id' });
        if (error) { toast('Erro ao salvar configurações.', 'error'); return; }
        state.restaurantConfig = payload;
        toast('Configurações salvas!');
    };

    // ============================================================
    // DEPÓSITOS
    // ============================================================
    async function carregarDepositos() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('depositos')
            .select('*')
            .eq('empresa_id', tenantId)
            .order('nome');
        if (error) { console.error('[Restaurante] Erro depósitos:', error); return; }
        state.depositos = data || [];
    }

    function renderDepositos() {
        const container = document.getElementById('rest-depositos-lista');
        if (!container) return;
        if (!state.depositos.length) {
            container.innerHTML = '<p class="rest-empty">Nenhum depósito cadastrado. Clique em <strong>+ Novo Depósito</strong> para começar.</p>';
            return;
        }
        const tipoLabel = { geral: 'Geral', cozinha: 'Cozinha', bar: 'Bar', central: 'Estoque Central', filial: 'Filial', outro: 'Outro' };
        container.innerHTML = state.depositos.map(d => `
            <div class="rest-list-item ${!d.ativo ? 'inativo' : ''}">
                <div class="rest-list-info">
                    <span class="rest-list-nome">${d.nome}</span>
                    <span class="rest-badge">${tipoLabel[d.tipo] || d.tipo}</span>
                    ${!d.ativo ? '<span class="rest-badge rest-badge--off">Inativo</span>' : ''}
                </div>
                <div class="rest-list-actions" style="align-items: center; gap: 12px;">
                    <label class="switch" title="${d.ativo ? 'Desativar' : 'Ativar'}">
                        <input type="checkbox" ${d.ativo ? 'checked' : ''} onchange="window.__RESTAURANTE.toggleDeposito('${d.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button class="btn-sm btn-edit" onclick="window.__RESTAURANTE.editarDeposito('${d.id}')">Editar</button>
                </div>
            </div>`).join('');
    }

    window.__RESTAURANTE.novoDeposito = function () {
        state.editingDepositoId = null;
        document.getElementById('restDepositoId').value = '';
        document.getElementById('restDepositoNome').value = '';
        document.getElementById('restDepositoTipo').value = 'geral';
        document.getElementById('restDepositoAtivo').checked = true;
        document.getElementById('modalRestDeposito').querySelector('h3').textContent = '🏪 Novo Depósito';
        abrirModal('modalRestDeposito');
    };

    window.__RESTAURANTE.editarDeposito = function (id) {
        const d = state.depositos.find(x => x.id === id);
        if (!d) return;
        state.editingDepositoId = id;
        document.getElementById('restDepositoId').value = id;
        document.getElementById('restDepositoNome').value = d.nome;
        document.getElementById('restDepositoTipo').value = d.tipo;
        document.getElementById('restDepositoAtivo').checked = d.ativo;
        document.getElementById('modalRestDeposito').querySelector('h3').textContent = '✏️ Editar Depósito';
        abrirModal('modalRestDeposito');
    };

    window.__RESTAURANTE.salvarDeposito = async function () {
        const nome = document.getElementById('restDepositoNome').value.trim();
        if (!nome) { toast('Nome do depósito é obrigatório.', 'error'); return; }
        const tenantId = getTenantId();
        const payload = {
            empresa_id: tenantId,
            nome,
            tipo: document.getElementById('restDepositoTipo').value,
            ativo: document.getElementById('restDepositoAtivo').checked,
        };
        let error;
        if (state.editingDepositoId) {
            ({ error } = await sb.from('depositos').update(payload).eq('id', state.editingDepositoId));
        } else {
            ({ error } = await sb.from('depositos').insert(payload));
        }
        if (error) { toast('Erro ao salvar depósito.', 'error'); return; }
        fecharModalRest('modalRestDeposito');
        await carregarDepositos();
        renderDepositos();
        toast('Depósito salvo!');
    };

    window.__RESTAURANTE.toggleDeposito = async function (id, novoStatus) {
        const { error } = await sb.from('depositos').update({ ativo: novoStatus }).eq('id', id);
        if (error) { toast('Erro ao alterar status.', 'error'); return; }
        await carregarDepositos();
        renderDepositos();
        toast(novoStatus ? 'Depósito ativado.' : 'Depósito desativado.');
    };

    // ============================================================
    // FORNECEDORES
    // ============================================================
    async function carregarFornecedores() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('fornecedores')
            .select('*')
            .eq('empresa_id', tenantId)
            .order('nome');
        if (error) { console.error('[Restaurante] Erro fornecedores:', error); return; }
        state.fornecedores = data || [];
    }

    function renderFornecedores() {
        const container = document.getElementById('rest-fornecedores-lista');
        if (!container) return;
        if (!state.fornecedores.length) {
            container.innerHTML = '<p class="rest-empty">Nenhum fornecedor cadastrado.</p>';
            return;
        }
        container.innerHTML = state.fornecedores.map(f => `
            <div class="rest-list-item ${!f.ativo ? 'inativo' : ''}">
                <div class="rest-list-info">
                    <span class="rest-list-nome">${f.nome}</span>
                    ${f.telefone ? `<span class="rest-list-detail">📞 ${f.telefone}</span>` : ''}
                    ${f.email ? `<span class="rest-list-detail">✉️ ${f.email}</span>` : ''}
                    ${f.contato ? `<span class="rest-list-detail">👤 ${f.contato}</span>` : ''}
                    ${!f.ativo ? '<span class="rest-badge rest-badge--off">Inativo</span>' : ''}
                </div>
                <div class="rest-list-actions" style="align-items: center; gap: 12px;">
                    <label class="switch" title="${f.ativo ? 'Desativar' : 'Ativar'}">
                        <input type="checkbox" ${f.ativo ? 'checked' : ''} onchange="window.__RESTAURANTE.toggleFornecedor('${f.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button class="btn-sm btn-edit" onclick="window.__RESTAURANTE.editarFornecedor('${f.id}')">Editar</button>
                </div>
            </div>`).join('');
    }

    window.__RESTAURANTE.novoFornecedor = function () {
        state.editingFornecedorId = null;
        ['restFornId', 'restFornNome', 'restFornTelefone', 'restFornEmail', 'restFornContato', 'restFornObs'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('restFornAtivo').checked = true;
        document.getElementById('modalRestFornecedor').querySelector('h3').textContent = '🚚 Novo Fornecedor';
        abrirModal('modalRestFornecedor');
    };

    window.__RESTAURANTE.editarFornecedor = function (id) {
        const f = state.fornecedores.find(x => x.id === id);
        if (!f) return;
        state.editingFornecedorId = id;
        document.getElementById('restFornId').value = id;
        document.getElementById('restFornNome').value = f.nome || '';
        document.getElementById('restFornTelefone').value = f.telefone || '';
        document.getElementById('restFornEmail').value = f.email || '';
        document.getElementById('restFornContato').value = f.contato || '';
        document.getElementById('restFornObs').value = f.observacoes || '';
        document.getElementById('restFornAtivo').checked = f.ativo;
        document.getElementById('modalRestFornecedor').querySelector('h3').textContent = '✏️ Editar Fornecedor';
        abrirModal('modalRestFornecedor');
    };

    window.__RESTAURANTE.salvarFornecedor = async function () {
        const nome = document.getElementById('restFornNome').value.trim();
        if (!nome) { toast('Nome do fornecedor é obrigatório.', 'error'); return; }
        const tenantId = getTenantId();
        const payload = {
            empresa_id: tenantId,
            nome,
            telefone: document.getElementById('restFornTelefone').value.trim() || null,
            email: document.getElementById('restFornEmail').value.trim() || null,
            contato: document.getElementById('restFornContato').value.trim() || null,
            observacoes: document.getElementById('restFornObs').value.trim() || null,
            ativo: document.getElementById('restFornAtivo').checked,
        };
        let error;
        if (state.editingFornecedorId) {
            ({ error } = await sb.from('fornecedores').update(payload).eq('id', state.editingFornecedorId));
        } else {
            ({ error } = await sb.from('fornecedores').insert(payload));
        }
        if (error) { toast('Erro ao salvar fornecedor.', 'error'); return; }
        fecharModalRest('modalRestFornecedor');
        await carregarFornecedores();
        renderFornecedores();
        toast('Fornecedor salvo!');
    };

    window.__RESTAURANTE.toggleFornecedor = async function (id, novoStatus) {
        const { error } = await sb.from('fornecedores').update({ ativo: novoStatus }).eq('id', id);
        if (error) { toast('Erro ao alterar status.', 'error'); return; }
        await carregarFornecedores();
        renderFornecedores();
        toast(novoStatus ? 'Fornecedor ativado.' : 'Fornecedor desativado.');
    };

    // ============================================================
    // CATEGORIAS DE INSUMOS
    // ============================================================
    async function carregarCategoriasInsumos() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('categorias_insumos')
            .select('*')
            .eq('empresa_id', tenantId)
            .order('nome');
        if (error) { console.error('[Restaurante] Erro categorias insumos:', error); return; }
        state.categoriasInsumos = data || [];
    }

    function renderCategoriasInsumos() {
        const container = document.getElementById('rest-categorias-lista');
        if (!container) return;
        if (!state.categoriasInsumos.length) {
            container.innerHTML = '<p class="rest-empty">Nenhuma categoria cadastrada.</p>';
            return;
        }
        container.innerHTML = state.categoriasInsumos.map(c => `
            <div class="rest-list-item ${!c.ativo ? 'inativo' : ''}">
                <div class="rest-list-info">
                    <span class="rest-list-nome">${c.nome}</span>
                    ${!c.ativo ? '<span class="rest-badge rest-badge--off">Inativa</span>' : ''}
                </div>
                <div class="rest-list-actions" style="align-items: center; gap: 12px;">
                    <label class="switch" title="${c.ativo ? 'Desativar' : 'Ativar'}">
                        <input type="checkbox" ${c.ativo ? 'checked' : ''} onchange="window.__RESTAURANTE.toggleCategoria('${c.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button class="btn-sm btn-edit" onclick="window.__RESTAURANTE.editarCategoria('${c.id}')">Editar</button>
                </div>
            </div>`).join('');
    }

    window.__RESTAURANTE.novaCategoria = function () {
        state.editingCategoriaId = null;
        document.getElementById('restCatId').value = '';
        document.getElementById('restCatNome').value = '';
        document.getElementById('restCatAtivo').checked = true;
        document.getElementById('modalRestCategoria').querySelector('h3').textContent = '🏷️ Nova Categoria';
        abrirModal('modalRestCategoria');
    };

    window.__RESTAURANTE.editarCategoria = function (id) {
        const c = state.categoriasInsumos.find(x => x.id === id);
        if (!c) return;
        state.editingCategoriaId = id;
        document.getElementById('restCatId').value = id;
        document.getElementById('restCatNome').value = c.nome;
        document.getElementById('restCatAtivo').checked = c.ativo;
        document.getElementById('modalRestCategoria').querySelector('h3').textContent = '✏️ Editar Categoria';
        abrirModal('modalRestCategoria');
    };

    window.__RESTAURANTE.salvarCategoria = async function () {
        const nome = document.getElementById('restCatNome').value.trim();
        if (!nome) { toast('Nome da categoria é obrigatório.', 'error'); return; }
        const tenantId = getTenantId();
        const payload = {
            empresa_id: tenantId,
            nome,
            ativo: document.getElementById('restCatAtivo').checked,
        };
        let error;
        if (state.editingCategoriaId) {
            ({ error } = await sb.from('categorias_insumos').update(payload).eq('id', state.editingCategoriaId));
        } else {
            ({ error } = await sb.from('categorias_insumos').insert(payload));
        }
        if (error) { toast('Erro ao salvar categoria.', 'error'); return; }
        fecharModalRest('modalRestCategoria');
        await carregarCategoriasInsumos();
        renderCategoriasInsumos();
        toast('Categoria salva!');
    };

    window.__RESTAURANTE.toggleCategoria = async function (id, novoStatus) {
        const { error } = await sb.from('categorias_insumos').update({ ativo: novoStatus }).eq('id', id);
        if (error) { toast('Erro ao alterar status.', 'error'); return; }
        await carregarCategoriasInsumos();
        renderCategoriasInsumos();
    };

    // ============================================================
    // PRODUTOS DO CARDÁPIO (para seleção na ficha técnica)
    // ============================================================
    async function carregarProdutosCardapio() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('products')
            .select('id, name, price')
            .eq('empresa_id', tenantId)
            .eq('active', true)
            .order('name');
        if (error) { console.error('[Restaurante] Erro produtos:', error); return; }
        state.produtosCardapio = data || [];
    }

    // ============================================================
    // INSUMOS
    // ============================================================
    async function carregarInsumos() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('insumos')
            .select(`
                *,
                categorias_insumos (nome),
                fornecedores (nome),
                unidade_medida:unidades_medida!insumos_unidade_medida_id_fkey (nome, simbolo, fator_conversao),
                unidade_compra:unidades_medida!insumos_unidade_compra_id_fkey (nome, simbolo, fator_conversao),
                estoque_insumos (estoque_atual, estoque_minimo, deposito_id, depositos(nome))
            `)
            .eq('empresa_id', tenantId)
            .order('nome');
        if (error) { console.error('[Restaurante] Erro insumos:', error); return; }
        state.insumos = data || [];
    }

    function renderInsumos() {
        const container = document.getElementById('rest-insumos-lista');
        if (!container) return;
        if (!state.insumos.length) {
            container.innerHTML = '<p class="rest-empty">Nenhum insumo cadastrado. Clique em <strong>+ Novo Insumo</strong> para começar.</p>';
            return;
        }
        const insumosFiltro = document.getElementById('restInsumoBusca')?.value?.toLowerCase() || '';
        const categoriaFiltro = document.getElementById('restInsumoCategoriaFiltro')?.value || '';
        let lista = state.insumos;
        if (insumosFiltro) lista = lista.filter(i => i.nome.toLowerCase().includes(insumosFiltro));
        if (categoriaFiltro) lista = lista.filter(i => i.categoria_id === categoriaFiltro);

        container.innerHTML = lista.map(ins => {
            const totalEstoque = (ins.estoque_insumos || []).reduce((sum, e) => sum + (parseFloat(e.estoque_atual) || 0), 0);
            const minEstoque = (ins.estoque_insumos || []).reduce((sum, e) => sum + (parseFloat(e.estoque_minimo) || 0), 0);
            const alertaEstoque = totalEstoque <= minEstoque && minEstoque > 0;
            const unSimbolo = ins.unidade_medida?.simbolo || '';
            const categoria = ins.categorias_insumos?.nome || '—';
            const fornecedor = ins.fornecedores?.nome || '—';
            const totalEstoqueFormatted = totalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
            return `
            <div class="rest-insumo-card ${alertaEstoque ? 'alerta-minimo' : ''} ${!ins.ativo ? 'inativo' : ''}" style="display:flex; flex-direction:column; gap:10px; padding:12px;">
                <!-- Linha 1: Nome (com Código) e Switch Ativo/Inativo -->
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="rest-insumo-nome" style="font-weight:600; font-size:0.95rem;">
                        ${ins.codigo_interno ? `<span style="color:var(--text-muted); font-size:0.85rem; margin-right:4px;">${ins.codigo_interno} -</span> ` : ''}${ins.nome}
                    </span>
                    <label class="switch" title="${ins.ativo ? 'Desativar' : 'Ativar'}" style="margin-bottom:0;">
                        <input type="checkbox" ${ins.ativo ? 'checked' : ''} onchange="window.__RESTAURANTE.toggleInsumo('${ins.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>
                <!-- Linha 2: Ações (Editar, Estoque) e Badges -->
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button class="btn-sm btn-edit" style="padding: 4px 8px; font-size: 0.75rem;" onclick="window.__RESTAURANTE.editarInsumo('${ins.id}')">Editar</button>
                    <button class="btn-sm" style="padding: 4px 8px; font-size: 0.75rem; background:rgba(229,178,93,0.1); color:var(--primary); border:1px solid rgba(229,178,93,0.2);" title="Gerenciar Estoque" onclick="window.__RESTAURANTE.gerenciarEstoque('${ins.id}')">Estoque</button>
                    ${alertaEstoque ? '<span class="rest-badge rest-badge--alerta">⚠️ Estoque mínimo</span>' : ''}
                    ${!ins.ativo ? '<span class="rest-badge rest-badge--off">Inativo</span>' : ''}
                </div>
                <!-- Linha 3: Tags de detalhes -->
                <div class="rest-insumo-details" style="margin-top:0; border-top:none; padding-top:0; display:flex; flex-wrap:wrap; gap:8px 12px; font-size:0.8rem;">
                    <span>🏷️ ${categoria}</span>
                    <span>🚚 ${fornecedor}</span>
                    <span>📏 ${unSimbolo}</span>
                    <span>💰 Custo: ${fmtBRL(ins.custo_medio)}/${unSimbolo}</span>
                    <span class="${alertaEstoque ? 'text-danger' : ''}">📦 Estoque: ${totalEstoqueFormatted} ${unSimbolo}</span>
                </div>
            </div>`;
        }).join('');
    }

    function parseBRL(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        let str = value.toString().trim();
        if (str.includes(',')) {
            str = str.replace(/\./g, '').replace(',', '.');
        }
        return parseFloat(str) || 0;
    }

    function atualizarHintCustoInsumo() {
        const valorPago = parseBRL(document.getElementById('restInsumoCusto').value);
        const qtdEmbalagem = parseFloat(document.getElementById('restInsumoQtdEmbalagem').value) || 1;

        // Obtém fator de conversão da unidade de USO
        const selUso = document.getElementById('restInsumoUnidade');
        const unidadeUsoId = selUso?.value || '';
        const fatorUso = getFator(unidadeUsoId);
        let simboloUso = 'un';
        if (selUso && selUso.selectedIndex >= 0) {
            const txt = selUso.options[selUso.selectedIndex].text;
            const match = txt.match(/\(([^)]+)\)/);
            if (match) simboloUso = match[1];
        }

        // Obtém fator de conversão da unidade de COMPRA
        const selCompra = document.getElementById('restInsumoUnidadeCompra');
        const unidadeCompraId = selCompra?.value || '';
        const fatorCompra = unidadeCompraId ? getFator(unidadeCompraId) : fatorUso;
        let simboloCompra = simboloUso;
        if (selCompra && selCompra.selectedIndex >= 0 && selCompra.value) {
            const txt = selCompra.options[selCompra.selectedIndex].text;
            const match = txt.match(/\(([^)]+)\)/);
            if (match) simboloCompra = match[1];
        }

        // Fórmula correta: valorPago / (qtdEmbalagem × fatorCompra / fatorUso)
        // Exemplo: R$2.400 / (24 kg × 1000g/kg ÷ 1g) = R$0,10/g
        const custoMedio = calcularCustoMedio(valorPago, qtdEmbalagem, fatorCompra, fatorUso);
        const custoFormatado = custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Qtd total na embalagem em unidade de uso
        const totalUsoUnits = qtdEmbalagem * fatorCompra / fatorUso;
        const totalFormatado = totalUsoUnits.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

        const hintEl = document.getElementById('restInsumoCustoCalculadoHint');
        if (hintEl) {
            hintEl.innerHTML =
                `Custo por <strong>${simboloUso}</strong>: <strong style="color:#fff;">${custoFormatado}</strong>` +
                (unidadeCompraId && unidadeCompraId !== unidadeUsoId
                    ? ` <span style="color:var(--text-muted); font-size:0.8em;">(embalagem = ${totalFormatado} ${simboloUso})</span>`
                    : '');
        }
    }


    window.__RESTAURANTE.novoInsumo = function () {
        state.editingInsumoId = null;
        document.getElementById('restInsumoId').value = '';
        document.getElementById('restInsumoNome').value = '';
        document.getElementById('restInsumoCategoria').innerHTML = buildCategoriaOptions();
        document.getElementById('restInsumoFornecedor').innerHTML = buildFornecedorOptions();
        document.getElementById('restInsumoUnidade').innerHTML = buildUnidadeOptions();
        document.getElementById('restInsumoUnidadeCompra').innerHTML = buildUnidadeOptions();
        document.getElementById('restInsumoQtdEmbalagem').value = '';
        document.getElementById('restInsumoCusto').value = '';
        document.getElementById('restInsumoCodigo').value = '';
        document.getElementById('restInsumoControlaLote').checked = false;
        document.getElementById('restInsumoControlaValidade').checked = false;
        document.getElementById('restInsumoAtivo').checked = true;
        document.getElementById('restInsumoEstoqueInicial').value = '';
        document.getElementById('restInsumoEstoqueMinimo').value = '';
        document.getElementById('restInsumoEstoqueInicialRow').style.display = 'flex'; // mostra em novo insumo
        document.getElementById('modalRestInsumo').querySelector('h3').textContent = '🧂 Novo Insumo';
        
        // Reset do hint de custo calculado
        const hintEl = document.getElementById('restInsumoCustoCalculadoHint');
        if (hintEl) hintEl.innerHTML = 'Custo por unidade de uso: R$ 0,00';
        
        abrirModal('modalRestInsumo');
    };

    window.__RESTAURANTE.editarInsumo = function (id) {
        const ins = state.insumos.find(x => x.id === id);
        if (!ins) return;
        state.editingInsumoId = id;
        document.getElementById('restInsumoId').value = id;
        document.getElementById('restInsumoNome').value = ins.nome;
        document.getElementById('restInsumoCategoria').innerHTML = buildCategoriaOptions(ins.categoria_id);
        document.getElementById('restInsumoFornecedor').innerHTML = buildFornecedorOptions(ins.fornecedor_id);
        document.getElementById('restInsumoUnidade').innerHTML = buildUnidadeOptions(ins.unidade_medida_id);
        document.getElementById('restInsumoUnidadeCompra').innerHTML = buildUnidadeOptions(ins.unidade_compra_id);
        document.getElementById('restInsumoQtdEmbalagem').value = ins.quantidade_por_embalagem || '';
        
        // Custo exibido é o preço pago pela embalagem inteira
        // Reconstrói: valorPago = custo_medio × qtdEmbalagem × fatorCompra / fatorUso
        const fUso = parseFloat(ins.unidade_medida?.fator_conversao) || 1;
        const fCompra = parseFloat(ins.unidade_compra?.fator_conversao) || fUso;
        const qtdEmb = parseFloat(ins.quantidade_por_embalagem) || 1;
        const valorPagoEdit = (ins.custo_medio || 0) * qtdEmb * fCompra / fUso;
        document.getElementById('restInsumoCusto').value = valorPagoEdit > 0 ? valorPagoEdit.toFixed(2) : (ins.custo_medio || '');

        
        document.getElementById('restInsumoCodigo').value = ins.codigo_interno || '';
        document.getElementById('restInsumoControlaLote').checked = ins.controla_lote;
        document.getElementById('restInsumoControlaValidade').checked = ins.controla_validade;
        document.getElementById('restInsumoAtivo').checked = ins.ativo;
        document.getElementById('restInsumoEstoqueInicialRow').style.display = 'none'; // esconde em edição
        document.getElementById('restInsumoEstoqueInicial').value = '';
        document.getElementById('restInsumoEstoqueMinimo').value = '';
        document.getElementById('modalRestInsumo').querySelector('h3').textContent = '✏️ Editar Insumo';
        
        // Atualiza o hint de custo calculado
        atualizarHintCustoInsumo();
        
        abrirModal('modalRestInsumo');
    };

    window.__RESTAURANTE.salvarInsumo = async function () {
        const nome = document.getElementById('restInsumoNome').value.trim();
        const unidadeId = document.getElementById('restInsumoUnidade').value;
        const codigoInterno = document.getElementById('restInsumoCodigo').value.trim();

        if (!nome) { toast('Nome do insumo é obrigatório.', 'error'); return; }
        if (!unidadeId) { toast('Unidade de medida é obrigatória.', 'error'); return; }
        if (!codigoInterno) { toast('Código Interno é obrigatório.', 'error'); return; }

        const tenantId = getTenantId();

        // Verifica se o código interno já existe para esta empresa
        let queryValidaCod = sb.from('insumos')
            .select('id')
            .eq('empresa_id', tenantId)
            .eq('codigo_interno', codigoInterno);
        if (state.editingInsumoId) {
            queryValidaCod = queryValidaCod.neq('id', state.editingInsumoId);
        }
        const { data: dataCod } = await queryValidaCod;
        if (dataCod && dataCod.length > 0) {
            toast('Já existe um insumo com este Código Interno.', 'error');
            return;
        }

        // Obtém fatores de conversão para cálculo correto do custo unitário
        const unidadeUsoId = document.getElementById('restInsumoUnidade').value;
        const unidadeCompraId = document.getElementById('restInsumoUnidadeCompra').value || unidadeUsoId;
        const fatorUso = getFator(unidadeUsoId);
        const fatorCompra = getFator(unidadeCompraId);
        const valorPago = parseBRL(document.getElementById('restInsumoCusto').value);
        const qtdEmbalagem = parseFloat(document.getElementById('restInsumoQtdEmbalagem').value) || 1;

        // Fórmula correta: valorPago / (qtdEmbalagem × fatorCompra / fatorUso)
        // Ex: R$2.400 / (24 kg × 1000 / 1) = R$0,10 por grama
        const custoMedio = calcularCustoMedio(valorPago, qtdEmbalagem, fatorCompra, fatorUso);

        const payload = {
            empresa_id: tenantId,
            nome,
            categoria_id: document.getElementById('restInsumoCategoria').value || null,
            fornecedor_id: document.getElementById('restInsumoFornecedor').value || null,
            unidade_medida_id: unidadeId,
            unidade_compra_id: document.getElementById('restInsumoUnidadeCompra').value || null,
            quantidade_por_embalagem: parseFloat(document.getElementById('restInsumoQtdEmbalagem').value) || null,
            custo_medio: custoMedio,
            codigo_interno: codigoInterno,
            controla_lote: document.getElementById('restInsumoControlaLote').checked,
            controla_validade: document.getElementById('restInsumoControlaValidade').checked,
            ativo: document.getElementById('restInsumoAtivo').checked,
        };
        let error, savedId;
        if (state.editingInsumoId) {
            ({ error } = await sb.from('insumos').update(payload).eq('id', state.editingInsumoId));
            savedId = state.editingInsumoId;
        } else {
            const { data, error: err } = await sb.from('insumos').insert(payload).select().single();
            error = err;
            savedId = data?.id;
        }
        if (error) { toast('Erro ao salvar insumo: ' + error.message, 'error'); return; }

        // Estoque inicial (apenas em novo insumo)
        // O usuário informa a quantidade em UNIDADE DE COMPRA (ex: 24 KG)
        // Converte para UNIDADE DE USO (ex: gramas) antes de salvar
        if (!state.editingInsumoId && savedId) {
            const estoqueInicialCompra = parseFloat(document.getElementById('restInsumoEstoqueInicial').value) || 0;
            const estoqueMinimoCompra = parseFloat(document.getElementById('restInsumoEstoqueMinimo').value) || 0;
            
            if (estoqueInicialCompra > 0 || estoqueMinimoCompra > 0) {
                // Converte para unidade de uso: qtd_compra × fatorCompra / fatorUso
                const estoqueInicialUso = estoqueInicialCompra * fatorCompra / fatorUso;
                
                // O usuário digita o estoque mínimo já na unidade de USO (conforme hint na UI)
                const estoqueMinimoUso = estoqueMinimoCompra;

                // Pega o depósito principal (primeiro ativo)
                const depositoPrincipal = state.depositos.find(d => d.ativo);
                if (depositoPrincipal) {
                    await sb.from('estoque_insumos').upsert({
                        empresa_id: tenantId,
                        insumo_id: savedId,
                        deposito_id: depositoPrincipal.id,
                        estoque_atual: estoqueInicialUso,
                        estoque_minimo: estoqueMinimoUso,
                        atualizado_em: new Date().toISOString(),
                    }, { onConflict: 'empresa_id,insumo_id,deposito_id' });
                    
                    // Registra movimentação de estoque inicial se houver quantidade
                    if (estoqueInicialUso > 0) {
                        await sb.from('movimentacoes_insumos').insert({
                            empresa_id: tenantId,
                            insumo_id: savedId,
                            deposito_id: depositoPrincipal.id,
                            tipo: 'entrada',
                            quantidade: estoqueInicialUso,
                            custo_unitario: custoMedio,
                            observacao: 'Estoque inicial',
                        });
                    }
                }
            }
        }
        
        fecharModalRest('modalRestInsumo');
        await carregarInsumos();
        renderInsumos();
        toast('Insumo salvo!');
    };

    window.__RESTAURANTE.toggleInsumo = async function (id, novoStatus) {
        const { error } = await sb.from('insumos').update({ ativo: novoStatus }).eq('id', id);
        if (error) { toast('Erro ao alterar status.', 'error'); return; }
        await carregarInsumos();
        renderInsumos();
    };

    // ============================================================
    // ESTOQUE DO INSUMO POR DEPÓSITO
    // ============================================================
    window.__RESTAURANTE.gerenciarEstoque = async function (insumoId) {
        const ins = state.insumos.find(x => x.id === insumoId);
        if (!ins) return;
        const unSimbolo = ins.unidade_medida?.simbolo || '';
        const container = document.getElementById('restEstoqueDepositosLista');
        document.getElementById('restEstoqueInsumoNome').textContent = ins.nome + ` (${unSimbolo})`;
        document.getElementById('restEstoqueInsumoId').value = insumoId;

        // Painel de tipo de operação (sempre visível ao abrir o modal de edição)
        const rowTipo = document.getElementById('restEstoqueRowTipo');
        rowTipo.style.display = 'block';
        document.getElementById('restEstoqueTipo').value = 'entrada';
        document.getElementById('restEstoqueQtd').value = '';
        document.getElementById('restEstoqueQtdLabel').textContent = 'Quantidade de Entrada';
        document.getElementById('restEstoqueMotivoBox').style.display = 'none';
        document.getElementById('restEstoqueMotivoId').value = '';
        document.getElementById('restEstoqueObs').value = '';

        // Carrega estoque atual
        const estoqueAtual = ins.estoque_insumos || [];

        let html = '';
        if (!state.depositos.length) {
            html = '<p class="rest-empty">Nenhum depósito cadastrado. Crie um depósito primeiro.</p>';
        } else {
            html = state.depositos.filter(d => d.ativo).map(dep => {
                const estEntry = estoqueAtual.find(e => e.deposito_id === dep.id);
                const estoqueAtualVal = estEntry ? parseFloat(estEntry.estoque_atual).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                const estoqueMinVal = estEntry ? parseFloat(estEntry.estoque_minimo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                return `
                <div class="rest-estoque-deposito-item">
                    <strong>${dep.nome}</strong>
                    <div class="form-row" style="margin-top:8px; gap:8px;">
                        <div class="form-group" style="flex:1">
                            <label style="color:var(--text-muted); font-size:0.8rem;">Saldo Atual (${unSimbolo})</label>
                            <div style="padding:6px 10px; background:rgba(255,255,255,0.05); border-radius:6px; font-weight:600;">${estoqueAtualVal} ${unSimbolo}</div>
                        </div>
                        <div class="form-group" style="flex:1">
                            <label for="estMin_${dep.id}">Estoque Mínimo (${unSimbolo})</label>
                            <input type="number" step="0.01" min="0"
                                id="estMin_${dep.id}"
                                value="${estEntry ? estEntry.estoque_minimo : 0}">
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
        container.innerHTML = html;
        abrirModal('modalRestEstoque');
    };

    // Listener para mostrar/ocultar motivo de saída no modal de estoque
    (function () {
        const sel = document.getElementById('restEstoqueTipo');
        if (sel && !sel.dataset.listenerOk) {
            sel.dataset.listenerOk = 'true';
            sel.addEventListener('change', () => {
                const isSaida = sel.value === 'saida';
                document.getElementById('restEstoqueMotivoBox').style.display = isSaida ? 'block' : 'none';
                document.getElementById('restEstoqueQtdLabel').textContent = isSaida ? 'Quantidade de Saída' : 'Quantidade de Entrada';
            });
        }
    })();

    window.__RESTAURANTE.salvarEstoque = async function () {
        const insumoId = document.getElementById('restEstoqueInsumoId').value;
        const tenantId = getTenantId();
        const ins = state.insumos.find(x => x.id === insumoId);
        const depositosAtivos = state.depositos.filter(d => d.ativo);
        const tipo = document.getElementById('restEstoqueTipo')?.value || 'entrada';
        const qtdMovimento = parseFloat(document.getElementById('restEstoqueQtd')?.value) || 0;
        const motivo = document.getElementById('restEstoqueMotivoId')?.value || null;
        const obs = document.getElementById('restEstoqueObs')?.value.trim() || null;

        // Se foi informada quantidade de movimenta\u00e7\u00e3o, aplica delta no dep\u00f3sito selecionado
        if (qtdMovimento > 0 && depositosAtivos.length > 0) {
            // Aplica no primeiro dep\u00f3sito ativo como dep\u00f3sito padr\u00e3o se houver apenas 1
            // ou no dep\u00f3sito que j\u00e1 tem saldo
            const estoqueAtual = ins?.estoque_insumos || [];
            let depositoAlvo = depositosAtivos.find(d => estoqueAtual.some(e => e.deposito_id === d.id)) || depositosAtivos[0];

            const entryAtual = estoqueAtual.find(e => e.deposito_id === depositoAlvo.id);
            const saldoAtual = entryAtual ? parseFloat(entryAtual.estoque_atual) : 0;
            const novoSaldo = tipo === 'entrada' ? saldoAtual + qtdMovimento : Math.max(0, saldoAtual - qtdMovimento);

            const { error: errEst } = await sb.from('estoque_insumos').upsert({
                empresa_id: tenantId,
                insumo_id: insumoId,
                deposito_id: depositoAlvo.id,
                estoque_atual: novoSaldo,
                estoque_minimo: entryAtual?.estoque_minimo || 0,
                atualizado_em: new Date().toISOString(),
            }, { onConflict: 'empresa_id,insumo_id,deposito_id' });

            if (!errEst) {
                await sb.from('movimentacoes_insumos').insert({
                    empresa_id: tenantId,
                    insumo_id: insumoId,
                    deposito_id: depositoAlvo.id,
                    tipo,
                    quantidade: qtdMovimento,
                    custo_unitario: ins?.custo_medio || null,
                    motivo: tipo === 'saida' ? (motivo || null) : null,
                    observacao: tipo === 'saida' ? obs : (obs || null),
                });
            }
        }

        // Atualiza estoque m\u00ednimo de todos os dep\u00f3sitos
        let erros = 0;
        for (const dep of depositosAtivos) {
            const estMinEl = document.getElementById(`estMin_${dep.id}`);
            if (!estMinEl) continue;
            const estoqueAtual = ins?.estoque_insumos || [];
            const entryAtual = estoqueAtual.find(e => e.deposito_id === dep.id);
            const { error } = await sb.from('estoque_insumos').upsert({
                empresa_id: tenantId,
                insumo_id: insumoId,
                deposito_id: dep.id,
                estoque_atual: entryAtual ? parseFloat(entryAtual.estoque_atual) : 0,
                estoque_minimo: parseFloat(estMinEl.value) || 0,
                atualizado_em: new Date().toISOString(),
            }, { onConflict: 'empresa_id,insumo_id,deposito_id' });
            if (error) erros++;
        }
        if (erros) { toast('Erro ao salvar alguns estoques.', 'error'); return; }
        fecharModalRest('modalRestEstoque');
        await carregarInsumos();
        renderInsumos();
        toast('Estoque atualizado!');
    };

    // ============================================================
    // FICHAS TÉCNICAS
    // ============================================================
    async function carregarFichasTecnicas() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('ficha_tecnica')
            .select(`
                *,
                products (name, price, estoque_calculado, controle_estoque),
                ficha_tecnica_itens (
                    id, quantidade, insumo_id, unidade_medida_id,
                    insumos (nome, custo_medio),
                    unidades_medida (nome, simbolo)
                )
            `)
            .eq('empresa_id', tenantId)
            .order('criado_em', { ascending: false });
        if (error) { console.error('[Restaurante] Erro fichas técnicas:', error); return; }
        state.fichasTecnicas = data || [];
    }

    function renderFichasTecnicas() {
        carregarFichasTecnicas().then(() => {
            const container = document.getElementById('rest-fichas-lista');
            if (!container) return;
            if (!state.fichasTecnicas.length) {
                container.innerHTML = '<p class="rest-empty">Nenhuma ficha técnica cadastrada. Selecione um produto para criar.</p>';
                return;
            }
            const grupos = {};
            state.fichasTecnicas.forEach(ft => {
                const key = ft.product_id;
                if (!grupos[key]) grupos[key] = [];
                grupos[key].push(ft);
            });
            container.innerHTML = Object.keys(grupos).map(productId => {
                const fichas = grupos[productId];
                const fichaAtiva = fichas.find(f => f.ativo) || fichas[0];
                const produto = fichaAtiva.products;
                const itens = fichaAtiva.ficha_tecnica_itens || [];
                const custo = fichaAtiva.custo_calculado || 0;
                const margem = produto?.price ? ((produto.price - custo) / produto.price * 100).toFixed(1) : null;
                const estoqueCalc = produto?.estoque_calculado;
                const estoqueLabel = estoqueCalc != null
                    ? `<span style="color:${estoqueCalc <= 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:600;">${estoqueCalc <= 0 ? '⚠️ 0 (sem estoque)' : estoqueCalc + ' disponíveis'}</span>`
                    : '<span style="color:var(--text-muted);">N/A</span>';
                return `
                <div class="rest-ficha-card" style="display:flex; flex-direction:column; gap:10px; padding:12px;">
                    <!-- Linha 1: Nome, versão e switch ativo/inativo -->
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="rest-ficha-produto" style="font-weight:600; font-size:1rem;">
                            ${produto?.name || 'Produto removido'} <span style="color:var(--text-muted); font-size:0.8rem; margin-left:4px;">v${fichaAtiva.versao}</span>
                        </span>
                        <label class="switch" title="${fichaAtiva.ativo ? 'Desativar' : 'Ativar'}" style="margin-bottom:0;">
                            <input type="checkbox" ${fichaAtiva.ativo ? 'checked' : ''} onchange="window.__RESTAURANTE.toggleFicha('${fichaAtiva.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                    
                    <!-- Linha 2: Informações (Sessão de informações primeiro) -->
                    <div class="rest-ficha-footer" style="margin-top:0; border-top:none; padding-top:0; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; flex-wrap:wrap; gap:8px 12px; font-size:0.85rem;">
                        <span>💰 Custo: <strong>${fmtBRL(custo)}</strong></span>
                        ${produto?.price ? `<span>💵 Preço: <strong>${fmtBRL(produto.price)}</strong></span>` : ''}
                        ${margem !== null ? `<span>📈 Margem: <strong>${margem}%</strong></span>` : ''}
                        ${fichaAtiva.quantidade_produzida ? `<span>🍽️ Rende: ${fichaAtiva.quantidade_produzida} porções</span>` : ''}
                        <span>📦 Estoque: ${estoqueLabel}</span>
                    </div>

                    <!-- Linha 3: Ingredientes -->
                    <div class="rest-ficha-itens" style="margin-top:0; font-size:0.85rem;">
                        <p style="margin-bottom:6px; font-weight:600; color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">Ingredientes</p>
                        ${itens.map(it => `
                            <span class="rest-ficha-item" style="display:inline-block; margin-right:8px; margin-bottom:6px;">
                                ${it.insumos?.nome}: <strong>${it.quantidade} ${it.unidades_medida?.simbolo || ''}</strong>
                                <em style="color:var(--text-muted)">(${fmtBRL(it.insumos?.custo_medio * it.quantidade)})</em>
                            </span>`).join('')}
                    </div>

                    <!-- Linha 4: Botões de ação -->
                    <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                        <button class="btn-sm btn-edit" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.__RESTAURANTE.editarFicha('${fichaAtiva.id}')">Editar Ficha</button>
                        <button class="btn-sm" style="padding: 4px 10px; font-size: 0.75rem; background:rgba(229,178,93,0.1); color:var(--primary); border:1px solid rgba(229,178,93,0.2);" onclick="window.__RESTAURANTE.novaVersaoFicha('${productId}')">Nova Versão</button>
                        ${fichaAtiva.observacoes ? `<button class="btn-sm" style="padding: 4px 10px; font-size: 0.75rem; background:rgba(46,204,113,0.1); color:#2ecc71; border:1px solid rgba(46,204,113,0.2);" onclick="window.__RESTAURANTE.verPreparo('${fichaAtiva.id}')">📖 Modo de Preparo</button>` : ''}
                    </div>
                </div>`;
            }).join('');
        });
    }

    window.__RESTAURANTE.toggleFicha = async function (id, novoStatus) {
        const { error } = await sb.from('ficha_tecnica').update({ ativo: novoStatus }).eq('id', id);
        if (error) { toast('Erro ao alterar status da ficha.', 'error'); return; }
        await carregarFichasTecnicas();
        renderFichasTecnicas();
    };

    window.__RESTAURANTE.verPreparo = function(fichaId) {
        let fichaEncontrada = null;
        for (const f of state.fichasTecnicas) {
            if (f.id === fichaId) {
                fichaEncontrada = f;
                break;
            }
        }
        if (!fichaEncontrada) return;
        document.getElementById('restPreparoNome').textContent = fichaEncontrada.products?.name || 'Produto';
        document.getElementById('restPreparoTexto').innerHTML = (fichaEncontrada.observacoes || 'Nenhum preparo informado.').replace(/\n/g, '<br>');
        abrirModal('modalRestPreparo');
    };

    window.__RESTAURANTE.novaFicha = function () {
        state.editingFichaId = null;
        state.editingFichaItens = [];
        // Popular select de produtos
        const select = document.getElementById('restFichaProduto');
        select.innerHTML = '<option value="">Selecione o produto...</option>' +
            state.produtosCardapio.map(p => `<option value="${p.id}">${p.name} (${fmtBRL(p.price)})</option>`).join('');
        document.getElementById('restFichaId').value = '';
        document.getElementById('restFichaVersao').value = '1';
        document.getElementById('restFichaAtivo').checked = true;
        document.getElementById('restFichaObs').value = '';
        document.getElementById('restFichaQtdProduzida').value = '';
        document.getElementById('restFichaUnidProduzida').innerHTML = buildUnidadeOptions();
        renderItensEditorFicha();
        document.getElementById('modalRestFicha').querySelector('h3').textContent = '📋 Nova Ficha Técnica';
        abrirModal('modalRestFicha');
    };

    window.__RESTAURANTE.editarFicha = function (id) {
        const ft = state.fichasTecnicas.find(x => x.id === id);
        if (!ft) return;
        state.editingFichaId = id;
        state.editingFichaItens = (ft.ficha_tecnica_itens || []).map(it => ({
            id: it.id,
            insumo_id: it.insumo_id,
            insumo_nome: it.insumos?.nome || '',
            quantidade: it.quantidade,
            unidade_medida_id: it.unidade_medida_id,
            unidade_simbolo: it.unidades_medida?.simbolo || '',
            custo_medio: it.insumos?.custo_medio || 0,
        }));
        const select = document.getElementById('restFichaProduto');
        select.innerHTML = '<option value="">Selecione o produto...</option>' +
            state.produtosCardapio.map(p =>
                `<option value="${p.id}" ${p.id === ft.product_id ? 'selected' : ''}>${p.name} (${fmtBRL(p.price)})</option>`
            ).join('');
        document.getElementById('restFichaId').value = id;
        document.getElementById('restFichaVersao').textContent = `v${ft.versao}`;
        document.getElementById('restFichaAtivo').checked = ft.ativo;
        document.getElementById('restFichaObs').value = ft.observacoes || '';
        document.getElementById('restFichaQtdProduzida').value = ft.quantidade_produzida || '';
        document.getElementById('restFichaUnidProduzida').innerHTML = buildUnidadeOptions(ft.unidade_produzida_id);
        renderItensEditorFicha();
        document.getElementById('modalRestFicha').querySelector('h3').textContent = '✏️ Editar Ficha Técnica';
        abrirModal('modalRestFicha');
    };

    window.__RESTAURANTE.novaVersaoFicha = function (productId) {
        const fichasDoProduct = state.fichasTecnicas.filter(f => f.product_id === productId);
        const maxVersao = fichasDoProduct.reduce((max, f) => Math.max(max, f.versao), 0);
        const ftAtiva = fichasDoProduct.find(f => f.ativo);
        state.editingFichaId = null;
        state.editingFichaItens = ftAtiva ? (ftAtiva.ficha_tecnica_itens || []).map(it => ({
            insumo_id: it.insumo_id,
            insumo_nome: it.insumos?.nome || '',
            quantidade: it.quantidade,
            unidade_medida_id: it.unidade_medida_id,
            unidade_simbolo: it.unidades_medida?.simbolo || '',
            custo_medio: it.insumos?.custo_medio || 0,
        })) : [];
        const select = document.getElementById('restFichaProduto');
        select.innerHTML = '<option value="">Selecione o produto...</option>' +
            state.produtosCardapio.map(p =>
                `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${p.name} (${fmtBRL(p.price)})</option>`
            ).join('');
        select.disabled = true;
        document.getElementById('restFichaId').value = '';
        document.getElementById('restFichaVersao').textContent = `v${maxVersao + 1} (nova versão)`;
        document.getElementById('restFichaAtivo').checked = true;
        document.getElementById('restFichaObs').value = ftAtiva?.observacoes || '';
        document.getElementById('restFichaQtdProduzida').value = ftAtiva?.quantidade_produzida || '';
        document.getElementById('restFichaUnidProduzida').innerHTML = buildUnidadeOptions(ftAtiva?.unidade_produzida_id);
        renderItensEditorFicha();
        document.getElementById('modalRestFicha').querySelector('h3').textContent = '📋 Nova Versão da Ficha';
        abrirModal('modalRestFicha');
    };

    window.__RESTAURANTE.adicionarItemFicha = function () {
        const insumoId = document.getElementById('restFichaAddInsumo').value;
        const quantidade = parseFloat(document.getElementById('restFichaAddQtd').value);
        const unidadeId = document.getElementById('restFichaAddUnidade').value;
        if (!insumoId || !quantidade || quantidade <= 0 || !unidadeId) {
            toast('Preencha insumo, quantidade e unidade.', 'error'); return;
        }
        const ins = state.insumos.find(x => x.id === insumoId);
        const un = state.unidades.find(x => x.id === unidadeId);
        if (state.editingFichaItens.find(x => x.insumo_id === insumoId)) {
            toast('Este insumo já está na ficha. Edite a quantidade.', 'error'); return;
        }
        state.editingFichaItens.push({
            insumo_id: insumoId,
            insumo_nome: ins?.nome || '',
            quantidade,
            unidade_medida_id: unidadeId,
            unidade_simbolo: un?.simbolo || '',
            custo_medio: ins?.custo_medio || 0,
        });
        document.getElementById('restFichaAddInsumo').value = '';
        document.getElementById('restFichaAddQtd').value = '';
        renderItensEditorFicha();
    };

    window.__RESTAURANTE.removerItemFicha = function (insumoId) {
        state.editingFichaItens = state.editingFichaItens.filter(x => x.insumo_id !== insumoId);
        renderItensEditorFicha();
    };

    function renderItensEditorFicha() {
        // Popula select de insumos disponíveis
        const selInsumo = document.getElementById('restFichaAddInsumo');
        if (selInsumo) {
            selInsumo.innerHTML = '<option value="">Selecione o insumo...</option>' +
                state.insumos.filter(i => i.ativo).map(i =>
                    `<option value="${i.id}">${i.nome} (${i.unidade_medida?.simbolo || ''})</option>`
                ).join('');
        }
        const selUnidade = document.getElementById('restFichaAddUnidade');
        if (selUnidade) selUnidade.innerHTML = buildUnidadeOptions();

        const container = document.getElementById('restFichaItensLista');
        if (!container) return;
        if (!state.editingFichaItens.length) {
            container.innerHTML = '<p class="rest-empty" style="margin:0.5rem 0;">Nenhum insumo adicionado ainda.</p>';
            updateCustoFicha();
            return;
        }
        container.innerHTML = state.editingFichaItens.map(item => `
            <div class="rest-ficha-item-editor">
                <div class="rest-ficha-item-info">
                    <span>${item.insumo_nome}</span>
                    <span class="rest-ficha-item-qtd">${item.quantidade} ${item.unidade_simbolo}</span>
                    <span style="color:var(--text-muted)">${fmtBRL(item.custo_medio * item.quantidade)}</span>
                </div>
                <button class="btn-cancel btn-sm" title="Remover" onclick="window.__RESTAURANTE.removerItemFicha('${item.insumo_id}')">🗑️</button>
            </div>`).join('');
        updateCustoFicha();
    }

    function updateCustoFicha() {
        const total = state.editingFichaItens.reduce((sum, it) => sum + (it.custo_medio * it.quantidade), 0);
        const el = document.getElementById('restFichaCustoTotal');
        if (el) el.textContent = fmtBRL(total);
    }

    window.__RESTAURANTE.salvarFicha = async function () {
        const tenantId = getTenantId();
        const productId = document.getElementById('restFichaProduto').value;
        if (!productId) { toast('Selecione um produto.', 'error'); return; }
        if (!state.editingFichaItens.length) { toast('Adicione pelo menos um insumo.', 'error'); return; }

        // Calcula custo total
        const custoCalculado = state.editingFichaItens.reduce((sum, it) => sum + (it.custo_medio * it.quantidade), 0);

        // Determina versão
        let versao = 1;
        if (!state.editingFichaId) {
            const fichasProd = state.fichasTecnicas.filter(f => f.product_id === productId);
            versao = fichasProd.reduce((max, f) => Math.max(max, f.versao), 0) + 1;
            // Desativa versão anterior
            if (fichasProd.length) {
                await sb.from('ficha_tecnica')
                    .update({ ativo: false, vigencia_fim: new Date().toISOString() })
                    .eq('product_id', productId)
                    .eq('ativo', true);
            }
        }

        const fichaPayload = {
            empresa_id: tenantId,
            product_id: productId,
            versao,
            ativo: document.getElementById('restFichaAtivo').checked,
            custo_calculado: custoCalculado,
            quantidade_produzida: parseFloat(document.getElementById('restFichaQtdProduzida').value) || null,
            unidade_produzida_id: document.getElementById('restFichaUnidProduzida').value || null,
            observacoes: document.getElementById('restFichaObs').value.trim() || null,
        };

        let fichaId = state.editingFichaId;
        let error;
        if (fichaId) {
            ({ error } = await sb.from('ficha_tecnica').update(fichaPayload).eq('id', fichaId));
        } else {
            const { data, error: e } = await sb.from('ficha_tecnica').insert(fichaPayload).select().single();
            error = e;
            if (data) fichaId = data.id;
        }
        if (error) { toast('Erro ao salvar ficha técnica: ' + error.message, 'error'); return; }

        // Salva itens (deleta e reinserena edição; insere na criação)
        if (state.editingFichaId) {
            await sb.from('ficha_tecnica_itens').delete().eq('ficha_tecnica_id', fichaId);
        }
        const itensPayload = state.editingFichaItens.map(it => ({
            empresa_id: tenantId,
            ficha_tecnica_id: fichaId,
            insumo_id: it.insumo_id,
            quantidade: it.quantidade,
            unidade_medida_id: it.unidade_medida_id,
        }));
        const { error: errItens } = await sb.from('ficha_tecnica_itens').insert(itensPayload);
        if (errItens) { toast('Erro ao salvar itens da ficha: ' + errItens.message, 'error'); return; }

        // Atualiza custo_producao e margem no produto
        const produto = state.produtosCardapio.find(p => p.id === productId);
        if (produto?.price) {
            const margem = ((produto.price - custoCalculado) / produto.price) * 100;
            await sb.from('products')
                .update({ custo_producao: custoCalculado, margem_percentual: margem })
                .eq('id', productId);
        }

        // Habilitar select de produto novamente (caso nova versão)
        const selectProd = document.getElementById('restFichaProduto');
        if (selectProd) selectProd.disabled = false;

        fecharModalRest('modalRestFicha');
        renderFichasTecnicas();
        toast('Ficha técnica salva!');
    };

    // ============================================================
    // INVENTÁRIO FÍSICO
    // ============================================================
    async function carregarInventarios() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('inventarios_insumos')
            .select('*, depositos(nome)')
            .eq('empresa_id', tenantId)
            .order('criado_em', { ascending: false })
            .limit(20);
        if (error) { console.error('[Restaurante] Erro inventários:', error); return; }
        state.inventarios = data || [];
    }

    function renderInventarios() {
        const container = document.getElementById('rest-inventarios-lista');
        if (!container) return;
        if (!state.inventarios.length) {
            container.innerHTML = '<p class="rest-empty">Nenhum inventário realizado. Clique em <strong>+ Novo Inventário</strong> para iniciar.</p>';
            return;
        }
        const statusLabel = { aberto: '🟡 Aberto', concluido: '✅ Concluído', cancelado: '❌ Cancelado' };
        container.innerHTML = state.inventarios.map(inv => {
            const data = new Date(inv.criado_em).toLocaleDateString('pt-BR');
            return `
            <div class="rest-list-item">
                <div class="rest-list-info">
                    <span class="rest-list-nome">Inventário ${inv.data_inventario}</span>
                    <span>${inv.depositos?.nome || 'Todos os depósitos'}</span>
                    <span class="rest-badge">${statusLabel[inv.status] || inv.status}</span>
                    <span style="color:var(--text-muted); font-size:0.78rem">${data}</span>
                </div>
                <div class="rest-list-actions" style="align-items: center; gap: 8px;">
                    ${inv.status === 'aberto' ? `
                        <button class="btn-sm btn-edit" style="padding: 5px 8px; font-size: 0.75rem;" onclick="window.__RESTAURANTE.abrirInventario('${inv.id}')">Contar</button>
                        <button class="btn-sm" style="padding: 5px 8px; font-size: 0.75rem; background:rgba(0,184,148,0.1); color:var(--success); border:1px solid rgba(0,184,148,0.2);" onclick="window.__RESTAURANTE.concluirInventario('${inv.id}')">Concluir</button>
                        <button class="btn-sm btn-delete" style="padding: 5px 8px; font-size: 0.75rem;" onclick="window.__RESTAURANTE.cancelarInventario('${inv.id}')">Cancelar</button>
                    ` : `
                        <button class="btn-sm btn-edit" style="padding: 5px 8px; font-size: 0.75rem;" onclick="window.__RESTAURANTE.abrirInventario('${inv.id}')">Visualizar</button>
                    `}
                </div>
            </div>`;
        }).join('');
    }

    window.__RESTAURANTE.novoInventario = function () {
        state.editingInventarioId = null;
        const selDep = document.getElementById('restInventarioDeposito');
        selDep.innerHTML = '<option value="">Todos os depósitos</option>' +
            state.depositos.filter(d => d.ativo).map(d =>
                `<option value="${d.id}">${d.nome}</option>`
            ).join('');
        document.getElementById('restInventarioObs').value = '';
        abrirModal('modalRestNovoInventario');
    };

    window.__RESTAURANTE.iniciarInventario = async function () {
        const tenantId = getTenantId();
        const depositoId = document.getElementById('restInventarioDeposito').value || null;
        const observacao = document.getElementById('restInventarioObs').value.trim() || null;
        // Cria o inventário
        const { data: inv, error } = await sb.from('inventarios_insumos').insert({
            empresa_id: tenantId,
            deposito_id: depositoId,
            observacao,
            status: 'aberto',
        }).select().single();
        if (error) { toast('Erro ao criar inventário.', 'error'); return; }

        // Cria os itens com snapshot do estoque atual
        let insumosFiltrados = state.insumos.filter(i => i.ativo);
        if (depositoId) {
            // Apenas insumos que têm estoque neste depósito
            insumosFiltrados = insumosFiltrados.filter(i =>
                (i.estoque_insumos || []).some(e => e.deposito_id === depositoId)
            );
        }
        const itens = insumosFiltrados.map(ins => {
            const estoqueEntries = ins.estoque_insumos || [];
            let estoqueAtual = 0;
            if (depositoId) {
                const entry = estoqueEntries.find(e => e.deposito_id === depositoId);
                estoqueAtual = entry ? parseFloat(entry.estoque_atual) : 0;
            } else {
                estoqueAtual = estoqueEntries.reduce((sum, e) => sum + parseFloat(e.estoque_atual || 0), 0);
            }
            return {
                empresa_id: tenantId,
                inventario_id: inv.id,
                insumo_id: ins.id,
                estoque_sistema: estoqueAtual,
                estoque_contado: 0,
            };
        });

        if (itens.length) {
            const { error: errItens } = await sb.from('inventarios_insumos_itens').insert(itens);
            if (errItens) { toast('Erro ao criar itens do inventário.', 'error'); return; }
        }
        fecharModalRest('modalRestNovoInventario');
        await carregarInventarios();
        renderInventarios();
        toast(`Inventário criado! ${itens.length} insumos incluídos.`);
        // Abre o inventário diretamente
        window.__RESTAURANTE.abrirInventario(inv.id);
    };

    window.__RESTAURANTE.abrirInventario = async function (inventarioId) {
        const inv = state.inventarios.find(x => x.id === inventarioId);
        if (!inv) return;
        state.editingInventarioId = inventarioId;
        // Carrega itens
        const { data: itens, error } = await sb.from('inventarios_insumos_itens')
            .select('*, insumos(nome, unidade_medida:unidades_medida!insumos_unidade_medida_id_fkey(simbolo))')
            .eq('inventario_id', inventarioId)
            .order('insumos(nome)');
        if (error) { toast('Erro ao carregar itens.', 'error'); return; }
        const readonly = inv.status !== 'aberto';
        const statusLabel = { aberto: '🟡 Aberto', concluido: '✅ Concluído', cancelado: '❌ Cancelado' };
        document.getElementById('restInventarioVerTitulo').textContent = `Inventário — ${inv.data_inventario} (${statusLabel[inv.status] || ''})`;
        document.getElementById('restInventarioVerDeposito').textContent = inv.depositos?.nome || 'Todos os depósitos';
        document.getElementById('restInventarioVerObs').textContent = inv.observacao || '—';
        document.getElementById('btnConcluirInventarioVer').style.display = inv.status === 'aberto' ? 'inline-flex' : 'none';

        const container = document.getElementById('restInventarioItensLista');
        container.innerHTML = (itens || []).map(item => {
            const diffVal = (parseFloat(item.estoque_contado) - parseFloat(item.estoque_sistema));
            const dif = diffVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
            const difClass = diffVal < 0 ? 'text-danger' : diffVal > 0 ? 'text-success' : '';
            const sistemaVal = parseFloat(item.estoque_sistema).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
            const contadoVal = parseFloat(item.estoque_contado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
            return `
            <tr>
                <td>${item.insumos?.nome || '—'}</td>
                <td>${sistemaVal} ${item.insumos?.unidade_medida?.simbolo || ''}</td>
                <td>
                    ${readonly
                        ? `<span>${contadoVal} ${item.insumos?.unidade_medida?.simbolo || ''}</span>`
                        : `<input type="number" step="0.001" min="0" class="inv-contado-input"
                            data-item-id="${item.id}" value="${item.estoque_contado}"
                            style="width:90px; padding:4px 8px;">`
                    }
                </td>
                <td class="${difClass}">${diffVal > 0 ? '+' : ''}${dif}</td>
                <td>${item.ajuste_aplicado ? '✅' : '—'}</td>
            </tr>`;
        }).join('');
        abrirModal('modalRestInventarioVer');
    };

    window.__RESTAURANTE.salvarContagemInventario = async function () {
        const inputs = document.querySelectorAll('.inv-contado-input');
        const updates = [];
        inputs.forEach(input => {
            updates.push({
                id: input.dataset.itemId,
                estoque_contado: parseFloat(input.value) || 0,
            });
        });
        for (const u of updates) {
            await sb.from('inventarios_insumos_itens').update({ estoque_contado: u.estoque_contado }).eq('id', u.id);
        }
        toast('Contagem salva!');
        window.__RESTAURANTE.abrirInventario(state.editingInventarioId);
    };

    window.__RESTAURANTE.concluirInventario = async function (inventarioId) {
        const id = inventarioId || state.editingInventarioId;
        if (!confirm('Confirmar conclusão do inventário? Os ajustes de diferença poderão ser aplicados.')) return;
        const { error } = await sb.from('inventarios_insumos')
            .update({ status: 'concluido', concluido_em: new Date().toISOString() })
            .eq('id', id);
        if (error) { toast('Erro ao concluir inventário.', 'error'); return; }
        fecharModalRest('modalRestInventarioVer');
        await carregarInventarios();
        renderInventarios();
        // Safety net: recalcula estoques de todos os produtos com ficha técnica
        // após inventário, pois pode ter havido ajustes em massa de insumos
        try {
            await sb.rpc('recalcular_todos_estoques_produtos');
        } catch (e) {
            console.warn('[Restaurante] Falha ao recalcular estoques pós-inventário:', e);
        }
        toast('Inventário concluído!');
    };


    window.__RESTAURANTE.cancelarInventario = async function (inventarioId) {
        if (!confirm('Cancelar este inventário?')) return;
        const { error } = await sb.from('inventarios_insumos')
            .update({ status: 'cancelado' })
            .eq('id', inventarioId);
        if (error) { toast('Erro ao cancelar inventário.', 'error'); return; }
        await carregarInventarios();
        renderInventarios();
        toast('Inventário cancelado.');
    };

    // ============================================================
    // MOVIMENTAÇÕES MANUAIS
    // ============================================================
    async function carregarMovimentacoes() {
        const tenantId = getTenantId();
        if (!tenantId) return;
        const { data, error } = await sb.from('vw_movimentacoes_insumos')
            .select('*')
            .eq('empresa_id', tenantId)
            .order('data', { ascending: false })
            .limit(100);
        if (error) { console.error('[Restaurante] Erro movimentações:', error); return; }
        state.movimentacoes = data || [];
    }

    function renderMovimentacoes() {
        const container = document.getElementById('rest-movimentos-lista');
        if (!container) return;
        if (!state.movimentacoes.length) {
            container.innerHTML = '<tr><td colspan="7" class="rest-empty" style="border:none;">Nenhuma movimentação registrada.</td></tr>';
            return;
        }

        const tipoBadge = {
            entrada: '<span class="rest-badge rest-badge--ok">Entrada</span>',
            saida: '<span class="rest-badge rest-badge--alerta">Saída</span>',
            perda: '<span class="rest-badge rest-badge--off">Perda</span>',
            consumo: '<span class="rest-badge" style="background:rgba(255,255,255,0.15);">Consumo</span>',
            estorno: '<span class="rest-badge">Estorno</span>',
            ajuste: '<span class="rest-badge">Ajuste</span>',
            reserva: '<span class="rest-badge">Reserva</span>'
        };

        container.innerHTML = state.movimentacoes.map(m => {
            const date = new Date(m.data).toLocaleString('pt-BR');
            const qtyClass = m.tipo === 'entrada' || m.tipo === 'estorno' ? 'text-success' : 'text-danger';
            const sign = m.tipo === 'entrada' || m.tipo === 'estorno' ? '+' : '-';
            return `
            <tr>
                <td><span style="font-size:0.85rem;color:var(--text-secondary);">${date}</span></td>
                <td><strong>${m.insumo_nome}</strong></td>
                <td>${m.deposito_nome || '—'}</td>
                <td>${tipoBadge[m.tipo] || m.tipo}</td>
                <td class="${qtyClass}">${sign}${parseFloat(m.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ${m.unidade || ''}</td>
                <td>${m.custo_unitario ? fmtBRL(m.custo_unitario) : '—'}</td>
                <td><span style="font-size:0.85rem;">${m.observacao || '—'}</span></td>
            </tr>`;
        }).join('');
    }

    window.__RESTAURANTE.novaMovimentacao = function () {
        const selInsumo = document.getElementById('restMovInsumo');
        selInsumo.innerHTML = '<option value="">Selecione o Insumo</option>' +
            state.insumos.filter(i => i.ativo).map(i =>
                `<option value="${i.id}">${i.nome} (${i.unidade_medida?.simbolo || ''})</option>`
            ).join('');

        const selDep = document.getElementById('restMovDeposito');
        selDep.innerHTML = state.depositos.filter(d => d.ativo).map(d =>
            `<option value="${d.id}">${d.nome}</option>`
        ).join('');

        document.getElementById('restMovTipo').value = 'entrada';
        document.getElementById('restMovQtd').value = '';
        document.getElementById('restMovCusto').value = '';
        document.getElementById('restMovObs').value = '';
        
        // Show/hide custoRow based on tipo
        document.getElementById('restMovTipo').onchange = (e) => {
            document.getElementById('restMovCustoRow').style.display = e.target.value === 'entrada' ? 'flex' : 'none';
            document.getElementById('restMovCusto').value = '';
        };
        document.getElementById('restMovCustoRow').style.display = 'flex';

        abrirModal('modalRestMovimento');
    };

    window.__RESTAURANTE.salvarMovimentacao = async function () {
        const tenantId = getTenantId();
        const insumoId = document.getElementById('restMovInsumo').value;
        const depositoId = document.getElementById('restMovDeposito').value;
        const tipo = document.getElementById('restMovTipo').value;
        const qty = parseFloat(document.getElementById('restMovQtd').value);
        const custoStr = document.getElementById('restMovCusto').value;
        const obs = document.getElementById('restMovObs').value.trim();

        if (!insumoId) { toast('Selecione o insumo.', 'error'); return; }
        if (!depositoId) { toast('Selecione o depósito.', 'error'); return; }
        if (!qty || qty <= 0) { toast('Quantidade inválida.', 'error'); return; }

        const payload = {
            empresa_id: tenantId,
            insumo_id: insumoId,
            deposito_id: depositoId,
            tipo: tipo,
            quantidade: qty,
            custo_unitario: (tipo === 'entrada' && custoStr) ? parseFloat(custoStr) : null,
            referencia_tipo: 'manual',
            observacao: obs || null,
        };

        const { error } = await sb.from('movimentacoes_insumos').insert(payload);
        if (error) { toast('Erro ao registrar movimentação.', 'error'); return; }

        fecharModalRest('modalRestMovimento');
        await carregarMovimentacoes();
        renderMovimentacoes();
        
        // Refresh insumos para ver novo saldo e custo na listagem
        await carregarInsumos();
        renderInsumos();
        
        toast('Movimentação registrada com sucesso!');
    };

    // ============================================================
    // HELPERS: builders de options
    // ============================================================
    function buildCategoriaOptions(selectedId = '') {
        let html = '<option value="">Sem categoria</option>';
        state.categoriasInsumos.filter(c => c.ativo).forEach(c => {
            html += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.nome}</option>`;
        });
        return html;
    }

    function buildFornecedorOptions(selectedId = '') {
        let html = '<option value="">Sem fornecedor</option>';
        state.fornecedores.filter(f => f.ativo).forEach(f => {
            html += `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${f.nome}</option>`;
        });
        return html;
    }

    // Expor renderização para filtros
    window.__RESTAURANTE.filtrarInsumos = renderInsumos;

})();
