import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { ChevronDown, ChevronUp, Flag } from 'lucide-react'

interface Briefing {
  id: string
  title: string
  summary: string
  flags: string[]
  created_at: string
}

const flagColor: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
  opportunity: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prymal_intel_briefings')
        .select('*')
        .order('created_at', { ascending: false })
      setBriefings(data ?? [])
      if (data && data.length > 0) setOpenId(data[0].id)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-white mb-1">Intel Briefings</h1>
      <p className="text-zinc-400 text-sm mb-6">Weekly AI-generated summaries of your business intelligence</p>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : briefings.length === 0 ? (
        <p className="text-zinc-500 text-sm">No briefings yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {briefings.map((b) => {
            const isOpen = openId === b.id
            return (
              <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setOpenId(isOpen ? null : b.id)}
                >
                  <div>
                    <p className="text-white font-medium text-sm">{b.title}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">{formatDate(b.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.flags && b.flags.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Flag size={12} className="text-amber-500" />
                        <span className="text-xs text-amber-500">{b.flags.length}</span>
                      </div>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-zinc-800">
                    {b.flags && b.flags.length > 0 && (
                      <div className="flex flex-wrap gap-2 py-3">
                        {b.flags.map((flag, i) => {
                          const key = flag.toLowerCase().split(':')[0] ?? 'info'
                          const color = flagColor[key] ?? flagColor.info
                          return (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded border ${color}`}>
                              {flag}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap mt-2">
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
