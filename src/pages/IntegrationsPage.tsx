import { useState, useEffect, type ReactNode } from 'react'
import { useClient } from '@/hooks/useClient'
import { CheckCircle, Globe, ChevronDown, CreditCard, Zap, Mail, Calendar, HardDrive, Edit2 } from 'lucide-react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'

type Tab = 'brand' | 'integrations' | 'billing'

function useAnthropicKey() {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('prymal_clients').select('anthropic_api_key').single().then(({ data }) => {
      if (data?.anthropic_api_key) setKey(data.anthropic_api_key)
      setLoaded(true)
    })
  }, [])

  async function save() {
    setSaving(true)
    const { data: clientRow } = await supabase.from('prymal_clients').select('id').single()
    if (clientRow) {
      await supabase.from('prymal_clients').update({ anthropic_api_key: key.trim() }).eq('id', clientRow.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return { key, setKey, save, saving, saved, loaded }
}

interface SocialAccount {
  id: string
  platform: string
  handle: string | null
  connected: boolean
  updated_at: string
}

const GOOGLE_CLIENT_ID = '602381566088-s7dcq0m47u4dr623bvefvakn98c14dqr.apps.googleusercontent.com'

const GOOGLE_SCOPES: Record<string, string[]> = {
  gbp: ['https://www.googleapis.com/auth/business.manage'],
  gmail: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  calendar: ['https://www.googleapis.com/auth/calendar'],
  drive: ['https://www.googleapis.com/auth/drive.readonly'],
}

function startGoogleOAuth(platform: string) {
  const redirectUri = `${window.location.origin}/auth/google/callback`
  const scopes = GOOGLE_SCOPES[platform] ?? GOOGLE_SCOPES.gbp

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: platform,
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function IntegrationsPage() {
  const { client, loading: clientLoading, update } = useClient()
  const [tab, setTab] = useState<Tab>('integrations')
  const anthropicKey = useAnthropicKey()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ brand_tone: '', knowledge_base: '', delivery_cadence: '' })
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set())
  const [acctLoading, setAcctLoading] = useState(true)
  const googleAccount = accounts.find(a => a.platform === 'google')

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
      const [accountsRes, clientRes, tokensRes] = await Promise.all([
        supabase.from('prymal_social_accounts').select('*').order('platform'),
        supabase.from('prymal_clients').select('gbp_account_id, gbp_location_id').single(),
        supabase.from('prymal_oauth_tokens').select('platform'),
      ])
      setAccounts(accountsRes.data ?? [])
      setGbpIds({
        account: clientRes.data?.gbp_account_id ?? null,
        location: clientRes.data?.gbp_location_id ?? null,
      })
      const platforms = new Set((tokensRes.data ?? []).map((r: { platform: string }) => r.platform))
      setConnectedPlatforms(platforms)
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

  const gbpConnected = !!(googleAccount?.connected && gbpIds.account && gbpIds.location && gbpIds.location !== '0' && gbpIds.account !== '0')
  const gbpTokensOnly = !!(googleAccount?.connected && (!gbpIds.account || !gbpIds.location || gbpIds.location === '0' || gbpIds.account === '0'))
  const [showManual, setShowManual] = useState(false)
  const [gbpEditing, setGbpEditing] = useState(false)
  const [manualForm, setManualForm] = useState({ accountId: gbpIds.account ?? '', locationId: gbpIds.location && gbpIds.location !== '0' ? gbpIds.location : '', businessName: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMsg, setManualMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [rediscovering, setRediscovering] = useState(false)

  async function handleRediscover() {
    setRediscovering(true)
    setManualMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTION_BASE}/prymal-google-oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'rediscover' }),
    })
    const data = await res.json()
    if (data.location_id && data.location_id !== '0') {
      setManualMsg({ text: `Found location: ${data.location_id}. Reloading…`, ok: true })
      setTimeout(() => window.location.reload(), 1500)
    } else {
      setManualMsg({ text: data.error ?? 'Could not auto-discover location — GBP API quota may still be 0. Enter IDs manually below.', ok: false })
    }
    setRediscovering(false)
  }

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
      setGbpEditing(false)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setManualMsg({ text: String(err), ok: false })
    } finally {
      setManualSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl relative">
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
        {(['integrations', 'brand', 'billing'] as Tab[]).map((t) => (
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
            {t === 'brand' ? 'BRAND SETTINGS' : t === 'billing' ? 'BILLING' : 'INTEGRATIONS'}
          </button>
        ))}
      </div>

      {tab === 'integrations' && (
        <div className="flex flex-col gap-4">

          {/* ── Google Business Profile ── */}
          <IntegrationCard
            icon={<Globe size={18} style={{ color: '#00d4ff' }} />}
            title="Google Business Profile"
            subtitle="Review monitoring & AI-drafted responses"
            loading={acctLoading}
            connected={gbpConnected}
            warning={gbpTokensOnly}
          >
            {gbpConnected && !acctLoading && (
              <>
                <div
                  className="mt-4 pt-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {googleAccount?.handle ?? 'Business Profile connected'} · {gbpIds.location}
                    </span>
                  </div>
                  <button
                    onClick={() => { setGbpEditing(v => !v); setManualMsg(null) }}
                    className="flex items-center gap-1 text-xs transition-colors"
                    style={{ color: 'rgba(0,212,255,0.45)' }}
                  >
                    <Edit2 size={11} />
                    {gbpEditing ? 'Cancel' : 'Edit IDs'}
                  </button>
                </div>

                {gbpEditing && (
                  <form onSubmit={handleManualConnect} className="mt-3 flex flex-col gap-3">
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
                    {manualMsg && <p className={`text-xs ${manualMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{manualMsg.text}</p>}
                    <button
                      type="submit"
                      disabled={manualSaving || !manualForm.accountId || !manualForm.locationId}
                      className="py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                      style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
                    >
                      {manualSaving ? 'SAVING…' : 'SAVE IDs'}
                    </button>
                  </form>
                )}
              </>
            )}

            {gbpTokensOnly && !acctLoading && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(251,191,36,0.1)' }}>
                <p className="text-xs mb-3" style={{ color: 'rgba(251,191,36,0.7)' }}>
                  OAuth authorized but your Business Profile location wasn't found automatically (GBP API quota issue). Try re-discovering or enter IDs manually.
                </p>
                <button
                  onClick={handleRediscover}
                  disabled={rediscovering}
                  className="px-4 py-1.5 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40 mb-3"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                >
                  {rediscovering ? 'SEARCHING…' : '↻ RE-DISCOVER LOCATION'}
                </button>
                {manualMsg && <p className={`text-xs mb-2 ${manualMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{manualMsg.text}</p>}
              </div>
            )}

            {!gbpConnected && !acctLoading && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                {!gbpTokensOnly && (
                  <button
                    onClick={() => startGoogleOAuth('gbp')}
                    className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all mb-3"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                      border: '1px solid rgba(0,212,255,0.35)',
                      color: '#00d4ff',
                    }}
                  >
                    CONNECT WITH GOOGLE
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowManual(v => !v)
                    setManualForm(f => ({ ...f, accountId: f.accountId || (gbpIds.account && gbpIds.account !== '0' ? gbpIds.account : '') }))
                  }}
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
                        <li>Go to <span style={{ color: '#00d4ff' }}>business.google.com</span> and sign in</li>
                        <li>Click your business name to open it</li>
                        <li>Click the 3-dot menu → <strong className="text-white">Business Profile Settings</strong></li>
                        <li>Click <strong className="text-white">Advanced Settings</strong></li>
                        <li>Copy the <strong className="text-white">Account ID</strong> and <strong className="text-white">Location ID</strong></li>
                      </ol>
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
                    {manualMsg && <p className={`text-xs ${manualMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{manualMsg.text}</p>}
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
          </IntegrationCard>

          {/* ── Gmail ── */}
          <IntegrationCard
            icon={<Mail size={18} style={{ color: '#00d4ff' }} />}
            title="Gmail"
            subtitle="Read, compose & send emails via AI agents"
            loading={acctLoading}
            connected={connectedPlatforms.has('gmail')}
          >
            {!acctLoading && !connectedPlatforms.has('gmail') && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <button
                  onClick={() => startGoogleOAuth('gmail')}
                  className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                    border: '1px solid rgba(0,212,255,0.35)',
                    color: '#00d4ff',
                  }}
                >
                  CONNECT GMAIL
                </button>
              </div>
            )}
            {!acctLoading && connectedPlatforms.has('gmail') && (
              <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Gmail authorized — agents can read and send email</span>
              </div>
            )}
          </IntegrationCard>

          {/* ── Google Calendar ── */}
          <IntegrationCard
            icon={<Calendar size={18} style={{ color: '#00d4ff' }} />}
            title="Google Calendar"
            subtitle="Booking Agent reads & creates calendar events"
            loading={acctLoading}
            connected={connectedPlatforms.has('calendar')}
          >
            {!acctLoading && !connectedPlatforms.has('calendar') && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <button
                  onClick={() => startGoogleOAuth('calendar')}
                  className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                    border: '1px solid rgba(0,212,255,0.35)',
                    color: '#00d4ff',
                  }}
                >
                  CONNECT CALENDAR
                </button>
              </div>
            )}
            {!acctLoading && connectedPlatforms.has('calendar') && (
              <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Calendar authorized — Booking Agent can manage appointments</span>
              </div>
            )}
          </IntegrationCard>

          {/* ── Google Drive ── */}
          <IntegrationCard
            icon={<HardDrive size={18} style={{ color: '#00d4ff' }} />}
            title="Google Drive"
            subtitle="Intel Agent reads docs & reports for context"
            loading={acctLoading}
            connected={connectedPlatforms.has('drive')}
          >
            {!acctLoading && !connectedPlatforms.has('drive') && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <button
                  onClick={() => startGoogleOAuth('drive')}
                  className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                    border: '1px solid rgba(0,212,255,0.35)',
                    color: '#00d4ff',
                  }}
                >
                  CONNECT DRIVE
                </button>
              </div>
            )}
            {!acctLoading && connectedPlatforms.has('drive') && (
              <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Drive authorized — agents can read your documents</span>
              </div>
            )}
          </IntegrationCard>

          {/* ── AI Engine ── */}
          <IntegrationCard
            icon={<Zap size={18} style={{ color: '#00d4ff' }} />}
            title="AI Engine"
            subtitle="Anthropic API key — powers your agents & chat"
            loading={!anthropicKey.loaded}
            connected={!!anthropicKey.key}
          >
            <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="sk-ant-api03-…"
                  value={anthropicKey.key}
                  onChange={e => anthropicKey.setKey(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
                  style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.3)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)' }}
                />
                <button
                  onClick={anthropicKey.save}
                  disabled={anthropicKey.saving || !anthropicKey.key.trim()}
                  className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                  style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
                >
                  {anthropicKey.saved ? 'SAVED ✓' : anthropicKey.saving ? 'SAVING…' : 'SAVE'}
                </button>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Get your key at <span style={{ color: 'rgba(0,212,255,0.5)' }}>console.anthropic.com</span> → API Keys.
              </p>
            </div>
          </IntegrationCard>

        </div>
      )}

      {tab === 'brand' && (
        <div
          className="rounded-xl p-5"
          style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}
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
                    style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}
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

      {tab === 'billing' && <BillingTab client={client} />}
    </div>
  )
}

function IntegrationCard({
  icon,
  title,
  subtitle,
  loading,
  connected,
  warning,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  loading: boolean
  connected: boolean
  warning?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
            {icon}
          </div>
          <div>
            <p className="text-white font-semibold text-sm tracking-wide">{title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(0,212,255,0.45)' }}>{subtitle}</p>
          </div>
        </div>
        {loading ? (
          <div className="w-24 h-8 rounded-lg animate-pulse" style={{ background: 'rgba(0,212,255,0.05)' }} />
        ) : warning ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24' }} />
            <span className="text-xs font-semibold tracking-widest" style={{ color: '#fbbf24' }}>SETUP NEEDED</span>
          </div>
        ) : connected ? (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full dot-pulse" style={{ background: '#00d4ff' }} />
            <span className="text-xs font-semibold tracking-widest" style={{ color: '#00d4ff' }}>CONNECTED</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <span className="text-xs font-semibold tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>NOT CONNECTED</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

const PLANS = [
  { key: 'starter', label: 'Starter', price: '$299/mo', features: ['Google Agent', 'Brand Agent', '50 leads/mo'] },
  { key: 'pro', label: 'Pro', price: '$599/mo', features: ['All Starter features', 'Outreach + Service Agents', '200 leads/mo', 'Priority support'] },
  { key: 'agency', label: 'Agency', price: '$1,499/mo', features: ['All Pro features', 'Unlimited leads', 'Multi-location', 'White label'] },
]

function BillingTab({ client }: { client: import('@/hooks/useClient').PrymalClient | null }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleUpgrade(plan: string) {
    setLoading(plan)
    setMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTION_BASE}/prymal-stripe-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setMsg({ text: data.error ?? data.message ?? 'Billing not configured yet.', ok: false })
    }
    setLoading(null)
  }

  const trialDaysLeft = client?.trial_ends_at
    ? Math.ceil((new Date(client.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div>
      <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={14} style={{ color: 'rgba(0,212,255,0.6)' }} />
          <p className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,212,255,0.6)' }}>CURRENT PLAN</p>
        </div>
        <p className="text-2xl font-bold text-white uppercase mt-2">{client?.plan ?? 'trial'}</p>
        {client?.plan === 'trial' && trialDaysLeft !== null && (
          <p className="text-xs mt-1" style={{ color: trialDaysLeft <= 3 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
            {trialDaysLeft > 0 ? `${trialDaysLeft} days remaining in trial` : 'Trial expired'}
          </p>
        )}
        {client?.plan !== 'trial' && (
          <p className="text-xs mt-1" style={{ color: 'rgba(0,212,255,0.4)' }}>
            Status: <span className="capitalize">{client?.status}</span>
          </p>
        )}
      </div>

      {msg && <p className={`text-xs mb-4 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}

      <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>UPGRADE YOUR PLAN</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLANS.map(plan => {
          const isCurrent = client?.plan === plan.key
          return (
            <div
              key={plan.key}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: isCurrent ? 'rgba(0,212,255,0.06)' : 'rgba(8,13,22,0.8)',
                border: isCurrent ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(0,212,255,0.1)',
              }}
            >
              <div>
                <p className="text-sm font-bold text-white">{plan.label}</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: '#00d4ff' }}>{plan.price}</p>
              </div>
              <ul className="flex flex-col gap-1 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Zap size={10} style={{ color: 'rgba(0,212,255,0.5)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={isCurrent || loading !== null}
                className="py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                style={{
                  background: isCurrent ? 'rgba(0,212,255,0.1)' : 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.08))',
                  border: '1px solid rgba(0,212,255,0.3)',
                  color: '#00d4ff',
                }}
              >
                {isCurrent ? 'CURRENT' : loading === plan.key ? 'LOADING…' : 'UPGRADE'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
