const url = 'https://ggjggdtcsdtlaynnwrku.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnamdnZHRjc2R0bGF5bm53cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzMyNTMsImV4cCI6MjA5MTE0OTI1M30.a6oSuzqBOTX08ORtCHebcCX3VSrxIaAlSTBPOCY-rv0';

async function run() {
    try {
        console.log("--- OPEN COMANDAS ---");
        const comandasRes = await fetch(`${url}/comandas?status=eq.aberta&select=*`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const comandas = await comandasRes.json();
        console.log(JSON.stringify(comandas, null, 2));

        for (const c of comandas) {
            console.log(`\n--- ORDERS FOR COMANDA ${c.id} (total_acumulado in DB: ${c.total_acumulado}) ---`);
            const ordersRes = await fetch(`${url}/orders?comanda_id=eq.${c.id}&select=id,total,cliente_premium_id,status,created_at`, {
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            const orders = await ordersRes.json();
            console.log(JSON.stringify(orders, null, 2));
            const calculatedTotal = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
            console.log(`Calculated sum of orders for this comanda: ${calculatedTotal}`);
        }
        
    } catch (e) {
        console.error(e);
    }
}
run();
