// Twilio SMS webhook → Alfy. Validates the Twilio signature, matches the sender
// to a verified client, replies asynchronously via the Twilio REST API.
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''
const INTERNAL_FUNCTION_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'askalfy.com'

const HISTORY_LIMIT = 12

async function validateTwilioSignature(req: Request, params: Record<string, string>): Promise<boolean> {
  const signature = req.headers.get('x-twilio-signature')
  if (!signature || !TWILIO_AUTH_TOKEN) return false
  // Twilio: signature = HMAC-SHA1(url + sorted concatenated POST params, auth token), base64
  const url = new URL(req.url)
  // Reconstruct public URL (Supabase terminates TLS; Twilio signs the public https URL)
  const publicUrl = `https://${url.host}${url.pathname}${url.search}`
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('')
  const data = publicUrl + sorted
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(TWILIO_AUTH_TOKEN),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return expected === signature
}

async function sendSms(to: string, bodyText: string): Promise<void> {
  // SMS practical limit — split long replies into up to 3 chunks
  const chunks: string[] = []
  let rest = bodyText.trim()
  while (rest.length > 0 && chunks.length < 3) {
    chunks.push(rest.slice(0, 1500))
    rest = rest.slice(1500)
  }
  for (const chunk of chunks) {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: TWILIO_PHONE_NUMBER, To: to, Body: chunk }),
    })
  }
}

async function processMessage(clientId: string, from: string, text: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  try {
    // Rolling history
    const { data: histRows } = await supabase
      .from('prymal_sms_history')
      .select('role, content')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
    const history = (histRows ?? []).reverse()

    await supabase.from('prymal_sms_history').insert({ client_id: clientId, role: 'user', content: text })

    const res = await fetch(`${SUPABASE_URL}/functions/v1/prymal-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': INTERNAL_FUNCTION_SECRET,
      },
      body: JSON.stringify({ client_id: clientId, message: text, history, channel: 'sms' }),
    })
    const data = await res.json()
    const reply: string = data.reply ?? data.error ?? "Something went wrong — try again in a minute, or use the dashboard."

    await supabase.from('prymal_sms_history').insert({ client_id: clientId, role: 'assistant', content: reply })
    await sendSms(from, reply)

    // Keep history table bounded
    const { data: old } = await supabase
      .from('prymal_sms_history')
      .select('id')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .range(40, 200)
    if (old?.length) {
      await supabase.from('prymal_sms_history').delete().in('id', old.map(r => r.id))
    }
  } catch (err) {
    console.error('SMS processing error:', err)
    await sendSms(from, 'Alfy hit a snag processing that. Try again in a minute.')
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const form = await req.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  const valid = await validateTwilioSignature(req, params)
  if (!valid) {
    console.error('Invalid Twilio signature')
    return new Response('Forbidden', { status: 403 })
  }

  const from = params['From'] ?? ''
  const text = (params['Body'] ?? '').trim()
  const twiml = (msg?: string) =>
    new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ''}</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )

  if (!from || !text) return twiml()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: client } = await supabase
    .from('prymal_clients')
    .select('id, phone_verified, plan')
    .eq('phone_number', from)
    .maybeSingle()

  if (!client || !client.phone_verified) {
    return twiml(`This number isn't linked to an Alfy account yet. Verify your phone in Settings at ${APP_URL}`)
  }

  // Answer the webhook instantly; think + reply in the background
  // deno-lint-ignore no-explicit-any
  ;(globalThis as any).EdgeRuntime?.waitUntil
    ? (globalThis as any).EdgeRuntime.waitUntil(processMessage(client.id, from, text))
    : processMessage(client.id, from, text)

  return twiml()
})
