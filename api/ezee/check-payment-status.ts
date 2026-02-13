/**
 * Vercel API Route: /api/ezee/check-payment-status.ts
 * Check payment status with eZeePayments API
 * Used by auto-checker to verify if pending transactions were actually paid
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

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!EZEE_API_URL || !EZEE_LICENCE_KEY || !EZEE_SITE) {
      console.error('[CHECK-STATUS] CRITICAL: Missing eZeePayments environment variables:', {
        EZEE_API_URL: !!EZEE_API_URL,
        EZEE_LICENCE_KEY: !!EZEE_LICENCE_KEY,
        EZEE_SITE: !!EZEE_SITE,
      });
      return res.status(500).json({ error: 'Payment service not configured' });
    }

    const { order_id } = req.method === 'GET' ? req.query : req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    console.log(`[CHECK-STATUS] Checking payment status for order_id: ${order_id}`);

    // First, try to get transaction from database to get transaction_number if available
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('transaction_number, order_id')
      .eq('order_id', order_id)
      .maybeSingle();

    // If we have a transaction_number, use it to check status
    // Otherwise, we'll need to query by order_id
    let statusResult;

    if (transaction?.transaction_number) {
      // Check by transaction number (more reliable)
      console.log(`[CHECK-STATUS] Found transaction_number: ${transaction.transaction_number}`);
      statusResult = await checkStatusByTransactionNumber(transaction.transaction_number);
    } else {
      // Check by order_id (may need to query transaction history)
      console.log(`[CHECK-STATUS] No transaction_number found, checking by order_id`);
      statusResult = await checkStatusByOrderId(order_id);
    }

    if (!statusResult) {
      return res.status(200).json({
        success: false,
        status: 'pending',
        message: 'Could not determine payment status from eZeePayments',
      });
    }

    return res.status(200).json({
      success: statusResult.success,
      status: statusResult.status,
      transactionNumber: statusResult.transactionNumber,
      message: statusResult.message,
    });

  } catch (error: any) {
    console.error('[CHECK-STATUS] Error:', error);
    return res.status(500).json({
      success: false,
      status: 'pending',
      error: error.message || 'Internal server error',
    });
  }
}

/**
 * Check payment status by transaction number
 * This is the most reliable method
 */
async function checkStatusByTransactionNumber(transactionNumber: string): Promise<{
  success: boolean;
  status: 'completed' | 'pending' | 'failed';
  transactionNumber?: string;
  message?: string;
} | null> {
  try {
    // eZeePayments API endpoint for transaction status
    // Note: This endpoint may vary - adjust based on actual eZeePayments API docs
    const response = await fetch(
      `${EZEE_API_URL}/v1.1/transaction/status/${transactionNumber}/`,
      {
        method: 'GET',
        headers: {
          'Licence': EZEE_LICENCE_KEY,
          'site': EZEE_SITE,
        },
      }
    );

    if (!response.ok) {
      console.warn(`[CHECK-STATUS] eZeePayments API returned ${response.status}`);
      // Try alternative endpoint or method
      return await checkStatusByOrderIdFallback(transactionNumber);
    }

    const data = await response.json().catch(() => ({}));

    // Parse response - adjust based on actual eZeePayments response format
    // Typical response might be: { status: 1, transaction_number: "...", ... }
    const responseCode = data.ResponseCode || data.status || data.result?.status;
    const isSuccess = responseCode === 1 || responseCode === '1' || responseCode === 'SUCCESS';

    return {
      success: isSuccess,
      status: isSuccess ? 'completed' : (data.status === 'PENDING' ? 'pending' : 'failed'),
      transactionNumber: data.TransactionNumber || data.transaction_number || transactionNumber,
      message: data.ResponseDescription || data.message || (isSuccess ? 'Transaction completed' : 'Transaction pending or failed'),
    };

  } catch (error) {
    console.error('[CHECK-STATUS] Error checking by transaction number:', error);
    return null;
  }
}

/**
 * Check payment status by order_id
 * May need to query transaction history
 */
async function checkStatusByOrderId(orderId: string): Promise<{
  success: boolean;
  status: 'completed' | 'pending' | 'failed';
  transactionNumber?: string;
  message?: string;
} | null> {
  try {
    // Try to query transaction history by order_id
    // This endpoint may need to be adjusted based on eZeePayments API
    const response = await fetch(
      `${EZEE_API_URL}/v1.1/transaction/history/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Licence': EZEE_LICENCE_KEY,
          'site': EZEE_SITE,
        },
        body: JSON.stringify({
          order_id: orderId,
        }),
      }
    );

    if (!response.ok) {
      console.warn(`[CHECK-STATUS] Transaction history API returned ${response.status}`);
      // If history endpoint doesn't work, we can't determine status
      return {
        success: false,
        status: 'pending',
        message: 'Could not query transaction status',
      };
    }

    const data = await response.json().catch(() => ({}));

    // Find transaction matching our order_id
    const transactions = data.transactions || data.result?.transactions || data.data || [];
    const matchingTransaction = Array.isArray(transactions)
      ? transactions.find((t: any) => t.order_id === orderId || t.CustomOrderId === orderId)
      : null;

    if (!matchingTransaction) {
      return {
        success: false,
        status: 'pending',
        message: 'Transaction not found in eZeePayments',
      };
    }

    const responseCode = matchingTransaction.ResponseCode || matchingTransaction.status;
    const isSuccess = responseCode === 1 || responseCode === '1' || responseCode === 'SUCCESS';

    return {
      success: isSuccess,
      status: isSuccess ? 'completed' : 'pending',
      transactionNumber: matchingTransaction.TransactionNumber || matchingTransaction.transaction_number,
      message: matchingTransaction.ResponseDescription || (isSuccess ? 'Transaction completed' : 'Transaction pending'),
    };

  } catch (error) {
    console.error('[CHECK-STATUS] Error checking by order_id:', error);
    return null;
  }
}

/**
 * Fallback method if transaction number endpoint doesn't work
 * Try querying by order_id from database
 */
async function checkStatusByOrderIdFallback(transactionNumber: string): Promise<{
  success: boolean;
  status: 'completed' | 'pending' | 'failed';
  transactionNumber?: string;
  message?: string;
} | null> {
  // Get order_id from database using transaction_number
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('order_id')
    .eq('transaction_number', transactionNumber)
    .maybeSingle();

  if (transaction?.order_id) {
    return await checkStatusByOrderId(transaction.order_id);
  }

  return {
    success: false,
    status: 'pending',
    message: 'Could not determine payment status',
  };
}
