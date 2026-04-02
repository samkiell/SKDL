import { createClient } from '@supabase/supabase-js'

let cachedClient: ReturnType<typeof createClient> | null = null

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are missing.')
  }

  return { supabaseUrl, supabaseKey }
}

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient
  }

  const { supabaseUrl, supabaseKey } = getSupabaseConfig()
  cachedClient = createClient(supabaseUrl, supabaseKey)
  return cachedClient
}
