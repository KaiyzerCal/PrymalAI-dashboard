import { useEffect, useState } from 'react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { formatRelative } from '@/lib/utils'
import { Check, X, Edit2, ChevronDown, ChevronUp } from 'lucide-react'

interface ApprovalItem {
  id: string
  agent: string
  action_type: string
  draft_content: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const agentColor: Record<string, string> = {
  google: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  brand: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  outreach: 'bg-green-500/10 text-green-400 border-green-500/20',
  service: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  ops: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  intel: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

type Tab = 'pending' | 'approved' | 'rejected'

export function ApprovalQueuePage() {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [tab, setTab] = useState<Tab>('pending')
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prymal_approval_queue')
        .select('*')
        .order('created_at', { ascending: false })
      setItems(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function sendAction(id: string, reply: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${FUNCTION_BASE}/prymal-approval-flow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ item_id: id, reply_text: reply }),
    })
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, status: reply === 'APPROVE' ? 'approved' : reply === 'REJECT' ? 'rejected' : 'approved' }
          : it
      )
    )
  }

  const filtered = items.filter((i) => i.status === tab)

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-white mb-1">Approval Queue</h1>
      <p className="text-zinc-400 text-sm mb-6">Review and approve AI-drafted actions</p>

      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => {
          const count = items.filter((i) => i.status === t).length
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
                tab === t
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className="ml-2 text-xs opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">No {tab} items.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => {
            const color = agentColor[item.agent] ?? 'bg-zinc-700/20 text-zinc-400 border-zinc-600/20'
            const isExpanded = expandedId === item.id
            const isEditing = editId === item.id

            return (
              <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded border ${color}`}>
                      {item.agent}
                    </span>
                    <span className="text-xs text-zinc-500">{item.action_type}</span>
                    <span className="text-xs text-zinc-600">{formatRelative(item.created_at)}</span>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-zinc-500 hover:text-zinc-300 shrink-0"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                <p className={`mt-3 text-sm text-zinc-300 ${isExpanded ? '' : 'line-clamp-2'}`}>
                  {item.draft_content}
                </p>

                {isEditing && (
                  <textarea
                    className="mt-3 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                    rows={4}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                )}

                {tab === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    {isEditing ? (
                      <>
                        <button
                          onClick={async () => {
                            await sendAction(item.id, `EDIT ${editText}`)
                            setEditId(null)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors"
                        >
                          Submit edit
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => sendAction(item.id, 'APPROVE')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs hover:bg-green-500/20 transition-colors"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => { setEditId(item.id); setEditText(item.draft_content) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700/30 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700/50 transition-colors"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => sendAction(item.id, 'REJECT')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                        >
                          <X size={12} /> Reject
                        </button>
                      </>
                    )}
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
