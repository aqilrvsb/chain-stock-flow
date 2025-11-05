import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validation schema for user deletion
const DeleteUserSchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID format" }),
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

    // Only HQ and Master Agent can delete users
    if (userRole !== 'hq' && userRole !== 'master_agent') {
      console.error('Authorization error - user is not HQ or Master Agent')
      throw new Error('Unauthorized to delete users')
    }

    // Parse and validate input
    const requestBody = await req.json()
    const validationResult = DeleteUserSchema.safeParse(requestBody)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Validation failed: ${errors}`)
    }

    const { userId } = validationResult.data

    // Check if user to be deleted is an agent
    const { data: targetUserRole, error: targetRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (targetRoleError) {
      throw new Error('User not found')
    }

    // Additional check: Master Agents can only delete their own agents
    if (userRole === 'master_agent') {
      if (targetUserRole.role !== 'agent') {
        throw new Error('Master Agents can only delete agent accounts')
      }

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
        console.error('Master Agent attempting to delete agent not under their management')
        throw new Error('You can only delete your own agents')
      }
    }

    // Check if agent has any transaction history in agent_purchases
    const { data: agentPurchases, error: purchaseError } = await supabaseAdmin
      .from('agent_purchases')
      .select('id')
      .eq('agent_id', userId)
      .limit(1)

    if (purchaseError) {
      console.error('Error checking agent purchases:', purchaseError)
      throw new Error('Error checking transaction history')
    }

    if (agentPurchases && agentPurchases.length > 0) {
      throw new Error('Cannot delete agent with existing transaction history')
    }

    // Check if agent has any orders in pending_orders
    const { data: pendingOrders, error: ordersError } = await supabaseAdmin
      .from('pending_orders')
      .select('id')
      .eq('buyer_id', userId)
      .limit(1)

    if (ordersError) {
      console.error('Error checking pending orders:', ordersError)
      throw new Error('Error checking transaction history')
    }

    if (pendingOrders && pendingOrders.length > 0) {
      throw new Error('Cannot delete agent with existing transaction history')
    }

    console.log('Deleting user:', userId)

    // Delete from auth.users - this will cascade delete to profiles via trigger
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      throw deleteError
    }

    console.log('User deleted successfully:', userId)

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in delete-user function:', error)
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
