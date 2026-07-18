import { useEffect, useState, type FormEvent } from 'react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { MessageSquare, CheckCircle } from 'lucide-react'

type Stage = 'loading' | 'enter_phone' | 'enter_code' | 'verified'

async function callVerify(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${FUNCTION_BASE}/prymal-sms-verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

export function TextAlfyCard() {
  const [stage, setStage] = useState<Stage>('loading')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [alfyNumber, setAlfyNumber] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    callVerify({ action: 'status' }).then(data => {
      if (data.verified) {
        setAlfyNumber(data.alfy_number)
        setPhone(data.phone_number ?? '')
        setStage('verified')
      } else {
        setStage('enter_phone')
      }
    }).catch(() => setStage('enter_phone'))
  }, [])

  async function startVerify(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const data = await callVerify({ action: 'start', phone })
    setBusy(false)
    if (data.error) { setError(data.error); return }
    setStage('enter_code')
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const data = await callVerify({ action: 'check', code })
    setBusy(false)
    if (data.error) { setError(data.error); return }
    setAlfyNumber(data.alfy_number)
    setStage('verified')
  }

  async function disconnect() {
    setBusy(true)
    await callVerify({ action: 'disconnect' })
    setBusy(false)
    setPhone(''); setCode(''); setAlfyNumber(null)
    setStage('enter_phone')
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}
    >
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}
        >
          <MessageSquare size={17} style={{ color: '#00d4ff' }} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Text Alfy</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Message your assistant by SMS — briefs, follow-ups, and approvals from your phone
          </p>
        </div>
        {stage === 'verified' && (
          <span
            className="ml-auto flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff' }}
          >
            <CheckCircle size={11} /> CONNECTED
          </span>
        )}
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
        {stage === 'loading' && (
          <p className="text-xs tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>LOADING…</p>
        )}

        {stage === 'enter_phone' && (
          <form onSubmit={startVerify} className="flex gap-2 flex-wrap">
            <input
              type="tel"
              placeholder="+15551234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="flex-1 min-w-44 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
              style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
            />
            <button
              type="submit"
              disabled={busy || !phone.trim()}
              className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
            >
              {busy ? 'SENDING…' : 'SEND CODE'}
            </button>
          </form>
        )}

        {stage === 'enter_code' && (
          <form onSubmit={checkCode} className="flex gap-2 flex-wrap items-center">
            <p className="text-xs w-full mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              We texted a 6-digit code to {phone}
            </p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-32 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none tracking-widest"
              style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
            >
              {busy ? 'VERIFYING…' : 'VERIFY'}
            </button>
            <button
              type="button"
              onClick={() => { setStage('enter_phone'); setCode(''); setError(null) }}
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Change number
            </button>
          </form>
        )}

        {stage === 'verified' && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {phone} is linked. Text Alfy at{' '}
              <span className="font-bold" style={{ color: '#00d4ff' }}>{alfyNumber}</span>
              {' '}— save it to your contacts.
            </p>
            <button
              onClick={disconnect}
              disabled={busy}
              className="text-xs px-2 py-0.5 rounded disabled:opacity-50"
              style={{ color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              Disconnect
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    </div>
  )
}
