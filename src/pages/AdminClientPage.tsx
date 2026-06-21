import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { useAdmin } from '@/hooks/useAdmin'
import { ArrowLeft, Play, Star } from 'lucide-react'
import { formatRelative, formatDate } from '@/lib/utils'

type Tab = 'overview' | 'approvals' | 'data' | 'settings'

const planColor: Record<string, string> = {
  trial: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  starter: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  pro: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  agency: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
}

const AGENT_FUNCTIONS: Record<string, string> = {
  google: 'prymal-google-agent',
  brand: 'prymal-brand-agent',
  outreach: 'prymal-outreach-agent',
  service: 'prymal-service-agent',
  booking: 'prymal-booking-agent',
  intel: 'prymal-intel-agent',
}

export function AdminClientPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [runningAgent, setRunningAgent] = useState<string | null>(null)

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTION_BASE}/prymal-admin-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'get_client', client_id: id }),
    })
    const result = await res.json()
    setData(result)
    const c = result.client ?? {}
    setEditForm({
      business_name: c.business_name ?? '',
      brand_tone: c.brand_tone ?? '',
      knowledge_base: c.knowledge_base ?? '',
      delivery_cadence: c.delivery_cadence ?? '',
      gbp_account_id: c.gbp_account_id ?? '',
      gbp_location_id: c.gbp_location_id ?? '',
      plan: c.plan ?? 'trial',
      status: c.status ?? 'active',
      contact_name: c.contact_name ?? '',
      website: c.website ?? '',
      industry: c.industry ?? '',
    })
    setLoading(false)
  }

  useEffect(() => { if (!adminLoading && isAdmin && id) load() }, [isAdmin, adminLoading, id])

  async function saveSettings() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTION_BASE}/prymal-admin-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'update_client', client_id: id, ...editForm }),
    })
    const result = await res.json()
    setSaveMsg(result.success ? 'Saved.' : result.error ?? 'Failed')
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 2000)
    if (result.success) load()
  }

  if (adminLoading || loading) return <div className="p-6"><p className="text-zinc-500 text-sm">Loading…</p></div>
  if (!isAdmin) return <div className="p-6"><p className="text-red-400 text-sm">Access denied.</p></div>

  const client = (data?.client ?? {}) as Record<string, string>
  const approvals = (data?.approvals ?? []) as Record<string, string>[]
  const reviews = (data?.reviews ?? []) as Record<string, unknown>[]
  const leads = (data?.leads ?? []) as Record<string, string>[]
  const inquiries = (data?.inquiries ?? []) as Record<string, string>[]
  const appointments = (data?.appointments ?? []) as Record<string, string>[]

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'approvals', label: `APPROVALS ${approvals.filter(a => a.status === 'pending').length > 0 ? `(${approvals.filter(a => a.status === 'pending').length})` : ''}` },
    { id: 'data', label: 'DATA' },
    { id: 'settings', label: 'SETTINGS' },
  ]

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6">
        <ArrowLeft size={12} /> Back to Admin
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-wide text-white">{client.business_name ?? 'Unknown Business'}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{client.owner_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded border font-semibold tracking-widest uppercase ${planColor[client.plan] ?? planColor.trial}`}>
            {client.plan}
          </span>
          <span className={`text-xs px-2 py-1 rounded border capitalize ${client.status === 'active' ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>
            {client.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 rounded-lg overflow-hidden w-fit" style={{ border: '1px solid rgba(0,212,255,0.12)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 text-xs font-semibold tracking-widest transition-all"
            style={tab === t.id ? { background: 'rgba(0,212,255,0.1)', color: '#00d4ff' } : { background: 'transparent', color: 'rgba(255,255,255,0.35)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Reviews', value: reviews.length },
              { label: 'Leads', value: leads.length },
              { label: 'Inquiries', value: inquiries.length },
              { label: 'Appointments', value: appointments.length },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.7)' }}>RUN AGENTS</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(AGENT_FUNCTIONS).map(([agentId, fnName]) => (
              <button
                key={agentId}
                disabled={runningAgent !== null}
                onClick={async () => {
                  setRunningAgent(agentId)
                  const { data: { session } } = await supabase.auth.getSession()
                  await fetch(`${FUNCTION_BASE}/${fnName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                    body: JSON.stringify({}),
                  })
                  setRunningAgent(null)
                  load()
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all disabled:opacity-40"
                style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'rgba(0,212,255,0.7)' }}
              >
                <Play size={10} />
                {runningAgent === agentId ? 'Running…' : agentId.charAt(0).toUpperCase() + agentId.slice(1) + ' Agent'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Approvals tab */}
      {tab === 'approvals' && (
        <div className="flex flex-col gap-2">
          {approvals.length === 0 ? <p className="text-zinc-500 text-sm">No approvals yet.</p> : approvals.map(a => (
            <div key={a.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-sm text-white font-medium capitalize">{a.action_type?.replace(/_/g, ' ')}</p>
                <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${a.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : a.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {a.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2">{a.draft_content}</p>
              <p className="text-xs text-zinc-600 mt-1">{formatRelative(a.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Data tab */}
      {tab === 'data' && (
        <div className="flex flex-col gap-6">
          {reviews.length > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.7)' }}>GOOGLE REVIEWS ({reviews.length})</p>
              <div className="flex flex-col gap-2">
                {reviews.map((r, i) => (
                  <div key={i} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
                    <div>
                      <p className="text-sm text-white">{String(r.reviewer_name ?? 'Anonymous')}</p>
                      <p className="text-xs text-zinc-500 line-clamp-1">{String(r.review_text ?? '')}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {Array.from({ length: Number(r.rating ?? 0) }).map((_, j) => <Star key={j} size={10} className="fill-amber-400 text-amber-400" />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leads.length > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.7)' }}>LEADS ({leads.length})</p>
              <div className="flex flex-col gap-2">
                {leads.map(l => (
                  <div key={l.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
                    <div>
                      <p className="text-sm text-white">{l.name}</p>
                      <p className="text-xs text-zinc-500">{[l.company, l.email].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded border capitalize bg-blue-500/10 text-blue-400 border-blue-500/20">{l.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inquiries.length > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.7)' }}>INQUIRIES ({inquiries.length})</p>
              <div className="flex flex-col gap-2">
                {inquiries.map(inq => (
                  <div key={inq.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
                    <p className="text-sm text-white">{inq.customer_name ?? 'Anonymous'}</p>
                    <p className="text-xs text-zinc-400 line-clamp-2">{inq.subject ?? inq.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appointments.length > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.7)' }}>APPOINTMENTS ({appointments.length})</p>
              <div className="flex flex-col gap-2">
                {appointments.map(a => (
                  <div key={a.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
                    <div>
                      <p className="text-sm text-white">{a.customer_name}</p>
                      <p className="text-xs text-zinc-500">{[a.service_type, a.confirmed_date ? formatDate(a.confirmed_date) : a.requested_date ? formatDate(a.requested_date) : null].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded border capitalize bg-blue-500/10 text-blue-400 border-blue-500/20">{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviews.length === 0 && leads.length === 0 && inquiries.length === 0 && appointments.length === 0 && (
            <p className="text-zinc-500 text-sm">No data yet for this client.</p>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="flex flex-col gap-4 max-w-xl">
          {[
            { key: 'business_name', label: 'BUSINESS NAME' },
            { key: 'contact_name', label: 'CONTACT NAME' },
            { key: 'website', label: 'WEBSITE' },
            { key: 'industry', label: 'INDUSTRY' },
            { key: 'gbp_account_id', label: 'GBP ACCOUNT ID' },
            { key: 'gbp_location_id', label: 'GBP LOCATION ID' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
              <input
                type="text"
                value={editForm[key] ?? ''}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
              />
            </div>
          ))}
          {[
            { key: 'brand_tone', label: 'BRAND TONE', rows: 2 },
            { key: 'knowledge_base', label: 'KNOWLEDGE BASE', rows: 4 },
            { key: 'delivery_cadence', label: 'DELIVERY CADENCE', rows: 1 },
          ].map(({ key, label, rows }) => (
            <div key={key}>
              <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
              <textarea
                rows={rows}
                value={editForm[key] ?? ''}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'plan', label: 'PLAN', options: ['trial', 'starter', 'pro', 'agency'] },
              { key: 'status', label: 'STATUS', options: ['active', 'cancelled', 'past_due'] },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
                <select
                  value={editForm[key] ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)', colorScheme: 'dark' }}
                >
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          {saveMsg && <p className="text-xs text-green-400">{saveMsg}</p>}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="self-start px-5 py-2 text-xs font-bold tracking-widest rounded-lg disabled:opacity-40"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
          >
            {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
        </div>
      )}
    </div>
  )
}
