/**
 * Vercel API Route: /api/ezee/create-subscription.ts
 * Creates a subscription for recurring payments
 * WITH CORS SUPPORT
 * Uses official eZeePayments API format with form data
 */

import { createClient } from '@supabase/supabase-js';

const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY!;
const EZEE_SITE = process.env.EZEE_SITE || 'https://test.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibe.volunteersinc.org';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    } = req.body;

    if (!amount || !frequency || !subscriptionType || !userId || !customerEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount, frequency, subscriptionType, userId, customerEmail' 
      });
    }

    const subscriptionOrderId = `sub_${subscriptionType}_${userId}_${Date.now()}`;
    const postBackUrl = `${APP_URL}/api/ezee/webhook`;
    const returnUrl = `${APP_URL}/payment/success?type=subscription`;
    const cancelUrl = `${APP_URL}/payment/cancel?type=subscription`;

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

    const subscriptionResponse = await fetch(`${EZEE_API_URL}/v1/subscription/create/`, {
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
    const { data: subscription, error: dbError } = await supabase
      .from('payment_subscriptions')
      .insert({
        user_id: userId,
        subscription_type: subscriptionType,
        reference_id: referenceId || null,
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
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // Get token for first payment using form data
    const tokenFormData = new URLSearchParams();
    tokenFormData.append('amount', amount.toString());
    tokenFormData.append('currency', 'JMD');
    tokenFormData.append('order_id', subscriptionOrderId);
    tokenFormData.append('post_back_url', postBackUrl);
    tokenFormData.append('return_url', returnUrl);
    tokenFormData.append('cancel_url', cancelUrl);
    tokenFormData.append('subscription_id', ezeeSubscriptionId);

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
