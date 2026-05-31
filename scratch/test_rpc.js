const url = 'https://ggjggdtcsdtlaynnwrku.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnamdnZHRjc2R0bGF5bm53cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzMyNTMsImV4cCI6MjA5MTE0OTI1M30.a6oSuzqBOTX08ORtCHebcCX3VSrxIaAlSTBPOCY-rv0';
const comandaId = 'd0aa38a6-99e3-48d4-8951-2d7f8055e384';

async function run() {
    try {
        console.log("Testing RPC call...");
        const res = await fetch(`https://ggjggdtcsdtlaynnwrku.supabase.co/rest/v1/rpc/incrementar_total_comanda`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                _comanda_id: comandaId,
                _valor: 10
            })
        });
        console.log("Status:", res.status);
        console.log("Body:", await res.text());
    } catch (e) {
        console.error(e);
    }
}
run();
