/**
 * Vercel API Route: /api/ezee/process-payment.ts
 * Process a completed payment transaction
 * Used by auto-checker to process payments that were verified as completed
 * This endpoint uses the shared payment processor
 */

import { createClient } from '@supabase/supabase-js';
import { processOneTimePayment, processSubscriptionPayment } from './lib/processPayment';

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
    const { transaction_id, transaction_number, subscription_id } = req.body;

    if (!transaction_id && !subscription_id) {
      return res.status(400).json({ error: 'transaction_id or subscription_id is required' });
    }

    if (!transaction_number) {
      return res.status(400).json({ error: 'transaction_number is required' });
    }

    const logPrefix = '[PROCESS-PAYMENT]';

    // Process one-time payment
    if (transaction_id) {
      console.log(`${logPrefix} Processing one-time payment for transaction: ${transaction_id}`);

      // Get transaction from database
      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions')
        .select('*, metadata')
        .eq('id', transaction_id)
        .single();

      if (transactionError || !transaction) {
        console.error(`${logPrefix} Transaction not found:`, transactionError);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Check if already processed
      if (transaction.status === 'completed') {
        console.log(`${logPrefix} Transaction already completed, skipping`);
        return res.status(200).json({
          success: true,
          message: 'Transaction already processed',
        });
      }

      // Process the payment
      await processOneTimePayment(transaction, transaction_number, logPrefix);

      return res.status(200).json({
        success: true,
        message: 'Payment processed successfully',
        transaction_id: transaction.id,
      });
    }

    // Process subscription payment
    if (subscription_id) {
      console.log(`${logPrefix} Processing subscription payment for subscription: ${subscription_id}`);

      // Get subscription from database
      const { data: subscription, error: subscriptionError } = await supabase
        .from('payment_subscriptions')
        .select('*')
        .eq('id', subscription_id)
        .single();

      if (subscriptionError || !subscription) {
        console.error(`${logPrefix} Subscription not found:`, subscriptionError);
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Process the subscription payment
      await processSubscriptionPayment(subscription, transaction_number, logPrefix);

      return res.status(200).json({
        success: true,
        message: 'Subscription payment processed successfully',
        subscription_id: subscription.id,
      });
    }

    return res.status(400).json({ error: 'Invalid request' });

  } catch (error: any) {
    console.error('[PROCESS-PAYMENT] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
