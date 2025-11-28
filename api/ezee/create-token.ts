/**
 * Vercel API Route: /api/ezee/create-token.ts
 * Creates a payment token for one-time payments
 * WITH CORS SUPPORT
 * Uses official eZeePayments API format with form data
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
    } = req.body;

    // Validate required fields
    if (!amount || !orderId || !orderType || !customerEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount, orderId, orderType, customerEmail' 
      });
    }

    // Generate short unique order ID (max 50 chars for eZeePayments)
    // Format: ORD_timestamp_random (e.g., "ORD_1764299044_x7k9m2" ~28 chars)
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const uniqueOrderId = `ORD_${timestamp}_${randomStr}`;

    // Callback URLs
    const postBackUrl = `${APP_URL}/api/ezee/webhook`;
    const returnUrl = `${APP_URL}/payment/success?orderId=${orderId}`;
    const cancelUrl = `${APP_URL}/payment/cancel?orderId=${orderId}`;

    // Create form data (NOT JSON) - eZeePayments requires form data
    const formData = new URLSearchParams();
    formData.append('amount', amount.toString());
    formData.append('currency', 'JMD');
    formData.append('order_id', uniqueOrderId);
    formData.append('post_back_url', postBackUrl);
    formData.append('return_url', returnUrl);
    formData.append('cancel_url', cancelUrl);

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

    let tokenData;
    try {
      tokenData = await tokenResponse.json();
    } catch (jsonError) {
      console.error('Failed to parse eZeePayments response:', jsonError);
      const textResponse = await tokenResponse.text();
      console.error('Response text:', textResponse);
      return res.status(500).json({ error: 'Invalid response from payment provider' });
    }

    // Check response - note the "result" wrapper
    if (!tokenData.result || tokenData.result.status !== 1) {
      console.error('eZeePayments token error:', tokenData);
      return res.status(500).json({ 
        error: tokenData.result?.message || 'Failed to create payment token',
        details: tokenData 
      });
    }

    // Token is inside result object
    const token = tokenData.result.token;

    // Store transaction in database
    const { data: transaction, error: dbError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId || null,
        order_id: orderId,
        order_type: orderType,
        reference_id: referenceId || null,
        amount,
        currency: 'JMD',
        description: description || `Payment for ${orderType}`,
        ezee_token: token,
        status: 'pending',
        customer_email: customerEmail,
        customer_name: customerName,
        metadata: { unique_order_id: uniqueOrderId },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue even if DB insert fails - we still return the token
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
    console.error('Create token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
