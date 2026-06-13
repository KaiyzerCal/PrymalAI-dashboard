import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { code, redirect_uri } = await req.json()
    if (!code || !redirect_uri)
      return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), { status: 400 })

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token)
      return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokens }), { status: 400 })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: client } = await admin
      .from('prymal_clients')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!client) return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 })

    // Fetch GBP accounts
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const accountsData = await accountsRes.json()
    const account = accountsData.accounts?.[0]
    if (!account)
      return new Response(JSON.stringify({ error: 'No GBP accounts found' }), { status: 400 })

    // Fetch locations
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const locationsData = await locationsRes.json()
    const location = locationsData.locations?.[0]
    if (!location)
      return new Response(JSON.stringify({ error: 'No GBP locations found' }), { status: 400 })

    // Store tokens
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()
    await admin.from('prymal_oauth_tokens').upsert(
      {
        client_id: client.id,
        platform: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      },
      { onConflict: 'client_id,platform' }
    )

    // Update client with GBP IDs
    await admin
      .from('prymal_clients')
      .update({ gbp_account_id: account.name, gbp_location_id: location.name })
      .eq('id', client.id)

    // Upsert social account record
    await admin.from('prymal_social_accounts').upsert(
      {
        client_id: client.id,
        platform: 'google',
        handle: location.title ?? account.name,
        connected: true,
      },
      { onConflict: 'client_id,platform' }
    )

    return new Response(
      JSON.stringify({
        success: true,
        account: account.name,
        location: location.name,
        location_title: location.title,
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
