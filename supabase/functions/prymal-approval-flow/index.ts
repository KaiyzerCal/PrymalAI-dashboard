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

// Try each platform token in order (handles Google's per-scope connections)
async function tokenFor(
  admin: ReturnType<typeof createClient>,
  clientId: string,
  platforms: string[]
): Promise<string | null> {
  for (const p of platforms) {
    const t = await getValidAccessToken(admin, clientId, p)
    if (t) return t
  }
  return null
}

// Resolve a Gmail label name to its id, creating the label if it doesn't exist
async function gmailResolveLabelId(token: string, labelName: string): Promise<string | null> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  const existing = (data.labels ?? []).find(
    (l: { name: string }) => l.name?.toLowerCase() === labelName.toLowerCase()
  )
  if (existing) return existing.id
  const cr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
  })
  const cd = await cr.json()
  return cd.id ?? null
}

// Apply add/remove label sets across many threads; returns success count
async function gmailModifyThreads(
  token: string,
  threadIds: string[],
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<{ ok: number; failed: number; lastError?: string }> {
  let ok = 0, failed = 0
  let lastError: string | undefined
  for (const id of threadIds) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    })
    if (res.ok) ok++
    else { failed++; lastError = (await res.json())?.error?.message }
  }
  return { ok, failed, lastError }
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

    // ═══ Gmail: labels / organize / management ═══════════════════════════════
    else if (actionType === 'create_label') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: meta.name,
            labelListVisibility: meta.labelListVisibility ?? 'labelShow',
            messageListVisibility: meta.messageListVisibility ?? 'show',
          }),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, label_id: d.id, name: d.name } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'apply_label') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const labelId = await gmailResolveLabelId(token, meta.labelName as string)
        if (!labelId) executionResult = { done: false, error: `Could not resolve or create label "${meta.labelName}".` }
        else {
          const r = await gmailModifyThreads(token, (meta.threadIds as string[]) ?? [], [labelId], [])
          executionResult = { done: r.failed === 0, labeled: r.ok, failed: r.failed, error: r.lastError }
        }
      }
    }

    else if (actionType === 'remove_label') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const labelId = await gmailResolveLabelId(token, meta.labelName as string)
        if (!labelId) executionResult = { done: false, error: `Label "${meta.labelName}" not found.` }
        else {
          const r = await gmailModifyThreads(token, (meta.threadIds as string[]) ?? [], [], [labelId])
          executionResult = { done: r.failed === 0, unlabeled: r.ok, failed: r.failed, error: r.lastError }
        }
      }
    }

    else if (actionType === 'archive_email') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const r = await gmailModifyThreads(token, (meta.threadIds as string[]) ?? [], [], ['INBOX'])
        executionResult = { done: r.failed === 0, archived: r.ok, failed: r.failed, error: r.lastError }
      }
    }

    else if (actionType === 'mark_as_read') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const r = await gmailModifyThreads(token, (meta.threadIds as string[]) ?? [], [], ['UNREAD'])
        executionResult = { done: r.failed === 0, updated: r.ok, failed: r.failed, error: r.lastError }
      }
    }

    else if (actionType === 'mark_as_unread') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const r = await gmailModifyThreads(token, (meta.threadIds as string[]) ?? [], ['UNREAD'], [])
        executionResult = { done: r.failed === 0, updated: r.ok, failed: r.failed, error: r.lastError }
      }
    }

    else if (actionType === 'delete_email') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        // Move to trash (reversible) rather than permanent delete
        let ok = 0, failed = 0
        for (const id of (meta.threadIds as string[]) ?? []) {
          const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}/trash`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` },
          })
          res.ok ? ok++ : failed++
        }
        executionResult = { done: failed === 0, trashed: ok, failed }
      }
    }

    else if (actionType === 'create_filter') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const criteria: Record<string, string> = {}
        if (meta.from) criteria.from = meta.from as string
        if (meta.to) criteria.to = meta.to as string
        if (meta.subject) criteria.subject = meta.subject as string
        if (meta.query) criteria.query = meta.query as string
        const action: Record<string, unknown> = {}
        const act = meta.action as string
        if (act === 'archive') action.removeLabelIds = ['INBOX']
        else if (act === 'markRead') action.removeLabelIds = ['UNREAD']
        else if (act === 'star') action.addLabelIds = ['STARRED']
        else if (act === 'delete') action.addLabelIds = ['TRASH']
        if (meta.label) {
          const labelId = await gmailResolveLabelId(token, meta.label as string)
          if (labelId) action.addLabelIds = [...(action.addLabelIds as string[] ?? []), labelId]
        }
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/filters', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteria, action }),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, filter_id: d.id } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'set_auto_reply') {
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const vacation: Record<string, unknown> = {
          enableAutoReply: true,
          responseSubject: meta.subject ?? '',
          responseBodyPlainText: meta.message ?? finalText,
          restrictToContacts: meta.restrictToContacts ?? false,
          restrictToDomain: meta.restrictToDomain ?? false,
        }
        if (meta.startTime) vacation.startTime = String(new Date(meta.startTime as string).getTime())
        if (meta.endTime) vacation.endTime = String(new Date(meta.endTime as string).getTime())
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/vacation', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(vacation),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'schedule_send') {
      // Gmail API has no scheduled-send; save as a draft the user can send at the time
      const token = await tokenFor(admin, clientId, ['gmail'])
      if (!token) executionResult = { done: false, error: 'Gmail not connected.' }
      else {
        const raw = buildGmailRaw({ to: meta.to as string, subject: (meta.subject as string) ?? '(no subject)', body: finalText })
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { raw } }),
        })
        const d = await res.json()
        executionResult = res.ok
          ? { done: true, draft_id: d.id, note: 'Saved as a draft — Gmail\'s API cannot schedule sends. Open the draft and use Gmail\'s Schedule Send to set the time.' }
          : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    // ═══ Calendar ════════════════════════════════════════════════════════════
    else if (actionType === 'update_event') {
      const token = await tokenFor(admin, clientId, ['calendar'])
      if (!token) executionResult = { done: false, error: 'Calendar not connected.' }
      else {
        const patch: Record<string, unknown> = {}
        if (meta.title) patch.summary = meta.title
        if (meta.description) patch.description = meta.description
        if (meta.location) patch.location = meta.location
        if (meta.startTime) patch.start = { dateTime: meta.startTime, timeZone: (meta.timezone as string) ?? 'UTC' }
        if (meta.endTime) patch.end = { dateTime: meta.endTime, timeZone: (meta.timezone as string) ?? 'UTC' }
        if (meta.attendees) patch.attendees = (meta.attendees as string[]).map(email => ({ email }))
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${meta.eventId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, event_id: d.id, link: d.htmlLink } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'delete_event' || actionType === 'cancel_meeting') {
      const token = await tokenFor(admin, clientId, ['calendar'])
      if (!token) executionResult = { done: false, error: 'Calendar not connected.' }
      else {
        const eventId = (meta.eventId ?? meta.meetingId) as string
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        })
        executionResult = res.ok || res.status === 204 ? { done: true, deleted: eventId } : { done: false, error: await res.text() }
      }
    }

    else if (actionType === 'schedule_meet') {
      const token = await tokenFor(admin, clientId, ['calendar'])
      if (!token) executionResult = { done: false, error: 'Calendar not connected.' }
      else {
        const event: Record<string, unknown> = {
          summary: meta.title, description: meta.description ?? finalText,
          start: { dateTime: meta.startTime, timeZone: (meta.timezone as string) ?? 'UTC' },
          end: { dateTime: meta.endTime ?? meta.startTime, timeZone: (meta.timezone as string) ?? 'UTC' },
          conferenceData: { createRequest: { requestId: `prymal-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        }
        if (meta.attendees) event.attendees = (meta.attendees as string[]).map(email => ({ email }))
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, event_id: d.id, meet_link: d.hangoutLink, link: d.htmlLink } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    // ═══ Google Tasks ════════════════════════════════════════════════════════
    else if (actionType === 'create_task') {
      const token = await tokenFor(admin, clientId, ['tasks'])
      if (!token) executionResult = { done: false, error: 'Google Tasks not connected.' }
      else {
        const task: Record<string, unknown> = { title: meta.title, notes: meta.description ?? undefined }
        if (meta.dueDate) task.due = new Date(meta.dueDate as string).toISOString()
        const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, task_id: d.id } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'update_task' || actionType === 'complete_task') {
      const token = await tokenFor(admin, clientId, ['tasks'])
      if (!token) executionResult = { done: false, error: 'Google Tasks not connected.' }
      else {
        const patch: Record<string, unknown> = {}
        if (actionType === 'complete_task' || meta.status === 'completed') patch.status = 'completed'
        if (meta.title) patch.title = meta.title
        if (meta.description) patch.notes = meta.description
        if (meta.dueDate) patch.due = new Date(meta.dueDate as string).toISOString()
        const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${meta.taskId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, task_id: d.id } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    // ═══ Google Drive ══════════════════════════════════════════════════════════
    else if (actionType === 'create_folder') {
      const token = await tokenFor(admin, clientId, ['drive'])
      if (!token) executionResult = { done: false, error: 'Google Drive not connected.' }
      else {
        const body: Record<string, unknown> = { name: meta.name, mimeType: 'application/vnd.google-apps.folder' }
        if (meta.parentFolderId) body.parents = [meta.parentFolderId]
        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, folder_id: d.id } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'move_file') {
      const token = await tokenFor(admin, clientId, ['drive'])
      if (!token) executionResult = { done: false, error: 'Google Drive not connected.' }
      else {
        // Need existing parents to remove them
        const cur = await fetch(`https://www.googleapis.com/drive/v3/files/${meta.fileId}?fields=parents`, { headers: { Authorization: `Bearer ${token}` } })
        const curData = await cur.json()
        const prevParents = (curData.parents ?? []).join(',')
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${meta.fileId}?addParents=${meta.targetFolderId}&removeParents=${prevParents}`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, file_id: d.id } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'rename_file') {
      const token = await tokenFor(admin, clientId, ['drive'])
      if (!token) executionResult = { done: false, error: 'Google Drive not connected.' }
      else {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${meta.fileId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: meta.newName }),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, name: d.name } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'delete_file') {
      const token = await tokenFor(admin, clientId, ['drive'])
      if (!token) executionResult = { done: false, error: 'Google Drive not connected.' }
      else if (meta.permanently) {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${meta.fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        executionResult = res.ok || res.status === 204 ? { done: true, deleted: meta.fileId } : { done: false, error: await res.text() }
      } else {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${meta.fileId}`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
        })
        executionResult = res.ok ? { done: true, trashed: meta.fileId } : { done: false, error: await res.text() }
      }
    }

    else if (actionType === 'share_file' || actionType === 'set_permissions') {
      const token = await tokenFor(admin, clientId, ['drive'])
      if (!token) executionResult = { done: false, error: 'Google Drive not connected.' }
      else {
        const targets = actionType === 'share_file'
          ? (meta.emailAddresses as string[] ?? []).map(email => ({ type: 'user', role: (meta.role as string) ?? 'reader', emailAddress: email }))
          : [{ type: (meta.type as string) ?? 'anyone', role: (meta.role as string) ?? 'reader', ...(meta.value ? { emailAddress: meta.value } : {}) }]
        let ok = 0, failed = 0; let lastErr: string | undefined
        for (const perm of targets) {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${meta.fileId}/permissions?sendNotificationEmail=${meta.sendNotification ?? false}`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(perm),
          })
          if (res.ok) ok++; else { failed++; lastErr = (await res.json())?.error?.message }
        }
        executionResult = { done: failed === 0, shared: ok, failed, error: lastErr }
      }
    }

    // ═══ Docs / Sheets / Slides (create via Drive mimeType) ════════════════════
    else if (actionType === 'create_document' || actionType === 'create_sheet' || actionType === 'create_slide') {
      const mimeType = actionType === 'create_document' ? 'application/vnd.google-apps.document'
        : actionType === 'create_sheet' ? 'application/vnd.google-apps.spreadsheet'
        : 'application/vnd.google-apps.presentation'
      const platform = actionType === 'create_document' ? ['docs', 'drive'] : actionType === 'create_sheet' ? ['sheets', 'drive'] : ['slides', 'drive']
      const token = await tokenFor(admin, clientId, platform)
      if (!token) executionResult = { done: false, error: 'Google Drive not connected.' }
      else {
        const body: Record<string, unknown> = { name: meta.title, mimeType }
        if (meta.parentFolderId) body.parents = [meta.parentFolderId]
        const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        const d = await res.json()
        if (!res.ok) executionResult = { done: false, error: d.error?.message ?? JSON.stringify(d) }
        else {
          // Insert initial text for a doc, if provided
          if (actionType === 'create_document' && meta.content) {
            const docToken = await tokenFor(admin, clientId, ['docs', 'drive'])
            await fetch(`https://docs.googleapis.com/v1/documents/${d.id}:batchUpdate`, {
              method: 'POST', headers: { Authorization: `Bearer ${docToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: meta.content } }] }),
            })
          }
          executionResult = { done: true, file_id: d.id, link: d.webViewLink }
        }
      }
    }

    else if (actionType === 'update_document') {
      const token = await tokenFor(admin, clientId, ['docs', 'drive'])
      if (!token) executionResult = { done: false, error: 'Google Docs not connected.' }
      else {
        // Append text at end; for replace, caller should clear first (kept simple: append)
        const doc = await fetch(`https://docs.googleapis.com/v1/documents/${meta.documentId}?fields=body(content(endIndex))`, { headers: { Authorization: `Bearer ${token}` } })
        const docData = await doc.json()
        const contentArr = docData.body?.content ?? []
        const endIndex = contentArr.length ? (contentArr[contentArr.length - 1].endIndex ?? 1) - 1 : 1
        const res = await fetch(`https://docs.googleapis.com/v1/documents/${meta.documentId}:batchUpdate`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ insertText: { location: { index: Math.max(1, endIndex) }, text: `\n${meta.content}` } }] }),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'update_sheet') {
      const token = await tokenFor(admin, clientId, ['sheets', 'drive'])
      if (!token) executionResult = { done: false, error: 'Google Sheets not connected.' }
      else {
        const range = (meta.sheetName ? `${meta.sheetName}!` : '') + ((meta.range as string) ?? 'A1')
        const values = meta.values ?? []
        const isAppend = meta.mode === 'append'
        const url = isAppend
          ? `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`
          : `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
        const res = await fetch(url, {
          method: isAppend ? 'POST' : 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, updated: d.updates ?? d.updatedCells ?? true } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'update_slide') {
      const token = await tokenFor(admin, clientId, ['slides', 'drive'])
      if (!token) executionResult = { done: false, error: 'Google Slides not connected.' }
      else {
        // Add a new slide (with optional title text box handled by Slides default layout)
        const requests: Record<string, unknown>[] = [{ createSlide: {} }]
        const res = await fetch(`https://slides.googleapis.com/v1/presentations/${meta.presentationId}:batchUpdate`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, note: 'Slide added. Text placement via Slides API is limited — refine in the editor.' } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    // ═══ Google Contacts ═══════════════════════════════════════════════════════
    else if (actionType === 'create_contact') {
      const token = await tokenFor(admin, clientId, ['contacts'])
      if (!token) executionResult = { done: false, error: 'Google Contacts not connected.' }
      else {
        const person: Record<string, unknown> = {
          names: [{ givenName: meta.givenName, familyName: meta.familyName }],
        }
        if (meta.email) person.emailAddresses = [{ value: meta.email }]
        if (meta.phone) person.phoneNumbers = [{ value: meta.phone }]
        if (meta.company || meta.jobTitle) person.organizations = [{ name: meta.company, title: meta.jobTitle }]
        if (meta.notes) person.biographies = [{ value: meta.notes, contentType: 'TEXT_PLAIN' }]
        const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(person),
        })
        const d = await res.json()
        executionResult = res.ok ? { done: true, resource_name: d.resourceName } : { done: false, error: d.error?.message ?? JSON.stringify(d) }
      }
    }

    else if (actionType === 'delete_contact') {
      const token = await tokenFor(admin, clientId, ['contacts'])
      if (!token) executionResult = { done: false, error: 'Google Contacts not connected.' }
      else {
        const res = await fetch(`https://people.googleapis.com/v1/${meta.resourceName}:deleteContact`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        executionResult = res.ok ? { done: true } : { done: false, error: await res.text() }
      }
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
