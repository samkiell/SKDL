import { createClient } from '@supabase/supabase-js'

// Safe stub so legacy routes never throw when Supabase env vars are absent
export const supabase = createClient('https://placeholder.supabase.co', 'placeholder')

export function getSupabaseClient() {
  return supabase
}
