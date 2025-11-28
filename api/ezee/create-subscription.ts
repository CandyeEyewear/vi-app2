/**
 * Vercel API Route: /api/ezee/create-subscription.ts
 * Creates a subscription for recurring payments
 * WITH CORS SUPPORT
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
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    quarterly: 'QUARTERLY',
    annually: 'YEARLY',
  };
  return map[freq.toLowerCase()] || 'MONTHLY';
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

    // Create subscription with eZeePayments
    const subscriptionResponse = await fetch(`${EZEE_API_URL}/v1/subscription/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licence_key: EZEE_LICENCE_KEY,
        site: EZEE_SITE,
        transaction_ref: subscriptionOrderId,
        amount: amount.toFixed(2),
        currency: 'JMD',
        frequency: mapFrequency(frequency),
        customer_email: customerEmail,
        customer_name: customerName || 'Subscriber',
        description: description || `${frequency} subscription`,
        webhook_url: postBackUrl,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        start_date: new Date().toISOString().split('T')[0],
        end_date: endDate || null,
      }),
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

    if (!subscriptionResponse.ok) {
      console.error('eZeePayments subscription error:', subscriptionData);
      return res.status(500).json({ 
        error: 'Failed to create subscription', 
        details: subscriptionData 
      });
    }

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
        ezee_subscription_id: subscriptionData.subscription_id || subscriptionOrderId,
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

    // Get token for first payment
    const tokenResponse = await fetch(`${EZEE_API_URL}/v1/custom_token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licence_key: EZEE_LICENCE_KEY,
        site: EZEE_SITE,
        transaction_ref: subscriptionOrderId,
        amount: amount.toFixed(2),
        currency: 'JMD',
        customer_email: customerEmail,
        customer_name: customerName || 'Subscriber',
        description: `First payment: ${description || frequency + ' subscription'}`,
        webhook_url: postBackUrl,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        subscription_id: subscriptionData.subscription_id,
      }),
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

    const paymentUrl = EZEE_API_URL.includes('test')
      ? 'https://secure-test.ezeepayments.com/pay'
      : 'https://secure.ezeepayments.com/pay';

    return res.status(200).json({
      success: true,
      subscriptionId: subscription?.id,
      ezeeSubscriptionId: subscriptionData.subscription_id,
      token: tokenData.token,
      paymentUrl,
      paymentData: {
        token: tokenData.token,
      },
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
