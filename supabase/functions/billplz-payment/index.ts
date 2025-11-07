import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    // Check if it's a webhook from Billplz
    if (req.method === 'POST' && contentType.includes('application/x-www-form-urlencoded')) {
      return await handleWebhook(req);
    }

    // Handle GET request to check bill status
    if (req.method === 'GET') {
      return await checkBillStatus(req);
    }

    // Regular API call from frontend
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    
    // Handle recheck action
    if (body.action === 'recheck') {
      return await recheckPayment(body.bill_id);
    }
    const { bundleId, quantity, units, profile } = body;

    if (!bundleId || !quantity || !units || !profile) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Billplz configuration from system settings
    const { data: billplzApiKey } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'billplz_api_key')
      .single();

    const { data: billplzCollectionId } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'billplz_collection_id')
      .single();

    const BILLPLZ_API_KEY = billplzApiKey?.setting_value || Deno.env.get('BILLPLZ_API_KEY');
    const BILLPLZ_COLLECTION_ID = billplzCollectionId?.setting_value || Deno.env.get('BILLPLZ_COLLECTION_ID');
    const BILLPLZ_BASE_URL = 'https://www.billplz.com/api/v3';

    if (!BILLPLZ_API_KEY || !BILLPLZ_COLLECTION_ID) {
      throw new Error('Billplz not configured. Please contact administrator.');
    }

    // Get user's role to determine correct pricing
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      throw new Error('User role not found');
    }

    // Get bundle and product details
    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .select('*, products(*)')
      .eq('id', bundleId)
      .eq('is_active', true)
      .single();

    if (bundleError || !bundle) {
      throw new Error('Bundle not found or inactive');
    }

    // Calculate price server-side based on user role
    const serverUnitPrice = userRole.role === 'agent' 
      ? bundle.agent_price 
      : bundle.master_agent_price;
    
    const serverTotalQuantity = quantity * units;
    const serverTotalPrice = serverUnitPrice * quantity;

    // Generate order number
    const { data: orderNumberData, error: orderNumberError } = await supabase
      .rpc('generate_order_number');
    
    if (orderNumberError || !orderNumberData) {
      throw new Error('Failed to generate order number');
    }
    
    const orderNumber = orderNumberData;

    // Get app origin for redirect
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
    const appOrigin = origin || Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app');

    console.log(`🌐 Using app origin: ${appOrigin}`);

    // Create Billplz bill
    const billPlzData = new URLSearchParams({
      collection_id: BILLPLZ_COLLECTION_ID,
      email: profile.email,
      name: profile.idstaff || profile.full_name || 'Customer',
      amount: (serverTotalPrice * 100).toString(), // Convert to cents
      description: `Order ${orderNumber} - ${bundle.name}`,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/billplz-payment`,
      redirect_url: `${appOrigin}/payment-summary?order=${orderNumber}`,
      reference_1_label: 'Order Number',
      reference_1: orderNumber
    });

    if (profile.phone_number) {
      billPlzData.append('mobile', profile.phone_number);
    }

    const response = await fetch(`${BILLPLZ_BASE_URL}/bills`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(BILLPLZ_API_KEY + ':')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: billPlzData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Billplz API error:', errorText);
      throw new Error(`Billplz API error: ${response.status}`);
    }

    const billData = await response.json();

    // Activate customer receipt delivery for this collection
    try {
      await fetch(`https://www.billplz.com/api/v4/collections/${BILLPLZ_COLLECTION_ID}/customer_receipt_delivery/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(BILLPLZ_API_KEY + ':')}`,
        },
      });
      console.log('📧 Customer receipt delivery activated for collection');
    } catch (receiptError) {
      console.warn('⚠️ Failed to activate customer receipt delivery:', receiptError);
      // Don't fail the entire request if receipt activation fails
    }

    // Store pending order
    const { error: pendingError } = await supabase
      .from('pending_orders')
      .insert({
        order_number: orderNumber,
        buyer_id: user.id,
        product_id: bundle.product_id,
        bundle_id: bundleId,
        quantity: serverTotalQuantity,
        unit_price: serverUnitPrice,
        total_price: serverTotalPrice,
        status: 'pending',
        transaction_id: billData.id,
        billplz_bill_id: billData.id,
      });

    if (pendingError) {
      console.error('Pending order creation error:', pendingError);
      throw pendingError;
    }

    console.log('✅ Billplz bill created:', billData.id);

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: billData.url,
        orderNumber: orderNumber,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in billplz-payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

async function handleWebhook(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();

    const billplz_id = formData.get('id') as string || formData.get('billplz[id]') as string;

    console.log('🔔 Webhook received - Bill ID:', billplz_id);

    if (!billplz_id) {
      console.error('❌ Missing bill ID in webhook');
      return new Response('Missing bill ID', { status: 400 });
    }

    // Find payment record
    const { data: payment, error: paymentError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('transaction_id', billplz_id)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('❌ Payment not found for bill:', billplz_id);
      return new Response('Payment not found', { status: 404 });
    }

    // Only process if payment is currently pending
    if (payment.status !== 'pending') {
      console.log('⚠️ Payment already processed, skipping:', payment.id);
      return new Response('Payment already processed', { status: 200 });
    }

    // Get API key to query Billplz API directly
    const { data: apiKeySetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'billplz_api_key')
      .maybeSingle();

    const apiKey = apiKeySetting?.setting_value || Deno.env.get('BILLPLZ_API_KEY');

    if (!apiKey) {
      console.error('❌ Billplz API key not configured');
      return new Response('API key not configured', { status: 500 });
    }

    // Query Billplz API directly to get real payment status
    console.log('🔍 Querying Billplz API for real status...');
    const billResponse = await fetch(`https://www.billplz.com/api/v3/bills/${billplz_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`,
      },
    });

    if (!billResponse.ok) {
      const errorText = await billResponse.text();
      console.error('❌ Billplz API error:', errorText);
      return new Response('Billplz API error', { status: 500 });
    }

    const billData = await billResponse.json();
    console.log('📊 Real bill status from Billplz API:', billData);

    // Determine payment status from API response - only success if paid is true AND state is 'paid'
    const isPaidSuccess = billData.paid === true && billData.state === 'paid';

    console.log(`📝 Payment ${payment.id} real status: ${isPaidSuccess ? 'SUCCESS' : 'FAILED'}`);

    if (isPaidSuccess) {
      console.log(`💰 Payment SUCCESSFUL - Processing order ${payment.order_number}`);

      // Billplz is only used for Master Agent → HQ transactions
      // Agent → Master Agent uses manual transactions (see TransactionAgent.tsx)
      // So seller is always HQ for Billplz payments
      const { data: hqUser } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'hq')
        .limit(1)
        .single();

      const sellerId = hqUser?.user_id || null;

      // Create completed transaction with bill ID and seller_id
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          buyer_id: payment.buyer_id,
          seller_id: sellerId,
          product_id: payment.product_id,
          quantity: payment.quantity,
          unit_price: payment.unit_price,
          total_price: payment.total_price,
          transaction_type: 'purchase',
          billplz_bill_id: billplz_id,
        });

      if (txError) {
        console.error('❌ Transaction creation error:', txError);
        return new Response('Error creating transaction', { status: 500 });
      }

      // Update buyer's inventory (increase)
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', payment.buyer_id)
        .eq('product_id', payment.product_id)
        .maybeSingle();

      if (existingInventory) {
        await supabase
          .from('inventory')
          .update({
            quantity: existingInventory.quantity + payment.quantity,
          })
          .eq('id', existingInventory.id);
      } else {
        await supabase
          .from('inventory')
          .insert({
            user_id: payment.buyer_id,
            product_id: payment.product_id,
            quantity: payment.quantity,
          });
      }

      // Update seller's inventory (decrease) - only if seller exists
      if (sellerId) {
        const { data: sellerInventory } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', sellerId)
          .eq('product_id', payment.product_id)
          .maybeSingle();

        if (sellerInventory && sellerInventory.quantity >= payment.quantity) {
          await supabase
            .from('inventory')
            .update({
              quantity: sellerInventory.quantity - payment.quantity,
            })
            .eq('id', sellerInventory.id);

          console.log(`📦 Seller inventory decreased by ${payment.quantity} units`);
        } else {
          console.warn(`⚠️ Seller inventory insufficient or not found. Current: ${sellerInventory?.quantity || 0}, Required: ${payment.quantity}`);
        }
      }

      // Mark pending order as completed
      await supabase
        .from('pending_orders')
        .update({ status: 'completed' })
        .eq('id', payment.id);

      console.log('✅ Payment processed successfully, buyer and seller inventory updated');
    } else {
      console.log(`❌ Payment NOT successful (paid: ${billData.paid}, state: ${billData.state})`);
      
      // Mark order as failed
      await supabase
        .from('pending_orders')
        .update({ status: 'failed' })
        .eq('id', payment.id);
    }

    return new Response('OK', { status: 200 });

  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// Check bill status directly from Billplz API (100% accurate, not dependent on callback)
async function checkBillStatus(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const billId = url.searchParams.get('bill_id');
    const orderNumber = url.searchParams.get('order_number');

    if (!billId && !orderNumber) {
      return new Response(
        JSON.stringify({ error: 'bill_id or order_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let actualBillId = billId;

    // If only order_number is provided, fetch the bill_id from pending_orders
    if (!actualBillId && orderNumber) {
      const { data: order } = await supabase
        .from('pending_orders')
        .select('billplz_bill_id')
        .eq('order_number', orderNumber)
        .single();

      if (order?.billplz_bill_id) {
        actualBillId = order.billplz_bill_id;
      } else {
        return new Response(
          JSON.stringify({ error: 'Order not found or no bill ID available' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get API key from system settings or environment variable
    const { data: apiKeySetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'billplz_api_key')
      .maybeSingle();

    const apiKey = apiKeySetting?.setting_value || Deno.env.get('BILLPLZ_API_KEY');

    if (!apiKey) {
      throw new Error('Billplz API key not configured');
    }

    // Call Billplz API to get bill status
    const billResponse = await fetch(`https://www.billplz.com/api/v3/bills/${actualBillId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`,
      },
    });

    if (!billResponse.ok) {
      const errorText = await billResponse.text();
      console.error('Billplz API error:', errorText);
      throw new Error(`Billplz API error: ${billResponse.status}`);
    }

    const billData = await billResponse.json();
    console.log('📊 Bill status from Billplz API:', billData);

    // Determine actual status based on Billplz response
    // paid=true AND state='paid' means successful payment
    // If user returned without paying (navigated back), Billplz webhook already marked it as failed
    const isPaid = billData.paid === true && billData.state === 'paid';
    
    // Check if order was already marked as failed by webhook
    let status = isPaid ? 'completed' : 'pending';
    if (orderNumber) {
      const { data: currentOrder } = await supabase
        .from('pending_orders')
        .select('status')
        .eq('order_number', orderNumber)
        .single();
      
      // If webhook already marked it as failed, keep it failed
      if (currentOrder?.status === 'failed') {
        status = 'failed';
      }
    }

    // Update pending_orders with the actual status
    if (orderNumber) {
      const { data: order } = await supabase
        .from('pending_orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

      if (order && order.status !== status) {
        console.log(`🔄 Updating order ${orderNumber} status: ${order.status} → ${status}`);
        
        await supabase
          .from('pending_orders')
          .update({ status })
          .eq('order_number', orderNumber);

        // If payment is completed, create transaction and update inventory
        if (status === 'completed' && order.status !== 'completed') {
          const { data: hqUser } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'hq')
            .limit(1)
            .single();

          if (hqUser) {
            await supabase
              .from('transactions')
              .insert({
                buyer_id: order.buyer_id,
                seller_id: hqUser.user_id,
                product_id: order.product_id,
                quantity: order.quantity,
                unit_price: order.unit_price,
                total_price: order.total_price,
                transaction_type: 'purchase',
                billplz_bill_id: actualBillId,
              });

            // Update buyer's inventory (increase)
            const { data: existingInventory } = await supabase
              .from('inventory')
              .select('*')
              .eq('user_id', order.buyer_id)
              .eq('product_id', order.product_id)
              .maybeSingle();

            if (existingInventory) {
              await supabase
                .from('inventory')
                .update({ quantity: existingInventory.quantity + order.quantity })
                .eq('id', existingInventory.id);
            } else {
              await supabase
                .from('inventory')
                .insert({
                  user_id: order.buyer_id,
                  product_id: order.product_id,
                  quantity: order.quantity,
                });
            }

            // Update HQ's inventory (decrease)
            const { data: hqInventory } = await supabase
              .from('inventory')
              .select('*')
              .eq('user_id', hqUser.user_id)
              .eq('product_id', order.product_id)
              .maybeSingle();

            if (hqInventory && hqInventory.quantity >= order.quantity) {
              await supabase
                .from('inventory')
                .update({ quantity: hqInventory.quantity - order.quantity })
                .eq('id', hqInventory.id);

              console.log(`📦 HQ inventory decreased by ${order.quantity} units`);
            } else {
              console.warn(`⚠️ HQ inventory insufficient. Current: ${hqInventory?.quantity || 0}, Required: ${order.quantity}`);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        bill_id: actualBillId,
        status,
        paid: billData.paid,
        state: billData.state,
        amount: billData.amount,
        paid_at: billData.paid_at,
        billplz_data: billData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error checking bill status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

// Recheck payment status for failed orders
async function recheckPayment(billId: string): Promise<Response> {
  try {
    if (!billId) {
      return new Response(
        JSON.stringify({ error: 'bill_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API key
    const { data: apiKeySetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'billplz_api_key')
      .maybeSingle();

    const apiKey = apiKeySetting?.setting_value || Deno.env.get('BILLPLZ_API_KEY');

    if (!apiKey) {
      throw new Error('Billplz API key not configured');
    }

    // Call Billplz API to get current bill status
    const billResponse = await fetch(`https://www.billplz.com/api/v3/bills/${billId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`,
      },
    });

    if (!billResponse.ok) {
      const errorText = await billResponse.text();
      console.error('Billplz API error:', errorText);
      throw new Error(`Billplz API error: ${billResponse.status}`);
    }

    const billData = await billResponse.json();
    console.log('🔍 Recheck - Bill status from Billplz:', billData);

    // Check if payment is now successful
    const isPaid = billData.paid === true && billData.state === 'paid';
    
    // Find the pending order
    const { data: order } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('billplz_bill_id', billId)
      .single();

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let status = order.status;

    // If payment is now successful and order was failed/pending, process it
    if (isPaid && (order.status === 'failed' || order.status === 'pending')) {
      console.log(`✅ Recheck: Payment is now successful! Processing order ${order.order_number}`);

      // Get HQ as the seller (Billplz only for Master Agent → HQ)
      const { data: hqUser } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'hq')
        .limit(1)
        .single();

      const sellerId = hqUser?.user_id || null;

      // Check if transaction already exists for this bill_id
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('billplz_bill_id', billId)
        .maybeSingle();

      // Create transaction only if it doesn't exist
      if (!existingTransaction) {
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            buyer_id: order.buyer_id,
            seller_id: sellerId,
            product_id: order.product_id,
            quantity: order.quantity,
            unit_price: order.unit_price,
            total_price: order.total_price,
            transaction_type: 'purchase',
            billplz_bill_id: billId,
          });

        if (txError) {
          console.error('❌ Transaction creation error:', txError);
          throw new Error(`Failed to create transaction: ${txError.message}`);
        }
      } else {
        console.log('ℹ️ Transaction already exists for this bill, skipping creation');
      }

      // Only update inventory if transaction was just created (not already existing)
      if (!existingTransaction) {
        // Update buyer's inventory (increase)
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', order.buyer_id)
          .eq('product_id', order.product_id)
          .maybeSingle();

        if (existingInventory) {
          await supabase
            .from('inventory')
            .update({ quantity: existingInventory.quantity + order.quantity })
            .eq('id', existingInventory.id);
        } else {
          await supabase
            .from('inventory')
            .insert({
              user_id: order.buyer_id,
              product_id: order.product_id,
              quantity: order.quantity,
            });
        }

        // Update HQ's inventory (decrease)
        if (sellerId) {
          const { data: hqInventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', sellerId)
            .eq('product_id', order.product_id)
            .maybeSingle();

          if (hqInventory && hqInventory.quantity >= order.quantity) {
            await supabase
              .from('inventory')
              .update({ quantity: hqInventory.quantity - order.quantity })
              .eq('id', hqInventory.id);

            console.log(`📦 HQ inventory decreased by ${order.quantity} units`);
          } else {
            console.warn(`⚠️ HQ inventory insufficient. Current: ${hqInventory?.quantity || 0}, Required: ${order.quantity}`);
          }
        }

        console.log('✅ Recheck: Order processed successfully, buyer and HQ inventory updated');
      } else {
        console.log('ℹ️ Inventory already updated for this transaction, skipping inventory update');
      }

      // Update order status to completed
      await supabase
        .from('pending_orders')
        .update({ status: 'completed' })
        .eq('id', order.id);

      status = 'completed';
    } else if (!isPaid) {
      // Still not paid - keep as failed
      status = 'failed';
      console.log('❌ Recheck: Payment still failed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        bill_id: billId,
        status,
        paid: billData.paid,
        state: billData.state,
        amount: billData.amount,
        paid_at: billData.paid_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error rechecking payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

serve(handler);
