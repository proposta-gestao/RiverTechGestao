const url = 'https://ggjggdtcsdtlaynnwrku.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnamdnZHRjc2R0bGF5bm53cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzMyNTMsImV4cCI6MjA5MTE0OTI1M30.a6oSuzqBOTX08ORtCHebcCX3VSrxIaAlSTBPOCY-rv0';
const comandaId = 'd0aa38a6-99e3-48d4-8951-2d7f8055e384';

async function run() {
    try {
        console.log("Testing direct update...");
        const res = await fetch(`https://ggjggdtcsdtlaynnwrku.supabase.co/rest/v1/comandas?id=eq.${comandaId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                total_acumulado: 58.90
            })
        });
        console.log("Status:", res.status);
        console.log("Body:", await res.text());
    } catch (e) {
        console.error(e);
    }
}
run();
