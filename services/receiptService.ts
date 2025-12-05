/**
 * Receipt Service
 * Handles receipt generation and management for payments
 */

import { getSupabaseClient } from './supabase';

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ReceiptData {
  transactionId?: string;
  subscriptionId?: string;
  transactionNumber: string;
  customerName: string;
  customerEmail: string;
  receiptType: 'donation' | 'subscription' | 'event' | 'membership';
  lineItems: ReceiptLineItem[];
  subtotal: number;
  processingFee: number;
  totalAmount: number;
  paymentMethod?: string;
  billingAddress?: any;
}

export class ReceiptService {
  
  static generateReceiptNumber(): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const sequence = timestamp.toString().slice(-6);
    return `RCP-${year}-${sequence}${random}`;
  }

  static async createReceipt(data: ReceiptData) {
    try {
      const supabase = getSupabaseClient();
      const receiptNumber = this.generateReceiptNumber();
      
      const { data: receipt, error } = await supabase
        .from('receipts')
        .insert({
          transaction_id: data.transactionId || null,
          subscription_id: data.subscriptionId || null,
          transaction_number: data.transactionNumber,
          receipt_number: receiptNumber,
          receipt_type: data.receiptType,
          customer_name: data.customerName,
          customer_email: data.customerEmail,
          billing_address: data.billingAddress || null,
          subtotal: data.subtotal,
          processing_fee: data.processingFee,
          total_amount: data.totalAmount,
          currency: 'JMD',
          line_items: data.lineItems,
          payment_method: data.paymentMethod || 'Credit Card',
          status: 'generated',
        })
        .select()
        .single();

      if (error) {
        console.error('Receipt creation error:', error);
        throw new Error('Failed to create receipt');
      }

      // Try to send email (non-blocking)
      this.sendReceiptEmail(receipt).catch(err => {
        console.error('Email sending failed (non-critical):', err);
      });

      return receipt;
      
    } catch (error) {
      console.error('Receipt creation error:', error);
      throw error;
    }
  }

  private static async sendReceiptEmail(receipt: any) {
    try {
      const supabase = getSupabaseClient();
      const emailHtml = this.generateEmailTemplate(receipt);
      
      // TODO: Integrate with your email service (Resend, SendGrid, etc.)
      console.log(`Receipt email would be sent to: ${receipt.customer_email}`);
      console.log('Email HTML:', emailHtml);
      
      // For now, just mark as sent (you'll integrate actual email sending later)
      await supabase
        .from('receipts')
        .update({ 
          status: 'sent', 
          email_sent_at: new Date().toISOString() 
        })
        .eq('id', receipt.id);

    } catch (error) {
      console.error('Email error:', error);
      const supabase = getSupabaseClient();
      await supabase
        .from('receipts')
        .update({ status: 'failed' })
        .eq('id', receipt.id);
    }
  }

  private static generateEmailTemplate(receipt: any): string {
    const lineItemsHtml = receipt.line_items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.amount.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; border-bottom: 2px solid #38B6FF; padding-bottom: 20px;">
        <h1 style="color: #38B6FF;">Volunteers Inc</h1>
        <p>Payment Receipt</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h2>Receipt #${receipt.receipt_number}</h2>
        <p><strong>Date:</strong> ${new Date(receipt.issued_at).toLocaleDateString()}</p>
        <p><strong>Transaction:</strong> ${receipt.transaction_number}</p>
      </div>

      <div style="margin: 20px 0;">
        <h3>Billed To:</h3>
        <p><strong>${receipt.customer_name}</strong></p>
        <p>${receipt.customer_email}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #38B6FF; color: white;">
            <th style="padding: 12px; text-align: left;">Description</th>
            <th style="padding: 12px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>

      <div style="text-align: right; margin: 20px 0;">
        <p><strong>Subtotal:</strong> $${receipt.subtotal.toFixed(2)} JMD</p>
        ${receipt.processing_fee > 0 ? `<p><strong>Processing Fee:</strong> $${receipt.processing_fee.toFixed(2)} JMD</p>` : ''}
        <p style="font-size: 18px; color: #38B6FF;"><strong>Total: $${receipt.total_amount.toFixed(2)} JMD</strong></p>
      </div>

      <div style="text-align: center; border-top: 2px solid #eee; padding-top: 20px; color: #666;">
        <p>Thank you for your ${receipt.receipt_type === 'donation' ? 'donation' : 'payment'}!</p>
        <p style="font-size: 12px;">Questions? Contact support@volunteersinc.org</p>
      </div>
    </body>
    </html>
    `;
  }

  static async getUserReceipts(userEmail: string, limit = 20) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('customer_email', userEmail)
      .order('issued_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching receipts:', error);
      throw new Error('Failed to fetch receipts');
    }
    return data;
  }

  static async getReceipt(receiptNumber: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('receipt_number', receiptNumber)
      .single();

    if (error) {
      console.error('Error fetching receipt:', error);
      throw new Error('Receipt not found');
    }
    return data;
  }
}

