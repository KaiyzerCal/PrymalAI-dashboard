import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are Prymal — an autonomous AI operations system for the Google Agent.

The Google Agent monitors Google Business Profile reviews and drafts AI-powered responses that match the client's brand voice. All responses are queued for client approval before anything is posted.

RULES — never break these:
1. Any action that posts or sends something externally must go through queue_action first. The client reviews and approves it in the dashboard.
2. Reading reviews is always safe — do it freely.
3. When you queue a response, tell the client it's waiting in the Google Agent tab of the dashboard.
4. Write responses that match the client's brand tone from their profile. If brand tone is not set, ask before drafting.
5. Be specific — tell the client exactly what you found, what you drafted, and why.`

async function getFreshGBPToken(
  supabase: ReturnType<typeof createClient>,
  clientId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('prymal_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('client_id', clientId)
    .eq('platform', 'google')
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
  }).eq('client_id', clientId).eq('platform', 'google')

  return tokens.access_token
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_client_info',
    description: 'Get the client profile including business name, brand tone, knowledge base, and GBP location IDs.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_reviews',
    description: 'Fetch reviews from Google Business Profile. Requires Google to be connected. Returns reviewer name, rating, text, and reply status.',
    input_schema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of reviews to fetch (max 50)', default: 20 },
        orderBy: { type: 'string', description: 'Sort order: "updateTime desc" (newest first) or "rating" (lowest first)', default: 'updateTime desc' }
      }
    }
  },
  {
    name: 'get_pending_approvals',
    description: 'Get queued review responses waiting for client approval in the dashboard.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_agent_activity',
    description: 'Get history of approved or rejected review responses.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', default: 10 } }
    }
  },
  {
    name: 'queue_action',
    description: 'Queue a drafted review response for client approval. The client sees and approves it in the Google Agent tab before it is posted.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Short title shown on the approval card, e.g. "Response to 5-star review from John D."' },
        draft_content: { type: 'string', description: 'The full review response the client will review and approve' },
        review_id: { type: 'string', description: 'The GBP review ID this response is for' }
      },
      required: ['summary', 'draft_content']
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
]

async function handleTool(
  toolName: string,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  clientId: string
): Promise<unknown> {
  switch (toolName) {

    case 'get_client_info': {
      const { data, error } = await supabase
        .from('prymal_clients')
        .select('business_name, plan, brand_tone, knowledge_base, delivery_cadence, gbp_account_id, gbp_location_id')
        .eq('id', clientId)
        .single()
      if (error) throw new Error(error.message)
      const { data: tokenRow } = await supabase
        .from('prymal_oauth_tokens')
        .select('platform')
        .eq('client_id', clientId)
        .eq('platform', 'google')
        .maybeSingle()
      return { ...data, google_connected: !!tokenRow }
    }

    case 'get_reviews': {
      const token = await getFreshGBPToken(supabase, clientId)
      if (!token) return { error: 'Google Business Profile not connected. Ask the client to connect Google in Settings → Integrations.' }

      const { data: clientData } = await supabase
        .from('prymal_clients')
        .select('gbp_location_id')
        .eq('id', clientId)
        .single()

      if (!clientData?.gbp_location_id || clientData.gbp_location_id === '0') {
        return { error: 'GBP location ID not configured. Ask the client to set it in Settings → Integrations → Google Business Profile.' }
      }

      const pageSize = (input.pageSize as number) ?? 20
      const orderBy = (input.orderBy as string) ?? 'updateTime desc'
      const params = new URLSearchParams({ pageSize: String(pageSize), orderBy })

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

    case 'get_pending_approvals': {
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .select('*')
        .eq('client_id', clientId)
        .eq('agent', 'google')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)
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
          action_type: 'respond_to_review',
          summary: input.summary,
          draft_content: input.draft_content,
          status: 'pending',
          ...(input.review_id ? { metadata: { review_id: input.review_id } } : {}),
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data?.id, message: 'Response queued — visible in the Google Agent tab of the dashboard for approval.' }
    }

    case 'update_client_info': {
      const updates: Record<string, unknown> = {}
      if (input.brand_tone !== undefined) updates.brand_tone = input.brand_tone
      if (input.knowledge_base !== undefined) updates.knowledge_base = input.knowledge_base
      const { error } = await supabase.from('prymal_clients').update(updates).eq('id', clientId)
      if (error) throw new Error(error.message)
      return { updated: true, fields: Object.keys(updates) }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

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
      .select('id, anthropic_api_key')
      .eq('user_id', user.id)
      .single()

    if (!clientRow) {
      return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 })
    }

    if (!clientRow.anthropic_api_key) {
      return new Response(
        JSON.stringify({ reply: 'No Anthropic API key found. Add yours in Settings → Integrations → AI Engine to activate the chat.' }),
        { headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const anthropic = new Anthropic({ apiKey: clientRow.anthropic_api_key })
    const { message, history = [] } = await req.json()

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    let finalText = ''
    while (true) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      })

      if (response.stop_reason === 'end_turn') {
        finalText = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('')
        break
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            try {
              const result = await handleTool(block.name, block.input as Record<string, unknown>, supabase, clientRow.id)
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
