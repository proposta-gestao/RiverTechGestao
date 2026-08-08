import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, empresaId, redirectUri } = await req.json();

    if (!code || !empresaId || !redirectUri) {
      throw new Error('Missing code, empresaId, or redirectUri');
    }

    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Missing MP credentials in Edge Function environment');
    }

    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Mercado Pago OAuth Error:', tokenData);
      throw new Error(tokenData.message || 'Failed to exchange token');
    }

    // Fetch user details to get the account name
    let mpAccountName = 'Conta Mercado Pago';
    try {
      const userResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.first_name) {
          mpAccountName = `${userData.first_name} ${userData.last_name || ''}`.trim();
        } else if (userData.nickname) {
          mpAccountName = userData.nickname;
        }
      }
    } catch (e) {
      console.error('Error fetching user info:', e);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save the tokens in the empresas table
    const { error: dbError } = await supabase
      .from('empresas')
      .update({
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token,
        mp_oauth_connected_at: new Date().toISOString(),
        mp_account_name: mpAccountName
      })
      .eq('id', empresaId);

    if (dbError) {
      console.error('Database Error:', dbError);
      throw new Error('Failed to save tokens in database');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conta conectada com sucesso',
        user_id: tokenData.user_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in mercadopago-oauth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
