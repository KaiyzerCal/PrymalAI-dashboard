import { useState, useEffect, type ReactNode, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '@/hooks/useClient'
import { useAdmin } from '@/hooks/useAdmin'
import { CheckCircle, Globe, ChevronDown, CreditCard, Zap, Mail, Calendar, HardDrive, Edit2, Lock } from 'lucide-react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { TIER_CONFIGS, planAtLeast, type TierLevel } from '@/lib/tierConfig'

type Tab = 'brand' | 'integrations' | 'billing' | 'account'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data: clientRow } = await supabase
      .from('prymal_clients')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (clientRow) {
      const { error: updateError } = await supabase
        .from('prymal_clients')
        .update({ anthropic_api_key: key.trim() })
        .eq('id', clientRow.id)
      if (!updateError) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }
    setSaving(false)
  }

  return { key, setKey, save, saving, saved, loaded }
}

function useGeminiKey() {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('prymal_clients').select('gemini_api_key').single().then(({ data }) => {
      if (data?.gemini_api_key) setKey(data.gemini_api_key)
      setLoaded(true)
    })
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data: clientRow } = await supabase
      .from('prymal_clients')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (clientRow) {
      const { error: updateError } = await supabase
        .from('prymal_clients')
        .update({ gemini_api_key: key.trim() })
        .eq('id', clientRow.id)
      if (!updateError) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }
    setSaving(false)
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
  gmail: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  calendar: ['https://www.googleapis.com/auth/calendar'],
  tasks: ['https://www.googleapis.com/auth/tasks'],
  drive: ['https://www.googleapis.com/auth/drive.file'],
  docs: ['https://www.googleapis.com/auth/documents'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  slides: ['https://www.googleapis.com/auth/presentations'],
  forms: ['https://www.googleapis.com/auth/forms'],
  keep: ['https://www.googleapis.com/auth/keep'],
  meet: ['https://www.googleapis.com/auth/calendar'],
  contacts: ['https://www.googleapis.com/auth/contacts'],
  gbp: ['https://www.googleapis.com/auth/business.manage'],
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
  const { isAdmin } = useAdmin()
  const [tab, setTab] = useState<Tab>('integrations')
  const anthropicKey = useAnthropicKey()
  const geminiKey = useGeminiKey()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ brand_tone: '', knowledge_base: '', delivery_cadence: '' })
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set())
  const [acctLoading, setAcctLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [disconnectError, setDisconnectError] = useState<string | null>(null)
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set())
  const googleAccount = accounts.find(a => a.platform === 'google')

  const toggleTier = (tier: string) => {
    const newExpanded = new Set(expandedTiers)
    if (newExpanded.has(tier)) {
      newExpanded.delete(tier)
    } else {
      newExpanded.add(tier)
    }
    setExpandedTiers(newExpanded)
  }

  const hasAccess = (requiredTier: TierLevel): boolean => {
    if (isAdmin) return true
    return planAtLeast(client?.plan ?? 'free', requiredTier)
  }

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
    if (!client) return
    const clientId = client.id
    const gbpAccountId = client.gbp_account_id
    const gbpLocationId = client.gbp_location_id

    async function load() {
      const [accountsRes, tokensRes] = await Promise.all([
        supabase.from('prymal_social_accounts').select('*').eq('client_id', clientId).order('platform'),
        supabase.from('prymal_oauth_tokens').select('platform').eq('client_id', clientId),
      ])
      setAccounts(accountsRes.data ?? [])
      setGbpIds({
        account: gbpAccountId ?? null,
        location: gbpLocationId ?? null,
      })
      const platforms = new Set((tokensRes.data ?? []).map((r: { platform: string }) => r.platform))
      setConnectedPlatforms(platforms)
      setAcctLoading(false)
    }
    load()
  }, [client])

  async function handleDisconnect(platform: string) {
    setDisconnecting(platform)
    setDisconnectError(null)
    try {
      const { data: clientRow } = await supabase.from('prymal_clients').select('id').single()
      if (!clientRow) {
        setDisconnectError('Client not found')
        return
      }

      // Delete oauth tokens
      const { error: tokenError } = await supabase
        .from('prymal_oauth_tokens')
        .delete()
        .eq('client_id', clientRow.id)
        .eq('platform', platform)
      if (tokenError) throw tokenError

      // Update social accounts
      const { error: accountError } = await supabase
        .from('prymal_social_accounts')
        .update({ connected: false })
        .eq('client_id', clientRow.id)
        .eq('platform', platform)
      if (accountError) throw accountError

      // Clear GBP IDs if disconnecting Google
      if (platform === 'google' || platform === 'gbp') {
        const { error: gbpError } = await supabase
          .from('prymal_clients')
          .update({ gbp_account_id: null, gbp_location_id: null })
          .eq('id', clientRow.id)
        if (gbpError) throw gbpError
      }

      // Update local state
      const newPlatforms = new Set(connectedPlatforms)
      newPlatforms.delete(platform)
      setConnectedPlatforms(newPlatforms)

      // Update accounts if it's a social account
      setAccounts(prev => prev.map(a =>
        a.platform === platform ? { ...a, connected: false } : a
      ))
    } catch (err) {
      setDisconnectError(`Failed to disconnect: ${String(err)}`)
      console.error('Disconnect error:', err)
    } finally {
      setDisconnecting(null)
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await update(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const gbpConnected = !!(googleAccount?.connected && gbpIds.account && gbpIds.account !== '0')
  const gbpTokensOnly = !!(googleAccount?.connected && (!gbpIds.account || gbpIds.account === '0'))
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

  async function handleManualConnect(e: FormEvent) {
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
        gbp_location_id: manualForm.locationId.trim() || null,
      }).eq('id', clientRow.id)

      await supabase.from('prymal_social_accounts').upsert({
        client_id: clientRow.id,
        platform: 'google',
        handle: manualForm.businessName.trim() || manualForm.accountId.trim(),
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
        {(['integrations', 'brand', 'billing', 'account'] as Tab[]).map((t) => (
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
            {t === 'brand' ? 'BRAND SETTINGS' : t === 'billing' ? 'BILLING' : t === 'account' ? 'ACCOUNT' : 'INTEGRATIONS'}
          </button>
        ))}
      </div>

      {tab === 'integrations' && (
        <div className="flex flex-col gap-4">

          {/* ── Tier 1: Email Mastery ── */}
          <TierSection
            name={TIER_CONFIGS.tier1.displayName}
            expanded={expandedTiers.has('tier1')}
            onToggle={() => toggleTier('tier1')}
          >
            {/* ── Gmail ── */}
            <IntegrationCard
              icon={<Mail size={18} style={{ color: '#00d4ff' }} />}
              title="Gmail"
              subtitle="Read inbox, compose & send emails, organize with labels & filters"
              loading={acctLoading}
              connected={connectedPlatforms.has('gmail')}
              tier="tier1"
              tierName={TIER_CONFIGS.tier1.displayName}
              locked={!hasAccess('tier1')}
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
                <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Gmail authorized — agents can read and send email</span>
                    <button
                      onClick={() => handleDisconnect('gmail')}
                      disabled={disconnecting === 'gmail'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                    >
                      {disconnecting === 'gmail' ? 'DISCONNECTING…' : 'Disconnect'}
                    </button>
                    <button
                      onClick={() => startGoogleOAuth('gmail')}
                      disabled={disconnecting === 'gmail'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.2)'}}
                    >
                      Reconnect
                    </button>
                  </div>
                  {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
                </div>
              )}
            </IntegrationCard>
          </TierSection>

          {/* ── Tier 2: Calendar & Tasks ── */}
          <TierSection
            name={TIER_CONFIGS.tier2.displayName}
            expanded={expandedTiers.has('tier2')}
            onToggle={() => toggleTier('tier2')}
          >
            {/* ── Google Calendar ── */}
            <IntegrationCard
              icon={<Calendar size={18} style={{ color: '#00d4ff' }} />}
              title="Google Calendar"
              subtitle="View schedule, check availability, create & manage events"
              loading={acctLoading}
              connected={connectedPlatforms.has('calendar')}
              tier="tier2"
              tierName={TIER_CONFIGS.tier2.displayName}
              locked={!hasAccess('tier2')}
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
                <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Calendar authorized — Booking Agent can manage appointments</span>
                    <button
                      onClick={() => handleDisconnect('calendar')}
                      disabled={disconnecting === 'calendar'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                    >
                      {disconnecting === 'calendar' ? 'DISCONNECTING…' : 'Disconnect'}
                    </button>
                    <button
                      onClick={() => startGoogleOAuth('calendar')}
                      disabled={disconnecting === 'calendar'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.2)'}}
                    >
                      Reconnect
                    </button>
                  </div>
                  {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
                </div>
              )}
            </IntegrationCard>
          </TierSection>

          {/* ── Tier 3: Docs & Collaboration ── */}
          <TierSection
            name={TIER_CONFIGS.tier3.displayName}
            expanded={expandedTiers.has('tier3')}
            onToggle={() => toggleTier('tier3')}
          >
            {/* ── Google Drive ── */}
            <IntegrationCard
              icon={<HardDrive size={18} style={{ color: '#00d4ff' }} />}
              title="Google Drive"
              subtitle="Read, search, and manage files and folders"
              loading={acctLoading}
              connected={connectedPlatforms.has('drive')}
              tier="tier3"
              tierName={TIER_CONFIGS.tier3.displayName}
              locked={!hasAccess('tier3')}
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
                <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Drive authorized — agents can read your documents</span>
                    <button
                      onClick={() => handleDisconnect('drive')}
                      disabled={disconnecting === 'drive'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                    >
                      {disconnecting === 'drive' ? 'DISCONNECTING…' : 'Disconnect'}
                    </button>
                    <button
                      onClick={() => startGoogleOAuth('drive')}
                      disabled={disconnecting === 'drive'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.2)'}}
                    >
                      Reconnect
                    </button>
                  </div>
                  {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
                </div>
              )}
            </IntegrationCard>

            {/* ── Google Places ── */}
            <IntegrationCard
              icon={<Globe size={18} style={{ color: '#00d4ff' }} />}
              title="Google Places"
              subtitle="Location intelligence and place data"
              loading={acctLoading}
              connected={connectedPlatforms.has('places')}
              tier="tier3"
              tierName={TIER_CONFIGS.tier3.displayName}
              locked={!hasAccess('tier3')}
            >
              {!acctLoading && !connectedPlatforms.has('places') && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                  <button
                    onClick={() => startGoogleOAuth('places')}
                    disabled={!hasAccess('tier3')}
                    className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                      border: '1px solid rgba(0,212,255,0.35)',
                      color: '#00d4ff',
                    }}
                  >
                    CONNECT PLACES
                  </button>
                </div>
              )}
              {!acctLoading && connectedPlatforms.has('places') && (
                <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Places authorized — agents can access location data</span>
                    <button
                      onClick={() => handleDisconnect('places')}
                      disabled={disconnecting === 'places'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                    >
                      {disconnecting === 'places' ? 'DISCONNECTING…' : 'Disconnect'}
                    </button>
                  </div>
                  {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
                </div>
              )}
            </IntegrationCard>
          </TierSection>

          {/* ── Tier 4: Full Access ── */}
          <TierSection
            name={TIER_CONFIGS.tier4.displayName}
            expanded={expandedTiers.has('tier4')}
            onToggle={() => toggleTier('tier4')}
          >
            {/* ── Google Business Profile ── */}
          <IntegrationCard
            icon={<Globe size={18} style={{ color: '#00d4ff' }} />}
            title="Google Business Profile"
            subtitle="Review monitoring, AI-drafted responses, and business insights"
            loading={acctLoading}
            connected={gbpConnected}
            warning={gbpTokensOnly}
            tier="tier4"
            tierName={TIER_CONFIGS.tier4.displayName}
            locked={!planAtLeast(client?.plan ?? 'free', 'tier4')}
          >
            {gbpConnected && !acctLoading && (
              <>
                <div
                  className="mt-4 pt-4 flex flex-col gap-2"
                  style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {googleAccount?.handle ?? 'Business Profile connected'}{gbpIds.location && gbpIds.location !== '0' ? ` · ${gbpIds.location}` : ''}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDisconnect('google')}
                        disabled={disconnecting === 'google'}
                        className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                      >
                        {disconnecting === 'google' ? 'DISCONNECTING…' : 'Disconnect'}
                      </button>
                      <button
                        onClick={() => startGoogleOAuth('gbp')}
                        disabled={disconnecting === 'google'}
                        className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.2)'}}
                      >
                        Reconnect
                      </button>
                    </div>
                  </div>
                  {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
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
                      { key: 'locationId', label: 'LOCATION ID (optional — skip if online/service-area business)', placeholder: 'accounts/123456789/locations/987654321' },
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
                      disabled={manualSaving || !manualForm.accountId}
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
                  Google authorized but your Business Profile Account ID wasn't found automatically. Try re-discovering, or enter your Account ID manually below. Location ID is optional for online/service-area businesses.
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
                        <li>Copy the <strong className="text-white">Account ID</strong> (Location ID is optional for online/service-area businesses)</li>
                      </ol>
                    </div>
                    {[
                      { key: 'businessName', label: 'BUSINESS NAME', placeholder: 'Bioneer Fitness' },
                      { key: 'accountId', label: 'ACCOUNT ID', placeholder: 'accounts/123456789' },
                      { key: 'locationId', label: 'LOCATION ID (optional — skip if online/service-area business)', placeholder: 'accounts/123456789/locations/987654321' },
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
                      disabled={manualSaving || !manualForm.accountId}
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
            subtitle="Read inbox, compose & send emails, organize with labels & filters"
            loading={acctLoading}
            connected={connectedPlatforms.has('gmail')}
            tier="tier1"
            tierName={TIER_CONFIGS.tier1.displayName}
            locked={!planAtLeast(client?.plan ?? 'free', 'tier1')}
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
              <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Gmail authorized — agents can read and send email</span>
                  <button
                    onClick={() => handleDisconnect('gmail')}
                    disabled={disconnecting === 'gmail'}
                    className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                  >
                    {disconnecting === 'gmail' ? 'DISCONNECTING…' : 'Disconnect'}
                  </button>
                  <button
                    onClick={() => startGoogleOAuth('gmail')}
                    disabled={disconnecting === 'gmail'}
                    className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.2)'}}
                  >
                    Reconnect
                  </button>
                </div>
                {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
              </div>
            )}
          </IntegrationCard>

          {/* ── Google Calendar ── */}
          <IntegrationCard
            icon={<Calendar size={18} style={{ color: '#00d4ff' }} />}
            title="Google Calendar"
            subtitle="View schedule, check availability, create & manage events"
            loading={acctLoading}
            connected={connectedPlatforms.has('calendar')}
            tier="tier2"
            tierName={TIER_CONFIGS.tier2.displayName}
            locked={!planAtLeast(client?.plan ?? 'free', 'tier2')}
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
              <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Calendar authorized — Booking Agent can manage appointments</span>
                  <button
                    onClick={() => handleDisconnect('calendar')}
                    disabled={disconnecting === 'calendar'}
                    className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                  >
                    {disconnecting === 'calendar' ? 'DISCONNECTING…' : 'Disconnect'}
                  </button>
                  <button
                    onClick={() => startGoogleOAuth('calendar')}
                    disabled={disconnecting === 'calendar'}
                    className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.2)'}}
                  >
                    Reconnect
                  </button>
                </div>
                {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
              </div>
            )}
          </IntegrationCard>

          {/* ── Google Drive ── */}
          <IntegrationCard
            icon={<HardDrive size={18} style={{ color: '#00d4ff' }} />}
            title="Google Drive"
            subtitle="Read, search, and manage files and folders"
            loading={acctLoading}
            connected={connectedPlatforms.has('drive')}
            tier="tier3"
            tierName={TIER_CONFIGS.tier3.displayName}
            locked={!planAtLeast(client?.plan ?? 'free', 'tier3')}
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
              <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Drive authorized — agents can read your documents</span>
                  <button
                    onClick={() => handleDisconnect('drive')}
                    disabled={disconnecting === 'drive'}
                    className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                  >
                    {disconnecting === 'drive' ? 'DISCONNECTING…' : 'Disconnect'}
                  </button>
                  <button
                    onClick={() => startGoogleOAuth('drive')}
                    disabled={disconnecting === 'drive'}
                    className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.2)'}}
                  >
                    Reconnect
                  </button>
                </div>
                {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
              </div>
            )}
          </IntegrationCard>

            {/* ── Google Photos ── */}
            <IntegrationCard
              icon={<Zap size={18} style={{ color: '#00d4ff' }} />}
              title="Google Photos"
              subtitle="Organize photos, detect duplicates, and manage collections"
              loading={acctLoading}
              connected={connectedPlatforms.has('photos')}
              tier="tier4"
              tierName={TIER_CONFIGS.tier4.displayName}
              locked={!hasAccess('tier4')}
            >
              {!acctLoading && !connectedPlatforms.has('photos') && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                  <button
                    onClick={() => startGoogleOAuth('photos')}
                    disabled={!hasAccess('tier4')}
                    className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
                      border: '1px solid rgba(0,212,255,0.35)',
                      color: '#00d4ff',
                    }}
                  >
                    CONNECT PHOTOS
                  </button>
                </div>
              )}
              {!acctLoading && connectedPlatforms.has('photos') && (
                <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle size={13} style={{ color: '#00d4ff' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Photos authorized — agents can organize your photos</span>
                    <button
                      onClick={() => handleDisconnect('photos')}
                      disabled={disconnecting === 'photos'}
                      className="text-xs px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)'}}
                    >
                      {disconnecting === 'photos' ? 'DISCONNECTING…' : 'Disconnect'}
                    </button>
                  </div>
                  {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
                </div>
              )}
            </IntegrationCard>
          </TierSection>

          {/* ── AI Engine ── */}
          <IntegrationCard
            icon={<Zap size={18} style={{ color: '#00d4ff' }} />}
            title="AI Engine"
            subtitle="Anthropic API key — primary AI engine for your agents & chat"
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
                Get your key at <span style={{ color: 'rgba(0,212,255,0.5)' }}>console.anthropic.com</span> → API Keys. Used as the primary AI engine — Gemini is the fallback.
              </p>
            </div>
          </IntegrationCard>

          {/* ── Gemini AI ── */}
          <IntegrationCard
            icon={<Zap size={18} style={{ color: '#00d4ff' }} />}
            title="Gemini AI (Fallback)"
            subtitle="Google Gemini API key — free tier, used when Anthropic is unavailable"
            loading={!geminiKey.loaded}
            connected={!!geminiKey.key}
          >
            <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="AIza…"
                  value={geminiKey.key}
                  onChange={e => geminiKey.setKey(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
                  style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.3)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.12)' }}
                />
                <button
                  onClick={geminiKey.save}
                  disabled={geminiKey.saving || !geminiKey.key.trim()}
                  className="px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
                  style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
                >
                  {geminiKey.saved ? 'SAVED ✓' : geminiKey.saving ? 'SAVING…' : 'SAVE'}
                </button>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Get a free key at <span style={{ color: 'rgba(0,212,255,0.5)' }}>aistudio.google.com</span> → Get API key. No billing required.
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

      {tab === 'brand' && <PasswordChangeSection />}

      {tab === 'billing' && <BillingTab client={client} />}

      {tab === 'account' && <AccountTab />}
    </div>
  )
}

function PasswordChangeSection() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleChange(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) { setMsg({ text: 'Passwords do not match.', ok: false }); return }
    if (newPassword.length < 8) { setMsg({ text: 'Password must be at least 8 characters.', ok: false }); return }
    setLoading(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setMsg(error ? { text: error.message, ok: false } : { text: 'Password updated successfully.', ok: true })
    if (!error) { setNewPassword(''); setConfirm('') }
    setLoading(false)
  }

  return (
    <div
      className="rounded-xl p-5 mt-4"
      style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}
    >
      <h3 className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'rgba(0,212,255,0.5)' }}>CHANGE PASSWORD</h3>
      <form onSubmit={handleChange} className="flex flex-col gap-3 max-w-sm">
        <input
          type="password"
          required
          placeholder="New password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
          style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}
          onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.3)' }}
          onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.1)' }}
        />
        <input
          type="password"
          required
          placeholder="Confirm new password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
          style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}
          onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.3)' }}
          onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.1)' }}
        />
        {msg && <p className={`text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button
          type="submit"
          disabled={loading}
          className="self-start py-2 px-5 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
            border: '1px solid rgba(0,212,255,0.35)',
            color: '#00d4ff',
          }}
        >
          {loading ? 'UPDATING…' : 'UPDATE PASSWORD'}
        </button>
      </form>
    </div>
  )
}

function TierSection({
  name,
  expanded,
  onToggle,
  children,
}: {
  name: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 rounded-lg transition-all"
        style={{
          background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.15)',
        }}
      >
        <ChevronDown
          size={16}
          style={{
            color: '#00d4ff',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s',
          }}
        />
        <span className="text-sm font-semibold tracking-wide" style={{ color: '#00d4ff' }}>
          {name}
        </span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-3 mt-3 pl-2">
          {children}
        </div>
      )}
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
  tier,
  tierName,
  locked,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  loading: boolean
  connected: boolean
  warning?: boolean
  tier?: string
  tierName?: string
  locked?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'rgba(8,13,22,0.8)', border: locked ? '1px solid rgba(255,80,80,0.2)' : '1px solid rgba(0,212,255,0.1)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
            {locked ? <Lock size={18} style={{ color: 'rgba(255,80,80,0.6)' }} /> : icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-sm tracking-wide">{title}</p>
              {tier && tierName && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                  {tierName}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(0,212,255,0.45)' }}>{subtitle}</p>
          </div>
        </div>
        {loading ? (
          <div className="w-24 h-8 rounded-lg animate-pulse" style={{ background: 'rgba(0,212,255,0.05)' }} />
        ) : locked ? (
          <div className="flex items-center gap-1.5">
            <Lock size={14} style={{ color: 'rgba(255,80,80,0.6)' }} />
            <span className="text-xs font-semibold tracking-widest" style={{ color: 'rgba(255,80,80,0.6)' }}>LOCKED</span>
          </div>
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
      {locked && (
        <div className="mt-4 pt-4 px-3 py-3 rounded text-xs" style={{ borderTop: '1px solid rgba(255,80,80,0.15)', background: 'rgba(255,80,80,0.05)' }}>
          <p style={{ color: 'rgba(255,80,80,0.7)' }}>Upgrade to <strong>{tierName}</strong> to use this API</p>
        </div>
      )}
      {!locked && children}
    </div>
  )
}

function AccountTab() {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setDeleting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Error: Not logged in')
        setDeleting(false)
        return
      }

      // Get client ID for deletion
      const { data: client } = await supabase.from('prymal_clients').select('id').eq('user_id', user.id).single()

      if (client) {
        // Delete user's approval queue items
        await supabase.from('prymal_approval_queue').delete().eq('client_id', client.id)

        // Delete user's OAuth tokens
        await supabase.from('prymal_oauth_tokens').delete().eq('client_id', client.id)

        // Delete user's client record
        await supabase.from('prymal_clients').delete().eq('id', client.id)
      }

      // Sign out
      await supabase.auth.signOut()

      // Redirect to login
      navigate('/login')
    } catch (err) {
      alert(`Error deleting account: ${(err as Error).message}`)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div>
      <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,212,255,0.6)' }}>ACCOUNT</p>
        </div>
        <p className="text-sm text-white">Manage your Prymal AI account</p>
      </div>

      <div className="rounded-xl p-5 border border-red-900/30" style={{ background: 'rgba(127,29,29,0.1)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-400 mb-1">Delete Account</h3>
            <p className="text-xs text-slate-400">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              When you delete your account:
            </p>
            <ul className="text-xs text-slate-500 mt-1 ml-4 space-y-0.5">
              <li>• All personal data is permanently deleted</li>
              <li>• Chat history and logs are purged</li>
              <li>• OAuth tokens are revoked</li>
              <li>• Backups are deleted after 7 days</li>
            </ul>
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="py-2 px-4 text-xs font-bold tracking-widest rounded-lg transition-all whitespace-nowrap flex-shrink-0"
            style={{
              background: confirmDelete ? 'rgba(220,38,38,0.3)' : 'rgba(127,29,29,0.3)',
              border: confirmDelete ? '1px solid rgb(220,38,38)' : '1px solid rgba(127,29,29,0.5)',
              color: '#f87171',
            }}
          >
            {deleting ? 'DELETING…' : confirmDelete ? 'CONFIRM DELETE' : 'DELETE ACCOUNT'}
          </button>
        </div>
      </div>
    </div>
  )
}

const PLANS = [
  { key: 'tier1', label: 'Tier 1', price: '$17/mo', features: ['Email management', 'Email composition & drafting', 'Labels, filters, threads'] },
  { key: 'tier2', label: 'Tier 2', price: '$47/mo', features: ['Everything in Tier 1', 'Calendar management', 'Appointment scheduling', 'Google Tasks'] },
  { key: 'tier3', label: 'Tier 3', price: '$97/mo', features: ['Everything in Tier 2', 'Google Drive management', 'Docs, Sheets, Slides', 'Content automation'] },
  { key: 'tier4', label: 'Tier 4', price: '$147/mo', features: ['Everything in Tier 3', 'Google Meet scheduling', 'Contacts & Photos', 'Google Business Profile'] },
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
