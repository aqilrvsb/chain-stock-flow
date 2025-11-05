import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validation schema for password update
const UpdatePasswordSchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID format" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(100),
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
      console.error('Authentication error:', authError)
      throw new Error('Unauthorized')
    }

    // Check if user is HQ or Master Agent
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError) {
      console.error('Authorization error:', roleError)
      throw new Error('Unauthorized')
    }

    const userRole = roleData?.role

    // Only HQ and Master Agent can update passwords
    if (userRole !== 'hq' && userRole !== 'master_agent') {
      console.error('Authorization error - user is not HQ or Master Agent')
      throw new Error('Unauthorized to update user passwords')
    }

    // Parse and validate input
    const requestBody = await req.json()
    const validationResult = UpdatePasswordSchema.safeParse(requestBody)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Validation failed: ${errors}`)
    }

    const { userId, password } = validationResult.data

    // Additional check: Master Agents can only update passwords for their own agents
    if (userRole === 'master_agent') {
      const { data: relationship, error: relError } = await supabaseAdmin
        .from('master_agent_relationships')
        .select('master_agent_id')
        .eq('agent_id', userId)
        .maybeSingle()

      if (relError) {
        console.error('Error checking relationship:', relError)
        throw new Error('Error verifying agent relationship')
      }

      if (!relationship || relationship.master_agent_id !== user.id) {
        console.error('Master Agent attempting to update password for agent not under their management')
        throw new Error('You can only update passwords for your own agents')
      }
    }

    console.log('Updating password for user:', userId)

    // Update the user's password
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: password }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      throw updateError
    }

    console.log('Password updated successfully for user:', userId)

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in update-user-password function:', error)
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
