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
    const hostname = window.location.hostname; // ex: cliente1.meusistema.com

    // Ambiente local: usar slug fixo ou querystring
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
    if (isLocal) {
    // 1. Tentar pegar da Rota (Pathname) - Ex: meudominio.com/slug
    const pathSegments = window.location.pathname.split('/').filter(p => p);
    // Ignora admin.html, index.html ou admin-saas.html
    if (pathSegments.length > 0 && !pathSegments[0].includes('.html')) {
        return pathSegments[0];
    }

    // 2. Tentar da Querystring - Ex: ?loja=slug (Ótimo para testes locais)
    const paramSlug = new URLSearchParams(window.location.search).get('loja');
    if (paramSlug) return paramSlug;

    // 3. Tentar Subdomínio - Ex: slug.meudominio.com
    const partes = hostname.split('.');
    if (partes.length >= 3 && hostname !== '127.0.0.1') {
        return partes[0];
    }

    // Fallback para dev local
    if (isLocal) {
        console.warn('[Tenant] Ambiente local — usando slug de desenvolvimento: "teste"');
        return 'teste';
    }

    console.error('[Tenant] Não foi possível determinar o slug a partir de:', hostname, window.location.pathname);
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
    pronto: false,
};

// window.empresa — alias para compatibilidade com código legado
window.empresa = null;

// Promise de inicialização (evita múltiplas chamadas ao banco)
let _tenantPromise = null;

// ================================================================
// PASSO 5: APLICAR WHITE-LABEL (CSS VARS + LOGO + NOME)
// ================================================================
function _aplicarWhiteLabel(data) {
    // Cor primária via CSS custom property
    if (data.cor_primaria) {
        document.documentElement.style.setProperty('--primary', data.cor_primaria);
        document.documentElement.style.setProperty('--primary-color', data.cor_primaria);
        // Gera variantes de opacidade automaticamente
        document.documentElement.style.setProperty('--primary-10', data.cor_primaria + '1A');
        document.documentElement.style.setProperty('--primary-30', data.cor_primaria + '4D');
    }

    // Logo: aplica em elementos com class "logo-main" ou id "logoEmpresa"
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

    // Nome da empresa: aplica em elementos com class "brand-name"
    if (data.nome) {
        const nomes = document.querySelectorAll('.brand-name, #brandName');
        nomes.forEach(el => { el.textContent = data.nome; });
        document.title = data.nome + ' | Sistema';
    }

    console.info('[Tenant] White-label aplicado:', data.nome, data.cor_primaria);
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
        const { data, error } = await supabaseClient
            .from('empresas')
            .select('id, nome, slug, cor_primaria, logo_url, status')
            .eq('slug', slug)
            .eq('status', 'ativo')
            .single();

        // PASSO 6 — Tratar empresa não encontrada
        if (error || !data) {
            console.error('[Tenant] Empresa não encontrada:', slug, error?.message);
            _mostrarTelaNaoEncontrada(slug);
            return null;
        }

        // PASSO 3 — Armazenar globalmente
        window.TENANT.empresa_id  = data.id;
        window.TENANT.slug        = data.slug;
        window.TENANT.nome        = data.nome;
        window.TENANT.cor_primaria = data.cor_primaria;
        window.TENANT.logo_url    = data.logo_url;
        window.TENANT.pronto      = true;

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

    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('empresa_id, role, email, empresas(id, nome, slug, cor_primaria, logo_url, status)')
        .eq('id', userId)
        .single();

    if (error || !data) {
        console.error('[Tenant] Usuário sem empresa vinculada:', userId, error?.message);
        return null;
    }

    const emp = data.empresas || {};

    // Bloquear acesso se a empresa estiver inativa
    if (emp.status === 'inativo') {
        console.warn('[Tenant] Empresa inativa. Acesso bloqueado.');
        return null;
    }

    // PASSO 3 — Armazenar globalmente
    window.TENANT.empresa_id   = data.empresa_id;
    window.TENANT.slug         = emp.slug   || null;
    window.TENANT.nome         = emp.nome   || null;
    window.TENANT.cor_primaria = emp.cor_primaria || null;
    window.TENANT.logo_url     = emp.logo_url || null;
    window.TENANT.role         = data.role;
    window.TENANT.pronto       = true;

    window.empresa = {
        id:           data.empresa_id,
        nome:         emp.nome,
        cor_primaria: emp.cor_primaria,
        logo_url:     emp.logo_url,
    };

    // PASSO 5 — White-label no admin também
    if (emp.nome || emp.cor_primaria || emp.logo_url) {
        _aplicarWhiteLabel(emp);
    }

    console.info('[Tenant] ✅ Admin autenticado:', data.email, '| Empresa:', emp.nome);
    return data.empresa_id;
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
