/**
 * eZeePayments - Subscription Management API
 * Vercel Serverless Function
 * File: api/ezee/subscription.ts
 * 
 * Check status and cancel subscriptions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY!;
const EZEE_SITE = process.env.EZEE_SITE || 'https://test.com';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  switch (action) {
    case 'status':
      return handleGetStatus(req, res);
    case 'cancel':
      return handleCancel(req, res);
    default:
      return res.status(400).json({ error: 'Invalid action. Use: status, cancel' });
  }
}

/**
 * Get subscription status from eZeePayments
 */
async function handleGetStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const subscriptionId = req.query.subscriptionId || req.body?.subscriptionId;
    const transactionNumber = req.query.transactionNumber || req.body?.transactionNumber;

    if (!subscriptionId && !transactionNumber) {
      return res.status(400).json({ error: 'Missing subscriptionId or transactionNumber' });
    }

    // Get subscription from our database
    let subscription;
    if (subscriptionId) {
      const { data } = await supabase
        .from('payment_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();
      subscription = data;
    } else if (transactionNumber) {
      const { data } = await supabase
        .from('payment_subscriptions')
        .select('*')
        .eq('transaction_number', transactionNumber)
        .single();
      subscription = data;
    }

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Get status from eZeePayments
    const formData = new FormData();
    formData.append('TransactionNumber', subscription.transaction_number || subscription.ezee_subscription_id);

    const ezeeResponse = await fetch(`${EZEE_API_URL}/v1/subscription/status/`, {
      method: 'POST',
      headers: {
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: formData,
    });

    const ezeeData = await ezeeResponse.json();

    // Map eZeePayments status to our status
    let mappedStatus = subscription.status;
    if (ezeeData.result?.message) {
      const message = ezeeData.result.message.toLowerCase();
      if (message.includes('active')) {
        mappedStatus = 'active';
      } else if (message.includes('cancelled')) {
        mappedStatus = 'cancelled';
      } else if (message.includes('ended') || message.includes('expired')) {
        mappedStatus = 'ended';
      }

      // Update our database if status changed
      if (mappedStatus !== subscription.status) {
        await supabase
          .from('payment_subscriptions')
          .update({ status: mappedStatus })
          .eq('id', subscription.id);
      }
    }

    return res.status(200).json({
      success: true,
      subscription: {
        id: subscription.id,
        status: mappedStatus,
        amount: subscription.amount,
        currency: subscription.currency,
        frequency: subscription.frequency,
        nextBillingDate: subscription.next_billing_date,
        lastBillingDate: subscription.last_billing_date,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
      },
      ezeeStatus: ezeeData.result?.message || 'Unknown',
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Cancel subscription
 */
async function handleCancel(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscriptionId, userId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscriptionId' });
    }

    // Get subscription from our database
    const { data: subscription, error: findError } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (findError || !subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Verify ownership if userId provided
    if (userId && subscription.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this subscription' });
    }

    // Cancel with eZeePayments
    const formData = new FormData();
    formData.append('TransactionNumber', subscription.transaction_number || subscription.ezee_subscription_id);

    const ezeeResponse = await fetch(`${EZEE_API_URL}/v1/subscription/cancel/`, {
      method: 'POST',
      headers: {
        'licence_key': EZEE_LICENCE_KEY,
        'site': EZEE_SITE,
      },
      body: formData,
    });

    const ezeeData = await ezeeResponse.json();

    if (ezeeData.result?.status !== 1) {
      console.error('eZeePayments cancel error:', ezeeData);
      // Still update our database even if eZee fails
    }

    // Update our database
    await supabase
      .from('payment_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    // Update related records
    if (subscription.subscription_type === 'recurring_donation' && subscription.reference_id) {
      await supabase
        .from('recurring_donations')
        .update({ status: 'cancelled' })
        .eq('id', subscription.reference_id);
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      ezeeMessage: ezeeData.result?.message || 'Cancelled',
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
