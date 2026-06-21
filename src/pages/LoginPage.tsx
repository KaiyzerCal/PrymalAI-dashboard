import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'password' | 'magic' | 'signup'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [showReset, setShowReset] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      if (error) {
        setMessage({ text: error.message, ok: false })
      } else if (data.user) {
        // create initial client record so onboarding can find/update it
        await supabase.from('prymal_clients').upsert({
          user_id: data.user.id,
          owner_email: email,
          contact_name: name,
          plan: 'trial',
          status: 'active',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          onboarding_complete: false,
        }, { onConflict: 'user_id' })
        setMessage({ text: 'Account created! Redirecting to onboarding…', ok: true })
      }
    } else if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({ email })
      setMessage(
        error
          ? { text: error.message, ok: false }
          : { text: 'Check your email for a magic link.', ok: true }
      )
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage({ text: error.message, ok: false })
        if (error.message.toLowerCase().includes('invalid')) setShowReset(true)
      }
    }
    setLoading(false)
  }

  async function handleResetPassword() {
    if (!email) {
      setMessage({ text: 'Enter your email above first.', ok: false })
      return
    }
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setMessage(
      error
        ? { text: error.message, ok: false }
        : { text: 'Password reset link sent — check your email.', ok: true }
    )
    setShowReset(false)
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#03070f' }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial glow from top */}
      <div
        className="absolute inset-x-0 top-0 h-96 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(0,212,255,0.1) 0%, transparent 70%)',
        }}
      />

      {/* Corner accents */}
      <div className="absolute top-8 left-8 w-8 h-8 pointer-events-none" style={{ borderTop: '1px solid rgba(0,212,255,0.3)', borderLeft: '1px solid rgba(0,212,255,0.3)' }} />
      <div className="absolute top-8 right-8 w-8 h-8 pointer-events-none" style={{ borderTop: '1px solid rgba(0,212,255,0.3)', borderRight: '1px solid rgba(0,212,255,0.3)' }} />
      <div className="absolute bottom-8 left-8 w-8 h-8 pointer-events-none" style={{ borderBottom: '1px solid rgba(0,212,255,0.3)', borderLeft: '1px solid rgba(0,212,255,0.3)' }} />
      <div className="absolute bottom-8 right-8 w-8 h-8 pointer-events-none" style={{ borderBottom: '1px solid rgba(0,212,255,0.3)', borderRight: '1px solid rgba(0,212,255,0.3)' }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
            style={{
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.25)',
              boxShadow: '0 0 32px rgba(0,212,255,0.15)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L25 8V20L14 26L3 20V8L14 2Z" stroke="rgba(0,212,255,0.9)" strokeWidth="1.2" fill="rgba(0,212,255,0.06)" />
              <path d="M14 2L14 26M3 8L25 20M25 8L3 20" stroke="rgba(0,212,255,0.3)" strokeWidth="0.8" />
              <circle cx="14" cy="14" r="3" fill="rgba(0,212,255,0.6)" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tracking-widest">
              <span className="text-white">PRYMAL</span>
              <span style={{ color: '#00d4ff', textShadow: '0 0 16px rgba(0,212,255,0.6)' }}>AI</span>
            </div>
            <p className="text-xs tracking-widest mt-1" style={{ color: 'rgba(0,212,255,0.5)' }}>
              AUTONOMOUS DIGITAL INFRASTRUCTURE
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(8,13,22,0.95)',
            border: '1px solid rgba(0,212,255,0.15)',
            boxShadow: '0 0 40px rgba(0,212,255,0.06), inset 0 1px 0 rgba(0,212,255,0.05)',
          }}
        >
          <h1 className="text-sm font-semibold text-white tracking-widest mb-1">ACCESS PORTAL</h1>
          <p className="text-xs mb-6" style={{ color: 'rgba(0,212,255,0.45)' }}>
            Authenticate to enter your dashboard
          </p>

          {/* Mode toggle */}
          <div
            className="flex gap-0 mb-5 rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(0,212,255,0.12)' }}
          >
            {(['password', 'magic', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setMessage(null); setShowReset(false) }}
                className="flex-1 py-2 text-xs font-medium tracking-widest transition-all"
                style={
                  mode === m
                    ? { background: 'rgba(0,212,255,0.1)', color: '#00d4ff', textShadow: '0 0 8px rgba(0,212,255,0.4)' }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.3)' }
                }
              >
                {m === 'password' ? 'SIGN IN' : m === 'magic' ? 'MAGIC LINK' : 'SIGN UP'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <input
                type="text"
                required
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
                onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.35)' }}
                onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)' }}
              />
            )}
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
              style={{
                background: 'rgba(0,212,255,0.04)',
                border: '1px solid rgba(0,212,255,0.12)',
              }}
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.35)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(0,212,255,0.06)' }}
              onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {(mode === 'password' || mode === 'signup') && (
              <input
                type="password"
                required
                placeholder={mode === 'signup' ? 'Create a password' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
                style={{
                  background: 'rgba(0,212,255,0.04)',
                  border: '1px solid rgba(0,212,255,0.12)',
                }}
                onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.35)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(0,212,255,0.06)' }}
                onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            )}

            {message && (
              <p className={`text-xs ${message.ok ? 'text-green-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="py-2.5 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
              style={{
                background: loading
                  ? 'rgba(0,212,255,0.08)'
                  : 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                border: '1px solid rgba(0,212,255,0.35)',
                color: '#00d4ff',
                boxShadow: loading ? 'none' : '0 0 20px rgba(0,212,255,0.1)',
                textShadow: '0 0 8px rgba(0,212,255,0.4)',
              }}
            >
              {loading ? (mode === 'signup' ? 'CREATING ACCOUNT…' : 'AUTHENTICATING…') : mode === 'magic' ? 'SEND MAGIC LINK' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}
            </button>
          </form>

          {mode === 'password' && (
            <div className="mt-4 text-center">
              {showReset ? (
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="text-xs tracking-wide transition-colors disabled:opacity-50"
                  style={{ color: '#00d4ff' }}
                >
                  Send password reset email →
                </button>
              ) : (
                <button
                  onClick={() => setShowReset(true)}
                  className="text-xs tracking-wide text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6 tracking-widest" style={{ color: 'rgba(0,212,255,0.2)' }}>
          OUR AGENTS · OUR SYSTEMS · YOUR ADVANTAGE
        </p>
      </div>
    </div>
  )
}
