import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return Response.json({ error: 'Server configuration unavailable' }, { status: 500, headers: corsHeaders })

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })

  const { data: profile, error: profileError } = await userClient.from('profiles').select('role').eq('user_id', user.id).single()
  if (profileError || profile?.role !== 'organizer') return Response.json({ error: 'Organizer role required' }, { status: 403, headers: corsHeaders })

  let payload: { email?: string }
  try { payload = await request.json() } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders }) }
  const email = payload.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Valid email required' }, { status: 400, headers: corsHeaders })

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { error: invitationError } = await userClient.rpc('invite_reader', { p_email: email })
  if (invitationError) return Response.json({ error: invitationError.message }, { status: 400, headers: corsHeaders })

  const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email)
  if (inviteError && !inviteError.message.toLowerCase().includes('already')) {
    return Response.json({ error: inviteError.message }, { status: 400, headers: corsHeaders })
  }

  return Response.json({ invited: true, userId: invite.user?.id ?? null }, { status: 200, headers: corsHeaders })
})
