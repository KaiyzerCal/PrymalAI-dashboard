import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useClient } from '@/hooks/useClient'
import { AGENTS } from '@/lib/agents'
import { ChevronRight, Clock, Activity } from 'lucide-react'

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
    <div className="p-6 max-w-5xl relative">
      {/* Ambient glow top */}
      <div
        className="absolute inset-x-0 top-0 h-64 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,212,255,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <div className="relative mb-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p
              className="text-xs tracking-widest font-semibold mb-2"
              style={{ color: 'rgba(0,212,255,0.5)' }}
            >
              AUTONOMOUS DIGITAL INFRASTRUCTURE
            </p>
            <h1 className="text-3xl font-bold tracking-wide text-white">
              {client?.business_name ?? 'Your AI Team'}
            </h1>
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {AGENTS.length} agents online — operating autonomously around the clock
            </p>
          </div>

          {/* System status */}
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.12)',
            }}
          >
            <Activity size={14} style={{ color: '#00d4ff' }} />
            <div>
              <p className="text-xs font-semibold tracking-widest" style={{ color: '#00d4ff' }}>
                ALL SYSTEMS NOMINAL
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(0,212,255,0.4)' }}>
                {AGENTS.length} agents active
              </p>
            </div>
            <span className="w-2 h-2 rounded-full dot-pulse ml-1" style={{ background: '#00d4ff' }} />
          </div>
        </div>

        {/* Pending banner */}
        {!countsLoading && totalPending > 0 && (
          <div
            className="mt-4 inline-flex items-center gap-2.5 rounded-lg px-4 py-2"
            style={{
              background: 'rgba(0,212,255,0.06)',
              border: '1px solid rgba(0,212,255,0.2)',
              boxShadow: '0 0 20px rgba(0,212,255,0.05)',
            }}
          >
            <Clock size={12} style={{ color: '#00d4ff' }} />
            <span
              className="text-xs font-semibold tracking-wide"
              style={{ color: '#00d4ff' }}
            >
              {totalPending} ACTION{totalPending > 1 ? 'S' : ''} AWAITING YOUR APPROVAL
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        className="mb-8 h-px"
        style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.2) 0%, transparent 60%)' }}
      />

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AGENTS.map(agent => {
          const pending = pendingCounts[agent.id] ?? 0
          const Icon = agent.icon

          return (
            <Link
              key={agent.id}
              to={`/agents/${agent.id}`}
              className="group relative rounded-xl p-5 flex flex-col gap-4 transition-all duration-300"
              style={{
                background: 'rgba(8,13,22,0.8)',
                border: '1px solid rgba(0,212,255,0.08)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.border = '1px solid rgba(0,212,255,0.25)'
                e.currentTarget.style.boxShadow = '0 0 32px rgba(0,212,255,0.08), inset 0 0 32px rgba(0,212,255,0.02)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border = '1px solid rgba(0,212,255,0.08)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Top line accent */}
              <div
                className="absolute top-0 left-4 right-4 h-px rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)' }}
              />

              {/* Icon + status */}
              <div className="flex items-start justify-between">
                <div
                  className={`p-2.5 rounded-xl`}
                  style={{
                    background: 'rgba(0,212,255,0.06)',
                    border: '1px solid rgba(0,212,255,0.15)',
                  }}
                >
                  <Icon size={18} className={agent.color.text} />
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full dot-pulse"
                    style={{ background: '#00d4ff' }}
                  />
                  <span className="text-xs tracking-widest" style={{ color: 'rgba(0,212,255,0.5)' }}>
                    ONLINE
                  </span>
                </div>
              </div>

              {/* Name + description */}
              <div className="flex-1">
                <p className="text-white font-semibold text-sm tracking-wide">{agent.name}</p>
                <p className={`text-xs mt-0.5 ${agent.color.text}`}>{agent.tagline}</p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {agent.description}
                </p>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between pt-3"
                style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}
              >
                {pending > 0 ? (
                  <span
                    className="flex items-center gap-1.5 text-xs font-semibold tracking-wide"
                    style={{ color: '#00d4ff', textShadow: '0 0 8px rgba(0,212,255,0.4)' }}
                  >
                    <Clock size={10} />
                    {pending} PENDING APPROVAL{pending > 1 ? 'S' : ''}
                  </span>
                ) : (
                  <span className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    NO PENDING ITEMS
                  </span>
                )}
                <ChevronRight
                  size={14}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                  style={{ color: 'rgba(0,212,255,0.4)' }}
                />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Footer tagline */}
      <p
        className="mt-12 text-center text-xs tracking-widest"
        style={{ color: 'rgba(0,212,255,0.15)' }}
      >
        OUR AGENTS · OUR SYSTEMS · YOUR ADVANTAGE
      </p>
    </div>
  )
}
