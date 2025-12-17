/**
 * Authentication Context
 * Manages user authentication state and provides auth functions
 */

import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { registerForFCMNotifications, setupFCMHandlers } from '../services/fcmNotifications';
import { savePushToken, removePushToken } from '../services/pushNotifications';
import { syncContactToHubSpot } from '../services/hubspotService';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/resendService';
import { User, RegisterFormData, LoginFormData, ApiResponse } from '../types';
import { supabase } from '../services/supabase';
import { cache, CacheKeys } from '../services/cache';
import { mapDbUserToUser, mapUserToDbUser, type DbUser } from '../utils/userTransform';
import { isWeb } from '../utils/platform';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initialAuthComplete: boolean;
  needsPasswordSetup: boolean;
  isPasswordRecovery: boolean;
  signIn: (data: LoginFormData) => Promise<ApiResponse<User>>;
  signUp: (data: RegisterFormData) => Promise<ApiResponse<User>>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<ApiResponse<User>>;
  forgotPassword: (email: string) => Promise<ApiResponse<void>>;
  resetPassword: (newPassword: string) => Promise<ApiResponse<void>>;
  refreshUser: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  isAdmin: boolean;
  isSup: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialAuthComplete, setInitialAuthComplete] = useState(false); // Prevents race condition during initial boot
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [sessionAppRole, setSessionAppRole] = useState<string | null>(null);
  const profileLoadInProgress = useRef<string | null>(null); // Tracks which userId is being loaded

  // Initialize auth state on mount
  useEffect(() => {
    console.log('[AUTH] 🚀 Initializing AuthProvider...');
    let subscription: any;
    let userChannel: any = null;

    const initializeAuth = async () => {
      console.log('[AUTH] 🔐 Starting auth initialization...');
      
      // Check for password recovery tokens in URL (web only)
      if (isWeb && typeof window !== 'undefined' && window.location && window.location.hash) {
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
          console.log('[AUTH] 🔐 Password recovery flow detected');
          setIsPasswordRecovery(true);
        }
      }
      
      try {
        // Get initial session with error handling for invalid tokens
        // Add a small delay to ensure SecureStore is ready (especially in Expo Dev Client)
        console.log('[AUTH] ⏳ Waiting for SecureStore to initialize...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('[AUTH] 📡 Fetching current session from Supabase...');
        let { data: { session }, error } = await supabase.auth.getSession();

        // If no session found, retry multiple times with increasing delays
        // SecureStore might need more time in Expo Dev Client
        if (!session && !error) {
          console.log('[AUTH] ⏳ No session on first attempt, retrying with delays...');
          const retryDelays = [150, 300, 500];
          for (let i = 0; i < retryDelays.length; i++) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
            const retryResult = await supabase.auth.getSession();
            session = retryResult.data.session;
            error = retryResult.error;
            if (session) {
              console.log(`[AUTH] ✅ Session found on retry ${i + 1}`);
              break;
            } else {
              console.log(`[AUTH] ⏳ No session on retry ${i + 1}, trying again...`);
            }
          }
        }

        if (error) {
          // Handle invalid refresh token or any auth errors
          console.log('[AUTH] ⚠️ Session error, clearing auth:', error.message);
          console.log('[AUTH] Error code:', error.code);
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          setLoading(false);
          return;
        }

        if (session) {
          console.log('[AUTH] ✅ Active session found');
          console.log('[AUTH] User ID:', session.user.id);
          console.log('[AUTH] User email:', session.user.email);
          const needsSetup = session?.user?.user_metadata?.needs_password_setup === true;
          setNeedsPasswordSetup(needsSetup);
          if (needsSetup) {
            console.log('[AUTH] Session found but needs password setup');
          }
          await loadUserProfile(session.user.id);
        } else {
          console.log('[AUTH] ℹ️ No active session found');
          setNeedsPasswordSetup(false);
          setLoading(false);
        }
      } catch (error) {
        console.error('[AUTH] ❌ Error initializing auth:', error);
        await supabase.auth.signOut().catch(() => {});
        setUser(null);
        setNeedsPasswordSetup(false);
        setLoading(false);
      } finally {
        // Mark initial auth as complete to prevent race conditions
        setInitialAuthComplete(true);
        console.log('[AUTH] ✅ Initial auth check complete');
      }

      // Return promise so we can chain operations after initialization
      return Promise.resolve();
    };

    // Set up auth state listener
    const setupAuthListener = () => {
      console.log('[AUTH] 👂 Setting up auth state listener...');
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[AUTH] 🔔 Auth state changed:', event);
        
        // Check for recovery flow
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          if (isWeb && typeof window !== 'undefined' && window.location) {
            const hash = window.location.hash || '';
            if (hash.includes('type=recovery')) {
              console.log('[AUTH] 🔐 Password recovery session detected');
              setIsPasswordRecovery(true);
            }
          }
        }

        // Only ignore token refresh events - they don't change auth state
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] ⏭️ Ignoring TOKEN_REFRESHED event');
          return;
        }

        // For INITIAL_SESSION, handle it carefully during initialization
        if (event === 'INITIAL_SESSION') {
          if (user) {
            console.log('[AUTH] ⏭️ Ignoring INITIAL_SESSION - user already loaded');
            return;
          }
          
        // If INITIAL_SESSION fires with null session during initialization,
        // it might mean SecureStore hasn't loaded yet. Wait and retry getSession()
        if (!session && !initialAuthComplete) {
          console.log('[AUTH] ⚠️ INITIAL_SESSION fired with null session during initialization');
          console.log('[AUTH] 🔄 Retrying getSession() multiple times with increasing delays...');
          
          // Try multiple times with increasing delays
          const retryDelays = [100, 200, 500];
          for (let i = 0; i < retryDelays.length; i++) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
            const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
            if (retryError) {
              console.log(`[AUTH] ⚠️ Retry ${i + 1} getSession() error:`, retryError.message);
              continue;
            }
            if (retrySession) {
              console.log(`[AUTH] ✅ Session found on retry ${i + 1} - User ID:`, retrySession.user.id);
              setNeedsPasswordSetup(retrySession?.user?.user_metadata?.needs_password_setup === true);
              await loadUserProfile(retrySession.user.id);
              setupRealtimeSubscription().catch((error) => {
                console.error('[AUTH] ❌ Error setting up real-time subscription:', error);
              });
              return; // Success, exit early
            } else {
              console.log(`[AUTH] ℹ️ No session on retry ${i + 1}, will try again...`);
            }
          }
          console.log('[AUTH] ❌ No session found after all retries - user needs to sign in');
          return; // Don't process this INITIAL_SESSION event further
        }
          
          console.log('[AUTH] 📧 Processing INITIAL_SESSION');
        }

        if (session) {
          console.log('[AUTH] Session active - User ID:', session.user.id);
          setNeedsPasswordSetup(session?.user?.user_metadata?.needs_password_setup === true);
          setSessionAppRole((session.user as any)?.app_metadata?.app_role ?? null);
          await loadUserProfile(session.user.id);
          // Set up real-time subscription after session is confirmed
          setupRealtimeSubscription().catch((error) => {
            console.error('[AUTH] ❌ Error setting up real-time subscription:', error);
          });
        } else {
          console.log('[AUTH] Session ended - User logged out');

          // RACE CONDITION FIX: Don't set loading=false during initial boot
          // Let initializeAuth handle it to prevent premature routing
          // Also ignore INITIAL_SESSION with null during initialization - it might be a timing issue
          if (!initialAuthComplete && event === 'INITIAL_SESSION') {
            console.log('[AUTH] ⏭️ Ignoring INITIAL_SESSION with null session during initialization (timing issue)');
            return;
          }
          
          if (!initialAuthComplete) {
            console.log('[AUTH] ⏭️ Skipping loading state update - initial auth still in progress');
            return;
          }

          setUser(null);
          setNeedsPasswordSetup(false);
          setSessionAppRole(null);
          setLoading(false);
          // Clean up real-time subscription on logout
          if (userChannel) {
            console.log('[AUTH] 🧹 Unsubscribing from user profile changes on logout...');
            supabase.removeChannel(userChannel);
            userChannel = null;
          }
        }
      });
      subscription = sub;
      console.log('[AUTH] ✅ Auth listener registered');
    };

    // Set up real-time subscription for user profile changes
    const setupRealtimeSubscription = async () => {
      console.log('[AUTH] 👂 Setting up real-time user profile subscription...');
      
      // Get current user ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.log('[AUTH] ⚠️ No session found for real-time subscription');
        return;
      }
      
      const userId = session.user.id;
      console.log('[AUTH] 📡 Subscribing to user profile changes for:', userId);
      
      userChannel = supabase
        .channel(`user-profile-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`,
          },
          async (payload) => {
            console.log('[AUTH] 🔔 User profile updated in database:', payload.new);
            // Refresh user profile when database changes
            await loadUserProfile(userId, true);
          }
        )
        .subscribe((status) => {
          console.log('[AUTH] 📡 Real-time subscription status:', status);
        });
    };

    // Initialize auth first
    initializeAuth().then(() => {
      // After initialization completes, set up real-time subscription if we have a session
      setupRealtimeSubscription().catch((error) => {
        console.error('[AUTH] ❌ Error setting up real-time subscription:', error);
      });
    });
    setupAuthListener();
    setupFCMHandlers();

    // Cleanup subscription on unmount
    return () => {
      console.log('[AUTH] 🧹 Cleaning up auth subscription...');
      if (subscription) {
        subscription.unsubscribe();
      }
      if (userChannel) {
        console.log('[AUTH] 🧹 Unsubscribing from user profile changes...');
        supabase.removeChannel(userChannel);
      }
    };
  }, []);

  const loadUserProfile = async (userId: string, forceRefresh: boolean = false) => {
    // GUARD: Prevent concurrent calls for the same user
    if (profileLoadInProgress.current === userId && !forceRefresh) {
      console.log('[AUTH] ⏭️ Profile load already in progress for this user, skipping...');
      return;
    }

    // Set the guard
    profileLoadInProgress.current = userId;
    console.log('[AUTH] 👤 Loading user profile...');
    console.log('[AUTH] User ID:', userId);
    console.log('[AUTH] Force refresh:', forceRefresh);

    const cacheKey = CacheKeys.userProfile(userId);
    if (!forceRefresh) {
      const cachedUser = cache.get<User>(cacheKey);
      if (cachedUser) {
        console.log('[AUTH] ✅ Using cached user profile');
        setUser(cachedUser);
        profileLoadInProgress.current = null;
        setLoading(false);
        return;
      }
    } else {
      cache.delete(cacheKey);
      console.log('[AUTH] 🗑️ Cache cleared for forced refresh');
    }

    const fetchProfileWithTimeout = async (timeoutMs: number = 10000): Promise<any> => {
      console.log('[AUTH] 📊 Querying users table...');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), timeoutMs);
      });
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      return Promise.race([queryPromise, timeoutPromise]);
    };

    const maxRetries = 5;
    const retryDelayMs = 1000;

    try {
      let profileData: any = null;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[AUTH] 📊 Attempt ${attempt}/${maxRetries} to fetch profile...`);
          const { data, error }: any = await fetchProfileWithTimeout();
          console.log('[AUTH] 📊 Query completed');

          if (error) {
            console.error('[AUTH] ❌ Query error:', error.message);
            console.error('[AUTH] Error code:', error.code);
            if (error.code === 'PGRST116' && attempt < maxRetries) {
              console.log(`[AUTH] ⏳ Profile not found, waiting ${retryDelayMs}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
              continue;
            }
            lastError = error;
            break;
          }

          if (data) {
            profileData = data;
            console.log('[AUTH] ✅ Profile found on attempt', attempt);
            break;
          }
        } catch (err: any) {
          console.error('[AUTH] ❌ Attempt', attempt, 'failed:', err.message);
          lastError = err;
          if (err.message === 'Database query timeout') {
            console.log('[AUTH] ⚠️ Query timed out, will retry...');
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
              continue;
            }
          }
          break;
        }
      }

      if (!profileData) {
        console.log('[AUTH] ⚠️ Profile not found after', maxRetries, 'attempts, attempting to create from auth metadata...');
        
        // Get the current auth user to access their metadata
        const { data: { user: authUser }, error: authUserError } = await supabase.auth.getUser();
        
        if (authUserError || !authUser) {
          console.error('[AUTH] ❌ Cannot get auth user:', authUserError?.message);
          setUser(null);
          profileLoadInProgress.current = null;
          setLoading(false);
          return;
        }
        
        console.log('[AUTH] 📧 Auth user email:', authUser.email);
        console.log('[AUTH] 📋 Auth user metadata:', JSON.stringify(authUser.user_metadata, null, 2));
        
        const metadata = authUser.user_metadata || {};
        
        // Prepare profile data from metadata
        const newProfileData = {
          id: userId,
          email: authUser.email,
          full_name: metadata.full_name || metadata.fullName || authUser.email?.split('@')[0] || 'User',
          phone: metadata.phone || null,
          location: metadata.location || null,
          country: metadata.country || 'Jamaica',
          bio: metadata.bio || null,
          areas_of_expertise: metadata.areas_of_expertise || [],
          education: metadata.education || null,
          date_of_birth: metadata.date_of_birth || null,
          role: 'volunteer',
          membership_tier: 'free',
          membership_status: 'inactive',
          is_private: false,
          total_hours: 0,
          activities_completed: 0,
          organizations_helped: 0,
          account_type: 'individual',
          approval_status: 'approved',
          is_partner_organization: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        console.log('[AUTH] 📝 Creating profile with data:', JSON.stringify(newProfileData, null, 2));
        
        try {
          const { data: createdProfile, error: createError } = await supabase
            .from('users')
            .insert(newProfileData)
            .select()
            .single();
          
          if (createError) {
            console.error('[AUTH] ❌ Failed to create profile:', createError.message);
            console.error('[AUTH] Error code:', createError.code);
            console.error('[AUTH] Error details:', createError.details);
            
            // If it's a duplicate key error, try to fetch again (race condition)
            if (createError.code === '23505') {
              console.log('[AUTH] 🔄 Duplicate key - profile may have been created, retrying fetch...');
              const { data: retryData, error: retryError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
              
              if (retryData) {
                profileData = retryData;
                console.log('[AUTH] ✅ Profile found on retry after duplicate key error');
              } else {
                console.error('[AUTH] ❌ Still cannot fetch profile:', retryError?.message);
                setUser(null);
                profileLoadInProgress.current = null;
                setLoading(false);
                return;
              }
            } else {
              setUser(null);
              profileLoadInProgress.current = null;
              setLoading(false);
              return;
            }
          } else {
            profileData = createdProfile;
            console.log('[AUTH] ✅ Profile created successfully');
          }
        } catch (createException: any) {
          console.error('[AUTH] ❌ Exception creating profile:', createException.message);
          setUser(null);
          profileLoadInProgress.current = null;
          setLoading(false);
          return;
        }
      }

      console.log('[AUTH] ✅ Profile data retrieved from database');
      console.log('[AUTH] Email:', profileData.email);
      console.log('[AUTH] Full Name:', profileData.full_name);
      console.log('[AUTH] Role:', profileData.role);

      const userData: User = mapDbUserToUser(profileData as DbUser);

      const cacheTTL = 1 * 60 * 1000;
      cache.set(cacheKey, userData, cacheTTL);
      console.log('[AUTH] 💾 User profile cached (TTL: 1 minute)');
      console.log('[AUTH] 📦 User data transformed successfully');
      setUser(userData);
      console.log('[AUTH] ✅ User state updated');

      profileLoadInProgress.current = null;
      setLoading(false);
      console.log('[AUTH] ✅ Loading complete');

      if (!profileData.push_token) {
        console.log('[AUTH] 🔔 No push token found, registering in background...');
        registerForFCMNotifications()
          .then(async (pushToken) => {
            if (pushToken) {
              console.log('[AUTH] 💾 Saving new push token...');
              const saveResult = await savePushToken(userId, pushToken);
              if (saveResult) {
                console.log('[AUTH] ✅ Push token saved successfully');
              } else {
                console.error('[AUTH] ❌ Failed to save push token to database');
              }
            } else {
              console.log('[AUTH] ⚠️ No push token received');
            }
          })
          .catch((error: any) => {
            console.error('[AUTH] ❌ Push notification registration error:', error?.message);
          });
      } else {
        console.log('[AUTH] ✅ Push token already exists');
      }
    } catch (error) {
      console.error('[AUTH] ❌ Exception while loading user:', error);
      setUser(null);
      profileLoadInProgress.current = null;
      setLoading(false);
      console.log('[AUTH] ✅ Loading complete (after error)');
    }
  };

  const signIn = async (data: LoginFormData): Promise<ApiResponse<User>> => {
    console.log('[AUTH] 🔑 Starting sign in process...');
    console.log('[AUTH] Email:', data.email);
    
    try {
      setLoading(true);

      // Sign in with Supabase
      console.log('[AUTH] 🔐 Authenticating with Supabase...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        console.error('[AUTH] ❌ Authentication failed:', authError.message);
        console.error('[AUTH] Error code:', authError.code);
        return { success: false, error: authError.message };
      }

      console.log('[AUTH] ✅ Authentication successful');
      console.log('[AUTH] User ID:', authData.user.id);
      
      // Verify session is saved to SecureStore
      console.log('[AUTH] 🔍 Verifying session persistence...');
      await new Promise(resolve => setTimeout(resolve, 100)); // Give SecureStore time to save
      const { data: { session: verifySession } } = await supabase.auth.getSession();
      if (verifySession) {
        console.log('[AUTH] ✅ Session verified and persisted to SecureStore');
      } else {
        console.error('[AUTH] ⚠️ WARNING: Session not found in SecureStore after sign-in!');
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      const needsSetup = user?.user_metadata?.needs_password_setup === true;
      setNeedsPasswordSetup(needsSetup);
      if (needsSetup) {
        console.log('[AUTH] User needs to set password - redirecting via layout');
      }

      // Fetch user profile
      console.log('[AUTH] 📥 Fetching user profile from database...');
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('[AUTH] ❌ Failed to fetch user profile:', profileError.message);
        return { success: false, error: profileError.message };
      }

      console.log('[AUTH] ✅ Profile fetched successfully');
      console.log('[AUTH] Full Name:', profileData.full_name);
      console.log('[AUTH] Role:', profileData.role);

      // Transform database user to app User type
      const userData: User = mapDbUserToUser(profileData as DbUser);

      console.log('[AUTH] 📦 Setting user state...');
      setUser(userData);
      console.log('[AUTH] ✅ User state updated');
      
      // Register for push notifications
      console.log('[AUTH] 🔔 Registering for push notifications...');
      try {
        const pushToken = await registerForFCMNotifications();
        
        if (pushToken) {
          console.log('[AUTH] ✅ Push token received, saving to database...');
          const saveResult = await savePushToken(authData.user.id, pushToken);
          if (saveResult) {
            console.log('[AUTH] ✅ Push token saved successfully');
          } else {
            console.error('[AUTH] ❌ Failed to save push token to database');
          }
        } else {
          console.log('[AUTH] ⚠️ No push token received (may be running on simulator or permissions denied)');
        }
      } catch (pushError: any) {
        console.error('[AUTH] ❌ Push notification registration error:', pushError);
        console.error('[AUTH] ❌ Error message:', pushError?.message);
        console.error('[AUTH] ❌ Error stack:', pushError?.stack);
      }

      console.log('[AUTH] 🎉 Sign in process completed successfully');
      return { success: true, data: userData };
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception during sign in:', error);
      console.error('[AUTH] Error message:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get user-friendly error messages
  const getSignUpErrorMessage = (error: any): string => {
    if (!error) return 'An unexpected error occurred';

    const errorCode = error.code;
    const errorMessage = error.message?.toLowerCase() || '';

    // User already exists / Email already registered
    if (
      errorCode === 'signup_disabled' ||
      errorCode === 'user_already_registered' ||
      errorMessage.includes('already registered') ||
      errorMessage.includes('user already exists') ||
      errorMessage.includes('email already confirmed') ||
      errorMessage.includes('email address is already registered')
    ) {
      return 'This email address is already registered. Please sign in or use a different email.';
    }

    // Invalid email format
    if (
      errorCode === 'invalid_email' ||
      errorMessage.includes('invalid email') ||
      errorMessage.includes('email format')
    ) {
      return 'Please enter a valid email address.';
    }

    // Weak password
    if (
      errorCode === 'password_too_short' ||
      errorMessage.includes('password') && errorMessage.includes('short') ||
      errorMessage.includes('password') && errorMessage.includes('weak')
    ) {
      return 'Password must be at least 6 characters long.';
    }

    // Network/connection errors
    if (
      errorCode === 'network_error' ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch')
    ) {
      return 'Network error. Please check your internet connection and try again.';
    }

    // Rate limiting
    if (
      errorCode === 'too_many_requests' ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('rate limit')
    ) {
      return 'Too many signup attempts. Please wait a few minutes and try again.';
    }

    // Database errors
    if (
      errorCode === 'database_error' ||
      errorMessage.includes('database error') ||
      errorMessage.includes('saving new user')
    ) {
      return 'Database error. Please try again in a moment. If the problem persists, contact support.';
    }

    // Return the original message if we can't categorize it
    return error.message || 'Registration failed. Please try again.';
  };

  const signUp = async (data: RegisterFormData): Promise<ApiResponse<User>> => {
    try {
      setLoading(true);
      
      console.log('[AUTH] 🚀 Starting signup process (SDK 54)');
      
      // Prepare metadata object
      const metadata = {
        full_name: data.fullName,
        phone: data.phone,
        location: data.location,
        bio: data.bio || '',
        areas_of_expertise: data.areasOfExpertise || [],
        education: data.education || '',
        country: (data as any).country || 'Jamaica',
        date_of_birth: (data as any).dateOfBirth || null,
        invite_code: (data as any).inviteCode || null,
      };

      // 🔍 DEBUG: Log metadata being sent
      console.log('[AUTH] 📤 Metadata being sent to Supabase:');
      console.log('[AUTH] Metadata object:', JSON.stringify(metadata, null, 2));
      console.log('[AUTH] Metadata keys:', Object.keys(metadata));
      console.log('[AUTH] Full name:', metadata.full_name);
      console.log('[AUTH] Phone:', metadata.phone);
      console.log('[AUTH] Location:', metadata.location);
      
      // Determine signup confirmation redirect URL based on platform.
      // If Supabase email confirmations are enabled, this is where the "Confirm your email" link sends users.
      // - Web: send to hosted web app
      // - Native: send to deep link handled by Expo/React Navigation
      const emailRedirectTo = isWeb
        ? 'https://vibe.volunteersinc.org/login'
        : 'vibe://login';

      // Sign up with Supabase Auth - pass ALL data as metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: metadata,
          emailRedirectTo,
        }
      });

      // 🔍 DEBUG: Log response from Supabase
      if (authError) {
        console.error('[AUTH] ❌ Signup error response:');
        console.error('[AUTH] Error code:', authError.code);
        console.error('[AUTH] Error message:', authError.message);
        console.error('[AUTH] Full error:', JSON.stringify(authError, null, 2));
        const friendlyError = getSignUpErrorMessage(authError);
        return { success: false, error: friendlyError };
      } else if (authData) {
        console.log('[AUTH] ✅ Signup successful response:');
        console.log('[AUTH] User ID:', authData.user?.id);
        console.log('[AUTH] User email:', authData.user?.email);
        console.log('[AUTH] Session exists:', !!authData.session);
        
        // 🔍 DEBUG: Check if metadata was received by Supabase
        if (authData.user) {
          console.log('[AUTH] 🔍 Checking raw_user_meta_data in response:');
          console.log('[AUTH] user_metadata:', JSON.stringify(authData.user.user_metadata, null, 2));
          console.log('[AUTH] app_metadata:', JSON.stringify(authData.user.app_metadata, null, 2));
          
          // Check if metadata fields are present
          const receivedMetadata = authData.user.user_metadata || {};
          console.log('[AUTH] 📥 Received metadata fields:');
          console.log('[AUTH] - full_name:', receivedMetadata.full_name || 'MISSING ❌');
          console.log('[AUTH] - phone:', receivedMetadata.phone || 'MISSING ❌');
          console.log('[AUTH] - location:', receivedMetadata.location || 'MISSING ❌');
          console.log('[AUTH] - country:', receivedMetadata.country || 'MISSING ❌');
          console.log('[AUTH] - date_of_birth:', receivedMetadata.date_of_birth || 'MISSING ❌');
          console.log('[AUTH] - invite_code:', receivedMetadata.invite_code || 'MISSING ❌');
          
          // Warn if metadata is missing
          if (!receivedMetadata.full_name || !receivedMetadata.phone || !receivedMetadata.location) {
            console.warn('[AUTH] ⚠️ WARNING: Some metadata fields are missing in the response!');
            console.warn('[AUTH] This might indicate a serialization issue with SDK 54');
            console.warn('[AUTH] Check if SecureStore + PKCE flow is working correctly');
          } else {
            console.log('[AUTH] ✅ All metadata fields present in response!');
          }
        }
      }

      if (!authData?.user) {
        return { success: false, error: 'Failed to create user account. Please try again.' };
      }

      // Check if email confirmation is required (no session means email confirmation needed)
      if (!authData.session) {
        console.log('[AUTH] ⚠️ Email confirmation required - no session created');
        return { 
          success: true, 
          data: null, // No user data yet - email confirmation required
          requiresEmailConfirmation: true 
        } as any;
      }

      console.log('[AUTH] ✅ Auth user created with session, waiting for trigger to create profile...');

      // Wait for trigger to create profile (with retries)
      let profileData = null;
      let retries = 0;
      const maxRetries = 10;

      while (retries < maxRetries) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        
        if (data) {
          profileData = data;
          console.log('[AUTH] ✅ Profile found after', retries + 1, 'attempts');
          break;
        }
        
        if (error && error.code !== 'PGRST116') {
          console.error('[AUTH] ❌ Error fetching profile:', error);
          return { success: false, error: error.message };
        }
        
        retries++;
        if (retries < maxRetries) {
          console.log(`[AUTH] ⏳ Waiting for trigger... (${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!profileData) {
        console.error('[AUTH] ❌ Profile creation timed out after trigger');
        return { success: false, error: 'Profile creation failed - please contact support' };
      }

      // Transform to User type
      const userData: User = mapDbUserToUser(profileData as DbUser);

      setUser(userData);

      // Register for push notifications (non-blocking)
      try {
        const pushToken = await registerForFCMNotifications();
        if (pushToken) {
          await savePushToken(authData.user.id, pushToken);
          console.log('[AUTH] ✅ Push notifications registered');
        }
      } catch (pushError) {
        // Don't fail signup if push notification registration fails
        console.warn('[AUTH] ⚠️ Push notification registration failed:', pushError);
      }

      // Sync contact to HubSpot and save Contact ID
      console.log('[AUTH] 🔄 Syncing contact to HubSpot...');
      const hubspotResult = await syncContactToHubSpot({
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        location: data.location,
        bio: data.bio,
        areasOfExpertise: data.areasOfExpertise,
        education: data.education,
      });

      if (hubspotResult.success && hubspotResult.contactId) {
        console.log('[AUTH] ✅ HubSpot contact synced:', hubspotResult.contactId);
        
        // Save HubSpot Contact ID to database
        const { error: updateError } = await supabase
          .from('users')
          .update({ hubspot_contact_id: hubspotResult.contactId })
          .eq('id', authData.user.id);
        
        if (updateError) {
          console.error('[AUTH] ⚠️ Failed to save HubSpot Contact ID:', updateError);
        } else {
          console.log('[AUTH] ✅ HubSpot Contact ID saved to database');
        }
      } else {
        console.error('[AUTH] ⚠️ HubSpot sync failed:', hubspotResult.error);
        // Don't fail signup if HubSpot fails - just log it
      }

      // Send welcome email (non-blocking)
      console.log('[AUTH] 📧 Sending welcome email...');
      sendWelcomeEmail(data.email, data.fullName)
        .then((result) => {
          if (result.success) {
            console.log('[AUTH] ✅ Welcome email sent');
          } else {
            console.error('[AUTH] ⚠️ Welcome email failed:', result.error);
          }
        })
        .catch((error) => {
          console.error('[AUTH] ⚠️ Welcome email error:', error);
        });

      console.log('[AUTH] 🎉 Signup complete!');
      return { success: true, data: userData };
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Signup error:', error);
      console.error('[AUTH] Error type:', typeof error);
      console.error('[AUTH] Error details:', JSON.stringify(error, null, 2));
      
      // Handle different error types
      if (error?.code || error?.message) {
        const friendlyError = getSignUpErrorMessage(error);
        return { success: false, error: friendlyError };
      }
      
      // Handle network/connection errors
      if (error?.name === 'NetworkError' || error?.message?.includes('network')) {
        return { success: false, error: 'Network error. Please check your internet connection and try again.' };
      }
      
      // Generic fallback
      return { 
        success: false, 
        error: error?.message || 'An unexpected error occurred during registration. Please try again.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    console.log('[AUTH] 🚪 Starting sign out process...');
    
    try {
      setLoading(true);

      // Remove push token before signing out
      if (user?.id) {
        console.log('[AUTH] 🗑️ Removing push token...');
        console.log('[AUTH] User ID:', user.id);
        const removeResult = await removePushToken(user.id);
        if (removeResult) {
          console.log('[AUTH] ✅ Push token removed successfully');
        } else {
          console.log('[AUTH] ⚠️ Failed to remove push token');
        }
      } else {
        console.log('[AUTH] ℹ️ No user ID found, skipping push token removal');
      }

      console.log('[AUTH] 🔑 Calling Supabase signOut...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AUTH] ❌ Sign out error:', error);
      }
    } catch (error) {
      console.error('[AUTH] ❌ Error during sign out:', error);
    }

    // Clear all state
    setUser(null);
    setNeedsPasswordSetup(false);
    setIsPasswordRecovery(false);
    profileLoadInProgress.current = null;
    setInitialAuthComplete(false); // Reset for next login
    setLoading(false);
    console.log('[AUTH] ✅ Sign out complete');
  };

  const updateProfile = async (updates: Partial<User>): Promise<ApiResponse<User>> => {
    console.log('[AUTH] ✏️ Starting profile update...');
    
    if (!user) {
      console.error('[AUTH] ❌ No user logged in');
      return { success: false, error: 'No user logged in' };
    }

    console.log('[AUTH] User ID:', user.id);
    console.log('[AUTH] Updates requested:', Object.keys(updates));

    try {
      // Update in Supabase
      console.log('[AUTH] 💾 Updating profile in database...');
      const dbUpdates = mapUserToDbUser(updates);
      const { data, error } = await supabase
        .from('users')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('[AUTH] ❌ Database error updating profile:', error.message);
        console.error('[AUTH] Error code:', error.code);
        return { success: false, error: error.message };
      }

      console.log('[AUTH] ✅ Profile updated in database');

      const mappedUpdatedUser = mapDbUserToUser(data as DbUser);
      const updatedUser: User = {
        ...user,
        ...mappedUpdatedUser,
        // Preserve achievements if they were hydrated elsewhere
        achievements: user.achievements ?? mappedUpdatedUser.achievements,
      };

      console.log('[AUTH] 📦 Updating user state...');
      // Update cache with new user data
      const cacheKey = CacheKeys.userProfile(user.id);
      cache.set(cacheKey, updatedUser, 5 * 60 * 1000);
      console.log('[AUTH] 💾 Updated user profile in cache');
      
      setUser(updatedUser);
      console.log('[AUTH] ✅ Profile update completed successfully');
      
      return { success: true, data: updatedUser };
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception during profile update:', error);
      console.error('[AUTH] Error message:', error.message);
      return { success: false, error: error.message };
    }
  };

  const forgotPassword = async (email: string): Promise<ApiResponse<void>> => {
    console.log('[AUTH] 🔑 Starting forgot password process...');
    console.log('[AUTH] Email:', email);
    
    try {
      if (!email) {
        return { success: false, error: 'Email is required' };
      }

      // Get user's name from database for personalized email
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('email', email.toLowerCase())
        .single();

      const fullName = userData?.full_name || 'there';

      // Determine redirect URL based on platform
      const redirectUrl = isWeb 
        ? 'https://vibe.volunteersinc.org/reset-password'
        : 'vibe://reset-password';
      
      console.log('[AUTH] 📧 Redirect URL:', redirectUrl);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('[AUTH] ❌ Failed to send reset email:', error.message);
        return { success: false, error: error.message };
      }

      console.log('[AUTH] ✅ Password reset email sent');
      return { success: true };
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception during forgot password:', error);
      return { success: false, error: error.message || 'Failed to send reset email' };
    }
  };

  const resetPassword = async (newPassword: string): Promise<ApiResponse<void>> => {
    console.log('[AUTH] 🔐 Starting password reset process...');
    
    try {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Update password via Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[AUTH] ❌ Failed to reset password:', error.message);
        return { success: false, error: error.message };
      }

      console.log('[AUTH] ✅ Password reset successfully');
      
      // Clear recovery flag
      setIsPasswordRecovery(false);
      
      return { success: true };
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception during password reset:', error);
      return { success: false, error: error.message || 'Failed to reset password' };
    }
  };

  // Refresh user profile from database
  const refreshUser = async () => {
    if (!user) {
      console.log('[AUTH] ⚠️ Cannot refresh: no user');
      return;
    }
    
    console.log('[AUTH] 🔄 Refreshing user profile...');
    console.log('[AUTH] User ID:', user.id);
    
    // Reload profile with force refresh flag
    await loadUserProfile(user.id, true);
    console.log('[AUTH] ✅ User profile refreshed');
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('[AUTH] ⚠️ refreshSession failed:', error.message);
        return false;
      }
      const appRole = (data?.session?.user as any)?.app_metadata?.app_role ?? null;
      setSessionAppRole(appRole);
      // Re-fetch profile as well (role may have changed)
      if (data?.session?.user?.id) {
        await loadUserProfile(data.session.user.id, true);
      }
      return true;
    } catch (e: any) {
      console.warn('[AUTH] ⚠️ refreshSession exception:', e?.message);
      return false;
    }
  };

  const isAdmin = sessionAppRole === 'admin' || user?.role === 'admin';
  const isSup = sessionAppRole === 'sup' || user?.role === 'sup';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialAuthComplete,
        needsPasswordSetup,
        isPasswordRecovery,
        signIn,
        signUp,
        signOut,
        updateProfile,
        forgotPassword,
        resetPassword,
        refreshUser,
        refreshSession,
        isAdmin,
        isSup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}