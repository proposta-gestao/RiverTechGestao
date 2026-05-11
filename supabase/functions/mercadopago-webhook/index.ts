import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const url = new URL(req.url)
    console.log(`[Webhook] Nova requisição: ${req.method} ${url.pathname}${url.search}`)

    let paymentId: string | null = null
    let topic: string | null = null

    const contentType = req.headers.get('content-type') || ''
    
    if (req.method === 'POST') {
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}))
        console.log('[Webhook] Body JSON recebido:', JSON.stringify(body))
        
        topic = body.type || body.topic || url.searchParams.get('topic') || url.searchParams.get('type') || body.action
        paymentId = body.data?.id || body.id || url.searchParams.get('id') || url.searchParams.get('data.id')
      } else {
        const text = await req.text().catch(() => '')
        console.log('[Webhook] Body Text recebido:', text)
        topic = url.searchParams.get('topic') || url.searchParams.get('type')
        paymentId = url.searchParams.get('id') || url.searchParams.get('data.id')
      }
    } else {
      topic = url.searchParams.get('topic') || url.searchParams.get('type')
      paymentId = url.searchParams.get('id') || url.searchParams.get('data.id')
    }

    console.log(`[Webhook] Resolvido -> Topic/Type: ${topic}, PaymentId: ${paymentId}`)

    if (!paymentId) {
      console.log('[Webhook] Ignorado: Nenhum ID de pagamento encontrado.')
      return new Response('Ignored', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // ============================================================
    // MULTI-TENANT: Descobrir de qual empresa é o pagamento
    // ============================================================

    // 1. Precisamos descobrir qual empresa para usar o token correto.
    //    Mas ainda não temos o external_reference (orderId) — precisamos
    //    buscar os detalhes do pagamento primeiro.
    //
    //    ESTRATÉGIA: Tentar buscar o pedido por mp_payment_id no banco.
    //    Se encontrar, já temos o empresa_id. Se não, fazemos fallback.

    // Primeiro, tentar encontrar o pedido pelo payment ID no nosso banco
    const { data: orderByPayment } = await supabase
      .from('orders')
      .select('id, empresa_id')
      .eq('mp_payment_id', String(paymentId))
      .maybeSingle()

    let mpAccessToken: string | null = null
    let orderId: string | null = null

    if (orderByPayment) {
      // Encontramos o pedido — buscar token da empresa
      orderId = orderByPayment.id
      const { data: empresa } = await supabase
        .from('empresas')
        .select('mp_access_token, nome')
        .eq('id', orderByPayment.empresa_id)
        .single()

      if (empresa?.mp_access_token) {
        mpAccessToken = empresa.mp_access_token
        console.log(`[Webhook] Empresa identificada: "${empresa.nome}" via mp_payment_id`)
      }
    }

    // Fallback: Se não encontrou por mp_payment_id, tentar com todas as empresas
    // que têm token configurado (cenário raro, mas possível se o payment_id
    // no banco ainda não foi salvo)
    if (!mpAccessToken) {
      console.log('[Webhook] Pedido não encontrado por mp_payment_id. Tentando busca por empresas...')
      
      const { data: empresasComPix } = await supabase
        .from('empresas')
        .select('id, mp_access_token, nome')
        .eq('pix_habilitado', true)
        .not('mp_access_token', 'is', null)

      if (!empresasComPix || empresasComPix.length === 0) {
        console.error('[Webhook] Nenhuma empresa com PIX configurado encontrada.')
        return new Response('OK', { status: 200 })
      }

      // Tentar validar com cada empresa até encontrar a certa
      for (const emp of empresasComPix) {
        try {
          const testResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${emp.mp_access_token}` }
          })
          
          if (testResp.ok) {
            const testData = await testResp.json()
            mpAccessToken = emp.mp_access_token
            orderId = testData.external_reference
            console.log(`[Webhook] Empresa identificada por fallback: "${emp.nome}"`)
            
            // Processar diretamente aqui para evitar outra chamada
            if (testData.status === 'approved' && orderId) {
              console.log(`[Webhook] Pagamento aprovado! Atualizando pedido ${orderId}...`)
              
              const { error, data } = await supabase
                .from('orders')
                .update({ payment_status: 'pago' })
                .eq('id', orderId)
                .select()

              if (error) {
                console.error('[Webhook] ERRO ao atualizar pedido:', error)
              } else if (data && data.length === 0) {
                console.warn(`[Webhook] AVISO: Nenhum pedido atualizado. ID ${orderId} pode não existir.`)
              } else {
                console.log(`[Webhook] SUCESSO! Pedido ${orderId} atualizado.`)
              }
            } else {
              console.log(`[Webhook] Pagamento não aprovado (Status: ${testData.status}).`)
            }

            return new Response('OK', { status: 200 })
          }
        } catch (e) {
          // Token inválido para este pagamento, tentar próxima empresa
          continue
        }
      }

      if (!mpAccessToken) {
        console.error('[Webhook] Não foi possível identificar a empresa deste pagamento.')
        return new Response('OK', { status: 200 })
      }
    }

    // ============================================================
    // Fluxo principal (empresa já identificada via mp_payment_id)
    // ============================================================

    console.log(`[Webhook] Buscando detalhes do pagamento ${paymentId} na API do Mercado Pago...`)
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    })
    const mpData = await response.json()
    
    console.log(`[Webhook] Dados do pagamento MP: Status=${mpData.status}, Ref=${mpData.external_reference}`)

    if (mpData.status === 'approved') {
      const finalOrderId = mpData.external_reference || orderId

      if (!finalOrderId) {
        console.error(`[Webhook] ERRO: external_reference não definido no pagamento ${paymentId}`)
        return new Response('OK', { status: 200 })
      }

      console.log(`[Webhook] Pagamento aprovado! Atualizando pedido ${finalOrderId} no Supabase...`)

      const { error, data } = await supabase
        .from('orders')
        .update({
          payment_status: 'pago'
        })
        .eq('id', finalOrderId)
        .select()

      if (error) {
        console.error('[Webhook] ERRO ao atualizar pedido no Supabase:', error)
      } else if (data && data.length === 0) {
        console.warn(`[Webhook] AVISO: Nenhum pedido atualizado. Talvez o ID ${finalOrderId} não exista.`)
      } else {
        console.log(`[Webhook] SUCESSO! Pedido ${finalOrderId} atualizado no banco.`)
      }
    } else {
      console.log(`[Webhook] Pagamento não aprovado (Status atual: ${mpData.status}). Nenhuma ação necessária.`)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[Webhook] ERRO FATAL:', error)
    return new Response('Error', { status: 500 })
  }
})
