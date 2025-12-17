// @ts-nocheck
/**
 * Supabase Edge Function: admin-set-user-role
 *
 * Purpose:
 * - Allow existing admins to promote/demote users.
 * - Update BOTH:
 *   1) public.users.role (app DB)
 *   2) auth.users app_metadata.app_role (JWT claim used for non-recursive RLS)
 *
 * Auth:
 * - verify_jwt = true (see supabase/config.toml)
 * - Additionally checks caller is an admin via DB (service role client).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const ALLOWED_ROLES = new Set(["admin", "sup", "volunteer"]);

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const json = (payload: any) =>
    new Response(JSON.stringify(payload), {
      // Always 200 so the client can read the body reliably (functions-js throws on non-2xx)
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      const missing = [
        !supabaseUrl ? "SUPABASE_URL" : null,
        !anonKey ? "SUPABASE_ANON_KEY" : null,
        !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      ].filter(Boolean);
      return json({ success: false, error: `Server not configured (missing: ${missing.join(", ")})` });
    }

    // Identify caller (JWT)
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
    const targetUserId = body?.userId || body?.targetUserId;
    const role = String(body?.role || "").toLowerCase();

    if (!targetUserId || !role) {
      return json({ success: false, error: "Missing required fields: userId, role" });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return json({ success: false, error: "Invalid role" });
    }
    // Don't allow removing your own admin/staff privileges (prevents locking yourself out)
    if (targetUserId === callerId && role === "volunteer") {
      return json({ success: false, error: "Forbidden: cannot remove your own staff access" });
    }

    // Service role client for privileged checks/updates
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check caller is admin in DB
    const { data: callerProfile, error: callerProfileErr } = await adminClient
      .from("users")
      .select("id, role")
      .eq("id", callerId)
      .single();

    if (callerProfileErr || callerProfile?.role !== "admin") {
      return json({ success: false, error: "Forbidden" });
    }

    // Update DB role
    const { error: updateDbErr } = await adminClient.from("users").update({ role }).eq("id", targetUserId);
    if (updateDbErr) {
      console.error("[admin-set-user-role] DB update error:", updateDbErr);
      throw updateDbErr;
    }

    // Update JWT claim (auth app_metadata)
    const app_role = role === "admin" ? "admin" : role === "sup" ? "sup" : "user";
    const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      app_metadata: { app_role },
    });
    if (updateAuthErr) {
      console.error("[admin-set-user-role] Auth update error:", updateAuthErr);
      throw updateAuthErr;
    }

    return json({ success: true });
  } catch (err: any) {
    console.error("[admin-set-user-role] error", err);
    const message =
      err?.message ||
      err?.error_description ||
      err?.details ||
      (typeof err === "string" ? err : "Internal error");
    return json({ success: false, error: message });
  }
});


