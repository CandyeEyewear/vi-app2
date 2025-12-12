import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function setCorsHeaders(res: any) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

function json(res: any, status: number, body: any) {
  setCorsHeaders(res);
  return res.status(status).json(body);
}

/**
 * Vercel API Route: /api/auth/verify-password
 * Verifies the current user's password without creating a new session
 */
export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[verify-password] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return json(res, 500, { success: false, error: 'Server misconfiguration' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return json(res, 400, { success: false, error: 'Email and password are required' });
    }

    // Create a fresh Supabase client (no session persistence)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Attempt to sign in - we only care if it succeeds or fails
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('[verify-password] Password verification failed:', error.message);
      return json(res, 401, { success: false, error: 'Invalid password' });
    }

    // Password is correct
    console.log('[verify-password] Password verified for:', email);
    return json(res, 200, { success: true });

  } catch (error: any) {
    console.error('[verify-password] Error:', error);
    return json(res, 500, { success: false, error: 'Internal server error' });
  }
}
