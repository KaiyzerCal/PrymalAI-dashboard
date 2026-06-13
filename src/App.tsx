import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AgentPage } from '@/pages/AgentPage'
import { ApprovalQueuePage } from '@/pages/ApprovalQueuePage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="agents/:id" element={<AgentPage />} />
          <Route path="approvals" element={<ApprovalQueuePage />} />
          <Route path="settings" element={<IntegrationsPage />} />
          {/* Legacy redirects */}
          <Route path="briefings" element={<Navigate to="/agents/intel" replace />} />
          <Route path="social" element={<Navigate to="/agents/brand" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
