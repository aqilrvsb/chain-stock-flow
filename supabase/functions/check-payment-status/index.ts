import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const apiToken = Deno.env.get('BAYARCASH_API_TOKEN');

    // Get order number from request
    const { orderNumber } = await req.json();

    if (!orderNumber) {
      throw new Error('Order number is required');
    }

    console.log('Checking payment status for order:', orderNumber);

    // Get order details
    const { data: pendingOrder, error: orderError } = await supabaseAdmin
      .from('pending_orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderError || !pendingOrder) {
      throw new Error('Order not found');
    }

    // If already completed or failed, return current status
    if (pendingOrder.status !== 'pending') {
      console.log('Order already processed:', pendingOrder.status);
      return new Response(
        JSON.stringify({ 
          status: pendingOrder.status,
          order: pendingOrder 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check payment status from BayarCash API
    if (pendingOrder.transaction_id) {
      console.log('Checking BayarCash status for transaction:', pendingOrder.transaction_id);
      
      const statusResponse = await fetch(
        `https://api.console.bayar.cash/v3/transactions/${pendingOrder.transaction_id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('BayarCash status API response status:', statusResponse.status);

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('BayarCash status response:', JSON.stringify(statusData));

        // Update order status based on BayarCash response
        // Status codes: 0 = Pending, 1 = Processing, 2 = Failed/Cancelled, 3 = Successful/Approved
        let newStatus = 'pending';
        
        if (statusData.status === 3 || statusData.status === '3') {
          newStatus = 'completed';
          
          // Create transaction and update inventory
          const { error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
              buyer_id: pendingOrder.buyer_id,
              product_id: pendingOrder.product_id,
              quantity: pendingOrder.quantity,
              unit_price: pendingOrder.unit_price,
              total_price: pendingOrder.total_price,
              transaction_type: 'purchase',
            });

          if (!txError) {
            // Update buyer's inventory
            const { data: existingInventory } = await supabaseAdmin
              .from('inventory')
              .select('*')
              .eq('user_id', pendingOrder.buyer_id)
              .eq('product_id', pendingOrder.product_id)
              .maybeSingle();

            if (existingInventory) {
              await supabaseAdmin
                .from('inventory')
                .update({
                  quantity: existingInventory.quantity + pendingOrder.quantity,
                })
                .eq('id', existingInventory.id);
            } else {
              await supabaseAdmin
                .from('inventory')
                .insert({
                  user_id: pendingOrder.buyer_id,
                  product_id: pendingOrder.product_id,
                  quantity: pendingOrder.quantity,
                });
            }
            
            console.log('Payment completed, inventory updated');
          }
        } else if (statusData.status === 2 || statusData.status === '2') {
          newStatus = 'failed';
          console.log('Payment failed/cancelled');
        }

        // Update pending order status
        if (newStatus !== 'pending') {
          await supabaseAdmin
            .from('pending_orders')
            .update({ status: newStatus })
            .eq('id', pendingOrder.id);

          pendingOrder.status = newStatus;
        }
      } else {
        console.error('Failed to fetch payment status from BayarCash. Status:', statusResponse.status);
        const errorText = await statusResponse.text();
        console.error('BayarCash error response:', errorText);
      }
    } else {
      console.warn('No transaction_id found for order. Cannot check BayarCash status.');
    }

    return new Response(
      JSON.stringify({ 
        status: pendingOrder.status,
        order: pendingOrder 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking payment status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
