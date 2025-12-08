/**
 * Supabase Edge Function: Check Pending Payments
 * 
 * Automatically checks pending payment transactions and verifies their status
 * with eZeePayments. If a payment was actually completed, processes it.
 * 
 * This function should be called hourly via Supabase cron job.
 * 
 * Usage:
 * POST /check-pending-payments
 * Headers: Authorization: Bearer [SERVICE_ROLE_KEY]
 * 
 * Returns:
 * {
 *   checked: number,
 *   processed: number,
 *   failed: number,
 *   errors: string[]
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logPrefix = '[CHECK-PENDING]';

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://vibe.volunteersinc.org';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log(`${logPrefix} Starting pending payment check...`);

    // Find all pending transactions older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: pendingTransactions, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('*, metadata')
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo)
      .order('created_at', { ascending: true })
      .limit(100); // Process up to 100 transactions per run

    if (fetchError) {
      throw new Error(`Failed to fetch pending transactions: ${fetchError.message}`);
    }

    if (!pendingTransactions || pendingTransactions.length === 0) {
      console.log(`${logPrefix} No pending transactions found`);
      return new Response(
        JSON.stringify({
          checked: 0,
          processed: 0,
          failed: 0,
          errors: [],
          message: 'No pending transactions to check',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`${logPrefix} Found ${pendingTransactions.length} pending transactions to check`);

    let checkedCount = 0;
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Check each transaction
    for (const transaction of pendingTransactions) {
      try {
        checkedCount++;
        console.log(`${logPrefix} Checking transaction ${transaction.id} (order_id: ${transaction.order_id})`);

        // Call check-payment-status API
        const statusCheckUrl = `${appUrl}/api/ezee/check-payment-status?order_id=${encodeURIComponent(transaction.order_id)}`;
        
        const statusResponse = await fetch(statusCheckUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          const errorMsg = `Status check failed for transaction ${transaction.id}: ${statusResponse.status} ${errorText}`;
          console.error(`${logPrefix} ${errorMsg}`);
          errors.push(errorMsg);
          failedCount++;
          continue;
        }

        const statusData = await statusResponse.json();

        if (!statusData.success || statusData.status !== 'completed') {
          console.log(`${logPrefix} Transaction ${transaction.id} is still pending or failed`);
          // Log to payment_webhooks for audit trail (silent logging)
          await supabase.from('payment_webhooks').insert({
            event_type: 'auto_check',
            transaction_number: statusData.transactionNumber || null,
            payload: {
              transaction_id: transaction.id,
              order_id: transaction.order_id,
              status: statusData.status,
              message: statusData.message,
            },
            processed: false,
            error_message: statusData.status === 'pending' ? 'Payment still pending' : 'Payment failed',
          }).catch((err) => {
            console.error(`${logPrefix} Failed to log webhook:`, err);
          });
          continue;
        }

        // Payment was completed! Process it
        console.log(`${logPrefix} Transaction ${transaction.id} was completed! Processing...`);

        const transactionNumber = statusData.transactionNumber || transaction.transaction_number;

        if (!transactionNumber) {
          const errorMsg = `No transaction number found for completed payment ${transaction.id}`;
          console.error(`${logPrefix} ${errorMsg}`);
          errors.push(errorMsg);
          failedCount++;
          continue;
        }

        // Call process-payment API to handle all downstream updates
        const processUrl = `${appUrl}/api/ezee/process-payment`;
        
        const processResponse = await fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction_id: transaction.id,
            transaction_number: transactionNumber,
          }),
        });

        if (!processResponse.ok) {
          const errorText = await processResponse.text();
          const errorMsg = `Payment processing failed for transaction ${transaction.id}: ${processResponse.status} ${errorText}`;
          console.error(`${logPrefix} ${errorMsg}`);
          errors.push(errorMsg);
          failedCount++;
          
          // Log to payment_webhooks
          await supabase.from('payment_webhooks').insert({
            event_type: 'auto_check',
            transaction_number: transactionNumber,
            payload: {
              transaction_id: transaction.id,
              order_id: transaction.order_id,
              status: 'completed',
            },
            processed: false,
            error_message: errorMsg,
          }).catch((err) => {
            console.error(`${logPrefix} Failed to log webhook:`, err);
          });
          continue;
        }

        const processData = await processResponse.json();

        if (processData.success) {
          console.log(`${logPrefix} Successfully processed transaction ${transaction.id}`);
          processedCount++;
          
          // Log to payment_webhooks (silent logging)
          await supabase.from('payment_webhooks').insert({
            event_type: 'auto_check',
            transaction_number: transactionNumber,
            payload: {
              transaction_id: transaction.id,
              order_id: transaction.order_id,
              status: 'completed',
              auto_processed: true,
            },
            processed: true,
            processed_at: new Date().toISOString(),
          }).catch((err) => {
            console.error(`${logPrefix} Failed to log webhook:`, err);
          });
        } else {
          const errorMsg = `Payment processing returned failure for transaction ${transaction.id}`;
          console.error(`${logPrefix} ${errorMsg}`);
          errors.push(errorMsg);
          failedCount++;
        }

      } catch (error: any) {
        const errorMsg = `Error processing transaction ${transaction.id}: ${error.message || 'Unknown error'}`;
        console.error(`${logPrefix} ${errorMsg}`, error);
        errors.push(errorMsg);
        failedCount++;
        
        // Continue processing other transactions
      }
    }

    const duration = Date.now() - startTime;
    console.log(`${logPrefix} Completed in ${duration}ms. Checked: ${checkedCount}, Processed: ${processedCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        checked: checkedCount,
        processed: processedCount,
        failed: failedCount,
        errors: errors.slice(0, 10), // Limit errors to first 10
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error(`${logPrefix} Fatal error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        checked: 0,
        processed: 0,
        failed: 0,
        errors: [error.message || 'Unknown error'],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
