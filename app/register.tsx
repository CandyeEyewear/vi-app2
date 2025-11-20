/**
 * Register Screen
 * Simplified volunteer registration with essential fields
 * Works with Supabase database trigger for automatic profile creation
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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomAlert from '../components/CustomAlert';

export default function RegisterScreen() {
  const router = useRouter();
  const { invite, code } = useLocalSearchParams<{ invite?: string; code?: string }>();
  const { signUp, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'error' as 'success' | 'error' | 'warning',
  });
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    country: 'Jamaica',
    password: '',
    confirmPassword: '',
    bio: '',
    areasOfExpertise: '',
    education: '',
    dateOfBirth: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [dobDate, setDobDate] = useState<Date>(() => {
    return formData.dateOfBirth ? new Date(formData.dateOfBirth) : new Date(2000, 0, 1);
  });

  // Capture invite code from URL (supports both 'code' and 'invite' parameters)
  useEffect(() => {
    const inviteParam = code || invite;
    if (inviteParam && typeof inviteParam === 'string') {
      setInviteCode(inviteParam);
      console.log('Invite code detected:', inviteParam);
    }
  }, [invite, code]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/(tabs)/feed');
    }
  }, [user, authLoading, router]);

  const handleRegister = async () => {
    // Validation
    if (!formData.fullName || !formData.email || !formData.phone || !formData.location || !formData.country || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Validate DOB
    if (!formData.dateOfBirth) {
      Alert.alert('Error', 'Please enter your date of birth');
      return;
    }

    // Calculate age
    const calculateAge = (dob: string) => {
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    const age = calculateAge(formData.dateOfBirth);
    if (age < 18) {
      Alert.alert('Age Restriction', 'You must be 18 or older to register for VIbe');
      return;
    }

    setLoading(true);

    try {
      // Parse areas of expertise into array
      const expertiseArray = formData.areasOfExpertise
        ? formData.areasOfExpertise.split(',').map(item => item.trim()).filter(Boolean)
        : [];

      // Use AuthContext signUp function - it handles profile creation and user state
      const response = await signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        bio: formData.bio.trim() || undefined,
        areasOfExpertise: expertiseArray.length > 0 ? expertiseArray : undefined,
        education: formData.education.trim() || undefined,
        // Pass additional fields via metadata (country, date_of_birth, invite_code)
        ...(formData.country && { country: formData.country }),
        ...(formData.dateOfBirth && { dateOfBirth: formData.dateOfBirth }),
        ...(inviteCode && { inviteCode }),
      } as any);

      if (!response.success) {
        setAlertConfig({
          title: 'Registration Failed',
          message: response.error || 'An error occurred during registration',
          type: 'error',
        });
        setAlertVisible(true);
        return;
      }

      // Check if email confirmation is required
      if ((response as any).requiresEmailConfirmation || !response.data) {
        // Email confirmation required
        setAlertConfig({
          title: 'Check Your Email',
          message: 'We sent you a confirmation email. Please verify your email address to complete registration.',
          type: 'warning',
        });
        setAlertVisible(true);
        
        // Navigate to login after showing message
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      } else if (response.data) {
        // User is automatically logged in (session exists)
        setAlertConfig({
          title: 'Success!',
          message: 'Your account has been created successfully. Welcome to VIbe!',
          type: 'success',
        });
        setAlertVisible(true);
        
        // Small delay to show success message, then navigate
        // The AuthContext has already set the user, so app/index.tsx will handle redirect
        setTimeout(() => {
          router.replace('/(tabs)/feed');
        }, 1500);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setAlertConfig({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        type: 'error',
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const insets = useSafeAreaInsets();

  // Don't render form if already authenticated
  if (!authLoading && user) {
    return null; // Will redirect via useEffect
  }

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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Join VIbe</Text>
          <Text style={styles.subtitle}>Create your volunteer account</Text>
          
          {inviteCode && (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteText}>🎉 You were invited by a friend!</Text>
            </View>
          )}
        </View>

        {/* Required Fields Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information*</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name*</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.fullName}
              onChangeText={(value) => updateField('fullName', value)}
              editable={!loading}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email*</Text>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number*</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 (876) 123-4567"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              keyboardType="phone-pad"
              editable={!loading}
              autoComplete="tel"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Location*</Text>
            <TextInput
              style={styles.input}
              placeholder="Kingston, Jamaica"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.location}
              onChangeText={(value) => updateField('location', value)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Country*</Text>
            <TextInput
              style={styles.input}
              placeholder="Jamaica"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.country}
              onChangeText={(value) => updateField('country', value)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Date of Birth*</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDobPicker(true)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={{ color: formData.dateOfBirth ? Colors.light.text : Colors.light.textSecondary }}>
                {formData.dateOfBirth
                  ? new Date(formData.dateOfBirth).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Select your date of birth'}
              </Text>
            </TouchableOpacity>
            {showDobPicker && (
              <DateTimePicker
                value={dobDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDobPicker(false);
                  if (selectedDate) {
                    setDobDate(selectedDate);
                    // Store as YYYY-MM-DD for backend consistency
                    const iso = selectedDate.toISOString().split('T')[0];
                    updateField('dateOfBirth', iso);
                  }
                }}
                maximumDate={new Date()}
              />
            )}
            <Text style={styles.helperText}>You must be 18 or older to register</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password*</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                secureTextEntry={!showPassword}
                editable={!loading}
                autoComplete="password-new"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password*</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.confirmPassword}
              onChangeText={(value) => updateField('confirmPassword', value)}
              secureTextEntry={!showPassword}
              editable={!loading}
              autoComplete="password-new"
            />
          </View>
        </View>

        {/* Optional Fields Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Information (Optional)</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about yourself and why you want to volunteer..."
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.bio}
              onChangeText={(value) => updateField('bio', value)}
              multiline
              numberOfLines={4}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Areas of Expertise</Text>
            <TextInput
              style={styles.input}
              placeholder="Teaching, Healthcare, Technology (comma separated)"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.areasOfExpertise}
              onChangeText={(value) => updateField('areasOfExpertise', value)}
              editable={!loading}
            />
            <Text style={styles.helperText}>Separate multiple areas with commas</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Education</Text>
            <TextInput
              style={styles.input}
              placeholder="Bachelor's in Computer Science"
              placeholderTextColor={Colors.light.textSecondary}
              value={formData.education}
              onChangeText={(value) => updateField('education', value)}
              editable={!loading}
            />
          </View>
        </View>

        {/* Register Button */}
        <TouchableOpacity
          style={[styles.registerButton, loading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.registerButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading}>
            <Text style={styles.loginLink}>Sign In</Text>
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
  header: {
    marginBottom: 32,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
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
  registerButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  inviteBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  inviteText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
  },
});