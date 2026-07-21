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

// These endpoints authenticate every request with a Supabase Bearer JWT, so the
// origin allowlist is defense-in-depth, not the primary gate. To avoid blocking
// legitimate app/preview hosts, we reflect the caller's origin by DEFAULT and
// only enforce the strict allowlist when ALLOWED_ORIGINS is explicitly set.
const STRICT = extra.length > 0

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = STRICT
    ? (ALLOWED.has(origin) ? origin : DEFAULT_ALLOWED[0])
    : (origin || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-internal-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
