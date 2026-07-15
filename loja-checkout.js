/**
 * loja-checkout.js — Checkout da Loja de Roupas
 * ================================================
 * Checkout completo de e-commerce:
 *  - Dados do cliente (nome, telefone)
 *  - CEP com busca automática via ViaCEP
 *  - Endereço completo (logradouro, número, complemento, bairro, cidade, estado)
 *  - Formas de recebimento: Retirada / Entrega (sem "Mesa" ou conceitos de restaurante)
 *  - Forma de pagamento: PIX / Cartão / Dinheiro
 *  - Integração com Mercado Pago (reusa lógica existente)
 *  - Preparado para: múltiplas modalidades de entrega, frete calculado, endereços salvos
 *
 * Dependências: loja-store.js (LojaStore), supabase
 */

(function () {
    'use strict';

    let _sb = null;
    let _empresaId = null;
    let _zonasFrete = [];
    let _freteAtual = 0;

    /* ═══════════════════════════════════════════════
       CONFIGURAR SUPABASE
       ═══════════════════════════════════════════════ */

    async function setup(supabaseClient, empresaId) {
        _sb = supabaseClient;
        _empresaId = empresaId;
        try {
            const { data } = await _sb.from('shipping_zones').select('*').eq('empresa_id', _empresaId).eq('active', true);
            _zonasFrete = data || [];
        } catch (e) {
            console.warn('[LojaCheckout] Erro ao carregar zonas de frete', e);
        }
    }

    /* ═══════════════════════════════════════════════
       ABRIR / FECHAR MODAL CHECKOUT
       ═══════════════════════════════════════════════ */

    function abrir() {
        const modal = document.getElementById('loja-checkout-modal');
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        _resetForm();
        _preencherResumo();
    }

    function fechar() {
        const modal = document.getElementById('loja-checkout-modal');
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function _resetForm() {
        const ids = ['chk-nome', 'chk-telefone', 'chk-cep', 'chk-logradouro',
                     'chk-numero', 'chk-complemento', 'chk-bairro', 'chk-cidade', 'chk-estado'];
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

        const radRetirada = document.getElementById('chk-tipo-retirada');
        if (radRetirada) radRetirada.checked = true;
        _toggleEnderecoSection();

        const radPix = document.getElementById('chk-pgto-pix');
        if (radPix) radPix.checked = true;

        const cepStatus = document.getElementById('chk-cep-status');
        if (cepStatus) cepStatus.textContent = '';
        const camposAuto = document.getElementById('chk-campos-auto');
        if (camposAuto) camposAuto.style.display = 'none';

        _freteAtual = 0;
    }

    function _preencherResumo() {
        const container = document.getElementById('chk-resumo-itens');
        const totalEl = document.getElementById('chk-resumo-total');
        if (!container) return;

        let total = LojaStore.getCartSubtotal();
        const tipoEntrega = document.querySelector('input[name="chk-tipo"]:checked')?.value || 'retirada';
        
        let htmlExtra = '';
        if (tipoEntrega === 'entrega' && _freteAtual > 0) {
            htmlExtra = `
                <div class="chk-resumo-item" style="color: var(--text-muted);">
                    <span class="chk-resumo-nome">Frete</span>
                    <span class="chk-resumo-preco">${LojaStore.formatPreco(_freteAtual)}</span>
                </div>
            `;
            total += _freteAtual;
        }

        container.innerHTML = cart.map(item => `
            <div class="chk-resumo-item">
                <span class="chk-resumo-nome">${item.nome}
                    <small>${item.tamanho || ''}${item.tamanho && item.cor ? ' · ' : ''}${item.cor || ''}</small>
                </span>
                <span class="chk-resumo-preco">${LojaStore.formatPreco(parseFloat(item.preco) * (item.quantidade || 1))}
                    ${item.quantidade > 1 ? `<small>×${item.quantidade}</small>` : ''}
                </span>
            </div>
        `).join('') + htmlExtra;

        if (totalEl) totalEl.textContent = LojaStore.formatPreco(total);
    }

    /* ═══════════════════════════════════════════════
       CÁLCULO DE FRETE
       ═══════════════════════════════════════════════ */

    function _normalizar(str) {
        return (str || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function _calcularFrete(bairro, cidade) {
        if (!bairro) return -1;
        const bNorm = _normalizar(bairro);
        const cNorm = _normalizar(cidade);

        const zona = _zonasFrete.find(z => {
            if (!z.neighborhoods) return false;
            if (z.cidade && _normalizar(z.cidade) !== cNorm) return false;
            const lista = z.neighborhoods.split(',').map(b => _normalizar(b));
            return lista.includes(bNorm);
        });
        return zona ? (parseFloat(zona.fee) || 0) : -1;
    }

    /* ═══════════════════════════════════════════════
       VIAÇÃO CEP — BUSCA AUTOMÁTICA
       ═══════════════════════════════════════════════ */

    function _setupCep() {
        const cepInput = document.getElementById('chk-cep');
        if (!cepInput) return;

        cepInput.addEventListener('input', () => {
            let digits = cepInput.value.replace(/\D/g, '').slice(0, 8);
            cepInput.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
            if (digits.length === 8) _buscarCep(digits);
        });
    }

    async function _buscarCep(cep) {
        const status = document.getElementById('chk-cep-status');
        const camposAuto = document.getElementById('chk-campos-auto');
        if (status) status.textContent = '⏳ Buscando endereço...';

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();

            if (data.erro) {
                if (status) status.textContent = '❌ CEP não encontrado.';
                if (camposAuto) camposAuto.style.display = 'none';
                return;
            }

            _setVal('chk-logradouro', data.logradouro);
            _setVal('chk-bairro', data.bairro);
            _setVal('chk-cidade', data.localidade);
            _setVal('chk-estado', data.uf);

            _freteAtual = _calcularFrete(data.bairro, data.localidade);

            if (_freteAtual === -1) {
                if (status) {
                    status.textContent = '⚠️ Bairro não atendido para entrega.';
                    status.style.color = 'var(--danger)';
                }
            } else {
                if (status) {
                    status.textContent = \`✅ Frete para \${data.bairro}: \${_freteAtual === 0 ? 'Grátis' : LojaStore.formatPreco(_freteAtual)}\`;
                    status.style.color = 'var(--success)';
                }
            }

            if (camposAuto) camposAuto.style.display = 'grid';
            _preencherResumo();

            document.getElementById('chk-numero')?.focus();
        } catch {
            if (status) {
                status.textContent = '❌ Erro ao buscar CEP.';
                status.style.color = 'var(--danger)';
            }
        }
    }

    /* ═══════════════════════════════════════════════
       SEÇÃO DE ENTREGA
       ═══════════════════════════════════════════════ */

    function _toggleEnderecoSection() {
        const tipo = document.querySelector('input[name="chk-tipo"]:checked')?.value || 'retirada';
        const secaoEndereco = document.getElementById('chk-secao-endereco');
        if (secaoEndereco) secaoEndereco.style.display = tipo === 'entrega' ? 'block' : 'none';
        _preencherResumo();
    }

    /* ═══════════════════════════════════════════════
       PROCESSAR PEDIDO
       ═══════════════════════════════════════════════ */

    async function processar() {
        const nome = document.getElementById('chk-nome')?.value.trim();
        const telefone = document.getElementById('chk-telefone')?.value.trim();
        const tipoEntrega = document.querySelector('input[name="chk-tipo"]:checked')?.value || 'retirada';
        const formaPgto = document.querySelector('input[name="chk-pgto"]:checked')?.value || 'pix';

        if (!nome || !telefone) {
            LojaStore.showToast('Preencha nome e telefone.', 'error');
            return;
        }

        const telLimpo = telefone.replace(/\D/g, '');
        if (telLimpo.length !== 11) {
            LojaStore.showToast('Telefone deve ter 11 dígitos.', 'error');
            return;
        }

        let enderecoObj = null;
        if (tipoEntrega === 'entrega') {
            const cep = document.getElementById('chk-cep')?.value.trim();
            const logradouro = document.getElementById('chk-logradouro')?.value.trim();
            const numero = document.getElementById('chk-numero')?.value.trim();
            const bairro = document.getElementById('chk-bairro')?.value.trim();
            const cidade = document.getElementById('chk-cidade')?.value.trim();
            const estado = document.getElementById('chk-estado')?.value.trim();
            const complemento = document.getElementById('chk-complemento')?.value.trim();

            if (!numero) {
                LojaStore.showToast('Informe o número do endereço.', 'error');
                return;
            }

            if (_freteAtual === -1) {
                LojaStore.showToast('Bairro não atendido para entrega.', 'error');
                return;
            }

            enderecoObj = { cep, logradouro, numero, complemento, bairro, cidade, estado };
        }

        const cart = LojaStore.getCart();
        if (cart.length === 0) {
            LojaStore.showToast('Carrinho vazio.', 'error');
            return;
        }

        const btn = document.getElementById('chk-btn-confirmar');
        if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

        try {
            const subtotal = LojaStore.getCartSubtotal();

            // 1. Abater estoque de todas as variações
            for (const item of cart) {
                const { error: estqErr } = await _sb.rpc('loja_remover_estoque', {
                    p_variacao_id: item.id,
                    p_quantidade: item.quantidade || 1
                });
                if (estqErr) {
                    LojaStore.showToast(`Estoque insuficiente: ${item.nome}.`, 'error');
                    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar Pedido'; }
                    return;
                }
            }

            // 2. Criar pedido
            const subtotalTotal = subtotal;
            const freteCalculado = (tipoEntrega === 'entrega' && _freteAtual > 0) ? _freteAtual : 0;
            const orderTotal = subtotalTotal + freteCalculado;

            const { data: orderData, error: orderErr } = await _sb.from('orders').insert({
                empresa_id: _empresaId,
                customer_name: nome,
                customer_phone: telefone,
                customer_address: enderecoObj,
                subtotal: subtotalTotal,
                discount: 0,
                shipping_fee: freteCalculado,
                total: orderTotal,
                delivery_type: tipoEntrega,
                payment_method: formaPgto,
                status: 'pendente'
            }).select().single();

            if (orderErr) {
                LojaStore.showToast('Erro ao criar pedido.', 'error');
                if (btn) { btn.disabled = false; btn.textContent = 'Confirmar Pedido'; }
                return;
            }

            // 3. Inserir itens do pedido
            const itensPedido = cart.map(item => ({
                order_id: orderData.id,
                product_id: item.produtoId,
                product_name: `${item.nome}${item.tamanho ? ' (' + item.tamanho : ''}${item.cor ? ' - ' + item.cor + ')' : ')'}`,
                quantity: item.quantidade || 1,
                unit_price: parseFloat(item.preco),
                total_price: parseFloat(item.preco) * (item.quantidade || 1),
                empresa_id: _empresaId,
            }));
            await _sb.from('order_items').insert(itensPedido);

            // 4. Limpar carrinho
            LojaStore.clearCart();
            fechar();

            // 5. Fluxo de pagamento
            if (formaPgto === 'pix') {
                await _gerarPix(orderData.id, orderTotal);
            } else if (formaPgto === 'cartao') {
                await _gerarCartao(orderData.id);
            } else {
                LojaStore.showToast('Pedido realizado com sucesso! Entraremos em contato.', 'success');
            }

        } catch (err) {
            console.error('[LojaCheckout]', err);
            LojaStore.showToast('Erro: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Confirmar Pedido'; }
        }
    }

    /* ═══════════════════════════════════════════════
       PAGAMENTOS (reusa funções existentes de vitrine.js)
       ═══════════════════════════════════════════════ */

    async function _gerarPix(orderId, total) {
        const pixModal = document.getElementById('loja-pix-modal');
        if (pixModal) pixModal.classList.add('active');

        try {
            const { data, error } = await _sb.functions.invoke('mercadopago-pix', {
                body: { orderId, total, empresaId: _empresaId }
            });

            if (error || !data || data.error) {
                LojaStore.showToast('Erro ao gerar PIX.', 'error');
                return;
            }

            const qrImg = document.getElementById('loja-pix-qr');
            const copyBtn = document.getElementById('loja-pix-copiar');
            const pixLoading = document.getElementById('loja-pix-loading');
            const pixStatus = document.getElementById('loja-pix-status');

            if (qrImg) { qrImg.src = `data:image/png;base64,${data.qr_code_base64}`; qrImg.style.display = 'block'; }
            if (pixLoading) pixLoading.style.display = 'none';
            if (copyBtn) { copyBtn.style.display = 'block'; }
            if (pixStatus) pixStatus.textContent = 'Aguardando pagamento...';

            window._lojaPixCodigo = data.qr_code;
            if (copyBtn) {
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(window._lojaPixCodigo);
                    LojaStore.showToast('Código PIX copiado!', 'success');
                };
            }
        } catch (err) {
            LojaStore.showToast('Erro de rede ao gerar PIX.', 'error');
        }
    }

    async function _gerarCartao(orderId) {
        const overlay = document.getElementById('mpRedirectOverlay');
        if (overlay) overlay.style.display = 'flex';

        try {
            const { data, error } = await _sb.functions.invoke('mercadopago-checkout', {
                body: { orderId }
            });
            if (error || !data || data.error) {
                if (overlay) overlay.style.display = 'none';
                LojaStore.showToast('Erro ao processar pagamento.', 'error');
                return;
            }
            if (data.url) window.location.href = data.url;
        } catch {
            if (overlay) overlay.style.display = 'none';
            LojaStore.showToast('Erro de rede.', 'error');
        }
    }

    /* ═══════════════════════════════════════════════
       UTILITÁRIOS
       ═══════════════════════════════════════════════ */

    function _setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }

    /* ═══════════════════════════════════════════════
       INICIALIZAÇÃO
       ═══════════════════════════════════════════════ */

    function init() {
        // Fechar modal
        document.getElementById('chk-fechar')?.addEventListener('click', fechar);
        document.getElementById('loja-checkout-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'loja-checkout-modal') fechar();
        });

        // Botão confirmar
        document.getElementById('chk-btn-confirmar')?.addEventListener('click', processar);

        // Toggle seção endereço
        document.querySelectorAll('input[name="chk-tipo"]').forEach(r => {
            r.addEventListener('change', _toggleEnderecoSection);
        });

        // Máscara telefone checkout
        const telInput = document.getElementById('chk-telefone');
        if (telInput) {
            telInput.addEventListener('input', () => {
                let d = telInput.value.replace(/\D/g, '').slice(0, 11);
                if (d.length > 7) d = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
                else if (d.length > 2) d = `(${d.slice(0,2)}) ${d.slice(2)}`;
                telInput.value = d;
            });
        }

        // CEP
        _setupCep();

        // Fechar PIX modal
        document.getElementById('loja-pix-fechar')?.addEventListener('click', () => {
            const pixModal = document.getElementById('loja-pix-modal');
            if (pixModal) pixModal.classList.remove('active');
            window.location.reload();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ═══════════════════════════════════════════════
       API PÚBLICA
       ═══════════════════════════════════════════════ */

    window.LojaCheckout = { abrir, fechar, setup };

})();
