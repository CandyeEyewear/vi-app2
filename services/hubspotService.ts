/**
 * HubSpot Service
 * Handles creating and updating contacts in HubSpot CRM
 */

const HUBSPOT_API_KEY = 'pat-na1-51b5-c2bf-4758-9dec-e9476277a041';
const HUBSPOT_API_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

interface ContactData {
  email: string;
  fullName: string;
  phone?: string;
  location?: string;
  bio?: string;
  areasOfExpertise?: string[];
  education?: string;
}

/**
 * Create a new contact in HubSpot
 */
export async function createHubSpotContact(contactData: ContactData): Promise<{ success: boolean; error?: string }> {
  try {
    // Split full name into first and last name
    const nameParts = contactData.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Prepare HubSpot contact properties
    const properties: Record<string, string> = {
      email: contactData.email,
      firstname: firstName,
      lastname: lastName,
    };

    // Add optional fields if they exist
    if (contactData.phone) {
      properties.phone = contactData.phone;
    }

    if (contactData.location) {
      properties.city = contactData.location;
    }

    if (contactData.bio) {
      properties.notes = contactData.bio;
    }

    if (contactData.education) {
      properties.school = contactData.education;
    }

    // Join areas of expertise into a comma-separated string
    if (contactData.areasOfExpertise && contactData.areasOfExpertise.length > 0) {
      properties.areas_of_expertise = contactData.areasOfExpertise.join(', ');
    }

    // Add source tracking
    properties.hs_lead_status = 'NEW';
    properties.lifecyclestage = 'lead';

    // Make API request to HubSpot
    const response = await fetch(HUBSPOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      },
      body: JSON.stringify({
        properties,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('HubSpot API Error:', errorData);
      
      // Check if contact already exists
      if (response.status === 409) {
        console.log('Contact already exists in HubSpot');
        return { success: true }; // Consider this a success
      }
      
      return { 
        success: false, 
        error: `HubSpot API error: ${response.status}` 
      };
    }

    const data = await response.json();
    console.log('HubSpot contact created:', data.id);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error creating HubSpot contact:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create HubSpot contact' 
    };
  }
}

/**
 * Update an existing contact in HubSpot by email
 */
export async function updateHubSpotContact(email: string, updates: Partial<ContactData>): Promise<{ success: boolean; error?: string }> {
  try {
    // First, search for the contact by email
    const searchUrl = `${HUBSPOT_API_URL}/search`;
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
      }),
    });

    if (!searchResponse.ok) {
      return { success: false, error: 'Failed to find contact' };
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      return { success: false, error: 'Contact not found' };
    }

    const contactId = searchData.results[0].id;

    // Prepare update properties
    const properties: Record<string, string> = {};

    if (updates.fullName) {
      const nameParts = updates.fullName.trim().split(' ');
      properties.firstname = nameParts[0] || '';
      properties.lastname = nameParts.slice(1).join(' ') || '';
    }

    if (updates.phone) properties.phone = updates.phone;
    if (updates.location) properties.city = updates.location;
    if (updates.bio) properties.notes = updates.bio;
    if (updates.education) properties.school = updates.education;
    if (updates.areasOfExpertise && updates.areasOfExpertise.length > 0) {
      properties.areas_of_expertise = updates.areasOfExpertise.join(', ');
    }

    // Update the contact
    const updateResponse = await fetch(`${HUBSPOT_API_URL}/${contactId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!updateResponse.ok) {
      return { success: false, error: 'Failed to update contact' };
    }

    console.log('HubSpot contact updated:', contactId);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating HubSpot contact:', error);
    return { success: false, error: error.message };
  }
}
