import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = ['projectapexai@gmail.com', 'caljohnathon@gmail.com']

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = user?.email ?? ''
      setIsAdmin(ADMIN_EMAILS.includes(email))
      setAdminEmail(email)
      setLoading(false)
    })
  }, [])

  return { isAdmin, adminEmail, loading }
}
