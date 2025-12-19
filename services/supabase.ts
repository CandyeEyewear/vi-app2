import { createClient, type SupportedStorage } from '@supabase/supabase-js';

import { supabaseConfig } from '../config/supabase.config';

// Detect environment: React Native, Web, or Node.js server
const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

let Platform: { OS?: string } | null = null;
let isReactNative = false;
try {
  Platform = require('react-native')?.Platform ?? null;
  isReactNative = !!Platform && (Platform.OS === 'ios' || Platform.OS === 'android');
} catch {
  // Not React Native (or react-native module not available in this runtime)
  Platform = null;
  isReactNative = false;
}

const isServer = !isReactNative && !isWeb;

// Storage backends (native modules may be missing in a dev-client build until rebuilt)
let SecureStore: any = null;
let AsyncStorage: any = null;

if (isReactNative) {
  console.log('[SUPABASE] ✅ React Native environment detected');

  // Expo SecureStore (preferred)
  try {
    SecureStore = require('expo-secure-store');
  } catch (error) {
    console.error('[SUPABASE] ❌ expo-secure-store native module missing:', error);
    console.error('[SUPABASE] 👉 If you use Expo Dev Client, you must rebuild the client after adding/upgrading Expo modules.');
    SecureStore = null;
  }

  // AsyncStorage fallback (less secure, but avoids total auth persistence failure)
  if (!SecureStore) {
    try {
      // Some builds export default, others export module directly
      const mod = require('@react-native-async-storage/async-storage');
      AsyncStorage = mod?.default ?? mod;
      console.warn('[SUPABASE] ⚠️ Falling back to AsyncStorage for session persistence (SecureStore unavailable)');
    } catch (error) {
      console.error('[SUPABASE] ❌ AsyncStorage module missing too:', error);
      AsyncStorage = null;
    }
  }
} else if (isServer) {
  console.log('[SUPABASE] Server environment detected');
} else {
  console.log('[SUPABASE] Web browser environment detected');
}

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

// Create AsyncStorage adapter (fallback for when SecureStore isn't available)
const createAsyncStorageAdapter = (): SupportedStorage => {
  const cache = new Map<string, { value: string | null; timestamp: number }>();
  const CACHE_TTL = 100;

  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const now = Date.now();
        const cached = cache.get(key);
        if (cached && (now - cached.timestamp) < CACHE_TTL) return cached.value;

        const value = await AsyncStorage.getItem(key);
        cache.set(key, { value, timestamp: now });
        return value;
      } catch (error) {
        console.error('[SUPABASE] ❌ Error getting item from AsyncStorage:', error);
        cache.delete(key);
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        await AsyncStorage.setItem(key, value);
        cache.set(key, { value, timestamp: Date.now() });
      } catch (error) {
        console.error('[SUPABASE] ❌ Error setting item in AsyncStorage:', error);
        cache.delete(key);
        throw error;
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        await AsyncStorage.removeItem(key);
        cache.delete(key);
      } catch (error) {
        console.error('[SUPABASE] ❌ Error removing item from AsyncStorage:', error);
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
    if (__DEV__) {
      console.log('[SUPABASE] ✅ Using SecureStore for session persistence (PKCE-compatible)');
      console.log('[SUPABASE] Platform.OS:', Platform?.OS ?? 'unknown');
    }
    
    // Verify SecureStore is actually available
    if (!SecureStore || !SecureStore.getItemAsync) {
      if (AsyncStorage && AsyncStorage.getItem && AsyncStorage.setItem && AsyncStorage.removeItem) {
        if (__DEV__) {
          console.warn('[SUPABASE] ⚠️ SecureStore not available. Using AsyncStorage adapter.');
        }
        return createAsyncStorageAdapter();
      }

      console.error('[SUPABASE] ⚠️ No React Native storage backend available. Falling back to no storage.');
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
      // Web-based auth flows (email confirmation, magic links, OAuth) return sessions via URL.
      // Keep this off for native apps, but on for web so confirmations can complete.
      detectSessionInUrl: isWeb,
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