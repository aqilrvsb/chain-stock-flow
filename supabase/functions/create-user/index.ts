import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validation schema for user creation
const CreateUserSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email format" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(100),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100),
  role: z.enum(['hq', 'master_agent', 'agent'], { invalid_type_error: "Invalid role" }),
  masterAgentId: z.string().uuid().optional(),
  idstaff: z.string().trim().min(1).max(50).optional(),
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

    // Verify the caller is HQ
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is HQ
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'hq') {
      throw new Error('Only HQ can create users')
    }

    // Parse and validate input
    const requestBody = await req.json()
    const validationResult = CreateUserSchema.safeParse(requestBody)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Validation failed: ${errors}`)
    }

    const { email, password, fullName, role, masterAgentId, idstaff } = validationResult.data

    // Validate idstaff uniqueness
    if (idstaff) {
      const { data: existingStaff } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('idstaff', idstaff)
        .maybeSingle()
      
      if (existingStaff) {
        throw new Error('A user with this IDSTAFF already exists')
      }
    }

    // Create the user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        idstaff: idstaff,
      },
    })

    if (createError) {
      // Return user-friendly error for duplicate email
      if (createError.message?.includes('already been registered')) {
        throw new Error('A user with this email already exists')
      }
      throw createError
    }

    // Update profile with idstaff
    if (idstaff) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ idstaff: idstaff })
        .eq('id', authData.user.id)
      
      if (profileUpdateError) throw profileUpdateError
    }

    // Create role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role,
        created_by: user.id
      })

    if (roleInsertError) throw roleInsertError

    // If agent, create master_agent_relationship
    if (role === 'agent' && masterAgentId) {
      const { error: relationshipError } = await supabaseAdmin
        .from('master_agent_relationships')
        .insert({
          agent_id: authData.user.id,
          master_agent_id: masterAgentId
        })

      if (relationshipError) throw relationshipError
    }

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating user:', error)
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
