import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Search, Clock, Tag } from 'lucide-react'

interface ContactMemory {
  id: string
  contact_email: string
  contact_name: string | null
  company: string | null
  context_summary: string | null
  tags: string[]
  last_interaction: string | null
  updated_at: string
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function RelationshipsPage() {
  const [contacts, setContacts] = useState<ContactMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [staleOnly, setStaleOnly] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: clientRow } = await supabase.from('prymal_clients').select('id').single()
      if (!clientRow) { setLoading(false); return }
      const { data } = await supabase
        .from('prymal_contact_memory')
        .select('*')
        .eq('client_id', clientRow.id)
        .order('updated_at', { ascending: false })
      setContacts((data as ContactMemory[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = contacts.filter(c => {
    if (staleOnly) {
      const d = daysSince(c.last_interaction)
      if (d === null || d < 21) return false
    }
    if (!q) return true
    return [c.contact_name, c.contact_email, c.company, c.context_summary, ...(c.tags ?? [])]
      .filter(Boolean)
      .some(v => (v as string).toLowerCase().includes(q))
  })

  return (
    <div className="p-6 max-w-3xl relative">
      <div
        className="absolute inset-x-0 top-0 h-48 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,212,255,0.06) 0%, transparent 70%)' }}
      />

      <div className="relative mb-6">
        <p className="text-xs tracking-widest font-semibold mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>
          ALFY'S MEMORY
        </p>
        <h1 className="text-2xl font-bold tracking-wide text-white">Relationships</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Everything Alfy knows about the people you work with. Memory builds automatically as Alfy reads
          your email, preps meetings, and works alongside you — or tell Alfy about someone in chat.
        </p>
      </div>

      {/* Search + filters */}
      <div className="relative flex gap-2 mb-5 flex-wrap">
        <div
          className="flex items-center gap-2 flex-1 min-w-48 rounded-lg px-3 py-2"
          style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)' }}
        >
          <Search size={14} style={{ color: 'rgba(0,212,255,0.5)' }} />
          <input
            type="text"
            placeholder="Search people, companies, context…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setStaleOnly(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
          style={staleOnly
            ? { background: 'rgba(255,160,0,0.12)', border: '1px solid rgba(255,160,0,0.35)', color: '#ffa500' }
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }
          }
        >
          <Clock size={12} />
          Haven't spoken in 3+ weeks
        </button>
      </div>

      {loading ? (
        <p className="relative text-xs tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>LOADING…</p>
      ) : filtered.length === 0 ? (
        <div
          className="relative rounded-2xl p-8 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,255,0.1)' }}
        >
          <Users size={24} className="mx-auto mb-3" style={{ color: 'rgba(0,212,255,0.35)' }} />
          <p className="text-sm font-semibold text-white mb-1">
            {contacts.length === 0 ? 'No relationship memory yet' : 'No matches'}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: '380px', margin: '0 auto' }}>
            {contacts.length === 0
              ? 'Alfy builds memory as it works. Try asking Alfy for your morning brief, or say "remember that Jordan Lee is my top client at Acme."'
              : 'Try a different search or clear the stale filter.'}
          </p>
        </div>
      ) : (
        <div className="relative flex flex-col gap-3">
          {filtered.map(c => {
            const stale = daysSince(c.last_interaction)
            return (
              <div
                key={c.id}
                className="rounded-xl p-4"
                style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {c.contact_name ?? c.contact_email}
                      {c.company && (
                        <span className="font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}> · {c.company}</span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(0,212,255,0.5)' }}>{c.contact_email}</p>
                  </div>
                  {stale !== null && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={stale >= 21
                        ? { background: 'rgba(255,160,0,0.1)', border: '1px solid rgba(255,160,0,0.3)', color: '#ffa500' }
                        : { background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', color: 'rgba(0,212,255,0.6)' }
                      }
                    >
                      {stale === 0 ? 'today' : `${stale}d ago`}
                    </span>
                  )}
                </div>
                {c.context_summary && (
                  <p className="text-sm leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {c.context_summary}
                  </p>
                )}
                {c.tags?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {c.tags.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                        style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)', color: 'rgba(0,212,255,0.6)' }}
                      >
                        <Tag size={9} />
                        {t}
                      </span>
                    ))}
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
