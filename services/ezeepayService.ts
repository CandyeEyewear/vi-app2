/**
 * eZeePayments Service
 * Handles all payment processing for donations and subscriptions
 * File: services/ezeepayService.ts
 * 
 * API Documentation: eZeePayments Recurring Billing API (Apr 2024)
 * 
 * ⚠️ TODO: Replace placeholder credentials with real ones
 */

// =============================================================================
// CONFIGURATION - REPLACE THESE WITH YOUR ACTUAL CREDENTIALS
// =============================================================================

const EZEE_CONFIG = {
  // ⚠️ PLACEHOLDER - Replace with your actual credentials
  merchantId: 'YOUR_MERCHANT_ID',
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
  
  // API Endpoints
  baseUrl: 'https://api.ezeepayments.com', // Production
  // baseUrl: 'https://api-test.ezeepayments.com', // Sandbox/Testing
  
  // Payment page URLs
  paymentPageUrl: 'https://secure.ezeepayments.com/pay',
  // paymentPageUrl: 'https://secure-test.ezeepayments.com/pay', // Sandbox
  
  // Your app's callback URLs
  callbackUrl: 'https://your-api.com/webhooks/ezeepay', // Your backend webhook
  returnUrl: 'vibeapp://payment-complete', // Deep link back to app
  cancelUrl: 'vibeapp://payment-cancelled',
  
  // Currency
  currency: 'JMD',
};

// =============================================================================
// TYPES
// =============================================================================

export type PaymentFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface PaymentTokenRequest {
  amount: number;
  currency?: string;
  description: string;
  customerEmail: string;
  customerName: string;
  orderId: string; // Your internal reference (donation ID, subscription ID, etc.)
  metadata?: Record<string, string>;
}

export interface PaymentTokenResponse {
  success: boolean;
  token?: string;
  paymentUrl?: string;
  error?: string;
}

export interface SubscriptionRequest {
  amount: number;
  currency?: string;
  frequency: PaymentFrequency;
  customerEmail: string;
  customerName: string;
  description: string;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string (optional)
  metadata?: Record<string, string>;
}

export interface SubscriptionResponse {
  success: boolean;
  subscriptionId?: string;
  status?: string;
  nextBillingDate?: string;
  error?: string;
}

export interface WebhookPayload {
  ResponseCode: string; // '1' = success
  ResponseDescription: string;
  TransactionNumber: string;
  OrderId: string;
  Amount: string;
  Currency: string;
  CustomerEmail?: string;
  SubscriptionId?: string;
  PaymentType?: 'once' | 'recurring';
}

export interface TransactionResult {
  success: boolean;
  transactionNumber?: string;
  orderId?: string;
  amount?: number;
  error?: string;
}

// =============================================================================
// MEMBERSHIP SUBSCRIPTION PLANS
// =============================================================================

export const MEMBERSHIP_PLANS = {
  monthly: {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    price: 1000,
    currency: 'JMD',
    frequency: 'monthly' as PaymentFrequency,
    description: 'VIbe Premium Membership - Monthly',
    benefits: [
      'Blue verification tick',
      'Official Member designation',
      'Propose volunteer opportunities',
      'Customized Blue VI T-Shirt',
      'Impact Statistics on profile',
      'Priority support',
    ],
  },
  yearly: {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    price: 12000,
    currency: 'JMD',
    frequency: 'annually' as PaymentFrequency,
    description: 'VIbe Premium Membership - Yearly',
    savings: 0, // J$1000 * 12 = J$12,000 (no savings, but could add discount later)
    benefits: [
      'Blue verification tick',
      'Official Member designation',
      'Propose volunteer opportunities',
      'Customized Blue VI T-Shirt',
      'Impact Statistics on profile',
      'Priority support',
      'All yearly benefits',
    ],
  },
};

// =============================================================================
// API HELPER FUNCTIONS
// =============================================================================

/**
 * Make authenticated request to eZeePayments API
 */
async function makeApiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: Record<string, any>
): Promise<T> {
  const url = `${EZEE_CONFIG.baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Merchant-Id': EZEE_CONFIG.merchantId,
    'X-Api-Key': EZEE_CONFIG.apiKey,
    // Add any other required auth headers
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eZeePayments API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Generate unique order ID
 */
export function generateOrderId(prefix: string = 'ORD'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

// =============================================================================
// ONE-TIME PAYMENT FUNCTIONS
// =============================================================================

/**
 * Create a payment token for one-time payment
 * Use this for donations
 */
export async function createPaymentToken(
  request: PaymentTokenRequest
): Promise<PaymentTokenResponse> {
  try {
    // ⚠️ This is the expected API structure - adjust based on actual eZeePayments docs
    const response = await makeApiRequest<any>('/v1/custom_token/', 'POST', {
      merchant_id: EZEE_CONFIG.merchantId,
      amount: request.amount,
      currency: request.currency || EZEE_CONFIG.currency,
      description: request.description,
      customer_email: request.customerEmail,
      customer_name: request.customerName,
      order_id: request.orderId,
      callback_url: EZEE_CONFIG.callbackUrl,
      return_url: EZEE_CONFIG.returnUrl,
      cancel_url: EZEE_CONFIG.cancelUrl,
      metadata: request.metadata,
    });

    if (response.token) {
      return {
        success: true,
        token: response.token,
        paymentUrl: `${EZEE_CONFIG.paymentPageUrl}?token=${response.token}`,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to create payment token',
    };
  } catch (error) {
    console.error('Error creating payment token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create payment URL for one-time donation
 */
export async function createDonationPayment(params: {
  donationId: string;
  amount: number;
  causeTitle: string;
  donorName: string;
  donorEmail: string;
}): Promise<PaymentTokenResponse> {
  return createPaymentToken({
    amount: params.amount,
    description: `Donation to: ${params.causeTitle}`,
    customerEmail: params.donorEmail,
    customerName: params.donorName,
    orderId: `DON-${params.donationId}`,
    metadata: {
      type: 'donation',
      donationId: params.donationId,
    },
  });
}

// =============================================================================
// SUBSCRIPTION FUNCTIONS
// =============================================================================

/**
 * Create a recurring subscription
 * Use this for membership subscriptions and recurring donations
 */
export async function createSubscription(
  request: SubscriptionRequest
): Promise<SubscriptionResponse> {
  try {
    // ⚠️ This is the expected API structure - adjust based on actual eZeePayments docs
    const response = await makeApiRequest<any>('/v1/subscription/create/', 'POST', {
      merchant_id: EZEE_CONFIG.merchantId,
      amount: request.amount,
      currency: request.currency || EZEE_CONFIG.currency,
      frequency: request.frequency,
      customer_email: request.customerEmail,
      customer_name: request.customerName,
      description: request.description,
      start_date: request.startDate || new Date().toISOString().split('T')[0],
      end_date: request.endDate,
      callback_url: EZEE_CONFIG.callbackUrl,
      return_url: EZEE_CONFIG.returnUrl,
      cancel_url: EZEE_CONFIG.cancelUrl,
      metadata: request.metadata,
    });

    if (response.subscription_id) {
      return {
        success: true,
        subscriptionId: response.subscription_id,
        status: response.status,
        nextBillingDate: response.next_billing_date,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to create subscription',
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create membership subscription
 */
export async function createMembershipSubscription(params: {
  userId: string;
  plan: 'monthly' | 'yearly';
  customerName: string;
  customerEmail: string;
}): Promise<SubscriptionResponse> {
  const planDetails = MEMBERSHIP_PLANS[params.plan];
  
  return createSubscription({
    amount: planDetails.price,
    currency: planDetails.currency,
    frequency: planDetails.frequency,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    description: planDetails.description,
    metadata: {
      type: 'membership',
      userId: params.userId,
      plan: params.plan,
    },
  });
}

/**
 * Create recurring donation subscription
 */
export async function createRecurringDonationSubscription(params: {
  recurringDonationId: string;
  amount: number;
  frequency: PaymentFrequency;
  causeTitle: string;
  donorName: string;
  donorEmail: string;
}): Promise<SubscriptionResponse> {
  return createSubscription({
    amount: params.amount,
    frequency: params.frequency,
    customerEmail: params.donorEmail,
    customerName: params.donorName,
    description: `Recurring donation to: ${params.causeTitle}`,
    metadata: {
      type: 'recurring_donation',
      recurringDonationId: params.recurringDonationId,
    },
  });
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<SubscriptionResponse> {
  try {
    const response = await makeApiRequest<any>(
      `/v1/subscription/status/?subscription_id=${subscriptionId}`,
      'GET'
    );

    return {
      success: true,
      subscriptionId: response.subscription_id,
      status: response.status,
      nextBillingDate: response.next_billing_date,
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await makeApiRequest<any>('/v1/subscription/cancel/', 'POST', {
      subscription_id: subscriptionId,
      reason: reason,
    });

    return { success: true };
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Pause a subscription (if supported)
 */
export async function pauseSubscription(
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await makeApiRequest<any>('/v1/subscription/pause/', 'POST', {
      subscription_id: subscriptionId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error pausing subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resume a paused subscription (if supported)
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await makeApiRequest<any>('/v1/subscription/resume/', 'POST', {
      subscription_id: subscriptionId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

/**
 * Parse and validate webhook payload from eZeePayments
 * This should be called from your backend webhook endpoint
 */
export function parseWebhookPayload(payload: any): WebhookPayload | null {
  try {
    // Validate required fields
    if (!payload.ResponseCode || !payload.TransactionNumber || !payload.OrderId) {
      console.error('Invalid webhook payload - missing required fields');
      return null;
    }

    return {
      ResponseCode: payload.ResponseCode,
      ResponseDescription: payload.ResponseDescription || '',
      TransactionNumber: payload.TransactionNumber,
      OrderId: payload.OrderId,
      Amount: payload.Amount,
      Currency: payload.Currency || 'JMD',
      CustomerEmail: payload.CustomerEmail,
      SubscriptionId: payload.SubscriptionId,
      PaymentType: payload.PaymentType,
    };
  } catch (error) {
    console.error('Error parsing webhook payload:', error);
    return null;
  }
}

/**
 * Check if payment was successful
 */
export function isPaymentSuccessful(payload: WebhookPayload): boolean {
  return payload.ResponseCode === '1';
}

/**
 * Process webhook and return result
 */
export function processWebhook(payload: WebhookPayload): TransactionResult {
  const success = isPaymentSuccessful(payload);
  
  return {
    success,
    transactionNumber: payload.TransactionNumber,
    orderId: payload.OrderId,
    amount: parseFloat(payload.Amount),
    error: success ? undefined : payload.ResponseDescription,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'JMD'): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate next billing date based on frequency
 */
export function calculateNextBillingDate(frequency: PaymentFrequency, fromDate?: Date): Date {
  const date = fromDate ? new Date(fromDate) : new Date();
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'annually':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date;
}

/**
 * Check if credentials are configured
 */
export function isConfigured(): boolean {
  return (
    EZEE_CONFIG.merchantId !== 'YOUR_MERCHANT_ID' &&
    EZEE_CONFIG.apiKey !== 'YOUR_API_KEY' &&
    EZEE_CONFIG.apiSecret !== 'YOUR_API_SECRET'
  );
}

/**
 * Get configuration status for debugging
 */
export function getConfigStatus(): { configured: boolean; message: string } {
  if (isConfigured()) {
    return { configured: true, message: 'eZeePayments is configured' };
  }
  return {
    configured: false,
    message: 'eZeePayments credentials not configured. Replace placeholders in ezeepayService.ts',
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Configuration
  EZEE_CONFIG,
  MEMBERSHIP_PLANS,
  isConfigured,
  getConfigStatus,
  
  // One-time payments
  createPaymentToken,
  createDonationPayment,
  
  // Subscriptions
  createSubscription,
  createMembershipSubscription,
  createRecurringDonationSubscription,
  getSubscriptionStatus,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  
  // Webhooks
  parseWebhookPayload,
  isPaymentSuccessful,
  processWebhook,
  
  // Utilities
  generateOrderId,
  formatCurrency,
  calculateNextBillingDate,
};
