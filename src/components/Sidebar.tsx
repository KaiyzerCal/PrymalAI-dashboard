import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Settings, LogOut, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AGENTS } from '@/lib/agents'

export function Sidebar() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800 min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800">
        <Zap className="text-amber-500" size={20} />
        <span className="font-semibold text-white text-sm tracking-wide">PrymalAI</span>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {/* Overview */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-amber-500/10 text-amber-400 font-medium'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`
          }
        >
          <LayoutDashboard size={15} />
          Overview
        </NavLink>

        {/* Agents */}
        <p className="text-xs font-medium text-zinc-600 px-3 pt-5 pb-1.5 uppercase tracking-wider">
          Agents
        </p>
        {AGENTS.map(agent => {
          const Icon = agent.icon
          return (
            <NavLink
              key={agent.id}
              to={`/agents/${agent.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? `${agent.color.bg} ${agent.color.text} font-medium`
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`
              }
            >
              <Icon size={15} />
              {agent.name}
            </NavLink>
          )
        })}

        {/* Global */}
        <p className="text-xs font-medium text-zinc-600 px-3 pt-5 pb-1.5 uppercase tracking-wider">
          Global
        </p>
        <NavLink
          to="/approvals"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-amber-500/10 text-amber-400 font-medium'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`
          }
        >
          <CheckSquare size={15} />
          All Approvals
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-amber-500/10 text-amber-400 font-medium'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`
          }
        >
          <Settings size={15} />
          Settings
        </NavLink>
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
