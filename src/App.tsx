import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { useSentryUser } from '@/lib/monitoring'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AgentPage } from '@/pages/AgentPage'
import { ApprovalQueuePage } from '@/pages/ApprovalQueuePage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { GoogleCallbackPage } from '@/pages/GoogleCallbackPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { AdminPage } from '@/pages/AdminPage'
import { AdminClientPage } from '@/pages/AdminClientPage'
import { LandingPage } from '@/pages/LandingPage'
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/TermsOfServicePage'
import { SecurityPolicyPage } from '@/pages/SecurityPolicyPage'
import { ContactPage } from '@/pages/ContactPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | undefined>(undefined)
  const [userPlan, setUserPlan] = useState<string | undefined>(undefined)

  useSentryUser(session?.user?.id, session?.user?.email, userPlan)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        supabase
          .from('prymal_clients')
          .select('onboarding_complete, plan')
          .eq('user_id', data.session.user.id)
          .maybeSingle()
          .then(({ data: client }) => {
            setNeedsOnboarding(!client || !client.onboarding_complete)
            setUserPlan(client?.plan)
          })
      } else {
        setNeedsOnboarding(false)
        setUserPlan(undefined)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s?.user) {
        supabase
          .from('prymal_clients')
          .select('onboarding_complete, plan')
          .eq('user_id', s.user.id)
          .maybeSingle()
          .then(({ data: client }) => {
            setNeedsOnboarding(!client || !client.onboarding_complete)
            setUserPlan(client?.plan)
          })
      } else {
        setNeedsOnboarding(false)
        setUserPlan(undefined)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined || needsOnboarding === undefined) return null
  if (!session) return <Navigate to="/login" replace />
  if (needsOnboarding && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/security" element={<SecurityPolicyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/onboarding" element={
          <AuthGuardSession>
            <OnboardingPage />
          </AuthGuardSession>
        } />
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
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/clients/:id" element={<AdminClientPage />} />
          {/* Legacy redirects */}
          <Route path="briefings" element={<Navigate to="/agents/intel" replace />} />
          <Route path="social" element={<Navigate to="/agents/brand" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function AuthGuardSession({ children }: { children: React.ReactNode }) {
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
