import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { Check, ChevronDown, Gift } from 'lucide-react'

const PLANS = [
  {
    id: 'tier1',
    name: 'Tier 1',
    price: '$17',
    period: '/month',
    description: 'Email mastery',
    features: ['Email composition & drafting', 'Read, send, manage emails', 'Labels, filters, threads', 'Schedule sends & auto-reply'],
    cta: 'Start with Tier 1',
    highlight: false,
  },
  {
    id: 'tier2',
    name: 'Tier 2',
    price: '$47',
    period: '/month',
    description: 'Everything in Tier 1 +',
    features: ['Everything in Tier 1', 'Calendar management', 'Appointment scheduling', 'Google Tasks integration'],
    cta: 'Start with Tier 2',
    highlight: false,
  },
  {
    id: 'tier3',
    name: 'Tier 3',
    price: '$97',
    period: '/month',
    description: 'Everything in Tier 2 +',
    features: ['Everything in Tier 2', 'Google Drive management', 'Docs, Sheets, Slides', 'Content automation'],
    cta: 'Start with Tier 3',
    highlight: true,
  },
  {
    id: 'tier4',
    name: 'Tier 4',
    price: '$147',
    period: '/month',
    description: 'Everything in Tier 3 +',
    features: ['Everything in Tier 3', 'Google Meet scheduling', 'Google Contacts management', 'Google Business Profile'],
    cta: 'Start with Tier 4',
    highlight: false,
  },
]

const INDUSTRIES = ['Fitness & Wellness', 'Restaurant & Food', 'Retail', 'Healthcare', 'Legal', 'Real Estate', 'Home Services', 'Beauty & Spa', 'Auto', 'Other']

function CustomDropdown({ value, onChange, options, placeholder }: { value: string; onChange: (val: string) => void; options: string[]; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-lg px-3 py-2.5 text-sm text-left text-white placeholder-zinc-600 focus:outline-none transition-all flex items-center justify-between"
        style={{ background: 'rgba(0,212,255,0.04)', border: open ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(0,212,255,0.12)' }}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50"
          style={{ background: '#ffffff', border: '1px solid rgba(0,212,255,0.2)' }}
        >
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className="w-full px-3 py-2 text-sm text-left text-gray-900 hover:bg-blue-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [policiesAcknowledged, setPoliciesAcknowledged] = useState(false)
  const [form, setForm] = useState({
    business_name: '',
    industry: '',
    website: '',
    contact_name: '',
    brand_tone: '',
    knowledge_base: '',
    delivery_cadence: '',
  })

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  async function saveStep1() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Upsert client record
    const { data: existing } = await supabase.from('prymal_clients').select('id').eq('user_id', user.id).single()
    if (existing) {
      await supabase.from('prymal_clients').update({
        business_name: form.business_name,
        industry: form.industry,
        website: form.website || null,
        contact_name: form.contact_name,
      }).eq('id', existing.id)
    } else {
      await supabase.from('prymal_clients').insert({
        user_id: user.id,
        owner_email: user.email,
        business_name: form.business_name,
        industry: form.industry,
        website: form.website || null,
        contact_name: form.contact_name,
        contact_email: user.email,
        plan: 'trial',
        status: 'active',
      })
    }
    setSaving(false)
    setStep(2)
  }

  async function saveStep2() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('prymal_clients').update({
      brand_tone: form.brand_tone,
      knowledge_base: form.knowledge_base,
      delivery_cadence: form.delivery_cadence || null,
    }).eq('user_id', user.id)
    setSaving(false)
    setStep(3)
  }

  async function choosePlan(planId: string) {
    if (!policiesAcknowledged) {
      alert('Please acknowledge our policies before continuing')
      return
    }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }

      // Mark onboarding complete so the return URL from Stripe lands on dashboard
      await supabase.from('prymal_clients').update({
        onboarding_complete: true,
      }).eq('user_id', session.user.id)

      // Call Stripe checkout Edge Function
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
      } else {
        // Fallback: just go to dashboard if checkout fails
        navigate('/dashboard')
      }
    } catch (err) {
      console.error('Error starting checkout:', err)
      navigate('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  async function startFreeTrial() {
    if (!policiesAcknowledged) {
      alert('Please acknowledge our policies before continuing')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('prymal_clients').update({
          plan: 'trial',
          onboarding_complete: true,
        }).eq('user_id', user.id)
      }
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all'
  const inputStyle = { background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#03070f' }}>
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="w-full max-w-3xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-xl font-bold tracking-widest mb-1">
            <span className="text-white">PRYMAL</span>
            <span style={{ color: '#00d4ff' }}>AI</span>
          </div>
          <p className="text-xs tracking-widest" style={{ color: 'rgba(0,212,255,0.5)' }}>WELCOME — LET'S GET YOU SET UP</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {['Business Info', 'Brand Settings', 'Choose Plan'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={step > i + 1
                    ? { background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.5)', color: '#4ade80' }
                    : step === i + 1
                    ? { background: 'rgba(0,212,255,0.2)', border: '1px solid rgba(0,212,255,0.5)', color: '#00d4ff' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
                  }
                >
                  {step > i + 1 ? <Check size={12} /> : i + 1}
                </div>
                <span className="text-xs tracking-wide hidden sm:block" style={{ color: step === i + 1 ? '#00d4ff' : 'rgba(255,255,255,0.3)' }}>{label}</span>
              </div>
              {i < 2 && <div className="w-8 h-px" style={{ background: step > i + 1 ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)' }} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="rounded-xl p-6" style={{ background: 'rgba(8,13,22,0.95)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <h2 className="text-white font-bold tracking-wide mb-1">Business Details</h2>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Tell us about the business you're setting up agents for.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'business_name', label: 'BUSINESS NAME *', placeholder: 'Bioneer Fitness', type: 'text' },
                { key: 'contact_name', label: 'YOUR NAME *', placeholder: 'John Smith', type: 'text' },
                { key: 'website', label: 'WEBSITE', placeholder: 'https://example.com', type: 'text' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold tracking-widest mb-1.5" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
                  <input type={type} placeholder={placeholder} {...field(key as keyof typeof form)} className={inputClass} style={inputStyle}
                    onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.4)' }}
                    onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)' }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold tracking-widest mb-1.5" style={{ color: 'rgba(0,212,255,0.5)' }}>INDUSTRY</label>
                <CustomDropdown value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e }))} options={INDUSTRIES} placeholder="Select industry…" />
              </div>
            </div>
            <button
              onClick={saveStep1}
              disabled={saving || !form.business_name || !form.contact_name}
              className="mt-6 w-full py-2.5 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.08))', border: '1px solid rgba(0,212,255,0.35)', color: '#00d4ff' }}
            >
              {saving ? 'SAVING…' : 'NEXT →'}
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="rounded-xl p-6" style={{ background: 'rgba(8,13,22,0.95)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <h2 className="text-white font-bold tracking-wide mb-1">Brand Settings</h2>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>The agents use this to match your voice and stay on-brand. You can update anytime.</p>
            <div className="flex flex-col gap-4">
              {[
                { key: 'brand_tone', label: 'BRAND TONE *', placeholder: 'Professional, friendly, and motivating. We inspire people to take action.', rows: 2 },
                { key: 'knowledge_base', label: 'ABOUT YOUR BUSINESS *', placeholder: 'What you do, who you serve, what makes you different, key services/products, pricing, location…', rows: 5 },
                { key: 'delivery_cadence', label: 'CONTENT CADENCE', placeholder: 'e.g. 3 social posts per week, daily review responses', rows: 1 },
              ].map(({ key, label, placeholder, rows }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold tracking-widest mb-1.5" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
                  <textarea rows={rows} placeholder={placeholder} {...field(key as keyof typeof form)} className={`${inputClass} resize-none`} style={inputStyle}
                    onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.4)' }}
                    onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 text-xs font-semibold tracking-widest rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>← BACK</button>
              <button
                onClick={saveStep2}
                disabled={saving || !form.brand_tone || !form.knowledge_base}
                className="flex-1 py-2.5 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.08))', border: '1px solid rgba(0,212,255,0.35)', color: '#00d4ff' }}
              >
                {saving ? 'SAVING…' : 'NEXT →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Plan selection */}
        {step === 3 && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-white font-bold tracking-wide">Choose Your Plan</h2>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Every plan includes a 7-day free trial. No charge until your trial ends.</p>
            </div>

            {/* Trial callout */}
            <div
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm font-semibold"
              style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff' }}
            >
              <Gift size={16} />
              7-day free trial · Cancel anytime · No credit card charged today
            </div>

            {/* Policy Acknowledgment */}
            <div className="mb-8 p-4 rounded-lg" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policiesAcknowledged}
                  onChange={e => setPoliciesAcknowledged(e.target.checked)}
                  className="mt-1 w-4 h-4 cursor-pointer"
                  style={{ accentColor: '#00d4ff' }}
                />
                <span className="text-xs text-slate-300">
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
                    Privacy Policy
                  </a>
                  {', '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
                    Terms of Service
                  </a>
                  {', and '}
                  <a href="/security" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
                    Security Policy
                  </a>
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  className="rounded-xl p-5 flex flex-col"
                  style={{
                    background: plan.highlight ? 'rgba(0,212,255,0.06)' : 'rgba(8,13,22,0.95)',
                    border: plan.highlight ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(0,212,255,0.12)',
                    boxShadow: plan.highlight ? '0 0 30px rgba(0,212,255,0.08)' : 'none',
                  }}
                >
                  {plan.highlight && (
                    <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#00d4ff' }}>MOST POPULAR</div>
                  )}
                  <div className="mb-4">
                    <p className="text-white font-bold tracking-wide">{plan.name}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-white">{plan.price}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.period}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{plan.description}</p>
                  </div>
                  <ul className="flex flex-col gap-1.5 flex-1 mb-5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        <Check size={11} className="mt-0.5 shrink-0" style={{ color: '#00d4ff' }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => choosePlan(plan.id)}
                    disabled={saving}
                    className="w-full py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                    style={plan.highlight
                      ? { background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,212,255,0.1))', border: '1px solid rgba(0,212,255,0.5)', color: '#00d4ff' }
                      : { background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }
                    }
                  >
                    {saving ? '…' : 'Start 7-Day Trial'}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setStep(2)} className="text-xs tracking-wide text-zinc-600 hover:text-zinc-400 transition-colors">← Back</button>
              <button
                onClick={startFreeTrial}
                disabled={saving}
                className="text-xs tracking-wide transition-colors disabled:opacity-40"
                style={{ color: 'rgba(255,255,255,0.25)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
              >
                Skip for now — explore free →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
