import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface PrymalClient {
  id: string
  user_id: string | null
  owner_email: string
  business_name: string | null
  brand_tone: string | null
  knowledge_base: string | null
  delivery_cadence: string | null
  gbp_account_id: string | null
  gbp_location_id: string | null
  plan: string
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
  contact_name: string | null
  contact_email: string | null
  website: string | null
  industry: string | null
  onboarding_complete: boolean
  anthropic_api_key: string | null
  workspace_connected: boolean
  created_at: string
}

export function useClient() {
  const [client, setClient] = useState<PrymalClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data, error } = await supabase
        .from('prymal_clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data && !error) {
        // fallback to email lookup for legacy records
        const { data: d2, error: e2 } = await supabase
          .from('prymal_clients')
          .select('*')
          .eq('owner_email', user.email)
          .maybeSingle()
        if (e2) setError(e2.message)
        else setClient(d2)
        setLoading(false)
        return
      }

      if (error) setError(error.message)
      else setClient(data)
      setLoading(false)
    }
    load()
  }, [])

  async function update(fields: Partial<PrymalClient>) {
    if (!client) return
    const { data, error } = await supabase
      .from('prymal_clients')
      .update(fields)
      .eq('id', client.id)
      .select()
      .single()
    if (!error && data) setClient(data)
    return { data, error }
  }

  return { client, loading, error, update }
}
