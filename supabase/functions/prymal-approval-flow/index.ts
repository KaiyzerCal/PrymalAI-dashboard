import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

async function getValidAccessToken(admin: ReturnType<typeof createClient>, clientId: string): Promise<string | null> {
  const { data: tokenRow } = await admin
    .from('prymal_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .single()

  if (!tokenRow) return null

  const expiresAt = new Date(tokenRow.expires_at).getTime()
  if (Date.now() < expiresAt - 5 * 60 * 1000) return tokenRow.access_token

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  if (!data.access_token) return null

  await admin.from('prymal_oauth_tokens').update({
    access_token: data.access_token,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  }).eq('client_id', clientId).eq('platform', 'google')

  return data.access_token
}

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

    const { approval_id, reply_text } = await req.json()
    if (!approval_id || reply_text === undefined)
      return new Response(JSON.stringify({ error: 'Missing approval_id or reply_text' }), { status: 400 })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get the approval item + verify it belongs to this user's client
    const { data: approval } = await admin
      .from('prymal_approval_queue')
      .select('*, prymal_clients!inner(user_id, gbp_account_id, gbp_location_id)')
      .eq('id', approval_id)
      .single()

    if (!approval) return new Response(JSON.stringify({ error: 'Approval not found' }), { status: 404 })
    if (approval.prymal_clients.user_id !== user.id)
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

    const trimmed = reply_text.trim()

    if (trimmed === 'REJECT') {
      await admin.from('prymal_approval_queue').update({ status: 'rejected' }).eq('id', approval_id)
      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const finalText = trimmed.startsWith('EDIT ')
      ? trimmed.slice(5).trim()
      : approval.draft_content

    // If this is a Google review response, post to GBP
    if (approval.agent === 'google' && approval.action_type === 'review_response' && approval.reference_id) {
      const { data: reviewRow } = await admin
        .from('prymal_gmb_reviews')
        .select('gbp_review_id, gbp_account_id, gbp_location_id')
        .eq('id', approval.reference_id)
        .single()

      if (reviewRow) {
        const clientId = approval.client_id
        const accessToken = await getValidAccessToken(admin, clientId)

        if (accessToken) {
          const replyUrl = `https://mybusiness.googleapis.com/v4/${reviewRow.gbp_account_id}/${reviewRow.gbp_location_id}/reviews/${reviewRow.gbp_review_id}/reply`
          const replyRes = await fetch(replyUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ comment: finalText }),
          })

          if (replyRes.ok) {
            await admin
              .from('prymal_gmb_reviews')
              .update({ response_status: 'responded' })
              .eq('id', approval.reference_id)
          }
        }
      }
    }

    await admin
      .from('prymal_approval_queue')
      .update({ status: 'approved', approved_content: finalText })
      .eq('id', approval_id)

    return new Response(
      JSON.stringify({ success: true, action: 'approved', posted_text: finalText }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
