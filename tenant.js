/**
 * tenant.js — Contexto Multi-Tenant (v2)
 * =========================================
 * Identifica a empresa automaticamente via SUBDOMÍNIO da URL.
 *
 * Exemplos:
 *   cliente1.meusistema.com  → slug = "cliente1"
 *   cliente2.meusistema.com  → slug = "cliente2"
 *   localhost / 127.0.0.1    → slug = "teste" (fallback dev)
 *   ?loja=slug               → fallback legacy (querystring)
 *
 * Passos implementados:
 *   1. Captura slug via subdomínio (ou fallback)
 *   2. Busca empresa no Supabase (1x, cacheado)
 *   3. Armazena em window.empresa e window.TENANT
 *   4. Aplica white-label (CSS vars, logo, nome)
 *   5. Mostra tela de erro se empresa não encontrada
 *   6. getTenantId() usado em todos INSERTs/SELECTs
 *
 * SEGURANÇA: O frontend usa empresa_id apenas como contexto.
 * O RLS do Supabase valida e garante o isolamento real.
 */

// ================================================================
// PASSO 1: CAPTURAR O SLUG DA EMPRESA A PARTIR DA URL
// ================================================================
function _resolverSlug() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // 1. Tentar da Querystring - Ex: ?loja=slug (Útil para debug)
    const paramSlug = new URLSearchParams(window.location.search).get('loja');
    if (paramSlug) return paramSlug;

    // 2. Tentar pegar da Rota (Pathname) - Ex: meusite.com/slug/cardapio
    const pathSegments = pathname.split('/').filter(p => p);
    // Ignora arquivos estáticos
    if (pathSegments.length > 0 && !pathSegments[0].includes('.html')) {
        return pathSegments[0];
    }

    // 3. Tentar Subdomínio - Ex: slug.meusistema.com
    const partes = hostname.split('.');
    if (partes.length >= 3 && hostname !== '127.0.0.1') {
        return partes[0];
    }

    // Fallback para ambiente local
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
    if (isLocal) {
        console.warn('[Tenant] Ambiente local — usando slug de desenvolvimento: "teste"');
        return 'teste';
    }

    console.error('[Tenant] Não foi possível determinar o slug a partir de:', hostname, pathname);
    return null;
}

// ================================================================
// ESTADO GLOBAL DO TENANT (único ponto de verdade)
// ================================================================
window.TENANT = {
    empresa_id: null,
    slug: null,
    nome: null,
    cor_primaria: null,
    logo_url: null,
    modulos: {},
    pronto: false,
};

// window.empresa — alias para compatibilidade com código legado
window.empresa = null;

// Promise de inicialização (evita múltiplas chamadas ao banco)
let _tenantPromise = null;

/**
 * Converte um hex (#RRGGBB) em rgba(r,g,b,alpha).
 * Usado para gerar as variantes de opacidade automaticamente.
 */
function _hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r)) return hex;
    return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Escurece uma cor hex em uma porcentagem (0-100).
 * Usado para gerar automaticamente o hover da cor primária.
 */
function _darkenHex(hex, percent) {
    if (!hex || !hex.startsWith('#')) return hex;
    const r = Math.max(0, parseInt(hex.slice(1,3),16) - Math.round(2.55*percent));
    const g = Math.max(0, parseInt(hex.slice(3,5),16) - Math.round(2.55*percent));
    const b = Math.max(0, parseInt(hex.slice(5,7),16) - Math.round(2.55*percent));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ================================================================
// PASSO 5: APLICAR WHITE-LABEL (CSS VARS + LOGO + NOME)
// ================================================================
function _aplicarWhiteLabel(data) {
    const set = (v, val) => { if (val) document.documentElement.style.setProperty(v, val); };

    // --- Cores do Tema ---
    const primaria   = data.tema_cor_primaria   || data.cor_primaria || '#E5B25D';
    const secundaria = data.tema_cor_secundaria  || '#1E90FF';
    const botao      = data.tema_cor_botao       || primaria;
    const bg         = data.tema_cor_bg          || '#0d0d0d';
    const surface    = data.tema_cor_surface      || '#1a1a1a';
    const borda      = data.tema_cor_borda        || _hexToRgba(primaria, 0.2);

    // Variáveis do sistema de temas
    set('--color-primary',        primaria);
    set('--color-primary-hover',  _darkenHex(primaria, 8));
    set('--color-secondary',      secundaria);
    set('--color-secondary-hover',_darkenHex(secundaria, 8));
    set('--color-primary-10',     _hexToRgba(primaria, 0.10));
    set('--color-primary-30',     _hexToRgba(primaria, 0.30));
    set('--color-bg',             bg);
    set('--color-surface',        surface);
    set('--color-surface-hover',  _darkenHex(surface, 3));
    set('--color-border',         borda);

    // Aliases legados (mantém compatibilidade)
    set('--primary',       primaria);
    set('--primary-hover', _darkenHex(primaria, 8));
    set('--bg-body',       bg);
    set('--bg-card',       surface);
    set('--border-color',  borda);

    // Aliases do atendente
    set('--accent-waiter', primaria);
    set('--bg-waiter',     bg);
    set('--card-waiter',   surface);

    // Variável de botão (pode ser diferente da primária)
    set('--color-button',        botao);
    set('--color-button-hover',  _darkenHex(botao, 8));

    // --- Logo ---
    if (data.logo_url) {
        const logos = document.querySelectorAll('.logo-main, #logoEmpresa');
        logos.forEach(el => {
            if (el.tagName === 'IMG') {
                el.src = data.logo_url;
                el.alt = data.nome || 'Logo';
            } else {
                el.style.backgroundImage = `url(${data.logo_url})`;
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';
            }
        });
    }

    // --- Nome da empresa ---
    if (data.nome) {
        const nomes = document.querySelectorAll('.brand-name, #brandName');
        nomes.forEach(el => { el.textContent = data.nome; });
        document.title = data.nome + ' | Sistema';
    }

    console.info('[Tenant] ✅ Tema aplicado:', primaria, '| Empresa:', data.nome);
}

// ================================================================
// PASSO 6: TELA DE ERRO — EMPRESA NÃO ENCONTRADA
// ================================================================
function _mostrarTelaNaoEncontrada(slug) {
    // Garante que o body seja exibido mesmo se estiver oculto
    document.body.style.display = 'flex';
    document.body.style.flexDirection = 'column';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.minHeight = '100vh';
    document.body.style.background = '#0d0d0d';
    document.body.style.color = '#fff';
    document.body.style.fontFamily = 'Inter, sans-serif';
    document.body.style.padding = '2rem';

    document.body.innerHTML = `
        <div style="text-align:center; max-width: 400px;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
            <h1 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff;">Loja não encontrada</h1>
            <p style="color: #999; font-size: 0.95rem; line-height: 1.6;">
                Não encontramos nenhuma loja associada ao endereço
                <code style="background:#1a1a1a; padding: 2px 8px; border-radius: 4px; color: #e5b25d;">${slug || window.location.hostname}</code>.
            </p>
            <p style="color: #666; font-size: 0.8rem; margin-top: 1.5rem;">
                Verifique o link ou entre em contato com o suporte.
            </p>
        </div>
    `;
}

// ================================================================
// PASSO 2 + 3: BUSCAR EMPRESA E ARMAZENAR GLOBALMENTE
// Função principal — chamada apenas 1x, resultado cacheado.
// ================================================================
async function initTenantPublico(supabaseClient) {
    // Cache: se já foi carregado, retorna imediatamente
    if (window.TENANT.pronto) return window.TENANT.empresa_id;

    // Evita múltiplas chamadas simultâneas ao banco
    if (_tenantPromise) return _tenantPromise;

    _tenantPromise = (async () => {
        // PASSO 1 — Resolver slug
        const slug = _resolverSlug();
        if (!slug) {
            _mostrarTelaNaoEncontrada(null);
            return null;
        }

        console.info('[Tenant] Buscando empresa para slug:', slug);

        // PASSO 2 — Buscar no Supabase
        // Tentamos primeiro com todas as colunas de tema. Se falhar (ex: colunas ainda não criadas),
        // tentamos uma busca simplificada para não quebrar o acesso à loja.
        let { data, error } = await supabaseClient
            .from('empresas')
            .select('id, nome, slug, cor_primaria, logo_url, status, modulos, tema_cor_primaria, tema_cor_secundaria, tema_cor_botao, tema_cor_bg, tema_cor_surface, tema_cor_borda')
            .eq('slug', slug)
            .eq('status', 'ativo')
            .single();

        if (error && error.code === 'PGRST204') { // Colunas faltando ou erro de estrutura
            console.warn('[Tenant] Erro ao buscar colunas de tema, tentando busca simplificada...');
            const retry = await supabaseClient
                .from('empresas')
                .select('id, nome, slug, cor_primaria, logo_url, status')
                .eq('slug', slug)
                .eq('status', 'ativo')
                .single();
            data = retry.data;
            error = retry.error;
        }

        // PASSO 6 — Tratar empresa não encontrada
        if (error || !data) {
            console.error('[Tenant] Erro fatal: Empresa não encontrada ou erro no banco:', slug, error?.message);
            _mostrarTelaNaoEncontrada(slug);
            return null;
        }

        // PASSO 3 — Armazenar globalmente (incluindo tema)
        window.TENANT.empresa_id       = data.id;
        window.TENANT.slug             = data.slug;
        window.TENANT.nome             = data.nome;
        window.TENANT.cor_primaria     = data.cor_primaria;
        window.TENANT.logo_url         = data.logo_url;
        window.TENANT.modulos          = data.modulos || {};
        window.TENANT.tema_cor_primaria   = data.tema_cor_primaria;
        window.TENANT.tema_cor_secundaria = data.tema_cor_secundaria;
        window.TENANT.tema_cor_botao      = data.tema_cor_botao;
        window.TENANT.tema_cor_bg         = data.tema_cor_bg;
        window.TENANT.tema_cor_surface    = data.tema_cor_surface;
        window.TENANT.tema_cor_borda      = data.tema_cor_borda;
        window.TENANT.pronto           = true;

        // Alias window.empresa para compatibilidade
        window.empresa = {
            id:           data.id,
            nome:         data.nome,
            cor_primaria: data.cor_primaria,
            logo_url:     data.logo_url,
        };

        // PASSO 5 — Aplicar white-label imediatamente
        _aplicarWhiteLabel(data);

        console.info('[Tenant] ✅ Empresa carregada:', data.nome, '|', data.id);
        return data.id;
    })();

    return _tenantPromise;
}

// ================================================================
// TENANT PARA O ADMIN (usa auth.uid() → tabela usuarios)
// ================================================================
async function initTenantAdmin(supabaseClient, userId) {
    // Cache: se já carregado pelo subdomínio, enriquece apenas
    if (window.TENANT.pronto) return window.TENANT.empresa_id;

    // Tentamos primeiro com o tema completo
    let { data, error } = await supabaseClient
        .from('usuarios')
        .select('empresa_id, role, email, empresas(id, nome, slug, cor_primaria, logo_url, status, modulos, tema_cor_primaria, tema_cor_secundaria, tema_cor_botao, tema_cor_bg, tema_cor_surface, tema_cor_borda)')
        .eq('id', userId)
        .single();

    if (error && error.code === 'PGRST204') {
        console.warn('[Tenant-Admin] Falha ao carregar colunas de tema, tentando busca básica...');
        const retry = await supabaseClient
            .from('usuarios')
            .select('empresa_id, role, email, empresas(id, nome, slug, cor_primaria, logo_url, status, modulos)')
            .eq('id', userId)
            .single();
        data = retry.data;
        error = retry.error;
    }

    if (error || !data) {
        console.warn('[Tenant-Admin] Usuário não encontrado em usuarios. Verificando Super Admin...');
        
        // Se não encontrou no usuarios, pode ser um Super Admin tentando acessar
        const { data: isSuper } = await supabaseClient.rpc('is_super_admin', { _user_id: userId });
        
        if (isSuper) {
            console.info('[Tenant-Admin] Super Admin detectado. Tentando carregar empresa via URL...');
            const slug = _resolverSlug();
            if (slug) {
                return await initTenantPublico(supabaseClient);
            }
        }
        
        console.error('[Tenant-Admin] Erro fatal ao buscar empresa do usuário:', userId, error?.message);
        return null;
    }

    const emp = data.empresas || {};

    // Bloquear acesso se a empresa estiver inativa
    if (emp.status === 'inativo') {
        console.warn('[Tenant] Empresa inativa. Acesso bloqueado.');
        return null;
    }

    // PASSO 3 — Armazenar globalmente (incluindo tema)
    window.TENANT.empresa_id         = data.empresa_id;
    window.TENANT.slug               = emp.slug   || null;
    window.TENANT.nome               = emp.nome   || null;
    window.TENANT.cor_primaria       = emp.cor_primaria || null;
    window.TENANT.logo_url           = emp.logo_url || null;
    window.TENANT.role               = data.role;
    window.TENANT.modulos             = emp.modulos || {};
    window.TENANT.tema_cor_primaria   = emp.tema_cor_primaria  || null;
    window.TENANT.tema_cor_secundaria = emp.tema_cor_secundaria || null;
    window.TENANT.tema_cor_botao      = emp.tema_cor_botao     || null;
    window.TENANT.tema_cor_bg         = emp.tema_cor_bg        || null;
    window.TENANT.tema_cor_surface    = emp.tema_cor_surface   || null;
    window.TENANT.tema_cor_borda      = emp.tema_cor_borda     || null;
    window.TENANT.pronto             = true;

    window.empresa = {
        id:           data.empresa_id,
        nome:         emp.nome,
        cor_primaria: emp.cor_primaria,
        logo_url:     emp.logo_url,
    };

    // PASSO 5 — White-label no admin também (com todos os dados de tema)
    _aplicarWhiteLabel({
        ...emp,
        tema_cor_primaria:   emp.tema_cor_primaria,
        tema_cor_secundaria: emp.tema_cor_secundaria,
        tema_cor_botao:      emp.tema_cor_botao,
        tema_cor_bg:         emp.tema_cor_bg,
        tema_cor_surface:    emp.tema_cor_surface,
        tema_cor_borda:      emp.tema_cor_borda,
    });

    console.info('[Tenant] ✅ Admin autenticado:', data.email, '| Empresa:', emp.nome);
    return data.empresa_id;
}

/**
 * Inicializa o tenant diretamente pelo ID da empresa.
 * Útil para o painel do atendente que usa um sistema de login customizado.
 */
async function initTenantById(supabaseClient, empresaId) {
    if (window.TENANT.pronto && window.TENANT.empresa_id === empresaId) return empresaId;

    const { data, error } = await supabaseClient
        .from('empresas')
        .select('id, nome, slug, cor_primaria, logo_url, status, modulos, tema_cor_primaria, tema_cor_secundaria, tema_cor_botao, tema_cor_bg, tema_cor_surface, tema_cor_borda')
        .eq('id', empresaId)
        .single();

    if (error || !data) {
        console.error('[Tenant] Erro ao carregar empresa por ID:', empresaId, error?.message);
        return null;
    }

    // PASSO 3 — Armazenar globalmente (incluindo tema)
    window.TENANT.empresa_id         = data.id;
    window.TENANT.slug               = data.slug;
    window.TENANT.nome               = data.nome;
    window.TENANT.cor_primaria       = data.cor_primaria;
    window.TENANT.logo_url           = data.logo_url;
    window.TENANT.modulos            = data.modulos || {};
    window.TENANT.tema_cor_primaria   = data.tema_cor_primaria;
    window.TENANT.tema_cor_secundaria = data.tema_cor_secundaria;
    window.TENANT.tema_cor_botao      = data.tema_cor_botao;
    window.TENANT.tema_cor_bg         = data.tema_cor_bg;
    window.TENANT.tema_cor_surface    = data.tema_cor_surface;
    window.TENANT.tema_cor_borda      = data.tema_cor_borda;
    window.TENANT.pronto             = true;

    _aplicarWhiteLabel(data);

    console.info('[Tenant] ✅ Empresa carregada por ID:', data.nome);
    return data.id;
}

// ================================================================
// PASSO 4 + 7: getTenantId() — RETORNA empresa_id CACHEADO
// Use em TODOS os INSERTs, UPDATEs e SELECTs do frontend.
// ================================================================
function getTenantId() {
    if (!window.TENANT.empresa_id) {
        throw new Error(
            '[Tenant] empresa_id não disponível.\n' +
            'Certifique-se de que initTenantPublico() ou initTenantAdmin() foi aguardado antes desta chamada.'
        );
    }
    return window.TENANT.empresa_id;
}

/**
 * Verifica se um determinado módulo está ativo para a empresa atual.
 * Ex: isModuloAtivo('estoque')
 */
function isModuloAtivo(modulo) {
    if (!window.TENANT || !window.TENANT.pronto) return false;
    
    const mods = window.TENANT.modulos || {};
    let status;
    
    if (mods[modulo] === undefined) {
        status = true; // backward compatibility
    } else {
        status = mods[modulo] === true;
    }
    
    console.log(`[Modules Check] ${modulo}: ${status}`);
    return status;
}
