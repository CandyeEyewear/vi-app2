/**
* Vercel API Route: /api/ezee/create-token.ts
* Creates a payment token for one-time payments
* WITH CORS SUPPORT
 * Uses official eZeePayments API format with form data
 * 
 * DEBUGGING VERSION - Added detailed logging
*/

import { createClient } from '@supabase/supabase-js';

const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY!;
const EZEE_SITE = process.env.EZEE_SITE || 'https://test.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibe.volunteersinc.org';

const supabase = createClient(
 process.env.SUPABASE_URL!,
 process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to validate UUID
const isValidUUID = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

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

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

 if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
   const {
     amount,
     orderId,
     orderType,
     referenceId,
     userId,
     customerEmail,
     customerName,
     description,
     platform,  // 'web' or 'app'
     returnPath,  // Path to redirect to after successful payment
    } = req.body;

   // ========== DEBUG LOGGING START ==========
   console.log('='.repeat(60));
   console.log('CREATE TOKEN REQUEST STARTED');
   console.log('='.repeat(60));
   console.log('Environment Variables:');
   console.log('  EZEE_API_URL:', EZEE_API_URL);
   console.log('  EZEE_SITE:', EZEE_SITE);
   console.log('  EZEE_LICENCE_KEY:', EZEE_LICENCE_KEY ? `${EZEE_LICENCE_KEY.substring(0, 8)}...` : 'NOT SET');
   console.log('  APP_URL:', APP_URL);
   console.log('Request Body:', JSON.stringify(req.body, null, 2));
   // ========== DEBUG LOGGING END ==========

   // Validate required fields
   if (!amount || !orderId || !orderType || !customerEmail) {
      console.log('VALIDATION FAILED: Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: amount, orderId, orderType, customerEmail' 
      });
   }

    // Generate short unique order ID (max 50 chars for eZeePayments)
    // Format: ORD_timestamp_random (e.g., "ORD_1764299044_x7k9m2" ~28 chars)
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const uniqueOrderId = `ORD_${timestamp}_${randomStr}`;

   // Determine redirect URLs based on platform
   const isApp = platform === 'app';
   const postBackUrl = `${APP_URL}/api/ezee/webhook`;
   
   // Build return URL with returnPath if provided
   const returnParams = new URLSearchParams({ orderId: uniqueOrderId });
   if (returnPath) {
     returnParams.append('returnPath', returnPath);
   }
   const returnUrl = isApp 
     ? `vibe://payment/success?${returnParams.toString()}`
     : `${APP_URL}/payment/success?${returnParams.toString()}`;
   const cancelUrl = isApp 
     ? `vibe://payment/cancel?orderId=${uniqueOrderId}`
     : `${APP_URL}/payment/cancel?orderId=${uniqueOrderId}`;

    // Create form data (NOT JSON) - eZeePayments requires form data
    const formData = new URLSearchParams();
    formData.append('amount', amount.toString());
    formData.append('currency', 'JMD');
    formData.append('order_id', uniqueOrderId);
    formData.append('post_back_url', postBackUrl);
    formData.append('return_url', returnUrl);
    formData.append('cancel_url', cancelUrl);

   // ========== DEBUG LOGGING START ==========
   console.log('-'.repeat(60));
   console.log('CALLING EZEEPAYMENTS API');
   console.log('-'.repeat(60));
   console.log('URL:', `${EZEE_API_URL}/v1/custom_token/`);
   console.log('Headers:');
   console.log('  Content-Type: application/x-www-form-urlencoded');
   console.log('  licence_key:', EZEE_LICENCE_KEY ? `${EZEE_LICENCE_KEY.substring(0, 8)}...` : 'NOT SET');
   console.log('  site:', EZEE_SITE);
   console.log('Form Data:', formData.toString());
   console.log('Form Data (decoded):');
   for (const [key, value] of formData.entries()) {
     console.log(`  ${key}: ${value}`);
   }
   // ========== DEBUG LOGGING END ==========

   // Create token with eZeePayments
    // licence_key and site MUST be in headers, not body
   const tokenResponse = await fetch(`${EZEE_API_URL}/v1/custom_token/`, {
     method: 'POST',
     headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: formData.toString(),
    });

    // ========== DEBUG LOGGING START ==========
    console.log('-'.repeat(60));
    console.log('EZEEPAYMENTS RESPONSE');
    console.log('-'.repeat(60));
    console.log('HTTP Status:', tokenResponse.status);
    console.log('HTTP Status Text:', tokenResponse.statusText);
    // ========== DEBUG LOGGING END ==========

    // Get raw response text first
    const responseText = await tokenResponse.text();
    console.log('Raw Response Body:', responseText);

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
      console.log('Parsed Response:', JSON.stringify(tokenData, null, 2));
    } catch (jsonError) {
      console.error('FAILED TO PARSE JSON:', jsonError);
      console.error('Raw text was:', responseText);
      return res.status(500).json({ 
        error: 'Invalid response from payment provider',
        rawResponse: responseText 
      });
    }

    // ========== DEBUG LOGGING START ==========
    console.log('-'.repeat(60));
    console.log('RESPONSE ANALYSIS');
    console.log('-'.repeat(60));
    console.log('Has result?', !!tokenData.result);
    console.log('result.status:', tokenData.result?.status);
    console.log('result.token:', tokenData.result?.token);
    console.log('result.message:', tokenData.result?.message);
    // ========== DEBUG LOGGING END ==========

    // Check response - note the "result" wrapper
    if (!tokenData.result || tokenData.result.status !== 1) {
     console.error('TOKEN CREATION FAILED!');
     console.error('Full response:', JSON.stringify(tokenData, null, 2));
      return res.status(500).json({ 
        error: tokenData.result?.message || 'Failed to create payment token',
        details: tokenData 
      });
    }

    // Token is inside result object
    const token = tokenData.result.token;
    console.log('TOKEN CREATED SUCCESSFULLY:', token);

   // Store transaction in database
    // Use uniqueOrderId as order_id (this is what eZeePayments will send back as CustomOrderId)
    // Only use reference_id if it's a valid UUID (database column is UUID type)
   const { data: transaction, error: dbError } = await supabase
     .from('payment_transactions')
     .insert({
       user_id: userId || null,
        order_id: uniqueOrderId,  // Store the ID we sent to eZeePayments
       order_type: orderType,
        reference_id: (referenceId && isValidUUID(referenceId)) ? referenceId : null,  // Only use if valid UUID
       amount,
       currency: 'JMD',
       description: description || `Payment for ${orderType}`,
        ezee_token: token,
       status: 'pending',
       customer_email: customerEmail,
       customer_name: customerName,
        metadata: { 
          original_order_id: orderId,  // Always store original orderId here
        },
     })
     .select()
     .single();

   if (dbError) {
     console.error('Database error:', dbError);
      // Continue even if DB insert fails - we still return the token
   } else {
     console.log('Transaction saved to DB:', transaction?.id);
   }

    // Build the redirect URL to our payment form page
    // This page will auto-submit a POST form to eZeePayments
    const paymentRedirectUrl = `${APP_URL}/api/ezee/pay?` + new URLSearchParams({
      token: token,
      amount: amount.toString(),
      currency: 'JMD',
      order_id: uniqueOrderId,
      email: customerEmail,
      name: customerName || '',
      description: description || `Payment for ${orderType}`,
    }).toString();

    console.log('='.repeat(60));
    console.log('CREATE TOKEN COMPLETED SUCCESSFULLY');
    console.log('Payment URL:', paymentRedirectUrl);
    console.log('='.repeat(60));

    return res.status(200).json({
       success: true,
      token: token,
       transactionId: transaction?.id,
      paymentUrl: paymentRedirectUrl,  // This URL will auto-POST to eZeePayments
       paymentData: {
        token: token,
        amount: amount,
        currency: 'JMD',
        order_id: uniqueOrderId,
        email_address: customerEmail,
        customer_name: customerName || 'Customer',
        description: description || `Payment for ${orderType}`,
      },
    });
  } catch (error: any) {
   console.error('='.repeat(60));
   console.error('CREATE TOKEN FATAL ERROR');
   console.error('='.repeat(60));
   console.error('Error:', error);
   console.error('Stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error' });
 }
}