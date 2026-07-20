import { useState } from 'react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { Sun, RefreshCw } from 'lucide-react'

// Renders **bold** and keeps line breaks — enough for Alfy's brief format
function renderBrief(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith('**') && seg.endsWith('**')
        ? <strong key={j} className="text-white">{seg.slice(2, -2)}</strong>
        : <span key={j}>{seg}</span>
    )
    return <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{parts}</p>
  })
}

export function DailyBriefCard() {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const res = await fetch(`${FUNCTION_BASE}/prymal-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: 'Give me my morning brief — what needs my attention today? Keep it tight and scannable.',
          history: [],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBrief(data.reply ?? 'No brief available.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative mb-8 rounded-2xl p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.05) 0%, rgba(0,212,255,0.02) 100%)',
        border: '1px solid rgba(0,212,255,0.15)',
        boxShadow: '0 0 40px rgba(0,212,255,0.04)',
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
          >
            <Sun size={17} style={{ color: '#00d4ff' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Daily Brief</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Alfy scans your inbox, calendar, tasks, and pending follow-ups
            </p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-widest transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.08) 100%)',
            border: '1px solid rgba(0,212,255,0.35)',
            color: '#00d4ff',
          }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'BRIEFING…' : brief ? 'REFRESH' : "TODAY'S BRIEF"}
        </button>
      </div>

      {error && (
        <p className="mt-4 text-xs text-red-400">{error}</p>
      )}

      {brief && !loading && (
        <div
          className="mt-4 pt-4 text-sm leading-relaxed"
          style={{ borderTop: '1px solid rgba(0,212,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
        >
          {renderBrief(brief)}
        </div>
      )}
    </div>
  )
}
