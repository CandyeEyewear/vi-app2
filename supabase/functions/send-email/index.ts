console.info('send-email function starting');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, to, data } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    if (!type || !to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: type, to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let subject = '';
    let html = '';

    // Generate email based on type
    switch (type) {
      case 'welcome':
        subject = 'Welcome to VIbe! 🎉';
        html = generateWelcomeEmail(data?.firstName ?? 'there');
        break;

      case 'event_confirmation':
        subject = `Event Confirmed: ${data?.eventName ?? ''}`.trim();
        html = generateEventConfirmationEmail(data ?? {});
        break;

      case 'payment_receipt':
        subject = 'Payment Receipt - VIbe';
        html = generatePaymentReceiptEmail(data ?? {});
        break;

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'VIbe <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Resend API error: ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('Resend API Error:', errorData);
        errorMessage = errorData?.message ?? errorMessage;
      } catch (_) {}
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await response.json();
    console.log('Email sent successfully:', responseData?.id ?? responseData);

    return new Response(
      JSON.stringify({ success: true, id: responseData?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

 function generateWelcomeEmail(firstName: string): string {
  return `
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
  `
}

function generateEventConfirmationEmail(data: any): string {
  return `
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
            <div class="greeting">Hi ${data.firstName}! 👋</div>
            
            <p class="intro-text">
              Fantastic news! Your registration has been confirmed. We're excited to see you at the event and can't wait for you to be part of this amazing experience!
            </p>

            <div class="event-card">
              <div class="event-title">${data.eventName}</div>
              
              <div class="event-details">
                <div class="detail-row">
                  <div class="detail-icon">📅</div>
                  <div class="detail-content">
                    <div class="detail-label">Date & Time</div>
                    <div class="detail-value">${data.eventDate}</div>
                  </div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-icon">📍</div>
                  <div class="detail-content">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${data.eventLocation}</div>
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
  `
}

function generatePaymentReceiptEmail(data: any): string {
  return `
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
          .receipt-card {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .receipt-header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px dashed #ddd;
            margin-bottom: 25px;
          }
          .receipt-title {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 5px;
          }
          .receipt-date {
            font-size: 14px;
            color: #999;
          }
          .receipt-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .receipt-row:last-child {
            border-bottom: none;
            padding-top: 20px;
            margin-top: 10px;
            border-top: 2px solid #e9ecef;
          }
          .receipt-label {
            font-size: 15px;
            color: #666;
            font-weight: 500;
          }
          .receipt-value {
            font-size: 15px;
            color: #2c3e50;
            font-weight: 600;
          }
          .total-row .receipt-label,
          .total-row .receipt-value {
            font-size: 20px;
            color: #4A90E2;
            font-weight: 700;
          }
          .success-message {
            background: #d4edda;
            border-left: 4px solid #28a745;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
          }
          .success-message-icon {
            font-size: 24px;
            margin-bottom: 10px;
          }
          .success-message-text {
            color: #155724;
            font-size: 15px;
            font-weight: 500;
          }
          .info-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            text-align: center;
          }
          .info-box-text {
            color: #666;
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
            <h1>Payment Successful!</h1>
            <div class="success-badge">✓ Transaction Complete</div>
          </div>
          
          <div class="content">
            <div class="greeting">Hi ${data.firstName}! 👋</div>
            
            <p class="intro-text">
              Thank you for your payment! Your transaction has been processed successfully. Below is your receipt for your records.
            </p>

            <div class="success-message">
              <div class="success-message-icon">✓</div>
              <div class="success-message-text">
                Your payment has been received and confirmed. You should receive a confirmation shortly.
              </div>
            </div>

            <div class="receipt-card">
              <div class="receipt-header">
                <div class="receipt-title">Official Receipt</div>
                <div class="receipt-date">${data.date}</div>
              </div>

              <div class="receipt-row">
                <div class="receipt-label">Transaction ID</div>
                <div class="receipt-value">${data.transactionId}</div>
              </div>

              <div class="receipt-row">
                <div class="receipt-label">Description</div>
                <div class="receipt-value">${data.description || 'Payment'}</div>
              </div>

              <div class="receipt-row">
                <div class="receipt-label">Payment Method</div>
                <div class="receipt-value">Card Payment</div>
              </div>

              <div class="receipt-row total-row">
                <div class="receipt-label">Total Amount</div>
                <div class="receipt-value">${data.amount}</div>
              </div>
            </div>

            <div class="info-box">
              <div class="info-box-text">
                📄 This is an automated receipt. Please keep it for your records.<br>
                💡 Questions about this transaction? Contact us anytime.
              </div>
            </div>

            <div class="divider"></div>

            <p style="color: #666; font-size: 14px; text-align: center;">
              Need assistance? Email us at <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
            </p>
          </div>

          <div class="footer">
            <p class="footer-text">
              <strong>VIbe - Volunteers Incorporated </strong><br>
              Secure Payment Processing
            </p>
            <p style="font-size: 13px; color: #999; margin-top: 15px;">
              © ${new Date().getFullYear()} Volunteers Incorporated. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}
