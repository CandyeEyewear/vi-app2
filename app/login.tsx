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
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import CustomAlert from '../components/CustomAlert';
import { supabase } from '../services/supabase';
import Button from '../components/Button';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, loading, user } = useAuth();
  const params = useLocalSearchParams();
  const needsVerification = params.needsVerification === 'true';
  const userEmail = params.email as string;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'error' as 'success' | 'error' | 'warning',
  });
  const [resendingEmail, setResendingEmail] = useState(false);

  // Redirect authenticated users away from login screen
  useEffect(() => {
    if (!loading && user) {
      router.replace('/feed' as any);
    }
  }, [user, loading, router]);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  // Don't render login form if user is already authenticated
  if (!loading && user) {
    return null; // Will redirect via useEffect
  }

  const handleTerms = () => {
    Linking.openURL('https://volunteersinc.org/terms-and-conditions');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://volunteersinc.org/vibe-privacy-policy');
  };

  const handleResendVerification = async () => {
    if (!userEmail) return;

    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
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

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Missing Information', 'Please fill in all fields', 'error');
      return;
    }

    const response = await signIn({ email, password });
    
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
        if (errorLower.includes('invalid login credentials') || 
            errorLower.includes('invalid_credentials') ||
            errorLower.includes('email not confirmed') ||
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
      
      // Show alert immediately instead of using pendingError to avoid navigation issues
      setTimeout(() => {
        showAlert('Login Failed', errorMessage, 'error');
      }, 100);
    }
  };

  return (
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
          {needsVerification && (
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
                <Text style={{ fontWeight: '600' }}>{userEmail}</Text>. Please check your
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
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor={Colors.light.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
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

      {/* Custom Alert */}
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