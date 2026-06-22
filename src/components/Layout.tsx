import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ChatWidget } from './ChatWidget'

export function Layout() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <ChatWidget />
    </div>
  )
}
