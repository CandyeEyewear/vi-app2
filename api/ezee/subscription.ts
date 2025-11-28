/**
 * Vercel API Route: /api/ezee/subscription.ts
 * Manage subscriptions (status check, cancel)
 * WITH CORS SUPPORT
 */

import { createClient } from '@supabase/supabase-js';

const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY!;

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

  const { action } = req.query;

  try {
    if (req.method === 'GET' && action === 'status') {
      return await getSubscriptionStatus(req, res);
  }

    if (req.method === 'POST' && action === 'cancel') {
      return await cancelSubscription(req, res);
  }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error: any) {
    console.error('Subscription API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function getSubscriptionStatus(req: any, res: any) {
  const { subscriptionId } = req.query;

  if (!subscriptionId) {
    return res.status(400).json({ error: 'subscriptionId is required' });
  }

  // Try to find by ID first, then by ezee_subscription_id
  let { data: subscription, error } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error || !subscription) {
    // Try by ezee_subscription_id
    const { data: subByEzee, error: ezeeError } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('ezee_subscription_id', subscriptionId)
      .single();
    
    if (ezeeError || !subByEzee) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    subscription = subByEzee;
    }

    if (subscription.ezee_subscription_id) {
      try {
        const ezeeResponse = await fetch(
          `${EZEE_API_URL}/v1/subscription/status/${subscription.ezee_subscription_id}/`,
          {
            method: 'GET',
            headers: { 'Licence': EZEE_LICENCE_KEY },
          }
        );

        if (ezeeResponse.ok) {
        let ezeeData;
        try {
          ezeeData = await ezeeResponse.json();
        } catch (jsonError) {
          console.error('Failed to parse eZeePayments status response:', jsonError);
          // Continue with database status if JSON parsing fails
          ezeeData = { status: subscription.status };
        }

          const statusMap: Record<string, string> = {
            'ACTIVE': 'active',
            'CANCELLED': 'cancelled',
            'ENDED': 'ended',
            'PAUSED': 'paused',
          };

          const mappedStatus = statusMap[ezeeData.status] || subscription.status;

          if (mappedStatus !== subscription.status) {
            await supabase
              .from('payment_subscriptions')
            .update({ status: mappedStatus, updated_at: new Date().toISOString() })
            .eq('id', subscription.id);

            subscription.status = mappedStatus;
          }
        }
      } catch (ezeeError) {
        console.error('eZee status check error:', ezeeError);
      }
    }

  return res.status(200).json({
    success: true,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      amount: subscription.amount,
      currency: subscription.currency,
      frequency: subscription.frequency,
      createdAt: subscription.created_at,
      nextBillingDate: subscription.next_billing_date,
    }
  });
}

async function cancelSubscription(req: any, res: any) {
  const { subscriptionId, userId } = req.body;

    if (!subscriptionId || !userId) {
    return res.status(400).json({ error: 'subscriptionId and userId are required' });
    }

  // Try to find by ID first, then by ezee_subscription_id
  let { data: subscription, error } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', userId)
      .single();

    if (error || !subscription) {
    // Try by ezee_subscription_id
    const { data: subByEzee, error: ezeeError } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('ezee_subscription_id', subscriptionId)
      .eq('user_id', userId)
      .single();
    
    if (ezeeError || !subByEzee) {
      return res.status(404).json({ error: 'Subscription not found or unauthorized' });
    }
    subscription = subByEzee;
    }

    if (subscription.ezee_subscription_id) {
      try {
      const ezeeResponse = await fetch(`${EZEE_API_URL}/v1/subscription/cancel/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
          licence_key: EZEE_LICENCE_KEY,
            subscription_id: subscription.ezee_subscription_id,
          }),
        });

      if (!ezeeResponse.ok) {
        const ezeeError = await ezeeResponse.json().catch(() => ({}));
        console.error('eZee cancel error:', ezeeError);
      }
    } catch (ezeeError) {
      console.error('eZee cancel request error:', ezeeError);
      }
    }

    await supabase
      .from('payment_subscriptions')
      .update({
        status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
      })
    .eq('id', subscription.id);

    if (subscription.subscription_type === 'recurring_donation' && subscription.reference_id) {
      await supabase
        .from('recurring_donations')
        .update({ status: 'cancelled' })
        .eq('id', subscription.reference_id);
    }

    if (subscription.subscription_type === 'membership') {
      await supabase
        .from('users')
        .update({ membership_status: 'cancelled', is_premium: false })
        .eq('id', userId);
    }

  return res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully'
  });
  }
