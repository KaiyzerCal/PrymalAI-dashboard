import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { getAgent } from '@/lib/agents'
import { formatRelative, formatDate } from '@/lib/utils'
import {
  Check, X, Edit2, ChevronDown, ChevronUp,
  Star, Flag, CheckCircle, MessageSquare, Globe, Play, Plus,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApprovalItem {
  id: string
  agent: string
  action_type: string
  draft_content: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface GmbReview {
  id: string
  reviewer_name: string | null
  rating: number | null
  review_text: string | null
  response_status: 'pending' | 'responded' | 'skipped'
  response_text: string | null
  review_date: string | null
  created_at: string
}

interface SocialPost {
  id: string
  platform: string
  content: string
  status: 'drafted' | 'scheduled' | 'published'
  scheduled_for: string | null
  created_at: string
}

interface Briefing {
  id: string
  title: string
  summary: string
  flags: string[]
  created_at: string
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={12}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}
        />
      ))}
    </div>
  )
}

// ─── Approval Card ───────────────────────────────────────────────────────────

function ApprovalCard({
  item,
  onAction,
}: {
  item: ApprovalItem
  onAction: (id: string, reply: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.draft_content)
  const [busy, setBusy] = useState(false)

  async function handle(reply: string) {
    setBusy(true)
    await onAction(item.id, reply)
    setBusy(false)
    setEditing(false)
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(6,10,18,0.9)', border: '1px solid rgba(0,212,255,0.1)' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-300 capitalize">
            {item.action_type.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-zinc-600">{formatRelative(item.created_at)}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-600 hover:text-zinc-400 shrink-0 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {editing ? (
        <textarea
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 resize-none mt-1"
          rows={5}
          value={editText}
          onChange={e => setEditText(e.target.value)}
        />
      ) : (
        <p className={`text-sm text-zinc-300 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {item.draft_content}
        </p>
      )}

      <div className="flex gap-2 mt-4">
        {editing ? (
          <>
            <button
              onClick={() => handle(`EDIT ${editText}`)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              Submit edit
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handle('APPROVE')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              <Check size={12} /> Approve
            </button>
            <button
              onClick={() => { setEditing(true); setEditText(item.draft_content) }}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <Edit2 size={12} /> Edit
            </button>
            <button
              onClick={() => handle('REJECT')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <X size={12} /> Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Google-specific content ─────────────────────────────────────────────────

interface ClientRow {
  gbp_account_id: string | null
  gbp_location_id: string | null
}

function GoogleSetupBanner({ client }: { client: ClientRow | null }) {
  const hasTokens = true // already confirmed tokens stored
  const hasIds = !!(client?.gbp_account_id && client?.gbp_location_id)

  const steps = [
    {
      done: hasTokens,
      label: 'Google account connected',
      detail: 'OAuth tokens stored successfully.',
    },
    {
      done: hasIds,
      label: 'Business Profile IDs configured',
      detail: hasIds
        ? `Account: ${client?.gbp_account_id}`
        : 'Enter your GBP Account ID and Location ID in Settings → Integrations.',
    },
    {
      done: false,
      label: 'Google API access approved',
      detail: 'Google requires manual approval for new projects. Request quota increase in Google Cloud Console.',
    },
  ]

  if (hasIds) return null

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{ background: 'rgba(8,13,22,0.9)', border: '1px solid rgba(251,191,36,0.2)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />
        <p className="text-xs font-bold tracking-widest" style={{ color: '#fbbf24' }}>SETUP REQUIRED</p>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
              step.done
                ? 'bg-green-500/20 text-green-400'
                : 'bg-zinc-800 text-zinc-500'
            }`} style={step.done ? { border: '1px solid rgba(74,222,128,0.3)' } : { border: '1px solid rgba(255,255,255,0.1)' }}>
              {step.done ? '✓' : i + 1}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${step.done ? 'text-zinc-400 line-through' : 'text-white'}`}>
                {step.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{step.detail}</p>
              {i === 1 && !step.done && (
                <a
                  href="/settings"
                  className="inline-block mt-2 text-xs font-semibold tracking-widest px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: 'rgba(0,212,255,0.08)',
                    border: '1px solid rgba(0,212,255,0.25)',
                    color: '#00d4ff',
                  }}
                >
                  GO TO SETTINGS →
                </a>
              )}
              {i === 2 && (
                <a
                  href="https://console.cloud.google.com/apis/api/mybusinessaccountmanagement.googleapis.com/quotas?project=fluted-current-500019-i0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs font-semibold tracking-widest px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: 'rgba(251,191,36,0.08)',
                    border: '1px solid rgba(251,191,36,0.25)',
                    color: '#fbbf24',
                  }}
                >
                  REQUEST QUOTA INCREASE →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GoogleContent() {
  const [reviews, setReviews] = useState<GmbReview[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded'>('all')
  const [client, setClient] = useState<ClientRow | null>(null)

  useEffect(() => {
    Promise.all([
      supabase
        .from('prymal_gmb_reviews')
        .select('*')
        .order('review_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('prymal_clients')
        .select('gbp_account_id, gbp_location_id')
        .single(),
    ]).then(([reviewsRes, clientRes]) => {
      setReviews(reviewsRes.data ?? [])
      setClient(clientRes.data ?? null)
      setLoading(false)
    })
  }, [])

  const filtered = reviews.filter(r => filter === 'all' || r.response_status === filter)
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    : '—'
  const pendingCount = reviews.filter(r => r.response_status === 'pending').length

  return (
    <div className="mt-8">
      {!loading && <GoogleSetupBanner client={client} />}

      <h2 className="text-xs font-bold tracking-widest mb-4" style={{ color: 'rgba(0,212,255,0.7)' }}>GOOGLE REVIEWS</h2>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Reviews', value: String(reviews.length) },
          { label: 'Average Rating', value: `${avgRating} ★` },
          { label: 'Awaiting Response', value: String(pendingCount) },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <p className="text-2xl font-semibold text-white">{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'responded'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs border transition-colors capitalize ${
              filter === f
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}
        >
          <p className="text-zinc-500 text-sm mb-1">No reviews synced yet.</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Reviews will appear here once your Google Business Profile API access is approved and Business Profile IDs are configured.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(review => (
            <div key={review.id} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {review.reviewer_name ?? 'Anonymous'}
                    </span>
                    <Stars rating={review.rating} />
                  </div>
                  {review.review_date && (
                    <p className="text-xs text-zinc-600 mt-0.5">{formatDate(review.review_date)}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded border shrink-0 ${
                    review.response_status === 'responded'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : review.response_status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-zinc-700/30 text-zinc-500 border-zinc-700/30'
                  }`}
                >
                  {review.response_status}
                </span>
              </div>

              {review.review_text && (
                <p className="text-sm text-zinc-300 mt-3 leading-relaxed">{review.review_text}</p>
              )}

              {review.response_text && (
                <div className="mt-3 pl-3 border-l-2 border-zinc-700">
                  <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                    <MessageSquare size={10} /> Your response
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{review.response_text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Brand-specific content ───────────────────────────────────────────────────

const postStatusBadge: Record<string, string> = {
  drafted: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  published: 'bg-green-500/10 text-green-400 border-green-500/20',
}

function BrandContent() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('prymal_social_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPosts(data ?? []); setLoading(false) })
  }, [])

  const filtered = posts.filter(p => statusFilter === 'all' || p.status === statusFilter)

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,212,255,0.7)' }}>SOCIAL POSTS</h2>
          <RunAgentButton functionName="prymal-brand-agent" label="DRAFT POSTS" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'drafted', 'scheduled', 'published'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Drafted', value: posts.filter(p => p.status === 'drafted').length },
          { label: 'Scheduled', value: posts.filter(p => p.status === 'scheduled').length },
          { label: 'Published', value: posts.filter(p => p.status === 'published').length },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <p className="text-2xl font-semibold text-white">{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">No posts found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(post => (
            <div
              key={post.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 capitalize flex items-center gap-1.5">
                  <Globe size={12} /> {post.platform}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${postStatusBadge[post.status] ?? postStatusBadge.drafted}`}
                >
                  {post.status}
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4 flex-1">
                {post.content}
              </p>
              <p className="text-xs text-zinc-600">
                {post.scheduled_for
                  ? `Scheduled ${formatDate(post.scheduled_for)}`
                  : formatDate(post.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Intel-specific content ───────────────────────────────────────────────────

const flagColor: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
  opportunity: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

function IntelContent() {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('prymal_intel_briefings')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBriefings(data ?? [])
        if (data && data.length > 0) setOpenId(data[0].id)
        setLoading(false)
      })
  }, [])

  return (
    <div className="mt-8">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,212,255,0.7)' }}>WEEKLY BRIEFINGS</h2>
        <RunAgentButton functionName="prymal-intel-agent" label="GENERATE BRIEFING" />
      </div>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : briefings.length === 0 ? (
        <p className="text-zinc-500 text-sm">No briefings yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {briefings.map(b => {
            const isOpen = openId === b.id
            return (
              <div
                key={b.id}
                className="rounded-xl overflow-hidden" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}
              >
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-800/40 transition-colors"
                  onClick={() => setOpenId(isOpen ? null : b.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{b.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{formatDate(b.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.flags?.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Flag size={11} className="text-amber-500" />
                        <span className="text-xs text-amber-500">{b.flags.length}</span>
                      </div>
                    )}
                    {isOpen
                      ? <ChevronUp size={14} className="text-zinc-500" />
                      : <ChevronDown size={14} className="text-zinc-500" />
                    }
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-zinc-800">
                    {b.flags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 py-3">
                        {b.flags.map((flag, i) => {
                          const key = flag.toLowerCase().split(':')[0] ?? 'info'
                          const color = flagColor[key] ?? flagColor['info']
                          return (
                            <span
                              key={i}
                              className={`text-xs px-2 py-0.5 rounded border ${color}`}
                            >
                              {flag}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap mt-2">
                      {b.summary}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Run Agent Button ─────────────────────────────────────────────────────────

function RunAgentButton({ functionName, label = 'RUN AGENT', body = {} }: { functionName: string; label?: string; body?: Record<string, unknown> }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function run() {
    setRunning(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FUNCTION_BASE}/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const drafted = data.drafted ?? data.briefing_created ? 1 : 0
        setResult({ ok: true, msg: data.message ?? `Done — ${drafted} item${drafted !== 1 ? 's' : ''} drafted` })
      } else {
        setResult({ ok: false, msg: data.error ?? 'Failed' })
      }
    } catch (err) {
      setResult({ ok: false, msg: String(err) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all disabled:opacity-50"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
          border: '1px solid rgba(0,212,255,0.35)',
          color: '#00d4ff',
        }}
      >
        <Play size={11} />
        {running ? 'RUNNING…' : label}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}>{result.msg}</span>
      )}
    </div>
  )
}

// ─── Outreach content ─────────────────────────────────────────────────────────

interface Lead {
  id: string
  name: string
  email: string | null
  company: string | null
  status: string
  created_at: string
}

function OutreachContent() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', company: '', notes: '' })
  const [adding, setAdding] = useState(false)

  async function loadLeads() {
    const { data } = await supabase.from('prymal_leads').select('*').order('created_at', { ascending: false }).limit(50)
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadLeads() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const { data: client } = await supabase.from('prymal_clients').select('id').single()
    if (client) {
      await supabase.from('prymal_leads').insert({ client_id: client.id, ...addForm, status: 'new' })
      setAddForm({ name: '', email: '', company: '', notes: '' })
      setShowAdd(false)
      loadLeads()
    }
    setAdding(false)
  }

  const statusColor: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    contacted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    converted: 'bg-green-500/10 text-green-400 border-green-500/20',
    lost: 'bg-zinc-700/30 text-zinc-500 border-zinc-700',
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Leads', value: leads.length },
          { label: 'New', value: leads.filter(l => l.status === 'new').length },
          { label: 'Converted', value: leads.filter(l => l.status === 'converted').length },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <p className="text-2xl font-semibold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <RunAgentButton functionName="prymal-outreach-agent" label="DRAFT OUTREACH" />
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold tracking-widest px-3 py-2 rounded-lg transition-all"
          style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
        >
          <Plus size={11} /> ADD LEAD
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl p-4 mb-4 flex flex-col gap-3" style={{ background: 'rgba(8,13,22,0.9)', border: '1px solid rgba(0,212,255,0.15)' }}>
          {[
            { key: 'name', label: 'NAME *', placeholder: 'Jane Smith' },
            { key: 'email', label: 'EMAIL', placeholder: 'jane@company.com' },
            { key: 'company', label: 'COMPANY', placeholder: 'Acme Corp' },
            { key: 'notes', label: 'NOTES', placeholder: 'Met at conference, interested in…' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={addForm[key as keyof typeof addForm]}
                onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
              />
            </div>
          ))}
          <button type="submit" disabled={adding || !addForm.name} className="py-2 text-xs font-bold tracking-widest rounded-lg disabled:opacity-40" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
            {adding ? 'ADDING…' : 'ADD LEAD'}
          </button>
        </form>
      )}

      {loading ? <p className="text-zinc-500 text-sm">Loading…</p> : leads.length === 0 ? (
        <p className="text-zinc-500 text-sm">No leads yet. Add your first lead above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map(lead => (
            <div key={lead.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
              <div>
                <p className="text-sm font-medium text-white">{lead.name}</p>
                <p className="text-xs text-zinc-500">{[lead.company, lead.email].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusColor[lead.status] ?? statusColor.new}`}>{lead.status}</span>
                <span className="text-xs text-zinc-600">{formatRelative(lead.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Service content ──────────────────────────────────────────────────────────

interface Inquiry {
  id: string
  customer_name: string | null
  customer_email: string | null
  subject: string | null
  message: string
  channel: string
  status: string
  created_at: string
}

function ServiceContent() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ customer_name: '', customer_email: '', subject: '', message: '', channel: 'email' })
  const [adding, setAdding] = useState(false)

  async function loadInquiries() {
    const { data } = await supabase.from('prymal_inquiries').select('*').order('created_at', { ascending: false }).limit(50)
    setInquiries(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadInquiries() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const { data: client } = await supabase.from('prymal_clients').select('id').single()
    if (client) {
      await supabase.from('prymal_inquiries').insert({ client_id: client.id, ...addForm, status: 'new' })
      setAddForm({ customer_name: '', customer_email: '', subject: '', message: '', channel: 'email' })
      setShowAdd(false)
      loadInquiries()
    }
    setAdding(false)
  }

  const statusColor: Record<string, string> = {
    new: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    drafted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    responded: 'bg-green-500/10 text-green-400 border-green-500/20',
    closed: 'bg-zinc-700/30 text-zinc-500 border-zinc-700',
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: inquiries.length },
          { label: 'New', value: inquiries.filter(i => i.status === 'new').length },
          { label: 'Responded', value: inquiries.filter(i => i.status === 'responded').length },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <p className="text-2xl font-semibold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <RunAgentButton functionName="prymal-service-agent" label="DRAFT REPLIES" />
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold tracking-widest px-3 py-2 rounded-lg transition-all"
          style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
        >
          <Plus size={11} /> ADD INQUIRY
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl p-4 mb-4 flex flex-col gap-3" style={{ background: 'rgba(8,13,22,0.9)', border: '1px solid rgba(0,212,255,0.15)' }}>
          {[
            { key: 'customer_name', label: 'CUSTOMER NAME', placeholder: 'John Doe' },
            { key: 'customer_email', label: 'EMAIL', placeholder: 'john@example.com' },
            { key: 'subject', label: 'SUBJECT', placeholder: 'Question about pricing…' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
              <input type="text" placeholder={placeholder} value={addForm[key as keyof typeof addForm]}
                onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>MESSAGE *</label>
            <textarea rows={3} placeholder="Customer's message…" value={addForm.message}
              onChange={e => setAddForm(f => ({ ...f, message: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none resize-none"
              style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }} />
          </div>
          <button type="submit" disabled={adding || !addForm.message} className="py-2 text-xs font-bold tracking-widest rounded-lg disabled:opacity-40" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
            {adding ? 'ADDING…' : 'ADD INQUIRY'}
          </button>
        </form>
      )}

      {loading ? <p className="text-zinc-500 text-sm">Loading…</p> : inquiries.length === 0 ? (
        <p className="text-zinc-500 text-sm">No inquiries yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {inquiries.map(inq => (
            <div key={inq.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{inq.customer_name ?? 'Anonymous'}</p>
                  <p className="text-xs text-zinc-500 truncate">{inq.subject ?? inq.message.slice(0, 60)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusColor[inq.status] ?? statusColor.new}`}>{inq.status}</span>
                  <span className="text-xs text-zinc-600">{formatRelative(inq.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Booking ──────────────────────────────────────────────────────────────────

interface Appointment {
  id: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  service_type: string | null
  requested_date: string | null
  confirmed_date: string | null
  status: string
  created_at: string
}

function BookingContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ customer_name: '', customer_email: '', customer_phone: '', service_type: '', notes: '', requested_date: '' })
  const [adding, setAdding] = useState(false)

  async function loadAppointments() {
    const { data } = await supabase.from('prymal_appointments').select('*').order('created_at', { ascending: false }).limit(50)
    setAppointments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAppointments() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const { data: client } = await supabase.from('prymal_clients').select('id').single()
    if (client) {
      await supabase.from('prymal_appointments').insert({
        client_id: client.id,
        customer_name: addForm.customer_name,
        customer_email: addForm.customer_email || null,
        customer_phone: addForm.customer_phone || null,
        service_type: addForm.service_type || null,
        notes: addForm.notes || null,
        requested_date: addForm.requested_date ? new Date(addForm.requested_date).toISOString() : null,
        status: 'requested',
      })
      setAddForm({ customer_name: '', customer_email: '', customer_phone: '', service_type: '', notes: '', requested_date: '' })
      setShowAdd(false)
      loadAppointments()
    }
    setAdding(false)
  }

  const statusColor: Record<string, string> = {
    requested: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    confirmed: 'bg-green-500/10 text-green-400 border-green-500/20',
    reminded: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    completed: 'bg-zinc-700/30 text-zinc-400 border-zinc-700',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  const thisWeek = appointments.filter(a => {
    const d = new Date(a.created_at)
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000
  })

  return (
    <div className="mt-8">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: appointments.length },
          { label: 'This Week', value: thisWeek.length },
          { label: 'Confirmed', value: appointments.filter(a => a.status === 'confirmed').length },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <p className="text-2xl font-semibold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <RunAgentButton functionName="prymal-booking-agent" label="SEND CONFIRMATIONS" />
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold tracking-widest px-3 py-2 rounded-lg transition-all"
          style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
        >
          <Plus size={11} /> ADD APPOINTMENT
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl p-4 mb-4 flex flex-col gap-3" style={{ background: 'rgba(8,13,22,0.9)', border: '1px solid rgba(0,212,255,0.15)' }}>
          {[
            { key: 'customer_name', label: 'NAME *', placeholder: 'Jane Smith', type: 'text' },
            { key: 'customer_email', label: 'EMAIL', placeholder: 'jane@example.com', type: 'email' },
            { key: 'customer_phone', label: 'PHONE', placeholder: '+1 555 000 0000', type: 'text' },
            { key: 'service_type', label: 'SERVICE', placeholder: 'Personal Training Session', type: 'text' },
            { key: 'requested_date', label: 'REQUESTED DATE', placeholder: '', type: 'datetime-local' },
            { key: 'notes', label: 'NOTES', placeholder: 'Any relevant details…', type: 'text' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>{label}</label>
              <input type={type} placeholder={placeholder} value={addForm[key as keyof typeof addForm]}
                onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)', colorScheme: 'dark' }} />
            </div>
          ))}
          <button type="submit" disabled={adding || !addForm.customer_name} className="py-2 text-xs font-bold tracking-widest rounded-lg disabled:opacity-40" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
            {adding ? 'ADDING…' : 'ADD APPOINTMENT'}
          </button>
        </form>
      )}

      {loading ? <p className="text-zinc-500 text-sm">Loading…</p> : appointments.length === 0 ? (
        <p className="text-zinc-500 text-sm">No appointments yet. Add your first one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {appointments.map(appt => (
            <div key={appt.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}>
              <div>
                <p className="text-sm font-medium text-white">{appt.customer_name}</p>
                <p className="text-xs text-zinc-500">{[appt.service_type, appt.confirmed_date ? formatDate(appt.confirmed_date) : appt.requested_date ? formatDate(appt.requested_date) : null].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusColor[appt.status] ?? statusColor.requested}`}>{appt.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Outreach / Service history ───────────────────────────────────────────────

export function AgentHistory({ agentId }: { agentId: string }) {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('prymal_approval_queue')
      .select('*')
      .eq('agent', agentId)
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [agentId])

  return (
    <div className="mt-8">
      <h2 className="text-xs font-bold tracking-widest mb-4" style={{ color: 'rgba(0,212,255,0.7)' }}>RECENT ACTIVITY</h2>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 text-sm">No completed actions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div
              key={item.id}
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-300 capitalize">
                  {item.action_type.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5 truncate">
                  {item.draft_content.slice(0, 90)}…
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${
                    item.status === 'approved'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  {item.status}
                </span>
                <span className="text-xs text-zinc-600">{formatRelative(item.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AgentPage ────────────────────────────────────────────────────────────────

export function AgentPage() {
  const { id } = useParams<{ id: string }>()
  const agent = id ? getAgent(id) : undefined

  const [pendingItems, setPendingItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supabase
      .from('prymal_approval_queue')
      .select('*')
      .eq('agent', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPendingItems(data ?? []); setLoading(false) })
  }, [id])

  async function sendAction(itemId: string, reply: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${FUNCTION_BASE}/prymal-approval-flow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ approval_id: itemId, reply_text: reply }),
    })
    setPendingItems(prev => prev.filter(i => i.id !== itemId))
  }

  if (!agent) return <Navigate to="/" replace />

  const Icon = agent.icon

  return (
    <div className="p-6 max-w-4xl relative">
      {/* Ambient glow */}
      <div
        className="absolute inset-x-0 top-0 h-56 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(0,212,255,0.06) 0%, transparent 70%)' }}
      />

      {/* Agent hero */}
      <div
        className="relative rounded-xl p-6 mb-8 overflow-hidden"
        style={{
          background: 'rgba(8,13,22,0.9)',
          border: '1px solid rgba(0,212,255,0.15)',
          boxShadow: '0 0 40px rgba(0,212,255,0.05)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)' }}
        />

        <div className="flex items-start gap-5">
          <div
            className="p-3 rounded-xl shrink-0"
            style={{
              background: 'rgba(0,212,255,0.07)',
              border: '1px solid rgba(0,212,255,0.2)',
              boxShadow: '0 0 20px rgba(0,212,255,0.1)',
            }}
          >
            <Icon size={28} className={agent.color.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold tracking-wide text-white">{agent.name.toUpperCase()}</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full dot-pulse" style={{ background: '#00d4ff' }} />
                <span className="text-xs tracking-widest" style={{ color: 'rgba(0,212,255,0.5)' }}>ONLINE</span>
              </div>
            </div>
            <p className={`text-xs font-semibold tracking-widest mb-3 ${agent.color.text}`}>
              {agent.tagline.toUpperCase()}
            </p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {agent.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map(cap => (
                <span
                  key={cap}
                  className="text-xs px-2.5 py-1 rounded tracking-wide"
                  style={{
                    background: 'rgba(0,212,255,0.06)',
                    border: '1px solid rgba(0,212,255,0.15)',
                    color: 'rgba(0,212,255,0.8)',
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pending approvals */}
      {!loading && (
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-px flex-shrink-0 w-4"
              style={{ background: 'rgba(0,212,255,0.3)' }}
            />
            <h2 className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,212,255,0.7)' }}>
              PENDING APPROVALS
            </h2>
            {pendingItems.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded font-bold tracking-wide"
                style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff' }}
              >
                {pendingItems.length}
              </span>
            )}
          </div>

          {pendingItems.length === 0 ? (
            <div
              className="rounded-xl p-5 flex items-center gap-3"
              style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.08)' }}
            >
              <CheckCircle size={15} className="text-green-400 shrink-0" />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                All caught up — no pending approvals.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingItems.map(item => (
                <ApprovalCard key={item.id} item={item} onAction={sendAction} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent-specific content */}
      {id === 'google' && <GoogleContent />}
      {id === 'brand' && <BrandContent />}
      {id === 'intel' && <IntelContent />}
      {id === 'booking' && <BookingContent />}
      {id === 'outreach' && <OutreachContent />}
      {id === 'service' && <ServiceContent />}
    </div>
  )
}
