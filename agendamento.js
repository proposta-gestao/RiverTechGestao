/**
 * agendamento.js
 * Lógica do fluxo de agendamento público (Wizard de 5 passos)
 * Integração com Supabase e sistema de Tenant
 */

// ============================================================
// CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    },

    selecionarProfissional(id) {
        const prof = state.profissionais.find(p => p.id === id);
        if (!prof) return;
        state.profissional = prof;

        // Atualiza UI
        document.querySelectorAll('#profissionaisGrid .ag-card').forEach(el => el.classList.remove('selected'));
        document.getElementById(`prof-${id}`).classList.add('selected');
        document.getElementById('btnStep2Next').disabled = false;
    },

    navMes,
    selecionarDia,
    selecionarSlot,
    confirmarAgendamento,
    novoAgendamento
};

window.agendarApp = agendarApp;

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
        container.innerHTML = `<div class="ag-slots-empty">Erro ao carregar horários. Tente novamente.</div>`;
    }
}

function renderSlots(slots) {
    const container = document.getElementById('slotsContainer');

    if (slots.length === 0) {
        container.innerHTML = `<div class="ag-slots-empty">Nenhum horário disponível nesta data.</div>`;
        return;
    }

    const agora = new Date();
    const isHoje = state.dataSelecionada.toDateString() === agora.toDateString();

    // Cria grid
    let html = `<div class="ag-slots-grid">`;
    slots.forEach((s, i) => {
        const dInicio = new Date(s.slot_inicio);
        
        // Se for hoje, filtra slots passados (usando comparação nominal)
        if (isHoje) {
            // Criamos um Date 'agora' nominal para comparar com o UTC do slot
            const agoraNominal = new Date();
            const slotNominal = new Date(s.slot_inicio);
            
            // Comparar apenas se o slot é no passado HOJE
            // slot_inicio vem como "2026-04-30T09:00:00Z"
            // Queremos saber se "09:00" já passou no relógio local
            const hSlot = slotNominal.getUTCHours();
            const mSlot = slotNominal.getUTCMinutes();
            const hAgora = agoraNominal.getHours();
            const mAgora = agoraNominal.getMinutes();

            if (hSlot < hAgora || (hSlot === hAgora && mSlot <= mAgora)) return;
        }

        // Extrair hora nominal (UTC) para evitar deslocamento de fuso
        const hora = String(dInicio.getUTCHours()).padStart(2, '0');
        const min = String(dInicio.getUTCMinutes()).padStart(2, '0');
        const horaFormatada = `${hora}:${min}`;
        
        html += `<div class="ag-slot" id="slot-${i}" data-inicio="${s.slot_inicio}" data-fim="${s.slot_fim}" onclick="agendarApp.selecionarSlot(${i}, '${horaFormatada}')">${horaFormatada}</div>`;
    });
    html += `</div>`;

    if (html === `<div class="ag-slots-grid"></div>`) {
        container.innerHTML = `<div class="ag-slots-empty">Todos os horários de hoje já passaram.</div>`;
    } else {
        container.innerHTML = html;
    }
}

function selecionarSlot(index, horaFormatada) {
    document.querySelectorAll('.ag-slot').forEach(el => el.classList.remove('selected'));
    const slotEl = document.getElementById(`slot-${index}`);
    slotEl.classList.add('selected');

    state.slotSelecionado = horaFormatada;
    state.slotInicio = slotEl.dataset.inicio;
    state.slotFim = slotEl.dataset.fim;

    document.getElementById('btnStep4Next').disabled = false;
}

// ============================================================
// RESUMO E CONFIRMAÇÃO
// ============================================================
function renderResumo() {
    document.getElementById('sumServico').textContent = state.servico.nome;
    document.getElementById('sumProfissional').textContent = state.profissional.nome;
    
    const dStr = state.dataSelecionada.toLocaleDateString('pt-BR');
    document.getElementById('sumDataHora').textContent = `${dStr} às ${state.slotSelecionado}`;
    
    document.getElementById('sumDuracao').textContent = `${state.servico.duracao_min || state.servico.duracao_minutos || 0} min`;
    document.getElementById('sumPreco').textContent = `R$ ${Number(state.servico.preco).toFixed(2).replace('.', ',')}`;
}

async function confirmarAgendamento() {
    const nome = document.getElementById('clienteNome').value.trim();
    const tel = document.getElementById('clienteTel').value.trim();
    const obs = document.getElementById('clienteObs').value.trim();

    if (!nome) return showToast('Preencha seu nome', 'error');
    if (!tel || tel.length < 10) return showToast('Preencha um celular válido', 'error');

    showLoading('Confirmando seu horário...');
    document.getElementById('btnConfirmar').disabled = true;

    try {
        const duracao = parseInt(state.servico.duracao_min || state.servico.duracao_minutos || 30);
        const dataInicio = new Date(state.slotInicio);
        const dataFim = new Date(dataInicio.getTime() + duracao * 60000);

        const payload = {
            empresa_id: state.empresaId,
            profissional_id: state.profissional.id,
            servico_id: state.servico.id,
            cliente_nome: nome,
            cliente_telefone: tel,
            observacao: obs,
            data_hora_inicio: dataInicio.toISOString(),
            data_hora_fim: dataFim.toISOString(),
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
        showToast('Erro ao confirmar agendamento. O horário pode ter sido reservado por outra pessoa.', 'error');
        hideLoading();
        document.getElementById('btnConfirmar').disabled = false;
        
        // Recarrega slots para garantir
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
    
    // Volta para o primeiro passo, mantendo profissional e serviço já selecionados para facilitar
    // ou podemos resetar a seleção deles também. Para UX, melhor manter serviço e prof e só limpar data.
    // Mas para garantir fluxo limpo:
    document.getElementById('btnStep3Next').disabled = true;
    document.getElementById('btnStep4Next').disabled = true;
    
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
