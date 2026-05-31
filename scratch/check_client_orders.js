const url = 'https://ggjggdtcsdtlaynnwrku.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnamdnZHRjc2R0bGF5bm53cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzMyNTMsImV4cCI6MjA5MTE0OTI1M30.a6oSuzqBOTX08ORtCHebcCX3VSrxIaAlSTBPOCY-rv0';
const clientPremiumId = 'c3835c47-bdbd-457b-9d82-00bea166e137';

async function run() {
    try {
        console.log(`--- ORDERS FOR CLIENT ${clientPremiumId} ---`);
        const ordersRes = await fetch(`${url}/orders?cliente_premium_id=eq.${clientPremiumId}&select=*`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const orders = await ordersRes.json();
        console.log(JSON.stringify(orders, null, 2));

        const sum = orders.reduce((acc, curr) => acc + parseFloat(curr.total || 0), 0);
        console.log(`Total sum of orders for this client: ${sum}`);
    } catch (e) {
        console.error(e);
    }
}
run();
