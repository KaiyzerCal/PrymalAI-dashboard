// Phone verification for the Text Alfy channel.
// actions: status | start (send code) | check (confirm code) | disconnect
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: client } = await supabase
      .from('prymal_clients')
      .select('id, phone_number, phone_verified, phone_verify_code, phone_verify_expires')
      .eq('user_id', user.id)
      .single()
    if (!client) return json({ error: 'Client not found' }, 404)

    const { action, phone, code } = await req.json()

    if (action === 'status') {
      return json({
        phone_number: client.phone_number,
        verified: client.phone_verified,
        alfy_number: client.phone_verified ? TWILIO_PHONE_NUMBER : null,
      })
    }

    if (action === 'start') {
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return json({ error: 'SMS is not configured yet. Contact support.' }, 500)
      }
      const normalized = String(phone ?? '').replace(/[^\d+]/g, '')
      if (!/^\+\d{10,15}$/.test(normalized)) {
        return json({ error: 'Enter your number in international format, e.g. +15551234567' }, 400)
      }
      // Number must not belong to another account
      const { data: taken } = await supabase
        .from('prymal_clients')
        .select('id')
        .eq('phone_number', normalized)
        .neq('id', client.id)
        .maybeSingle()
      if (taken) return json({ error: 'That number is already linked to another account.' }, 400)

      const verifyCode = String(Math.floor(100000 + Math.random() * 900000))
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      await supabase.from('prymal_clients').update({
        phone_number: normalized,
        phone_verified: false,
        phone_verify_code: verifyCode,
        phone_verify_expires: expires,
      }).eq('id', client.id)

      const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_PHONE_NUMBER,
          To: normalized,
          Body: `Your Prymal AI verification code is ${verifyCode}. It expires in 10 minutes.`,
        }),
      })
      const smsData = await smsRes.json()
      if (smsData.error_code || smsData.code) {
        return json({ error: `Couldn't send the code: ${smsData.message ?? 'unknown Twilio error'}` }, 500)
      }
      return json({ sent: true })
    }

    if (action === 'check') {
      if (!client.phone_verify_code || !client.phone_verify_expires) {
        return json({ error: 'No verification in progress. Start over.' }, 400)
      }
      if (new Date(client.phone_verify_expires) < new Date()) {
        return json({ error: 'Code expired. Request a new one.' }, 400)
      }
      if (String(code ?? '').trim() !== client.phone_verify_code) {
        return json({ error: 'Wrong code. Check the text and try again.' }, 400)
      }
      await supabase.from('prymal_clients').update({
        phone_verified: true,
        phone_verify_code: null,
        phone_verify_expires: null,
      }).eq('id', client.id)

      // Welcome text from Alfy
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_PHONE_NUMBER,
          To: client.phone_number!,
          Body: "Hey, it's Alfy 👋 You're connected. Text me anytime — try \"morning brief\" or \"what needs my attention?\" Save this number.",
        }),
      })

      return json({ verified: true, alfy_number: TWILIO_PHONE_NUMBER })
    }

    if (action === 'disconnect') {
      await supabase.from('prymal_clients').update({
        phone_number: null,
        phone_verified: false,
        phone_verify_code: null,
        phone_verify_expires: null,
      }).eq('id', client.id)
      return json({ disconnected: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
