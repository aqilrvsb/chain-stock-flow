import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wc-webhook-signature, x-wc-webhook-source, x-wc-webhook-topic, x-wc-webhook-resource, x-wc-webhook-event, x-wc-webhook-id, x-wc-webhook-delivery-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NINJAVAN_API = 'https://api.ninjavan.co/my';

// WooCommerce Order interface (simplified)
interface WooOrder {
  id: number;
  status: string; // 'processing', 'completed', etc.
  currency: string;
  total: string;
  billing: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string;
    email: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string;
  };
  payment_method: string;
  payment_method_title: string;
  line_items: Array<{
    name: string;
    quantity: number;
    total: string;
    sku: string;
  }>;
  date_created: string;
}

// Verify WooCommerce webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');
    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Get valid NinjaVan access token
async function getNinjavanToken(supabase: any, profileId: string): Promise<string | null> {
  try {
    // Get NinjaVan config for this profile's branch
    const { data: profile } = await supabase
      .from('profiles')
      .select('branch_id')
      .eq('id', profileId)
      .single();

    const branchId = profile?.branch_id || profileId;

    const { data: config, error: configError } = await supabase
      .from('ninjavan_config')
      .select('*')
      .eq('profile_id', branchId)
      .single();

    if (configError || !config) {
      console.error('NinjaVan config not found:', configError);
      return null;
    }

    const now = new Date();

    // Check for valid (non-expired) token
    const { data: tokenData } = await supabase
      .from('ninjavan_tokens')
      .select('*')
      .eq('profile_id', branchId)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenData && tokenData.access_token) {
      console.log('Using existing NinjaVan token');
      return tokenData.access_token;
    }

    // Get new token from NinjaVan OAuth
    console.log('Getting new NinjaVan token');
    const authResponse = await fetch(`${NINJAVAN_API}/2.0/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.client_id,
        client_secret: config.client_secret,
        grant_type: 'client_credentials'
      })
    });

    if (!authResponse.ok) {
      console.error('NinjaVan auth failed');
      return null;
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;
    const expiresIn = authData.expires_in || 3600;

    // Store token
    const expiresAt = new Date(now.getTime() + ((expiresIn - 300) * 1000));
    await supabase.from('ninjavan_tokens').insert({
      profile_id: branchId,
      access_token: accessToken,
      expires_at: expiresAt.toISOString()
    });

    return accessToken;
  } catch (error) {
    console.error('Error getting NinjaVan token:', error);
    return null;
  }
}

// Create NinjaVan order
async function createNinjavanOrder(
  supabase: any,
  profileId: string,
  orderData: {
    idSale: string;
    customerName: string;
    phone: string;
    address: string;
    postcode: string;
    city: string;
    state: string;
    price: number;
    paymentMethod: string;
    productName: string;
    marketerIdStaff: string;
  }
): Promise<{ success: boolean; trackingNumber?: string; error?: string }> {
  try {
    const accessToken = await getNinjavanToken(supabase, profileId);
    if (!accessToken) {
      return { success: false, error: 'Failed to get NinjaVan access token' };
    }

    // Get profile's branch for sender config
    const { data: profile } = await supabase
      .from('profiles')
      .select('branch_id')
      .eq('id', profileId)
      .single();

    const branchId = profile?.branch_id || profileId;

    // Get sender config
    const { data: config } = await supabase
      .from('ninjavan_config')
      .select('*')
      .eq('profile_id', branchId)
      .single();

    if (!config) {
      return { success: false, error: 'NinjaVan sender config not found' };
    }

    // Prepare address
    let address1 = orderData.address;
    let address2 = '';
    if (orderData.address.length > 100) {
      address1 = orderData.address.substring(0, 100);
      address2 = orderData.address.substring(100, 200);
    }

    const today = new Date();
    const pickupDate = today.toISOString().split('T')[0];
    const deliveryDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // COD amount (only for COD payments)
    const codAmount = orderData.paymentMethod === 'COD' ? Math.round(orderData.price) : 0;
    const deliveryInstructions = `${orderData.productName} (${orderData.marketerIdStaff}) (${pickupDate})`;

    const ninjavanPayload = {
      service_type: "Parcel",
      service_level: "Standard",
      requested_tracking_number: orderData.idSale,
      reference: {
        merchant_order_number: `OLIVEJARDIN-${orderData.idSale}`
      },
      from: {
        name: config.sender_name,
        phone_number: config.sender_phone,
        email: config.sender_email,
        address: {
          address1: config.sender_address1,
          address2: config.sender_address2 || '',
          country: "MY",
          postcode: config.sender_postcode,
          city: config.sender_city,
          state: config.sender_state
        }
      },
      to: {
        name: orderData.customerName,
        phone_number: orderData.phone,
        address: {
          address1: address1,
          address2: address2,
          country: "MY",
          postcode: orderData.postcode,
          city: orderData.city,
          state: orderData.state
        }
      },
      parcel_job: {
        is_pickup_required: true,
        pickup_service_type: "Scheduled",
        pickup_service_level: "Standard",
        pickup_date: pickupDate,
        pickup_timeslot: {
          start_time: "09:00",
          end_time: "18:00",
          timezone: "Asia/Kuala_Lumpur"
        },
        pickup_approx_volume: "Half-Van Load",
        delivery_start_date: deliveryDate,
        delivery_timeslot: {
          start_time: "09:00",
          end_time: "18:00",
          timezone: "Asia/Kuala_Lumpur"
        },
        delivery_instructions: deliveryInstructions,
        cash_on_delivery: codAmount,
        insured_value: Math.round(orderData.price),
        dimensions: {
          weight: 0.5
        }
      }
    };

    console.log('Sending to NinjaVan:', JSON.stringify(ninjavanPayload));

    const orderResponse = await fetch(`${NINJAVAN_API}/4.1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ninjavanPayload)
    });

    const orderResult = await orderResponse.json();
    console.log('NinjaVan response:', orderResult);

    if (!orderResponse.ok) {
      return {
        success: false,
        error: orderResult.message || 'Failed to create NinjaVan order'
      };
    }

    return {
      success: true,
      trackingNumber: orderResult.tracking_number
    };
  } catch (error: any) {
    console.error('NinjaVan order error:', error);
    return { success: false, error: error.message };
  }
}

// Generate Sale ID using database sequence
async function generateSaleId(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc('generate_sale_id');
  if (error || !data) {
    // Fallback
    const ts = Date.now().toString().slice(-5);
    return `OJ${ts}`;
  }
  return data;
}

// Format phone number to local format (0xxxxxxxxx)
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('60')) {
    formatted = '0' + formatted.substring(2);
  }
  if (!formatted.startsWith('0')) {
    formatted = '0' + formatted;
  }
  return formatted;
}

// Map Malaysian state names
function mapState(state: string): string {
  const stateMap: Record<string, string> = {
    'wp kuala lumpur': 'Kuala Lumpur',
    'kuala lumpur': 'Kuala Lumpur',
    'kl': 'Kuala Lumpur',
    'selangor': 'Selangor',
    'johor': 'Johor',
    'penang': 'Penang',
    'pulau pinang': 'Penang',
    'perak': 'Perak',
    'kedah': 'Kedah',
    'kelantan': 'Kelantan',
    'terengganu': 'Terengganu',
    'pahang': 'Pahang',
    'negeri sembilan': 'Negeri Sembilan',
    'melaka': 'Melaka',
    'malacca': 'Melaka',
    'sabah': 'Sabah',
    'sarawak': 'Sarawak',
    'perlis': 'Perlis',
    'labuan': 'Labuan',
    'putrajaya': 'Putrajaya'
  };
  return stateMap[state.toLowerCase()] || state;
}

serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get webhook headers
  const signature = req.headers.get('x-wc-webhook-signature') || '';
  const source = req.headers.get('x-wc-webhook-source') || '';
  const topic = req.headers.get('x-wc-webhook-topic') || '';
  const webhookId = req.headers.get('x-wc-webhook-id') || '';

  // Get marketer_id (idstaff like "BRKB-001") from URL query parameter
  const url = new URL(req.url);
  const marketerIdStaffParam = url.searchParams.get('marketer_id');

  if (!marketerIdStaffParam) {
    return new Response(
      JSON.stringify({ error: 'marketer_id (idstaff) is required as query parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Look up the marketer by idstaff to get UUID
  const { data: marketerLookup, error: lookupError } = await supabase
    .from('profiles')
    .select('id, idstaff, full_name, branch_id')
    .eq('idstaff', marketerIdStaffParam)
    .single();

  if (lookupError || !marketerLookup) {
    return new Response(
      JSON.stringify({ error: `Marketer not found with idstaff: ${marketerIdStaffParam}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const marketerId = marketerLookup.id; // UUID
  const marketerIdStaff = marketerLookup.idstaff;
  const branchId = marketerLookup.branch_id;

  console.log('=== Marketer found ===');
  console.log('Marketer UUID:', marketerId);
  console.log('Marketer idstaff:', marketerIdStaff);
  console.log('Branch ID:', branchId);

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    console.log('Raw body length:', rawBody.length);
    console.log('Raw body preview:', rawBody.substring(0, 200));

    // Handle empty body (ping test from WooCommerce)
    if (!rawBody || rawBody.trim() === '') {
      console.log('WooCommerce ping test received - returning success');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook endpoint is active' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let wooOrder: WooOrder;

    try {
      wooOrder = JSON.parse(rawBody);
    } catch {
      // If not valid JSON, might be a ping test
      console.log('Non-JSON body received, treating as ping test');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook endpoint is active' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle WooCommerce webhook ping/test
    // WooCommerce sends different test payloads:
    // 1. webhook_id in body (test delivery)
    // 2. action: "woocommerce_rest_api_test_connection"
    // 3. Empty or minimal payload
    const orderAsAny = wooOrder as any;
    const isPingTest = wooOrder && typeof wooOrder === 'object' && (
      'webhook_id' in wooOrder ||
      orderAsAny.action === 'woocommerce_rest_api_test_connection' ||
      !wooOrder.id ||
      !wooOrder.status
    );

    if (isPingTest) {
      console.log('WooCommerce webhook ping/test received:', JSON.stringify(wooOrder).substring(0, 200));
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook test successful' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log ALL incoming webhooks for debugging
    console.log('=== WooCommerce webhook received ===');
    console.log('Topic:', topic);
    console.log('Source:', source);
    console.log('Order ID:', wooOrder.id);
    console.log('Order Status:', wooOrder.status);
    console.log('Marketer ID:', marketerId);
    console.log('Marketer idstaff:', marketerIdStaff);
    console.log('Full order data:', JSON.stringify(wooOrder).substring(0, 500));

    // Log to webhook_logs immediately for debugging (even before processing)
    await supabase.from('webhook_logs').insert({
      webhook_type: 'woocommerce',
      request_method: req.method,
      request_body: wooOrder,
      request_headers: { signature: signature ? 'present' : 'missing', source, topic, webhookId },
      profile_id: marketerId,
      response_status: 0, // Mark as "incoming" - will be updated later
      response_body: { stage: 'received', status: wooOrder.status },
      processing_time_ms: 0
    });

    // Verify webhook signature using idstaff as secret (no woo_config needed)
    // Marketer sets their idstaff as the webhook secret in WooCommerce
    // Note: Skip verification if no signature provided (for testing)
    if (signature) {
      const isValidSignature = verifyWebhookSignature(rawBody, signature, marketerIdStaff);
      console.log('Signature verification:', {
        provided: signature.substring(0, 20) + '...',
        secret: marketerIdStaff,
        valid: isValidSignature
      });

      if (!isValidSignature) {
        console.error('Invalid webhook signature');
        await supabase.from('webhook_logs').insert({
          webhook_type: 'woocommerce',
          request_method: req.method,
          request_body: wooOrder,
          request_headers: { signature, source, topic, webhookId },
          profile_id: marketerId,
          response_status: 401,
          response_body: { error: 'Invalid signature' },
          error_message: `Invalid webhook signature - expected secret: ${marketerIdStaff}`,
          processing_time_ms: Date.now() - startTime
        });

        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature. Use your idstaff as the webhook secret in WooCommerce.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('No signature provided - skipping verification');
    }

    // Only process orders with status 'processing' (payment confirmed)
    if (wooOrder.status !== 'processing') {
      console.log('Skipping order - status is not processing:', wooOrder.status);
      return new Response(
        JSON.stringify({ success: true, message: `Skipped - order status is ${wooOrder.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate - skip if woo_order_id already exists
    // This handles cases where order goes: processing -> on-hold -> processing
    const { data: existingOrder } = await supabase
      .from('customer_purchases')
      .select('id, id_sale, tracking_number')
      .eq('woo_order_id', wooOrder.id)
      .maybeSingle();

    if (existingOrder) {
      console.log('Duplicate order detected - WooCommerce order already processed:', {
        woo_order_id: wooOrder.id,
        existing_order_id: existingOrder.id,
        id_sale: existingOrder.id_sale,
        tracking_number: existingOrder.tracking_number
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Order already processed',
          existing_order_id: existingOrder.id,
          id_sale: existingOrder.id_sale,
          tracking_number: existingOrder.tracking_number
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use shipping address if available, otherwise billing
    const shipping = wooOrder.shipping.address_1 ? wooOrder.shipping : wooOrder.billing;
    const customerName = `${shipping.first_name} ${shipping.last_name}`.trim() ||
                         `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim();
    const customerPhone = formatPhoneNumber(shipping.phone || wooOrder.billing.phone);
    const fullAddress = [shipping.address_1, shipping.address_2].filter(Boolean).join(', ');
    const city = shipping.city;
    const state = mapState(shipping.state);
    const postcode = shipping.postcode;

    // Get product info from line items
    const productNames = wooOrder.line_items.map(item => item.name).join(', ');
    const totalQuantity = wooOrder.line_items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = parseFloat(wooOrder.total);

    // Determine payment method (COD or CASH - online payment)
    // WooCommerce payment methods: 'cod', 'bacs', 'paypal', 'stripe', etc.
    const isCOD = wooOrder.payment_method.toLowerCase() === 'cod';
    const caraBayaran = isCOD ? 'COD' : 'CASH';
    const paymentMethod = isCOD ? 'COD' : 'Online Transfer';

    // Generate Sale ID
    const idSale = await generateSaleId(supabase);
    const dateOrder = new Date().toISOString().split('T')[0];

    // Create NinjaVan order for COD and CASH (Website platform)
    let trackingNumber = '';
    let ninjavanSuccess = false;

    if (branchId) {
      console.log('Creating NinjaVan order...');
      const ninjavanResult = await createNinjavanOrder(supabase, marketerId, {
        idSale,
        customerName,
        phone: customerPhone,
        address: fullAddress,
        postcode,
        city,
        state,
        price: totalPrice,
        paymentMethod: caraBayaran,
        productName: productNames,
        marketerIdStaff
      });

      if (ninjavanResult.success && ninjavanResult.trackingNumber) {
        trackingNumber = ninjavanResult.trackingNumber;
        ninjavanSuccess = true;
        console.log('NinjaVan order created, tracking:', trackingNumber);
      } else {
        console.error('NinjaVan failed:', ninjavanResult.error);
      }
    }

    // Create or get customer record (like MarketerOrders.tsx does)
    let customerId: string | null = null;

    // Check if customer exists by phone
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', customerPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update customer address
      await supabase
        .from('customers')
        .update({
          name: customerName,
          address: fullAddress,
          postcode: postcode,
          city: city,
          state: state,
        })
        .eq('id', customerId);
      console.log('Existing customer found:', customerId);
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: customerName,
          phone: customerPhone,
          address: fullAddress,
          postcode: postcode,
          city: city,
          state: state,
          created_by: marketerId,
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        // Continue without customer_id - will fail if NOT NULL constraint exists
      } else {
        customerId = newCustomer.id;
        console.log('New customer created:', customerId);
      }
    }

    // Insert order into customer_purchases
    const { data: newOrder, error: insertError } = await supabase
      .from('customer_purchases')
      .insert({
        customer_id: customerId, // Link to customer record
        seller_id: branchId, // Branch ID so it appears in Branch logistics
        marketer_id: marketerId,
        marketer_id_staff: marketerIdStaff,
        marketer_name: customerName, // Customer name stored here
        no_phone: customerPhone,
        alamat: fullAddress,
        poskod: postcode,
        bandar: city,
        negeri: state,
        produk: productNames,
        sku: wooOrder.line_items[0]?.sku || productNames,
        quantity: totalQuantity,
        unit_price: totalPrice / totalQuantity,
        total_price: totalPrice,
        profit: totalPrice,
        kurier: 'Ninjavan',
        id_sale: idSale,
        tracking_number: trackingNumber,
        no_tracking: trackingNumber,
        jenis_platform: 'Website', // WooCommerce = Website platform
        jenis_customer: 'NP', // Default to new prospect
        jenis_closing: 'Website', // Closed via website
        cara_bayaran: caraBayaran,
        payment_method: paymentMethod,
        nota_staff: `WooCommerce Order #${wooOrder.id}`,
        delivery_status: 'Pending',
        date_order: dateOrder,
        // For CASH (online payment), payment is already done
        tarikh_bayaran: !isCOD ? dateOrder : null,
        jenis_bayaran: !isCOD ? 'FPX' : null,
        platform: 'WooCommerce',
        woo_order_id: wooOrder.id // Store WooCommerce order ID for reference
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting order:', insertError);
      await supabase.from('webhook_logs').insert({
        webhook_type: 'woocommerce',
        request_method: req.method,
        request_body: wooOrder,
        request_headers: { signature, source, topic, webhookId },
        profile_id: marketerId,
        response_status: 500,
        response_body: { error: insertError.message },
        error_message: insertError.message,
        processing_time_ms: Date.now() - startTime
      });

      return new Response(
        JSON.stringify({ error: 'Failed to create order', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful webhook
    await supabase.from('webhook_logs').insert({
      webhook_type: 'woocommerce',
      request_method: req.method,
      request_body: wooOrder,
      request_headers: { signature, source, topic, webhookId },
      profile_id: marketerId,
      order_id: newOrder.id,
      response_status: 200,
      response_body: {
        success: true,
        order_id: newOrder.id,
        id_sale: idSale,
        tracking_number: trackingNumber
      },
      processing_time_ms: Date.now() - startTime
    });

    console.log('Order created successfully:', {
      id: newOrder.id,
      idSale,
      trackingNumber,
      ninjavanSuccess
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order created successfully',
        order_id: newOrder.id,
        id_sale: idSale,
        tracking_number: trackingNumber,
        ninjavan_success: ninjavanSuccess
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('WooCommerce webhook error:', error);

    await supabase.from('webhook_logs').insert({
      webhook_type: 'woocommerce',
      request_method: req.method,
      request_headers: { signature, source, topic, webhookId },
      profile_id: marketerId,
      response_status: 500,
      response_body: { error: error.message },
      error_message: error.message,
      processing_time_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
