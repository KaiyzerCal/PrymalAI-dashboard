import Stripe from 'npm:stripe'
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify Stripe signature
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      // ── $5 trial one-time payment completed ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment' && session.metadata?.plan === 'trial_access') {
          const customerId = session.customer as string
          const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          await supabase.from('prymal_clients').update({
            plan: 'trial',
            status: 'active',
            trial_ends_at: trialEndsAt,
            trial_actions_used: 0,
            trial_daily_actions: 0,
            trial_daily_reset_date: null,
          }).eq('stripe_customer_id', customerId)
          console.log('Trial started for customer:', customerId, 'ends:', trialEndsAt)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = subscription.status
        const planId = subscription.metadata?.plan || extractPlanFromPrice(subscription.items.data[0].price)

        // Find user by Stripe customer ID
        const { data: clients } = await supabase
          .from('prymal_clients')
          .select('user_id')
          .eq('stripe_customer_id', customerId)

        if (clients && clients.length > 0) {
          await supabase.from('prymal_clients').update({
            plan: planId,
            status,
            stripe_subscription_id: subscription.id,
            trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          }).eq('stripe_customer_id', customerId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Reset to trial
        await supabase.from('prymal_clients').update({
          plan: 'trial',
          status: 'cancelled',
          stripe_subscription_id: null,
        }).eq('stripe_customer_id', customerId)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Send invoice email if needed (implementation in email service)
        console.log('Invoice paid:', invoice.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // Send failed payment email and alert
        console.log('Invoice failed:', invoice.id)
        // TODO: Send email notifying user of failed payment
        break
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription
        // Send trial ending email
        console.log('Trial ending:', subscription.id)
        // TODO: Send email reminding user trial ends soon
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error('Webhook processing error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})

function extractPlanFromPrice(price: Stripe.Price): string {
  // Extract plan from price nickname or metadata
  if (price.nickname?.includes('tier1')) return 'tier1'
  if (price.nickname?.includes('tier2')) return 'tier2'
  if (price.nickname?.includes('tier3')) return 'tier3'
  if (price.nickname?.includes('tier4')) return 'tier4'
  return 'trial'
}
