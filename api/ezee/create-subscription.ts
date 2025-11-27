/**
 * eZeePayments - Create Subscription API
 * Vercel Serverless Function
 * File: api/ezee/create-subscription.ts
 * 
 * Creates a subscription for recurring payments
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

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

interface CreateSubscriptionRequest {
  amount: number;
  frequency: Frequency;
  subscriptionType: 'recurring_donation' | 'membership' | 'other';
  referenceId?: string;
  userId: string;
  customerEmail: string;
  customerName?: string;
  description?: string;
  endDate?: string; // Format: d/m/Y
}

interface EzeeSubscriptionResponse {
  result: {
    status: number;
    subscription_id?: string;
    message?: string | { [key: string]: string };
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
      frequency,
      subscriptionType,
      referenceId,
      userId,
      customerEmail,
      customerName,
      description,
      endDate,
    }: CreateSubscriptionRequest = req.body;

    // Validate required fields
    if (!amount || !frequency || !subscriptionType || !userId || !customerEmail) {
      return res.status(400).json({
        error: 'Missing required fields: amount, frequency, subscriptionType, userId, customerEmail',
      });
    }

    // Validate frequency
    const validFrequencies: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`,
      });
    }

    // Define callback URL for subscription webhooks
    const postBackUrl = `${APP_URL}/api/ezee/webhook`;

    // Create form data for eZeePayments
    const formData = new FormData();
    formData.append('amount', amount.toString());
    formData.append('currency', 'JMD');
    formData.append('frequency', frequency);
    if (description) {
      formData.append('description', description);
    }
    if (endDate) {
      formData.append('end_date', endDate);
    }
    formData.append('post_back_url', postBackUrl);

    // Call eZeePayments API to create subscription
    const ezeeResponse = await fetch(`${EZEE_API_URL}/v1/subscription/create/`, {
      method: 'POST',
      headers: {
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: formData,
    });

    const ezeeData: EzeeSubscriptionResponse = await ezeeResponse.json();

    if (ezeeData.result.status !== 1 || !ezeeData.result.subscription_id) {
      console.error('eZeePayments subscription error:', ezeeData);
      
      // Format error message
      let errorMessage = 'Unknown error';
      if (ezeeData.result.message) {
        if (typeof ezeeData.result.message === 'string') {
          errorMessage = ezeeData.result.message;
        } else {
          errorMessage = Object.values(ezeeData.result.message).join(', ');
        }
      }
      
      return res.status(400).json({
        error: 'Failed to create subscription',
        message: errorMessage,
      });
    }

    // Calculate next billing date based on frequency
    const now = new Date();
    let nextBillingDate = new Date(now);
    switch (frequency) {
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

    // Store subscription in database
    const { data: subscription, error: dbError } = await supabase
      .from('payment_subscriptions')
      .insert({
        user_id: userId,
        subscription_type: subscriptionType,
        reference_id: referenceId || null,
        amount,
        currency: 'JMD',
        frequency,
        description: description || null,
        ezee_subscription_id: ezeeData.result.subscription_id,
        status: 'pending', // Will become 'active' after first successful payment
        start_date: now.toISOString().split('T')[0],
        end_date: endDate ? new Date(endDate.split('/').reverse().join('-')).toISOString().split('T')[0] : null,
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        customer_email: customerEmail,
        customer_name: customerName || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue anyway
    }

    // Now we need to make the first payment
    // Generate order ID for the first payment
    const orderId = `sub_${ezeeData.result.subscription_id}_${Date.now()}`;
    
    // Get payment token for the first payment
    const tokenFormData = new FormData();
    tokenFormData.append('amount', amount.toString());
    tokenFormData.append('currency', 'JMD');
    tokenFormData.append('order_id', orderId);
    tokenFormData.append('post_back_url', postBackUrl);
    tokenFormData.append('return_url', `${APP_URL}/payment/success?subscriptionId=${subscription?.id}`);
    tokenFormData.append('cancel_url', `${APP_URL}/payment/cancel?subscriptionId=${subscription?.id}`);

    const tokenResponse = await fetch(`${EZEE_API_URL}/v1/custom_token/`, {
      method: 'POST',
      headers: {
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: tokenFormData,
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.result.status !== 1 || !tokenData.result.token) {
      console.error('Failed to get token for subscription payment:', tokenData);
      return res.status(400).json({
        error: 'Subscription created but failed to get payment token',
        subscriptionId: subscription?.id,
        ezeeSubscriptionId: ezeeData.result.subscription_id,
      });
    }

    // Return subscription info and payment data
    return res.status(200).json({
      success: true,
      subscriptionId: subscription?.id,
      ezeeSubscriptionId: ezeeData.result.subscription_id,
      token: tokenData.result.token,
      paymentUrl: `https://secure-test.ezeepayments.com`,
      paymentData: {
        platform: 'custom',
        token: tokenData.result.token,
        amount: amount.toString(),
        currency: 'JMD',
        order_id: orderId,
        email_address: customerEmail,
        customer_name: customerName || '',
        description: description || `${frequency} subscription`,
        recurring: 'true',
        subscription_id: ezeeData.result.subscription_id,
      },
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
