import { useState } from 'react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { Check, Gift, Lock } from 'lucide-react'

const PLANS = [
  {
    id: 'tier1',
    name: 'Tier 1',
    price: '$17',
    period: '/month',
    description: 'Email mastery',
    features: ['Email composition & drafting', 'Read, send, manage emails', 'Labels, filters, threads', 'Schedule sends & auto-reply'],
    highlight: false,
  },
  {
    id: 'tier2',
    name: 'Tier 2',
    price: '$47',
    period: '/month',
    description: 'Everything in Tier 1 +',
    features: ['Everything in Tier 1', 'Calendar management', 'Appointment scheduling', 'Google Tasks integration'],
    highlight: false,
  },
  {
    id: 'tier3',
    name: 'Tier 3',
    price: '$97',
    period: '/month',
    description: 'Everything in Tier 2 +',
    features: ['Everything in Tier 2', 'Google Drive management', 'Docs, Sheets, Slides', 'Content automation'],
    highlight: true,
  },
  {
    id: 'tier4',
    name: 'Tier 4',
    price: '$147',
    period: '/month',
    description: 'Everything in Tier 3 +',
    features: ['Everything in Tier 3', 'Google Meet scheduling', 'Google Contacts management', 'Google Business Profile'],
    highlight: false,
  },
]

export function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planId: string) {
    setLoading(planId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${FUNCTION_BASE}/prymal-stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: '#060b14', color: 'white', fontFamily: 'system-ui, sans-serif' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,212,255,0.08) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 8px #00d4ff' }} />
            <span className="text-sm font-bold tracking-widest" style={{ color: '#00d4ff' }}>PRYMAL AI</span>
          </div>

          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
            style={{ background: 'rgba(255,160,0,0.1)', border: '1px solid rgba(255,160,0,0.35)', color: '#ffa500' }}
          >
            <Lock size={14} />
            Your free trial has ended
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Ready to keep going?
          </h1>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '480px', margin: '0 auto' }}>
            Choose a plan to restore full access. Your data and settings are safe — pick up exactly where you left off.
          </p>
        </div>

        {/* Trial badge */}
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl mb-8 text-sm font-semibold"
          style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
        >
          <Gift size={15} />
          All plans include a new 7-day trial period · Cancel anytime
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className="rounded-2xl p-5 flex flex-col"
              style={{
                background: plan.highlight ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: plan.highlight ? '1px solid rgba(0,212,255,0.35)' : '1px solid rgba(255,255,255,0.07)',
                boxShadow: plan.highlight ? '0 0 40px rgba(0,212,255,0.08)' : 'none',
                position: 'relative',
              }}
            >
              {plan.highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold tracking-widest"
                  style={{ background: '#00d4ff', color: '#060b14' }}
                >
                  MOST POPULAR
                </div>
              )}

              <div className="mb-4">
                <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.6)' }}>
                  {plan.name.toUpperCase()}
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.period}</span>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{plan.description}</p>
              </div>

              <ul className="flex flex-col gap-2 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <Check size={11} className="mt-0.5 shrink-0" style={{ color: '#00d4ff' }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={!!loading}
                className="w-full py-2.5 text-xs font-bold tracking-widest rounded-xl transition-all disabled:opacity-50"
                style={plan.highlight
                  ? { background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,212,255,0.12))', border: '1px solid rgba(0,212,255,0.45)', color: '#00d4ff' }
                  : { background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }
                }
              >
                {loading === plan.id ? 'REDIRECTING…' : 'SUBSCRIBE NOW'}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Questions? <a href="/contact" className="underline" style={{ color: 'rgba(0,212,255,0.5)' }}>Contact us</a>
        </p>
      </div>
    </div>
  )
}
