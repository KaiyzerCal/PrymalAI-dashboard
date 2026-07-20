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
import { RelationshipsPage } from '@/pages/RelationshipsPage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { GoogleCallbackPage } from '@/pages/GoogleCallbackPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { AdminPage } from '@/pages/AdminPage'
import { AdminClientPage } from '@/pages/AdminClientPage'
import { LandingPage } from '@/pages/LandingPage'
import { UpgradePage } from '@/pages/UpgradePage'
import { AlfyApp } from '@/alfy/AlfyApp'
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/TermsOfServicePage'
import { SecurityPolicyPage } from '@/pages/SecurityPolicyPage'
import { ContactPage } from '@/pages/ContactPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | undefined>(undefined)
  const [trialExpired, setTrialExpired] = useState<boolean | undefined>(undefined)
  const [userPlan, setUserPlan] = useState<string | undefined>(undefined)

  useSentryUser(session?.user?.id, session?.user?.email, userPlan)

  async function loadClient(userId: string) {
    const { data: client } = await supabase
      .from('prymal_clients')
      .select('onboarding_complete, plan, trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle()
    setNeedsOnboarding(!client || !client.onboarding_complete)
    setUserPlan(client?.plan)
    const expired =
      client?.plan === 'trial' &&
      !!client?.trial_ends_at &&
      new Date(client.trial_ends_at) < new Date()
    setTrialExpired(expired)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        loadClient(data.session.user.id)
      } else {
        setNeedsOnboarding(false)
        setTrialExpired(false)
        setUserPlan(undefined)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s?.user) {
        loadClient(s.user.id)
      } else {
        setNeedsOnboarding(false)
        setTrialExpired(false)
        setUserPlan(undefined)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined || needsOnboarding === undefined || trialExpired === undefined) return null
  if (!session) return <Navigate to="/login" replace />
  if (needsOnboarding && !window.location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding" replace />
  }
  if (trialExpired && !window.location.pathname.startsWith('/upgrade')) {
    return <Navigate to="/upgrade" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
        <Route path="/upgrade" element={
          <AuthGuardSession>
            <UpgradePage />
          </AuthGuardSession>
        } />
        <Route path="/alfy" element={<Navigate to="/alfy/today" replace />} />
        <Route path="/alfy/:tab" element={
          <AuthGuardSession>
            <AlfyApp />
          </AuthGuardSession>
        } />
        <Route path="/dashboard"
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="agents/:id" element={<AgentPage />} />
          <Route path="approvals" element={<ApprovalQueuePage />} />
          <Route path="relationships" element={<RelationshipsPage />} />
          <Route path="settings" element={<IntegrationsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/clients/:id" element={<AdminClientPage />} />
        </Route>
        {/* Legacy redirects */}
        <Route path="/agents/:id" element={<Navigate to="/dashboard/agents/:id" replace />} />
        <Route path="/approvals" element={<Navigate to="/dashboard/approvals" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/briefings" element={<Navigate to="/dashboard/agents/intel" replace />} />
        <Route path="/social" element={<Navigate to="/dashboard/agents/brand" replace />} />
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
