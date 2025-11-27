/**
 * Donate Screen
 * File: app/causes/[id]/donate.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  CreditCard,
  RefreshCw,
  User,
  Mail,
  MessageCircle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Cause, RecurringFrequency } from '../../../types';
import {
  getCauseById,
  createDonation,
  formatCurrency,
} from '../../../services/causesService';
import { useAuth } from '../../../contexts/AuthContext';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Preset donation amounts (JMD)
const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000, 25000];

// Recurring frequency options
const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; description: string }[] = [
  { value: 'weekly', label: 'Weekly', description: 'Every week' },
  { value: 'monthly', label: 'Monthly', description: 'Every month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months' },
  { value: 'annually', label: 'Annually', description: 'Every year' },
];

export default function DonateScreen() {
  const { id, recurring: recurringParam } = useLocalSearchParams<{ id: string; recurring?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // State
  const [cause, setCause] = useState<Cause | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedAmount, setSelectedAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isRecurring, setIsRecurring] = useState(recurringParam === 'true');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [donorName, setDonorName] = useState(user?.fullName || '');
  const [donorEmail, setDonorEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');

  // Calculate final amount
  const finalAmount = isCustom 
    ? parseFloat(customAmount) || 0 
    : selectedAmount || 0;

  // Fetch cause data
  useEffect(() => {
    async function fetchCause() {
      if (!id) return;

      try {
        const response = await getCauseById(id);
        if (response.success && response.data) {
          setCause(response.data);
          if (user) {
            setDonorName(user.fullName || '');
            setDonorEmail(user.email || '');
          }
        } else {
          Alert.alert('Error', 'Failed to load cause');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching cause:', error);
        router.back();
      } finally {
        setLoading(false);
      }
    }

    fetchCause();
  }, [id, user, router]);

  // Handle preset amount selection
  const handlePresetSelect = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
  }, []);

  // Handle custom amount
  const handleCustomAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    setIsCustom(true);
    setSelectedAmount(null);
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    if (finalAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a donation amount');
      return false;
    }

    if (cause?.minimumDonation && finalAmount < cause.minimumDonation) {
      Alert.alert(
        'Minimum Donation',
        `The minimum donation for this cause is ${formatCurrency(cause.minimumDonation)}`
      );
      return false;
    }

    if (!isAnonymous) {
      if (!donorName.trim()) {
        Alert.alert('Name Required', 'Please enter your name or donate anonymously');
        return false;
      }
      if (!donorEmail.trim()) {
        Alert.alert('Email Required', 'Please enter your email for the receipt');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(donorEmail.trim())) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return false;
      }
    }

    if (isRecurring && !user) {
      Alert.alert(
        'Sign In Required',
        'You need to be signed in to set up recurring donations',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/login') },
        ]
      );
      return false;
    }

    return true;
  }, [finalAmount, cause, isAnonymous, donorName, donorEmail, isRecurring, user, router]);

  // Handle donation submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm() || !cause || !id) return;

    setSubmitting(true);

    try {
      if (isRecurring && user) {
        console.log('Creating recurring donation:', {
          causeId: id,
          userId: user.id,
          amount: finalAmount,
          frequency,
          isAnonymous,
        });

        // TODO: Integrate eZeePayments subscription API
        Alert.alert(
          'Coming Soon',
          'Recurring donations will be available soon. Please make a one-time donation for now.',
          [{ text: 'OK' }]
        );
        setSubmitting(false);
        return;
      }

      // Create one-time donation record
      const donationResponse = await createDonation({
        causeId: id,
        amount: finalAmount,
        userId: user?.id,
        donorName: isAnonymous ? undefined : donorName.trim(),
        donorEmail: isAnonymous ? undefined : donorEmail.trim(),
        isAnonymous,
        message: message.trim() || undefined,
      });

      if (!donationResponse.success || !donationResponse.data) {
        throw new Error('Failed to create donation');
      }

      const donation = donationResponse.data;

      // TODO: Integrate eZeePayments
      console.log('Donation created:', donation);

      Alert.alert(
        'Thank You! 💝',
        `Your donation of ${formatCurrency(finalAmount)} to "${cause.title}" is being processed.\n\nPayment integration coming soon!`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Donation error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validateForm, cause, id, isRecurring, user, finalAmount, frequency, isAnonymous, donorName, donorEmail, message, router]);

  // Loading state
  if (loading || !cause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Donate</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
        </View>
      </View>
    );
  }

  const selectedFrequency = FREQUENCY_OPTIONS.find(f => f.value === frequency);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Donate</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cause Info */}
          <View style={[styles.causeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Heart size={24} color="#38B6FF" />
            <View style={styles.causeInfo}>
              <Text style={[styles.causeName, { color: colors.text }]} numberOfLines={2}>
                {cause.title}
              </Text>
              <Text style={[styles.causeProgress, { color: colors.textSecondary }]}>
                {formatCurrency(cause.amountRaised)} raised of {formatCurrency(cause.goalAmount)}
              </Text>
            </View>
          </View>

          {/* Donation Type Toggle */}
          {cause.allowRecurring && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Donation Type</Text>
              <View style={[styles.typeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.typeOption, !isRecurring && { backgroundColor: '#38B6FF' }]}
                  onPress={() => setIsRecurring(false)}
                >
                  <Heart size={18} color={!isRecurring ? '#FFFFFF' : colors.textSecondary} />
                  <Text style={[styles.typeOptionText, { color: !isRecurring ? '#FFFFFF' : colors.textSecondary }]}>
                    One-time
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeOption, isRecurring && { backgroundColor: '#38B6FF' }]}
                  onPress={() => setIsRecurring(true)}
                >
                  <RefreshCw size={18} color={isRecurring ? '#FFFFFF' : colors.textSecondary} />
                  <Text style={[styles.typeOptionText, { color: isRecurring ? '#FFFFFF' : colors.textSecondary }]}>
                    Recurring
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Frequency Selector */}
          {isRecurring && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Frequency</Text>
              <TouchableOpacity
                style={[styles.frequencySelector, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowFrequencyPicker(!showFrequencyPicker)}
              >
                <View style={styles.frequencyInfo}>
                  <Text style={[styles.frequencyText, { color: colors.text }]}>{selectedFrequency?.label}</Text>
                  <Text style={[styles.frequencyDescription, { color: colors.textSecondary }]}>
                    {selectedFrequency?.description}
                  </Text>
                </View>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {showFrequencyPicker && (
                <View style={[styles.frequencyOptions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.frequencyOption, frequency === option.value && { backgroundColor: colors.background }]}
                      onPress={() => {
                        setFrequency(option.value);
                        setShowFrequencyPicker(false);
                      }}
                    >
                      <View>
                        <Text style={[styles.frequencyOptionLabel, { color: colors.text }]}>{option.label}</Text>
                        <Text style={[styles.frequencyOptionDesc, { color: colors.textSecondary }]}>{option.description}</Text>
                      </View>
                      {frequency === option.value && <Check size={20} color="#38B6FF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Amount Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Amount (JMD)</Text>
            <View style={styles.amountGrid}>
              {PRESET_AMOUNTS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedAmount === amount && !isCustom && { borderColor: '#38B6FF', borderWidth: 2 },
                  ]}
                  onPress={() => handlePresetSelect(amount)}
                >
                  <Text
                    style={[
                      styles.amountButtonText,
                      { color: colors.text },
                      selectedAmount === amount && !isCustom && { color: '#38B6FF', fontWeight: '700' },
                    ]}
                  >
                    ${amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Amount */}
            <View style={[styles.customAmountContainer, { backgroundColor: colors.card, borderColor: isCustom ? '#38B6FF' : colors.border }]}>
              <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>J$</Text>
              <TextInput
                style={[styles.customAmountInput, { color: colors.text }]}
                placeholder="Enter custom amount"
                placeholderTextColor={colors.textSecondary}
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                keyboardType="numeric"
                onFocus={() => setIsCustom(true)}
              />
            </View>

            {cause.minimumDonation > 0 && (
              <Text style={[styles.minimumNote, { color: colors.textSecondary }]}>
                Minimum donation: {formatCurrency(cause.minimumDonation)}
              </Text>
            )}
          </View>

          {/* Anonymous Toggle */}
          <View style={styles.section}>
            <View style={[styles.anonymousRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.anonymousInfo}>
                {isAnonymous ? <EyeOff size={20} color="#38B6FF" /> : <Eye size={20} color={colors.textSecondary} />}
                <View style={styles.anonymousTextContainer}>
                  <Text style={[styles.anonymousLabel, { color: colors.text }]}>Donate Anonymously</Text>
                  <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
                    Your name won't be shown publicly
                  </Text>
                </View>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: colors.border, true: '#38B6FF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Donor Info */}
          {!isAnonymous && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Information</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <User size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textSecondary}
                  value={donorName}
                  onChangeText={setDonorName}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Mail size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Email (for receipt)"
                  placeholderTextColor={colors.textSecondary}
                  value={donorEmail}
                  onChangeText={setDonorEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          {/* Optional Message */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Message (Optional)</Text>
            <View style={[styles.messageContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.messageInput, { color: colors.text }]}
                placeholder="Add a message of support..."
                placeholderTextColor={colors.textSecondary}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={200}
                numberOfLines={3}
              />
            </View>
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>{message.length}/200</Text>
          </View>

          {/* Summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Donation Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Amount</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(finalAmount)}</Text>
            </View>
            {isRecurring && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Frequency</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedFrequency?.label}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Donation type</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{isAnonymous ? 'Anonymous' : 'Public'}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>
                {isRecurring ? 'Amount per payment' : 'Total'}
              </Text>
              <Text style={[styles.totalValue, { color: '#38B6FF' }]}>{formatCurrency(finalAmount)}</Text>
            </View>
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Shield size={16} color={colors.textSecondary} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              Your payment is secured by eZeePayments
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: '#38B6FF' }, (submitting || finalAmount <= 0) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || finalAmount <= 0}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <CreditCard size={22} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {isRecurring ? `Donate ${formatCurrency(finalAmount)}/month` : `Donate ${formatCurrency(finalAmount)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  causeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  causeInfo: {
    flex: 1,
  },
  causeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  causeProgress: {
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  typeOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  frequencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  frequencyInfo: {
    flex: 1,
  },
  frequencyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  frequencyDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  frequencyOptions: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  frequencyOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  frequencyOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  amountButton: {
    width: (screenWidth - 56) / 3,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  amountButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  minimumNote: {
    fontSize: 13,
    marginTop: 8,
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  anonymousInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  anonymousTextContainer: {
    flex: 1,
  },
  anonymousLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  anonymousDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  messageContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  messageInput: {
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  securityText: {
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
