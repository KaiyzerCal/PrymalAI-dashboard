import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Settings, LogOut, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AGENTS } from '@/lib/agents'
import { useAdmin } from '@/hooks/useAdmin'
import { useClient } from '@/hooks/useClient'

const planColor: Record<string, string> = {
  trial: 'text-amber-400',
  starter: 'text-blue-400',
  pro: 'text-cyan-400',
  agency: 'text-purple-400',
}

export function Sidebar() {
  const { isAdmin } = useAdmin()
  const { client } = useClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <aside
      className="w-56 shrink-0 flex flex-col min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #060b14 0%, #03070f 100%)',
        borderRight: '1px solid rgba(0,212,255,0.1)',
        boxShadow: '4px 0 32px rgba(0,212,255,0.03)',
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-5 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}
      >
        <div
          className="w-7 h-7 rounded flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.25)',
            boxShadow: '0 0 12px rgba(0,212,255,0.15)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" stroke="rgba(0,212,255,0.9)" strokeWidth="1" fill="rgba(0,212,255,0.08)" />
            <path d="M8 1L8 15M2 5L14 11M14 5L2 11" stroke="rgba(0,212,255,0.35)" strokeWidth="0.75" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-sm tracking-widest text-white">PRYMAL</span>
          <span
            className="font-bold text-sm tracking-widest"
            style={{ color: '#00d4ff', textShadow: '0 0 10px rgba(0,212,255,0.5)' }}
          >
            AI
          </span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">

        {/* Overview */}
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
              isActive
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-200'
            }`
          }
          style={({ isActive }) => isActive ? {
            background: 'rgba(0,212,255,0.07)',
            borderLeft: '2px solid #00d4ff',
            paddingLeft: '10px',
            boxShadow: 'inset 0 0 20px rgba(0,212,255,0.03)',
          } : { borderLeft: '2px solid transparent' }}
        >
          <LayoutDashboard size={14} />
          OVERVIEW
        </NavLink>

        {/* Agents section */}
        <p
          className="text-xs px-3 pt-5 pb-2 tracking-widest font-semibold"
          style={{ color: 'rgba(0,212,255,0.4)' }}
        >
          AGENTS
        </p>

        {(isAdmin ? AGENTS : AGENTS.filter(a => a.id === 'google')).map(agent => {
          const Icon = agent.icon
          return (
            <NavLink
              key={agent.id}
              to={`/dashboard/agents/${agent.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
                  isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: `rgba(0,212,255,0.06)`,
                borderLeft: `2px solid #00d4ff`,
                paddingLeft: '10px',
              } : { borderLeft: '2px solid transparent' }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={14} className={isActive ? agent.color.text : ''} />
                  <span>{agent.name.toUpperCase()}</span>
                  {isActive && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full dot-pulse"
                      style={{ background: '#00d4ff' }}
                    />
                  )}
                </>
              )}
            </NavLink>
          )
        })}

        {/* Global section */}
        <p
          className="text-xs px-3 pt-5 pb-2 tracking-widest font-semibold"
          style={{ color: 'rgba(0,212,255,0.4)' }}
        >
          GLOBAL
        </p>

        {[
          { to: '/dashboard/approvals', icon: CheckSquare, label: 'ALL APPROVALS' },
          { to: '/dashboard/settings', icon: Settings, label: 'SETTINGS' },
        ].map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
              }`
            }
            style={({ isActive }) => isActive ? {
              background: 'rgba(0,212,255,0.07)',
              borderLeft: '2px solid #00d4ff',
              paddingLeft: '10px',
            } : { borderLeft: '2px solid transparent' }}
          >
            <Icon size={14} />
            {label}
          </NavLink>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <p
              className="text-xs px-3 pt-5 pb-2 tracking-widest font-semibold"
              style={{ color: 'rgba(168,85,247,0.6)' }}
            >
              ADMIN
            </p>
            <NavLink
              to="/dashboard/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
                  isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'rgba(168,85,247,0.07)',
                borderLeft: '2px solid rgba(168,85,247,0.8)',
                paddingLeft: '10px',
              } : { borderLeft: '2px solid transparent' }}
            >
              <ShieldCheck size={14} />
              ADMIN PANEL
            </NavLink>
          </>
        )}
      </nav>

      {/* Plan badge + Sign out */}
      <div style={{ borderTop: '1px solid rgba(0,212,255,0.06)' }}>
        {client && (
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-zinc-600 tracking-wide">{client.business_name ?? client.owner_email}</span>
            <span className={`text-xs font-bold tracking-widest uppercase ${planColor[client.plan] ?? 'text-zinc-500'}`}>
              {client.plan}
            </span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-5 py-4 text-xs text-zinc-600 hover:text-zinc-300 tracking-wide transition-colors"
          style={{ borderTop: client ? '1px solid rgba(0,212,255,0.04)' : undefined }}
        >
          <LogOut size={14} />
          SIGN OUT
        </button>
      </div>
    </aside>
  )
}
