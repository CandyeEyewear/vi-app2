const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, fullName, phone, location, bio, areasOfExpertise, education } = await req.json()

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and fullName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
    if (location) properties.city = location
    if (bio) properties.notes_last_contacted = bio // or use a custom property
    if (education) properties.school = education
    if (areasOfExpertise && areasOfExpertise.length > 0) {
      properties.areas_of_expertise = areasOfExpertise.join(', ')
    }

    // First, try to find existing contact by email
    const searchUrl = 'https://api.hubapi.com/crm/v3/objects/contacts/search'
    const searchResponse = await fetch(searchUrl, {
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

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      console.error('[HUBSPOT] Search error:', errorText)
      throw new Error(`HubSpot search failed: ${searchResponse.status}`)
    }

    const searchData = await searchResponse.json()
    const existingContact = searchData.results?.[0]

    let contactId: string

    if (existingContact) {
      // Update existing contact
      console.log('[HUBSPOT] Updating existing contact:', existingContact.id)
      const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${existingContact.id}`
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      })

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        console.error('[HUBSPOT] Update error:', errorText)
        throw new Error(`HubSpot update failed: ${updateResponse.status}`)
      }

      contactId = existingContact.id
    } else {
      // Create new contact
      console.log('[HUBSPOT] Creating new contact')
      const createUrl = 'https://api.hubapi.com/crm/v3/objects/contacts'
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('[HUBSPOT] Create error:', errorText)
        throw new Error(`HubSpot create failed: ${createResponse.status}`)
      }

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
