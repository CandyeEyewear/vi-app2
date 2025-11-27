/**
 * Vercel API Route: /api/ezee/webhook.ts
 * Handles payment confirmations from eZeePayments
 * WITH CORS SUPPORT
 */

import { createClient } from '@supabase/supabase-js';

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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('Failed to parse webhook body:', jsonError);
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const headers = Object.fromEntries(req.headers.entries());

    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const {
      transaction_number,
      order_id,
      status,
      response_code,
      response_description,
      amount,
      subscription_id,
    } = body;

    // Log webhook to database
    const { data: webhookRecord } = await supabase.from('payment_webhooks').insert({
      event_type: subscription_id ? 'subscription_payment' : 'one_time_payment',
      transaction_number,
      payload: body,
      headers,
      processed: false,
    }).select().single();

    const isSuccessful = status === 'APPROVED' || response_code === '00' || response_code === '000';

    if (subscription_id) {
      await handleSubscriptionPayment(order_id, transaction_number, isSuccessful, body);
    } else {
      await handleOneTimePayment(order_id, transaction_number, isSuccessful, body);
    }

    // Update webhook as processed
    if (webhookRecord?.id) {
      await supabase
        .from('payment_webhooks')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', webhookRecord.id);
    } else if (transaction_number) {
      // Fallback: update by transaction_number if ID not available
      await supabase
        .from('payment_webhooks')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('transaction_number', transaction_number);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleOneTimePayment(
  orderId: string,
  transactionNumber: string,
  isSuccessful: boolean,
  webhookData: any
) {
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .update({
      status: isSuccessful ? 'completed' : 'failed',
      transaction_number: transactionNumber,
      response_code: webhookData.response_code,
      response_description: webhookData.response_description,
    })
    .eq('order_id', orderId)
    .select()
    .single();

  if (!transaction) {
    console.error('Transaction not found for order:', orderId);
    return;
  }

  if (isSuccessful) {
    await handleSuccessfulPayment(transaction);
  }
}

async function handleSubscriptionPayment(
  orderId: string,
  transactionNumber: string,
  isSuccessful: boolean,
  webhookData: any
) {
  const { data: subscription } = await supabase
    .from('payment_subscriptions')
    .select()
    .eq('ezee_subscription_id', webhookData.subscription_id)
    .single();

  if (!subscription) {
    console.error('Subscription not found:', webhookData.subscription_id);
    return;
  }

  const nextBillingDate = calculateNextBillingDate(subscription.frequency);

  await supabase
    .from('payment_subscriptions')
    .update({
      status: isSuccessful ? 'active' : 'failed',
      transaction_number: transactionNumber,
      last_billing_date: new Date().toISOString().split('T')[0],
      next_billing_date: nextBillingDate,
    })
    .eq('id', subscription.id);

  if (isSuccessful) {
    await handleSuccessfulSubscriptionPayment(subscription, webhookData);
  }
}

async function handleSuccessfulPayment(transaction: any) {
  const { order_type, reference_id, amount } = transaction;

  switch (order_type) {
    case 'donation':
      await supabase
        .from('donations')
        .update({ payment_status: 'completed' })
        .eq('id', reference_id);

      const { data: donation } = await supabase
        .from('donations')
        .select('cause_id')
        .eq('id', reference_id)
        .single();

      if (donation?.cause_id) {
        await supabase.rpc('increment_cause_amount', {
          p_cause_id: donation.cause_id,
          p_amount: amount,
        });
      }
      break;

    case 'event_registration':
      await supabase
        .from('event_registrations')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', reference_id);
      break;

    case 'membership':
      const { data: paymentSub } = await supabase
        .from('payment_subscriptions')
        .select('user_id')
        .eq('reference_id', reference_id)
        .single();

      if (paymentSub?.user_id) {
        await supabase
          .from('users')
          .update({ membership_status: 'active', is_premium: true })
          .eq('id', paymentSub.user_id);
      }
      break;
  }

  console.log(`Successfully processed ${order_type} payment for ${reference_id}`);
}

async function handleSuccessfulSubscriptionPayment(subscription: any, webhookData: any) {
  const { subscription_type, reference_id, user_id, amount } = subscription;

  switch (subscription_type) {
    case 'recurring_donation':
      await supabase
        .from('recurring_donations')
        .update({ status: 'active' })
        .eq('id', reference_id);

      const { data: recurringDonation } = await supabase
        .from('recurring_donations')
        .select('cause_id, is_anonymous')
        .eq('id', reference_id)
        .single();

      if (recurringDonation) {
        await supabase.from('donations').insert({
          cause_id: recurringDonation.cause_id,
          user_id,
          amount,
          currency: 'JMD',
          is_anonymous: recurringDonation.is_anonymous,
          payment_status: 'completed',
          recurring_donation_id: reference_id,
        });

        await supabase.rpc('increment_cause_amount', {
          p_cause_id: recurringDonation.cause_id,
          p_amount: amount,
        });
      }
      break;

    case 'membership':
      await supabase
        .from('users')
        .update({ membership_status: 'active', is_premium: true })
        .eq('id', user_id);
      break;
  }

  console.log(`Successfully processed ${subscription_type} subscription payment`);
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