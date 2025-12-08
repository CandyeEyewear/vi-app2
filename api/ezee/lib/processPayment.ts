/**
 * Shared Payment Processor
 * Extracted from webhook.ts for reuse by webhook and auto-checker
 * Handles all downstream updates after successful payment confirmation
 */

import { createClient } from '@supabase/supabase-js';
import { ReceiptService } from '../../../services/receiptService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Process a one-time payment transaction
 * Updates all related records (donations, events, memberships, etc.)
 */
export async function processOneTimePayment(
  transaction: any,
  transactionNumber: string,
  logPrefix: string = '[PROCESS]'
): Promise<void> {
  console.log(`${logPrefix} Processing one-time payment for transaction: ${transaction.id}`);
  console.log(`${logPrefix}   order_type: ${transaction.order_type}`);
  console.log(`${logPrefix}   reference_id: ${transaction.reference_id}`);
  console.log(`${logPrefix}   user_id: ${transaction.user_id}`);

  try {
    // Update transaction status first
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'completed',
        transaction_number: transactionNumber,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error(`${logPrefix} Transaction update FAILED:`, updateError);
      throw new Error(`Transaction update failed: ${updateError.message}`);
    }

    // Process based on order type
    switch (transaction.order_type) {
      case 'event_registration':
        await handleEventRegistration(transaction, transactionNumber, logPrefix);
        break;

      case 'donation':
        await handleDonation(transaction, transactionNumber, logPrefix);
        break;

      case 'membership':
      case 'organization_membership':
        await handleMembership(transaction, logPrefix);
        break;

      case 'recurring_donation':
        await handleRecurringDonation(transaction, transactionNumber, logPrefix);
        break;

      default:
        console.log(`${logPrefix} No specific handling for order_type: ${transaction.order_type}`);
    }

    // Generate receipt for all successful payments
    await generateReceiptForTransaction(transaction, transactionNumber, logPrefix);

    console.log(`${logPrefix} One-time payment processing completed successfully`);
  } catch (error) {
    console.error(`${logPrefix} One-time payment processing ERROR:`, error);
    throw error;
  }
}

/**
 * Process a subscription payment
 * Updates subscription and related records
 */
export async function processSubscriptionPayment(
  subscription: any,
  transactionNumber: string,
  logPrefix: string = '[PROCESS]'
): Promise<void> {
  console.log(`${logPrefix} Processing subscription payment`);
  console.log(`${logPrefix}   subscription_id: ${subscription.id}`);
  console.log(`${logPrefix}   subscription_type: ${subscription.subscription_type}`);
  console.log(`${logPrefix}   user_id: ${subscription.user_id}`);

  try {
    // Update subscription
    const { error: updateError } = await supabase
      .from('payment_subscriptions')
      .update({
        status: 'active',
        transaction_number: transactionNumber,
        last_billing_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error(`${logPrefix} Subscription update FAILED:`, updateError);
      throw new Error(`Subscription update failed: ${updateError.message}`);
    }

    console.log(`${logPrefix} Subscription updated successfully`);

    // Process based on subscription type
    switch (subscription.subscription_type) {
      case 'recurring_donation':
        await handleRecurringDonationSubscription(subscription, transactionNumber, logPrefix);
        break;

      case 'membership':
      case 'organization_membership':
        await handleMembershipSubscription(subscription, logPrefix);
        break;

      default:
        console.log(`${logPrefix} No specific handling for subscription_type: ${subscription.subscription_type}`);
    }

    console.log(`${logPrefix} Subscription payment processing completed successfully`);
  } catch (error) {
    console.error(`${logPrefix} Subscription payment processing ERROR:`, error);
    throw error;
  }
}

/**
 * Handle event registration payment
 */
async function handleEventRegistration(
  transaction: any,
  transactionNumber: string,
  logPrefix: string
) {
  if (!transaction.reference_id) {
    console.warn(`${logPrefix} Event registration has no reference_id, skipping update`);
    return;
  }

  console.log(`${logPrefix} Updating event registration: ${transaction.reference_id}`);

  const { error: eventError } = await supabase
    .from('event_registrations')
    .update({
      payment_status: 'Completed',
      status: 'Registered',
      transaction_number: transactionNumber,
      amount_paid: transaction.amount,
    })
    .eq('id', transaction.reference_id);

  if (eventError) {
    console.error(`${logPrefix} Event registration update FAILED:`, eventError);
    throw new Error(`Event registration update failed: ${eventError.message}`);
  }

  console.log(`${logPrefix} Event registration updated successfully`);
}

/**
 * Handle donation payment
 */
async function handleDonation(
  transaction: any,
  transactionNumber: string,
  logPrefix: string
) {
  if (!transaction.reference_id) {
    console.warn(`${logPrefix} Donation has no reference_id, skipping update`);
    return;
  }

  console.log(`${logPrefix} Updating donation: ${transaction.reference_id}`);

  const { error: donationError } = await supabase
    .from('donations')
    .update({
      payment_status: 'completed',
      completed_at: new Date().toISOString(),
      transaction_number: transactionNumber,
    })
    .eq('id', transaction.reference_id);

  if (donationError) {
    console.error(`${logPrefix} Donation update FAILED:`, donationError);
    throw new Error(`Donation update failed: ${donationError.message}`);
  }

  console.log(`${logPrefix} Donation updated successfully`);

  // Increment cause amount raised
  const { data: donation } = await supabase
    .from('donations')
    .select('cause_id')
    .eq('id', transaction.reference_id)
    .single();

  if (donation?.cause_id) {
    console.log(`${logPrefix} Incrementing cause amount for cause_id: ${donation.cause_id}`);

    const { error: incrementError } = await supabase.rpc('increment_cause_amount', {
      p_cause_id: donation.cause_id,
      p_amount: parseFloat(transaction.amount),
    });

    if (incrementError) {
      console.error(`${logPrefix} Cause increment FAILED:`, incrementError);
      // Don't throw - donation is already recorded, this is secondary
    } else {
      console.log(`${logPrefix} Cause amount incremented successfully`);
    }
  }
}

/**
 * Handle membership payment
 */
async function handleMembership(transaction: any, logPrefix: string) {
  if (!transaction.user_id) {
    console.warn(`${logPrefix} Membership has no user_id, skipping update`);
    return;
  }

  console.log(`${logPrefix} Updating user membership: ${transaction.user_id}`);

  // Check account type
  const { data: userData } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', transaction.user_id)
    .single();

  const expiresAt = transaction.metadata?.payment_subscriptions_id
    ? await resolveMembershipExpiryFromTransaction(transaction)
    : calculateNextBillingDate('monthly'); // Default to monthly

  await updateUserMembership(transaction.user_id, userData?.account_type, {
    expiresAt,
  }, logPrefix);

  console.log(`${logPrefix} User membership updated successfully`);
}

/**
 * Handle recurring donation payment
 */
async function handleRecurringDonation(
  transaction: any,
  transactionNumber: string,
  logPrefix: string
) {
  if (!transaction.reference_id) {
    console.warn(`${logPrefix} Recurring donation has no reference_id, skipping update`);
    return;
  }

  console.log(`${logPrefix} Processing recurring donation: ${transaction.reference_id}`);

  // Update recurring_donations status
  const { error: recurringUpdateError } = await supabase
    .from('recurring_donations')
    .update({ status: 'active' })
    .eq('id', transaction.reference_id);

  if (recurringUpdateError) {
    console.error(`${logPrefix} Recurring donation update FAILED:`, recurringUpdateError);
    throw new Error(`Recurring donation update failed: ${recurringUpdateError.message}`);
  }

  // Fetch recurring donation details
  const { data: recurringDonation, error: recurringFetchError } = await supabase
    .from('recurring_donations')
    .select('cause_id, is_anonymous')
    .eq('id', transaction.reference_id)
    .single();

  if (recurringFetchError) {
    console.error(`${logPrefix} Recurring donation fetch FAILED:`, recurringFetchError);
    throw new Error(`Recurring donation fetch failed: ${recurringFetchError.message}`);
  }

  if (recurringDonation) {
    // Create donation record for this recurring payment
    console.log(`${logPrefix} Creating donation record for recurring payment`);

    const { error: donationInsertError } = await supabase.from('donations').insert({
      cause_id: recurringDonation.cause_id,
      user_id: transaction.user_id,
      amount: transaction.amount,
      currency: 'JMD',
      is_anonymous: recurringDonation.is_anonymous,
      payment_status: 'completed',
      recurring_donation_id: transaction.reference_id,
      completed_at: new Date().toISOString(),
      transaction_number: transactionNumber,
    });

    if (donationInsertError) {
      console.error(`${logPrefix} Donation creation FAILED:`, donationInsertError);
      throw new Error(`Donation creation failed: ${donationInsertError.message}`);
    }

    console.log(`${logPrefix} Donation record created successfully`);

    // Increment cause amount raised
    const { error: incrementError } = await supabase.rpc('increment_cause_amount', {
      p_cause_id: recurringDonation.cause_id,
      p_amount: parseFloat(transaction.amount),
    });

    if (incrementError) {
      console.error(`${logPrefix} Cause increment FAILED:`, incrementError);
      // Don't throw - donation is already created
    } else {
      console.log(`${logPrefix} Cause amount incremented successfully`);
    }
  }

  console.log(`${logPrefix} Recurring donation processing complete`);
}

/**
 * Handle recurring donation subscription payment
 */
async function handleRecurringDonationSubscription(
  subscription: any,
  transactionNumber: string,
  logPrefix: string
) {
  console.log(`${logPrefix} Processing recurring donation subscription payment`);

  // reference_id should point to recurring_donations record
  if (!subscription.reference_id) {
    console.warn(`${logPrefix} Recurring donation subscription has no reference_id`);
    return;
  }

  // Update recurring_donations status
  const { error: recurringUpdateError } = await supabase
    .from('recurring_donations')
    .update({ status: 'active' })
    .eq('id', subscription.reference_id);

  if (recurringUpdateError) {
    console.error(`${logPrefix} Recurring donation update FAILED:`, recurringUpdateError);
    throw new Error(`Recurring donation update failed: ${recurringUpdateError.message}`);
  }

  // Fetch recurring donation details
  const { data: recurringDonation, error: recurringFetchError } = await supabase
    .from('recurring_donations')
    .select('cause_id, is_anonymous')
    .eq('id', subscription.reference_id)
    .single();

  if (recurringFetchError) {
    console.error(`${logPrefix} Recurring donation fetch FAILED:`, recurringFetchError);
    throw new Error(`Recurring donation fetch failed: ${recurringFetchError.message}`);
  }

  if (recurringDonation) {
    // Create donation record for this subscription payment
    const { error: donationInsertError } = await supabase.from('donations').insert({
      cause_id: recurringDonation.cause_id,
      user_id: subscription.user_id,
      amount: subscription.amount,
      currency: 'JMD',
      is_anonymous: recurringDonation.is_anonymous,
      payment_status: 'completed',
      recurring_donation_id: subscription.reference_id,
      completed_at: new Date().toISOString(),
      transaction_number: transactionNumber,
    });

    if (donationInsertError) {
      console.error(`${logPrefix} Donation creation FAILED:`, donationInsertError);
      throw new Error(`Donation creation failed: ${donationInsertError.message}`);
    }

    // Increment cause amount
    const { error: incrementError } = await supabase.rpc('increment_cause_amount', {
      p_cause_id: recurringDonation.cause_id,
      p_amount: parseFloat(subscription.amount),
    });

    if (incrementError) {
      console.error(`${logPrefix} Cause increment FAILED:`, incrementError);
      // Don't throw
    }
  }

  console.log(`${logPrefix} Recurring donation subscription processed successfully`);
}

/**
 * Handle membership subscription payment
 */
async function handleMembershipSubscription(subscription: any, logPrefix: string) {
  console.log(`${logPrefix} Processing membership subscription payment`);

  const { data: userData } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', subscription.user_id)
    .single();

  const expiresAt = subscription.next_billing_date || calculateNextBillingDate(subscription.frequency);

  await updateUserMembership(subscription.user_id, userData?.account_type, {
    expiresAt,
  }, logPrefix);

  console.log(`${logPrefix} Membership subscription processed successfully`);
}

/**
 * Calculate next billing date based on frequency
 */
function calculateNextBillingDate(frequency: string): string {
  const now = new Date();
  switch (frequency.toLowerCase()) {
    case 'daily': now.setDate(now.getDate() + 1); break;
    case 'weekly': now.setDate(now.getDate() + 7); break;
    case 'monthly': now.setMonth(now.getMonth() + 1); break;
    case 'quarterly': now.setMonth(now.getMonth() + 3); break;
    case 'annually': now.setFullYear(now.getFullYear() + 1); break;
  }
  return now.toISOString().split('T')[0];
}

/**
 * Resolve membership expiry from transaction metadata
 */
async function resolveMembershipExpiryFromTransaction(transaction: any): Promise<string | null> {
  if (transaction.metadata?.payment_subscriptions_id) {
    const { data } = await supabase
      .from('payment_subscriptions')
      .select('next_billing_date')
      .eq('id', transaction.metadata.payment_subscriptions_id)
      .single();

    if (data?.next_billing_date) {
      return data.next_billing_date;
    }
  }

  if (transaction.metadata?.frequency) {
    return calculateNextBillingDate(transaction.metadata.frequency);
  }

  return null;
}

/**
 * Update user membership fields
 */
async function updateUserMembership(
  userId: string,
  accountType: string | null | undefined,
  options: { expiresAt?: string | null } = {},
  logPrefix: string
) {
  console.log(`${logPrefix} Updating user membership for user: ${userId}`);

  const updateData: Record<string, any> = {
    membership_status: 'active',
    subscription_start_date: new Date().toISOString(),
  };

  if (accountType === 'organization') {
    updateData.is_partner_organization = true;
  } else {
    updateData.is_premium = true;
    updateData.membership_tier = 'premium';
  }

  if (options.expiresAt) {
    updateData.membership_expires_at = options.expiresAt;
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error(`${logPrefix} User membership update FAILED:`, error);
    throw new Error(`User membership update failed: ${error.message}`);
  }

  console.log(`${logPrefix} User membership updated:`, updateData);
}

/**
 * Map order type to receipt type
 */
function mapOrderTypeToReceiptType(orderType: string): 'donation' | 'subscription' | 'event' | 'membership' {
  const mapping: Record<string, 'donation' | 'subscription' | 'event' | 'membership'> = {
    donation: 'donation',
    recurring_donation: 'subscription',
    event_registration: 'event',
    membership: 'membership',
    organization_membership: 'membership',
  };
  return mapping[orderType] || 'donation';
}

/**
 * Generate line items for receipt
 */
function generateLineItemsFromTransaction(transaction: any) {
  return [{
    description: transaction.description || `${transaction.order_type} payment`,
    quantity: 1,
    unitPrice: parseFloat(transaction.amount),
    amount: parseFloat(transaction.amount),
  }];
}

/**
 * Calculate eZeePayments processing fee
 */
function calculateProcessingFee(amount: number): number {
  // eZeePayments fee: 3% or minimum $135 JMD
  return Math.max(135, amount * 0.03);
}

/**
 * Generate receipt for transaction
 */
async function generateReceiptForTransaction(
  transaction: any,
  transactionNumber: string,
  logPrefix: string
) {
  console.log(`${logPrefix} Generating receipt for transaction: ${transaction.id}`);

  if (!transactionNumber || !transaction.customer_email) {
    console.warn(`${logPrefix} Cannot generate receipt: missing transaction_number or customer_email`);
    return;
  }

  try {
    await ReceiptService.createReceipt({
      transactionId: transaction.id,
      transactionNumber: transactionNumber,
      customerName: transaction.customer_name || 'Customer',
      customerEmail: transaction.customer_email,
      receiptType: mapOrderTypeToReceiptType(transaction.order_type),
      lineItems: generateLineItemsFromTransaction(transaction),
      subtotal: parseFloat(transaction.amount),
      processingFee: calculateProcessingFee(parseFloat(transaction.amount)),
      totalAmount: parseFloat(transaction.amount),
      paymentMethod: 'Credit Card',
    });

    console.log(`${logPrefix} Receipt generated successfully`);
  } catch (error) {
    console.error(`${logPrefix} Receipt generation FAILED:`, error);
    // Don't throw - receipt generation is secondary to payment processing
  }
}
