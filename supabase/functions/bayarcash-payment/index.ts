import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Validation schemas
const PaymentRequestSchema = z.object({
  bundleId: z.string().uuid({ message: "Invalid bundle ID format" }),
  quantity: z.number().int().positive().max(10000, { message: "Quantity must be between 1 and 10000" }),
  units: z.number().int().positive().max(100, { message: "Units must be between 1 and 100" }),
  profile: z.object({
    idstaff: z.string().trim().min(1).max(50).optional(),
    full_name: z.string().trim().min(1, { message: "Full name is required" }).max(100),
    email: z.string().trim().email({ message: "Invalid email format" }).max(255),
    phone_number: z.string().trim().regex(/^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/, { message: "Invalid Malaysian phone number format" }),
  }),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create checksum using Web Crypto API
// Only uses: amount, order_number, payer_email, payer_name, payment_channel (alphabetically sorted)
async function createChecksum(data: any, secretKey: string): Promise<string> {
  const payload = {
    amount: data.amount,
    order_number: data.order_number,
    payer_email: data.payer_email,
    payer_name: data.payer_name,
    payment_channel: data.payment_channel,
  };
  
  // Sort keys alphabetically (JavaScript object keys maintain order)
  const sortedKeys = Object.keys(payload).sort();
  const sortedValues = sortedKeys.map(key => payload[key as keyof typeof payload]);
  const payloadString = sortedValues.join('|');
  
  // Create HMAC SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(payloadString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to verify callback checksum with timestamp validation
async function verifyCallbackChecksum(callbackData: any, secretKey: string): Promise<{ isValid: boolean; error?: string }> {
  // Validate timestamp to prevent replay attacks (reject callbacks older than 5 minutes)
  if (callbackData.datetime) {
    try {
      const callbackTime = new Date(callbackData.datetime).getTime();
      const currentTime = Date.now();
      const timeDifference = currentTime - callbackTime;
      const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
      
      if (timeDifference > MAX_AGE_MS) {
        console.warn('Callback rejected: timestamp too old', { 
          datetime: callbackData.datetime,
          age_minutes: Math.floor(timeDifference / 60000)
        });
        return { isValid: false, error: 'Callback timestamp expired' };
      }
      
      if (timeDifference < -60000) { // Future timestamp (more than 1 minute ahead)
        console.warn('Callback rejected: timestamp in future', { datetime: callbackData.datetime });
        return { isValid: false, error: 'Invalid callback timestamp' };
      }
    } catch (e) {
      console.error('Callback rejected: invalid datetime format', { datetime: callbackData.datetime });
      return { isValid: false, error: 'Invalid datetime format' };
    }
  }
  
  const payload = {
    record_type: callbackData.record_type,
    transaction_id: callbackData.transaction_id,
    exchange_reference_number: callbackData.exchange_reference_number,
    exchange_transaction_id: callbackData.exchange_transaction_id,
    order_number: callbackData.order_number,
    currency: callbackData.currency,
    amount: callbackData.amount,
    payer_name: callbackData.payer_name,
    payer_email: callbackData.payer_email,
    payer_bank_name: callbackData.payer_bank_name,
    status: callbackData.status,
    status_description: callbackData.status_description,
    datetime: callbackData.datetime,
  };
  
  // Sort keys alphabetically
  const sortedKeys = Object.keys(payload).sort();
  const sortedValues = sortedKeys.map(key => payload[key as keyof typeof payload]);
  const payloadString = sortedValues.join('|');
  
  // Create HMAC SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(payloadString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const calculatedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const isValid = calculatedChecksum === callbackData.checksum;
  return { isValid, error: isValid ? undefined : 'Invalid checksum' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const portalKey = Deno.env.get('BAYARCASH_PORTAL_KEY');
    const secretKey = Deno.env.get('BAYARCASH_API_SECRET_KEY');
    const apiToken = Deno.env.get('BAYARCASH_API_TOKEN');

    // Handle payment callbacks from BayarCash
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const callbackData: any = {};
      
      for (const [key, value] of formData.entries()) {
        callbackData[key] = value;
      }

      console.log('Payment callback received:', {
        order_number: callbackData.order_number,
        status: callbackData.status,
        status_description: callbackData.status_description,
        amount: callbackData.amount,
        transaction_id: callbackData.transaction_id,
      });

      // Verify callback checksum and timestamp
      const verification = await verifyCallbackChecksum(callbackData, secretKey!);
      
      if (!verification.isValid) {
        console.error('Callback verification failed:', verification.error);
        return new Response(verification.error || 'Invalid callback', { status: 400, headers: corsHeaders });
      }

      // BayarCash Status Codes:
      // '0' = Pending
      // '1' = Processing
      // '2' = Failed/Cancelled/Rejected
      // '3' = Successful/Completed
      
      // Only process if status is '3' (successful payment)
      if (callbackData.status === '3') {
        console.log('Payment successful, processing order');

        // Find pending transaction by order number (stored in a new pending_orders table)
        const { data: pendingOrder } = await supabaseAdmin
          .from('pending_orders')
          .select('*')
          .eq('order_number', callbackData.order_number)
          .eq('status', 'pending')
          .single();

        if (pendingOrder) {
          // Create completed transaction
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
            console.error('Transaction creation error:', txError);
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

            // Mark pending order as completed
            await supabaseAdmin
              .from('pending_orders')
              .update({ status: 'completed' })
              .eq('id', pendingOrder.id);

            console.log('Payment processed successfully, inventory updated');
          }
        } else {
          console.warn('Pending order not found for successful payment:', callbackData.order_number);
        }
      } else {
        // Handle failed, cancelled, or other non-successful statuses
        const statusMap: Record<string, string> = {
          '0': 'Pending',
          '1': 'Processing', 
          '2': 'Failed/Cancelled',
          '3': 'Successful',
        };
        
        console.log('Payment not successful:', {
          status: callbackData.status,
          status_name: statusMap[callbackData.status] || 'Unknown',
          description: callbackData.status_description,
          order_number: callbackData.order_number,
        });
        
        // Mark order as failed for any non-successful status (0, 1, 2, or unknown)
        const { error: updateError } = await supabaseAdmin
          .from('pending_orders')
          .update({ status: 'failed' })
          .eq('order_number', callbackData.order_number)
          .eq('status', 'pending');
          
        if (updateError) {
          console.error('Failed to update order status:', updateError);
        } else {
          console.log('Order marked as failed successfully');
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Handle payment creation request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Parse and validate input
    const requestBody = await req.json();
    const validationResult = PaymentRequestSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }

    const { bundleId, quantity, units, profile } = validationResult.data;

    // Get user's role to determine correct pricing tier
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      throw new Error('User role not found');
    }

    // Get bundle and product details with price
    const { data: bundle, error: bundleError } = await supabaseAdmin
      .from('bundles')
      .select('*, products(*)')
      .eq('id', bundleId)
      .eq('is_active', true)
      .single();

    if (bundleError || !bundle) {
      throw new Error('Bundle not found or inactive');
    }

    if (!bundle.products || !bundle.products.is_active) {
      throw new Error('Product is inactive');
    }

    // CRITICAL: Calculate price server-side based on user role - never trust client input
    const serverUnitPrice = userRole.role === 'agent' 
      ? bundle.agent_price 
      : bundle.master_agent_price;
    
    if (!serverUnitPrice || serverUnitPrice <= 0) {
      throw new Error('Invalid bundle pricing configuration');
    }

    const serverTotalQuantity = quantity * units;
    const serverTotalPrice = serverUnitPrice * quantity;

    // Generate sequential order number using database function
    const { data: orderNumberData, error: orderNumberError } = await supabaseAdmin
      .rpc('generate_order_number');
    
    if (orderNumberError || !orderNumberData) {
      throw new Error('Failed to generate order number');
    }
    
    const orderNumber = orderNumberData;
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bayarcash-callback`;
    
    // Get origin from request header for dynamic redirect URL
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovableproject.com')}`;
    const returnUrl = `${origin}/payment-summary?order=${orderNumber}`;

    // Prepare payment intent data with server-calculated price
    const paymentData = {
      portal_key: portalKey,
      order_number: orderNumber,
      amount: serverTotalPrice.toFixed(2),
      payer_name: profile.idstaff || profile.full_name,
      payer_email: profile.email,
      payer_telephone_number: profile.phone_number,
      callback_url: callbackUrl,
      return_url: returnUrl,
      payment_channel: '1', // 1 = FPX (default payment gateway for Malaysia)
    };

    // Generate checksum for security
    const checksum = await createChecksum(paymentData, secretKey!);
    const paymentDataWithChecksum = { ...paymentData, checksum };

    console.log('Creating payment intent');

    // Call BayarCash API v2
    const bayarcashResponse = await fetch('https://console.bayar.cash/api/v2/payment-intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(paymentDataWithChecksum),
    });

    const responseText = await bayarcashResponse.text();
    console.log('Payment API response status:', bayarcashResponse.status);
    console.log('Payment API response body:', responseText);

    let bayarcashResult;
    try {
      bayarcashResult = JSON.parse(responseText);
      console.log('Parsed BayarCash result:', JSON.stringify(bayarcashResult));
    } catch (e) {
      console.error('Failed to parse payment API response');
      throw new Error(`Payment API returned invalid response. Status: ${bayarcashResponse.status}`);
    }

    if (!bayarcashResponse.ok) {
      throw new Error(bayarcashResult.message || 'Failed to create payment intent');
    }

    // Extract transaction ID from BayarCash response
    // BayarCash returns transaction_id in the response (e.g., "trx_xyz123")
    const transactionId = bayarcashResult.id || bayarcashResult.transaction_id || bayarcashResult.data?.id || bayarcashResult.data?.transaction_id;
    console.log('Extracted transaction ID:', transactionId);
    
    if (!transactionId) {
      console.warn('No transaction ID received from BayarCash');
    }

    // Store pending order with server-calculated values and transaction ID
    const { error: pendingError } = await supabaseAdmin
      .from('pending_orders')
      .insert({
        order_number: orderNumber,
        buyer_id: user.id,
        product_id: bundle.product_id,
        quantity: serverTotalQuantity,
        unit_price: serverUnitPrice,
        total_price: serverTotalPrice,
        status: 'pending',
        transaction_id: transactionId,
      });

    if (pendingError) {
      console.error('Pending order creation error:', pendingError);
      throw pendingError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: bayarcashResult.url,
        orderNumber: orderNumber,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
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
