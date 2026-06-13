import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface PrymalClient {
  id: string
  owner_email: string
  business_name: string | null
  brand_tone: string | null
  knowledge_base: string | null
  delivery_cadence: string | null
  gbp_account_id: string | null
  gbp_location_id: string | null
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
        .eq('owner_email', user.email)
        .single()

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
