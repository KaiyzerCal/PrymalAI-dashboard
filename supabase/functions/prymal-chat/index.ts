import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
// Platform-level Gemini key (optional override); client key takes priority

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Plan hierarchy
const PLAN_RANK: Record<string, number> = { trial: 0, starter: 1, pro: 2, agency: 3 }
function planAtLeast(clientPlan: string, required: string) {
  return (PLAN_RANK[clientPlan] ?? 0) >= (PLAN_RANK[required] ?? 99)
}

const SYSTEM_PROMPT = `You are Prymal — an autonomous AI Google Agent managing a client's full Google workspace and online presence.

You have access to Gmail, Google Calendar, Google Drive, and Google Business Profile — depending on their plan and which services they've connected.

CAPABILITIES BY PLAN:
- Free ($0/mo): Gmail (read, search) + Google Calendar (view) + Google Drive (search)
- Starter ($20/mo): + Gmail send + Calendar event creation + Drive read & summarize + brand tone memory
- Pro ($50/mo): + Google Business Profile (review monitoring, AI responses, reputation management)
- Agency ($100/mo): + multi-client management + white-label + team access + dedicated support

RULES — never break these:
1. Never post, send, or create anything externally without going through queue_action first. The client approves everything in the dashboard before it goes out.
2. Reading data (reviews, emails, events, files) is always safe — do it freely.
3. If a client asks for a feature their plan doesn't include, tell them clearly which plan unlocks it and what it does.
4. If a Google service isn't connected yet, tell the client to go to Settings → Integrations to connect it.
5. Match the client's brand tone when drafting any content. If brand tone isn't set, ask first.
6. Be specific — tell the client exactly what you found, what you drafted, and why.`

// ── Token management ──────────────────────────────────────────────────────────

async function getFreshToken(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  platform: string
): Promise<string | null> {
  const { data } = await supabase
    .from('prymal_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .single()

  if (!data) return null

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (Date.now() < expiresAt - 60000) return data.access_token
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

  await supabase.from('prymal_oauth_tokens').update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
  }).eq('client_id', clientId).eq('platform', platform)

  return tokens.access_token
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  // ── All plans ──
  {
    name: 'get_client_info',
    description: 'Get the client profile: business name, plan, brand tone, knowledge base, GBP IDs, and which Google services are connected.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_pending_approvals',
    description: 'Get all actions queued for client approval, optionally filtered by type.',
    input_schema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'Filter by type: respond_to_review, send_email, create_event, drive_report. Omit for all.' }
      }
    }
  },
  {
    name: 'get_agent_activity',
    description: 'Get history of approved or rejected actions.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', default: 10 } }
    }
  },
  {
    name: 'queue_action',
    description: 'Queue any action for client approval before it goes external. Always use this before sending, posting, or creating anything.',
    input_schema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'e.g. respond_to_review, send_email, create_event, drive_report' },
        summary: { type: 'string', description: 'Short title for the approval card' },
        draft_content: { type: 'string', description: 'Full content the client will review' },
        metadata: { type: 'object', description: 'Extra context. For send_email: always include "to" (recipient email address) and "subject". For review responses: review_id. For events: start, end, title, attendees.' }
      },
      required: ['action_type', 'summary', 'draft_content']
    }
  },
  {
    name: 'update_client_info',
    description: "Update the client's brand tone or knowledge base.",
    input_schema: {
      type: 'object',
      properties: {
        brand_tone: { type: 'string' },
        knowledge_base: { type: 'string' }
      }
    }
  },

  // ── Pro+ : GBP ──
  {
    name: 'get_reviews',
    description: '[Pro+] Fetch reviews from Google Business Profile. Returns reviewer, rating, comment, and whether a reply exists.',
    input_schema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', default: 20, description: 'Number of reviews (max 50)' },
        orderBy: { type: 'string', default: 'updateTime desc', description: '"updateTime desc" (newest) or "rating" (lowest first)' }
      }
    }
  },

  // ── Starter+ : Gmail ──
  {
    name: 'get_emails',
    description: '[Starter+] Search and list Gmail messages. Use to find unanswered inquiries, leads, or any email thread.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query, e.g. "is:unread", "from:customer@example.com", "subject:invoice"' },
        maxResults: { type: 'number', default: 10, description: 'Number of emails to return (max 50)' }
      }
    }
  },
  {
    name: 'get_email_thread',
    description: '[Starter+] Get the full content of an email thread by thread ID.',
    input_schema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'Gmail thread ID' }
      },
      required: ['threadId']
    }
  },

  // ── Starter+ : Calendar ──
  {
    name: 'get_calendar_events',
    description: '[Starter+] List upcoming Google Calendar events.',
    input_schema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start of range in ISO 8601. Defaults to now.' },
        timeMax: { type: 'string', description: 'End of range in ISO 8601. Defaults to 7 days from now.' },
        maxResults: { type: 'number', default: 20 }
      }
    }
  },
  {
    name: 'get_availability',
    description: '[Starter+] Check free/busy slots on Google Calendar for a given time range.',
    input_schema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start of range ISO 8601' },
        timeMax: { type: 'string', description: 'End of range ISO 8601' }
      },
      required: ['timeMin', 'timeMax']
    }
  },

  // ── Starter+ : Drive ──
  {
    name: 'search_drive_files',
    description: '[Starter+] Search Google Drive for files by name or content.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Drive search query, e.g. "name contains \'report\'" or "mimeType=\'application/pdf\'"' },
        maxResults: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'read_drive_file',
    description: '[Starter+] Read the text content of a Google Drive document.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' }
      },
      required: ['fileId']
    }
  },
]

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleTool(
  toolName: string,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientPlan: string
): Promise<unknown> {

  // Plan gate helper
  function requirePlan(plan: string, feature: string) {
    if (!planAtLeast(clientPlan, plan)) {
      throw new Error(`${feature} requires the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan. Your current plan is ${clientPlan}. Upgrade in Settings → Billing.`)
    }
  }

  switch (toolName) {

    // ── Shared ──

    case 'get_client_info': {
      const { data, error } = await supabase
        .from('prymal_clients')
        .select('business_name, plan, brand_tone, knowledge_base, delivery_cadence, gbp_account_id, gbp_location_id')
        .eq('id', clientId)
        .single()
      if (error) throw new Error(error.message)

      const { data: tokens } = await supabase
        .from('prymal_oauth_tokens')
        .select('platform')
        .eq('client_id', clientId)
      const connected = (tokens ?? []).map((t: { platform: string }) => t.platform)

      return { ...data, connected_services: connected }
    }

    case 'get_pending_approvals': {
      let query = supabase
        .from('prymal_approval_queue')
        .select('*')
        .eq('client_id', clientId)
        .eq('agent', 'google')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)
      if (input.action_type) query = query.eq('action_type', input.action_type as string)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return { count: data?.length ?? 0, items: data ?? [] }
    }

    case 'get_agent_activity': {
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .select('*')
        .eq('client_id', clientId)
        .eq('agent', 'google')
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit((input.limit as number) ?? 10)
      if (error) throw new Error(error.message)
      return { count: data?.length ?? 0, items: data ?? [] }
    }

    case 'queue_action': {
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: input.action_type,
          summary: input.summary,
          draft_content: input.draft_content,
          status: 'pending',
          metadata: input.metadata ?? null,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data?.id, message: 'Action queued — visible in the Google Agent tab for your approval.' }
    }

    case 'update_client_info': {
      const updates: Record<string, unknown> = {}
      if (input.brand_tone !== undefined) updates.brand_tone = input.brand_tone
      if (input.knowledge_base !== undefined) updates.knowledge_base = input.knowledge_base
      const { error } = await supabase.from('prymal_clients').update(updates).eq('id', clientId)
      if (error) throw new Error(error.message)
      return { updated: true, fields: Object.keys(updates) }
    }

    // ── Pro+ : GBP ──

    case 'get_reviews': {
      requirePlan('pro', 'Google Business Profile reviews')
      const token = await getFreshToken(supabase, clientId, 'google')
      if (!token) return { error: 'Google Business Profile not connected. Go to Settings → Integrations → Google Business Profile to connect.' }

      const { data: clientData } = await supabase
        .from('prymal_clients')
        .select('gbp_location_id')
        .eq('id', clientId)
        .single()

      if (!clientData?.gbp_location_id || clientData.gbp_location_id === '0') {
        return { error: 'GBP location ID not configured. Go to Settings → Integrations → Google Business Profile.' }
      }

      const params = new URLSearchParams({
        pageSize: String((input.pageSize as number) ?? 20),
        orderBy: (input.orderBy as string) ?? 'updateTime desc',
      })
      const res = await fetch(
        `https://mybusinessreviews.googleapis.com/v1/${clientData.gbp_location_id}/reviews?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const reviews = (data.reviews ?? []).map((r: Record<string, unknown>) => ({
        reviewId: r.reviewId,
        reviewer: (r.reviewer as Record<string, unknown>)?.displayName ?? 'Anonymous',
        starRating: r.starRating,
        comment: r.comment ?? '(no comment)',
        createTime: r.createTime,
        updateTime: r.updateTime,
        hasReply: !!(r.reviewReply),
        replyText: (r.reviewReply as Record<string, unknown>)?.comment ?? null,
      }))
      return { totalReviewCount: data.totalReviewCount ?? reviews.length, reviews }
    }

    // ── Starter+ : Gmail ──

    case 'get_emails': {
      requirePlan('starter', 'Gmail')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const params = new URLSearchParams({
        q: (input.query as string) ?? '',
        maxResults: String((input.maxResults as number) ?? 10),
      })
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }
      if (!data.messages?.length) return { count: 0, emails: [], message: 'No emails matched that query.' }

      // Fetch snippets for each message
      const emails = await Promise.all(
        (data.messages ?? []).slice(0, 10).map(async (m: { id: string; threadId: string }) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const msg = await msgRes.json()
          const headers: Record<string, string> = {}
          for (const h of msg.payload?.headers ?? []) headers[h.name] = h.value
          return {
            id: m.id,
            threadId: m.threadId,
            subject: headers['Subject'] ?? '(no subject)',
            from: headers['From'] ?? '',
            date: headers['Date'] ?? '',
            snippet: msg.snippet ?? '',
          }
        })
      )
      return { count: data.resultSizeEstimate ?? emails.length, emails }
    }

    case 'get_email_thread': {
      requirePlan('starter', 'Gmail')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${input.threadId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const messages = (data.messages ?? []).map((m: Record<string, unknown>) => {
        const headers: Record<string, string> = {}
        for (const h of (m.payload as Record<string, unknown[]>)?.headers ?? []) {
          const hdr = h as Record<string, string>
          headers[hdr.name] = hdr.value
        }
        // Decode body
        let body = ''
        const payload = m.payload as Record<string, unknown>
        const parts = payload?.parts as Record<string, unknown>[] ?? []
        const bodyData = parts.find(p => p.mimeType === 'text/plain') ?? payload
        const encoded = (bodyData?.body as Record<string, string>)?.data ?? ''
        if (encoded) {
          try { body = atob(encoded.replace(/-/g, '+').replace(/_/g, '/')) } catch { body = '' }
        }
        return {
          from: headers['From'] ?? '',
          date: headers['Date'] ?? '',
          subject: headers['Subject'] ?? '',
          body: body.slice(0, 2000),
        }
      })
      return { threadId: input.threadId, messages }
    }

    // ── Starter+ : Calendar ──

    case 'get_calendar_events': {
      requirePlan('starter', 'Google Calendar')
      const token = await getFreshToken(supabase, clientId, 'calendar')
      if (!token) return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }

      const timeMin = (input.timeMin as string) ?? new Date().toISOString()
      const timeMax = (input.timeMax as string) ?? new Date(Date.now() + 7 * 86400000).toISOString()
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        maxResults: String((input.maxResults as number) ?? 20),
        singleEvents: 'true',
        orderBy: 'startTime',
      })
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const events = (data.items ?? []).map((e: Record<string, unknown>) => ({
        id: e.id,
        summary: e.summary ?? '(no title)',
        start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
        end: (e.end as Record<string, string>)?.dateTime ?? (e.end as Record<string, string>)?.date,
        location: e.location ?? null,
        description: (e.description as string)?.slice(0, 300) ?? null,
        attendees: ((e.attendees as Record<string, string>[]) ?? []).map(a => a.email),
        status: e.status,
      }))
      return { count: events.length, events }
    }

    case 'get_availability': {
      requirePlan('starter', 'Google Calendar')
      const token = await getFreshToken(supabase, clientId, 'calendar')
      if (!token) return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }

      const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          items: [{ id: 'primary' }],
        }),
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const busy = data.calendars?.primary?.busy ?? []
      return {
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        busy_slots: busy,
        busy_count: busy.length,
        message: busy.length === 0 ? 'Completely free during this period.' : `${busy.length} busy slot(s) found.`,
      }
    }

    // ── Starter+ : Drive ──

    case 'search_drive_files': {
      requirePlan('starter', 'Google Drive')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      const params = new URLSearchParams({
        q: (input.query as string) ?? '',
        pageSize: String((input.maxResults as number) ?? 10),
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      })
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }
      return { count: data.files?.length ?? 0, files: data.files ?? [] }
    }

    case 'read_drive_file': {
      requirePlan('starter', 'Google Drive')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      // Export Google Docs as plain text; download other files directly
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.fileId}?fields=name,mimeType`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const meta = await metaRes.json()
      if (meta.error) return { error: meta.error.message }

      let content = ''
      if (meta.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = await exportRes.text()
      } else {
        const downloadRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = await downloadRes.text()
      }

      return { fileId: input.fileId, name: meta.name, mimeType: meta.mimeType, content: content.slice(0, 8000) }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// ── Gemini 2.0 Flash agentic loop ────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } }

async function runGeminiLoop(
  apiKey: string,
  history: { role: string; content: string }[],
  message: string,
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientPlan: string
): Promise<string> {
  const functionDeclarations = TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }))

  // Build initial contents from plain-text history + new message
  const contents: { role: string; parts: GeminiPart[] }[] = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }] as GeminiPart[],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          tools: [{ functionDeclarations }],
          generationConfig: { maxOutputTokens: 4096 },
        }),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json()
    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? []
    const calls = parts.filter(
      (p): p is { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p
    )

    if (calls.length === 0) {
      return parts
        .filter((p): p is { text: string } => 'text' in p)
        .map(p => p.text)
        .join('')
    }

    // Push model turn + execute tools
    contents.push({ role: 'model', parts })
    const responses: GeminiPart[] = await Promise.all(
      calls.map(async c => {
        try {
          const result = await handleTool(c.functionCall.name, c.functionCall.args, supabase, clientId, clientPlan)
          return { functionResponse: { name: c.functionCall.name, response: { output: JSON.stringify(result) } } }
        } catch (err) {
          return { functionResponse: { name: c.functionCall.name, response: { error: (err as Error).message } } }
        }
      })
    )
    contents.push({ role: 'user', parts: responses })
  }

  throw new Error('Gemini loop exceeded max iterations')
}

// ── Claude Haiku fallback loop ────────────────────────────────────────────────

async function runHaikuLoop(
  apiKey: string,
  history: { role: string; content: string }[],
  message: string,
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientPlan: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey })
  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: message },
  ]

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      return response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          try {
            const result = await handleTool(block.name, block.input as Record<string, unknown>, supabase, clientId, clientPlan)
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
          } catch (err) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${(err as Error).message}`, is_error: true })
          }
        }
      }
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }
  return ''
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { data: clientRow } = await supabase
      .from('prymal_clients')
      .select('id, anthropic_api_key, gemini_api_key, plan')
      .eq('user_id', user.id)
      .single()

    if (!clientRow) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 })

    const { message, history = [] } = await req.json()

    const geminiKey = (clientRow.gemini_api_key as string | null) ?? ''
    const anthropicKey = (clientRow.anthropic_api_key as string | null) ?? ''

    // ── Gemini-first, Haiku fallback ──────────────────────────────────────────
    let finalText = ''

    if (geminiKey) {
      try {
        finalText = await runGeminiLoop(
          geminiKey, history, message, supabase, clientRow.id, clientRow.plan
        )
      } catch (geminiErr) {
        // Gemini unavailable (rate limit, API error) — fall back to Haiku
        console.error('Gemini failed, falling back to Haiku:', (geminiErr as Error).message)
        if (!anthropicKey) {
          return new Response(
            JSON.stringify({ reply: 'AI is temporarily unavailable. Please add an Anthropic API key in Settings → Integrations as a backup.' }),
            { headers: { 'Content-Type': 'application/json', ...CORS } }
          )
        }
        finalText = await runHaikuLoop(
          anthropicKey, history, message, supabase, clientRow.id, clientRow.plan
        )
      }
    } else {
      // No Gemini key configured — use Haiku directly
      if (!anthropicKey) {
        return new Response(
          JSON.stringify({ reply: 'No AI key found. Add a Gemini or Anthropic API key in Settings → Integrations to activate the agent.' }),
          { headers: { 'Content-Type': 'application/json', ...CORS } }
        )
      }
      finalText = await runHaikuLoop(
        anthropicKey, history, message, supabase, clientRow.id, clientRow.plan
      )
    }

    return new Response(JSON.stringify({ reply: finalText }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }
})
