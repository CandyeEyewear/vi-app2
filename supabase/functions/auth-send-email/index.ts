// @ts-nocheck
console.info('auth-send-email hook function starting');

/**
 * Supabase Auth Send Email Hook
 *
 * Called internally by Supabase Auth whenever it needs to send an email
 * (signup confirmation, password recovery, magic link, email change, etc.).
 *
 * Sends branded VIbe emails via Resend API instead of Supabase defaults.
 *
 * Hook payload shape:
 * {
 *   user: { id, email, user_metadata: { full_name, ... } },
 *   email_data: {
 *     token_hash: string,
 *     redirect_to: string,
 *     email_action_type: "signup" | "recovery" | "magiclink" | "email_change" | "invite",
 *     site_url: string,
 *     token: string,
 *     token_new: string,
 *     token_hash_new: string
 *   }
 * }
 */

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    const { user, email_data } = payload;

    if (!user?.email || !email_data) {
      console.error('Invalid hook payload:', JSON.stringify(payload));
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured — allowing signup to proceed without email');
      // Return 200 so GoTrue does NOT roll back the user creation
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const { token_hash, redirect_to, email_action_type } = email_data;
    const email = user.email;
    const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there';

    // Check if this is a notification-only email (no action link needed)
    const isNotification = email_action_type?.endsWith('_notification');

    // Construct the verification/action URL only for actionable emails
    const actionUrl = (!isNotification && token_hash)
      ? `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to || '')}`
      : '';

    let subject = '';
    let html = '';

    switch (email_action_type) {
      case 'signup':
        subject = 'Welcome to VIbe! Verify Your Email';
        html = generateSignupConfirmationEmail(firstName, actionUrl);
        break;

      case 'recovery':
        subject = 'Reset Your VIbe Password';
        html = generatePasswordRecoveryEmail(firstName, actionUrl);
        break;

      case 'email_change':
        subject = 'Confirm Your Email Change - VIbe';
        html = generateEmailChangeEmail(firstName, actionUrl);
        break;

      case 'magiclink':
        subject = 'Your VIbe Login Link';
        html = generateMagicLinkEmail(firstName, actionUrl);
        break;

      // Notification emails - informational only, no action link
      case 'password_changed_notification':
        subject = 'Your VIbe Password Was Changed';
        html = generatePasswordChangedNotification(firstName);
        break;

      case 'email_changed_notification':
        subject = 'Your VIbe Email Was Changed';
        html = generateEmailChangedNotification(firstName);
        break;

      default:
        // For unknown notification types, send a simple notification
        if (isNotification) {
          console.log(`Notification email type: ${email_action_type} - sending simple notification`);
          subject = 'VIbe Account Update';
          html = generateAccountUpdateNotification(firstName, email_action_type);
        } else if (actionUrl) {
          console.warn(`Unhandled email_action_type: ${email_action_type}`);
          subject = 'VIbe Account Action Required';
          html = generateGenericActionEmail(firstName, actionUrl, email_action_type);
        } else {
          // No token and not a known notification - skip sending
          console.warn(`Skipping email for ${email_action_type}: no token_hash and not a recognized notification`);
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        break;
    }

    // Send via Resend
    console.log(`Sending ${email_action_type} email to ${email}`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'VIbe <noreply@volunteersinc.org>',
        to: [email],
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
      // Log the error but return 200 so GoTrue does NOT roll back the user creation.
      // The user can resend the verification email from the login screen.
      console.error('Email send failed but allowing signup to proceed:', errorMessage);
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseData = await response.json();
    console.log(`${email_action_type} email sent successfully:`, responseData?.id);

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Auth send-email hook error:', error);
    // Return 200 even on unexpected errors so GoTrue does NOT roll back the user creation
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

function emailWrapper(headerTitle: string, content: string): string {
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
          }
          .fallback-link {
            word-break: break-all;
            font-size: 13px;
            color: #999;
            margin-top: 15px;
          }
          .fallback-link a {
            color: #4A90E2;
            text-decoration: none;
          }
          .info-box {
            background: #e3f2fd;
            border-left: 4px solid #4A90E2;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
          }
          .info-box-text {
            color: #555;
            font-size: 14px;
            line-height: 1.6;
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
            <h1>${headerTitle}</h1>
          </div>

          <div class="content">
            ${content}
          </div>

          <div class="footer">
            <p class="footer-text">
              <strong>VIbe - Volunteers Incorporated</strong><br>
              Empowering communities through volunteer action
            </p>

            <div class="social-links">
              <a href="https://volunteersinc.org" class="social-link">Website</a>
              <a href="mailto:info@volunteersinc.org" class="social-link">Contact</a>
            </div>

            <p class="contact-info">
              &copy; ${new Date().getFullYear()} Volunteers Incorporated. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateSignupConfirmationEmail(firstName: string, confirmationUrl: string): string {
  const content = `
    <div class="greeting">Hi ${firstName}!</div>

    <p class="intro-text">
      Welcome to the VIbe community! We're thrilled to have you join a growing network of passionate volunteers making a real difference.
    </p>

    <p class="intro-text">
      Please verify your email address to activate your account and get started:
    </p>

    <div class="cta-container">
      <a href="${confirmationUrl}" class="cta-button">Verify My Email</a>
      <p class="fallback-link">
        Or copy this link: <a href="${confirmationUrl}">${confirmationUrl}</a>
      </p>
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">&#x1F50D;</div>
        <div class="feature-title">Discover Opportunities</div>
        <div class="feature-desc">Find volunteer opportunities that match your interests, skills, and location.</div>
      </div>

      <div class="feature-card">
        <div class="feature-icon">&#x1F91D;</div>
        <div class="feature-title">Connect & Collaborate</div>
        <div class="feature-desc">Build meaningful connections with like-minded volunteers and organizations.</div>
      </div>

      <div class="feature-card">
        <div class="feature-icon">&#x1F4CA;</div>
        <div class="feature-title">Track Your Impact</div>
        <div class="feature-desc">Monitor your volunteer hours, completed activities, and the difference you're making.</div>
      </div>

      <div class="feature-card">
        <div class="feature-icon">&#x1F3AF;</div>
        <div class="feature-title">Join Events</div>
        <div class="feature-desc">Participate in community events and initiatives that align with your passion.</div>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-text">
        This verification link expires in 1 hour. If you didn't create a VIbe account, you can safely ignore this email.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      Need help getting started? Our team is here to support you every step of the way.
    </p>
  `;
  return emailWrapper('Welcome to VIbe!', content);
}

function generatePasswordRecoveryEmail(firstName: string, recoveryUrl: string): string {
  const content = `
    <div class="greeting">Hi ${firstName},</div>

    <p class="intro-text">
      We received a request to reset your VIbe password. Click the button below to set a new password:
    </p>

    <div class="cta-container">
      <a href="${recoveryUrl}" class="cta-button">Reset My Password</a>
      <p class="fallback-link">
        Or copy this link: <a href="${recoveryUrl}">${recoveryUrl}</a>
      </p>
    </div>

    <div class="info-box">
      <div class="info-box-text">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      Questions? Contact us at <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
    </p>
  `;
  return emailWrapper('Reset Your Password', content);
}

function generateEmailChangeEmail(firstName: string, confirmUrl: string): string {
  const content = `
    <div class="greeting">Hi ${firstName},</div>

    <p class="intro-text">
      You requested to change your email address on VIbe. Please confirm this change by clicking the button below:
    </p>

    <div class="cta-container">
      <a href="${confirmUrl}" class="cta-button">Confirm Email Change</a>
      <p class="fallback-link">
        Or copy this link: <a href="${confirmUrl}">${confirmUrl}</a>
      </p>
    </div>

    <div class="info-box">
      <div class="info-box-text">
        This link expires in 1 hour. If you didn't request this change, please contact us immediately at info@volunteersinc.org.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      Questions? Contact us at <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
    </p>
  `;
  return emailWrapper('Confirm Email Change', content);
}

function generateMagicLinkEmail(firstName: string, magicLinkUrl: string): string {
  const content = `
    <div class="greeting">Hi ${firstName},</div>

    <p class="intro-text">
      Click the button below to log in to your VIbe account:
    </p>

    <div class="cta-container">
      <a href="${magicLinkUrl}" class="cta-button">Log In to VIbe</a>
      <p class="fallback-link">
        Or copy this link: <a href="${magicLinkUrl}">${magicLinkUrl}</a>
      </p>
    </div>

    <div class="info-box">
      <div class="info-box-text">
        This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      Questions? Contact us at <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
    </p>
  `;
  return emailWrapper('Your Login Link', content);
}

function generatePasswordChangedNotification(firstName: string): string {
  const content = `
    <div class="greeting">Hi ${firstName},</div>

    <p class="intro-text">
      This is a confirmation that your VIbe account password was just changed successfully.
    </p>

    <div class="info-box">
      <div class="info-box-text">
        <strong>If you made this change</strong>, no further action is needed. You're all set!
      </div>
    </div>

    <div class="info-box" style="background: #fff3e0; border-left-color: #ff9800;">
      <div class="info-box-text">
        <strong>If you didn't make this change</strong>, please contact us immediately at
        <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
        to secure your account.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      This is an automated security notification from VIbe.
    </p>
  `;
  return emailWrapper('Password Changed', content);
}

function generateEmailChangedNotification(firstName: string): string {
  const content = `
    <div class="greeting">Hi ${firstName},</div>

    <p class="intro-text">
      This is a confirmation that the email address on your VIbe account was just changed.
    </p>

    <div class="info-box">
      <div class="info-box-text">
        <strong>If you made this change</strong>, no further action is needed.
      </div>
    </div>

    <div class="info-box" style="background: #fff3e0; border-left-color: #ff9800;">
      <div class="info-box-text">
        <strong>If you didn't make this change</strong>, please contact us immediately at
        <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
        to secure your account.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      This is an automated security notification from VIbe.
    </p>
  `;
  return emailWrapper('Email Address Changed', content);
}

function generateAccountUpdateNotification(firstName: string, actionType: string): string {
  const readableType = actionType
    .replace(/_notification$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const content = `
    <div class="greeting">Hi ${firstName},</div>

    <p class="intro-text">
      This is a confirmation that a change was made to your VIbe account: <strong>${readableType}</strong>.
    </p>

    <div class="info-box">
      <div class="info-box-text">
        If you made this change, no further action is needed. If you didn't, please contact us at
        <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      This is an automated security notification from VIbe.
    </p>
  `;
  return emailWrapper('Account Update', content);
}

function generateGenericActionEmail(firstName: string, actionUrl: string, actionType: string): string {
  const content = `
    <div class="greeting">Hi ${firstName},</div>

    <p class="intro-text">
      An action is required on your VIbe account. Please click the button below to proceed:
    </p>

    <div class="cta-container">
      <a href="${actionUrl}" class="cta-button">Continue</a>
      <p class="fallback-link">
        Or copy this link: <a href="${actionUrl}">${actionUrl}</a>
      </p>
    </div>

    <div class="info-box">
      <div class="info-box-text">
        This link expires in 1 hour. If you didn't initiate this action, please contact us at info@volunteersinc.org.
      </div>
    </div>

    <div class="divider"></div>

    <p style="color: #666; font-size: 14px; text-align: center;">
      Questions? Contact us at <a href="mailto:info@volunteersinc.org" style="color: #4A90E2; text-decoration: none;">info@volunteersinc.org</a>
    </p>
  `;
  return emailWrapper('Action Required', content);
}
