/**
 * Resend Email Service
 * Calls Supabase Edge Function to send transactional emails via Resend API
 */

import { supabase } from './supabase';

const RESEND_API_KEY =
  (typeof Deno !== 'undefined' ? Deno.env.get('RESEND_API_KEY') : null) ||
  (typeof process !== 'undefined' ? process.env.RESEND_API_KEY : null) ||
  (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_RESEND_API_KEY : null);

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string, 
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const firstName = fullName.split(' ')[0] || 'there';
    
    console.log('[RESEND] Sending welcome email...');

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'welcome',
        to: email,
        data: { firstName },
      },
    });

    if (error) {
      console.error('[RESEND] Edge Function error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      console.error('[RESEND] Email failed:', data.error);
      return { success: false, error: data.error };
    }

    console.log('[RESEND] Welcome email sent successfully');
    return { success: true };

  } catch (error: any) {
    console.error('[RESEND] Error calling Edge Function:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send email' 
    };
  }
}

/**
 * Send email confirmation with verification link
 */
export async function sendEmailConfirmation(
  email: string, 
  fullName: string,
  confirmationUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const firstName = fullName.split(' ')[0] || 'there';
    
    console.log('[RESEND] Sending email confirmation...');

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'email_confirmation',
        to: email,
        data: { firstName, confirmationUrl },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data.success ? { success: true } : { success: false, error: data.error };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string, 
  fullName: string,
  resetUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const firstName = fullName.split(' ')[0] || 'there';
    
    console.log('[RESEND] Sending password reset email...');

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'password_reset',
        to: email,
        data: { firstName, resetUrl },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data.success ? { success: true } : { success: false, error: data.error };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send event confirmation email
 */
export async function sendEventConfirmationEmail(
  email: string, 
  fullName: string,
  eventName: string,
  eventDate: string,
  eventLocation: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const firstName = fullName.split(' ')[0] || 'there';
    
    console.log('[RESEND] Sending event confirmation email...');

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'event_confirmation',
        to: email,
        data: { 
          firstName, 
          eventName, 
          eventDate, 
          eventLocation 
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data.success ? { success: true } : { success: false, error: data.error };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send payment receipt email
 */
export async function sendPaymentReceiptEmail(
  email: string, 
  fullName: string,
  amount: string,
  transactionId: string,
  description: string,
  date: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const firstName = fullName.split(' ')[0] || 'there';
    
    console.log('[RESEND] Sending payment receipt email...');

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'payment_receipt',
        to: email,
        data: { 
          firstName, 
          amount, 
          transactionId, 
          description, 
          date 
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data.success ? { success: true } : { success: false, error: data.error };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
