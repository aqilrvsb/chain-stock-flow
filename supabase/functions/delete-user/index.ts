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

    // Only HQ, Master Agent, and Branch can delete users
    if (userRole !== 'hq' && userRole !== 'master_agent' && userRole !== 'branch') {
      console.error('Authorization error - user is not HQ, Master Agent, or Branch')
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

    // Additional check: Branch can only delete their own marketers
    if (userRole === 'branch') {
      // Check if target user has branch_id = this branch
      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from('profiles')
        .select('branch_id')
        .eq('id', userId)
        .single()

      if (targetProfileError) {
        console.error('Error checking target profile:', targetProfileError)
        throw new Error('Error verifying marketer')
      }

      if (targetProfile.branch_id !== user.id) {
        console.error('Branch attempting to delete marketer not under their management')
        throw new Error('You can only delete your own marketers')
      }
    }

    console.log('Deleting user and all related records:', userId)

    // Delete all related records before deleting the user
    // Order matters due to foreign key constraints

    // 1. Delete from transactions (buyer_id or seller_id)
    const { error: transactionsError } = await supabaseAdmin
      .from('transactions')
      .delete()
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)

    if (transactionsError) {
      console.error('Error deleting transactions:', transactionsError)
      throw new Error('Error deleting transaction history')
    }
    console.log('Deleted transactions for user:', userId)

    // 2. Delete from agent_purchases (agent_id or master_agent_id)
    const { error: agentPurchasesError } = await supabaseAdmin
      .from('agent_purchases')
      .delete()
      .or(`agent_id.eq.${userId},master_agent_id.eq.${userId}`)

    if (agentPurchasesError) {
      console.error('Error deleting agent purchases:', agentPurchasesError)
      throw new Error('Error deleting agent purchases')
    }
    console.log('Deleted agent_purchases for user:', userId)

    // 3. Delete from customer_purchases (seller_id or marketer_id)
    const { error: customerPurchasesError } = await supabaseAdmin
      .from('customer_purchases')
      .delete()
      .or(`seller_id.eq.${userId},marketer_id.eq.${userId}`)

    if (customerPurchasesError) {
      console.error('Error deleting customer purchases:', customerPurchasesError)
      throw new Error('Error deleting customer purchases')
    }
    console.log('Deleted customer_purchases for user:', userId)

    // 4. Delete from pending_orders (buyer_id)
    const { error: pendingOrdersError } = await supabaseAdmin
      .from('pending_orders')
      .delete()
      .eq('buyer_id', userId)

    if (pendingOrdersError) {
      console.error('Error deleting pending orders:', pendingOrdersError)
      throw new Error('Error deleting pending orders')
    }
    console.log('Deleted pending_orders for user:', userId)

    // 5. Delete from inventory (user_id)
    const { error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('user_id', userId)

    if (inventoryError) {
      console.error('Error deleting inventory:', inventoryError)
      throw new Error('Error deleting inventory')
    }
    console.log('Deleted inventory for user:', userId)

    // 6. Delete from customers (created_by)
    const { error: customersError } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('created_by', userId)

    if (customersError) {
      console.error('Error deleting customers:', customersError)
      throw new Error('Error deleting customers')
    }
    console.log('Deleted customers for user:', userId)

    // 7. Delete from processed_stock (user_id)
    const { error: processedStockError } = await supabaseAdmin
      .from('processed_stock')
      .delete()
      .eq('user_id', userId)

    if (processedStockError) {
      console.error('Error deleting processed stock:', processedStockError)
      throw new Error('Error deleting processed stock')
    }
    console.log('Deleted processed_stock for user:', userId)

    // 8. Delete from raw_material_stock (user_id)
    const { error: rawMaterialError } = await supabaseAdmin
      .from('raw_material_stock')
      .delete()
      .eq('user_id', userId)

    if (rawMaterialError) {
      console.error('Error deleting raw material stock:', rawMaterialError)
      throw new Error('Error deleting raw material stock')
    }
    console.log('Deleted raw_material_stock for user:', userId)

    // 9. Delete from stock_in_hq (user_id)
    const { error: stockInError } = await supabaseAdmin
      .from('stock_in_hq')
      .delete()
      .eq('user_id', userId)

    if (stockInError) {
      console.error('Error deleting stock_in_hq:', stockInError)
      throw new Error('Error deleting stock in records')
    }
    console.log('Deleted stock_in_hq for user:', userId)

    // 10. Delete from stock_out_hq (user_id)
    const { error: stockOutError } = await supabaseAdmin
      .from('stock_out_hq')
      .delete()
      .eq('user_id', userId)

    if (stockOutError) {
      console.error('Error deleting stock_out_hq:', stockOutError)
      throw new Error('Error deleting stock out records')
    }
    console.log('Deleted stock_out_hq for user:', userId)

    // 11. Delete from master_agent_relationships (if agent)
    const { error: relationshipError } = await supabaseAdmin
      .from('master_agent_relationships')
      .delete()
      .eq('agent_id', userId)

    if (relationshipError) {
      console.error('Error deleting master_agent_relationships:', relationshipError)
      throw new Error('Error deleting agent relationships')
    }
    console.log('Deleted master_agent_relationships for user:', userId)

    // 12. Delete from user_roles (user_id)
    const { error: userRolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (userRolesError) {
      console.error('Error deleting user roles:', userRolesError)
      throw new Error('Error deleting user roles')
    }
    console.log('Deleted user_roles for user:', userId)

    // 13. Delete from profiles (id)
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profilesError) {
      console.error('Error deleting profile:', profilesError)
      throw new Error('Error deleting user profile')
    }
    console.log('Deleted profile for user:', userId)

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
