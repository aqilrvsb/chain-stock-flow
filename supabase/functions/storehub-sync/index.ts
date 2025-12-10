import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storehub_username, storehub_password, date } = await req.json();

    if (!storehub_username || !storehub_password) {
      return new Response(
        JSON.stringify({ error: "Missing StoreHub credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Basic Auth header
    const credentials = btoa(`${storehub_username}:${storehub_password}`);

    // Format date for StoreHub API (YYYY-MM-DD)
    const today = date || new Date().toISOString().split('T')[0];

    // Calculate yesterday's date (needed because Malaysia is UTC+8,
    // so early morning Malaysia time is still "yesterday" in UTC)
    const todayDate = new Date(today + 'T00:00:00Z');
    const yesterdayDate = new Date(todayDate.getTime() - (24 * 60 * 60 * 1000));
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    // Fetch transactions from StoreHub for yesterday and today (to cover timezone differences)
    const transactionsUrl = `https://api.storehubhq.com/transactions?from=${yesterday}&to=${today}`;

    const transactionsResponse = await fetch(transactionsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (!transactionsResponse.ok) {
      const errorText = await transactionsResponse.text();
      return new Response(
        JSON.stringify({
          error: "Failed to fetch transactions from StoreHub",
          details: errorText,
          status: transactionsResponse.status
        }),
        { status: transactionsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allTransactions = await transactionsResponse.json();

    // Filter transactions by Malaysia time (UTC+8)
    // Only include transactions where transactionTime in Malaysia timezone matches the requested date
    const filteredTransactions = allTransactions.filter((t: any) => {
      if (!t.transactionTime) return false;
      // Convert UTC to Malaysia time
      const utcDate = new Date(t.transactionTime);
      const malaysiaDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours
      const malaysiaDayStr = malaysiaDate.toISOString().split('T')[0];
      return malaysiaDayStr === today;
    });

    const transactions = filteredTransactions;

    // Fetch customers from StoreHub
    const customersResponse = await fetch("https://api.storehubhq.com/customers", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    let customers = [];
    if (customersResponse.ok) {
      customers = await customersResponse.json();
    }

    // Fetch products from StoreHub
    const productsResponse = await fetch("https://api.storehubhq.com/products", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    let products = [];
    if (productsResponse.ok) {
      products = await productsResponse.json();
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactions,
        customers,
        products,
        date: today
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
