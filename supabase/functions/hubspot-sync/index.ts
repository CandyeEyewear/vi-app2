// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { email, fullName, phone, location, bio, areasOfExpertise, education } = await req.json()

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and fullName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // AuthZ: require a valid Supabase user JWT, and only allow syncing the authenticated user's email.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase env not configured (SUPABASE_URL/SUPABASE_ANON_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const authedEmail = userData?.user?.email?.toLowerCase();
    if (userErr || !authedEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (String(email).toLowerCase() !== authedEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: can only sync the authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const HUBSPOT_ACCESS_TOKEN = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    if (!HUBSPOT_ACCESS_TOKEN) {
      console.error('HUBSPOT_ACCESS_TOKEN not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'HubSpot not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[HUBSPOT] Syncing contact:', email)

    // Create new contact
    const nameParts = fullName.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Build properties object (v3 format)
    const properties: Record<string, string> = {
      email,
      firstname: firstName,
      lastname: lastName,
    }

    if (phone) properties.phone = phone

    // Helper: call HubSpot and handle errors with structured logging
    async function hubspotFetch(endpoint: string, options: RequestInit): Promise<Response> {
      const res = await fetch(endpoint, options)
      if (!res.ok) {
        const body = await res.text()
        const truncated = body.length > 500 ? body.slice(0, 500) + '…' : body
        console.error(JSON.stringify({
          msg: 'HubSpot API error',
          endpoint,
          method: options.method,
          status: res.status,
          body: truncated,
        }))
        // Surface upstream status category without leaking raw response to client
        const category = res.status === 401 ? 'auth/token'
          : res.status === 403 ? 'forbidden/scopes'
          : res.status === 429 ? 'rate-limited'
          : `upstream-${res.status}`
        return new Response(
          JSON.stringify({ success: false, error: `HubSpot ${options.method} failed (${category})`, upstreamStatus: res.status }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return res
    }

    // Search for existing contact by email
    const searchUrl = 'https://api.hubapi.com/crm/v3/objects/contacts/search'
    const searchResponse = await hubspotFetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email,
          }],
        }],
      }),
    })
    if (searchResponse.headers.get('Content-Type')?.includes('application/json') === false || searchResponse.status === 502) {
      return searchResponse // already an error response with CORS headers
    }

    const searchData = await searchResponse.json()
    const existingContact = searchData.results?.[0]

    let contactId: string

    if (existingContact) {
      console.log('[HUBSPOT] Updating existing contact:', existingContact.id)
      const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${existingContact.id}`
      const updateResponse = await hubspotFetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      })
      if (updateResponse.status === 502) return updateResponse

      contactId = existingContact.id
    } else {
      console.log('[HUBSPOT] Creating new contact')
      const createUrl = 'https://api.hubapi.com/crm/v3/objects/contacts'
      const createResponse = await hubspotFetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      })
      if (createResponse.status === 502) return createResponse

      const createData = await createResponse.json()
      contactId = createData.id
    }

    console.log('[HUBSPOT] Contact synced successfully. ID:', contactId)

    return new Response(
      JSON.stringify({ success: true, contactId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[HUBSPOT] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
