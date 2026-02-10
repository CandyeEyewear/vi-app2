/**
 * Organization Registration Screen
 * For partner organizations to create accounts
 * Sets account_type='organization' and approval_status='pending'
 */

import React, { useState } from 'react';
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
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import CustomAlert from '../components/CustomAlert';
import { useAuth } from '../contexts/AuthContext';
import CountryPicker from '../components/CountryPicker';

const VERIFICATION_NOTICE_KEY = 'pending_email_verification_notice';

export default function RegisterOrganizationScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { signUp, signOut, updateProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'error' as 'success' | 'error' | 'warning',
  });
  
  const [formData, setFormData] = useState({
    // Login credentials
    email: '',
    password: '',
    confirmPassword: '',
    
    // Organization details
    organizationName: '',
    registrationNumber: '',
    organizationDescription: '',
    websiteUrl: '',
    
    // Contact person
    contactPersonName: '',
    contactPersonRole: '',
    phone: '',
    
    // Organization specifics
    location: '',
    country: 'Jamaica',
    organizationSize: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);

  const persistVerificationNotice = async (email: string) => {
    try {
      await AsyncStorage.setItem(
        VERIFICATION_NOTICE_KEY,
        JSON.stringify({
          email: email.trim().toLowerCase(),
          ts: Date.now(),
        })
      );
    } catch (error) {
      console.warn('[REGISTER_ORG] Failed to persist verification notice', error);
    }
  };

  const isValidPhone = (phone: string) => {
    const trimmed = phone.trim();
    if (!trimmed) return false;
    if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  };

  // Industry focus options
  const industryOptions = [
    'Education',
    'Healthcare',
    'Environment',
    'Community Development',
    'Youth Development',
    'Elderly Care',
    'Disaster Relief',
    'Animal Welfare',
    'Arts & Culture',
    'Sports & Recreation',
    'Technology',
    'Other',
  ];

  // Organization size options
  const sizeOptions = ['1-10', '11-50', '51-200', '200+'];

  const handleRegister = async () => {
    // Validation
    if (!formData.email || !formData.password || !formData.organizationName || 
        !formData.registrationNumber || !formData.organizationDescription ||
        !formData.contactPersonName || !formData.phone || !formData.location || !formData.country) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!isValidPhone(formData.phone)) {
      Alert.alert('Error', 'Please enter a valid phone number (7–15 digits)');
      return;
    }

    if (selectedFocus.length === 0) {
      Alert.alert('Error', 'Please select at least one industry focus area');
      return;
    }

    if (!formData.organizationSize) {
      Alert.alert('Error', 'Please select your organization size');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create the auth user via AuthContext (handles side effects)
      const signUpResponse = await signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.organizationName.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        bio: formData.organizationDescription.trim() || undefined,
        ...(formData.country && { country: formData.country }),
        accountType: 'organization',
        approvalStatus: 'pending',
        isPartnerOrganization: false,
        organizationData: {
          organization_name: formData.organizationName.trim(),
          registration_number: formData.registrationNumber.trim(),
          organization_description: formData.organizationDescription.trim(),
          website_url: formData.websiteUrl.trim() || null,
          contact_person_name: formData.contactPersonName.trim(),
          contact_person_role: formData.contactPersonRole.trim() || null,
          organization_size: formData.organizationSize,
          industry_focus: selectedFocus,
        },
      });

      if (!signUpResponse.success) {
        throw new Error(signUpResponse.error || 'Failed to create user account');
      }

      if ((signUpResponse as any).requiresEmailConfirmation || !signUpResponse.data) {
        await persistVerificationNotice(formData.email);
        setAlertConfig({
          title: 'Verify Your Email',
          message: 'We sent a verification link to your email. Please verify your account, then sign in.',
          type: 'warning',
        });
        setAlertVisible(true);
        router.replace({
          pathname: '/login',
          params: {
            needsVerification: 'true',
            email: formData.email.trim().toLowerCase(),
          },
        } as any);
        return;
      }

      // Step 2: Update the user profile with organization data (profile row already created by AuthContext)
      const organizationData = {
        organization_name: formData.organizationName.trim(),
        registration_number: formData.registrationNumber.trim(),
        organization_description: formData.organizationDescription.trim(),
        website_url: formData.websiteUrl.trim() || null,
        contact_person_name: formData.contactPersonName.trim(),
        contact_person_role: formData.contactPersonRole.trim() || null,
        organization_size: formData.organizationSize,
        industry_focus: selectedFocus,
      };

      const updateProfileResponse = await updateProfile({
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        country: formData.country,
        account_type: 'organization',
        organization_data: organizationData,
        approval_status: 'pending',
        is_partner_organization: false, // Will become true after admin approval + payment
      });

      if (!updateProfileResponse.success) {
        throw new Error(updateProfileResponse.error || 'Failed to save organization profile');
      }

      // Step 3: Notify admins (you'll implement this in Phase 3)
      // For now, we'll just log it
      console.log('New organization application submitted');

      // Success message
      setAlertConfig({
        title: 'Application Submitted!',
        message: 'Your organization application has been submitted for review. Our team will review your application and contact you within 2-3 business days.',
        type: 'success',
      });
      setAlertVisible(true);
      
      // Sign out the user (they can't use the app until approved)
      await signOut();
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.replace('/login');
      }, 3000);

    } catch (error: any) {
      console.error('Registration error:', error);
      setAlertConfig({
        title: 'Registration Failed',
        message: error.message || 'An error occurred during registration. Please try again.',
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

  const toggleFocus = (focus: string) => {
    setSelectedFocus(prev => 
      prev.includes(focus) 
        ? prev.filter(f => f !== focus)
        : [...prev, focus]
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
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
            <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Partner Organization</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Register your organization with VIbe</Text>
          <View style={styles.benefitBanner}>
            <Text style={styles.benefitText}>✨ Get a Golden Badge & Full Platform Access</Text>
          </View>
        </View>

        {/* Organization Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Organization Information*</Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Organization Name*</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="Jamaica Red Cross"
              placeholderTextColor={colors.textSecondary}
              value={formData.organizationName}
              onChangeText={(value) => updateField('organizationName', value)}
              editable={!loading}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Registration/Tax ID Number*</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="JRC-123456"
              placeholderTextColor={colors.textSecondary}
              value={formData.registrationNumber}
              onChangeText={(value) => updateField('registrationNumber', value)}
              editable={!loading}
            />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>For verification purposes</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Organization Description*</Text>
            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="Describe your organization's mission and what you do..."
              placeholderTextColor={colors.textSecondary}
              value={formData.organizationDescription}
              onChangeText={(value) => updateField('organizationDescription', value)}
              multiline
              numberOfLines={4}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Website URL (Optional)</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="https://yourorganization.org"
              placeholderTextColor={colors.textSecondary}
              value={formData.websiteUrl}
              onChangeText={(value) => updateField('websiteUrl', value)}
              editable={!loading}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Organization Size*</Text>
            <View style={styles.chipContainer}>
              {sizeOptions.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.chip,
                    { 
                      backgroundColor: formData.organizationSize === size ? '#FFC107' : colors.card,
                      borderColor: formData.organizationSize === size ? '#FFC107' : colors.border,
                    }
                  ]}
                  onPress={() => updateField('organizationSize', size)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.chipText,
                    { color: formData.organizationSize === size ? '#000000' : colors.text }
                  ]}>
                    {size} employees
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Industry Focus Areas* (Select all that apply)</Text>
            <View style={styles.chipContainer}>
              {industryOptions.map((focus) => (
                <TouchableOpacity
                  key={focus}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedFocus.includes(focus) ? '#FFC107' : colors.card,
                      borderColor: selectedFocus.includes(focus) ? '#FFC107' : colors.border,
                    }
                  ]}
                  onPress={() => toggleFocus(focus)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.chipText,
                    { color: selectedFocus.includes(focus) ? '#000000' : colors.text }
                  ]}>
                    {focus}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information*</Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Contact Person Name*</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="John Doe"
              placeholderTextColor={colors.textSecondary}
              value={formData.contactPersonName}
              onChangeText={(value) => updateField('contactPersonName', value)}
              editable={!loading}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Contact Person Role (Optional)</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="Volunteer Coordinator"
              placeholderTextColor={colors.textSecondary}
              value={formData.contactPersonRole}
              onChangeText={(value) => updateField('contactPersonRole', value)}
              editable={!loading}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Organization Email*</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="info@organization.org"
              placeholderTextColor={colors.textSecondary}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              editable={!loading}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Phone Number*</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="+1 876-555-0123"
              placeholderTextColor={colors.textSecondary}
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              editable={!loading}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Location*</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="Kingston, Jamaica"
              placeholderTextColor={colors.textSecondary}
              value={formData.location}
              onChangeText={(value) => updateField('location', value)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <CountryPicker
              label="Country*"
              value={formData.country}
              onChange={(country) => updateField('country', country)}
              disabled={loading}
              colors={{
                background: colors.background,
                card: colors.card,
                border: colors.border,
                text: colors.text,
                textSecondary: colors.textSecondary,
                primary: colors.primary,
              }}
            />
          </View>
        </View>

        {/* Account Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Security*</Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Password*</Text>
            <View style={[styles.passwordContainer, { 
              backgroundColor: colors.card,
              borderColor: colors.border 
            }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textSecondary}
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
            <Text style={[styles.label, { color: colors.text }]}>Confirm Password*</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border 
              }]}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textSecondary}
              value={formData.confirmPassword}
              onChangeText={(value) => updateField('confirmPassword', value)}
              secureTextEntry={!showPassword}
              editable={!loading}
              autoComplete="password-new"
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>📋 What happens next?</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            1. Our team reviews your application (2-3 business days){'\n'}
            2. You'll receive an email with approval and payment link{'\n'}
            3. Complete payment (JMD 10,000/month or 100,000/year){'\n'}
            4. Get your Golden Badge and full platform access!
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Application</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={[styles.loginText, { color: colors.textSecondary }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Individual Registration Link */}
        <View style={styles.loginContainer}>
          <Text style={[styles.loginText, { color: colors.textSecondary }]}>Not an organization? </Text>
          <TouchableOpacity onPress={() => router.replace('/register')} disabled={loading}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>Register as Volunteer</Text>
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
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  benefitBanner: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  benefitText: {
    fontSize: 14,
    color: '#F57F17',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
  },
  eyeText: {
    fontSize: 20,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
