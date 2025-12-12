import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function SetPasswordScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Simple session check on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('[SET-PASSWORD] Checking session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[SET-PASSWORD] Session error:', error.message);
          setSessionError('Session error. Please try logging in again.');
          setCheckingSession(false);
          return;
        }
        
        if (!session) {
          console.log('[SET-PASSWORD] No session found');
          setSessionError('No active session. Please use the link from your email or log in.');
          setCheckingSession(false);
          return;
        }
        
        console.log('[SET-PASSWORD] ✅ Session found for:', session.user.email);
        setCheckingSession(false);
        
      } catch (error: any) {
        console.error('[SET-PASSWORD] Exception:', error);
        setSessionError('Something went wrong. Please try again.');
        setCheckingSession(false);
      }
    };
    
    checkSession();
  }, []);

  const handleSetPassword = async () => {
    if (loading) return;

    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    console.log('[SET-PASSWORD] Starting password update...');

    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password
      });

      if (passwordError) {
        if (passwordError.message.includes('different from the old password')) {
          console.log('[SET-PASSWORD] Password already set, proceeding...');
        } else {
          throw passwordError;
        }
      }

      console.log('[SET-PASSWORD] ✅ Password updated');

      // Clear the needs_password_setup flag
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { needs_password_setup: false }
      });

      if (metadataError) {
        console.warn('[SET-PASSWORD] Could not clear flag:', metadataError.message);
      }

      console.log('[SET-PASSWORD] ✅ Flag cleared');

      // Refresh user to update auth context
      if (refreshUser) {
        await refreshUser();
      }

      console.log('[SET-PASSWORD] ✅ Password set successfully, showing success state');

      // Ensure we don't leave the button stuck in loading
      setLoading(false);

      // Set success state to show success UI
      setSuccess(true);

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        console.log('[SET-PASSWORD] Redirecting to feed...');
        router.replace('/feed' as any);
      }, 2000);

    } catch (error: any) {
      console.error('[SET-PASSWORD] Error:', error);
      setLoading(false);
      
      let errorMessage = 'Failed to set password. Please try again.';
      if (error.message?.includes('expired')) {
        errorMessage = 'Your session has expired. Please request a new link.';
        setSessionError(errorMessage);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  // Loading state
  if (checkingSession) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Error state
  if (sessionError) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerContentContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Session Problem</Text>
          <Text style={styles.errorMessage}>{sessionError}</Text>
          
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/login' as any)}>
            <Text style={styles.primaryButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Success state
  if (success) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerContentContainer}>
        <View style={styles.successCard}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Password Set!</Text>
          <Text style={styles.successMessage}>
            Your password has been saved successfully.{'\n'}
            Redirecting you to the app...
          </Text>
          <ActivityIndicator size="small" color="#4A90E2" style={{ marginTop: 16 }} />
        </View>
      </ScrollView>
    );
  }

  // Password form
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://46485094.fs1.hubspotusercontent-na1.net/hubfs/46485094/icon%2022a.png' }}
          style={styles.logo}
        />
        <Text style={styles.title}>Set Your Password</Text>
        <Text style={styles.subtitle}>
          {user?.email 
            ? `Secure your account for ${user.email}`
            : 'Secure your VIbe account by creating a strong password'
          }
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.requirementsBox}>
          <Text style={styles.requirementsTitle}>Password Requirements:</Text>
          <Text style={styles.requirement}>• At least 8 characters</Text>
          <Text style={styles.requirement}>• Include uppercase letters (A-Z)</Text>
          <Text style={styles.requirement}>• Include numbers (0-9)</Text>
          <Text style={styles.requirement}>• Include special characters (!@#$%)</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (loading || !password || !confirmPassword) && styles.buttonDisabled]}
          onPress={handleSetPassword}
          disabled={loading || !password || !confirmPassword}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Setting Password...' : 'Set Password & Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  contentContainer: { padding: 20 },
  centerContainer: { flex: 1, backgroundColor: '#f5f7fa', justifyContent: 'center', alignItems: 'center', padding: 20 },
  centerContentContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  logo: { width: 80, height: 80, marginBottom: 16, resizeMode: 'contain' as any },
  title: { fontSize: 28, fontWeight: '700', color: '#2c3e50', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', paddingHorizontal: 20 },
  form: { backgroundColor: 'white', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  inputContainer: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  requirementsBox: { backgroundColor: '#e3f2fd', padding: 16, borderRadius: 8, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#4A90E2' },
  requirementsTitle: { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 8 },
  requirement: { fontSize: 13, color: '#555', marginBottom: 4 },
  button: { backgroundColor: '#4A90E2', paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  successCard: { backgroundColor: 'white', borderRadius: 12, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 28, fontWeight: '700', color: '#27ae60', marginBottom: 12 },
  successMessage: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  errorCard: { backgroundColor: 'white', borderRadius: 12, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  errorEmoji: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 24, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
  errorMessage: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  primaryButton: { backgroundColor: '#4A90E2', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
