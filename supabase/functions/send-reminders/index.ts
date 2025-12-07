/**
 * Supabase Edge Function: Send Reminders
 * 
 * Processes pending reminders and sends push notifications via FCM
 * 
 * This function should be called by an external cron service every 15 minutes
 * 
 * Usage:
 * POST /send-reminders
 * Headers: Authorization: Bearer [CRON_SECRET]
 * 
 * Returns:
 * {
 *   processed: number,
 *   sent: number,
 *   failed: number
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Parse PEM private key and convert to format needed for JWT signing
 */
function parsePrivateKey(privateKey: string): string {
  return privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
}

/**
 * Generate JWT for OAuth 2.0 service account authentication
 */
async function generateOAuthToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // Token valid for 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const privateKeyPem = parsePrivateKey(serviceAccount.private_key);
  const keyData = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Exchange JWT for OAuth access token
 */
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const jwt = await generateOAuthToken(serviceAccount);

  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Send FCM notification via HTTP v1 API
 */
async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
      ) : undefined,
      android: {
        priority: 'high' as const,
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FCM API error: ${response.status} ${error}`);
  }
}

/**
 * Build notification body based on reminder type
 */
function buildNotificationBody(
  reminderType: string,
  itemName: string,
  itemTime: string,
  hoursBefore?: number
): string {
  switch (reminderType) {
    case 'day_before':
      return `Tomorrow! Don't forget about ${itemName} at ${itemTime}`;
    case 'day_of':
      return `Today! ${itemName} starts at ${itemTime}`;
    case 'hours_before':
      return `${itemName} starts in ${hoursBefore} hour${hoursBefore !== 1 ? 's' : ''}`;
    default:
      return `Reminder: ${itemName} is coming up`;
  }
}

/**
 * Format time from timestamp
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify API key
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    if (!cronSecret) {
      throw new Error('CRON_SECRET environment variable not set');
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get Firebase service account from environment
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not set');
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${error.message}`);
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Query pending reminders that are due
    const { data: reminders, error: remindersError } = await supabase
      .from('scheduled_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(100); // Process up to 100 reminders per run

    if (remindersError) {
      throw new Error(`Failed to fetch reminders: ${remindersError.message}`);
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({
          processed: 0,
          sent: 0,
          failed: 0,
          message: 'No pending reminders',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get OAuth access token (reuse for all notifications)
    const accessToken = await getAccessToken(serviceAccount);

    let sentCount = 0;
    let failedCount = 0;

    // Process each reminder
    for (const reminder of reminders) {
      try {
        // Get user's FCM token
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('push_token, full_name')
          .eq('id', reminder.user_id)
          .single();

        if (userError || !userData || !userData.push_token) {
          // Update reminder as failed
          await supabase
            .from('scheduled_reminders')
            .update({
              status: 'failed',
              error_message: 'User not found or has no push token',
            })
            .eq('id', reminder.id);
          failedCount++;
          continue;
        }

        // Get event or opportunity details
        let itemName = '';
        let itemTime = '';
        let itemTimeFormatted = '';
        let itemLocation = '';
        let notificationType = '';
        let itemId = '';
        let itemStartDateTime: Date | null = null;

        if (reminder.event_id) {
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('title, event_date, start_time, location')
            .eq('id', reminder.event_id)
            .single();

          if (eventError || !eventData) {
            await supabase
              .from('scheduled_reminders')
              .update({
                status: 'failed',
                error_message: 'Event not found',
              })
              .eq('id', reminder.id);
            failedCount++;
            continue;
          }

          itemName = eventData.title;
          const eventDateTime = `${eventData.event_date} ${eventData.start_time || '09:00:00'}`;
          itemTimeFormatted = formatTime(eventDateTime);
          itemStartDateTime = new Date(eventDateTime);
          itemLocation = eventData.location || '';
          notificationType = 'event_reminder';
          itemId = reminder.event_id;
        } else if (reminder.opportunity_id) {
          const { data: oppData, error: oppError } = await supabase
            .from('opportunities')
            .select('title, date_start, time_start, location')
            .eq('id', reminder.opportunity_id)
            .single();

          if (oppError || !oppData) {
            await supabase
              .from('scheduled_reminders')
              .update({
                status: 'failed',
                error_message: 'Opportunity not found',
              })
              .eq('id', reminder.id);
            failedCount++;
            continue;
          }

          itemName = oppData.title;
          const oppDateTime = oppData.time_start
            ? `${oppData.date_start.split('T')[0]} ${oppData.time_start}`
            : oppData.date_start;
          itemTimeFormatted = formatTime(oppDateTime);
          itemStartDateTime = new Date(oppDateTime);
          itemLocation = oppData.location || '';
          notificationType = 'opportunity_reminder';
          itemId = reminder.opportunity_id;
        } else {
          await supabase
            .from('scheduled_reminders')
            .update({
              status: 'failed',
              error_message: 'Neither event_id nor opportunity_id set',
            })
            .eq('id', reminder.id);
          failedCount++;
          continue;
        }

        // Build notification
        const title = `Reminder: ${itemName}`;
        // Calculate hours before for hours_before reminder type
        let hoursBefore: number | undefined;
        if (reminder.reminder_type === 'hours_before' && itemStartDateTime) {
          const scheduledTime = new Date(reminder.scheduled_for);
          const diffMs = itemStartDateTime.getTime() - scheduledTime.getTime();
          hoursBefore = Math.round(diffMs / (1000 * 60 * 60));
        }
        const body = buildNotificationBody(reminder.reminder_type, itemName, itemTimeFormatted, hoursBefore);

        const notificationData = {
          type: notificationType,
          id: itemId,
        };

        // Send FCM notification
        await sendFCMNotification(
          accessToken,
          serviceAccount.project_id,
          userData.push_token,
          title,
          body,
          notificationData
        );

        // Update reminder as sent
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        sentCount++;
      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
        
        // Update reminder as failed
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error',
          })
          .eq('id', reminder.id);

        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        processed: reminders.length,
        sent: sentCount,
        failed: failedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-reminders function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
