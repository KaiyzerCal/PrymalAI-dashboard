import { useNavigate } from 'react-router-dom'
import { Mail, Calendar, HardDrive, Shield, Lock, Eye, Trash2, Gift, ChevronRight } from 'lucide-react'
import { getAvailableTiers } from '@/lib/tierConfig'

const FEATURES = [
  {
    icon: <Mail size={20} style={{ color: '#00d4ff' }} />,
    title: 'Inbox, handled.',
    description: 'Ask "what needs my attention today?" and get a prioritized briefing — not a list of 47 unread. Prymal reads for context, surfaces what matters, drafts replies. You approve before anything sends.',
  },
  {
    icon: <Calendar size={20} style={{ color: '#00d4ff' }} />,
    title: 'Calendar, spoken.',
    description: '"Block Thursday afternoon for deep work" or "find a time for a 45-minute call with Jordan this week." It checks your actual availability, proposes slots, books only when you confirm.',
  },
  {
    icon: <HardDrive size={20} style={{ color: '#00d4ff' }} />,
    title: 'Drive, searchable.',
    description: '"Summarize last quarter\'s report" or "find the NDA we signed with Acme." Prymal reads your Drive and returns the answer — not a list of files to click through.',
  },
  {
    icon: <Shield size={20} style={{ color: '#00d4ff' }} />,
    title: 'You hold the wheel.',
    description: 'Every email draft, every calendar change, every file move goes into an approval queue first. Prymal proposes. You decide. Nothing touches your accounts without your explicit sign-off.',
  },
]

const TRUST_POINTS = [
  {
    icon: <Lock size={18} style={{ color: '#00d4ff' }} />,
    title: 'OAuth only. No passwords stored.',
    description: 'Prymal connects to Google via official OAuth 2.0. We never see your password. Revoke access from your Google account settings at any time.',
  },
  {
    icon: <Eye size={18} style={{ color: '#00d4ff' }} />,
    title: 'Approval queue on every action.',
    description: 'Nothing sends, moves, or changes without appearing in your approval panel first. You review each proposed action before it executes.',
  },
  {
    icon: <Trash2 size={18} style={{ color: '#00d4ff' }} />,
    title: 'Delete everything, anytime.',
    description: 'Request full account deletion and every piece of your data — conversation history, stored context, OAuth tokens — is purged.',
  },
]

// Build pricing from tier configs
const PRICING = getAvailableTiers()
  .filter(tier => tier.level !== 'free')
  .map(tier => ({
    name: tier.name,
    price: `$${tier.price}`,
    period: '/mo',
    description: tier.description,
    features: tier.features.slice(0, 5),
    apis: tier.apis,
    highlight: tier.level === 'tier3',
  }))

const CTA_TEXT = 'Start your 7-day trial — $5 · Credited to your first month. Cancel anytime.'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen"
      style={{ background: '#060b14', color: 'white', fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Founding-100 scarcity banner */}
      <div
        className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-center"
        style={{ background: 'rgba(255,160,0,0.08)', borderBottom: '1px solid rgba(255,160,0,0.2)', color: 'rgba(255,160,0,0.9)', letterSpacing: '0.02em' }}
      >
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ffa500', boxShadow: '0 0 6px #ffa500', flexShrink: 0 }} />
        Founding 100 members — locking in the lowest price this product will ever be at.
        <button
          onClick={() => navigate('/login')}
          className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold"
          style={{ background: 'rgba(255,160,0,0.15)', border: '1px solid rgba(255,160,0,0.35)', color: '#ffa500' }}
        >
          Claim your spot →
        </button>
      </div>

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
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            Start for $5
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
          Your inbox, calendar, and Drive — run by an AI you control
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-none"
          style={{ maxWidth: '860px' }}
        >
          An AI runs your inbox,
          <br />
          calendar, and Drive.
          <br />
          <span style={{ color: '#00d4ff' }}>You approve every move.</span>
        </h1>

        <p
          className="text-lg md:text-xl mb-10 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '560px' }}
        >
          Prymal handles the operational grind across your Google tools — reading, drafting, scheduling,
          searching — and puts every proposed action in front of you before it executes.
          You get the leverage of an AI assistant with zero loss of control.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
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
            Start your 7-day trial for $5
            <ChevronRight size={16} />
          </button>
        </div>
        <p className="text-xs mb-14" style={{ color: 'rgba(255,255,255,0.25)' }}>
          $5 credited toward your first month if you upgrade. Cancel anytime.
        </p>

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
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff', animation: 'pulse-dot 2s infinite' }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>PRYMAL AI</span>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3 text-left">
            {[
              { role: 'user', text: 'What emails need my attention today?' },
              { role: 'ai', text: '3 emails need action:\n\n1. Invoice from Acme Corp ($2,400) — due in 2 days, no reply yet\n2. Client proposal request from Jordan Lee — asks for quote by Friday\n3. Meeting reschedule from your 3pm call — they want Thursday instead\n\nWant me to draft replies to any of these?' },
              { role: 'user', text: 'Yes, reply to Jordan with my standard proposal template' },
              { role: 'ai', text: 'Done — draft queued for your approval. I used your brand tone and attached your standard rate sheet. Review it in the approval panel when you\'re ready.\n\n⚡ Nothing has been sent yet. You approve before it goes.' },
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
          {/* Demo caption */}
          <div
            className="px-4 py-3 text-xs text-center"
            style={{ borderTop: '1px solid rgba(0,212,255,0.08)', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}
          >
            This is a real Prymal session. It read the inbox, prioritized what mattered, and queued a reply — waiting for approval. It never acts alone.
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-widest font-semibold text-center mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>
            WHAT PRYMAL DOES
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">
            One AI. All your Google tools.
          </h2>
          <p className="text-base text-center mb-16" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: '480px', margin: '0 auto 4rem' }}>
            Prymal connects to Gmail, Calendar, Drive, Tasks, Contacts, and Meet through Google's official APIs.
            You can expand or restrict access at any time.
          </p>
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

      {/* Trust section */}
      <section className="px-6 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-widest font-semibold text-center mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>
            SECURITY & CONTROL
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">
            Built on Trust.
          </h2>
          <p className="text-base text-center mb-14" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: '500px', margin: '0 auto 3.5rem' }}>
            You're handing an AI access to your most sensitive tools. Here's exactly how we've structured that.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TRUST_POINTS.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(0,212,255,0.03)',
                  border: '1px solid rgba(0,212,255,0.12)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}
                >
                  {t.icon}
                </div>
                <h3 className="text-sm font-bold mb-2">{t.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{t.description}</p>
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
          <p className="text-sm text-center mb-4" style={{ color: 'rgba(255,255,255,0.3)', maxWidth: '460px', margin: '0 auto 1rem' }}>
            The $5 trial gives you 7 days and 75 AI actions — enough to run your inbox for a week and decide if this is worth it.
            Each action is one AI task: read an email, draft a reply, check a calendar event.
            If you upgrade, the $5 comes off your first month.
          </p>
          <div className="flex justify-center mb-14">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff' }}
            >
              <Gift size={14} />
              All plans start with the same $5 / 7-day trial
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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

                {p.apis && p.apis.length > 0 && (
                  <div className="pt-2 border-t" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(0,212,255,0.6)' }}>GOOGLE TOOLS</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.apis.map((api, j) => (
                        <span
                          key={j}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: 'rgba(0,212,255,0.08)',
                            border: '1px solid rgba(0,212,255,0.15)',
                            color: 'rgba(0,212,255,0.7)',
                          }}
                        >
                          {api}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

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
                  Start for $5
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="relative px-6 py-24 text-center overflow-hidden"
      >
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: '400px', background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(0,212,255,0.07) 0%, transparent 70%)' }}
        />
        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Your inbox won't manage itself.
            <br />
            <span style={{ color: '#00d4ff' }}>Prymal will.</span>
          </h2>
          <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: '460px', margin: '0 auto 2.5rem' }}>
            Start today for $5. Seven days, seventy-five actions, your first month credited if you stay.
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
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 80px rgba(0,212,255,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 60px rgba(0,212,255,0.15)' }}
          >
            {CTA_TEXT}
            <ChevronRight size={16} />
          </button>
          <p className="text-xs mt-5" style={{ color: 'rgba(255,255,255,0.18)' }}>
            No commitment. Cancel from settings in 30 seconds.
          </p>
        </div>
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
          {['Privacy', 'Terms', 'Security', 'Contact'].map(link => (
            <a
              key={link}
              href={`/${link.toLowerCase()}`}
              className="text-xs transition-colors"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.25)' }}
            >
              {link}
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
