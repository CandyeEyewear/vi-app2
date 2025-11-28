/**
 * Payment Service
 * React Native client for eZeePayments integration
 * File: services/paymentService.ts
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// API Base URL - Update this to your Vercel deployment URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://vibe.volunteersinc.org';

// Types
export type OrderType = 'donation' | 'event_registration' | 'membership' | 'other';
export type SubscriptionType = 'recurring_donation' | 'membership' | 'other';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentTransaction {
  id: string;
  userId?: string;
  orderId: string;
  orderType: OrderType;
  referenceId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionNumber?: string;
  createdAt: string;
}

export interface PaymentSubscription {
  id: string;
  userId: string;
  subscriptionType: SubscriptionType;
  amount: number;
  currency: string;
  frequency: Frequency;
  status: string;
  nextBillingDate?: string;
  createdAt: string;
}

export interface CreatePaymentParams {
  amount: number;
  orderId: string;
  orderType: OrderType;
  referenceId?: string;
  userId?: string;
  customerEmail: string;
  customerName?: string;
  description?: string;
  platform?: 'web' | 'app'; // Platform source for smart redirects
}

export interface CreateSubscriptionParams {
  amount: number;
  frequency: Frequency;
  subscriptionType: SubscriptionType;
  referenceId?: string;
  userId: string;
  customerEmail: string;
  customerName?: string;
  description?: string;
  endDate?: string;
  platform?: 'web' | 'app'; // Platform source for smart redirects
}

export interface PaymentResponse {
  success: boolean;
  token?: string;
  transactionId?: string;
  paymentUrl?: string;
  paymentData?: Record<string, string>;
  error?: string;
}

export interface SubscriptionResponse {
  success: boolean;
  subscriptionId?: string;
  ezeeSubscriptionId?: string;
  token?: string;
  paymentUrl?: string;
  paymentData?: Record<string, string>;
  error?: string;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate payment parameters before making API call
 */
function validatePaymentParams(params: CreatePaymentParams): { valid: boolean; error?: string } {
  if (!params.amount || params.amount <= 0) {
    return { valid: false, error: 'Invalid payment amount. Amount must be greater than 0.' };
  }

  if (!params.orderId?.trim()) {
    return { valid: false, error: 'Order ID is required' };
  }

  if (!params.customerEmail?.trim()) {
    return { valid: false, error: 'Customer email is required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.customerEmail.trim())) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validate subscription parameters before making API call
 */
function validateSubscriptionParams(params: CreateSubscriptionParams): { valid: boolean; error?: string } {
  if (!params.amount || params.amount <= 0) {
    return { valid: false, error: 'Invalid subscription amount. Amount must be greater than 0.' };
  }

  if (!params.userId?.trim()) {
    return { valid: false, error: 'User ID is required' };
  }

  if (!params.customerEmail?.trim()) {
    return { valid: false, error: 'Customer email is required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.customerEmail.trim())) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Validate frequency
  const validFrequencies: Frequency[] = ['weekly', 'monthly', 'quarterly', 'annually'];
  if (!validFrequencies.includes(params.frequency)) {
    return { valid: false, error: 'Invalid subscription frequency. Must be one of: weekly, monthly, quarterly, annually' };
  }

  return { valid: true };
}

// ============================================
// NETWORK HELPERS
// ============================================

/**
 * Fetch with timeout wrapper
 * Prevents requests from hanging indefinitely
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Payment request timed out. Please check your connection and try again.');
    }
    throw error;
  }
}

// ============================================
// ONE-TIME PAYMENTS
// ============================================

/**
 * Create a payment token and get payment data
 */
export async function createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
  try {
    // Default to 'app' if platform not specified
    const requestBody = {
      ...params,
      platform: params.platform || 'app',
    };

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/ezee/create-token`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      },
      30000 // 30 second timeout
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `Failed to create payment (status: ${response.status})`,
      };
    }

    return {
      success: true,
      token: data.token,
      transactionId: data.transactionId,
      paymentUrl: data.paymentUrl,
      paymentData: data.paymentData,
    };
  } catch (error) {
    console.error('Create payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error. Please check your connection and try again.',
    };
  }
}

/**
 * Open the eZeePayments payment page in browser
 * The paymentUrl returned from the API already includes all parameters
 * and will auto-submit a POST form to eZeePayments
 */
export async function openPaymentPage(
  paymentUrl: string,
  paymentData?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    // The paymentUrl from the API already includes all required parameters
    // Just open it directly - it will auto-submit the form to eZeePayments
    const result = await WebBrowser.openBrowserAsync(paymentUrl, {
      showTitle: true,
      enableBarCollapsing: true,
    });

    return {
      success: result.type === 'dismiss' || result.type === 'cancel',
    };
  } catch (error) {
    console.error('Open payment page error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open payment page',
    };
  }
}

/**
 * Process a one-time payment (combines createPayment and openPaymentPage)
 */
export async function processPayment(params: CreatePaymentParams): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
}> {
  // Validate inputs first
  const validation = validatePaymentParams(params);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  try {
  // Create payment token
  const paymentResult = await createPayment(params);

  if (!paymentResult.success || !paymentResult.paymentUrl || !paymentResult.paymentData) {
    return {
      success: false,
      error: paymentResult.error || 'Failed to create payment',
    };
  }

  // Open payment page
  const browserResult = await openPaymentPage(paymentResult.paymentUrl, paymentResult.paymentData);

  return {
    success: browserResult.success,
    transactionId: paymentResult.transactionId,
    error: browserResult.error,
  };
  } catch (error) {
    console.error('Process payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process payment. Please try again.',
    };
  }
}

// ============================================
// RECURRING PAYMENTS / SUBSCRIPTIONS
// ============================================

/**
 * Create a subscription for recurring payments
 */
export async function createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResponse> {
  try {
    // Default to 'app' if platform not specified
    const requestBody = {
      ...params,
      platform: params.platform || 'app',
    };

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/ezee/create-subscription`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      },
      30000 // 30 second timeout
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `Failed to create subscription (status: ${response.status})`,
      };
    }

    return {
      success: true,
      subscriptionId: data.subscriptionId,
      ezeeSubscriptionId: data.ezeeSubscriptionId,
      token: data.token,
      paymentUrl: data.paymentUrl,
      paymentData: data.paymentData,
    };
  } catch (error) {
    console.error('Create subscription error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error. Please check your connection and try again.',
    };
  }
}

/**
 * Process a subscription payment (combines createSubscription and openPaymentPage)
 */
export async function processSubscription(params: CreateSubscriptionParams): Promise<{
  success: boolean;
  subscriptionId?: string;
  error?: string;
}> {
  // Validate inputs first
  const validation = validateSubscriptionParams(params);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  try {
  // Create subscription
  const subscriptionResult = await createSubscription(params);

  if (!subscriptionResult.success || !subscriptionResult.paymentUrl || !subscriptionResult.paymentData) {
    return {
      success: false,
      error: subscriptionResult.error || 'Failed to create subscription',
    };
  }

  // Open payment page for first payment
  const browserResult = await openPaymentPage(subscriptionResult.paymentUrl, subscriptionResult.paymentData);

  return {
    success: browserResult.success,
    subscriptionId: subscriptionResult.subscriptionId,
    error: browserResult.error,
  };
  } catch (error) {
    console.error('Process subscription error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process subscription. Please try again.',
    };
  }
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus(subscriptionId: string): Promise<{
  success: boolean;
  subscription?: PaymentSubscription;
  error?: string;
}> {
  if (!subscriptionId?.trim()) {
    return {
      success: false,
      error: 'Subscription ID is required',
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/ezee/subscription?action=status&subscriptionId=${subscriptionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      30000 // 30 second timeout
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to get subscription status (status: ${response.status})`,
      };
    }

    return {
      success: true,
      subscription: data.subscription,
    };
  } catch (error) {
    console.error('Get subscription status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error. Please check your connection and try again.',
    };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!subscriptionId?.trim()) {
    return {
      success: false,
      error: 'Subscription ID is required',
    };
  }

  if (!userId?.trim()) {
    return {
      success: false,
      error: 'User ID is required',
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/ezee/subscription?action=cancel`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscriptionId, userId }),
      },
      30000 // 30 second timeout
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to cancel subscription (status: ${response.status})`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error. Please check your connection and try again.',
    };
  }
}

// ============================================
// TRANSACTION HISTORY
// ============================================

/**
 * Get user's payment transactions
 */
export async function getUserTransactions(userId: string): Promise<{
  success: boolean;
  transactions?: PaymentTransaction[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      transactions: data?.map(transformTransaction) || [],
    };
  } catch (error) {
    console.error('Get transactions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's subscriptions
 */
export async function getUserSubscriptions(userId: string): Promise<{
  success: boolean;
  subscriptions?: PaymentSubscription[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('payment_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      subscriptions: data?.map(transformSubscription) || [],
    };
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(transactionId: string): Promise<{
  success: boolean;
  transaction?: PaymentTransaction;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      transaction: transformTransaction(data),
    };
  } catch (error) {
    console.error('Get transaction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format currency amount
 */
export function formatPaymentAmount(amount: number, currency: string = 'JMD'): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get payment status display info
 */
export function getPaymentStatusInfo(status: PaymentStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7' };
    case 'processing':
      return { label: 'Processing', color: '#3B82F6', bgColor: '#DBEAFE' };
    case 'completed':
      return { label: 'Completed', color: '#10B981', bgColor: '#D1FAE5' };
    case 'failed':
      return { label: 'Failed', color: '#EF4444', bgColor: '#FEE2E2' };
    case 'cancelled':
      return { label: 'Cancelled', color: '#6B7280', bgColor: '#F3F4F6' };
    case 'refunded':
      return { label: 'Refunded', color: '#8B5CF6', bgColor: '#EDE9FE' };
    default:
      return { label: 'Unknown', color: '#6B7280', bgColor: '#F3F4F6' };
  }
}

/**
 * Transform database transaction to frontend format
 */
function transformTransaction(data: any): PaymentTransaction {
  return {
    id: data.id,
    userId: data.user_id,
    orderId: data.order_id,
    orderType: data.order_type,
    referenceId: data.reference_id,
    amount: parseFloat(data.amount),
    currency: data.currency,
    status: data.status,
    transactionNumber: data.transaction_number,
    createdAt: data.created_at,
  };
}

/**
 * Transform database subscription to frontend format
 */
function transformSubscription(data: any): PaymentSubscription {
  return {
    id: data.id,
    userId: data.user_id,
    subscriptionType: data.subscription_type,
    amount: parseFloat(data.amount),
    currency: data.currency,
    frequency: data.frequency,
    status: data.status,
    nextBillingDate: data.next_billing_date,
    createdAt: data.created_at,
  };
}
