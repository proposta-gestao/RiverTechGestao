import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'MISSING_ORDER_ID' }), { 
        status: 400, headers: corsHeaders 
      })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Buscar o pedido
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      console.error('[PIX] Pedido não encontrado:', orderId, orderErr?.message)
      return new Response(JSON.stringify({ error: 'PEDIDO_NOT_FOUND: ' + orderId }), { 
        headers: corsHeaders 
      })
    }

    // 2. Buscar o token do Mercado Pago DA EMPRESA (isolamento multi-tenant)
    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('mp_access_token, pix_habilitado, nome')
      .eq('id', order.empresa_id)
      .single()

    if (empErr || !empresa) {
      console.error('[PIX] Empresa não encontrada para pedido:', order.empresa_id, empErr?.message)
      return new Response(JSON.stringify({ error: 'EMPRESA_NOT_FOUND' }), { 
        headers: corsHeaders 
      })
    }

    // 3. Validar que o PIX está habilitado e o token existe
    if (!empresa.pix_habilitado) {
      console.warn('[PIX] PIX desabilitado para empresa:', empresa.nome)
      return new Response(JSON.stringify({ error: 'PIX_DISABLED: PIX não está habilitado para esta empresa.' }), { 
        headers: corsHeaders 
      })
    }

    if (!empresa.mp_access_token) {
      console.error('[PIX] Token do Mercado Pago não configurado para empresa:', empresa.nome)
      return new Response(JSON.stringify({ error: 'PIX_NOT_CONFIGURED: Token do Mercado Pago não cadastrado para esta empresa.' }), { 
        headers: corsHeaders 
      })
    }

    const MP_ACCESS_TOKEN = empresa.mp_access_token
    console.log(`[PIX] Gerando cobrança para empresa "${empresa.nome}" | Pedido: ${orderId}`)

    // 4. Criar pagamento PIX na API do Mercado Pago (usando token da empresa)
    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 
        'Content-Type': 'application/json',
        'X-Idempotency-Key': order.id // Evita pagamentos duplicados
      },
      body: JSON.stringify({
        transaction_amount: Math.round(Number(order.total) * 100) / 100,
        description: `Pedido ${order.id.slice(0,8)} — ${empresa.nome}`,
        payment_method_id: 'pix',
        payer: { 
          email: 'cliente@exemplo.com', 
          first_name: order.customer_name.split(' ')[0], 
          last_name: order.customer_name.split(' ').slice(1).join(' ') || 'Cliente'
        },
        external_reference: order.id,
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`
      })
    })

    const mpData = await mpResp.json()

    if (!mpResp.ok) {
      const detail = mpData.message || mpData.description || (mpData.cause && mpData.cause[0]?.description) || 'Erro s/ msg'
      console.error(`[PIX] Erro Mercado Pago para empresa "${empresa.nome}":`, detail)
      return new Response(JSON.stringify({ error: `MP_ERROR: ${detail}` }), { headers: corsHeaders })
    }

    const pixData = mpData.point_of_interaction.transaction_data;
    
    // 5. Salvar dados do PIX no pedido
    const responseData = {
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      payment_id: mpData.id
    };

    await supabase.from('orders').update({
      mp_payment_id: String(mpData.id),
      pix_qr_code: pixData.qr_code,
      pix_qr_code_base64: pixData.qr_code_base64
    }).eq('id', orderId);

    console.log(`[PIX] ✅ QR Code gerado para empresa "${empresa.nome}" | Payment ID: ${mpData.id}`)

    return new Response(JSON.stringify(responseData), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e) {
    console.error('[PIX] ERRO FATAL:', e.message)
    return new Response(JSON.stringify({ error: 'FATAL: ' + e.message }), { headers: corsHeaders })
  }
})
