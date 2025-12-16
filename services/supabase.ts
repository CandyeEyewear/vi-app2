import { createClient, type SupportedStorage } from '@supabase/supabase-js';

// Detect if we're running in Node.js (server) or React Native (mobile)
const isServer = typeof window === 'undefined' || typeof document === 'undefined';

let SecureStore: any;
let Platform: any;

if (!isServer) {
  // We're in React Native - import mobile modules
  SecureStore = require('expo-secure-store');
  Platform = require('react-native').Platform;
} else {
  // We're in Node.js - create mocks
  SecureStore = {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
    deleteItemAsync: async () => {},
  };
  Platform = { OS: 'web' };
}

import { supabaseConfig } from '../config/supabase.config';

// Create SecureStore adapter for React Native
// Supabase expects a storage interface with getItem, setItem, removeItem methods
// SecureStore is more secure than AsyncStorage and works better with PKCE flow
const createSecureStoreAdapter = (): SupportedStorage => {
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const value = await SecureStore.getItemAsync(key);
        return value;
      } catch (error) {
        console.error('[SUPABASE] Error getting item from SecureStore:', error);
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (error) {
        console.error('[SUPABASE] Error setting item in SecureStore:', error);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.error('[SUPABASE] Error removing item from SecureStore:', error);
      }
    },
  };
};

// Determine storage based on platform
// - Web: undefined (Supabase uses localStorage automatically)
// - React Native: SecureStore adapter (required for PKCE flow with Expo SDK 54)
// - Server: undefined (no storage needed, but undefined is acceptable)
const getStorage = (): SupportedStorage | undefined => {
  // Server environment - no storage needed
  if (isServer) {
    return undefined;
  }

  // React Native (iOS/Android) - use SecureStore for session persistence
  // SecureStore is required for proper PKCE flow support in Expo SDK 54+
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    console.log('[SUPABASE] Using SecureStore for session persistence (PKCE-compatible)');
    return createSecureStoreAdapter();
  }

  // Web environment - Supabase uses localStorage automatically
  console.log('[SUPABASE] Using localStorage for session persistence (web)');
  return undefined;
};

// Client-side Supabase (for app usage)
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      storage: getStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Server-side Supabase (only created if service role key is available)
// This prevents errors when SUPABASE_SERVICE_ROLE_KEY is not set in client environments
let supabaseServerInstance: any = null;

const createSupabaseServer = (): any => {
  if (!supabaseServerInstance) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      // In client environments, service role key won't be available
      // Return regular client as fallback
      return supabase;
    }
    supabaseServerInstance = createClient(
      process.env.SUPABASE_URL || supabaseConfig.url,
      serviceRoleKey
    );
  }
  return supabaseServerInstance;
};

// Export supabaseServer - only creates server client if key is available
// Falls back to regular client in client environments
export const supabaseServer = (() => {
  try {
    return createSupabaseServer();
  } catch (error) {
    // If creation fails, return regular client
    console.warn('Failed to create supabaseServer, using regular client:', error);
    return supabase;
  }
})();

// Auto-detect which client to use
export const getSupabaseClient = () => {
  // If we're in a server environment (API routes, webhooks) and have service role key
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createSupabaseServer();
  }
  // Otherwise use regular client
  return supabase;
};

export default supabase;