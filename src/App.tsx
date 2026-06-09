import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { ApprovalQueuePage } from '@/pages/ApprovalQueuePage'
import { BriefingsPage } from '@/pages/BriefingsPage'
import { SocialCalendarPage } from '@/pages/SocialCalendarPage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'

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
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/approvals" replace />} />
          <Route path="approvals" element={<ApprovalQueuePage />} />
          <Route path="briefings" element={<BriefingsPage />} />
          <Route path="social" element={<SocialCalendarPage />} />
          <Route path="settings" element={<IntegrationsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
