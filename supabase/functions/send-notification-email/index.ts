/**
 * Send Notification Email Edge Function
 * Sends email notifications for messages, circle requests, and other alerts
 *
 * Includes throttling to prevent email spam
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const APP_URL = 'https://vibe.volunteersinc.org';
const FROM_EMAIL = 'VIbe <noreply@volunteersinc.org>';

interface NotificationEmailRequest {
  recipientUserId: string;
  type: 'message' | 'circle_request' | 'announcement' | 'opportunity' | 'event' | 'cause';
  data: {
    senderName?: string;
    senderAvatarUrl?: string;
    messagePreview?: string;
    conversationId?: string;
    title?: string;
    description?: string;
    slug?: string;
    id?: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const body: NotificationEmailRequest = await req.json();
    const { recipientUserId, type, data } = body;

    if (!recipientUserId || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get reference ID for throttling
    const referenceId = data.conversationId || data.id || null;

    // Check if we should send the email (throttling + user preferences)
    const { data: shouldSend, error: checkError } = await supabase.rpc(
      'should_send_notification_email',
      {
        p_user_id: recipientUserId,
        p_notification_type: type,
        p_reference_id: referenceId,
        p_throttle_minutes: type === 'message' ? 15 : 60, // Messages: 15 min, others: 1 hour
      }
    );

    if (checkError) {
      console.error('Error checking if should send email:', checkError);
      throw checkError;
    }

    if (!shouldSend) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Throttled or disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient's email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', recipientUserId)
      .single();

    if (userError || !userData?.email) {
      console.error('Error getting user email:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found or no email' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email content based on type
    const emailContent = generateEmailContent(type, data, userData.full_name);

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: userData.email,
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend error:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    // Log that we sent the email (for throttling)
    await supabase.rpc('log_notification_email', {
      p_user_id: recipientUserId,
      p_notification_type: type,
      p_reference_id: referenceId,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending notification email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateEmailContent(
  type: string,
  data: NotificationEmailRequest['data'],
  recipientName: string
): { subject: string; html: string } {
  const greeting = recipientName ? `Hi ${recipientName.split(' ')[0]},` : 'Hi,';

  switch (type) {
    case 'message':
      return {
        subject: `${data.senderName || 'Someone'} sent you a message`,
        html: generateMessageEmail(data, greeting),
      };

    case 'circle_request':
      return {
        subject: `${data.senderName || 'Someone'} wants to add you to their circle`,
        html: generateCircleRequestEmail(data, greeting),
      };

    case 'announcement':
      return {
        subject: `New announcement: ${data.title || 'Check it out'}`,
        html: generateAnnouncementEmail(data, greeting),
      };

    case 'opportunity':
      return {
        subject: `New volunteer opportunity: ${data.title || 'Check it out'}`,
        html: generateOpportunityEmail(data, greeting),
      };

    case 'event':
      return {
        subject: `New event: ${data.title || 'Check it out'}`,
        html: generateEventEmail(data, greeting),
      };

    case 'cause':
      return {
        subject: `New cause: ${data.title || 'Check it out'}`,
        html: generateCauseEmail(data, greeting),
      };

    default:
      return {
        subject: 'New notification on VIbe',
        html: generateGenericEmail(data, greeting),
      };
  }
}

function generateMessageEmail(data: NotificationEmailRequest['data'], greeting: string): string {
  const preview = data.messagePreview
    ? `<p style="color: #666; font-style: italic; margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px;">"${truncate(data.messagePreview, 100)}"</p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Message</h1>
        </div>
        <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px;">
          <p style="color: #333; font-size: 16px; line-height: 1.5;">${greeting}</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;"><strong>${data.senderName || 'Someone'}</strong> sent you a message on VIbe.</p>
          ${preview}
          <div style="text-align: center; margin-top: 24px;">
            <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Message</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>You received this email because you have email notifications enabled.</p>
          <p>To stop receiving these emails, update your notification settings in the app.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCircleRequestEmail(data: NotificationEmailRequest['data'], greeting: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Circle Request</h1>
        </div>
        <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px;">
          <p style="color: #333; font-size: 16px; line-height: 1.5;">${greeting}</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;"><strong>${data.senderName || 'Someone'}</strong> wants to add you to their circle on VIbe.</p>
          <p style="color: #666; font-size: 14px; line-height: 1.5;">Adding someone to your circle lets you see their posts and stay connected.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Request</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>You received this email because you have email notifications enabled.</p>
          <p>To stop receiving these emails, update your notification settings in the app.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateAnnouncementEmail(data: NotificationEmailRequest['data'], greeting: string): string {
  return generateGenericNotificationEmail('New Announcement', data, greeting, '#10B981');
}

function generateOpportunityEmail(data: NotificationEmailRequest['data'], greeting: string): string {
  return generateGenericNotificationEmail('New Volunteer Opportunity', data, greeting, '#F59E0B');
}

function generateEventEmail(data: NotificationEmailRequest['data'], greeting: string): string {
  return generateGenericNotificationEmail('New Event', data, greeting, '#EC4899');
}

function generateCauseEmail(data: NotificationEmailRequest['data'], greeting: string): string {
  return generateGenericNotificationEmail('New Cause', data, greeting, '#EF4444');
}

function generateGenericNotificationEmail(
  title: string,
  data: NotificationEmailRequest['data'],
  greeting: string,
  accentColor: string
): string {
  const description = data.description
    ? `<p style="color: #666; font-size: 14px; line-height: 1.5; margin-top: 12px;">${truncate(data.description, 200)}</p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
        </div>
        <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px;">
          <p style="color: #333; font-size: 16px; line-height: 1.5;">${greeting}</p>
          <div style="background: #f9fafb; border-left: 4px solid ${accentColor}; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <h2 style="color: #333; margin: 0 0 8px 0; font-size: 18px;">${data.title || 'Check it out'}</h2>
            ${description}
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View on VIbe</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>You received this email because you have email notifications enabled.</p>
          <p>To stop receiving these emails, update your notification settings in the app.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateGenericEmail(data: NotificationEmailRequest['data'], greeting: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Notification</h1>
        </div>
        <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px;">
          <p style="color: #333; font-size: 16px; line-height: 1.5;">${greeting}</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">You have a new notification on VIbe.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Open VIbe</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>You received this email because you have email notifications enabled.</p>
          <p>To stop receiving these emails, update your notification settings in the app.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
