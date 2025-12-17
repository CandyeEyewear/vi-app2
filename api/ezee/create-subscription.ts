/**
 * Vercel API Route: /api/ezee/create-subscription.ts
 * Creates a subscription for recurring payments
 * WITH CORS SUPPORT
 * Uses official eZeePayments API format with form data
 */

import { createClient } from '@supabase/supabase-js';

const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY;
const EZEE_SITE = process.env.EZEE_SITE;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibe.volunteersinc.org';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to validate UUID
const isValidUUID = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function mapFrequency(freq: string): string {
  const map: Record<string, string> = {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    quarterly: 'quarterly',
    annually: 'annually',
  };
  return map[freq.toLowerCase()] || 'monthly';
}

function formatDateForEzee(date: string): string {
  // Convert YYYY-MM-DD to d/m/Y format
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function calculateNextBillingDate(frequency: string): string {
  const now = new Date();
  switch (frequency.toLowerCase()) {
    case 'daily': now.setDate(now.getDate() + 1); break;
    case 'weekly': now.setDate(now.getDate() + 7); break;
    case 'monthly': now.setMonth(now.getMonth() + 1); break;
    case 'quarterly': now.setMonth(now.getMonth() + 3); break;
    case 'annually': now.setFullYear(now.getFullYear() + 1); break;
  }
  return now.toISOString().split('T')[0];
}

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate required environment variables
  if (!EZEE_SITE || !EZEE_LICENCE_KEY) {
    console.error('CRITICAL: Missing eZeePayments environment variables:', {
      EZEE_SITE: !!EZEE_SITE,
      EZEE_LICENCE_KEY: !!EZEE_LICENCE_KEY,
      EZEE_API_URL: EZEE_API_URL,
    });
    return res.status(500).json({
      error: 'Payment configuration error. Please contact support.',
      debug: process.env.NODE_ENV === 'development' ? {
        missing: {
          EZEE_SITE: !EZEE_SITE,
          EZEE_LICENCE_KEY: !EZEE_LICENCE_KEY,
        }
      } : undefined
    });
  }

  try {
    const {
      amount,
      frequency,
      subscriptionType,
      referenceId,
      userId,
      customerEmail,
      customerName,
      description,
      endDate,
      platform,  // 'web' or 'app'
      returnPath,  // Path to redirect to after successful payment
    } = req.body;

    if (!amount || !frequency || !subscriptionType || !userId || !customerEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount, frequency, subscriptionType, userId, customerEmail' 
      });
    }

    // Generate short unique order ID (max 50 chars for eZeePayments)
    // Format: SUB_timestamp_random (e.g., "SUB_1764299044_x7k9m2" ~28 chars)
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const subscriptionOrderId = `SUB_${timestamp}_${randomStr}`;
    
    // Determine redirect URLs based on platform
    const isApp = platform === 'app';
    
    // Ensure APP_URL is HTTPS (eZeePayments requirement)
    // Remove any trailing slashes and ensure it starts with https://
    let baseUrl = APP_URL.trim();
    if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://')) {
      baseUrl = `https://${baseUrl}`;
    } else if (baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'https://');
    }
    baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    
    const postBackUrl = `${baseUrl}/api/ezee/webhook`;
    
    // Build return URL with returnPath if provided
    const returnParams = new URLSearchParams({ 
      orderId: subscriptionOrderId,
      type: 'subscription'
    });
    if (returnPath) {
      returnParams.append('returnPath', returnPath);
    }
    if (isApp) {
      returnParams.append('platform', 'app'); // flag for app-specific handling
    }
    const returnUrl = `${baseUrl}/payment/success?${returnParams.toString()}`;
    const cancelParams = new URLSearchParams({
      orderId: subscriptionOrderId,
      type: 'subscription',
    });
    if (isApp) {
      cancelParams.append('platform', 'app');
    }
    const cancelUrl = `${baseUrl}/payment/cancel?${cancelParams.toString()}`;

    // Create subscription with eZeePayments using form data
    const subscriptionFormData = new URLSearchParams();
    subscriptionFormData.append('amount', amount.toString());
    subscriptionFormData.append('currency', 'JMD');
    subscriptionFormData.append('frequency', mapFrequency(frequency));
    if (endDate) {
      subscriptionFormData.append('end_date', formatDateForEzee(endDate));
    }
    if (description) {
      subscriptionFormData.append('description', description);
    }
    subscriptionFormData.append('post_back_url', postBackUrl);

    const subscriptionResponse = await fetch(`${EZEE_API_URL}/v1.1/subscription/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: subscriptionFormData.toString(),
    });

    let subscriptionData;
    try {
      subscriptionData = await subscriptionResponse.json();
    } catch (jsonError) {
      console.error('Failed to parse eZeePayments subscription response:', jsonError);
      const textResponse = await subscriptionResponse.text();
      console.error('Response text:', textResponse);
      return res.status(500).json({ error: 'Invalid response from payment provider' });
    }

    // Check response - note the "result" wrapper
    if (!subscriptionData.result || subscriptionData.result.status !== 1) {
      console.error('eZeePayments subscription error:', subscriptionData);
      return res.status(500).json({ 
        error: subscriptionData.result?.message || 'Failed to create subscription',
        details: subscriptionData 
      });
    }

    // Subscription ID is inside result object
    const ezeeSubscriptionId = subscriptionData.result.subscription_id;

    // Store subscription in database
    // Only use reference_id if it's a valid UUID (database column is UUID type)
    const { data: subscription, error: dbError } = await supabase
      .from('payment_subscriptions')
      .insert({
        user_id: userId,
        subscription_type: subscriptionType,
        reference_id: (referenceId && isValidUUID(referenceId)) ? referenceId : null,  // Only use if valid UUID
        amount,
        currency: 'JMD',
        frequency,
        description: description || `${frequency} subscription`,
        ezee_subscription_id: ezeeSubscriptionId,
        status: 'pending',
        start_date: new Date().toISOString().split('T')[0],
        end_date: endDate || null,
        next_billing_date: calculateNextBillingDate(frequency),
        customer_email: customerEmail,
        customer_name: customerName,
        metadata: {
          cause_id: referenceId || null,  // Store cause_id for recurring donations
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // ALSO store in payment_transactions so webhook can find it by order_id
    // Map subscription_type to order_type for webhook compatibility
    let orderType: string = 'other';
    if (subscriptionType === 'membership') {
      orderType = 'membership';
    } else if (subscriptionType === 'organization_membership') {
      orderType = 'organization_membership';
    } else if (subscriptionType === 'recurring_donation') {
      orderType = 'recurring_donation';
    }

    const { error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId,
        order_id: subscriptionOrderId,  // This is what webhook looks for
        order_type: orderType,
        // reference_id needs to point at the recurring donation record for those subscriptions
        reference_id: subscriptionType === 'recurring_donation'
          ? (referenceId && isValidUUID(referenceId) ? referenceId : null)
          : (subscription?.id || null),
        amount,
        currency: 'JMD',
        description: description || `${frequency} subscription`,
        status: 'pending',
        customer_email: customerEmail,
        customer_name: customerName,
        metadata: {
          subscription_type: subscriptionType,
          frequency: frequency,
          ezee_subscription_id: ezeeSubscriptionId,
          payment_subscriptions_id: subscription?.id,
          recurring_donations_id: subscriptionType === 'recurring_donation' ? referenceId : null,
        },
      });

    if (txError) {
      console.error('Transaction record error:', txError);
    }

    // Get token for first payment using form data
    const tokenFormData = new URLSearchParams();
    tokenFormData.append('amount', amount.toString());
    tokenFormData.append('currency', 'JMD');
    tokenFormData.append('order_id', subscriptionOrderId);
    tokenFormData.append('post_back_url', postBackUrl);
    tokenFormData.append('return_url', returnUrl);
    tokenFormData.append('cancel_url', cancelUrl);
    // subscription_id is passed in paymentData for the final POST, not here

    const tokenResponse = await fetch(`${EZEE_API_URL}/v1/custom_token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: tokenFormData.toString(),
    });

    let tokenData;
    try {
      tokenData = await tokenResponse.json();
    } catch (jsonError) {
      console.error('Failed to parse eZeePayments token response:', jsonError);
      const textResponse = await tokenResponse.text();
      console.error('Response text:', textResponse);
      return res.status(500).json({ error: 'Invalid response from payment provider' });
    }

    // Check response - note the "result" wrapper
    if (!tokenData.result || tokenData.result.status !== 1) {
      console.error('eZeePayments token error:', tokenData);
      return res.status(500).json({ 
        error: tokenData.result?.message || 'Failed to create payment token',
        details: tokenData 
      });
    }

    // Token is inside result object
    const token = tokenData.result.token;

    // Build the redirect URL to our payment form page
    // This page will auto-submit a POST form to eZeePayments
    const paymentRedirectUrl = `${APP_URL}/api/ezee/pay?` + new URLSearchParams({
      token: token,
      amount: amount.toString(),
      currency: 'JMD',
      order_id: subscriptionOrderId,
      email: customerEmail,
      name: customerName || '',
      description: description || `${frequency} subscription`,
      subscription_id: ezeeSubscriptionId,
      recurring: 'true',
    }).toString();

    return res.status(200).json({
        success: true,
        subscriptionId: subscription?.id,
      ezeeSubscriptionId: ezeeSubscriptionId,
      token: token,
      paymentUrl: paymentRedirectUrl,  // This URL will auto-POST to eZeePayments
        paymentData: {
        token: token,
        amount: amount,
        currency: 'JMD',
        order_id: subscriptionOrderId,
        email_address: customerEmail,
        customer_name: customerName || 'Subscriber',
        description: description || `${frequency} subscription`,
        subscription_id: ezeeSubscriptionId,
      },
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
