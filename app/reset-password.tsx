/**
 * Reset Password Screen
 * Allows users to set a new password after clicking the reset link
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import CustomAlert from '../components/CustomAlert';
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import { isWeb } from '../utils/platform';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();

  // Session handling states
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });

  // Process hash tokens on mount (web only)
  useEffect(() => {
    const processTokens = async () => {
      try {
        console.log('[RESET-PASSWORD] Processing tokens...');

        if (isWeb && typeof window !== 'undefined') {
          const hash = window.location.hash;

          console.log('[RESET-PASSWORD] URL hash present:', !!hash);

          if (hash && hash.includes('access_token')) {
            console.log('[RESET-PASSWORD] Parsing hash tokens...');
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const type = hashParams.get('type');

            console.log('[RESET-PASSWORD] Token type:', type);
            console.log('[RESET-PASSWORD] access_token present:', !!accessToken);
            console.log('[RESET-PASSWORD] refresh_token present:', !!refreshToken);

            if (!accessToken) {
              setSessionError('Invalid reset link. Please request a new password reset email.');
              setCheckingSession(false);
              return;
            }

            // Establish session from tokens
            console.log('[RESET-PASSWORD] Calling setSession()...');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (error) {
              console.error('[RESET-PASSWORD] setSession error:', error.message);
              if (error.message.includes('expired') || error.message.includes('invalid')) {
                setSessionError('Your reset link has expired. Please request a new one.');
              } else {
                setSessionError(`Failed to verify your link: ${error.message}`);
              }
              setCheckingSession(false);
              return;
            }

            if (data.session) {
              console.log('[RESET-PASSWORD] ✅ Session established for:', data.session.user.email);
              setSessionReady(true);

              // Clean the URL
              if (window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname);
              }
            } else {
              setSessionError('Failed to establish session. Please request a new link.');
            }

            setCheckingSession(false);
            return;
          }
        }

        // No hash tokens - check for existing session
        console.log('[RESET-PASSWORD] No hash tokens, checking existing session...');
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('[RESET-PASSWORD] Session error:', error.message);
          setSessionError('Session error. Please request a new password reset link.');
          setCheckingSession(false);
          return;
        }

        if (session) {
          console.log('[RESET-PASSWORD] ✅ Existing session found for:', session.user.email);
          setSessionReady(true);
        } else {
          console.log('[RESET-PASSWORD] No session found');
          setSessionError('No valid session. Please use the link from your password reset email.');
        }

        setCheckingSession(false);
      } catch (error: any) {
        console.error('[RESET-PASSWORD] Exception:', error);
        setSessionError('Something went wrong. Please try again.');
        setCheckingSession(false);
      }
    };

    processTokens();
  }, []);

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' = 'success'
  ) => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handleResetPassword = async () => {
    if (loading) return;

    // Validation
    if (!newPassword || !confirmPassword) {
      showAlert('Error', 'Please fill in all fields', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Error', 'Passwords do not match', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('[RESET-PASSWORD] Resetting password...');

      const response = await resetPassword(newPassword);

      if (response.success) {
        console.log('[RESET-PASSWORD] ✅ Password reset successful');
        setSuccess(true);

        // Auto-redirect after 2 seconds
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      } else {
        console.error('[RESET-PASSWORD] Reset failed:', response.error);
        showAlert('Error', response.error || 'Failed to reset password. Please try again.', 'error');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('[RESET-PASSWORD] Exception:', error);
      showAlert('Error', error.message || 'An unexpected error occurred', 'error');
      setLoading(false);
    }
  };

  // Loading state
  if (checkingSession) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Verifying your reset link...</Text>
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

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/forgot-password')}>
            <Text style={styles.primaryButtonText}>Request New Link</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/login')}>
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
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
          <Text style={styles.successTitle}>Password Reset!</Text>
          <Text style={styles.successMessage}>
            Your password has been changed successfully.{"\n"}
            Redirecting to login...
          </Text>
          <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginTop: 16 }} />
        </View>
      </ScrollView>
    );
  }

  // Only show password form when session is ready
  if (!sessionReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerContentContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Link Problem</Text>
          <Text style={styles.errorMessage}>
            No valid session. Please use the link from your password reset email.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/forgot-password')}>
            <Text style={styles.primaryButtonText}>Request New Link</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/login')}>
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Password form
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: styles.scrollContent.paddingBottom + insets.bottom + 80 },
        ]}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.iconCircle}>
            <Lock size={32} color={Colors.light.primary} />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your new password below. Make sure it's at least 6 characters long.
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* New Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                placeholderTextColor={Colors.light.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                {showPassword ? (
                  <EyeOff size={20} color={Colors.light.textSecondary} />
                ) : (
                  <Eye size={20} color={Colors.light.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.light.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={Colors.light.textSecondary} />
                ) : (
                  <Eye size={20} color={Colors.light.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.resetButton, loading && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.resetButtonText}>Reset Password</Text>}
          </TouchableOpacity>

          {/* Back to Login */}
          <View style={styles.backToLoginContainer}>
            <Text style={styles.backToLoginText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.backToLoginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  formSection: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
  },
  eyeButton: {
    padding: 16,
  },
  resetButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  backToLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  backToLoginLink: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  // Error card styles
  errorCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  // Success card styles
  successCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#27ae60',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
