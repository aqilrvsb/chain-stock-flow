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

    // Parse callback data from BayarCash
    const callbackData = await req.json();
    console.log('Received BayarCash callback:', JSON.stringify(callbackData));

    const {
      transaction_id,
      order_number,
      status,
      status_description,
      amount,
      payer_name,
      payer_email,
      payer_bank_name,
      exchange_reference_number,
      exchange_transaction_id,
    } = callbackData;

    // Validate required fields
    if (!order_number || status === undefined) {
      console.error('Missing required fields in callback');
      return new Response('Invalid callback data', { status: 400, headers: corsHeaders });
    }

    console.log(`Processing callback for order: ${order_number}, status: ${status} (${status_description})`);

    // Get pending order
    const { data: pendingOrder, error: orderError } = await supabaseAdmin
      .from('pending_orders')
      .select('*')
      .eq('order_number', order_number)
      .maybeSingle();

    if (orderError || !pendingOrder) {
      console.error('Order not found:', orderError);
      return new Response('Order not found', { status: 200, headers: corsHeaders }); // Still return 200 to BayarCash
    }

    // Map BayarCash status to our status
    // 0 = New, 1 = Pending, 2 = Failed, 3 = Success, 4 = Cancelled
    let newStatus = 'pending';
    
    const statusNum = typeof status === 'string' ? parseInt(status) : status;
    
    if (statusNum === 3) {
      newStatus = 'completed';
      console.log('Payment successful - creating transaction and updating inventory');

      // Create transaction record
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

      if (txError) {
        console.error('Failed to create transaction:', txError);
      } else {
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
        
        console.log('Inventory updated successfully');
      }
    } else if (statusNum === 2 || statusNum === 4) {
      newStatus = 'failed';
      console.log(`Payment ${statusNum === 2 ? 'failed' : 'cancelled'}`);
    } else if (statusNum === 0 || statusNum === 1) {
      newStatus = 'pending';
      console.log(`Payment ${statusNum === 0 ? 'new' : 'pending'}`);
    }

    // Update pending order status with transaction_id
    const { error: updateError } = await supabaseAdmin
      .from('pending_orders')
      .update({ 
        status: newStatus,
        transaction_id: transaction_id || pendingOrder.transaction_id,
      })
      .eq('id', pendingOrder.id);

    if (updateError) {
      console.error('Failed to update order status:', updateError);
    }

    console.log(`Order ${order_number} updated to status: ${newStatus}`);

    // Always return 200 to acknowledge receipt (BayarCash expects this)
    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error processing callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
