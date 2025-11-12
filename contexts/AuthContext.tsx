/**
 * Authentication Context
 * Manages user authentication state and provides auth functions
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { registerForPushNotifications, savePushToken, removePushToken } from '../services/pushNotifications';
import { User, RegisterFormData, LoginFormData, ApiResponse } from '../types';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (data: LoginFormData) => Promise<ApiResponse<User>>;
  signUp: (data: RegisterFormData) => Promise<ApiResponse<User>>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<ApiResponse<User>>;
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

      console.log('[AUTH] 📦 User data transformed successfully');
      setUser(userData);
      console.log('[AUTH] ✅ User state updated');
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
      const pushToken = await registerForPushNotifications();
      
      if (pushToken) {
        console.log('[AUTH] ✅ Push token received, saving to database...');
        const saveResult = await savePushToken(authData.user.id, pushToken);
        if (saveResult) {
          console.log('[AUTH] ✅ Push token saved successfully');
        } else {
          console.log('[AUTH] ⚠️ Failed to save push token');
        }
      } else {
        console.log('[AUTH] ⚠️ No push token received (may be running on simulator)');
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

  const signUp = async (data: RegisterFormData): Promise<ApiResponse<User>> => {
    console.log('[AUTH] 📝 Starting sign up process...');
    console.log('[AUTH] Email:', data.email);
    console.log('[AUTH] Full Name:', data.fullName);
    
    try {
      setLoading(true);

      // Sign up with Supabase Auth
      console.log('[AUTH] 🔐 Creating Supabase auth account...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        console.error('[AUTH] ❌ Failed to create auth account:', authError.message);
        console.error('[AUTH] Error code:', authError.code);
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        console.error('[AUTH] ❌ Auth data returned but no user object');
        return { success: false, error: 'Failed to create user' };
      }

      console.log('[AUTH] ✅ Auth account created successfully');
      console.log('[AUTH] User ID:', authData.user.id);

      // Create user profile
      console.log('[AUTH] 💾 Creating user profile in database...');
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: data.email,
          full_name: data.fullName,
          phone: data.phone,
          location: data.location,
          bio: data.bio,
          areas_of_expertise: data.areasOfExpertise,
          education: data.education,
          role: 'volunteer',
          is_private: false,
          total_hours: 0,
          activities_completed: 0,
          organizations_helped: 0,
        })
        .select()
        .single();

      if (profileError) {
        console.error('[AUTH] ❌ Failed to create user profile:', profileError.message);
        console.error('[AUTH] Error code:', profileError.code);
        console.error('[AUTH] Error details:', profileError.details);
        return { success: false, error: profileError.message };
      }

      console.log('[AUTH] ✅ User profile created successfully');

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
      const pushToken = await registerForPushNotifications();
      
      if (pushToken) {
        console.log('[AUTH] ✅ Push token received, saving to database...');
        const saveResult = await savePushToken(authData.user.id, pushToken);
        if (saveResult) {
          console.log('[AUTH] ✅ Push token saved successfully');
        } else {
          console.log('[AUTH] ⚠️ Failed to save push token');
        }
      } else {
        console.log('[AUTH] ⚠️ No push token received (may be running on simulator)');
      }

      console.log('[AUTH] 🎉 Sign up process completed successfully');
      return { success: true, data: userData };
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception during sign up:', error);
      console.error('[AUTH] Error message:', error.message);
      return { success: false, error: error.message };
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
          bio: updates.bio,
          areas_of_expertise: updates.areasOfExpertise,
          education: updates.education,
          avatar_url: updates.avatarUrl,
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
        bio: data.bio,
        areasOfExpertise: data.areas_of_expertise,
        education: data.education,
        avatarUrl: data.avatar_url,
        isPrivate: data.is_private,
        updatedAt: data.updated_at,
      };

      console.log('[AUTH] 📦 Updating user state...');
      setUser(updatedUser);
      console.log('[AUTH] ✅ Profile update completed successfully');
      
      return { success: true, data: updatedUser };
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception during profile update:', error);
      console.error('[AUTH] Error message:', error.message);
      return { success: false, error: error.message };
    }
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