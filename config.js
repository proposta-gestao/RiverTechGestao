/**
 * ============================================================
 * config.js — Configuração Central do Supabase
 * ============================================================
 * Este arquivo é o ÚNICO lugar onde as credenciais do Supabase
 * devem ser definidas. Todos os outros arquivos JS consomem
 * window.APP_CONFIG em vez de ter credenciais hardcoded.
 *
 * ⚠️  ATENÇÃO PARA AMBIENTES:
 *   - Branch `main`         → credenciais de PRODUÇÃO abaixo
 *   - Branch `homologacao`  → substituir pelos valores do Supabase de homologação
 * ============================================================
 */

window.APP_CONFIG = {
    // --- HOMOLOGAÇÃO (branch: homologacao) ---
    SUPABASE_URL:      'https://ggjggdtcsdtlaynnwrku.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnamdnZHRjc2R0bGF5bm53cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzMyNTMsImV4cCI6MjA5MTE0OTI1M30.a6oSuzqBOTX08ORtCHebcCX3VSrxIaAlSTBPOCY-rv0',

    // Ambiente atual (opcional — útil para logs de debug)
    ENV: 'staging',
};

// Congelar o objeto para evitar modificações acidentais em runtime
Object.freeze(window.APP_CONFIG);
