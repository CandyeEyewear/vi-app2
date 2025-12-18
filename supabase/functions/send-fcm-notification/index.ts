/**
 * Supabase Edge Function: Send FCM Notification
 * 
 * Sends push notifications via Firebase Cloud Messaging (FCM) HTTP v1 API
 * 
 * Usage:
 * POST /send-fcm-notification
 * {
 *   "userId": "user-uuid",
 *   "title": "Notification Title",
 *   "body": "Notification Body",
 *   "data": { "key": "value" } // optional
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FCMRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

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

type JsonResponse = {
  success: boolean;
  error?: string;
  userId?: string;
  callerId?: string;
  // Helpful debug hints (safe to share)
  hint?: string;
};

/**
 * Parse PEM private key and convert to format needed for JWT signing
 */
function parsePrivateKey(privateKey: string): string {
  // Remove header, footer, and whitespace
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

  // JWT Header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // JWT Payload
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key for signing
  const privateKeyPem = parsePrivateKey(serviceAccount.private_key);
  const keyData = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));
  
  // Import the key
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

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  // Encode signature
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

  const result = await response.json();
  console.log('FCM notification sent successfully:', result);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (payload: JsonResponse) =>
    // Always 200 so supabase-js can reliably read the body (it treats non-2xx as errors)
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' });
    }

    // Parse request body
    const requestData: FCMRequest = await req.json();
    const { userId, title, body, data } = requestData;

    // Validate required fields
    if (!userId || !title || !body) {
      return json({ success: false, error: 'Missing required fields: userId, title, body' });
    }

    // Get Firebase service account from environment
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      return json({
        success: false,
        userId,
        error: 'Server not configured',
        hint: 'Missing FIREBASE_SERVICE_ACCOUNT in Edge Function environment',
      });
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      return json({
        success: false,
        userId,
        error: 'Server not configured',
        hint: `Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${error.message}`,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    
    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      const missing = [
        !supabaseUrl ? 'SUPABASE_URL' : null,
        !supabaseKey ? 'SUPABASE_ANON_KEY' : null,
        !supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      ].filter(Boolean);
      return json({
        success: false,
        userId,
        error: 'Server not configured',
        hint: `Missing env: ${missing.join(', ')}`,
      });
    }

    // Identify caller via JWT (verify_jwt=true also enforces this at the platform layer,
    // but we still verify here so we can return a clear error payload.)
    const supabaseAuthed = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authErr } = await supabaseAuthed.auth.getUser();
    const callerId = authData?.user?.id;
    if (authErr || !callerId) {
      return json({ success: false, userId, error: 'Unauthorized' });
    }

    // Privileged service role client for DB reads (RLS-safe)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Authorization: users may only send to themselves unless staff.
    if (callerId !== userId) {
      const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', callerId)
        .single();

      const callerRole = (callerProfile as any)?.role;
      const isStaff = callerRole === 'admin' || callerRole === 'sup';

      if (callerProfileErr || !isStaff) {
        return json({
          success: false,
          userId,
          callerId,
          error: 'Forbidden',
          hint: 'Can only send push notifications to yourself unless you are admin/sup',
        });
      }
    }

    // Get user's push token from database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (userError) {
      return json({
        success: false,
        userId,
        callerId,
        error: `Failed to fetch user: ${userError.message}`,
      });
    }

    if (!userData || !userData.push_token) {
      return json({
        success: false,
        userId,
        callerId,
        error: 'User not found or has no push token registered',
        hint:
          'Make sure the app ran token registration on a real device and saved it to public.users.push_token',
      });
    }

    const fcmToken = userData.push_token;

    // Get OAuth access token
    console.log('Getting OAuth access token...');
    const accessToken = await getAccessToken(serviceAccount);

    // Send FCM notification
    console.log(`Sending FCM notification to user ${userId}...`);
    await sendFCMNotification(
      accessToken,
      serviceAccount.project_id,
      fcmToken,
      title,
      body,
      data
    );

    return json({
      success: true,
      userId,
      callerId,
    });
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    return json({
      success: false,
      error: error?.message || 'Unknown error occurred',
    });
  }
});
