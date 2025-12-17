/**
 * Payment Service
 * React Native client for eZeePayments integration
 * File: services/paymentService.ts
 */

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Pre-load expo-web-browser module to avoid dynamic import delay
// This is cached after first load, making subsequent calls much faster
// Use a type-safe approach that works with Metro bundler
type WebBrowserType = typeof import('expo-web-browser');
let WebBrowserModule: WebBrowserType | null = null;
let webBrowserLoadAttempted = false;
let webBrowserLoadPromise: Promise<WebBrowserType | null> | null = null;

async function loadWebBrowserModule(): Promise<WebBrowserType | null> {
  // If already loaded, return cached module
  if (WebBrowserModule) {
    return WebBrowserModule;
  }
  
  // If we're already loading, return the existing promise
  if (webBrowserLoadPromise) {
    return webBrowserLoadPromise;
  }
  
  // If we've already tried and failed, don't try again
  if (webBrowserLoadAttempted && !WebBrowserModule) {
    return null;
  }
  
  // Only try to load on mobile platforms (not web)
  if (Platform.OS === 'web') {
    webBrowserLoadAttempted = true;
    return null;
  }
  
  // Create a single promise for the load operation
  webBrowserLoadPromise = (async () => {
    try {
      webBrowserLoadAttempted = true;
      const module = await import('expo-web-browser');
      WebBrowserModule = module;
      return module;
    } catch (error) {
      console.warn('Failed to pre-load expo-web-browser:', error);
      return null;
    } finally {
      webBrowserLoadPromise = null; // Clear promise after completion
    }
  })();
  
  return webBrowserLoadPromise;
}

// Pre-load the module when this file is first imported (non-blocking)
// Only on mobile platforms
if (Platform.OS !== 'web') {
  // Use setTimeout to defer loading slightly, avoiding blocking initial render
  setTimeout(() => {
    loadWebBrowserModule().catch(() => {
      // Silently fail - we'll fallback to Linking if needed
    });
  }, 0);
}

// API Base URL - Update this to your Vercel deployment URL
// Trim and validate the URL to prevent typos
const getApiBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    // Trim whitespace
    let cleaned = envUrl.trim();
    
    // Extract the first http(s) URL token.
    // This is safer than trying to "trim" concatenated env vars, and avoids accidentally
    // chopping valid domains like ".org" (seen in mobile where ".org" became ".or").
    const match = cleaned.match(/https?:\/\/[^\s"'<>]+/i);
    if (match && match[0]) {
      cleaned = match[0];
    }
    
    // Remove trailing punctuation that might be included from logs/copy-paste
    cleaned = cleaned.replace(/[)\],.]+$/, '');
    
    // Validate it's a proper URL format
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      // Ensure it doesn't end with a slash (we'll add paths later)
      cleaned = cleaned.replace(/\/+$/, '');
      console.log('✅ [PAYMENT] Cleaned API URL:', cleaned);
      return cleaned;
    }
    console.warn('⚠️ [PAYMENT] Invalid EXPO_PUBLIC_API_URL format, using default. Raw value:', JSON.stringify(envUrl));
  }
  return 'https://vibe.volunteersinc.org';
};

const API_BASE_URL = getApiBaseUrl();

// Types
export type OrderType = 'donation' | 'event_registration' | 'membership' | 'other';
export type SubscriptionType = 'recurring_donation' | 'membership' | 'organization_membership' | 'other';
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
  returnPath?: string; // Path to redirect to after successful payment (e.g., '/causes/[slug]', '/events/[slug]', '/membership')
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
  returnPath?: string; // Path to redirect to after successful payment (e.g., '/causes/[slug]', '/events/[slug]', '/membership')
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
    // Auto-detect platform if not specified
    const detectedPlatform = params.platform || (Platform.OS === 'web' ? 'web' : 'app');
    const requestBody = {
      ...params,
      platform: detectedPlatform,
    };

    // Debug: Log the API URL being used
    const apiUrl = `${API_BASE_URL}/api/ezee/create-token`;
    const rawEnvValue = process.env.EXPO_PUBLIC_API_URL;
    console.log('🔵 [PAYMENT] Raw EXPO_PUBLIC_API_URL env var:', JSON.stringify(rawEnvValue));
    console.log('🔵 [PAYMENT] Raw env var length:', rawEnvValue?.length);
    console.log('🔵 [PAYMENT] Raw env var char codes:', rawEnvValue ? Array.from(rawEnvValue).map(c => c.charCodeAt(0)).join(',') : 'null');
    console.log('🔵 [PAYMENT] Cleaned API Base URL:', API_BASE_URL);
    console.log('🔵 [PAYMENT] Full API URL:', apiUrl);
    console.log('🔵 [PAYMENT] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetchWithTimeout(
      apiUrl,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      },
      30000 // 30 second timeout
    );

    console.log('🔵 [PAYMENT] Response status:', response.status);
    console.log('🔵 [PAYMENT] Response ok:', response.ok);

    // Try to parse JSON, but handle errors gracefully
    let data;
    try {
      const responseText = await response.text();
      console.log('🔵 [PAYMENT] Response text:', responseText);
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('🔵 [PAYMENT] Failed to parse response as JSON:', parseError);
      return {
        success: false,
        error: `Invalid response from server (status: ${response.status}). Please check your API configuration.`,
      };
    }

    if (!response.ok) {
      console.error('🔵 [PAYMENT] API error response:', data);
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
    console.error('🔵 [PAYMENT] Create payment error:', error);
    console.error('🔵 [PAYMENT] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('🔵 [PAYMENT] Error message:', error instanceof Error ? error.message : String(error));
    console.error('🔵 [PAYMENT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Provide more specific error messages
    let errorMessage = 'Network error. Please check your connection and try again.';
    if (error instanceof Error) {
      if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
        errorMessage = `Cannot reach payment server. Please check:\n1. Your internet connection\n2. API URL: ${API_BASE_URL}\n3. That the server is running and accessible`;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Payment request timed out. Please try again.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
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
    console.log('Opening payment page:', paymentUrl);
    
    // On web, use window.location to redirect
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        console.log('Redirecting on web to:', paymentUrl);
        window.location.href = paymentUrl;
        return { success: true };
      }
      console.error('Window not available on web');
      return { success: false, error: 'Window not available' };
    }
    
    // On mobile, try to use expo-web-browser first, fallback to Linking if it fails
    // Use pre-loaded module (much faster than dynamic import)
    const WebBrowser = await loadWebBrowserModule();
    
    if (WebBrowser && typeof WebBrowser.openBrowserAsync === 'function') {
      try {
        console.log('Opening browser with expo-web-browser...');
        const result = await WebBrowser.openBrowserAsync(paymentUrl, {
          showTitle: true,
          enableBarCollapsing: true,
        });
        console.log('Browser opened:', result);
        // On mobile, success means browser was opened (dismiss/cancel means user came back)
        return { success: true };
      } catch (webBrowserError) {
        // If openBrowserAsync fails, fallback to Linking
        console.warn('expo-web-browser.openBrowserAsync failed, falling back to Linking:', webBrowserError);
      }
    }
    
    // Fallback: Use Linking.openURL if expo-web-browser is not available
    console.log('Falling back to Linking.openURL...');
    const canOpen = await Linking.canOpenURL(paymentUrl);
    if (canOpen) {
      console.log('Can open URL, opening with Linking...');
      await Linking.openURL(paymentUrl);
      return { success: true };
    } else {
      console.error('Cannot open payment URL:', paymentUrl);
      return { success: false, error: 'Cannot open payment URL' };
    }
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
    console.log('Creating payment token...', { 
      amount: params.amount, 
      orderType: params.orderType,
      orderId: params.orderId 
    });
    
    const paymentResult = await createPayment(params);

    if (!paymentResult.success || !paymentResult.paymentUrl || !paymentResult.paymentData) {
      console.error('Payment creation failed:', paymentResult);
      return {
        success: false,
        error: paymentResult.error || 'Failed to create payment',
      };
    }

    console.log('Payment token created, opening payment page...', {
      paymentUrl: paymentResult.paymentUrl,
      transactionId: paymentResult.transactionId,
    });

    // Open payment page
    const browserResult = await openPaymentPage(paymentResult.paymentUrl, paymentResult.paymentData);

    if (!browserResult.success) {
      console.error('Failed to open payment page:', browserResult.error);
      return {
        success: false,
        error: browserResult.error || 'Failed to open payment page',
        transactionId: paymentResult.transactionId,
      };
    }

    // For web, the page redirects so we won't get a response
    if (Platform.OS === 'web') {
      console.log('Payment page opened on web, redirecting...');
      return {
        success: true,  // Assume success since we're redirecting
        transactionId: paymentResult.transactionId,
      };
    }

    console.log('Payment page opened on mobile');
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
    // Auto-detect platform if not specified
    const detectedPlatform = params.platform || (Platform.OS === 'web' ? 'web' : 'app');
    const requestBody = {
      ...params,
      platform: detectedPlatform,
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

  // For web, the page redirects so we won't get a response
  if (Platform.OS === 'web') {
    return {
      success: true,  // Assume success since we're redirecting
      subscriptionId: subscriptionResult.subscriptionId,
    };
  }

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
