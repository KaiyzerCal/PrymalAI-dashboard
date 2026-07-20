import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendSms } from '../_shared/twilio.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const CORS: Record<string, string> = {
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

// Try several stored platform names — the connect flow writes different rows
// (google, drive, docs, calendar) depending on when the client connected.
async function getTokenAny(
  admin: ReturnType<typeof createClient>,
  clientId: string,
  platforms: string[]
): Promise<string | null> {
  for (const pf of platforms) {
    const token = await getValidAccessToken(admin, clientId, pf)
    if (token) return token
  }
  return null
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
  Object.assign(CORS, corsHeaders(req))
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const body = await req.json()

    // Two auth paths: user JWT (dashboard) or the internal secret (SMS/automation bridges)
    const internalKey = req.headers.get('x-internal-key')
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? ''
    let internalClientId: string | null = null
    let user: { id: string } | null = null

    if (internalKey && internalSecret && internalKey === internalSecret && body.client_id) {
      internalClientId = body.client_id
    } else {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
      const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data, error: userError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
      if (userError || !data.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
      user = data.user
    }
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
    const owned = internalClientId
      ? approval.client_id === internalClientId
      : approval.prymal_clients.user_id === user!.id
    if (!owned)
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

    // Friend invite — sends the approved text via Twilio and records it
    else if (actionType === 'invite_friend') {
      const toPhone = (meta.to_phone ?? '') as string
      if (toPhone) {
        const ok = await sendSms(toPhone, finalText)
        if (ok) {
          await admin.from('prymal_invites').insert({
            client_id: clientId, phone: toPhone, name: (meta.name as string) ?? null, status: 'sent',
          })
        }
        executionResult = { sent: ok, to: toPhone }
      } else {
        executionResult = { sent: false, error: 'Missing to_phone in metadata.' }
      }
    }

    // Gmail send — also executes errand requests (reservations, appointments,
    // flights, bills) drafted as an email to the counterparty
    else if (actionType === 'send_email' || (['book_reservation','book_appointment','book_flight','pay_bill'].includes(actionType) && (meta.to || meta.recipient || meta.recipient_email))) {
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

    // Docs / Sheets / Drive / Meet — these queued for approval but had no
    // executor, so approvals silently did nothing. Now they perform the work.
    else if (['create_sheet','update_sheet','create_document','update_document','create_folder','move_file','rename_file','delete_file','share_file','schedule_meet'].includes(actionType)) {
      const accessToken = await getTokenAny(admin, clientId, ['drive', 'docs', 'google', 'calendar', 'gmail'])
      if (!accessToken) {
        executionResult = { executed: false, error: 'Google not connected or token expired.' }
      } else {
        try {
          const gauth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
          if (actionType === 'create_sheet') {
            const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
              method: 'POST', headers: gauth,
              body: JSON.stringify({ properties: { title: (meta.title as string) ?? 'Untitled' } }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            if (meta.parentFolderId) {
              await fetch('https://www.googleapis.com/drive/v3/files/' + d.spreadsheetId + '?addParents=' + meta.parentFolderId, { method: 'PATCH', headers: gauth })
            }
            executionResult = { executed: true, spreadsheetId: d.spreadsheetId, url: d.spreadsheetUrl }
          } else if (actionType === 'update_sheet') {
            const range = encodeURIComponent((meta.range as string) ?? String(meta.sheetName ?? 'Sheet1'))
            const isAppend = meta.mode === 'append'
            const res = await fetch(
              'https://sheets.googleapis.com/v4/spreadsheets/' + meta.spreadsheetId + '/values/' + range + (isAppend ? ':append' : '') + '?valueInputOption=USER_ENTERED',
              { method: isAppend ? 'POST' : 'PUT', headers: gauth, body: JSON.stringify({ values: meta.values }) }
            )
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            executionResult = { executed: true, updated: d.updates?.updatedCells ?? d.updatedCells ?? 0 }
          } else if (actionType === 'create_document') {
            const res = await fetch('https://docs.googleapis.com/v1/documents', {
              method: 'POST', headers: gauth,
              body: JSON.stringify({ title: (meta.title as string) ?? 'Untitled' }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            const content = (meta.content as string) ?? ''
            if (content) {
              await fetch('https://docs.googleapis.com/v1/documents/' + d.documentId + ':batchUpdate', {
                method: 'POST', headers: gauth,
                body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: content } }] }),
              })
            }
            if (meta.parentFolderId) {
              await fetch('https://www.googleapis.com/drive/v3/files/' + d.documentId + '?addParents=' + meta.parentFolderId, { method: 'PATCH', headers: gauth })
            }
            executionResult = { executed: true, documentId: d.documentId, url: 'https://docs.google.com/document/d/' + d.documentId + '/edit' }
          } else if (actionType === 'update_document') {
            const docId = meta.documentId as string
            const content = (meta.content as string) ?? finalText
            const doc = await (await fetch('https://docs.googleapis.com/v1/documents/' + docId + '?fields=body.content', { headers: gauth })).json()
            const parts = doc.body?.content ?? []
            const endIndex = Math.max(1, (parts.length ? parts[parts.length - 1].endIndex ?? 2 : 2) - 1)
            const requests = meta.mode === 'replace'
              ? [
                  ...(endIndex > 1 ? [{ deleteContentRange: { range: { startIndex: 1, endIndex } } }] : []),
                  { insertText: { location: { index: 1 }, text: content } },
                ]
              : [{ insertText: { location: { index: endIndex }, text: '\n' + content } }]
            const res = await fetch('https://docs.googleapis.com/v1/documents/' + docId + ':batchUpdate', {
              method: 'POST', headers: gauth, body: JSON.stringify({ requests }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            executionResult = { executed: true, documentId: docId }
          } else if (actionType === 'create_folder') {
            const res = await fetch('https://www.googleapis.com/drive/v3/files', {
              method: 'POST', headers: gauth,
              body: JSON.stringify({
                name: (meta.name as string) ?? (meta.title as string) ?? 'New folder',
                mimeType: 'application/vnd.google-apps.folder',
                ...(meta.parentFolderId ? { parents: [meta.parentFolderId] } : {}),
              }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            executionResult = { executed: true, folderId: d.id }
          } else if (actionType === 'delete_file') {
            const res = await fetch('https://www.googleapis.com/drive/v3/files/' + meta.fileId, { method: 'DELETE', headers: gauth })
            if (!res.ok && res.status !== 204) throw new Error('Delete failed: ' + res.status)
            executionResult = { executed: true, deleted: meta.fileId }
          } else if (actionType === 'share_file') {
            const res = await fetch('https://www.googleapis.com/drive/v3/files/' + meta.fileId + '/permissions', {
              method: 'POST', headers: gauth,
              body: JSON.stringify({ type: 'user', role: (meta.role as string) ?? 'reader', emailAddress: meta.email }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            executionResult = { executed: true, shared: meta.email }
          } else if (actionType === 'move_file' || actionType === 'rename_file') {
            const qs = actionType === 'move_file'
              ? '?addParents=' + meta.newParentId + (meta.oldParentId ? '&removeParents=' + meta.oldParentId : '')
              : ''
            const res = await fetch('https://www.googleapis.com/drive/v3/files/' + meta.fileId + qs, {
              method: 'PATCH', headers: gauth,
              body: JSON.stringify(actionType === 'rename_file' ? { name: meta.newName } : {}),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            executionResult = { executed: true, fileId: meta.fileId }
          } else if (actionType === 'schedule_meet') {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
              method: 'POST', headers: gauth,
              body: JSON.stringify({
                summary: (meta.title as string) ?? 'Meeting',
                description: (meta.description as string) ?? '',
                start: { dateTime: meta.startTime },
                end: { dateTime: meta.endTime },
                attendees: ((meta.attendees as string[]) ?? []).map((email: string) => ({ email })),
                conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
              }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error?.message ?? JSON.stringify(d))
            executionResult = { executed: true, eventId: d.id, meetLink: d.hangoutLink ?? d.conferenceData?.entryPoints?.[0]?.uri }
          }
        } catch (err) {
          executionResult = { executed: false, error: String(err) }
        }
      }
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

    // Honest fallback — an action type with no executor must say so, loudly,
    // instead of being marked approved as if the work happened.
    else {
      executionResult = { executed: false, error: "No executor for '" + actionType + "' yet — nothing was performed." }
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
