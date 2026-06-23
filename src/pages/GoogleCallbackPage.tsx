import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

export function GoogleCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')

        if (error || !code) {
          setStatus('error')
          setMessage(error === 'access_denied' ? 'Google access was denied.' : 'OAuth failed — no code returned.')
          return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setStatus('error')
          setMessage('Not signed in. Please log into the dashboard first, then try connecting Google again.')
          return
        }

        const redirectUri = `${window.location.origin}/auth/google/callback`
        const platform = params.get('state') ?? 'gbp'

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://josabyyaarhlgepfelid.supabase.co'
        const res = await fetch(
          `${supabaseUrl}/functions/v1/prymal-google-oauth`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ code, redirect_uri: redirectUri, platform }),
          }
        )

        const data = await res.json()

        if (!res.ok || !data.success) {
          setStatus('error')
          const detail = data.details ? ` — ${JSON.stringify(data.details)}` : ''
          setMessage((data.error ?? `Connection failed (${res.status})`) + detail)
          return
        }

        setStatus('success')
        if (platform !== 'gbp') {
          setMessage(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully.`)
          setTimeout(() => navigate('/settings'), 2500)
        } else if (data.tokens_stored && !data.location) {
          setMessage('Tokens saved. Go to Settings → Integrations to enter your GBP IDs manually.')
          setTimeout(() => navigate('/settings'), 2500)
        } else {
          setMessage(`Connected: ${data.location_title ?? data.location}`)
          setTimeout(() => navigate('/agents/google'), 2500)
        }
      } catch (err) {
        setStatus('error')
        setMessage(`Unexpected error: ${String(err)}`)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#03070f' }}
    >
      <div
        className="rounded-xl p-8 max-w-sm w-full text-center"
        style={{
          background: 'rgba(8,13,22,0.95)',
          border: '1px solid rgba(0,212,255,0.15)',
          boxShadow: '0 0 40px rgba(0,212,255,0.06)',
        }}
      >
        {status === 'loading' && (
          <>
            <Loader size={32} className="animate-spin mx-auto mb-4" style={{ color: '#00d4ff' }} />
            <p className="text-white font-semibold tracking-wide">CONNECTING GOOGLE</p>
            <p className="text-xs mt-2" style={{ color: 'rgba(0,212,255,0.45)' }}>
              Exchanging tokens and fetching your Business Profile…
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={32} className="mx-auto mb-4" style={{ color: '#00d4ff' }} />
            <p className="text-white font-semibold tracking-wide">GOOGLE CONNECTED</p>
            <p className="text-xs mt-2" style={{ color: 'rgba(0,212,255,0.45)' }}>{message}</p>
            <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Redirecting to Google Agent…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={32} className="mx-auto mb-4 text-red-400" />
            <p className="text-white font-semibold tracking-wide mb-2">CONNECTION FAILED</p>
            <p className="text-xs text-red-400 mb-5">{message}</p>
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2 text-xs font-semibold tracking-widest rounded-lg transition-all"
              style={{
                background: 'rgba(0,212,255,0.08)',
                border: '1px solid rgba(0,212,255,0.25)',
                color: '#00d4ff',
              }}
            >
              BACK TO SETTINGS
            </button>
          </>
        )}
      </div>
    </div>
  )
}
