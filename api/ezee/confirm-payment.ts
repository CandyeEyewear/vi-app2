/**
 * Vercel API Route: /api/ezee/confirm-payment.ts
 * Called by the payment success page to confirm and process a payment.
 *
 * Since eZeePayments never fires the post_back_url webhook, the only
 * reliable signal is the user being redirected to /payment/success.
 * This endpoint turns that redirect into a confirmed payment.
 */

import { createClient } from '@supabase/supabase-js';
import { processOneTimePayment } from './lib/processPayment';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const logPrefix = '[CONFIRM-PAYMENT]';

  try {
    const { order_id } = req.body;

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).json({ error: 'order_id is required' });
    }

    console.log(`${logPrefix} Confirming payment for order_id: ${order_id}`);

    // Find the transaction
    const { data: transaction, error: findError } = await supabase
      .from('payment_transactions')
      .select('*, metadata')
      .eq('order_id', order_id)
      .maybeSingle();

    if (findError) {
      console.error(`${logPrefix} DB error:`, findError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!transaction) {
      console.warn(`${logPrefix} Transaction not found for order_id: ${order_id}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Idempotent: already completed
    if (transaction.status === 'completed') {
      console.log(`${logPrefix} Transaction ${transaction.id} already completed`);
      return res.status(200).json({
        success: true,
        status: 'completed',
        message: 'Payment already confirmed',
        transaction_id: transaction.id,
      });
    }

    // Mark as completed
    const transactionNumber = `CONFIRM_${order_id}`;

    const { data: updated, error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'completed',
        transaction_number: transactionNumber,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        response_description: 'Confirmed via payment success redirect',
      })
      .eq('id', transaction.id)
      .select('*, metadata')
      .single();

    if (updateError) {
      console.error(`${logPrefix} Failed to update transaction:`, updateError);
      return res.status(500).json({ error: 'Failed to update transaction' });
    }

    console.log(`${logPrefix} Transaction ${transaction.id} marked as completed`);

    // Process the payment (create registration, tickets, etc.)
    try {
      await processOneTimePayment(updated, transactionNumber, logPrefix);
      console.log(`${logPrefix} Payment processing completed for ${transaction.id}`);
    } catch (processError: any) {
      console.error(`${logPrefix} Payment processing failed:`, processError);
      // Transaction is already marked completed — return success but note the error
      return res.status(200).json({
        success: true,
        status: 'completed',
        message: 'Payment confirmed but downstream processing had an error. Your registration will be created shortly.',
        transaction_id: transaction.id,
        processing_error: processError.message,
      });
    }

    // Log to payment_webhooks for audit trail
    try {
      await supabase.from('payment_webhooks').insert({
        event_type: 'success_page_confirm',
        transaction_number: transactionNumber,
        payload: {
          transaction_id: transaction.id,
          order_id,
          order_type: transaction.order_type,
          confirmed_via: 'payment_success_redirect',
        },
        processed: true,
        processed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`${logPrefix} Audit log error:`, err);
    }

    return res.status(200).json({
      success: true,
      status: 'completed',
      message: 'Payment confirmed and processed',
      transaction_id: transaction.id,
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
