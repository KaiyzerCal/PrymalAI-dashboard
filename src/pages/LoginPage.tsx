import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Zap } from 'lucide-react'

type Mode = 'password' | 'magic'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [showReset, setShowReset] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'magic') {
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="text-amber-500" size={24} />
          <span className="text-xl font-semibold text-white">PrymalAI</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-white mb-1">Sign in</h1>
          <p className="text-sm text-zinc-400 mb-6">Access your client dashboard</p>

          <div className="flex gap-2 mb-5">
            {(['password', 'magic'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setMessage(null); setShowReset(false) }}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                  mode === m
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {m === 'password' ? 'Password' : 'Magic link'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            {mode === 'password' && (
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            )}
            {message && (
              <p className={`text-sm ${message.ok ? 'text-green-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? 'Loading…' : mode === 'magic' ? 'Send magic link' : 'Sign in'}
            </button>
          </form>

          {mode === 'password' && (
            <div className="mt-4 text-center">
              {showReset ? (
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                >
                  Send password reset email →
                </button>
              ) : (
                <button
                  onClick={() => setShowReset(true)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
