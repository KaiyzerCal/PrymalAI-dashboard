import { NavLink } from 'react-router-dom'
import { CheckSquare, BookOpen, Calendar, Settings, LogOut, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const nav = [
  { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
  { to: '/briefings', icon: BookOpen, label: 'Briefings' },
  { to: '/social', icon: Calendar, label: 'Social' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800 min-h-screen">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800">
        <Zap className="text-amber-500" size={20} />
        <span className="font-semibold text-white text-sm tracking-wide">PrymalAI</span>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 px-6 py-4 text-sm text-zinc-500 hover:text-zinc-300 border-t border-zinc-800 transition-colors"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </aside>
  )
}
