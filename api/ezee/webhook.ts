/**
 * Vercel API Route: /api/ezee/webhook.ts
 * Handles payment confirmations from eZeePayments
 * WITH CORS SUPPORT
 * Uses official eZeePayments webhook format
 */

import { createClient } from '@supabase/supabase-js';
import { ReceiptService } from '../../services/receiptService';

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

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const headers = typeof req.headers === 'object' ? req.headers : {};

    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // eZeePayments webhook format
    const {
      ResponseCode,           // 1 = success, other = failure
      ResponseDescription,    // "Transaction is approved" or error message
      TransactionNumber,      // Reference for reconciliation
      CustomOrderId,          // The uniqueOrderId we sent to eZeePayments
      order_id,              // May also be present, but CustomOrderId is primary
      amount,
      subscription_id,        // For recurring payments
    } = body;

    // Get order ID from webhook - eZeePayments sends it as CustomOrderId
    const customOrderId = CustomOrderId || order_id;

    // Log webhook to database
    const { data: webhookRecord, error: logError } = await supabase
      .from('payment_webhooks')
      .insert({
      event_type: subscription_id ? 'subscription_payment' : 'one_time_payment',
        transaction_number: TransactionNumber || null,
      payload: body,
      headers,
      processed: false,
      })
      .select()
      .single();

    if (logError) {
      console.error('Webhook log error:', logError);
    }

    // ResponseCode: 1 = success, other = failure
    const isSuccessful = ResponseCode === 1 || ResponseCode === '1';

    // Handle one-time payment
    if (customOrderId && TransactionNumber) {
      // First, try to find the transaction
      const { data: existingTransaction, error: findError } = await supabase
        .from('payment_transactions')
        .select('*, metadata')
        .eq('order_id', customOrderId)
        .maybeSingle();

      if (findError) {
        console.error('Error finding transaction:', findError);
        console.error('Looking for order_id:', customOrderId);
      }

      // Update transaction if it exists
      if (existingTransaction) {
        const { data: transaction, error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            status: isSuccessful ? 'completed' : 'failed',
            transaction_number: TransactionNumber,
            response_code: ResponseCode?.toString() || null,
            response_description: ResponseDescription || null,
            updated_at: new Date().toISOString(),
            completed_at: isSuccessful ? new Date().toISOString() : null,
          })
          .eq('id', existingTransaction.id)
          .select('*, metadata')
          .single();

        if (updateError) {
          console.error('Transaction update error:', updateError);
          console.error('Transaction ID:', existingTransaction.id);
          console.error('Webhook body:', JSON.stringify(body, null, 2));
        } else if (transaction && isSuccessful) {
          try {
            await handleSuccessfulPayment(transaction);
            // Verify donation was updated
            if (transaction.order_type === 'donation' && transaction.reference_id) {
              const { data: verifyDonation } = await supabase
                .from('donations')
                .select('payment_status, completed_at, transaction_number')
                .eq('id', transaction.reference_id)
                .single();
              
              if (verifyDonation && verifyDonation.payment_status !== 'completed') {
                console.error('⚠️ Donation update verification failed!', {
                  donationId: transaction.reference_id,
                  status: verifyDonation.payment_status,
                });
                // Retry the update
                await supabase
                  .from('donations')
                  .update({
                    payment_status: 'completed',
                    completed_at: new Date().toISOString(),
                    transaction_number: transaction.transaction_number || null,
                  })
                  .eq('id', transaction.reference_id);
              }
            }
          } catch (paymentError) {
            console.error('Error in handleSuccessfulPayment:', paymentError);
            // Don't throw - we've already updated the transaction
          }
        }
      } else {
        console.error('Transaction not found for order_id:', customOrderId);
        console.error('Webhook body:', JSON.stringify(body, null, 2));
        // Try to find by transaction_number as fallback
        const { data: transactionByNumber } = await supabase
          .from('payment_transactions')
          .select('*, metadata')
          .eq('transaction_number', TransactionNumber)
          .maybeSingle();

        if (transactionByNumber && isSuccessful) {
          console.log('Found transaction by transaction_number, updating...');
          const { data: updatedTransaction, error: updateError } = await supabase
            .from('payment_transactions')
            .update({
              status: 'completed',
              transaction_number: TransactionNumber,
              response_code: ResponseCode?.toString() || null,
              response_description: ResponseDescription || null,
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            })
            .eq('id', transactionByNumber.id)
            .select('*, metadata')
            .single();

          if (!updateError && updatedTransaction) {
            try {
              await handleSuccessfulPayment(updatedTransaction);
              // Verify payment was processed (same verification as above)
              if (updatedTransaction.order_type === 'donation' && updatedTransaction.reference_id) {
                const { data: verifyDonation } = await supabase
                  .from('donations')
                  .select('payment_status, completed_at, transaction_number')
                  .eq('id', updatedTransaction.reference_id)
                  .single();
                
                if (verifyDonation && verifyDonation.payment_status !== 'completed') {
                  console.error('⚠️ Donation update verification failed (fallback)!', {
                    donationId: updatedTransaction.reference_id,
                    status: verifyDonation.payment_status,
                  });
                  // Retry the update
                  await supabase
                    .from('donations')
                    .update({
                      payment_status: 'completed',
                      completed_at: new Date().toISOString(),
                      transaction_number: updatedTransaction.transaction_number || null,
                    })
                    .eq('id', updatedTransaction.reference_id);
                }
              } else if (updatedTransaction.order_type === 'event_registration' && updatedTransaction.reference_id) {
                const { data: verifyEvent } = await supabase
                  .from('event_registrations')
                  .select('payment_status, status, transaction_number')
                  .eq('id', updatedTransaction.reference_id)
                  .single();
                
                if (verifyEvent && verifyEvent.payment_status !== 'paid') {
                  console.error('⚠️ Event registration update verification failed (fallback)!', {
                    registrationId: updatedTransaction.reference_id,
                    paymentStatus: verifyEvent.payment_status,
                  });
                  // Retry the update
                  await supabase
                    .from('event_registrations')
                    .update({
                      payment_status: 'paid',
                      status: 'confirmed',
                      transaction_number: updatedTransaction.transaction_number || null,
                    })
                    .eq('id', updatedTransaction.reference_id);
                }
              }
            } catch (paymentError) {
              console.error('Error in handleSuccessfulPayment (fallback):', paymentError);
            }
          }
        }
      }
    }

    // Handle subscription payment
    if (subscription_id) {
      const { data: subscription, error: subUpdateError } = await supabase
        .from('payment_subscriptions')
        .update({
          status: isSuccessful ? 'active' : 'failed',
          transaction_number: TransactionNumber || null,
          last_billing_date: isSuccessful ? new Date().toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq('ezee_subscription_id', subscription_id)
        .select()
        .single();

      if (subUpdateError) {
        console.error('Subscription update error:', subUpdateError);
      }

      if (subscription && isSuccessful) {
        // Calculate next billing date
        const nextBillingDate = calculateNextBillingDate(subscription.frequency);
        await supabase
          .from('payment_subscriptions')
          .update({ next_billing_date: nextBillingDate })
          .eq('id', subscription.id);

        try {
          await handleSuccessfulSubscriptionPayment(subscription);
          
          // Verify subscription payment was processed correctly
          const { data: verifySubPayment } = await supabase
            .from('payment_subscriptions')
            .select('status, transaction_number, last_billing_date')
            .eq('id', subscription.id)
            .single();

          if (verifySubPayment && verifySubPayment.status !== 'active') {
            console.error('⚠️ Subscription payment verification failed!', {
              subscriptionId: subscription.id,
              status: verifySubPayment.status,
            });
            // Retry the update
            await supabase
              .from('payment_subscriptions')
              .update({
                status: 'active',
                transaction_number: TransactionNumber || null,
                last_billing_date: new Date().toISOString().split('T')[0],
                updated_at: new Date().toISOString(),
                next_billing_date: nextBillingDate,
              })
              .eq('id', subscription.id);
          }
        } catch (subscriptionError) {
          console.error('Error in handleSuccessfulSubscriptionPayment:', subscriptionError);
          // Don't throw - we've already updated the subscription
        }
      }
    }

    // Update webhook as processed
    if (webhookRecord?.id) {
      await supabase
        .from('payment_webhooks')
        .update({ 
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecord.id);
    } else if (TransactionNumber) {
      // Fallback: update by transaction_number if ID not available
      await supabase
        .from('payment_webhooks')
        .update({ 
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('transaction_number', TransactionNumber);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleSuccessfulPayment(transaction: any) {
  const { order_type, reference_id, amount } = transaction;

  switch (order_type) {
    case 'donation':
      // Update donation status with all required fields
      const { error: donationUpdateError } = await supabase
        .from('donations')
        .update({
          payment_status: 'completed',
          completed_at: new Date().toISOString(),
          transaction_number: transaction.transaction_number || null,
        })
        .eq('id', reference_id);

      if (donationUpdateError) {
        console.error('Error updating donation status:', donationUpdateError);
        console.error('Donation ID:', reference_id);
        throw donationUpdateError;
      }

      // Fetch donation to get cause_id for amount increment
      const { data: donation, error: donationFetchError } = await supabase
        .from('donations')
        .select('cause_id')
        .eq('id', reference_id)
        .single();

      if (donationFetchError) {
        console.error('Error fetching donation:', donationFetchError);
        throw donationFetchError;
      }

      // Increment cause amount raised
      if (donation?.cause_id) {
        const { error: incrementError } = await supabase.rpc('increment_cause_amount', {
          p_cause_id: donation.cause_id,
          p_amount: amount,
        });

        if (incrementError) {
          console.error('Error incrementing cause amount:', incrementError);
          // Don't throw here - donation is already marked as complete
        }
      }
      break;

    case 'event_registration':
      // Update event registration with all required fields
      const { error: eventUpdateError } = await supabase
        .from('event_registrations')
        .update({ 
          payment_status: 'paid', 
          status: 'confirmed',
          transaction_number: transaction.transaction_number || null,
        })
        .eq('id', reference_id);

      if (eventUpdateError) {
        console.error('Error updating event registration status:', eventUpdateError);
        console.error('Event Registration ID:', reference_id);
        throw eventUpdateError;
      }

      // Verify event registration was updated
      const { data: verifyEvent } = await supabase
        .from('event_registrations')
        .select('payment_status, status, transaction_number')
        .eq('id', reference_id)
        .single();

      if (verifyEvent && verifyEvent.payment_status !== 'paid') {
        console.error('⚠️ Event registration update verification failed!', {
          registrationId: reference_id,
          paymentStatus: verifyEvent.payment_status,
        });
        // Retry the update
        await supabase
          .from('event_registrations')
          .update({ 
            payment_status: 'paid', 
            status: 'confirmed',
            transaction_number: transaction.transaction_number || null,
          })
          .eq('id', reference_id);
      }
      break;

    case 'membership':
    case 'organization_membership':  // NEW: Handle organization memberships
      // Update payment_subscriptions status if linked via metadata
      if (transaction.metadata?.payment_subscriptions_id) {
        const { error: subscriptionUpdateError } = await supabase
          .from('payment_subscriptions')
          .update({ 
            status: 'active',
            transaction_number: transaction.transaction_number || null,
            last_billing_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.metadata.payment_subscriptions_id);

        if (subscriptionUpdateError) {
          console.error('Error updating payment subscription:', subscriptionUpdateError);
          throw subscriptionUpdateError;
        }

        // Verify subscription was updated
        const { data: verifySubscription } = await supabase
          .from('payment_subscriptions')
          .select('status, transaction_number, last_billing_date')
          .eq('id', transaction.metadata.payment_subscriptions_id)
          .single();

        if (verifySubscription && verifySubscription.status !== 'active') {
          console.error('⚠️ Subscription update verification failed!', {
            subscriptionId: transaction.metadata.payment_subscriptions_id,
            status: verifySubscription.status,
          });
          // Retry the update
          await supabase
            .from('payment_subscriptions')
            .update({ 
              status: 'active',
              transaction_number: transaction.transaction_number || null,
              last_billing_date: new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('id', transaction.metadata.payment_subscriptions_id);
        }
      }
      
      // Update user membership status
      if (transaction.user_id) {
        // Check if this is an organization account
        const { data: userData } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', transaction.user_id)
          .single();

        const expiresAt = await resolveMembershipExpiryFromTransaction(transaction);
        await updateUserMembership(transaction.user_id, userData?.account_type, {
          expiresAt,
        });
      }
      break;

    case 'recurring_donation':
      // Update payment_subscriptions status if linked via metadata
      let causeId: string | null = null;
      
      if (transaction.metadata?.payment_subscriptions_id) {
        // Update subscription status
        const { error: subscriptionUpdateError } = await supabase
          .from('payment_subscriptions')
          .update({ 
            status: 'active',
            transaction_number: transaction.transaction_number || null,
            last_billing_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.metadata.payment_subscriptions_id);

        if (subscriptionUpdateError) {
          console.error('Error updating recurring donation subscription:', subscriptionUpdateError);
          throw subscriptionUpdateError;
        }

        // Verify subscription was updated
        const { data: verifySubscription } = await supabase
          .from('payment_subscriptions')
          .select('status, transaction_number, last_billing_date')
          .eq('id', transaction.metadata.payment_subscriptions_id)
          .single();

        if (verifySubscription && verifySubscription.status !== 'active') {
          console.error('⚠️ Recurring donation subscription update verification failed!', {
            subscriptionId: transaction.metadata.payment_subscriptions_id,
            status: verifySubscription.status,
          });
          // Retry the update
          await supabase
            .from('payment_subscriptions')
            .update({ 
              status: 'active',
              transaction_number: transaction.transaction_number || null,
              last_billing_date: new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('id', transaction.metadata.payment_subscriptions_id);
        }

        // Get the payment_subscriptions record to find the donation/cause
        const { data: paymentSub } = await supabase
          .from('payment_subscriptions')
          .select('reference_id')
          .eq('id', transaction.metadata.payment_subscriptions_id)
          .single();

        if (paymentSub?.reference_id) {
          // Look up the donation to get cause_id
          const { data: donation } = await supabase
            .from('donations')
            .select('cause_id')
            .eq('id', paymentSub.reference_id)
            .single();

          if (donation?.cause_id) {
            causeId = donation.cause_id;
          }
        }
      }

      // Fallback: try to get cause_id from metadata or reference_id directly
      if (!causeId) {
        causeId = transaction.metadata?.reference_id || transaction.reference_id;
      }
      
      if (causeId) {
        // Create a donation record for this recurring payment
        const { error: donationInsertError } = await supabase.from('donations').insert({
          cause_id: causeId,
          user_id: transaction.user_id,
          amount: transaction.amount,
          currency: 'JMD',
          payment_status: 'completed',
          transaction_number: transaction.transaction_number || null,
          completed_at: new Date().toISOString(),
        });

        if (donationInsertError) {
          console.error('Error creating recurring donation record:', donationInsertError);
          throw donationInsertError;
        }

        // Increment cause amount raised
        const { error: incrementError } = await supabase.rpc('increment_cause_amount', {
          p_cause_id: causeId,
          p_amount: transaction.amount,
        });

        if (incrementError) {
          console.error('Error incrementing cause amount:', incrementError);
          // Don't throw here - donation is already created
        }
      }
      break;
  }

  console.log(`Successfully processed ${order_type} payment for ${reference_id}`);

  // Generate receipt after successful payment processing
  try {
    await generateReceiptForTransaction(transaction);
  } catch (receiptError) {
    console.error('Receipt generation error:', receiptError);
    // Don't fail the payment if receipt fails
  }
}

async function handleSuccessfulSubscriptionPayment(subscription: any) {
  const { subscription_type, reference_id, user_id, amount } = subscription;

  switch (subscription_type) {
    case 'recurring_donation':
      // Update recurring donation status
      const { error: recurringUpdateError } = await supabase
        .from('recurring_donations')
        .update({ status: 'active' })
        .eq('id', reference_id);

      if (recurringUpdateError) {
        console.error('Error updating recurring donation status:', recurringUpdateError);
        throw recurringUpdateError;
      }

      // Fetch recurring donation details
      const { data: recurringDonation, error: recurringFetchError } = await supabase
        .from('recurring_donations')
        .select('cause_id, is_anonymous')
        .eq('id', reference_id)
        .single();

      if (recurringFetchError) {
        console.error('Error fetching recurring donation:', recurringFetchError);
        throw recurringFetchError;
      }

      if (recurringDonation) {
        // Create donation record for this recurring payment
        const { error: donationInsertError } = await supabase.from('donations').insert({
          cause_id: recurringDonation.cause_id,
          user_id,
          amount,
          currency: 'JMD',
          is_anonymous: recurringDonation.is_anonymous,
          payment_status: 'completed',
          recurring_donation_id: reference_id,
          completed_at: new Date().toISOString(),
        });

        if (donationInsertError) {
          console.error('Error creating donation from recurring payment:', donationInsertError);
          throw donationInsertError;
        }

        // Verify donation was created correctly
        const { data: verifyDonation } = await supabase
          .from('donations')
          .select('id, payment_status, completed_at, transaction_number')
          .eq('recurring_donation_id', reference_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verifyDonation && verifyDonation.payment_status !== 'completed') {
          console.error('⚠️ Recurring donation payment verification failed!', {
            recurringDonationId: reference_id,
            donationStatus: verifyDonation.payment_status,
          });
          // Retry the update if we can find the donation
          if (verifyDonation.id) {
            await supabase
              .from('donations')
              .update({
                payment_status: 'completed',
                completed_at: new Date().toISOString(),
                transaction_number: subscription.transaction_number || null,
              })
              .eq('id', verifyDonation.id);
          }
        }

        // Increment cause amount raised
        const { error: incrementError } = await supabase.rpc('increment_cause_amount', {
          p_cause_id: recurringDonation.cause_id,
          p_amount: amount,
        });

        if (incrementError) {
          console.error('Error incrementing cause amount:', incrementError);
          // Don't throw here - donation is already created
        }
      }
      break;

    case 'membership':
    case 'organization_membership':  // NEW: Handle organization memberships
      // Check if this is an organization account
      const { data: userData } = await supabase
        .from('users')
        .select('account_type')
        .eq('id', user_id)
        .single();

      const expiresAt = subscription.next_billing_date || calculateNextBillingDate(subscription.frequency);
      await updateUserMembership(user_id, userData?.account_type, {
        expiresAt,
      });
      break;
  }

  console.log(`Successfully processed ${subscription_type} subscription payment`);
}

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

async function updateUserMembership(
  userId: string,
  accountType: string | null | undefined,
  options: { expiresAt?: string | null } = {}
) {
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

  await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);
}

// ==================== RECEIPT GENERATION ====================

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

function generateLineItemsFromTransaction(transaction: any) {
  return [{
    description: transaction.description || `${transaction.order_type} payment`,
    quantity: 1,
    unitPrice: parseFloat(transaction.amount),
    amount: parseFloat(transaction.amount),
  }];
}

function calculateProcessingFee(amount: number): number {
  // eZeePayments fee structure: 3% or minimum $135 JMD
  return Math.max(135, amount * 0.03);
}

async function generateReceiptForTransaction(transaction: any) {
  try {
    if (!transaction.transaction_number || !transaction.customer_email) {
      console.warn('Cannot generate receipt: missing transaction_number or customer_email');
      return;
    }

    await ReceiptService.createReceipt({
      transactionId: transaction.id,
      transactionNumber: transaction.transaction_number,
      customerName: transaction.customer_name || 'Customer',
      customerEmail: transaction.customer_email,
      receiptType: mapOrderTypeToReceiptType(transaction.order_type),
      lineItems: generateLineItemsFromTransaction(transaction),
      subtotal: parseFloat(transaction.amount),
      processingFee: calculateProcessingFee(parseFloat(transaction.amount)),
      totalAmount: parseFloat(transaction.amount),
      paymentMethod: 'Credit Card',
    });

    console.log(`Receipt generated for transaction ${transaction.transaction_number}`);
  } catch (error) {
    console.error('Error generating receipt:', error);
    throw error;
  }
}
