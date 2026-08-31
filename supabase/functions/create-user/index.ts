
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Hello from Functions!")

const decodeJwtPayload = (token: string | null) => {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('create-user:start', { method: req.method, time: new Date().toISOString() })
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    const apikeyHeader = req.headers.get('apikey') || req.headers.get('x-api-key')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const jwtPayload = decodeJwtPayload(bearerToken)
    const nowSec = Math.floor(Date.now() / 1000)

    console.log('Auth header present:', !!authHeader, 'apikey present:', !!apikeyHeader)
    console.log('JWT payload (sanitized):', {
      iss: jwtPayload?.iss,
      ref: jwtPayload?.ref,
      sub: jwtPayload?.sub,
      exp: jwtPayload?.exp,
      expired: typeof jwtPayload?.exp === 'number' ? jwtPayload.exp < nowSec : null,
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Verify Requesting User
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError) {
      console.log('getUser error:', userError)
    }

    if (!user) throw new Error('Unauthorized')
    console.log('create-user:requester', user.id)

    // 2. Verify Role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, roles, is_disabled')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.log('profile lookup error:', profileError)
    }

    const isAdmin = profile?.roles?.includes('admin') || profile?.role === 'admin'
    if (profileError || !profile || !isAdmin || profile.is_disabled) {
      console.log('create-user:forbidden', { isAdmin, disabled: profile?.is_disabled })
      return new Response(JSON.stringify({ error: 'Forbidden: You must be an admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Create New User (Admin Context)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, role, roles, full_name } = await req.json()
    console.log('Create user request:', { email, role, roles, full_name })

    const allowedRoles = ['admin', 'general_manager', 'sales_manager', 'purchase_manager', 'production_manager']
    const rolesInput = Array.isArray(roles) ? roles : (role ? [role] : [])
    const normalizedRoles = Array.from(new Set(rolesInput)).filter(Boolean)
    const invalidRole = normalizedRoles.find((r) => !allowedRoles.includes(r))

    if (!email || !password || normalizedRoles.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (invalidRole) {
      return new Response(JSON.stringify({ error: `Invalid role: ${invalidRole}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (createError) throw createError
    console.log('create-user:created', { id: newUser?.user?.id, email })

    // 4. Create Profile for New User
    if (newUser.user) {
        const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: newUser.user.id,
            role: normalizedRoles[0],
            roles: normalizedRoles,
            full_name: full_name
        })

        if (insertError) {
            throw insertError
        }
    }

    return new Response(JSON.stringify(newUser), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.log('create-user:error', error?.message || error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
