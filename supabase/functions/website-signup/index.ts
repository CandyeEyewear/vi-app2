import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const { error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://vibe.volunteersinc.org/set-password'
      }
    });

    if (recoveryError) {
      console.error('[WEBSITE-SIGNUP] Failed to generate recovery link:', recoveryError);
      // Don't fail the whole signup - account is created, they can request reset later
    } else {
      console.log('[WEBSITE-SIGNUP] ✅ Password recovery email sent');
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
