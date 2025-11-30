/**
 * Unified Register Screen
 * Allows users to choose between Individual or Organization registration
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
import { supabase } from '../services/supabase';

type AccountType = 'individual' | 'organization';

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
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [dobDate, setDobDate] = useState<Date>(() => {
    return individualFormData.dateOfBirth ? new Date(individualFormData.dateOfBirth) : new Date(2000, 0, 1);
  });
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);

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

  const handleIndividualRegister = async () => {
    const formData = individualFormData;

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!formData.dateOfBirth) {
      Alert.alert('Error', 'Please enter your date of birth');
      return;
    }

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

      if ((response as any).requiresEmailConfirmation || !response.data) {
        setAlertConfig({
          title: 'Check Your Email',
          message: 'We sent you a confirmation email. Please verify your email address to complete registration.',
          type: 'warning',
        });
        setAlertVisible(true);
        
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      } else if (response.data) {
        setAlertConfig({
          title: 'Success!',
          message: 'Your account has been created successfully. Welcome to VIbe!',
          type: 'success',
        });
        setAlertVisible(true);
        
        setTimeout(() => {
          router.replace('/feed' as any);
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

  const handleOrganizationRegister = async () => {
    const formData = organizationFormData;

    // Validation
    if (!formData.email || !formData.password || !formData.organizationName || 
        !formData.registrationNumber || !formData.organizationDescription ||
        !formData.contactPersonName || !formData.phone || !formData.location) {
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.organizationName.trim(),
            account_type: 'organization',
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

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
        .eq('id', authData.user.id);

      if (updateError) throw updateError;

      setAlertConfig({
        title: 'Application Submitted!',
        message: 'Your organization application has been submitted for review. Our team will review your application and contact you within 2-3 business days.',
        type: 'success',
      });
      setAlertVisible(true);
      
      await supabase.auth.signOut();
      
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

  const handleRegister = () => {
    if (accountType === 'individual') {
      handleIndividualRegister();
    } else {
      handleOrganizationRegister();
    }
  };

  const updateIndividualField = (field: string, value: string) => {
    setIndividualFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateOrganizationField = (field: string, value: string) => {
    setOrganizationFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleFocus = (focus: string) => {
    setSelectedFocus(prev => 
      prev.includes(focus) 
        ? prev.filter(f => f !== focus)
        : [...prev, focus]
    );
  };

  const insets = useSafeAreaInsets();

  if (!authLoading && user) {
    return null;
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
              onPress={() => setAccountType('individual')}
              disabled={loading}
              activeOpacity={0.7}
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
              onPress={() => setAccountType('organization')}
              disabled={loading}
              activeOpacity={0.7}
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.fullName}
                  onChangeText={(value) => updateIndividualField('fullName', value)}
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
                  value={individualFormData.email}
                  onChangeText={(value) => updateIndividualField('email', value)}
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
                  value={individualFormData.phone}
                  onChangeText={(value) => updateIndividualField('phone', value)}
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
                  value={individualFormData.location}
                  onChangeText={(value) => updateIndividualField('location', value)}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Country*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jamaica"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={individualFormData.country}
                  onChangeText={(value) => updateIndividualField('country', value)}
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
                  <Text style={{ color: individualFormData.dateOfBirth ? Colors.light.text : Colors.light.textSecondary }}>
                    {individualFormData.dateOfBirth
                      ? new Date(individualFormData.dateOfBirth).toLocaleDateString('en-US', {
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
                        const iso = selectedDate.toISOString().split('T')[0];
                        updateIndividualField('dateOfBirth', iso);
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
                    value={individualFormData.password}
                    onChangeText={(value) => updateIndividualField('password', value)}
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
                  value={individualFormData.confirmPassword}
                  onChangeText={(value) => updateIndividualField('confirmPassword', value)}
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Organization Name*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Volunteers Incorporated"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.organizationName}
                  onChangeText={(value) => updateOrganizationField('organizationName', value)}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Registration/Tax ID Number*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your official registration number"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.registrationNumber}
                  onChangeText={(value) => updateOrganizationField('registrationNumber', value)}
                  editable={!loading}
                />
                <Text style={styles.helperText}>Required for verification purposes</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Organization Description*</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your organization's mission and activities..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.organizationDescription}
                  onChangeText={(value) => updateOrganizationField('organizationDescription', value)}
                  multiline
                  numberOfLines={4}
                  editable={!loading}
                />
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Organization Size*</Text>
                <View style={styles.chipsContainer}>
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
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Industry Focus*</Text>
                <Text style={styles.helperText}>Select all that apply</Text>
                <View style={styles.chipsContainer}>
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
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Information*</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Contact Person Name*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.contactPersonName}
                  onChangeText={(value) => updateOrganizationField('contactPersonName', value)}
                  editable={!loading}
                />
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Organization Email*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="contact@organization.org"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.email}
                  onChangeText={(value) => updateOrganizationField('email', value)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 (876) 123-4567"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.phone}
                  onChangeText={(value) => updateOrganizationField('phone', value)}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Location*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Kingston, Jamaica"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.location}
                  onChangeText={(value) => updateOrganizationField('location', value)}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Country*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jamaica"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.country}
                  onChangeText={(value) => updateOrganizationField('country', value)}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password*</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="At least 6 characters"
                    placeholderTextColor={Colors.light.textSecondary}
                    value={organizationFormData.password}
                    onChangeText={(value) => updateOrganizationField('password', value)}
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password*</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={organizationFormData.confirmPassword}
                  onChangeText={(value) => updateOrganizationField('confirmPassword', value)}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
              </View>
            </View>
          </>
        )}

        {/* Register Button */}
        <TouchableOpacity
          style={[
            styles.registerButton,
            {
              backgroundColor: accountType === 'organization' ? '#FFC107' : Colors.light.primary,
            },
            loading && styles.registerButtonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color={accountType === 'organization' ? '#000000' : '#FFFFFF'} />
          ) : (
            <Text
              style={[
                styles.registerButtonText,
                { color: accountType === 'organization' ? '#000000' : '#FFFFFF' },
              ]}
            >
              {accountType === 'organization' ? 'Submit Application' : 'Create Account'}
            </Text>
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
  registerButton: {
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