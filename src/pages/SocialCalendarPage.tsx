import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Instagram, Twitter, Linkedin, Facebook, Clock, CheckCircle, XCircle, Send } from 'lucide-react'

interface SocialPost {
  id: string
  platform: string
  content: string
  status: 'drafted' | 'scheduled' | 'published'
  scheduled_for: string | null
  created_at: string
}

const platformIcon: Record<string, React.ReactNode> = {
  instagram: <Instagram size={14} />,
  twitter: <Twitter size={14} />,
  linkedin: <Linkedin size={14} />,
  facebook: <Facebook size={14} />,
}

const statusBadge: Record<string, string> = {
  drafted: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  published: 'bg-green-500/10 text-green-400 border-green-500/20',
}

const statusIcon: Record<string, React.ReactNode> = {
  drafted: <Clock size={12} />,
  scheduled: <Send size={12} />,
  published: <CheckCircle size={12} />,
}

const platforms = ['all', 'instagram', 'twitter', 'linkedin', 'facebook']
const statuses = ['all', 'drafted', 'scheduled', 'published']

export function SocialCalendarPage() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prymal_social_posts')
        .select('*')
        .order('scheduled_for', { ascending: false, nullsFirst: false })
      setPosts(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = posts.filter((p) =>
    (platform === 'all' || p.platform === platform) &&
    (status === 'all' || p.status === status)
  )

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-white mb-1">Social Calendar</h1>
      <p className="text-zinc-400 text-sm mb-6">Drafted, scheduled, and published social content</p>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-1.5">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors capitalize ${
                platform === p
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors capitalize ${
                status === s
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">No posts found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-xs capitalize">
                  {platformIcon[post.platform] ?? <XCircle size={14} />}
                  {post.platform}
                </div>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${statusBadge[post.status] ?? statusBadge.drafted}`}>
                  {statusIcon[post.status]}
                  {post.status}
                </span>
              </div>
              <p className="text-sm text-zinc-300 line-clamp-4 flex-1">{post.content}</p>
              <p className="text-xs text-zinc-600">
                {post.scheduled_for ? formatDate(post.scheduled_for) : formatDate(post.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
