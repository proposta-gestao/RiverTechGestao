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
      console.error('[MP-Checkout] Pedido não encontrado:', orderId, orderErr?.message)
      return new Response(JSON.stringify({ error: 'PEDIDO_NOT_FOUND: ' + orderId }), { 
        headers: corsHeaders 
      })
    }

    // 2. Buscar o token e configs DA EMPRESA
    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('mp_access_token, cartao_habilitado, cartao_parcelamento, nome, slug')
      .eq('id', order.empresa_id)
      .single()

    if (empErr || !empresa) {
      console.error('[MP-Checkout] Empresa não encontrada para pedido:', order.empresa_id, empErr?.message)
      return new Response(JSON.stringify({ error: 'EMPRESA_NOT_FOUND' }), { 
        headers: corsHeaders 
      })
    }

    if (!empresa.cartao_habilitado || !empresa.mp_access_token) {
      console.error('[MP-Checkout] Cartão não configurado/habilitado para empresa:', empresa.nome)
      return new Response(JSON.stringify({ error: 'CARTAO_NOT_CONFIGURED' }), { 
        headers: corsHeaders 
      })
    }

    const MP_ACCESS_TOKEN = empresa.mp_access_token;
    
    // Configurar o payload da Preferência do Mercado Pago
    // A URL de retorno deve ser dinâmica baseada na URL atual da loja
    // (Por segurança e simplicidade, vamos usar o site atual ou o slug da empresa)
    
    const reqUrl = new URL(req.url);
    // Para Edge Functions, não temos a origem exata do request às vezes,
    // então passamos a origem pelo header Origin do request ou montamos com a base.
    const originUrl = req.headers.get('origin') || `https://${reqUrl.host}`;
    const returnUrl = `${originUrl}/${empresa.slug}?order_confirmed=${order.id}`;

    const preferenceData: any = {
      items: [
        {
          title: `Pedido ${order.id.slice(0,8)} — ${empresa.nome}`,
          description: `Pagamento do pedido ${order.id}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Math.round(Number(order.total) * 100) / 100
        }
      ],
      payer: {
        name: order.customer_name,
      },
      back_urls: {
        success: returnUrl,
        pending: returnUrl,
        failure: returnUrl
      },
      auto_return: "approved",
      external_reference: order.id,
      payment_methods: {
        excluded_payment_types: [
          // Excluir formas de pagamento antigas/indesejadas, como ticket (boleto).
          // Para forçar que apenas cartão/PIX apareçam.
          // Aqui não excluímos nada inicialmente, permitindo que o Checkout Pro mostre tudo.
        ],
        installments: 12 // Padrão
      },
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`
    };

    // 3. REGRA DE PARCELAMENTO
    // Se o painel estiver configurado para bloquear parcelamento, forçamos 1x
    if (empresa.cartao_parcelamento === false) {
      preferenceData.payment_methods.installments = 1;
      console.log(`[MP-Checkout] Empresa ${empresa.nome} NÃO permite parcelamento. Limitando a 1x.`);
    } else {
      console.log(`[MP-Checkout] Empresa ${empresa.nome} permite parcelamento livre.`);
    }

    // 4. Criar Preferência na API do MP
    console.log(`[MP-Checkout] Criando preferência para o pedido ${order.id}...`);
    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceData)
    });

    const mpData = await mpResp.json()

    if (!mpResp.ok) {
      const detail = mpData.message || mpData.description || (mpData.cause && mpData.cause[0]?.description) || 'Erro s/ msg'
      console.error(`[MP-Checkout] Erro MP para empresa "${empresa.nome}":`, detail)
      return new Response(JSON.stringify({ error: `MP_ERROR: ${detail}` }), { headers: corsHeaders })
    }

    // 5. Salvar o preference_id no pedido (opcional mas bom para registro)
    await supabase.from('orders').update({
      mp_payment_id: `pref_${mpData.id}`
    }).eq('id', orderId);

    console.log(`[MP-Checkout] ✅ Preferência criada! Redirecionando cliente para: ${mpData.init_point}`);

    // Retorna a URL de redirecionamento para o frontend
    return new Response(JSON.stringify({
      url: mpData.init_point,
      sandbox_url: mpData.sandbox_init_point
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e) {
    console.error('[MP-Checkout] ERRO FATAL:', e.message)
    return new Response(JSON.stringify({ error: 'FATAL: ' + e.message }), { headers: corsHeaders })
  }
})
