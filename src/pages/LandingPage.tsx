import { useNavigate } from 'react-router-dom'
import { Mail, Calendar, HardDrive, Shield, Zap, ChevronRight, Star } from 'lucide-react'

const FEATURES = [
  {
    icon: <Mail size={20} style={{ color: '#00d4ff' }} />,
    title: 'Inbox, handled.',
    description: 'Ask "what emails need my attention today?" and get a prioritized summary. Reply to anything in seconds.',
  },
  {
    icon: <Calendar size={20} style={{ color: '#00d4ff' }} />,
    title: 'Calendar, spoken.',
    description: '"What\'s on my schedule this week?" or "block Thursday afternoon for deep work" — just say it.',
  },
  {
    icon: <HardDrive size={20} style={{ color: '#00d4ff' }} />,
    title: 'Drive, searchable.',
    description: 'Find any file, read any doc. "Summarize last quarter\'s report" and it\'s done in seconds.',
  },
  {
    icon: <Shield size={20} style={{ color: '#00d4ff' }} />,
    title: 'You approve everything.',
    description: 'Prymal drafts, you decide. Nothing sends without your sign-off. Full control, zero risk.',
  },
]

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Get started — no credit card needed',
    features: [
      'AI chat interface',
      'Gmail inbox summaries & search',
      'Calendar view & availability',
      'Google Drive file search',
    ],
    cta: 'Get started free',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$20',
    period: '/mo',
    description: 'For freelancers & solopreneurs',
    features: [
      'Everything in Free',
      'Send emails via AI (you approve)',
      'Create & manage calendar events',
      'Read & summarize Drive docs',
      'Brand tone memory',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$50',
    period: '/mo',
    description: 'For small business owners',
    features: [
      'Everything in Starter',
      'Google Business Profile management',
      'AI review responses',
      'Reputation monitoring',
      'Priority support',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '$100',
    period: '/mo',
    description: 'For agencies & multi-location businesses',
    features: [
      'Everything in Pro',
      'Multi-client management',
      'White-label dashboard',
      'Team access',
      'Dedicated support',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
]

const TESTIMONIALS = [
  {
    text: "I used to spend 2 hours a day on email. Now I open Prymal, ask what needs my attention, and I'm done in 20 minutes.",
    name: 'Sarah M.',
    role: 'Freelance Designer',
  },
  {
    text: "It actually reads my emails and tells me what matters. Not just search — it understands context.",
    name: 'James T.',
    role: 'Small Business Owner',
  },
  {
    text: "The approval flow is brilliant. My AI does the work, I just hit approve. Nothing goes out without me seeing it first.",
    name: 'Priya K.',
    role: 'Marketing Consultant',
  },
]

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen"
      style={{ background: '#060b14', color: 'white', fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-50"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.08)', backdropFilter: 'blur(20px)', background: 'rgba(6,11,20,0.9)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 8px #00d4ff' }} />
          <span className="text-sm font-bold tracking-widest" style={{ color: '#00d4ff' }}>PRYMAL AI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-sm px-4 py-2 rounded-lg transition-all"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm px-4 py-2 rounded-lg font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
              border: '1px solid rgba(0,212,255,0.35)',
              color: '#00d4ff',
            }}
          >
            Get started free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,212,255,0.1) 0%, transparent 70%)' }}
        />

        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
        >
          <Zap size={11} />
          Your Google inbox, calendar & Drive — now with AI
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-none"
          style={{ maxWidth: '800px' }}
        >
          Stop managing Google.
          <br />
          <span style={{ color: '#00d4ff' }}>Start talking to it.</span>
        </h1>

        <p
          className="text-lg md:text-xl mb-10 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '560px' }}
        >
          Prymal is an AI agent that reads your Gmail, knows your calendar, and searches your Drive —
          then acts on your behalf with your approval.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-12">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold tracking-wide transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(0,212,255,0.12) 100%)',
              border: '1px solid rgba(0,212,255,0.4)',
              color: '#00d4ff',
              boxShadow: '0 0 40px rgba(0,212,255,0.15)',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 60px rgba(0,212,255,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 40px rgba(0,212,255,0.15)' }}
          >
            Try it free — no credit card
            <ChevronRight size={16} />
          </button>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            7-day free trial · Cancel anytime
          </p>
        </div>

        {/* Chat demo mockup */}
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{
            maxWidth: '580px',
            background: 'rgba(6,11,20,0.97)',
            border: '1px solid rgba(0,212,255,0.15)',
            boxShadow: '0 0 80px rgba(0,212,255,0.1), 0 40px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* Chat header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>PRYMAL AI</span>
          </div>
          {/* Messages */}
          <div className="px-4 py-4 flex flex-col gap-3 text-left">
            {[
              { role: 'user', text: 'What emails need my attention today?' },
              { role: 'ai', text: '3 emails need action:\n\n1. Invoice from Acme Corp ($2,400) — due in 2 days, no reply yet\n2. Client proposal request from Jordan Lee — asks for quote by Friday\n3. Meeting reschedule from your 3pm call — they want Thursday instead\n\nWant me to draft replies to any of these?' },
              { role: 'user', text: 'Yes, reply to Jordan with my standard proposal template' },
              { role: 'ai', text: 'Done — draft queued for your approval. I used your brand tone and attached your standard rate sheet. Review it in the approval panel when you\'re ready.' },
            ].map((m, i) => (
              <div
                key={i}
                className="px-3.5 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-line"
                style={
                  m.role === 'user'
                    ? {
                        alignSelf: 'flex-end',
                        maxWidth: '80%',
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.22) 0%, rgba(0,212,255,0.1) 100%)',
                        border: '1px solid rgba(0,212,255,0.3)',
                        color: '#e0f7ff',
                        borderBottomRightRadius: '4px',
                      }
                    : {
                        alignSelf: 'flex-start',
                        maxWidth: '88%',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.8)',
                        borderBottomLeftRadius: '4px',
                      }
                }
              >
                {m.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-widest font-semibold text-center mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>
            WHAT PRYMAL DOES
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight">
            One AI. All your Google tools.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(0,212,255,0.1)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}
                >
                  {f.icon}
                </div>
                <h3 className="text-base font-bold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="px-6 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-widest font-semibold text-center mb-12" style={{ color: 'rgba(0,212,255,0.5)' }}>
            EARLY USERS
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 flex flex-col gap-4"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={12} fill="#00d4ff" style={{ color: '#00d4ff' }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>"{t.text}"</p>
                <div>
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-widest font-semibold text-center mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>
            PRICING
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">
            Simple, honest pricing.
          </h2>
          <p className="text-center text-sm mb-16" style={{ color: 'rgba(255,255,255,0.35)' }}>
            7-day free trial on all plans. No credit card required to start.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRICING.map((p, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 flex flex-col gap-5"
                style={{
                  background: p.highlight ? 'rgba(0,212,255,0.05)' : 'rgba(255,255,255,0.02)',
                  border: p.highlight ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: p.highlight ? '0 0 40px rgba(0,212,255,0.08)' : 'none',
                  position: 'relative',
                }}
              >
                {p.highlight && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold tracking-widest"
                    style={{ background: '#00d4ff', color: '#060b14' }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.6)' }}>
                    {p.name.toUpperCase()}
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold">{p.price}</span>
                    <span className="text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.period}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.description}</p>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      <span className="mt-0.5 flex-shrink-0" style={{ color: '#00d4ff' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-auto w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all"
                  style={
                    p.highlight
                      ? {
                          background: 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(0,212,255,0.12) 100%)',
                          border: '1px solid rgba(0,212,255,0.4)',
                          color: '#00d4ff',
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.6)',
                        }
                  }
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="px-6 py-24 text-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{ height: '400px', background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(0,212,255,0.07) 0%, transparent 70%)' }}
        />
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
          Your inbox won't manage itself.
          <br />
          <span style={{ color: '#00d4ff' }}>Prymal will.</span>
        </h2>
        <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: '420px', margin: '0 auto 2.5rem' }}>
          Join the waitlist and get early access at founding member pricing.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-sm font-bold tracking-wide transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(0,212,255,0.12) 100%)',
            border: '1px solid rgba(0,212,255,0.4)',
            color: '#00d4ff',
            boxShadow: '0 0 60px rgba(0,212,255,0.15)',
          }}
        >
          Get early access — free
          <ChevronRight size={16} />
        </button>
      </section>

      {/* Footer */}
      <footer
        className="px-6 py-8 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4ff' }} />
          <span className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,212,255,0.6)' }}>PRYMAL AI</span>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © 2026 PrymalAI. All rights reserved.
        </p>
        <div className="flex gap-4">
          {['Privacy', 'Terms', 'Contact'].map(l => (
            <a key={l} href="#" className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.25)' }}
            >
              {l}
            </a>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
