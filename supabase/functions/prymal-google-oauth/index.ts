import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

async function discoverLocation(accessToken: string): Promise<{ accountName: string; locationName: string; locationTitle: string } | null> {
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const accountsData = await accountsRes.json()
  const account = accountsData.accounts?.[0]
  if (!account) return null

  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const locationsData = await locationsRes.json()
  const location = locationsData.locations?.[0]
  if (!location) return null

  return { accountName: account.name, locationName: location.name, locationTitle: location.title ?? account.name }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: clientRow } = await admin
      .from('prymal_clients')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!clientRow) return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 })

    const body = await req.json()
    const { action, code, redirect_uri, platform = 'google' } = body
    const oauthPlatform = platform === 'gbp' ? 'google' : platform

    // ── Re-discover location using stored refresh token ──
    if (action === 'rediscover') {
      const { data: tokenRow } = await admin
        .from('prymal_oauth_tokens')
        .select('refresh_token')
        .eq('client_id', clientRow.id)
        .eq('platform', 'google')
        .single()

      if (!tokenRow?.refresh_token) {
        return new Response(JSON.stringify({ error: 'No stored refresh token — please reconnect Google.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      const accessToken = await refreshAccessToken(tokenRow.refresh_token)
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Failed to refresh access token.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      const found = await discoverLocation(accessToken)
      if (!found) {
        return new Response(JSON.stringify({ error: 'GBP API returned no locations — quota may still be 0. Enter IDs manually.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      await admin.from('prymal_clients').update({
        gbp_account_id: found.accountName,
        gbp_location_id: found.locationName,
      }).eq('id', clientRow.id)

      await admin.from('prymal_social_accounts').upsert({
        client_id: clientRow.id,
        platform: 'google',
        handle: found.locationTitle,
        connected: true,
      }, { onConflict: 'client_id,platform' })

      return new Response(JSON.stringify({
        success: true,
        account_id: found.accountName,
        location_id: found.locationName,
        location_title: found.locationTitle,
      }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // ── Initial OAuth code exchange ──
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), { status: 400 })
    }

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
    if (!tokens.access_token) {
      return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokens }), { status: 400 })
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    // Store tokens with the correct platform name
    await admin.from('prymal_oauth_tokens').upsert({
      client_id: clientRow.id,
      platform: oauthPlatform,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    }, { onConflict: 'client_id,platform' })

    // Non-GBP platforms (gmail, calendar, drive) — done after storing tokens
    if (oauthPlatform !== 'google') {
      return new Response(JSON.stringify({
        success: true,
        tokens_stored: true,
        platform: oauthPlatform,
      }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // GBP — try to discover location (may fail if GBP API quota=0)
    const found = await discoverLocation(tokens.access_token).catch(() => null)

    if (found) {
      await admin.from('prymal_clients').update({
        gbp_account_id: found.accountName,
        gbp_location_id: found.locationName,
      }).eq('id', clientRow.id)

      await admin.from('prymal_social_accounts').upsert({
        client_id: clientRow.id,
        platform: 'google',
        handle: found.locationTitle,
        connected: true,
      }, { onConflict: 'client_id,platform' })

      return new Response(JSON.stringify({
        success: true,
        tokens_stored: true,
        account_id: found.accountName,
        location_id: found.locationName,
        location_title: found.locationTitle,
      }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    } else {
      // Tokens stored but location not found — mark as partially connected
      await admin.from('prymal_social_accounts').upsert({
        client_id: clientRow.id,
        platform: 'google',
        handle: null,
        connected: true,
      }, { onConflict: 'client_id,platform' })

      return new Response(JSON.stringify({
        success: true,
        tokens_stored: true,
        location: null,
        message: 'OAuth authorized but GBP location not found — quota may be 0. Use Settings to enter IDs manually.',
      }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
