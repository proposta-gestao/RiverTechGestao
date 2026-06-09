/**
 * ============================================================
 * config.js — Configuração Central do Supabase (Auto-Detect)
 * ============================================================
 * Detecta automaticamente o ambiente (produção vs homologação)
 * com base no hostname da URL. Isso elimina a necessidade de
 * manter credenciais diferentes por branch.
 *
 * ✅ Este arquivo é IDÊNTICO nas branches main e homologacao.
 *    Pode ser mergeado livremente sem risco de sobrescrever
 *    credenciais.
 * ============================================================
 */

(function () {
    const hostname = window.location.hostname;

    // --- Credenciais por ambiente ---
    const PRODUCAO = {
        SUPABASE_URL:      'https://bpwwdnmhryblhsnywyoz.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg',
        ENV: 'production',
    };

    const HOMOLOGACAO = {
        SUPABASE_URL:      'https://ggjggdtcsdtlaynnwrku.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnamdnZHRjc2R0bGF5bm53cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzMyNTMsImV4cCI6MjA5MTE0OTI1M30.a6oSuzqBOTX08ORtCHebcCX3VSrxIaAlSTBPOCY-rv0',
        ENV: 'staging',
    };

    // --- Regra de detecção ---
    // Apenas o domínio exato de produção usa o banco de produção.
    // Qualquer outro hostname (localhost, previews, homologação) usa staging.
    const isProducao = hostname === 'gestaotech.vercel.app';

    const config = isProducao ? PRODUCAO : HOMOLOGACAO;

    // Expor globalmente
    window.APP_CONFIG = config;
    Object.freeze(window.APP_CONFIG);

    // Log visual no console para facilitar debug
    console.log(
        '%c[Config] Ambiente: ' + config.ENV.toUpperCase() + ' %c(' + hostname + ')',
        'color: ' + (isProducao ? '#22c55e' : '#f59e0b') + '; font-weight: bold;',
        'color: #888;'
    );
})();
