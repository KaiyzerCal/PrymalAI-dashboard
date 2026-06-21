import { useState, useEffect } from 'react'
import { useClient } from '@/hooks/useClient'
import { CheckCircle, XCircle, Globe, ChevronDown } from 'lucide-react'
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

  const [gbpIds, setGbpIds] = useState<{ account: string | null; location: string | null }>({ account: null, location: null })

  useEffect(() => {
    async function load() {
      const [accountsRes, clientRes] = await Promise.all([
        supabase.from('prymal_social_accounts').select('*').order('platform'),
        supabase.from('prymal_clients').select('gbp_account_id, gbp_location_id').single(),
      ])
      setAccounts(accountsRes.data ?? [])
      setGbpIds({
        account: clientRes.data?.gbp_account_id ?? null,
        location: clientRes.data?.gbp_location_id ?? null,
      })
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
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ accountId: '', locationId: '', businessName: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMsg, setManualMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleManualConnect(e: React.FormEvent) {
    e.preventDefault()
    setManualSaving(true)
    setManualMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setManualMsg({ text: 'Not signed in.', ok: false }); return }

      const { data: clientRow } = await supabase.from('prymal_clients').select('id').single()
      if (!clientRow) { setManualMsg({ text: 'Client record not found.', ok: false }); return }

      await supabase.from('prymal_clients').update({
        gbp_account_id: manualForm.accountId.trim(),
        gbp_location_id: manualForm.locationId.trim(),
      }).eq('id', clientRow.id)

      await supabase.from('prymal_social_accounts').upsert({
        client_id: clientRow.id,
        platform: 'google',
        handle: manualForm.businessName.trim() || manualForm.locationId.trim(),
        connected: true,
      }, { onConflict: 'client_id,platform' })

      setManualMsg({ text: 'Connected! Reload to see updated status.', ok: true })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setManualMsg({ text: String(err), ok: false })
    } finally {
      setManualSaving(false)
    }
  }

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
              ) : googleAccount?.connected && gbpIds.account && gbpIds.location ? (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full dot-pulse" style={{ background: '#00d4ff' }} />
                  <span className="text-xs font-semibold tracking-widest" style={{ color: '#00d4ff' }}>
                    CONNECTED
                  </span>
                </div>
              ) : googleAccount?.connected ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24' }} />
                  <span className="text-xs font-semibold tracking-widest" style={{ color: '#fbbf24' }}>
                    SETUP NEEDED
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

            {googleAccount?.connected && gbpIds.account && gbpIds.location && (
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

            {googleAccount?.connected && (!gbpIds.account || !gbpIds.location) && !acctLoading && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(251,191,36,0.1)' }}>
                <p className="text-xs mb-3" style={{ color: 'rgba(251,191,36,0.7)' }}>
                  OAuth connected but Business Profile IDs are missing — enter them below to activate the agent.
                </p>
              </div>
            )}

            {(!googleAccount?.connected || !gbpIds.account || !gbpIds.location) && !acctLoading && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <button
                  onClick={() => setShowManual(v => !v)}
                  className="flex items-center gap-1.5 text-xs tracking-wide transition-colors"
                  style={{ color: 'rgba(0,212,255,0.45)' }}
                >
                  <ChevronDown size={12} style={{ transform: showManual ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  Enter GBP IDs manually instead
                </button>

                {showManual && (
                  <form onSubmit={handleManualConnect} className="mt-4 flex flex-col gap-3">
                    <div className="text-xs rounded-lg p-3" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
                      <p className="font-semibold mb-1" style={{ color: 'rgba(0,212,255,0.7)' }}>HOW TO FIND YOUR IDS</p>
                      <ol className="list-decimal list-inside space-y-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <li>Go to <span style={{ color: '#00d4ff' }}>business.google.com</span> and sign in as <span style={{ color: '#00d4ff' }}>bioneerfitness@gmail.com</span></li>
                        <li>Click your business name to open it</li>
                        <li>Click the 3-dot menu → <strong className="text-white">Business Profile Settings</strong></li>
                        <li>Click <strong className="text-white">Advanced Settings</strong></li>
                        <li>Copy the <strong className="text-white">Account ID</strong> (numbers only, e.g. <span style={{ color: 'rgba(0,212,255,0.6)' }}>123456789</span>)</li>
                        <li>Copy the <strong className="text-white">Location ID</strong> (numbers only, e.g. <span style={{ color: 'rgba(0,212,255,0.6)' }}>987654321</span>)</li>
                      </ol>
                      <p className="mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Enter them below with the <span style={{ color: 'rgba(0,212,255,0.5)' }}>accounts/</span> prefix as shown.</p>
                    </div>
                    {[
                      { key: 'businessName', label: 'BUSINESS NAME', placeholder: 'Bioneer Fitness' },
                      { key: 'accountId', label: 'ACCOUNT ID', placeholder: 'accounts/123456789' },
                      { key: 'locationId', label: 'LOCATION ID', placeholder: 'accounts/123456789/locations/987654321' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold tracking-widest mb-1.5" style={{ color: 'rgba(0,212,255,0.45)' }}>{label}</label>
                        <input
                          type="text"
                          placeholder={placeholder}
                          value={manualForm[key as keyof typeof manualForm]}
                          onChange={e => setManualForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
                          style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
                          onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.3)' }}
                          onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)' }}
                        />
                      </div>
                    ))}
                    {manualMsg && (
                      <p className={`text-xs ${manualMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{manualMsg.text}</p>
                    )}
                    <button
                      type="submit"
                      disabled={manualSaving || !manualForm.accountId || !manualForm.locationId}
                      className="py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                      style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
                    >
                      {manualSaving ? 'SAVING…' : 'SAVE & CONNECT'}
                    </button>
                  </form>
                )}
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
