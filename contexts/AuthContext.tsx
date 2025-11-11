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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        setUser(null);
        return;
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
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (data: LoginFormData): Promise<ApiResponse<User>> => {
    try {
      setLoading(true);

      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        return { success: false, error: profileError.message };
      }

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

      setUser(userData);
      
      // Register for push notifications
      const pushToken = await registerForPushNotifications();
      if (pushToken && authData.user) {
        await savePushToken(authData.user.id, pushToken);
      }

      return { success: true, data: userData };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: RegisterFormData): Promise<ApiResponse<User>> => {
    try {
      setLoading(true);

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user' };
      }

      // Create user profile
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
        return { success: false, error: profileError.message };
      }

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

      // Register for push notifications
      const pushToken = await registerForPushNotifications();
      if (pushToken && authData.user) {
        await savePushToken(authData.user.id, pushToken);
      }

      return { success: true, data: userData };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Remove push token before signing out
      if (user?.id) {
        await removePushToken(user.id);
      }
      
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<ApiResponse<User>> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      // Update in Supabase
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
        return { success: false, error: error.message };
      }

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

      setUser(updatedUser);
      return { success: true, data: updatedUser };
    } catch (error: any) {
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
