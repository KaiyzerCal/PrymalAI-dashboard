import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { useAdmin } from '@/hooks/useAdmin'
import { Plus, ChevronRight, Users, DollarSign, CheckSquare, TrendingUp } from 'lucide-react'

interface Client {
  id: string
  business_name: string | null
  owner_email: string
  contact_name: string | null
  plan: string
  status: string
  trial_ends_at: string | null
  created_at: string
  pending_approvals: number
  total_leads: number
  total_appointments: number
}

interface Stats {
  total_clients: number
  active: number
  trial: number
  mrr: number
  approvals_this_week: number
  total_leads: number
}

const planColor: Record<string, string> = {
  trial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  starter: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pro: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  agency: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}
const statusColor: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  past_due: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export function AdminPage() {
  const { isAdmin, loading: adminLoading } = useAdmin()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ business_name: '', contact_email: '', contact_name: '', plan: 'trial', industry: '', website: '' })
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }

    const [clientsRes, statsRes] = await Promise.all([
      fetch(`${FUNCTION_BASE}/prymal-admin-api`, { method: 'POST', headers, body: JSON.stringify({ action: 'list_clients' }) }),
      fetch(`${FUNCTION_BASE}/prymal-admin-api`, { method: 'POST', headers, body: JSON.stringify({ action: 'stats' }) }),
    ])
    const [clientsData, statsData] = await Promise.all([clientsRes.json(), statsRes.json()])
    setClients(clientsData.clients ?? [])
    setStats(statsData)
    setLoading(false)
  }

  useEffect(() => { if (!adminLoading && isAdmin) load() }, [isAdmin, adminLoading])

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTION_BASE}/prymal-admin-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'create_client', ...addForm }),
    })
    const data = await res.json()
    if (data.success) {
      setAddMsg({ text: `Client created! Temp password: ${data.temp_password}`, ok: true })
      setAddForm({ business_name: '', contact_email: '', contact_name: '', plan: 'trial', industry: '', website: '' })
      load()
    } else {
      setAddMsg({ text: data.error ?? 'Failed', ok: false })
    }
    setAdding(false)
  }

  if (adminLoading) return null
  if (!isAdmin) return (
    <div className="p-6">
      <p className="text-red-400 text-sm">Access denied — admin only.</p>
    </div>
  )

  const trialDaysLeft = (client: Client) => {
    if (!client.trial_ends_at) return null
    const days = Math.ceil((new Date(client.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-8">
        <p className="text-xs tracking-widest font-semibold mb-1" style={{ color: 'rgba(0,212,255,0.5)' }}>PRYMAL AI</p>
        <h1 className="text-2xl font-bold tracking-wide text-white">Admin Panel</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Manage all client accounts and agent activity</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Clients', value: stats.total_clients, icon: Users, sub: `${stats.trial} on trial` },
            { label: 'Monthly Revenue', value: `$${stats.mrr.toLocaleString()}`, icon: DollarSign, sub: `${stats.active} active accounts` },
            { label: 'Approvals This Week', value: stats.approvals_this_week, icon: CheckSquare, sub: 'across all clients' },
            { label: 'Total Leads', value: stats.total_leads, icon: TrendingUp, sub: 'in outreach pipeline' },
          ].map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: 'rgba(8,13,22,0.8)', border: '1px solid rgba(0,212,255,0.1)' }}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={14} style={{ color: 'rgba(0,212,255,0.5)' }} />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(0,212,255,0.4)' }}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Clients list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,212,255,0.7)' }}>CLIENT ACCOUNTS</h2>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold tracking-widest rounded-lg transition-all"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.08))', border: '1px solid rgba(0,212,255,0.35)', color: '#00d4ff' }}
        >
          <Plus size={11} /> ADD CLIENT
        </button>
      </div>

      {/* Add client form */}
      {showAdd && (
        <form onSubmit={handleAddClient} className="rounded-xl p-5 mb-4" style={{ background: 'rgba(8,13,22,0.95)', border: '1px solid rgba(0,212,255,0.2)' }}>
          <p className="text-xs font-bold tracking-widest mb-4" style={{ color: 'rgba(0,212,255,0.7)' }}>NEW CLIENT</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'business_name', label: 'BUSINESS NAME *', placeholder: 'Bioneer Fitness' },
              { key: 'contact_name', label: 'CONTACT NAME *', placeholder: 'John Smith' },
              { key: 'contact_email', label: 'EMAIL *', placeholder: 'john@business.com' },
              { key: 'website', label: 'WEBSITE', placeholder: 'https://business.com' },
              { key: 'industry', label: 'INDUSTRY', placeholder: 'Fitness & Wellness' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.45)' }}>{label}</label>
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
            <div>
              <label className="block text-xs font-semibold tracking-widest mb-1" style={{ color: 'rgba(0,212,255,0.45)' }}>PLAN</label>
              <select
                value={addForm.plan}
                onChange={e => setAddForm(f => ({ ...f, plan: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)', colorScheme: 'dark' }}
              >
                <option value="trial">Trial (14 days)</option>
                <option value="starter">Starter ($299/mo)</option>
                <option value="pro">Pro ($599/mo)</option>
                <option value="agency">Agency ($1,499/mo)</option>
              </select>
            </div>
          </div>
          {addMsg && <p className={`text-xs mt-3 ${addMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{addMsg.text}</p>}
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs font-semibold tracking-widest rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>CANCEL</button>
            <button type="submit" disabled={adding || !addForm.business_name || !addForm.contact_email || !addForm.contact_name} className="flex-1 py-2 text-xs font-bold tracking-widest rounded-lg disabled:opacity-40" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
              {adding ? 'CREATING…' : 'CREATE CLIENT'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading clients…</p>
      ) : clients.length === 0 ? (
        <p className="text-zinc-500 text-sm">No clients yet. Add your first one above.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(0,212,255,0.04)', borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
                {['Business', 'Contact', 'Plan', 'Status', 'Pending', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold tracking-widest" style={{ color: 'rgba(0,212,255,0.5)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((client, i) => {
                const days = trialDaysLeft(client)
                return (
                  <tr
                    key={client.id}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    style={{ background: i % 2 === 0 ? 'rgba(8,13,22,0.8)' : 'rgba(6,10,18,0.9)', borderBottom: '1px solid rgba(0,212,255,0.05)' }}
                    onClick={() => navigate(`/admin/clients/${client.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{client.business_name ?? '—'}</p>
                      <p className="text-xs text-zinc-500">{client.owner_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{client.contact_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border uppercase ${planColor[client.plan] ?? planColor.trial}`}>
                        {client.plan}
                      </span>
                      {client.plan === 'trial' && days !== null && (
                        <p className="text-xs mt-0.5" style={{ color: days <= 3 ? '#f87171' : 'rgba(255,255,255,0.3)' }}>
                          {days > 0 ? `${days}d left` : 'Expired'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusColor[client.status] ?? statusColor.active}`}>{client.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {client.pending_approvals > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">{client.pending_approvals}</span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-zinc-600" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
