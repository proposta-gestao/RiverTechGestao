import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token } = await req.json()

    if (!token) {
      return new Response(JSON.stringify({ error: 'TOKEN_REQUIRED' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Chama a API do Mercado Pago server-side (sem CORS)
    const resp = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    const data = await resp.json()

    if (resp.ok && data.id) {
      return new Response(JSON.stringify({
        success: true,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        id: data.id,
        country_id: data.country_id || 'BR'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: data.message || data.error || 'Token inválido ou expirado.'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
