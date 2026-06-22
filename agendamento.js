/**
 * agendamento.js
 * Lógica do fluxo de agendamento público (Wizard de 5 passos)
 * Integração com Supabase e sistema de Tenant
 */

// ============================================================
// CONFIGURAÇÃO SUPABASE
// ============================================================
const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

// ============================================================
// ESTADO DO WIZARD
// ============================================================
const state = {
    step: 1,
    empresaId: null,
    
    // Dados carregados
    servicos: [],
    profissionais: [],
    
    // Seleção do usuário
    servico: null,      // Objeto completo
    profissional: null, // Objeto completo
    dataSelecionada: null, // Date object
    slotSelecionado: null, // String "HH:MM"
    slotFim: null,         // ISO String do fim
    slotInicio: null,      // ISO String do inicio
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoading('Carregando informações da loja...');
        
        // 1. Inicializa o Tenant
        // Se `supabase` não estiver configurado corretamente, vamos avisar
        if (!sb) {
            console.error('Supabase client não configurado. Certifique-se de incluir a chave.');
        }

        const tenantId = await initTenantPublico(sb);
        if (!tenantId) {
            hideLoading();
            return; // A tela de erro de loja não encontrada já foi exibida
        }

        state.empresaId = tenantId;
        
        // Atualiza UI com nome da loja
        if (window.TENANT.nome) {
            document.title = `Agendar | ${window.TENANT.nome}`;
            document.getElementById('agNomeLoja').textContent = window.TENANT.nome;
        }

        // Configura navegação clicável nos passos do topo
        document.querySelectorAll('.ag-step').forEach(stepEl => {
            stepEl.style.cursor = 'pointer';
            stepEl.addEventListener('click', () => {
                const stepNum = parseInt(stepEl.dataset.step);
                agendarApp.irPara(stepNum);
            });
        });

        // 2. Carrega Dados Iniciais
        await carregarServicos();
        await carregarProfissionais();

        // 3. Renderiza o Passo 1
        renderServicos();
        hideLoading();

    } catch (error) {
        console.error('Erro na inicialização:', error);
        showToast('Erro ao carregar a página de agendamento.', 'error');
        hideLoading();
    }
});

// ============================================================
// NAVEGAÇÃO E WIZARD
// ============================================================
const agendarApp = {
    irPara(passo) {
        // Validações antes de avançar
        if (passo === 2 && !state.servico) return showToast('Selecione um serviço para continuar.', 'error');
        if (passo === 3 && !state.profissional) return showToast('Selecione um profissional.', 'error');
        if (passo === 4 && !state.dataSelecionada) return showToast('Selecione uma data.', 'error');
        if (passo === 5 && !state.slotSelecionado) return showToast('Selecione um horário.', 'error');

        // Lógica de transição
        if (passo === 3) {
            initCalendario();
        } else if (passo === 4) {
            carregarSlotsDisponiveis();
        } else if (passo === 5) {
            renderResumo();
        }

        // Atualiza a UI
        document.querySelectorAll('.ag-step-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`step-${passo}`).classList.add('active');

        document.querySelectorAll('.ag-step').forEach(el => {
            const num = parseInt(el.dataset.step);
            el.classList.remove('active', 'done');
            if (num < passo) el.classList.add('done');
            if (num === passo) el.classList.add('active');
        });

        state.step = passo;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    selecionarServico(id) {
        const srv = state.servicos.find(s => s.id === id);
        if (!srv) return;
        state.servico = srv;
        
        // Atualiza UI
        document.querySelectorAll('#servicosGrid .ag-card').forEach(el => el.classList.remove('selected'));
        document.getElementById(`srv-${id}`).classList.add('selected');
        document.getElementById('btnStep1Next').disabled = false;

        // Avança automaticamente para o próximo passo
        setTimeout(() => this.irPara(2), 200);
    },

    selecionarProfissional(id) {
        const prof = state.profissionais.find(p => p.id === id);
        if (!prof) return;
        state.profissional = prof;

        // Atualiza UI
        document.querySelectorAll('#profissionaisGrid .ag-card').forEach(el => el.classList.remove('selected'));
        document.getElementById(`prof-${id}`).classList.add('selected');
        document.getElementById('btnStep2Next').disabled = false;

        // Avança automaticamente para o próximo passo
        setTimeout(() => this.irPara(3), 200);
    },

    abrirListaEspera() {
        const modal = document.getElementById('modalListaEspera');
        if (!modal) return;
        
        // Carrega opções de serviço
        const selServico = document.getElementById('wlServico');
        selServico.innerHTML = state.servicos.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        
        // Carrega opções de profissional
        const selProfissional = document.getElementById('wlProfissional');
        selProfissional.innerHTML = '<option value="">Qualquer profissional</option>' + 
            state.profissionais.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        
        // Pré-seleciona se já escolheu
        if (state.servico) selServico.value = state.servico.id;
        if (state.profissional) selProfissional.value = state.profissional.id;
        
        // Carrega opções de horários baseados na empresa
        agendarApp.carregarOpcoesHorariosListaEspera();
        
        // Pré-seleciona data se já escolheu
        const inputData = document.getElementById('wlData');
        if (state.dataSelecionada) {
            const y = state.dataSelecionada.getFullYear();
            const m = String(state.dataSelecionada.getMonth() + 1).padStart(2, '0');
            const d = String(state.dataSelecionada.getDate()).padStart(2, '0');
            inputData.value = `${y}-${m}-${d}`;
        } else {
            inputData.value = '';
        }
        
        document.getElementById('wlTel').value = '';
        document.getElementById('wlHorario1').value = '';
        document.getElementById('wlHorario2').value = '';
        document.getElementById('wlHorario3').value = '';
        
        modal.style.display = 'flex';
    },

    fecharListaEspera() {
        const modal = document.getElementById('modalListaEspera');
        if (modal) modal.style.display = 'none';
    },

    async salvarListaEspera() {
        const nome = document.getElementById('wlNome').value.trim();
        const telefone = document.getElementById('wlTel').value.trim();
        const servicoId = document.getElementById('wlServico').value;
        const profId = document.getElementById('wlProfissional').value || null;
        const dataPref = document.getElementById('wlData').value || null;
        const h1 = document.getElementById('wlHorario1').value;
        const h2 = document.getElementById('wlHorario2').value;
        const h3 = document.getElementById('wlHorario3').value;
        
        const horariosPreferenciais = [];
        if (h1) horariosPreferenciais.push(h1);
        if (h2) horariosPreferenciais.push(h2);
        if (h3) horariosPreferenciais.push(h3);

        if (!nome || !telefone) {
            showToast('Nome e WhatsApp são obrigatórios.', 'error');
            return;
        }

        const telLimpo = telefone.replace(/\D/g, '');
        if (telLimpo.length !== 11) {
            showToast('O WhatsApp deve ter 11 números com DDD.', 'error');
            return;
        }

        showLoading('Entrando na fila...');
        
        try {
            const payload = {
                empresa_id: window.TENANT.empresa_id,
                cliente_nome: nome,
                cliente_telefone: telefone,
                servico_id: servicoId,
                profissional_id_pref: profId,
                data_desejada: dataPref,
                horarios_preferenciais: horariosPreferenciais,
                status: 'aguardando'
            };

            const { error } = await sb.from('lista_espera').insert(payload);
            if (error) throw error;

            agendarApp.fecharListaEspera();
            showToast('Sucesso! Você está na lista de espera.');
        } catch (err) {
            console.error('Erro na lista de espera:', err);
            showToast('Erro ao entrar na lista de espera.', 'error');
        } finally {
            hideLoading();
        }
    },

    async carregarOpcoesHorariosListaEspera() {
        try {
            const { data, error } = await sb
                .from('horarios_funcionamento')
                .select('hora_abertura, hora_fechamento')
                .eq('empresa_id', state.empresaId);

            if (error || !data || data.length === 0) return this.gerarHorariosPadrao();

            let minTime = "23:59:59";
            let maxTime = "00:00:00";
            data.forEach(h => {
                if (h.hora_abertura && h.hora_abertura < minTime) minTime = h.hora_abertura;
                if (h.hora_fechamento && h.hora_fechamento > maxTime) maxTime = h.hora_fechamento;
            });

            if (minTime > maxTime) return this.gerarHorariosPadrao();

            const hInicio = parseInt(minTime.split(':')[0]);
            const hFim = parseInt(maxTime.split(':')[0]);
            
            let optionsHtml = '<option value="">Qualquer horário</option>';
            for (let h = hInicio; h <= hFim; h++) {
                for (let m of ['00', '30']) {
                    if (h === hFim && m === '30') continue;
                    const horaStr = `${String(h).padStart(2, '0')}:${m}`;
                    optionsHtml += `<option value="${horaStr}">${horaStr}</option>`;
                }
            }
            
            document.getElementById('wlHorario1').innerHTML = optionsHtml;
            document.getElementById('wlHorario2').innerHTML = optionsHtml;
            document.getElementById('wlHorario3').innerHTML = optionsHtml;
        } catch (err) {
            console.error('Erro ao buscar horarios de funcionamento', err);
            this.gerarHorariosPadrao();
        }
    },

    gerarHorariosPadrao() {
        let optionsHtml = '<option value="">Qualquer horário</option>';
        for (let h = 8; h <= 20; h++) {
            for (let m of ['00', '30']) {
                if (h === 20 && m === '30') continue;
                const horaStr = `${String(h).padStart(2, '0')}:${m}`;
                optionsHtml += `<option value="${horaStr}">${horaStr}</option>`;
            }
        }
        document.getElementById('wlHorario1').innerHTML = optionsHtml;
        document.getElementById('wlHorario2').innerHTML = optionsHtml;
        document.getElementById('wlHorario3').innerHTML = optionsHtml;
    },

    navMes,
    selecionarDia,
    selecionarSlot,
    confirmarAgendamento,
    novoAgendamento,
    validarDadosCliente
};

window.agendarApp = agendarApp;

// Adicionar listeners para validação em tempo real no passo 5
document.addEventListener('DOMContentLoaded', () => {
    const nomeInput = document.getElementById('clienteNome');
    const telInput = document.getElementById('clienteTel');
    if (nomeInput) nomeInput.addEventListener('input', validarDadosCliente);
    const wlTelInput = document.getElementById('wlTel');
    
    function formatarTelefone(input) {
        let digits = input.value.replace(/\D/g, '').slice(0, 11);
        let formatted = digits;
        if (digits.length > 2) formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
        if (digits.length > 7) formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
        input.value = formatted;
    }

    if (telInput) {
        telInput.addEventListener('input', () => {
            formatarTelefone(telInput);
            validarDadosCliente();
        });
        telInput.addEventListener('keydown', (e) => {
            const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
            if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
                e.preventDefault();
            }
        });
        telInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            telInput.value = pasted.replace(/\D/g, '').slice(0, 11);
            formatarTelefone(telInput);
            validarDadosCliente();
        });
    }

    if (wlTelInput) {
        wlTelInput.addEventListener('input', () => {
            formatarTelefone(wlTelInput);
        });
        wlTelInput.addEventListener('keydown', (e) => {
            const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
            if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
                e.preventDefault();
            }
        });
        wlTelInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            wlTelInput.value = pasted.replace(/\D/g, '').slice(0, 11);
            formatarTelefone(wlTelInput);
        });
    }
});

function validarDadosCliente() {
    const nome = document.getElementById('clienteNome')?.value.trim();
    const tel = document.getElementById('clienteTel')?.value.trim();
    const btn = document.getElementById('btnConfirmar');
    if (!btn) return;

    const digits = tel ? tel.replace(/\D/g, '') : '';
    // Habilita se tiver nome e exatamente 11 digitos no telefone
    btn.disabled = !(nome && digits.length === 11);
}

// ============================================================
// DADOS BASE: SERVIÇOS E PROFISSIONAIS
// ============================================================
async function carregarServicos() {
    const { data, error } = await sb
        .from('servicos')
        .select('*')
        .eq('empresa_id', state.empresaId)
        .order('nome', { ascending: true });

    if (error) {
        console.error('Erro ao buscar serviços:', error);
        return;
    }
    state.servicos = data || [];
}

function renderServicos() {
    const container = document.getElementById('servicosGrid');
    if (state.servicos.length === 0) {
        container.innerHTML = '<p style="color:var(--color-muted);">Nenhum serviço disponível no momento.</p>';
        return;
    }

    container.innerHTML = state.servicos.map(s => `
        <div class="ag-card" id="srv-${s.id}" onclick="agendarApp.selecionarServico('${s.id}')">
            <div class="ag-card-check">✓</div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                <div class="ag-card-icon">✂️</div>
                <div>
                    <div class="ag-card-name">${s.nome}</div>
                    <div class="ag-card-sub">⏱️ ${s.duracao_min || s.duracao_minutos || 0} min</div>
                </div>
            </div>
            ${s.descricao ? `<p style="font-size:0.8rem; color:var(--color-muted); margin-bottom:10px;">${s.descricao}</p>` : ''}
            <div class="ag-card-price">R$ ${Number(s.preco).toFixed(2).replace('.', ',')}</div>
        </div>
    `).join('');
}

async function carregarProfissionais() {
    const { data, error } = await sb
        .from('profissionais')
        .select('*')
        .eq('empresa_id', state.empresaId)
        // Se a coluna 'ativo' não existir ou for nula, assume true para não quebrar
        .or('ativo.eq.true,ativo.is.null') 
        .order('nome', { ascending: true });

    if (error) {
        console.error('Erro ao buscar profissionais:', error);
        return;
    }
    state.profissionais = data || [];
    renderProfissionais();
}

function renderProfissionais() {
    const container = document.getElementById('profissionaisGrid');
    if (state.profissionais.length === 0) {
        container.innerHTML = '<p style="color:var(--color-muted);">Nenhum profissional disponível.</p>';
        return;
    }

    container.innerHTML = state.profissionais.map(p => {
        const bg = p.foto_url ? `url(${p.foto_url})` : 'rgba(229,178,93,0.2)';
        const content = p.foto_url ? '' : p.nome.charAt(0).toUpperCase();

        return `
        <div class="ag-card" id="prof-${p.id}" onclick="agendarApp.selecionarProfissional('${p.id}')">
            <div class="ag-card-check">✓</div>
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="ag-prof-avatar" style="background-image:${bg}; background-color:rgba(229,178,93,0.2);">${content}</div>
                <div>
                    <div class="ag-card-name">${p.nome}</div>
                    <div class="ag-card-sub">${p.especialidade || 'Atendimento Geral'}</div>
                </div>
            </div>
        </div>
    `}).join('');
}

// ============================================================
// CALENDÁRIO
// ============================================================
let calDate = new Date();

function initCalendario() {
    if (!state.dataSelecionada) {
        calDate = new Date(); // Reset para hoje se não houver seleção
    }
    renderCalendario();
}

function navMes(delta) {
    calDate.setMonth(calDate.getMonth() + delta);
    renderCalendario();
}

function renderCalendario() {
    const ano = calDate.getFullYear();
    const mes = calDate.getMonth();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    document.getElementById('calMonthLabel').textContent = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const container = document.getElementById('calGrid');
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let html = diasSemana.map(d => `<div class="ag-cal-day-name">${d}</div>`).join('');

    const primeiroDia = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDia; i++) {
        html += `<div class="ag-cal-day empty"></div>`;
    }

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dateObj = new Date(ano, mes, dia);
        dateObj.setHours(0,0,0,0);
        
        const isPast = dateObj < hoje;
        const isSel = state.dataSelecionada && dateObj.getTime() === state.dataSelecionada.getTime();
        const isToday = dateObj.getTime() === hoje.getTime();

        let classes = ['ag-cal-day'];
        if (isPast) classes.push('past');
        if (isSel) classes.push('selected');
        if (isToday) classes.push('today');

        if (isPast) {
            html += `<div class="${classes.join(' ')}">${dia}</div>`;
        } else {
            html += `<div class="${classes.join(' ')}" onclick="agendarApp.selecionarDia(${ano}, ${mes}, ${dia})">${dia}</div>`;
        }
    }

    container.innerHTML = html;
}

function selecionarDia(ano, mes, dia) {
    const newDate = new Date(ano, mes, dia);
    newDate.setHours(0, 0, 0, 0);
    
    state.dataSelecionada = newDate;
    
    // Reseta o slot selecionado pois mudou a data
    state.slotSelecionado = null;
    document.getElementById('btnStep4Next').disabled = true;

    renderCalendario();
    document.getElementById('btnStep3Next').disabled = false;
    
    // Formata para o subtítulo do step 4
    document.getElementById('step4Subtitle').textContent = `Horários para ${newDate.toLocaleDateString('pt-BR')}`;

    // Avança automaticamente para o próximo passo (Horários)
    setTimeout(() => agendarApp.irPara(4), 250);
}

// ============================================================
// HORÁRIOS (SLOTS)
// ============================================================
async function carregarSlotsDisponiveis() {
    const container = document.getElementById('slotsContainer');
    container.innerHTML = `<div class="ag-slots-loading"><div class="ag-spinner" style="width:24px;height:24px;border-width:2px;"></div> Buscando horários...</div>`;
    document.getElementById('btnStep4Next').disabled = true;

    // Formata data YYYY-MM-DD em fuso local
    const y = state.dataSelecionada.getFullYear();
    const m = String(state.dataSelecionada.getMonth() + 1).padStart(2, '0');
    const d = String(state.dataSelecionada.getDate()).padStart(2, '0');
    const isoDate = `${y}-${m}-${d}`;

    try {
        const { data, error } = await sb.rpc('get_slots_disponiveis', {
            p_empresa_id: state.empresaId,
            p_profissional_id: state.profissional.id,
            p_servico_id: state.servico.id,
            p_data: isoDate
        });

        if (error) throw error;

        renderSlots(data || []);

    } catch (err) {
        console.error('Erro ao buscar slots:', err);
        container.innerHTML = `
            <div class="ag-slots-empty">
                <p>Erro ao carregar horários.</p>
                <small style="color:var(--color-danger);">${err.message || 'Erro desconhecido'}</small>
                <br>
                <button class="ag-btn-back" style="margin-top:10px; padding: 8px 16px;" onclick="agendarApp.irPara(4)">Tentar Novamente</button>
            </div>`;
    }
}

function renderSlots(slots) {
    const container = document.getElementById('slotsContainer');
    const agora = new Date();
    const isHoje = state.dataSelecionada.toDateString() === agora.toDateString();

    // Filtra slots que já passaram
    const slotsDisponiveis = slots.filter(s => {
        const dInicio = new Date(s.slot_inicio);
        return !(isHoje && dInicio <= agora);
    });

    if (slotsDisponiveis.length === 0) {
        const diaSemanaNome = state.dataSelecionada.toLocaleDateString('pt-BR', { weekday: 'long' });
        if (isHoje) {
            container.innerHTML = `
                <div class="ag-slots-empty">
                    <div style="font-size: 2rem; margin-bottom: 10px;">🌙</div>
                    <strong>Todos os horários de hoje já passaram.</strong><br>
                    <p style="margin-top:8px; font-size:0.85rem; color:var(--color-muted);">
                        Tente selecionar uma data futura no calendário.
                    </p>
                    <button class="ag-btn-next" style="margin-top:15px; padding: 10px 16px;" onclick="agendarApp.abrirListaEspera()">Entrar na Lista de Espera</button>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="ag-slots-empty">
                    <div style="font-size: 2rem; margin-bottom: 10px;">📅</div>
                    <strong>Nenhum horário disponível para esta data.</strong><br>
                    <p style="margin-top:10px; font-size:0.85rem; color:var(--color-muted); line-height:1.4;">
                        Não encontramos horários para <b>${state.profissional.nome}</b> em <b>${diaSemanaNome}</b>.<br>
                        <span style="display:block; margin-top:8px;">
                            Verifique se a empresa configurou horários de funcionamento para este dia da semana no painel.
                        </span>
                    </p>
                    <button class="ag-btn-next" style="margin-top:15px; padding: 10px 16px;" onclick="agendarApp.abrirListaEspera()">Entrar na Lista de Espera</button>
                </div>`;
        }
        return;
    }

    let html = `<div class="ag-slots-grid">`;
    slotsDisponiveis.forEach((s, i) => {
        const dInicio = new Date(s.slot_inicio);
        const horaNominal = String(dInicio.getHours()).padStart(2, '0') + ':' + String(dInicio.getMinutes()).padStart(2, '0');
        html += `<div class="ag-slot" id="slot-${i}" data-inicio="${s.slot_inicio}" data-fim="${s.slot_fim}" onclick="agendarApp.selecionarSlot(${i}, '${horaNominal}')">${horaNominal}</div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function selecionarSlot(index, horaFormatada) {
    document.querySelectorAll('.ag-slot').forEach(el => el.classList.remove('selected'));
    const slotEl = document.getElementById(`slot-${index}`);
    slotEl.classList.add('selected');

    state.slotSelecionado = horaFormatada;
    state.slotInicio = slotEl.dataset.inicio;
    state.slotFim = slotEl.dataset.fim;

    document.getElementById('btnStep4Next').disabled = false;

    // Avança automaticamente para o próximo passo (Resumo)
    setTimeout(() => agendarApp.irPara(5), 200);
}

// ============================================================
// RESUMO E CONFIRMAÇÃO
// ============================================================
function renderResumo() {
    if (!state.servico || !state.profissional || !state.dataSelecionada) {
        console.warn('Estado incompleto ao renderizar resumo');
        return;
    }

    document.getElementById('sumServico').textContent = state.servico.nome;
    document.getElementById('sumProfissional').textContent = state.profissional.nome;
    
    const dStr = state.dataSelecionada.toLocaleDateString('pt-BR');
    document.getElementById('sumDataHora').textContent = `${dStr} às ${state.slotSelecionado || '--:--'}`;
    
    document.getElementById('sumDuracao').textContent = `${state.servico.duracao_min || state.servico.duracao_minutos || 30} min`;
    document.getElementById('sumPreco').textContent = `R$ ${Number(state.servico.preco).toFixed(2).replace('.', ',')}`;

    // Garante que o botão de confirmar siga a validação dos campos
    validarDadosCliente();
}

async function confirmarAgendamento() {
    const nome = document.getElementById('clienteNome').value.trim();
    const tel = document.getElementById('clienteTel').value.trim();
    const obs = document.getElementById('clienteObs').value.trim();

    if (!nome) return showToast('Preencha seu nome', 'error');
    if (!tel || tel.replace(/\D/g, '').length !== 11) return showToast('Preencha um celular válido com 11 dígitos', 'error');

    showLoading('Confirmando seu horário...');
    document.getElementById('btnConfirmar').disabled = true;

    try {
        // Usar diretamente os valores de slotInicio/slotFim recebidos da RPC
        // que já contêm os timestamps corretos com timezone de Brasília
        const payload = {
            empresa_id: state.empresaId,
            profissional_id: state.profissional.id,
            servico_id: state.servico.id,
            cliente_nome: nome,
            cliente_telefone: tel,
            observacao: obs,
            data_hora_inicio: state.slotInicio,
            data_hora_fim: state.slotFim,
            status: 'pendente'
        };

        const { error } = await sb
            .from('agendamentos')
            .insert(payload);

        if (error) throw error;

        // Preenche tela de sucesso
        document.getElementById('confServico').textContent = state.servico.nome;
        document.getElementById('confProfissional').textContent = state.profissional.nome;
        document.getElementById('confDataHora').textContent = `${state.dataSelecionada.toLocaleDateString('pt-BR')} às ${state.slotSelecionado}`;
        document.getElementById('confPreco').textContent = `R$ ${Number(state.servico.preco).toFixed(2).replace('.', ',')}`;

        hideLoading();
        
        // Vai para a tela final de sucesso (oculta outras)
        document.querySelectorAll('.ag-step-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('step-sucesso').classList.add('active');
        document.querySelector('.ag-progress-wrap').style.display = 'none';

    } catch (err) {
        console.error('Erro ao salvar agendamento:', err);

        // Código 23P01 = exclusion_violation (PostgreSQL)
        // Acontece quando a exclusion constraint detecta sobreposição de horários
        const isConflito = err.code === '23P01' || (err.message && err.message.includes('agendamentos_no_overlap'));
        const msg = isConflito
            ? '⚡ Este horário acabou de ser reservado por outra pessoa. Escolha outro.'
            : 'Erro ao confirmar agendamento. Tente novamente.';

        showToast(msg, 'error');
        hideLoading();
        document.getElementById('btnConfirmar').disabled = false;
        
        // Recarrega slots para mostrar grade atualizada
        carregarSlotsDisponiveis();
        agendarApp.irPara(4); // Volta para tela de horário
    }
}

function novoAgendamento() {
    // Reseta estado principal
    state.step = 1;
    state.dataSelecionada = null;
    state.slotSelecionado = null;
    state.slotInicio = null;
    state.slotFim = null;

    // Reseta inputs
    document.getElementById('clienteNome').value = '';
    document.getElementById('clienteTel').value = '';
    document.getElementById('clienteObs').value = '';
    
    // Reseta UI
    document.querySelector('.ag-progress-wrap').style.display = 'block';
    
    // Reseta botões
    document.getElementById('btnStep1Next').disabled = true;
    document.getElementById('btnStep2Next').disabled = true;
    document.getElementById('btnStep3Next').disabled = true;
    document.getElementById('btnStep4Next').disabled = true;
    document.getElementById('btnConfirmar').disabled = true;
    
    agendarApp.irPara(1);
}

// ============================================================
// UTILS
// ============================================================
function showLoading(msg = 'Carregando...') {
    const el = document.getElementById('agLoading');
    if (!el) return;
    const p = el.querySelector('p');
    if (p) p.textContent = msg;
    el.classList.remove('hidden');
}

function hideLoading() {
    const el = document.getElementById('agLoading');
    if (el) el.classList.add('hidden');
}

let toastTimeout;
function showToast(msg, type = 'success') {
    const el = document.getElementById('agToast');
    if (!el) {
        // Se a tela de erro do tenant estiver ativa, usamos alert ou console
        console.log(`[Toast Fallback] ${type}: ${msg}`);
        return;
    }
    el.textContent = msg;
    el.className = `ag-toast show ${type}`;
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        el.classList.remove('show');
    }, 3500);
}
