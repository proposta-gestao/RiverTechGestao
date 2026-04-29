/* ============================================================
   admin-agenda.js - Módulo de Agendamento (Lazy Loaded)
   Carregado apenas quando o usuário clica na aba Agenda
   ============================================================ */

(function () {
    'use strict';

    // Evitar inicialização dupla
    if (window.__AGENDA_INICIADO) return;
    window.__AGENDA_INICIADO = true;

    // Referência ao cliente Supabase (já inicializado pelo admin.js)
    const sb = window.sb;
    const EMPRESA_ID = () => window.TENANT?.empresa_id;

    // ============================================================
    // Estado local do módulo
    // ============================================================
    let agendamentos = [];
    let profissionais = [];
    let servicos = [];
    let agendamentosFuturos = [];
    let listaEspera = [];
    let diasComEventos = new Set();
    let agendaSubscription = null;
    let profissionalSelecionado = null;
    let dataSelecionada = new Date();
    let calMes = new Date();

    const CORES_PROFISSIONAL = ['#E5B25D', '#6366f1', '#22c55e', '#06b6d4', '#f43f5e', '#f59e0b'];
    const STATUS_LABELS = {
        pendente: 'Pendente', confirmado: 'Confirmado',
        em_andamento: 'Em andamento', concluido: 'Concluído',
        cancelado: 'Cancelado', no_show: 'No-show'
    };
    const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const DIAS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    // ============================================================
    // 1. Inicialização
    // ============================================================
    async function init() {
        try {
            await Promise.all([carregarProfissionais(), carregarServicos()]);
            await carregarDiasComAgendamentos();
            renderSubtab('agenda'); // Começa na aba de Agenda do dia
            renderMiniCal();
            renderProfissionaisSidebar();
            await Promise.all([
                carregarAgendamentos(), 
                carregarAgendamentosFuturos(),
                carregarListaEspera()
            ]);
            renderTimeline();
            renderTimelineFuturo();
            renderStats();
            setupRealtime();
        } catch (err) {
            console.error('[Agenda] Erro na inicialização:', err);
        }
    }

    function setupRealtime() {
        if (agendaSubscription) return;
        agendaSubscription = sb.channel('agenda-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `empresa_id=eq.${EMPRESA_ID()}` }, async () => {
                await Promise.all([carregarAgendamentos(), carregarAgendamentosFuturos(), carregarDiasComAgendamentos()]);
                renderMiniCal();
                renderTimeline();
                renderTimelineFuturo();
                renderStats();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_espera', filter: `empresa_id=eq.${EMPRESA_ID()}` }, async () => {
                await carregarListaEspera();
                if (document.getElementById('agendaTab_lista').style.display !== 'none') {
                    renderListaEsperaTab();
                }
            })
            .subscribe();
    }

    // ============================================================
    // 2. Carregamento de Dados
    // ============================================================
    async function carregarProfissionais() {
        const { data, error } = await sb
            .from('profissionais')
            .select('*')
            .eq('empresa_id', EMPRESA_ID())
            .order('nome');
        if (!error) profissionais = data || [];
    }

    async function carregarServicos() {
        const { data, error } = await sb
            .from('servicos')
            .select('*')
            .eq('empresa_id', EMPRESA_ID())
            .order('nome');
        if (!error) servicos = data || [];
    }

    async function carregarAgendamentos(dataInicio = null, dataFim = null) {
        const inicio = dataInicio || new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), dataSelecionada.getDate()).toISOString();
        const fim = dataFim || new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), dataSelecionada.getDate(), 23, 59, 59).toISOString();

        let query = sb
            .from('agendamentos')
            .select('*, profissional:profissionais(nome, cor_agenda), servico:servicos(nome, duracao_min, preco)')
            .eq('empresa_id', EMPRESA_ID())
            .gte('data_hora_inicio', inicio)
            .lte('data_hora_inicio', fim)
            .order('data_hora_inicio');

        if (profissionalSelecionado) {
            query = query.eq('profissional_id', profissionalSelecionado);
        }

        const { data, error } = await query;
        if (!error) agendamentos = data || [];
    }

    async function carregarAgendamentosFuturos() {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(0, 0, 0, 0);

        let query = sb.from('agendamentos')
            .select('*, profissional:profissionais(nome, cor_agenda), servico:servicos(nome, duracao_min, preco)')
            .eq('empresa_id', EMPRESA_ID())
            .gte('data_hora_inicio', amanha.toISOString())
            .in('status', ['pendente', 'confirmado'])
            .order('data_hora_inicio')
            .limit(20);

        if (profissionalSelecionado) query = query.eq('profissional_id', profissionalSelecionado);

        const { data } = await query;
        agendamentosFuturos = data || [];
    }

    async function carregarDiasComAgendamentos() {
        const inicioMes = new Date(calMes.getFullYear(), calMes.getMonth(), 1).toISOString();
        const fimMes = new Date(calMes.getFullYear(), calMes.getMonth() + 1, 0, 23, 59, 59).toISOString();
        
        const { data } = await sb.from('agendamentos')
            .select('data_hora_inicio')
            .eq('empresa_id', EMPRESA_ID())
            .gte('data_hora_inicio', inicioMes)
            .lte('data_hora_inicio', fimMes)
            .in('status', ['pendente', 'confirmado', 'em_andamento', 'concluido']);
            
        diasComEventos.clear();
        if (data) {
            data.forEach(ag => {
                diasComEventos.add(new Date(ag.data_hora_inicio).toDateString());
            });
        }
    }

    async function carregarListaEspera() {
        const { data, error } = await sb
            .from('lista_espera')
            .select('*, servico:servicos(nome)')
            .eq('empresa_id', EMPRESA_ID())
            .in('status', ['aguardando', 'notificado'])
            .order('criado_em', { ascending: true });
        
        if (!error) listaEspera = data || [];
    }

    // ============================================================
    // 3. Renderização do Mini Calendário
    // ============================================================
    function renderMiniCal() {
        const container = document.getElementById('miniCalGrid');
        const label = document.getElementById('miniCalLabel');
        if (!container) return;

        const ano = calMes.getFullYear();
        const mes = calMes.getMonth();
        const hoje = new Date();

        label.textContent = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        // Cabeçalho dos dias
        let html = DIAS_SEMANA.map(d => `<div class="mini-cal-day-name">${d}</div>`).join('');

        const primeiroDia = new Date(ano, mes, 1).getDay();
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();

        // Espaços vazios antes
        for (let i = 0; i < primeiroDia; i++) {
            html += `<div class="mini-cal-day empty"></div>`;
        }

        for (let dia = 1; dia <= diasNoMes; dia++) {
            const d = new Date(ano, mes, dia);
            const isHoje = d.toDateString() === hoje.toDateString();
            const isSel = d.toDateString() === dataSelecionada.toDateString();
            const hasEvents = diasComEventos.has(d.toDateString());
            const classes = ['mini-cal-day',
                isHoje ? 'today' : '',
                isSel ? 'selected' : '',
                hasEvents ? 'has-events' : ''
            ].filter(Boolean).join(' ');

            html += `<div class="${classes}" onclick="window.__AGENDA.selecionarDia(${ano}, ${mes}, ${dia})">${dia}</div>`;
        }

        container.innerHTML = html;
    }

    async function navMes(delta) {
        calMes = new Date(calMes.getFullYear(), calMes.getMonth() + delta, 1);
        await carregarDiasComAgendamentos();
        renderMiniCal();
    }

    async function selecionarDia(ano, mes, dia) {
        dataSelecionada = new Date(ano, mes, dia);
        renderMiniCal();
        await carregarAgendamentos();
        renderTimeline();
        renderStats();
    }

    // ============================================================
    // 4. Sidebar de Profissionais
    // ============================================================
    function renderProfissionaisSidebar() {
        const container = document.getElementById('profissionaisList');
        if (!container) return;

        let html = `
            <div class="profissional-pill ${!profissionalSelecionado ? 'active' : ''}" onclick="window.__AGENDA.filtrarProfissional(null)">
                <div class="profissional-avatar-placeholder" style="background: rgba(229,178,93,0.2); font-size:1.2rem;">👥</div>
                <div class="profissional-info">
                    <div class="profissional-nome">Todos os Profissionais</div>
                    <div class="profissional-esp">Ver agenda completa</div>
                </div>
            </div>`;

        profissionais.forEach((p, i) => {
            const cor = p.cor_agenda || CORES_PROFISSIONAL[i % CORES_PROFISSIONAL.length];
            const inicial = (p.nome || '?').charAt(0).toUpperCase();
            const avatar = p.foto_url
                ? `<img class="profissional-avatar" src="${p.foto_url}" alt="${p.nome || 'Profissional'}">`
                : `<div class="profissional-avatar-placeholder" style="background:${cor};">${inicial}</div>`;
            const isActive = profissionalSelecionado === p.id;

            html += `
                <div class="profissional-pill ${isActive ? 'active' : ''}" onclick="window.__AGENDA.filtrarProfissional('${p.id}')">
                    ${avatar}
                    <div class="profissional-info">
                        <div class="profissional-nome">${p.nome}</div>
                        <div class="profissional-esp">${p.especialidade || 'Profissional'}</div>
                    </div>
                </div>`;
        });

        if (profissionais.length === 0) {
            html += `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding: 1rem 0;">Nenhum profissional cadastrado.</p>`;
        }

        container.innerHTML = html;
    }

    async function filtrarProfissional(id) {
        profissionalSelecionado = id;
        renderProfissionaisSidebar();
        await Promise.all([carregarAgendamentos(), carregarAgendamentosFuturos()]);
        renderTimeline();
        renderTimelineFuturo();
    }

    // ============================================================
    // 5. Timeline de Agendamentos
    // ============================================================
    function gerarHtmlTimeline(lista, isEmptyMsg) {
        if (lista.length === 0) {
            return `
                <div class="timeline-empty">
                    <div class="icon">📅</div>
                    <p>${isEmptyMsg}</p>
                </div>`;
        }

        return lista.map(ag => {
            const dataOb = new Date(ag.data_hora_inicio);
            const horaInicio = dataOb.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const horaFim = new Date(ag.data_hora_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const dataLabel = dataOb.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const cor = ag.profissional?.cor_agenda || '#E5B25D';
            const statusLabel = STATUS_LABELS[ag.status] || ag.status;

            return `
                <div class="agendamento-card">
                    <div class="agendamento-cor-bar" style="background:${cor};"></div>
                    <div class="agendamento-body">
                        <div class="agendamento-hora">${horaInicio}<br><small style="color:var(--text-muted);font-weight:400;">${dataLabel}</small></div>
                        <div class="agendamento-info">
                            <div class="agendamento-cliente">${ag.cliente_nome} <span style="font-size:0.75rem; color:var(--text-muted);">📱 ${ag.cliente_telefone}</span></div>
                            <div class="agendamento-servico">${ag.servico?.nome || '—'} · ${ag.profissional?.nome || '—'}</div>
                        </div>
                        <span class="agendamento-status status-${ag.status}">${statusLabel}</span>
                    </div>
                    <div class="agendamento-actions">
                        ${ag.status === 'concluido' ? '' : `<button onclick="window.__AGENDA.abrirModalAgendamento('${ag.id}')" title="Ver detalhes">✏️</button>`}
                        ${ag.status === 'concluido' ? '' : `<button onclick="window.__AGENDA.atualizarStatus('${ag.id}', 'concluido')" title="Marcar como concluído">✅</button>`}
                        ${['cancelado', 'concluido'].includes(ag.status) ? '' : `<button onclick="window.__AGENDA.cancelarAgendamento('${ag.id}')" title="Cancelar" style="color:#ef4444;">✕</button>`}
                    </div>
                </div>`;
        }).join('');
    }

    function renderTimeline() {
        const container = document.getElementById('agendaTimeline');
        const label = document.getElementById('timelineDateLabel');
        if (!container) return;

        label.textContent = dataSelecionada.toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });

        container.innerHTML = gerarHtmlTimeline(agendamentos, 'Nenhum agendamento para este dia.');
    }

    function renderTimelineFuturo() {
        const container = document.getElementById('agendaTimelineFuturo');
        if (!container) return;
        container.innerHTML = gerarHtmlTimeline(agendamentosFuturos, 'Nenhum agendamento futuro.');
    }

    // ============================================================
    // 6. Stats do Dia
    // ============================================================
    function renderStats() {
        const total = agendamentos.length;
        const concluidos = agendamentos.filter(a => a.status === 'concluido').length;
        const faturamento = agendamentos
            .filter(a => a.status === 'concluido')
            .reduce((sum, a) => sum + parseFloat(a.servico?.preco || 0), 0);

        const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('agendaStat_total', total);
        el('agendaStat_concluidos', concluidos);
        el('agendaStat_faturamento', fmt(faturamento));
        el('agendaStat_pendentes', agendamentos.filter(a => a.status === 'pendente').length);
    }

    // ============================================================
    // 7. Subtabs do módulo
    // ============================================================
    function renderSubtab(id) {
        document.querySelectorAll('.agenda-subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === id));
        document.querySelectorAll('.agenda-subtab-content').forEach(c => {
            const isActive = c.id === 'agendaTab_' + id;
            c.classList.toggle('active', isActive);
            c.style.display = isActive ? 'block' : 'none';
        });

        // Carregar conteúdo sob demanda
        if (id === 'servicos') renderServicos();
        if (id === 'profissionais') renderProfissionaisTab();
        if (id === 'horarios') renderHorariosTab();
        if (id === 'lista') renderListaEsperaTab();
    }

    // ============================================================
    // 8. Aba: Profissionais
    // ============================================================
    function renderProfissionaisTab() {
        const container = document.getElementById('profissionaisTabList');
        if (!container) return;

        if (profissionais.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem;">Nenhum profissional cadastrado ainda.</p>`;
            return;
        }

        container.innerHTML = profissionais.map((p, i) => {
            const cor = p.cor_agenda || CORES_PROFISSIONAL[i % CORES_PROFISSIONAL.length];
            return `
                <div class="agenda-form-card">
                    <div class="profissional-avatar-placeholder" style="background:${cor}; width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.4rem; font-weight:700; color:#000; flex-shrink:0;">
                        ${p.nome.charAt(0)}
                    </div>
                    <div class="info">
                        <div class="nome">${p.nome}</div>
                        <div class="sub">${p.especialidade || 'Sem especialidade'} · ${p.ativo ? '🟢 Ativo' : '🔴 Inativo'}</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn-sm btn-edit" onclick="window.__AGENDA.editarProfissional('${p.id}')">Editar</button>
                        <button class="btn-sm btn-cancel" onclick="window.__AGENDA.toggleProfissional('${p.id}', ${!p.ativo})">${p.ativo ? 'Desativar' : 'Ativar'}</button>
                    </div>
                </div>`;
        }).join('');
    }

    // ============================================================
    // 9. Aba: Serviços
    // ============================================================
    function renderServicos() {
        const container = document.getElementById('servicosTabList');
        if (!container) return;

        if (servicos.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem;">Nenhum serviço cadastrado ainda.</p>`;
            return;
        }

        container.innerHTML = servicos.map(s => `
            <div class="agenda-form-card">
                <div style="width:44px;height:44px;border-radius:10px;background:rgba(229,178,93,0.15);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">✂️</div>
                <div class="info">
                    <div class="nome">${s.nome}</div>
                    <div class="sub">⏱ ${s.duracao_min} min · 💰 R$ ${parseFloat(s.preco).toFixed(2).replace('.', ',')} · ${s.ativo ? '🟢 Ativo' : '🔴 Inativo'}</div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-sm btn-edit" onclick="window.__AGENDA.editarServico('${s.id}')">Editar</button>
                </div>
            </div>`).join('');
    }

    // ============================================================
    // 10. Aba: Horários de Funcionamento
    // ============================================================
    async function renderHorariosTab() {
        const container = document.getElementById('horariosTabContent');
        if (!container) return;

        const { data: horarios } = await sb
            .from('horarios_funcionamento')
            .select('*')
            .eq('empresa_id', EMPRESA_ID())
            .is('profissional_id', null)
            .order('dia_semana');

        const horariosMap = {};
        (horarios || []).forEach(h => { horariosMap[h.dia_semana] = h; });

        container.innerHTML = `
            <div class="horarios-grid">
                ${DIAS_FULL.map((nome, i) => {
                    const h = horariosMap[i] || { hora_abertura: '09:00', hora_fechamento: '19:00', ativo: i !== 0 };
                    return `
                        <div class="horario-dia">
                            <div class="dia-nome">${nome}</div>
                            <input type="time" id="horAbre_${i}" value="${h.hora_abertura}" onchange="window.__AGENDA.salvarHorario(${i})">
                            <input type="time" id="horFecha_${i}" value="${h.hora_fechamento}" onchange="window.__AGENDA.salvarHorario(${i})">
                            <div class="switch-wrap">
                                <label class="switch">
                                    <input type="checkbox" id="horAtivo_${i}" ${h.ativo ? 'checked' : ''} onchange="window.__AGENDA.salvarHorario(${i})">
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    }

    // ============================================================
    // 10.5 Aba: Lista de Espera
    // ============================================================
    function renderListaEsperaTab() {
        const container = document.getElementById('listaEsperaTabContent');
        if (!container) return;

        if (listaEspera.length === 0) {
            container.innerHTML = `
                <div class="timeline-empty">
                    <div class="icon">📝</div>
                    <p>Nenhum cliente na lista de espera no momento.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="agenda-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Serviço</th>
                            <th>Data Desejada</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${listaEspera.map(item => {
                            const dataDesejada = item.data_desejada ? new Date(item.data_desejada).toLocaleDateString('pt-BR') : 'Qualquer';
                            const statusClass = item.status === 'notificado' ? 'status-confirmado' : 'status-pendente';
                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight:600;">${item.cliente_nome}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);">📱 ${item.cliente_telefone}</div>
                                    </td>
                                    <td>${item.servico?.nome || '—'}</td>
                                    <td>${dataDesejada}</td>
                                    <td><span class="agendamento-status ${statusClass}">${item.status.toUpperCase()}</span></td>
                                    <td class="agendamento-actions">
                                        <button onclick="window.__AGENDA.abrirModalNovoAgendamentoParaLista('${item.id}')" title="Converter em Agendamento">📅</button>
                                        <button onclick="window.__AGENDA.removerDaLista('${item.id}')" title="Remover" style="color:var(--danger);">✕</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    async function removerDaLista(id) {
        if (!confirm('Deseja remover este cliente da lista de espera?')) return;
        const { error } = await sb.from('lista_espera').update({ status: 'cancelado' }).eq('id', id);
        if (!error) {
            window.showToast?.('Removido da lista.');
            await carregarListaEspera();
            renderListaEsperaTab();
        }
    }

    function abrirModalListaEspera() {
        const modal = document.getElementById('modalListaEspera');
        if (!modal) return;

        const selServ = document.getElementById('waitlistServico');
        selServ.innerHTML = servicos.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');

        document.getElementById('waitlistNome').value = '';
        document.getElementById('waitlistTelefone').value = '';
        document.getElementById('waitlistData').value = '';

        modal.classList.add('active');
    }

    async function salvarListaEspera() {
        const payload = {
            empresa_id: EMPRESA_ID(),
            cliente_nome: document.getElementById('waitlistNome').value.trim(),
            cliente_telefone: document.getElementById('waitlistTelefone').value.trim(),
            servico_id: document.getElementById('waitlistServico').value,
            data_desejada: document.getElementById('waitlistData').value || null,
            status: 'aguardando'
        };

        if (!payload.cliente_nome || !payload.cliente_telefone) {
            window.showToast?.('Nome e Telefone são obrigatórios', 'error');
            return;
        }

        const { error } = await sb.from('lista_espera').insert(payload);

        if (error) {
            window.showToast?.('Erro: ' + error.message, 'error');
            return;
        }

        window.showToast?.('Adicionado à lista de espera!');
        document.getElementById('modalListaEspera').classList.remove('active');
        await carregarListaEspera();
        renderListaEsperaTab();
    }

    async function salvarHorario(diaSemana) {
        const abre = document.getElementById(`horAbre_${diaSemana}`)?.value;
        const fecha = document.getElementById(`horFecha_${diaSemana}`)?.value;
        const ativo = document.getElementById(`horAtivo_${diaSemana}`)?.checked;

        if (ativo === undefined) ativo = true;

        // LIMPEZA TOTAL: Removemos TUDO deste dia (Loja e Profissionais)
        // Isso garante que não existam registros "fantasmas" atrapalhando a sincronização.
        await sb.from('horarios_funcionamento')
            .delete()
            .eq('empresa_id', EMPRESA_ID())
            .eq('dia_semana', diaSemana);

        // Inserimos o novo horário da LOJA
        const { error } = await sb.from('horarios_funcionamento').insert({
            empresa_id: EMPRESA_ID(),
            profissional_id: null,
            dia_semana: diaSemana,
            hora_abertura: abre,
            hora_fechamento: fecha,
            ativo: ativo
        });

        if (!error) {
            window.showToast?.('Horário sincronizado com sucesso!');
        } else {
            console.error('Erro ao salvar horário:', error);
            window.showToast?.('Erro ao sincronizar horário', 'error');
        }
    }

    // ============================================================
    // 11. Modais (Novo/Editar Agendamento)
    // ============================================================
    function abrirModalNovoAgendamento() {
        const modal = document.getElementById('modalNovoAgendamento');
        if (!modal) return;

        // Preencher selects
        const selProf = document.getElementById('agendaModalProfissional');
        const selServ = document.getElementById('agendaModalServico');

        selProf.innerHTML = profissionais.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        selServ.innerHTML = servicos.map(s => `<option value="${s.id}" data-dur="${s.duracao_min}">${s.nome} (${s.duracao_min}min)</option>`).join('');

        // Data padrão = data selecionada
        const dataStr = dataSelecionada.toISOString().split('T')[0];
        document.getElementById('agendaModalData').value = dataStr;
        document.getElementById('agendaModalHora').value = '09:00';
        document.getElementById('agendaModalCliente').value = '';
        document.getElementById('agendaModalTelefone').value = '';
        document.getElementById('agendaModalObs').value = '';
        document.getElementById('agendaModalId').value = '';

        modal.classList.add('active');
    }

    function abrirModalAgendamento(id) {
        const ag = agendamentos.find(a => a.id === id);
        if (!ag) return;

        const modal = document.getElementById('modalNovoAgendamento');
        if (!modal) return;

        // Preencher selects
        const selProf = document.getElementById('agendaModalProfissional');
        const selServ = document.getElementById('agendaModalServico');
        selProf.innerHTML = profissionais.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        selServ.innerHTML = servicos.map(s => `<option value="${s.id}" data-dur="${s.duracao_min}">${s.nome} (${s.duracao_min}min)</option>`).join('');

        // Preencher valores do agendamento existente
        document.getElementById('agendaModalProfissional').value = ag.profissional_id;
        document.getElementById('agendaModalServico').value = ag.servico_id;
        
        const dateObj = new Date(ag.data_hora_inicio);
        document.getElementById('agendaModalData').value = dateObj.toISOString().split('T')[0];
        document.getElementById('agendaModalHora').value = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        document.getElementById('agendaModalCliente').value = ag.cliente_nome;
        document.getElementById('agendaModalTelefone').value = ag.cliente_telefone;
        document.getElementById('agendaModalObs').value = ag.observacao || '';
        document.getElementById('agendaModalId').value = ag.id;

        modal.classList.add('active');
    }

    function abrirModalNovoAgendamentoParaLista(waitlistId) {
        const item = listaEspera.find(i => i.id === waitlistId);
        if (!item) return;

        abrirModalNovoAgendamento();
        document.getElementById('agendaModalCliente').value = item.cliente_nome || '';
        document.getElementById('agendaModalTelefone').value = item.cliente_telefone || '';
        document.getElementById('agendaModalServico').value = item.servico_id || '';
        document.getElementById('agendaModalData').value = item.data_desejada || dataSelecionada.toISOString().split('T')[0];
        
        // Atribuir o ID da lista ao campo oculto (vou precisar criar esse campo no HTML)
        const hiddenWaitlist = document.getElementById('agendaModalWaitlistId') || document.createElement('input');
        hiddenWaitlist.type = 'hidden';
        hiddenWaitlist.id = 'agendaModalWaitlistId';
        hiddenWaitlist.value = waitlistId;
        document.getElementById('modalNovoAgendamento').appendChild(hiddenWaitlist);
    }

    async function salvarAgendamento() {
        const profId = document.getElementById('agendaModalProfissional').value;
        const servId = document.getElementById('agendaModalServico').value;
        const data = document.getElementById('agendaModalData').value;
        const hora = document.getElementById('agendaModalHora').value;
        const cliente = document.getElementById('agendaModalCliente').value.trim();
        const telefone = document.getElementById('agendaModalTelefone').value.trim();
        const obs = document.getElementById('agendaModalObs').value.trim();
        const editId = document.getElementById('agendaModalId').value;

        if (!profId || !servId || !data || !hora || !cliente || !telefone) {
            window.showToast?.('Preencha todos os campos obrigatórios.', 'error');
            return;
        }

        const serv = servicos.find(s => s.id === servId);
        const durMin = serv?.duracao_min || 30;
        const inicio = new Date(`${data}T${hora}`);
        const fim = new Date(inicio.getTime() + durMin * 60000);

        const payload = {
            empresa_id: EMPRESA_ID(),
            profissional_id: profId,
            servico_id: servId,
            cliente_nome: cliente,
            cliente_telefone: telefone,
            data_hora_inicio: inicio.toISOString(),
            data_hora_fim: fim.toISOString(),
            observacao: obs || null,
        };

        const { error } = editId
            ? await sb.from('agendamentos').update(payload).eq('id', editId)
            : await sb.from('agendamentos').insert(payload);

        if (error) {
            window.showToast?.('Erro ao salvar agendamento: ' + error.message, 'error');
            return;
        }

        const waitlistId = document.getElementById('agendaModalWaitlistId')?.value;
        if (waitlistId) {
            payload.waitlist_id = waitlistId; // Se quiser rastrear a origem
            // Marcar como confirmado na lista de espera
            await sb.from('lista_espera').update({ status: 'confirmado', agendamento_id: data.id }).eq('id', waitlistId);
            document.getElementById('agendaModalWaitlistId').value = '';
        }

        window.showToast?.('Agendamento salvo!');
        document.getElementById('modalNovoAgendamento').classList.remove('active');
        await Promise.all([carregarAgendamentos(), carregarListaEspera()]);
        renderTimeline();
        renderStats();
        if (document.getElementById('agendaTab_lista').style.display !== 'none') renderListaEsperaTab();
    }

    async function atualizarStatus(id, status) {
        const { error } = await sb.from('agendamentos').update({ status }).eq('id', id);
        if (!error) {
            window.showToast?.(`Status atualizado para: ${STATUS_LABELS[status]}`);
            await carregarAgendamentos();
            renderTimeline();
            renderStats();
        }
    }

    async function cancelarAgendamento(id) {
        if (!confirm('Deseja cancelar este agendamento?')) return;
        await atualizarStatus(id, 'cancelado');
    }

    async function toggleProfissional(id, ativo) {
        await sb.from('profissionais').update({ ativo }).eq('id', id);
        await carregarProfissionais();
        renderProfissionaisTab();
        renderProfissionaisSidebar();
        window.showToast?.(`Profissional ${ativo ? 'ativado' : 'desativado'}!`);
    }

    function editarProfissional(id) {
        if (id) {
            const p = profissionais.find(x => x.id === id);
            if (!p) return;
            document.getElementById('profModalId').value = p.id;
            document.getElementById('profModalNome').value = p.nome || '';
            document.getElementById('profModalEsp').value = p.especialidade || '';
            document.getElementById('profModalBio').value = p.bio || '';
            document.getElementById('profModalCor').value = p.cor_agenda || '#E5B25D';
            document.getElementById('profModalFoto').value = p.foto_url || '';
        } else {
            document.getElementById('profModalId').value = '';
            document.getElementById('profModalNome').value = '';
            document.getElementById('profModalEsp').value = '';
            document.getElementById('profModalBio').value = '';
            document.getElementById('profModalCor').value = '#E5B25D';
            document.getElementById('profModalFoto').value = '';
        }
        document.getElementById('modalProfissional').classList.add('active');
    }

    async function salvarProfissional() {
        const id = document.getElementById('profModalId').value;
        const payload = {
            empresa_id: EMPRESA_ID(),
            nome: document.getElementById('profModalNome').value.trim(),
            especialidade: document.getElementById('profModalEsp').value.trim() || null,
            bio: document.getElementById('profModalBio').value.trim() || null,
            cor_agenda: document.getElementById('profModalCor').value,
            foto_url: document.getElementById('profModalFoto').value.trim() || null,
        };

        if (!payload.nome) { window.showToast?.('Nome é obrigatório', 'error'); return; }

        const { error } = id
            ? await sb.from('profissionais').update(payload).eq('id', id)
            : await sb.from('profissionais').insert(payload);

        if (error) { window.showToast?.('Erro: ' + error.message, 'error'); return; }

        window.showToast?.('Profissional salvo!');
        document.getElementById('modalProfissional').classList.remove('active');
        await carregarProfissionais();
        renderProfissionaisTab();
        renderProfissionaisSidebar();
    }

    function editarServico(id) {
        if (id) {
            const s = servicos.find(x => x.id === id);
            if (!s) return;
            document.getElementById('servModalId').value = s.id;
            document.getElementById('servModalNome').value = s.nome || '';
            document.getElementById('servModalDesc').value = s.descricao || '';
            document.getElementById('servModalDuracao').value = s.duracao_min || 30;
            document.getElementById('servModalPreco').value = s.preco || 0;
        } else {
            document.getElementById('servModalId').value = '';
            document.getElementById('servModalNome').value = '';
            document.getElementById('servModalDesc').value = '';
            document.getElementById('servModalDuracao').value = '';
            document.getElementById('servModalPreco').value = '';
        }
        document.getElementById('modalServico').classList.add('active');
    }

    async function salvarServico() {
        const id = document.getElementById('servModalId').value;
        const payload = {
            empresa_id: EMPRESA_ID(),
            nome: document.getElementById('servModalNome').value.trim(),
            descricao: document.getElementById('servModalDesc').value.trim() || null,
            duracao_min: parseInt(document.getElementById('servModalDuracao').value) || 30,
            preco: parseFloat(document.getElementById('servModalPreco').value) || 0,
        };

        if (!payload.nome) { window.showToast?.('Nome é obrigatório', 'error'); return; }

        const { error } = id
            ? await sb.from('servicos').update(payload).eq('id', id)
            : await sb.from('servicos').insert(payload);

        if (error) { window.showToast?.('Erro: ' + error.message, 'error'); return; }

        window.showToast?.('Serviço salvo!');
        document.getElementById('modalServico').classList.remove('active');
        await carregarServicos();
        renderServicos();
    }

    // ============================================================
    // 12. Expor API pública para uso no HTML
    // ============================================================
    window.__AGENDA = {
        selecionarDia, navMes, filtrarProfissional, renderSubtab,
        abrirModalNovoAgendamento, abrirModalAgendamento, salvarAgendamento,
        atualizarStatus, cancelarAgendamento,
        editarProfissional, salvarProfissional, toggleProfissional,
        editarServico, salvarServico,
        salvarHorario,
        abrirModalListaEspera, salvarListaEspera, removerDaLista, abrirModalNovoAgendamentoParaLista
    };

    // Iniciar
    init();
})();
