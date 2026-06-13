import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Zap } from 'lucide-react'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  // Supabase fires PASSWORD_RECOVERY after parsing the hash in the URL
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ text: 'Passwords do not match.', ok: false })
      return
    }
    if (password.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters.', ok: false })
      return
    }
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage({ text: error.message, ok: false })
    } else {
      setMessage({ text: 'Password set! Redirecting…', ok: true })
      setTimeout(() => navigate('/'), 1500)
    }
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
          <h1 className="text-lg font-semibold text-white mb-1">Set your password</h1>
          <p className="text-sm text-zinc-400 mb-6">
            {ready
              ? 'Choose a password to use for future sign-ins.'
              : 'Verifying your reset link…'}
          </p>

          {ready && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="password"
                required
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <input
                type="password"
                required
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
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
                {loading ? 'Saving…' : 'Set password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
