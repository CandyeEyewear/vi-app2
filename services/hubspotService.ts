/**
 * HubSpot Service
 * Calls Supabase Edge Function to sync contacts to HubSpot CRM
 */

import { supabase } from './supabase';

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
 * Sync contact to HubSpot - searches for existing contact by email, creates if not found
 * Returns the HubSpot Contact ID in both cases
 */
export async function syncContactToHubSpot(contactData: ContactData): Promise<{ 
  success: boolean; 
  contactId?: string; 
  error?: string 
}> {
  try {
    console.log('[HUBSPOT] Calling Edge Function to sync contact...');

    const { data, error } = await supabase.functions.invoke('hubspot-sync', {
      body: {
        email: contactData.email,
        fullName: contactData.fullName,
        phone: contactData.phone,
        location: contactData.location,
        bio: contactData.bio,
        areasOfExpertise: contactData.areasOfExpertise,
        education: contactData.education,
      },
    });

    if (error) {
      console.error('[HUBSPOT] Edge Function error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      console.error('[HUBSPOT] Sync failed:', data.error);
      return { success: false, error: data.error };
    }

    console.log('[HUBSPOT] Contact synced successfully:', data.contactId);
    return { success: true, contactId: data.contactId };

  } catch (error: any) {
    console.error('[HUBSPOT] Error calling Edge Function:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to sync HubSpot contact' 
    };
  }
}
