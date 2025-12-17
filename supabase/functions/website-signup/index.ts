// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

// CORS headers handled via shared helper

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    // AuthN: this endpoint creates auth users with service role; require a shared secret header.
    const expected = Deno.env.get('WEBSITE_SIGNUP_SECRET') || '';
    const provided =
      req.headers.get('x-website-signup-secret') ||
      req.headers.get('X-Website-Signup-Secret') ||
      '';
    if (!expected || provided !== expected) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, fullName, phone, location, bio, areasOfExpertise, education, country, dateOfBirth } = await req.json();

    console.log('[WEBSITE-SIGNUP] Creating account for:', email);

    // Generate random temporary password
    const tempPassword = generateSecurePassword();

    // Create Supabase auth account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        phone: phone || '',
        location: location || '',
        bio: bio || '',
        areas_of_expertise: areasOfExpertise || [],
        education: education || '',
        country: country || 'Jamaica',
        date_of_birth: dateOfBirth || null,
        needs_password_setup: true,
        source: 'website_registration',
      }
    });

    if (authError) {
      console.error('[WEBSITE-SIGNUP] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[WEBSITE-SIGNUP] ✅ Account created, user ID:', authData.user.id);

    // Send password recovery email so user can set their password
    console.log('[WEBSITE-SIGNUP] Sending password recovery email...');

    const { data: linkData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://vibe.volunteersinc.org/set-password'
      }
    });

    if (recoveryError || !linkData?.properties?.action_link) {
      console.error('[WEBSITE-SIGNUP] Failed to generate recovery link:', recoveryError);
      // Don't fail the whole signup - account is created, they can request reset later
    } else {
      const recoveryLink = linkData.properties.action_link;
      console.log('[WEBSITE-SIGNUP] ✅ Recovery link generated');

      // Actually send the email via Resend
      console.log('[WEBSITE-SIGNUP] Sending email via Resend...');

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        console.error('[WEBSITE-SIGNUP] RESEND_API_KEY not configured!');
      } else {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: 'VIbe <noreply@volunteersinc.org>',
              to: [email],
              subject: 'Set Your VIbe Password',
              html: `
                <!DOCTYPE html>
                <html>
                <body style="font-family: Arial, sans-serif;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <img src="https://46485094.fs1.hubspotusercontent-na1.net/hubfs/46485094/icon%2022a.png" alt="VIbe" style="width: 80px;">
                    </div>

                    <h1 style="color: #4A90E2;">Welcome to VIbe!</h1>

                    <p>Hi ${fullName},</p>
                    <p>Your VIbe account has been created! Click the button below to set your password:</p>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${recoveryLink}" style="background: #4A90E2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Set Your Password</a>
                    </div>

                    <p style="font-size: 14px; color: #666;">Or copy this link:</p>
                    <p style="font-size: 12px; word-break: break-all;">${recoveryLink}</p>
                  </div>
                </body>
                </html>
              `
            })
          });

          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            console.log('[WEBSITE-SIGNUP] ✅ Email sent successfully via Resend:', emailData.id);
          } else {
            const errorText = await emailResponse.text();
            console.error('[WEBSITE-SIGNUP] Resend API error:', errorText);
          }
        } catch (emailError) {
          console.error('[WEBSITE-SIGNUP] Failed to send email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account created successfully. Please check your email to verify.',
        userId: authData.user.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[WEBSITE-SIGNUP] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
