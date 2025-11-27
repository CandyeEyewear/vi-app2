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

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'status' && req.method === 'GET') {
    return handleGetStatus(url);
  }

  if (action === 'cancel' && req.method === 'POST') {
    return handleCancel(req);
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    status: 400,
    headers: corsHeaders,
  });
}

async function handleGetStatus(url: URL) {
  const subscriptionId = url.searchParams.get('subscriptionId');

  if (!subscriptionId) {
    return new Response(
      JSON.stringify({ error: 'subscriptionId required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const { data: subscription, error } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error || !subscription) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: corsHeaders }
      );
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
              .update({ status: mappedStatus })
              .eq('id', subscriptionId);

            subscription.status = mappedStatus;
          }
        }
      } catch (ezeeError) {
        console.error('eZee status check error:', ezeeError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, subscription }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Get status error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get subscription status' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleCancel(req: Request) {
  try {
    const body = await req.json();
    const { subscriptionId, userId } = body;

    if (!subscriptionId || !userId) {
      return new Response(
        JSON.stringify({ error: 'subscriptionId and userId required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: subscription, error } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', userId)
      .single();

    if (error || !subscription) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found or unauthorized' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (subscription.ezee_subscription_id) {
      try {
        await fetch(`${EZEE_API_URL}/v1/subscription/cancel/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Licence': EZEE_LICENCE_KEY,
          },
          body: JSON.stringify({
            subscription_id: subscription.ezee_subscription_id,
          }),
        });
      } catch (ezeeError) {
        console.error('eZee cancel error:', ezeeError);
      }
    }

    await supabase
      .from('payment_subscriptions')
      .update({
        status: 'cancelled',
        end_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', subscriptionId);

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

    return new Response(
      JSON.stringify({ success: true, message: 'Subscription cancelled' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to cancel subscription' }),
      { status: 500, headers: corsHeaders }
    );
  }
}