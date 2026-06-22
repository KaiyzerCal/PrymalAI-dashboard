import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SYSTEM_PROMPT = `You are Prymal — an autonomous AI operations system managing a client's full digital presence. You have real-time access to their approval queue, agent activity, and connected integrations.

You operate 6 autonomous agents:
- GOOGLE AGENT: Monitors Google Business Profile reviews, drafts AI responses, manages reputation
- BRAND AGENT: Creates social media content across platforms, schedules posts, maintains brand voice
- INTEL AGENT: Delivers weekly competitive briefings and market intelligence reports
- OUTREACH AGENT: Identifies and qualifies leads, sends personalized outreach sequences
- SERVICE AGENT: Handles customer inquiries, routes support tickets, drafts responses
- BOOKING AGENT: Manages appointments, confirms bookings, handles reschedules

RULES:
1. Actions that affect the client externally (sending emails, posting content, responding to reviews) must go through the approval queue — use queue_action for these. Never claim you did something without queuing it first.
2. Read operations (checking queue, reading stats, looking up client info) are always safe to do directly.
3. Be concise and specific. Tell the user what you found or what you queued — don't pad responses.
4. When the user asks about an agent, give accurate info about what that agent actually does, not generic descriptions.`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_pending_approvals',
    description: 'Get all actions currently waiting for client approval, optionally filtered by agent.',
    input_schema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Filter by agent: google, brand, intel, outreach, service, booking. Omit for all.' }
      }
    }
  },
  {
    name: 'get_client_info',
    description: 'Get the client profile including business name, plan, brand tone, knowledge base, and delivery cadence.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_agent_activity',
    description: 'Get recent completed actions for a specific agent.',
    input_schema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent: google, brand, intel, outreach, service, booking' },
        limit: { type: 'number', default: 10 }
      },
      required: ['agent']
    }
  },
  {
    name: 'queue_action',
    description: 'Queue an action for client approval. Use for anything that affects external parties: sending emails, posting content, responding to reviews, sending outreach.',
    input_schema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Which agent is taking this action' },
        action_type: { type: 'string', description: 'Type of action, e.g. send_email, post_content, respond_to_review, send_outreach' },
        summary: { type: 'string', description: 'Short summary shown in the approval card' },
        draft_content: { type: 'string', description: 'Full draft content of the action (email body, post text, review response, etc.)' }
      },
      required: ['agent', 'action_type', 'summary', 'draft_content']
    }
  },
  {
    name: 'update_client_info',
    description: 'Update the client\'s brand tone, knowledge base, or delivery cadence.',
    input_schema: {
      type: 'object',
      properties: {
        brand_tone: { type: 'string' },
        knowledge_base: { type: 'string' },
        delivery_cadence: { type: 'string' }
      }
    }
  }
]

async function handleTool(
  toolName: string,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  clientId: string
): Promise<unknown> {
  switch (toolName) {
    case 'get_pending_approvals': {
      let query = supabase
        .from('prymal_approval_queue')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)
      if (input.agent) query = query.eq('agent', input.agent as string)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return { count: data?.length ?? 0, items: data ?? [] }
    }

    case 'get_client_info': {
      const { data, error } = await supabase
        .from('prymal_clients')
        .select('business_name, plan, status, brand_tone, knowledge_base, delivery_cadence, trial_ends_at')
        .eq('id', clientId)
        .single()
      if (error) throw new Error(error.message)
      return data
    }

    case 'get_agent_activity': {
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .select('*')
        .eq('client_id', clientId)
        .eq('agent', input.agent as string)
        .eq('status', 'approved')
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
          agent: input.agent,
          action_type: input.action_type,
          summary: input.summary,
          draft_content: input.draft_content,
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data?.id, message: 'Action queued for approval — it will appear in the dashboard.' }
    }

    case 'update_client_info': {
      const updates: Record<string, unknown> = {}
      if (input.brand_tone !== undefined) updates.brand_tone = input.brand_tone
      if (input.knowledge_base !== undefined) updates.knowledge_base = input.knowledge_base
      if (input.delivery_cadence !== undefined) updates.delivery_cadence = input.delivery_cadence
      const { error } = await supabase
        .from('prymal_clients')
        .update(updates)
        .eq('id', clientId)
      if (error) throw new Error(error.message)
      return { updated: true, fields: Object.keys(updates) }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const userSupabase = createClient(SUPABASE_URL, authHeader.replace('Bearer ', ''))
    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { data: clientRow } = await supabase
      .from('prymal_clients')
      .select('id, anthropic_api_key')
      .eq('user_id', user.id)
      .single()
    if (!clientRow) return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 })

    const apiKey = clientRow.anthropic_api_key
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No Anthropic API key configured. Go to Settings → Integrations → AI Engine to add yours.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const anthropic = new Anthropic({ apiKey })

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
