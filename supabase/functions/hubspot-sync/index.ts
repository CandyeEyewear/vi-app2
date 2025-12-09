import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, fullName, phone, location, bio, areasOfExpertise, education } = await req.json()

    // Validate required fields
    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and fullName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY')
    if (!HUBSPOT_API_KEY) {
      throw new Error('HUBSPOT_API_KEY not configured')
    }

    // Search for existing contact
    const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
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

    const searchData = await searchResponse.json()

    // If contact exists, return their ID
    if (searchData.results && searchData.results.length > 0) {
      const contactId = searchData.results[0].id
      console.log('Found existing HubSpot contact:', contactId)
      return new Response(
        JSON.stringify({ success: true, contactId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create new contact
    const nameParts = fullName.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const properties: Record<string, string> = {
      email,
      firstname: firstName,
      lastname: lastName,
    }

    if (phone) properties.phone = phone
    if (location) properties.city = location
    if (bio) properties.notes = bio
    if (education) properties.school = education
    if (areasOfExpertise && areasOfExpertise.length > 0) {
      properties.areas_of_expertise = areasOfExpertise.join(', ')
    }

    properties.hs_lead_status = 'NEW'
    properties.lifecyclestage = 'lead'

    const createResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      },
      body: JSON.stringify({ properties }),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()
      console.error('HubSpot API Error:', errorData)
      return new Response(
        JSON.stringify({ success: false, error: `HubSpot API error: ${createResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const createData = await createResponse.json()
    const contactId = createData.id
    console.log('Created new HubSpot contact:', contactId)

    return new Response(
      JSON.stringify({ success: true, contactId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
