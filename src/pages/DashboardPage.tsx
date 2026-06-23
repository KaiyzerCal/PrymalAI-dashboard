import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useClient } from '@/hooks/useClient'
import { AGENTS } from '@/lib/agents'
import { ChevronRight, Clock, Activity } from 'lucide-react'

interface AgentStats {
  google: { reviews: number; pending: number }
  brand: { posts: number; scheduled: number }
  outreach: { leads: number; newLeads: number }
  service: { inquiries: number; newInquiries: number }
  booking: { appointments: number; upcoming: number }
  intel: { briefings: number }
}

export function DashboardPage() {
  const { client } = useClient()
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({})
  const [stats, setStats] = useState<Partial<AgentStats>>({})
  const [countsLoading, setCountsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString()
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        pendingRes,
        reviewsRes,
        postsRes,
        leadsRes,
        inquiriesRes,
        apptRes,
        briefingsRes,
      ] = await Promise.all([
        supabase.from('prymal_approval_queue').select('agent').eq('status', 'pending'),
        supabase.from('prymal_gmb_reviews').select('response_status'),
        supabase.from('prymal_social_posts').select('status'),
        supabase.from('prymal_leads').select('status, created_at'),
        supabase.from('prymal_inquiries').select('status'),
        supabase.from('prymal_appointments').select('status, requested_date, confirmed_date'),
        supabase.from('prymal_intel_briefings').select('id'),
      ])

      // pending counts per agent
      const counts: Record<string, number> = {}
      for (const row of pendingRes.data ?? []) {
        counts[row.agent] = (counts[row.agent] ?? 0) + 1
      }
      setPendingCounts(counts)

      // per-agent stats
      const reviews = reviewsRes.data ?? []
      const posts = postsRes.data ?? []
      const leads = leadsRes.data ?? []
      const inquiries = inquiriesRes.data ?? []
      const appts = apptRes.data ?? []

      setStats({
        google: {
          reviews: reviews.length,
          pending: reviews.filter(r => r.response_status === 'pending').length,
        },
        brand: {
          posts: posts.length,
          scheduled: posts.filter(p => p.status === 'scheduled').length,
        },
        outreach: {
          leads: leads.length,
          newLeads: leads.filter(l => l.status === 'new' && l.created_at > weekAgo).length,
        },
        service: {
          inquiries: inquiries.length,
          newInquiries: inquiries.filter(i => i.status === 'new').length,
        },
        booking: {
          appointments: appts.length,
          upcoming: appts.filter(a => {
            const d = a.confirmed_date ?? a.requested_date
            return d && d > now && a.status !== 'cancelled'
          }).length,
        },
        intel: {
          briefings: briefingsRes.data?.length ?? 0,
        },
      })

      setCountsLoading(false)
    }
    load()
  }, [])

  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0)

  function agentStat(id: string): string | null {
    const s = stats as AgentStats
    if (!s[id as keyof AgentStats]) return null
    switch (id) {
      case 'google': return s.google.reviews > 0
        ? `${s.google.reviews} review${s.google.reviews !== 1 ? 's' : ''} · ${s.google.pending} awaiting response`
        : null
      case 'brand': return s.brand.posts > 0
        ? `${s.brand.posts} post${s.brand.posts !== 1 ? 's' : ''} · ${s.brand.scheduled} scheduled`
        : null
      case 'outreach': return s.outreach.leads > 0
        ? `${s.outreach.leads} lead${s.outreach.leads !== 1 ? 's' : ''} · ${s.outreach.newLeads} new this week`
        : null
      case 'service': return s.service.inquiries > 0
        ? `${s.service.inquiries} inquir${s.service.inquiries !== 1 ? 'ies' : 'y'} · ${s.service.newInquiries} open`
        : null
      case 'booking': return s.booking.appointments > 0
        ? `${s.booking.appointments} total · ${s.booking.upcoming} upcoming`
        : null
      case 'intel': return s.intel.briefings > 0
        ? `${s.intel.briefings} briefing${s.intel.briefings !== 1 ? 's' : ''} generated`
        : null
      default: return null
    }
  }

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
          const stat = agentStat(agent.id)

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

              {/* Live stat */}
              {!countsLoading && stat && (
                <div
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
                >
                  {stat}
                </div>
              )}

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
                    {countsLoading ? '—' : 'NO PENDING ITEMS'}
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
