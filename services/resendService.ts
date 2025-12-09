/**
 * Resend Email Service
 * Handles sending transactional emails via Resend API
 */

const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email via Resend
 */
async function sendEmail(emailData: EmailData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!RESEND_API_KEY) {
      console.error('[RESEND] API key not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: emailData.from || 'VIbe <onboarding@resend.dev>',
        to: [emailData.to],
        subject: emailData.subject,
        html: emailData.html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[RESEND] API Error:', errorData);
      return { 
        success: false, 
        error: `Failed to send email: ${response.status}` 
      };
    }

    const data = await response.json();
    console.log('[RESEND] Email sent successfully:', data.id);
    
    return { success: true };
  } catch (error: any) {
    console.error('[RESEND] Error sending email:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send email' 
    };
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string, 
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  const firstName = fullName.split(' ')[0] || 'there';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to VIbe! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Welcome to the VIbe community! We're thrilled to have you join our network of volunteers making a difference in Jamaica and beyond.</p>
            <p>With VIbe, you can:</p>
            <ul>
              <li>🤝 Connect with volunteer opportunities</li>
              <li>📅 Register for events</li>
              <li>💬 Network with other volunteers</li>
              <li>🎯 Track your volunteer hours and impact</li>
            </ul>
            <p>Ready to get started? Open the VIbe app and explore what's happening in your community!</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Happy volunteering!</p>
            <p><strong>The VIbe Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} VIbe - Volunteers Incorporated. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to VIbe! 🎉',
    html,
  });
}

/**
 * Send email confirmation with verification link
 */
export async function sendEmailConfirmation(
  email: string, 
  fullName: string,
  confirmationUrl: string
): Promise<{ success: boolean; error?: string }> {
  const firstName = fullName.split(' ')[0] || 'there';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email Address</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Thanks for signing up for VIbe! Please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${confirmationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">${confirmationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account with VIbe, you can safely ignore this email.</p>
            <p><strong>The VIbe Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} VIbe - Volunteers Incorporated. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify your VIbe email address',
    html,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string, 
  fullName: string,
  resetUrl: string
): Promise<{ success: boolean; error?: string }> {
  const firstName = fullName.split(' ')[0] || 'there';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your VIbe password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
            <p><strong>The VIbe Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} VIbe - Volunteers Incorporated. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset your VIbe password',
    html,
  });
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
  const firstName = fullName.split(' ')[0] || 'there';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #9C27B0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .event-details { background: white; padding: 20px; border-left: 4px solid #9C27B0; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Event Registration Confirmed! 🎟️</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Great news! You're registered for the following event:</p>
            <div class="event-details">
              <h2 style="margin-top: 0; color: #9C27B0;">${eventName}</h2>
              <p><strong>📅 Date:</strong> ${eventDate}</p>
              <p><strong>📍 Location:</strong> ${eventLocation}</p>
            </div>
            <p>We're excited to see you there! Make sure to check your VIbe app for any updates about the event.</p>
            <p>If you need to cancel your registration, you can do so through the VIbe app.</p>
            <p>See you soon!</p>
            <p><strong>The VIbe Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} VIbe - Volunteers Incorporated. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Event Confirmed: ${eventName}`,
    html,
  });
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
  const firstName = fullName.split(' ')[0] || 'there';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .receipt { background: white; padding: 20px; border: 1px solid #ddd; margin: 20px 0; }
          .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .receipt-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt 💳</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Thank you for your payment! Here's your receipt:</p>
            <div class="receipt">
              <div class="receipt-row">
                <span>Description:</span>
                <span>${description}</span>
              </div>
              <div class="receipt-row">
                <span>Date:</span>
                <span>${date}</span>
              </div>
              <div class="receipt-row">
                <span>Transaction ID:</span>
                <span>${transactionId}</span>
              </div>
              <div class="receipt-row">
                <span>Amount Paid:</span>
                <span>${amount}</span>
              </div>
            </div>
            <p>This payment has been successfully processed. You can view your payment history in the VIbe app.</p>
            <p>If you have any questions about this payment, please contact our support team.</p>
            <p><strong>The VIbe Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} VIbe - Volunteers Incorporated. All rights reserved.</p>
            <p>Keep this receipt for your records.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Payment Receipt - VIbe',
    html,
  });
}

