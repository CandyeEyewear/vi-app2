/**
 * Login Screen
 * Beautiful login interface with VIbe branding
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
  Linking,
  Image,
  Alert,
} from 'react-native';
import { useRouter, Redirect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { useAlert } from '../hooks/useAlert';
import { supabase } from '../services/supabase';
import Button from '../components/Button';
import { isWeb } from '../utils/platform';

let GoogleSignin: any = null;
const VERIFICATION_NOTICE_KEY = 'pending_email_verification_notice';
if (!isWeb) {
  try {
    const gsi = require('@react-native-google-signin/google-signin');
    GoogleSignin = gsi.GoogleSignin;
  } catch (e) {
    console.warn('[LOGIN] Google Sign-In not available:', e);
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, loading, user } = useAuth();
  const params = useLocalSearchParams();
  const needsVerificationParam = params.needsVerification;
  const userEmailParam = params.email;
  const needsVerification = Array.isArray(needsVerificationParam)
    ? needsVerificationParam.some((value) => {
        const normalized = String(value).toLowerCase();
        return normalized === 'true' || normalized === '1';
      })
    : (() => {
        const normalized = String(needsVerificationParam ?? '').toLowerCase();
        return normalized === 'true' || normalized === '1';
      })();
  const userEmail = Array.isArray(userEmailParam)
    ? (userEmailParam[0] || '')
    : String(userEmailParam || '');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [fallbackNeedsVerification, setFallbackNeedsVerification] = useState(false);
  const [fallbackVerificationEmail, setFallbackVerificationEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { showAlert } = useAlert();
  const [resendingEmail, setResendingEmail] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [exchangingCode, setExchangingCode] = useState(false);
  const effectiveNeedsVerification = needsVerification || fallbackNeedsVerification;
  const effectiveVerificationEmail = (userEmail || fallbackVerificationEmail || '').trim();

  // Handle PKCE code exchange from email verification redirect.
  // When users click the verification link in their email, Supabase redirects
  // to this page with ?code=<pkce_code>. We must exchange it for a session.
  const codeParam = params.code;
  const authCode = Array.isArray(codeParam) ? codeParam[0] : codeParam;

  useEffect(() => {
    if (!authCode || exchangingCode) return;

    const exchangeCode = async () => {
      setExchangingCode(true);
      console.log('[LOGIN] PKCE auth code detected, exchanging for session...');
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(String(authCode));
        if (error) {
          console.error('[LOGIN] PKCE code exchange failed:', error);
          showAlert({
            type: 'error',
            title: 'Verification Failed',
            message: 'Unable to verify your email. The link may have expired — please try signing in and resending the verification email.',
          });
        } else {
          console.log('[LOGIN] PKCE code exchange successful — session established');
          showAlert({
            type: 'success',
            title: 'Email Verified',
            message: 'Your email has been verified! Redirecting...',
          });
          router.replace('/feed' as any);
        }
      } catch (err) {
        console.error('[LOGIN] PKCE exchange error:', err);
      } finally {
        setExchangingCode(false);
      }
    };

    exchangeCode();
  }, [authCode]);

  useEffect(() => {
    if (userEmail && !email) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  useEffect(() => {
    let mounted = true;

    const hydrateVerificationNotice = async () => {
      if (needsVerification) {
        setFallbackNeedsVerification(true);
        if (userEmail) {
          setFallbackVerificationEmail(userEmail);
        }
        try {
          await AsyncStorage.removeItem(VERIFICATION_NOTICE_KEY);
        } catch {}
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(VERIFICATION_NOTICE_KEY);
        if (!raw || !mounted) return;

        const parsed = JSON.parse(raw);
        const ts = Number(parsed?.ts || 0);
        const isFresh = !!ts && Date.now() - ts <= 30 * 60 * 1000;
        if (!isFresh) {
          await AsyncStorage.removeItem(VERIFICATION_NOTICE_KEY);
          return;
        }

        setFallbackNeedsVerification(true);
        if (typeof parsed?.email === 'string' && parsed.email.trim()) {
          const normalizedEmail = parsed.email.trim();
          setFallbackVerificationEmail(normalizedEmail);
          setEmail((prev) => prev || normalizedEmail);
        }

        await AsyncStorage.removeItem(VERIFICATION_NOTICE_KEY);
      } catch (error) {
        console.warn('[LOGIN] Failed to hydrate verification notice', error);
      }
    };

    hydrateVerificationNotice();
    return () => {
      mounted = false;
    };
  }, [needsVerification, userEmail]);

  // Configure Google Sign-In on mount
  useEffect(() => {
    if (GoogleSignin) {
      GoogleSignin.configure({
        webClientId: '771771235452-4qd63i98hjp7r8fah0sdpus8fdifrf81.apps.googleusercontent.com',
        iosClientId: '771771235452-ipe2kn383hf02f8ui5j7s4gr5ehebr2q.apps.googleusercontent.com',
      });
    }
  }, []);

  // Redirect authenticated users away from login screen
  useEffect(() => {
    if (!loading && user) {
      router.replace('/feed' as any);
    }
  }, [user, loading, router]);


  // Don't render login form if user is already authenticated or code exchange is in progress
  if ((!loading && user) || exchangingCode) {
    return null; // Will redirect via useEffect or PKCE exchange
  }

  const handleTerms = () => {
    Linking.openURL('https://volunteersinc.org/terms-and-conditions');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://volunteersinc.org/vibe-privacy-policy');
  };

  const handleResendVerification = async () => {
    const targetEmail = effectiveVerificationEmail;
    if (!targetEmail) return;

    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
      });

      if (error) {
        Alert.alert('Error', 'Failed to resend verification email. Please try again.');
      } else {
        Alert.alert('Email Sent!', 'We sent you a new verification link. Please check your inbox.');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GoogleSignin) {
      showAlert({ title: 'Unavailable', message: 'Google Sign-In is not available on this platform.', type: 'error' });
      return;
    }

    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.data?.idToken;

      if (!idToken) {
        throw new Error('Failed to get ID token from Google.');
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (authError) {
        throw authError;
      }

      const user = authData?.user;
      if (!user) {
        throw new Error('No user returned from sign-in.');
      }

      // Check if profile exists, create one if first-time Google user
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile) {
        console.log('[LOGIN] First-time Google user, creating profile...');
        await supabase.from('users').insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
          account_type: 'volunteer',
          role: 'volunteer',
        });
      }

      console.log('[LOGIN] Google sign-in successful');
      setTimeout(() => {
        router.replace('/feed' as any);
      }, 100);
    } catch (error: any) {
      console.error('[LOGIN] Google sign-in error:', error);
      // Don't show error if user cancelled
      if (error?.code !== 'SIGN_IN_CANCELLED' && error?.code !== 'ERR_CANCELED') {
        showAlert({
          title: 'Google Sign-In Failed',
          message: error?.message || 'Something went wrong. Please try again.',
          type: 'error',
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const validateEmailField = () => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleLogin = async () => {
    console.log('[LOGIN] Login requested');

    if (!email || !password) {
      console.log('[LOGIN] Missing credentials, showing alert');
      if (!email.trim()) {
        setEmailError('Email is required');
      }
      showAlert({ title: 'Missing Information', message: 'Please fill in all fields', type: 'error' });
      return;
    }

    if (!validateEmailField()) {
      showAlert({ title: 'Invalid Email', message: 'Please enter a valid email address.', type: 'error' });
      return;
    }

    // Prevent multiple simultaneous sign-in attempts
    if (loading) {
      console.log('[LOGIN] Already loading, ignoring duplicate call');
      return;
    }

    try {
      console.log('[LOGIN] Calling signIn...');
      const response = await signIn({ email, password });
      console.log('[LOGIN] signIn response:', { success: response.success, hasError: !!response.error });

      if (response.success) {
        // Small delay to ensure Root Layout is fully mounted before navigating
        setTimeout(() => {
          router.replace('/feed' as any);
        }, 100);
      } else {
        // Provide user-friendly error messages
        let errorMessage = 'Please check your credentials and try again.';

        if (response.error) {
          const errorLower = response.error.toLowerCase();
          if (errorLower.includes('email not confirmed')) {
            errorMessage = 'Please verify your email address before signing in. Check your inbox for the verification link.';
          } else if (errorLower.includes('invalid login credentials') ||
            errorLower.includes('invalid_credentials') ||
            errorLower.includes('invalid password') ||
            errorLower.includes('user not found')) {
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          } else if (errorLower.includes('too many requests')) {
            errorMessage = 'Too many login attempts. Please wait a moment and try again.';
          } else if (errorLower.includes('network') || errorLower.includes('connection')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          } else {
            errorMessage = response.error;
          }
        }

        // Show alert immediately
        console.log('[LOGIN] Showing error alert:', errorMessage);
        showAlert({ title: 'Login Failed', message: errorMessage, type: 'error' });
      }
    } catch (error) {
      console.error('[LOGIN] Exception in handleLogin:', error);
      showAlert({ title: 'Login Failed', message: 'An unexpected error occurred. Please try again.', type: 'error' });
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: styles.scrollContent.paddingBottom + insets.bottom + 80 }
          ]}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Changing Communities Through Volunteerism</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue volunteering</Text>
            {effectiveNeedsVerification && (
              <View
                style={{
                  backgroundColor: '#e3f2fd',
                  borderLeftWidth: 4,
                  borderLeftColor: '#4A90E2',
                  padding: 16,
                  marginBottom: 20,
                  borderRadius: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: 8,
                  }}
                >
                  📧 Verify Your Email
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#555',
                    lineHeight: 20,
                  }}
                >
                  We sent a verification link to{' '}
                  <Text style={{ fontWeight: '600' }}>{effectiveVerificationEmail || 'your email address'}</Text>. Please check your
                  inbox (and spam folder) to verify your account before logging in.
                </Text>
                <Button
                  variant="primary"
                  loading={resendingEmail}
                  disabled={resendingEmail}
                  onPress={handleResendVerification}
                  style={{ marginTop: 12, alignSelf: 'flex-start' }}
                >
                  Resend Verification Link
                </Button>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                placeholder="your.email@example.com"
                placeholderTextColor={Colors.light.textSecondary}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (emailError) setEmailError('');
                }}
                onBlur={validateEmailField}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => {
                setTimeout(() => {
                  router.push('/forgot-password');
                }, 100);
              }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <Button
              variant="primary"
              size="lg"
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              style={styles.loginButton}
            >
              Sign In
            </Button>

            {/* Divider */}
            {!isWeb && GoogleSignin && (
              <>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In Button */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  activeOpacity={0.7}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#4285F4" style={{ marginRight: 12 }} />
                  ) : (
                    <View style={styles.googleIconContainer}>
                      <Text style={styles.googleIcon}>G</Text>
                    </View>
                  )}
                  <Text style={styles.googleButtonText}>Sign in with Google</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => {
                  setTimeout(() => {
                    router.push('/register');
                  }, 100);
                }}
              >
                <Text style={styles.registerLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleTerms}>
              <Text style={styles.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.footerDivider}>•</Text>
            <TouchableOpacity onPress={handlePrivacyPolicy}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
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
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  formSection: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 32,
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
  input: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  errorText: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 4,
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
  eyeText: {
    fontSize: 20,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  loginButton: {
    marginBottom: 24,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerLink: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  footerDivider: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginHorizontal: 8,
  },
});
