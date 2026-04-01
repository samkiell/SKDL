import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables are missing.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
