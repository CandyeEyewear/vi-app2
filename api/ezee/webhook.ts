/**
 * Vercel API Route: /api/ezee/webhook.ts
 * Handles payment confirmations from eZeePayments
 * WITH CORS SUPPORT
 * Uses official eZeePayments webhook format
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
    const body = req.body;
    const headers = typeof req.headers === 'object' ? req.headers : {};

    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // eZeePayments webhook format
    const {
      ResponseCode,           // 1 = success, other = failure
      ResponseDescription,    // "Transaction is approved" or error message
      TransactionNumber,      // Reference for reconciliation
      CustomOrderId,          // The uniqueOrderId we sent to eZeePayments
      order_id,              // May also be present, but CustomOrderId is primary
      amount,
      subscription_id,        // For recurring payments
    } = body;

    // Get order ID from webhook - eZeePayments sends it as CustomOrderId
    const customOrderId = CustomOrderId || order_id;

    // Log webhook to database
    const { data: webhookRecord, error: logError } = await supabase
      .from('payment_webhooks')
      .insert({
      event_type: subscription_id ? 'subscription_payment' : 'one_time_payment',
        transaction_number: TransactionNumber || null,
      payload: body,
      headers,
      processed: false,
      })
      .select()
      .single();

    if (logError) {
      console.error('Webhook log error:', logError);
    }

    // ResponseCode: 1 = success, other = failure
    const isSuccessful = ResponseCode === 1 || ResponseCode === '1';

    // Handle one-time payment
    if (customOrderId && TransactionNumber) {
      // Find transaction by order_id (which is the uniqueOrderId we sent to eZeePayments)
      const { data: transaction, error: updateError } = await supabase
    .from('payment_transactions')
    .update({
      status: isSuccessful ? 'completed' : 'failed',
          transaction_number: TransactionNumber,
          response_code: ResponseCode?.toString() || null,
          response_description: ResponseDescription || null,
          updated_at: new Date().toISOString(),
          completed_at: isSuccessful ? new Date().toISOString() : null,
    })
        .eq('order_id', customOrderId)  // Match by CustomOrderId (uniqueOrderId)
    .select('*, metadata')
    .single();

      if (updateError) {
        console.error('Transaction update error:', updateError);
        console.error('Looking for order_id:', customOrderId);
        console.error('Webhook body:', JSON.stringify(body, null, 2));
  }

      if (transaction && isSuccessful) {
    await handleSuccessfulPayment(transaction);
  }
}

    // Handle subscription payment
    if (subscription_id) {
      const { data: subscription, error: subUpdateError } = await supabase
    .from('payment_subscriptions')
        .update({
          status: isSuccessful ? 'active' : 'failed',
          transaction_number: TransactionNumber || null,
          last_billing_date: isSuccessful ? new Date().toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq('ezee_subscription_id', subscription_id)
    .select()
    .single();

      if (subUpdateError) {
        console.error('Subscription update error:', subUpdateError);
  }

      if (subscription && isSuccessful) {
        // Calculate next billing date
  const nextBillingDate = calculateNextBillingDate(subscription.frequency);
  await supabase
    .from('payment_subscriptions')
          .update({ next_billing_date: nextBillingDate })
    .eq('id', subscription.id);

        await handleSuccessfulSubscriptionPayment(subscription);
      }
    }

    // Update webhook as processed
    if (webhookRecord?.id) {
      await supabase
        .from('payment_webhooks')
        .update({ 
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecord.id);
    } else if (TransactionNumber) {
      // Fallback: update by transaction_number if ID not available
      await supabase
        .from('payment_webhooks')
        .update({ 
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('transaction_number', TransactionNumber);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
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
    case 'organization_membership':  // NEW: Handle organization memberships
      // Update payment_subscriptions status if linked via metadata
      if (transaction.metadata?.payment_subscriptions_id) {
        await supabase
          .from('payment_subscriptions')
          .update({ 
            status: 'active',
            transaction_number: transaction.transaction_number,
            last_billing_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.metadata.payment_subscriptions_id);
      }
      
      // Update user membership status
      if (transaction.user_id) {
        // Check if this is an organization account
        const { data: userData } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', transaction.user_id)
          .single();
        
        if (userData?.account_type === 'organization') {
          // For organizations: set is_partner_organization = true
          await supabase
            .from('users')
            .update({ 
              membership_status: 'active',
              membership_tier: 'premium',
              is_partner_organization: true,  // Golden badge!
            })
            .eq('id', transaction.user_id);
        } else {
          // For individuals: set is_premium = true
          await supabase
            .from('users')
            .update({ 
              membership_status: 'active',
              membership_tier: 'premium',
              is_premium: true 
            })
            .eq('id', transaction.user_id);
        }
      }
      break;

    case 'recurring_donation':
      // Update payment_subscriptions status if linked via metadata
      let causeId: string | null = null;
      
      if (transaction.metadata?.payment_subscriptions_id) {
        // Update subscription status
        await supabase
          .from('payment_subscriptions')
          .update({ 
            status: 'active',
            transaction_number: transaction.transaction_number,
            last_billing_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.metadata.payment_subscriptions_id);

        // Get the payment_subscriptions record to find the donation/cause
        const { data: paymentSub } = await supabase
          .from('payment_subscriptions')
          .select('reference_id')
          .eq('id', transaction.metadata.payment_subscriptions_id)
          .single();

        if (paymentSub?.reference_id) {
          // Look up the donation to get cause_id
          const { data: donation } = await supabase
            .from('donations')
            .select('cause_id')
            .eq('id', paymentSub.reference_id)
            .single();

          if (donation?.cause_id) {
            causeId = donation.cause_id;
          }
        }
      }

      // Fallback: try to get cause_id from metadata or reference_id directly
      if (!causeId) {
        causeId = transaction.metadata?.reference_id || transaction.reference_id;
      }
      
      if (causeId) {
        // Create a donation record for this recurring payment
        await supabase.from('donations').insert({
          cause_id: causeId,
          user_id: transaction.user_id,
          amount: transaction.amount,
          currency: 'JMD',
          payment_status: 'completed',
          transaction_number: transaction.transaction_number,
          completed_at: new Date().toISOString(),
        });

        // Increment cause amount raised
        await supabase.rpc('increment_cause_amount', {
          p_cause_id: causeId,
          p_amount: transaction.amount,
        });
      }
      break;
  }

  console.log(`Successfully processed ${order_type} payment for ${reference_id}`);
}

async function handleSuccessfulSubscriptionPayment(subscription: any) {
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
    case 'organization_membership':  // NEW: Handle organization memberships
      // Check if this is an organization account
      const { data: userData } = await supabase
        .from('users')
        .select('account_type')
        .eq('id', user_id)
        .single();
      
      if (userData?.account_type === 'organization') {
        // For organizations: set is_partner_organization = true
        await supabase
          .from('users')
          .update({ 
            membership_status: 'active',
            membership_tier: 'premium',
            is_partner_organization: true,  // Golden badge!
          })
          .eq('id', user_id);
      } else {
        // For individuals: set is_premium = true
        await supabase
          .from('users')
          .update({ 
            membership_status: 'active',
            membership_tier: 'premium',
            is_premium: true 
          })
          .eq('id', user_id);
      }
      break;
  }

  console.log(`Successfully processed ${subscription_type} subscription payment`);
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
