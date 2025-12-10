/**
 * Resend Email Service
 * Calls Supabase Edge Function to send transactional emails via Resend API
 */

import { supabase } from './supabase';

declare const Deno: any;

const globalProcess: any =
  typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
const RESEND_API_KEY: string | undefined = globalProcess?.env?.RESEND_API_KEY;

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
    console.log('[RESEND] Environment:', typeof Deno !== 'undefined' ? 'Deno/Edge' : 'Node.js');
    console.log('[RESEND] API Key exists?', !!RESEND_API_KEY);

    const isNodeEnv = !!globalProcess && typeof Deno === 'undefined';

    if (isNodeEnv && RESEND_API_KEY) {
      console.log('[RESEND] Calling Resend API directly...');
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'VIbe <noreply@volunteersinc.org>',
          to: [email],
          subject: 'Welcome to VIbe! 🎉',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6; 
                    color: #333; 
                    background: #f5f7fa;
                    padding: 20px;
                  }
                  .email-wrapper { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                  }
                  .logo-section {
                    background: white;
                    padding: 30px;
                    text-align: center;
                    border-bottom: 1px solid #e9ecef;
                  }
                  .logo { width: 80px; height: 80px; }
                  .header { 
                    background: linear-gradient(135deg, #4A90E2 0%, #5BA3F5 50%, #7BB8FF 100%); 
                    padding: 40px 30px;
                    text-align: center;
                    position: relative;
                  }
                  .header::after {
                    content: '';
                    position: absolute;
                    bottom: -20px;
                    left: 0;
                    right: 0;
                    height: 40px;
                    background: linear-gradient(135deg, #4A90E2 0%, #5BA3F5 50%, #7BB8FF 100%);
                    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 0);
                  }
                  .header h1 { 
                    color: white; 
                    font-size: 32px; 
                    font-weight: 700;
                    margin: 0;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .content { 
                    padding: 60px 40px 40px;
                    background: white;
                  }
                  .greeting { 
                    font-size: 24px; 
                    font-weight: 600; 
                    color: #2c3e50;
                    margin-bottom: 20px;
                  }
                  .intro-text {
                    font-size: 16px;
                    color: #555;
                    margin-bottom: 30px;
                    line-height: 1.8;
                  }
                  .features-grid {
                    display: grid;
                    gap: 20px;
                    margin: 30px 0;
                  }
                  .feature-card {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 20px;
                    border-radius: 10px;
                    border-left: 4px solid #4A90E2;
                    transition: transform 0.2s;
                  }
                  .feature-icon {
                    font-size: 24px;
                    margin-bottom: 8px;
                  }
                  .feature-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #2c3e50;
                    margin-bottom: 8px;
                  }
                  .feature-desc {
                    font-size: 14px;
                    color: #666;
                    line-height: 1.6;
                  }
                  .cta-container {
                    text-align: center;
                    margin: 40px 0 30px;
                  }
                  .cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
                    color: white;
                    padding: 16px 40px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
                    transition: all 0.3s;
                  }
                  .cta-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
                  }
                  .divider {
                    height: 1px;
                    background: linear-gradient(90deg, transparent, #ddd, transparent);
                    margin: 30px 0;
                  }
                  .footer {
                    background: #f8f9fa;
                    padding: 30px 40px;
                    text-align: center;
                    border-top: 1px solid #e9ecef;
                  }
                  .footer-text {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 15px;
                  }
                  .social-links {
                    margin: 20px 0;
                  }
                  .social-link {
                    display: inline-block;
                    margin: 0 10px;
                    color: #4A90E2;
                    text-decoration: none;
                    font-size: 14px;
                    font-weight: 500;
                  }
                  .contact-info {
                    font-size: 13px;
                    color: #999;
                    margin-top: 15px;
                  }
                </style>
              </head>
              <body>
                <div class="email-wrapper">
                  <div class="logo-section">
                    <img src="https://46485094.fs1.hubspotusercontent-na1.net/hubfs/46485094/icon.png" alt="VIbe Logo" class="logo">
                  </div>
                  <div class="header">
                    <h1>Welcome to VIbe! 🎉</h1>
                  </div>
                  
                  <div class="content">
                    <div class="greeting">Hi ${firstName}!</div>
                    
                    <p class="intro-text">
                      We're absolutely thrilled to have you join the VIbe community! You're now part of a growing network of passionate volunteers making a real difference in our communities.
                    </p>

                    <div class="features-grid">
                      <div class="feature-card">
                        <div class="feature-icon">🔍</div>
                        <div class="feature-title">Discover Opportunities</div>
                        <div class="feature-desc">Find volunteer opportunities that match your interests, skills, and location.</div>
                      </div>
                      
                      <div class="feature-card">
                        <div class="feature-icon">🤝</div>
                        <div class="feature-title">Connect & Collaborate</div>
                        <div class="feature-desc">Build meaningful connections with like-minded volunteers and organizations.</div>
                      </div>
                      
                      <div class="feature-card">
                        <div class="feature-icon">📊</div>
                        <div class="feature-title">Track Your Impact</div>
                        <div class="feature-desc">Monitor your volunteer hours, completed activities, and the difference you're making.</div>
                      </div>
                      
                      <div class="feature-card">
                        <div class="feature-icon">🎯</div>
                        <div class="feature-title">Join Events</div>
                        <div class="feature-desc">Participate in community events and initiatives that align with your passion.</div>
                      </div>
                    </div>

                    <div class="cta-container">
                      <a href="https://vibe.volunteersinc.org" class="cta-button">Start Your Journey</a>
                    </div>

                    <div class="divider"></div>

                    <p style="color: #666; font-size: 14px; text-align: center;">
                      Need help getting started? Our team is here to support you every step of the way.
                    </p>
                  </div>

                  <div class="footer">
                    <p class="footer-text">
                      <strong>VIbe - Volunteers Incorporated </strong><br>
                      Empowering communities through volunteer action
                    </p>
                    
                    <div class="social-links">
                      <a href="https://volunteersinc.org" class="social-link">🌐 Website</a>
                      <a href="mailto:info@volunteersinc.org" class="social-link">📧 Contact</a>
                    </div>
                    
                    <p class="contact-info">
                      © ${new Date().getFullYear()} Volunteers Incorporated. All rights reserved.
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        }),
      });

      console.log('[RESEND] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[RESEND] API Error:', errorData);
        return { success: false, error: `Resend API error: ${response.status}` };
      }

      const responseData = await response.json();
      console.log('[RESEND] ✅ Email sent successfully:', responseData.id);
      return { success: true };
    } else {
      console.log('[RESEND] Calling via Supabase Edge Function...');

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
    }

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
    console.log('[RESEND] Environment:', typeof Deno !== 'undefined' ? 'Deno/Edge' : 'Node.js');
    console.log('[RESEND] API Key exists?', !!RESEND_API_KEY);

    const isNodeEnv = !!globalProcess && typeof Deno === 'undefined';

    if (isNodeEnv && RESEND_API_KEY) {
      console.log('[RESEND] Calling Resend API directly...');

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'VIbe <noreply@volunteersinc.org>',
          to: [email],
          subject: `Event Confirmed: ${eventName}`.trim(),
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6; 
                    color: #333; 
                    background: #f5f7fa;
                    padding: 20px;
                  }
                  .email-wrapper { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                  }
                  .logo-section {
                    background: white;
                    padding: 30px;
                    text-align: center;
                    border-bottom: 1px solid #e9ecef;
                  }
                  .logo { width: 80px; height: 80px; }
                  .header { 
                    background: linear-gradient(135deg, #4A90E2 0%, #5BA3F5 50%, #7BB8FF 100%); 
                    padding: 40px 30px;
                    text-align: center;
                    position: relative;
                  }
                  .header::after {
                    content: '';
                    position: absolute;
                    bottom: -20px;
                    left: 0;
                    right: 0;
                    height: 40px;
                    background: linear-gradient(135deg, #4A90E2 0%, #5BA3F5 50%, #7BB8FF 100%);
                    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 0);
                  }
                  .header h1 { 
                    color: white; 
                    font-size: 28px; 
                    font-weight: 700;
                    margin: 0;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .success-badge {
                    display: inline-block;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    margin-top: 10px;
                  }
                  .content { 
                    padding: 60px 40px 40px;
                    background: white;
                  }
                  .greeting { 
                    font-size: 24px; 
                    font-weight: 600; 
                    color: #2c3e50;
                    margin-bottom: 20px;
                  }
                  .intro-text {
                    font-size: 16px;
                    color: #555;
                    margin-bottom: 30px;
                    line-height: 1.8;
                  }
                  .event-card {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 12px;
                    padding: 30px;
                    margin: 30px 0;
                    border: 2px solid #4A90E2;
                    position: relative;
                    overflow: hidden;
                  }
                  .event-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 5px;
                    height: 100%;
                    background: linear-gradient(180deg, #4A90E2 0%, #5BA3F5 100%);
                  }
                  .event-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #2c3e50;
                    margin-bottom: 20px;
                    padding-left: 15px;
                  }
                  .event-details {
                    display: grid;
                    gap: 15px;
                    padding-left: 15px;
                  }
                  .detail-row {
                    display: flex;
                    align-items: start;
                    font-size: 16px;
                    padding: 12px;
                    background: white;
                    border-radius: 8px;
                  }
                  .detail-icon {
                    font-size: 24px;
                    margin-right: 15px;
                    min-width: 30px;
                  }
                  .detail-content {
                    flex: 1;
                  }
                  .detail-label {
                    font-weight: 600;
                    color: #4A90E2;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                  }
                  .detail-value {
                    color: #2c3e50;
                    font-size: 16px;
                  }
                  .info-box {
                    background: #e3f2fd;
                    border-left: 4px solid #4A90E2;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 30px 0;
                  }
                  .info-box-title {
                    font-weight: 600;
                    color: #2c3e50;
                    margin-bottom: 10px;
                    font-size: 16px;
                  }
                  .info-box-text {
                    color: #555;
                    font-size: 14px;
                    line-height: 1.6;
                  }
                  .divider {
                    height: 1px;
                    background: linear-gradient(90deg, transparent, #ddd, transparent);
                    margin: 30px 0;
                  }
                  .footer {
                    background: #f8f9fa;
                    padding: 30px 40px;
                    text-align: center;
                    border-top: 1px solid #e9ecef;
                  }
                  .footer-text {
                    font-size: 14px;
                    color: #666;
                  }
                </style>
              </head>
              <body>
                <div class="email-wrapper">
                  <div class="logo-section">
                    <img src="https://46485094.fs1.hubspotusercontent-na1.net/hubfs/46485094/icon.png" alt="VIbe Logo" class="logo">
                  </div>
                  <div class="header">
                    <h1>Registration Confirmed!</h1>
                    <div class="success-badge">✓ You're All Set</div>
                  </div>
                  
                  <div class="content">
                    <div class="greeting">Hi ${firstName}! 👋</div>
                    
                    <p class="intro-text">
                      Fantastic news! Your registration has been confirmed. We're excited to see you at the event and can't wait for you to be part of this amazing experience!
                    </p>

                    <div class="event-card">
                      <div class="event-title">${eventName}</div>
                      
                      <div class="event-details">
                        <div class="detail-row">
                          <div class="detail-icon">📅</div>
                          <div class="detail-content">
                            <div class="detail-label">Date & Time</div>
                            <div class="detail-value">${eventDate}</div>
                          </div>
                        </div>
                        
                        <div class="detail-row">
                          <div class="detail-icon">📍</div>
                          <div class="detail-content">
                            <div class="detail-label">Location</div>
                            <div class="detail-value">${eventLocation}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="info-box">
                      <div class="info-box-title">⏰ Important Reminders</div>
                      <div class="info-box-text">
                        • Please arrive 10-15 minutes early for check-in<br>
                        • Bring a valid ID for verification<br>
                        • Wear comfortable clothing appropriate for volunteering<br>
                        • Check your email for any last-minute updates
                      </div>
                    </div>

                    <div class="divider"></div>

                    <p style="color: #666; font-size: 14px; text-align: center;">
                      Questions? Contact us at <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
                    </p>
                  </div>

                  <div class="footer">
                    <p class="footer-text">
                      <strong>VIbe - Volunteers Incorporated </strong><br>
                      Making a difference, one volunteer at a time
                    </p>
                    <p style="font-size: 13px; color: #999; margin-top: 15px;">
                      © ${new Date().getFullYear()} Volunteers Incorporated
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        }),
      });

      console.log('[RESEND] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[RESEND] API Error:', errorData);
        return { success: false, error: `Resend API error: ${response.status}` };
      }

      const responseData = await response.json();
      console.log('[RESEND] ✅ Email sent successfully:', responseData.id);
      return { success: true };
    } else {
      console.log('[RESEND] Calling via Supabase Edge Function...');

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
    }

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
    console.log('[RESEND] Environment:', typeof Deno !== 'undefined' ? 'Deno/Edge' : 'Node.js');
    console.log('[RESEND] API Key exists?', !!RESEND_API_KEY);

    const isNodeEnv = !!globalProcess && typeof Deno === 'undefined';

    if (isNodeEnv && RESEND_API_KEY) {
      // Call Resend API directly (Node.js/Vercel)
      console.log('[RESEND] Calling Resend API directly...');
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'VIbe <noreply@volunteersinc.org>',
          to: [email],
          subject: 'Payment Receipt - VIbe',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6; 
                    color: #333; 
                    background: #f5f7fa;
                    padding: 20px;
                  }
                  .email-wrapper { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                  }
                  .logo-section {
                    background: white;
                    padding: 30px;
                    text-align: center;
                    border-bottom: 1px solid #e9ecef;
                  }
                  .logo { width: 80px; height: 80px; }
                  .header { 
                    background: linear-gradient(135deg, #4A90E2 0%, #5BA3F5 50%, #7BB8FF 100%); 
                    padding: 40px 30px;
                    text-align: center;
                    position: relative;
                  }
                  .header h1 { 
                    color: white; 
                    font-size: 28px; 
                    font-weight: 700;
                    margin: 0;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .success-badge {
                    display: inline-block;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    margin-top: 10px;
                  }
                  .content { 
                    padding: 60px 40px 40px;
                    background: white;
                  }
                  .greeting { 
                    font-size: 24px; 
                    font-weight: 600; 
                    color: #2c3e50;
                    margin-bottom: 20px;
                  }
                  .receipt-card {
                    background: white;
                    border: 2px solid #e9ecef;
                    border-radius: 12px;
                    padding: 30px;
                    margin: 30px 0;
                  }
                  .receipt-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 15px 0;
                    border-bottom: 1px solid #f0f0f0;
                  }
                  .receipt-label { font-weight: 500; color: #666; }
                  .receipt-value { font-weight: 600; color: #2c3e50; }
                  .footer {
                    background: #f8f9fa;
                    padding: 30px 40px;
                    text-align: center;
                    border-top: 1px solid #e9ecef;
                    font-size: 14px;
                    color: #666;
                  }
                </style>
              </head>
              <body>
                <div class="email-wrapper">
                  <div class="logo-section">
                    <img src="https://46485094.fs1.hubspotusercontent-na1.net/hubfs/46485094/icon.png" alt="VIbe Logo" class="logo">
                  </div>
                  <div class="header">
                    <h1>Payment Successful!</h1>
                    <div class="success-badge">✓ Transaction Complete</div>
                  </div>
                  
                  <div class="content">
                    <div class="greeting">Hi ${firstName}! 👋</div>
                    <p style="margin-bottom: 30px;">Thank you for your payment! Your transaction has been processed successfully.</p>

                    <div class="receipt-card">
                      <div class="receipt-row">
                        <div class="receipt-label">Transaction ID</div>
                        <div class="receipt-value">${transactionId}</div>
                      </div>
                      <div class="receipt-row">
                        <div class="receipt-label">Description</div>
                        <div class="receipt-value">${description}</div>
                      </div>
                      <div class="receipt-row">
                        <div class="receipt-label">Date</div>
                        <div class="receipt-value">${date}</div>
                      </div>
                      <div class="receipt-row" style="border: none; padding-top: 20px; margin-top: 10px; border-top: 2px solid #e9ecef;">
                        <div class="receipt-label" style="font-size: 20px; color: #4A90E2; font-weight: 700;">Total Amount</div>
                        <div class="receipt-value" style="font-size: 20px; color: #4A90E2; font-weight: 700;">${amount}</div>
                      </div>
                    </div>
                  </div>

                  <div class="footer">
                    <strong>VIbe - Volunteers Incorporated Jamaica</strong><br>
                    © ${new Date().getFullYear()} All rights reserved.
                  </div>
                </div>
              </body>
            </html>
          `,
        }),
      });

      console.log('[RESEND] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[RESEND] API Error:', errorData);
        return { success: false, error: `Resend API error: ${response.status}` };
      }

      const responseData = await response.json();
      console.log('[RESEND] ✅ Email sent successfully:', responseData.id);
      return { success: true };

    } else {
      // Use Supabase Edge Function (when in Edge environment)
      console.log('[RESEND] Calling via Supabase Edge Function...');
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'payment_receipt',
          to: email,
          data: { firstName, amount, transactionId, description, date },
        },
      });

      if (error) {
        console.error('[RESEND] Edge Function error:', error);
        return { success: false, error: error.message };
      }

      return data.success ? { success: true } : { success: false, error: data.error };
    }

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
