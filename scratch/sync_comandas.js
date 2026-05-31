const url = 'https://ggjggdtcsdtlaynnwrku.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnamdnZHRjc2R0bGF5bm53cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzMyNTMsImV4cCI6MjA5MTE0OTI1M30.a6oSuzqBOTX08ORtCHebcCX3VSrxIaAlSTBPOCY-rv0';

async function run() {
    try {
        console.log("Fetching all comandas...");
        const comandasRes = await fetch(`${url}/comandas?select=*`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const comandas = await comandasRes.json();
        console.log(`Found ${comandas.length} comandas. Syncing totals...`);

        for (const c of comandas) {
            const ordersRes = await fetch(`${url}/orders?comanda_id=eq.${c.id}&select=total`, {
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            const orders = await ordersRes.json();
            const calculatedTotal = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
            
            console.log(`Comanda ${c.id}: DB Total = ${c.total_acumulado}, Calculated = ${calculatedTotal}`);
            
            if (parseFloat(c.total_acumulado || 0) !== calculatedTotal) {
                console.log(`-> Updating comanda ${c.id} total to ${calculatedTotal}...`);
                const updateRes = await fetch(`${url}/comandas?id=eq.${c.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': key,
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        total_acumulado: calculatedTotal
                    })
                });
                console.log(`Update status: ${updateRes.status}`);
            }
        }
        console.log("Sync complete!");
    } catch (e) {
        console.error(e);
    }
}
run();
