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

export const config = {
  runtime: 'edge',
};

function mapFrequency(freq: string): string {
  const map: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    quarterly: 'QUARTERLY',
    annually: 'YEARLY',
  };
  return map[freq] || 'MONTHLY';
}

function calculateNextBillingDate(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'daily': now.setDate(now.getDate() + 1); break;
    case 'weekly': now.setDate(now.getDate() + 7); break;
    case 'monthly': now.setMonth(now.getMonth() + 1); break;
    case 'quarterly': now.setMonth(now.getMonth() + 3); break;
    case 'annually': now.setFullYear(now.getFullYear() + 1); break;
  }
  return now.toISOString().split('T')[0];
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
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
    } = body;

    if (!amount || !frequency || !subscriptionType || !userId || !customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
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
        'Licence': EZEE_LICENCE_KEY,
      },
      body: JSON.stringify({
        site: EZEE_SITE,
        order_id: subscriptionOrderId,
        amount: amount.toFixed(2),
        currency: 'JMD',
        frequency: mapFrequency(frequency),
        cardholder_email: customerEmail,
        cardholder_name: customerName || 'Subscriber',
        description: description || `${frequency} subscription`,
        postback_url: postBackUrl,
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
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!subscriptionResponse.ok) {
      console.error('eZeePayments subscription error:', subscriptionData);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription', details: subscriptionData }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Store subscription in database
    const { data: subscription, error: dbError } = await supabase
      .from('payment_subscriptions')
      .insert({
        user_id: userId,
        subscription_type: subscriptionType,
        reference_id: referenceId,
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
        'Licence': EZEE_LICENCE_KEY,
      },
      body: JSON.stringify({
        site: EZEE_SITE,
        order_id: subscriptionOrderId,
        amount: amount.toFixed(2),
        currency: 'JMD',
        cardholder_email: customerEmail,
        cardholder_name: customerName || 'Subscriber',
        description: `First payment: ${description || frequency + ' subscription'}`,
        postback_url: postBackUrl,
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
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const paymentUrl = EZEE_API_URL.includes('test')
      ? 'https://secure-test.ezeepayments.com/pay'
      : 'https://secure.ezeepayments.com/pay';

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription?.id,
        ezeeSubscriptionId: subscriptionData.subscription_id,
        token: tokenData.token,
        paymentUrl,
        paymentData: {
          token: tokenData.token,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Create subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}