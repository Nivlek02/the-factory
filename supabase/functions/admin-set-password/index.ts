import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { email, password } = await req.json()
  const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (lErr) return new Response(JSON.stringify({ error: lErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const { error: uErr } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true })
  if (uErr) return new Response(JSON.stringify({ error: uErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  return new Response(JSON.stringify({ success: true, userId: user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
