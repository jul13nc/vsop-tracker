import { describe, expect, it } from 'vitest'
import { readPublicConfig } from './config'

describe('readPublicConfig', () => {
  it('returns null when required public settings are absent', () => {
    expect(readPublicConfig({})).toBeNull()
  })

  it('accepts HTTPS Supabase project settings', () => {
    expect(readPublicConfig({
      VITE_SUPABASE_URL: 'https://poker.supabase.co/',
      VITE_SUPABASE_ANON_KEY: 'public-key',
    })).toEqual({ supabaseUrl: 'https://poker.supabase.co', supabaseKey: 'public-key' })
  })

  it('accepts a local Supabase endpoint over HTTP', () => {
    expect(readPublicConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:55421', VITE_SUPABASE_ANON_KEY: 'local-key' })).not.toBeNull()
  })

  it('rejects insecure remote endpoints', () => {
    expect(readPublicConfig({
      VITE_SUPABASE_URL: 'http://poker.example.com',
      VITE_SUPABASE_ANON_KEY: 'public-key',
    })).toBeNull()
  })

  it('rejects a shell assignment accidentally copied into the key value', () => {
    expect(readPublicConfig({
      VITE_SUPABASE_URL: 'http://127.0.0.1:55421',
      VITE_SUPABASE_ANON_KEY: 'PUBLISHABLE_KEY="sb_publishable_example"',
    })).toBeNull()
  })
})
