import { useState, useEffect } from 'react'
import { useClient } from '@/hooks/useClient'
import { CheckCircle, XCircle, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Tab = 'brand' | 'integrations'

interface SocialAccount {
  id: string
  platform: string
  handle: string | null
  connected: boolean
  updated_at: string
}

const GOOGLE_CLIENT_ID = '763647234428-nuu71d9svv04cekj0j3n7m6mpusar6oa.apps.googleusercontent.com'

function startGoogleOAuth() {
  const redirectUri = `${window.location.origin}/auth/google/callback`
  const scopes = [
    'https://www.googleapis.com/auth/business.manage',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function IntegrationsPage() {
  const { client, loading: clientLoading, update } = useClient()
  const [tab, setTab] = useState<Tab>('integrations')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ brand_tone: '', knowledge_base: '', delivery_cadence: '' })
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [acctLoading, setAcctLoading] = useState(true)

  useEffect(() => {
    if (client) {
      setForm({
        brand_tone: client.brand_tone ?? '',
        knowledge_base: client.knowledge_base ?? '',
        delivery_cadence: client.delivery_cadence ?? '',
      })
    }
  }, [client])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prymal_social_accounts')
        .select('*')
        .order('platform')
      setAccounts(data ?? [])
      setAcctLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await update(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const googleAccount = accounts.find(a => a.platform === 'google')

  return (
    <div className="p-6 max-w-2xl relative">
      {/* Ambient glow */}
      <div
        className="absolute inset-x-0 top-0 h-48 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,212,255,0.06) 0%, transparent 70%)' }}
      />

      <div className="relative mb-8">
        <p className="text-xs tracking-widest font-semibold mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>
          CONFIGURATION
        </p>
        <h1 className="text-2xl font-bold tracking-wide text-white">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Manage brand settings and connect your integrations
        </p>
      </div>

      {/* Tab toggle */}
      <div
        className="flex gap-0 mb-6 rounded-lg overflow-hidden w-fit"
        style={{ border: '1px solid rgba(0,212,255,0.12)' }}
      >
        {(['integrations', 'brand'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 text-xs font-semibold tracking-widest transition-all"
            style={
              tab === t
                ? { background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.35)' }
            }
          >
            {t === 'brand' ? 'BRAND SETTINGS' : 'INTEGRATIONS'}
          </button>
        ))}
      </div>

      {tab === 'integrations' && (
        <div className="flex flex-col gap-4">
          {/* Google Business Profile card */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(8,13,22,0.8)',
              border: '1px solid rgba(0,212,255,0.1)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}
                >
                  <Globe size={18} style={{ color: '#00d4ff' }} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm tracking-wide">Google Business Profile</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(0,212,255,0.45)' }}>
                    Review monitoring &amp; AI-drafted responses
                  </p>
                </div>
              </div>

              {acctLoading ? (
                <div className="w-24 h-8 rounded-lg animate-pulse" style={{ background: 'rgba(0,212,255,0.05)' }} />
              ) : googleAccount?.connected ? (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full dot-pulse" style={{ background: '#00d4ff' }} />
                  <span className="text-xs font-semibold tracking-widest" style={{ color: '#00d4ff' }}>
                    CONNECTED
                  </span>
                </div>
              ) : (
                <button
                  onClick={startGoogleOAuth}
                  className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                    border: '1px solid rgba(0,212,255,0.35)',
                    color: '#00d4ff',
                    boxShadow: '0 0 20px rgba(0,212,255,0.1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 28px rgba(0,212,255,0.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,0.1)' }}
                >
                  CONNECT
                </button>
              )}
            </div>

            {googleAccount?.connected && (
              <div
                className="mt-4 pt-4 flex items-center gap-2"
                style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}
              >
                <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {googleAccount.handle ?? 'Business Profile connected'}
                </span>
              </div>
            )}
          </div>

          {/* Placeholder cards for future integrations */}
          {[
            { name: 'Facebook Pages', desc: 'Social content publishing' },
            { name: 'Instagram Business', desc: 'Visual content scheduling' },
          ].map(({ name, desc }) => (
            <div
              key={name}
              className="rounded-xl p-5 opacity-40"
              style={{
                background: 'rgba(8,13,22,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <XCircle size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>{name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{desc}</p>
                  </div>
                </div>
                <span className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>COMING SOON</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'brand' && (
        <div
          className="rounded-xl p-5"
          style={{
            background: 'rgba(8,13,22,0.8)',
            border: '1px solid rgba(0,212,255,0.1)',
          }}
        >
          {clientLoading ? (
            <p className="text-xs tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>LOADING…</p>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              {[
                { key: 'brand_tone', label: 'BRAND TONE', placeholder: 'e.g. Professional, friendly, concise…', rows: 3 },
                { key: 'knowledge_base', label: 'KNOWLEDGE BASE', placeholder: 'Key information about your business, products, and services…', rows: 5 },
                { key: 'delivery_cadence', label: 'DELIVERY CADENCE', placeholder: 'e.g. 3 posts/week, daily briefing…', rows: 1 },
              ].map(({ key, label, placeholder, rows }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: 'rgba(0,212,255,0.5)' }}>
                    {label}
                  </label>
                  <textarea
                    rows={rows}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all resize-none"
                    style={{
                      background: 'rgba(0,212,255,0.03)',
                      border: '1px solid rgba(0,212,255,0.1)',
                    }}
                    onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.3)' }}
                    onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.1)' }}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                className="self-start py-2 px-5 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                  border: '1px solid rgba(0,212,255,0.35)',
                  color: '#00d4ff',
                }}
              >
                {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE CHANGES'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
