import { createClient } from '@supabase/supabase-js'
import { publicConfig } from './config'

export const supabase = publicConfig
  ? createClient(publicConfig.supabaseUrl, publicConfig.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export type SupabaseClient = NonNullable<typeof supabase>
