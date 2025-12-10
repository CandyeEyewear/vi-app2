/**
 * Donate Screen
 * File: app/causes/[id]/donate.tsx
 * 
 * Modern UI with:
 * - Responsive design (mobile app, mobile web, desktop)
 * - Shimmer skeleton loading
 * - Animated amount selection
 * - Sliding toggle indicator
 * - Enhanced input fields with focus states
 * - Gradient submit button with animations
 * - Elevated cards with proper shadows
 * - Full theme integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  Pressable,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  ChevronUp,
  Eye,
  EyeOff,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Cause, RecurringFrequency } from '../../../types';
import {
  getCauseById,
  createDonation,
  formatCurrency,
} from '../../../services/causesService';
import { useAuth } from '../../../contexts/AuthContext';
import WebContainer from '../../../components/WebContainer';
import {
  processPayment,
  processSubscription,
  type Frequency as PaymentFrequency,
} from '../../../services/paymentService';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================
const getResponsiveValues = () => {
  const width = Dimensions.get('window').width;
  
  const isSmallMobile = width < 380;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  return {
    isSmallMobile,
    isMobile,
    isTablet,
    isDesktop,
    maxContentWidth: isDesktop ? 600 : isTablet ? 550 : '100%',
    // Amount grid columns
    amountColumns: isSmallMobile ? 3 : isMobile ? 3 : 5,
    spacing: {
      xs: isSmallMobile ? 4 : 6,
      sm: isSmallMobile ? 8 : 10,
      md: isSmallMobile ? 12 : 16,
      lg: isSmallMobile ? 16 : 20,
      xl: isSmallMobile ? 20 : 24,
      xxl: isSmallMobile ? 24 : 32,
    },
    fontSize: {
      xs: isSmallMobile ? 11 : 12,
      sm: isSmallMobile ? 12 : 13,
      md: isSmallMobile ? 14 : 15,
      lg: isSmallMobile ? 16 : 17,
      xl: isSmallMobile ? 18 : 20,
      xxl: isSmallMobile ? 22 : 26,
    },
    buttonHeight: isSmallMobile ? 50 : 56,
    inputHeight: isSmallMobile ? 48 : 52,
  };
};

// Preset donation amounts (JMD) - minimum 1000 JMD for eZeePayments
const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000];

// Recurring frequency options
const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; description: string }[] = [
  { value: 'weekly', label: 'Weekly', description: 'Every week' },
  { value: 'monthly', label: 'Monthly', description: 'Every month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months' },
  { value: 'annually', label: 'Annually', description: 'Every year' },
];

// ============================================================================
// WEB-COMPATIBLE ALERT HELPERS
// ============================================================================
const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'OK', onPress: onConfirm },
    ]);
  }
};

// ============================================================================
// SHIMMER SKELETON COMPONENT
// ============================================================================
function ShimmerEffect({ style, colors }: { style?: any; colors: typeof Colors.light }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.skeleton, opacity },
        style,
      ]}
    />
  );
}

function DonateSkeleton({ colors }: { colors: typeof Colors.light }) {
  const responsive = getResponsiveValues();

  return (
    <View style={[styles.skeletonContainer, { padding: responsive.spacing.md }]}>
      {/* Cause Card */}
      <ShimmerEffect colors={colors} style={[styles.skeletonCard, { height: 80, borderRadius: 16 }]} />
      
      {/* Type Toggle */}
      <ShimmerEffect colors={colors} style={[styles.skeletonCard, { height: 56, borderRadius: 14, marginTop: 24 }]} />
      
      {/* Amount Section */}
      <ShimmerEffect colors={colors} style={[styles.skeletonTitle, { marginTop: 24 }]} />
      <View style={styles.skeletonAmountGrid}>
        {[1, 2, 3, 4, 5].map((i) => (
          <ShimmerEffect key={i} colors={colors} style={styles.skeletonAmountButton} />
        ))}
      </View>
      <ShimmerEffect colors={colors} style={[styles.skeletonInput, { marginTop: 16 }]} />
      
      {/* Anonymous Toggle */}
      <ShimmerEffect colors={colors} style={[styles.skeletonCard, { height: 72, marginTop: 24, borderRadius: 16 }]} />
      
      {/* Summary */}
      <ShimmerEffect colors={colors} style={[styles.skeletonCard, { height: 160, marginTop: 24, borderRadius: 16 }]} />
    </View>
  );
}

// ============================================================================
// HEADER BUTTON COMPONENT
// ============================================================================
function HeaderButton({ 
  onPress, 
  children, 
  colors 
}: { 
  onPress: () => void; 
  children: React.ReactNode; 
  colors: typeof Colors.light;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.headerButton,
          {
            backgroundColor: colorScheme === 'dark' 
              ? colors.surface 
              : colors.surfaceElevated,
            borderColor: colors.border,
          }
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// ANIMATED AMOUNT BUTTON
// ============================================================================
function AmountButton({
  amount,
  isSelected,
  onPress,
  colors,
}: {
  amount: number;
  isSelected: boolean;
  onPress: () => void;
  colors: typeof Colors.light;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(bgAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.card, colors.primarySoft],
  });

  const borderColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View style={[
      styles.amountButtonWrapper,
      { transform: [{ scale: scaleAnim }] }
    ]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[
          styles.amountButton,
          {
            backgroundColor,
            borderColor,
            borderWidth: isSelected ? 2 : 1,
          }
        ]}>
          {isSelected && (
            <View style={[styles.amountCheckmark, { backgroundColor: colors.primary }]}>
              <Check size={10} color="#FFFFFF" strokeWidth={3} />
            </View>
          )}
          <Text style={[
            styles.amountButtonText,
            { color: isSelected ? colors.primary : colors.text },
            isSelected && styles.amountButtonTextSelected,
          ]}>
            ${amount.toLocaleString()}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// ANIMATED TOGGLE COMPONENT
// ============================================================================
function DonationTypeToggle({
  isRecurring,
  onToggle,
  colors,
}: {
  isRecurring: boolean;
  onToggle: (value: boolean) => void;
  colors: typeof Colors.light;
}) {
  const slideAnim = useRef(new Animated.Value(isRecurring ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isRecurring ? 1 : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [isRecurring]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, Dimensions.get('window').width / 2 - 40], // Approximate half width
  });

  return (
    <View style={[styles.toggleContainer, { backgroundColor: colors.surfaceElevated }]}>
      {/* Sliding Indicator */}
      <Animated.View 
        style={[
          styles.toggleIndicator,
          { 
            transform: [{ translateX }],
            backgroundColor: colors.card,
            shadowColor: colors.shadow,
          }
        ]}
      />
      
      {/* Options */}
      <Pressable
        style={styles.toggleOption}
        onPress={() => onToggle(false)}
      >
        <Heart 
          size={18} 
          color={!isRecurring ? colors.primary : colors.textSecondary} 
          fill={!isRecurring ? colors.primary : 'transparent'}
        />
        <Text style={[
          styles.toggleOptionText,
          { color: !isRecurring ? colors.primary : colors.textSecondary },
          !isRecurring && styles.toggleOptionTextActive,
        ]}>
          One-time
        </Text>
      </Pressable>
      
      <Pressable
        style={styles.toggleOption}
        onPress={() => onToggle(true)}
      >
        <RefreshCw 
          size={18} 
          color={isRecurring ? colors.primary : colors.textSecondary} 
        />
        <Text style={[
          styles.toggleOptionText,
          { color: isRecurring ? colors.primary : colors.textSecondary },
          isRecurring && styles.toggleOptionTextActive,
        ]}>
          Recurring
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// ENHANCED INPUT FIELD
// ============================================================================
function EnhancedInput({
  icon: Icon,
  placeholder,
  value,
  onChangeText,
  colors,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  maxLength,
  numberOfLines,
}: {
  icon?: any;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  colors: typeof Colors.light;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  maxLength?: number;
  numberOfLines?: number;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const iconColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.primary],
  });

  return (
    <Animated.View style={[
      styles.inputContainer,
      {
        backgroundColor: colors.card,
        borderColor,
        borderWidth: isFocused ? 2 : 1,
      },
      multiline && styles.inputContainerMultiline,
    ]}>
      {Icon && (
        <Animated.View style={{ opacity: 1 }}>
          <Icon 
            size={20} 
            color={isFocused ? colors.primary : colors.textSecondary} 
          />
        </Animated.View>
      )}
      <TextInput
        style={[
          styles.input,
          { color: colors.text },
          multiline && styles.inputMultiline,
          !Icon && { paddingLeft: 0 },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        maxLength={maxLength}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </Animated.View>
  );
}

// ============================================================================
// GRADIENT SUBMIT BUTTON
// ============================================================================
function SubmitButton({
  onPress,
  label,
  isLoading,
  isDisabled,
  colors,
}: {
  onPress: () => void;
  label: string;
  isLoading: boolean;
  isDisabled: boolean;
  colors: typeof Colors.light;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const responsive = getResponsiveValues();

  const handlePressIn = () => {
    if (!isDisabled && !isLoading) {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[
      styles.submitButtonWrapper,
      { transform: [{ scale: scaleAnim }] },
      (isDisabled || isLoading) && styles.submitButtonDisabled,
    ]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled || isLoading}
        style={styles.submitButtonPressable}
      >
        <LinearGradient
          colors={isDisabled || isLoading 
            ? [colors.textTertiary, colors.textSecondary]
            : Colors.gradients.primary
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.submitButton, { height: responsive.buttonHeight }]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <CreditCard size={22} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
      {/* Shadow Layer */}
      {!isDisabled && !isLoading && (
        <View style={[styles.submitButtonShadow, { backgroundColor: colors.primary }]} />
      )}
    </Animated.View>
  );
}

// ============================================================================
// FREQUENCY PICKER
// ============================================================================
function FrequencyPicker({
  frequency,
  isOpen,
  onToggle,
  onSelect,
  colors,
}: {
  frequency: RecurringFrequency;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: RecurringFrequency) => void;
  colors: typeof Colors.light;
}) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const selectedOption = FREQUENCY_OPTIONS.find(f => f.value === frequency);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOpen]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const maxHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280],
  });

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[
          styles.frequencySelector,
          {
            backgroundColor: colors.card,
            borderColor: isOpen ? colors.primary : colors.border,
            borderWidth: isOpen ? 2 : 1,
          }
        ]}
      >
        <View style={styles.frequencyInfo}>
          <Text style={[styles.frequencyText, { color: colors.text }]}>
            {selectedOption?.label}
          </Text>
          <Text style={[styles.frequencyDescription, { color: colors.textSecondary }]}>
            {selectedOption?.description}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={20} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[
        styles.frequencyOptionsContainer,
        { maxHeight, opacity: heightAnim }
      ]}>
        <View style={[
          styles.frequencyOptions,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          }
        ]}>
          {FREQUENCY_OPTIONS.map((option, index) => (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.frequencyOption,
                {
                  backgroundColor: pressed 
                    ? colors.surfacePressed 
                    : frequency === option.value 
                      ? colors.primarySoft 
                      : 'transparent',
                },
                index < FREQUENCY_OPTIONS.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                },
              ]}
              onPress={() => onSelect(option.value)}
            >
              <View>
                <Text style={[
                  styles.frequencyOptionLabel,
                  { color: frequency === option.value ? colors.primary : colors.text }
                ]}>
                  {option.label}
                </Text>
                <Text style={[styles.frequencyOptionDesc, { color: colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
              {frequency === option.value && (
                <View style={[styles.frequencyCheckmark, { backgroundColor: colors.primary }]}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function DonateScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[]; recurring?: string | string[] }>();
  const slugParam = params.slug;
  const recurringParamRaw = params.recurring;
  const id = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const recurringParam = Array.isArray(recurringParamRaw) ? recurringParamRaw[0] : recurringParamRaw;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();
  const responsive = getResponsiveValues();

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
        const response = await getCauseById(id, user?.id);
        if (response.success && response.data) {
          setCause(response.data);
          if (user) {
            setDonorName(user.fullName || '');
            setDonorEmail(user.email || '');
          }
        } else {
          showAlert('Error', 'Failed to load cause');
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
      showAlert('Invalid Amount', 'Please enter a donation amount');
      return false;
    }

    const MINIMUM_PAYMENT = 1000;
    if (finalAmount < MINIMUM_PAYMENT) {
      showAlert(
        'Minimum Payment Required',
        `The minimum payment amount is ${formatCurrency(MINIMUM_PAYMENT)}. eZeePayments does not accept payments below ${formatCurrency(MINIMUM_PAYMENT)}.`
      );
      return false;
    }

    if (cause?.minimumDonation && finalAmount < cause.minimumDonation) {
      showAlert(
        'Minimum Donation',
        `The minimum donation for this cause is ${formatCurrency(cause.minimumDonation)}`
      );
      return false;
    }

    if (!isAnonymous) {
      if (!donorName.trim()) {
        showAlert('Name Required', 'Please enter your name or donate anonymously');
        return false;
      }
      if (!donorEmail.trim()) {
        showAlert('Email Required', 'Please enter your email for the receipt');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(donorEmail.trim())) {
        showAlert('Invalid Email', 'Please enter a valid email address');
        return false;
      }
    }

    const MINIMUM_SUBSCRIPTION = 1000;
    if (isRecurring && finalAmount < MINIMUM_SUBSCRIPTION) {
      showAlert(
        'Minimum Subscription Required',
        `The minimum subscription amount is ${formatCurrency(MINIMUM_SUBSCRIPTION)}.`
      );
      return false;
    }

    if (isRecurring && !user) {
      showConfirm(
        'Sign In Required',
        'You need to be signed in to set up recurring donations',
        () => router.push('/login')
      );
      return false;
    }

    return true;
  }, [finalAmount, cause, isAnonymous, donorName, donorEmail, isRecurring, user, router]);

  // Map frequency
  const mapFrequency = (freq: RecurringFrequency): PaymentFrequency => {
    switch (freq) {
      case 'weekly': return 'weekly';
      case 'monthly': return 'monthly';
      case 'quarterly': return 'quarterly';
      case 'annually': return 'annually';
      default: return 'monthly';
    }
  };

  // Handle submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm() || !cause) return;

    setSubmitting(true);

    try {
      const donorEmailValue = isAnonymous ? undefined : donorEmail.trim();
      const donorNameValue = isAnonymous ? undefined : donorName.trim();

      if (isRecurring && user) {
        const donationResponse = await createDonation({
          causeId: cause.id,
          amount: finalAmount,
          userId: user.id,
          donorName: donorNameValue,
          donorEmail: donorEmailValue,
          isAnonymous,
          message: message.trim() || undefined,
        });

        if (!donationResponse.success || !donationResponse.data) {
          throw new Error('Failed to create donation record');
        }

        const donation = donationResponse.data;

        const subscriptionResult = await processSubscription({
          amount: finalAmount,
          frequency: mapFrequency(frequency),
          subscriptionType: 'recurring_donation',
          referenceId: cause.id, // Use cause ID (UUID) for recurring donations
          userId: user.id,
          customerEmail: donorEmailValue || user.email || '',
          customerName: donorNameValue || user.fullName,
          description: `Recurring donation to ${cause.title}`,
          platform: Platform.OS === 'web' ? 'web' : 'app',
          returnPath: `/causes/${id}`, // Return to cause page after payment
        });

        if (!subscriptionResult.success) {
          showAlert(
            'Payment Error',
            subscriptionResult.error || 'Failed to process subscription. Please try again.'
          );
          setSubmitting(false);
          return;
        }

        // Don't show alert - it blocks the redirect to eZeePayments!
        // On web: window.location.href redirect is already scheduled
        // On mobile native: in-app browser has opened
        console.log('🔵 [DONATE] Recurring donation initiated, redirecting to payment...');

        if (Platform.OS !== 'web') {
          // On mobile native, reset submitting state
          setSubmitting(false);
        }
        // On web, don't reset state - page is redirecting
        return;
      }

      // One-time donation
      const donationResponse = await createDonation({
        causeId: cause.id,
        amount: finalAmount,
        userId: user?.id,
        donorName: donorNameValue,
        donorEmail: donorEmailValue,
        isAnonymous,
        message: message.trim() || undefined,
      });

      if (!donationResponse.success || !donationResponse.data) {
        throw new Error('Failed to create donation record');
      }

      const donation = donationResponse.data;
      const orderId = `DON_${donation.id}_${Date.now()}`;

      console.log('🔵 [DONATE] Starting payment process...');
      console.log('🔵 [DONATE] Amount:', finalAmount);
      console.log('🔵 [DONATE] Order ID:', orderId);
      console.log('🔵 [DONATE] Reference ID (donation.id):', donation.id);

      const paymentResult = await processPayment({
        amount: finalAmount,
        orderId,
        orderType: 'donation',
        referenceId: donation.id,
        userId: user?.id,
        customerEmail: donorEmailValue || user?.email || '',
        customerName: donorNameValue || user?.fullName,
        description: `Donation to ${cause.title}`,
        platform: Platform.OS === 'web' ? 'web' : 'app',
        returnPath: `/causes/${id}`, // Return to cause page after payment
      });

      console.log('🔵 [DONATE] Payment result:', paymentResult);

      if (!paymentResult.success) {
        showAlert(
          'Payment Error',
          paymentResult.error || 'Failed to process payment. Please try again.'
        );
        setSubmitting(false);
        return;
      }

      // ✅ FIXED: Show "processing" message, not "complete"
      // The actual success is confirmed via webhook
      showAlert(
        'Payment Initiated',
        'You\'re being redirected to our secure payment gateway. Complete your payment there to finish your donation.',
        () => {
          // Don't navigate back immediately - let user complete payment
          // They'll return to the app after payment
        }
      );
    } catch (error) {
      console.error('Donation error:', error);
      showAlert('Error', error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validateForm, cause, isRecurring, user, finalAmount, frequency, isAnonymous, donorName, donorEmail, message, router]);

  const selectedFrequency = FREQUENCY_OPTIONS.find(f => f.value === frequency);

  // Loading state
  if (loading || !cause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          }
        ]}>
          <HeaderButton onPress={() => router.back()} colors={colors}>
            <ArrowLeft size={22} color={colors.text} />
          </HeaderButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Donate</Text>
          <View style={styles.headerSpacer} />
        </View>

        <DonateSkeleton colors={colors} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        }
      ]}>
        <HeaderButton onPress={() => router.back()} colors={colors}>
          <ArrowLeft size={22} color={colors.text} />
        </HeaderButton>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Donate</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <WebContainer>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingHorizontal: responsive.spacing.md,
                paddingBottom: Platform.OS === 'web' ? 120 : insets.bottom + 120,
                maxWidth: responsive.maxContentWidth,
                alignSelf: 'center',
                width: '100%',
              }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Cause Info Card */}
            <View style={[
              styles.causeCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadow,
              }
            ]}>
              <View style={[styles.causeIconContainer, { backgroundColor: colors.primarySoft }]}>
                <Heart size={24} color={colors.primary} fill={colors.primary} />
              </View>
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
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Donation Type
                </Text>
                <DonationTypeToggle
                  isRecurring={isRecurring}
                  onToggle={setIsRecurring}
                  colors={colors}
                />
              </View>
            )}

            {/* Frequency Picker */}
            {isRecurring && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Frequency
                </Text>
                <FrequencyPicker
                  frequency={frequency}
                  isOpen={showFrequencyPicker}
                  onToggle={() => setShowFrequencyPicker(!showFrequencyPicker)}
                  onSelect={(value) => {
                    setFrequency(value);
                    setShowFrequencyPicker(false);
                  }}
                  colors={colors}
                />
              </View>
            )}

            {/* Amount Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Select Amount (JMD)
              </Text>
              <View style={styles.amountGrid}>
                {PRESET_AMOUNTS.map((amount) => (
                  <AmountButton
                    key={amount}
                    amount={amount}
                    isSelected={selectedAmount === amount && !isCustom}
                    onPress={() => handlePresetSelect(amount)}
                    colors={colors}
                  />
                ))}
              </View>

              {/* Custom Amount */}
              <View style={[
                styles.customAmountContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: isCustom ? colors.primary : colors.border,
                  borderWidth: isCustom ? 2 : 1,
                }
              ]}>
                <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>
                  J$
                </Text>
                <TextInput
                  style={[styles.customAmountInput, { color: colors.text }]}
                  placeholder="Enter custom amount"
                  placeholderTextColor={colors.textTertiary}
                  value={customAmount}
                  onChangeText={handleCustomAmountChange}
                  keyboardType="numeric"
                  onFocus={() => setIsCustom(true)}
                />
                {isCustom && customAmount && (
                  <View style={[styles.customCheckmark, { backgroundColor: colors.primary }]}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </View>

              {cause.minimumDonation > 0 && (
                <Text style={[styles.minimumNote, { color: colors.textSecondary }]}>
                  Minimum donation: {formatCurrency(cause.minimumDonation)}
                </Text>
              )}
            </View>

            {/* Anonymous Toggle */}
            <View style={styles.section}>
              <Pressable
                style={({ pressed }) => [
                  styles.anonymousRow,
                  {
                    backgroundColor: pressed ? colors.surfacePressed : colors.card,
                    borderColor: isAnonymous ? colors.primary : colors.border,
                    borderWidth: isAnonymous ? 2 : 1,
                  }
                ]}
                onPress={() => setIsAnonymous(!isAnonymous)}
              >
                <View style={styles.anonymousInfo}>
                  <View style={[
                    styles.anonymousIconContainer,
                    { backgroundColor: isAnonymous ? colors.primarySoft : colors.surfaceElevated }
                  ]}>
                    {isAnonymous 
                      ? <EyeOff size={20} color={colors.primary} />
                      : <Eye size={20} color={colors.textSecondary} />
                    }
                  </View>
                  <View style={styles.anonymousTextContainer}>
                    <Text style={[styles.anonymousLabel, { color: colors.text }]}>
                      Donate Anonymously
                    </Text>
                    <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
                      Your name won't be shown publicly
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isAnonymous}
                  onValueChange={setIsAnonymous}
                  trackColor={{ false: colors.border, true: colors.primaryMuted }}
                  thumbColor={isAnonymous ? colors.primary : colors.textTertiary}
                  ios_backgroundColor={colors.border}
                />
              </Pressable>
            </View>

            {/* Donor Info */}
            {!isAnonymous && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Your Information
                </Text>
                <EnhancedInput
                  icon={User}
                  placeholder="Full Name"
                  value={donorName}
                  onChangeText={setDonorName}
                  colors={colors}
                  autoCapitalize="words"
                />
                <View style={{ height: 12 }} />
                <EnhancedInput
                  icon={Mail}
                  placeholder="Email (for receipt)"
                  value={donorEmail}
                  onChangeText={setDonorEmail}
                  colors={colors}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Message */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Message (Optional)
              </Text>
              <EnhancedInput
                placeholder="Add a message of support..."
                value={message}
                onChangeText={setMessage}
                colors={colors}
                multiline
                maxLength={200}
                numberOfLines={3}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {message.length}/200
              </Text>
            </View>

            {/* Summary Card */}
            <View style={[
              styles.summaryCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadow,
              }
            ]}>
              <View style={styles.summaryHeader}>
                <Sparkles size={18} color={colors.primary} />
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  Donation Summary
                </Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  Amount
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatCurrency(finalAmount)}
                </Text>
              </View>

              {isRecurring && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                    Frequency
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {selectedFrequency?.label}
                  </Text>
                </View>
              )}

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  Donation type
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {isAnonymous ? 'Anonymous' : 'Public'}
                </Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />

              <View style={styles.summaryTotalRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>
                  {isRecurring ? 'Per payment' : 'Total'}
                </Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>
                  {formatCurrency(finalAmount)}
                </Text>
              </View>
            </View>

            {/* Security Badge */}
            <View style={[styles.securityBadge, { backgroundColor: colors.successSoft }]}>
              <Shield size={16} color={colors.success} />
              <Text style={[styles.securityText, { color: colors.successText }]}>
                Your payment is secured by eZeePayments
              </Text>
            </View>

          </ScrollView>
        </WebContainer>
      </KeyboardAvoidingView>

      {/* Bottom Bar */}
      <View style={[
        styles.bottomBar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + 16,
        }
      ]}>
        <View style={{ maxWidth: responsive.maxContentWidth, alignSelf: 'center', width: '100%' }}>
          <SubmitButton
            onPress={handleSubmit}
            label={isRecurring 
              ? `Donate ${formatCurrency(finalAmount)}/${frequency}` 
              : `Donate ${formatCurrency(finalAmount)}`
            }
            isLoading={submitting}
            isDisabled={finalAmount <= 0}
            colors={colors}
          />
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
  },

  // Layout
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },

  // Cause Card
  causeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  causeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  causeInfo: {
    flex: 1,
  },
  causeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  causeProgress: {
    fontSize: 13,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    position: 'relative',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '48%',
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    zIndex: 1,
  },
  toggleOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  toggleOptionTextActive: {
    fontWeight: '600',
  },

  // Frequency Picker
  frequencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
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
  frequencyOptionsContainer: {
    overflow: 'hidden',
  },
  frequencyOptions: {
    marginTop: 8,
    borderRadius: 14,
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
  frequencyCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Amount Grid
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  amountButtonWrapper: {
    width: '31%',
  },
  amountButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  amountCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  amountButtonTextSelected: {
    fontWeight: '700',
  },

  // Custom Amount
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
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
  customCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimumNote: {
    fontSize: 13,
    marginTop: 8,
  },

  // Anonymous Toggle
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  anonymousInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  anonymousIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Input Fields
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  inputContainerMultiline: {
    height: 'auto',
    minHeight: 100,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: 0,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },

  // Summary Card
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  summaryDivider: {
    height: 1,
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
  },

  // Security Badge
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 16,
  },
  securityText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Bottom Bar
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        bottom: 0,
      },
    }),
  },
  submitButtonWrapper: {
    position: 'relative',
  },
  submitButtonPressable: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  submitButtonShadow: {
    position: 'absolute',
    bottom: -4,
    left: 12,
    right: 12,
    height: 24,
    borderRadius: 14,
    opacity: 0.3,
    zIndex: -1,
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
  },
  skeletonCard: {
    width: '100%',
  },
  skeletonTitle: {
    height: 20,
    width: '40%',
    borderRadius: 6,
  },
  skeletonAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  skeletonAmountButton: {
    width: '31%',
    height: 52,
    borderRadius: 12,
  },
  skeletonInput: {
    height: 52,
    borderRadius: 14,
    width: '100%',
  },
});
