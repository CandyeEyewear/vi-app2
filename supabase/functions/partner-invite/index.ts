// @ts-nocheck
/**
 * Supabase Edge Function: partner-invite
 *
 * Sends an invitation email to join a partner organization's team.
 * - Validates caller is a partner org (is_partner_organization = true)
 * - Inserts into partner_invites table
 * - Sends branded email via Resend API
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const json = (payload: any, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Server not configured" });
    }

    // Identify caller via JWT
    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabaseAuthed.auth.getUser();
    const callerId = userData?.user?.id;
    if (userErr || !callerId) {
      return json({ success: false, error: "Unauthorized" });
    }

    // Parse body
    const body = await req.json().catch(() => null);
    const email = body?.email?.trim().toLowerCase();

    if (!email) {
      return json({ success: false, error: "Email is required" });
    }

    // Service role client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller is a partner organization
    const { data: callerProfile, error: callerErr } = await adminClient
      .from("users")
      .select("id, full_name, is_partner_organization, organization_data, membership_status")
      .eq("id", callerId)
      .single();

    if (callerErr || !callerProfile?.is_partner_organization) {
      return json({ success: false, error: "Only partner organizations can send invites" });
    }

    // Verify active membership — prevent expired/cancelled orgs from inviting
    if (callerProfile.membership_status !== "active") {
      return json({ success: false, error: "Active subscription required to send invites. Please renew your membership." });
    }

    const orgName = callerProfile.organization_data?.organization_name || callerProfile.full_name || "VIbe Partner";

    // Check if there's already a pending invite for this email+org
    const { data: existingInvite } = await adminClient
      .from("partner_invites")
      .select("id, status")
      .eq("partner_org_id", callerId)
      .ilike("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return json({ success: false, error: "An invite is already pending for this email" });
    }

    // Check if user is already a team member
    const { data: existingMember } = await adminClient
      .from("users")
      .select("id")
      .eq("partner_org_id", callerId)
      .ilike("email", email)
      .maybeSingle();

    if (existingMember) {
      return json({ success: false, error: "This user is already a member of your team" });
    }

    // Insert invite (RLS INSERT policy requires partner_org_id = auth.uid() AND invited_by = auth.uid(),
    // but we use service role here to avoid timing issues)
    const { data: invite, error: insertErr } = await adminClient
      .from("partner_invites")
      .insert({
        partner_org_id: callerId,
        email: email,
        invited_by: callerId,
      })
      .select("token")
      .single();

    if (insertErr) {
      console.error("[partner-invite] Insert error:", insertErr);
      return json({ success: false, error: "Failed to create invite" });
    }

    // Send invite email via Resend
    if (RESEND_API_KEY) {
      const inviteLink = `https://vibe.volunteersinc.org/accept-invite?token=${invite.token}`;

      const html = generateInviteEmail(orgName, inviteLink);

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "VIbe <noreply@volunteersinc.org>",
          to: [email],
          subject: `You've been invited to join ${orgName} on VIbe!`,
          html,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json().catch(() => null);
        console.error("[partner-invite] Resend error:", errorData);
        // Invite was created but email failed — don't roll back
      } else {
        const resendData = await resendResponse.json();
        console.log("[partner-invite] Email sent:", resendData?.id);
      }
    } else {
      console.warn("[partner-invite] RESEND_API_KEY not configured, skipping email");
    }

    return json({ success: true, token: invite.token });
  } catch (err: any) {
    console.error("[partner-invite] error:", err);
    return json({ success: false, error: err?.message || "Internal error" });
  }
});

function generateInviteEmail(orgName: string, inviteLink: string): string {
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
            background: linear-gradient(135deg, #F59E0B 0%, #F59E0B 50%, #FBBF24 100%);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            color: white;
            font-size: 28px;
            font-weight: 700;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .content {
            padding: 40px;
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
            margin-bottom: 20px;
            line-height: 1.8;
          }
          .org-name {
            font-weight: 700;
            color: #F59E0B;
          }
          .cta-container {
            text-align: center;
            margin: 40px 0 30px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
            color: white;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
          }
          .fallback-link {
            word-break: break-all;
            font-size: 13px;
            color: #999;
            margin-top: 15px;
          }
          .fallback-link a { color: #F59E0B; text-decoration: none; }
          .info-box {
            background: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
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
            margin-bottom: 15px;
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
            <h1>Team Invitation</h1>
          </div>
          <div class="content">
            <div class="greeting">You're Invited!</div>
            <p class="intro-text">
              <span class="org-name">${orgName}</span> has invited you to join their team on VIbe.
              As a team member, you'll be able to discover volunteer opportunities and track your impact together.
            </p>
            <div class="cta-container">
              <a href="${inviteLink}" class="cta-button">Accept Invitation</a>
              <p class="fallback-link">
                Or copy this link: <a href="${inviteLink}">${inviteLink}</a>
              </p>
            </div>
            <div class="info-box">
              <div class="info-box-text">
                This invitation expires in 7 days. If you don't have a VIbe account yet, you'll be able to create one when you accept.
              </div>
            </div>
            <div class="divider"></div>
            <p style="color: #666; font-size: 14px; text-align: center;">
              Questions? Contact us at <a href="mailto:info@volunteersinc.org" style="color: #F59E0B; text-decoration: none;">info@volunteersinc.org</a>
            </p>
          </div>
          <div class="footer">
            <p class="footer-text">
              <strong>VIbe - Volunteers Incorporated</strong><br>
              Empowering communities through volunteer action
            </p>
            <p class="contact-info">
              &copy; ${new Date().getFullYear()} Volunteers Incorporated. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}
