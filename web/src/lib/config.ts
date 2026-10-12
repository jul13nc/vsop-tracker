export type PublicConfig = {
  supabaseUrl: string
  supabaseKey: string
}

export function readPublicConfig(env: Record<string, string | undefined>): PublicConfig | null {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseKey || /^(?:PUBLISHABLE_KEY|ANON_KEY|SUPABASE_ANON_KEY)\s*=/i.test(supabaseKey)) return null

  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null
    return { supabaseUrl: url.toString().replace(/\/$/, ''), supabaseKey }
  } catch {
    return null
  }
}

export const publicConfig = readPublicConfig(import.meta.env)
