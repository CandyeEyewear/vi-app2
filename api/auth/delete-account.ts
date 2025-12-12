import { createClient } from '@supabase/supabase-js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function setCorsHeaders(res: any) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

function getBearerToken(req: any): string | null {
  const raw = (req?.headers?.authorization || req?.headers?.Authorization) as string | undefined;
  if (!raw || typeof raw !== 'string') return null;
  const [scheme, token] = raw.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function json(res: any, status: number, body: any) {
  setCorsHeaders(res);
  return res.status(status).json(body);
}

/**
 * Vercel API Route: /api/auth/delete-account.ts
 * Securely deletes the authenticated user's account.
 */
export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[delete-account] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return json(res, 500, { success: false, error: 'Server misconfiguration' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return json(res, 401, { success: false, error: 'Unauthorized' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    // 1) Authenticate request and derive user ID from access token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;

    if (userError || !userId) {
      console.error('[delete-account] auth.getUser failed:', userError);
      return json(res, 401, { success: false, error: 'Unauthorized' });
    }

    // 2) Pre-deletion cleanup: remove user from conversations participants
    // Desired SQL:
    //   UPDATE conversations
    //   SET participants = array_remove(participants, $1::text)
    //   WHERE $1::text = ANY(participants)
    //
    // If you have a DB function matching this, the route will use it.
    // Otherwise we fall back to a safe (but less efficient) per-row update.
    let conversationCleanupSucceeded = false;
    try {
      const { error: rpcError } = await supabase.rpc('remove_user_from_conversations', {
        user_id: userId,
      });

      if (!rpcError) {
        conversationCleanupSucceeded = true;
      } else {
        console.warn('[delete-account] remove_user_from_conversations RPC failed; falling back:', rpcError);
      }
    } catch (rpcException) {
      console.warn('[delete-account] remove_user_from_conversations RPC threw; falling back:', rpcException);
    }

    if (!conversationCleanupSucceeded) {
      const { data: conversations, error: convErr } = await supabase
        .from('conversations')
        .select('id, participants')
        .contains('participants', [userId]);

      if (convErr) {
        console.error('[delete-account] Failed to load conversations for cleanup:', convErr);
      } else if (Array.isArray(conversations) && conversations.length > 0) {
        for (const convo of conversations) {
          const participants = Array.isArray(convo.participants) ? convo.participants : [];
          const next = participants.filter((p: any) => p !== userId);
          if (next.length === participants.length) continue;

          const { error: updateErr } = await supabase
            .from('conversations')
            .update({ participants: next })
            .eq('id', convo.id);

          if (updateErr) {
            console.error('[delete-account] Failed to update conversation participants:', {
              conversationId: convo.id,
              error: updateErr,
            });
          }
        }
      }
    }

    // 3) Delete user data (cascades for most tables)
    const { error: profileDeleteError } = await supabase.from('users').delete().eq('id', userId);
    if (profileDeleteError) {
      console.error('[delete-account] Failed to delete from public.users:', profileDeleteError);
      // Continue; user might already be deleted.
    }

    // 4) Delete auth user using service role admin API
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      const msg = (authDeleteError as any)?.message || String(authDeleteError);
      const status = (authDeleteError as any)?.status;

      // Treat "already deleted" as success.
      if (status === 404 || /not\s*found/i.test(msg)) {
        console.warn('[delete-account] auth user already deleted:', authDeleteError);
      } else {
        console.error('[delete-account] Failed to delete auth user:', authDeleteError);
        return json(res, 500, { success: false, error: 'Failed to delete account' });
      }
    }

    return json(res, 200, { success: true, message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('[delete-account] Unhandled error:', error);
    return json(res, 500, { success: false, error: 'Internal server error' });
  }
}
