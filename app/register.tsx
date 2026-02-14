/**
 * Unified Register Screen
 * Allows users to choose between Individual or Organization registration
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import CrossPlatformDateTimePicker from '../components/CrossPlatformDateTimePicker';
import CustomAlert from '../components/CustomAlert';
import { supabase } from '../services/supabase';
import Button from '../components/Button';
import CountryPicker from '../components/CountryPicker';

type AccountType = 'individual' | 'organization';
type FormErrors = Record<string, string>;
const VERIFICATION_NOTICE_KEY = 'pending_email_verification_notice';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Basic international phone validation:
// - allows +, spaces, parentheses, dots and dashes
// - requires 7–15 digits total (E.164 max is 15)
const isValidPhone = (phone: string) => {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

export default function RegisterScreen() {
  const router = useRouter();
  const { invite, code } = useLocalSearchParams<{ invite?: string; code?: string }>();
  const { signUp, signOut, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'error' as 'success' | 'error' | 'warning',
  });

  // Account type selection
  const [accountType, setAccountType] = useState<AccountType>('individual');

  // Individual form data
  const [individualFormData, setIndividualFormData] = useState({
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

  // Organization form data
  const [organizationFormData, setOrganizationFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    registrationNumber: '',
    organizationDescription: '',
    websiteUrl: '',
    contactPersonName: '',
    contactPersonRole: '',
    phone: '',
    location: '',
    country: 'Jamaica',
    organizationSize: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [individualErrors, setIndividualErrors] = useState<FormErrors>({});
  const [organizationErrors, setOrganizationErrors] = useState<FormErrors>({});
  const [dobDate, setDobDate] = useState<Date>(() => {
    return individualFormData.dateOfBirth ? new Date(individualFormData.dateOfBirth) : new Date(2000, 0, 1);
  });
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);
  const fieldLayouts = useRef<Record<string, number>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  // Industry focus options (for organizations)
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
      console.warn('[REGISTER] Failed to persist verification notice', error);
    }
  };

  const setFieldLayout = (field: string) => (e: LayoutChangeEvent) => {
    fieldLayouts.current[field] = e.nativeEvent.layout.y;
  };

  const setInputRef = (field: string) => (ref: TextInput | null) => {
    inputRefs.current[field] = ref;
  };

  const focusFirstInvalidField = (errors: FormErrors, type: AccountType) => {
    const fieldOrder =
      type === 'individual'
        ? ['fullName', 'email', 'phone', 'location', 'country', 'dateOfBirth', 'password', 'confirmPassword', 'terms']
        : [
            'organizationName',
            'registrationNumber',
            'organizationDescription',
            'organizationSize',
            'industryFocus',
            'contactPersonName',
            'email',
            'phone',
            'location',
            'country',
            'password',
            'confirmPassword',
            'terms',
          ];

    const firstInvalidField = fieldOrder.find((key) => !!errors[key]);
    if (!firstInvalidField) return;

    const y = fieldLayouts.current[firstInvalidField];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(y - 24, 0), animated: true });
    }

    const input = inputRefs.current[firstInvalidField];
    if (input) {
      setTimeout(() => input.focus(), 120);
    }
  };

  const validateEmailOnBlur = (type: AccountType) => {
    const value = type === 'individual' ? individualFormData.email : organizationFormData.email;
    const normalized = value.trim();

    if (!normalized) return;

    if (!isValidEmail(normalized)) {
      if (type === 'individual') {
        setIndividualErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
      } else {
        setOrganizationErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
      }
    }
  };

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

  const getIndividualValidationErrors = (): FormErrors => {
    const formData = individualFormData;
    const errors: FormErrors = {};

    if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    if (!formData.country.trim()) errors.country = 'Country is required';
    if (!formData.password) errors.password = 'Password is required';
    if (!formData.confirmPassword) errors.confirmPassword = 'Please confirm your password';
    if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
    if (!acceptedTerms) errors.terms = 'You must accept the Terms and Privacy Policy';

    if (formData.password && formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (formData.email && !isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number (7-15 digits)';
    }

    if (formData.dateOfBirth) {
      const age = calculateAge(formData.dateOfBirth);
      if (age < 18) {
        errors.dateOfBirth = 'You must be 18 or older to register for VIbe';
      }
    }

    return errors;
  };

  const getOrganizationValidationErrors = (): FormErrors => {
    const formData = organizationFormData;
    const errors: FormErrors = {};

    if (!formData.organizationName.trim()) errors.organizationName = 'Organization name is required';
    if (!formData.registrationNumber.trim()) errors.registrationNumber = 'Registration/Tax ID is required';
    if (!formData.organizationDescription.trim()) errors.organizationDescription = 'Organization description is required';
    if (!formData.contactPersonName.trim()) errors.contactPersonName = 'Contact person name is required';
    if (!formData.email.trim()) errors.email = 'Organization email is required';
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    if (!formData.country.trim()) errors.country = 'Country is required';
    if (!formData.password) errors.password = 'Password is required';
    if (!formData.confirmPassword) errors.confirmPassword = 'Please confirm your password';
    if (!formData.organizationSize) errors.organizationSize = 'Please select your organization size';
    if (selectedFocus.length === 0) errors.industryFocus = 'Please select at least one industry focus area';
    if (!acceptedTerms) errors.terms = 'You must accept the Terms and Privacy Policy';

    if (formData.email && !isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number (7-15 digits)';
    }

    if (formData.password && formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  };

  // Capture invite code from URL
  useEffect(() => {
    const inviteParam = code || invite;
    if (inviteParam && typeof inviteParam === 'string') {
      setInviteCode(inviteParam);
    }
  }, [invite, code]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/feed' as any);
    }
  }, [user, authLoading, router]);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handleIndividualRegister = async () => {
    const formData = individualFormData;
    const errors = getIndividualValidationErrors();

    if (Object.keys(errors).length > 0) {
      setIndividualErrors(errors);
      focusFirstInvalidField(errors, 'individual');
      showAlert('Fix Required Fields', 'Please correct the highlighted fields.');
      return;
    }

    setIndividualErrors({});
    setLoading(true);

    try {
      const expertiseArray = formData.areasOfExpertise
        ? formData.areasOfExpertise.split(',').map(item => item.trim()).filter(Boolean)
        : [];

      const response = await signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        bio: formData.bio.trim() || undefined,
        areasOfExpertise: expertiseArray.length > 0 ? expertiseArray : undefined,
        education: formData.education.trim() || undefined,
        ...(formData.country && { country: formData.country }),
        ...(formData.dateOfBirth && { dateOfBirth: formData.dateOfBirth }),
        ...(inviteCode && { inviteCode }),
        accountType: 'individual',
      });

      if (!response.success) {
        showAlert('Registration Failed', response.error || 'An error occurred during registration');
        return;
      }

      if ((response as any).requiresEmailConfirmation || !response.data) {
        setVerificationEmail(formData.email);
        setShowVerificationMessage(true);
        await persistVerificationNotice(formData.email);

        router.replace({
          pathname: '/login',
          params: {
            needsVerification: 'true',
            email: formData.email,
          },
        } as any);

        return;
      } else if (response.data) {
        showAlert(
          'Account Created Successfully! 🎉',
          'Welcome to VIbe! Your account is now active and ready to use. You\'ll be redirected to your feed shortly.',
          'success'
        );

        setTimeout(() => {
          router.replace('/feed' as any);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      showAlert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const handleOrganizationRegister = async () => {
    const formData = organizationFormData;
    const errors = getOrganizationValidationErrors();

    if (Object.keys(errors).length > 0) {
      setOrganizationErrors(errors);
      focusFirstInvalidField(errors, 'organization');
      showAlert('Fix Required Fields', 'Please correct the highlighted fields.');
      return;
    }

    setOrganizationErrors({});
    setLoading(true);

    try {
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

      const authResponse = await signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.organizationName.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        ...(formData.country && { country: formData.country }),
        ...(inviteCode && { inviteCode }),
        accountType: 'organization',
        approvalStatus: 'pending',
        isPartnerOrganization: false,
        organizationData,
      });

      if (!authResponse.success) {
        showAlert('Registration Failed', authResponse.error || 'An error occurred during registration. Please try again.');
        return;
      }

      if ((authResponse as any).requiresEmailConfirmation || !authResponse.data) {
        setVerificationEmail(formData.email);
        setShowVerificationMessage(true);
        await persistVerificationNotice(formData.email);
        router.replace({
          pathname: '/login',
          params: {
            needsVerification: 'true',
            email: formData.email,
          },
        } as any);
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          phone: formData.phone.trim(),
          location: formData.location.trim(),
          country: formData.country,
          account_type: 'organization',
          organization_data: organizationData,
          approval_status: 'pending',
          is_partner_organization: false,
        })
        .eq('id', authResponse.data.id);

      if (updateError) throw updateError;

      showAlert(
        'Application Submitted Successfully! 🎉',
        'Your organization account has been created and submitted for review. Our team will review your application and contact you within 2-3 business days. You\'ll receive an email notification once your account is approved.',
        'success'
      );

      await signOut();

      setTimeout(() => {
        router.replace('/login');
      }, 4000);

    } catch (error: any) {
      console.error('Registration error:', error);
      showAlert('Registration Failed', error.message || 'An error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const handleRegister = () => {
    if (accountType === 'individual') {
      handleIndividualRegister();
    } else {
      handleOrganizationRegister();
    }
  };

  const updateIndividualField = (field: string, value: string) => {
    setIndividualFormData(prev => ({ ...prev, [field]: value }));
    setIndividualErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateOrganizationField = (field: string, value: string) => {
    setOrganizationFormData(prev => ({ ...prev, [field]: value }));
    setOrganizationErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const toggleFocus = (focus: string) => {
    setSelectedFocus(prev => 
      prev.includes(focus) 
        ? prev.filter(f => f !== focus)
        : [...prev, focus]
    );
    setOrganizationErrors(prev => {
      if (!prev.industryFocus) return prev;
      const next = { ...prev };
      delete next.industryFocus;
      return next;
    });
  };

  const insets = useSafeAreaInsets();
  const currentErrors = accountType === 'individual' ? individualErrors : organizationErrors;
  const currentErrorCount = Object.keys(currentErrors).length;

  if (!authLoading && user) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: styles.scrollContent.paddingBottom + insets.bottom + 80 }
        ]}
      >
        {showVerificationMessage && (
          <View
            style={{
              backgroundColor: '#4CAF50',
              padding: 20,
              borderRadius: 12,
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 32, marginRight: 12 }}>✅</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: 'white',
                  flex: 1,
                }}
              >
                Account Created!
              </Text>
            </View>

            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: 16,
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: 8,
                }}
              >
                📧 Check Your Email
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: 'white',
                  lineHeight: 20,
                }}
              >
                We sent a verification link to:
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: 'white',
                  marginTop: 4,
                }}
              >
                {verificationEmail}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 13,
                color: 'white',
                textAlign: 'center',
                opacity: 0.9,
              }}
            >
              Please check your inbox (and spam folder) to verify your account.
            </Text>

            <TouchableOpacity
              onPress={async () => {
                await persistVerificationNotice(verificationEmail);
                router.replace({
                  pathname: '/login',
                  params: {
                    needsVerification: 'true',
                    email: verificationEmail,
                  },
                } as any);
              }}
              style={{
                backgroundColor: 'white',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                marginTop: 16,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: '#4CAF50',
                  fontWeight: '600',
                  fontSize: 15,
                }}
              >
                Go to Login →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Join VIbe</Text>
          <Text style={styles.subtitle}>Create your account</Text>
          
          {inviteCode && (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteText}>🎉 You were invited by a friend!</Text>
            </View>
          )}
        </View>

        {/* Account Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I am registering as:</Text>
          <View style={styles.accountTypeContainer}>
            <TouchableOpacity
              style={[
                styles.accountTypeButton,
                {
                  backgroundColor: accountType === 'individual' ? Colors.light.primary : Colors.light.card,
                  borderColor: accountType === 'individual' ? Colors.light.primary : Colors.light.border,
                },
              ]}
              onPress={() => {
                setAccountType('individual');
                setOrganizationErrors({});
              }}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: accountType === 'individual', disabled: loading }}
              accessibilityLabel="Register as individual volunteer"
            >
              <Text
                style={[
                  styles.accountTypeText,
                  { color: accountType === 'individual' ? '#FFFFFF' : Colors.light.text },
                ]}
              >
                Individual Volunteer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.accountTypeButton,
                {
                  backgroundColor: accountType === 'organization' ? '#FFC107' : Colors.light.card,
                  borderColor: accountType === 'organization' ? '#FFC107' : Colors.light.border,
                },
              ]}
              onPress={() => {
                setAccountType('organization');
                setIndividualErrors({});
              }}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: accountType === 'organization', disabled: loading }}
              accessibilityLabel="Register as partner organization"
            >
              <Text
                style={[
                  styles.accountTypeText,
                  { color: accountType === 'organization' ? '#000000' : Colors.light.text },
                ]}
              >
                Partner Organization
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Conditional Forms - Part 1 of 2 */}
        {accountType === 'individual' ? (
          // INDIVIDUAL FORM
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information*</Text>

              <View style={styles.inputContainer} onLayout={setFieldLayout('fullName')}>
                <Text style={styles.label}>Full Name*</Text>
                <TextInput
                  ref={setInputRef('fullName')}
                  style={[styles.input, individualErrors.fullName && styles.inputError]}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.fullName}
                  onChangeText={(value) => updateIndividualField('fullName', value)}
                  editable={!loading}
                  autoCapitalize="words"
                />
                {individualErrors.fullName ? <Text style={styles.errorText}>{individualErrors.fullName}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('email')}>
                <Text style={styles.label}>Email*</Text>
                <TextInput
                  ref={setInputRef('email')}
                  style={[styles.input, individualErrors.email && styles.inputError]}
                  placeholder="your.email@example.com"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.email}
                  onChangeText={(value) => updateIndividualField('email', value)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="email"
                  onBlur={() => validateEmailOnBlur('individual')}
                />
                {individualErrors.email ? <Text style={styles.errorText}>{individualErrors.email}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('phone')}>
                <Text style={styles.label}>Phone Number*</Text>
                <TextInput
                  ref={setInputRef('phone')}
                  style={[styles.input, individualErrors.phone && styles.inputError]}
                  placeholder="+1 (876) 123-4567"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.phone}
                  onChangeText={(value) => updateIndividualField('phone', value)}
                  keyboardType="phone-pad"
                  editable={!loading}
                  autoComplete="tel"
                />
                {individualErrors.phone ? <Text style={styles.errorText}>{individualErrors.phone}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('location')}>
                <Text style={styles.label}>Location*</Text>
                <TextInput
                  ref={setInputRef('location')}
                  style={[styles.input, individualErrors.location && styles.inputError]}
                  placeholder="Kingston, Jamaica"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.location}
                  onChangeText={(value) => updateIndividualField('location', value)}
                  editable={!loading}
                />
                {individualErrors.location ? <Text style={styles.errorText}>{individualErrors.location}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('country')}>
                <CountryPicker
                  label="Country*"
                  value={individualFormData.country}
                  onChange={(country) => updateIndividualField('country', country)}
                  disabled={loading}
                  colors={{
                    background: Colors.light.background,
                    card: Colors.light.card,
                    border: Colors.light.border,
                    text: Colors.light.text,
                    textSecondary: Colors.light.textSecondary,
                    primary: Colors.light.primary,
                  }}
                />
                {individualErrors.country ? <Text style={styles.errorText}>{individualErrors.country}</Text> : null}
              </View>

              <View onLayout={setFieldLayout('dateOfBirth')}>
                <CrossPlatformDateTimePicker
                  mode="date"
                  value={dobDate}
                  onChange={(date) => {
                    if (date) {
                      setDobDate(date);
                      const iso = date.toISOString().split('T')[0];
                      updateIndividualField('dateOfBirth', iso);
                    }
                  }}
                  maximumDate={new Date()}
                  label="Date of Birth *"
                  placeholder="Select your date of birth"
                  colors={{
                    card: '#FFFFFF',
                    border: Colors.light.border,
                    text: Colors.light.text,
                    textSecondary: Colors.light.textSecondary,
                  }}
                  disabled={loading}
                />
                <Text style={styles.helperText}>You must be 18 or older to register</Text>
                {individualErrors.dateOfBirth ? <Text style={styles.errorText}>{individualErrors.dateOfBirth}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('password')}>
                <Text style={styles.label}>Password*</Text>
                <View style={[styles.passwordContainer, individualErrors.password && styles.inputError]}>
                  <TextInput
                    ref={setInputRef('password')}
                    style={styles.passwordInput}
                    placeholder="At least 8 characters"
                    placeholderTextColor={Colors.light.textSecondary}
                    value={individualFormData.password}
                    onChangeText={(value) => updateIndividualField('password', value)}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    autoComplete="password-new"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
                {individualErrors.password ? <Text style={styles.errorText}>{individualErrors.password}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('confirmPassword')}>
                <Text style={styles.label}>Confirm Password*</Text>
                <TextInput
                  ref={setInputRef('confirmPassword')}
                  style={[styles.input, individualErrors.confirmPassword && styles.inputError]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.confirmPassword}
                  onChangeText={(value) => updateIndividualField('confirmPassword', value)}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  autoComplete="password-new"
                />
                {individualErrors.confirmPassword ? <Text style={styles.errorText}>{individualErrors.confirmPassword}</Text> : null}
              </View>
            </View>

            {/* Optional Fields Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Information (Optional)</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.bio}
                  onChangeText={(value) => updateIndividualField('bio', value)}
                  multiline
                  numberOfLines={4}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Areas of Expertise</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Teaching, Healthcare (comma separated)"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.areasOfExpertise}
                  onChangeText={(value) => updateIndividualField('areasOfExpertise', value)}
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
                  value={individualFormData.education}
                  onChangeText={(value) => updateIndividualField('education', value)}
                  editable={!loading}
                />
              </View>
            </View>
          </>
        ) : (
          // ORGANIZATION FORM - Continued in next part due to length

          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organization Information*</Text>

              <View style={styles.inputContainer} onLayout={setFieldLayout('organizationName')}>
                <Text style={styles.label}>Organization Name*</Text>
                <TextInput
                  ref={setInputRef('organizationName')}
                  style={[styles.input, organizationErrors.organizationName && styles.inputError]}
                  placeholder="Volunteers Incorporated"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.organizationName}
                  onChangeText={(value) => updateOrganizationField('organizationName', value)}
                  editable={!loading}
                />
                {organizationErrors.organizationName ? <Text style={styles.errorText}>{organizationErrors.organizationName}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('registrationNumber')}>
                <Text style={styles.label}>Registration/Tax ID Number*</Text>
                <TextInput
                  ref={setInputRef('registrationNumber')}
                  style={[styles.input, organizationErrors.registrationNumber && styles.inputError]}
                  placeholder="Enter your official registration number"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.registrationNumber}
                  onChangeText={(value) => updateOrganizationField('registrationNumber', value)}
                  editable={!loading}
                />
                <Text style={styles.helperText}>Required for verification purposes</Text>
                {organizationErrors.registrationNumber ? <Text style={styles.errorText}>{organizationErrors.registrationNumber}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('organizationDescription')}>
                <Text style={styles.label}>Organization Description*</Text>
                <TextInput
                  ref={setInputRef('organizationDescription')}
                  style={[styles.input, styles.textArea, organizationErrors.organizationDescription && styles.inputError]}
                  placeholder="Describe your organization's mission and activities..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.organizationDescription}
                  onChangeText={(value) => updateOrganizationField('organizationDescription', value)}
                  multiline
                  numberOfLines={4}
                  editable={!loading}
                />
                {organizationErrors.organizationDescription ? <Text style={styles.errorText}>{organizationErrors.organizationDescription}</Text> : null}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Website URL (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://www.yourorganization.org"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.websiteUrl}
                  onChangeText={(value) => updateOrganizationField('websiteUrl', value)}
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('organizationSize')}>
                <Text style={styles.label}>Organization Size*</Text>
                <View style={[styles.chipsContainer, organizationErrors.organizationSize && styles.chipsError]}>
                  {sizeOptions.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.chip,
                        organizationFormData.organizationSize === size && styles.chipSelected,
                      ]}
                      onPress={() => updateOrganizationField('organizationSize', size)}
                      disabled={loading}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: organizationFormData.organizationSize === size, disabled: loading }}
                      accessibilityLabel={`Organization size ${size} employees`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          organizationFormData.organizationSize === size && styles.chipTextSelected,
                        ]}
                      >
                        {size} employees
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {organizationErrors.organizationSize ? <Text style={styles.errorText}>{organizationErrors.organizationSize}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('industryFocus')}>
                <Text style={styles.label}>Industry Focus*</Text>
                <Text style={styles.helperText}>Select all that apply</Text>
                <View style={[styles.chipsContainer, organizationErrors.industryFocus && styles.chipsError]}>
                  {industryOptions.map((focus) => (
                    <TouchableOpacity
                      key={focus}
                      style={[
                        styles.chip,
                        selectedFocus.includes(focus) && styles.chipSelected,
                      ]}
                      onPress={() => toggleFocus(focus)}
                      disabled={loading}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selectedFocus.includes(focus), disabled: loading }}
                      accessibilityLabel={`Industry focus ${focus}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedFocus.includes(focus) && styles.chipTextSelected,
                        ]}
                      >
                        {focus}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {organizationErrors.industryFocus ? <Text style={styles.errorText}>{organizationErrors.industryFocus}</Text> : null}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Information*</Text>

              <View style={styles.inputContainer} onLayout={setFieldLayout('contactPersonName')}>
                <Text style={styles.label}>Contact Person Name*</Text>
                <TextInput
                  ref={setInputRef('contactPersonName')}
                  style={[styles.input, organizationErrors.contactPersonName && styles.inputError]}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.contactPersonName}
                  onChangeText={(value) => updateOrganizationField('contactPersonName', value)}
                  editable={!loading}
                />
                {organizationErrors.contactPersonName ? <Text style={styles.errorText}>{organizationErrors.contactPersonName}</Text> : null}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Contact Person Role (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Executive Director"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.contactPersonRole}
                  onChangeText={(value) => updateOrganizationField('contactPersonRole', value)}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('email')}>
                <Text style={styles.label}>Organization Email*</Text>
                <TextInput
                  ref={setInputRef('email')}
                  style={[styles.input, organizationErrors.email && styles.inputError]}
                  placeholder="contact@organization.org"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.email}
                  onChangeText={(value) => updateOrganizationField('email', value)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  onBlur={() => validateEmailOnBlur('organization')}
                />
                {organizationErrors.email ? <Text style={styles.errorText}>{organizationErrors.email}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('phone')}>
                <Text style={styles.label}>Phone Number*</Text>
                <TextInput
                  ref={setInputRef('phone')}
                  style={[styles.input, organizationErrors.phone && styles.inputError]}
                  placeholder="+1 (876) 123-4567"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.phone}
                  onChangeText={(value) => updateOrganizationField('phone', value)}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
                {organizationErrors.phone ? <Text style={styles.errorText}>{organizationErrors.phone}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('location')}>
                <Text style={styles.label}>Location*</Text>
                <TextInput
                  ref={setInputRef('location')}
                  style={[styles.input, organizationErrors.location && styles.inputError]}
                  placeholder="Kingston, Jamaica"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.location}
                  onChangeText={(value) => updateOrganizationField('location', value)}
                  editable={!loading}
                />
                {organizationErrors.location ? <Text style={styles.errorText}>{organizationErrors.location}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('country')}>
                <CountryPicker
                  label="Country*"
                  value={organizationFormData.country}
                  onChange={(country) => updateOrganizationField('country', country)}
                  disabled={loading}
                  colors={{
                    background: Colors.light.background,
                    card: Colors.light.card,
                    border: Colors.light.border,
                    text: Colors.light.text,
                    textSecondary: Colors.light.textSecondary,
                    primary: Colors.light.primary,
                  }}
                />
                {organizationErrors.country ? <Text style={styles.errorText}>{organizationErrors.country}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('password')}>
                <Text style={styles.label}>Password*</Text>
                <View style={[styles.passwordContainer, organizationErrors.password && styles.inputError]}>
                  <TextInput
                    ref={setInputRef('password')}
                    style={styles.passwordInput}
                    placeholder="At least 8 characters"
                    placeholderTextColor={Colors.light.textSecondary}
                    value={organizationFormData.password}
                    onChangeText={(value) => updateOrganizationField('password', value)}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
                {organizationErrors.password ? <Text style={styles.errorText}>{organizationErrors.password}</Text> : null}
              </View>

              <View style={styles.inputContainer} onLayout={setFieldLayout('confirmPassword')}>
                <Text style={styles.label}>Confirm Password*</Text>
                <TextInput
                  ref={setInputRef('confirmPassword')}
                  style={[styles.input, organizationErrors.confirmPassword && styles.inputError]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.confirmPassword}
                  onChangeText={(value) => updateOrganizationField('confirmPassword', value)}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                {organizationErrors.confirmPassword ? <Text style={styles.errorText}>{organizationErrors.confirmPassword}</Text> : null}
              </View>
            </View>
          </>
        )}

        <View style={styles.termsContainer} onLayout={setFieldLayout('terms')}>
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => {
              setAcceptedTerms(prev => !prev);
              setIndividualErrors(prev => {
                if (!prev.terms) return prev;
                const next = { ...prev };
                delete next.terms;
                return next;
              });
              setOrganizationErrors(prev => {
                if (!prev.terms) return prev;
                const next = { ...prev };
                delete next.terms;
                return next;
              });
            }}
            disabled={loading}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms, disabled: loading }}
            accessibilityLabel="Agree to Terms of Service and Privacy Policy"
          >
            <View
              style={[
                styles.checkbox,
                acceptedTerms && styles.checkboxChecked,
                (individualErrors.terms || organizationErrors.terms) && styles.checkboxError,
              ]}
            >
              {acceptedTerms ? <Text style={styles.checkboxCheck}>X</Text> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://volunteersinc.org/terms-and-conditions')}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://volunteersinc.org/vibe-privacy-policy')}>
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
          {(individualErrors.terms || organizationErrors.terms) ? (
            <Text style={styles.errorText}>{individualErrors.terms || organizationErrors.terms}</Text>
          ) : null}
        </View>

        {currentErrorCount > 0 ? (
          <View style={styles.errorSummaryBanner}>
            <Text style={styles.errorSummaryTitle}>Please fix {currentErrorCount} field{currentErrorCount > 1 ? 's' : ''}</Text>
            <Text style={styles.errorSummaryText}>Highlighted fields need attention before you can continue.</Text>
          </View>
        ) : null}

        {/* Register Button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleRegister}
          disabled={loading}
          loading={loading}
          gradientColors={
            accountType === 'organization'
              ? ['#FFC107', '#FFB300']
              : undefined
          }
          textColorOverride={accountType === 'organization' ? '#000000' : undefined}
          style={styles.registerButton}
        >
          {accountType === 'organization' ? 'Submit Application' : 'Create Account'}
        </Button>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
    maxWidth: 480,
    width: '100%' as any,
    alignSelf: 'center' as any,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  accountTypeContainer: {
    gap: 12,
  },
  accountTypeButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '600',
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
  inputError: {
    borderColor: '#D32F2F',
  },
  errorText: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 4,
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chipsError: {
    borderWidth: 1,
    borderColor: '#D32F2F',
    borderRadius: 10,
    padding: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  chipSelected: {
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
  },
  chipText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#000000',
    fontWeight: '600',
  },
  termsContainer: {
    marginBottom: 16,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginTop: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.card,
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  checkboxError: {
    borderColor: '#D32F2F',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  errorSummaryBanner: {
    backgroundColor: '#FDECEC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D32F2F',
    padding: 12,
    marginBottom: 12,
  },
  errorSummaryTitle: {
    color: '#B71C1C',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  errorSummaryText: {
    color: '#B71C1C',
    fontSize: 12,
  },
  registerButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
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
});



