import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useClient } from '@/hooks/useClient'
import { AGENTS } from '@/lib/agents'
import { ChevronRight, Clock, Zap } from 'lucide-react'

export function DashboardPage() {
  const { client } = useClient()
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({})
  const [countsLoading, setCountsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prymal_approval_queue')
        .select('agent')
        .eq('status', 'pending')
      if (data) {
        const counts: Record<string, number> = {}
        for (const row of data) {
          counts[row.agent] = (counts[row.agent] ?? 0) + 1
        }
        setPendingCounts(counts)
      }
      setCountsLoading(false)
    }
    load()
  }, [])

  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Zap size={22} className="text-amber-500" />
          <h1 className="text-2xl font-semibold text-white">
            {client?.business_name ?? 'Your AI Team'}
          </h1>
        </div>
        <p className="text-zinc-500 text-sm">
          {AGENTS.length} agents active — monitoring and running your business around the clock
        </p>
        {!countsLoading && totalPending > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Clock size={13} className="text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">
              {totalPending} item{totalPending > 1 ? 's' : ''} awaiting your approval across your agents
            </span>
          </div>
        )}
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AGENTS.map(agent => {
          const pending = pendingCounts[agent.id] ?? 0
          const Icon = agent.icon
          return (
            <Link
              key={agent.id}
              to={`/agents/${agent.id}`}
              className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 flex flex-col gap-4 transition-all"
            >
              {/* Icon + status */}
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${agent.color.bg} border ${agent.color.border}`}>
                  <Icon size={18} className={agent.color.text} />
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${agent.color.dot}`} />
                  <span className="text-xs text-zinc-500">Active</span>
                </div>
              </div>

              {/* Name + description */}
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{agent.name}</p>
                <p className={`text-xs mt-0.5 ${agent.color.text}`}>{agent.tagline}</p>
                <p className="text-zinc-500 text-xs mt-2 leading-relaxed line-clamp-2">
                  {agent.description}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                {pending > 0 ? (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                    <Clock size={11} />
                    {pending} pending approval{pending > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">No pending items</span>
                )}
                <ChevronRight
                  size={14}
                  className="text-zinc-600 group-hover:text-zinc-300 transition-colors"
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
