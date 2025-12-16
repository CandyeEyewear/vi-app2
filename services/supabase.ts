import { createClient, type SupportedStorage } from '@supabase/supabase-js';

// Detect environment: React Native, Web, or Node.js server
// Try to detect React Native first by attempting to require it
let isReactNative = false;
try {
  const RNPlatform = require('react-native')?.Platform;
  isReactNative = !!RNPlatform && (RNPlatform.OS === 'ios' || RNPlatform.OS === 'android');
} catch (e) {
  // Not React Native
}

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
const isServer = !isReactNative && !isWeb;

let SecureStore: any;
let Platform: any;

if (isReactNative) {
  // We're in React Native - import mobile modules
  try {
    SecureStore = require('expo-secure-store');
    Platform = require('react-native').Platform;
    console.log('[SUPABASE] ✅ React Native environment detected');
  } catch (error) {
    console.error('[SUPABASE] ❌ Failed to load React Native modules:', error);
    SecureStore = {
      getItemAsync: async () => null,
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    };
    Platform = { OS: 'unknown' };
  }
} else if (isServer) {
  // We're in Node.js server - create mocks
  SecureStore = {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
    deleteItemAsync: async () => {},
  };
  Platform = { OS: 'web' };
  console.log('[SUPABASE] Server environment detected');
} else {
  // We're in web browser
  SecureStore = null;
  Platform = { OS: 'web' };
  console.log('[SUPABASE] Web browser environment detected');
}

import { supabaseConfig } from '../config/supabase.config';

// Create SecureStore adapter for React Native
// Supabase expects a storage interface with getItem, setItem, removeItem methods
// SecureStore is more secure than AsyncStorage and works better with PKCE flow
// Added caching to reduce excessive SecureStore reads
const createSecureStoreAdapter = (): SupportedStorage => {
  // Cache to reduce SecureStore reads
  const cache = new Map<string, { value: string | null; timestamp: number }>();
  const CACHE_TTL = 100; // Cache for 100ms to reduce reads during rapid checks
  let lastLoggedKey: string | null = null;
  let lastLoggedValue: string | null = null;

  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const now = Date.now();
        const cached = cache.get(key);
        
        // Use cache if valid
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          return cached.value;
        }

        // Read from SecureStore
        const value = await SecureStore.getItemAsync(key);
        
        // Update cache
        cache.set(key, { value, timestamp: now });
        
        // Only log if value changed or it's the first read
        if (__DEV__ && (key !== lastLoggedKey || value !== lastLoggedValue)) {
          if (key.includes('auth')) {
            console.log(`[SUPABASE] 🔍 Session check: ${value ? '✅ Found' : '❌ Not found'}`);
            if (value) {
              try {
                const parsed = JSON.parse(value);
                console.log(`[SUPABASE] Session data:`, {
                  hasAccessToken: !!parsed?.access_token,
                  hasRefreshToken: !!parsed?.refresh_token,
                  expiresAt: parsed?.expires_at,
                });
              } catch (e) {
                // Not JSON, that's okay
              }
            }
          }
          lastLoggedKey = key;
          lastLoggedValue = value;
        }
        
        return value;
      } catch (error) {
        console.error('[SUPABASE] ❌ Error getting item from SecureStore:', error);
        // Clear cache on error
        cache.delete(key);
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        await SecureStore.setItemAsync(key, value);
        
        // Update cache immediately
        cache.set(key, { value, timestamp: Date.now() });
        
        // Only log on actual changes
        if (__DEV__ && key.includes('auth')) {
          try {
            const parsed = JSON.parse(value);
            console.log(`[SUPABASE] 💾 Session updated:`, {
              hasAccessToken: !!parsed?.access_token,
              hasRefreshToken: !!parsed?.refresh_token,
              expiresAt: parsed?.expires_at,
            });
          } catch (e) {
            // Not JSON, that's okay
          }
        }
      } catch (error) {
        console.error('[SUPABASE] ❌ Error setting item in SecureStore:', error);
        // Clear cache on error
        cache.delete(key);
        throw error; // Re-throw so Supabase knows it failed
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        await SecureStore.deleteItemAsync(key);
        // Clear cache
        cache.delete(key);
        if (__DEV__ && key.includes('auth')) {
          console.log(`[SUPABASE] 🗑️ Session cleared`);
        }
      } catch (error) {
        console.error('[SUPABASE] ❌ Error removing item from SecureStore:', error);
        // Clear cache on error
        cache.delete(key);
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
    if (__DEV__) {
      console.log('[SUPABASE] Server environment - no storage needed');
    }
    return undefined;
  }

  // Web environment - Supabase uses localStorage automatically
  if (isWeb) {
    if (__DEV__) {
      console.log('[SUPABASE] Using localStorage for session persistence (web)');
    }
    return undefined;
  }

  // React Native environment - use SecureStore
  if (isReactNative) {
    if (!Platform) {
      console.error('[SUPABASE] ⚠️ Platform not available!');
      return undefined;
    }

    if (__DEV__) {
      console.log('[SUPABASE] ✅ Using SecureStore for session persistence (PKCE-compatible)');
      console.log('[SUPABASE] Platform.OS:', Platform.OS);
    }
    
    // Verify SecureStore is actually available
    if (!SecureStore || !SecureStore.getItemAsync) {
      console.error('[SUPABASE] ⚠️ SecureStore not available! Falling back to no storage.');
      return undefined;
    }
    
    const adapter = createSecureStoreAdapter();
    if (__DEV__) {
      console.log('[SUPABASE] ✅ SecureStore adapter created with caching');
    }
    return adapter;
  }

  // Fallback
  if (__DEV__) {
    console.log('[SUPABASE] ⚠️ Unknown environment, using default storage');
  }
  return undefined;
};

// Initialize storage
const storage = getStorage();
if (__DEV__) {
  console.log('[SUPABASE] 📦 Storage initialized:', storage ? 'SecureStore adapter' : 'undefined (using default)');
}

// Client-side Supabase (for app usage)
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      storage: storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

if (__DEV__) {
  console.log('[SUPABASE] ✅ Supabase client created with storage:', storage ? 'SecureStore' : 'default');
}

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