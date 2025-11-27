/**
 * eZeePayments - Create Token API
 * Vercel Serverless Function
 * File: api/ezee/create-token.ts
 * 
 * Creates a payment token for one-time payments
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY!;
const EZEE_SITE = process.env.EZEE_SITE || 'https://test.com';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

// Initialize Supabase with service role for server-side operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CreateTokenRequest {
  amount: number;
  orderId: string;
  orderType: 'donation' | 'event_registration' | 'membership' | 'other';
  referenceId?: string;
  userId?: string;
  customerEmail: string;
  customerName?: string;
  description?: string;
}

interface EzeeTokenResponse {
  result: {
    status: number;
    token?: string;
    message?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    }: CreateTokenRequest = req.body;

    // Validate required fields
    if (!amount || !orderId || !orderType || !customerEmail) {
      return res.status(400).json({
        error: 'Missing required fields: amount, orderId, orderType, customerEmail',
      });
    }

    // Generate unique order ID with timestamp
    const uniqueOrderId = `${orderType}_${orderId}_${Date.now()}`;

    // Define callback URLs
    const postBackUrl = `${APP_URL}/api/ezee/webhook`;
    const returnUrl = `${APP_URL}/payment/success?orderId=${uniqueOrderId}`;
    const cancelUrl = `${APP_URL}/payment/cancel?orderId=${uniqueOrderId}`;

    // Create form data for eZeePayments
    const formData = new FormData();
    formData.append('amount', amount.toString());
    formData.append('currency', 'JMD');
    formData.append('order_id', uniqueOrderId);
    formData.append('post_back_url', postBackUrl);
    formData.append('return_url', returnUrl);
    formData.append('cancel_url', cancelUrl);

    // Call eZeePayments API to get token
    const ezeeResponse = await fetch(`${EZEE_API_URL}/v1/custom_token/`, {
      method: 'POST',
      headers: {
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: formData,
    });

    const ezeeData: EzeeTokenResponse = await ezeeResponse.json();

    if (ezeeData.result.status !== 1 || !ezeeData.result.token) {
      console.error('eZeePayments token error:', ezeeData);
      return res.status(400).json({
        error: 'Failed to create payment token',
        message: ezeeData.result.message || 'Unknown error',
      });
    }

    // Store transaction in database
    const { data: transaction, error: dbError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId || null,
        order_id: uniqueOrderId,
        order_type: orderType,
        reference_id: referenceId || null,
        amount,
        currency: 'JMD',
        description: description || null,
        ezee_token: ezeeData.result.token,
        status: 'pending',
        customer_email: customerEmail,
        customer_name: customerName || null,
        metadata: {
          original_order_id: orderId,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue anyway - payment can still work
    }

    // Return token and payment URL
    return res.status(200).json({
      success: true,
      token: ezeeData.result.token,
      transactionId: transaction?.id,
      paymentUrl: `https://secure-test.ezeepayments.com`,
      paymentData: {
        platform: 'custom',
        token: ezeeData.result.token,
        amount: amount.toString(),
        currency: 'JMD',
        order_id: uniqueOrderId,
        email_address: customerEmail,
        customer_name: customerName || '',
        description: description || '',
        recurring: 'false',
      },
    });
  } catch (error) {
    console.error('Create token error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
