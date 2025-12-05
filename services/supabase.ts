import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/supabase.config';

// Client-side Supabase (for app usage)
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      storage: typeof window !== 'undefined' ? undefined : null,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Server-side Supabase (for API/webhook usage)
export const supabaseServer = createClient(
  process.env.SUPABASE_URL || supabaseConfig.url,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Auto-detect which client to use
export const getSupabaseClient = () => {
  // If we're in a server environment (API routes, webhooks)
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseServer;
  }
  // Otherwise use regular client
  return supabase;
};

export default supabase;