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

interface SyncOptions {
  attempts?: number;
  initialDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sync contact to HubSpot - searches for existing contact by email, creates if not found
 * Returns the HubSpot Contact ID in both cases
 */
export async function syncContactToHubSpot(contactData: ContactData): Promise<{ 
  success: boolean; 
  contactId?: string; 
  error?: string 
}> {
  return syncContactToHubSpotWithRetry(contactData);
}

export async function syncContactToHubSpotWithRetry(
  contactData: ContactData,
  options: SyncOptions = {}
): Promise<{
  success: boolean;
  contactId?: string;
  error?: string;
}> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const initialDelayMs = Math.max(100, options.initialDelayMs ?? 600);

  let lastError = 'Failed to sync HubSpot contact';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`[HUBSPOT] Sync attempt ${attempt}/${attempts}...`);

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
        lastError = error.message || 'HubSpot Edge Function error';
        console.error('[HUBSPOT] Edge Function error:', error);
      } else if (!data?.success) {
        lastError = data?.error || 'HubSpot sync returned unsuccessful response';
        console.error('[HUBSPOT] Sync failed:', data?.error);
      } else {
        console.log('[HUBSPOT] Contact synced successfully:', data.contactId);
        return { success: true, contactId: data.contactId };
      }
    } catch (error: any) {
      lastError = error?.message || 'Failed to sync HubSpot contact';
      console.error('[HUBSPOT] Error calling Edge Function:', error);
    }

    if (attempt < attempts) {
      const backoffMs = initialDelayMs * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
