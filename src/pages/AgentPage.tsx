import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { getAgent } from '@/lib/agents'
import { formatRelative, formatDate } from '@/lib/utils'
import {
  Check, X, Edit2, ChevronDown, ChevronUp,
  Star, Flag, CheckCircle, MessageSquare, Globe,
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
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
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

function GoogleContent() {
  const [reviews, setReviews] = useState<GmbReview[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded'>('all')

  useEffect(() => {
    supabase
      .from('prymal_gmb_reviews')
      .select('*')
      .order('review_date', { ascending: false, nullsFirst: false })
      .then(({ data }) => { setReviews(data ?? []); setLoading(false) })
  }, [])

  const filtered = reviews.filter(r => filter === 'all' || r.response_status === filter)
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    : '—'
  const pendingCount = reviews.filter(r => r.response_status === 'pending').length

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-white mb-4">Google Reviews</h2>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Reviews', value: String(reviews.length) },
          { label: 'Average Rating', value: `${avgRating} ★` },
          { label: 'Awaiting Response', value: String(pendingCount) },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
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
        <p className="text-zinc-500 text-sm">No reviews found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(review => (
            <div key={review.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
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
        <h2 className="text-base font-semibold text-white">Social Posts</h2>
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
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
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
      <h2 className="text-base font-semibold text-white mb-4">Weekly Briefings</h2>
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
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
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

// ─── Outreach / Service history ───────────────────────────────────────────────

function AgentHistory({ agentId }: { agentId: string }) {
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
      <h2 className="text-base font-semibold text-white mb-4">Recent Activity</h2>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 text-sm">No completed actions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div
              key={item.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
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
      body: JSON.stringify({ item_id: itemId, reply_text: reply }),
    })
    setPendingItems(prev => prev.filter(i => i.id !== itemId))
  }

  if (!agent) return <Navigate to="/" replace />

  const Icon = agent.icon

  return (
    <div className="p-6 max-w-4xl">
      {/* Agent hero */}
      <div className={`rounded-xl border ${agent.color.border} ${agent.color.bg} p-6 mb-8`}>
        <div className="flex items-start gap-5">
          <div className={`p-3 rounded-xl bg-zinc-900/60 border ${agent.color.border} shrink-0`}>
            <Icon size={28} className={agent.color.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-white">{agent.name}</h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${agent.color.dot}`} />
                <span className="text-xs text-zinc-400">Active</span>
              </div>
            </div>
            <p className={`text-sm font-medium mb-2 ${agent.color.text}`}>{agent.tagline}</p>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">{agent.description}</p>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map(cap => (
                <span
                  key={cap}
                  className={`text-xs px-2.5 py-1 rounded-lg border ${agent.color.bg} ${agent.color.border} ${agent.color.text}`}
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
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-white">Pending Approvals</h2>
            {pendingItems.length > 0 && (
              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-medium">
                {pendingItems.length}
              </span>
            )}
          </div>

          {pendingItems.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-3">
              <CheckCircle size={15} className="text-green-400 shrink-0" />
              <p className="text-sm text-zinc-400">All caught up — no pending approvals.</p>
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
      {(id === 'outreach' || id === 'service') && <AgentHistory agentId={id} />}
    </div>
  )
}
