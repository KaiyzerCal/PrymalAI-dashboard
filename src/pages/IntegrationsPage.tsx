import { useState } from 'react'
import { useClient } from '@/hooks/useClient'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

type Tab = 'brand' | 'integrations'

interface SocialAccount {
  id: string
  platform: string
  username: string | null
  connected: boolean
  updated_at: string
}

export function IntegrationsPage() {
  const { client, loading: clientLoading, update } = useClient()
  const [tab, setTab] = useState<Tab>('brand')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ brand_tone: '', knowledge_base: '', delivery_cadence: '' })
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [acctLoading, setAcctLoading] = useState(true)

  useEffect(() => {
    if (client) {
      setForm({
        brand_tone: client.brand_tone ?? '',
        knowledge_base: client.knowledge_base ?? '',
        delivery_cadence: client.delivery_cadence ?? '',
      })
    }
  }, [client])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prymal_social_accounts')
        .select('*')
        .order('platform')
      setAccounts(data ?? [])
      setAcctLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await update(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-white mb-1">Settings</h1>
      <p className="text-zinc-400 text-sm mb-6">Manage brand settings and integrations</p>

      <div className="flex gap-2 mb-6">
        {(['brand', 'integrations'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm border transition-colors capitalize ${
              tab === t
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {t === 'brand' ? 'Brand Settings' : 'Integrations'}
          </button>
        ))}
      </div>

      {tab === 'brand' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          {clientLoading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Brand Tone</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Professional, friendly, concise…"
                  value={form.brand_tone}
                  onChange={(e) => setForm({ ...form, brand_tone: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Knowledge Base</label>
                <textarea
                  rows={5}
                  placeholder="Key information about your business, products, and services…"
                  value={form.knowledge_base}
                  onChange={(e) => setForm({ ...form, knowledge_base: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Delivery Cadence</label>
                <input
                  type="text"
                  placeholder="e.g. 3 posts/week, daily briefing…"
                  value={form.delivery_cadence}
                  onChange={(e) => setForm({ ...form, delivery_cadence: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="self-start bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-medium rounded-lg px-5 py-2 text-sm transition-colors"
              >
                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          )}
        </div>
      )}

      {tab === 'integrations' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {acctLoading ? (
            <p className="text-zinc-500 text-sm p-5">Loading…</p>
          ) : accounts.length === 0 ? (
            <p className="text-zinc-500 text-sm p-5">No integrations configured.</p>
          ) : (
            accounts.map((acct) => (
              <div key={acct.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm text-white capitalize">{acct.platform}</p>
                  {acct.username && <p className="text-xs text-zinc-500 mt-0.5">@{acct.username}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {acct.connected ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle size={14} /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <XCircle size={14} /> Disconnected
                    </span>
                  )}
                  <button className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
