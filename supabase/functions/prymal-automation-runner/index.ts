// Scheduled runner for standing instructions. Invoked by pg_cron (hourly).
// For each due instruction, re-invokes the Alfy chat loop headlessly
// (channel: 'automation') so the LLM decides whether action is needed now.
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INTERNAL_FUNCTION_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? ''

const CADENCE_MS: Record<string, number> = {
  hourly: 55 * 60 * 1000,             // slack so an hourly cron tick always qualifies
  daily: 23 * 60 * 60 * 1000,
  weekly: 6.8 * 24 * 60 * 60 * 1000,
}

Deno.serve(async (req) => {
  // Only the cron job (or an admin with the secret) may invoke this
  const key = req.headers.get('x-runner-key')
  if (!INTERNAL_FUNCTION_SECRET || key !== INTERNAL_FUNCTION_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: instructions, error } = await supabase
    .from('prymal_standing_instructions')
    .select('id, client_id, goal_text, trigger_config, last_run_at')
    .eq('status', 'active')
    .limit(50)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const now = Date.now()
  const due = (instructions ?? []).filter(i => {
    const cadence = (i.trigger_config as { cadence?: string })?.cadence ?? 'daily'
    const interval = CADENCE_MS[cadence] ?? CADENCE_MS.daily
    return !i.last_run_at || (now - new Date(i.last_run_at).getTime()) >= interval
  })

  const results: Record<string, unknown>[] = []

  for (const inst of due) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const message =
        `Scheduled check of a standing instruction. Today is ${today}.\n` +
        `The client's ongoing goal: "${inst.goal_text}"\n` +
        `Look at the current state with your tools and decide whether anything needs doing today to honor this goal. ` +
        `If yes, act (external actions via queue_action). If not, reply NO_ACTION.`

      const res = await fetch(`${SUPABASE_URL}/functions/v1/prymal-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': INTERNAL_FUNCTION_SECRET,
        },
        body: JSON.stringify({
          client_id: inst.client_id,
          message,
          history: [],
          channel: 'automation',
        }),
      })
      const data = await res.json()
      const reply: string = data.reply ?? data.error ?? 'no reply'
      const acted = !reply.trim().startsWith('NO_ACTION')

      await supabase.from('prymal_standing_instructions').update({
        last_run_at: new Date().toISOString(),
        last_result: reply.slice(0, 500),
      }).eq('id', inst.id)

      results.push({ id: inst.id, acted, summary: reply.slice(0, 120) })
    } catch (err) {
      await supabase.from('prymal_standing_instructions').update({
        last_run_at: new Date().toISOString(),
        last_result: `Runner error: ${(err as Error).message}`.slice(0, 500),
      }).eq('id', inst.id)
      results.push({ id: inst.id, error: (err as Error).message })
    }
  }

  return new Response(JSON.stringify({ checked: due.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// deploy trigger: cf7227f
