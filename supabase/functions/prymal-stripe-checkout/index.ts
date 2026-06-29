import Stripe from 'npm:stripe'
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_PUBLISHABLE_KEY = Deno.env.get('STRIPE_PUBLISHABLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Product IDs from Stripe
const TIER_PRODUCTS: Record<string, { productId: string; priceId: string; name: string; mode: 'subscription' | 'payment' }> = {
  // $5 one-time trial — create this product in Stripe dashboard: $5 one-time, name "7-Day Trial Access"
  // Then replace STRIPE_TRIAL_PRICE_ID with the actual price ID
  trial_access: { productId: 'prod_trial', priceId: Deno.env.get('STRIPE_TRIAL_PRICE_ID') ?? 'price_trial_placeholder', name: '7-Day Trial Access', mode: 'payment' },
  tier1: { productId: 'prod_UmbUZ2NASZSR1D', priceId: 'price_1Tn2I5Er3TvCaWKF0s9jjuwR', name: 'Tier 1 - Email Management', mode: 'subscription' },
  tier2: { productId: 'prod_UmbU1XY7wiWHZ4', priceId: 'price_1Tn2I7Er3TvCaWKF3I1THG4O', name: 'Tier 2 - Calendar & Tasks', mode: 'subscription' },
  tier3: { productId: 'prod_UmbU26BC8sMYhf', priceId: 'price_1Tn2I9Er3TvCaWKFAG5p0PlU', name: 'Tier 3 - Drive & Docs', mode: 'subscription' },
  tier4: { productId: 'prod_UmbUsj4DRsyIQl', priceId: 'price_1Tn2IBEr3TvCaWKFfwvbpPED', name: 'Tier 4 - Full Access', mode: 'subscription' },
}

// Coupon giving $5 off first month (used when trial users upgrade)
// Create this coupon in Stripe dashboard: $5 off once, id "TRIAL_CREDIT_5"
const TRIAL_UPGRADE_COUPON = 'TRIAL_CREDIT_5'

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

    const { plan, fromTrial } = await req.json()
    if (!plan || !TIER_PRODUCTS[plan]) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 })
    }

    // Get or create Stripe customer
    const { data: clientData } = await supabase
      .from('prymal_clients')
      .select('stripe_customer_id, owner_email, plan')
      .eq('user_id', user.id)
      .single()

    const stripe = new Stripe(STRIPE_SECRET_KEY)
    let customerId = clientData?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clientData?.owner_email || user.email,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('prymal_clients').update({ stripe_customer_id: customerId }).eq('user_id', user.id)
    }

    // Create checkout session
    const tierProduct = TIER_PRODUCTS[plan]
    const isTrialPurchase = plan === 'trial_access'
    // Apply $5 credit coupon when a trial user upgrades to a paid plan
    const applyTrialCredit = !isTrialPurchase && (fromTrial || clientData?.plan === 'trial')

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customerId,
      line_items: [{ price: tierProduct.priceId, quantity: 1 }],
      mode: tierProduct.mode,
      success_url: isTrialPurchase
        ? `${new URL(req.url).origin}/dashboard?trial=started`
        : `${new URL(req.url).origin}/dashboard?payment=success&plan=${plan}`,
      cancel_url: `${new URL(req.url).origin}/dashboard/settings?tab=billing`,
      metadata: { user_id: user.id, plan },
    }

    // Attach coupon for upgrading trial users ($5 off first month)
    if (applyTrialCredit && tierProduct.mode === 'subscription') {
      sessionParams.discounts = [{ coupon: TRIAL_UPGRADE_COUPON }]
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    })

  } catch (err) {
    console.error('Stripe checkout error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }
})
