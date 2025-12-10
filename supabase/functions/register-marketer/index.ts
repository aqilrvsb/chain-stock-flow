import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validation schema for marketer registration
const RegisterMarketerSchema = z.object({
  idStaff: z.string().trim().min(1, { message: "Staff ID is required" }).max(50),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100),
  password: z.string().min(4, { message: "Password must be at least 4 characters" }).max(100),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is Branch
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError) {
      throw new Error('Unauthorized')
    }

    const userRole = roleData?.role

    // Only Branch can create marketers
    if (userRole !== 'branch' && userRole !== 'hq') {
      throw new Error('Only Branch users can register marketers')
    }

    // Parse and validate input
    const requestBody = await req.json()
    const validationResult = RegisterMarketerSchema.safeParse(requestBody)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Validation failed: ${errors}`)
    }

    const { idStaff, fullName, password } = validationResult.data

    // Validate idStaff uniqueness
    const { data: existingStaff } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('idstaff', idStaff)
      .maybeSingle()

    if (existingStaff) {
      throw new Error('A marketer with this Staff ID already exists')
    }

    // Create the user with a generated email
    const email = `${idStaff.toLowerCase().replace(/[^a-z0-9]/g, '')}@marketer.local`

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        idstaff: idStaff,
      },
    })

    if (createError) {
      // Return user-friendly error for duplicate email
      if (createError.message?.includes('already been registered')) {
        throw new Error('A user with this Staff ID already exists')
      }
      throw createError
    }

    // Update profile with marketer-specific fields
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        idstaff: idStaff,
        password_hash: password.toUpperCase(), // Store uppercase for Staff ID login
        branch_id: user.id, // Link to the branch that created this marketer
        is_active: true,
      })
      .eq('id', authData.user.id)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError)
      throw profileUpdateError
    }

    // Create marketer role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'marketer',
        created_by: user.id
      })

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError)
      throw roleInsertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          idstaff: idStaff,
          full_name: fullName,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error registering marketer:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
