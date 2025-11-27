/**
 * Authentication Context
 * Manages user authentication state and provides auth functions
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { registerForFCMNotifications, setupFCMHandlers } from '../services/fcmNotifications';
import { savePushToken, removePushToken } from '../services/pushNotifications';
import { createHubSpotContact } from '../services/hubspotService';
import { User, RegisterFormData, LoginFormData, ApiResponse } from '../types';
import { supabase } from '../services/supabase';
import { cache, CacheKeys } from '../services/cache';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (data: LoginFormData) => Promise<ApiResponse<User>>;
  signUp: (data: RegisterFormData) => Promise<ApiResponse<User>>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<ApiResponse<User>>;
  forgotPassword: (email: string) => Promise<ApiResponse<void>>;
  resetPassword: (newPassword: string) => Promise<ApiResponse<void>>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    console.log('[AUTH] 🚀 Initializing AuthProvider...');
    let subscription: any;

    const initializeAuth = async () => {
      console.log('[AUTH] 🔐 Starting auth initialization...');
      try {
        // Get initial session with error handling for invalid tokens
        console.log('[AUTH] 📡 Fetching current session from Supabase...');
        const { data: { session }, error } = await supabase.auth.getSession();

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
          await loadUserProfile(session.user.id);
        } else {
          console.log('[AUTH] ℹ️ No active session found');
          setLoading(false);
        }
      } catch (error) {
        console.error('[AUTH] ❌ Error initializing auth:', error);
        await supabase.auth.signOut().catch(() => {});
        setUser(null);
        setLoading(false);
      }
    };

    // Set up auth state listener
    const setupAuthListener = () => {
      console.log('[AUTH] 👂 Setting up auth state listener...');
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[AUTH] 🔔 Auth state changed:', event);

        // ✅ ADD THIS LINE:
        if (event === 'TOKEN_REFRESHED') return; // Ignore token refresh!

        if (session) {
          console.log('[AUTH] Session active - User ID:', session.user.id);
          await loadUserProfile(session.user.id);
        } else {
          console.log('[AUTH] Session ended - User logged out');
          setUser(null);
          setLoading(false);
        }
      });
      subscription = sub;
      console.log('[AUTH] ✅ Auth listener registered');
    };

    initializeAuth();
    setupAuthListener();
    setupFCMHandlers();

    // Cleanup subscription on unmount
    return () => {
      console.log('[AUTH] 🧹 Cleaning up auth subscription...');
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const loadUserProfile = async (userId: string) => {
    console.log('[AUTH] 👤 Loading user profile...');
    console.log('[AUTH] User ID:', userId);
    
    // Check cache first
    const cacheKey = CacheKeys.userProfile(userId);
    const cachedUser = cache.get<User>(cacheKey);
    if (cachedUser) {
      console.log('[AUTH] ✅ Using cached user profile');
      setUser(cachedUser);
      setLoading(false);
      return;
    }
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('[AUTH] ❌ Error loading profile from database:', profileError);
        console.error('[AUTH] Error code:', profileError.code);
        console.error('[AUTH] Error message:', profileError.message);
        setUser(null);
        return;
      }

      console.log('[AUTH] ✅ Profile data retrieved from database');
      console.log('[AUTH] Email:', profileData.email);
      console.log('[AUTH] Full Name:', profileData.full_name);
      console.log('[AUTH] Role:', profileData.role);

      // Transform to User type
      const userData: User = {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        phone: profileData.phone,
        location: profileData.location,
        country: profileData.country,
        bio: profileData.bio,
        areasOfExpertise: profileData.areas_of_expertise,
        education: profileData.education,
        avatarUrl: profileData.avatar_url,
        dateOfBirth: profileData.date_of_birth,
        role: profileData.role,
        membershipTier: profileData.membership_tier || 'free',
        membershipStatus: profileData.membership_status || 'inactive',
        isPrivate: profileData.is_private,
        totalHours: profileData.total_hours,
        activitiesCompleted: profileData.activities_completed,
        organizationsHelped: profileData.organizations_helped,
        achievements: [],
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at,
      };

      // Cache the user data (5 minutes TTL)
      cache.set(cacheKey, userData, 5 * 60 * 1000);
      console.log('[AUTH] 💾 User profile cached');
      console.log('[AUTH] 📊 Membership status:', {
        tier: userData.membershipTier,
        status: userData.membershipStatus,
      });

      console.log('[AUTH] 📦 User data transformed successfully');
      setUser(userData);
      console.log('[AUTH] ✅ User state updated');
      
      // Register for push notifications if we don't have a token yet
      if (!profileData.push_token) {
        try {
          console.log('[AUTH] 🔔 No push token found, registering...');
          const pushToken = await registerForFCMNotifications();
          if (pushToken) {
            console.log('[AUTH] 💾 Saving new push token...');
            const saveResult = await savePushToken(userId, pushToken);
            if (saveResult) {
              console.log('[AUTH] ✅ Push token saved successfully');
            } else {
              console.error('[AUTH] ❌ Failed to save push token to database');
            }
          } else {
            console.log('[AUTH] ⚠️ No push token received (may be running on simulator or permissions denied)');
          }
        } catch (error: any) {
          console.error('[AUTH] ❌ Push notification registration error:', error);
          console.error('[AUTH] ❌ Error message:', error?.message);
          console.error('[AUTH] ❌ Error stack:', error?.stack);
        }
      } else {
        console.log('[AUTH] ✅ Push token already exists');
      }
    } catch (error) {
      console.error('[AUTH] ❌ Exception while loading user:', error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log('[AUTH] Loading complete');
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
      const userData: User = {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        phone: profileData.phone,
        location: profileData.location,
        bio: profileData.bio,
        areasOfExpertise: profileData.areas_of_expertise,
        education: profileData.education,
        avatarUrl: profileData.avatar_url,
        role: profileData.role,
        isPrivate: profileData.is_private,
        totalHours: profileData.total_hours,
        activitiesCompleted: profileData.activities_completed,
        organizationsHelped: profileData.organizations_helped,
        achievements: [],
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at,
      };

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
      
      // Sign up with Supabase Auth - pass ALL data as metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: metadata
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
      const userData: User = {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        phone: profileData.phone,
        location: profileData.location,
        bio: profileData.bio,
        areasOfExpertise: profileData.areas_of_expertise,
        education: profileData.education,
        avatarUrl: profileData.avatar_url,
        role: profileData.role,
        isPrivate: profileData.is_private,
        totalHours: profileData.total_hours,
        activitiesCompleted: profileData.activities_completed,
        organizationsHelped: profileData.organizations_helped,
        achievements: [],
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at,
      };

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

      // Create HubSpot contact (non-blocking - don't fail signup if this fails)
      try {
        console.log('[AUTH] 📧 Creating HubSpot contact...');
        const hubspotResult = await createHubSpotContact({
          email: userData.email,
          fullName: userData.fullName,
          phone: userData.phone,
          location: userData.location,
          bio: userData.bio,
          education: userData.education,
          areasOfExpertise: userData.areasOfExpertise,
        });
        
        if (hubspotResult.success) {
          console.log('[AUTH] ✅ HubSpot contact created successfully');
        } else {
          console.warn('[AUTH] ⚠️ HubSpot contact creation failed:', hubspotResult.error);
          // Don't fail signup if HubSpot fails - just log the warning
        }
      } catch (hubspotError) {
        // Don't fail signup if HubSpot contact creation fails
        console.warn('[AUTH] ⚠️ HubSpot contact creation error:', hubspotError);
      }

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
      
      console.log('[AUTH] 🔓 Signing out from Supabase...');
      await supabase.auth.signOut();
      console.log('[AUTH] ✅ Signed out from Supabase');
      
      console.log('[AUTH] 🧹 Clearing user state...');
      setUser(null);
      console.log('[AUTH] ✅ Sign out process completed');
    } catch (error) {
      console.error('[AUTH] ❌ Error during sign out:', error);
    }
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
      const { data, error } = await supabase
        .from('users')
        .update({
          full_name: updates.fullName,
          phone: updates.phone,
          location: updates.location,
          country: updates.country,
          bio: updates.bio,
          areas_of_expertise: updates.areasOfExpertise,
          education: updates.education,
          avatar_url: updates.avatarUrl,
          date_of_birth: updates.dateOfBirth,
          is_private: updates.isPrivate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('[AUTH] ❌ Database error updating profile:', error.message);
        console.error('[AUTH] Error code:', error.code);
        return { success: false, error: error.message };
      }

      console.log('[AUTH] ✅ Profile updated in database');

      const updatedUser: User = {
        ...user,
        fullName: data.full_name,
        phone: data.phone,
        location: data.location,
        country: data.country,
        bio: data.bio,
        areasOfExpertise: data.areas_of_expertise,
        education: data.education,
        avatarUrl: data.avatar_url,
        dateOfBirth: data.date_of_birth,
        isPrivate: data.is_private,
        updatedAt: data.updated_at,
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

      // Send password reset email via Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'vibe://reset-password',
      });

      if (error) {
        console.error('[AUTH] ❌ Failed to send reset email:', error.message);
        return { success: false, error: error.message };
      }

      console.log('[AUTH] ✅ Password reset email sent successfully');
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
    
    // Clear cache to force fresh load
    const cacheKey = CacheKeys.userProfile(user.id);
    cache.delete(cacheKey);
    console.log('[AUTH] ✅ Cache cleared');
    
    // Reload profile - this will fetch fresh data from database
    await loadUserProfile(user.id);
    console.log('[AUTH] ✅ User profile refreshed');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        forgotPassword,
        resetPassword,
        refreshUser,
        isAdmin,
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