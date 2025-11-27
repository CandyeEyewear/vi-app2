/**
 * Vercel API Route: /api/ezee/create-token.ts
 * Creates a payment token for one-time payments
 * WITH CORS SUPPORT
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
   const body = await req.json();
   const {
     amount,
     orderId,
     orderType,
     referenceId,
     userId,
     customerEmail,
     customerName,
     description,
   } = body;

   // Validate required fields
   if (!amount || !orderId || !orderType || !customerEmail) {
     return new Response(
       JSON.stringify({ error: 'Missing required fields: amount, orderId, orderType, customerEmail' }),
       { status: 400, headers: corsHeaders }
     );
   }

   // Generate unique order ID with timestamp
   const uniqueOrderId = `${orderType}_${orderId}_${Date.now()}`;

   // Callback URLs
   const postBackUrl = `${APP_URL}/api/ezee/webhook`;
   const returnUrl = `${APP_URL}/payment/success?orderId=${orderId}`;
   const cancelUrl = `${APP_URL}/payment/cancel?orderId=${orderId}`;

   // Create token with eZeePayments
   const tokenResponse = await fetch(`${EZEE_API_URL}/v1/custom_token/`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Licence': EZEE_LICENCE_KEY,
     },
     body: JSON.stringify({
       site: EZEE_SITE,
       order_id: uniqueOrderId,
       amount: amount.toFixed(2),
       currency: 'JMD',
       cardholder_email: customerEmail,
       cardholder_name: customerName || 'Customer',
       description: description || `Payment for ${orderType}`,
       postback_url: postBackUrl,
       return_url: returnUrl,
       cancel_url: cancelUrl,
     }),
   });

   let tokenData;
   try {
     tokenData = await tokenResponse.json();
   } catch (jsonError) {
     console.error('Failed to parse eZeePayments response:', jsonError);
     const textResponse = await tokenResponse.text();
     console.error('Response text:', textResponse);
     return new Response(
       JSON.stringify({ error: 'Invalid response from payment provider' }),
       { status: 500, headers: corsHeaders }
     );
   }

   if (!tokenResponse.ok || !tokenData.token) {
     console.error('eZeePayments token error:', tokenData);
     return new Response(
       JSON.stringify({ error: 'Failed to create payment token', details: tokenData }),
       { status: 500, headers: corsHeaders }
     );
   }

   // Store transaction in database
   const { data: transaction, error: dbError } = await supabase
     .from('payment_transactions')
     .insert({
       user_id: userId || null,
       order_id: uniqueOrderId,
       order_type: orderType,
       reference_id: referenceId || orderId,
       amount,
       currency: 'JMD',
       description: description || `Payment for ${orderType}`,
       ezee_token: tokenData.token,
       status: 'pending',
       customer_email: customerEmail,
       customer_name: customerName,
       metadata: { original_order_id: orderId },
     })
     .select()
     .single();

   if (dbError) {
     console.error('Database error:', dbError);
   }

   // Payment page URL
   const paymentUrl = EZEE_API_URL.includes('test') 
     ? 'https://secure-test.ezeepayments.com/pay'
     : 'https://secure.ezeepayments.com/pay';

   return new Response(
     JSON.stringify({
       success: true,
       token: tokenData.token,
       transactionId: transaction?.id,
       paymentUrl,
       paymentData: {
         token: tokenData.token,
       },
     }),
     { status: 200, headers: corsHeaders }
   );
 } catch (error) {
   console.error('Create token error:', error);
   return new Response(
     JSON.stringify({ error: 'Internal server error' }),
     { status: 500, headers: corsHeaders }
   );
 }
}