// Origin allowlist for browser-facing functions. Server-to-server callers
// (Twilio, Stripe, internal) don't send an Origin and are unaffected.
const DEFAULT_ALLOWED = [
  'https://askalfy.com',
  'https://www.askalfy.com',
  'https://app.prymalai.com',
  'https://prymalai.com',
  'http://localhost:5173',
  'http://localhost:4321',
]

const extra = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
const ALLOWED = new Set([...DEFAULT_ALLOWED, ...extra])

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : DEFAULT_ALLOWED[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-internal-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
