import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('update-user-password:start', { method: req.method, time: new Date().toISOString() })
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) throw new Error('Unauthorized')
    console.log('update-user-password:requester', user.id)

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, roles, is_disabled')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.roles?.includes('admin') || profile?.role === 'admin'
    if (profileError || !profile || !isAdmin || profile.is_disabled) {
      console.log('update-user-password:forbidden', { isAdmin, disabled: profile?.is_disabled })
      return new Response(JSON.stringify({ error: 'Forbidden: You must be an admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_id, password } = await req.json()
    if (!user_id || !password) {
      return new Response(JSON.stringify({ error: 'Missing user_id or password' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password,
    })

    if (updateError) throw updateError
    console.log('update-user-password:updated', { user_id })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.log('update-user-password:error', error?.message || error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
