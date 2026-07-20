// Sunday digest — the weekly receipt, by text. Invoked by pg_cron weekly.
// Law: every message earns its send — clients with nothing handled and
// nothing watched get silence, not a newsletter.
import { createClient } from 'npm:@supabase/supabase-js'
import { sendSms, twilioReady } from '../_shared/twilio.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INTERNAL_FUNCTION_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? ''

Deno.serve(async (req) => {
  const key = req.headers.get('x-runner-key')
  if (!INTERNAL_FUNCTION_SECRET || key !== INTERNAL_FUNCTION_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }
  if (!twilioReady) {
    return new Response(JSON.stringify({ error: 'Twilio not configured' }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: clients, error } = await supabase
    .from('prymal_clients')
    .select('id, phone_number')
    .eq('phone_verified', true)
    .not('phone_number', 'is', null)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  let sent = 0
  for (const client of clients ?? []) {
    try {
      const [{ data: handled }, { count: watching }] = await Promise.all([
        supabase
          .from('prymal_approval_queue')
          .select('summary, status')
          .eq('client_id', client.id)
          .eq('status', 'approved')
          .gte('created_at', weekAgo)
          .order('created_at', { ascending: false }),
        supabase
          .from('prymal_standing_instructions')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', 'active'),
      ])

      const n = handled?.length ?? 0
      const w = watching ?? 0
      if (n === 0 && w === 0) continue // silence is a feature

      const top = n > 0 ? ` Biggest one: ${handled![0].summary.toLowerCase()}.` : ''
      const watchLine = w > 0 ? ` I'm still watching ${w} thing${w === 1 ? '' : 's'} for you.` : ''
      const body =
        n > 0
          ? `Your week: ${n} thing${n === 1 ? '' : 's'} handled, every one with your yes.${top}${watchLine}\n— A`
          : `Quiet week — nothing needed your yes.${watchLine}\n— A`

      if (await sendSms(client.phone_number as string, body)) sent++
    } catch (err) {
      console.error('digest failed for client', client.id, err)
    }
  }

  return new Response(JSON.stringify({ clients: clients?.length ?? 0, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
