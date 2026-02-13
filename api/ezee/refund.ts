/**
 * Vercel API Route: /api/ezee/refund.ts
 * Processes refunds through eZeePayments
 * WITH CORS SUPPORT
 */

import { createClient } from '@supabase/supabase-js';

const EZEE_API_URL = process.env.EZEE_API_URL;
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY;
const EZEE_SITE = process.env.EZEE_SITE;

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
    const { transactionId, orderId, amount, reason } = req.body;

    if (!transactionId || !orderId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: transactionId, orderId, amount',
      });
    }

    // Create form data for eZeePayments refund API
    const formData = new URLSearchParams();
    formData.append('transaction_number', transactionId);
    formData.append('order_id', orderId);
    formData.append('amount', amount.toString());
    if (reason) {
      formData.append('reason', reason);
    }

    // Call eZeePayments refund API
    const refundResponse = await fetch(`${EZEE_API_URL}/v1.1/refund/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: formData.toString(),
    });

    let refundData;
    try {
      refundData = await refundResponse.json();
    } catch (jsonError) {
      console.error('Failed to parse eZeePayments refund response:', jsonError);
      const textResponse = await refundResponse.text();
      console.error('Response text:', textResponse);
      return res.status(500).json({ error: 'Invalid response from payment provider' });
    }

    // Check response
    if (!refundData.result || refundData.result.status !== 1) {
      console.error('eZeePayments refund error:', refundData);
      return res.status(500).json({
        error: refundData.result?.message || 'Failed to process refund',
        details: refundData,
      });
    }

    // Update transaction status in database
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_number', transactionId);

    if (updateError) {
      console.error('Database update error:', updateError);
      // Still return success since refund was processed
    }

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      refundId: refundData.result.refund_id,
    });
  } catch (error: any) {
    console.error('Refund error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

