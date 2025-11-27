/**
 * eZeePayments - Webhook Handler
 * Vercel Serverless Function
 * File: api/ezee/webhook.ts
 * 
 * Handles payment confirmations from eZeePayments
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface EzeeWebhookPayload {
  ResponseCode: string;
  ResponseDescription: string;
  TransactionNumber: string;
  order_id?: string;
  amount?: string;
  currency?: string;
  subscription_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // eZeePayments sends POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload: EzeeWebhookPayload = req.body;
    
    console.log('eZeePayments webhook received:', JSON.stringify(payload, null, 2));

    // Log the webhook for debugging
    await supabase.from('payment_webhooks').insert({
      event_type: payload.ResponseCode === '1' ? 'payment_success' : 'payment_failed',
      transaction_number: payload.TransactionNumber,
      payload: payload,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      },
    });

    const isSuccess = payload.ResponseCode === '1';
    const transactionNumber = payload.TransactionNumber;
    const orderId = payload.order_id;

    if (!orderId) {
      console.error('Missing order_id in webhook payload');
      return res.status(400).json({ error: 'Missing order_id' });
    }

    // Determine if this is a subscription payment
    const isSubscription = orderId.startsWith('sub_') || payload.subscription_id;

    if (isSubscription && payload.subscription_id) {
      // Handle subscription payment
      await handleSubscriptionPayment(
        payload.subscription_id,
        transactionNumber,
        isSuccess,
        payload.ResponseDescription
      );
    } else {
      // Handle one-time payment
      await handleOneTimePayment(
        orderId,
        transactionNumber,
        isSuccess,
        payload.ResponseDescription
      );
    }

    // Mark webhook as processed
    await supabase
      .from('payment_webhooks')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('transaction_number', transactionNumber);

    // Respond to eZeePayments
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    
    // Log the error
    await supabase.from('payment_webhooks').insert({
      event_type: 'error',
      payload: req.body,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle one-time payment webhook
 */
async function handleOneTimePayment(
  orderId: string,
  transactionNumber: string,
  isSuccess: boolean,
  responseDescription: string
) {
  // Find the transaction by order_id
  const { data: transaction, error: findError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (findError || !transaction) {
    console.error('Transaction not found:', orderId);
    return;
  }

  // Update transaction status
  const updateData: any = {
    transaction_number: transactionNumber,
    response_code: isSuccess ? '1' : '0',
    response_description: responseDescription,
    status: isSuccess ? 'completed' : 'failed',
  };

  if (isSuccess) {
    updateData.completed_at = new Date().toISOString();
  }

  await supabase
    .from('payment_transactions')
    .update(updateData)
    .eq('id', transaction.id);

  // If successful, update the related record based on order_type
  if (isSuccess) {
    await handleSuccessfulPayment(transaction);
  }
}

/**
 * Handle subscription payment webhook
 */
async function handleSubscriptionPayment(
  ezeeSubscriptionId: string,
  transactionNumber: string,
  isSuccess: boolean,
  responseDescription: string
) {
  // Find the subscription
  const { data: subscription, error: findError } = await supabase
    .from('payment_subscriptions')
    .select('*')
    .eq('ezee_subscription_id', ezeeSubscriptionId)
    .single();

  if (findError || !subscription) {
    console.error('Subscription not found:', ezeeSubscriptionId);
    return;
  }

  if (isSuccess) {
    // Calculate next billing date
    const now = new Date();
    let nextBillingDate = new Date(now);
    switch (subscription.frequency) {
      case 'daily':
        nextBillingDate.setDate(nextBillingDate.getDate() + 1);
        break;
      case 'weekly':
        nextBillingDate.setDate(nextBillingDate.getDate() + 7);
        break;
      case 'monthly':
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
        break;
      case 'annually':
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        break;
    }

    // Update subscription
    await supabase
      .from('payment_subscriptions')
      .update({
        status: 'active',
        transaction_number: subscription.transaction_number || transactionNumber,
        last_billing_date: now.toISOString().split('T')[0],
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
      })
      .eq('id', subscription.id);

    // Handle the successful recurring payment
    await handleSuccessfulSubscriptionPayment(subscription);
  } else {
    // Update subscription status
    await supabase
      .from('payment_subscriptions')
      .update({
        status: 'failed',
        metadata: {
          ...subscription.metadata,
          last_error: responseDescription,
          last_error_date: new Date().toISOString(),
        },
      })
      .eq('id', subscription.id);
  }
}

/**
 * Handle successful one-time payment
 * Updates related records (donations, event registrations, etc.)
 */
async function handleSuccessfulPayment(transaction: any) {
  const { order_type, reference_id, amount, user_id } = transaction;

  switch (order_type) {
    case 'donation':
      if (reference_id) {
        // Update donation status
        await supabase
          .from('donations')
          .update({
            payment_status: 'completed',
          })
          .eq('id', reference_id);

        // Get the cause and update amount raised
        const { data: donation } = await supabase
          .from('donations')
          .select('cause_id')
          .eq('id', reference_id)
          .single();

        if (donation?.cause_id) {
          // Increment cause amount_raised
          await supabase.rpc('increment_cause_amount', {
            cause_id: donation.cause_id,
            amount: amount,
          });
        }
      }
      break;

    case 'event_registration':
      if (reference_id) {
        // Update event registration status
        await supabase
          .from('event_registrations')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
          })
          .eq('id', reference_id);
      }
      break;

    case 'membership':
      if (user_id) {
        // Update user membership
        // This would integrate with your membership/subscription system
        console.log('Membership payment successful for user:', user_id);
      }
      break;

    default:
      console.log('Unknown order type:', order_type);
  }
}

/**
 * Handle successful subscription payment
 * Updates related recurring records
 */
async function handleSuccessfulSubscriptionPayment(subscription: any) {
  const { subscription_type, reference_id, amount, user_id } = subscription;

  switch (subscription_type) {
    case 'recurring_donation':
      if (reference_id) {
        // Update recurring donation status
        await supabase
          .from('recurring_donations')
          .update({
            status: 'active',
          })
          .eq('id', reference_id);

        // Get the cause and create a new donation record
        const { data: recurringDonation } = await supabase
          .from('recurring_donations')
          .select('cause_id')
          .eq('id', reference_id)
          .single();

        if (recurringDonation?.cause_id) {
          // Create a donation record for this recurring payment
          await supabase.from('donations').insert({
            cause_id: recurringDonation.cause_id,
            user_id,
            amount,
            currency: 'JMD',
            payment_status: 'completed',
            is_recurring: true,
            recurring_donation_id: reference_id,
          });

          // Increment cause amount_raised
          await supabase.rpc('increment_cause_amount', {
            cause_id: recurringDonation.cause_id,
            amount: amount,
          });
        }
      }
      break;

    case 'membership':
      if (user_id) {
        // Handle membership subscription payment
        console.log('Membership subscription payment for user:', user_id);
      }
      break;

    default:
      console.log('Unknown subscription type:', subscription_type);
  }
}
