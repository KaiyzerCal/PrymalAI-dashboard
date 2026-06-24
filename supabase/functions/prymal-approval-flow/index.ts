import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

async function getValidAccessToken(
  admin: ReturnType<typeof createClient>,
  clientId: string,
  platform: string
): Promise<string | null> {
  const { data } = await admin
    .from('prymal_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .single()

  if (!data) return null

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (Date.now() < expiresAt - 5 * 60 * 1000) return data.access_token
  if (!data.refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  })
  const tokens = await res.json()
  if (!tokens.access_token) return null

  await admin.from('prymal_oauth_tokens').update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
  }).eq('client_id', clientId).eq('platform', platform)

  return tokens.access_token
}

// Build a RFC 2822 / base64url encoded Gmail message
function buildGmailRaw(opts: { to: string; subject: string; body: string; from?: string; replyTo?: string }): string {
  const msgId = `<${Date.now()}.prymal@mail.gmail.com>`
  const date = new Date().toUTCString()
  const lines = [
    `To: ${opts.to}`,
    opts.from ? `From: ${opts.from}` : '',
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : '',
    `Subject: ${opts.subject}`,
    `Date: ${date}`,
    `Message-ID: ${msgId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    opts.body,
  ].filter(Boolean).join('\r\n')
  return btoa(unescape(encodeURIComponent(lines)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const body = await req.json()
    const approval_id = body.approval_id ?? body.item_id
    const reply_text = body.reply_text
    if (!approval_id || reply_text === undefined)
      return new Response(JSON.stringify({ error: 'Missing approval_id or reply_text' }), { status: 400, headers: CORS })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch approval row, verify ownership
    const { data: approval } = await admin
      .from('prymal_approval_queue')
      .select('*, prymal_clients!inner(user_id, gbp_account_id, gbp_location_id)')
      .eq('id', approval_id)
      .single()

    if (!approval) return new Response(JSON.stringify({ error: 'Approval not found' }), { status: 404, headers: CORS })
    if (approval.prymal_clients.user_id !== user.id)
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })

    const trimmed = reply_text.trim()

    // ── Reject ────────────────────────────────────────────────────────────────
    if (trimmed === 'REJECT') {
      await admin.from('prymal_approval_queue').update({ status: 'rejected' }).eq('id', approval_id)
      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Final content — either user-edited or original draft
    const finalText = trimmed.startsWith('EDIT ') ? trimmed.slice(5).trim() : approval.draft_content
    const meta = approval.metadata ?? {}
    const clientId = approval.client_id
    let executionResult: Record<string, unknown> = {}

    // ── Execute based on action_type ─────────────────────────────────────────
    const actionType = approval.action_type as string

    // GBP review response
    if (actionType === 'respond_to_review' || actionType === 'review_response') {
      const accessToken = await getValidAccessToken(admin, clientId, 'google')
      if (accessToken) {
        // Try reference_id first, then metadata
        let reviewRow: { gbp_review_id: string; gbp_account_id: string; gbp_location_id: string } | null = null
        if (approval.reference_id) {
          const { data } = await admin
            .from('prymal_gmb_reviews')
            .select('gbp_review_id, gbp_account_id, gbp_location_id')
            .eq('id', approval.reference_id)
            .single()
          reviewRow = data
        } else if (meta.review_id) {
          const { data } = await admin
            .from('prymal_gmb_reviews')
            .select('gbp_review_id, gbp_account_id, gbp_location_id')
            .eq('id', meta.review_id)
            .single()
          reviewRow = data
        }

        if (reviewRow) {
          const replyUrl = `https://mybusiness.googleapis.com/v4/${reviewRow.gbp_account_id}/${reviewRow.gbp_location_id}/reviews/${reviewRow.gbp_review_id}/reply`
          const replyRes = await fetch(replyUrl, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment: finalText }),
          })
          if (replyRes.ok) {
            await admin.from('prymal_gmb_reviews').update({ response_status: 'responded', response_text: finalText })
              .eq('id', reviewRow.gbp_review_id)
            executionResult = { posted: true, platform: 'gbp' }
          } else {
            executionResult = { posted: false, error: await replyRes.text() }
          }
        }
      }
    }

    // Gmail send
    else if (actionType === 'send_email') {
      const accessToken = await getValidAccessToken(admin, clientId, 'gmail')
      const recipient = (meta.to ?? meta.recipient ?? meta.recipient_email ?? '') as string
      if (accessToken && recipient) {
        const raw = buildGmailRaw({
          to: recipient,
          subject: (meta.subject as string) ?? '(no subject)',
          body: finalText,
        })
        const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        })
        const sendData = await sendRes.json()
        if (sendRes.ok) {
          executionResult = { sent: true, message_id: sendData.id }
        } else {
          executionResult = { sent: false, error: sendData.error?.message ?? JSON.stringify(sendData) }
        }
      } else if (!accessToken) {
        executionResult = { sent: false, error: 'Gmail not connected or token expired.' }
      } else {
        executionResult = { sent: false, error: `Missing recipient email in metadata. Got keys: ${Object.keys(meta).join(', ')}` }
      }
    }

    // Google Calendar event
    else if (actionType === 'create_event' || actionType === 'schedule_event') {
      const accessToken = await getValidAccessToken(admin, clientId, 'calendar')
      if (accessToken) {
        const event: Record<string, unknown> = {
          summary: (meta.title as string) ?? finalText.split('\n')[0],
          description: finalText,
          start: meta.start
            ? { dateTime: meta.start, timeZone: (meta.timezone as string) ?? 'UTC' }
            : { date: new Date().toISOString().split('T')[0] },
          end: meta.end
            ? { dateTime: meta.end, timeZone: (meta.timezone as string) ?? 'UTC' }
            : { date: new Date().toISOString().split('T')[0] },
        }
        if (meta.attendees) {
          event.attendees = (meta.attendees as string[]).map((email: string) => ({ email }))
        }
        const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        })
        const calData = await calRes.json()
        if (calRes.ok) {
          executionResult = { created: true, event_id: calData.id, link: calData.htmlLink }
        } else {
          executionResult = { created: false, error: calData.error?.message ?? JSON.stringify(calData) }
        }
      } else {
        executionResult = { created: false, error: 'Google Calendar not connected or token expired.' }
      }
    }

    // Drive / report — mark done, no external write needed
    else if (actionType === 'drive_report') {
      executionResult = { noted: true, message: 'Report approved and saved.' }
    }

    // Social post
    else if (actionType === 'social_post' || actionType === 'post_content') {
      const platform = (meta.platform as string) ?? 'unknown'
      await admin.from('prymal_social_posts').insert({
        client_id: clientId,
        platform,
        content: finalText,
        status: 'scheduled',
        scheduled_for: (meta.scheduled_for as string) ?? null,
      }).select()
      executionResult = { queued: true, platform }
    }

    // ── Mark approved ─────────────────────────────────────────────────────────
    await admin
      .from('prymal_approval_queue')
      .update({ status: 'approved', approved_content: finalText })
      .eq('id', approval_id)

    return new Response(
      JSON.stringify({ success: true, action: 'approved', posted_text: finalText, execution: executionResult }),
      { headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
