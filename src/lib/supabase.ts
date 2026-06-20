import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://josabyyaarhlgepfelid.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvc2FieXlhYXJobGdlcGZlbGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzc0MjMsImV4cCI6MjA5NjYxMzQyM30.r5ERReA-_rdzqF2MrdlEUuOROxwZaFoQ3e-T6Gtb0WE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const FUNCTION_BASE = `${supabaseUrl}/functions/v1`
