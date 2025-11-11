/**
 * Supabase Client
 * Main client for interacting with Supabase backend
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/supabase.config';


// Create Supabase client
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      // Store session in AsyncStorage for React Native
      storage: undefined, // Will be configured in the app
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Helper function to check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    supabaseConfig.url !== 'YOUR_SUPABASE_URL_HERE' &&
    supabaseConfig.anonKey !== 'YOUR_SUPABASE_ANON_KEY_HERE'
  );
};

export default supabase;
