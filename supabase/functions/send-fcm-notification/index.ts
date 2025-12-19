/**
 * Supabase Edge Function: send-fcm-notification
 *
 * Sends push notifications via Firebase Cloud Messaging (FCM) HTTP v1 API.
 *
 * Security rules:
 * - service_role JWT: allowed (cron/triggers/admin tooling)
 * - normal user JWT: allowed only if
 *   - sending to self, OR
 *   - caller is admin/sup, OR
 *   - notification is a "message" and BOTH caller + recipient are participants of the conversation
 *
 * Request body:
 * {
 *   "userId": "recipient-user-uuid",
 *   "title": "Notification Title",
 *   "body": "Notification Body",
 *   "data": { ... } // optional
 * }
 *
 * For chat pushes, include:
 * data: { type: "message", id: "<conversationId>", ... }
 */
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
 
type JsonResponse = {
  success: boolean;
  error?: string;
  hint?: string;
  userId?: string;
  callerId?: string;
};
 
interface FCMRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}
 
interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}
 
function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return atob(padded);
}
 
function getJwtClaimsFromAuthHeader(authHeader: string): Record<string, any> | null {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : authHeader?.trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}
 
function parsePrivateKey(privateKey: string): string {
  return privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
}
 
async function generateOAuthToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;
 
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };
 
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
 
  const privateKeyPem = parsePrivateKey(serviceAccount.private_key);
  const keyData = Uint8Array.from(atob(privateKeyPem), (c) => c.charCodeAt(0));
 
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
 
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput),
  );
 
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
 
  return `${signatureInput}.${encodedSignature}`;
}
 
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const jwt = await generateOAuthToken(serviceAccount);
 
  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
 
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${error}`);
  }
 
  const data = await response.json();
  return data.access_token;
}
 
async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
 
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data: data
        ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
        : undefined,
      android: { priority: "high" as const },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default", badge: 1 } },
      },
    },
  };
 
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
 
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FCM API error: ${response.status} ${error}`);
  }
 
  const result = await response.json();
  console.log("FCM notification sent successfully:", result);
}
 
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
 
  const json = (payload: JsonResponse) =>
    new Response(JSON.stringify(payload), {
      status: 200, // IMPORTANT: always 200 so supabase-js invoke can reliably read body
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
 
  try {
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" });
    }
 
    const requestData: FCMRequest = await req.json();
    const { userId, title, body, data } = requestData;
 
    if (!userId || !title || !body) {
      return json({ success: false, userId, error: "Missing required fields: userId, title, body" });
    }
 
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      return json({
        success: false,
        userId,
        error: "Server not configured",
        hint: "Missing FIREBASE_SERVICE_ACCOUNT in Edge Function environment",
      });
    }
 
    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e: any) {
      return json({
        success: false,
        userId,
        error: "Server not configured",
        hint: `Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${e?.message || String(e)}`,
      });
    }
 
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
 
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      const missing = [
        !supabaseUrl ? "SUPABASE_URL" : null,
        !supabaseAnonKey ? "SUPABASE_ANON_KEY" : null,
        !supabaseServiceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      ].filter(Boolean);
      return json({
        success: false,
        userId,
        error: "Server not configured",
        hint: `Missing env: ${missing.join(", ")}`,
      });
    }
 
    const claims = getJwtClaimsFromAuthHeader(authHeader);
    const tokenRole = claims?.role || claims?.["https://hasura.io/jwt/claims"]?.["x-hasura-role"];
    const isServiceRole = tokenRole === "service_role";
 
    // Privileged DB client for reads (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
 
    // Identify caller for non-service requests
    let callerId: string | null = null;
    if (!isServiceRole) {
      const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
 
      const { data: authData, error: authErr } = await supabaseAuthed.auth.getUser();
      callerId = authData?.user?.id || null;
      if (authErr || !callerId) {
        return json({ success: false, userId, error: "Unauthorized" });
      }
    } else {
      callerId = "service_role";
    }
 
    // Authorization
    if (!isServiceRole && callerId !== userId) {
      const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
        .from("users")
        .select("id, role")
        .eq("id", callerId)
        .maybeSingle();
 
      const callerRole = (callerProfile as any)?.role;
      const isStaff = callerRole === "admin" || callerRole === "sup";
 
      const isMessage = requestData?.data?.type === "message";
      const conversationId =
        requestData?.data?.conversationId ||
        requestData?.data?.conversation_id ||
        requestData?.data?.id;
 
      if (!callerProfileErr && !isStaff && isMessage && conversationId) {
        const { data: conversation, error: convErr } = await supabaseAdmin
          .from("conversations")
          .select("id, participants")
          .eq("id", conversationId)
          .maybeSingle();
 
        const participants: string[] = (conversation as any)?.participants || [];
        const ok = !convErr && !!conversation && participants.includes(callerId) && participants.includes(userId);
 
        if (!ok) {
          return json({
            success: false,
            userId,
            callerId,
            error: "Forbidden",
            hint: "Message push notifications are only allowed when both users are participants of the conversation",
          });
        }
      } else if (callerProfileErr || !isStaff) {
        return json({
          success: false,
          userId,
          callerId,
          error: "Forbidden",
          hint: "Can only send push notifications to yourself unless you are admin/sup",
        });
      }
    }
 
    // Get recipient push token (FCM token) from DB
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("id", userId)
      .maybeSingle();
 
    if (userError) {
      return json({ success: false, userId, callerId, error: `Failed to fetch user: ${userError.message}` });
    }
 
    if (!userData?.push_token) {
      return json({
        success: false,
        userId,
        callerId,
        error: "User not found or has no push token registered",
        hint: "Ensure the recipient has registered on a real device and saved public.users.push_token",
      });
    }
 
    const accessToken = await getAccessToken(serviceAccount);
 
    await sendFCMNotification(
      accessToken,
      serviceAccount.project_id,
      userData.push_token,
      title,
      body,
      data,
    );
 
    return json({ success: true, userId, callerId });
  } catch (e: any) {
    console.error("Error sending FCM notification:", e);
    return json({ success: false, error: e?.message || "Unknown error occurred" });
  }
});
