import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Circle, ChevronRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ChecklistItem {
  id: string
  label: string
  description: string
  done: boolean
}

export function SetupChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('prymal_checklist_dismissed')
    if (wasDismissed) { setDismissed(true); setLoading(false); return }

    async function load() {
      const [clientRes, tokensRes] = await Promise.all([
        supabase.from('prymal_clients').select('anthropic_api_key, brand_tone, gbp_account_id').single(),
        supabase.from('prymal_oauth_tokens').select('platform'),
      ])
      const client = clientRes.data
      const connected = new Set((tokensRes.data ?? []).map((r: { platform: string }) => r.platform))

      setItems([
        {
          id: 'api_key',
          label: 'Add Anthropic API key',
          description: 'Required for all AI agents to work',
          done: !!client?.anthropic_api_key,
        },
        {
          id: 'google',
          label: 'Connect Google Business Profile',
          description: 'Review monitoring & AI responses',
          done: connected.has('google') && !!client?.gbp_account_id,
        },
        {
          id: 'gmail',
          label: 'Connect Gmail',
          description: 'Read inbox & send approved emails',
          done: connected.has('gmail'),
        },
        {
          id: 'calendar',
          label: 'Connect Google Calendar',
          description: 'View schedule & create events',
          done: connected.has('calendar'),
        },
        {
          id: 'brand',
          label: 'Set your brand tone',
          description: 'So Prymal matches your voice in all content',
          done: !!client?.brand_tone,
        },
      ])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || dismissed) return null

  const done = items.filter(i => i.done).length
  const total = items.length
  if (done === total) return null

  function dismiss() {
    sessionStorage.setItem('prymal_checklist_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div
      className="mb-8 rounded-2xl p-5"
      style={{
        background: 'rgba(0,212,255,0.03)',
        border: '1px solid rgba(0,212,255,0.12)',
        boxShadow: '0 0 40px rgba(0,212,255,0.04)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs tracking-widest font-semibold mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>
            SETUP GUIDE
          </p>
          <h2 className="text-sm font-bold text-white">
            Get Prymal ready — {done}/{total} complete
          </h2>
        </div>
        <button
          onClick={dismiss}
          className="p-1 rounded-lg"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(done / total) * 100}%`, background: 'linear-gradient(90deg, #00d4ff, rgba(0,212,255,0.5))' }}
        />
      </div>

      <div className="flex flex-col gap-2">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: item.done ? 'rgba(0,212,255,0.03)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${item.done ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
              opacity: item.done ? 0.6 : 1,
            }}
          >
            <div className="flex items-center gap-3">
              {item.done
                ? <CheckCircle size={15} style={{ color: '#00d4ff', flexShrink: 0 }} />
                : <Circle size={15} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
              }
              <div>
                <p className="text-xs font-semibold text-white">{item.label}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.description}</p>
              </div>
            </div>
            {!item.done && (
              <Link
                to="/settings"
                className="flex items-center gap-1 text-xs font-semibold flex-shrink-0"
                style={{ color: '#00d4ff' }}
              >
                Set up <ChevronRight size={12} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
