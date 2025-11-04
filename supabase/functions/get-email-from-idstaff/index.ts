import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // NOTE: This function is intentionally public to support IDSTAFF-based login
    // It only exposes email addresses (not passwords or sensitive data)
    // Email enumeration is mitigated by the fact that login still requires valid password

    const { idstaff } = await req.json()

    if (!idstaff) {
      throw new Error('IDSTAFF is required')
    }

    console.log('Looking up email for IDSTAFF:', idstaff)

    // Look up the email from idstaff
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('idstaff', idstaff)
      .maybeSingle()

    if (error) {
      console.error('Error looking up profile:', error)
      throw error
    }

    if (!profile) {
      console.log('No profile found for IDSTAFF:', idstaff)
      return new Response(
        JSON.stringify({ email: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found email for IDSTAFF:', idstaff)

    return new Response(
      JSON.stringify({ email: profile.email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in get-email-from-idstaff function:', error)
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
