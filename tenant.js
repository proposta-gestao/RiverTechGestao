/**
 * tenant.js — Contexto Multi-Tenant
 * Responsável por resolver e expor o empresa_id da sessão atual.
 *
 * Para o cardápio público (index.html):
 *   A URL deve conter o slug: ex. /index.html?loja=minha-loja
 *   O empresa_id é buscado na tabela `empresas` via slug.
 *
 * Para o admin (admin.html):
 *   O empresa_id é buscado na tabela `usuarios` via auth.uid()
 *   após login bem-sucedido.
 */

// =============================================
// CONTEXTO DO TENANT (compartilhado globalmente)
// =============================================
window.TENANT = {
    empresa_id: null,
    slug: null,
    nome: null,
    pronto: false,
};

/**
 * Inicializa o tenant para páginas PÚBLICAS (cardápio).
 * Lê o slug da URL e busca o empresa_id no banco.
 * @param {object} supabaseClient - instância do sb já criada
 * @returns {Promise<string|null>} empresa_id ou null se não encontrado
 */
async function initTenantPublico(supabaseClient) {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('loja');

    if (!slug) {
        console.warn('[Tenant] Nenhum slug encontrado na URL (?loja=slug). Cardápio sem empresa definida.');
        return null;
    }

    const { data, error } = await supabaseClient
        .from('empresas')
        .select('id, nome, slug, cor_primaria, logo_url, status')
        .eq('slug', slug)
        .eq('status', 'ativo')
        .single();

    if (error || !data) {
        console.error('[Tenant] Empresa não encontrada para slug:', slug, error);
        return null;
    }

    window.TENANT.empresa_id = data.id;
    window.TENANT.slug = data.slug;
    window.TENANT.nome = data.nome;
    window.TENANT.pronto = true;

    console.info('[Tenant] Empresa carregada:', data.nome, '|', data.id);
    return data.id;
}

/**
 * Inicializa o tenant para o ADMIN.
 * Usa auth.uid() para buscar empresa_id na tabela `usuarios`.
 * @param {object} supabaseClient - instância do sb já criada
 * @param {string} userId - auth.uid() do usuário logado
 * @returns {Promise<string|null>} empresa_id ou null se não encontrado
 */
async function initTenantAdmin(supabaseClient, userId) {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('empresa_id, role, email, empresas(nome, slug)')
        .eq('id', userId)
        .single();

    if (error || !data) {
        console.error('[Tenant] Usuário sem empresa vinculada:', userId, error);
        return null;
    }

    window.TENANT.empresa_id = data.empresa_id;
    window.TENANT.slug = data.empresas?.slug || null;
    window.TENANT.nome = data.empresas?.nome || null;
    window.TENANT.role = data.role;
    window.TENANT.pronto = true;

    console.info('[Tenant] Admin autenticado:', data.email, '| Empresa:', data.empresas?.nome);
    return data.empresa_id;
}

/**
 * Retorna o empresa_id atual. Lança erro se não estiver pronto.
 * Use em qualquer INSERT/UPDATE para garantir o isolamento.
 * @returns {string} empresa_id UUID
 */
function getTenantId() {
    if (!window.TENANT.empresa_id) {
        throw new Error('[Tenant] empresa_id não disponível. initTenant* não foi chamado.');
    }
    return window.TENANT.empresa_id;
}
