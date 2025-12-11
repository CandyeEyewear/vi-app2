import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

export default function SetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Session handling states
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Process hash tokens on mount
  useEffect(() => {
    const processHashTokens = async () => {
      try {
        console.log('[SET-PASSWORD] Processing hash tokens...');
        
        // Get the full URL hash
        const hash = window.location.hash;
        
        if (!hash || !hash.includes('access_token')) {
          // No hash tokens - check if we already have a session
          console.log('[SET-PASSWORD] No hash tokens, checking existing session...');
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            console.log('[SET-PASSWORD] ✅ Existing session found');
            setUserEmail(session.user.email || null);
            setSessionReady(true);
          } else {
            console.log('[SET-PASSWORD] ❌ No session and no tokens');
            setSessionError('No valid session found. Please use the link from your email or request a new one.');
          }
          setCheckingSession(false);
          return;
        }
        
        // Parse hash parameters
        console.log('[SET-PASSWORD] Parsing hash tokens...');
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        console.log('[SET-PASSWORD] access_token present:', !!accessToken);
        console.log('[SET-PASSWORD] refresh_token present:', !!refreshToken);
        
        if (!accessToken) {
          setSessionError('Invalid link. Please request a new password reset email.');
          setCheckingSession(false);
          return;
        }
        
        // Manually set the session using the tokens
        console.log('[SET-PASSWORD] Calling setSession()...');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        
        if (error) {
          console.error('[SET-PASSWORD] ❌ setSession error:', error.message);
          if (error.message.includes('expired') || error.message.includes('invalid')) {
            setSessionError('Your link has expired. Please request a new password reset email.');
          } else {
            setSessionError(`Failed to verify your link: ${error.message}`);
          }
          setCheckingSession(false);
          return;
        }
        
        if (data.session) {
          console.log('[SET-PASSWORD] ✅ Session established for:', data.session.user.email);
          setUserEmail(data.session.user.email || null);
          setSessionReady(true);
          
          // Clean the URL (remove hash) to prevent issues on refresh
          if (window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else {
          console.log('[SET-PASSWORD] ❌ No session returned from setSession');
          setSessionError('Failed to establish session. Please request a new link.');
        }
        
      } catch (error: any) {
        console.error('[SET-PASSWORD] ❌ Exception:', error);
        setSessionError('Something went wrong. Please try again or request a new link.');
      } finally {
        setCheckingSession(false);
      }
    };
    
    processHashTokens();
  }, []);

  const handleSetPassword = async () => {
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

    try {
      // Verify session still exists
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session Expired', 'Please use the link from your email again.');
        setSessionReady(false);
        setSessionError('Session expired. Please request a new link.');
        return;
      }
      
      console.log('[SET-PASSWORD] Updating password...');
      
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password
      });

      if (passwordError) throw passwordError;

      console.log('[SET-PASSWORD] Clearing needs_password_setup flag...');
      
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { needs_password_setup: false }
      });

      if (metadataError) {
        console.warn('[SET-PASSWORD] Could not clear flag:', metadataError);
        // Don't throw - password was set successfully
      }

      console.log('[SET-PASSWORD] ✅ Password set successfully!');

      Alert.alert(
        'Success! 🎉',
        'Your password has been set. Welcome to VIbe!',
        [{ text: 'Get Started', onPress: () => router.replace('/feed' as any) }]
      );

    } catch (error: any) {
      console.error('[SET-PASSWORD] Error:', error);
      Alert.alert('Error', error.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (checkingSession) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Verifying your link...</Text>
      </View>
    );
  }

  // Error state
  if (sessionError) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerContentContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Link Problem</Text>
          <Text style={styles.errorMessage}>{sessionError}</Text>
          
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/forgot-password' as any)}>
            <Text style={styles.primaryButtonText}>Request New Link</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/login' as any)}>
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Password form (only shown when session is ready)
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://46485094.fs1.hubspotusercontent-na1.net/hubfs/46485094/icon%2022a.png' }}
          style={styles.logo}
        />
        <Text style={styles.title}>Set Your Password</Text>
        <Text style={styles.subtitle}>
          {userEmail 
            ? `Secure your account for ${userEmail}`
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
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSetPassword}
          disabled={loading}
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
  errorCard: { backgroundColor: 'white', borderRadius: 12, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  errorEmoji: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 24, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
  errorMessage: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  primaryButton: { backgroundColor: '#4A90E2', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  secondaryButtonText: { color: '#4A90E2', fontSize: 16, fontWeight: '600' },
});
